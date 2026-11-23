# Copyright (c) 2015, Frappe Technologies and contributors
# For license information, please see license.txt

import json
import frappe
from frappe import _
from frappe.utils import cstr, flt, now
from education.education.api_modules.common import _resolve_portal_student
from education.education.api_modules.students import get_student_group_students


@frappe.whitelist(allow_guest=True)
def get_quiz_status(quiz_name: str, student: str = None):
    if not quiz_name or not frappe.db.exists("Quiz", quiz_name):
        return {}

    quiz_doc = frappe.get_doc("Quiz", quiz_name)
    user_roles = frappe.get_roles()
    is_staff = any(r in user_roles for r in ["Instructor", "Academics User", "Education Manager", "System Manager", "Administrator"])

    student_id = student or _resolve_portal_student()
    max_attempts = int(quiz_doc.max_attempts or 2)
    total_submissions = frappe.db.count("Quiz Activity", filters={"quiz": quiz_name})

    if is_staff and not student:
        return {
            "is_teacher": True,
            "max_attempts": max_attempts,
            "passing_score": quiz_doc.passing_score or 70.0,
            "total_submissions": total_submissions,
            "is_locked": False,
            "attempts_used": 0,
            "attempts_remaining": max_attempts,
        }

    if not student_id:
        student_id = "EDU-STU-2026-00001"

    existing_activities = frappe.db.get_list(
        "Quiz Activity",
        filters={"quiz": quiz_name, "student": student_id},
        fields=["name", "score", "status", "activity_date", "creation"],
        order_by="creation asc"
    )

    attempts_used = len(existing_activities)
    is_locked = attempts_used >= max_attempts
    highest_score = 0
    for act in existing_activities:
        try:
            val = float(str(act.score).replace("%", "").strip())
            if val > highest_score:
                highest_score = val
        except Exception:
            pass

    return {
        "is_teacher": is_staff,
        "student_id": student_id,
        "max_attempts": max_attempts,
        "attempts_used": attempts_used,
        "attempts_remaining": max(0, max_attempts - attempts_used),
        "is_locked": is_locked,
        "highest_score": highest_score,
        "passing_score": quiz_doc.passing_score or 70.0,
        "total_submissions": total_submissions,
        "history": existing_activities,
    }


