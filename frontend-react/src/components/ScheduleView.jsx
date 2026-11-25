import { todayISO } from '../utils/date';
import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { 
  Calendar as CalendarIcon, 
  Clock, 
  MapPin, 
  User, 
  Sparkles, 
  ChevronRight,
  ChevronLeft,
  BookOpen,
  Plus,
  X,
  CheckCircle2,
  AlertCircle,
  GraduationCap,
  Lock,
  ChevronDown,
  LayoutGrid,
  List,
  Trash2,
  UserCheck,
  Check,
  Search,
  Filter,
  Users
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/frappeClient';

export default function ScheduleView() {
  const { 
    activeProgram, 
    studentGroups, 
    isStaff, 
    isInstructor, 
    isAdmin, 
    instructorInfo, 
    programs,
    isGuardian,
    students,
    selectStudent,
    activeStudentId,
    studentProfile
  } = useAuth();

  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [selectedProgramFilter, setSelectedProgramFilter] = useState('all');
  const [viewMode, setViewMode] = useState('day'); // 'day' | 'week'
  const [teacherFilter, setTeacherFilter] = useState(isInstructor ? 'my' : 'all'); // 'my' | 'all'
  const [selectedInstructorFilter, setSelectedInstructorFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Delete lecture state
  const [deletingId, setDeletingId] = useState(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState(null);

  // Quick Attendance modal from Lecture
  const [attModalOpen, setAttModalOpen] = useState(false);
  const [activeLectureForAtt, setActiveLectureForAtt] = useState(null);
  const [roster, setRoster] = useState([]);
  const [rosterLoading, setRosterLoading] = useState(false);
  const [savingAttendance, setSavingAttendance] = useState(false);
  const [attSuccessMsg, setAttSuccessMsg] = useState('');
  const [rosterSearch, setRosterSearch] = useState('');

  // Lecture Details Modal state
  const [selectedLectureForDetails, setSelectedLectureForDetails] = useState(null);
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [detailsRosterSummary, setDetailsRosterSummary] = useState(null);
  const [loadingDetailsRoster, setLoadingDetailsRoster] = useState(false);
  const [detailsStudentSearch, setDetailsStudentSearch] = useState('');

  const getMonday = (d) => {
    const date = new Date(d);
    const day = date.getDay();
    const diff = date.getDate() - day + (day === 0 ? -6 : 1);
    date.setDate(diff);
    date.setHours(0, 0, 0, 0);
    return date;
  };

  const [currentWeekStart, setCurrentWeekStart] = useState(() => getMonday(new Date()));
  const [selectedDayIndex, setSelectedDayIndex] = useState(() => {
    const today = new Date().getDay(); // 0 is Sun, 1 is Mon...
    return today === 0 ? 6 : today - 1; // Map Mon=0 ... Sun=6
  });

  const weekDays = useMemo(() => {
    const days = [];
    const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    const shortNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const todayStr = todayISO();

    for (let i = 0; i < 7; i++) {
      const d = new Date(currentWeekStart);
      d.setDate(currentWeekStart.getDate() + i);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const dateStr = `${year}-${month}-${day}`;

      days.push({
        index: i,
        name: dayNames[i],
        shortName: shortNames[i],
        dateStr,
        dayOfMonth: d.getDate(),
        monthName: monthNames[d.getMonth()],
        isToday: dateStr === todayStr,
      });
    }
    return days;
  }, [currentWeekStart]);

  const weekRangeLabel = useMemo(() => {
    if (!weekDays.length) return '';
    const first = weekDays[0];
    const last = weekDays[6];
    if (first.monthName === last.monthName) {
      return `${first.dayOfMonth} - ${last.dayOfMonth} ${first.monthName} ${currentWeekStart.getFullYear()}`;
    }
    return `${first.dayOfMonth} ${first.monthName} - ${last.dayOfMonth} ${last.monthName} ${currentWeekStart.getFullYear()}`;
  }, [weekDays, currentWeekStart]);

  const handlePrevWeek = () => {
    const prev = new Date(currentWeekStart);
    prev.setDate(prev.getDate() - 7);
    setCurrentWeekStart(prev);
  };

  const handleNextWeek = () => {
    const next = new Date(currentWeekStart);
    next.setDate(next.getDate() + 7);
    setCurrentWeekStart(next);
  };

  const handleTodayWeek = () => {
    const mon = getMonday(new Date());
    setCurrentWeekStart(mon);
    const today = new Date().getDay();
    setSelectedDayIndex(today === 0 ? 6 : today - 1);
  };

  // Modal state for scheduling lecture (Teachers / Admins only)
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [meta, setMeta] = useState({ courses: [], instructors: [], student_groups: [], rooms: [] });
  const [formData, setFormData] = useState({
    course: '',
    student_group: '',
    instructor: '',
    schedule_date: todayISO(),
    from_time: '09:00:00',
    to_time: '10:00:00',
    room: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState(false);

  const formatTime12h = (t) => {
    if (!t) return '';
    const parts = t.split(':');
    if (parts.length < 2) return t;
    let h = parseInt(parts[0], 10);
    const m = parts[1];
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12;
    h = h ? h : 12;
    const hh = h < 10 ? `0${h}` : h;
    return `${hh}:${m} ${ampm}`;
  };

  const formatLectureDateDisplay = (dateStr) => {
    if (!dateStr) return '';
    try {
      const parts = dateStr.split('-');
      if (parts.length === 3) {
        const year = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1;
        const day = parseInt(parts[2], 10);
        const d = new Date(year, month, day);
        const dayName = d.toLocaleDateString('en-US', { weekday: 'long' });
        const monthName = d.toLocaleDateString('en-US', { month: 'short' });
        return `${dayName}, ${day} ${monthName} ${year}`;
      }
      return dateStr;
    } catch (e) {
      return dateStr;
    }
  };

  const calculateDuration = (fromTime, toTime) => {
    if (!fromTime || !toTime) return '';
    try {
      const [h1, m1] = fromTime.split(':').map(Number);
      const [h2, m2] = toTime.split(':').map(Number);
      let diffMinutes = (h2 * 60 + m2) - (h1 * 60 + m1);
      if (diffMinutes < 0) diffMinutes += 24 * 60;
      if (diffMinutes === 60) return '1 hr';
      if (diffMinutes > 60 && diffMinutes % 60 === 0) return `${diffMinutes / 60} hrs`;
      if (diffMinutes > 60) return `${Math.floor(diffMinutes / 60)}h ${diffMinutes % 60}m`;
      return `${diffMinutes} mins`;
    } catch (e) {
      return '';
    }
  };

  const getFriendlyRoomName = (roomId) => {
    if (!roomId) return 'Classroom / TBA';
    const found = (meta.rooms || []).find(r => r.name === roomId);
    return found ? (found.room_name || found.name) : roomId;
  };

  // Logged-in instructor's own Instructor record (from portal context, else resolved by the backend metadata)
  const myInstructorId = instructorInfo?.name || meta.current_instructor || '';
  const myInstructorName = instructorInfo?.instructor_name
    || (meta.instructors || []).find(i => i.name === myInstructorId)?.instructor_name
    || myInstructorId;
  const currentStudent = isStaff ? null : (activeStudentId || studentProfile?.name || null);
  const weekFromDate = weekDays[0]?.dateStr;
  const weekToDate = weekDays[6]?.dateStr;

  const fetchSchedule = () => {
    setLoading(true);
    setLoadError(null);
    const prog = selectedProgramFilter === 'all' ? null : selectedProgramFilter;
    const groups = (selectedProgramFilter === 'all' || isStaff || selectedProgramFilter !== activeProgram)
      ? null
      : studentGroups;

    const effectiveInstructor = isInstructor
      ? myInstructorId
      : (selectedInstructorFilter || meta.instructors?.[0]?.name || '');

    const instructorParam = (teacherFilter === 'my') ? effectiveInstructor : null;

    if (teacherFilter === 'my' && !effectiveInstructor) {
      // No Instructor record linked to this login (or none selected) -> nothing to show
      setEvents([]);
      setLoading(false);
      return;
    }

    api.getCourseSchedule(prog, groups, currentStudent, instructorParam, weekFromDate, weekToDate)
      .then((data) => {
        const mapped = (data || []).map((item) => ({
          id: item.name,
          title: item.title || item.course || 'Lecture',
          course: item.course,
          program: item.program,
          student_group: item.student_group,
          instructor: item.instructor_name || item.instructor,
          room: item.room,
          date: item.schedule_date,
          from_time: item.from_time ? item.from_time.split('.')[0] : '',
          to_time: item.to_time ? item.to_time.split('.')[0] : '',
          color: item.class_schedule_color || '#4f46e5',
        }));
        setEvents(mapped);
      })
      .catch((err) => {
        console.error('Error fetching course schedule:', err);
        setEvents([]);
        setLoadError(err.message || 'Failed to load the class schedule.');
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchSchedule();
  }, [activeProgram, studentGroups, selectedProgramFilter, isStaff, teacherFilter, selectedInstructorFilter, currentStudent, myInstructorId, weekFromDate, weekToDate, meta.instructors]);

  const availablePrograms = Array.from(
    new Set([
      ...(programs || []).map(p => (typeof p === 'object' ? p.program : p)).filter(Boolean),
      ...events.map(e => e.program).filter(Boolean),
      ...(meta.student_groups || []).map(g => g.program).filter(Boolean)
    ])
  ).filter(Boolean).sort();

  // Pre-fetch schedule metadata on mount so dropdowns are immediately populated
  useEffect(() => {
    if (!isStaff) return;
    api.getScheduleMetadata()
      .then((data) => {
        if (data) {
          setMeta(data);
        }
      })
      .catch((err) => console.error('Failed to pre-fetch schedule metadata:', err));
  }, [isStaff]);

  const openScheduleModal = async (initialOverrides = null) => {
    setIsModalOpen(true);
    setFormError('');
    setFormSuccess(false);

    try {
      const data = (meta.courses && meta.courses.length > 0) ? meta : await api.getScheduleMetadata();
      if (data) {
        setMeta(data);
        let targetGroup = data.student_groups?.[0]?.name || '';
        if (initialOverrides?.program) {
          const matched = (data.student_groups || []).find(g => g.program === initialOverrides.program);
          if (matched) targetGroup = matched.name;
        } else if (selectedProgramFilter && selectedProgramFilter !== 'all') {
          const matched = (data.student_groups || []).find(g => g.program === selectedProgramFilter);
          if (matched) targetGroup = matched.name;
        } else if (activeProgram) {
          const matched = (data.student_groups || []).find(g => g.program === activeProgram);
          if (matched) targetGroup = matched.name;
        }

        // Pick the course: explicit override, else the group's course, else a course this
        // instructor is mapped to, else the first course on record.
        const groupMeta = (data.student_groups || []).find(g => g.name === targetGroup);
        const ownId = instructorInfo?.name || data.current_instructor || '';
        const mappedCourse = ownId
          ? Object.keys(data.course_instructors || {}).find(c => (data.course_instructors[c] || []).some(i => i.name === ownId))
          : null;
        const targetCourse = initialOverrides?.course || groupMeta?.course || mappedCourse || data.courses?.[0]?.name || '';

        setFormData({
          course: targetCourse,
          student_group: targetGroup,
          instructor: ownId || data.instructors?.[0]?.name || '',
          schedule_date: weekDays[selectedDayIndex]?.dateStr || todayISO(),
          from_time: '09:00:00',
          to_time: '10:00:00',
          room: groupMeta?.default_room || data.rooms?.[0]?.name || '',
        });
      }
    } catch (err) {
      console.error('Failed to load schedule metadata:', err);
    }
  };

  // Auto-open schedule modal if URL specifies query parameters (?course=...&program=...)
  useEffect(() => {
    const courseParam = searchParams.get('course');
    const programParam = searchParams.get('program');
    if (courseParam && isStaff) {
      openScheduleModal({ course: courseParam, program: programParam });
    }
  }, [searchParams, isStaff]);

  const handleCreateLecture = async (e) => {
    e.preventDefault();
    if (!formData.course || !formData.student_group || !formData.instructor || !formData.schedule_date) {
      setFormError('Please fill in all required fields.');
      return;
    }

    setSubmitting(true);
    setFormError('');
    try {
      await api.createCourseSchedule(formData);
      setFormSuccess(true);
      setTimeout(() => {
        setIsModalOpen(false);
        setFormSuccess(false);
        fetchSchedule();
      }, 1000);
    } catch (err) {
      console.error('Schedule creation error:', err);
      setFormError(err.message || 'Failed to schedule lecture.');
    } finally {
      setSubmitting(false);
    }
  };

  // Delete lecture handler
  const handleDeleteLecture = async () => {
    if (!deletingId) return;
    setIsDeleting(true);
    setDeleteError(null);
    try {
      await api.deleteCourseSchedule(deletingId);
      setDeleteConfirmOpen(false);
      setDeletingId(null);
      setDeleteError(null);
      fetchSchedule();
    } catch (err) {
      console.error('Delete lecture error:', err);
      setDeleteError(err.message || 'Failed to cancel lecture');
    } finally {
      setIsDeleting(false);
    }
  };

  // Take Attendance Quick Action
  const openAttendanceModalForLecture = (lecture) => {
    setActiveLectureForAtt(lecture);
    setAttModalOpen(true);
    setAttSuccessMsg('');
    setRosterLoading(true);

    api.getAttendanceRoster(lecture.student_group, lecture.date, lecture.id)
      .then((data) => {
        const list = (data || []).map(s => ({
          ...s,
          selectedStatus: s.status || (s.on_leave ? 'Leave' : 'Present'),
        }));
        setRoster(list);
      })
      .catch((err) => {
        console.error('Error fetching roster for lecture:', err);
        setRoster([]);
      })
      .finally(() => setRosterLoading(false));
  };

  const handleMarkAllRoster = (status) => {
    setRoster(prev => prev.map(s => ({ ...s, selectedStatus: status })));
  };

  const handleToggleStudentRoster = (studentId, status) => {
    setRoster(prev => prev.map(s => (s.student === studentId ? { ...s, selectedStatus: status } : s)));
  };

  const handleSubmitLectureAttendance = async () => {
    if (!activeLectureForAtt) return;
    setSavingAttendance(true);
    setAttSuccessMsg('');
    try {
      const students_present = roster
        .filter(s => s.selectedStatus === 'Present')
        .map(s => ({ student: s.student, student_name: s.student_name }));

      const students_absent = roster
        .filter(s => s.selectedStatus === 'Absent')
        .map(s => ({ student: s.student, student_name: s.student_name }));

      await api.markAttendance({
        students_present,
        students_absent,
        student_group: activeLectureForAtt.student_group,
        date: activeLectureForAtt.date,
        course_schedule: activeLectureForAtt.id,
      });

      setAttSuccessMsg(
        `Attendance recorded! (${students_present.length} Present, ${students_absent.length} Absent)`
      );

      setTimeout(() => {
        setAttModalOpen(false);
        setActiveLectureForAtt(null);
        setAttSuccessMsg('');
      }, 1200);
    } catch (err) {
      console.error('Error saving lecture attendance:', err);
      alert(err.message || 'Failed to submit lecture attendance');
    } finally {
      setSavingAttendance(false);
    }
  };

  // Fetch enrolled students and attendance summary whenever details modal opens
  useEffect(() => {
    if (!detailsModalOpen || !selectedLectureForDetails) {
      setDetailsRosterSummary(null);
      setDetailsStudentSearch('');
      return;
    }
    setLoadingDetailsRoster(true);
    api.getAttendanceRoster(
      selectedLectureForDetails.student_group,
      selectedLectureForDetails.date,
      selectedLectureForDetails.id
    )
      .then((data) => {
        const rosterList = data || [];
        const present = rosterList.filter(s => s.status === 'Present').length;
        const absent = rosterList.filter(s => s.status === 'Absent').length;
        const leave = rosterList.filter(s => s.status === 'Leave' || s.on_leave).length;
        const isMarked = rosterList.some(s => s.status);
        setDetailsRosterSummary({
          totalStudents: rosterList.length,
          students: rosterList,
          isMarked,
          present,
          absent,
          leave,
        });
      })
      .catch((err) => {
        console.error('Failed to load roster details for lecture:', err);
        setDetailsRosterSummary(null);
      })
      .finally(() => setLoadingDetailsRoster(false));
  }, [detailsModalOpen, selectedLectureForDetails]);

  const activeDay = weekDays[selectedDayIndex] || weekDays[0];

  // Filter events for the exact selected day in the active week
  const filteredEvents = useMemo(() => {
    return events.filter((ev) => {
      if (ev.date !== activeDay.dateStr) return false;

      if (selectedProgramFilter !== 'all' && ev.program && ev.program !== selectedProgramFilter) {
        return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matches = 
          (ev.title || '').toLowerCase().includes(q) ||
          (ev.course || '').toLowerCase().includes(q) ||
          (ev.instructor || '').toLowerCase().includes(q) ||
          (ev.room || '').toLowerCase().includes(q) ||
          (ev.student_group || '').toLowerCase().includes(q);
        if (!matches) return false;
      }

      return true;
    });
  }, [events, activeDay.dateStr, selectedProgramFilter, searchQuery]);

  // Events grouped by weekday dateStr for Week Matrix View
  const eventsByDay = useMemo(() => {
    const map = {};
    weekDays.forEach(d => { map[d.dateStr] = []; });
    events.forEach(ev => {
      if (map[ev.date]) {
        if (selectedProgramFilter === 'all' || !ev.program || ev.program === selectedProgramFilter) {
          map[ev.date].push(ev);
        }
      }
    });
    return map;
  }, [events, weekDays, selectedProgramFilter]);

  // Filtered Roster for attendance modal
  const filteredRoster = useMemo(() => {
    if (!rosterSearch.trim()) return roster;
    const q = rosterSearch.toLowerCase();
    return roster.filter(s =>
      (s.student_name || '').toLowerCase().includes(q) ||
      (s.student || '').toLowerCase().includes(q) ||
      String(s.group_roll_number || '').includes(q)
    );
  }, [roster, rosterSearch]);

  const modalPresentCount = roster.filter(s => s.selectedStatus === 'Present').length;
  const modalAbsentCount = roster.filter(s => s.selectedStatus === 'Absent').length;
  const modalLeaveCount = roster.filter(s => s.selectedStatus === 'Leave').length;

  return (
    <div className="space-y-6">
      {/* Guardian Ward Switcher Pill */}
      {isGuardian && students && students.length > 1 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 shrink-0">Viewing Ward:</span>
          {students.map((w) => {
            const isSelected = (activeStudentId || studentProfile?.name) === w.student;
            return (
              <button
                key={w.student}
                onClick={() => selectStudent(w.student)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition flex items-center gap-1.5 shrink-0 ${
                  isSelected
                    ? 'bg-brand-600 text-white shadow-xs'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                <span>{w.student_name}</span>
                <span className="text-[11px] opacity-75">({w.relation || 'Ward'})</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Top Banner & Controls */}
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
        <div className="min-w-0 flex-1 basis-[260px]">
          <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
            <h2 className="text-lg sm:text-xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight">Lecture Timetable</h2>
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-brand-50 dark:bg-brand-950/80 text-brand-600 dark:text-brand-400 border border-brand-200/60 dark:border-brand-800">
              {events.length} Lectures Scheduled
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {isStaff ? 'Faculty class schedule, timetable matrix, and direct lecture attendance' : 'Your enrolled subject lecture timetable and classroom schedule'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          {/* View mode toggle: Day vs Week Matrix */}
          <div className="flex items-center bg-slate-100 dark:bg-slate-800/90 rounded-xl p-1 border border-slate-200/60 dark:border-slate-700/60">
            <button
              onClick={() => setViewMode('day')}
              className={`flex items-center gap-1.5 px-3 py-2 sm:py-1.5 rounded-lg text-xs font-semibold transition ${
                viewMode === 'day'
                  ? 'bg-white dark:bg-slate-700 text-brand-600 dark:text-brand-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <List className="w-3.5 h-3.5" />
              <span>Day View</span>
            </button>
            <button
              onClick={() => setViewMode('week')}
              className={`flex items-center gap-1.5 px-3 py-2 sm:py-1.5 rounded-lg text-xs font-semibold transition ${
                viewMode === 'week'
                  ? 'bg-white dark:bg-slate-700 text-brand-600 dark:text-brand-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>Week Matrix</span>
            </button>
          </div>

          {/* Teacher Filter (My Lectures vs All Lectures) */}
          {(isInstructor || isAdmin || isStaff) && (
            <div className="flex items-center bg-slate-100 dark:bg-slate-800/90 rounded-xl p-1 border border-slate-200/60 dark:border-slate-700/60">
              <button
                onClick={() => setTeacherFilter('my')}
                className={`px-3 py-2 sm:py-1.5 rounded-lg text-xs font-semibold transition ${
                  teacherFilter === 'my'
                    ? 'bg-white dark:bg-slate-700 text-brand-600 dark:text-brand-400 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                My Lectures
              </button>
              <button
                onClick={() => setTeacherFilter('all')}
                className={`px-3 py-2 sm:py-1.5 rounded-lg text-xs font-semibold transition ${
                  teacherFilter === 'all'
                    ? 'bg-white dark:bg-slate-700 text-brand-600 dark:text-brand-400 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                All Lectures
              </button>
            </div>
          )}

          {/* Instructor Selector when Admin selects My Lectures */}
          {isAdmin && teacherFilter === 'my' && (
            <div className="relative flex-1 min-w-[140px] sm:flex-none">
              <select
                value={selectedInstructorFilter || meta.instructors?.[0]?.name || ''}
                onChange={(e) => setSelectedInstructorFilter(e.target.value)}
                className="appearance-none bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-700/80 rounded-xl pl-3.5 pr-8 py-2 text-xs font-semibold text-slate-800 dark:text-slate-100 hover:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30 shadow-xs cursor-pointer transition w-full sm:w-auto min-w-[140px]"
              >
                {(meta.instructors || []).map(ins => (
                  <option key={ins.name} value={ins.name}>
                    {ins.instructor_name || ins.name}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          )}

          {/* Program Filter */}
          <div className="relative flex-1 min-w-[140px] sm:flex-none">
            <select
              value={selectedProgramFilter}
              onChange={(e) => setSelectedProgramFilter(e.target.value)}
              className="appearance-none bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-700/80 rounded-xl pl-3.5 pr-8 py-2 text-xs font-semibold text-slate-800 dark:text-slate-100 hover:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30 shadow-xs cursor-pointer transition w-full sm:w-auto min-w-[140px]"
            >
              <option value="all">All Programs</option>
              {availablePrograms.map(p => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          {/* Schedule Lecture button (Staff/Admin) */}
          {isStaff ? (
            <button
              onClick={openScheduleModal}
              className="flex items-center justify-center gap-2 w-full sm:w-auto px-4 py-2.5 sm:py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold shadow-xs transition active:scale-95 shrink-0"
            >
              <Plus className="w-4 h-4" />
              Schedule Lecture
            </button>
          ) : (
            <div className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-medium flex items-center gap-1.5">
              <BookOpen className="w-3.5 h-3.5 text-brand-500" />
              <span>Student Timetable</span>
            </div>
          )}
        </div>
      </div>

      {/* Week Navigator & Day Selector */}
      <div className="space-y-3">
        {/* Week Switcher Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-1">
          {/* Week Date Range & Navigation */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-xl p-1 border border-slate-200/60 dark:border-slate-700/60">
              <button
                onClick={handlePrevWeek}
                title="Previous Week"
                className="p-2 sm:p-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 hover:text-brand-600 dark:hover:text-brand-400 transition"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="px-3 text-xs font-bold text-slate-800 dark:text-slate-100 whitespace-nowrap">
                {weekRangeLabel}
              </span>
              <button
                onClick={handleNextWeek}
                title="Next Week"
                className="p-2 sm:p-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 hover:text-brand-600 dark:hover:text-brand-400 transition"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <button
              onClick={handleTodayWeek}
              className="px-3 py-2 sm:py-1.5 rounded-xl text-xs font-semibold bg-brand-50 dark:bg-brand-950/80 text-brand-600 dark:text-brand-400 border border-brand-200/60 dark:border-brand-800 hover:bg-brand-100 dark:hover:bg-brand-900/60 transition"
            >
              Current Week
            </button>
          </div>

          {/* Search bar inside timetable */}
          <div className="relative w-full sm:w-auto sm:min-w-[220px]">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search subject, room, teacher..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded-xl pl-8 pr-3 py-2 sm:py-1.5 text-xs text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Day Selector Pills with Exact Dates (shown in Day View) */}
        {viewMode === 'day' && (
          <div className="flex items-center gap-2 p-1.5 bg-slate-100 dark:bg-slate-800/90 rounded-2xl overflow-x-auto max-w-full">
            {weekDays.map((d) => {
              const isSelected = selectedDayIndex === d.index;
              const countForDay = events.filter((e) => {
                if (e.date !== d.dateStr) return false;
                if (selectedProgramFilter !== 'all' && e.program && e.program !== selectedProgramFilter) return false;
                return true;
              }).length;

              return (
                <button
                  key={d.dateStr}
                  onClick={() => setSelectedDayIndex(d.index)}
                  className={`flex-1 min-w-[70px] sm:min-w-[90px] py-2 px-2.5 rounded-xl text-center transition-all ${
                    isSelected
                      ? 'bg-brand-600 text-white shadow-xs font-bold'
                      : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-white/60 dark:hover:bg-slate-700/60'
                  }`}
                >
                  <div className="flex items-center justify-center gap-1">
                    <span className="text-[11px] font-semibold">{d.shortName}</span>
                    {d.isToday && (
                      <span className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-white' : 'bg-brand-500 animate-pulse'}`} />
                    )}
                  </div>
                  <div className="mt-0.5 flex items-center justify-center gap-1">
                    <span className="text-sm font-extrabold">{d.dayOfMonth}</span>
                    {countForDay > 0 && (
                      <span className={`inline-block px-1.5 py-0 rounded-full text-[11px] leading-4 font-bold ${isSelected ? 'bg-white/20 text-white' : 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400'}`}>
                        {countForDay}
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Main Content Area: Day Timeline View vs Week Matrix View */}
      {loading ? (
        <div className="flex items-center justify-center p-12 text-slate-400 text-sm">
          <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin mr-3" />
          Loading class schedule...
        </div>
      ) : loadError ? (
        <div className="glass-panel rounded-3xl p-12 text-center border border-rose-200/80 dark:border-rose-900/60">
          <div className="w-14 h-14 rounded-2xl bg-rose-50 dark:bg-rose-950/60 text-rose-500 flex items-center justify-center mx-auto mb-3">
            <AlertCircle className="w-7 h-7" />
          </div>
          <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">Could not load the class schedule</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">{loadError}</p>
          <button
            onClick={fetchSchedule}
            className="mt-4 px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold transition"
          >
            Retry
          </button>
        </div>
      ) : viewMode === 'day' ? (
        /* DAY VIEW */
        filteredEvents.length === 0 ? (
          <div className="glass-panel rounded-3xl p-12 text-center border border-slate-200/80 dark:border-slate-800">
            <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 flex items-center justify-center mx-auto mb-3">
              <CalendarIcon className="w-7 h-7" />
            </div>
            <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">
              No lectures for {activeDay.name}, {activeDay.monthName} {activeDay.dayOfMonth}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-xs mx-auto">
              {isStaff 
                ? 'No lectures scheduled on this date. Click "+ Schedule Lecture" above to plan a class.' 
                : 'You have no classes scheduled on this day. Select another day to view lectures.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredEvents.map((item, index) => (
              <div 
                key={item.id || index}
                onClick={() => {
                  setSelectedLectureForDetails(item);
                  setDetailsModalOpen(true);
                }}
                className="glass-panel p-5 rounded-2xl border border-slate-200/70 dark:border-slate-800 hover:border-brand-500/70 hover:shadow-glow transition-all duration-200 group relative overflow-hidden cursor-pointer active:scale-[0.99]"
              >
                {/* Colored side indicator bar */}
                <div 
                  className="absolute left-0 top-0 bottom-0 w-1.5"
                  style={{ backgroundColor: item.color || '#4f46e5' }}
                />

                <div className="flex flex-col sm:flex-row md:flex-col xl:flex-row sm:items-start md:items-stretch xl:items-start justify-between gap-3">
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2 min-w-0">
                      <span 
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: item.color || '#4f46e5' }}
                      />
                      <h4 className="text-base font-bold text-slate-900 dark:text-slate-100 group-hover:text-brand-600 dark:group-hover:text-brand-400 transition min-w-0 break-words">
                        {item.title}
                      </h4>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 pl-4">
                      <span className="px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 text-[11px] font-bold border border-indigo-200/50 dark:border-indigo-800/50">
                        {item.student_group || item.program}
                      </span>
                      <span className="text-[11px] text-slate-400 font-mono">
                        {item.date}
                      </span>
                    </div>
                  </div>

                  <div className="px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold flex items-center gap-1 shrink-0 self-start">
                    <Clock className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                    {formatTime12h(item.from_time)} - {formatTime12h(item.to_time)}
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600 dark:text-slate-400">
                  <div className="flex items-center gap-1.5 font-medium min-w-0">
                    <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="truncate" title={item.instructor || 'Staff Instructor'}>{item.instructor || 'Staff Instructor'}</span>
                  </div>
                  <div className="flex items-center gap-1.5 font-medium min-w-0 max-w-full bg-slate-50 dark:bg-slate-800/60 px-2.5 py-1 rounded-lg border border-slate-200/60 dark:border-slate-700/60">
                    <MapPin className="w-3.5 h-3.5 text-brand-600 dark:text-brand-400 shrink-0" />
                    <span className="truncate">{getFriendlyRoomName(item.room)}</span>
                  </div>
                </div>

                {/* Faculty Quick Actions Bar */}
                {isStaff && (
                  <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800/60 flex items-center justify-between gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        openAttendanceModalForLecture(item);
                      }}
                      className="px-3 py-2 sm:py-1.5 rounded-xl bg-brand-50 dark:bg-brand-950/80 hover:bg-brand-100 dark:hover:bg-brand-900/80 text-brand-700 dark:text-brand-300 text-xs font-bold flex items-center gap-1.5 transition active:scale-95"
                    >
                      <UserCheck className="w-3.5 h-3.5 text-brand-600 dark:text-brand-400" />
                      <span>Take Attendance</span>
                    </button>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeletingId(item.id);
                        setDeleteError(null);
                        setDeleteConfirmOpen(true);
                      }}
                      className="p-2 sm:p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition"
                      title="Cancel Lecture"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )
      ) : (
        /* WEEK MATRIX VIEW */
        <div className="space-y-2">
        <p className="lg:hidden text-[11px] text-slate-400 dark:text-slate-500 flex items-center gap-1 print:hidden">
          <ChevronRight className="w-3 h-3 shrink-0" />
          Swipe sideways to see the full week
        </p>
        <div className="overflow-x-auto overscroll-x-contain rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
          <div className="min-w-[800px]">
            {/* Header row for days */}
            <div className="grid grid-cols-7 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 text-center">
              {weekDays.map((d) => (
                <div 
                  key={d.dateStr} 
                  className={`p-3 border-r last:border-r-0 border-slate-200 dark:border-slate-800 ${d.isToday ? 'bg-brand-50/50 dark:bg-brand-950/30' : ''}`}
                >
                  <div className="text-xs font-bold text-slate-800 dark:text-slate-200">{d.name}</div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    {d.monthName} {d.dayOfMonth}
                  </div>
                </div>
              ))}
            </div>

            {/* Timetable content columns */}
            <div className="grid grid-cols-7 min-h-[360px] divide-x divide-slate-100 dark:divide-slate-800">
              {weekDays.map((d) => {
                const dayEvents = eventsByDay[d.dateStr] || [];
                return (
                  <div 
                    key={d.dateStr}
                    className={`p-2 space-y-2.5 min-w-0 ${d.isToday ? 'bg-brand-50/20 dark:bg-brand-950/10' : ''}`}
                  >
                    {dayEvents.length === 0 ? (
                      <div className="h-full flex items-center justify-center py-12 text-[11px] text-slate-400 dark:text-slate-600 italic">
                        No classes
                      </div>
                    ) : (
                      dayEvents.map((ev) => (
                        <div
                          key={ev.id}
                          onClick={() => {
                            setSelectedLectureForDetails(ev);
                            setDetailsModalOpen(true);
                          }}
                          className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 hover:border-brand-500 hover:shadow-md transition group relative cursor-pointer active:scale-[0.98]"
                        >
                          <div 
                            className="w-1.5 h-full absolute left-0 top-0 bottom-0 rounded-l-xl"
                            style={{ backgroundColor: ev.color || '#4f46e5' }}
                          />
                          <div className="pl-1">
                            <div className="text-xs font-bold text-slate-900 dark:text-slate-100 line-clamp-1 group-hover:text-brand-600 dark:group-hover:text-brand-400 transition">
                              {ev.course || ev.title}
                            </div>
                            <div className="text-[11px] font-semibold text-brand-600 dark:text-brand-400 mt-0.5">
                              {formatTime12h(ev.from_time)} - {formatTime12h(ev.to_time)}
                            </div>
                            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-1 truncate">
                              <Users className="w-3 h-3 shrink-0" />
                              <span className="truncate">{ev.student_group}</span>
                            </div>
                            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-1 truncate">
                              <MapPin className="w-3 h-3 shrink-0 text-slate-400" />
                              <span className="truncate">{getFriendlyRoomName(ev.room)}</span>
                            </div>

                            {/* Faculty Quick attendance & cancel buttons in week cell */}
                            {isStaff && (
                              <div className="mt-2 flex items-center gap-1">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openAttendanceModalForLecture(ev);
                                  }}
                                  className="flex-1 py-1 px-1.5 rounded-lg bg-brand-50 dark:bg-brand-950/80 text-[11px] font-bold text-brand-600 dark:text-brand-400 hover:bg-brand-100 flex items-center justify-center gap-1 transition"
                                >
                                  <UserCheck className="w-3 h-3" />
                                  <span>Attendance</span>
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setDeletingId(ev.id);
                                    setDeleteError(null);
                                    setDeleteConfirmOpen(true);
                                  }}
                                  className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition"
                                  title="Cancel Lecture"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
        </div>
      )}

      {/* Delete Lecture Confirmation Modal */}
      {deleteConfirmOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-sm w-full max-h-[90vh] overflow-y-auto p-5 sm:p-6 shadow-2xl border border-slate-100 dark:border-slate-800 space-y-4 animate-in fade-in zoom-in-95">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto shadow-xs">
              <Trash2 className="w-6 h-6" />
            </div>
            <div className="text-center space-y-1">
              <h3 className="font-bold text-base text-slate-900 dark:text-slate-100">Cancel Lecture</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 break-words">
                Are you sure you want to remove this scheduled lecture ({deletingId}) from the timetable?
              </p>
            </div>

            {deleteError && (
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span className="leading-relaxed">{deleteError}</span>
              </div>
            )}

            <div className="flex items-center gap-2 pt-2">
              <button
                onClick={() => {
                  setDeleteConfirmOpen(false);
                  setDeletingId(null);
                  setDeleteError(null);
                }}
                className="flex-1 py-2.5 sm:py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
              >
                Keep Lecture
              </button>
              <button
                onClick={handleDeleteLecture}
                disabled={isDeleting}
                className="flex-1 py-2.5 sm:py-2 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 transition shadow-xs flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                {isDeleting ? (
                  <>
                    <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Removing...</span>
                  </>
                ) : (
                  <span>Confirm Cancel</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Lecture Details Modal */}
      {detailsModalOpen && selectedLectureForDetails && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-xl w-full p-5 sm:p-6 shadow-2xl border border-slate-100 dark:border-slate-800 space-y-5 animate-in fade-in zoom-in-95 max-h-[92vh] flex flex-col my-auto overflow-hidden">
            
            {/* Header */}
            <div className="flex items-start justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-800 shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <div 
                  className="w-10 h-10 rounded-2xl flex items-center justify-center text-white font-bold shadow-md shrink-0"
                  style={{ backgroundColor: selectedLectureForDetails.color || '#4f46e5' }}
                >
                  <BookOpen className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-base sm:text-lg text-slate-900 dark:text-slate-100 break-words">
                      {selectedLectureForDetails.title || selectedLectureForDetails.course}
                    </h3>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-0.5">
                    <span className="font-mono text-[11px] text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md break-all border border-slate-200/50 dark:border-slate-700/50">
                      {selectedLectureForDetails.id}
                    </span>
                    <span className="text-xs text-brand-600 dark:text-brand-400 font-semibold">
                      {selectedLectureForDetails.program || 'Standard Course'}
                    </span>
                  </div>
                </div>
              </div>

              <button
                onClick={() => {
                  setDetailsModalOpen(false);
                  setSelectedLectureForDetails(null);
                }}
                className="w-9 h-9 sm:w-8 sm:h-8 shrink-0 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body: Scrollable content */}
            <div className="space-y-4 overflow-y-auto pr-1">
              
              {/* Core Attributes Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Date & Day */}
                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800/80 flex items-start gap-3">
                  <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 mt-0.5">
                    <CalendarIcon className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Date & Day</div>
                    <div className="text-xs font-bold text-slate-800 dark:text-slate-200 mt-0.5 break-words">
                      {formatLectureDateDisplay(selectedLectureForDetails.date)}
                    </div>
                  </div>
                </div>

                {/* Time & Duration */}
                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800/80 flex items-start gap-3">
                  <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0 mt-0.5">
                    <Clock className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Timing & Duration</div>
                    <div className="text-xs font-bold text-slate-800 dark:text-slate-200 mt-0.5 flex items-center gap-1.5 flex-wrap">
                      <span>{formatTime12h(selectedLectureForDetails.from_time)} - {formatTime12h(selectedLectureForDetails.to_time)}</span>
                      {calculateDuration(selectedLectureForDetails.from_time, selectedLectureForDetails.to_time) && (
                        <span className="text-[11px] px-1.5 py-0.5 rounded-md bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 font-semibold">
                          {calculateDuration(selectedLectureForDetails.from_time, selectedLectureForDetails.to_time)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Instructor / Faculty */}
                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800/80 flex items-start gap-3">
                  <div className="w-8 h-8 rounded-xl bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0 mt-0.5">
                    <User className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Assigned Faculty</div>
                    <div className="text-xs font-bold text-slate-800 dark:text-slate-200 mt-0.5 break-words">
                      {selectedLectureForDetails.instructor || 'Staff Instructor'}
                    </div>
                  </div>
                </div>

                {/* Classroom / Room */}
                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800/80 flex items-start gap-3">
                  <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
                    <MapPin className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Classroom / Room</div>
                    <div className="text-xs font-bold text-slate-800 dark:text-slate-200 mt-0.5 break-words">
                      {getFriendlyRoomName(selectedLectureForDetails.room)}
                    </div>
                    {selectedLectureForDetails.room && selectedLectureForDetails.room !== getFriendlyRoomName(selectedLectureForDetails.room) && (
                      <div className="text-[11px] text-slate-400 font-mono mt-0.5 break-all">
                        ID: {selectedLectureForDetails.room}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Student Group / Cohort Banner */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800/80 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <Users className="w-4 h-4 text-brand-600 dark:text-brand-400 shrink-0" />
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200 break-words min-w-0">
                      {selectedLectureForDetails.student_group || 'All Students'}
                    </span>
                  </div>
                  
                  {/* Live attendance badge */}
                  {loadingDetailsRoster ? (
                    <span className="text-[11px] text-slate-400 animate-pulse flex items-center gap-1">
                      <div className="w-2.5 h-2.5 rounded-full border-2 border-brand-500 border-t-transparent animate-spin" />
                      Checking status...
                    </span>
                  ) : detailsRosterSummary?.isMarked ? (
                    <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" />
                      Attendance Recorded
                    </span>
                  ) : (
                    <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-50 dark:bg-amber-950/80 text-amber-600 dark:text-amber-400 border border-amber-200/60 dark:border-amber-800">
                      Attendance Pending
                    </span>
                  )}
                </div>

                {/* Roster Metrics / Breakdown */}
                {detailsRosterSummary && (
                  <div className="pt-2 border-t border-slate-200/60 dark:border-slate-700/60 space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-xs text-slate-600 dark:text-slate-400">
                      <span className="font-semibold text-slate-700 dark:text-slate-300">
                        Enrolled Students ({detailsRosterSummary.totalStudents})
                      </span>
                      {detailsRosterSummary.isMarked && (
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] font-bold">
                          <span className="text-emerald-600 dark:text-emerald-400">
                            {detailsRosterSummary.present} Present
                          </span>
                          <span>•</span>
                          <span className="text-rose-600 dark:text-rose-400">
                            {detailsRosterSummary.absent} Absent
                          </span>
                          {detailsRosterSummary.leave > 0 && (
                            <>
                              <span>•</span>
                              <span className="text-amber-600 dark:text-amber-400">
                                {detailsRosterSummary.leave} Leave
                              </span>
                            </>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Enrolled Students Quick List */}
                    {detailsRosterSummary.students?.length > 0 && (
                      <div className="space-y-2">
                        <div className="relative">
                          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                          <input
                            type="text"
                            placeholder="Search enrolled students..."
                            value={detailsStudentSearch}
                            onChange={(e) => setDetailsStudentSearch(e.target.value)}
                            className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-[11px] text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-brand-500"
                          />
                        </div>
                        
                        <div className="max-h-36 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/80 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-700/60">
                          {detailsRosterSummary.students
                            .filter(s => (s.student_name || s.student || '').toLowerCase().includes(detailsStudentSearch.toLowerCase()))
                            .map((stu) => (
                              <div key={stu.student} className="p-2 flex items-center justify-between gap-2 text-xs hover:bg-slate-50 dark:hover:bg-slate-800/50 transition">
                                <div className="flex items-center gap-2 truncate min-w-0">
                                  <div className="w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold text-[11px] flex items-center justify-center shrink-0">
                                    {(stu.student_name || stu.student || 'S')[0]}
                                  </div>
                                  <div className="truncate min-w-0" title={stu.student_name || stu.student}>
                                    <span className="font-semibold text-slate-800 dark:text-slate-200 text-xs">
                                      {stu.student_name || stu.student}
                                    </span>
                                    <span className="text-[11px] text-slate-400 font-mono ml-1.5">
                                      {stu.student}
                                    </span>
                                  </div>
                                </div>
                                <div className="shrink-0">
                                  {stu.status === 'Present' ? (
                                    <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-emerald-50 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-400">
                                      Present
                                    </span>
                                  ) : stu.status === 'Absent' ? (
                                    <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-rose-50 dark:bg-rose-950/80 text-rose-600 dark:text-rose-400">
                                      Absent
                                    </span>
                                  ) : stu.status === 'Leave' || stu.on_leave ? (
                                    <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-amber-50 dark:bg-amber-950/80 text-amber-600 dark:text-amber-400">
                                      On Leave
                                    </span>
                                  ) : (
                                    <span className="px-2 py-0.5 rounded-md text-[11px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                                      Unmarked
                                    </span>
                                  )}
                                </div>
                              </div>
                            ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Footer / Quick Actions */}
            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 shrink-0">
              <div>
                {isStaff && (
                  <button
                    onClick={() => {
                      const idToDel = selectedLectureForDetails.id;
                      setDetailsModalOpen(false);
                      setSelectedLectureForDetails(null);
                      setDeletingId(idToDel);
                      setDeleteError(null);
                      setDeleteConfirmOpen(true);
                    }}
                    className="px-3 py-2.5 sm:py-2 rounded-xl text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 text-xs font-semibold flex items-center gap-1.5 transition"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Cancel Lecture</span>
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2 ml-auto">
                <button
                  onClick={() => {
                    setDetailsModalOpen(false);
                    setSelectedLectureForDetails(null);
                  }}
                  className="px-4 py-2.5 sm:py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                >
                  Close
                </button>
                {isStaff && (
                  <button
                    onClick={() => {
                      const targetLecture = selectedLectureForDetails;
                      setDetailsModalOpen(false);
                      setSelectedLectureForDetails(null);
                      openAttendanceModalForLecture(targetLecture);
                    }}
                    className="px-4 py-2.5 sm:py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold shadow-xs transition active:scale-95 flex items-center gap-1.5"
                  >
                    <UserCheck className="w-4 h-4" />
                    <span>{detailsRosterSummary?.isMarked ? 'Update Attendance' : 'Take Attendance'}</span>
                  </button>
                )}
              </div>
            </div>

          </div>
        </div>
      )}

      {/* Lecture Attendance Modal */}
      {attModalOpen && activeLectureForAtt && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-2xl w-full p-4 sm:p-6 shadow-2xl border border-slate-100 dark:border-slate-800 space-y-4 animate-in fade-in zoom-in-95 max-h-[92vh] flex flex-col my-auto overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-start justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-800 shrink-0">
              <div className="space-y-1 min-w-0">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-brand-50 dark:bg-brand-950/80 text-brand-600 dark:text-brand-400 flex items-center justify-center font-bold shrink-0">
                    <UserCheck className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-bold text-base text-slate-900 dark:text-slate-100">
                      Take Class Attendance
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 break-words">
                      {activeLectureForAtt.title || activeLectureForAtt.course} • {activeLectureForAtt.student_group}
                    </p>
                  </div>
                </div>
              </div>

              <button
                onClick={() => setAttModalOpen(false)}
                className="w-9 h-9 sm:w-8 sm:h-8 shrink-0 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Quick Metrics & Batch Controls */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="px-3 py-1 rounded-xl text-xs font-bold bg-emerald-50 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800">
                  {modalPresentCount} Present
                </span>
                <span className="px-3 py-1 rounded-xl text-xs font-bold bg-rose-50 dark:bg-rose-950/80 text-rose-600 dark:text-rose-400 border border-rose-200/60 dark:border-rose-800">
                  {modalAbsentCount} Absent
                </span>
                {modalLeaveCount > 0 && (
                  <span className="px-3 py-1 rounded-xl text-xs font-bold bg-amber-50 dark:bg-amber-950/80 text-amber-600 dark:text-amber-400 border border-amber-200/60 dark:border-amber-800">
                    {modalLeaveCount} On Leave
                  </span>
                )}
              </div>

              <div className="grid grid-cols-2 sm:flex sm:items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleMarkAllRoster('Present')}
                  className="px-3 py-2 sm:py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 text-slate-700 dark:text-slate-300 hover:text-emerald-600 dark:hover:text-emerald-400 text-xs font-bold transition flex items-center justify-center gap-1.5"
                >
                  <Check className="w-3.5 h-3.5 text-emerald-500" />
                  <span>All Present</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleMarkAllRoster('Absent')}
                  className="px-3 py-2 sm:py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-slate-700 dark:text-slate-300 hover:text-rose-600 dark:hover:text-rose-400 text-xs font-bold transition flex items-center justify-center gap-1.5"
                >
                  <X className="w-3.5 h-3.5 text-rose-500" />
                  <span>All Absent</span>
                </button>
              </div>
            </div>

            {/* Roster Search Bar */}
            <div className="relative shrink-0">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search student by name or roll number..."
                value={rosterSearch}
                onChange={(e) => setRosterSearch(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 rounded-xl pl-8 pr-3 py-2 sm:py-1.5 text-xs text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
              />
            </div>

            {/* Roster Table */}
            <div className="flex-1 min-h-0 overflow-y-auto border border-slate-200 dark:border-slate-800 rounded-2xl">
              {rosterLoading ? (
                <div className="p-8 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                  <div className="w-4 h-4 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
                  <span>Loading class students...</span>
                </div>
              ) : filteredRoster.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-400">
                  No students found in this cohort.
                </div>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredRoster.map((stu) => {
                    const isPresent = stu.selectedStatus === 'Present';
                    const isAbsent = stu.selectedStatus === 'Absent';
                    const isLeave = stu.selectedStatus === 'Leave' || stu.on_leave;

                    return (
                      <div 
                        key={stu.student}
                        className="p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-3 hover:bg-slate-50/70 dark:hover:bg-slate-800/50 transition"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="w-7 h-7 shrink-0 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-bold flex items-center justify-center">
                            {stu.group_roll_number || '—'}
                          </span>
                          <div className="min-w-0">
                            <div className="text-xs font-bold text-slate-900 dark:text-slate-100 flex flex-wrap items-center gap-x-2 gap-y-1">
                              <span className="break-words min-w-0">{stu.student_name}</span>
                              {stu.on_leave && (
                                <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300 border border-amber-200/60 dark:border-amber-800">
                                  Approved Leave {stu.leave_reason ? `(${stu.leave_reason})` : ''}
                                </span>
                              )}
                            </div>
                            <span className="text-[11px] text-slate-400 font-mono break-all">{stu.student}</span>
                          </div>
                        </div>

                        {/* Status Toggle Buttons */}
                        <div className="grid grid-cols-2 sm:flex sm:items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleToggleStudentRoster(stu.student, 'Present')}
                            className={`px-3 py-2 sm:py-1 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1 ${
                              isPresent
                                ? 'bg-emerald-600 text-white shadow-xs'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 hover:text-emerald-600'
                            }`}
                          >
                            <Check className="w-3 h-3" />
                            <span>Present</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleToggleStudentRoster(stu.student, 'Absent')}
                            className={`px-3 py-2 sm:py-1 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1 ${
                              isAbsent
                                ? 'bg-rose-600 text-white shadow-xs'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-rose-50 dark:hover:bg-rose-950/50 hover:text-rose-600'
                            }`}
                          >
                            <X className="w-3 h-3" />
                            <span>Absent</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {attSuccessMsg && (
              <div className="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/80 border border-emerald-200 dark:border-emerald-800 text-xs font-semibold text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-500" />
                <span>{attSuccessMsg}</span>
              </div>
            )}

            {/* Modal Bottom Actions */}
            <div className="flex flex-col-reverse sm:flex-row sm:items-center justify-end gap-2 sm:gap-3 pt-3 border-t border-slate-100 dark:border-slate-800 shrink-0">
              <button
                type="button"
                onClick={() => setAttModalOpen(false)}
                className="px-4 py-2.5 sm:py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSubmitLectureAttendance}
                disabled={savingAttendance || rosterLoading || roster.length === 0}
                className="px-5 py-2.5 sm:py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold shadow-xs transition active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {savingAttendance ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Saving Attendance...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Save & Submit Attendance</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Schedule Lecture Modal (for Teachers & Admins) */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-md w-full shadow-2xl border border-slate-100 dark:border-slate-800 max-h-[92vh] flex flex-col my-auto overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-4 sm:p-5 pb-3 border-b border-slate-100 dark:border-slate-800 shrink-0 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <CalendarIcon className="w-5 h-5 shrink-0 text-brand-600 dark:text-brand-400" />
                <h3 className="font-bold text-base text-slate-900 dark:text-slate-100">Schedule New Lecture</h3>
              </div>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="w-9 h-9 sm:w-7 sm:h-7 shrink-0 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {formSuccess ? (
              <div className="p-6 py-8 text-center space-y-3 flex-1 overflow-y-auto">
                <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto animate-bounce">
                  <CheckCircle2 className="w-7 h-7" />
                </div>
                <h4 className="text-base font-bold text-slate-900 dark:text-slate-100">Lecture Scheduled!</h4>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  The class session has been registered in the timetable calendar.
                </p>
                <div className="pt-3">
                  <button
                    type="button"
                    onClick={() => {
                      setFormSuccess(false);
                      setIsModalOpen(false);
                    }}
                    className="px-5 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold transition"
                  >
                    Done
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleCreateLecture} className="flex-1 min-h-0 flex flex-col overflow-hidden">
                <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
                  {formError && (
                    <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-400 flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>{formError}</span>
                    </div>
                  )}

                  {/* Course / Subject */}
                  <div>
                    <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1 mb-1">
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                        Course / Subject *
                      </label>
                      <button
                        type="button"
                        onClick={() => navigate('/courses')}
                        className="text-[11px] font-bold text-brand-600 dark:text-brand-400 hover:underline flex items-center gap-1"
                        title="Create a new course in curriculum"
                      >
                        <Plus className="w-3 h-3" />
                        <span>New Course</span>
                      </button>
                    </div>
                    <div className="relative">
                      <select
                        value={formData.course}
                        onChange={(e) => setFormData({ ...formData, course: e.target.value })}
                        className="w-full appearance-none bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 pr-8 text-xs text-slate-800 dark:text-slate-200 font-semibold focus:outline-none focus:ring-2 focus:ring-brand-500 shadow-xs"
                      >
                        {meta.courses?.map((c) => (
                          <option key={c.name} value={c.name}>{c.course_name || c.name}</option>
                        ))}
                      </select>
                      <ChevronDown className="w-4 h-4 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* Student Batch / Group */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Student Batch / Group *
                      </label>
                      <div className="relative">
                        <select
                          value={formData.student_group}
                          onChange={(e) => setFormData({ ...formData, student_group: e.target.value })}
                          className="w-full appearance-none bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 pr-8 text-xs text-slate-800 dark:text-slate-200 font-semibold focus:outline-none focus:ring-2 focus:ring-brand-500 shadow-xs"
                        >
                          {availablePrograms.map(prog => {
                            const groupsInProg = (meta.student_groups || []).filter(g => g.program === prog);
                            if (groupsInProg.length === 0) return null;
                            return (
                              <optgroup key={prog} label={`── ${prog} ──`}>
                                {groupsInProg.map(g => (
                                  <option key={g.name} value={g.name}>
                                    {g.student_group_name || g.name}
                                  </option>
                                ))}
                              </optgroup>
                            );
                          })}
                          {(meta.student_groups || []).filter(g => !g.program || !availablePrograms.includes(g.program)).length > 0 && (
                            <optgroup label="Other Batches">
                              {(meta.student_groups || [])
                                .filter(g => !g.program || !availablePrograms.includes(g.program))
                                .map(g => (
                                  <option key={g.name} value={g.name}>{g.student_group_name || g.name}</option>
                                ))}
                            </optgroup>
                          )}
                        </select>
                        <ChevronDown className="w-4 h-4 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      </div>
                    </div>

                    {/* Instructor (Locked to current teacher if Instructor, selectable if Admin) */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Instructor *
                      </label>
                      {isInstructor && !isAdmin ? (
                        <div className="w-full bg-slate-100 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-xs text-slate-800 dark:text-slate-200 font-semibold flex items-center justify-between shadow-xs">
                          <span className="flex items-center gap-1.5 truncate">
                            <User className="w-3.5 h-3.5 text-brand-500 shrink-0" />
                            <span className="truncate">{myInstructorName || 'No instructor record linked to your account'}</span>
                          </span>
                          <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-700 px-2 py-0.5 rounded-md border border-slate-200/60 dark:border-slate-600 flex items-center gap-1 shrink-0">
                            <Lock className="w-2.5 h-2.5" />
                            <span>You</span>
                          </span>
                        </div>
                      ) : (
                        <div className="relative">
                          <select
                            value={formData.instructor}
                            onChange={(e) => setFormData({ ...formData, instructor: e.target.value })}
                            className="w-full appearance-none bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 pr-8 text-xs text-slate-800 dark:text-slate-200 font-semibold focus:outline-none focus:ring-2 focus:ring-brand-500 shadow-xs"
                          >
                            {meta.instructors?.map((i) => (
                              <option key={i.name} value={i.name}>{i.instructor_name || i.name}</option>
                            ))}
                          </select>
                          <ChevronDown className="w-4 h-4 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Date *
                      </label>
                      <input
                        type="date"
                        value={formData.schedule_date}
                        onChange={(e) => setFormData({ ...formData, schedule_date: e.target.value })}
                        className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-2 text-xs text-slate-800 dark:text-slate-200 font-medium focus:outline-none focus:ring-2 focus:ring-brand-500 shadow-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Start Time *
                      </label>
                      <input
                        type="time"
                        value={formData.from_time}
                        onChange={(e) => setFormData({ ...formData, from_time: e.target.value })}
                        className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-2 text-xs text-slate-800 dark:text-slate-200 font-medium focus:outline-none focus:ring-2 focus:ring-brand-500 shadow-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        End Time *
                      </label>
                      <input
                        type="time"
                        value={formData.to_time}
                        onChange={(e) => setFormData({ ...formData, to_time: e.target.value })}
                        className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-2 text-xs text-slate-800 dark:text-slate-200 font-medium focus:outline-none focus:ring-2 focus:ring-brand-500 shadow-xs"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Classroom / Room
                    </label>
                    <div className="relative">
                      <select
                        value={formData.room}
                        onChange={(e) => setFormData({ ...formData, room: e.target.value })}
                        className="w-full appearance-none bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 pr-8 text-xs text-slate-800 dark:text-slate-200 font-semibold focus:outline-none focus:ring-2 focus:ring-brand-500 shadow-xs"
                      >
                        {meta.rooms?.map((r) => (
                          <option key={r.name} value={r.name}>{r.room_name || r.name}</option>
                        ))}
                      </select>
                      <ChevronDown className="w-4 h-4 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    </div>
                  </div>
                </div>

                <div className="p-4 sm:p-5 pt-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/70 flex items-center justify-end gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-2.5 sm:py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-5 py-2.5 sm:py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold shadow-xs transition active:scale-95 disabled:opacity-50"
                  >
                    {submitting ? 'Scheduling...' : 'Save Lecture'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
