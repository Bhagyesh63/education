# Copyright (c) 2015, Frappe Technologies and contributors
# For license information, please see license.txt

import json
import frappe
from frappe import _
from education.education.api_modules.curriculum import (
    _get_user_instructors,
    _get_viewable_students,
    _has_any_role,
    _is_staff,
    _require_login,
    _require_staff,
    MANAGER_ROLES,
)

SCHEDULE_FIELDS = [
    "name",
    "schedule_date",
    "room",
    "class_schedule_color",
    "course",
    "from_time",
    "to_time",
    "instructor",
    "instructor_name",
    "title",
    "program",
    "student_group",
]


def _parse_list(value):
    if not value:
        return []
    if isinstance(value, str):
        try:
            value = json.loads(value)
        except Exception:
            value = [v.strip() for v in value.split(",") if v.strip()]
    if not isinstance(value, (list, tuple)):
        value = [value]
    out = []
    for v in value:
        if isinstance(v, dict):
            v = v.get("label") or v.get("name") or v.get("student_group")
        if v:
            out.append(str(v))
    return out


def _student_group_ids(students):
    """Active, enabled student groups the given students belong to."""
    if not students:
        return []
    sg = frappe.qb.DocType("Student Group")
    sgs = frappe.qb.DocType("Student Group Student")
    rows = (
        frappe.qb.from_(sg)
        .inner_join(sgs)
        .on(sg.name == sgs.parent)
        .select(sg.name)
        .where(sgs.student.isin(students))
        .where(sgs.active == 1)
        .where(sg.disabled == 0)
        .distinct()
        .run(pluck=True)
    )
    return list(rows)


def _instructor_group_ids(instructors):
    if not instructors:
        return []
    return list(
        set(
            frappe.get_all(
                "Student Group Instructor",
                filters={"parenttype": "Student Group", "instructor": ["in", instructors]},
                pluck="parent",
            )
        )
    )


def _resolve_instructor_ids(value):
    """Accepts an Instructor ID or an instructor display name; returns matching Instructor IDs."""
    if not value or value == "all":
        return []
    if frappe.db.exists("Instructor", value):
        return [value]
    return frappe.get_all("Instructor", filters={"instructor_name": value}, pluck="name")


def _get_schedule_scope(student=None):
    """Determines which Course Schedules the current user may read.

    Returns a dict:
      {"all": True}                                    -> managers / academics users
      {"groups": [...], "instructors": [...]}          -> instructors (own groups OR own lectures)
      {"groups": [...], "students": [...]}             -> students / guardians (enrolled groups only)
    """
    _require_login()
    is_manager = _has_any_role(MANAGER_ROLES)
    instructors = [] if is_manager else _get_user_instructors()
    # Academics Users without a linked Instructor record act as academic administrators;
    # anyone linked to an Instructor record (and not a manager) is scoped to own groups.
    is_full = is_manager or (_has_any_role({"Academics User"}) and not instructors)

    if student and (is_full or _is_staff()):
        # Staff looking at a particular student's timetable
        if not frappe.db.exists("Student", student):
            return {"groups": [], "students": []}
        return {"groups": _student_group_ids([student]), "students": [student]}

    if is_full:
        return {"all": True}

    if instructors or _has_any_role({"Instructor"}):
        return {"groups": _instructor_group_ids(instructors), "instructors": instructors}

    students = _get_viewable_students(student)
    return {"groups": _student_group_ids(students), "students": students}


@frappe.whitelist()
def get_course_schedule_events(
    start: str, end: str, filters: str | dict | list | None = None
):
    from frappe.utils import get_datetime, make_filter_tuple

    filters = frappe.parse_json(filters) if filters else []
    if isinstance(filters, dict):
        filters = [
            make_filter_tuple("Course Schedule", k, v) for k, v in filters.items()
        ]
    filters.append(["Course Schedule", "schedule_date", "between", [start, end]])

    data = frappe.get_list(
        "Course Schedule",
        fields=[
            "name",
            "course",
            "color",
            "schedule_date",
            "from_time",
            "to_time",
            "room",
            "student_group",
        ],
        filters=filters,
        limit_page_length=0,
    )

    for d in data:
        schedule_date = d.pop("schedule_date")
        for field in ("from_time", "to_time"):
            if schedule_date and d[field] is not None:
                d[field] = get_datetime(schedule_date) + d[field]
            else:
                d[field] = None
        d["allDay"] = 0

    return data


