import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { GraduationCap, Award, ArrowRight, TrendingUp, MessageSquareQuote } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/frappeClient';
import { calculateGradeFromScale, getGradeBadgeTheme } from '../utils/grades';

export default function RecentGradesWidget() {
  const navigate = useNavigate();
  const { studentProfile, activeStudentId, isStaff } = useAuth();
  const [results, setResults] = useState([]);
  const [gradingScale, setGradingScale] = useState(null);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    // Fetch active grading scale intervals from backend
    api.getGradingScaleIntervals()
      .then((data) => setGradingScale(data || null))
      .catch((err) => {
        console.error('Error fetching grading scale intervals for widget:', err);
        setGradingScale(null);
      });
  }, []);

  useEffect(() => {
    let isMounted = true;
    const studentId = isStaff ? null : (activeStudentId || studentProfile?.name || null);
    setLoading(true);
    setError('');
    // Role-scoped on the server: student -> self, guardian -> selected ward, staff -> all
    api.getRecentAssessments(studentId, 4)
      .then((data) => {
        if (!isMounted) return;
        setResults(data?.results || []);
        setSummary(data?.summary || null);
      })
      .catch((err) => {
        console.error('Error fetching dashboard grades:', err);
        if (isMounted) {
          setResults([]);
          setSummary(null);
          setError(err.message || 'Unable to load assessment results');
        }
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });
    return () => {
      isMounted = false;
    };
  }, [studentProfile?.name, activeStudentId, isStaff]);

  // Overall average across all published results (aggregated server-side)
  const avg = summary?.percentage ?? 0;
  const cumulativeGrade = calculateGradeFromScale(avg, gradingScale?.intervals);

  return (
    <div className="glass-panel p-4 sm:p-5 rounded-2xl sm:rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col justify-between min-w-0">
      <div>
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 pb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 shrink-0 rounded-xl bg-indigo-50 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <Award className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100 truncate">Recent Assessments</h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">Formal examination scores</p>
            </div>
          </div>

          <button
            onClick={() => navigate('/grades')}
            className="shrink-0 min-h-[36px] sm:min-h-0 text-xs font-bold text-brand-600 dark:text-brand-400 hover:text-brand-700 dark:hover:text-brand-300 flex items-center gap-1 transition"
          >
            <span>All Grades</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Overall summary mini-banner */}
        {!loading && summary?.percentage !== null && summary?.percentage !== undefined && results.length > 0 && (
          <div className="mt-4 p-3 rounded-2xl bg-gradient-to-r from-brand-50 to-indigo-50 dark:from-indigo-950/50 dark:to-slate-900/80 border border-brand-100/60 dark:border-indigo-900/40 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
            <div className="flex items-center gap-2 min-w-0">
              <TrendingUp className="w-4 h-4 shrink-0 text-brand-600 dark:text-brand-400" />
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">Cumulative GPA Average:</span>
            </div>
            <span className="text-sm font-black text-brand-700 dark:text-brand-300">
              {avg}% {cumulativeGrade && cumulativeGrade !== '—' && (
                <span className={`text-xs font-bold ${cumulativeGrade === 'Grade unavailable' ? 'text-slate-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                  ({cumulativeGrade === 'Grade unavailable' ? cumulativeGrade : `Grade ${cumulativeGrade}`})
                </span>
              )}
            </span>
          </div>
        )}

        {loading ? (
          <div className="py-10 text-center text-slate-400 text-xs">
            <div className="w-5 h-5 border-2 border-brand-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            Loading assessment scores...
          </div>
        ) : error ? (
          <div className="py-10 text-center text-rose-500 dark:text-rose-400 text-xs break-words">
            <GraduationCap className="w-8 h-8 text-slate-300 dark:text-slate-700 mx-auto mb-2" />
            {error}
          </div>
        ) : results.length === 0 ? (
          <div className="py-10 text-center text-slate-400 text-xs">
            <GraduationCap className="w-8 h-8 text-slate-300 dark:text-slate-700 mx-auto mb-2" />
            No published assessment results yet.
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            {results.slice(0, 4).map((row, idx) => {
              const pct = row.maximum_score > 0 ? Math.round((row.total_score / row.maximum_score) * 100) : 0;
              const calculatedGrade = row.grade || calculateGradeFromScale(pct, gradingScale?.intervals);

              return (
                <div 
                  key={row.name || idx}
                  className="p-3.5 rounded-2xl bg-white/70 dark:bg-slate-900/70 border border-slate-200/70 dark:border-slate-800 hover:bg-white dark:hover:bg-slate-900/90 transition shadow-xs backdrop-blur-xs"
                >
                  <div className="flex items-start sm:items-center justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 break-words">
                        {isStaff && row.student_name ? `${row.student_name} · ${row.course}` : row.course}
                      </h4>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 break-words">
                        {[row.assessment_group, row.program].filter(Boolean).join(' · ') || row.academic_term || row.academic_year || ''}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs font-extrabold whitespace-nowrap text-slate-900 dark:text-slate-100">
                        {row.total_score}/{row.maximum_score}
                      </span>
                      <span className={`px-2 py-0.5 rounded-md text-[11px] font-bold border ${getGradeBadgeTheme(calculatedGrade)}`}>
                        {calculatedGrade}
                      </span>
                    </div>
                  </div>

                  <div className="mt-2.5 w-full bg-slate-200/70 dark:bg-slate-800/80 h-1.5 rounded-full overflow-hidden border border-transparent dark:border-slate-700/30">
                    <div 
                      className="bg-brand-600 dark:bg-brand-500 h-full rounded-full transition-all duration-500 shadow-xs" 
                      style={{ width: `${pct}%` }} 
                    />
                  </div>

                  {row.comment && row.comment.trim() !== '' && (
                    <div className="mt-2.5 pt-2 border-t border-slate-100 dark:border-slate-800/80 flex items-start gap-1.5 text-[11px] text-amber-700 dark:text-amber-300 font-medium italic">
                      <MessageSquareQuote className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                      <span className="truncate min-w-0" title={row.comment}>"{row.comment}"</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
