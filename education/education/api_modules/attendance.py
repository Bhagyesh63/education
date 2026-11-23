# Copyright (c) 2015, Frappe Technologies and contributors
# For license information, please see license.txt

import json
import frappe
from frappe import _
from frappe.utils import getdate
from education.education.api_modules.students import get_student_groups


@frappe.whitelist()
def check_attendance_records_exist(
    course_schedule: str | None = None,
    student_group: str | None = None,
    date: str | None = None,
):
    if course_schedule:
        return frappe.get_list(
            "Student Attendance", filters={"course_schedule": course_schedule}
        )
    else:
        return frappe.get_list(
            "Student Attendance", filters={"student_group": student_group, "date": date}
        )


@frappe.whitelist(allow_guest=True)
def get_attendance_roster(
    student_group: str,
    date: str | None = None,
    course_schedule: str | None = None,
):
    date = date or frappe.utils.today()

    group_students = frappe.get_all(
        "Student Group Student",
        filters={"parent": student_group, "active": 1},
        fields=["student", "student_name", "group_roll_number"],
        order_by="group_roll_number asc, student_name asc",
    )

    if not group_students:
        sg = frappe.db.get_value("Student Group", student_group, ["group_based_on", "course", "program"], as_dict=True)
        if sg and (sg.group_based_on == "Course" or sg.course):
            course = sg.get("course")
            program = sg.get("program")
            ce_filters = {}
            if course:
                ce_filters["course"] = course
            if program:
                ce_filters["program"] = program

            enrolled = frappe.get_all(
                "Course Enrollment",
                filters=ce_filters,
                fields=["student", "student_name"],
                order_by="student_name asc",
            )
            if not enrolled and program:
                enrolled = frappe.get_all(
                    "Program Enrollment",
                    filters={"program": program, "docstatus": 1},
                    fields=["student", "student_name"],
                    order_by="student_name asc",
                )

            seen = set()
            for idx, cs in enumerate(enrolled, 1):
                if cs.student not in seen:
                    seen.add(cs.student)
                    group_students.append({
                        "student": cs.student,
                        "student_name": cs.student_name or frappe.db.get_value("Student", cs.student, "student_name"),
                        "group_roll_number": idx,
                    })

    if not group_students:
        return []

    att_filters = {
        "student_group": student_group,
        "date": date,
        "docstatus": 1,
    }
    if course_schedule:
        att_filters["course_schedule"] = course_schedule

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
            "from_date": ["<=", date],
            "to_date": [">=", date],
            "docstatus": 1,
        },
        fields=["student", "name as leave_application", "reason"],
    )
    leave_map = {l.student: l for l in approved_leaves}

    result = []
    for s in group_students:
        stu_id = s.student
        rec = attendance_map.get(stu_id)
        current_status = rec.status if rec else None
        leave_info = leave_map.get(stu_id)

        result.append({
            "student": stu_id,
            "student_name": s.student_name,
            "group_roll_number": s.group_roll_number,
            "status": current_status,
            "attendance_id": rec.name if rec else None,
            "on_leave": bool(leave_info or current_status == "Leave"),
            "leave_reason": leave_info.reason if leave_info else None,
            "leave_id": leave_info.leave_application if leave_info else None,
        })

    return result


@frappe.whitelist(allow_guest=True)
def mark_attendance(
    students_present: str | list,
    students_absent: str | list,
    course_schedule: str | None = None,
    student_group: str | None = None,
    date: str | None = None,
):
    date = date or frappe.utils.today()
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
                if getdate(date) < getdate(year_dates.year_start_date) or getdate(date) > getdate(
                    year_dates.year_end_date
                ):
                    frappe.throw(
                        _(
                            "Attendance cannot be marked outside of Academic Year {0}"
                        ).format(academic_year)
                    )

    if isinstance(students_present, str):
        present = json.loads(students_present) if students_present else []
    else:
        present = students_present or []

    if isinstance(students_absent, str):
        absent = json.loads(students_absent) if students_absent else []
    else:
        absent = students_absent or []

    for d in present:
        stu_id = d.get("student") if isinstance(d, dict) else d
        stu_name = (
            d.get("student_name")
            if isinstance(d, dict)
            else frappe.db.get_value("Student", stu_id, "student_name")
        )
        make_attendance_records(
            stu_id,
            stu_name,
            "Present",
            course_schedule,
            student_group,
            date,
        )

    for d in absent:
        stu_id = d.get("student") if isinstance(d, dict) else d
        stu_name = (
            d.get("student_name")
            if isinstance(d, dict)
            else frappe.db.get_value("Student", stu_id, "student_name")
        )
        make_attendance_records(
            stu_id,
            stu_name,
            "Absent",
            course_schedule,
            student_group,
            date,
        )

    frappe.msgprint(_("Attendance has been marked successfully."))
    return {
        "status": "success",
        "message": _("Attendance has been marked successfully."),
        "present_count": len(present),
        "absent_count": len(absent),
    }