@frappe.whitelist()
def get_course_schedule_for_student(
    program_name: str = None,
    student_groups: list | str = None,
    student: str = None,
    instructor: str = None,
    from_date: str = None,
    to_date: str = None,
):
    """Returns course schedules visible to the current user.

    - Managers / Academics Users: all schedules (optionally filtered).
    - Instructors: lectures of their student groups or lectures they teach.
    - Students: lectures of the student groups they are enrolled in.
    - Guardians: lectures of their wards' groups (``student`` must be a ward).
    """
    scope = _get_schedule_scope(student)
    requested_groups = _parse_list(student_groups)

    filters = {}
    or_filters = None

    if program_name and program_name != "all":
        filters["program"] = program_name

    if from_date and to_date:
        filters["schedule_date"] = ["between", [from_date, to_date]]
    elif from_date:
        filters["schedule_date"] = [">=", from_date]
    elif to_date:
        filters["schedule_date"] = ["<=", to_date]

    if instructor and instructor != "all":
        ids = _resolve_instructor_ids(instructor)
        if not ids:
            return []
        filters["instructor"] = ["in", ids]

    if not scope.get("all"):
        allowed = scope.get("groups") or []
        if "instructors" in scope:
            # Visible: lectures of own student groups OR lectures they teach.
            mine = scope.get("instructors") or []
            visibility = []
            if allowed:
                visibility.append(["Course Schedule", "student_group", "in", allowed])
            if mine:
                visibility.append(["Course Schedule", "instructor", "in", mine])
            if not visibility:
                return []
            # or_filters are AND-ed with filters, so requested groups / instructor narrow further
            or_filters = visibility
            if requested_groups:
                filters["student_group"] = ["in", requested_groups]
        else:
            if not allowed:
                return []
            groups = [g for g in requested_groups if g in allowed]
            filters["student_group"] = ["in", groups or allowed]
    elif requested_groups:
        filters["student_group"] = ["in", requested_groups]

    return frappe.get_all(
        "Course Schedule",
        fields=SCHEDULE_FIELDS,
        filters=filters,
        or_filters=or_filters,
        order_by="schedule_date asc, from_time asc",
        limit_page_length=500 if (from_date or to_date) else 300,
    )


get_course_schedule = get_course_schedule_for_student


def _course_instructor_map(courses=None):
    """{course: [instructor IDs]} from Instructor Log rows and course-based Student Group instructors."""
    mapping = {}
    log_filters = {"parenttype": "Instructor", "course": ["is", "set"]}
    if courses:
        log_filters["course"] = ["in", courses]
    for row in frappe.get_all("Instructor Log", filters=log_filters, fields=["parent", "course"]):
        mapping.setdefault(row.course, set()).add(row.parent)

    sg = frappe.qb.DocType("Student Group")
    sgi = frappe.qb.DocType("Student Group Instructor")
    q = (
        frappe.qb.from_(sg)
        .inner_join(sgi)
        .on(sg.name == sgi.parent)
        .select(sg.course, sgi.instructor)
        .where(sg.group_based_on == "Course")
        .where(sg.course.isnotnull())
    )
    if courses:
        q = q.where(sg.course.isin(courses))
    for row in q.run(as_dict=True):
        if row.course and row.instructor:
            mapping.setdefault(row.course, set()).add(row.instructor)
    return {k: sorted(v) for k, v in mapping.items()}


def get_eligible_instructors(course: str = None, student_group: str = None):
    """Instructor IDs eligible to teach the given course / student group, based purely on
    Student Group Instructor and Instructor Log records. Falls back to all instructors
    when no assignment data exists."""
    eligible = []

    if student_group:
        assigned = frappe.get_all(
            "Student Group Instructor", {"parent": student_group}, pluck="instructor"
        )
        group_based_on = frappe.db.get_value("Student Group", student_group, "group_based_on")
        if group_based_on == "Course" and assigned:
            return assigned
        eligible.extend(assigned)

    if course:
        from_course = _course_instructor_map([course]).get(course)
        if from_course:
            return from_course

    return eligible or frappe.get_all("Instructor", pluck="name")


