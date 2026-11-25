# Copyright (c) 2015, Frappe Technologies and contributors
# For license information, please see license.txt

import frappe
from frappe import _
from frappe.email.doctype.email_group.email_group import add_subscribers

PORTAL_STUDENT_FIELDS = [
    "name",
    "student_name",
    "student_email_id",
    "student_mobile_number",
    "image",
    "gender",
    "blood_group",
    "nationality",
    "date_of_birth",
    "joining_date",
    "address_line_1",
    "address_line_2",
    "city",
    "state",
    "pincode",
    "country",
]

PROGRAM_ENROLLMENT_FIELDS = [
    "name as program_enrollment",
    "program",
    "student_name",
    "student_batch_name as student_batch",
    "student_category",
    "academic_term",
    "academic_year",
]


# ==============================================================================
# Helper & Security Utilities
# ==============================================================================

def _resolve_portal_student(student=None):
    if student:
        return student

    user = frappe.session.user
    if user in ("Guest", "Administrator"):
        return None

    return frappe.db.get_value("Student", {"user": user}, "name")


def check_permission(student, resource_type):
    user = frappe.session.user
    if user in ("Administrator", "Guest"):
        return

    student_user = frappe.db.get_value("Student", student, "user")
    if student_user == user:
        return

    if is_guardian_of(student, user):
        return

    user_roles = frappe.get_roles()
    if any(
        r in user_roles
        for r in [
            "Instructor",
            "Academics User",
            "Education Manager",
            "System Manager",
            "Administrator",
        ]
    ):
        return

    raise frappe.PermissionError(
        _("You are not authorized to access this student's {0}").format(resource_type)
    )


def get_guardians_for_user(user=None):
    user = user or frappe.session.user
    if not user or user in ("Guest", "Administrator"):
        return []

    guardians = frappe.get_all(
        "Guardian", filters={"user": user}, pluck="name", order_by="creation asc"
    )

    email = frappe.db.get_value("User", user, "email")
    if email:
        guardians += frappe.get_all(
            "Guardian",
            filters={"user": ["is", "not set"], "email_address": email},
            pluck="name",
            order_by="creation asc",
        )

    return guardians


def get_guardian_for_user(user=None):
    guardians = get_guardians_for_user(user)
    return guardians[0] if guardians else None


def is_guardian_of(student, user=None):
    guardians = get_guardians_for_user(user)
    if not guardians:
        return False

    return bool(
        frappe.db.exists(
            "Student Guardian",
            {
                "parent": student,
                "parenttype": "Student",
                "guardian": ["in", guardians],
            },
        )
    )


def get_currency_symbol(currency):
    return frappe.db.get_value("Currency", currency, "symbol") or currency


def get_posting_date_from_payment_entry_against_sales_invoice(sales_invoice):
    payment_entry = frappe.qb.DocType("Payment Entry")
    payment_entry_reference = frappe.qb.DocType("Payment Entry Reference")

    q = (
        frappe.qb.from_(payment_entry)
        .inner_join(payment_entry_reference)
        .on(payment_entry.name == payment_entry_reference.parent)
        .select(payment_entry.posting_date)
        .where(payment_entry_reference.reference_name == sales_invoice)
    ).run(as_dict=1)

    if len(q) > 0:
        return q[0].get("posting_date")
    return None


def get_fees_print_format():
    val = frappe.db.get_value(
        "Property Setter",
        dict(property="default_print_format", doc_type="Sales Invoice"),
        "value",
    )
    if val and val != "Standard":
        return val
    if frappe.db.exists("Print Format", "Tax Invoice"):
        return "Tax Invoice"
    if frappe.db.exists("Print Format", "Sales Invoice Print"):
        return "Sales Invoice Print"
    return "Standard"


def get_program_from_fee_schedule(fee_schedule):
    return frappe.db.get_value(
        "Fee Schedule", filters={"name": fee_schedule}, fieldname=["program"]
    )


def _get_submitted_program_enrollments(student):
    enrollments = frappe.get_all(
        "Program Enrollment",
        filters={"student": student, "docstatus": ["<", 2]},
        fields=PROGRAM_ENROLLMENT_FIELDS,
        order_by="creation desc",
    )
    for row in enrollments:
        prog = row.get("program") or ""
        year = row.get("academic_year") or ""
        row["label"] = f"{prog} ({year})" if year else prog
    return enrollments


