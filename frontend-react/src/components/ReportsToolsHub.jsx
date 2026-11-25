import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/frappeClient';
import { 
  Calculator, 
  FileText, 
  UserCheck, 
  CalendarPlus, 
  UserPlus,
  Users, 
  Clock, 
  ArrowRight, 
  Sparkles, 
  FolderKanban,
  FileSpreadsheet,
  CheckCircle2,
  Clock3
} from 'lucide-react';

export default function ReportsToolsHub() {
  const navigate = useNavigate();
  const { isStaff } = useAuth();

  // Live counters from the backend (staff only)
  const [summary, setSummary] = useState(null);
  const [summaryError, setSummaryError] = useState('');
  useEffect(() => {
    if (!isStaff) return;
    let cancelled = false;
    api.getReportsToolsSummary()
      .then((data) => { if (!cancelled) setSummary(data || null); })
      .catch((err) => {
        console.error('Failed to load reports & tools summary:', err);
        if (!cancelled) setSummaryError(err.message || 'Live statistics unavailable');
      });
    return () => { cancelled = true; };
  }, [isStaff]);

  const liveStat = (fn, fallback) => (summary ? fn(summary) : (summaryError ? summaryError : fallback));

  const activeTools = [
    {
      id: 'assessment-tool',
      title: 'Assessment Result Tool',
      category: 'Academic Grading',
      description: 'Streamlined marks entry and grade calculation. Capture criteria scores (Mid-Term, Final, Viva), auto-compute percentages, and submit results directly to Frappe Assessment Result records.',
      icon: Calculator,
      color: 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border-emerald-200/60 dark:border-emerald-800',
      path: '/assessment-tool',
      badge: 'Active & Verified',
      stats: liveStat(
        (d) => `${d.assessment_plans} plans · ${d.assessment_results_submitted} published · ${d.assessment_results_draft} draft`,
        'Supports single & batch evaluation'
      ),
    },
    {
      id: 'report-card-tool',
      title: 'Student Report Generation Tool',
      category: 'Official Credentials',
      description: 'Official single-page printable student academic report card. Includes school letterhead crest, student demographics, attendance dossier, course results table, grading key, and signature blocks.',
      icon: FileText,
      color: 'bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 border-amber-200/60 dark:border-amber-800',
      path: '/report-card-tool',
      badge: 'Active & 1-Page Optimized',
      stats: liveStat(
        (d) => `${d.students_with_results} students with published results`,
        'Single student & cohort PDF generation'
      ),
    },
    {
      id: 'attendance-tool',
      title: 'Student Attendance Tool',
      category: 'Daily Operations',
      description: 'Dedicated attendance register for student groups and live course schedules. Features 1-click Mark All Present, quick absent toggles, real-time stats, and direct submission to Frappe records.',
      icon: UserCheck,
      color: 'bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border-blue-200/60 dark:border-blue-800',
      path: '/attendance-tool',
      badge: 'Active & Verified',
      stats: liveStat(
        (d) => `Today: ${d.attendance_marked_today} marked in ${d.attendance_groups_today} groups · ${d.pending_leave_applications} leave pending`,
        'Supports Group & Schedule modes'
      ),
    },
    {
      id: 'course-scheduling-tool',
      title: 'Course Scheduling Tool',
      category: 'Timetable & Planning',
      description: 'Bulk lecture scheduler across customizable date ranges, weekdays, classrooms, and instructors with conflict checks and direct sync to Frappe Course Schedule.',
      icon: CalendarPlus,
      color: 'bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 border-purple-200/60 dark:border-purple-800',
      path: '/course-scheduling-tool',
      badge: 'Active & Verified',
      stats: liveStat(
        (d) => `${d.upcoming_course_schedules} upcoming sessions · ${d.student_groups} groups`,
        'Automated recurring slot generator'
      ),
    },
    {
      id: 'program-enrollment-tool',
      title: 'Program Enrollment Tool',
      category: 'Enrollment & Promotion',
      description: 'Promote a whole class to the next standard or academic year, or admit approved applicants as students, in one run. Skips students already enrolled and reports every result.',
      icon: UserPlus,
      color: 'bg-teal-50 dark:bg-teal-950/60 text-teal-600 dark:text-teal-400 border-teal-200/60 dark:border-teal-800',
      path: '/program-enrollment-tool',
      badge: 'New',
      stats: liveStat(
        (d) => `${d.program_enrollments} enrollments · ${d.approved_applicants} approved applicants waiting`,
        'Bulk promotion & admission'
      ),
    },
    {
      id: 'student-group-tool',
      title: 'Student Group Creation Tool',
      category: 'Cohorts & Sections',
      description: 'Create all section (batch) and subject (course) groups of a class in one go, filled with the enrolled students, with a suggested teacher, room and max strength per group.',
      icon: Users,
      color: 'bg-orange-50 dark:bg-orange-950/60 text-orange-600 dark:text-orange-400 border-orange-200/60 dark:border-orange-800',
      path: '/student-group-tool',
      badge: 'New',
      stats: liveStat(
        (d) => `${d.student_groups} active groups`,
        'Batch & course groups in bulk'
      ),
    },
  ];

  const upcomingTools = [
    {
      title: 'Timetable Generator',
      category: 'Master Schedules',
      description: 'Algorithmic automated timetable solver that allocates courses, rooms, breaks, and teachers without clashes.',
      icon: Clock,
      status: 'Upcoming',
    },
    {
      title: 'Monthly Attendance Sheet Report',
      category: 'Frappe Query Report',
      description: 'Comprehensive month-wise attendance percentage matrix for all enrolled students in each class/batch.',
      icon: FileSpreadsheet,
      status: 'Upcoming',
    },
  ];

  return (
    <div className="space-y-6 sm:space-y-8 min-w-0 animate-in fade-in duration-300">
      {/* 1. Header Hero */}
      <div className="p-4 sm:p-8 rounded-2xl sm:rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 max-w-full h-80 bg-brand-500/5 rounded-full blur-3xl pointer-events-none" />
        
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
          <div className="space-y-2 min-w-0">
            <div className="inline-flex max-w-full items-center gap-2 px-3 py-1 rounded-full bg-brand-50 dark:bg-brand-950/70 text-brand-700 dark:text-brand-300 border border-brand-200/60 dark:border-brand-800 text-xs font-bold">
              <FolderKanban className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">Frappe Education Desk Management</span>
            </div>
            <h1 className="text-xl sm:text-3xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
              Academic Reports &amp; Management Tools
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 max-w-2xl leading-relaxed">
              Consolidated command center for academic result processing, official report cards, attendance tracking, and administrative education workflows.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <div className="px-4 py-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 text-center">
              <span className="text-xl font-black text-brand-600 dark:text-brand-400 block font-mono">{activeTools.length}</span>
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Ready Tools</span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Active & Available Tools */}
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
          <h2 className="text-base font-extrabold text-slate-900 dark:text-slate-100 flex items-center gap-2 min-w-0">
            <Sparkles className="w-4 h-4 shrink-0 text-brand-600" />
            <span>Active Tools in Education</span>
          </h2>
          <span className="text-xs font-semibold text-slate-400">Ready for instant use</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-4 gap-4 sm:gap-5">
          {activeTools.map((tool) => {
            const Icon = tool.icon;
            return (
              <div
                key={tool.id}
                onClick={() => navigate(tool.path)}
                className="group p-4 sm:p-6 min-w-0 rounded-2xl sm:rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 hover:border-brand-500/50 dark:hover:border-brand-500/50 shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer flex flex-col justify-between"
              >
                <div className="space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className={`w-12 h-12 shrink-0 rounded-2xl flex items-center justify-center border font-black shadow-xs ${tool.color}`}>
                      <Icon className="w-6 h-6" />
                    </div>
                    <span className="inline-flex min-w-0 items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800 text-[11px] font-bold">
                      <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">{tool.badge}</span>
                    </span>
                  </div>

                  <div className="space-y-1.5">
                    <span className="text-[11px] uppercase font-bold text-slate-400 tracking-wider">
                      {tool.category}
                    </span>
                    <h3 className="text-base sm:text-lg font-black break-words text-slate-900 dark:text-slate-100 group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors">
                      {tool.title}
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                      {tool.description}
                    </p>
                  </div>
                </div>

                <div className="pt-4 mt-4 sm:pt-5 sm:mt-5 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
                  <span className="min-w-0 flex-1 basis-40 text-[11px] font-semibold text-slate-400 font-mono break-words">
                    {tool.stats}
                  </span>
                  <button
                    type="button"
                    className="shrink-0 min-h-[36px] inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 dark:bg-slate-800 hover:bg-brand-600 dark:hover:bg-brand-600 text-white text-xs font-bold transition shadow-xs group-hover:translate-x-0.5"
                  >
                    <span>Open Tool</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 3. Upcoming Frappe Education Tools & Reports */}
      <div className="space-y-4 pt-2">
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
          <h2 className="text-base font-extrabold text-slate-900 dark:text-slate-100 flex items-start sm:items-center gap-2 min-w-0">
            <Clock3 className="w-4 h-4 shrink-0 mt-0.5 sm:mt-0 text-slate-400" />
            <span>Upcoming Tools &amp; Query Reports in frappe/education</span>
          </h2>
          <span className="text-xs text-slate-400">Scheduled for implementation</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {upcomingTools.map((t, idx) => {
            const Icon = t.icon;
            return (
              <div 
                key={idx} 
                className="p-4 sm:p-5 min-w-0 rounded-2xl bg-slate-50/70 dark:bg-slate-900/40 border border-slate-200/60 dark:border-slate-800/60 flex flex-col justify-between opacity-80 hover:opacity-100 transition-opacity"
              >
                <div className="space-y-2.5">
                  <div className="w-9 h-9 rounded-xl bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center shadow-xs">
                    <Icon className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-[11px] uppercase font-bold text-slate-400 block tracking-wider">
                      {t.category}
                    </span>
                    <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 mt-0.5">
                      {t.title}
                    </h4>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug">
                    {t.description}
                  </p>
                </div>

                <div className="pt-3 mt-3 border-t border-slate-200/50 dark:border-slate-800/50 flex items-center justify-between">
                  <span className="text-[11px] font-bold text-brand-600 dark:text-brand-400 bg-brand-50 dark:bg-brand-950/60 px-2 py-0.5 rounded-md">
                    {t.status}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
