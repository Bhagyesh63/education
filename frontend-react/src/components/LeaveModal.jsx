import React, { useState } from 'react';
import { Calendar, PlusCircle, CheckCircle2, AlertCircle, X, Sparkles } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/frappeClient';

export default function LeaveModal({ isOpen, onClose, onSuccess }) {
  const { studentProfile, activeProgram, activeStudentId, activeWard, isStaff } = useAuth();
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [success, setSuccess] = useState(false);

  if (!isOpen) return null;

  // The student the leave is filed for: the logged-in student, or the guardian's active ward
  const studentId = activeStudentId || studentProfile?.name || null;
  const studentName = activeWard?.student_name || studentProfile?.student_name || '';

  // Calculate days difference
  const calculateDays = () => {
    if (!fromDate || !toDate) return 1;
    const start = new Date(fromDate);
    const end = new Date(toDate);
    const diff = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
    return diff > 0 ? diff : 1;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!fromDate || !toDate || !reason) {
      setErrorMsg('Please fill in all required fields.');
      return;
    }

    if (!studentId) {
      setErrorMsg('No student is linked to this account, so a leave application cannot be filed.');
      return;
    }
    if (toDate < fromDate) {
      setErrorMsg('To Date cannot be before From Date.');
      return;
    }

    setSubmitting(true);
    setErrorMsg('');

    try {
      const leaveData = {
        student: studentId,
        student_name: studentName,
        from_date: fromDate,
        to_date: toDate,
        reason: reason.trim(),
        total_days: calculateDays(),
      };

      await api.applyLeave(leaveData, activeProgram || null);

      setSuccess(true);
      window.dispatchEvent(new CustomEvent('edu:leave-applied', { detail: { student: studentId } }));
      setTimeout(() => {
        setSuccess(false);
        setFromDate('');
        setToDate('');
        setReason('');
        onClose();
        if (onSuccess) onSuccess();
      }, 1500);
    } catch (err) {
      console.error('Leave submission error:', err);
      setErrorMsg(err.message || 'Failed to submit leave request.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center pt-6 sm:p-4 overflow-y-auto animate-fade-in">
      <div className="bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl max-w-md w-full max-h-[92dvh] sm:max-h-[92vh] flex flex-col sm:my-auto overflow-hidden shadow-2xl border border-slate-100 dark:border-slate-800 animate-in fade-in zoom-in-95 duration-150">
        <div className="p-4 sm:p-5 pb-3 border-b border-slate-100 dark:border-slate-800 shrink-0 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <Calendar className="w-5 h-5 shrink-0 text-brand-600 dark:text-brand-400" />
            <div className="min-w-0">
              <h3 className="font-bold text-sm sm:text-base text-slate-900 dark:text-slate-100 truncate">Request Leave of Absence</h3>
              {studentName && (
                <p className="text-[11px] text-slate-500 dark:text-slate-400 break-words">For {studentName}{studentId ? ` (${studentId})` : ''}</p>
              )}
            </div>
          </div>
          <button 
            onClick={onClose}
            aria-label="Close"
            className="w-9 h-9 sm:w-8 sm:h-8 shrink-0 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition"
          >
            <X className="w-5 h-5 sm:w-4 sm:h-4" />
          </button>
        </div>

        {success ? (
          <div className="p-6 sm:p-8 text-center space-y-3 flex-1 overflow-y-auto">
            <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto animate-bounce">
              <CheckCircle2 className="w-7 h-7" />
            </div>
            <h4 className="text-base font-bold text-slate-900 dark:text-slate-100">Leave Application Submitted!</h4>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Your leave request has been submitted to the academic office for verification.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex-1 min-h-0 flex flex-col overflow-hidden">
            <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-4 sm:p-5 space-y-4">
              {!studentId && !errorMsg && (
                <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 text-xs text-amber-700 dark:text-amber-400 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{isStaff ? 'Leave applications are filed by students or their guardians.' : 'No student profile is linked to this account.'}</span>
                </div>
              )}
              {errorMsg && (
                <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-400 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span className="min-w-0 break-words">{errorMsg}</span>
                </div>
              )}

              <div className="grid grid-cols-1 min-[400px]:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    From Date *
                  </label>
                  <input
                    type="date"
                    value={fromDate}
                    onChange={(e) => setFromDate(e.target.value)}
                    className="w-full min-w-0 px-3 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 text-base sm:text-xs font-medium focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    To Date *
                  </label>
                  <input
                    type="date"
                    value={toDate}
                    min={fromDate}
                    onChange={(e) => setToDate(e.target.value)}
                    className="w-full min-w-0 px-3 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 text-base sm:text-xs font-medium focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                    required
                  />
                </div>
              </div>

              <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/60 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-xs text-slate-600 dark:text-slate-400">
                <span>Total Leave Duration:</span>
                <span className="font-bold text-brand-600 dark:text-brand-400">{calculateDays()} Days</span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Reason for Leave *
                </label>
                <textarea
                  rows={3}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Briefly state the reason (e.g. medical illness, family emergency)..."
                  className="w-full min-w-0 px-3 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 text-base sm:text-xs font-medium focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                  required
                />
              </div>
            </div>

            <div className="p-4 sm:p-5 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] sm:pb-5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/70 flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 min-h-[40px] py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting || !studentId}
                className="flex-1 min-h-[40px] py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold shadow-md shadow-brand-500/20 transition flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Submitting...</span>
                  </>
                ) : (
                  <span>Submit Application</span>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
