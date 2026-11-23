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



@frappe.whitelist()
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
