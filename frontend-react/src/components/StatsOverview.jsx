import React, { useState, useEffect } from 'react';
import { UserCheck, BookOpen, CreditCard, CalendarCheck, TrendingUp, AlertCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/frappeClient';

export default function StatsOverview({ onNavigate }) {
  const { studentProfile, activeStudentId, activeProgram, isStaff } = useAuth();
  const studentId = isStaff ? null : (activeStudentId || studentProfile?.name || null);

  const [stats, setStats] = useState({
    attendanceRate: '—',
    presentCount: 0,
    totalSessions: 0,
    courseCount: 0,
    pendingFees: 0,
    currency: '',
    nextClass: null,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    setError('');

    // Single role-scoped backend call: student -> self, guardian -> selected ward, staff -> institution
    api.getDashboardStats(studentId, activeProgram)
      .then((data) => {
        if (!isMounted) return;
        const att = data?.attendance || {};
        const fees = data?.fees || {};
        const next = data?.next_class;
        setStats({
          attendanceRate: att.rate === null || att.rate === undefined ? '—' : `${att.rate}%`,
          presentCount: att.present || 0,
          totalSessions: att.total || 0,
          courseCount: data?.course_count || 0,
          pendingFees: Number(fees.pending || 0),
          currency: fees.currency_symbol || fees.currency || '',
          nextClass: next ? {
            title: next.title || next.course,
            from_time: next.from_time || '',
            to_time: next.to_time || '',
            room: next.room_name || next.room || '',
            date: next.schedule_date,
          } : null,
        });
      })
      .catch((err) => {
        console.error('Error loading dashboard overview stats:', err);
        if (isMounted) setError(err.message || 'Unable to load dashboard statistics');
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [studentId, activeProgram]);

  const todayStr = new Date().toLocaleDateString('en-CA');
  const placeholder = loading ? '…' : null;

  return (
    <>
    {error && (
      <div className="mb-3 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-xs text-rose-700 dark:text-rose-300 flex items-center gap-2">
        <AlertCircle className="w-4 h-4 shrink-0" />
        <span className="min-w-0 break-words">{error}</span>
      </div>
    )}
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-4 sm:mb-6">
      {/* 1. Attendance Card */}
      <div 
        onClick={() => onNavigate?.('/attendance')}
        className="glass-panel p-3.5 sm:p-5 rounded-2xl min-w-0 cursor-pointer hover:shadow-glow transition-all duration-200 group border border-slate-200/70 dark:border-slate-800"
      >
        <div className="flex items-start sm:items-center justify-between gap-2">
          <span className="min-w-0 text-[11px] sm:text-xs leading-tight font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide sm:tracking-wider break-words">Attendance</span>
          <div className="w-8 h-8 sm:w-9 sm:h-9 shrink-0 rounded-xl bg-emerald-50 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-400 flex items-center justify-center group-hover:scale-110 transition-transform">
            <UserCheck className="w-5 h-5" />
          </div>
        </div>
        <div className="mt-2 sm:mt-3 flex flex-wrap items-baseline gap-x-2 gap-y-0.5 min-w-0">
          <span className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight">{placeholder || stats.attendanceRate}</span>
          {!loading && stats.totalSessions > 0 && (
            <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400 flex items-center gap-0.5">
              <TrendingUp className="w-3 h-3" />
              Verified
            </span>
          )}
        </div>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 break-words">
          {loading
            ? 'Loading attendance...'
            : stats.totalSessions > 0
              ? `${stats.presentCount} of ${stats.totalSessions} sessions logged`
              : 'No attendance recorded yet'}
        </p>
      </div>

      {/* 2. Enrolled Courses */}
      <div 
        onClick={() => onNavigate?.('/courses')}
        className="glass-panel p-3.5 sm:p-5 rounded-2xl min-w-0 cursor-pointer hover:shadow-glow transition-all duration-200 group border border-slate-200/70 dark:border-slate-800"
      >
        <div className="flex items-start sm:items-center justify-between gap-2">
          <span className="min-w-0 text-[11px] sm:text-xs leading-tight font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide sm:tracking-wider break-words">Curriculum Courses</span>
          <div className="w-8 h-8 sm:w-9 sm:h-9 shrink-0 rounded-xl bg-brand-50 dark:bg-brand-950/80 text-brand-600 dark:text-brand-400 flex items-center justify-center group-hover:scale-110 transition-transform">
            <BookOpen className="w-5 h-5" />
          </div>
        </div>
        <div className="mt-2 sm:mt-3 flex flex-wrap items-baseline gap-x-2 gap-y-0.5 min-w-0">
          <span className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight">{placeholder || stats.courseCount}</span>
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Subjects</span>
        </div>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 break-words">
          {activeProgram || (isStaff ? 'All programs' : 'No active enrollment')}
        </p>
      </div>

      {/* 3. Next Class Schedule */}
      <div 
        onClick={() => onNavigate?.('/schedule')}
        className="glass-panel p-3.5 sm:p-5 rounded-2xl min-w-0 cursor-pointer hover:shadow-glow transition-all duration-200 group border border-slate-200/70 dark:border-slate-800"
      >
        <div className="flex items-start sm:items-center justify-between gap-2">
          <span className="min-w-0 text-[11px] sm:text-xs leading-tight font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide sm:tracking-wider break-words">Next Period</span>
          <div className="w-8 h-8 sm:w-9 sm:h-9 shrink-0 rounded-xl bg-indigo-50 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-400 flex items-center justify-center group-hover:scale-110 transition-transform">
            <CalendarCheck className="w-5 h-5" />
          </div>
        </div>
        <div className="mt-2 sm:mt-3 min-w-0">
          <p className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
            {loading ? 'Loading...' : stats.nextClass ? stats.nextClass.title : 'No upcoming classes'}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
            {loading
              ? '\u00a0'
              : stats.nextClass
                ? [
                    stats.nextClass.date && stats.nextClass.date !== todayStr ? stats.nextClass.date : null,
                    `${stats.nextClass.from_time} - ${stats.nextClass.to_time}`,
                    stats.nextClass.room || null,
                  ].filter(Boolean).join(' • ')
                : 'Nothing scheduled in the timetable'}
          </p>
        </div>
      </div>

      {/* 4. Tuition / Fees Balance */}
      <div 
        onClick={() => onNavigate?.('/fees')}
        className="glass-panel p-3.5 sm:p-5 rounded-2xl min-w-0 cursor-pointer hover:shadow-glow transition-all duration-200 group border border-slate-200/70 dark:border-slate-800"
      >
        <div className="flex items-start sm:items-center justify-between gap-2">
          <span className="min-w-0 text-[11px] sm:text-xs leading-tight font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide sm:tracking-wider break-words">Tuition Fees</span>
          <div className={`w-8 h-8 sm:w-9 sm:h-9 shrink-0 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform ${
            stats.pendingFees > 0 
              ? 'bg-amber-50 dark:bg-amber-950/80 text-amber-600 dark:text-amber-400' 
              : 'bg-emerald-50 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-400'
          }`}>
            <CreditCard className="w-5 h-5" />
          </div>
        </div>
        <div className="mt-2 sm:mt-3 flex flex-wrap items-baseline gap-x-2 gap-y-0.5 min-w-0">
          <span className={`text-xl sm:text-2xl font-extrabold tracking-tight break-all ${
            stats.pendingFees > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-900 dark:text-slate-100'
          }`}>
            {placeholder || `${stats.currency}${stats.pendingFees.toLocaleString()}`}
          </span>
          {!loading && (
            <span className={`text-xs font-medium ${stats.pendingFees > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
              {stats.pendingFees > 0 ? 'Due soon' : 'All Clear'}
            </span>
          )}
        </div>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 break-words">
          {loading ? 'Loading invoices...' : stats.pendingFees > 0 ? 'Click to review invoices' : 'No outstanding balances'}
        </p>
      </div>
    </div>
    </>
  );
}
