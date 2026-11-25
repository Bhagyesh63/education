# Copyright (c) 2026, Frappe Technologies and contributors
# For license information, please see license.txt

"""Portal version of the desk "Program Enrollment Tool".

Two flows, same as the desk tool:
  * Program Enrollment -> promote / re-enroll students of a program + academic year
    (optionally term / batch) into a new program, academic year and term.
  * Student Applicant  -> turn Approved applicants into Students and enroll them in
    the program / academic year they applied for.

Differences from the desk tool (deliberate):
  * only submitted enrollments of enabled students are offered for promotion
    (the desk also lists draft/cancelled enrollments);
  * students already enrolled in the target are flagged and skipped instead of
    failing the whole run;
  * each student is enrolled inside its own savepoint, so one bad row doesn't
    leave half-created records;
  * enrollments are submitted by default (course enrollments, joining date and
    fee records are created on submit), with an option to keep them as drafts.
"""

import json

import frappe
from frappe import _
from frappe.model.mapper import get_mapped_doc
from frappe.utils import cint, getdate, today

SOURCE_ENROLLMENT = "Program Enrollment"
SOURCE_APPLICANT = "Student Applicant"


def _require_enrollment_permission():
    if frappe.session.user == "Guest":
        frappe.throw(_("Please log in to continue."), frappe.PermissionError)
    if not frappe.has_permission("Program Enrollment", "create"):
        frappe.throw(
            _(
                "You are not permitted to enroll students (Program Enrollment create permission required)."
            ),
            frappe.PermissionError,
        )


def _as_list(value):
    if isinstance(value, str):
        try:
            value = json.loads(value)
        except ValueError:
            value = []
    return value if isinstance(value, list) else []


@frappe.whitelist(methods=["GET"])
def get_program_enrollment_tool_metadata():
    _require_enrollment_permission()
    return {
        "programs": frappe.get_all(
            "Program", fields=["name", "program_name"], order_by="name asc"
        ),
        "academic_years": frappe.get_all(
            "Academic Year",
            fields=["name", "year_start_date", "year_end_date"],
            order_by="year_start_date desc",
        ),
        "academic_terms": frappe.get_all(
            "Academic Term",
            fields=[
                "name",
                "academic_year",
                "term_name",
                "term_start_date",
                "term_end_date",
            ],
            order_by="term_start_date desc",
        ),
        "student_batches": frappe.get_all(
            "Student Batch Name", pluck="name", order_by="name asc"
        ),
        "student_groups": frappe.get_all(
            "Student Group",
            filters={"disabled": 0},
            fields=[
                "name",
                "program",
                "academic_year",
                "academic_term",
                "group_based_on",
                "batch",
            ],
            order_by="name asc",
        ),
        "academic_term_reqd": cint(
            frappe.db.get_single_value("Education Settings", "academic_term_reqd")
        ),
    }


@frappe.whitelist(methods=["GET"])
def get_program_enrollment_tool_students(
    get_students_from: str,
    program: str,
    academic_year: str,
    academic_term: str | None = None,
    student_batch: str | None = None,
    new_program: str | None = None,
    new_academic_year: str | None = None,
    new_academic_term: str | None = None,
):
    """Students the tool can enroll, each flagged with `already_enrolled` for the target."""
    _require_enrollment_permission()
    if get_students_from not in (SOURCE_ENROLLMENT, SOURCE_APPLICANT):
        frappe.throw(
            _("Get Students From must be Program Enrollment or Student Applicant.")
        )
    if not program or not academic_year:
        frappe.throw(_("Program and Academic Year are required."))

    excluded = {}
    if get_students_from == SOURCE_APPLICANT:
        filters = {
            "application_status": "Approved",
            "program": program,
            "academic_year": academic_year,
        }
        if academic_term:
            filters["academic_term"] = academic_term
        applicants = frappe.get_all(
            "Student Applicant",
            filters=filters,
            fields=[
                "name",
                "title",
                "student_category",
                "academic_term",
                "student_email_id",
            ],
            order_by="title asc",
        )
        rows = []
        admitted = 0
        for a in applicants:
            if frappe.db.exists("Student", {"student_applicant": a.name}):
                admitted += 1
                continue
            rows.append(
                {
                    "key": a.name,
                    "student_applicant": a.name,
                    "student": None,
                    "student_name": a.title,
                    "student_category": a.student_category,
                    "student_batch_name": None,
                    "email": a.student_email_id,
                    "already_enrolled": False,
                }
            )
        if admitted:
            excluded["already_admitted"] = admitted
        return {"students": rows, "excluded": excluded}

    filters = {"program": program, "academic_year": academic_year, "docstatus": 1}
    if academic_term:
        filters["academic_term"] = academic_term
    if student_batch:
        filters["student_batch_name"] = student_batch
    enrollments = frappe.get_all(
        "Program Enrollment",
        filters=filters,
        fields=[
            "name",
            "student",
            "student_name",
            "student_batch_name",
            "student_category",
            "academic_term",
        ],
        order_by="student_name asc",
    )

    rows, seen, disabled = [], set(), 0
    for e in enrollments:
        if e.student in seen:
            continue
        seen.add(e.student)
        if not frappe.db.get_value("Student", e.student, "enabled"):
            disabled += 1
            continue
        existing = None
        if new_program and new_academic_year:
            existing = _existing_enrollment(
                e.student, new_program, new_academic_year, new_academic_term
            )
        rows.append(
            {
                "key": e.student,
                "student": e.student,
                "student_applicant": None,
                "student_name": e.student_name,
                "student_category": e.student_category,
                "student_batch_name": e.student_batch_name,
                "current_enrollment": e.name,
                "already_enrolled": bool(existing),
                "existing_enrollment": existing,
            }
        )
    if disabled:
        excluded["disabled_students"] = disabled
    return {"students": rows, "excluded": excluded}


