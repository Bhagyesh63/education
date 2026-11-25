# Copyright (c) 2015, Frappe Technologies and contributors
# For license information, please see license.txt

import json
import frappe
from frappe import _
from frappe.utils import getdate, today
from education.education.api_modules.common import get_guardians_for_user
from education.education.api_modules.students import get_student_groups

# ==============================================================================
# Access helpers (shared by attendance, assessment and fees modules)
# ==============================================================================

STAFF_ROLES = (
    "Instructor",
    "Academics User",
    "Education Manager",
    "System Manager",
    "Administrator",
)

FEE_VIEW_ROLES = STAFF_ROLES + ("Accounts User", "Accounts Manager")

FEE_MANAGER_ROLES = (
    "Accounts User",
    "Accounts Manager",
    "Education Manager",
    "System Manager",
    "Administrator",
)


def has_any_role(roles, user=None):
    user = user or frappe.session.user
    if not user or user == "Guest":
        return False
    if user == "Administrator":
        return True
    user_roles = frappe.get_roles(user)
    return any(r in user_roles for r in roles)


def is_staff_user(user=None):
    return has_any_role(STAFF_ROLES, user)


def require_login():
    if frappe.session.user == "Guest":
        frappe.throw(_("Please log in to continue."), frappe.PermissionError)


def require_roles(roles, message=None):
    require_login()
    if not has_any_role(roles):
        frappe.throw(
            message or _("You are not permitted to perform this action."),
            frappe.PermissionError,
        )


def require_staff(message=None):
    require_roles(
        STAFF_ROLES, message or _("Only school staff can perform this action.")
    )


def get_portal_student_ids(user=None, staff_roles=STAFF_ROLES):
    """None => unrestricted (staff). Otherwise the explicit list of students
    (own Student record + guardian wards) the user may access."""
    user = user or frappe.session.user
    if not user or user == "Guest":
        return []
    if has_any_role(staff_roles, user):
        return None

    ids = []
    own = frappe.db.get_value("Student", {"user": user}, "name")
    if own:
        ids.append(own)

    guardians = get_guardians_for_user(user)
    if guardians:
        wards = frappe.get_all(
            "Student Guardian",
            filters={"parenttype": "Student", "guardian": ["in", guardians]},
            pluck="parent",
        )
        for ward in wards:
            if ward not in ids:
                ids.append(ward)
    return ids


def resolve_student_scope(student=None, staff_roles=STAFF_ROLES):
    """Returns the list of students a query must be restricted to, or None for
    unrestricted staff queries. Raises PermissionError when a portal user asks
    for a student that is neither themselves nor one of their wards."""
    require_login()
    allowed = get_portal_student_ids(staff_roles=staff_roles)
    requested = student if student and student != "all" else None

    if allowed is None:
        return [requested] if requested else None

    if requested:
        if requested not in allowed:
            frappe.throw(
                _("You are not authorized to access this student's records."),
                frappe.PermissionError,
            )
        return [requested]
    return allowed


def assert_student_access(student, staff_roles=STAFF_ROLES):
    if not student:
        frappe.throw(_("Student is required."))
    resolve_student_scope(student, staff_roles=staff_roles)


# ==============================================================================
# Attendance
# ==============================================================================


@frappe.whitelist()
def check_attendance_records_exist(
    course_schedule: str | None = None,
    student_group: str | None = None,
    date: str | None = None,
):
    require_staff()
    if course_schedule:
        return frappe.get_all(
            "Student Attendance",
            filters={"course_schedule": course_schedule, "docstatus": 1},
        )
    return frappe.get_all(
        "Student Attendance",
        filters={"student_group": student_group, "date": date, "docstatus": 1},
    )


