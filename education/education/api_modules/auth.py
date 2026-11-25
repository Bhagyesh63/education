# Copyright (c) 2015, Frappe Technologies and contributors
# For license information, please see license.txt

import frappe
from frappe import _
from education.education.api_modules.common import (
    _resolve_portal_student,
    get_guardian_for_user,
    get_guardians_for_user,
    get_instructor_for_user,
)

DEMO_ACCOUNT_LIMITS = {"students": 12, "teachers": 8, "guardians": 8}
PREVIEW_TARGET_LIMIT = 50


# nosemgrep: guest-whitelisted-method -- returns only a Guest stub when not logged in
@frappe.whitelist(allow_guest=True)
def get_user_info():
    if frappe.session.user == "Guest":
        return {"name": "Guest", "session_user": False}

    users = frappe.db.get_list(
        "User",
        fields=["name", "email", "enabled", "user_image", "full_name", "user_type"],
        filters={"name": frappe.session.user},
    )
    if not users:
        return {"name": frappe.session.user, "session_user": True}
    current_user = users[0]
    current_user["session_user"] = True
    return current_user


# nosemgrep: guest-whitelisted-method -- returns "Guest" when not logged in
@frappe.whitelist(allow_guest=True)
def get_user_role():
    if frappe.session.user == "Guest":
        return "Guest"

    roles = frappe.get_roles()
    if (
        "System Manager" in roles
        or "Education Manager" in roles
        or "Administrator" in roles
    ):
        return "Administrator"
    if "Instructor" in roles or "Academics User" in roles:
        return "Instructor"
    if "Guardian" in roles:
        return "Guardian"
    if "Student" in roles:
        return "Student"

    return "Student"


# nosemgrep: guest-whitelisted-method -- public school name and logo for the login/landing page
@frappe.whitelist(allow_guest=True)
def get_school_abbr_logo():
    abbr = frappe.db.get_single_value(
        "Education Settings", "school_college_name_abbreviation"
    ) or frappe.defaults.get_global_default("company")
    logo = frappe.db.get_single_value("Education Settings", "school_college_logo")
    return {"name": abbr, "logo": logo}


# nosemgrep: guest-whitelisted-method -- returns None for Guest; SPA fetches the token before writes
@frappe.whitelist(allow_guest=True, methods=["GET"])
def get_csrf_token():
    """CSRF token of the current session, for the SPA's write requests.

    Only readable same-origin (cross-site pages cannot read the JSON response),
    so exposing it here is equivalent to Frappe injecting it into desk pages."""
    from frappe.sessions import get_csrf_token as _session_csrf_token

    if frappe.session.user == "Guest":
        return None
    return _session_csrf_token()


# nosemgrep: guest-whitelisted-method -- login endpoint, must be callable before a session exists
@frappe.whitelist(allow_guest=True, methods=["POST"])
def portal_login(usr: str | None = None, pwd: str | None = None):
    """Portal authentication: logs in through Frappe's standard LoginManager flow and
    returns the pre-hydrated portal context in the same round-trip."""
    usr = usr or frappe.form_dict.get("usr")
    pwd = pwd or frappe.form_dict.get("pwd")

    if not usr or not pwd:
        frappe.throw(_("Email and Password are required"), frappe.AuthenticationError)

    # Standard login: before_login / on_login / on_session_creation hooks, disabled
    # password login, login attempt tracking, 2FA, IP restriction, login hours and
    # forced password reset all apply exactly as for /api/method/login.
    frappe.form_dict.usr = usr
    frappe.form_dict.pwd = pwd
    login_manager = frappe.local.login_manager
    if login_manager.login() is False:
        # 2FA verification or password reset pending: frappe.local.response already
        # carries the standard payload for the client; no session was created.
        return None

    # login() switched frappe.session to the new user; drop permission data that may
    # have been cached for Guest earlier in this request.
    frappe.local.user_perms = None
    frappe.local.role_permissions = {}

    context = get_portal_context()

    return {
        "message": "Logged In",
        "home_page": "/dashboard",
        "full_name": login_manager.full_name,
        "user": login_manager.user,
        "context": context,
    }


def _apply_student_context(context, stu_id):
    """Hydrate a portal context dict with a student's profile, programs and active enrollment."""
    from education.education.api_modules.students import (
        get_student_profile,
        get_program_context,
    )

    prof = get_student_profile(stu_id)
    if not prof:
        return context
    context["student_info"] = prof.get("student")
    context["programs"] = prof.get("programs")
    context["suggested_program"] = prof.get("suggested_program")
    context["suggested_academic_year"] = prof.get("suggested_academic_year")
    context["suggested_enrollment"] = prof.get("suggested_enrollment")
    active_p = prof.get("suggested_program")
    active_y = prof.get("suggested_academic_year")
    active_enr = prof.get("suggested_enrollment")
    if active_p or active_enr:
        context["active_program"] = active_p
        context["active_academic_year"] = active_y
        context["active_enrollment_id"] = active_enr
        p_ctx = get_program_context(
            stu_id, active_p, academic_year=active_y, program_enrollment=active_enr
        )
        context["enrollment"] = p_ctx.get("enrollment")
        context["student_groups"] = p_ctx.get("student_groups")
    return context


