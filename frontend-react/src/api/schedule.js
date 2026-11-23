import { frappeCall } from './client';

export const scheduleApi = {
  getCourseSchedule: (program_name, student_groups, student, instructor) => 
    frappeCall('education.education.api.get_course_schedule_for_student', { program_name, student_groups, student, instructor }),

  getScheduleMetadata: () => 
    frappeCall('education.education.api.get_schedule_metadata'),

  createCourseSchedule: (data) => 
    frappeCall('education.education.api.create_course_schedule', data),

  deleteCourseSchedule: (course_schedule) => 
    frappeCall('education.education.api.delete_course_schedule', { course_schedule }),

  getInstructors: (student_group) => 
    frappeCall('education.education.api.get_instructors', { student_group }),

  bulkScheduleCourse: (data) =>
    frappeCall('education.education.api.bulk_schedule_course', data),
};

export default scheduleApi;
