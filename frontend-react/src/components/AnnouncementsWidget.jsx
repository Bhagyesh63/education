import React, { useState, useEffect } from 'react';
import { Megaphone, Calendar, Tag, Award } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/frappeClient';

const BADGE_COLORS = {
  'Note': 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800',
  'Notification Log': 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800',
  'Achievement': 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400 border-amber-200 dark:border-amber-800',
  'Student Log': 'bg-brand-50 text-brand-700 dark:bg-brand-950/60 dark:text-brand-400 border-brand-200 dark:border-brand-800',
};

export default function AnnouncementsWidget() {
  const { studentProfile, activeStudentId, isStaff } = useAuth();
  const studentId = isStaff ? null : (activeStudentId || studentProfile?.name || null);
  const [items, setItems] = useState([]);
  const [activeFilter, setActiveFilter] = useState('All');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    setError('');

    // Public circulars (Note), the scoped student's Student Logs and the user's own Notification Logs
    api.getDashboardAnnouncements(studentId, 20)
      .then((data) => {
        if (!isMounted) return;
        setItems((data?.items || []).map(item => ({
          ...item,
          date: item.date || '',
          badgeColor: (item.source === 'Student Log' && item.category === 'Achievement')
            ? BADGE_COLORS.Achievement
            : (BADGE_COLORS[item.source] || BADGE_COLORS['Student Log']),
          pinnedLabel: item.source === 'Note' ? 'Pinned Circular' : 'Pinned Achievement',
        })));
        setActiveFilter('All');
      })
      .catch((err) => {
        console.error('Error loading notices:', err);
        if (isMounted) {
          setItems([]);
          setError(err.message || 'Unable to load notices');
        }
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [studentId]);

  const categories = ['All', ...new Set(items.map(a => a.category))];

  const filtered = activeFilter === 'All' 
    ? items 
    : items.filter(a => a.category === activeFilter);

  return (
    <div className="glass-panel rounded-2xl sm:rounded-3xl min-w-0 border border-slate-200/80 dark:border-slate-800 overflow-hidden shadow-xs">
      <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 min-w-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 shrink-0 rounded-xl bg-brand-50 dark:bg-brand-950/80 text-brand-600 dark:text-brand-400 flex items-center justify-center">
            <Megaphone className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">Notice Board & Circulars</h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">School circulars, student log records and academic notifications</p>
          </div>
        </div>

        {categories.length > 1 && (
          <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl overflow-x-auto no-scrollbar max-w-full min-w-0 self-start sm:self-auto">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveFilter(cat)}
                className={`shrink-0 px-3 py-1.5 sm:py-1 rounded-lg text-xs font-semibold transition whitespace-nowrap ${
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
          <div className="p-6 sm:p-8 text-center text-slate-400 text-xs">
            Loading notifications from backend...
          </div>
        ) : error ? (
          <div className="p-6 sm:p-8 text-center text-rose-500 dark:text-rose-400 text-xs break-words">
            {error}
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-6 sm:p-8 text-center text-slate-400 text-xs">
            {items.length === 0 ? 'No notices or circulars yet.' : 'No notices found in this category.'}
          </div>
        ) : (
          filtered.map((item) => (
            <div key={item.id} className="p-4 sm:p-5 hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1.5 flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    {item.pinned && (
                      <span className="flex items-center gap-1 text-[11px] font-bold text-amber-600 dark:text-amber-400">
                        <Award className="w-3.5 h-3.5 fill-current" /> {item.pinnedLabel}
                      </span>
                    )}
                    <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 min-w-0 break-words">
                      {item.title}
                    </h4>
                    <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider border ${item.badgeColor}`}>
                      {item.badge}
                    </span>
                  </div>

                  {item.content && (
                    <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed break-words">
                      {item.content}
                    </p>
                  )}

                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-400 dark:text-slate-500 pt-1">
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
