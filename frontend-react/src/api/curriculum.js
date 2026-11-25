import { frappeCall } from './client';

const isArgsObject = (args) => args.length === 1 && args[0] && typeof args[0] === 'object';

function materialArgs(args) {
  const [topic_name, content_type, title, details, course_name] = isArgsObject(args)
    ? [args[0].topic_name, args[0].content_type, args[0].title, args[0].details, args[0].course_name]
    : args;
  return { topic_name, content_type, title, details, course_name };
}

function topicArgs(args) {
  const [course_name, topic_title, description] = isArgsObject(args)
    ? [args[0].course_name, args[0].topic_title, args[0].description]
    : args;
  return { course_name, topic_title, description };
}


export const curriculumApi = {
  getAllPrograms: () => 
    frappeCall('education.education.api.get_all_programs'),

  getPrograms: (student) => 
    frappeCall('education.education.api.get_student_programs', { student }),

  getCourseListBasedOnProgram: (program_name) => 
    frappeCall('education.education.api.get_course_list_based_on_program', { program_name }),

  getProgramCurriculumDetails: (program_name) => 
    frappeCall('education.education.api.get_program_curriculum_details', { program_name }),

  getProgramCurriculum: (program_name) => 
    frappeCall('education.education.api.get_program_curriculum_details', { program_name }),

  getCourseDetails: (course) => 
    frappeCall('education.education.api.get_course_details', { course }),

  getTopicDetails: (topic) => 
    frappeCall('education.education.api.get_topic_details', { topic }),

  getLearningContentDetails: (content_type, content_name) => 
    frappeCall('education.education.api.get_learning_content_details', { content_type, content_name }),

  getLearningContent: (content_type, content_name) => 
    frappeCall('education.education.api.get_learning_content_details', { content_type, content_name }),

  // Accept an object or positional args (topic_name, content_type, title, details, course_name)
  createTopicLearningMaterial: (...args) =>
    frappeCall('education.education.api.create_topic_learning_material', materialArgs(args)),

  createLearningMaterial: (...args) =>
    frappeCall('education.education.api.create_topic_learning_material', materialArgs(args)),

  // Accept an object or positional args (course_name, topic_title, description)
  createCourseTopic: (...args) =>
    frappeCall('education.education.api.create_course_topic', topicArgs(args)),

  createTopic: (...args) =>
    frappeCall('education.education.api.create_course_topic', topicArgs(args)),

  createProgram: ({ program_name, program_abbreviation, department, courses, create_default_section }) =>
    frappeCall('education.education.api.create_program', {
      program_name,
      program_abbreviation: program_abbreviation || null,
      department: department || null,
      courses: courses || null,
      create_default_section: create_default_section !== false,
    }),

  createCourse: ({ course_name, program, department, default_grading_scale, description, attach_to_programs }) =>
    frappeCall('education.education.api.create_course', {
      course_name,
      program: program || null,
      department: department || null,
      default_grading_scale: default_grading_scale || null,
      description: description || null,
    }),
  createAcademicYear: ({ academic_year_name, year_start_date, year_end_date }) =>
    frappeCall('education.education.api.create_academic_year', {
      academic_year_name,
      year_start_date,
      year_end_date,
    }),

  getAcademicYears: () =>
    frappeCall('education.education.api.get_all_academic_years'),

  getAllAcademicYears: () =>
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

  getAllAvailableCourses: () =>
    frappeCall('education.education.api.get_all_available_courses'),

  getProgramCourses: (program_name) =>
    frappeCall('education.education.api.get_program_courses', { program_name }),

  assignCourseToProgram: ({ program_name, course, required }) =>
    frappeCall('education.education.api.assign_course_to_program', { program_name, course, required: required !== 0 ? 1 : 0 }),

  removeCourseFromProgram: ({ program_name, course }) =>
    frappeCall('education.education.api.remove_course_from_program', { program_name, course }),

  deleteCourse: (course) =>
    frappeCall('education.education.api.delete_course', { course }),
};

export default curriculumApi;
