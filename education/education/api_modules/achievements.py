# Copyright (c) 2015, Frappe Technologies and contributors
# For license information, please see license.txt

import frappe
from frappe import _
from frappe.utils import today
from education.education.api_modules.common import _resolve_portal_student, is_guardian_of
from education.education.api_modules.auth import get_user_role, get_guardian_students


@frappe.whitelist(allow_guest=True)
def get_student_logs(student=None, log_type=None):
    filters = {}
    if student and student != "all":
        filters["student"] = student
    if log_type and log_type != "all":
        filters["type"] = log_type
    if not frappe.db.exists("DocType", "Student Log"):
        return []
    logs = frappe.get_all(
        "Student Log",
        fields=["name", "student", "student_name", "date", "academic_term", "academic_year", "program", "type", "log", "creation"],
        filters=filters,
        order_by="date desc, creation desc",
        limit_page_length=100,
    )
    if logs:
        log_names = [l.name for l in logs]
        attachments = frappe.get_all(
            "File",
            filters={
                "attached_to_doctype": "Student Log",
                "attached_to_name": ["in", log_names],
            },
            fields=["name", "file_name", "file_url", "is_private", "attached_to_name"],
        )
        attachments_by_log = {}
        for att in attachments:
            attachments_by_log.setdefault(att.attached_to_name, []).append(att)

        for l in logs:
            l["attachments"] = attachments_by_log.get(l.name, [])
    return logs


@frappe.whitelist(allow_guest=True)
def get_student_achievements(student=None):
    """Returns achievements for a student from Student Log doctype, validating permissions."""
    user = frappe.session.user
    role = get_user_role()

    if role == "Student":
        resolved_stu = _resolve_portal_student()
        if resolved_stu:
            student = resolved_stu
        elif not student:
            student = "EDU-STU-2026-00001"
    elif role == "Guardian":
        if student and student != "all" and not is_guardian_of(student, user):
            wards = get_guardian_students()
            if wards:
                student = wards[0].get("student")
        elif not student or student == "all":
            wards = get_guardian_students()
            if wards:
                student = wards[0].get("student")

    filters = {"type": "Achievement"}
    if student and student != "all":
        filters["student"] = student

    if not frappe.db.exists("DocType", "Student Log"):
        return []

    logs = frappe.get_all(
        "Student Log",
        fields=[
            "name",
            "student",
            "student_name",
            "date",
            "academic_term",
            "academic_year",
            "program",
            "student_batch",
            "type",
            "log",
            "creation",
        ],
        filters=filters,
        order_by="date desc, creation desc",
        limit_page_length=100,
    )

    if logs:
        log_names = [l.name for l in logs]
        attachments = frappe.get_all(
            "File",
            filters={
                "attached_to_doctype": "Student Log",
                "attached_to_name": ["in", log_names],
            },
            fields=["name", "file_name", "file_url", "is_private", "attached_to_name"],
        )
        attachments_by_log = {}
        for att in attachments:
            attachments_by_log.setdefault(att.attached_to_name, []).append(att)

        for l in logs:
            l["attachments"] = attachments_by_log.get(l.name, [])

    return logs


@frappe.whitelist()
def create_student_log(
    student,
    log_type="Achievement",
    log="",
    program=None,
    academic_year=None,
    academic_term=None,
    date=None,
):
    """Creates a Student Log record (Achievement, Academic, etc.) with permission verification."""
    roles = frappe.get_roles()
    if not any(
        r in roles
        for r in [
            "Instructor",
            "Academics User",
            "Education Manager",
            "System Manager",
            "Administrator",
        ]
    ):
        frappe.throw(_("Not permitted to create Student Log"), frappe.PermissionError)

    if not student:
        frappe.throw(_("Student is required"))

    doc = frappe.new_doc("Student Log")
    doc.student = student
    doc.type = log_type
    doc.date = date or today()
    doc.log = log
    if program:
        doc.program = program
    if academic_year:
        doc.academic_year = academic_year
    if academic_term:
        doc.academic_term = academic_term
    doc.insert(ignore_permissions=True)
    frappe.db.commit()
    return doc.as_dict()


@frappe.whitelist(allow_guest=True)
def get_notification_logs():
    if not frappe.db.exists("DocType", "Notification Log"):
        return []
    return frappe.get_all(
        "Notification Log",
        fields=["name", "subject", "email_content", "creation", "type"],
        order_by="creation desc",
        limit_page_length=20,
    )


@frappe.whitelist()
def delete_student_log(log_name):
    roles = frappe.get_roles()
    if not any(
        r in roles
        for r in [
            "Instructor",
            "Academics User",
            "Education Manager",
            "System Manager",
            "Administrator",
        ]
    ):
        frappe.throw(_("Not permitted to delete Student Log"), frappe.PermissionError)

    if not frappe.db.exists("Student Log", log_name):
        frappe.throw(_("Student Log {0} not found").format(log_name))

    frappe.delete_doc("Student Log", log_name, ignore_permissions=True)
    frappe.db.commit()
    return {"status": "success", "deleted": log_name}
