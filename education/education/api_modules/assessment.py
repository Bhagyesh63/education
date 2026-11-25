# Copyright (c) 2015, Frappe Technologies and contributors
# For license information, please see license.txt

import json
import math

import frappe
from frappe import _
from frappe.utils import cstr, flt, now, today
from education.education.api_modules.common import _resolve_portal_student
from education.education.api_modules.students import get_student_group_students
from education.education.api_modules.attendance import (
    STAFF_ROLES,
    assert_student_access,
    get_portal_student_ids,
    is_staff_user,
    require_login,
    require_staff,
    resolve_student_scope,
)


@frappe.whitelist()
def get_quiz_status(quiz_name: str, student: str = None):
    require_login()
    if not quiz_name or not frappe.db.exists("Quiz", quiz_name):
        return {}

    quiz_doc = frappe.get_doc("Quiz", quiz_name)
    user_roles = frappe.get_roles()
    is_staff = any(
        r in user_roles
        for r in [
            "Instructor",
            "Academics User",
            "Education Manager",
            "System Manager",
            "Administrator",
        ]
    )

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
        return {
            "is_teacher": is_staff,
            "student_id": None,
            "max_attempts": max_attempts,
            "attempts_used": 0,
            "attempts_remaining": max_attempts,
            "is_locked": False,
            "highest_score": 0,
            "passing_score": quiz_doc.passing_score or 70.0,
            "total_submissions": total_submissions if is_staff else None,
            "history": [],
        }

    assert_student_access(student_id)

    existing_activities = frappe.get_all(
        "Quiz Activity",
        filters={"quiz": quiz_name, "student": student_id},
        fields=["name", "score", "status", "activity_date", "creation"],
        order_by="creation asc",
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


def _quiz_review(quiz_doc, answers, reveal):
    """Per-question review of an attempt. The correct option and explanation are only
    included when `reveal` is true (staff preview, passed, or no attempts left)."""
    review = []
    for idx, q_row in enumerate(quiz_doc.question or []):
        selected = answers.get(str(idx)) or answers.get(idx) or ""
        correct_opts, explanation, is_correct = [], "", False
        if q_row.question_link and frappe.db.exists("Question", q_row.question_link):
            q_doc = frappe.get_doc("Question", q_row.question_link)
            for opt in q_doc.options or []:
                if opt.is_correct:
                    correct_opts.append(opt.option)
                    explanation = explanation or (getattr(opt, "explanation", "") or "")
                    if opt.option == selected:
                        is_correct = True
        row = {"index": idx, "selected": selected, "is_correct": is_correct}
        if reveal:
            row["correct_option"] = correct_opts[0] if correct_opts else None
            row["explanation"] = explanation
        review.append(row)
    return review


@frappe.whitelist(methods=["POST"])
def submit_quiz_assessment(
    quiz_name: str,
    answers: dict | str | None,
    course_name: str = None,
    student: str = None,
    time_taken: float = 0,
):
    if isinstance(answers, str):
        try:
            answers = json.loads(answers)
        except Exception:
            answers = {}
    elif not isinstance(answers, dict):
        answers = {}

    require_login()
    if not quiz_name or not frappe.db.exists("Quiz", quiz_name):
        frappe.throw(_("Invalid or missing Quiz."))

    quiz_doc = frappe.get_doc("Quiz", quiz_name)
    user_roles = frappe.get_roles()
    is_staff = any(
        r in user_roles
        for r in [
            "Instructor",
            "Academics User",
            "Education Manager",
            "System Manager",
            "Administrator",
        ]
    )

    if is_staff and not student:
        questions = quiz_doc.question or []
        correct_count = 0
        total_q = len(questions)
        for idx, q_row in enumerate(questions):
            selected = answers.get(str(idx)) or answers.get(idx)
            if q_row.question_link and frappe.db.exists(
                "Question", q_row.question_link
            ):
                q_doc = frappe.get_doc("Question", q_row.question_link)
                for opt in q_doc.options or []:
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
            "review": _quiz_review(quiz_doc, answers, reveal=True),
            "answers_revealed": True,
            "message": "Teacher Preview Assessment Complete (Not recorded in student database).",
        }

    student_id = student or _resolve_portal_student()
    if not student_id:
        frappe.throw(
            _("No student record is linked to your account."), frappe.PermissionError
        )
    if not is_staff and student_id != _resolve_portal_student():
        frappe.throw(
            _("Quizzes can only be submitted by the student themselves."),
            frappe.PermissionError,
        )

    existing_activities = frappe.get_all(
        "Quiz Activity",
        filters={"quiz": quiz_name, "student": student_id},
        fields=["name", "score", "status", "creation"],
    )
    max_attempts = int(quiz_doc.max_attempts or 2)
    attempts_used = len(existing_activities)

    if attempts_used >= max_attempts:
        frappe.throw(
            f"Maximum attempts ({max_attempts}) reached. You cannot retake this quiz."
        )

    questions = quiz_doc.question or []
    correct_count = 0
    total_q = len(questions)
    result_rows = []

    for idx, q_row in enumerate(questions):
        selected = answers.get(str(idx)) or answers.get(idx) or ""
        is_correct = False
        if q_row.question_link and frappe.db.exists("Question", q_row.question_link):
            q_doc = frappe.get_doc("Question", q_row.question_link)
            for opt in q_doc.options or []:
                if opt.option == selected and opt.is_correct:
                    is_correct = True
                    correct_count += 1
                    break
        result_rows.append(
            {
                "question": q_row.question_link or "",
                "selected_option": selected,
                "quiz_result": "Correct" if is_correct else "Wrong",
            }
        )

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
        "review": _quiz_review(quiz_doc, answers, reveal=passed or is_now_locked),
        "answers_revealed": bool(passed or is_now_locked),
        "message": f"Quiz submitted successfully! You scored {percent}%.",
    }


