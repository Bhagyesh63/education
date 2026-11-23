import React, { useState, useEffect, useRef } from 'react';
import { 
  Award, 
  Sparkles, 
  Calendar, 
  User, 
  BookOpen, 
  Search, 
  Plus, 
  X, 
  CheckCircle2, 
  AlertCircle, 
  GraduationCap, 
  Users, 
  Medal, 
  Trophy, 
  Star,
  ExternalLink,
  ChevronDown,
  Trash2,
  Printer,
  FileText,
  HeartPulse,
  ShieldCheck,
  Filter
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/frappeClient';

export default function AchievementsView() {
  const { 
    studentProfile, 
    activeStudentId, 
    isGuardian, 
    students, 
    selectStudent, 
    isStaff, 
    isInstructor, 
    isAdmin 
  } = useAuth();

  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTypeFilter, setSelectedTypeFilter] = useState('all'); // 'all' | 'Achievement' | 'Academic' | 'General' | 'Medical'
  const [selectedProgramFilter, setSelectedProgramFilter] = useState('all');
  const [selectedYearFilter, setSelectedYearFilter] = useState('all');
  const [staffStudentFilter, setStaffStudentFilter] = useState('all');

  // Modal state for recording new achievement / log (Staff / Faculty only)
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [directoryStudents, setDirectoryStudents] = useState([]);
  const [formData, setFormData] = useState({
    student: '',
    log_type: 'Achievement',
    program: 'Standard 5',
    academic_year: '2026-2027',
    academic_term: '2026-2027 (Term 1)',
    date: new Date().toISOString().split('T')[0],
    log: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState(false);

  // Certificate Credential Modal
  const [selectedCertificate, setSelectedCertificate] = useState(null);
  const certificatePrintRef = useRef(null);

  // Delete Log State
  const [deletingId, setDeletingId] = useState(null);

  // Fetch directory students for modal & filter if staff
  useEffect(() => {
    if (isStaff) {
      api.getStudentDirectory()
        .then((data) => {
          if (Array.isArray(data)) {
            setDirectoryStudents(data);
            if (data.length > 0 && !formData.student) {
              setFormData((prev) => ({ ...prev, student: data[0].name }));
            }
          }
        })
        .catch(() => {});
    }
  }, [isStaff]);

  // Main fetch function for student logs & achievements
  const fetchLogs = () => {
    setLoading(true);
    let targetStudent = null;

    if (isStaff) {
      targetStudent = staffStudentFilter === 'all' ? null : staffStudentFilter;
    } else {
      targetStudent = activeStudentId || studentProfile?.name || null;
    }
    
    api.getStudentLogs(targetStudent, selectedTypeFilter === 'all' ? null : selectedTypeFilter)
      .then((data) => {
        setLogs(Array.isArray(data) ? data : []);
      })
      .catch((err) => {
        console.error('Error fetching student logs:', err);
        setLogs([]);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchLogs();
  }, [activeStudentId, isStaff, staffStudentFilter, selectedTypeFilter]);

  // Strip HTML helper to render text cleanly
  const renderLogContent = (htmlContent) => {
    if (!htmlContent) return '';
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = htmlContent;
    return tempDiv.textContent || tempDiv.innerText || htmlContent;
  };

  // Format date helper
  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  // Handle Form Submit for Staff
  const handleSubmitLog = async (e) => {
    e.preventDefault();
    if (!formData.student || !formData.log.trim()) {
      setFormError('Please select a student and provide accolade details.');
      return;
    }

    setSubmitting(true);
    setFormError('');
    setFormSuccess(false);

    try {
      await api.createStudentLog({
        student: formData.student,
        log_type: formData.log_type,
        log: `<p>${formData.log.trim()}</p>`,
        program: formData.program,
        academic_year: formData.academic_year,
        academic_term: formData.academic_term,
        date: formData.date,
      });

      setFormSuccess(true);
      fetchLogs();
      setTimeout(() => {
        setIsModalOpen(false);
        setFormSuccess(false);
        setFormData((prev) => ({ ...prev, log: '' }));
      }, 1200);
    } catch (err) {
      setFormError(err.message || 'Failed to record student log.');
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Delete Log for Staff
  const handleDeleteLog = async (logName) => {
    if (!window.confirm(`Are you sure you want to delete log ${logName}? This action cannot be undone.`)) {
      return;
    }
    setDeletingId(logName);
    try {
      await api.deleteStudentLog(logName);
      fetchLogs();
    } catch (err) {
      console.error('Failed to delete log:', err);
      alert(err.message || 'Failed to delete log.');
    } finally {
      setDeletingId(null);
    }
  };

  // Print Certificate Helper
  const handlePrintCertificate = () => {
    window.print();
  };

  // Filter logs by search query, program, and academic year
  const filteredLogs = logs.filter((item) => {
    const rawText = renderLogContent(item.log).toLowerCase();
    const studentName = (item.student_name || '').toLowerCase();
    const studentId = (item.student || '').toLowerCase();
    const query = searchQuery.toLowerCase();

    const matchesSearch = !query || rawText.includes(query) || studentName.includes(query) || studentId.includes(query);
    const matchesProgram = selectedProgramFilter === 'all' || item.program === selectedProgramFilter;
    const matchesYear = selectedYearFilter === 'all' || item.academic_year === selectedYearFilter;

    return matchesSearch && matchesProgram && matchesYear;
  });

  const availablePrograms = Array.from(
    new Set(['Standard 5', 'Standard 6', ...logs.map((a) => a.program).filter(Boolean)])
  ).sort();

  const availableYears = Array.from(
    new Set(['2026-2027', '2027-2028', ...logs.map((a) => a.academic_year).filter(Boolean)])
  ).sort();

  // Helper for type badges and colors
  const getTypeBadge = (type) => {
    switch (type) {
      case 'Achievement':
        return {
          icon: Trophy,
          label: 'Achievement',
          badgeClass: 'bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-400 border-amber-300 dark:border-amber-800',
          gradient: 'from-amber-500 to-orange-500',
          shadow: 'shadow-amber-500/20',
        };
      case 'Academic':
        return {
          icon: GraduationCap,
          label: 'Academic Honor',
          badgeClass: 'bg-blue-100 dark:bg-blue-950/80 text-blue-700 dark:text-blue-400 border-blue-300 dark:border-blue-800',
          gradient: 'from-blue-600 to-indigo-600',
          shadow: 'shadow-blue-500/20',
        };
      case 'Medical':
        return {
          icon: HeartPulse,
          label: 'Medical & Wellness',
          badgeClass: 'bg-rose-100 dark:bg-rose-950/80 text-rose-700 dark:text-rose-400 border-rose-300 dark:border-rose-800',
          gradient: 'from-rose-500 to-pink-500',
          shadow: 'shadow-rose-500/20',
        };
      default:
        return {
          icon: FileText,
          label: 'General Notice',
          badgeClass: 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-400 border-emerald-300 dark:border-emerald-800',
          gradient: 'from-emerald-600 to-teal-600',
          shadow: 'shadow-emerald-500/20',
        };
    }
  };

  return (
    <div className="space-y-6 max-w-full overflow-hidden animate-fade-in">
      {/* Top Banner Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-500 via-orange-500 to-yellow-400 text-white flex items-center justify-center shadow-lg shadow-amber-500/20 shrink-0">
            <Trophy className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-black text-slate-900 dark:text-slate-100 tracking-tight flex items-center gap-2">
              <span>Student Achievements & Recognitions</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full font-mono font-bold bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border border-amber-200/80 dark:border-amber-800/80">
                Official Logs
              </span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {isStaff 
                ? 'Institutional student honors, competition awards, and academic milestones'
                : isGuardian 
                ? 'Recognitions, interschool honors, and merit certificates awarded to your ward'
                : 'Your verified academic accolades, competition awards, and institutional credentials'}
            </p>
          </div>
        </div>

        {/* Action button for faculty */}
        {isStaff && (
          <button
            onClick={() => {
              setIsModalOpen(true);
              setFormError('');
              setFormSuccess(false);
            }}
            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white text-xs font-bold shadow-md shadow-amber-500/20 transition active:scale-95 shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Record New Milestone</span>
          </button>
        )}
      </div>

      {/* KPI Metric Summary Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="glass-panel p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/80 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
            <Award className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Total Records
            </p>
            <p className="text-lg font-black text-slate-900 dark:text-slate-100">
              {logs.length}
            </p>
          </div>
        </div>

        <div className="glass-panel p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/80 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
            <Medal className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Academic Term
            </p>
            <p className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">
              {logs[0]?.academic_term || '2026-2027 (Term 1)'}
            </p>
          </div>
        </div>

        <div className="glass-panel p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Status Verification
            </p>
            <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
              Authenticated & Official
            </p>
          </div>
        </div>

        <div className="glass-panel p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-950/80 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
            <Star className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              {isStaff ? 'Honored Cohort' : 'Student Status'}
            </p>
            <p className="text-xs font-bold text-purple-600 dark:text-purple-400 truncate">
              {isStaff ? (staffStudentFilter === 'all' ? 'All Students' : staffStudentFilter) : (studentProfile?.student_name || 'Enrolled Student')}
            </p>
          </div>
        </div>
      </div>

      {/* Ward Switcher Pill for Guardians */}
      {isGuardian && students && students.length > 1 && (
        <div className="flex items-center gap-2 p-2 rounded-2xl bg-slate-100 dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800">
          <span className="text-xs font-bold text-slate-600 dark:text-slate-400 px-2 flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5" />
            <span>Select Ward:</span>
          </span>
          <div className="flex items-center gap-1.5 flex-wrap">
            {students.map((w) => {
              const isSelected = activeStudentId === w.student;
              return (
                <button
                  key={w.student}
                  onClick={() => selectStudent(w.student)}
                  className={`px-3 py-1 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                    isSelected
                      ? 'bg-amber-500 text-white shadow-xs'
                      : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  <User className="w-3 h-3" />
                  <span>{w.student_name}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Category Filter Tabs */}
      <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-2xl overflow-x-auto w-full">
        {[
          { id: 'all', label: 'All Milestones', icon: Award },
          { id: 'Achievement', label: 'Honors & Competitions', icon: Trophy },
          { id: 'Academic', label: 'Academic Accolades', icon: GraduationCap },
          { id: 'General', label: 'General Activity', icon: FileText },
          { id: 'Medical', label: 'Health & Wellness', icon: HeartPulse },
        ].map((tab) => {
          const Icon = tab.icon;
          const active = selectedTypeFilter === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setSelectedTypeFilter(tab.id)}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap ${
                active
                  ? 'bg-white dark:bg-slate-700 text-amber-600 dark:text-amber-300 shadow-xs'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Search and Secondary Filter Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white/60 dark:bg-slate-900/60 p-3 rounded-2xl border border-slate-200/80 dark:border-slate-800 backdrop-blur-md">
        {/* Search */}
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search honors, competitions, or students..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl pl-9 pr-3 py-1.5 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/30"
          />
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end flex-wrap">
          {/* Staff Student Selector */}
          {isStaff && (
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1">
                <User className="w-3.5 h-3.5" />
                <span>Student:</span>
              </span>
              <select
                value={staffStudentFilter}
                onChange={(e) => setStaffStudentFilter(e.target.value)}
                className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-2.5 py-1.5 text-xs font-semibold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500/30 cursor-pointer max-w-[150px] truncate"
              >
                <option value="all">All Students</option>
                {directoryStudents.map((s) => (
                  <option key={s.name} value={s.name}>
                    {s.student_name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Program filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1">
              <BookOpen className="w-3.5 h-3.5" />
              <span>Program:</span>
            </span>
            <div className="relative">
              <select
                value={selectedProgramFilter}
                onChange={(e) => setSelectedProgramFilter(e.target.value)}
                className="appearance-none bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl pl-3 pr-8 py-1.5 text-xs font-semibold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500/30 cursor-pointer"
              >
                <option value="all">All Programs</option>
                {availablePrograms.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
              <ChevronDown className="w-3 h-3 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          {/* Academic Year filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5" />
              <span>Year:</span>
            </span>
            <div className="relative">
              <select
                value={selectedYearFilter}
                onChange={(e) => setSelectedYearFilter(e.target.value)}
                className="appearance-none bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl pl-3 pr-8 py-1.5 text-xs font-semibold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500/30 cursor-pointer"
              >
                <option value="all">All Years</option>
                {availableYears.map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
              <ChevronDown className="w-3 h-3 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Grid */}
      {loading ? (
        <div className="py-20 flex flex-col items-center justify-center space-y-3">
          <div className="w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs font-semibold text-slate-400">Loading student records...</p>
        </div>
      ) : filteredLogs.length === 0 ? (
        <div className="glass-panel p-12 rounded-3xl border border-slate-200/80 dark:border-slate-800 text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-amber-50 dark:bg-amber-950/60 text-amber-500 flex items-center justify-center mx-auto shadow-xs">
            <Award className="w-7 h-7" />
          </div>
          <div className="space-y-1 max-w-sm mx-auto">
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
              No Milestones Found
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {searchQuery || selectedTypeFilter !== 'all' || selectedProgramFilter !== 'all'
                ? 'No student logs match your current search filters. Try clearing the filters.'
                : 'No official student milestones or achievements have been recorded yet.'}
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
          {filteredLogs.map((item) => {
            const cleanContent = renderLogContent(item.log);
            const badgeMeta = getTypeBadge(item.type);
            const IconComponent = badgeMeta.icon;

            return (
              <div
                key={item.name}
                className="glass-panel p-5 sm:p-6 rounded-3xl border border-slate-200/80 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 shadow-xs hover:shadow-md transition-all duration-200 relative overflow-hidden flex flex-col justify-between group"
              >
                {/* Ambient Top Glow */}
                <div className={`absolute top-0 right-0 w-32 h-32 bg-gradient-to-br ${badgeMeta.gradient} opacity-5 rounded-full blur-2xl pointer-events-none group-hover:opacity-10 transition`} />

                <div className="space-y-4">
                  {/* Card Header with Badges and Date */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <div className={`w-10 h-10 rounded-2xl bg-gradient-to-tr ${badgeMeta.gradient} text-white flex items-center justify-center shadow-md ${badgeMeta.shadow} shrink-0`}>
                        <IconComponent className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs font-black text-slate-900 dark:text-slate-100">
                            {item.student_name || 'Student'}
                          </span>
                          <span className={`text-[10px] font-extrabold px-2 py-0.2 rounded-full border ${badgeMeta.badgeClass}`}>
                            {badgeMeta.label}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400 font-mono mt-0.5">
                          {item.student || 'EDU-STU-2026-00001'}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1 text-[11px] font-semibold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800/80 px-2.5 py-1 rounded-xl">
                        <Calendar className="w-3 h-3 text-slate-400" />
                        <span>{formatDate(item.date)}</span>
                      </div>

                      {/* Staff Delete Button */}
                      {isStaff && (
                        <button
                          onClick={() => handleDeleteLog(item.name)}
                          disabled={deletingId === item.name}
                          className="p-1 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/60 text-slate-400 hover:text-rose-600 transition"
                          title="Delete Student Log"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Academic Program & Cohort Tags */}
                  <div className="flex items-center gap-2 flex-wrap text-[11px] text-slate-600 dark:text-slate-300">
                    <span className="px-2.5 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 font-medium">
                      Program: <strong className="text-slate-900 dark:text-slate-100">{item.program || 'Standard 5'}</strong>
                    </span>
                    {item.academic_term && (
                      <span className="px-2.5 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 font-medium">
                        Term: <strong className="text-slate-900 dark:text-slate-100">{item.academic_term}</strong>
                      </span>
                    )}
                  </div>

                  {/* Recognition Description Body */}
                  <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 text-slate-800 dark:text-slate-200 text-xs sm:text-sm leading-relaxed font-normal">
                    <p>{cleanContent}</p>
                  </div>

                  {/* Certificate Attachments */}
                  {item.attachments && item.attachments.length > 0 && (
                    <div className="pt-1 flex flex-wrap gap-2">
                      {item.attachments.map((att, idx) => (
                        <a
                          key={idx}
                          href={att.file_url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700/60 text-xs font-bold transition shadow-2xs"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          <span>{att.file_name || 'Certificate Credential'}</span>
                        </a>
                      ))}
                    </div>
                  )}
                </div>

                {/* Card Footer with Verification Strip and Action */}
                <div className="pt-4 mt-4 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-[11px] gap-2">
                  <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-semibold truncate">
                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">Verified Record ({item.name})</span>
                  </div>

                  {/* Official Certificate Preview Button */}
                  <button
                    onClick={() => setSelectedCertificate(item)}
                    className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-amber-50 dark:bg-amber-950/80 hover:bg-amber-100 text-amber-700 dark:text-amber-300 font-bold text-xs transition shrink-0"
                  >
                    <Trophy className="w-3.5 h-3.5" />
                    <span>View Certificate</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Official Certificate Award Modal */}
      {selectedCertificate && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-fade-in">
          <div className="bg-white dark:bg-slate-900 border border-amber-500/30 rounded-3xl shadow-2xl max-w-2xl w-full p-6 sm:p-8 space-y-6 relative overflow-hidden my-8">
            {/* Ambient Background Seals */}
            <div className="absolute -top-12 -right-12 w-48 h-48 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -bottom-12 -left-12 w-48 h-48 bg-orange-500/10 rounded-full blur-3xl pointer-events-none" />

            {/* Modal Controls Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 print:hidden">
              <span className="text-xs font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4" />
                <span>Official Institutional Credential</span>
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={handlePrintCertificate}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-200 text-xs font-bold transition"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print Certificate</span>
                </button>
                <button
                  onClick={() => setSelectedCertificate(null)}
                  className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-700 flex items-center justify-center transition"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Printable Certificate Frame */}
            <div 
              ref={certificatePrintRef}
              className="p-8 sm:p-12 rounded-2xl border-4 border-double border-amber-500/60 bg-gradient-to-b from-amber-50/40 via-white to-amber-50/20 dark:from-slate-900 dark:via-slate-900/90 dark:to-slate-900/60 text-center space-y-6 relative shadow-inner"
            >
              <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-amber-500 to-orange-500 text-white flex items-center justify-center mx-auto shadow-lg shadow-amber-500/30">
                <Trophy className="w-8 h-8" />
              </div>

              <div className="space-y-1">
                <h4 className="text-xs font-mono font-bold uppercase tracking-widest text-amber-600 dark:text-amber-400">
                  Institution of Frappe Education
                </h4>
                <h3 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
                  Certificate of Recognition
                </h3>
                <p className="text-xs text-slate-500 italic">This is officially presented to</p>
              </div>

              <div className="py-2 border-b-2 border-slate-300 dark:border-slate-700 max-w-md mx-auto">
                <h2 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-slate-100 tracking-tight text-amber-700 dark:text-amber-300">
                  {selectedCertificate.student_name || 'Rahul Sharma'}
                </h2>
                <p className="text-[11px] font-mono text-slate-400 mt-0.5">
                  Student ID: {selectedCertificate.student}
                </p>
              </div>

              <div className="max-w-lg mx-auto text-xs sm:text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                <p>{renderLogContent(selectedCertificate.log)}</p>
              </div>

              <div className="pt-8 flex items-center justify-between text-left text-xs border-t border-slate-200 dark:border-slate-800">
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Academic Program</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    {selectedCertificate.program || 'Standard 5'} ({selectedCertificate.academic_year || '2026-2027'})
                  </span>
                </div>
                <div className="text-center">
                  <div className="w-12 h-12 rounded-full border-2 border-amber-500 text-amber-500 flex items-center justify-center mx-auto">
                    <ShieldCheck className="w-6 h-6" />
                  </div>
                  <span className="text-[9px] uppercase font-bold text-slate-400 block mt-1">Official Seal</span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Date Conferred</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    {formatDate(selectedCertificate.date)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Record Milestone Modal for Faculty / Staff */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-lg max-h-[92vh] flex flex-col my-auto overflow-hidden shadow-2xl">
            <div className="p-4 sm:p-5 pb-3 border-b border-slate-100 dark:border-slate-800 shrink-0 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-500 text-white flex items-center justify-center">
                  <Award className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                    Record Student Milestone
                  </h3>
                  <p className="text-[11px] text-slate-500">Log honors, accolades, competition awards, or general notices</p>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 flex items-center justify-center transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitLog} className="flex-1 min-h-0 flex flex-col overflow-hidden">
              <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
                {formError && (
                  <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{formError}</span>
                  </div>
                )}

                {formSuccess && (
                  <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 text-emerald-700 dark:text-emerald-300 text-xs flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span>Milestone successfully recorded into official student record!</span>
                  </div>
                )}

                {/* Select Student */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Target Student
                  </label>
                  <select
                    value={formData.student}
                    onChange={(e) => setFormData({ ...formData, student: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500/30"
                    required
                  >
                    {directoryStudents.map((s) => (
                      <option key={s.name} value={s.name}>
                        {s.student_name} ({s.name})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Log Type & Program */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      Category Type
                    </label>
                    <select
                      value={formData.log_type}
                      onChange={(e) => setFormData({ ...formData, log_type: e.target.value })}
                      className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold text-slate-900 dark:text-slate-100"
                    >
                      <option value="Achievement">Achievement & Award</option>
                      <option value="Academic">Academic Recognition</option>
                      <option value="General">General Notice</option>
                      <option value="Medical">Medical / Health Note</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      Program
                    </label>
                    <select
                      value={formData.program}
                      onChange={(e) => setFormData({ ...formData, program: e.target.value })}
                      className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold text-slate-900 dark:text-slate-100"
                    >
                      <option value="Standard 5">Standard 5</option>
                      <option value="Standard 6">Standard 6</option>
                    </select>
                  </div>
                </div>

                {/* Date & Term */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      Conferred Date
                    </label>
                    <input
                      type="date"
                      value={formData.date}
                      onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                      className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold text-slate-900 dark:text-slate-100"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      Academic Term
                    </label>
                    <select
                      value={formData.academic_term}
                      onChange={(e) => setFormData({ ...formData, academic_term: e.target.value })}
                      className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold text-slate-900 dark:text-slate-100"
                    >
                      <option value="2026-2027 (Term 1)">2026-2027 (Term 1)</option>
                      <option value="2026-2027 (Term 2)">2026-2027 (Term 2)</option>
                      <option value="2027-2028 (Term 1)">2027-2028 (Term 1)</option>
                      <option value="2027-2028 (Term 2)">2027-2028 (Term 2)</option>
                    </select>
                  </div>
                </div>

                {/* Milestone Details */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Accolade Description & Citations
                  </label>
                  <textarea
                    rows={4}
                    placeholder="e.g. Awarded 1st place in the State Mathematics Olympiad for outstanding performance..."
                    value={formData.log}
                    onChange={(e) => setFormData({ ...formData, log: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/30"
                    required
                  />
                </div>
              </div>

              {/* Modal Buttons */}
              <div className="p-4 sm:p-5 pt-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/70 flex items-center gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold shadow-md shadow-amber-500/20 transition active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {submitting ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <span>Confirm & Save Log</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
