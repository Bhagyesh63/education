# Copyright (c) 2026, Frappe Technologies and contributors
# For license information, please see license.txt

"""Portal version of the desk "Student Group Creation Tool".

Like the desk tool it proposes, for one program + academic year (+ term):
  * one Batch group per Student Batch Name, and
  * one Course group per course of the program (optionally split per batch),
then creates the selected groups filled with the enrolled students.

Differences from the desk tool (deliberate):
  * students are looked up correctly for course groups (the desk passes the
    course as `student_category` to `get_students`, so its course groups come
    out empty);
  * each proposal shows its student count and whether a matching group exists;
    existing groups are skipped instead of aborting the whole run;
  * names follow the school's convention ("Standard 5 - Section A",
    "Standard 5 - Mathematics") by default; the desk "Program/Batch/Term" style
    is available too, and every name can be edited;
  * an instructor (suggested from the Instructor Log) and a default room can be
    set per group; max strength is checked before saving;
  * every group is created in its own savepoint.
"""

import json
import re

import frappe
from frappe import _
from frappe.utils import cint

from education.education.doctype.student_group.student_group import (
    get_program_enrollment,
)


def _require_group_permission():
    if frappe.session.user == "Guest":
        frappe.throw(_("Please log in to continue."), frappe.PermissionError)
    if not frappe.has_permission("Student Group", "create"):
        frappe.throw(
            _("You are not permitted to create Student Groups."),
            frappe.PermissionError,
        )


def _subject(course_name, program):
    """'Mathematics - Std 5' -> 'Mathematics' (strip a trailing class suffix)."""
    name = course_name or ""
    name = re.sub(r"\s*-\s*Std\.?\s*\d+\s*$", "", name, flags=re.I)
    if program:
        name = re.sub(r"\s*-\s*" + re.escape(program) + r"\s*$", "", name, flags=re.I)
    return name.strip() or course_name


def _group_name(
    style,
    program,
    academic_year,
    academic_term,
    batch=None,
    course=None,
    course_name=None,
):
    period = academic_term or academic_year
    if style == "desk":
        if course:
            return "/".join(p for p in (course, program, batch, period) if p)
        return "/".join(p for p in (program, batch, period) if p)
    parts = [program]
    if course:
        parts.append(_subject(course_name or course, program))
    if batch:
        parts.append(batch)
    return " - ".join(parts)


def _enrolled_students(academic_year, academic_term, program, batch=None, course=None):
    rows = (
        get_program_enrollment(
            academic_year, academic_term, program, batch, None, course
        )
        or []
    )
    seen, students = set(), []
    for r in rows:
        if r.student in seen:
            continue
        seen.add(r.student)
        if not frappe.db.get_value("Student", r.student, "enabled"):
            continue
        students.append(r)
    return students


def _matching_group(
    name, group_based_on, program, academic_year, academic_term, batch, course
):
    if frappe.db.exists("Student Group", name):
        return name
    filters = {
        "group_based_on": group_based_on,
        "program": program,
        "academic_year": academic_year,
        "disabled": 0,
    }
    filters["academic_term"] = academic_term or ["is", "not set"]
    filters["batch"] = batch or ["is", "not set"]
    filters["course"] = course or ["is", "not set"]
    return frappe.db.get_value("Student Group", filters, "name")


@frappe.whitelist(methods=["GET"])
def get_student_group_tool_metadata():
    _require_group_permission()
    return {
        "programs": frappe.get_all(
            "Program", fields=["name", "program_name"], order_by="name asc"
        ),
        "academic_years": frappe.get_all(
            "Academic Year",
            fields=["name", "year_start_date"],
            order_by="year_start_date desc",
        ),
        "academic_terms": frappe.get_all(
            "Academic Term",
            fields=["name", "academic_year", "term_start_date"],
            order_by="term_start_date desc",
        ),
        "student_batches": frappe.get_all(
            "Student Batch Name", pluck="name", order_by="name asc"
        ),
        "instructors": frappe.get_all(
            "Instructor",
            filters={"status": "Active"},
            fields=["name", "instructor_name"],
            order_by="instructor_name asc",
        ),
        "rooms": frappe.get_all(
            "Room",
            fields=["name", "room_name", "seating_capacity"],
            order_by="room_name asc",
        ),
        "current_academic_year": frappe.db.get_single_value(
            "Education Settings", "current_academic_year"
        ),
        "current_academic_term": frappe.db.get_single_value(
            "Education Settings", "current_academic_term"
        ),
    }


@frappe.whitelist(methods=["GET"])
def get_student_group_proposals(
    program: str,
    academic_year: str,
    academic_term: str | None = None,
    separate_groups: int | str = 0,
    name_style: str = "school",
):
    """Groups the tool would create, with student counts and existing-group flags."""
    _require_group_permission()
    if not program or not academic_year:
        frappe.throw(_("Program and Academic Year are required."))
    if (
        academic_term
        and frappe.db.get_value("Academic Term", academic_term, "academic_year")
        != academic_year
    ):
        frappe.throw(
            _("Academic Term {0} does not belong to Academic Year {1}.").format(
                academic_term, academic_year
            )
        )
    separate_groups = cint(separate_groups)

    batches = frappe.get_all("Student Batch Name", pluck="name", order_by="name asc")
    courses = frappe.get_all(
        "Program Course",
        filters={"parent": program, "parenttype": "Program"},
        fields=["course", "course_name"],
        order_by="idx asc",
    )

    plan = [{"group_based_on": "Batch", "batch": b} for b in batches]
    for c in courses:
        if separate_groups:
            plan += [
                {
                    "group_based_on": "Course",
                    "course": c.course,
                    "course_name": c.course_name,
                    "batch": b,
                }
                for b in batches
            ]
        else:
            plan.append(
                {
                    "group_based_on": "Course",
                    "course": c.course,
                    "course_name": c.course_name,
                }
            )

    proposals = []
    for p in plan:
        batch, course = p.get("batch"), p.get("course")
        name = _group_name(
            name_style,
            program,
            academic_year,
            academic_term,
            batch,
            course,
            p.get("course_name"),
        )
        students = _enrolled_students(
            academic_year, academic_term, program, batch, course
        )
        instructor = None
        if course:
            instructor = frappe.db.get_value(
                "Instructor Log",
                {"program": program, "course": course, "academic_year": academic_year},
                "parent",
            )
        proposals.append(
            {
                "key": f"{p['group_based_on']}|{course or ''}|{batch or ''}",
                "group_based_on": p["group_based_on"],
                "batch": batch,
                "course": course,
                "course_name": p.get("course_name"),
                "student_group_name": name,
                "student_count": len(students),
                "existing_group": _matching_group(
                    name,
                    p["group_based_on"],
                    program,
                    academic_year,
                    academic_term,
                    batch,
                    course,
                ),
                "suggested_instructor": instructor,
            }
        )
    return {"proposals": proposals}


