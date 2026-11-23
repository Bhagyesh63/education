# Copyright (c) 2026, Frappe Technologies and contributors
# For license information, please see license.txt

import json
import frappe
from frappe import _
from frappe.utils import getdate, nowdate, cint
from education.education.api_modules.common import check_permission

@frappe.whitelist(allow_guest=True)
def get_admissions_list():
    """Returns all Student Admission drives."""
    admissions = frappe.get_all(
        "Student Admission",
        fields=[
            "name",
            "title",
            "academic_year",
            "admission_start_date",
            "admission_end_date",
            "published",
            "enable_admission_application",
            "introduction",
            "modified",
        ],
        order_by="modified desc",
    )

    # Attach programs and applicant counts for each admission drive
    for adm in admissions:
        programs = frappe.get_all(
            "Student Admission Program",
            filters={"parent": adm.name, "parenttype": "Student Admission"},
            fields=["program", "min_age", "max_age"],
        )
        adm["programs"] = [p.get("program") for p in programs]
        adm["applicant_count"] = frappe.db.count(
            "Student Applicant", {"student_admission": adm.name}
        )

    return admissions


@frappe.whitelist(allow_guest=True)
def create_student_admission(
    title: str,
    academic_year: str,
    admission_start_date: str | None = None,
    admission_end_date: str | None = None,
    programs: list | str | None = None,
    introduction: str | None = None,
    enable_application: int | bool = 1,
    published: int | bool = 1,
):
    """Creates a new Student Admission campaign."""
    check_permission("Student Admission", "create")

    if not title or not academic_year:
        frappe.throw(_("Title and Academic Year are required."))

    if isinstance(programs, str):
        try:
            programs = json.loads(programs)
        except Exception:
            programs = [p.strip() for p in programs.split(",") if p.strip()]

    doc = frappe.new_doc("Student Admission")
    doc.title = title
    doc.academic_year = academic_year
    doc.admission_start_date = admission_start_date
    doc.admission_end_date = admission_end_date
    doc.published = cint(published)
    doc.enable_admission_application = cint(enable_application)
    doc.introduction = introduction or ""

    if programs:
        for prog in programs:
            prog_name = prog if isinstance(prog, str) else prog.get("program")
            if prog_name and frappe.db.exists("Program", prog_name):
                doc.append("program_details", {"program": prog_name})

    doc.insert()
    return doc.as_dict()


@frappe.whitelist(allow_guest=True)
def get_student_applicants(
    program: str | None = None,
    academic_year: str | None = None,
    application_status: str | None = None,
    student_admission: str | None = None,
    search: str | None = None,
):
    """Returns list of student applicants with filters."""
    filters = {}
    if program and program != "all":
        filters["program"] = program
    if academic_year and academic_year != "all":
        filters["academic_year"] = academic_year
    if application_status and application_status != "all":
        filters["application_status"] = application_status
    if student_admission and student_admission != "all":
        filters["student_admission"] = student_admission

    applicants = frappe.get_all(
        "Student Applicant",
        filters=filters,
        fields=[
            "name",
            "title",
            "first_name",
            "middle_name",
            "last_name",
            "student_email_id",
            "student_mobile_number",
            "program",
            "academic_year",
            "academic_term",
            "student_category",
            "application_status",
            "application_date",
            "student_admission",
            "paid",
            "image",
            "city",
            "state",
            "country",
            "creation",
            "modified",
        ],
        order_by="creation desc",
    )

    if search:
        s = search.lower().strip()
        applicants = [
            a for a in applicants
            if s in (a.get("title") or "").lower()
            or s in (a.get("name") or "").lower()
            or s in (a.get("student_email_id") or "").lower()
            or s in (a.get("program") or "").lower()
        ]

    return applicants


@frappe.whitelist(allow_guest=True)
def get_applicant_details(applicant_name: str):
    """Returns full details of a Student Applicant including guardians."""
    if not frappe.db.exists("Student Applicant", applicant_name):
        frappe.throw(_("Applicant {0} not found").format(applicant_name), frappe.DoesNotExistError)

    doc = frappe.get_doc("Student Applicant", applicant_name)
    data = doc.as_dict()

    # Check if student was already created from this applicant
    enrolled_student = frappe.db.get_value(
        "Student", {"student_applicant": applicant_name}, ["name", "student_name"], as_dict=True
    )
    data["enrolled_student"] = enrolled_student

    return data


