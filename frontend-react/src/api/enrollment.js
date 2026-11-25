import { frappeCall } from './client';

// Program Enrollment Tool (portal version of the desk tool)
export const enrollmentApi = {
  getProgramEnrollmentToolMetadata: () =>
    frappeCall('education.education.api.get_program_enrollment_tool_metadata', {}, { httpMethod: 'GET' }),

  getProgramEnrollmentToolStudents: (filters) =>
    frappeCall(
      'education.education.api.get_program_enrollment_tool_students',
      Object.fromEntries(Object.entries(filters).filter(([, v]) => v !== undefined && v !== null && v !== '')),
      { httpMethod: 'GET' }
    ),

  enrollStudentsViaTool: (payload) =>
    frappeCall('education.education.api.enroll_students_via_tool', payload),

  // Student Group Creation Tool (portal version of the desk tool)
  getStudentGroupToolMetadata: () =>
    frappeCall('education.education.api.get_student_group_tool_metadata', {}, { httpMethod: 'GET' }),

  getStudentGroupProposals: (filters) =>
    frappeCall(
      'education.education.api.get_student_group_proposals',
      Object.fromEntries(Object.entries(filters).filter(([, v]) => v !== undefined && v !== null && v !== '')),
      { httpMethod: 'GET' }
    ),

  createStudentGroupsViaTool: (payload) =>
    frappeCall('education.education.api.create_student_groups_via_tool', payload),
};

export default enrollmentApi;
