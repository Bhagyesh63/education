# Copyright (c) 2015, Frappe Technologies and contributors
# For license information, please see license.txt

import frappe
from frappe.model.mapper import get_mapped_doc
from frappe.utils import getdate, today, nowdate
from education.education.api_modules.common import (
    PORTAL_STUDENT_FIELDS,
    _resolve_portal_student,
    _get_submitted_program_enrollments,
    _resolve_default_program,
    _get_program_enrollment,
    check_permission,
    get_guardians_for_user,
    is_guardian_of,
)

# ==============================================================================
# Portal access helpers (role-scoped, read-only checks)
# ==============================================================================

STAFF_ROLES = (
    "Instructor",
    "Academics User",
    "Education Manager",
    "System Manager",
    "Administrator",
)


def _is_staff(user=None):
    user = user or frappe.session.user
    if not user or user == "Guest":
        return False
    if user == "Administrator":
        return True
    return any(r in STAFF_ROLES for r in frappe.get_roles(user))


def _require_login():
    if frappe.session.user == "Guest":
        frappe.throw(frappe._("Please log in to continue."), frappe.PermissionError)


def _require_staff(message=None):
    _require_login()
    if not _is_staff():
        frappe.throw(
            message or frappe._("Only school staff can perform this action."),
            frappe.PermissionError,
        )


def get_ward_ids(user=None):
    """Students linked to the guardian record(s) of the given user."""
    guardians = get_guardians_for_user(user)
    if not guardians:
        return []
    return list(
        dict.fromkeys(
            frappe.get_all(
                "Student Guardian",
                filters={"parenttype": "Student", "guardian": ["in", guardians]},
                pluck="parent",
            )
        )
    )


def get_accessible_student_ids(user=None):
    """Returns None for staff (unrestricted) or the explicit list of students the user may see."""
    user = user or frappe.session.user
    if not user or user == "Guest":
        return []
    if _is_staff(user):
        return None
    ids = []
    own = frappe.db.get_value("Student", {"user": user}, "name")
    if own:
        ids.append(own)
    for ward in get_ward_ids(user):
        if ward not in ids:
            ids.append(ward)
    return ids


def assert_can_view_student(student):
    """Student: only self. Guardian: only linked wards. Staff: any student."""
    _require_login()
    if not student:
        frappe.throw(frappe._("Student is required."))
    user = frappe.session.user
    if _is_staff(user):
        return
    if frappe.db.get_value("Student", student, "user") == user:
        return
    if is_guardian_of(student, user):
        return
    frappe.throw(
        frappe._("You are not authorized to access this student's records."),
        frappe.PermissionError,
    )


def _resolve_default_student():
    """Student user -> own record; guardian -> first linked ward; otherwise None."""
    own = _resolve_portal_student()
    if own:
        return own
    wards = get_ward_ids()
    return wards[0] if wards else None


@frappe.whitelist()
def get_current_enrollment(student: str, academic_year: str | None = None):
    assert_can_view_student(student)
    compare_date = getdate(academic_year) if academic_year else getdate(today())
    program_enrollment_list = frappe.db.sql(
        """
        SELECT
            pe.name AS program_enrollment, pe.student_name, pe.program, pe.student_batch_name AS student_batch,
            pe.student_category, pe.academic_term, pe.academic_year
        FROM
            `tabProgram Enrollment` pe
        JOIN
            `tabAcademic Year` ay ON pe.academic_year = ay.name
        WHERE
            pe.student = %s
            AND ay.year_end_date >= %s
        ORDER BY
            pe.creation
        """,
        (student, compare_date),
        as_dict=1,
    )
    return program_enrollment_list[0] if program_enrollment_list else None