def _resolve_default_program(student, programs):
    from education.education.api_modules.students import get_current_enrollment

    if not programs:
        return None
    active_enrollment = get_current_enrollment(student)
    if active_enrollment:
        for p in programs:
            if p.get("program_enrollment") == active_enrollment.get("program_enrollment"):
                return p.get("program")
            if p.get("program") == active_enrollment.get("program") and p.get("academic_year") == active_enrollment.get("academic_year"):
                return p.get("program")
    return programs[0]["program"]


def _get_program_enrollment(student, program=None, academic_year=None, program_enrollment=None):
    filters = {"student": student, "docstatus": ["<", 2]}
    if program_enrollment:
        filters["name"] = program_enrollment
    else:
        if program:
            filters["program"] = program
        if academic_year:
            filters["academic_year"] = academic_year

    enrollments = frappe.get_all(
        "Program Enrollment",
        filters=filters,
        fields=PROGRAM_ENROLLMENT_FIELDS,
        order_by="creation desc",
        limit=1,
    )
    return enrollments[0] if enrollments else None



@frappe.whitelist(methods=["POST"])
def update_email_group(doctype: str, name: str):
    from education.education.api_modules.students import (
        get_student_group_students,
        get_student_guardians,
    )

    if not frappe.db.exists("Email Group", name):
        email_group = frappe.new_doc("Email Group")
        email_group.title = name
        email_group.save()
    email_list = []
    students = []
    if doctype == "Student Group":
        students = get_student_group_students(name)
    for stud in students:
        for guard in get_student_guardians(stud.student):
            email = frappe.db.get_value("Guardian", guard.guardian, "email_address")
            if email:
                email_list.append(email)
    add_subscribers(name, email_list)


# ==============================================================================
# Portal Dashboard (role-scoped, permission-checked)
# ==============================================================================

STAFF_ROLES = (
    "Instructor",
    "Academics User",
    "Education Manager",
    "System Manager",
    "Administrator",
)
MANAGER_ROLES = ("Education Manager", "System Manager", "Administrator")


def _user_is_staff(user=None):
    user = user or frappe.session.user
    if user == "Administrator":
        return True
    roles = frappe.get_roles(user)
    return any(r in roles for r in STAFF_ROLES)


def _user_is_manager(user=None):
    user = user or frappe.session.user
    if user == "Administrator":
        return True
    roles = frappe.get_roles(user)
    return any(r in roles for r in MANAGER_ROLES)


def get_instructor_for_user(user=None):
    """Resolve the Instructor record linked to a user (via Employee.user_id, then by full name)."""
    user = user or frappe.session.user
    if not user or user in ("Guest", "Administrator"):
        return None

    if frappe.db.exists("DocType", "Employee"):
        employee = frappe.db.get_value("Employee", {"user_id": user}, "name")
        if employee:
            instructor = frappe.db.get_value("Instructor", {"employee": employee}, "name")
            if instructor:
                return instructor

    full_name = frappe.db.get_value("User", user, "full_name")
    if full_name:
        return frappe.db.get_value("Instructor", {"instructor_name": full_name}, "name")
    return None


def get_guardian_ward_ids(guardians):
    if not guardians:
        return []
    rows = frappe.get_all(
        "Student Guardian",
        filters={"guardian": ["in", guardians], "parenttype": "Student"},
        fields=["parent"],
        order_by="idx asc",
    )
    seen = []
    for row in rows:
        if row.parent not in seen:
            seen.append(row.parent)
    return seen


def _dashboard_scope(student=None):
    """Returns (scope, student) where scope is 'student', 'staff' or 'none'.

    - An explicit student is permission-checked (self, own ward, or staff).
    - Without a student: Student users resolve to themselves, Guardians to their first ward,
      staff get an institution-wide scope, everyone else gets nothing.
    """
    if frappe.session.user == "Guest":
        raise frappe.PermissionError(_("Please log in to view the dashboard"))

    if student:
        if not frappe.db.exists("Student", student):
            frappe.throw(_("Student {0} not found").format(student), frappe.DoesNotExistError)
        check_permission(student, "dashboard")
        return "student", student

    own = _resolve_portal_student()
    if own:
        return "student", own

    wards = get_guardian_ward_ids(get_guardians_for_user())
    if wards:
        return "student", wards[0]

    if _user_is_staff():
        return "staff", None

    return "none", None