def _existing_enrollment(student, program, academic_year, academic_term=None):
    filters = {
        "student": student,
        "program": program,
        "academic_year": academic_year,
        "docstatus": ["<", 2],
    }
    if academic_term:
        filters["academic_term"] = academic_term
    return frappe.db.get_value("Program Enrollment", filters, "name")


def _default_enrollment_date(academic_year, academic_term=None):
    if academic_term:
        start = frappe.db.get_value("Academic Term", academic_term, "term_start_date")
        if start:
            return start
    start = frappe.db.get_value("Academic Year", academic_year, "year_start_date")
    return start or today()


@frappe.whitelist(methods=["POST"])
def enroll_students_via_tool(
    get_students_from: str,
    students: list | str,
    new_program: str | None = None,
    new_academic_year: str | None = None,
    new_academic_term: str | None = None,
    new_student_batch: str | None = None,
    enrollment_date: str | None = None,
    student_group: str | None = None,
    submit: int | str = 1,
):
    """Enroll the selected students. Returns enrolled / skipped / errors per student."""
    _require_enrollment_permission()
    rows = _as_list(students)
    if not rows:
        frappe.throw(_("Select at least one student to enroll."))
    submit = cint(submit)

    if get_students_from == SOURCE_ENROLLMENT:
        if not new_program or not new_academic_year:
            frappe.throw(_("New Program and New Academic Year are required."))
        for doctype, value in (
            ("Program", new_program),
            ("Academic Year", new_academic_year),
        ):
            if not frappe.db.exists(doctype, value):
                frappe.throw(_("{0} {1} does not exist.").format(_(doctype), value))
        if new_academic_term:
            term_year = frappe.db.get_value(
                "Academic Term", new_academic_term, "academic_year"
            )
            if term_year is None:
                frappe.throw(
                    _("Academic Term {0} does not exist.").format(new_academic_term)
                )
            if term_year != new_academic_year:
                frappe.throw(
                    _("Academic Term {0} does not belong to Academic Year {1}.").format(
                        new_academic_term, new_academic_year
                    )
                )
    elif get_students_from != SOURCE_APPLICANT:
        frappe.throw(
            _("Get Students From must be Program Enrollment or Student Applicant.")
        )

    if new_student_batch and not frappe.db.exists(
        "Student Batch Name", new_student_batch
    ):
        frappe.throw(_("Student Batch {0} does not exist.").format(new_student_batch))
    if student_group:
        group = frappe.db.get_value(
            "Student Group",
            student_group,
            ["program", "academic_year", "disabled"],
            as_dict=True,
        )
        if not group or group.disabled:
            frappe.throw(
                _("Student Group {0} does not exist or is disabled.").format(
                    student_group
                )
            )
    if enrollment_date:
        enrollment_date = getdate(enrollment_date)

    enrolled, skipped, errors = [], [], []
    for row in rows:
        row = frappe._dict(row if isinstance(row, dict) else {"student": row})
        label = row.student or row.student_applicant or "?"
        savepoint = "pet_" + frappe.generate_hash(length=8)
        frappe.db.savepoint(savepoint)
        try:
            if get_students_from == SOURCE_ENROLLMENT:
                result = _enroll_existing_student(
                    row,
                    new_program,
                    new_academic_year,
                    new_academic_term,
                    new_student_batch,
                    enrollment_date,
                    submit,
                )
            else:
                result = _enroll_applicant(
                    row, new_academic_term, new_student_batch, enrollment_date, submit
                )

            if result.get("skipped"):
                skipped.append(
                    {
                        "student": label,
                        "student_name": row.student_name,
                        "reason": result["skipped"],
                    }
                )
                frappe.db.rollback(save_point=savepoint)
                continue

            if student_group:
                _add_to_group(result["student"], student_group)
            enrolled.append(result)
        except Exception as e:
            frappe.db.rollback(save_point=savepoint)
            frappe.clear_last_message()
            errors.append(
                {
                    "student": label,
                    "student_name": row.student_name,
                    "error": frappe.utils.strip_html_tags(str(e)) or type(e).__name__,
                }
            )
        finally:
            frappe.local.message_log = []

    return {
        "total": len(rows),
        "enrolled_count": len(enrolled),
        "skipped_count": len(skipped),
        "error_count": len(errors),
        "enrolled": enrolled,
        "skipped": skipped,
        "errors": errors,
        "submitted": bool(submit),
    }


