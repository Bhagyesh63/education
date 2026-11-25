import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  CalendarPlus, 
  ArrowLeft, 
  Calendar, 
  Clock, 
  Users, 
  BookOpen, 
  User, 
  MapPin, 
  Palette, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw, 
  Sparkles, 
  FileCheck2, 
  Trash2, 
  Layers,
  CalendarCheck,
  CheckCheck,
  Info,
  ChevronRight,
  Filter,
  Check,
  Building,
  School
} from 'lucide-react';
import { scheduleApi } from '../api/schedule';
import { useAuth } from '../context/AuthContext';

export default function CourseSchedulingTool() {
  const navigate = useNavigate();
  const { isStaff, isAdmin } = useAuth();

  // Helper for today formatted as YYYY-MM-DD
  const getTodayDate = () => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  // Helper for 1 month later
  const getOneMonthLater = () => {
    const d = new Date();
    d.setMonth(d.getMonth() + 1);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  // Form State (matching Frappe DocType "Course Scheduling Tool")
  const [selectedStudentGroup, setSelectedStudentGroup] = useState('');
  const [selectedCourse, setSelectedCourse] = useState('');
  const [selectedInstructor, setSelectedInstructor] = useState('');
  const [selectedRoom, setSelectedRoom] = useState('');
  const [scheduleColor, setScheduleColor] = useState('blue');
  const [fromTime, setFromTime] = useState('09:00');
  const [toTime, setToTime] = useState('10:00');
  const [courseStartDate, setCourseStartDate] = useState(getTodayDate());
  const [courseEndDate, setCourseEndDate] = useState(getOneMonthLater());
  const [selectedDays, setSelectedDays] = useState(['Monday', 'Wednesday', 'Friday']);
  const [reschedule, setReschedule] = useState(false);

  const [courses, setCourses] = useState([]);
  const [instructors, setInstructors] = useState([]);
  const [studentGroups, setStudentGroups] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [groupInstructorsMap, setGroupInstructorsMap] = useState({});
  const [courseInstructorsMap, setCourseInstructorsMap] = useState({});
  const [loadingMetadata, setLoadingMetadata] = useState(true);

  // Existing schedules feed & search
  const [existingSchedules, setExistingSchedules] = useState([]);
  const [loadingSchedules, setLoadingSchedules] = useState(false);
  const [scheduleFilterGroup, setScheduleFilterGroup] = useState('all');
  const [visibleScheduleCount, setVisibleScheduleCount] = useState(15);

  // UI state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState(null); // { type: 'success' | 'error' | 'warning', message: '', details?: [] }
  const [showResultModal, setShowResultModal] = useState(false);
  const [submissionResult, setSubmissionResult] = useState(null);

  const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

  const colorOptions = [
    { label: 'Blue', value: 'blue', bg: 'bg-blue-500', text: 'text-blue-500' },
    { label: 'Emerald', value: 'green', bg: 'bg-emerald-500', text: 'text-emerald-500' },
    { label: 'Red', value: 'red', bg: 'bg-rose-500', text: 'text-rose-500' },
    { label: 'Orange', value: 'orange', bg: 'bg-orange-500', text: 'text-orange-500' },
    { label: 'Yellow', value: 'yellow', bg: 'bg-amber-400', text: 'text-amber-400' },
    { label: 'Teal', value: 'teal', bg: 'bg-teal-500', text: 'text-teal-500' },
    { label: 'Purple', value: 'purple', bg: 'bg-purple-500', text: 'text-purple-500' },
    { label: 'Pink', value: 'pink', bg: 'bg-pink-500', text: 'text-pink-500' },
    { label: 'Cyan', value: 'cyan', bg: 'bg-cyan-500', text: 'text-cyan-500' },
  ];

  // 1. Fetch metadata (Courses, Instructors, Student Groups, Rooms)
  const fetchMetadata = async () => {
    setLoadingMetadata(true);
    try {
      const meta = (await scheduleApi.getScheduleMetadata()) || {};

      const courseList = meta.courses || [];
      const instructorList = meta.instructors || [];
      const groupList = meta.student_groups || [];
      const roomList = meta.rooms || [];

      setCourses(courseList);
      setInstructors(instructorList);
      setStudentGroups(groupList);
      setRooms(roomList);
      setGroupInstructorsMap(meta.group_instructors || {});
      setCourseInstructorsMap(meta.course_instructors || {});

      const missing = [
        groupList.length === 0 && 'student groups',
        courseList.length === 0 && 'courses',
        instructorList.length === 0 && 'instructors',
        roomList.length === 0 && 'rooms',
      ].filter(Boolean);
      if (missing.length > 0) {
        setFeedback({ type: 'warning', message: `No ${missing.join(', ')} found in Frappe yet. Create them before generating schedules.` });
      }

      // Auto-select defaults
      if (groupList.length > 0 && !selectedStudentGroup) {
        setSelectedStudentGroup(groupList[0].name);
      }
      if (courseList.length > 0 && !selectedCourse) {
        setSelectedCourse(courseList[0].name);
      }
      if (instructorList.length > 0 && !selectedInstructor) {
        setSelectedInstructor(instructorList[0].name);
      }
      if (roomList.length > 0 && !selectedRoom) {
        setSelectedRoom(roomList[0].name);
      }
    } catch (err) {
      console.error('Failed to load scheduling metadata:', err);
      setFeedback({ type: 'error', message: err.message || 'Failed to load scheduling parameters from Frappe.' });
    } finally {
      setLoadingMetadata(false);
    }
  };

  // 2. Fetch Existing Schedules
  const fetchExistingSchedules = async () => {
    setLoadingSchedules(true);
    try {
      // Recent and upcoming lectures (last 7 days onwards)
      const from = new Date();
      from.setDate(from.getDate() - 7);
      const fromStr = `${from.getFullYear()}-${String(from.getMonth() + 1).padStart(2, '0')}-${String(from.getDate()).padStart(2, '0')}`;
      const data = await scheduleApi.getCourseSchedulesInRange({ program_name: 'all', from_date: fromStr });
      setExistingSchedules(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to load existing course schedules:', err);
      setExistingSchedules([]);
      setFeedback({ type: 'error', message: err.message || 'Failed to load existing course schedules from Frappe.' });
    } finally {
      setLoadingSchedules(false);
    }
  };

  useEffect(() => {
    fetchMetadata();
    fetchExistingSchedules();
  }, []);

  // When student group changes, auto-fill course, program, and academic context
  const currentGroupMeta = useMemo(() => {
    return studentGroups.find(g => g.name === selectedStudentGroup) || null;
  }, [studentGroups, selectedStudentGroup]);

  const handleGroupChange = (newGroupName) => {
    setSelectedStudentGroup(newGroupName);
    const grp = studentGroups.find(g => g.name === newGroupName);
    if (grp && grp.course) {
      setSelectedCourse(grp.course);
    }
  };

  const handleCourseChange = (newCourse) => {
    setSelectedCourse(newCourse);
    // If the active student group is course-based and does not teach newCourse,
    // auto-switch student group to the corresponding group for newCourse
    if (currentGroupMeta && currentGroupMeta.group_based_on === 'Course' && currentGroupMeta.course !== newCourse) {
      const match = studentGroups.find(g => 
        g.course === newCourse && (currentGroupMeta.program ? g.program === currentGroupMeta.program : true)
      ) || studentGroups.find(g => g.course === newCourse);

      if (match) {
        setSelectedStudentGroup(match.name);
      }
    }
  };

  // Selected instructor object
  const currentInstructorMeta = useMemo(() => {
    return instructors.find(i => i.name === selectedInstructor) || null;
  }, [instructors, selectedInstructor]);

  // Eligible instructors strictly filtered by selected Course / Subject
  const eligibleInstructors = useMemo(() => {
    if (!selectedCourse) {
      return instructors;
    }

    // 1. Priority 1: Match directly from course_instructors mapping
    const fromCourseMap = courseInstructorsMap[selectedCourse];
    if (fromCourseMap && fromCourseMap.length > 0) {
      return fromCourseMap;
    }

    // 2. Priority 2: If active student group is dedicated to this exact course
    if (currentGroupMeta && currentGroupMeta.course === selectedCourse) {
      const assigned = groupInstructorsMap[currentGroupMeta.name];
      if (assigned && assigned.length > 0) return assigned;
    }

    // 3. Instructors assigned to the selected batch group
    if (currentGroupMeta && groupInstructorsMap[currentGroupMeta.name]?.length > 0) {
      return groupInstructorsMap[currentGroupMeta.name];
    }

    return instructors;
  }, [selectedCourse, currentGroupMeta, courseInstructorsMap, groupInstructorsMap, instructors]);

  // Keep selectedInstructor in sync with eligible instructors
  useEffect(() => {
    if (eligibleInstructors.length > 0) {
      const isCurrentValid = eligibleInstructors.some(i => i.name === selectedInstructor);
      if (!isCurrentValid) {
        setSelectedInstructor(eligibleInstructors[0].name);
      }
    }
  }, [eligibleInstructors, selectedInstructor]);

  // Selected room object
  const currentRoomMeta = useMemo(() => {
    return rooms.find(r => r.name === selectedRoom) || null;
  }, [rooms, selectedRoom]);

  // Toggle Day Selection
  const toggleDay = (day) => {
    setSelectedDays(prev => 
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
    );
  };

  // Quick Preset Days
  const setDaysPreset = (preset) => {
    if (preset === 'weekdays') {
      setSelectedDays(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']);
    } else if (preset === 'mwf') {
      setSelectedDays(['Monday', 'Wednesday', 'Friday']);
    } else if (preset === 'tt') {
      setSelectedDays(['Tuesday', 'Thursday']);
    } else if (preset === 'all') {
      setSelectedDays([...daysOfWeek]);
    } else if (preset === 'clear') {
      setSelectedDays([]);
    }
  };

  // Quick Date Range Presets
  const setDateRangePreset = (months) => {
    const start = new Date();
    const end = new Date();
    end.setMonth(end.getMonth() + months);

    const fmt = (d) => {
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      return `${yyyy}-${mm}-${dd}`;
    };

    setCourseStartDate(fmt(start));
    setCourseEndDate(fmt(end));
  };

  // Quick Duration Presets for Time
  const setDurationPreset = (minutes) => {
    if (!fromTime) return;
    const [h, m] = fromTime.split(':').map(Number);
    const totalMinutes = h * 60 + m + minutes;
    const newH = Math.floor(totalMinutes / 60) % 24;
    const newM = totalMinutes % 60;
    setToTime(`${String(newH).padStart(2, '0')}:${String(newM).padStart(2, '0')}`);
  };

  // Calculate Projected Generated Schedules Count
  const projectedLectures = useMemo(() => {
    if (!courseStartDate || !courseEndDate || selectedDays.length === 0) return [];
    if (courseStartDate > courseEndDate) return [];

    const projected = [];
    // Parse as local dates ('YYYY-MM-DD' alone is parsed as UTC and can shift the weekday)
    const curr = new Date(`${courseStartDate}T00:00:00`);
    const end = new Date(`${courseEndDate}T00:00:00`);

    // Limit preview loop to 100 entries to keep it ultra snappy
    while (curr <= end && projected.length < 150) {
      const dayName = daysOfWeek[(curr.getDay() + 6) % 7]; // Convert JS Sunday=0 to Monday=0
      if (selectedDays.includes(dayName)) {
        const yyyy = curr.getFullYear();
        const mm = String(curr.getMonth() + 1).padStart(2, '0');
        const dd = String(curr.getDate()).padStart(2, '0');
        projected.push({
          date: `${yyyy}-${mm}-${dd}`,
          day: dayName,
        });
      }
      curr.setDate(curr.getDate() + 1);
    }
    return projected;
  }, [courseStartDate, courseEndDate, selectedDays]);

  // Submit Handler: Bulk Course Schedule
  const handleScheduleCourses = async () => {
    setFeedback(null);

    // Validation
    if (!selectedStudentGroup) {
      setFeedback({ type: 'warning', message: 'Please select a Student Group.' });
      return;
    }
    if (!selectedCourse) {
      setFeedback({ type: 'warning', message: 'Please select a Course / Subject.' });
      return;
    }
    if (!selectedInstructor) {
      setFeedback({ type: 'warning', message: 'Please select an Instructor.' });
      return;
    }
    if (eligibleInstructors.length > 0 && !eligibleInstructors.some(i => i.name === selectedInstructor)) {
      setFeedback({
        type: 'error',
        message: `Faculty ${selectedInstructor} is not qualified or assigned to teach ${selectedCourse}.`,
      });
      return;
    }
    if (!selectedRoom) {
      setFeedback({ type: 'warning', message: 'Please select a Room / Classroom.' });
      return;
    }
    if (!fromTime || !toTime) {
      setFeedback({ type: 'warning', message: 'From Time and To Time are required.' });
      return;
    }
    if (fromTime >= toTime) {
      setFeedback({ type: 'warning', message: 'To Time must be later than From Time.' });
      return;
    }
    if (!courseStartDate || !courseEndDate) {
      setFeedback({ type: 'warning', message: 'Please specify Course Start Date and End Date.' });
      return;
    }
    if (courseStartDate > courseEndDate) {
      setFeedback({ type: 'warning', message: 'Course Start Date cannot be later than Course End Date.' });
      return;
    }
    if (selectedDays.length === 0) {
      setFeedback({ type: 'warning', message: 'Please select at least one day of the week to schedule.' });
      return;
    }

    setIsSubmitting(true);

    try {
      const payload = {
        student_group: selectedStudentGroup,
        course: selectedCourse,
        instructor: selectedInstructor,
        room: selectedRoom,
        course_start_date: courseStartDate,
        course_end_date: courseEndDate,
        from_time: fromTime.length === 5 ? `${fromTime}:00` : fromTime,
        to_time: toTime.length === 5 ? `${toTime}:00` : toTime,
        days: selectedDays,
        reschedule: reschedule ? 1 : 0,
        class_schedule_color: scheduleColor,
      };

      const res = await scheduleApi.bulkScheduleCourse(payload);

      setSubmissionResult(res);
      setShowResultModal(true);
      if (res.created_count > 0) {
        const reschedNote = res.rescheduled_count > 0 ? ` (${res.rescheduled_count} existing slot${res.rescheduled_count === 1 ? '' : 's'} replaced)` : '';
        const errNote = res.errors_count > 0
          ? ` ${res.errors_count} date${res.errors_count === 1 ? ' was' : 's were'} skipped: ${res.errors.map((er) => `${er.date} – ${er.error}`).join('; ')}`
          : '';
        setFeedback({
          type: res.errors_count > 0 ? 'warning' : 'success',
          message: `${res.created_count} course schedule${res.created_count === 1 ? '' : 's'} created successfully!${reschedNote}${errNote}`,
        });
      } else if (res.errors && res.errors.length > 0) {
        setFeedback({
          type: 'error',
          message: `Could not generate schedules: ${res.errors.map((er) => `${er.date} – ${er.error}`).join('; ')}`,
        });
      } else {
        setFeedback({
          type: 'info',
          message: 'All selected lecture dates already exist in the schedule.',
        });
      }

      // Refresh existing schedules feed
      await fetchExistingSchedules();
    } catch (err) {
      console.error('Failed to schedule courses:', err);
      setFeedback({
        type: 'error',
        message: err.message || 'An error occurred while generating course schedules in Frappe.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete Individual Schedule
  const handleDeleteSchedule = async (scheduleId) => {
    if (!window.confirm(`Are you sure you want to cancel lecture schedule ${scheduleId}?`)) return;

    try {
      await scheduleApi.deleteCourseSchedule(scheduleId);
      setFeedback({ type: 'info', message: `Lecture schedule ${scheduleId} was cancelled.` });
      await fetchExistingSchedules();
    } catch (err) {
      setFeedback({ type: 'error', message: err.message || 'Cannot cancel schedule with submitted attendance.' });
    }
  };

  // Filtered existing schedules
  const displayedExistingSchedules = useMemo(() => {
    if (scheduleFilterGroup === 'all') return existingSchedules;
    return existingSchedules.filter(s => s.student_group === scheduleFilterGroup);
  }, [existingSchedules, scheduleFilterGroup]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-24 animate-in fade-in duration-300">
      {/* 1. Header Hero Panel */}
      <div className="p-5 sm:p-8 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 relative z-10">
          <div className="space-y-2 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => navigate('/reports-tools')}
                className="inline-flex items-center gap-1.5 px-2.5 py-2 sm:py-1 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs font-semibold transition"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Reports &amp; Tools</span>
              </button>
              <span className="text-slate-300 dark:text-slate-700">•</span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/70 text-blue-700 dark:text-blue-300 border border-blue-200/60 dark:border-blue-800 text-[11px] font-bold">
                <FileCheck2 className="w-3 h-3" />
                DocType: Course Scheduling Tool
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-slate-100 tracking-tight flex items-center gap-2 sm:gap-3">
              <CalendarPlus className="w-7 h-7 sm:w-8 sm:h-8 shrink-0 text-blue-600 dark:text-blue-400" />
              <span>Course Scheduling Tool</span>
            </h1>

            <p className="text-sm text-slate-500 dark:text-slate-400 max-w-2xl leading-relaxed">
              Automated bulk timetable &amp; lecture generator. Select your cohort, subject, instructor, and classroom to generate recurring lectures across date ranges with live conflict checks and 1-click Frappe sync.
            </p>
          </div>
        </div>
      </div>

      {/* 2. Feedback Banners */}
      {feedback && (
        <div className={`p-4 rounded-2xl border flex items-start gap-3 animate-in fade-in duration-200 ${
          feedback.type === 'success' 
            ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200' 
            : feedback.type === 'warning'
            ? 'bg-amber-50 dark:bg-amber-950/60 border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200'
            : feedback.type === 'info'
            ? 'bg-blue-50 dark:bg-blue-950/60 border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-200'
            : 'bg-rose-50 dark:bg-rose-950/60 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200'
        }`}>
          {feedback.type === 'success' && <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-600 dark:text-emerald-400 mt-0.5" />}
          {feedback.type === 'warning' && <AlertCircle className="w-5 h-5 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />}
          {feedback.type === 'info' && <Info className="w-5 h-5 shrink-0 text-blue-600 dark:text-blue-400 mt-0.5" />}
          {feedback.type === 'error' && <AlertCircle className="w-5 h-5 shrink-0 text-rose-600 dark:text-rose-400 mt-0.5" />}
          <div className="flex-1 min-w-0 text-xs font-semibold leading-relaxed break-words">
            {feedback.message}
          </div>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="shrink-0 w-8 h-8 -mt-1.5 -mr-1.5 flex items-center justify-center rounded-lg text-xs font-bold opacity-60 hover:opacity-100"
          >
            ✕
          </button>
        </div>
      )}

      {/* 3. Main Configuration Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Form Parameters */}
        <div className="lg:col-span-2 space-y-6">
          <div className="p-4 sm:p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-4 border-b border-slate-100 dark:border-slate-800">
              <h2 className="text-sm font-extrabold text-slate-900 dark:text-slate-100 uppercase tracking-wider flex items-center gap-2">
                <Layers className="w-4 h-4 text-blue-600" />
                <span>Classroom &amp; Cohort Setup</span>
              </h2>
              {currentGroupMeta && (
                <span className="text-[11px] font-semibold text-slate-500 font-mono break-words min-w-0">
                  {[currentGroupMeta.program, currentGroupMeta.academic_year].filter(Boolean).join(' • ') || '—'}
                </span>
              )}
            </div>

            {/* Row 1: Student Group & Course */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex flex-wrap items-center justify-between gap-x-2 gap-y-0.5">
                  <span>Student Group <span className="text-rose-500">*</span></span>
                  {currentGroupMeta?.group_based_on && (
                    <span className="text-[11px] text-slate-400">
                      Based on {currentGroupMeta.group_based_on}
                    </span>
                  )}
                </label>
                <select
                  value={selectedStudentGroup}
                  onChange={(e) => handleGroupChange(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                >
                  {studentGroups.map((g) => (
                    <option key={g.name} value={g.name}>
                      {g.student_group_name || g.name} {g.program ? `(${g.program})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Course / Subject <span className="text-rose-500">*</span>
                </label>
                <select
                  value={selectedCourse}
                  onChange={(e) => handleCourseChange(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                >
                  {courses.map((c) => (
                    <option key={c.name} value={c.name}>
                      {c.course_name || c.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Row 2: Instructor & Room */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Instructor / Faculty <span className="text-rose-500">*</span>
                  </label>
                  {eligibleInstructors.length === 1 && (
                    <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
                      Assigned Subject Faculty
                    </span>
                  )}
                </div>
                <select
                  value={selectedInstructor}
                  onChange={(e) => setSelectedInstructor(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                >
                  {eligibleInstructors.map((i) => (
                    <option key={i.name} value={i.name}>
                      {i.instructor_name || i.name}
                    </option>
                  ))}
                </select>
                {eligibleInstructors.length === 0 && (
                  <p className="text-[11px] text-rose-500 font-medium">
                    No faculty assigned to teach {selectedCourse || 'this subject'}.
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex flex-wrap items-center justify-between gap-x-2 gap-y-0.5">
                  <span>Room / Classroom <span className="text-rose-500">*</span></span>
                  {currentRoomMeta?.seating_capacity && (
                    <span className="text-[11px] text-slate-400 font-mono">
                      Cap: {currentRoomMeta.seating_capacity} seats
                    </span>
                  )}
                </label>
                <select
                  value={selectedRoom}
                  onChange={(e) => setSelectedRoom(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                >
                  {rooms.map((r) => (
                    <option key={r.name} value={r.name}>
                      {r.room_name || r.name} {r.seating_capacity ? `(${r.seating_capacity} seats)` : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Row 3: Time Slots & Presets */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-100 dark:border-slate-800">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex flex-wrap items-center justify-between gap-x-2 gap-y-0.5">
                  <span>From Time <span className="text-rose-500">*</span></span>
                  <span className="text-[11px] text-slate-400">Class starts</span>
                </label>
                <input
                  type="time"
                  value={fromTime}
                  onChange={(e) => setFromTime(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex flex-wrap items-center justify-between gap-x-2 gap-y-0.5">
                  <span>To Time <span className="text-rose-500">*</span></span>
                  <span className="text-[11px] text-slate-400">Class ends</span>
                </label>
                <input
                  type="time"
                  value={toTime}
                  onChange={(e) => setToTime(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-mono"
                />
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  <span className="text-[11px] text-slate-400">Duration:</span>
                  <button
                    type="button"
                    onClick={() => setDurationPreset(45)}
                    className="px-2.5 py-1.5 sm:px-2 sm:py-0.5 rounded-md bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-[11px] font-bold text-slate-600 dark:text-slate-300 transition"
                  >
                    45m
                  </button>
                  <button
                    type="button"
                    onClick={() => setDurationPreset(60)}
                    className="px-2.5 py-1.5 sm:px-2 sm:py-0.5 rounded-md bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-[11px] font-bold text-slate-600 dark:text-slate-300 transition"
                  >
                    1 hr
                  </button>
                  <button
                    type="button"
                    onClick={() => setDurationPreset(90)}
                    className="px-2.5 py-1.5 sm:px-2 sm:py-0.5 rounded-md bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-[11px] font-bold text-slate-600 dark:text-slate-300 transition"
                  >
                    1.5 hr
                  </button>
                </div>
              </div>
            </div>

            {/* Row 4: Date Range & Presets */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-100 dark:border-slate-800">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Course Start Date <span className="text-rose-500">*</span>
                </label>
                <input
                  type="date"
                  value={courseStartDate}
                  onChange={(e) => setCourseStartDate(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Course End Date <span className="text-rose-500">*</span>
                </label>
                <input
                  type="date"
                  value={courseEndDate}
                  onChange={(e) => setCourseEndDate(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-mono"
                />
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  <span className="text-[11px] text-slate-400">Quick Range:</span>
                  <button
                    type="button"
                    onClick={() => setDateRangePreset(1)}
                    className="px-2.5 py-1.5 sm:px-2 sm:py-0.5 rounded-md bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-[11px] font-bold text-slate-600 dark:text-slate-300 transition"
                  >
                    1 Month
                  </button>
                  <button
                    type="button"
                    onClick={() => setDateRangePreset(3)}
                    className="px-2.5 py-1.5 sm:px-2 sm:py-0.5 rounded-md bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-[11px] font-bold text-slate-600 dark:text-slate-300 transition"
                  >
                    3 Months
                  </button>
                  <button
                    type="button"
                    onClick={() => setDateRangePreset(6)}
                    className="px-2.5 py-1.5 sm:px-2 sm:py-0.5 rounded-md bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-[11px] font-bold text-slate-600 dark:text-slate-300 transition"
                  >
                    6 Months
                  </button>
                </div>
              </div>
            </div>

            {/* Row 5: Days of the Week Selection */}
            <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <CalendarCheck className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                  <span>Scheduled Days of the Week <span className="text-rose-500">*</span></span>
                </label>
                <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                  <button
                    type="button"
                    onClick={() => setDaysPreset('weekdays')}
                    className="px-2.5 py-1.5 sm:px-2 sm:py-0.5 rounded-md bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 font-bold text-slate-600 dark:text-slate-400 transition"
                  >
                    Mon-Fri
                  </button>
                  <button
                    type="button"
                    onClick={() => setDaysPreset('mwf')}
                    className="px-2.5 py-1.5 sm:px-2 sm:py-0.5 rounded-md bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 font-bold text-slate-600 dark:text-slate-400 transition"
                  >
                    MWF
                  </button>
                  <button
                    type="button"
                    onClick={() => setDaysPreset('all')}
                    className="px-2.5 py-1.5 sm:px-2 sm:py-0.5 rounded-md bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 font-bold text-slate-600 dark:text-slate-400 transition"
                  >
                    All
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
                {daysOfWeek.map((day) => {
                  const isChecked = selectedDays.includes(day);
                  return (
                    <button
                      key={day}
                      type="button"
                      onClick={() => toggleDay(day)}
                      className={`py-2 px-2.5 rounded-2xl text-xs font-bold transition flex items-center justify-between border ${
                        isChecked
                          ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                          : 'bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 border-slate-200/80 dark:border-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      <span className="truncate">{day.substring(0, 3)}</span>
                      {isChecked && <Check className="w-3.5 h-3.5 shrink-0" />}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Row 6: Color Badge & Reschedule Toggle */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-100 dark:border-slate-800">
              {/* Color Theme Selector */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Palette className="w-3.5 h-3.5 text-blue-600" />
                  <span>Timetable Badge Color</span>
                </label>
                <div className="flex items-center gap-2 flex-wrap">
                  {colorOptions.map((c) => (
                    <button
                      key={c.value}
                      type="button"
                      onClick={() => setScheduleColor(c.value)}
                      className={`w-9 h-9 sm:w-7 sm:h-7 rounded-full ${c.bg} flex items-center justify-center transition-transform ${
                        scheduleColor === c.value ? 'ring-4 ring-blue-500/30 scale-110' : 'opacity-70 hover:opacity-100'
                      }`}
                      title={c.label}
                    >
                      {scheduleColor === c.value && <Check className="w-4 h-4 text-white" />}
                    </button>
                  ))}
                </div>
              </div>

              {/* Reschedule Toggle */}
              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60 flex items-start gap-3">
                <input
                  type="checkbox"
                  id="reschedule-check"
                  checked={reschedule}
                  onChange={(e) => setReschedule(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300 dark:border-slate-700"
                />
                <label htmlFor="reschedule-check" className="text-xs space-y-0.5 cursor-pointer">
                  <span className="font-bold text-slate-800 dark:text-slate-200 block">
                    Reschedule (replace existing slots)
                  </span>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 block leading-tight">
                    Deletes this group's existing lectures of the selected course in this date range on the selected days (lectures with attendance are kept), then creates the new ones.
                  </span>
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* Right 1 Col: Live Preview & Action Card */}
        <div className="space-y-6">
          <div className="p-4 sm:p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-5 lg:sticky lg:top-24">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-[11px] uppercase font-bold text-slate-400 tracking-wider">
                  Scheduling Projection
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/70 text-blue-700 dark:text-blue-300 text-[11px] font-bold">
                  <Sparkles className="w-3 h-3" />
                  Live Preview
                </span>
              </div>
              <h3 className="text-xl font-black text-slate-900 dark:text-slate-100 flex flex-wrap items-baseline gap-x-2">
                <span className="text-3xl text-blue-600 dark:text-blue-400 font-mono">
                  {projectedLectures.length}
                </span>
                <span>Lectures to Generate</span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Between <strong className="font-mono">{courseStartDate}</strong> and <strong className="font-mono">{courseEndDate}</strong>
              </p>
            </div>

            {/* Parameter Summary */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60 space-y-2 text-xs">
              <div className="flex justify-between gap-3 min-w-0">
                <span className="text-slate-500">Group:</span>
                <strong className="text-slate-900 dark:text-slate-100 font-mono text-right truncate max-w-[150px]">
                  {selectedStudentGroup}
                </strong>
              </div>
              <div className="flex justify-between gap-3 min-w-0">
                <span className="text-slate-500">Subject:</span>
                <strong className="text-slate-900 dark:text-slate-100 font-mono text-right truncate min-w-0" title={selectedCourse}>{selectedCourse}</strong>
              </div>
              <div className="flex justify-between gap-3 min-w-0">
                <span className="text-slate-500">Time:</span>
                <strong className="text-slate-900 dark:text-slate-100 font-mono whitespace-nowrap">{fromTime} – {toTime}</strong>
              </div>
              <div className="flex justify-between gap-3 min-w-0">
                <span className="text-slate-500">Room:</span>
                <strong className="text-slate-900 dark:text-slate-100 font-mono text-right truncate min-w-0" title={selectedRoom}>{selectedRoom}</strong>
              </div>
              <div className="flex justify-between gap-3 min-w-0">
                <span className="text-slate-500">Instructor:</span>
                <strong className="text-slate-900 dark:text-slate-100 font-mono truncate max-w-[150px]">
                  {currentInstructorMeta?.instructor_name || selectedInstructor}
                </strong>
              </div>
            </div>

            {/* Mini Projected Calendar Dates */}
            {projectedLectures.length > 0 && (
              <div className="space-y-1.5">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                  Upcoming Generated Slots (Preview):
                </span>
                <div className="max-h-36 overflow-y-auto space-y-1 pr-1">
                  {projectedLectures.slice(0, 10).map((p, idx) => (
                    <div 
                      key={idx}
                      className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 text-[11px] flex items-center justify-between"
                    >
                      <span className="font-mono text-slate-800 dark:text-slate-200 font-bold">{p.date}</span>
                      <span className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-950/60">
                        {p.day}
                      </span>
                    </div>
                  ))}
                  {projectedLectures.length > 10 && (
                    <p className="text-[11px] text-center text-slate-400 pt-1">
                      + {projectedLectures.length - 10} more dates
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Primary Action Button */}
            <button
              type="button"
              onClick={handleScheduleCourses}
              disabled={isSubmitting}
              className="w-full py-3.5 px-4 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-black text-xs shadow-lg shadow-blue-600/25 transition active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Scheduling Lectures...</span>
                </>
              ) : (
                <>
                  <CalendarPlus className="w-4 h-4" />
                  <span>Generate Course Schedules</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* 4. Existing Schedules List & Management */}
      <div className="p-4 sm:p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="space-y-0.5 min-w-0">
            <h3 className="text-sm font-extrabold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-blue-600" />
              <span>Active Course Schedules in Frappe</span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              View and manage created lecture schedules across all student cohorts.
            </p>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <select
              value={scheduleFilterGroup}
              onChange={(e) => { setScheduleFilterGroup(e.target.value); setVisibleScheduleCount(15); }}
              className="w-full sm:w-auto min-w-0 px-3 py-2 sm:py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300"
            >
              <option value="all">All Cohorts ({existingSchedules.length})</option>
              {studentGroups.map(g => (
                <option key={g.name} value={g.name}>{g.student_group_name || g.name}</option>
              ))}
            </select>
          </div>
        </div>

        {loadingSchedules ? (
          <div className="p-8 text-center text-xs text-slate-400">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-600" />
            Loading schedules...
          </div>
        ) : displayedExistingSchedules.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-400">
            No course schedules found for this filter.
          </div>
        ) : (
          <div className="overflow-x-auto -mx-4 sm:mx-0">
            <table className="w-full min-w-[760px] text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200/80 dark:border-slate-800 text-[11px] uppercase font-bold text-slate-400">
                  <th className="py-3 px-4">Schedule ID</th>
                  <th className="py-3 px-4">Subject</th>
                  <th className="py-3 px-4">Student Group</th>
                  <th className="py-3 px-4">Date &amp; Time</th>
                  <th className="py-3 px-4">Instructor</th>
                  <th className="py-3 px-4">Room</th>
                  <th className="py-3 px-4 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                {displayedExistingSchedules.slice(0, visibleScheduleCount).map((cs) => (
                  <tr key={cs.name} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition">
                    <td className="py-3 px-4 font-mono font-bold text-blue-600 dark:text-blue-400">
                      {cs.name}
                    </td>
                    <td className="py-3 px-4 font-bold text-slate-900 dark:text-slate-100">
                      {cs.course}
                    </td>
                    <td className="py-3 px-4 text-slate-600 dark:text-slate-300">
                      {cs.student_group}
                    </td>
                    <td className="py-3 px-4 font-mono">
                      <span className="font-bold text-slate-800 dark:text-slate-200 block">
                        {cs.schedule_date}
                      </span>
                      <span className="text-[11px] text-slate-400">
                        {cs.from_time ? String(cs.from_time).substring(0, 5) : ''} – {cs.to_time ? String(cs.to_time).substring(0, 5) : ''}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-600 dark:text-slate-300">
                      {cs.instructor_name || cs.instructor}
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-mono text-[11px]">
                        {cs.room || 'Room'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <button
                        type="button"
                        onClick={() => handleDeleteSchedule(cs.name)}
                        className="p-2 sm:p-1.5 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/60 text-slate-400 hover:text-rose-600 transition"
                        title="Cancel Lecture Schedule"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {displayedExistingSchedules.length > visibleScheduleCount && (
              <div className="pt-3 text-center">
                <button
                  type="button"
                  onClick={() => setVisibleScheduleCount((n) => n + 30)}
                  className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300"
                >
                  Show more ({displayedExistingSchedules.length - visibleScheduleCount} remaining)
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 5. Result Confirmation Modal */}
      {showResultModal && submissionResult && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-5 sm:p-6 border border-slate-200 dark:border-slate-800 shadow-2xl space-y-5 animate-in fade-in zoom-in-95">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mx-auto ${
              submissionResult.created_count > 0
                ? 'bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400'
                : 'bg-amber-50 dark:bg-amber-950 text-amber-600 dark:text-amber-400'
            }`}>
              {submissionResult.created_count > 0 ? <CheckCircle2 className="w-6 h-6" /> : <AlertCircle className="w-6 h-6" />}
            </div>

            <div className="text-center space-y-1">
              <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-slate-100">
                {submissionResult.created_count > 0
                  ? (submissionResult.errors_count > 0 ? 'Course Schedules Partially Generated' : 'Course Schedules Generated Successfully!')
                  : 'No Course Schedules Generated'}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Frappe backend created <strong>{submissionResult.created_count || 0}</strong> lecture entries in DocType <code className="font-mono bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded">Course Schedule</code>.
              </p>
            </div>

            {/* Result Table Preview */}
            <div className="max-h-48 overflow-auto rounded-2xl border border-slate-200/80 dark:border-slate-800">
              <table className="w-full min-w-[420px] text-left text-xs border-collapse">
                <thead className="bg-slate-50 dark:bg-slate-800 text-[11px] uppercase font-bold text-slate-400 sticky top-0">
                  <tr>
                    <th className="py-2 px-3">Date</th>
                    <th className="py-2 px-3">Day</th>
                    <th className="py-2 px-3">Subject</th>
                    <th className="py-2 px-3">Schedule ID</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {(submissionResult.created || []).map((c, i) => (
                    <tr key={i} className="hover:bg-slate-50/50">
                      <td className="py-2 px-3 font-mono font-bold">{c.schedule_date}</td>
                      <td className="py-2 px-3 text-slate-500">{c.day}</td>
                      <td className="py-2 px-3">{c.course}</td>
                      <td className="py-2 px-3 font-mono text-blue-600 dark:text-blue-400">{c.name}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {(submissionResult.errors || []).length > 0 && (
              <div className="space-y-1.5 text-left">
                <span className="text-[11px] font-bold text-rose-500 uppercase tracking-wider block">
                  Not scheduled ({submissionResult.errors.length}):
                </span>
                <ul className="max-h-40 overflow-y-auto p-2.5 rounded-xl bg-rose-50/60 dark:bg-rose-950/30 border border-rose-200/60 dark:border-rose-900/40 text-[11px] text-rose-700 dark:text-rose-300 space-y-1">
                  {submissionResult.errors.map((er, i) => (
                    <li key={i} className="break-words">
                      <strong className="font-mono">{er.date}</strong> ({er.day}): {er.error}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {((submissionResult.rescheduled || []).length > 0 || (submissionResult.reschedule_errors || []).length > 0) && (
              <div className="p-2.5 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200/60 dark:border-blue-800 text-[11px] text-blue-800 dark:text-blue-200 space-y-1 text-left break-words">
                {(submissionResult.rescheduled || []).length > 0 && (
                  <p>Replaced {submissionResult.rescheduled.length} existing slot(s): {submissionResult.rescheduled.join(', ')}</p>
                )}
                {(submissionResult.reschedule_errors || []).map((m, i) => <p key={i}>{m}</p>)}
              </div>
            )}

            <div className="pt-2">
              <button
                type="button"
                onClick={() => setShowResultModal(false)}
                className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition shadow-md shadow-blue-600/25"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