@frappe.whitelist()
def get_student_profile(student: str | None = None):
    _require_login()
    student = student or _resolve_default_student()
    if not student:
        return None
    assert_can_view_student(student)

    student_info = frappe.db.get_value(
        "Student", student, PORTAL_STUDENT_FIELDS + ["enabled"], as_dict=True
    )
    if not student_info:
        return None

    programs = _get_submitted_program_enrollments(student)
    curr_enr = get_current_enrollment(student)
    suggested_p = _resolve_default_program(student, programs)
    suggested_y = (
        curr_enr.get("academic_year")
        if curr_enr
        else (programs[0].get("academic_year") if programs else None)
    )
    suggested_enr = (
        curr_enr.get("program_enrollment")
        if curr_enr
        else (programs[0].get("program_enrollment") if programs else None)
    )

    # Linked Guardians
    guardians = frappe.db.sql(
        """
        SELECT
            sg.name, sg.guardian, sg.guardian_name, sg.relation,
            g.email_address, g.mobile_number
        FROM `tabStudent Guardian` sg
        LEFT JOIN `tabGuardian` g ON sg.guardian = g.name
        WHERE sg.parent = %s
    """,
        (student,),
        as_dict=True,
    )

    # Student Groups / Sections
    student_groups = frappe.db.sql(
        """
        SELECT
            sgs.parent AS student_group,
            sgs.group_roll_number,
            sgs.active,
            sg.program,
            sg.academic_year,
            sg.academic_term
        FROM `tabStudent Group Student` sgs
        JOIN `tabStudent Group` sg ON sgs.parent = sg.name
        WHERE sgs.student = %s
    """,
        (student,),
        as_dict=True,
    )

    # Enrolled courses: check tabCourse Enrollment first (official Frappe Education doctype)
    enrolled_courses = frappe.db.sql(
        """
        SELECT
            ce.name as enrollment_id,
            ce.course,
            COALESCE(c.course_name, ce.course) as course_name,
            ce.program,
            pe.academic_year,
            ce.enrollment_date
        FROM `tabCourse Enrollment` ce
        LEFT JOIN `tabCourse` c ON ce.course = c.name
        LEFT JOIN `tabProgram Enrollment` pe ON ce.program_enrollment = pe.name
        WHERE ce.student = %s
        ORDER BY ce.enrollment_date DESC, ce.course ASC
    """,
        (student,),
        as_dict=True,
    )

    if not enrolled_courses:
        enrolled_courses = frappe.db.sql(
            """
            SELECT
                pec.name as enrollment_id,
                pec.course, pec.course_name, pe.program, pe.academic_year
            FROM `tabProgram Enrollment Course` pec
            JOIN `tabProgram Enrollment` pe ON pec.parent = pe.name
            WHERE pe.student = %s AND pe.docstatus < 2
            ORDER BY pe.creation DESC, pec.course_name ASC
        """,
            (student,),
            as_dict=True,
        )

    # Attendance summary stats
    att_stats = frappe.db.sql(
        """
        SELECT
            count(*) as total,
            sum(case when status = 'Present' then 1 else 0 end) as present,
            sum(case when status = 'Absent' then 1 else 0 end) as absent
        FROM `tabStudent Attendance`
        WHERE student = %s AND docstatus < 2
    """,
        (student,),
        as_dict=True,
    )

    total_att = att_stats[0].get("total", 0) if att_stats else 0
    present_att = att_stats[0].get("present", 0) or 0 if att_stats else 0
    absent_att = att_stats[0].get("absent", 0) or 0 if att_stats else 0
    pct_att = (
        round((float(present_att) / float(total_att) * 100), 1)
        if total_att > 0
        else None
    )

    # Recent student logs (achievements, medical, academic)
    recent_logs = []
    if frappe.db.exists("DocType", "Student Log"):
        recent_logs = frappe.get_all(
            "Student Log",
            fields=["name", "date", "type", "academic_year", "log"],
            filters={"student": student},
            order_by="date desc",
            limit_page_length=10,
        )

    return {
        "student": student_info,
        "programs": programs,
        "current_enrollment": curr_enr,
        "suggested_program": suggested_p,
        "suggested_academic_year": suggested_y,
        "suggested_enrollment": suggested_enr,
        "guardians": guardians or [],
        "student_groups": student_groups or [],
        "enrolled_courses": enrolled_courses or [],
        "attendance_summary": {
            "total": total_att,
            "present": int(present_att),
            "absent": int(absent_att),
            "percentage": pct_att,
        },
        "recent_logs": recent_logs or [],
    }