def _get_active_student_groups(student, program=None):
    sg = frappe.qb.DocType("Student Group")
    sgs = frappe.qb.DocType("Student Group Student")
    query = (
        frappe.qb.from_(sgs)
        .inner_join(sg)
        .on(sg.name == sgs.parent)
        .select(sg.name)
        .where(sgs.student == student)
        .where(sgs.active == 1)
        .where(sg.disabled == 0)
    )
    if program:
        query = query.where(sg.program == program)
    return [row[0] for row in query.run()]


def _resolve_student_program(student, program=None):
    """Validate a requested program against the student's enrollments, else use the current one."""
    enrollments = _get_submitted_program_enrollments(student)
    programs = [e.get("program") for e in enrollments if e.get("program")]
    if program and program in programs:
        return program
    if not programs:
        return None
    return _resolve_default_program(student, enrollments)


def _fmt_time(value):
    if value is None or value == "":
        return ""
    if hasattr(value, "total_seconds"):
        secs = int(value.total_seconds())
        return f"{secs // 3600:02d}:{(secs % 3600) // 60:02d}:{secs % 60:02d}"
    return str(value).split(".")[0]


COURSE_SCHEDULE_DASHBOARD_FIELDS = [
    "name",
    "title",
    "course",
    "program",
    "student_group",
    "instructor",
    "instructor_name",
    "room",
    "schedule_date",
    "from_time",
    "to_time",
    "class_schedule_color",
]


def _schedule_filters_for_scope(scope, student, program=None):
    """Returns Course Schedule filters for the scope, or None when nothing is visible."""
    if scope == "student":
        groups = _get_active_student_groups(student)
        if not groups:
            return None
        filters = {"student_group": ["in", groups]}
        if program:
            filters["program"] = program
        return filters

    if scope == "staff":
        filters = {}
        if not _user_is_manager():
            instructor = get_instructor_for_user()
            if instructor:
                filters["instructor"] = instructor
        if program:
            filters["program"] = program
        return filters

    return None


def _format_sessions(rows):
    room_names = {}
    rooms = list({r.room for r in rows if r.get("room")})
    if rooms:
        room_names = dict(
            frappe.get_all("Room", filters={"name": ["in", rooms]}, fields=["name", "room_name"], as_list=True)
        )
    out = []
    for r in rows:
        out.append(
            {
                "name": r.name,
                "title": r.title or r.course,
                "course": r.course,
                "program": r.program,
                "student_group": r.student_group,
                "instructor": r.instructor,
                "instructor_name": r.instructor_name,
                "room": r.room,
                "room_name": room_names.get(r.room) or r.room,
                "schedule_date": str(r.schedule_date) if r.schedule_date else None,
                "from_time": _fmt_time(r.from_time),
                "to_time": _fmt_time(r.to_time),
                "color": r.class_schedule_color,
            }
        )
    return out


def _get_next_session(filters):
    today = frappe.utils.today()
    now_time = frappe.utils.nowtime()
    rows = frappe.get_all(
        "Course Schedule",
        filters={**filters, "schedule_date": today, "to_time": [">=", now_time]},
        fields=COURSE_SCHEDULE_DASHBOARD_FIELDS,
        order_by="from_time asc",
        limit=1,
    )
    if not rows:
        rows = frappe.get_all(
            "Course Schedule",
            filters={**filters, "schedule_date": [">", today]},
            fields=COURSE_SCHEDULE_DASHBOARD_FIELDS,
            order_by="schedule_date asc, from_time asc",
            limit=1,
        )
    return _format_sessions(rows)[0] if rows else None


def _sum_field(doctype, field, filters):
    rows = frappe.get_all(doctype, filters=filters, fields=[{"SUM": field, "as": "total"}])
    return frappe.utils.flt(rows[0].get("total")) if rows else 0.0


