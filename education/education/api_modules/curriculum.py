# Copyright (c) 2015, Frappe Technologies and contributors
# For license information, please see license.txt

import json
import frappe
from frappe import _
from frappe.utils import today
from education.education.api_modules.common import (
    _resolve_portal_student,
    get_guardians_for_user,
    is_guardian_of,
)

# ==============================================================================
# Access helpers (shared with api_modules.schedule)
# ==============================================================================

MANAGER_ROLES = {"System Manager", "Education Manager", "Administrator"}
STAFF_ROLES = MANAGER_ROLES | {"Academics User", "Instructor"}


def _require_login():
    if frappe.session.user == "Guest":
        raise frappe.PermissionError(_("Please log in to continue."))


def _has_any_role(roles):
    if frappe.session.user == "Administrator":
        return True
    return bool(set(frappe.get_roles()) & set(roles))


def _is_manager():
    """Education managers / system managers: unrestricted read access."""
    return _has_any_role(MANAGER_ROLES)


def _is_staff():
    """Any teaching or academic staff (instructors included)."""
    return _has_any_role(STAFF_ROLES)


def _require_staff(action=None):
    _require_login()
    if not _is_staff():
        raise frappe.PermissionError(
            _("You are not permitted to {0}.").format(
                action or _("perform this action")
            )
        )


def _get_user_instructors(user=None):
    """Instructor records linked to the given user (via Employee.user_id, else by full name)."""
    user = user or frappe.session.user
    if not user or user in ("Guest", "Administrator"):
        return []
    employees = (
        frappe.get_all("Employee", filters={"user_id": user}, pluck="name")
        if frappe.db.exists("DocType", "Employee")
        else []
    )
    instructors = []
    if employees:
        instructors = frappe.get_all(
            "Instructor", filters={"employee": ["in", employees]}, pluck="name"
        )
    if not instructors and {"Instructor", "Academics User"} & set(
        frappe.get_roles(user)
    ):
        full_name = frappe.db.get_value("User", user, "full_name")
        if full_name:
            instructors = frappe.get_all(
                "Instructor", filters={"instructor_name": full_name}, pluck="name"
            )
    return instructors


def _get_guardian_ward_ids(user=None):
    guardians = get_guardians_for_user(user)
    if not guardians:
        return []
    return list(
        set(
            frappe.get_all(
                "Student Guardian",
                filters={"parenttype": "Student", "guardian": ["in", guardians]},
                pluck="parent",
            )
        )
    )


def _get_viewable_students(student=None):
    """Students (not staff) the current user may view: self and/or guardian wards.

    If ``student`` is given it is validated and returned alone; raises PermissionError
    if the current user may not see that student.
    """
    _require_login()
    own = _resolve_portal_student()
    if student:
        if student == own or is_guardian_of(student):
            return [student]
        raise frappe.PermissionError(
            _("You are not authorized to access this student's records.")
        )
    students = [own] if own else []
    for ward in _get_guardian_ward_ids():
        if ward not in students:
            students.append(ward)
    return students


def _get_student_programs(students):
    if not students:
        return []
    return list(
        set(
            frappe.get_all(
                "Program Enrollment",
                filters={"student": ["in", students], "docstatus": ["<", 2]},
                pluck="program",
            )
        )
    )


def _check_program_access(program):
    """Staff may read any program; students/guardians only programs they (or wards) are enrolled in."""
    _require_login()
    if _is_staff():
        return
    if program not in _get_student_programs(_get_viewable_students()):
        raise frappe.PermissionError(
            _("You are not enrolled in program {0}.").format(program)
        )


def get_course(program):
    return frappe.db.sql(
        """select course, course_name from `tabProgram Course` where parent=%s""",
        (program),
        as_dict=1,
    )


# nosemgrep: guest-whitelisted-method -- public program catalogue for the admission form
@frappe.whitelist(allow_guest=True)
def get_all_programs():
    return frappe.get_all(
        "Program",
        fields=["name", "program_name", "department"],
        order_by="name asc",
        limit_page_length=50,
    )


@frappe.whitelist()
def get_course_details(course: str):
    _require_login()
    if not course or not frappe.db.exists("Course", course):
        return {}
    return frappe.get_doc("Course", course).as_dict()


@frappe.whitelist()
def get_topic_details(topic: str):
    _require_login()
    if not topic or not frappe.db.exists("Topic", topic):
        return {}
    return frappe.get_doc("Topic", topic).as_dict()