@frappe.whitelist()
def get_student_directory(program: str | None = None, student_group: str | None = None):
    _require_staff(frappe._("Only school staff can view the student directory."))
    students = frappe.get_all(
        "Student",
        fields=[
            "name",
            "student_name",
            "student_email_id",
            "student_mobile_number",
            "joining_date",
            "gender",
            "blood_group",
            "enabled",
            "image",
        ],
        order_by="name asc",
        limit_page_length=200,
    )
    enrollments = frappe.get_all(
        "Program Enrollment",
        fields=["student", "program"],
        filters={"docstatus": ["<", 2]},
        order_by="academic_year desc, creation desc",
        limit_page_length=500,
    )
    prog_map = {}
    for e in enrollments:
        if e.program not in prog_map.setdefault(e.student, []):
            prog_map[e.student].append(e.program)

    group_students = frappe.get_all(
        "Student Group Student",
        fields=["student", "parent", "group_roll_number"],
        filters={"active": 1},
        limit_page_length=1000,
    )
    grp_map = {}
    for g in group_students:
        grp_map.setdefault(g.student, []).append(
            {
                "student_group": g.parent,
                "group_roll_number": g.group_roll_number,
            }
        )

    guardians = frappe.get_all(
        "Student Guardian",
        fields=["parent", "guardian_name", "relation"],
        limit_page_length=1000,
    )
    grd_map = {}
    for gd in guardians:
        grd_map.setdefault(gd.parent, []).append(
            {
                "guardian_name": gd.guardian_name,
                "relation": gd.relation,
            }
        )

    result = []
    for s in students:
        s_progs = prog_map.get(s.name, [])
        s_grps = grp_map.get(s.name, [])
        s_grds = grd_map.get(s.name, [])

        if program and program != "all" and program not in s_progs:
            continue

        if student_group and student_group != "all":
            grp_names = [g["student_group"] for g in s_grps]
            if student_group not in grp_names:
                continue

        primary_roll = (
            s_grps[0]["group_roll_number"]
            if s_grps and s_grps[0].get("group_roll_number")
            else None
        )

        result.append(
            {
                "name": s.name,
                "student_name": s.student_name,
                "email": s.student_email_id,
                "mobile": s.student_mobile_number,
                "joining_date": str(s.joining_date) if s.joining_date else None,
                "gender": s.gender,
                "blood_group": s.blood_group,
                "enabled": s.enabled,
                "image": s.image,
                "programs": s_progs,
                "program": s_progs[0] if s_progs else None,
                "student_groups": s_grps,
                "roll_number": primary_roll,
                "guardians": s_grds,
            }
        )
    return result


@frappe.whitelist()
def get_enrollment_metadata():
    _require_staff()
    programs = frappe.get_all(
        "Program",
        fields=["name", "program_name", "program_abbreviation"],
        order_by="name asc",
    )
    academic_years = frappe.get_all(
        "Academic Year",
        fields=["name", "year_start_date", "year_end_date"],
        order_by="year_start_date desc",
    )
    academic_terms = frappe.get_all(
        "Academic Term",
        fields=[
            "name",
            "academic_year",
            "term_name",
            "term_start_date",
            "term_end_date",
        ],
        order_by="term_start_date desc",
    )
    student_groups = frappe.get_all(
        "Student Group",
        fields=["name", "student_group_name", "program", "academic_year"],
        order_by="name asc",
    )
    return {
        "programs": programs or [],
        "academic_years": academic_years or [],
        "academic_terms": academic_terms or [],
        "student_groups": student_groups or [],
    }


@frappe.whitelist(methods=["POST"])
def enroll_student_in_program(
    student: str, program: str, academic_year: str, academic_term: str | None = None
):
    _require_staff()
    if not frappe.db.exists("Student", student):
        frappe.throw(frappe._("Student {0} does not exist.").format(student))

    existing = frappe.db.exists(
        "Program Enrollment",
        {
            "student": student,
            "program": program,
            "academic_year": academic_year,
            "docstatus": ["<", 2],
        },
    )
    if existing:
        frappe.throw(
            frappe._("Student is already enrolled in {0} for {1}.").format(
                program, academic_year
            )
        )

    pe = frappe.new_doc("Program Enrollment")
    pe.student = student
    pe.program = program
    pe.academic_year = academic_year
    if academic_term:
        pe.academic_term = academic_term
    pe.enrollment_date = today()
    pe.save(ignore_permissions=True)
    pe.submit()
    return {
        "name": pe.name,
        "student": pe.student,
        "program": pe.program,
        "academic_year": pe.academic_year,
        "courses": [c.course for c in pe.courses] if pe.courses else [],
    }