@frappe.whitelist(allow_guest=True)
def submit_quiz_assessment(quiz_name: str, answers, course_name: str = None, student: str = None, time_taken: float = 0):
    if isinstance(answers, str):
        try:
            answers = json.loads(answers)
        except Exception:
            answers = {}
    elif not isinstance(answers, dict):
        answers = {}

    if not quiz_name or not frappe.db.exists("Quiz", quiz_name):
        frappe.throw("Invalid or missing Quiz.")

    quiz_doc = frappe.get_doc("Quiz", quiz_name)
    user_roles = frappe.get_roles()
    is_staff = any(r in user_roles for r in ["Instructor", "Academics User", "Education Manager", "System Manager", "Administrator"])

    if is_staff and not student:
        questions = quiz_doc.question or []
        correct_count = 0
        total_q = len(questions)
        for idx, q_row in enumerate(questions):
            selected = answers.get(str(idx)) or answers.get(idx)
            if q_row.question_link and frappe.db.exists("Question", q_row.question_link):
                q_doc = frappe.get_doc("Question", q_row.question_link)
                for opt in (q_doc.options or []):
                    if opt.option == selected and opt.is_correct:
                        correct_count += 1
                        break
        percent = round((correct_count / total_q) * 100) if total_q > 0 else 0
        passing_score = quiz_doc.passing_score or 70.0
        return {
            "success": True,
            "preview": True,
            "score": percent,
            "passed": percent >= passing_score,
            "correct_count": correct_count,
            "total_questions": total_q,
            "attempts_used": 1,
            "max_attempts": quiz_doc.max_attempts or 2,
            "is_locked": False,
            "message": "Teacher Preview Assessment Complete (Not recorded in student database).",
        }

    student_id = student or _resolve_portal_student() or "EDU-STU-2026-00001"

    existing_activities = frappe.db.get_list(
        "Quiz Activity",
        filters={"quiz": quiz_name, "student": student_id},
        fields=["name", "score", "status", "creation"]
    )
    max_attempts = int(quiz_doc.max_attempts or 2)
    attempts_used = len(existing_activities)

    if attempts_used >= max_attempts:
        frappe.throw(f"Maximum attempts ({max_attempts}) reached. You cannot retake this quiz.")

    questions = quiz_doc.question or []
    correct_count = 0
    total_q = len(questions)
    result_rows = []

    for idx, q_row in enumerate(questions):
        selected = answers.get(str(idx)) or answers.get(idx) or ""
        is_correct = False
        if q_row.question_link and frappe.db.exists("Question", q_row.question_link):
            q_doc = frappe.get_doc("Question", q_row.question_link)
            for opt in (q_doc.options or []):
                if opt.option == selected and opt.is_correct:
                    is_correct = True
                    correct_count += 1
                    break
        result_rows.append({
            "question": q_row.question_link or "",
            "selected_option": selected,
            "quiz_result": "Correct" if is_correct else "Wrong"
        })

    percent = round((correct_count / total_q) * 100) if total_q > 0 else 0
    passing_score = float(quiz_doc.passing_score or 70.0)
    passed = percent >= passing_score

    qa = frappe.new_doc("Quiz Activity")
    qa.quiz = quiz_name
    qa.student = student_id
    qa.course = course_name or ""
    qa.status = "Pass" if passed else "Fail"
    qa.score = f"{percent}%"
    qa.activity_date = now()
    qa.time_taken = float(time_taken or 0)

    for r in result_rows:
        qa.append("result", r)

    qa.insert(ignore_permissions=True)
    frappe.db.commit()

    new_attempts_used = attempts_used + 1
    is_now_locked = new_attempts_used >= max_attempts

    return {
        "success": True,
        "preview": False,
        "activity_name": qa.name,
        "score": percent,
        "passed": passed,
        "correct_count": correct_count,
        "total_questions": total_q,
        "attempts_used": new_attempts_used,
        "max_attempts": max_attempts,
        "is_locked": is_now_locked,
        "message": f"Quiz submitted successfully! You scored {percent}%.",
    }


@frappe.whitelist(allow_guest=True)
def get_quiz_student_submissions(quiz_name: str, course_name: str = None):
    if not quiz_name:
        return {"submissions": [], "stats": {}}

    filters = {"quiz": quiz_name}
    if course_name:
        filters["course"] = course_name

    activities = frappe.db.get_list(
        "Quiz Activity",
        filters=filters,
        fields=["name", "student", "course", "quiz", "status", "score", "activity_date", "creation", "time_taken"],
        order_by="creation asc"
    )

    student_attempts = {}
    enhanced = []

    for act in activities:
        stu_id = act.student
        student_attempts[stu_id] = student_attempts.get(stu_id, 0) + 1
        attempt_num = student_attempts[stu_id]

        student_name = frappe.db.get_value("Student", stu_id, "student_name") or stu_id
        student_email = frappe.db.get_value("Student", stu_id, "student_email_id") or ""
        enrollment = frappe.db.get_value("Program Enrollment", {"student": stu_id, "docstatus": 1}, ["program", "academic_year"], as_dict=True)

        score_clean = str(act.score or "0").replace("%", "").strip()
        score_val = float(score_clean) if score_clean.replace(".", "").isdigit() else 0

        enhanced.append({
            "name": act.name,
            "student": stu_id,
            "student_name": student_name,
            "student_email": student_email,
            "program": enrollment.program if enrollment else "Standard 6",
            "score": f"{score_clean}%",
            "score_num": score_val,
            "status": act.status or ("Pass" if score_val >= 70 else "Fail"),
            "attempt_number": attempt_num,
            "activity_date": str(act.activity_date or act.creation),
            "time_taken": act.time_taken,
        })

    total_attempts = len(enhanced)
    unique_students = len(student_attempts)
    passed_count = sum(1 for s in enhanced if s["status"] == "Pass")
    pass_rate = round((passed_count / total_attempts) * 100) if total_attempts > 0 else 0
    avg_score = round(sum(s["score_num"] for s in enhanced) / total_attempts) if total_attempts > 0 else 0

    enhanced.sort(key=lambda x: x["activity_date"], reverse=True)

    return {
        "submissions": enhanced,
        "stats": {
            "total_attempts": total_attempts,
            "unique_students": unique_students,
            "pass_rate": pass_rate,
            "avg_score": avg_score,
        }
    }