@frappe.whitelist()
def get_course_list_based_on_program(program_name: str):
    if not program_name or not frappe.db.exists("Program", program_name):
        return []
    _check_program_access(program_name)
    program = frappe.get_doc("Program", program_name)
    return [course.course for course in program.courses]


@frappe.whitelist()
def get_program_curriculum_details(program_name: str = None, program: str = None):
    """Courses -> topics -> learning contents of a program, straight from the database."""
    prog = program_name or program
    if not prog or not frappe.db.exists("Program", prog):
        return []
    _check_program_access(prog)

    program_doc = frappe.get_doc("Program", prog)
    courses_data = []

    for prog_course in program_doc.courses or []:
        course_name = prog_course.course
        if not course_name or not frappe.db.exists("Course", course_name):
            continue
        course_doc = frappe.get_doc("Course", course_name)
        topics_data = []
        for course_topic in course_doc.topics or []:
            topic_name = course_topic.topic or course_topic.topic_name
            if not topic_name or not frappe.db.exists("Topic", topic_name):
                continue
            topic_doc = frappe.get_doc("Topic", topic_name)
            contents = []
            for tc in topic_doc.topic_content or []:
                if not tc.content:
                    continue
                content_type = tc.content_type or "Article"
                label = (
                    frappe.db.get_value(content_type, tc.content, "title")
                    if frappe.db.exists(content_type, tc.content)
                    else None
                )
                contents.append(
                    {
                        "title": tc.content,
                        "label": label or tc.content,
                        "type": content_type.lower(),
                        "status": "Available",
                    }
                )
            topics_data.append(
                {
                    "name": topic_name,
                    "title": topic_doc.topic_name or topic_name,
                    "description": topic_doc.description or "",
                    "contents": contents,
                }
            )

        courses_data.append(
            {
                "name": course_name,
                "courseName": course_doc.course_name or course_name,
                "department": course_doc.department or "",
                "description": course_doc.description or "",
                "required": prog_course.required,
                "topicsCount": len(topics_data),
                "topics": topics_data,
            }
        )

    return courses_data


@frappe.whitelist()
def get_learning_content_details(content_type: str, content_name: str):
    from education.education.api_modules.assessment import get_quiz_status

    _require_login()
    if not content_type or not content_name:
        return {}

    content_type_cap = content_type.capitalize()
    if content_type.lower() == "article":
        content_type_cap = "Article"
    elif content_type.lower() == "video":
        content_type_cap = "Video"
    elif content_type.lower() == "quiz":
        content_type_cap = "Quiz"
    else:
        # only learning content may be read through this endpoint
        return {}

    if not frappe.db.exists(content_type_cap, content_name):
        return {}

    try:
        doc = frappe.get_doc(content_type_cap, content_name)
    except Exception as e:
        frappe.log_error(f"Error fetching {content_type_cap} {content_name}: {str(e)}")
        return {}

    data = {
        "name": doc.name,
        "title": getattr(doc, "title", doc.name),
        "doctype": doc.doctype,
    }

    if content_type_cap == "Article":
        data.update(
            {
                "author": getattr(doc, "author", "") or "",
                "content": getattr(doc, "content", "") or "",
                "publish_date": (
                    str(getattr(doc, "publish_date", ""))
                    if getattr(doc, "publish_date", None)
                    else ""
                ),
            }
        )
    elif content_type_cap == "Video":
        data.update(
            {
                "provider": getattr(doc, "provider", "YouTube"),
                "url": getattr(doc, "url", ""),
                "duration": getattr(doc, "duration", 0),
                "description": getattr(doc, "description", "") or "",
                "publish_date": (
                    str(getattr(doc, "publish_date", ""))
                    if getattr(doc, "publish_date", None)
                    else ""
                ),
            }
        )
    elif content_type_cap == "Quiz":
        questions = []
        for q_row in doc.question or []:
            q_text = q_row.question or ""
            q_options = []
            q_type = "Single Correct Answer"
            if q_row.question_link and frappe.db.exists(
                "Question", q_row.question_link
            ):
                q_doc = frappe.get_doc("Question", q_row.question_link)
                q_text = q_doc.question or q_text
                q_type = q_doc.question_type or "Single Correct Answer"
                for opt in q_doc.options or []:
                    q_options.append(
                        {
                            "option": opt.option,
                            "is_correct": bool(opt.is_correct),
                            "explanation": getattr(opt, "explanation", "") or "",
                        }
                    )
            questions.append(
                {
                    "question": q_text,
                    "question_link": q_row.question_link,
                    "question_type": q_type,
                    "options": q_options,
                }
            )
        # Students / guardians must not receive the answer key with the questions; the
        # per-question review comes back from submit_quiz_assessment after an attempt.
        if not _is_quiz_staff():
            for q in questions:
                for opt in q["options"]:
                    opt.pop("is_correct", None)
                    opt.pop("explanation", None)
        data.update(
            {
                "passing_score": getattr(doc, "passing_score", 60),
                "max_attempts": getattr(doc, "max_attempts", 3),
                "duration": getattr(doc, "duration", None),
                "is_time_bound": bool(getattr(doc, "is_time_bound", 0)),
                "questions": questions,
            }
        )
        try:
            data["quiz_status"] = get_quiz_status(content_name)
        except Exception:
            data["quiz_status"] = {}

    return data