@frappe.whitelist(methods=["POST"])
def assign_student_to_group(
    student: str, student_group: str, roll_number: int | None = None
):
    _require_staff()
    if not frappe.db.exists("Student", student):
        frappe.throw(frappe._("Student {0} does not exist.").format(student))
    if not frappe.db.exists("Student Group", student_group):
        frappe.throw(
            frappe._("Student Group {0} does not exist.").format(student_group)
        )

    existing = frappe.db.exists(
        "Student Group Student",
        {
            "parent": student_group,
            "student": student,
        },
    )
    if existing:
        frappe.db.set_value(
            "Student Group Student",
            existing,
            {
                "active": 1,
                "group_roll_number": roll_number if roll_number else None,
            },
        )
        return {"status": "updated", "name": existing}

    sg_doc = frappe.get_doc("Student Group", student_group)
    student_name = frappe.db.get_value("Student", student, "student_name")
    sg_doc.append(
        "students",
        {
            "student": student,
            "student_name": student_name,
            "group_roll_number": roll_number if roll_number else None,
            "active": 1,
        },
    )
    sg_doc.save(ignore_permissions=True)
    return {"status": "created", "student_group": student_group, "student": student}


@frappe.whitelist()
def get_program_context(
    student: str | None = None,
    program: str | None = None,
    academic_year: str | None = None,
    program_enrollment: str | None = None,
):
    _require_login()
    student = student or _resolve_default_student()
    if not student:
        return {
            "program": None,
            "academic_year": None,
            "program_enrollment": None,
            "enrollment": None,
            "student_groups": [],
        }
    assert_can_view_student(student)

    enrollment = _get_program_enrollment(
        student,
        program,
        academic_year=academic_year,
        program_enrollment=program_enrollment,
    )
    resolved_program = enrollment.get("program") if enrollment else program
    resolved_year = enrollment.get("academic_year") if enrollment else academic_year

    return {
        "program": resolved_program,
        "academic_year": resolved_year,
        "program_enrollment": (
            enrollment.get("program_enrollment") if enrollment else program_enrollment
        ),
        "enrollment": enrollment,
        "student_groups": get_student_groups(student, resolved_program),
    }


@frappe.whitelist()
def get_student_programs(student: str):
    assert_can_view_student(student)
    programs = frappe.get_all(
        "Program Enrollment",
        fields=["program", "name"],
        filters={"docstatus": ["<", 2], "student": student},
    )
    return programs


def get_student_groups(student, program_name):
    student_group = frappe.qb.DocType("Student Group")
    student_group_students = frappe.qb.DocType("Student Group Student")

    student_group_query = (
        frappe.qb.from_(student_group)
        .inner_join(student_group_students)
        .on(student_group.name == student_group_students.parent)
        .select((student_group_students.parent).as_("label"))
        .where(student_group_students.student == student)
        .where(student_group.program == program_name)
        .run(as_dict=1)
    )
    return student_group_query


def get_student_guardians(student):
    return frappe.get_all(
        "Student Guardian", fields=["guardian"], filters={"parent": student}
    )


@frappe.whitelist()
def get_student_group_students(student_group: str, include_inactive: bool = 0):
    # Also used internally (attendance validation, assessments): staff see any roster,
    # students / guardians only rosters of groups their own records belong to.
    accessible = get_accessible_student_ids()
    if accessible is not None and not frappe.db.exists(
        "Student Group Student",
        {"parent": student_group, "student": ["in", accessible or [""]]},
    ):
        frappe.throw(
            frappe._("You are not authorized to view this student group."),
            frappe.PermissionError,
        )
    filters = {"parent": student_group}
    if not include_inactive:
        filters["active"] = 1
    return frappe.get_all(
        "Student Group Student",
        fields=["student", "student_name"],
        filters=filters,
        order_by="group_roll_number",
    )