def _enroll_existing_student(
    row, program, academic_year, academic_term, batch, enrollment_date, submit
):
    if not row.student or not frappe.db.exists("Student", row.student):
        return {"skipped": _("Student not found")}
    if not frappe.db.get_value("Student", row.student, "enabled"):
        return {"skipped": _("Student is disabled")}
    existing = _existing_enrollment(row.student, program, academic_year, academic_term)
    if existing:
        return {"skipped": _("Already enrolled ({0})").format(existing)}

    pe = frappe.new_doc("Program Enrollment")
    pe.student = row.student
    category = row.student_category
    if not category and row.current_enrollment:
        category = frappe.db.get_value(
            "Program Enrollment", row.current_enrollment, "student_category"
        )
    pe.student_category = category
    pe.program = program
    pe.academic_year = academic_year
    pe.academic_term = academic_term
    pe.student_batch_name = batch or row.student_batch_name
    pe.enrollment_date = enrollment_date or _default_enrollment_date(
        academic_year, academic_term
    )
    pe.insert()
    if submit:
        pe.submit()
    return {
        "student": pe.student,
        "student_name": pe.student_name,
        "program_enrollment": pe.name,
        "program": pe.program,
        "docstatus": pe.docstatus,
    }


def _enroll_applicant(row, academic_term, batch, enrollment_date, submit):
    applicant_name = row.student_applicant
    if not applicant_name or not frappe.db.exists("Student Applicant", applicant_name):
        return {"skipped": _("Student Applicant not found")}
    applicant = frappe.get_doc("Student Applicant", applicant_name)
    if applicant.application_status != "Approved":
        return {
            "skipped": _("Application status is {0}, not Approved").format(
                applicant.application_status
            )
        }
    existing_student = frappe.db.get_value(
        "Student", {"student_applicant": applicant_name}, "name"
    )
    if existing_student:
        return {"skipped": _("Already admitted as {0}").format(existing_student)}

    student = get_mapped_doc(
        "Student Applicant",
        applicant_name,
        {
            "Student Applicant": {
                "doctype": "Student",
                "field_map": {"name": "student_applicant"},
            }
        },
        ignore_permissions=True,
    )
    student.insert(ignore_permissions=True)

    term = academic_term or applicant.academic_term
    pe = frappe.new_doc("Program Enrollment")
    pe.student = student.name
    pe.student_name = student.student_name
    pe.student_category = applicant.student_category
    pe.program = applicant.program
    pe.academic_year = applicant.academic_year
    pe.academic_term = term
    pe.student_batch_name = batch
    pe.enrollment_date = enrollment_date or _default_enrollment_date(
        applicant.academic_year, term
    )
    pe.insert()
    if submit:
        pe.submit()

    frappe.db.set_value(
        "Student Applicant", applicant_name, "application_status", "Admitted"
    )
    return {
        "student": student.name,
        "student_name": student.student_name,
        "student_applicant": applicant_name,
        "program_enrollment": pe.name,
        "program": pe.program,
        "docstatus": pe.docstatus,
    }


def _add_to_group(student, student_group):
    group = frappe.get_doc("Student Group", student_group)
    if any(s.student == student for s in group.students):
        return
    group.append(
        "students",
        {
            "student": student,
            "student_name": frappe.db.get_value("Student", student, "student_name"),
            "active": 1,
        },
    )
    group.save()
