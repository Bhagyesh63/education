# Copyright (c) 2015, Frappe Technologies and contributors
# For license information, please see license.txt

"""Public API Facade for Frappe Education.

Modular implementation is organized cleanly into domain-specific modules:
- api_modules.common: Constants, permission checkers, and shared utilities
- api_modules.auth: Portal login, user authentication, roles, context, and guardian lookups
- api_modules.students: Profiles, directory, enrollments, groups, and guardians
- api_modules.curriculum: Programs, courses, topics, and learning materials
- api_modules.schedule: Course scheduling, timetable events, instructors, and rooms
- api_modules.attendance: Mark attendance, attendance records, and leave applications
- api_modules.assessment: Quizzes, grading scales, assessment plans, criteria, and marks
- api_modules.fees: Fee structures, schedules, components, and student invoices
- api_modules.achievements: Student logs, achievements, and notification logs

All public methods are re-exported here to maintain 100% backward compatibility for all
Frappe RPC endpoints (e.g. /api/method/education.education.api.*).
"""

from education.education.api_modules.common import (
    PORTAL_STUDENT_FIELDS,
    PROGRAM_ENROLLMENT_FIELDS,
    _resolve_portal_student,
    check_permission,
    get_guardians_for_user,
    get_guardian_for_user,
    is_guardian_of,
    get_currency_symbol,
    get_posting_date_from_payment_entry_against_sales_invoice,
    get_fees_print_format,
    get_program_from_fee_schedule,
    _get_submitted_program_enrollments,
    _resolve_default_program,
    _get_program_enrollment,
    update_email_group,
    get_instructor_for_user,
    get_dashboard_stats,
    get_dashboard_schedule,
    get_recent_assessments,
    get_dashboard_announcements,
)

from education.education.api_modules.auth import (
    get_user_info,
    get_user_role,
    get_school_abbr_logo,
    portal_login,
    get_csrf_token,
    get_portal_context,
    get_guardian_info,
    get_guardian_students,
    get_demo_accounts,
    get_preview_targets,
    get_preview_context,
)

from education.education.api_modules.students import (
    get_current_enrollment,
    get_student_profile,
    get_student_directory,
    get_program_context,
    get_student_programs,
    get_student_groups,
    get_student_guardians,
    get_student_group_students,
    enroll_student,
    get_enrollment_metadata,
    enroll_student_in_program,
    bulk_enroll_students_in_program,
    assign_student_to_group,
    create_student_group,
    get_all_student_groups,
    get_student_group_details,
    remove_student_from_group,
    get_student_course_enrollments,
    get_available_courses_for_student,
    enroll_student_in_course,
    drop_course_enrollment,
)

from education.education.api_modules.curriculum import (
    get_course,
    get_all_programs,
    get_course_details,
    get_topic_details,
    get_course_list_based_on_program,
    get_program_curriculum_details,
    get_learning_content_details,
    create_topic_learning_material,
    create_course_topic,
    create_program,
    create_course,
    create_academic_year,
    get_all_academic_years,
    create_academic_term,
    get_all_academic_terms,
    get_all_available_courses,
    get_program_courses,
    assign_course_to_program,
    remove_course_from_program,
    delete_course,
)

from education.education.api_modules.schedule import (
    get_course_schedule_events,
    get_course_schedule_for_student,
    get_course_schedule,
    get_schedule_metadata,
    create_course_schedule,
    delete_course_schedule,
    get_instructors,
    bulk_schedule_course,
)

from education.education.api_modules.attendance import (
    get_attendance_roster,
    check_attendance_records_exist,
    mark_attendance,
    make_attendance_records,
    get_student_attendance,
    get_school_holidays,
    get_student_leaves,
    approve_student_leave,
    apply_leave,
    create_student_leave_application_based_on_course_schedule,
    create_student_leave_application_based_on_student_group,
)

from education.education.api_modules.assessment import (
    get_quiz_status,
    submit_quiz_assessment,
    get_quiz_student_submissions,
    get_assessment_criteria,
    get_assessment_students,
    get_assessment_details,
    get_result,
    get_grade,
    get_grading_scale_intervals,
    mark_assessment_result,
    submit_assessment_results,
    get_assessment_result_doc,
    get_student_assessment_results,
    get_assessment_plans,
    create_assessment_plan,
    get_assessment_setup_metadata,
    get_student_report_card_data,
    get_batch_report_cards_data,
    get_reports_tools_summary,
)

from education.education.api_modules.fees import (
    get_fee_structure,
    get_fee_components,
    get_fee_schedule,
    collect_fees,
    get_student_invoices,
    get_fee_dashboard_summary,
    get_all_invoices_for_admin,
    create_payment_entry,
    submit_sales_invoice,
    get_payment_modes,
)

from education.education.api_modules.achievements import (
    get_student_logs,
    get_student_achievements,
    create_student_log,
    delete_student_log,
    get_notification_logs,
)

from education.education.api_modules.program_enrollment_tool import (
    get_program_enrollment_tool_metadata,
    get_program_enrollment_tool_students,
    enroll_students_via_tool,
)

from education.education.api_modules.student_group_tool import (
    get_student_group_tool_metadata,
    get_student_group_proposals,
    create_student_groups_via_tool,
)

from education.education.api_modules.landing import (
    get_landing_context,
    get_open_admissions,
)

from education.education.api_modules.admissions import (
    get_admissions_list,
    create_student_admission,
    get_student_applicants,
    get_applicant_details,
    create_student_applicant,
    update_applicant_status,
    admit_and_enroll_applicant,
)
