import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar, Clock, MapPin, User, BookOpen, ArrowRight, Sparkles } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/frappeClient';

export default function TodayScheduleWidget() {
  const navigate = useNavigate();
  const { activeProgram, studentGroups, isStaff } = useAuth();
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.getCourseSchedule(null, null)
      .then((data) => {
        // Find today or next upcoming sessions
        const todayStr = new Date().toISOString().split('T')[0];
        let todayClasses = (data || []).filter(item => item.schedule_date === todayStr);

        // If no classes strictly today, show next available scheduled sessions as preview
        if (todayClasses.length === 0 && data && data.length > 0) {
          const sorted = [...data].sort((a, b) => new Date(a.schedule_date) - new Date(b.schedule_date));
          todayClasses = sorted.slice(0, 3);
        }

        const mapped = todayClasses.map(item => ({
          id: item.name,
          title: item.title || item.course || 'Lecture',
          course: item.course,
          program: item.program,
          student_group: item.student_group,
          instructor: item.instructor,
          room: item.room,
          date: item.schedule_date,
          from_time: item.from_time ? item.from_time.split('.')[0] : '',
          to_time: item.to_time ? item.to_time.split('.')[0] : '',
          color: item.class_schedule_color || '#4f46e5',
        }));

        setSessions(mapped);
      })
      .catch((err) => {
        console.error('Error fetching today schedule:', err);
        setSessions([]);
      })
      .finally(() => setLoading(false));
  }, [activeProgram, studentGroups, isStaff]);

  return (
    <div className="glass-panel p-5 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-brand-50 dark:bg-brand-950/80 text-brand-600 dark:text-brand-400 flex items-center justify-center">
              <Calendar className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">Today's Class Schedule</h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">Scheduled classroom lectures</p>
            </div>
          </div>

          <button
            onClick={() => navigate('/schedule')}
            className="text-xs font-bold text-brand-600 dark:text-brand-400 hover:text-brand-700 dark:hover:text-brand-300 flex items-center gap-1 transition"
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
                
                <div className="flex items-start justify-between gap-2 pl-1.5">
                  <div className="min-w-0">
                    <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                      {item.title}
                    </h4>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1 mt-0.5">
                      <User className="w-3 h-3" />
                      <span>{item.instructor || 'Faculty Member'}</span>
                    </p>
                  </div>

                  <span className="shrink-0 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800/90 text-[11px] font-semibold text-slate-700 dark:text-slate-200 border border-slate-200/80 dark:border-slate-700/60 flex items-center gap-1">
                    <Clock className="w-3 h-3 text-slate-400" />
                    {item.from_time} - {item.to_time}
                  </span>
                </div>

                <div className="mt-2.5 pt-2 pl-1.5 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                  <span className="flex items-center gap-1 font-medium text-slate-700 dark:text-slate-300">
                    <MapPin className="w-3 h-3 text-brand-500" />
                    {item.room || 'Classroom HTL-1'}
                  </span>
                  <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono">
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