@frappe.whitelist(allow_guest=True)
def create_student_applicant(
    first_name: str,
    program: str,
    academic_year: str,
    last_name: str | None = None,
    middle_name: str | None = None,
    student_email_id: str | None = None,
    student_mobile_number: str | None = None,
    date_of_birth: str | None = None,
    gender: str | None = None,
    student_admission: str | None = None,
    academic_term: str | None = None,
    student_category: str | None = None,
    address_line_1: str | None = None,
    city: str | None = None,
    state: str | None = None,
    pincode: str | None = None,
    country: str | None = "India",
    guardians: list | str | None = None,
):
    """Submits a new Student Application."""
    if not first_name or not program or not academic_year:
        frappe.throw(_("First Name, Program, and Academic Year are required."))

    doc = frappe.new_doc("Student Applicant")
    doc.first_name = first_name
    doc.middle_name = middle_name or ""
    doc.last_name = last_name or ""
    doc.program = program
    doc.academic_year = academic_year
    doc.academic_term = academic_term or None
    doc.student_email_id = student_email_id or None
    doc.student_mobile_number = student_mobile_number or None
    doc.date_of_birth = date_of_birth or None
    doc.gender = gender or None
    doc.student_admission = student_admission or None
    doc.student_category = student_category or None
    doc.address_line_1 = address_line_1 or None
    doc.city = city or None
    doc.state = state or None
    doc.pincode = pincode or None
    doc.country = country or "India"
    doc.application_status = "Applied"
    doc.application_date = nowdate()

    if isinstance(guardians, str):
        try:
            guardians = json.loads(guardians)
        except Exception:
            guardians = []

    if guardians and isinstance(guardians, list):
        for g in guardians:
            if isinstance(g, dict) and g.get("guardian"):
                doc.append("guardians", {
                    "guardian": g.get("guardian"),
                    "guardian_name": g.get("guardian_name"),
                    "relation": g.get("relation"),
                })

    doc.insert(ignore_permissions=True)
    return doc.as_dict()


@frappe.whitelist(allow_guest=True)
def update_applicant_status(applicant_name: str, status: str):
    """Updates applicant status (Applied, Approved, Rejected)."""
    check_permission("Student Applicant", "write")
    if status not in ["Applied", "Approved", "Rejected"]:
        frappe.throw(_("Invalid status {0}").format(status))

    doc = frappe.get_doc("Student Applicant", applicant_name)
    doc.application_status = status
    doc.save()
    return {"name": doc.name, "application_status": doc.application_status}


@frappe.whitelist(allow_guest=True)
def admit_and_enroll_applicant(applicant_name: str):
    """Approves applicant if needed, creates Student record, and sets up Program Enrollment."""
    check_permission("Student Applicant", "write")
    from education.education.api_modules.students import enroll_student

    if not frappe.db.exists("Student Applicant", applicant_name):
        frappe.throw(_("Applicant {0} not found").format(applicant_name), frappe.DoesNotExistError)

    applicant = frappe.get_doc("Student Applicant", applicant_name)

    # Check if student already enrolled
    existing_student = frappe.db.get_value("Student", {"student_applicant": applicant_name}, "name")
    if existing_student:
        return {
            "status": "already_enrolled",
            "student": existing_student,
            "message": _("Student {0} has already been enrolled from this application.").format(existing_student)
        }

    # Ensure status is approved before enrolling
    if applicant.application_status != "Approved":
        applicant.application_status = "Approved"
        applicant.save()

    # Call official Frappe Education enroll_student
    program_enrollment = enroll_student(applicant_name)
    if program_enrollment.docstatus == 0:
        program_enrollment.submit()

    # Mark applicant as Admitted
    applicant.reload()
    applicant.application_status = "Admitted"
    applicant.save()
    frappe.db.commit()

    return {
        "status": "success",
        "applicant": applicant_name,
        "student": program_enrollment.student,
        "student_name": program_enrollment.student_name,
        "program_enrollment": program_enrollment.name,
        "program": program_enrollment.program,
        "academic_year": program_enrollment.academic_year,
    }