def _apply_guardian_context(context, guardians):
    context["guardian"] = _get_guardian_details(guardians[0]) if guardians else None
    wards = _get_wards_for_guardians(guardians)
    context["students"] = wards
    if wards:
        active_stu = wards[0].get("student")
        context["active_student_id"] = active_stu
        _apply_student_context(context, active_stu)
    return context


def _apply_staff_context(context):
    db_programs = frappe.get_all(
        "Program", fields=["name as program"], order_by="name asc"
    )
    db_groups = frappe.get_all(
        "Student Group",
        filters={"disabled": 0},
        fields=["name as label"],
        order_by="name asc",
    )
    context["programs"] = db_programs or []
    context["student_groups"] = db_groups or []
    context["active_program"] = db_programs[0]["program"] if db_programs else None
    return context


def _get_instructor_details(instructor):
    if not instructor:
        return None
    return frappe.db.get_value(
        "Instructor",
        instructor,
        ["name", "instructor_name", "department"],
        as_dict=True,
    )


# nosemgrep: guest-whitelisted-method -- returns an empty stub for Guest (SPA bootstrap)
@frappe.whitelist(allow_guest=True)
def get_portal_context():
    """Returns role-aware bootstrap data for the portal SPA."""
    current_user = frappe.session.user
    if current_user == "Guest":
        return {
            "role": None,
            "user": None,
            "full_name": None,
        }

    role = get_user_role()
    # get_user_role() falls back to "Student" for users without any education role;
    # such users have no portal profile, so report no role instead of an empty student.
    if (
        role == "Student"
        and "Student" not in frappe.get_roles()
        and not _resolve_portal_student()
    ):
        role = None

    full_name = frappe.db.get_value("User", current_user, "full_name") or current_user
    context = {"role": role, "user": current_user, "full_name": full_name}

    if role == "Guardian":
        _apply_guardian_context(context, get_guardians_for_user())
    elif role == "Student":
        stu_id = _resolve_portal_student()
        context["student"] = stu_id
        if stu_id:
            _apply_student_context(context, stu_id)
    elif role == "Instructor":
        context["instructor"] = _get_instructor_details(
            get_instructor_for_user(current_user)
        )
        _apply_staff_context(context)
    elif role == "Administrator":
        context["admin"] = {"user": current_user, "name": full_name}
        _apply_staff_context(context)

    return context


def _get_guardian_details(guardian):
    if not guardian:
        return None
    return frappe.db.get_value(
        "Guardian",
        guardian,
        [
            "name",
            "guardian_name",
            "email_address",
            "mobile_number",
            "image",
            "date_of_birth",
            "nationality",
            "gender",
            "blood_group",
            "work_address",
            "occupation",
        ],
        as_dict=True,
    )


def _get_wards_for_guardians(guardians):
    if not guardians:
        return []

    student_guardian = frappe.qb.DocType("Student Guardian")
    student = frappe.qb.DocType("Student")

    students = (
        frappe.qb.from_(student_guardian)
        .inner_join(student)
        .on(student.name == student_guardian.parent)
        .select(
            student_guardian.parent.as_("student"),
            student.student_name,
            student.image,
            student_guardian.relation,
        )
        .where(student_guardian.guardian.isin(guardians))
        .where(student_guardian.parenttype == "Student")
        .orderby(student_guardian.idx)
        .run(as_dict=1)
    )

    wards = {}
    for row in students:
        wards.setdefault(row.student, row)
    return list(wards.values())


# nosemgrep: guest-whitelisted-method -- returns None for Guest (no guardian is linked to Guest)
@frappe.whitelist(allow_guest=True)
def get_guardian_info():
    return _get_guardian_details(get_guardian_for_user())


# nosemgrep: guest-whitelisted-method -- returns [] for Guest (no guardian is linked to Guest)
@frappe.whitelist(allow_guest=True)
def get_guardian_students():
    return _get_wards_for_guardians(get_guardians_for_user())


# ==============================================================================
# Developer-mode login directory
# ==============================================================================


def _enabled_user_emails(candidates):
    """Map candidate user ids/emails -> enabled User email (never exposes anything else)."""
    candidates = [c for c in candidates if c and c not in ("Administrator", "Guest")]
    if not candidates:
        return {}
    users = frappe.get_all(
        "User",
        filters={"enabled": 1},
        or_filters={"name": ["in", candidates], "email": ["in", candidates]},
        fields=["name", "email"],
    )
    out = {}
    for u in users:
        out[u.name] = u.email or u.name
        if u.email:
            out[u.email] = u.email
    return out


