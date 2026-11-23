import { frappeCall } from './client';

export const attendanceApi = {
  getAttendanceRoster: (student_group, date, course_schedule) =>
    frappeCall('education.education.api.get_attendance_roster', { student_group, date, course_schedule }),

  getStudentAttendance: (student, student_group) => 
    frappeCall('education.education.api.get_student_attendance', { student, student_group }),

  getSchoolHolidays: (holiday_list) => 
    frappeCall('education.education.api.get_school_holidays', { holiday_list }),

  getStudentLeaves: (student) => 
    frappeCall('education.education.api.get_student_leaves', student ? { student } : {}),

  approveStudentLeave: (leave_id) => 
    frappeCall('education.education.api.approve_student_leave', { leave_id }),

  applyLeave: (leave_data, program_name) => 
    frappeCall('education.education.api.apply_leave', { leave_data, program_name }),

  checkAttendanceRecordsExist: (course_schedule, student_group, date) =>
    frappeCall('education.education.api.check_attendance_records_exist', { course_schedule, student_group, date }),

  markAttendance: ({ students_present, students_absent, course_schedule, student_group, date }) =>
    frappeCall('education.education.api.mark_attendance', {
      students_present: typeof students_present === 'string' ? students_present : JSON.stringify(students_present),
      students_absent: typeof students_absent === 'string' ? students_absent : JSON.stringify(students_absent),
      course_schedule,
      student_group,
      date,
    }),

  getStudentAttendanceRecords: ({ based_on, student_group, date, course_schedule }) =>
    frappeCall('education.education.doctype.student_attendance_tool.student_attendance_tool.get_student_attendance_records', {
      based_on,
      student_group,
      date,
      course_schedule,
    }),

  getAllStudentGroups: (program, academic_year) =>
    frappeCall('education.education.api_modules.students.get_all_student_groups', {
      ...(program ? { program } : {}),
      ...(academic_year ? { academic_year } : {}),
    }),

  getCourseSchedulesForTool: (program_name = 'all') =>
    frappeCall('education.education.api.get_course_schedule_for_student', {
      program_name,
    }),
};

export default attendanceApi;
