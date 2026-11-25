# Copyright (c) 2015, Frappe Technologies and contributors
# For license information, please see license.txt

import frappe
from frappe import _
from frappe.utils import today
from education.education.api_modules.students import (
    _require_login,
    _require_staff,
    assert_can_view_student,
    get_accessible_student_ids,
)


LOG_FIELDS = [
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
]


def _scoped_log_filters(student=None, log_type=None):
    """Builds Student Log filters restricted to what the session user may see.

    Staff: any student (optionally filtered). Student: only own record.
    Guardian: only linked wards (a specific ward if requested). Returns None when
    the user has no accessible students."""
    _require_login()
    filters = {}
    if log_type and log_type != "all":
        filters["type"] = log_type

    requested = student if student and student != "all" else None
    accessible = get_accessible_student_ids()

    if accessible is None:  # staff
        if requested:
            filters["student"] = requested
        return filters

    if requested:
        assert_can_view_student(requested)
        filters["student"] = requested
    elif accessible:
        filters["student"] = ["in", accessible]
    else:
        return None
    return filters


def _fetch_logs(filters, limit=100):
    if filters is None or not frappe.db.exists("DocType", "Student Log"):
        return []
    logs = frappe.get_all(
        "Student Log",
        fields=LOG_FIELDS,
        filters=filters,
        order_by="date desc, creation desc",
        limit_page_length=limit,
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
def get_student_logs(student=None, log_type=None):
    """Student Log records (achievements, academic, general, medical), role-scoped."""
    return _fetch_logs(_scoped_log_filters(student, log_type))


@frappe.whitelist()
def get_student_achievements(student=None):
    """Achievement-type Student Logs, role-scoped (student: self, guardian: wards, staff: any)."""
    return _fetch_logs(_scoped_log_filters(student, "Achievement"))


@frappe.whitelist(methods=["POST"])
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
    _require_staff(_("Not permitted to create Student Log"))

    if not student:
        frappe.throw(_("Student is required"))
    if not frappe.db.exists("Student", student):
        frappe.throw(_("Student {0} does not exist").format(student))
    if not (log or "").strip():
        frappe.throw(_("Log details are required"))

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


@frappe.whitelist()
def get_notification_logs():
    """Notification Log entries addressed to the session user only."""
    _require_login()
    if not frappe.db.exists("DocType", "Notification Log"):
        return []
    return frappe.get_all(
        "Notification Log",
        filters={"for_user": frappe.session.user},
        fields=["name", "subject", "email_content", "creation", "type"],
        order_by="creation desc",
        limit_page_length=20,
    )


@frappe.whitelist(methods=["POST"])
def delete_student_log(log_name):
    _require_staff(_("Not permitted to delete Student Log"))

    if not frappe.db.exists("Student Log", log_name):
        frappe.throw(_("Student Log {0} not found").format(log_name))

    frappe.delete_doc("Student Log", log_name, ignore_permissions=True)
    frappe.db.commit()
    return {"status": "success", "deleted": log_name}