@frappe.whitelist()
def get_attendance_roster(
    student_group: str,
    date: str | None = None,
    course_schedule: str | None = None,
):
    require_staff()
    date = date or today()

    group_students = frappe.get_all(
        "Student Group Student",
        filters={"parent": student_group, "active": 1},
        fields=["student", "student_name", "group_roll_number"],
        order_by="group_roll_number asc, student_name asc",
    )

    # Only active members of the group (same as the desk tool): Student Attendance validation
    # rejects anyone who is not in the group, so enrolment-based fallbacks cannot be marked.
    if not group_students:
        return []

    student_ids = [s.student for s in group_students]

    att_filters = {"student": ["in", student_ids], "docstatus": 1}
    if course_schedule:
        att_filters["course_schedule"] = course_schedule
    else:
        # Group-level attendance only: per-lecture (course schedule) rows of the same day are
        # separate records (same as the desk Student Attendance Tool).
        att_filters["student_group"] = student_group
        att_filters["date"] = date
        att_filters["course_schedule"] = ["is", "not set"]

    attendance_map = {
        r.student: r
        for r in frappe.get_all(
            "Student Attendance",
            filters=att_filters,
            fields=["name", "student", "status", "leave_application"],
        )
    }

    approved_leaves = frappe.get_all(
        "Student Leave Application",
        filters={
            "student": ["in", student_ids],
            "from_date": ["<=", date],
            "to_date": [">=", date],
            "docstatus": 1,
        },
        fields=["student", "name", "reason"],
    )
    leave_map = {lv.student: lv for lv in approved_leaves}

    result = []
    for s in group_students:
        rec = attendance_map.get(s.student)
        current_status = rec.status if rec else None
        leave_info = leave_map.get(s.student)
        result.append(
            {
                "student": s.student,
                "student_name": s.student_name,
                "group_roll_number": s.group_roll_number,
                "status": current_status,
                "attendance_id": rec.name if rec else None,
                "on_leave": bool(leave_info or current_status == "Leave"),
                "leave_reason": leave_info.reason if leave_info else None,
                "leave_id": leave_info.name if leave_info else None,
            }
        )

    return result


@frappe.whitelist(methods=["POST"])
def mark_attendance(
    students_present: str | list,
    students_absent: str | list,
    course_schedule: str | None = None,
    student_group: str | None = None,
    date: str | None = None,
):
    require_staff(_("Only instructors and academic staff can mark attendance."))
    if not (student_group or course_schedule):
        frappe.throw(
            _("Student Group or Course Schedule is required to mark attendance.")
        )
    if course_schedule:
        # Attendance of a lecture always belongs to the lecture's group and date
        cs = frappe.db.get_value(
            "Course Schedule",
            course_schedule,
            ["student_group", "schedule_date"],
            as_dict=True,
        )
        if not cs:
            frappe.throw(_("Course Schedule {0} not found.").format(course_schedule))
        student_group = cs.student_group or student_group
        date = str(cs.schedule_date)
    date = date or today()

    if getdate(date) > getdate(today()):
        frappe.throw(_("Attendance cannot be marked for future dates."))

    if student_group:
        academic_year = frappe.db.get_value(
            "Student Group", student_group, "academic_year"
        )
        if academic_year:
            year_dates = frappe.db.get_value(
                "Academic Year",
                academic_year,
                ["year_start_date", "year_end_date"],
                as_dict=True,
            )
            if year_dates and year_dates.year_start_date and year_dates.year_end_date:
                if getdate(date) < getdate(year_dates.year_start_date) or getdate(
                    date
                ) > getdate(year_dates.year_end_date):
                    frappe.throw(
                        _(
                            "Attendance cannot be marked outside of Academic Year {0}"
                        ).format(academic_year)
                    )

    present = (
        json.loads(students_present)
        if isinstance(students_present, str) and students_present
        else (students_present if isinstance(students_present, list) else [])
    )
    absent = (
        json.loads(students_absent)
        if isinstance(students_absent, str) and students_absent
        else (students_absent if isinstance(students_absent, list) else [])
    )

    if not course_schedule:
        # The Student Attendance doctype allows only one record per student, group and date,
        # so group attendance cannot be added on top of per-lecture attendance.
        student_ids = [
            d.get("student") if isinstance(d, dict) else d for d in present + absent
        ]
        per_lecture = frappe.get_all(
            "Student Attendance",
            filters={
                "student": ["in", student_ids or [""]],
                "student_group": student_group,
                "date": date,
                "course_schedule": ["is", "set"],
                "docstatus": ["!=", 2],
            },
            fields=["student_name", "course_schedule"],
        )
        if per_lecture:
            frappe.throw(
                _(
                    "Attendance for {0} on {1} is already recorded per lecture (Course Schedule {2}) for {3}. "
                    "Use the Course Schedule mode to update it."
                ).format(
                    student_group,
                    frappe.utils.formatdate(date),
                    ", ".join(sorted({r.course_schedule for r in per_lecture})),
                    ", ".join(sorted({r.student_name for r in per_lecture})),
                ),
                title=_("Attendance already recorded"),
            )

    for status, rows in (("Present", present), ("Absent", absent)):
        for d in rows:
            stu_id = d.get("student") if isinstance(d, dict) else d
            if not stu_id or not frappe.db.exists("Student", stu_id):
                continue
            make_attendance_records(
                stu_id,
                frappe.db.get_value("Student", stu_id, "student_name"),
                status,
                course_schedule,
                student_group,
                date,
            )

    return {
        "status": "success",
        "message": _("Attendance has been marked successfully."),
        "present_count": len(present),
        "absent_count": len(absent),
    }