@frappe.whitelist(methods=["POST"])
def create_student_groups_via_tool(
    program: str,
    academic_year: str,
    groups: list | str,
    academic_term: str | None = None,
):
    _require_group_permission()
    if isinstance(groups, str):
        try:
            groups = json.loads(groups)
        except ValueError:
            groups = []
    if not groups:
        frappe.throw(_("Select at least one group to create."))
    if not frappe.db.exists("Program", program):
        frappe.throw(_("Program {0} does not exist.").format(program))
    if not frappe.db.exists("Academic Year", academic_year):
        frappe.throw(_("Academic Year {0} does not exist.").format(academic_year))
    if (
        academic_term
        and frappe.db.get_value("Academic Term", academic_term, "academic_year")
        != academic_year
    ):
        frappe.throw(
            _("Academic Term {0} does not belong to Academic Year {1}.").format(
                academic_term, academic_year
            )
        )

    created, skipped, errors = [], [], []
    seen_names = set()
    for g in groups:
        g = frappe._dict(g)
        name = (g.student_group_name or "").strip()
        sp = "sgt_" + frappe.generate_hash(length=8)
        frappe.db.savepoint(sp)
        try:
            if not name:
                raise frappe.ValidationError(_("Student Group Name is required."))
            if name in seen_names:
                raise frappe.ValidationError(
                    _("The name {0} is used twice in this run.").format(name)
                )
            seen_names.add(name)
            if g.group_based_on not in ("Batch", "Course"):
                raise frappe.ValidationError(
                    _("Group Based On must be Batch or Course.")
                )
            if g.group_based_on == "Batch" and not g.batch:
                raise frappe.ValidationError(
                    _("Batch is required for a batch-based group.")
                )
            if g.group_based_on == "Course" and not g.course:
                raise frappe.ValidationError(
                    _("Course is required for a course-based group.")
                )
            if g.course and not frappe.db.exists(
                "Program Course",
                {"parent": program, "parenttype": "Program", "course": g.course},
            ):
                raise frappe.ValidationError(
                    _("Course {0} is not part of {1}.").format(g.course, program)
                )

            existing = _matching_group(
                name,
                g.group_based_on,
                program,
                academic_year,
                academic_term,
                g.batch,
                g.course,
            )
            if existing:
                skipped.append(
                    {
                        "student_group_name": name,
                        "reason": _("Already exists ({0})").format(existing),
                    }
                )
                frappe.db.rollback(save_point=sp)
                continue

            students = _enrolled_students(
                academic_year, academic_term, program, g.batch, g.course
            )
            max_strength = cint(g.max_strength)
            if max_strength < 0:
                raise frappe.ValidationError(_("Max strength cannot be negative."))
            if max_strength and len(students) > max_strength:
                raise frappe.ValidationError(
                    _("{0} students are enrolled but max strength is {1}.").format(
                        len(students), max_strength
                    )
                )

            doc = frappe.new_doc("Student Group")
            doc.student_group_name = name
            doc.group_based_on = g.group_based_on
            doc.program = program
            doc.academic_year = academic_year
            doc.academic_term = academic_term
            doc.batch = g.batch
            doc.course = g.course
            doc.max_strength = max_strength or None
            if g.default_room:
                if not frappe.db.exists("Room", g.default_room):
                    raise frappe.ValidationError(
                        _("Room {0} does not exist.").format(g.default_room)
                    )
                doc.default_room = g.default_room
            for i, s in enumerate(students, 1):
                doc.append(
                    "students",
                    {
                        "student": s.student,
                        "student_name": s.student_name,
                        "group_roll_number": i,
                        "active": 1,
                    },
                )
            if g.instructor:
                if not frappe.db.exists("Instructor", g.instructor):
                    raise frappe.ValidationError(
                        _("Instructor {0} does not exist.").format(g.instructor)
                    )
                doc.append("instructors", {"instructor": g.instructor})
            doc.insert()
            created.append(
                {
                    "student_group": doc.name,
                    "group_based_on": doc.group_based_on,
                    "student_count": len(doc.students),
                    "instructor": g.instructor,
                }
            )
        except Exception as e:
            frappe.db.rollback(save_point=sp)
            frappe.clear_last_message()
            errors.append(
                {
                    "student_group_name": name,
                    "error": frappe.utils.strip_html_tags(str(e)) or type(e).__name__,
                }
            )
        finally:
            frappe.local.message_log = []

    return {
        "total": len(groups),
        "created_count": len(created),
        "skipped_count": len(skipped),
        "error_count": len(errors),
        "created": created,
        "skipped": skipped,
        "errors": errors,
    }
