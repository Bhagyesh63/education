import { frappeCall } from './client';

export const admissionsApi = {
  // Public landing page: school identity, contact, classes, open admissions, notices
  getLandingContext: () =>
    frappeCall('education.education.api.get_landing_context', {}, { httpMethod: 'GET' }),

  getAdmissionsList: () =>
    frappeCall('education.education.api.get_admissions_list'),

  createStudentAdmission: (data) =>
    frappeCall('education.education.api.create_student_admission', data),

  getStudentApplicants: (filters = {}) =>
    frappeCall('education.education.api.get_student_applicants', filters),

  getApplicantDetails: (applicantName) =>
    frappeCall('education.education.api.get_applicant_details', { applicant_name: applicantName }),

  createStudentApplicant: (data) =>
    frappeCall('education.education.api.create_student_applicant', data),

  updateApplicantStatus: (applicantName, status) =>
    frappeCall('education.education.api.update_applicant_status', { applicant_name: applicantName, status }),

  admitAndEnrollApplicant: (applicantName) =>
    frappeCall('education.education.api.admit_and_enroll_applicant', { applicant_name: applicantName }),
};

export default admissionsApi;
