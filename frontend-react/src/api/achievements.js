import { frappeCall } from './client';

export const achievementsApi = {
  getStudentAchievements: (student) => 
    frappeCall('education.education.api.get_student_achievements', student ? { student } : {}),

  getStudentLogs: (student, log_type) => 
    frappeCall('education.education.api.get_student_logs', {
      ...(student ? { student } : {}),
      ...(log_type ? { log_type } : {}),
    }),

  createStudentLog: (data) => 
    frappeCall('education.education.api.create_student_log', data),

  deleteStudentLog: (log_name) => 
    frappeCall('education.education.api.delete_student_log', { log_name }),

  getNotificationLogs: () => 
    frappeCall('education.education.api.get_notification_logs'),
};

export default achievementsApi;
