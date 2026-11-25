import { frappeCall } from './client';

export const scheduleApi = {
  // Permission-scoped on the server: students see own groups, guardians their wards,
  // instructors their groups/lectures, managers everything.
  getCourseSchedule: (program_name, student_groups, student, instructor, from_date, to_date) =>
    frappeCall('education.education.api.get_course_schedule_for_student', {
      program_name: program_name || null,
      student_groups: student_groups || null,
      student: student || null,
      instructor: instructor || null,
      ...(from_date ? { from_date } : {}),
      ...(to_date ? { to_date } : {}),
    }),

  getCourseSchedulesInRange: ({ program_name, student_groups, student, instructor, from_date, to_date } = {}) =>
    scheduleApi.getCourseSchedule(program_name, student_groups, student, instructor, from_date, to_date),

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