@frappe.whitelist()
def get_dashboard_stats(student=None, program=None):
    """KPI cards for the portal dashboard: attendance, curriculum, next period and fees."""
    scope, student = _dashboard_scope(student)
    out = {
        "scope": scope,
        "student": student,
        "program": None,
        "attendance": {"present": 0, "total": 0, "rate": None},
        "course_count": 0,
        "next_class": None,
        "fees": {"pending": 0.0, "open_invoices": 0, "currency": None, "currency_symbol": None},
    }
    if scope == "none":
        return out

    if scope == "student":
        program = _resolve_student_program(student, program)
    elif program and not frappe.db.exists("Program", program):
        program = None
    out["program"] = program

    # Attendance
    att_filters = {"docstatus": 1}
    if student:
        att_filters["student"] = student
    status_rows = frappe.get_all(
        "Student Attendance",
        filters=att_filters,
        fields=["status", {"COUNT": "name", "as": "c"}],
        group_by="status",
    )
    total = sum(frappe.utils.cint(r.c) for r in status_rows)
    present = sum(frappe.utils.cint(r.c) for r in status_rows if r.status == "Present")
    out["attendance"] = {
        "present": present,
        "total": total,
        "rate": round(present * 100.0 / total) if total else None,
    }

    # Curriculum courses
    if program:
        out["course_count"] = frappe.db.count(
            "Program Course", {"parent": program, "parenttype": "Program"}
        )
    elif scope == "staff":
        out["course_count"] = frappe.db.count("Course")

    # Next period
    sched_filters = _schedule_filters_for_scope(scope, student)
    if sched_filters is not None:
        out["next_class"] = _get_next_session(sched_filters)

    # Fees (Sales Invoices linked to students)
    if frappe.get_meta("Sales Invoice").has_field("student"):
        base = {"student": student} if student else {"student": ["is", "set"]}
        submitted = {**base, "docstatus": 1, "outstanding_amount": [">", 0]}
        drafts = {**base, "docstatus": 0}
        pending = _sum_field("Sales Invoice", "outstanding_amount", submitted) + _sum_field(
            "Sales Invoice", "grand_total", drafts
        )
        open_count = frappe.db.count("Sales Invoice", submitted) + frappe.db.count("Sales Invoice", drafts)
        currency = frappe.db.get_value(
            "Sales Invoice", {**base, "docstatus": ["<", 2]}, "currency", order_by="posting_date desc"
        ) or frappe.defaults.get_global_default("currency")
        out["fees"] = {
            "pending": pending,
            "open_invoices": open_count,
            "currency": currency,
            "currency_symbol": get_currency_symbol(currency) if currency else None,
        }

    return out


@frappe.whitelist()
def get_dashboard_schedule(student=None, limit=3):
    """Today's sessions for the scope; falls back to the next upcoming sessions when today is free."""
    scope, student = _dashboard_scope(student)
    limit = max(1, min(frappe.utils.cint(limit) or 3, 10))
    today = frappe.utils.today()
    out = {"scope": scope, "student": student, "date": today, "is_today": True, "sessions": []}

    filters = _schedule_filters_for_scope(scope, student)
    if filters is None:
        return out

    rows = frappe.get_all(
        "Course Schedule",
        filters={**filters, "schedule_date": today},
        fields=COURSE_SCHEDULE_DASHBOARD_FIELDS,
        order_by="from_time asc",
        limit=20,
    )
    if not rows:
        out["is_today"] = False
        rows = frappe.get_all(
            "Course Schedule",
            filters={**filters, "schedule_date": [">", today]},
            fields=COURSE_SCHEDULE_DASHBOARD_FIELDS,
            order_by="schedule_date asc, from_time asc",
            limit=limit,
        )
    out["sessions"] = _format_sessions(rows)
    return out


