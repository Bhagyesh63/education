import { frappeCall } from './client';

export const studentsApi = {
  getStudentProfile: (student) => 
    frappeCall('education.education.api.get_student_profile', { student }),

  getStudentDirectory: (program, student_group) => 
    frappeCall('education.education.api.get_student_directory', {
      ...(program ? { program } : {}),
      ...(student_group ? { student_group } : {}),
    }),

  getStudentGroupStudents: (student_group) => 
    frappeCall('education.education.api.get_student_group_students', { student_group }),

  getStudentPrograms: (student) => 
    frappeCall('education.education.api.get_student_programs', { student }),

  getProgramContext: (student, program, academic_year = null, program_enrollment = null) => 
    frappeCall('education.education.api.get_program_context', { student, program, academic_year, program_enrollment }),

  getCurrentEnrollment: (student) => 
    frappeCall('education.education.api.get_current_enrollment', { student }),

  getStudentLogs: (student) => 
    frappeCall('education.education.api.get_student_logs', { student }),

  getEnrollmentMetadata: () =>
    frappeCall('education.education.api.get_enrollment_metadata'),

  enrollStudentInProgram: ({ student, program, academic_year, academic_term }) =>
    frappeCall('education.education.api.enroll_student_in_program', {
      student,
      program,
      academic_year,
      academic_term: academic_term || null,
    }),

  assignStudentToGroup: ({ student, student_group, roll_number }) =>
    frappeCall('education.education.api.assign_student_to_group', {
      student,
      student_group,
      roll_number: roll_number || null,
    }),

  bulkEnrollStudentsInProgram: ({ students, program, academic_year, academic_term, student_group }) =>
    frappeCall('education.education.api.bulk_enroll_students_in_program', {
      students,
      program,
      academic_year,
      academic_term: academic_term || null,
      student_group: student_group || null,
    }),

  createAcademicYear: ({ academic_year_name, year_start_date, year_end_date }) =>
    frappeCall('education.education.api.create_academic_year', {
      academic_year_name,
      year_start_date,
      year_end_date,
    }),

  getAcademicYears: () =>
    frappeCall('education.education.api.get_all_academic_years'),

  createAcademicTerm: ({ academic_year, term_name, term_start_date, term_end_date }) =>
    frappeCall('education.education.api.create_academic_term', {
      academic_year,
      term_name,
      term_start_date,
      term_end_date,
    }),

  getAcademicTerms: (params) =>
    frappeCall('education.education.api.get_all_academic_terms', params || {}),

  createStudentGroup: ({ student_group_name, academic_year, program, group_based_on, max_strength, academic_term, course, batch }) =>
    frappeCall('education.education.api.create_student_group', {
      student_group_name,
      academic_year,
      program,
      group_based_on: group_based_on || 'Batch',
      max_strength: max_strength || 40,
      academic_term: academic_term || null,
      course: course || null,
      batch: batch || null,
    }),

  getAllStudentGroups: (params) =>
    frappeCall('education.education.api.get_all_student_groups', params || {}),

  getStudentGroupDetails: (student_group) =>
    frappeCall('education.education.api.get_student_group_details', { student_group }),

  removeStudentFromGroup: ({ student, student_group }) =>
    frappeCall('education.education.api.remove_student_from_group', { student, student_group }),

  getStudentCourseEnrollments: (student) =>
    frappeCall('education.education.api.get_student_course_enrollments', { student }),

  getAvailableCoursesForStudent: (student) =>
    frappeCall('education.education.api.get_available_courses_for_student', { student }),

  enrollStudentInCourse: ({ student, course, program_enrollment }) =>
    frappeCall('education.education.api.enroll_student_in_course', { student, course, program_enrollment }),

  dropCourseEnrollment: (enrollment_name) =>
    frappeCall('education.education.api.drop_course_enrollment', { enrollment_name }),
};

export default studentsApi;