@frappe.whitelist()
def get_quiz_student_submissions(quiz_name: str, course_name: str = None):
    require_staff()
    if not quiz_name:
        return {"submissions": [], "stats": {}}

    filters = {"quiz": quiz_name}
    if course_name:
        filters["course"] = course_name

    activities = frappe.get_all(
        "Quiz Activity",
        filters=filters,
        fields=[
            "name",
            "student",
            "course",
            "quiz",
            "status",
            "score",
            "activity_date",
            "creation",
            "time_taken",
        ],
        order_by="creation asc",
    )

    student_attempts = {}
    enhanced = []

    for act in activities:
        stu_id = act.student
        student_attempts[stu_id] = student_attempts.get(stu_id, 0) + 1
        attempt_num = student_attempts[stu_id]

        student_name = frappe.db.get_value("Student", stu_id, "student_name") or stu_id
        student_email = frappe.db.get_value("Student", stu_id, "student_email_id") or ""
        enrollment = frappe.db.get_value(
            "Program Enrollment",
            {"student": stu_id, "docstatus": 1},
            ["program", "academic_year"],
            as_dict=True,
        )

        score_clean = str(act.score or "0").replace("%", "").strip()
        score_val = float(score_clean) if score_clean.replace(".", "").isdigit() else 0

        enhanced.append(
            {
                "name": act.name,
                "student": stu_id,
                "student_name": student_name,
                "student_email": student_email,
                "program": enrollment.program if enrollment else "",
                "score": f"{score_clean}%",
                "score_num": score_val,
                "status": act.status or ("Pass" if score_val >= 70 else "Fail"),
                "attempt_number": attempt_num,
                "activity_date": str(act.activity_date or act.creation),
                "time_taken": act.time_taken,
            }
        )

    total_attempts = len(enhanced)
    unique_students = len(student_attempts)
    passed_count = sum(1 for s in enhanced if s["status"] == "Pass")
    pass_rate = (
        round((passed_count / total_attempts) * 100) if total_attempts > 0 else 0
    )
    avg_score = (
        round(sum(s["score_num"] for s in enhanced) / total_attempts)
        if total_attempts > 0
        else 0
    )

    enhanced.sort(key=lambda x: x["activity_date"], reverse=True)

    return {
        "submissions": enhanced,
        "stats": {
            "total_attempts": total_attempts,
            "unique_students": unique_students,
            "pass_rate": pass_rate,
            "avg_score": avg_score,
        },
    }


@frappe.whitelist()
def get_assessment_criteria(course: str):
    require_login()
    return frappe.get_all(
        "Course Assessment Criteria",
        fields=["assessment_criteria", "weightage"],
        filters={"parent": course},
        order_by="idx",
    )