def make_attendance_records(
    student, student_name, status, course_schedule=None, student_group=None, date=None
):
    existing_name = None
    if course_schedule:
        existing_name = frappe.db.get_value(
            "Student Attendance",
            {"student": student, "course_schedule": course_schedule, "docstatus": ("!=", 2)},
            "name",
        )
    else:
        existing_name = frappe.db.get_value(
            "Student Attendance",
            {"student": student, "student_group": student_group, "date": date, "docstatus": ("!=", 2)},
            "name",
        )

    if existing_name:
        att_doc = frappe.get_doc("Student Attendance", existing_name)
        if att_doc.status != status:
            att_doc.status = status
            att_doc.save(ignore_permissions=True)
            frappe.db.commit()
        return att_doc
    else:
        att_doc = frappe.new_doc("Student Attendance")
        att_doc.student = student
        att_doc.student_name = student_name or frappe.db.get_value("Student", student, "student_name")
        att_doc.course_schedule = course_schedule
        att_doc.student_group = student_group
        att_doc.date = date
        att_doc.status = status
        att_doc.insert(ignore_permissions=True)
        att_doc.submit()
        frappe.db.commit()
        return att_doc


@frappe.whitelist(allow_guest=True)
def get_student_attendance(student: str = None, student_group: str = None):
    filters = {"docstatus": 1}
    if student:
        filters["student"] = student
    if student_group and student_group != "all":
        filters["student_group"] = student_group

    return frappe.get_all(
        "Student Attendance",
        filters=filters,
        fields=["date", "status", "name", "student", "student_name", "student_group"],
        order_by="date desc",
        limit_page_length=100,
    )


@frappe.whitelist(allow_guest=True)
def get_school_holidays(holiday_list: str | None = None):
    if not holiday_list:
        holiday_list = (
            frappe.db.get_value("Holiday List", {"holiday_list_name": ["like", "%2026%"]}, "name")
            or frappe.db.get_value("Holiday List", {}, "name")
            or "ABC School Holidays 2026–2027"
        )

    if not holiday_list or not frappe.db.exists("Holiday List", holiday_list):
        return []

    return frappe.get_all(
        "Holiday",
        filters={"parent": holiday_list},
        fields=["holiday_date", "description"],
        order_by="holiday_date asc",
        limit_page_length=200,
    )


@frappe.whitelist(allow_guest=True)
def get_student_leaves(student=None):
    filters = {}
    if student and student != "all":
        filters["student"] = student

    leaves = frappe.get_all(
        "Student Leave Application",
        fields=["name", "student", "student_name", "from_date", "to_date", "reason", "docstatus", "attendance_based_on", "total_leave_days"],
        filters=filters,
        order_by="from_date desc",
        limit_page_length=50,
    )
    return leaves


@frappe.whitelist()
def approve_student_leave(leave_id):
    doc = frappe.get_doc("Student Leave Application", leave_id)
    if doc.docstatus == 0:
        doc.submit()
        frappe.db.commit()
    return {"status": "success", "docstatus": doc.docstatus}


@frappe.whitelist()
def apply_leave(leave_data: dict, program_name: str):
    if isinstance(leave_data, str):
        leave_data = json.loads(leave_data)

    attendance_based_on_course_schedule = frappe.db.get_single_value(
        "Education Settings", "attendance_based_on_course_schedule"
    )
    if attendance_based_on_course_schedule:
        create_student_leave_application_based_on_course_schedule(
            leave_data, program_name
        )
    else:
        create_student_leave_application_based_on_student_group(
            leave_data, program_name
        )


def create_student_leave_application_based_on_course_schedule(leave_data, program_name):
    course_schedule_in_leave_period = frappe.db.get_list(
        "Course Schedule",
        fields=["name", "schedule_date"],
        filters={
            "program": program_name,
            "schedule_date": [
                "between",
                [leave_data.get("from_date"), leave_data.get("to_date")],
            ],
        },
        order_by="schedule_date asc",
    )
    if not course_schedule_in_leave_period:
        frappe.throw(_("No classes found in the leave period"))

    student_leave_application = frappe.new_doc("Student Leave Application")
    student_leave_application.student = leave_data.get("student")
    student_leave_application.student_name = leave_data.get("student_name")
    student_leave_application.attendance_based_on = "Course Schedule"
    student_leave_application.course_schedule = course_schedule_in_leave_period[0].get(
        "name"
    )
    student_leave_application.from_date = leave_data.get("from_date")
    student_leave_application.to_date = leave_data.get("to_date")
    student_leave_application.reason = leave_data.get("reason")
    student_leave_application.save()


def create_student_leave_application_based_on_student_group(leave_data, program_name):
    student_groups = get_student_groups(leave_data.get("student"), program_name)
    group_name = student_groups[0].get("label") if student_groups else "Standard 5 - Section A"

    student_leave_application = frappe.new_doc("Student Leave Application")
    student_leave_application.student = leave_data.get("student")
    student_leave_application.student_name = leave_data.get("student_name")
    student_leave_application.attendance_based_on = "Student Group"
    student_leave_application.student_group = group_name
    student_leave_application.from_date = leave_data.get("from_date")
    student_leave_application.to_date = leave_data.get("to_date")
    student_leave_application.reason = leave_data.get("reason")
    student_leave_application.save()