@frappe.whitelist(methods=["POST"])
def create_topic_learning_material(
    topic_name: str,
    content_type: str,
    title: str,
    details: dict | str | None = None,
    course_name: str = None,
):
    _require_staff(_("add learning material"))
    if isinstance(details, str):
        try:
            details = json.loads(details)
        except Exception:
            details = {}
    elif not isinstance(details, dict):
        details = {}

    content_type_cap = content_type.capitalize()
    if content_type.lower() == "article":
        content_type_cap = "Article"
    elif content_type.lower() == "video":
        content_type_cap = "Video"
    elif content_type.lower() == "quiz":
        content_type_cap = "Quiz"

    if not frappe.db.exists("Topic", topic_name):
        topic_doc = frappe.new_doc("Topic")
        topic_doc.topic_name = topic_name
        topic_doc.description = (
            f"Topic curriculum module for {course_name or 'the course'}"
        )
        topic_doc.insert(ignore_permissions=True)
        if course_name and frappe.db.exists("Course", course_name):
            course_doc = frappe.get_doc("Course", course_name)
            course_doc.append("topics", {"topic": topic_doc.name})
            course_doc.save(ignore_permissions=True)
    else:
        topic_doc = frappe.get_doc("Topic", topic_name)

    created_content_name = None

    if content_type_cap == "Article":
        art_doc = frappe.new_doc("Article")
        art_doc.title = title
        art_doc.author = details.get("author") or frappe.session.user
        art_doc.content = details.get("content") or f"<p>{title}</p>"
        art_doc.publish_date = details.get("publish_date") or today()
        art_doc.insert(ignore_permissions=True)
        created_content_name = art_doc.name

    elif content_type_cap == "Video":
        vid_doc = frappe.new_doc("Video")
        vid_doc.title = title
        vid_doc.provider = details.get("provider") or "YouTube"
        vid_doc.url = details.get("url") or ""
        vid_doc.duration = float(details.get("duration") or 0)
        vid_doc.description = details.get("description") or f"<p>{title}</p>"
        vid_doc.publish_date = details.get("publish_date") or today()
        vid_doc.insert(ignore_permissions=True)
        created_content_name = vid_doc.name

    elif content_type_cap == "Quiz":
        questions_input = details.get("questions") or []
        quiz_question_rows = []
        for q_item in questions_input:
            q_text = (q_item.get("question") or "").strip()
            if not q_text:
                continue
            q_type = q_item.get("question_type") or "Single Correct Answer"
            q_options_input = q_item.get("options") or []

            question_doc = frappe.new_doc("Question")
            question_doc.question = q_text
            question_doc.question_type = q_type
            for opt in q_options_input:
                question_doc.append(
                    "options",
                    {
                        "option": opt.get("option") or "",
                        "is_correct": 1 if opt.get("is_correct") else 0,
                        "explanation": opt.get("explanation") or "",
                    },
                )
            question_doc.insert(ignore_permissions=True)

            quiz_question_rows.append(
                {
                    "question_link": question_doc.name,
                    "question": q_text,
                }
            )

        quiz_doc = frappe.new_doc("Quiz")
        quiz_doc.title = title
        quiz_doc.passing_score = float(details.get("passing_score") or 70.0)
        quiz_doc.max_attempts = int(details.get("max_attempts") or 3)
        if details.get("duration"):
            quiz_doc.is_time_bound = 1
            quiz_doc.duration = float(details.get("duration"))
        for qr in quiz_question_rows:
            quiz_doc.append("question", qr)
        quiz_doc.insert(ignore_permissions=True)
        created_content_name = quiz_doc.name

    topic_doc.append(
        "topic_content",
        {
            "content_type": content_type_cap,
            "content": created_content_name,
        },
    )
    topic_doc.save(ignore_permissions=True)

    return {
        "success": True,
        "message": f"{content_type_cap} '{title}' created and linked to topic '{topic_name}'.",
        "content": {
            "title": created_content_name,
            "type": content_type.lower(),
            "status": "Available",
        },
        "topic": topic_doc.name,
    }


