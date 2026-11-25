import { frappeCall } from './client';

export const gradesApi = {
  getQuizStatus: (quiz_name, student = null) => 
    frappeCall('education.education.api.get_quiz_status', { quiz_name, student }),

  // Accepts an object ({ quiz_name, answers, ... }) or positional args
  // (quiz_name, answers, course_name, student, time_taken) — CoursesView uses the latter.
  submitQuizAssessment: (quizOrArgs, answers, course_name, student, time_taken) => {
    const args = quizOrArgs && typeof quizOrArgs === 'object'
      ? quizOrArgs
      : { quiz_name: quizOrArgs, answers, course_name, student, time_taken };
    return frappeCall('education.education.api.submit_quiz_assessment', {
      quiz_name: args.quiz_name,
      answers: args.answers,
      course_name: args.course_name || undefined,
      student: args.student || undefined,
      time_taken: args.time_taken || 0,
    });
  },

  getQuizStudentSubmissions: (quiz_name, course_name = null) => 
    frappeCall('education.education.api.get_quiz_student_submissions', { quiz_name, course_name }),

  getQuizSubmissions: (quiz_name, course_name = null) => 
    frappeCall('education.education.api.get_quiz_student_submissions', { quiz_name, course_name }),

  getAssessmentResults: (student, program, course) => 
    frappeCall('education.education.api.get_student_assessment_results', { student, program, course }),

  getStudentAssessmentResults: (student, program, course) => 
    frappeCall('education.education.api.get_student_assessment_results', { student, program, course }),

  getAssessmentStudents: (assessment_plan, student_group) => 
    frappeCall('education.education.api.get_assessment_students', { assessment_plan, student_group }),

  getAssessmentDetails: (assessment_plan) => 
    frappeCall('education.education.api.get_assessment_details', { assessment_plan }),

  markAssessmentResult: (assessment_plan, scores) => 
    frappeCall('education.education.api.mark_assessment_result', { assessment_plan, scores }),

  submitAssessmentResults: (assessment_plan, student_group) => 
    frappeCall('education.education.api.submit_assessment_results', { assessment_plan, student_group }),

  getAssessmentPlans: (student_group, course, program) => 
    frappeCall('education.education.api.get_assessment_plans', { student_group, course, program }),

  createAssessmentPlan: (data) => 
    frappeCall('education.education.api.create_assessment_plan', data),

  getAssessmentSetupMetadata: () => 
    frappeCall('education.education.api.get_assessment_setup_metadata'),

  getGrade: (grading_scale, percentage) => 
    frappeCall('education.education.api.get_grade', { grading_scale, percentage }),

  getGradingScaleIntervals: (params = {}) => 
    frappeCall('education.education.api.get_grading_scale_intervals', typeof params === 'string' ? { grading_scale: params } : (params || {})),

  getStudentReportCardData: (params = {}) =>
    frappeCall('education.education.api.get_student_report_card_data', params),

  getBatchReportCardsData: (params = {}) =>
    frappeCall('education.education.api.get_batch_report_cards_data', params),

  getReportsToolsSummary: () =>
    frappeCall('education.education.api.get_reports_tools_summary'),
};

export default gradesApi;