@frappe.whitelist()
def get_schedule_metadata():
    """Courses, Instructors, Student Groups and Rooms (with faculty mappings) for schedule planning.
    Staff only."""
    _require_staff(_("plan course schedules"))

    courses = frappe.get_all("Course", fields=["name", "course_name"], order_by="course_name asc", limit_page_length=0)
    instructors = frappe.get_all(
        "Instructor",
        fields=["name", "instructor_name", "department"],
        filters={"status": ["!=", "Left"]},
        order_by="instructor_name asc",
        limit_page_length=0,
    )
    student_groups = frappe.get_all(
        "Student Group",
        fields=["name", "student_group_name", "program", "course", "group_based_on", "academic_year", "default_room"],
        filters={"disabled": 0},
        order_by="student_group_name asc",
        limit_page_length=0,
    )
    rooms = frappe.get_all(
        "Room",
        fields=["name", "room_name", "room_number", "seating_capacity"],
        order_by="room_name asc",
        limit_page_length=0,
    )

    instructor_lookup = {i.name: i for i in instructors}

    group_instructors = {}
    for row in frappe.get_all(
        "Student Group Instructor",
        filters={"parenttype": "Student Group"},
        fields=["parent", "instructor", "instructor_name"],
        limit_page_length=0,
    ):
        group_instructors.setdefault(row.parent, []).append({
            "name": row.instructor,
            "instructor_name": row.instructor_name or row.instructor,
        })

    course_instructors = {}
    for course, ins_ids in _course_instructor_map().items():
        course_instructors[course] = [
            {"name": i, "instructor_name": (instructor_lookup.get(i) or {}).get("instructor_name") or i}
            for i in ins_ids
        ]

    my_instructors = _get_user_instructors()

    return {
        "courses": courses,
        "instructors": instructors,
        "student_groups": student_groups,
        "rooms": rooms,
        "group_instructors": group_instructors,
        "course_instructors": course_instructors,
        "current_instructor": my_instructors[0] if my_instructors else None,
    }


@frappe.whitelist(methods=["POST"])
def create_course_schedule(course, student_group, instructor, schedule_date, from_time, to_time, room=None):
    _require_staff(_("schedule lectures"))
    if not frappe.db.exists("Instructor", instructor):
        ids = _resolve_instructor_ids(instructor)
        if not ids:
            frappe.throw(_("Instructor {0} not found.").format(instructor))
        instructor = ids[0]
    doc = frappe.new_doc("Course Schedule")
    doc.course = course
    doc.student_group = student_group
    doc.instructor = instructor
    doc.schedule_date = schedule_date
    doc.from_time = from_time
    doc.to_time = to_time
    if room:
        doc.room = room
    program = frappe.db.get_value("Student Group", student_group, "program")
    if program:
        doc.program = program
    doc.insert(ignore_permissions=True)
    frappe.db.commit()
    return doc.as_dict()


@frappe.whitelist(methods=["POST"])
def delete_course_schedule(course_schedule: str):
    _require_staff(_("cancel lectures"))
    if not course_schedule:
        frappe.throw(_("Course Schedule ID is required"))
    if frappe.db.exists("Course Schedule", course_schedule):
        att_count = frappe.db.count("Student Attendance", {"course_schedule": course_schedule, "docstatus": ("!=", 2)})
        if att_count > 0:
            frappe.throw(
                _("Cannot delete lecture schedule: {0} attendance records are already submitted for this class.").format(att_count)
            )
        frappe.delete_doc("Course Schedule", course_schedule, ignore_permissions=True)
        frappe.db.commit()
        return {"status": "success", "message": _("Lecture schedule cancelled successfully.")}
    return {"status": "not_found", "message": _("Schedule record not found.")}


@frappe.whitelist()
def get_instructors(student_group: str):
    _require_login()
    return frappe.get_all(
        "Student Group Instructor", {"parent": student_group}, pluck="instructor"
    )