@frappe.whitelist()
def get_recent_assessments(student=None, limit=4):
    """Latest submitted Assessment Results plus an aggregate score summary for the scope."""
    scope, student = _dashboard_scope(student)
    limit = max(1, min(frappe.utils.cint(limit) or 4, 20))
    out = {
        "scope": scope,
        "student": student,
        "results": [],
        "summary": {"count": 0, "total_score": 0.0, "maximum_score": 0.0, "percentage": None},
    }
    if scope == "none":
        return out

    filters = {"docstatus": 1}
    if student:
        filters["student"] = student

    out["results"] = frappe.get_all(
        "Assessment Result",
        filters=filters,
        fields=[
            "name",
            "student",
            "student_name",
            "course",
            "assessment_group",
            "program",
            "academic_year",
            "academic_term",
            "grading_scale",
            "total_score",
            "maximum_score",
            "grade",
            "comment",
            "creation",
        ],
        order_by="creation desc",
        limit=limit,
    )

    agg = frappe.get_all(
        "Assessment Result",
        filters=filters,
        fields=[
            {"COUNT": "name", "as": "c"},
            {"SUM": "total_score", "as": "total"},
            {"SUM": "maximum_score", "as": "maximum"},
        ],
    )
    if agg:
        total = frappe.utils.flt(agg[0].get("total"))
        maximum = frappe.utils.flt(agg[0].get("maximum"))
        out["summary"] = {
            "count": frappe.utils.cint(agg[0].get("c")),
            "total_score": total,
            "maximum_score": maximum,
            "percentage": round(total * 100.0 / maximum) if maximum else None,
        }
    return out


def _clean_text(html, length=400):
    text = frappe.utils.strip_html_tags(html or "").replace("&nbsp;", " ").strip()
    text = " ".join(text.split())
    return (text[: length - 1] + "…") if len(text) > length else text


@frappe.whitelist()
def get_dashboard_announcements(student=None, limit=20):
    """Notice board: public Notes (circulars), the scoped student's Student Logs and the
    current user's own Notification Logs."""
    scope, student = _dashboard_scope(student)
    limit = max(1, min(frappe.utils.cint(limit) or 20, 50))
    items = []
    now = frappe.utils.now_datetime()

    # 1. Public circulars (Note doctype) that have not expired
    notes = frappe.get_all(
        "Note",
        filters={"public": 1},
        or_filters=[
            ["expire_notification_on", "is", "not set"],
            ["expire_notification_on", ">", now],
        ],
        fields=["name", "title", "content", "notify_on_login", "creation", "modified"],
        order_by="modified desc",
        limit=limit,
    )
    for n in notes:
        items.append(
            {
                "id": f"note-{n.name}",
                "source": "Note",
                "title": n.title,
                "content": _clean_text(n.content),
                "date": str(n.modified or n.creation).split(" ")[0],
                "category": "Circular",
                "badge": "Circular",
                "pinned": bool(n.notify_on_login),
                "read": True,
            }
        )

    # 2. Student Logs for the scoped student only
    if scope == "student" and student:
        logs = frappe.get_all(
            "Student Log",
            filters={"student": student},
            fields=["name", "type", "log", "date", "academic_term", "program", "creation"],
            order_by="date desc, creation desc",
            limit=limit,
        )
        for log in logs:
            log_type = log.type or "General"
            items.append(
                {
                    "id": f"log-{log.name}",
                    "source": "Student Log",
                    "title": f"{log_type}: {log.academic_term or log.program or ''}".rstrip(": "),
                    "content": _clean_text(log.log),
                    "date": str(log.date or log.creation).split(" ")[0],
                    "category": log_type,
                    "badge": log_type,
                    "pinned": log_type == "Achievement",
                    "read": True,
                }
            )

    # 3. The current user's own notifications
    notifications = frappe.get_all(
        "Notification Log",
        filters={"for_user": frappe.session.user},
        fields=["name", "subject", "email_content", "creation", "read", "type"],
        order_by="creation desc",
        limit=limit,
    )
    for notif in notifications:
        subject = _clean_text(notif.subject, 200)
        items.append(
            {
                "id": f"notif-{notif.name}",
                "source": "Notification Log",
                "title": subject or _("Notification"),
                "content": _clean_text(notif.email_content) or subject,
                "date": str(notif.creation).split(" ")[0],
                "category": "Notification",
                "badge": "Notice" if notif.read else "New",
                "pinned": False,
                "read": bool(notif.read),
            }
        )

    # pinned first, then newest first
    pinned = sorted([i for i in items if i["pinned"]], key=lambda i: i["date"] or "", reverse=True)
    others = sorted([i for i in items if not i["pinned"]], key=lambda i: i["date"] or "", reverse=True)
    return {"scope": scope, "student": student, "items": (pinned + others)[:limit]}
