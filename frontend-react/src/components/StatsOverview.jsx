import React, { useState, useEffect } from 'react';
import { UserCheck, BookOpen, CreditCard, CalendarCheck, TrendingUp } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/frappeClient';

export default function StatsOverview({ onNavigate }) {
  const { studentProfile, activeStudentId, activeProgram, studentGroups } = useAuth();
  const studentId = activeStudentId || studentProfile?.name;

  const [stats, setStats] = useState({
    attendanceRate: '100%',
    presentCount: 0,
    totalSessions: 0,
    courseCount: 0,
    pendingFees: 0,
    currency: '₹',
    nextClass: null,
  });

  useEffect(() => {
    let isMounted = true;

    async function computeRealStats() {
      try {
        const promises = [
          // 1. Attendance
          studentId ? api.getStudentAttendance(studentId, studentGroups?.[0]?.label || studentGroups?.[0]) : Promise.resolve([]),
          // 2. Courses
          activeProgram ? api.getCourseListBasedOnProgram(activeProgram) : Promise.resolve([]),
          // 3. Invoices
          api.getStudentInvoices(studentId || null),
          // 4. Schedule
          (activeProgram && studentGroups?.length) ? api.getCourseSchedule(activeProgram, studentGroups) : Promise.resolve([]),
        ];

        const [attendanceData, courseList, invoicesData, scheduleData] = await Promise.all(promises);

        if (!isMounted) return;

        // Attendance stats
        const records = attendanceData || [];
        const present = records.filter(r => r.status === 'Present').length;
        const total = records.length;
        const rate = total > 0 ? `${Math.round((present / total) * 100)}%` : '100%';

        // Invoices stats
        const invList = invoicesData?.invoices || [];
        const pending = invList.reduce((acc, inv) => {
          if (inv.status !== 'Paid') {
            return acc + Number(inv.outstanding_amount || inv.grand_total || 0);
          }
          return acc;
        }, 0);

        // Schedule next class
        const todayStr = new Date().toISOString().split('T')[0];
        const upcoming = (scheduleData || []).find(ev => ev.schedule_date >= todayStr) || scheduleData?.[0] || null;

        setStats({
          attendanceRate: rate,
          presentCount: present,
          totalSessions: total,
          courseCount: (courseList || []).length,
          pendingFees: pending,
          currency: invList[0]?.currency_symbol || '₹',
          nextClass: upcoming ? {
            title: upcoming.title || upcoming.course || 'Class',
            from_time: upcoming.from_time ? upcoming.from_time.split('.')[0] : '',
            to_time: upcoming.to_time ? upcoming.to_time.split('.')[0] : '',
            room: upcoming.room || 'Room TBA',
          } : null,
        });
      } catch (err) {
        console.error('Error computing dashboard overview stats:', err);
      }
    }

    computeRealStats();

    return () => {
      isMounted = false;
    };
  }, [studentId, activeProgram, studentGroups]);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {/* 1. Attendance Card */}
      <div 
        onClick={() => onNavigate?.('/attendance')}
        className="glass-panel p-5 rounded-2xl cursor-pointer hover:shadow-glow transition-all duration-200 group border border-slate-200/70 dark:border-slate-800"
      >
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Attendance</span>
          <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-400 flex items-center justify-center group-hover:scale-110 transition-transform">
            <UserCheck className="w-5 h-5" />
          </div>
        </div>
        <div className="mt-3 flex items-baseline gap-2">
          <span className="text-2xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight">{stats.attendanceRate}</span>
          <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400 flex items-center gap-0.5">
            <TrendingUp className="w-3 h-3" />
            Verified
          </span>
        </div>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          {stats.presentCount} of {stats.totalSessions} sessions logged
        </p>
      </div>

      {/* 2. Enrolled Courses */}
      <div 
        onClick={() => onNavigate?.('/courses')}
        className="glass-panel p-5 rounded-2xl cursor-pointer hover:shadow-glow transition-all duration-200 group border border-slate-200/70 dark:border-slate-800"
      >
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Curriculum Courses</span>
          <div className="w-9 h-9 rounded-xl bg-brand-50 dark:bg-brand-950/80 text-brand-600 dark:text-brand-400 flex items-center justify-center group-hover:scale-110 transition-transform">
            <BookOpen className="w-5 h-5" />
          </div>
        </div>
        <div className="mt-3 flex items-baseline gap-2">
          <span className="text-2xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight">{stats.courseCount}</span>
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Subjects</span>
        </div>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          {activeProgram || 'Current Academic Term'}
        </p>
      </div>

      {/* 3. Next Class Schedule */}
      <div 
        onClick={() => onNavigate?.('/schedule')}
        className="glass-panel p-5 rounded-2xl cursor-pointer hover:shadow-glow transition-all duration-200 group border border-slate-200/70 dark:border-slate-800"
      >
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Next Period</span>
          <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-400 flex items-center justify-center group-hover:scale-110 transition-transform">
            <CalendarCheck className="w-5 h-5" />
          </div>
        </div>
        <div className="mt-3">
          <p className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
            {stats.nextClass ? stats.nextClass.title : 'No classes today'}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
            {stats.nextClass ? `${stats.nextClass.from_time} - ${stats.nextClass.to_time} • ${stats.nextClass.room}` : 'Enjoy your free time'}
          </p>
        </div>
      </div>

      {/* 4. Tuition / Fees Balance */}
      <div 
        onClick={() => onNavigate?.('/fees')}
        className="glass-panel p-5 rounded-2xl cursor-pointer hover:shadow-glow transition-all duration-200 group border border-slate-200/70 dark:border-slate-800"
      >
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Tuition Fees</span>
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform ${
            stats.pendingFees > 0 
              ? 'bg-amber-50 dark:bg-amber-950/80 text-amber-600 dark:text-amber-400' 
              : 'bg-emerald-50 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-400'
          }`}>
            <CreditCard className="w-5 h-5" />
          </div>
        </div>
        <div className="mt-3 flex items-baseline gap-2">
          <span className={`text-2xl font-extrabold tracking-tight ${
            stats.pendingFees > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-900 dark:text-slate-100'
          }`}>
            {stats.currency}{stats.pendingFees.toLocaleString()}
          </span>
          <span className={`text-xs font-medium ${stats.pendingFees > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
            {stats.pendingFees > 0 ? 'Due soon' : 'All Clear'}
          </span>
        </div>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          {stats.pendingFees > 0 ? 'Click to review invoices' : 'No outstanding balances'}
        </p>
      </div>
    </div>
  );
}