@frappe.whitelist(methods=["POST"])
def bulk_schedule_course(
    student_group: str,
    course: str,
    instructor: str,
    room: str,
    course_start_date: str,
    course_end_date: str,
    from_time: str,
    to_time: str,
    days: list | str,
    reschedule: int | bool = 0,
    class_schedule_color: str = "blue",
):
    import calendar
    from frappe.utils import add_days, get_time, getdate
    _require_staff(_("schedule lectures"))

    if isinstance(days, str):
        try:
            days = json.loads(days)
        except Exception:
            days = [d.strip() for d in days.split(",") if d.strip()]

    if not days:
        frappe.throw(_("Please select at least one day to schedule the course."))

    for value, label in (
        (student_group, _("Student Group")),
        (course, _("Course")),
        (instructor, _("Instructor")),
        (room, _("Room")),
        (from_time, _("From Time")),
        (to_time, _("To Time")),
        (course_start_date, _("Course Start Date")),
        (course_end_date, _("Course End Date")),
    ):
        if not value:
            frappe.throw(_("{0} is mandatory").format(label))

    if getdate(course_start_date) > getdate(course_end_date):
        frappe.throw(_("Course Start Date cannot be greater than Course End Date."))

    if get_time(from_time) >= get_time(to_time):
        frappe.throw(_("To Time must be later than From Time."))

    # Same as the desk tool: a course-based group always schedules its own course
    group_based_on, group_course = frappe.db.get_value(
        "Student Group", student_group, ["group_based_on", "course"]
    ) or (None, None)
    if group_based_on == "Course" and group_course:
        course = group_course

    # Validate faculty subject qualification
    eligible = get_eligible_instructors(course=course, student_group=student_group)
    if eligible and instructor not in eligible:
        ins_name = frappe.db.get_value("Instructor", instructor, "instructor_name") or instructor
        frappe.throw(
            _("Faculty {0} is not qualified or assigned to teach {1}.").format(ins_name, course)
        )

    instructor_name = frappe.db.get_value("Instructor", instructor, "instructor_name") or instructor
    program = frappe.db.get_value("Student Group", student_group, "program")

    rescheduled = []
    reschedule_errors = []

    created = []
    errors = []

    curr_date = getdate(course_start_date)
    end_date = getdate(course_end_date)

    # Reschedule (same as the desk Course Scheduling Tool): remove this student group's
    # schedules of this course within the date range on the selected weekdays, then recreate.
    # Lectures of other groups / courses are never touched; lectures that already have
    # attendance are kept and reported.
    if frappe.utils.cint(reschedule):
        for old in frappe.get_all(
            "Course Schedule",
            filters={
                "student_group": student_group,
                "course": course,
                "schedule_date": ["between", [course_start_date, course_end_date]],
            },
            fields=["name", "schedule_date", "room"],
        ):
            if calendar.day_name[getdate(old.schedule_date).weekday()] not in days:
                continue
            att_count = frappe.db.count(
                "Student Attendance", {"course_schedule": old.name, "docstatus": ("!=", 2)}
            )
            if att_count:
                reschedule_errors.append(
                    _("{0} ({1}) kept: {2} attendance records exist").format(
                        old.name, old.schedule_date, att_count
                    )
                )
                continue
            frappe.delete_doc("Course Schedule", old.name, ignore_permissions=True)
            rescheduled.append(old.name)

    while curr_date <= end_date:
        day_name = calendar.day_name[curr_date.weekday()]
        if day_name in days:
            date_str = str(curr_date)

            existing = frappe.db.exists(
                "Course Schedule",
                {
                    "student_group": student_group,
                    "course": course,
                    "schedule_date": date_str,
                    "from_time": from_time,
                    "to_time": to_time,
                    "room": room,
                    "instructor": instructor,
                },
            )
            if not existing:
                try:
                    cs = frappe.new_doc("Course Schedule")
                    cs.student_group = student_group
                    cs.course = course
                    cs.instructor = instructor
                    cs.instructor_name = instructor_name
                    cs.room = room
                    cs.schedule_date = date_str
                    cs.from_time = from_time
                    cs.to_time = to_time
                    cs.program = program
                    cs.class_schedule_color = class_schedule_color or "blue"
                    cs.insert(ignore_permissions=True)
                    created.append({
                        "name": cs.name,
                        "schedule_date": date_str,
                        "day": day_name,
                        "course": course,
                        "room": room,
                        "instructor": instructor_name,
                        "from_time": from_time,
                        "to_time": to_time,
                    })
                except frappe.ValidationError as ex:
                    # e.g. OverlapError (instructor / room / group already booked) or a date
                    # outside the academic term: skip this date and report it (like the desk).
                    if frappe.local.message_log:
                        frappe.local.message_log.pop()
                    errors.append({
                        "date": date_str,
                        "day": day_name,
                        "error": frappe.utils.strip_html(str(ex)),
                    })
        curr_date = add_days(curr_date, 1)

    frappe.db.commit()

    if not created and errors:
        return {
            "status": "error",
            "created_count": 0,
            "created": [],
            "errors_count": len(errors),
            "errors": errors,
            "rescheduled_count": len(rescheduled),
            "rescheduled": rescheduled,
            "reschedule_errors": reschedule_errors,
            "message": errors[0].get("error", _("Failed to create course schedules.")),
        }

    resched_note = _(" ({0} existing slots replaced)").format(len(rescheduled)) if rescheduled else ""
    return {
        "status": "success",
        "created_count": len(created),
        "created": created,
        "errors_count": len(errors),
        "errors": errors,
        "rescheduled_count": len(rescheduled),
        "rescheduled": rescheduled,
        "reschedule_errors": reschedule_errors,
        "message": _("{0} lecture schedules created successfully{1}.").format(len(created), resched_note),
    }