def make_attendance_records(
    student, student_name, status, course_schedule=None, student_group=None, date=None
):
    if course_schedule:
        existing_name = frappe.db.get_value(
            "Student Attendance",
            {
                "student": student,
                "course_schedule": course_schedule,
                "docstatus": ("!=", 2),
            },
            "name",
        )
    else:
        existing_name = frappe.db.get_value(
            "Student Attendance",
            {
                "student": student,
                "student_group": student_group,
                "date": date,
                "course_schedule": ("is", "not set"),
                "docstatus": ("!=", 2),
            },
            "name",
        )

    if existing_name:
        att_doc = frappe.get_doc("Student Attendance", existing_name)
        if att_doc.status != status:
            if att_doc.docstatus == 1:
                att_doc.db_set("status", status)
            else:
                att_doc.status = status
                att_doc.save(ignore_permissions=True)
        if att_doc.docstatus == 0:
            att_doc.submit()
        return att_doc

    att_doc = frappe.new_doc("Student Attendance")
    att_doc.student = student
    att_doc.student_name = student_name or frappe.db.get_value(
        "Student", student, "student_name"
    )
    att_doc.course_schedule = course_schedule
    att_doc.student_group = student_group
    att_doc.date = date
    att_doc.status = status
    att_doc.insert(ignore_permissions=True)
    att_doc.submit()
    return att_doc


@frappe.whitelist()
def get_student_attendance(
    student: str | None = None,
    student_group: str | None = None,
    from_date: str | None = None,
    to_date: str | None = None,
):
    scope = resolve_student_scope(student)
    if scope is not None and not scope:
        return []

    filters = {"docstatus": 1}
    if scope is not None:
        filters["student"] = ["in", scope]
    if student_group and student_group != "all":
        filters["student_group"] = student_group
    if from_date and to_date:
        filters["date"] = ["between", [from_date, to_date]]

    records = frappe.get_all(
        "Student Attendance",
        filters=filters,
        fields=[
            "date",
            "status",
            "name",
            "student",
            "student_name",
            "student_group",
            "course_schedule",
            "leave_application",
        ],
        order_by="date desc",
        limit_page_length=500,
    )

    schedules = list({r.course_schedule for r in records if r.course_schedule})
    if schedules:
        course_map = dict(
            frappe.get_all(
                "Course Schedule",
                filters={"name": ["in", schedules]},
                fields=["name", "course"],
                as_list=True,
            )
        )
        for r in records:
            if r.course_schedule:
                r["course"] = course_map.get(r.course_schedule)
    return records


def _resolve_holiday_list(holiday_list=None):
    if holiday_list and frappe.db.exists("Holiday List", holiday_list):
        return holiday_list

    current = today()
    company = frappe.defaults.get_user_default(
        "Company"
    ) or frappe.defaults.get_global_default("company")
    if company:
        default_list = frappe.db.get_value("Company", company, "default_holiday_list")
        if default_list:
            return default_list

    covering = frappe.get_all(
        "Holiday List",
        filters={"from_date": ["<=", current], "to_date": [">=", current]},
        pluck="name",
        order_by="from_date desc",
        limit=1,
    )
    if covering:
        return covering[0]

    latest = frappe.get_all(
        "Holiday List", pluck="name", order_by="to_date desc", limit=1
    )
    return latest[0] if latest else None


@frappe.whitelist()
def get_school_holidays(holiday_list: str | None = None, include_weekly_off: int = 0):
    require_login()
    holiday_list = _resolve_holiday_list(holiday_list)
    if not holiday_list:
        return []

    list_meta = (
        frappe.db.get_value(
            "Holiday List", holiday_list, ["from_date", "to_date"], as_dict=True
        )
        or {}
    )

    filters = {"parent": holiday_list, "parenttype": "Holiday List"}
    if not int(include_weekly_off or 0):
        filters["weekly_off"] = 0

    holidays = frappe.get_all(
        "Holiday",
        filters=filters,
        fields=["holiday_date", "description", "weekly_off"],
        order_by="holiday_date asc",
        limit_page_length=500,
    )
    for h in holidays:
        h["holiday_list"] = holiday_list
        h["list_from_date"] = list_meta.get("from_date")
        h["list_to_date"] = list_meta.get("to_date")
        h["description"] = frappe.utils.strip_html(h.description or "") or _("Holiday")
    return holidays