@frappe.whitelist(methods=["POST"])
def enroll_student(source_name: str):
    _require_staff()
    frappe.publish_realtime(
        "enroll_student_progress", {"progress": [1, 4]}, user=frappe.session.user
    )
    student = get_mapped_doc(
        "Student Applicant",
        source_name,
        {
            "Student Applicant": {
                "doctype": "Student",
                "field_map": {
                    "name": "student_applicant",
                },
            }
        },
        ignore_permissions=True,
    )
    student.save()

    student_applicant = frappe.db.get_value(
        "Student Applicant",
        source_name,
        ["student_category", "program", "academic_year", "academic_term"],
        as_dict=True,
    )
    program_enrollment = frappe.new_doc("Program Enrollment")
    program_enrollment.student = student.name
    program_enrollment.student_category = student_applicant.student_category
    program_enrollment.student_name = student.student_name
    program_enrollment.program = student_applicant.program
    program_enrollment.academic_year = student_applicant.academic_year
    program_enrollment.academic_term = student_applicant.academic_term
    program_enrollment.save(ignore_permissions=True)
    if program_enrollment.docstatus == 0:
        program_enrollment.submit()

    frappe.publish_realtime(
        "enroll_student_progress", {"progress": [2, 4]}, user=frappe.session.user
    )
    return program_enrollment


@frappe.whitelist(methods=["POST"])
def bulk_enroll_students_in_program(
    students: list | str,
    program: str,
    academic_year: str,
    academic_term: str | None = None,
    student_group: str | None = None,
):
    _require_staff()
    import json

    if isinstance(students, str):
        try:
            students = json.loads(students)
        except Exception:
            students = [s.strip() for s in students.split(",") if s.strip()]

    if not students or not isinstance(students, list):
        frappe.throw(frappe._("Please provide at least one student to enroll."))

    if not frappe.db.exists("Program", program):
        frappe.throw(frappe._("Program {0} does not exist.").format(program))

    if not frappe.db.exists("Academic Year", academic_year):
        frappe.throw(
            frappe._("Academic Year {0} does not exist.").format(academic_year)
        )

    enrolled = []
    skipped = []
    errors = []

    for stu_id in students:
        try:
            if not frappe.db.exists("Student", stu_id):
                skipped.append({"student": stu_id, "reason": "Student not found"})
                continue

            existing = frappe.db.exists(
                "Program Enrollment",
                {
                    "student": stu_id,
                    "program": program,
                    "academic_year": academic_year,
                    "docstatus": ["<", 2],
                },
            )
            if existing:
                if student_group and frappe.db.exists("Student Group", student_group):
                    assign_student_to_group(stu_id, student_group)
                skipped.append({"student": stu_id, "reason": "Already enrolled"})
                continue

            pe = frappe.new_doc("Program Enrollment")
            pe.student = stu_id
            pe.program = program
            pe.academic_year = academic_year
            if academic_term:
                pe.academic_term = academic_term
            pe.enrollment_date = today()
            pe.save(ignore_permissions=True)
            pe.submit()

            if student_group and frappe.db.exists("Student Group", student_group):
                assign_student_to_group(stu_id, student_group)

            enrolled.append(
                {
                    "student": stu_id,
                    "program_enrollment": pe.name,
                    "student_name": pe.student_name,
                }
            )
        except Exception as e:
            frappe.log_error(f"Error bulk enrolling student {stu_id}: {str(e)}")
            errors.append({"student": stu_id, "error": str(e)})

    return {
        "success": True,
        "total": len(students),
        "enrolled_count": len(enrolled),
        "skipped_count": len(skipped),
        "error_count": len(errors),
        "enrolled": enrolled,
        "skipped": skipped,
        "errors": errors,
    }


@frappe.whitelist(methods=["POST"])
def create_student_group(
    student_group_name: str,
    academic_year: str,
    program: str,
    group_based_on: str = "Batch",
    max_strength: int = 40,
    academic_term: str | None = None,
    course: str | None = None,
    batch: str | None = None,
):
    """Creates a new Student Group / Section."""
    _require_staff()
    if not student_group_name or not student_group_name.strip():
        frappe.throw(frappe._("Student Group Name is required."))

    student_group_name = student_group_name.strip()
    if frappe.db.exists("Student Group", student_group_name):
        frappe.throw(
            frappe._("Student Group '{0}' already exists.").format(student_group_name)
        )

    if not academic_year or not frappe.db.exists("Academic Year", academic_year):
        frappe.throw(frappe._("Valid Academic Year is required."))

    if group_based_on == "Batch" and (
        not program or not frappe.db.exists("Program", program)
    ):
        frappe.throw(frappe._("Valid Program is required for Batch-based group."))

    if group_based_on == "Course" and (
        not course or not frappe.db.exists("Course", course)
    ):
        frappe.throw(frappe._("Valid Course is required for Course-based group."))

    sg = frappe.new_doc("Student Group")
    sg.student_group_name = student_group_name
    sg.academic_year = academic_year
    sg.group_based_on = group_based_on or "Batch"
    if program:
        sg.program = program
    if academic_term:
        sg.academic_term = academic_term
    if course:
        sg.course = course
    if batch:
        sg.batch = batch
    sg.max_strength = int(max_strength) if max_strength else 0
    sg.insert(ignore_permissions=True)

    return {
        "success": True,
        "name": sg.name,
        "student_group_name": sg.student_group_name,
        "academic_year": sg.academic_year,
        "program": sg.program,
        "group_based_on": sg.group_based_on,
        "max_strength": sg.max_strength,
    }


