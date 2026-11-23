# Copyright (c) 2015, Frappe Technologies and contributors
# For license information, please see license.txt

import frappe
from frappe import _
from education.education.api_modules.common import (
    _resolve_portal_student,
    get_guardian_for_user,
    get_guardians_for_user,
)


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


@frappe.whitelist(allow_guest=True)
def get_user_role():
    if frappe.session.user == "Guest":
        return "Guest"

    roles = frappe.get_roles()
    if "System Manager" in roles or "Education Manager" in roles or "Administrator" in roles:
        return "Administrator"
    if "Instructor" in roles or "Academics User" in roles:
        return "Instructor"
    if "Guardian" in roles:
        return "Guardian"
    if "Student" in roles:
        return "Student"

    return "Student"


@frappe.whitelist(allow_guest=True)
def get_school_abbr_logo():
    abbr = frappe.db.get_single_value(
        "Education Settings", "school_college_name_abbreviation"
    ) or "Frappe Academy"
    logo = frappe.db.get_single_value("Education Settings", "school_college_logo")
    return {"name": abbr, "logo": logo}


@frappe.whitelist(allow_guest=True)
def portal_login(usr=None, pwd=None):
    """High-speed portal authentication: authenticates credentials, establishes session,
    and returns complete pre-hydrated portal context in a single round-trip."""
    if not usr or not pwd:
        usr = usr or frappe.form_dict.get("usr")
        pwd = pwd or frappe.form_dict.get("pwd")

    if not usr or not pwd:
        frappe.throw(_("Email and Password are required"), frappe.AuthenticationError)

    from frappe.auth import LoginManager
    login_manager = LoginManager()
    login_manager.authenticate(user=usr, pwd=pwd)

    # Fast session initialization without redundant desk table count scans
    login_manager.run_trigger("on_login")
    login_manager.validate_hour()
    login_manager.get_user_info()
    login_manager.make_session()
    login_manager.set_user_info()

    frappe.set_user(login_manager.user)
    frappe.db.commit()

    context = get_portal_context()

    return {
        "message": "Logged In",
        "home_page": "/dashboard",
        "full_name": login_manager.full_name,
        "user": login_manager.user,
        "context": context,
    }


@frappe.whitelist(allow_guest=True)
def get_portal_context():
    """Returns role-aware bootstrap data for the portal SPA."""
    from education.education.api_modules.students import (
        get_student_profile,
        get_program_context,
    )

    current_user = frappe.session.user
    if current_user == "Guest":
        return {
            "role": None,
            "user": None,
            "full_name": None,
        }

    role = get_user_role()
    full_name = frappe.db.get_value("User", current_user, "full_name") or current_user
    context = {"role": role, "user": current_user, "full_name": full_name}

    if role == "Guardian":
        context["guardian"] = get_guardian_info()
        wards = get_guardian_students()
        context["students"] = wards
        if wards:
            active_stu = wards[0].get("student")
            context["active_student_id"] = active_stu
            prof = get_student_profile(active_stu)
            if prof:
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
                    p_ctx = get_program_context(active_stu, active_p, academic_year=active_y, program_enrollment=active_enr)
                    context["enrollment"] = p_ctx.get("enrollment")
                    context["student_groups"] = p_ctx.get("student_groups")
    elif role == "Student":
        stu_id = _resolve_portal_student()
        context["student"] = stu_id
        if stu_id:
            prof = get_student_profile(stu_id)
            if prof:
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
                    p_ctx = get_program_context(stu_id, active_p, academic_year=active_y, program_enrollment=active_enr)
                    context["enrollment"] = p_ctx.get("enrollment")
                    context["student_groups"] = p_ctx.get("student_groups")

    elif role == "Instructor":
        inst = frappe.db.get_value("Instructor", {"employee": frappe.db.get_value("Employee", {"user_id": current_user}, "name")}, ["name", "instructor_name", "department"], as_dict=True)
        if not inst:
            inst = frappe.db.get_value("Instructor", {"instructor_name": full_name}, ["name", "instructor_name", "department"], as_dict=True)
        if not inst:
            inst = frappe.db.get_value("Instructor", {}, ["name", "instructor_name", "department"], as_dict=True)
        context["instructor"] = inst
        db_programs = frappe.get_all("Program", fields=["name as program"], order_by="name asc")
        db_groups = frappe.get_all("Student Group", fields=["name as label"], order_by="name asc")
        context["programs"] = db_programs or []
        context["student_groups"] = db_groups or []
        context["active_program"] = db_programs[0]["program"] if db_programs else None

    elif role == "Administrator":
        context["admin"] = {"user": current_user, "name": full_name}
        db_programs = frappe.get_all("Program", fields=["name as program"], order_by="name asc")
        db_groups = frappe.get_all("Student Group", fields=["name as label"], order_by="name asc")
        context["programs"] = db_programs or []
        context["student_groups"] = db_groups or []
        context["active_program"] = db_programs[0]["program"] if db_programs else None

    return context


@frappe.whitelist(allow_guest=True)
def get_guardian_info():
    guardian = get_guardian_for_user()
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


@frappe.whitelist(allow_guest=True)
def get_guardian_students():
    guardians = get_guardians_for_user()
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
        .run(as_dict=1)
    )

    wards = {}
    for row in students:
        wards.setdefault(row.student, row)
    return list(wards.values())
