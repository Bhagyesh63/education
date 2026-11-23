import React from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Calculator, 
  FileText, 
  UserCheck, 
  CalendarPlus, 
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
      stats: 'Supports single & batch evaluation',
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
      stats: 'Single student & cohort PDF generation',
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
      stats: 'Supports Group & Schedule modes',
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
      stats: 'Automated recurring slot generator',
    },
  ];

  const upcomingTools = [
    {
      title: 'Student Group Creation Tool',
      category: 'Cohorts & Sections',
      description: 'Automated cohort and section splitter based on program capacity, batch naming rules, and student quotas.',
      icon: Users,
      status: 'Next in Pipeline',
    },
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
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* 1. Header Hero */}
      <div className="p-6 sm:p-8 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-brand-500/5 rounded-full blur-3xl pointer-events-none" />
        
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-50 dark:bg-brand-950/70 text-brand-700 dark:text-brand-300 border border-brand-200/60 dark:border-brand-800 text-xs font-bold">
              <FolderKanban className="w-3.5 h-3.5" />
              <span>Frappe Education Desk Management</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
              Academic Reports &amp; Management Tools
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 max-w-2xl leading-relaxed">
              Consolidated command center for academic result processing, official report cards, attendance tracking, and administrative education workflows.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="px-4 py-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 text-center">
              <span className="text-xl font-black text-brand-600 dark:text-brand-400 block font-mono">4</span>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Ready Tools</span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Active & Available Tools */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-extrabold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-brand-600" />
            <span>Active Tools in Education</span>
          </h2>
          <span className="text-xs font-semibold text-slate-400">Ready for instant use</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-4 gap-5">
          {activeTools.map((tool) => {
            const Icon = tool.icon;
            return (
              <div
                key={tool.id}
                onClick={() => navigate(tool.path)}
                className="group p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 hover:border-brand-500/50 dark:hover:border-brand-500/50 shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer flex flex-col justify-between"
              >
                <div className="space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center border font-black shadow-xs ${tool.color}`}>
                      <Icon className="w-6 h-6" />
                    </div>
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800 text-[11px] font-bold">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      {tool.badge}
                    </span>
                  </div>

                  <div className="space-y-1.5">
                    <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                      {tool.category}
                    </span>
                    <h3 className="text-lg font-black text-slate-900 dark:text-slate-100 group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors">
                      {tool.title}
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                      {tool.description}
                    </p>
                  </div>
                </div>

                <div className="pt-5 mt-5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-slate-400 font-mono">
                    {tool.stats}
                  </span>
                  <button
                    type="button"
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 dark:bg-slate-800 hover:bg-brand-600 dark:hover:bg-brand-600 text-white text-xs font-bold transition shadow-xs group-hover:translate-x-0.5"
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
        <div className="flex items-center justify-between">
          <h2 className="text-base font-extrabold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Clock3 className="w-4 h-4 text-slate-400" />
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
                className="p-5 rounded-2xl bg-slate-50/70 dark:bg-slate-900/40 border border-slate-200/60 dark:border-slate-800/60 flex flex-col justify-between opacity-80 hover:opacity-100 transition-opacity"
              >
                <div className="space-y-2.5">
                  <div className="w-9 h-9 rounded-xl bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center shadow-xs">
                    <Icon className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-[9px] uppercase font-bold text-slate-400 block tracking-wider">
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
                  <span className="text-[10px] font-bold text-brand-600 dark:text-brand-400 bg-brand-50 dark:bg-brand-950/60 px-2 py-0.5 rounded-md">
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