@frappe.whitelist()
def get_assessment_criteria(course: str):
    return frappe.get_all(
        "Course Assessment Criteria",
        fields=["assessment_criteria", "weightage"],
        filters={"parent": course},
        order_by="idx",
    )


@frappe.whitelist()
def get_assessment_students(assessment_plan: str, student_group: str):
    student_list = get_student_group_students(student_group)
    for i, student in enumerate(student_list):
        result = get_result(student.student, assessment_plan)
        if result:
            student_result = {}
            for d in result.details:
                student_result.update({d.assessment_criteria: [cstr(d.score), d.grade]})
            student_result.update(
                {
                    "total_score": [cstr(result.total_score), result.grade],
                    "comment": result.comment,
                }
            )
            student.update(
                {
                    "assessment_details": student_result,
                    "docstatus": result.docstatus,
                    "name": result.name,
                }
            )
        else:
            student.update({"assessment_details": None})
    return student_list


@frappe.whitelist()
def get_assessment_details(assessment_plan: str):
    return frappe.get_all(
        "Assessment Plan Criteria",
        fields=["assessment_criteria", "maximum_score", "docstatus"],
        filters={"parent": assessment_plan},
        order_by="idx",
    )


def get_result(student, assessment_plan):
    results = frappe.get_all(
        "Assessment Result",
        filters={
            "student": student,
            "assessment_plan": assessment_plan,
            "docstatus": ("!=", 2),
        },
    )
    if results:
        return frappe.get_doc("Assessment Result", results[0])
    return None


@frappe.whitelist(allow_guest=True)
def get_grading_scale_intervals(
    grading_scale: str = None,
    assessment_plan: str = None,
    assessment_result: str = None,
    course: str = None,
    program: str = None,
):
    scale_name = None

    if grading_scale and frappe.db.exists("Grading Scale", grading_scale):
        scale_name = grading_scale
    elif assessment_plan:
        scale_name = frappe.db.get_value("Assessment Plan", assessment_plan, "grading_scale")
        if not scale_name:
            plan_course = frappe.db.get_value("Assessment Plan", assessment_plan, "course")
            if plan_course:
                scale_name = frappe.db.get_value("Course", plan_course, "default_grading_scale")
    elif assessment_result:
        res = frappe.db.get_value(
            "Assessment Result",
            assessment_result,
            ["grading_scale", "assessment_plan", "course"],
            as_dict=True,
        )
        if res:
            scale_name = res.grading_scale
            if not scale_name and res.assessment_plan:
                scale_name = frappe.db.get_value("Assessment Plan", res.assessment_plan, "grading_scale")
            if not scale_name and res.course:
                scale_name = frappe.db.get_value("Course", res.course, "default_grading_scale")
    elif course:
        scale_name = frappe.db.get_value("Course", course, "default_grading_scale")

    if not scale_name or not frappe.db.exists("Grading Scale", scale_name):
        # Fallback to ABC School Grading Scale or first available grading scale
        if frappe.db.exists("Grading Scale", "ABC School Grading Scale"):
            scale_name = "ABC School Grading Scale"
        else:
            scale_name = frappe.db.get_value("Grading Scale", {}, "name")

    if not scale_name:
        return {"grading_scale": None, "intervals": []}

    raw_intervals = frappe.get_all(
        "Grading Scale Interval",
        filters={"parent": scale_name},
        fields=["grade_code", "threshold", "grade_description"],
        order_by="threshold desc",
    )

    intervals = [
        {
            "grade": item.grade_code,
            "min_percentage": flt(item.threshold),
            "description": item.grade_description or "",
        }
        for item in raw_intervals
    ]

    return {
        "grading_scale": scale_name,
        "intervals": intervals,
    }