@frappe.whitelist()
def get_all_student_groups(
    program: str | None = None, academic_year: str | None = None
):
    """Returns Student Groups with enrolled student count.

    Staff see every group; students / guardians only the groups their own records belong to.
    """
    _require_login()
    filters = {}
    accessible = get_accessible_student_ids()
    if accessible is not None:
        if not accessible:
            return []
        member_groups = frappe.get_all(
            "Student Group Student",
            filters={"student": ["in", accessible]},
            pluck="parent",
        )
        if not member_groups:
            return []
        filters["name"] = ["in", list(set(member_groups))]
    if program:
        filters["program"] = program
    if academic_year:
        filters["academic_year"] = academic_year

    groups = frappe.get_all(
        "Student Group",
        filters=filters,
        fields=[
            "name",
            "student_group_name",
            "program",
            "academic_year",
            "academic_term",
            "group_based_on",
            "max_strength",
            "course",
        ],
        order_by="name asc",
    )

    for g in groups:
        count = frappe.db.count(
            "Student Group Student", {"parent": g.name, "active": 1}
        )
        g["student_count"] = count

    return groups


@frappe.whitelist()
def get_student_group_details(student_group: str):
    """Returns details, students roster, and instructors for a Student Group."""
    _require_staff()
    if not frappe.db.exists("Student Group", student_group):
        frappe.throw(
            frappe._("Student Group '{0}' does not exist.").format(student_group)
        )

    doc = frappe.get_doc("Student Group", student_group)
    students = []
    for s in doc.students:
        students.append(
            {
                "student": s.student,
                "student_name": s.student_name,
                "group_roll_number": s.group_roll_number,
                "active": s.active,
            }
        )

    instructors = []
    for i in doc.instructors or []:
        instructors.append(
            {
                "instructor": i.instructor,
                "instructor_name": i.instructor_name,
            }
        )

    return {
        "name": doc.name,
        "student_group_name": doc.student_group_name,
        "academic_year": doc.academic_year,
        "academic_term": doc.academic_term,
        "program": doc.program,
        "group_based_on": doc.group_based_on,
        "max_strength": doc.max_strength,
        "course": doc.course,
        "students": students,
        "instructors": instructors,
        "student_count": len([s for s in students if s["active"]]),
    }


@frappe.whitelist(methods=["POST"])
def remove_student_from_group(student: str, student_group: str):
    """Removes or deactivates a student from a Student Group / Section."""
    _require_staff()

    existing = frappe.db.exists(
        "Student Group Student",
        {
            "parent": student_group,
            "student": student,
        },
    )
    if not existing:
        return {
            "status": "not_in_group",
            "student": student,
            "student_group": student_group,
        }

    frappe.db.delete("Student Group Student", {"name": existing})
    return {"status": "removed", "student": student, "student_group": student_group}


@frappe.whitelist()
def get_student_course_enrollments(student: str):
    """Returns all Course Enrollments for a specific student."""
    if not student:
        return []
    assert_can_view_student(student)

    return frappe.db.sql(
        """
        SELECT
            ce.name,
            ce.course,
            COALESCE(c.course_name, ce.course) AS course_name,
            c.department,
            ce.program,
            ce.program_enrollment,
            pe.academic_year,
            ce.enrollment_date
        FROM `tabCourse Enrollment` ce
        LEFT JOIN `tabCourse` c ON ce.course = c.name
        LEFT JOIN `tabProgram Enrollment` pe ON ce.program_enrollment = pe.name
        WHERE ce.student = %s
        ORDER BY ce.enrollment_date DESC, ce.course ASC
    """,
        (student,),
        as_dict=True,
    )


