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
  const [loading, setLoading] = useState(true);

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
    const studentId = isStaff ? null : (studentProfile?.name || activeStudentId || null);
    setLoading(true);
    api.getAssessmentResults(studentId, null)
      .then((data) => {
        setResults(data || []);
      })
      .catch((err) => {
        console.error('Error fetching dashboard grades:', err);
        setResults([]);
      })
      .finally(() => setLoading(false));
  }, [studentProfile?.name, activeStudentId, isStaff]);

  // Overall average
  let total = 0;
  let max = 0;
  results.forEach(r => {
    total += Number(r.total_score || 0);
    max += Number(r.maximum_score || 0);
  });
  const avg = max > 0 ? Math.round((total / max) * 100) : 0;
  const cumulativeGrade = calculateGradeFromScale(avg, gradingScale?.intervals);

  return (
    <div className="glass-panel p-5 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <Award className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">Recent Assessments</h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">Formal examination scores</p>
            </div>
          </div>

          <button
            onClick={() => navigate('/grades')}
            className="text-xs font-bold text-brand-600 dark:text-brand-400 hover:text-brand-700 dark:hover:text-brand-300 flex items-center gap-1 transition"
          >
            <span>All Grades</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Overall summary mini-banner */}
        {results.length > 0 && (
          <div className="mt-4 p-3 rounded-2xl bg-gradient-to-r from-brand-50 to-indigo-50 dark:from-indigo-950/50 dark:to-slate-900/80 border border-brand-100/60 dark:border-indigo-900/40 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-brand-600 dark:text-brand-400" />
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
        ) : results.length === 0 ? (
          <div className="py-10 text-center text-slate-400 text-xs">
            <GraduationCap className="w-8 h-8 text-slate-300 dark:text-slate-700 mx-auto mb-2" />
            No published assessment results yet.
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            {results.slice(0, 4).map((row, idx) => {
              const pct = row.maximum_score > 0 ? Math.round((row.total_score / row.maximum_score) * 100) : 0;
              const calculatedGrade = calculateGradeFromScale(pct, gradingScale?.intervals);

              return (
                <div 
                  key={row.name || idx}
                  className="p-3.5 rounded-2xl bg-white/70 dark:bg-slate-900/70 border border-slate-200/70 dark:border-slate-800 hover:bg-white dark:hover:bg-slate-900/90 transition shadow-xs backdrop-blur-xs"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100">
                        {isStaff && row.student_name ? `${row.student_name} · ${row.course}` : row.course}
                      </h4>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400">
                        {row.assessment_group || 'Term Exam'} · {row.program || 'Standard 5'}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-xs font-extrabold text-slate-900 dark:text-slate-100">
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
                      <span className="truncate">"{row.comment}"</span>
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