@frappe.whitelist(allow_guest=True)
def get_grade(grading_scale: str, percentage: float):
    scale_data = get_grading_scale_intervals(grading_scale=grading_scale)
    intervals = scale_data.get("intervals") or []
    for interval in intervals:
        if flt(percentage) >= flt(interval.get("min_percentage", 0)):
            return interval.get("grade")
    return intervals[-1].get("grade") if intervals else ""


@frappe.whitelist()
def mark_assessment_result(assessment_plan: str, scores: str):
    student_score = json.loads(scores)
    assessment_details = []
    for criteria in student_score.get("assessment_details"):
        assessment_details.append(
            {
                "assessment_criteria": criteria,
                "score": flt(student_score["assessment_details"][criteria]),
            }
        )
    assessment_result = get_assessment_result_doc(
        student_score["student"], assessment_plan
    )
    assessment_result.update(
        {
            "student": student_score.get("student"),
            "assessment_plan": assessment_plan,
            "comment": student_score.get("comment"),
            "total_score": student_score.get("total_score"),
            "details": assessment_details,
        }
    )
    assessment_result.save()
    details = {}
    for d in assessment_result.details:
        details.update({d.assessment_criteria: d.grade})
    return {
        "name": assessment_result.name,
        "student": assessment_result.student,
        "total_score": assessment_result.total_score,
        "grade": assessment_result.grade,
        "details": details,
    }


@frappe.whitelist()
def submit_assessment_results(assessment_plan: str, student_group: str):
    total_result = 0
    student_list = get_student_group_students(student_group)
    for i, student in enumerate(student_list):
        doc = get_result(student.student, assessment_plan)
        if doc and doc.docstatus == 0:
            total_result += 1
            doc.submit()
    return total_result


def get_assessment_result_doc(student, assessment_plan):
    assessment_result = frappe.get_all(
        "Assessment Result",
        filters={
            "student": student,
            "assessment_plan": assessment_plan,
            "docstatus": ("!=", 2),
        },
    )
    if assessment_result:
        doc = frappe.get_doc("Assessment Result", assessment_result[0])
        if doc.docstatus == 0:
            return doc
        elif doc.docstatus == 1:
            frappe.msgprint(_("Result already Submitted"))
            return None
    return frappe.new_doc("Assessment Result")


@frappe.whitelist(allow_guest=True)
def get_student_assessment_results(student=None, program=None, course=None):
    filters = {"docstatus": 1}

    if student and student != "all":
        filters["student"] = student

    if program and program != "all":
        filters["program"] = program

    if course and course != "all":
        filters["course"] = course

    results = frappe.get_all(
        "Assessment Result",
        fields=[
            "name",
            "student",
            "student_name",
            "student_group",
            "course",
            "assessment_group",
            "program",
            "total_score",
            "maximum_score",
            "grade",
            "comment",
            "assessment_plan",
            "grading_scale",
            "academic_year",
            "academic_term",
            "creation",
        ],
        filters=filters,
        order_by="creation desc, student_name asc",
        limit_page_length=200,
    )
    for r in results:
        r["details"] = frappe.get_all(
            "Assessment Result Detail",
            fields=["assessment_criteria", "maximum_score", "score", "grade"],
            filters={"parent": r.name},
            order_by="idx",
        )
    return results


