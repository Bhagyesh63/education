import React, { useState, useEffect, useMemo } from 'react';
import { 
  UserCheck, 
  UserX, 
  Calendar, 
  Clock, 
  ChevronDown, 
  PlusCircle, 
  CheckCircle2, 
  AlertCircle,
  FileText,
  BadgeCheck,
  ShieldCheck,
  Check,
  X,
  Sparkles,
  Users,
  Search,
  Filter,
  CheckCheck,
  XCircle,
  AlertTriangle
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/frappeClient';

export default function AttendanceView({ onOpenLeaveModal }) {
  const { 
    studentProfile, 
    activeStudentId, 
    isGuardian, 
    students, 
    selectStudent, 
    activeWard,
    studentGroups, 
    isStaff, 
    isInstructor, 
    isAdmin 
  } = useAuth();

  const isTeacher = isStaff || isInstructor || isAdmin;
  const currentStudentId = isTeacher ? null : (activeStudentId || studentProfile?.name || 'EDU-STU-2026-00001');

  const [selectedGroup, setSelectedGroup] = useState('all');
  const [activeTab, setActiveTab] = useState('attendance'); // 'attendance' | 'holidays' | 'leaves'
  const [records, setRecords] = useState([]);
  const [leaves, setLeaves] = useState([]);
  const [holidays, setHolidays] = useState([]);
  const [showHolidaysInLog, setShowHolidaysInLog] = useState(true);
  const [holidaySearch, setHolidaySearch] = useState('');
  const [logSearch, setLogSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [leavesLoading, setLeavesLoading] = useState(true);
  const [holidaysLoading, setHolidaysLoading] = useState(true);
  const [approvingId, setApprovingId] = useState(null);
  const [fetchedGroups, setFetchedGroups] = useState([]);

  // Mark Attendance Modal state (Teacher / Staff feature)
  const [isMarkModalOpen, setIsMarkModalOpen] = useState(false);
  const [markingDate, setMarkingDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [markingGroup, setMarkingGroup] = useState('');
  const [roster, setRoster] = useState([]);
  const [rosterLoading, setRosterLoading] = useState(false);
  const [savingAttendance, setSavingAttendance] = useState(false);
  const [rosterSearch, setRosterSearch] = useState('');
  const [saveSuccessMsg, setSaveSuccessMsg] = useState('');

  // Fetch all student groups from backend
  useEffect(() => {
    if (api.getAllStudentGroups) {
      api.getAllStudentGroups()
        .then((res) => {
          const list = Array.isArray(res) ? res : (res?.message || []);
          if (list.length > 0) {
            setFetchedGroups(list.map(g => g.name || g.student_group_name || g.label));
          }
        })
        .catch(() => {});
    }
  }, []);

  // Groups list
  const availableGroups = useMemo(() => {
    const defaultList = ['Standard 5 - Section A', 'Standard 6 - Section A'];
    const authList = (studentGroups || []).map(g => g.label || g.name || g);
    return Array.from(new Set([...defaultList, ...authList, ...fetchedGroups])).filter(Boolean);
  }, [studentGroups, fetchedGroups]);

  useEffect(() => {
    if (availableGroups.length > 0 && (!markingGroup || markingGroup === 'all')) {
      setMarkingGroup(availableGroups[0]);
    }
  }, [availableGroups, markingGroup]);

  const fetchAttendance = () => {
    setLoading(true);
    api.getStudentAttendance(currentStudentId, selectedGroup || 'all')
      .then((data) => {
        setRecords(data || []);
      })
      .catch((err) => {
        console.error('Error fetching student attendance:', err);
        setRecords([]);
      })
      .finally(() => setLoading(false));
  };

  const fetchLeaves = () => {
    setLeavesLoading(true);
    api.getStudentLeaves(currentStudentId)
      .then((data) => {
        setLeaves(data || []);
      })
      .catch((err) => {
        console.error('Error fetching student leaves:', err);
        setLeaves([]);
      })
      .finally(() => setLeavesLoading(false));
  };

  useEffect(() => {
    fetchAttendance();
  }, [currentStudentId, selectedGroup, isTeacher]);

  useEffect(() => {
    fetchLeaves();
  }, [currentStudentId, isTeacher]);

  useEffect(() => {
    setHolidaysLoading(true);
    api.getSchoolHolidays()
      .then((data) => {
        setHolidays(data || []);
      })
      .catch((err) => {
        console.error('Error fetching holidays:', err);
        setHolidays([]);
      })
      .finally(() => setHolidaysLoading(false));
  }, []);

  // Fetch roster for attendance register tool
  const loadRoster = (group, date) => {
    const targetGroup = (group && group !== 'all') ? group : (markingGroup && markingGroup !== 'all' ? markingGroup : availableGroups[0]);
    const targetDate = date || markingDate;
    if (!targetGroup) return;

    setRosterLoading(true);
    setSaveSuccessMsg('');
    api.getAttendanceRoster(targetGroup, targetDate)
      .then((data) => {
        const list = (data || []).map(s => ({
          ...s,
          selectedStatus: s.status || (s.on_leave ? 'Leave' : 'Present'),
        }));
        setRoster(list);
      })
      .catch((err) => {
        console.error('Error loading roster:', err);
        setRoster([]);
      })
      .finally(() => setRosterLoading(false));
  };

  const openMarkModal = () => {
    setIsMarkModalOpen(true);
    const grp = (selectedGroup && selectedGroup !== 'all') ? selectedGroup : (markingGroup && markingGroup !== 'all' ? markingGroup : availableGroups[0]);
    setMarkingGroup(grp);
    loadRoster(grp, markingDate);
  };

  const handleMarkAll = (status) => {
    setRoster(prev => prev.map(s => {
      if (s.on_leave && status !== 'Leave') {
        return { ...s, selectedStatus: status };
      }
      return { ...s, selectedStatus: status };
    }));
  };

  const handleToggleStudent = (studentId, status) => {
    setRoster(prev => prev.map(s => (s.student === studentId ? { ...s, selectedStatus: status } : s)));
  };

  const handleSubmitAttendance = async () => {
    setSavingAttendance(true);
    setSaveSuccessMsg('');
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
        student_group: markingGroup,
        date: markingDate,
      });

      setSaveSuccessMsg(
        `Attendance recorded successfully for ${markingGroup}! (${students_present.length} Present, ${students_absent.length} Absent)`
      );
      fetchAttendance();

      setTimeout(() => {
        setIsMarkModalOpen(false);
        setSaveSuccessMsg('');
      }, 1400);
    } catch (err) {
      console.error('Error saving attendance:', err);
      alert(err.message || 'Failed to submit attendance records');
    } finally {
      setSavingAttendance(false);
    }
  };

  const combinedLogs = useMemo(() => {
    let list = records.map(r => ({ ...r, type: 'session' }));
    if (showHolidaysInLog && holidays.length > 0 && !isTeacher) {
      holidays.forEach(h => {
        const hDate = String(h.holiday_date);
        if (hDate >= '2026-09-01' && hDate <= '2026-10-31') {
          list.push({
            date: hDate,
            attendance_date: hDate,
            title: h.description,
            status: 'Holiday',
            type: 'holiday',
            name: `holiday-${hDate}`,
          });
        }
      });
    }

    if (logSearch.trim()) {
      const q = logSearch.toLowerCase();
      list = list.filter(r => 
        (r.student_name || '').toLowerCase().includes(q) ||
        (r.student || '').toLowerCase().includes(q) ||
        (r.date || r.attendance_date || '').toLowerCase().includes(q) ||
        (r.status || '').toLowerCase().includes(q)
      );
    }

    return list.sort((a, b) => (b.date || b.attendance_date || '').localeCompare(a.date || a.attendance_date || ''));
  }, [records, holidays, showHolidaysInLog, isTeacher, logSearch]);

  const handleApproveLeave = async (leaveId) => {
    setApprovingId(leaveId);
    try {
      await api.approveStudentLeave(leaveId);
      await fetchLeaves();
      fetchAttendance();
    } catch (err) {
      console.error('Error approving leave:', err);
      alert(err.message || 'Failed to approve leave application');
    } finally {
      setApprovingId(null);
    }
  };

  // Compute metrics
  const total = records.length;
  const present = records.filter(r => r.status === 'Present').length;
  const absent = records.filter(r => r.status === 'Absent').length;
  const rate = total > 0 ? Math.round((present / total) * 100) : 100;

  // Filter roster by search
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
                <span className="text-[10px] opacity-75">({w.relation || 'Ward'})</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Top Banner & Quick Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight">
            {isTeacher ? 'Student Attendance & Leave Register' : 'Attendance & Leave Records'}
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {isTeacher 
              ? 'Mark student cohort sessions, monitor leaves, and verify academic presence' 
              : `Verified academic presence for ${activeWard?.student_name || studentProfile?.student_name || 'student'}`}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Student Group Filter */}
          {availableGroups.length > 0 && (
            <div className="relative">
              <select
                value={selectedGroup}
                onChange={(e) => setSelectedGroup(e.target.value)}
                className="appearance-none bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 py-2 pl-3.5 pr-8 rounded-xl shadow-xs focus:outline-none focus:ring-2 focus:ring-brand-500/20"
              >
                <option value="all">All Cohorts & Sections</option>
                {availableGroups.map((grpName, idx) => (
                  <option key={idx} value={grpName}>{grpName}</option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          )}

          {/* Teacher Mark Attendance Trigger Button */}
          {isTeacher && (
            <button
              onClick={openMarkModal}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-brand-600 dark:hover:bg-brand-500 text-white text-xs font-semibold shadow-xs transition active:scale-95"
            >
              <UserCheck className="w-4 h-4 text-emerald-400 dark:text-white" />
              <span>Mark Attendance</span>
            </button>
          )}

          <button
            onClick={onOpenLeaveModal}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold shadow-xs transition active:scale-95"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Apply for Leave</span>
          </button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="glass-panel p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800">
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">
            {isTeacher ? 'Overall Cohort Rate' : 'Attendance Rate'}
          </span>
          <div className="mt-2 text-2xl font-black text-brand-600 dark:text-brand-400">{rate}%</div>
          <div className="mt-1.5 w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
            <div 
              className="bg-brand-600 dark:bg-brand-500 h-full rounded-full transition-all duration-500" 
              style={{ width: `${rate}%` }} 
            />
          </div>
        </div>

        <div className="glass-panel p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800">
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Present</span>
          <div className="mt-2 text-2xl font-black text-emerald-600 dark:text-emerald-400">{present}</div>
          <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">Sessions recorded</p>
        </div>

        <div className="glass-panel p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800">
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Absent</span>
          <div className="mt-2 text-2xl font-black text-rose-600 dark:text-rose-400">{absent}</div>
          <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">Unexcused missed</p>
        </div>

        <div className="glass-panel p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800">
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Active Leaves</span>
          <div className="mt-2 text-2xl font-black text-sky-600 dark:text-sky-400">{leaves.length}</div>
          <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">Applications logged</p>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2 overflow-x-auto max-w-full">
        <button
          onClick={() => setActiveTab('attendance')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap shrink-0 transition ${
            activeTab === 'attendance'
              ? 'bg-brand-600 text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <UserCheck className="w-4 h-4" />
          <span>Session Attendance Logs</span>
          <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${activeTab === 'attendance' ? 'bg-white/20 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'}`}>
            {combinedLogs.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('holidays')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap shrink-0 transition ${
            activeTab === 'holidays'
              ? 'bg-brand-600 text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Calendar className="w-4 h-4" />
          <span>School Holidays</span>
          <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${activeTab === 'holidays' ? 'bg-white/20 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'}`}>
            {holidays.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('leaves')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap shrink-0 transition ${
            activeTab === 'leaves'
              ? 'bg-brand-600 text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>Leave Applications History</span>
          <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${activeTab === 'leaves' ? 'bg-white/20 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'}`}>
            {leaves.length}
          </span>
        </button>
      </div>

      {/* Tab Content: Session Attendance Logs */}
      {activeTab === 'attendance' && (
        <div className="glass-panel rounded-3xl border border-slate-200/80 dark:border-slate-800 overflow-hidden shadow-xs">
          <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">Daily Session Logs</h3>
              <p className="text-[11px] text-slate-400 dark:text-slate-500">
                {isTeacher 
                  ? (selectedGroup === 'all'
                      ? 'Recorded attendance across all student cohorts'
                      : `Recorded attendance for ${selectedGroup}`) 
                  : 'Individual student attendance history'}
              </p>
            </div>
            
            <div className="flex items-center gap-2">
              <div className="relative w-full sm:w-64">
                <input
                  type="text"
                  value={logSearch}
                  onChange={(e) => setLogSearch(e.target.value)}
                  placeholder="Search student or date..."
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl pl-8 pr-3 py-1.5 text-xs text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                />
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>
          </div>

          {loading ? (
            <div className="p-12 text-center text-slate-400 text-sm">
              <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
              Loading attendance records...
            </div>
          ) : combinedLogs.length === 0 ? (
            <div className="p-12 text-center text-slate-500 dark:text-slate-400 text-xs">
              No session attendance logs found for this selection.
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-[500px] overflow-y-auto">
              {combinedLogs.map((row, idx) => {
                const isHoliday = row.status === 'Holiday';
                const isPresent = row.status === 'Present';
                const isAbsent = row.status === 'Absent';
                const isLeave = row.status === 'Leave';

                return (
                  <div key={idx} className="px-6 py-3.5 flex items-center justify-between hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                        isHoliday ? 'bg-sky-50 dark:bg-sky-950/80 text-sky-600 dark:text-sky-400' :
                        isPresent ? 'bg-emerald-50 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-400' :
                        isAbsent ? 'bg-rose-50 dark:bg-rose-950/80 text-rose-600 dark:text-rose-400' : 'bg-amber-50 dark:bg-amber-950/80 text-amber-600 dark:text-amber-400'
                      }`}>
                        {isHoliday ? <Calendar className="w-4 h-4" /> :
                         isPresent ? <CheckCircle2 className="w-4 h-4" /> :
                         isAbsent ? <UserX className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
                      </div>

                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-xs font-bold text-slate-900 dark:text-slate-100">
                            {isTeacher && row.student_name 
                              ? `${row.student_name} (${row.student})` 
                              : (row.title || row.course || (isHoliday ? 'School Holiday' : 'Scheduled Session'))}
                          </p>
                          {isTeacher && row.student_group && (
                            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                              {row.student_group}
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1 mt-0.5">
                          <Calendar className="w-3 h-3 text-slate-400 dark:text-slate-500" />
                          <span>Date: {row.date || row.attendance_date}</span>
                          {row.name && <span className="opacity-75 font-mono text-[10px]">· {row.name}</span>}
                        </p>
                      </div>
                    </div>

                    <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                      isHoliday ? 'bg-sky-50 text-sky-700 dark:bg-sky-950/80 dark:text-sky-300 border border-sky-200/60 dark:border-sky-800' :
                      isPresent ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/80 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800' :
                      isAbsent ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/80 dark:text-rose-400 border border-rose-200/60 dark:border-rose-800' :
                      'bg-amber-50 text-amber-700 dark:bg-amber-950/80 dark:text-amber-400 border border-amber-200/60 dark:border-amber-800'
                    }`}>
                      {row.status}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Tab Content: Academic Holidays */}
      {activeTab === 'holidays' && (
        <div className="glass-panel rounded-3xl border border-slate-200/80 dark:border-slate-800 overflow-hidden shadow-xs">
          <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">Official Academic Holidays</h3>
              <p className="text-[11px] text-slate-400 dark:text-slate-500">
                School calendar holidays for Academic Year 2026–2027
              </p>
            </div>
            <div className="relative w-full sm:w-64">
              <input
                type="text"
                value={holidaySearch}
                onChange={(e) => setHolidaySearch(e.target.value)}
                placeholder="Search holiday or date..."
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 text-xs text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
              />
            </div>
          </div>

          {holidaysLoading ? (
            <div className="p-12 text-center text-slate-400 text-sm">
              <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
              Loading school calendar holidays...
            </div>
          ) : holidays.length === 0 ? (
            <div className="p-12 text-center text-slate-500 dark:text-slate-400 text-xs">
              No school holidays configured in the academic calendar.
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-[480px] overflow-y-auto">
              {holidays
                .filter(h => {
                  if (!holidaySearch.trim()) return true;
                  const q = holidaySearch.toLowerCase();
                  return (
                    (h.description || '').toLowerCase().includes(q) ||
                    (String(h.holiday_date) || '').toLowerCase().includes(q)
                  );
                })
                .map((h, idx) => (
                  <div key={idx} className="px-6 py-3.5 flex items-center justify-between hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 bg-sky-50 dark:bg-sky-950/80 text-sky-600 dark:text-sky-400">
                        <Calendar className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-900 dark:text-slate-100">
                          {h.description}
                        </p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1">
                          <Clock className="w-3 h-3 text-slate-400 dark:text-slate-500" />
                          {String(h.holiday_date)}
                        </p>
                      </div>
                    </div>
                    <span className="px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider bg-sky-50 text-sky-700 dark:bg-sky-950/80 dark:text-sky-300 border border-sky-200/60 dark:border-sky-800">
                      School Holiday
                    </span>
                  </div>
                ))}
            </div>
          )}
        </div>
      )}

      {/* Tab Content: Leave Applications History */}
      {activeTab === 'leaves' && (
        <div className="glass-panel rounded-3xl border border-slate-200/80 dark:border-slate-800 overflow-hidden shadow-xs">
          <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <div>
              <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">Student Leave Applications</h3>
              <p className="text-[11px] text-slate-400 dark:text-slate-500">Official requests filed by students</p>
            </div>
            <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">{leaves.length} applications</span>
          </div>

          {leavesLoading ? (
            <div className="p-12 text-center text-slate-400 text-sm">
              <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
              Loading leave applications...
            </div>
          ) : leaves.length === 0 ? (
            <div className="p-12 text-center text-slate-500 dark:text-slate-400 text-xs">
              No leave applications submitted yet. Click "Apply for Leave" above to request absence.
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {leaves.map((leave, idx) => {
                const isApproved = leave.docstatus === 1;
                const isDraft = leave.docstatus === 0;
                const isCancelled = leave.docstatus === 2;

                return (
                  <div key={leave.name || idx} className="p-5 hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-xs font-bold text-brand-600 dark:text-brand-400 bg-brand-50 dark:bg-brand-950/80 px-2.5 py-0.5 rounded-md border border-brand-200/60 dark:border-brand-800">
                          {leave.name}
                        </span>
                        <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                          {leave.student_name || leave.student}
                        </span>
                        <span className="text-[11px] text-slate-400 dark:text-slate-500">
                          · {leave.attendance_based_on || 'Student Group'}
                        </span>
                      </div>

                      <div className="flex items-center gap-4 text-xs text-slate-600 dark:text-slate-300">
                        <div className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          <span>From: <strong className="text-slate-800 dark:text-slate-200">{leave.from_date}</strong></span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          <span>To: <strong className="text-slate-800 dark:text-slate-200">{leave.to_date}</strong></span>
                        </div>
                      </div>

                      <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/60 text-xs text-slate-700 dark:text-slate-300">
                        <span className="font-semibold text-slate-500 dark:text-slate-400">Reason: </span>
                        {leave.reason || 'Not specified'}
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0 sm:self-center">
                      <span className={`px-3 py-1 rounded-full text-xs font-bold border flex items-center gap-1.5 ${
                        isApproved
                          ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/80 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800'
                          : isDraft
                          ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/80 dark:text-amber-400 border-amber-200 dark:border-amber-800'
                          : 'bg-rose-50 text-rose-700 dark:bg-rose-950/80 dark:text-rose-400 border-rose-200 dark:border-rose-800'
                      }`}>
                        {isApproved && <CheckCircle2 className="w-3.5 h-3.5" />}
                        {isDraft && <Clock className="w-3.5 h-3.5" />}
                        {isCancelled && <AlertCircle className="w-3.5 h-3.5" />}
                        <span>{isApproved ? 'Approved' : isDraft ? 'Pending Approval' : 'Cancelled'}</span>
                      </span>

                      {/* Staff approval button */}
                      {(isInstructor || isAdmin) && isDraft && (
                        <button
                          onClick={() => handleApproveLeave(leave.name)}
                          disabled={approvingId === leave.name}
                          className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold flex items-center gap-1.5 shadow-xs transition active:scale-95 disabled:opacity-50"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>{approvingId === leave.name ? 'Approving...' : 'Approve'}</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Teacher Mark Attendance Modal Dialog */}
      {isMarkModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-2xl w-full max-h-[92vh] flex flex-col my-auto overflow-hidden shadow-2xl border border-slate-100 dark:border-slate-800 animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 pb-3 border-b border-slate-100 dark:border-slate-800 shrink-0 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-brand-50 dark:bg-brand-950/80 text-brand-600 dark:text-brand-400 flex items-center justify-center shrink-0">
                  <UserCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-slate-900 dark:text-slate-100">
                    Mark Class Attendance Register
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Verify daily presence and record attendance directly into Frappe Education
                  </p>
                </div>
              </div>

              <button
                onClick={() => setIsMarkModalOpen(false)}
                className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 flex items-center justify-center transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-5 space-y-4">
              {/* Selection Controls Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Session Date
                  </label>
                  <input
                    type="date"
                    value={markingDate}
                    onChange={(e) => {
                      setMarkingDate(e.target.value);
                      loadRoster(markingGroup, e.target.value);
                    }}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2 text-xs font-medium text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Student Group / Cohort
                  </label>
                  <div className="relative">
                    <select
                      value={markingGroup}
                      onChange={(e) => {
                        setMarkingGroup(e.target.value);
                        loadRoster(e.target.value, markingDate);
                      }}
                      className="w-full appearance-none bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2 pr-8 text-xs font-semibold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                    >
                      {availableGroups.map((grpName, idx) => (
                        <option key={idx} value={grpName}>{grpName}</option>
                      ))}
                    </select>
                    <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>
                </div>
              </div>

              {/* Quick Batch Bar and Stats */}
              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Quick Actions:</span>
                  <button
                    type="button"
                    onClick={() => handleMarkAll('Present')}
                    className="px-2.5 py-1 rounded-lg bg-emerald-100 hover:bg-emerald-200 dark:bg-emerald-950/80 dark:hover:bg-emerald-900 text-emerald-800 dark:text-emerald-300 text-xs font-semibold flex items-center gap-1 transition"
                  >
                    <CheckCheck className="w-3.5 h-3.5" />
                    <span>All Present</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleMarkAll('Absent')}
                    className="px-2.5 py-1 rounded-lg bg-rose-100 hover:bg-rose-200 dark:bg-rose-950/80 dark:hover:bg-rose-900 text-rose-800 dark:text-rose-300 text-xs font-semibold flex items-center gap-1 transition"
                  >
                    <XCircle className="w-3.5 h-3.5" />
                    <span>All Absent</span>
                  </button>
                </div>

                <div className="flex items-center gap-2 text-xs font-semibold">
                  <span className="text-emerald-600 dark:text-emerald-400">{modalPresentCount} Present</span>
                  <span className="text-slate-300 dark:text-slate-700">•</span>
                  <span className="text-rose-600 dark:text-rose-400">{modalAbsentCount} Absent</span>
                  {modalLeaveCount > 0 && (
                    <>
                      <span className="text-slate-300 dark:text-slate-700">•</span>
                      <span className="text-amber-600 dark:text-amber-400">{modalLeaveCount} On Leave</span>
                    </>
                  )}
                </div>
              </div>

              {/* Filter Search */}
              <div className="relative">
                <input
                  type="text"
                  value={rosterSearch}
                  onChange={(e) => setRosterSearch(e.target.value)}
                  placeholder="Filter by student name or roll number..."
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl pl-8 pr-3 py-1.5 text-xs text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                />
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>

              {/* Student Roster Table List */}
              {rosterLoading ? (
                <div className="py-12 text-center text-slate-400 text-xs">
                  <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                  Loading enrolled students for {markingGroup}...
                </div>
              ) : filteredRoster.length === 0 ? (
                <div className="py-10 text-center text-slate-500 dark:text-slate-400 text-xs">
                  No active students enrolled in {markingGroup}.
                </div>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-slate-800 overflow-y-auto pr-1">
                  {filteredRoster.map((s) => {
                    const isPresent = s.selectedStatus === 'Present';
                    const isAbsent = s.selectedStatus === 'Absent';
                    const isLeave = s.selectedStatus === 'Leave';

                    return (
                      <div
                        key={s.student}
                        className="py-3 px-1 flex items-center justify-between gap-3 hover:bg-slate-50/60 dark:hover:bg-slate-800/40 rounded-xl transition"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-8 h-8 rounded-full bg-brand-100 dark:bg-brand-950/80 text-brand-700 dark:text-brand-300 font-semibold text-xs flex items-center justify-center shrink-0">
                            {s.student_name ? s.student_name.charAt(0) : 'S'}
                          </div>

                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-bold text-xs text-slate-900 dark:text-slate-100 truncate">
                                {s.student_name}
                              </span>
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-slate-100 dark:bg-slate-800 text-slate-500">
                                #{s.group_roll_number || '–'}
                              </span>
                            </div>

                            <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                              <span>{s.student}</span>
                              {s.on_leave && (
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-50 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                                  Approved Leave {s.leave_reason ? `(${s.leave_reason})` : ''}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Status Toggle Buttons */}
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleToggleStudent(s.student, 'Present')}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1 ${
                              isPresent
                                ? 'bg-emerald-600 text-white shadow-xs'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                            }`}
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>Present</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleToggleStudent(s.student, 'Absent')}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1 ${
                              isAbsent
                                ? 'bg-rose-600 text-white shadow-xs'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                            }`}
                          >
                            <X className="w-3.5 h-3.5" />
                            <span>Absent</span>
                          </button>

                          {isLeave && (
                            <span className="px-2.5 py-1 rounded-xl text-xs font-bold bg-amber-500 text-white shadow-xs">
                              Leave
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Success message banner */}
              {saveSuccessMsg && (
                <div className="p-3 bg-emerald-50 dark:bg-emerald-950/80 border border-emerald-200 dark:border-emerald-800 rounded-xl text-emerald-800 dark:text-emerald-300 text-xs font-semibold flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{saveSuccessMsg}</span>
                </div>
              )}
            </div>

            {/* Modal Bottom Actions */}
            <div className="p-4 sm:p-5 pt-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/70 flex items-center justify-end gap-3 shrink-0">
              <button
                type="button"
                onClick={() => setIsMarkModalOpen(false)}
                className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleSubmitAttendance}
                disabled={savingAttendance || rosterLoading || roster.length === 0}
                className="px-5 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold shadow-md shadow-brand-500/20 transition flex items-center gap-2 disabled:opacity-50"
              >
                {savingAttendance ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Submitting Attendance...</span>
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
    </div>
  );
}