@frappe.whitelist()
def get_student_leaves(student: str | None = None):
    scope = resolve_student_scope(student)
    if scope is not None and not scope:
        return []

    filters = {}
    if scope is not None:
        filters["student"] = ["in", scope]

    return frappe.get_all(
        "Student Leave Application",
        fields=[
            "name",
            "student",
            "student_name",
            "from_date",
            "to_date",
            "reason",
            "docstatus",
            "attendance_based_on",
            "total_leave_days",
        ],
        filters=filters,
        order_by="from_date desc",
        limit_page_length=100,
    )


@frappe.whitelist(methods=["POST"])
def approve_student_leave(leave_id: str):
    require_staff(
        _("Only instructors and academic staff can approve leave applications.")
    )
    doc = frappe.get_doc("Student Leave Application", leave_id)
    if doc.docstatus == 0:
        doc.flags.ignore_permissions = True
        doc.submit()
    return {"status": "success", "docstatus": doc.docstatus}


@frappe.whitelist(methods=["POST"])
def apply_leave(leave_data: dict | str, program_name: str | None = None):
    require_login()
    if isinstance(leave_data, str):
        leave_data = json.loads(leave_data)
    leave_data = frappe._dict(leave_data or {})

    student = leave_data.get("student")
    assert_student_access(student)

    if not leave_data.get("from_date") or not leave_data.get("to_date"):
        frappe.throw(_("From Date and To Date are required."))
    if getdate(leave_data.to_date) < getdate(leave_data.from_date):
        frappe.throw(_("To Date cannot be before From Date."))
    if not (leave_data.get("reason") or "").strip():
        frappe.throw(_("Please provide a reason for the leave."))

    # Never trust client-sent names
    leave_data.student_name = frappe.db.get_value("Student", student, "student_name")

    if not program_name:
        program_name = frappe.db.get_value(
            "Program Enrollment",
            {"student": student, "docstatus": 1},
            "program",
            order_by="creation desc",
        )

    attendance_based_on_course_schedule = frappe.db.get_single_value(
        "Education Settings", "attendance_based_on_course_schedule"
    )
    if attendance_based_on_course_schedule:
        doc = create_student_leave_application_based_on_course_schedule(
            leave_data, program_name
        )
    else:
        doc = create_student_leave_application_based_on_student_group(
            leave_data, program_name
        )

    return {"name": doc.name, "docstatus": doc.docstatus}


def create_student_leave_application_based_on_course_schedule(leave_data, program_name):
    filters = {
        "schedule_date": [
            "between",
            [leave_data.get("from_date"), leave_data.get("to_date")],
        ],
    }
    if program_name:
        filters["program"] = program_name

    course_schedule_in_leave_period = frappe.get_all(
        "Course Schedule",
        fields=["name", "schedule_date"],
        filters=filters,
        order_by="schedule_date asc",
    )
    if not course_schedule_in_leave_period:
        frappe.throw(_("No classes found in the leave period"))

    doc = frappe.new_doc("Student Leave Application")
    doc.student = leave_data.get("student")
    doc.student_name = leave_data.get("student_name")
    doc.attendance_based_on = "Course Schedule"
    doc.course_schedule = course_schedule_in_leave_period[0].get("name")
    doc.from_date = leave_data.get("from_date")
    doc.to_date = leave_data.get("to_date")
    doc.reason = leave_data.get("reason")
    doc.insert(ignore_permissions=True)
    return doc


def create_student_leave_application_based_on_student_group(leave_data, program_name):
    student = leave_data.get("student")
    groups = get_student_groups(student, program_name) if program_name else []
    if not groups:
        groups = [
            {"label": g}
            for g in frappe.get_all(
                "Student Group Student",
                filters={"student": student, "active": 1},
                pluck="parent",
            )
        ]
    if not groups:
        frappe.throw(
            _(
                "No active student group found for {0}. Please contact the school office."
            ).format(leave_data.get("student_name") or student)
        )

    doc = frappe.new_doc("Student Leave Application")
    doc.student = student
    doc.student_name = leave_data.get("student_name")
    doc.attendance_based_on = "Student Group"
    doc.student_group = groups[0].get("label")
    doc.from_date = leave_data.get("from_date")
    doc.to_date = leave_data.get("to_date")
    doc.reason = leave_data.get("reason")
    doc.insert(ignore_permissions=True)
    return doc