@frappe.whitelist(allow_guest=True)
def get_assessment_plans(student_group: str = None, course: str = None, program: str = None):
    filters = {"docstatus": ("!=", 2)}
    if student_group and student_group != "all":
        filters["student_group"] = student_group
    if course and course != "all":
        filters["course"] = course
    if program and program != "all":
        filters["program"] = program

    plans = frappe.get_all(
        "Assessment Plan",
        fields=[
            "name",
            "assessment_name",
            "course",
            "student_group",
            "assessment_group",
            "grading_scale",
            "maximum_assessment_score",
            "schedule_date",
            "room",
            "examiner",
            "from_time",
            "to_time",
            "program",
            "docstatus",
        ],
        filters=filters,
        order_by="creation desc",
        limit_page_length=100,
    )
    for p in plans:
        criteria = frappe.get_all(
            "Assessment Plan Criteria",
            fields=["assessment_criteria", "maximum_score"],
            filters={"parent": p.name},
            order_by="idx",
        )
        p["criteria"] = criteria
        p["results_count"] = frappe.db.count("Assessment Result", {"assessment_plan": p.name, "docstatus": 1})
    return plans


@frappe.whitelist(allow_guest=True)
def get_assessment_setup_metadata():
    """Returns programs, student groups, courses, grading scales, assessment groups, and criteria for assessment setup."""
    programs = frappe.get_all("Program", fields=["name", "program_name"], order_by="name asc")
    student_groups = frappe.get_all(
        "Student Group",
        fields=["name", "student_group_name", "program", "academic_year"],
        order_by="name asc",
        limit_page_length=100
    )
    courses = frappe.get_all("Course", fields=["name", "course_name"], order_by="name asc", limit_page_length=100)
    assessment_groups = frappe.get_all(
        "Assessment Group",
        fields=["name", "assessment_group_name", "is_group"],
        filters={"is_group": 0},
        order_by="name asc"
    )
    if not assessment_groups:
        assessment_groups = frappe.get_all("Assessment Group", fields=["name", "assessment_group_name"], order_by="name asc")
    grading_scales = frappe.get_all("Grading Scale", fields=["name"], order_by="name asc")
    criteria = frappe.get_all("Assessment Criteria", fields=["name", "assessment_criteria"], order_by="name asc")

    return {
        "programs": programs,
        "student_groups": student_groups,
        "courses": courses,
        "assessment_groups": assessment_groups,
        "grading_scales": grading_scales,
        "criteria": criteria,
    }


@frappe.whitelist()
def create_assessment_plan(
    student_group: str,
    course: str,
    assessment_group: str = None,
    grading_scale: str = None,
    assessment_name: str = None,
    schedule_date: str = None,
    criteria: str | list = None,
    program: str = None,
):
    if not program:
        program = frappe.db.get_value("Student Group", student_group, "program")

    academic_year = frappe.db.get_value("Student Group", student_group, "academic_year") or "2026-2027"

    if not grading_scale:
        grading_scale = frappe.db.get_value("Course", course, "default_grading_scale") or "ABC School Grading Scale"

    if not assessment_group:
        ag_name = f"{program} - Term 1 Exams" if program else "All Assessment Groups"
        if not frappe.db.exists("Assessment Group", ag_name):
            try:
                ag_doc = frappe.new_doc("Assessment Group")
                ag_doc.assessment_group_name = ag_name
                ag_doc.parent_assessment_group = "All Assessment Groups"
                ag_doc.is_group = 0
                ag_doc.insert(ignore_permissions=True)
                frappe.db.commit()
            except Exception:
                ag_name = "All Assessment Groups"
        assessment_group = ag_name

    doc = frappe.new_doc("Assessment Plan")
    doc.student_group = student_group
    doc.course = course
    doc.assessment_group = assessment_group
    doc.grading_scale = grading_scale
    doc.assessment_name = assessment_name or f"{course} - {student_group} Assessment"
    doc.program = program
    doc.academic_year = academic_year
    doc.schedule_date = schedule_date or today()

    parsed_criteria = json.loads(criteria) if isinstance(criteria, str) else (criteria or [])
    total_max_score = 0.0
    if parsed_criteria:
        for c in parsed_criteria:
            score = flt(c.get("maximum_score", 100))
            total_max_score += score
            doc.append("assessment_criteria", {
                "assessment_criteria": c.get("assessment_criteria") or c.get("name"),
                "maximum_score": score,
            })
    else:
        # Default criteria
        doc.append("assessment_criteria", {
            "assessment_criteria": "Class Performance",
            "maximum_score": 100.0,
        })
        total_max_score = 100.0

    doc.maximum_assessment_score = total_max_score
    doc.insert(ignore_permissions=True)
    doc.submit()
    frappe.db.commit()
    return doc.as_dict()