@frappe.whitelist()
def get_assessment_students(assessment_plan: str, student_group: str):
    require_staff()
    student_list = get_student_group_students(student_group)
    roll_numbers = dict(
        frappe.get_all(
            "Student Group Student",
            filters={"parent": student_group},
            fields=["student", "group_roll_number"],
            as_list=True,
        )
    )
    for i, student in enumerate(student_list):
        student["group_roll_number"] = roll_numbers.get(student.student)
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
    require_staff()
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


@frappe.whitelist()
def get_grading_scale_intervals(
    grading_scale: str = None,
    assessment_plan: str = None,
    assessment_result: str = None,
    course: str = None,
    program: str = None,
):
    require_login()
    scale_name = _resolve_grading_scale(
        grading_scale=grading_scale,
        assessment_plan=assessment_plan,
        assessment_result=assessment_result,
        course=course,
        program=program,
    )
    if not scale_name:
        return {"grading_scale": None, "intervals": [], "pass_percentage": None}

    intervals = _scale_intervals(scale_name)
    return {
        "grading_scale": scale_name,
        "intervals": intervals,
        "pass_percentage": _passing_threshold(intervals),
    }


@frappe.whitelist()
def get_grade(grading_scale: str, percentage: float):
    require_login()
    return _grade_for(
        percentage,
        _scale_intervals(_resolve_grading_scale(grading_scale=grading_scale)),
    )


@frappe.whitelist(methods=["POST"])
def mark_assessment_result(assessment_plan: str, scores: str):
    require_staff(_("Only instructors and academic staff can record marks."))
    student_score = json.loads(scores) if isinstance(scores, str) else scores
    if not isinstance(student_score, dict) or not student_score.get("student"):
        frappe.throw(_("Student is required."))
    submitted = student_score.get("assessment_details") or {}
    plan_criteria = {
        d.assessment_criteria: flt(d.maximum_score)
        for d in get_assessment_details(assessment_plan)
    }
    if not plan_criteria:
        frappe.throw(
            _("Assessment Plan {0} has no assessment criteria.").format(assessment_plan)
        )
    unknown = [c for c in submitted if c not in plan_criteria]
    if unknown:
        frappe.throw(
            _("{0} is not a criterion of this Assessment Plan.").format(
                ", ".join(unknown)
            )
        )
    assessment_details = []
    for criteria, max_score in plan_criteria.items():
        raw = submitted.get(criteria)
        try:
            score = float(raw)
        except (TypeError, ValueError):
            score = None
        if cstr(raw).strip() == "" or score is None or not math.isfinite(score):
            frappe.throw(_("Enter a numeric score for {0}.").format(criteria))
        if score < 0:
            frappe.throw(_("Score for {0} cannot be negative.").format(criteria))
        if score > max_score:
            frappe.throw(
                _("Score for {0} cannot be greater than the maximum score {1}.").format(
                    criteria, max_score
                )
            )
        assessment_details.append({"assessment_criteria": criteria, "score": score})
    assessment_result = get_assessment_result_doc(
        student_score["student"], assessment_plan
    )
    if assessment_result is None:
        existing = get_result(student_score["student"], assessment_plan)
        return {
            "name": existing.name if existing else None,
            "student": student_score["student"],
            "total_score": existing.total_score if existing else None,
            "grade": existing.grade if existing else None,
            "details": {},
            "already_submitted": True,
        }
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


@frappe.whitelist(methods=["POST"])
def submit_assessment_results(assessment_plan: str, student_group: str):
    require_staff(_("Only instructors and academic staff can publish results."))
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


@frappe.whitelist()
def get_student_assessment_results(
    student: str | None = None, program: str | None = None, course: str | None = None
):
    scope = resolve_student_scope(student)
    if scope is not None and not scope:
        return []

    filters = {"docstatus": 1}
    if scope is not None:
        filters["student"] = ["in", scope]
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
        limit_page_length=1000,
    )
    if not results:
        return results

    details = frappe.get_all(
        "Assessment Result Detail",
        fields=["parent", "assessment_criteria", "maximum_score", "score", "grade"],
        filters={
            "parent": ["in", [r.name for r in results]],
            "parenttype": "Assessment Result",
        },
        order_by="idx",
    )
    details_map = {}
    for d in details:
        details_map.setdefault(d.pop("parent"), []).append(d)

    plan_names = list({r.assessment_plan for r in results if r.assessment_plan})
    plan_map = {}
    if plan_names:
        plan_map = {
            p.name: p
            for p in frappe.get_all(
                "Assessment Plan",
                filters={"name": ["in", plan_names]},
                fields=["name", "assessment_name", "schedule_date"],
            )
        }

    for r in results:
        r["details"] = details_map.get(r.name, [])
        max_score = flt(r.maximum_score)
        r["percentage"] = (
            round(flt(r.total_score) / max_score * 100, 1) if max_score > 0 else None
        )
        plan = plan_map.get(r.assessment_plan)
        r["assessment_name"] = plan.assessment_name if plan else None
        r["schedule_date"] = plan.schedule_date if plan else None
    return results