@frappe.whitelist()
def get_available_courses_for_student(student: str):
    """Returns all courses that a student is eligible for but not yet enrolled in."""
    if not student:
        return {"available_courses": []}
    assert_can_view_student(student)

    # Get student's current program
    prog_info = frappe.db.sql(
        """
        SELECT pe.program, pe.name as program_enrollment, pe.academic_year
        FROM `tabProgram Enrollment` pe
        WHERE pe.student = %s AND pe.docstatus < 2
        ORDER BY pe.creation DESC
        LIMIT 1
    """,
        (student,),
        as_dict=True,
    )

    current_program = prog_info[0].program if prog_info else None

    # Already enrolled course names
    enrolled_courses = frappe.db.sql_list(
        """
        SELECT course FROM `tabCourse Enrollment` WHERE student = %s
    """,
        (student,),
    )

    # Program courses
    program_courses = []
    if current_program:
        program_courses = frappe.db.sql(
            """
            SELECT pc.course, c.course_name, c.department, pc.required
            FROM `tabProgram Course` pc
            JOIN `tabCourse` c ON pc.course = c.name
            WHERE pc.parent = %s
            ORDER BY c.course_name ASC
        """,
            (current_program,),
            as_dict=True,
        )

    # General available courses not yet enrolled
    all_courses = frappe.get_all(
        "Course",
        fields=["name as course", "course_name", "department"],
        order_by="course_name asc",
    )

    available = []
    for c in all_courses:
        if c.course not in enrolled_courses:
            is_prog_course = any(pc["course"] == c.course for pc in program_courses)
            c["is_program_course"] = 1 if is_prog_course else 0
            c["current_program"] = current_program
            available.append(c)

    return {
        "current_program": current_program,
        "program_enrollment": prog_info[0].program_enrollment if prog_info else None,
        "academic_year": prog_info[0].academic_year if prog_info else None,
        "available_courses": available,
    }


@frappe.whitelist(methods=["POST"])
def enroll_student_in_course(
    student: str, course: str, program_enrollment: str | None = None
):
    """Enrolls a student in a specific course (Elective or Program course)."""
    _require_staff()

    if not student or not frappe.db.exists("Student", student):
        frappe.throw(frappe._("Valid Student ID is required."))

    if not course or not frappe.db.exists("Course", course):
        frappe.throw(frappe._("Valid Course is required."))

    # Find or validate program enrollment
    if not program_enrollment:
        pe = frappe.db.get_value(
            "Program Enrollment",
            {"student": student, "docstatus": ["<", 2]},
            ["name", "program"],
            as_dict=True,
            order_by="creation desc",
        )
        if not pe:
            frappe.throw(
                frappe._("No active Program Enrollment found for student {0}.").format(
                    student
                )
            )
        program_enrollment = pe.name

    # Check for duplicate enrollment
    existing = frappe.db.exists(
        "Course Enrollment",
        {
            "student": student,
            "course": course,
            "program_enrollment": program_enrollment,
        },
    )
    if existing:
        frappe.throw(
            frappe._("Student is already enrolled in course {0} via {1}.").format(
                course, existing
            )
        )

    ce = frappe.new_doc("Course Enrollment")
    ce.student = student
    ce.course = course
    ce.program_enrollment = program_enrollment
    ce.enrollment_date = nowdate()
    ce.insert(ignore_permissions=True)

    return {
        "success": True,
        "name": ce.name,
        "student": ce.student,
        "course": ce.course,
        "program": ce.program,
        "enrollment_date": str(ce.enrollment_date),
    }


@frappe.whitelist(methods=["POST"])
def drop_course_enrollment(enrollment_name: str):
    """Drops / deletes a course enrollment for a student."""
    _require_staff()

    if not enrollment_name or not frappe.db.exists(
        "Course Enrollment", enrollment_name
    ):
        frappe.throw(
            frappe._("Course Enrollment {0} does not exist.").format(enrollment_name)
        )

    frappe.delete_doc("Course Enrollment", enrollment_name, ignore_permissions=True)

    return {"success": True, "enrollment_name": enrollment_name}