@frappe.whitelist(allow_guest=True)
def get_student_report_card_data(
    student: str,
    academic_year: str = None,
    academic_term: str = None,
    program: str = None,
    student_group: str = None,
):
    """Generates complete report card data including student demographics, attendance, subject marks, GPA, and grading scale."""
    if not student:
        return {}

    stu_doc = frappe.get_doc("Student", student)
    enrollment = frappe.db.get_value(
        "Program Enrollment",
        {"student": student, "docstatus": 1},
        ["name", "program", "academic_year", "student_batch_name", "student_category"],
        as_dict=True,
    )

    prog_name = program or (enrollment.program if enrollment else "")
    acad_yr = academic_year or (enrollment.academic_year if enrollment else "")
    if not acad_yr:
        acad_yr = frappe.db.get_single_value("Education Settings", "current_academic_year") or "2028-2029"

    # Roll number
    roll_no = ""
    if student_group:
        roll_no = frappe.db.get_value(
            "Student Group Student",
            {"parent": student_group, "student": student},
            "group_roll_number"
        )
    if not roll_no:
        roll_no = frappe.db.get_value("Student Group Student", {"student": student}, "group_roll_number") or ""

    # Guardian details
    guardian_name = ""
    guardian_phone = ""
    guardians = frappe.get_all("Student Guardian", filters={"parent": student}, fields=["guardian"], limit=1)
    if guardians:
        g_doc = frappe.db.get_value("Guardian", guardians[0].guardian, ["guardian_name", "mobile_number"], as_dict=True)
        if g_doc:
            guardian_name = g_doc.guardian_name or ""
            guardian_phone = g_doc.mobile_number or ""

    # Attendance calculation
    attendance = {"present": 0, "absent": 0, "total": 0, "percentage": 100.0}
    try:
        from education.education.doctype.student_report_generation_tool.student_report_generation_tool import get_attendance_count
        att_res = get_attendance_count(student, acad_yr, academic_term)
        if att_res:
            present = getattr(att_res, "present", 0) or 0
            absent = getattr(att_res, "absent", 0) or 0
            total = getattr(att_res, "total", 0) or 0
            pct = round((present / total * 100), 1) if total > 0 else 100.0
            attendance = {"present": present, "absent": absent, "total": total, "percentage": pct}
    except Exception:
        # Fallback to direct query
        data = frappe.get_all(
            "Student Attendance",
            filters={"student": student, "docstatus": 1},
            fields=["status", "count(name) as count"],
            group_by="status",
        )
        total_days = 0
        pres_days = 0
        abs_days = 0
        for d in data:
            if d.status == "Present":
                pres_days = d.count
            elif d.status == "Absent":
                abs_days = d.count
            total_days += d.count
        if total_days > 0:
            attendance = {
                "present": pres_days,
                "absent": abs_days,
                "total": total_days,
                "percentage": round((pres_days / total_days * 100), 1)
            }

    # Assessment Results
    results_filters = {"student": student, "docstatus": ("!=", 2)}
    if acad_yr:
        results_filters["academic_year"] = acad_yr
    if academic_term and academic_term != "all":
        results_filters["academic_term"] = academic_term

    results = frappe.get_all(
        "Assessment Result",
        filters=results_filters,
        fields=["name", "course", "assessment_plan", "assessment_group", "total_score", "maximum_score", "grade", "comment", "academic_year"],
        order_by="course asc",
    )

    if not results and acad_yr:
        # Fallback: if no results in specified academic year, load student's latest results regardless of year
        fallback_filters = {"student": student, "docstatus": ("!=", 2)}
        results = frappe.get_all(
            "Assessment Result",
            filters=fallback_filters,
            fields=["name", "course", "assessment_plan", "assessment_group", "total_score", "maximum_score", "grade", "comment", "academic_year"],
            order_by="course asc",
        )
        if results and results[0].get("academic_year"):
            acad_yr = results[0]["academic_year"]

    course_records = []
    total_obtained = 0.0
    total_max = 0.0

    for r in results:
        max_score = flt(r.maximum_score)
        if max_score <= 0 and r.assessment_plan:
            max_score = flt(frappe.db.get_value("Assessment Plan", r.assessment_plan, "maximum_assessment_score")) or 100.0
        if max_score <= 0:
            max_score = 100.0

        score = flt(r.total_score)
        pct = round((score / max_score) * 100) if max_score > 0 else 0
        total_obtained += score
        total_max += max_score

        # Details breakdown
        details = frappe.get_all(
            "Assessment Result Detail",
            filters={"parent": r.name},
            fields=["assessment_criteria", "maximum_score", "score", "grade"],
            order_by="idx asc",
        )

        course_records.append({
            "name": r.name,
            "course": r.course,
            "total_score": score,
            "maximum_score": max_score,
            "percentage": pct,
            "grade": r.grade or "P",
            "comment": r.comment or "",
            "details": details,
        })

    overall_percentage = round((total_obtained / total_max) * 100, 1) if total_max > 0 else 0.0

    # Scale & Legend
    grading_scale = "ABC School Grading Scale"
    if course_records and course_records[0].get("course"):
        default_scale = frappe.db.get_value("Course", course_records[0]["course"], "default_grading_scale")
        if default_scale:
            grading_scale = default_scale

    scale_info = get_grading_scale_intervals(grading_scale=grading_scale)
    overall_grade = get_grade(grading_scale, overall_percentage) if total_max > 0 else "N/A"

    # School Info
    school_name = "ABC International School"
    try:
        edu_settings = frappe.get_single("Education Settings")
        school_name = getattr(edu_settings, "school_name", "ABC International School") or "ABC International School"
    except Exception:
        pass

    return {
        "student": {
            "name": student,
            "student_name": stu_doc.student_name,
            "student_email_id": stu_doc.student_email_id or "",
            "image": stu_doc.image or "",
            "roll_no": roll_no,
            "program": prog_name,
            "academic_year": acad_yr,
            "academic_term": academic_term or "Annual Assessment",
            "guardian_name": guardian_name,
            "guardian_phone": guardian_phone,
            "student_batch_name": enrollment.student_batch_name if enrollment else "",
        },
        "school": {
            "name": school_name,
            "affiliation": "Affiliation No. 2028-EDU-ABC",
            "academic_year": acad_yr,
        },
        "attendance": attendance,
        "results": course_records,
        "summary": {
            "total_obtained": total_obtained,
            "total_max": total_max,
            "percentage": overall_percentage,
            "grade": overall_grade,
            "result_status": "Promoted" if overall_percentage >= 40 else "Needs Improvement",
        },
        "grading_scale": scale_info,
    }


@frappe.whitelist(allow_guest=True)
def get_batch_report_cards_data(
    student_group: str,
    academic_year: str = None,
    academic_term: str = None,
    program: str = None,
):
    """Generates a batch of report cards for all students enrolled in a student group."""
    if not student_group:
        return []

    students = get_student_group_students(student_group)
    reports = []
    for s in students:
        rep = get_student_report_card_data(
            student=s.student,
            academic_year=academic_year,
            academic_term=academic_term,
            program=program,
            student_group=student_group,
        )
        if rep and rep.get("student"):
            reports.append(rep)
    return reports