@frappe.whitelist(methods=["POST"])
def create_course_topic(course_name: str, topic_title: str, description: str = ""):
    _require_staff(_("create topics"))
    if not course_name or not topic_title:
        frappe.throw(_("Course name and Topic title are required."))

    if not frappe.db.exists("Course", course_name):
        frappe.throw(_("Course {0} does not exist.").format(course_name))

    topic_doc = frappe.new_doc("Topic")
    topic_doc.topic_name = topic_title
    topic_doc.description = description or f"Curriculum modules for {topic_title}"
    topic_doc.insert(ignore_permissions=True)

    course_doc = frappe.get_doc("Course", course_name)
    course_doc.append("topics", {"topic": topic_doc.name})
    course_doc.save(ignore_permissions=True)

    return {
        "success": True,
        "topic": {
            "name": topic_doc.name,
            "title": topic_doc.topic_name,
            "description": topic_doc.description,
            "contents": [],
        },
    }


@frappe.whitelist(methods=["POST"])
def create_program(
    program_name: str,
    program_abbreviation: str = None,
    department: str = None,
    courses: list | str = None,
    create_default_section: bool = True,
):
    _require_staff(_("create programs"))
    if not program_name or not program_name.strip():
        frappe.throw(frappe._("Program Name is required."))

    program_name = program_name.strip()
    if frappe.db.exists("Program", program_name):
        frappe.throw(frappe._("Program '{0}' already exists.").format(program_name))

    doc = frappe.new_doc("Program")
    doc.program_name = program_name
    doc.program_abbreviation = program_abbreviation or (
        program_name[:8].upper()
        if len(program_name) <= 8
        else "".join([w[0] for w in program_name.split() if w]).upper()
    )
    if department and frappe.db.exists("Department", department):
        doc.department = department

    # Attach courses if provided
    parsed_courses = (
        json.loads(courses) if isinstance(courses, str) else (courses or [])
    )
    for c in parsed_courses:
        c_name = c if isinstance(c, str) else c.get("course")
        if c_name and frappe.db.exists("Course", c_name):
            doc.append("courses", {"course": c_name, "required": 1})

    doc.insert(ignore_permissions=True)

    # Automatically create default section (Student Group) if requested
    default_sg_name = f"{program_name} - Section A"
    curr_year = frappe.db.get_value(
        "Academic Year",
        {"year_start_date": ["<=", today()], "year_end_date": [">=", today()]},
        "name",
    ) or frappe.db.get_value(
        "Academic Year", {}, "name", order_by="year_start_date desc"
    )
    create_default_section = bool(create_default_section) and bool(curr_year)
    if create_default_section and not frappe.db.exists(
        "Student Group", default_sg_name
    ):
        sg = frappe.new_doc("Student Group")
        sg.student_group_name = default_sg_name
        sg.group_based_on = "Batch"
        sg.program = program_name
        sg.academic_year = curr_year
        sg.max_strength = 40
        sg.insert(ignore_permissions=True)

    return {
        "success": True,
        "name": doc.name,
        "program_name": doc.program_name,
        "program_abbreviation": doc.program_abbreviation,
        "department": doc.department,
        "courses": [row.course for row in (doc.courses or [])],
        "default_student_group": default_sg_name if create_default_section else None,
    }