def _program_badges(students):
    if not students:
        return {}
    rows = frappe.get_all(
        "Program Enrollment",
        filters={"student": ["in", students], "docstatus": ["<", 2]},
        fields=["student", "program", "academic_year"],
        order_by="academic_year asc, creation asc",
    )
    badges = {}
    for r in rows:
        progs = badges.setdefault(r.student, [])
        if r.program and r.program not in progs:
            progs.append(r.program)
    return {k: " & ".join(v) for k, v in badges.items()}


def _demo_students(limit):
    rows = frappe.get_all(
        "Student",
        filters={"enabled": 1},
        fields=["name", "student_name", "user", "student_email_id"],
        order_by="creation asc",
        limit=limit * 3,
    )
    emails = _enabled_user_emails(
        [r.user for r in rows] + [r.student_email_id for r in rows]
    )
    picked = []
    for r in rows:
        email = emails.get(r.user) or emails.get(r.student_email_id)
        if email:
            picked.append((r, email))
        if len(picked) >= limit:
            break
    badges = _program_badges([r.name for r, _e in picked])
    return [
        {
            "id": r.name,
            "name": r.student_name,
            "email": email,
            "badge": badges.get(r.name) or _("Not enrolled"),
            "role": "Student",
        }
        for r, email in picked
    ]


def _demo_guardians(limit):
    rows = frappe.get_all(
        "Guardian",
        fields=["name", "guardian_name", "user", "email_address"],
        order_by="creation asc",
        limit=limit * 3,
    )
    emails = _enabled_user_emails(
        [r.user for r in rows] + [r.email_address for r in rows]
    )
    picked = []
    for r in rows:
        email = emails.get(r.user) or emails.get(r.email_address)
        if email:
            picked.append((r, email))
        if len(picked) >= limit:
            break

    wards = {}
    if picked:
        for w in frappe.get_all(
            "Student Guardian",
            filters={
                "guardian": ["in", [r.name for r, _e in picked]],
                "parenttype": "Student",
            },
            fields=["guardian", "parent", "relation"],
            order_by="idx asc",
        ):
            wards.setdefault(w.guardian, []).append(w)
        student_names = (
            dict(
                frappe.get_all(
                    "Student",
                    filters={
                        "name": [
                            "in",
                            list({w.parent for ws in wards.values() for w in ws}),
                        ]
                    },
                    fields=["name", "student_name"],
                    as_list=True,
                )
            )
            if wards
            else {}
        )

    out = []
    for r, email in picked:
        ws = wards.get(r.name, [])
        if ws:
            relation = ws[0].relation
            label = (
                _("Parent") if relation in ("Father", "Mother", None, "") else relation
            )
            names = ", ".join(student_names.get(w.parent, w.parent) for w in ws)
            badge = _("{0} of {1}").format(label, names)
        else:
            badge = _("No linked students")
        out.append(
            {
                "id": r.name,
                "name": r.guardian_name,
                "email": email,
                "badge": badge,
                "role": "Guardian",
            }
        )
    return out


def _demo_teachers(limit):
    instructors = frappe.get_all(
        "Instructor",
        filters={"status": ["!=", "Left"]},
        fields=["name", "instructor_name", "employee", "department"],
        order_by="creation asc",
        limit=limit * 3,
    )
    employee_users = {}
    employees = [i.employee for i in instructors if i.employee]
    if employees and frappe.db.exists("DocType", "Employee"):
        employee_users = dict(
            frappe.get_all(
                "Employee",
                filters={"name": ["in", employees], "user_id": ["is", "set"]},
                fields=["name", "user_id"],
                as_list=True,
            )
        )

    # Fallback link: User with the Instructor role whose full name matches the instructor
    instructor_role_users = frappe.get_all(
        "Has Role",
        filters={"role": "Instructor", "parenttype": "User"},
        pluck="parent",
    )
    name_to_user = {}
    if instructor_role_users:
        for u in frappe.get_all(
            "User",
            filters={"name": ["in", instructor_role_users], "enabled": 1},
            fields=["name", "full_name"],
        ):
            if u.full_name:
                name_to_user.setdefault(u.full_name, u.name)

    candidates = {}
    for i in instructors:
        candidates[i.name] = employee_users.get(i.employee) or name_to_user.get(
            i.instructor_name
        )
    emails = _enabled_user_emails(list(candidates.values()))

    departments = list({i.department for i in instructors if i.department})
    department_names = (
        dict(
            frappe.get_all(
                "Department",
                filters={"name": ["in", departments]},
                fields=["name", "department_name"],
                as_list=True,
            )
        )
        if departments and frappe.db.exists("DocType", "Department")
        else {}
    )

    out = []
    for i in instructors:
        email = emails.get(candidates.get(i.name))
        if not email:
            continue
        badge = department_names.get(i.department) or i.department
        if not badge:
            courses = frappe.get_all(
                "Course Schedule",
                filters={"instructor": i.name},
                fields=["course"],
                group_by="course",
                order_by="course asc",
                limit=2,
            )
            badge = ", ".join(c.course for c in courses if c.course) or _("Faculty")
        out.append(
            {
                "id": i.name,
                "name": i.instructor_name,
                "email": email,
                "badge": badge,
                "role": "Teacher / Faculty",
            }
        )
        if len(out) >= limit:
            break
    return out


