import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar, Clock, MapPin, User, BookOpen, ArrowRight, Sparkles } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/frappeClient';

export default function TodayScheduleWidget() {
  const navigate = useNavigate();
  const { activeStudentId, studentProfile, isStaff } = useAuth();
  const studentId = isStaff ? null : (activeStudentId || studentProfile?.name || null);
  const [sessions, setSessions] = useState([]);
  const [isToday, setIsToday] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    setError('');
    // Role-scoped: student/guardian -> the student's groups, instructor -> own sessions
    api.getDashboardSchedule(studentId, 3)
      .then((data) => {
        if (!isMounted) return;
        setIsToday(data?.is_today !== false);
        setSessions((data?.sessions || []).map(item => ({
          id: item.name,
          title: item.title || item.course,
          course: item.course,
          program: item.program,
          student_group: item.student_group,
          instructor: item.instructor_name || item.instructor,
          room: item.room_name || item.room,
          date: item.schedule_date,
          from_time: item.from_time || '',
          to_time: item.to_time || '',
          color: item.color || '#4f46e5',
        })));
      })
      .catch((err) => {
        console.error('Error fetching today schedule:', err);
        if (isMounted) {
          setSessions([]);
          setError(err.message || 'Unable to load the timetable');
        }
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });
    return () => {
      isMounted = false;
    };
  }, [studentId, isStaff]);

  return (
    <div className="glass-panel p-4 sm:p-5 rounded-2xl sm:rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col justify-between min-w-0">
      <div>
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 pb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 shrink-0 rounded-xl bg-brand-50 dark:bg-brand-950/80 text-brand-600 dark:text-brand-400 flex items-center justify-center">
              <Calendar className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100 truncate">Today's Class Schedule</h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                {!loading && !isToday && sessions.length > 0 ? 'Nothing today · next upcoming lectures' : 'Scheduled classroom lectures'}
              </p>
            </div>
          </div>

          <button
            onClick={() => navigate('/schedule')}
            className="shrink-0 min-h-[36px] sm:min-h-0 text-xs font-bold text-brand-600 dark:text-brand-400 hover:text-brand-700 dark:hover:text-brand-300 flex items-center gap-1 transition"
          >
            <span>Full Timetable</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {loading ? (
          <div className="py-10 text-center text-slate-400 text-xs">
            <div className="w-5 h-5 border-2 border-brand-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            Loading classes...
          </div>
        ) : error ? (
          <div className="py-10 text-center text-rose-500 dark:text-rose-400 text-xs break-words">
            <Calendar className="w-8 h-8 text-slate-300 dark:text-slate-700 mx-auto mb-2" />
            {error}
          </div>
        ) : sessions.length === 0 ? (
          <div className="py-10 text-center text-slate-400 text-xs">
            <Calendar className="w-8 h-8 text-slate-300 dark:text-slate-700 mx-auto mb-2" />
            No lectures scheduled for today.
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            {sessions.map((item, idx) => (
              <div 
                key={item.id || idx}
                className="p-3.5 rounded-2xl bg-white/70 dark:bg-slate-900/70 border border-slate-200/70 dark:border-slate-800 hover:bg-white dark:hover:bg-slate-900/90 transition relative overflow-hidden shadow-xs backdrop-blur-xs"
              >
                <div 
                  className="absolute left-0 top-0 bottom-0 w-1.5 rounded-l-2xl" 
                  style={{ backgroundColor: item.color }} 
                />
                
                <div className="flex flex-wrap items-start justify-between gap-2 pl-1.5">
                  <div className="min-w-0 flex-1">
                    <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                      {item.title}
                    </h4>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1 mt-0.5 min-w-0">
                      <User className="w-3 h-3 shrink-0" />
                      <span className="truncate">{item.instructor || 'Instructor not assigned'}</span>
                    </p>
                  </div>

                  <span className="shrink-0 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800/90 text-[11px] font-semibold text-slate-700 dark:text-slate-200 border border-slate-200/80 dark:border-slate-700/60 flex items-center gap-1">
                    <Clock className="w-3 h-3 text-slate-400" />
                    {item.from_time} - {item.to_time}
                  </span>
                </div>

                <div className="mt-2.5 pt-2 pl-1.5 border-t border-slate-100 dark:border-slate-800/80 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-[11px] text-slate-500 dark:text-slate-400">
                  <span className="flex items-center gap-1 font-medium text-slate-700 dark:text-slate-300 min-w-0 break-words">
                    <MapPin className="w-3 h-3 shrink-0 text-brand-500" />
                    {item.room || 'Room not assigned'}
                  </span>
                  <span className="text-[11px] text-slate-400 dark:text-slate-500 font-mono">
                    {item.date}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