@frappe.whitelist(methods=["POST"])
def create_course(
    course_name: str,
    program: str = None,
    department: str = None,
    default_grading_scale: str = None,
    description: str = None,
    attach_to_programs: list | str = None,
):
    _require_staff(_("create courses"))
    if not course_name or not course_name.strip():
        frappe.throw(frappe._("Course Name is required."))

    course_name = course_name.strip()
    if frappe.db.exists("Course", course_name):
        frappe.throw(frappe._("Course '{0}' already exists.").format(course_name))

    # Resolve default grading scale
    if not default_grading_scale or not frappe.db.exists(
        "Grading Scale", default_grading_scale
    ):
        default_grading_scale = frappe.db.get_value(
            "Grading Scale", {"docstatus": ["<", 2]}, "name"
        )

    doc = frappe.new_doc("Course")
    doc.course_name = course_name
    if program and frappe.db.exists("Program", program):
        doc.program = program
    if department and frappe.db.exists("Department", department):
        doc.department = department
    if default_grading_scale:
        doc.default_grading_scale = default_grading_scale
    if description:
        doc.description = description

    doc.insert(ignore_permissions=True)

    # Link course to specified program(s)
    progs_to_link = set()
    if program:
        progs_to_link.add(program)
    if attach_to_programs:
        parsed_progs = (
            json.loads(attach_to_programs)
            if isinstance(attach_to_programs, str)
            else attach_to_programs
        )
        for p in parsed_progs:
            if p:
                progs_to_link.add(p)

    for p_name in progs_to_link:
        if frappe.db.exists("Program", p_name):
            prog_doc = frappe.get_doc("Program", p_name)
            already_has = any(c.course == doc.name for c in (prog_doc.courses or []))
            if not already_has:
                prog_doc.append("courses", {"course": doc.name, "required": 1})
                prog_doc.save(ignore_permissions=True)

    return {
        "success": True,
        "name": doc.name,
        "course_name": doc.course_name,
        "program": doc.program,
        "department": doc.department,
        "default_grading_scale": doc.default_grading_scale,
        "description": doc.description,
        "linked_programs": list(progs_to_link),
    }


@frappe.whitelist(methods=["POST"])
def create_academic_year(
    academic_year_name: str,
    year_start_date: str,
    year_end_date: str,
):
    """Creates a new Academic Year document in Frappe Education."""
    _require_staff(_("create academic years"))
    if not academic_year_name or not academic_year_name.strip():
        frappe.throw(frappe._("Academic Year Name is required (e.g. '2028-2029')."))

    academic_year_name = academic_year_name.strip()
    if frappe.db.exists("Academic Year", academic_year_name):
        frappe.throw(
            frappe._("Academic Year '{0}' already exists.").format(academic_year_name)
        )

    if not year_start_date or not year_end_date:
        frappe.throw(frappe._("Both Year Start Date and Year End Date are required."))

    if str(year_start_date) > str(year_end_date):
        frappe.throw(frappe._("Year End Date cannot be earlier than Year Start Date."))

    doc = frappe.new_doc("Academic Year")
    doc.academic_year_name = academic_year_name
    doc.year_start_date = year_start_date
    doc.year_end_date = year_end_date
    doc.insert(ignore_permissions=True)

    return {
        "success": True,
        "name": doc.name,
        "academic_year_name": doc.academic_year_name,
        "year_start_date": str(doc.year_start_date),
        "year_end_date": str(doc.year_end_date),
    }


# nosemgrep: guest-whitelisted-method -- public academic year list for the admission form
@frappe.whitelist(allow_guest=True)
def get_all_academic_years():
    """Returns all Academic Years ordered by year_start_date desc."""
    return frappe.get_all(
        "Academic Year",
        fields=["name", "academic_year_name", "year_start_date", "year_end_date"],
        order_by="year_start_date desc",
    )


@frappe.whitelist(methods=["POST"])
def create_academic_term(
    academic_year: str,
    term_name: str,
    term_start_date: str,
    term_end_date: str,
):
    """Creates a new Academic Term in Frappe Education."""
    _require_staff(_("create academic terms"))
    if not academic_year or not academic_year.strip():
        frappe.throw(frappe._("Academic Year is required."))

    academic_year = academic_year.strip()
    if not frappe.db.exists("Academic Year", academic_year):
        frappe.throw(
            frappe._("Academic Year '{0}' does not exist.").format(academic_year)
        )

    if not term_name or not term_name.strip():
        frappe.throw(frappe._("Term Name is required (e.g. 'Term 1' or 'Semester 1')."))

    term_name = term_name.strip()
    if not term_start_date or not term_end_date:
        frappe.throw(frappe._("Both Term Start Date and Term End Date are required."))

    if frappe.db.exists(
        "Academic Term", {"academic_year": academic_year, "term_name": term_name}
    ):
        frappe.throw(
            frappe._(
                "Academic Term '{0}' already exists for Academic Year '{1}'."
            ).format(term_name, academic_year)
        )

    doc = frappe.new_doc("Academic Term")
    doc.academic_year = academic_year
    doc.term_name = term_name
    doc.term_start_date = term_start_date
    doc.term_end_date = term_end_date
    doc.insert(ignore_permissions=True)

    return {
        "success": True,
        "name": doc.name,
        "title": doc.title or doc.name,
        "academic_year": doc.academic_year,
        "term_name": doc.term_name,
        "term_start_date": str(doc.term_start_date),
        "term_end_date": str(doc.term_end_date),
    }