# nosemgrep: guest-whitelisted-method -- login quick-pick, empty unless developer_mode is on
@frappe.whitelist(allow_guest=True)
def get_demo_accounts():
    """Quick-pick login directory built from real Student / Instructor / Guardian users.

    Only available when developer_mode is enabled; returns empty lists otherwise.
    Never returns passwords - only display name, login email and a short badge.
    """
    empty = {"enabled": False, "students": [], "teachers": [], "guardians": []}
    if not frappe.conf.get("developer_mode"):
        return empty

    return {
        "enabled": True,
        "students": _demo_students(DEMO_ACCOUNT_LIMITS["students"]),
        "teachers": _demo_teachers(DEMO_ACCOUNT_LIMITS["teachers"]),
        "guardians": _demo_guardians(DEMO_ACCOUNT_LIMITS["guardians"]),
    }


# ==============================================================================
# Administrator "preview as" (System Manager only)
# ==============================================================================


@frappe.whitelist()
def get_preview_targets():
    """Real records an administrator can preview the portal as."""
    frappe.only_for("System Manager")

    students = frappe.get_all(
        "Student",
        filters={"enabled": 1},
        fields=["name", "student_name"],
        order_by="student_name asc",
        limit=PREVIEW_TARGET_LIMIT,
    )
    badges = _program_badges([s.name for s in students])
    for s in students:
        s["badge"] = badges.get(s.name)

    guardians = frappe.get_all(
        "Guardian",
        fields=["name", "guardian_name"],
        order_by="guardian_name asc",
        limit=PREVIEW_TARGET_LIMIT,
    )
    if guardians:
        ward_rows = frappe.get_all(
            "Student Guardian",
            filters={
                "guardian": ["in", [g.name for g in guardians]],
                "parenttype": "Student",
            },
            fields=["guardian", "parent"],
        )
        student_names = (
            dict(
                frappe.get_all(
                    "Student",
                    filters={"name": ["in", list({w.parent for w in ward_rows})]},
                    fields=["name", "student_name"],
                    as_list=True,
                )
            )
            if ward_rows
            else {}
        )
        wards = {}
        for w in ward_rows:
            wards.setdefault(w.guardian, []).append(
                student_names.get(w.parent, w.parent)
            )
        for g in guardians:
            g["badge"] = ", ".join(wards.get(g.name, [])) or None

    instructors = frappe.get_all(
        "Instructor",
        filters={"status": ["!=", "Left"]},
        fields=["name", "instructor_name", "department as badge"],
        order_by="instructor_name asc",
        limit=PREVIEW_TARGET_LIMIT,
    )

    return {"students": students, "guardians": guardians, "instructors": instructors}


@frappe.whitelist()
def get_preview_context(target_role: str, target: str):
    """Portal bootstrap context for a specific real record, for administrator preview."""
    frappe.only_for("System Manager")

    if target_role == "Student":
        if not frappe.db.exists("Student", target):
            frappe.throw(
                _("Student {0} not found").format(target), frappe.DoesNotExistError
            )
        name = frappe.db.get_value("Student", target, "student_name")
        context = {
            "role": "Student",
            "user": frappe.session.user,
            "full_name": name,
            "student": target,
        }
        _apply_student_context(context, target)
    elif target_role == "Guardian":
        if not frappe.db.exists("Guardian", target):
            frappe.throw(
                _("Guardian {0} not found").format(target), frappe.DoesNotExistError
            )
        name = frappe.db.get_value("Guardian", target, "guardian_name")
        context = {"role": "Guardian", "user": frappe.session.user, "full_name": name}
        _apply_guardian_context(context, [target])
    elif target_role == "Instructor":
        if not frappe.db.exists("Instructor", target):
            frappe.throw(
                _("Instructor {0} not found").format(target), frappe.DoesNotExistError
            )
        details = _get_instructor_details(target)
        context = {
            "role": "Instructor",
            "user": frappe.session.user,
            "full_name": details.instructor_name,
            "instructor": details,
        }
        _apply_staff_context(context)
    else:
        frappe.throw(_("Unsupported preview role {0}").format(target_role))

    context["preview"] = True
    return context
