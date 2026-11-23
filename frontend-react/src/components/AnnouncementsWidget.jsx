import React, { useState, useEffect } from 'react';
import { Megaphone, Calendar, Tag, Pin, Award, Bell } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/frappeClient';

export default function AnnouncementsWidget() {
  const { studentProfile } = useAuth();
  const [items, setItems] = useState([]);
  const [activeFilter, setActiveFilter] = useState('All');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);

    async function loadLogsAndNotices() {
      try {
        const studentId = studentProfile?.name;
        const [studentLogs, notifications] = await Promise.all([
          studentId ? api.getStudentLogs(studentId) : Promise.resolve([]),
          api.getNotificationLogs()
        ]);

        const combined = [];

        // 1. Process Student Logs (Achievements, Teacher notes, Disciplinary, etc.)
        (studentLogs || []).forEach(log => {
          // strip any html tags in log
          const cleanLog = (log.log || '').replace(/<[^>]*>?/gm, '').trim() || 'Log record documented by school administration.';
          combined.push({
            id: `log-${log.name}`,
            title: `${log.type || 'Activity'}: ${log.academic_term || 'Current Session'}`,
            date: log.date || 'Recent',
            category: log.type || 'Academic',
            badge: log.type || 'Log',
            badgeColor: log.type === 'Achievement' 
              ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400 border-amber-200 dark:border-amber-800'
              : 'bg-brand-50 text-brand-700 dark:bg-brand-950/60 dark:text-brand-400 border-brand-200 dark:border-brand-800',
            content: cleanLog,
            pinned: log.type === 'Achievement',
          });
        });

        // 2. Process Notifications
        (notifications || []).forEach(notif => {
          combined.push({
            id: `notif-${notif.name}`,
            title: notif.subject || 'System Notification',
            date: notif.creation ? notif.creation.split(' ')[0] : 'Recent',
            category: 'Notification',
            badge: notif.read ? 'Notice' : 'New',
            badgeColor: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800',
            content: notif.email_content ? notif.email_content.replace(/<[^>]*>?/gm, '').trim() : notif.subject,
            pinned: false,
          });
        });



        if (isMounted) {
          setItems(combined);
          setLoading(false);
        }
      } catch (err) {
        console.error('Error loading notices:', err);
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    loadLogsAndNotices();

    return () => {
      isMounted = false;
    };
  }, [studentProfile?.name]);

  const categories = ['All', ...new Set(items.map(a => a.category))];

  const filtered = activeFilter === 'All' 
    ? items 
    : items.filter(a => a.category === activeFilter);

  return (
    <div className="glass-panel rounded-3xl border border-slate-200/80 dark:border-slate-800 overflow-hidden shadow-xs">
      <div className="p-5 border-b border-slate-100 dark:border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-brand-50 dark:bg-brand-950/80 text-brand-600 dark:text-brand-400 flex items-center justify-center">
            <Megaphone className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">Notice Board & Circulars</h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">Live student log records and academic notifications</p>
          </div>
        </div>

        {categories.length > 1 && (
          <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl overflow-x-auto">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveFilter(cat)}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition whitespace-nowrap ${
                  activeFilter === cat
                    ? 'bg-white dark:bg-slate-700 text-brand-600 dark:text-brand-300 shadow-xs'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="divide-y divide-slate-100 dark:divide-slate-800">
        {loading ? (
          <div className="p-8 text-center text-slate-400 text-xs">
            Loading notifications from backend...
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-xs">
            No notices found in this category.
          </div>
        ) : (
          filtered.map((item) => (
            <div key={item.id} className="p-5 hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1.5 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    {item.pinned && (
                      <span className="flex items-center gap-1 text-[11px] font-bold text-amber-600 dark:text-amber-400">
                        <Award className="w-3.5 h-3.5 fill-current" /> Pinned Achievement
                      </span>
                    )}
                    <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                      {item.title}
                    </h4>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${item.badgeColor}`}>
                      {item.badge}
                    </span>
                  </div>

                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                    {item.content}
                  </p>

                  <div className="flex items-center gap-3 text-[11px] text-slate-400 dark:text-slate-500 pt-1">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" /> {item.date}
                    </span>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <Tag className="w-3 h-3" /> {item.category}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