# nosemgrep: guest-whitelisted-method -- public academic term list for the admission form
@frappe.whitelist(allow_guest=True)
def get_all_academic_terms(academic_year: str | None = None):
    """Returns Academic Terms ordered by term_start_date desc."""
    filters = {}
    if academic_year:
        filters["academic_year"] = academic_year

    return frappe.get_all(
        "Academic Term",
        filters=filters,
        fields=[
            "name",
            "title",
            "academic_year",
            "term_name",
            "term_start_date",
            "term_end_date",
        ],
        order_by="term_start_date desc",
    )


@frappe.whitelist()
def get_all_available_courses():
    """Returns all Course documents across the institution."""
    _require_login()
    return frappe.get_all(
        "Course",
        fields=["name", "course_name", "department", "program", "description"],
        order_by="course_name asc",
    )


@frappe.whitelist()
def get_program_courses(program_name: str):
    """Returns all courses assigned to a specific Program / Standard."""
    if not program_name or not frappe.db.exists("Program", program_name):
        return []
    _check_program_access(program_name)

    program = frappe.get_doc("Program", program_name)
    result = []
    for pc in program.courses or []:
        course_name = pc.course
        course_doc = frappe.db.get_value(
            "Course",
            course_name,
            ["name", "course_name", "department", "description"],
            as_dict=True,
        ) or {"name": course_name, "course_name": pc.course_name or course_name}
        course_doc["required"] = pc.required
        result.append(course_doc)

    return result


@frappe.whitelist(methods=["POST"])
def assign_course_to_program(program_name: str, course: str, required: int = 1):
    """Links / assigns an existing or newly created course to a Program / Standard."""
    _require_staff(_("manage program courses"))

    if not program_name or not frappe.db.exists("Program", program_name):
        frappe.throw(frappe._("Program '{0}' does not exist.").format(program_name))

    if not course or not frappe.db.exists("Course", course):
        frappe.throw(frappe._("Course '{0}' does not exist.").format(course))

    prog_doc = frappe.get_doc("Program", program_name)
    already_assigned = any(c.course == course for c in (prog_doc.courses or []))
    if already_assigned:
        return {"status": "already_assigned", "program": program_name, "course": course}

    prog_doc.append("courses", {"course": course, "required": int(required)})
    prog_doc.save(ignore_permissions=True)

    return {"status": "success", "program": program_name, "course": course}


@frappe.whitelist(methods=["POST"])
def remove_course_from_program(program_name: str, course: str):
    """Unlinks / removes a course from a Program / Standard."""
    _require_staff(_("manage program courses"))

    if not program_name or not frappe.db.exists("Program", program_name):
        frappe.throw(frappe._("Program '{0}' does not exist.").format(program_name))

    prog_doc = frappe.get_doc("Program", program_name)
    initial_len = len(prog_doc.courses or [])
    prog_doc.courses = [c for c in (prog_doc.courses or []) if c.course != course]

    if len(prog_doc.courses) == initial_len:
        return {"status": "not_found", "program": program_name, "course": course}

    prog_doc.save(ignore_permissions=True)

    return {"status": "success", "program": program_name, "course": course}


@frappe.whitelist(methods=["POST"])
def delete_course(course: str):
    """Permanently deletes a Course document from the system if permitted."""
    _require_staff(_("delete courses"))

    if not course or not frappe.db.exists("Course", course):
        frappe.throw(frappe._("Course '{0}' does not exist.").format(course))

    # Remove course from any programs linked to it
    programs_with_course = frappe.get_all(
        "Program Course", filters={"course": course}, fields=["parent"]
    )
    for row in programs_with_course:
        try:
            p_doc = frappe.get_doc("Program", row.parent)
            p_doc.courses = [c for c in (p_doc.courses or []) if c.course != course]
            p_doc.save(ignore_permissions=True)
        except Exception as e:
            frappe.log_error(
                f"Error unlinking course {course} from program {row.parent}: {str(e)}"
            )

    frappe.delete_doc("Course", course, ignore_permissions=True)

    return {"status": "success", "course": course}


def _is_quiz_staff():
    roles = set(frappe.get_roles())
    return bool(
        roles
        & {
            "Instructor",
            "Academics User",
            "Education Manager",
            "System Manager",
            "Administrator",
        }
    )
