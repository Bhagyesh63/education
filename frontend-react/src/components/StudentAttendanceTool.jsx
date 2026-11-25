import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  UserCheck, 
  Users, 
  Calendar, 
  Clock, 
  Search, 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  ArrowLeft, 
  RefreshCw, 
  CheckCheck, 
  Layers, 
  CalendarDays, 
  LayoutGrid, 
  Table as TableIcon,
  Sparkles,
  ShieldAlert,
  ChevronDown,
  Info,
  CalendarCheck2,
  FileCheck2,
  RotateCcw,
  BookOpen,
  User,
  GraduationCap
} from 'lucide-react';
import { attendanceApi } from '../api/attendance';
import { useAuth } from '../context/AuthContext';

export default function StudentAttendanceTool() {
  const navigate = useNavigate();
  const { isStaff, isAdmin } = useAuth();

  // Helper for today's date formatted as YYYY-MM-DD
  const getTodayDate = () => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  const shiftDate = (days) => {
    const d = new Date();
    d.setDate(d.getDate() + days);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  // Configuration & Tool parameters (matching Frappe DocType "Student Attendance Tool")
  const [basedOn, setBasedOn] = useState('Student Group'); // 'Student Group' | 'Course Schedule'
  const [groupBasedOn, setGroupBasedOn] = useState('Batch'); // 'Batch' | 'Course' | 'Activity'
  const [selectedStudentGroup, setSelectedStudentGroup] = useState('');
  const [selectedCourseSchedule, setSelectedCourseSchedule] = useState('');
  const [attendanceDate, setAttendanceDate] = useState(getTodayDate());

  // Master lists
  const [studentGroups, setStudentGroups] = useState([]);
  const [courseSchedules, setCourseSchedules] = useState([]);
  const [loadingMetadata, setLoadingMetadata] = useState(true);

  // Active roster data
  const [roster, setRoster] = useState([]); // [{ student, student_name, group_roll_number, status, on_leave, leave_reason, leave_id, attendance_id }]
  const [attendanceMap, setAttendanceMap] = useState({}); // { [student_id]: 'Present' | 'Absent' | 'Leave' }
  const [initialAttendanceMap, setInitialAttendanceMap] = useState({});
  const [loadingRoster, setLoadingRoster] = useState(false);

  // UI state
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTab, setFilterTab] = useState('all'); // 'all' | 'present' | 'absent' | 'leave' | 'unmarked'
  const [viewMode, setViewMode] = useState('grid'); // 'grid' | 'table'
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState(null); // { type: 'success' | 'error' | 'warning', message: '' }

  // 1. Fetch metadata (Student Groups & Course Schedules)
  const fetchMetadata = async () => {
    setLoadingMetadata(true);
    try {
      const [groupsData, schedulesData] = await Promise.all([
        attendanceApi.getAllStudentGroups(),
        // Lectures of the last 30 days up to today (attendance cannot be marked for future lectures)
        attendanceApi.getCourseSchedulesForTool('all', shiftDate(-30), getTodayDate()).catch(() => []),
      ]);

      const groups = Array.isArray(groupsData) ? groupsData : [];
      setStudentGroups(groups);

      const schedules = Array.isArray(schedulesData) ? schedulesData : [];
      setCourseSchedules(schedules);

      // Auto-select first student group if not already set
      if (groups.length > 0 && !selectedStudentGroup) {
        // Prefer one matching group_based_on default 'Batch' or standard
        const defaultGroup = groups.find(g => g.group_based_on === 'Batch') || groups[0];
        setSelectedStudentGroup(defaultGroup.name);
      }

      // If schedules available, pick first as default if user toggles to Course Schedule
      if (schedules.length > 0 && !selectedCourseSchedule) {
        const todays = schedules.find(cs => cs.schedule_date === getTodayDate());
        setSelectedCourseSchedule((todays || schedules[schedules.length - 1]).name);
      }
    } catch (err) {
      console.error('Failed to load attendance tool metadata:', err);
      setFeedback({ type: 'error', message: 'Failed to fetch student groups or course schedules.' });
    } finally {
      setLoadingMetadata(false);
    }
  };

  useEffect(() => {
    if (isStaff) fetchMetadata();
  }, [isStaff]);

  // Filtered student groups based on `groupBasedOn`
  const filteredStudentGroups = useMemo(() => {
    if (!groupBasedOn) return studentGroups;
    const filtered = studentGroups.filter(g => g.group_based_on === groupBasedOn);
    return filtered.length > 0 ? filtered : studentGroups;
  }, [studentGroups, groupBasedOn]);

  // Selected Student Group metadata
  const currentGroupMeta = useMemo(() => {
    if (basedOn === 'Course Schedule') {
      const schedule = courseSchedules.find(cs => cs.name === selectedCourseSchedule);
      if (schedule && schedule.student_group) {
        return studentGroups.find(g => g.name === schedule.student_group) || {
          name: schedule.student_group,
          academic_year: schedule.academic_year || null,
          program: schedule.program || null,
        };
      }
    }
    return studentGroups.find(g => g.name === selectedStudentGroup) || null;
  }, [basedOn, selectedCourseSchedule, selectedStudentGroup, courseSchedules, studentGroups]);

  // Selected Course Schedule object
  const currentScheduleMeta = useMemo(() => {
    if (basedOn !== 'Course Schedule') return null;
    return courseSchedules.find(cs => cs.name === selectedCourseSchedule) || null;
  }, [basedOn, selectedCourseSchedule, courseSchedules]);

  // When Course Schedule changes, sync its schedule_date and student_group
  useEffect(() => {
    if (basedOn === 'Course Schedule' && currentScheduleMeta) {
      if (currentScheduleMeta.schedule_date) {
        setAttendanceDate(currentScheduleMeta.schedule_date);
      }
      if (currentScheduleMeta.student_group) {
        setSelectedStudentGroup(currentScheduleMeta.student_group);
        const grp = studentGroups.find(g => g.name === currentScheduleMeta.student_group);
        if (grp?.group_based_on) setGroupBasedOn(grp.group_based_on);
      }
    }
  }, [basedOn, currentScheduleMeta, studentGroups]);

  // 2. Fetch Roster when inputs change
  const fetchRoster = async ({ keepFeedback = false } = {}) => {
    const targetGroup = basedOn === 'Student Group' 
      ? selectedStudentGroup 
      : (currentScheduleMeta?.student_group || selectedStudentGroup);

    if (!targetGroup && !selectedCourseSchedule) {
      setRoster([]);
      setAttendanceMap({});
      return;
    }

    setLoadingRoster(true);
    if (!keepFeedback) setFeedback(null);

    try {
      // Validate date cannot be future
      const todayStr = getTodayDate();
      if (attendanceDate > todayStr) {
        setFeedback({ 
          type: 'warning', 
          message: 'Cannot mark attendance for future dates. Please select today or an earlier date.' 
        });
        setRoster([]);
        setLoadingRoster(false);
        return;
      }

      // Fetch attendance roster with leave data & existing attendance status
      const data = await attendanceApi.getAttendanceRoster(
        targetGroup,
        attendanceDate,
        basedOn === 'Course Schedule' ? selectedCourseSchedule : null
      );

      const studentList = Array.isArray(data) ? data : [];
      setRoster(studentList);

      // Initialize status mapping
      const initialMap = {};
      studentList.forEach(s => {
        // Default to recorded status if exists, else if on leave mark 'Leave', else default 'Present'
        if (s.status) {
          initialMap[s.student] = s.status;
        } else if (s.on_leave) {
          initialMap[s.student] = 'Leave';
        } else {
          initialMap[s.student] = 'Present'; // Standard default in Frappe attendance tool
        }
      });

      setAttendanceMap(initialMap);
      setInitialAttendanceMap({ ...initialMap });
    } catch (err) {
      console.error('Failed to load student roster:', err);
      setFeedback({ type: 'error', message: err.message || 'Failed to load attendance records for this group.' });
      setRoster([]);
    } finally {
      setLoadingRoster(false);
    }
  };

  useEffect(() => {
    if (!isStaff) return;
    if (selectedStudentGroup || (basedOn === 'Course Schedule' && selectedCourseSchedule)) {
      fetchRoster();
    }
  }, [basedOn, selectedStudentGroup, selectedCourseSchedule, attendanceDate]);

  // 3. Batch Action Handlers
  const handleMarkAllPresent = () => {
    const updated = { ...attendanceMap };
    roster.forEach(s => {
      // Don't overwrite if on approved leave unless user intends to
      if (!s.on_leave) {
        updated[s.student] = 'Present';
      }
    });
    setAttendanceMap(updated);
  };

  const handleMarkAllAbsent = () => {
    const updated = { ...attendanceMap };
    roster.forEach(s => {
      if (!s.on_leave) {
        updated[s.student] = 'Absent';
      }
    });
    setAttendanceMap(updated);
  };

  const handleInvertStatus = () => {
    const updated = { ...attendanceMap };
    roster.forEach(s => {
      if (!s.on_leave) {
        const cur = updated[s.student];
        updated[s.student] = cur === 'Present' ? 'Absent' : 'Present';
      }
    });
    setAttendanceMap(updated);
  };

  const handleResetToSaved = () => {
    setAttendanceMap({ ...initialAttendanceMap });
    setFeedback({ type: 'info', message: 'Restored attendance to previously saved database state.' });
  };

  const handleToggleStudent = (studentId, targetStatus) => {
    setAttendanceMap(prev => ({
      ...prev,
      [studentId]: targetStatus,
    }));
  };

  // 4. Statistics calculation
  const stats = useMemo(() => {
    const total = roster.length;
    let presentCount = 0;
    let absentCount = 0;
    let leaveCount = 0;
    let unmarkedCount = 0;

    roster.forEach(s => {
      const st = attendanceMap[s.student];
      if (st === 'Present') presentCount++;
      else if (st === 'Absent') absentCount++;
      else if (st === 'Leave') leaveCount++;
      else unmarkedCount++;
    });

    const presentPct = total > 0 ? Math.round((presentCount / total) * 100) : 0;
    const absentPct = total > 0 ? Math.round((absentCount / total) * 100) : 0;
    const leavePct = total > 0 ? Math.round((leaveCount / total) * 100) : 0;

    const isDirty = roster.some(s => attendanceMap[s.student] !== initialAttendanceMap[s.student]);
    const hasExistingAttendance = roster.some(s => Boolean(s.status || s.attendance_id));

    return {
      total,
      presentCount,
      absentCount,
      leaveCount,
      unmarkedCount,
      presentPct,
      absentPct,
      leavePct,
      isDirty,
      hasExistingAttendance,
    };
  }, [roster, attendanceMap, initialAttendanceMap]);

  // 5. Filtered & Searched Roster
  const displayedStudents = useMemo(() => {
    return roster.filter(s => {
      // Search text filter
      const q = searchQuery.toLowerCase().trim();
      const matchSearch = !q || 
        s.student_name.toLowerCase().includes(q) || 
        s.student.toLowerCase().includes(q) || 
        String(s.group_roll_number || '').includes(q);

      if (!matchSearch) return false;

      // Status tab filter
      const curStatus = attendanceMap[s.student];
      if (filterTab === 'present') return curStatus === 'Present';
      if (filterTab === 'absent') return curStatus === 'Absent';
      if (filterTab === 'leave') return curStatus === 'Leave' || s.on_leave;
      if (filterTab === 'unmarked') return !curStatus;
      return true;
    });
  }, [roster, searchQuery, filterTab, attendanceMap]);

  // 6. Submit Attendance to Frappe Backend
  const handleSubmitAttendance = async () => {
    setIsSubmitting(true);
    setFeedback(null);

    const students_present = [];
    const students_absent = [];

    roster.forEach(s => {
      const st = attendanceMap[s.student];
      const payload = {
        student: s.student,
        student_name: s.student_name,
        group_roll_number: s.group_roll_number,
      };

      if (st === 'Present') {
        students_present.push(payload);
      } else if (st === 'Absent') {
        students_absent.push(payload);
      }
    });

    try {
      const targetGroup = basedOn === 'Student Group' 
        ? selectedStudentGroup 
        : (currentScheduleMeta?.student_group || selectedStudentGroup);

      const targetSchedule = basedOn === 'Course Schedule' 
        ? selectedCourseSchedule 
        : null;

      await attendanceApi.markAttendance({
        students_present,
        students_absent,
        course_schedule: targetSchedule,
        student_group: targetGroup,
        date: attendanceDate,
      });

      setFeedback({
        type: 'success',
        message: `Attendance marked successfully for ${targetGroup}! (Present: ${students_present.length}, Absent: ${students_absent.length})`,
      });

      setShowConfirmModal(false);

      // Re-fetch to synchronize state with Frappe database
      await fetchRoster({ keepFeedback: true });
    } catch (err) {
      console.error('Failed to submit attendance:', err);
      setFeedback({
        type: 'error',
        message: err.message || 'Error occurred while saving attendance records to Frappe.',
      });
      setShowConfirmModal(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Quick Date presets
  const setDatePreset = (daysAgo) => {
    const d = new Date();
    d.setDate(d.getDate() - daysAgo);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    setAttendanceDate(`${yyyy}-${mm}-${dd}`);
  };

  if (!isStaff) {
    return (
      <div className="max-w-3xl mx-auto p-6 sm:p-10 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 text-center space-y-3">
        <ShieldAlert className="w-8 h-8 text-amber-500 mx-auto" />
        <h2 className="text-base font-extrabold text-slate-900 dark:text-slate-100">Staff-only tool</h2>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          The Student Attendance Tool is available to instructors and academic staff.
        </p>
        <button
          type="button"
          onClick={() => navigate('/attendance')}
          className="px-4 py-2 min-h-[36px] rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold"
        >
          View Attendance Records
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-40 sm:pb-24 animate-in fade-in duration-300">
      {/* 1. Header Hero Panel */}
      <div className="p-4 sm:p-8 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 relative z-10">
          <div className="space-y-2 min-w-0">
            <div className="flex items-center flex-wrap gap-2">
              <button
                type="button"
                onClick={() => navigate('/reports-tools')}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs font-semibold transition"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Reports &amp; Tools</span>
              </button>
              <span className="text-slate-300 dark:text-slate-700">•</span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800 text-[11px] font-bold">
                <FileCheck2 className="w-3 h-3" />
                DocType: Student Attendance Tool
              </span>
            </div>

            <h1 className="text-xl sm:text-3xl font-black text-slate-900 dark:text-slate-100 tracking-tight flex items-center gap-2 sm:gap-3">
              <UserCheck className="w-6 h-6 sm:w-8 sm:h-8 shrink-0 text-emerald-600 dark:text-emerald-400" />
              <span className="min-w-0 break-words">Student Attendance Tool</span>
            </h1>

            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-2xl leading-relaxed">
              Fast, high-precision daily attendance register for student cohorts, batches, and live scheduled classes. Directly writes and submits to Frappe <code className="text-xs font-mono bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">Student Attendance</code> records.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => fetchRoster()}
              disabled={loadingRoster}
              className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold transition shadow-xs disabled:opacity-60"
              title="Refresh Roster from Database"
            >
              <RefreshCw className={`w-4 h-4 ${loadingRoster ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Sync Database</span>
            </button>
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
          {feedback.type === 'error' && <XCircle className="w-5 h-5 shrink-0 text-rose-600 dark:text-rose-400 mt-0.5" />}
          <div className="flex-1 min-w-0 text-xs font-semibold leading-relaxed break-words">
            {feedback.message}
          </div>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            aria-label="Dismiss"
            className="shrink-0 -m-1 p-1.5 text-xs font-bold opacity-60 hover:opacity-100"
          >
            ✕
          </button>
        </div>
      )}

      {/* 3. Parameter Controls Panel (DocType Fields) */}
      <div className="p-4 sm:p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-5 sm:space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="space-y-0.5 min-w-0">
            <h2 className="text-sm font-extrabold text-slate-900 dark:text-slate-100 uppercase tracking-wider flex items-center gap-2">
              <Layers className="w-4 h-4 shrink-0 text-emerald-600" />
              <span>Attendance Scope &amp; Target Setup</span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Select whether attendance is recorded for a general student group or a specific live lecture slot.
            </p>
          </div>

          {/* Mode Selector (Based On) */}
          <div className="flex w-full sm:w-auto sm:inline-flex shrink-0 p-1 rounded-2xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200/60 dark:border-slate-700/60 sm:self-auto">
            <button
              type="button"
              onClick={() => setBasedOn('Student Group')}
              className={`flex-1 sm:flex-none whitespace-nowrap px-4 py-2 sm:py-1.5 rounded-xl text-xs font-bold transition-all ${
                basedOn === 'Student Group'
                  ? 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              Student Group
            </button>
            <button
              type="button"
              onClick={() => setBasedOn('Course Schedule')}
              className={`flex-1 sm:flex-none whitespace-nowrap px-4 py-2 sm:py-1.5 rounded-xl text-xs font-bold transition-all ${
                basedOn === 'Course Schedule'
                  ? 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              Course Schedule
            </button>
          </div>
        </div>

        {/* Inputs based on selection */}
        {basedOn === 'Student Group' ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Group Based On */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Group Based On
              </label>
              <select
                value={groupBasedOn}
                onChange={(e) => {
                  const val = e.target.value;
                  setGroupBasedOn(val);
                  const matching = studentGroups.filter(g => g.group_based_on === val);
                  if (matching.length > 0) {
                    setSelectedStudentGroup(matching[0].name);
                  }
                }}
                className="w-full px-3.5 py-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              >
                <option value="Batch">Batch (Cohort / Section)</option>
                <option value="Course">Course (Subject-wise)</option>
                <option value="Activity">Activity (Club / Event)</option>
              </select>
            </div>

            {/* Student Group Select */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex flex-wrap items-center justify-between gap-x-2 gap-y-0.5">
                <span>{groupBasedOn === 'Course' ? 'Course Group' : 'Student Group'} <span className="text-rose-500">*</span></span>
                {currentGroupMeta && (
                  <span className="text-[11px] font-normal text-slate-400 font-mono shrink-0">
                    {currentGroupMeta.student_count || roster.length} students
                  </span>
                )}
              </label>
              <select
                value={selectedStudentGroup}
                onChange={(e) => setSelectedStudentGroup(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              >
                {filteredStudentGroups.map((g) => (
                  <option key={g.name} value={g.name}>
                    {g.course ? `[${g.course}] ` : ''}{g.student_group_name || g.name} {g.program ? `• ${g.program}` : ''} ({g.student_count || 0} students)
                  </option>
                ))}
              </select>
            </div>

            {/* Attendance Date */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex flex-wrap items-center justify-between gap-x-2 gap-y-0.5">
                <span>Attendance Date <span className="text-rose-500">*</span></span>
                <span className="text-[11px] text-slate-400 shrink-0">Cannot be future</span>
              </label>
              <input
                type="date"
                max={getTodayDate()}
                value={attendanceDate}
                onChange={(e) => setAttendanceDate(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-mono"
              />
              <div className="flex items-center flex-wrap gap-1.5 pt-1">
                <button
                  type="button"
                  onClick={() => setDatePreset(0)}
                  className="px-2.5 sm:px-2 py-1.5 sm:py-0.5 rounded-md bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-[11px] font-bold text-slate-600 dark:text-slate-400 transition"
                >
                  Today
                </button>
                <button
                  type="button"
                  onClick={() => setDatePreset(1)}
                  className="px-2.5 sm:px-2 py-1.5 sm:py-0.5 rounded-md bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-[11px] font-bold text-slate-600 dark:text-slate-400 transition"
                >
                  Yesterday
                </button>
                <button
                  type="button"
                  onClick={() => setDatePreset(2)}
                  className="px-2.5 sm:px-2 py-1.5 sm:py-0.5 rounded-md bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-[11px] font-bold text-slate-600 dark:text-slate-400 transition"
                >
                  2 Days Ago
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Course Schedule Select */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Course Schedule Slot <span className="text-rose-500">*</span>
              </label>
              <select
                value={selectedCourseSchedule}
                onChange={(e) => setSelectedCourseSchedule(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              >
                {courseSchedules.map((cs) => (
                  <option key={cs.name} value={cs.name}>
                    {cs.course} • {cs.student_group} ({cs.schedule_date || 'No Date'} | {cs.instructor_name || 'Faculty'})
                  </option>
                ))}
              </select>
            </div>

            {/* Linked Schedule Info Card */}
            {currentScheduleMeta && (
              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-3">
                <div className="space-y-1 text-xs min-w-0">
                  <div className="flex items-center flex-wrap gap-2">
                    <span className="font-extrabold text-slate-900 dark:text-slate-100 break-words min-w-0">
                      {currentScheduleMeta.course}
                    </span>
                    <span className="text-[11px] px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-bold border border-emerald-200/50">
                      {currentScheduleMeta.room || 'Classroom'}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 break-words">
                    Group: <strong>{currentScheduleMeta.student_group}</strong> • Instructor: <strong>{currentScheduleMeta.instructor_name || currentScheduleMeta.instructor}</strong>
                  </p>
                </div>
                <div className="sm:text-right shrink-0 flex sm:block items-baseline gap-2">
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300 block font-mono">
                    {currentScheduleMeta.schedule_date}
                  </span>
                  <span className="text-[11px] text-slate-400 font-mono">
                    {currentScheduleMeta.from_time ? String(currentScheduleMeta.from_time).substring(0, 5) : ''}
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Informative Academic Session Pill */}
        {currentGroupMeta && (
          <div className="pt-2 flex flex-wrap items-center gap-2 text-xs">
            <span className="text-slate-400 font-medium">Linked Group Context:</span>
            {currentGroupMeta.course && (
              <span className="px-2.5 py-1 rounded-xl bg-emerald-50 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300 font-bold text-[11px] border border-emerald-200/60 dark:border-emerald-800 flex items-center gap-1.5 max-w-full break-words">
                <BookOpen className="w-3 h-3 shrink-0 text-emerald-600 dark:text-emerald-400" />
                <span>Subject / Course: {currentGroupMeta.course}</span>
              </span>
            )}
            <span className="px-2.5 py-1 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold font-mono text-[11px]">
              Academic Year: {currentGroupMeta.academic_year || 'Not set'}
            </span>
            {currentGroupMeta.academic_term && (
              <span className="px-2.5 py-1 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold font-mono text-[11px]">
                Term: {currentGroupMeta.academic_term}
              </span>
            )}
            {currentGroupMeta.program && (
              <span className="px-2.5 py-1 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold text-[11px]">
                Program: {currentGroupMeta.program}
              </span>
            )}
            {stats.hasExistingAttendance && (
              <span className="px-2.5 py-1 rounded-xl bg-blue-50 dark:bg-blue-950/70 text-blue-700 dark:text-blue-300 font-bold text-[11px] border border-blue-200/60 dark:border-blue-800 flex items-center gap-1.5 max-w-full">
                <FileCheck2 className="w-3.5 h-3.5 shrink-0 text-blue-600 dark:text-blue-400" />
                <span>Attendance already recorded (updates will overwrite in-place, no duplicates)</span>
              </span>
            )}
          </div>
        )}
      </div>

      {/* 4. Live Attendance Statistics & Segmented Bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-3.5">
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-1">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
            Enrolled Students
          </span>
          <div className="flex items-baseline flex-wrap gap-x-2">
            <span className="text-2xl font-black text-slate-900 dark:text-slate-100 font-mono">
              {stats.total}
            </span>
            <span className="text-xs text-slate-400">Total</span>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-emerald-50/60 dark:bg-emerald-950/40 border border-emerald-200/60 dark:border-emerald-800/60 shadow-xs space-y-1">
          <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Present
          </span>
          <div className="flex items-baseline flex-wrap gap-x-2">
            <span className="text-2xl font-black text-emerald-700 dark:text-emerald-300 font-mono">
              {stats.presentCount}
            </span>
            <span className="text-xs font-bold text-emerald-600/80 dark:text-emerald-400/80 font-mono">
              ({stats.presentPct}%)
            </span>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-rose-50/60 dark:bg-rose-950/40 border border-rose-200/60 dark:border-rose-800/60 shadow-xs space-y-1">
          <span className="text-[11px] font-bold text-rose-600 dark:text-rose-400 uppercase tracking-wider flex items-center gap-1.5">
            <XCircle className="w-3.5 h-3.5" />
            Absent
          </span>
          <div className="flex items-baseline flex-wrap gap-x-2">
            <span className="text-2xl font-black text-rose-700 dark:text-rose-300 font-mono">
              {stats.absentCount}
            </span>
            <span className="text-xs font-bold text-rose-600/80 dark:text-rose-400/80 font-mono">
              ({stats.absentPct}%)
            </span>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-amber-50/60 dark:bg-amber-950/40 border border-amber-200/60 dark:border-amber-800/60 shadow-xs space-y-1">
          <span className="text-[11px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
            <CalendarDays className="w-3.5 h-3.5" />
            On Leave
          </span>
          <div className="flex items-baseline flex-wrap gap-x-2">
            <span className="text-2xl font-black text-amber-700 dark:text-amber-300 font-mono">
              {stats.leaveCount}
            </span>
            <span className="text-xs font-bold text-amber-600/80 dark:text-amber-400/80 font-mono">
              ({stats.leavePct}%)
            </span>
          </div>
        </div>
      </div>

      {/* Visual Progress Bar */}
      <div className="h-2.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden flex">
        <div 
          style={{ width: `${stats.presentPct}%` }} 
          className="bg-emerald-500 transition-all duration-300" 
          title={`Present: ${stats.presentPct}%`}
        />
        <div 
          style={{ width: `${stats.leavePct}%` }} 
          className="bg-amber-400 transition-all duration-300" 
          title={`On Leave: ${stats.leavePct}%`}
        />
        <div 
          style={{ width: `${stats.absentPct}%` }} 
          className="bg-rose-500 transition-all duration-300" 
          title={`Absent: ${stats.absentPct}%`}
        />
      </div>

      {/* 5. Action Toolbar (1-Click Batch Tools, Search, Views) */}
      <div className="p-4 sm:p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* 1-Click Action Buttons (matching Desk behavior: Check All, Uncheck All) */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleMarkAllPresent}
              className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 min-h-[36px] flex-1 sm:flex-none whitespace-nowrap rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition active:scale-95"
            >
              <CheckCheck className="w-3.5 h-3.5" />
              <span>Mark All Present</span>
            </button>

            <button
              type="button"
              onClick={handleMarkAllAbsent}
              className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 min-h-[36px] flex-1 sm:flex-none whitespace-nowrap rounded-xl bg-slate-100 hover:bg-rose-50 hover:text-rose-600 dark:bg-slate-800 dark:hover:bg-rose-950/60 dark:hover:text-rose-400 text-slate-700 dark:text-slate-300 text-xs font-bold transition active:scale-95 border border-slate-200/80 dark:border-slate-700"
            >
              <XCircle className="w-3.5 h-3.5" />
              <span>Mark All Absent</span>
            </button>

            <button
              type="button"
              onClick={handleInvertStatus}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-2 min-h-[36px] min-w-[36px] rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs font-bold transition"
              title="Invert Present / Absent"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Invert</span>
            </button>

            {stats.isDirty && (
              <button
                type="button"
                onClick={handleResetToSaved}
                className="inline-flex items-center justify-center gap-1.5 px-3 py-2 min-h-[36px] whitespace-nowrap rounded-xl bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 text-xs font-bold transition border border-amber-200 dark:border-amber-800"
              >
                <span>Reset to Saved</span>
              </button>
            )}
          </div>

          {/* Search, Filter & View Controls */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Search Input */}
            <div className="relative min-w-0 sm:min-w-[200px] flex-1">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search name, roll no..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-8 py-2 min-h-[36px] rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  aria-label="Clear search"
                  className="absolute right-1.5 p-1 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600"
                >
                  ✕
                </button>
              )}
            </div>

            {/* View Switcher */}
            <div className="flex items-center p-1 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700/60 shrink-0">
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                className={`p-2 sm:p-1.5 rounded-lg text-xs transition ${
                  viewMode === 'grid'
                    ? 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-xs'
                    : 'text-slate-400 hover:text-slate-600'
                }`}
                title="Grid Cards View"
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode('table')}
                className={`p-2 sm:p-1.5 rounded-lg text-xs transition ${
                  viewMode === 'table'
                    ? 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-xs'
                    : 'text-slate-400 hover:text-slate-600'
                }`}
                title="Compact Table View"
              >
                <TableIcon className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Status Filter Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pt-2 sm:pt-1 border-t border-slate-100 dark:border-slate-800">
          <button
            type="button"
            onClick={() => setFilterTab('all')}
            className={`shrink-0 px-3 py-2 sm:py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap ${
              filterTab === 'all'
                ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900'
                : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            All Students ({stats.total})
          </button>
          <button
            type="button"
            onClick={() => setFilterTab('present')}
            className={`shrink-0 px-3 py-2 sm:py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap flex items-center gap-1.5 ${
              filterTab === 'present'
                ? 'bg-emerald-600 text-white'
                : 'text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40'
            }`}
          >
            <CheckCircle2 className="w-3 h-3" />
            <span>Present ({stats.presentCount})</span>
          </button>
          <button
            type="button"
            onClick={() => setFilterTab('absent')}
            className={`shrink-0 px-3 py-2 sm:py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap flex items-center gap-1.5 ${
              filterTab === 'absent'
                ? 'bg-rose-600 text-white'
                : 'text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40'
            }`}
          >
            <XCircle className="w-3 h-3" />
            <span>Absent ({stats.absentCount})</span>
          </button>
          {stats.leaveCount > 0 && (
            <button
              type="button"
              onClick={() => setFilterTab('leave')}
              className={`shrink-0 px-3 py-2 sm:py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap flex items-center gap-1.5 ${
                filterTab === 'leave'
                  ? 'bg-amber-500 text-white'
                  : 'text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/40'
              }`}
            >
              <CalendarDays className="w-3 h-3" />
              <span>On Leave ({stats.leaveCount})</span>
            </button>
          )}
        </div>
      </div>

      {/* 6. Student Roster Listing (Cards or Table) */}
      {loadingRoster ? (
        <div className="p-12 text-center rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 space-y-3">
          <RefreshCw className="w-8 h-8 text-emerald-600 dark:text-emerald-400 animate-spin mx-auto" />
          <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            Fetching student roster &amp; attendance status...
          </p>
        </div>
      ) : displayedStudents.length === 0 ? (
        <div className="p-12 text-center rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center mx-auto">
            <Users className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">
            No Students Found
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
            {searchQuery 
              ? `No student matching "${searchQuery}" in this filter.` 
              : 'There are no active students enrolled in this student group.'}
          </p>
        </div>
      ) : viewMode === 'grid' ? (
        /* GRID VIEW */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {displayedStudents.map((s) => {
            const currentStatus = attendanceMap[s.student] || 'Present';
            const isPresent = currentStatus === 'Present';
            const isAbsent = currentStatus === 'Absent';
            const isLeave = currentStatus === 'Leave';

            return (
              <div
                key={s.student}
                className={`p-4 rounded-3xl border transition-all duration-200 flex flex-col justify-between space-y-3 ${
                  isPresent
                    ? 'bg-white dark:bg-slate-900 border-emerald-300 dark:border-emerald-800/80 shadow-xs ring-1 ring-emerald-500/10'
                    : isAbsent
                    ? 'bg-rose-50/40 dark:bg-rose-950/20 border-rose-300 dark:border-rose-900/60 shadow-xs'
                    : 'bg-amber-50/40 dark:bg-amber-950/20 border-amber-300 dark:border-amber-900/60'
                }`}
              >
                {/* Student Info Top */}
                <div className="flex items-start justify-between gap-2.5">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-10 h-10 rounded-2xl flex items-center justify-center font-bold text-xs shrink-0 ${
                      isPresent
                        ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 ring-2 ring-emerald-500/20'
                        : isAbsent
                        ? 'bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 ring-2 ring-rose-500/20'
                        : 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 ring-2 ring-amber-500/20'
                    }`}>
                      {s.student_name ? s.student_name.charAt(0) : 'S'}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="shrink-0 text-[11px] font-black px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-mono">
                          #{s.group_roll_number || '—'}
                        </span>
                        <h4 className="text-sm sm:text-xs font-bold text-slate-900 dark:text-slate-100 truncate min-w-0" title={s.student_name}>
                          {s.student_name}
                        </h4>
                      </div>
                      <p className="text-[11px] text-slate-400 font-mono truncate mt-0.5" title={s.student}>
                        {s.student}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Approved Leave Badge */}
                {s.on_leave && (
                  <div className="p-2 rounded-xl bg-amber-100/70 dark:bg-amber-950/70 border border-amber-200/80 dark:border-amber-800 text-[11px] text-amber-800 dark:text-amber-200 flex items-center gap-1.5 font-medium min-w-0">
                    <CalendarDays className="w-3.5 h-3.5 shrink-0 text-amber-600" />
                    <span className="truncate" title={s.leave_reason || undefined}>Leave: {s.leave_reason || 'Approved Application'}</span>
                  </div>
                )}

                {/* Quick Toggle Controls */}
                <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleToggleStudent(s.student, 'Present')}
                    className={`flex-1 py-2.5 sm:py-2 px-3 min-h-[40px] sm:min-h-0 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 transition active:scale-95 ${
                      isPresent
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'bg-slate-100 hover:bg-emerald-50 dark:bg-slate-800 dark:hover:bg-emerald-950/50 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Present</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleToggleStudent(s.student, 'Absent')}
                    className={`flex-1 py-2.5 sm:py-2 px-3 min-h-[40px] sm:min-h-0 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 transition active:scale-95 ${
                      isAbsent
                        ? 'bg-rose-600 text-white shadow-xs'
                        : 'bg-slate-100 hover:bg-rose-50 dark:bg-slate-800 dark:hover:bg-rose-950/50 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    <XCircle className="w-3.5 h-3.5" />
                    <span>Absent</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* TABLE VIEW */
        <div className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm overflow-hidden">
          {/* Mobile compact list (< md) — easy-to-tap rows with Present / Absent toggles */}
          <ul className="md:hidden divide-y divide-slate-100 dark:divide-slate-800/80">
            {displayedStudents.map((s) => {
              const currentStatus = attendanceMap[s.student] || 'Present';
              const isPresent = currentStatus === 'Present';
              const isAbsent = currentStatus === 'Absent';

              return (
                <li key={s.student} className="p-3.5 space-y-2.5">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className={`w-8 h-8 shrink-0 rounded-lg flex items-center justify-center font-bold text-xs ${
                      isPresent ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700' : 'bg-rose-100 dark:bg-rose-950 text-rose-700'
                    }`}>
                      {s.student_name ? s.student_name.charAt(0) : 'S'}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="shrink-0 text-[11px] font-black px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-mono">
                          #{s.group_roll_number || '—'}
                        </span>
                        <span className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate min-w-0" title={s.student_name}>
                          {s.student_name}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 font-mono truncate mt-0.5" title={s.student}>
                        {s.student}
                      </p>
                    </div>
                  </div>
                  {s.on_leave && (
                    <div className="inline-flex max-w-full items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-50 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 font-bold text-[11px]">
                      <CalendarDays className="w-3 h-3 shrink-0" />
                      <span className="truncate">{s.leave_reason || 'Approved Leave'}</span>
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => handleToggleStudent(s.student, 'Present')}
                      className={`min-h-[40px] px-3 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 transition active:scale-95 ${
                        isPresent
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Present</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleToggleStudent(s.student, 'Absent')}
                      className={`min-h-[40px] px-3 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 transition active:scale-95 ${
                        isAbsent
                          ? 'bg-rose-600 text-white shadow-xs'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      <span>Absent</span>
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>

          <div className="hidden md:block overflow-x-auto">
            <table className="w-full md:min-w-[720px] text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200/80 dark:border-slate-800 text-[11px] uppercase font-bold text-slate-400 tracking-wider">
                  <th className="py-3.5 px-4 w-16 text-center">Roll</th>
                  <th className="py-3.5 px-4">Student Dossier</th>
                  <th className="py-3.5 px-4">Student ID</th>
                  <th className="py-3.5 px-4">Approved Leaves</th>
                  <th className="py-3.5 px-4 text-center">Status Toggle</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                {displayedStudents.map((s) => {
                  const currentStatus = attendanceMap[s.student] || 'Present';
                  const isPresent = currentStatus === 'Present';
                  const isAbsent = currentStatus === 'Absent';
                  const isLeave = currentStatus === 'Leave';

                  return (
                    <tr 
                      key={s.student}
                      className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      <td className="py-3.5 px-4 text-center font-mono font-bold text-slate-600 dark:text-slate-400">
                        #{s.group_roll_number || '—'}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2.5">
                          <div className={`w-7 h-7 shrink-0 rounded-lg flex items-center justify-center font-bold text-[11px] ${
                            isPresent ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700' : 'bg-rose-100 dark:bg-rose-950 text-rose-700'
                          }`}>
                            {s.student_name ? s.student_name.charAt(0) : 'S'}
                          </div>
                          <span className="font-bold text-slate-900 dark:text-slate-100">
                            {s.student_name}
                          </span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 font-mono text-slate-400 break-all">
                        {s.student}
                      </td>
                      <td className="py-3.5 px-4">
                        {s.on_leave ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-50 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 font-bold text-[11px]">
                            <CalendarDays className="w-3 h-3" />
                            {s.leave_reason || 'Approved Leave'}
                          </span>
                        ) : (
                          <span className="text-slate-300 dark:text-slate-600">—</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <div className="inline-flex shrink-0 p-1 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700/60">
                          <button
                            type="button"
                            onClick={() => handleToggleStudent(s.student, 'Present')}
                            className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                              isPresent
                                ? 'bg-emerald-600 text-white shadow-xs'
                                : 'text-slate-500 hover:text-emerald-600'
                            }`}
                          >
                            Present
                          </button>
                          <button
                            type="button"
                            onClick={() => handleToggleStudent(s.student, 'Absent')}
                            className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                              isAbsent
                                ? 'bg-rose-600 text-white shadow-xs'
                                : 'text-slate-500 hover:text-rose-600'
                            }`}
                          >
                            Absent
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 7. Floating Action Submission Bar */}
      {roster.length > 0 && (
        <div className="fixed bottom-3 sm:bottom-6 left-0 right-0 z-30 px-3 sm:px-4 pointer-events-none print:hidden">
          <div className="max-w-4xl mx-auto bg-slate-900/95 dark:bg-slate-950/95 text-white p-3 sm:p-4 rounded-3xl shadow-2xl backdrop-blur-md border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 pointer-events-auto">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 shrink-0 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold">
                <FileCheck2 className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-slate-200">
                  Ready to Submit Attendance
                </p>
                <p className="text-[11px] text-slate-400">
                  <strong className="text-emerald-400 font-mono">{stats.presentCount}</strong> Present • <strong className="text-rose-400 font-mono">{stats.absentCount}</strong> Absent • Date: <span className="font-mono text-slate-300">{attendanceDate}</span>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
              <button
                type="button"
                onClick={() => setShowConfirmModal(true)}
                disabled={isSubmitting}
                className="w-full sm:w-auto px-6 py-2.5 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs shadow-lg shadow-emerald-500/25 transition active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <span>Save &amp; Submit to Frappe</span>
                <CheckCircle2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 8. Confirmation Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-md w-full max-h-[90vh] overflow-y-auto my-auto p-5 sm:p-6 border border-slate-200 dark:border-slate-800 shadow-2xl space-y-5 animate-in fade-in zoom-in-95">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto">
              <UserCheck className="w-6 h-6" />
            </div>

            <div className="text-center space-y-1">
              <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-slate-100">
                Confirm Attendance Submission
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                This action will write attendance records to Frappe DocType <code className="font-mono bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded">Student Attendance</code>.
              </p>
            </div>

            {/* Breakdown card */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60 space-y-2 text-xs">
              <div className="flex justify-between gap-3">
                <span className="text-slate-500 shrink-0">Target Group:</span>
                <strong className="text-slate-900 dark:text-slate-100 font-mono text-right break-all min-w-0">
                  {basedOn === 'Student Group' ? selectedStudentGroup : currentScheduleMeta?.student_group}
                </strong>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-slate-500 shrink-0">Attendance Date:</span>
                <strong className="text-slate-900 dark:text-slate-100 font-mono">{attendanceDate}</strong>
              </div>
              {basedOn === 'Course Schedule' && (
                <div className="flex justify-between gap-3">
                  <span className="text-slate-500 shrink-0">Lecture Slot:</span>
                  <strong className="text-slate-900 dark:text-slate-100 font-mono text-right break-all min-w-0">{selectedCourseSchedule}</strong>
                </div>
              )}
              <div className="pt-2 border-t border-slate-200 dark:border-slate-700 flex justify-between font-bold">
                <span className="text-emerald-600">Present Count:</span>
                <span className="font-mono">{stats.presentCount} Students</span>
              </div>
              <div className="flex justify-between font-bold">
                <span className="text-rose-600">Absent Count:</span>
                <span className="font-mono">{stats.absentCount} Students</span>
              </div>
            </div>

            {/* List of absent students to double check */}
            {stats.absentCount > 0 && (
              <div className="space-y-1.5 text-left">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                  Students Marked Absent:
                </span>
                <div className="max-h-24 overflow-y-auto p-2.5 rounded-xl bg-rose-50/50 dark:bg-rose-950/30 border border-rose-200/60 dark:border-rose-900/40 text-[11px] text-rose-700 dark:text-rose-300 space-y-1">
                  {roster.filter(s => attendanceMap[s.student] === 'Absent').map(s => (
                    <div key={s.student} className="flex justify-between gap-2">
                      <span className="min-w-0 truncate" title={s.student_name}>{s.student_name}</span>
                      <span className="font-mono opacity-70 shrink-0">#{s.group_roll_number || s.student}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Notice if updating existing records */}
            {stats.hasExistingAttendance && (
              <div className="p-3 rounded-2xl bg-blue-50 dark:bg-blue-950/60 border border-blue-200/80 dark:border-blue-800 text-[11px] text-blue-800 dark:text-blue-200 flex items-start gap-2 text-left leading-relaxed">
                <Info className="w-4 h-4 shrink-0 text-blue-600 dark:text-blue-400 mt-0.5" />
                <span>
                  Attendance records already exist for this date and group. Submitting will <strong>update the existing records in-place</strong> without creating duplicates.
                </span>
              </div>
            )}

            <div className="flex items-center gap-2 sm:gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                disabled={isSubmitting}
                className="flex-1 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSubmitAttendance}
                disabled={isSubmitting}
                className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition shadow-md shadow-emerald-600/25 flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Submitting...</span>
                  </>
                ) : (
                  <span>Yes, Mark Attendance</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