@frappe.whitelist()
def get_assessment_plans(
    student_group: str = None, course: str = None, program: str = None
):
    require_staff()
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
            "academic_year",
            "academic_term",
            "docstatus",
        ],
        filters=filters,
        order_by="schedule_date desc, creation desc",
        limit_page_length=500,
    )
    for p in plans:
        p["criteria"] = frappe.get_all(
            "Assessment Plan Criteria",
            fields=["assessment_criteria", "maximum_score"],
            filters={"parent": p.name, "parenttype": "Assessment Plan"},
            order_by="idx",
        )
        p["results_count"] = frappe.db.count(
            "Assessment Result", {"assessment_plan": p.name, "docstatus": 1}
        )
    return plans


@frappe.whitelist()
def get_assessment_setup_metadata():
    """Programs, student groups, courses, grading scales, assessment groups,
    criteria, academic years and terms for assessment / report setup screens."""
    require_login()
    group_filters = {}
    allowed = get_portal_student_ids()
    if allowed is not None:
        member_groups = (
            frappe.get_all(
                "Student Group Student",
                filters={"student": ["in", allowed]},
                pluck="parent",
            )
            if allowed
            else []
        )
        group_filters["name"] = ["in", list(set(member_groups)) or [""]]

    programs = frappe.get_all(
        "Program", fields=["name", "program_name"], order_by="name asc"
    )
    student_groups = frappe.get_all(
        "Student Group",
        filters=group_filters,
        fields=[
            "name",
            "student_group_name",
            "program",
            "academic_year",
            "academic_term",
            "group_based_on",
        ],
        order_by="name asc",
        limit_page_length=500,
    )
    courses = frappe.get_all(
        "Course",
        fields=["name", "course_name", "default_grading_scale"],
        order_by="name asc",
        limit_page_length=500,
    )
    assessment_groups = frappe.get_all(
        "Assessment Group",
        fields=["name", "assessment_group_name", "is_group"],
        filters={"is_group": 0},
        order_by="name asc",
    )
    grading_scales = frappe.get_all(
        "Grading Scale", filters={"docstatus": 1}, fields=["name"], order_by="name asc"
    ) or frappe.get_all("Grading Scale", fields=["name"], order_by="name asc")
    criteria = frappe.get_all(
        "Assessment Criteria",
        fields=["name", "assessment_criteria"],
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

    return {
        "programs": programs,
        "student_groups": student_groups,
        "courses": courses,
        "assessment_groups": assessment_groups,
        "grading_scales": grading_scales,
        "criteria": criteria,
        "academic_years": academic_years,
        "academic_terms": academic_terms,
        "current_academic_year": frappe.db.get_single_value(
            "Education Settings", "current_academic_year"
        ),
        "current_academic_term": frappe.db.get_single_value(
            "Education Settings", "current_academic_term"
        ),
    }


@frappe.whitelist(methods=["POST"])
def create_assessment_plan(
    student_group: str,
    course: str,
    assessment_group: str = None,
    grading_scale: str = None,
    assessment_name: str = None,
    schedule_date: str = None,
    criteria: str | list = None,
    program: str = None,
    from_time: str = None,
    to_time: str = None,
    examiner: str = None,
):
    require_staff(_("Only instructors and academic staff can create assessment plans."))

    if not student_group or not frappe.db.exists("Student Group", student_group):
        frappe.throw(_("Please select a valid Student Group."))
    if not course or not frappe.db.exists("Course", course):
        frappe.throw(_("Please select a valid Course."))

    group = frappe.db.get_value(
        "Student Group",
        student_group,
        ["program", "academic_year", "academic_term"],
        as_dict=True,
    )
    program = program or group.program
    academic_year = group.academic_year or frappe.db.get_single_value(
        "Education Settings", "current_academic_year"
    )

    grading_scale = _resolve_grading_scale(
        grading_scale=grading_scale, course=course, program=program
    )
    if not grading_scale:
        frappe.throw(
            _("No Grading Scale is configured. Please create a Grading Scale first.")
        )

    if not assessment_group:
        leaf_groups = frappe.get_all(
            "Assessment Group",
            filters={"is_group": 0},
            pluck="name",
            order_by="creation asc",
            limit=1,
        )
        if not leaf_groups:
            frappe.throw(
                _("No Assessment Group is configured. Please create one first.")
            )
        assessment_group = leaf_groups[0]

    parsed_criteria = (
        json.loads(criteria)
        if isinstance(criteria, str) and criteria
        else (criteria or [])
    )
    if not parsed_criteria:
        frappe.throw(_("Please select at least one Assessment Criteria."))

    doc = frappe.new_doc("Assessment Plan")
    doc.student_group = student_group
    doc.course = course
    doc.assessment_group = assessment_group
    doc.grading_scale = grading_scale
    doc.assessment_name = assessment_name or f"{course} - {student_group}"
    doc.program = program
    doc.academic_year = academic_year
    doc.academic_term = group.academic_term
    doc.schedule_date = schedule_date or today()
    doc.from_time = from_time or "09:00:00"
    doc.to_time = to_time or "10:00:00"
    if examiner:
        doc.examiner = examiner

    total_max_score = 0.0
    for c in parsed_criteria:
        crit_name = c.get("assessment_criteria") or c.get("name")
        if not crit_name or not frappe.db.exists("Assessment Criteria", crit_name):
            frappe.throw(
                _("Assessment Criteria {0} does not exist.").format(crit_name or "")
            )
        score = flt(c.get("maximum_score")) or 100.0
        total_max_score += score
        doc.append(
            "assessment_criteria",
            {"assessment_criteria": crit_name, "maximum_score": score},
        )

    doc.maximum_assessment_score = total_max_score
    doc.insert(ignore_permissions=True)
    doc.submit()
    return doc.as_dict()


@frappe.whitelist()
def get_student_report_card_data(
    student: str,
    academic_year: str = None,
    academic_term: str = None,
    program: str = None,
    student_group: str = None,
):
    """Complete report card data: student details, attendance, published results,
    overall grade from the real Grading Scale, and school header info."""
    if not student:
        return {}
    assert_student_access(student)
    if academic_term in ("all", "", None):
        academic_term = None

    stu_doc = frappe.get_doc("Student", student)
    enrollment_filters = {"student": student, "docstatus": 1}
    if program:
        enrollment_filters["program"] = program
    if academic_year:
        enrollment_filters["academic_year"] = academic_year
    enrollment = frappe.db.get_value(
        "Program Enrollment",
        enrollment_filters,
        ["name", "program", "academic_year", "student_batch_name", "student_category"],
        as_dict=True,
        order_by="creation desc",
    ) or frappe.db.get_value(
        "Program Enrollment",
        {"student": student, "docstatus": 1},
        ["name", "program", "academic_year", "student_batch_name", "student_category"],
        as_dict=True,
        order_by="creation desc",
    )

    prog_name = program or (enrollment.program if enrollment else "")
    explicit_year = bool(academic_year)
    acad_yr = (
        academic_year
        or (enrollment.academic_year if enrollment else "")
        or (
            frappe.db.get_single_value("Education Settings", "current_academic_year")
            or ""
        )
    )

    # Student group & roll number
    if not student_group:
        sg_filters = {"student": student, "active": 1}
        member_of = frappe.get_all(
            "Student Group Student", filters=sg_filters, pluck="parent"
        )
        if member_of:
            # Prefer the class/section (batch-based) group over course or activity groups
            candidates = frappe.get_all(
                "Student Group",
                filters={
                    "name": ["in", member_of],
                    **({"program": prog_name} if prog_name else {}),
                },
                fields=["name", "group_based_on"],
                order_by="name asc",
            )
            candidates.sort(key=lambda g: g.group_based_on != "Batch")
            candidates = [g.name for g in candidates]
            student_group = candidates[0] if candidates else member_of[0]
    roll_no = ""
    if student_group:
        roll_no = (
            frappe.db.get_value(
                "Student Group Student",
                {"parent": student_group, "student": student},
                "group_roll_number",
            )
            or ""
        )

    class_teacher = ""
    if student_group:
        instructors = frappe.get_all(
            "Student Group Instructor",
            filters={"parent": student_group, "parenttype": "Student Group"},
            fields=["instructor_name", "instructor"],
            order_by="idx asc",
            limit=1,
        )
        if instructors:
            class_teacher = instructors[0].instructor_name or instructors[0].instructor

    # Guardian details
    guardian_name = ""
    guardian_phone = ""
    guardians = frappe.get_all(
        "Student Guardian",
        filters={"parent": student, "parenttype": "Student"},
        fields=["guardian", "guardian_name"],
        order_by="idx asc",
        limit=1,
    )
    if guardians:
        g_doc = frappe.db.get_value(
            "Guardian",
            guardians[0].guardian,
            ["guardian_name", "mobile_number"],
            as_dict=True,
        )
        if g_doc:
            guardian_name = g_doc.guardian_name or guardians[0].guardian_name or ""
            guardian_phone = g_doc.mobile_number or ""

    # Published assessment results only
    results_filters = {"student": student, "docstatus": 1}
    if acad_yr:
        results_filters["academic_year"] = acad_yr
    if academic_term:
        results_filters["academic_term"] = academic_term
    if program:
        results_filters["program"] = program

    result_fields = [
        "name",
        "course",
        "assessment_plan",
        "assessment_group",
        "total_score",
        "maximum_score",
        "grade",
        "grading_scale",
        "comment",
        "academic_year",
    ]
    results = frappe.get_all(
        "Assessment Result",
        filters=results_filters,
        fields=result_fields,
        order_by="course asc",
    )

    if not results and acad_yr and not explicit_year:
        # The student's latest results may belong to a different year than the
        # enrollment default; report the year the results actually belong to.
        fallback = {k: v for k, v in results_filters.items() if k != "academic_year"}
        results = frappe.get_all(
            "Assessment Result",
            filters=fallback,
            fields=result_fields,
            order_by="academic_year desc, course asc",
        )
        if results and results[0].get("academic_year"):
            acad_yr = results[0]["academic_year"]
            results = [r for r in results if r.academic_year == acad_yr]

    attendance = _attendance_summary(student, acad_yr, academic_term)

    scale_name = _resolve_grading_scale(
        grading_scale=next((r.grading_scale for r in results if r.grading_scale), None),
        assessment_plan=next(
            (r.assessment_plan for r in results if r.assessment_plan), None
        ),
        program=prog_name,
    )
    intervals = _scale_intervals(scale_name)
    description_map = {i["grade"]: i["description"] for i in intervals}

    course_records = []
    total_obtained = 0.0
    total_max = 0.0
    for r in results:
        max_score = flt(r.maximum_score)
        if max_score <= 0 and r.assessment_plan:
            max_score = flt(
                frappe.db.get_value(
                    "Assessment Plan", r.assessment_plan, "maximum_assessment_score"
                )
            )
        score = flt(r.total_score)
        pct = round((score / max_score) * 100) if max_score > 0 else 0
        total_obtained += score
        total_max += max_score
        grade = r.grade or (_grade_for(pct, intervals) if max_score > 0 else "")

        details = frappe.get_all(
            "Assessment Result Detail",
            filters={"parent": r.name, "parenttype": "Assessment Result"},
            fields=["assessment_criteria", "maximum_score", "score", "grade"],
            order_by="idx asc",
        )
        course_records.append(
            {
                "name": r.name,
                "course": r.course,
                "assessment_group": r.assessment_group,
                "total_score": score,
                "maximum_score": max_score,
                "percentage": pct,
                "grade": grade,
                "grade_description": description_map.get(grade, ""),
                "comment": r.comment or "",
                "details": details,
            }
        )

    overall_percentage = (
        round((total_obtained / total_max) * 100, 1) if total_max > 0 else None
    )
    overall_grade = (
        _grade_for(overall_percentage, intervals)
        if overall_percentage is not None
        else ""
    )
    pass_pct = _passing_threshold(intervals)
    if overall_percentage is None:
        result_status = ""
    elif pass_pct is None:
        result_status = ""
    else:
        result_status = (
            _("Pass") if overall_percentage >= pass_pct else _("Needs Improvement")
        )

    school = _school_info()
    school["academic_year"] = acad_yr

    return {
        "student": {
            "name": student,
            "student_name": stu_doc.student_name,
            "student_email_id": stu_doc.student_email_id or "",
            "image": stu_doc.image or "",
            "roll_no": roll_no,
            "program": prog_name,
            "student_group": student_group or "",
            "class_teacher": class_teacher,
            "academic_year": acad_yr,
            "academic_term": academic_term or "",
            "guardian_name": guardian_name,
            "guardian_phone": guardian_phone,
            "student_batch_name": enrollment.student_batch_name if enrollment else "",
        },
        "school": school,
        "attendance": attendance,
        "results": course_records,
        "summary": {
            "total_obtained": total_obtained,
            "total_max": total_max,
            "percentage": overall_percentage,
            "grade": overall_grade,
            "grade_description": description_map.get(overall_grade, ""),
            "pass_percentage": pass_pct,
            "result_status": result_status,
        },
        "grading_scale": {
            "grading_scale": scale_name,
            "intervals": intervals,
            "pass_percentage": pass_pct,
        },
    }


@frappe.whitelist()
def get_batch_report_cards_data(
    student_group: str,
    academic_year: str = None,
    academic_term: str = None,
    program: str = None,
):
    """Report cards for every active student of a student group (staff only)."""
    require_staff()
    if not student_group:
        return []

    reports = []
    for s in get_student_group_students(student_group):
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


def _most_used_grading_scale(filters):
    scales = frappe.get_all(
        "Assessment Plan",
        filters={**filters, "docstatus": 1, "grading_scale": ["is", "set"]},
        pluck="grading_scale",
    )
    if not scales:
        return None
    counts = {}
    for s in scales:
        counts[s] = counts.get(s, 0) + 1
    return max(counts.items(), key=lambda kv: kv[1])[0]


def _resolve_grading_scale(
    grading_scale=None,
    assessment_plan=None,
    assessment_result=None,
    course=None,
    program=None,
):
    """Resolve the real Grading Scale that applies to the given context."""
    if grading_scale and frappe.db.exists("Grading Scale", grading_scale):
        return grading_scale

    scale_name = None
    if assessment_plan:
        plan = frappe.db.get_value(
            "Assessment Plan",
            assessment_plan,
            ["grading_scale", "course"],
            as_dict=True,
        )
        if plan:
            scale_name = plan.grading_scale or (
                plan.course
                and frappe.db.get_value("Course", plan.course, "default_grading_scale")
            )
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
                scale_name = frappe.db.get_value(
                    "Assessment Plan", res.assessment_plan, "grading_scale"
                )
            if not scale_name and res.course:
                scale_name = frappe.db.get_value(
                    "Course", res.course, "default_grading_scale"
                )

    if not scale_name and course:
        scale_name = frappe.db.get_value(
            "Course", course, "default_grading_scale"
        ) or _most_used_grading_scale({"course": course})

    if not scale_name and program:
        scale_name = _most_used_grading_scale({"program": program})
        if not scale_name:
            program_courses = frappe.get_all(
                "Program Course",
                filters={"parent": program, "parenttype": "Program"},
                pluck="course",
            )
            if program_courses:
                defaults = frappe.get_all(
                    "Course",
                    filters={
                        "name": ["in", program_courses],
                        "default_grading_scale": ["is", "set"],
                    },
                    pluck="default_grading_scale",
                    limit=1,
                )
                scale_name = defaults[0] if defaults else None

    if not scale_name:
        scale_name = _most_used_grading_scale({})

    if not scale_name:
        submitted = frappe.get_all(
            "Grading Scale",
            filters={"docstatus": 1},
            pluck="name",
            order_by="creation asc",
            limit=1,
        )
        scale_name = submitted[0] if submitted else None

    if scale_name and frappe.db.exists("Grading Scale", scale_name):
        return scale_name
    return None


def _scale_intervals(scale_name):
    if not scale_name:
        return []
    raw_intervals = frappe.get_all(
        "Grading Scale Interval",
        filters={"parent": scale_name, "parenttype": "Grading Scale"},
        fields=["grade_code", "threshold", "grade_description"],
        order_by="threshold desc",
    )
    return [
        {
            "grade": item.grade_code,
            "min_percentage": flt(item.threshold),
            "description": item.grade_description or "",
        }
        for item in raw_intervals
    ]


def _grade_for(percentage, intervals):
    for interval in intervals:
        if flt(percentage) >= flt(interval.get("min_percentage", 0)):
            return interval.get("grade")
    return intervals[-1].get("grade") if intervals else ""


def _passing_threshold(intervals):
    """Minimum percentage needed to pass under a grading scale.

    The lowest interval of a scale with a 0% threshold is treated as the failing
    band; otherwise anything below the lowest threshold fails."""
    if not intervals:
        return None
    lowest = intervals[-1]
    if flt(lowest.get("min_percentage")) <= 0 and len(intervals) > 1:
        return flt(intervals[-2].get("min_percentage"))
    return flt(lowest.get("min_percentage"))


def _attendance_summary(student, academic_year=None, academic_term=None):
    from_date = to_date = None
    if academic_term and frappe.db.exists("Academic Term", academic_term):
        from_date, to_date = frappe.db.get_value(
            "Academic Term", academic_term, ["term_start_date", "term_end_date"]
        )
    elif academic_year and frappe.db.exists("Academic Year", academic_year):
        from_date, to_date = frappe.db.get_value(
            "Academic Year", academic_year, ["year_start_date", "year_end_date"]
        )

    filters = {"student": student, "docstatus": 1}
    if from_date and to_date:
        filters["date"] = ["between", [from_date, to_date]]

    rows = frappe.get_all(
        "Student Attendance",
        filters=filters,
        fields=["status", {"COUNT": "name", "as": "count"}],
        group_by="status",
    )
    counts = {r.status: r.count for r in rows}
    total = sum(counts.values())
    present = counts.get("Present", 0)
    return {
        "present": present,
        "absent": counts.get("Absent", 0),
        "leave": counts.get("Leave", 0),
        "total": total,
        "percentage": round(present / total * 100, 1) if total else None,
    }


def _school_info():
    name = frappe.db.get_single_value(
        "Education Settings", "school_college_name_abbreviation"
    )
    company = frappe.defaults.get_global_default("company")
    if not name:
        name = company
    logo = frappe.db.get_single_value("Education Settings", "school_college_logo")
    address = ""
    if company:
        address_name = frappe.db.get_value(
            "Dynamic Link",
            {"link_doctype": "Company", "link_name": company, "parenttype": "Address"},
            "parent",
        )
        if address_name:
            addr = frappe.db.get_value(
                "Address",
                address_name,
                ["address_line1", "city", "state"],
                as_dict=True,
            )
            if addr:
                address = ", ".join(
                    [p for p in (addr.address_line1, addr.city, addr.state) if p]
                )
    return {
        "name": name or "",
        "logo": logo or "",
        "company": company or "",
        "address": address,
    }


@frappe.whitelist()
def get_reports_tools_summary():
    """Live counters for the Reports & Tools hub (staff only)."""
    require_staff()
    current = today()
    return {
        "assessment_plans": frappe.db.count("Assessment Plan", {"docstatus": 1}),
        "assessment_results_submitted": frappe.db.count(
            "Assessment Result", {"docstatus": 1}
        ),
        "assessment_results_draft": frappe.db.count(
            "Assessment Result", {"docstatus": 0}
        ),
        "student_groups": frappe.db.count("Student Group", {"disabled": 0}),
        "students_with_results": len(
            frappe.get_all(
                "Assessment Result",
                filters={"docstatus": 1},
                pluck="student",
                distinct=True,
            )
        ),
        "attendance_marked_today": frappe.db.count(
            "Student Attendance", {"date": current, "docstatus": 1}
        ),
        "attendance_groups_today": len(
            frappe.get_all(
                "Student Attendance",
                filters={
                    "date": current,
                    "docstatus": 1,
                    "student_group": ["is", "set"],
                },
                pluck="student_group",
                distinct=True,
            )
        ),
        "pending_leave_applications": frappe.db.count(
            "Student Leave Application", {"docstatus": 0}
        ),
        "program_enrollments": frappe.db.count("Program Enrollment", {"docstatus": 1}),
        "approved_applicants": frappe.db.count(
            "Student Applicant", {"application_status": "Approved"}
        ),
        "upcoming_course_schedules": frappe.db.count(
            "Course Schedule", {"schedule_date": [">=", current]}
        ),
    }
