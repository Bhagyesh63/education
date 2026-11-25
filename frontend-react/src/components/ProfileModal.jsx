import React from 'react';
import { 
  User, 
  Mail, 
  Phone, 
  Calendar, 
  MapPin, 
  Heart, 
  Briefcase, 
  ShieldCheck, 
  X,
  BadgeCheck
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function ProfileModal({ isOpen, onClose }) {
  const { isStudent, isGuardian, isInstructor, isStaff, studentProfile, guardianInfo, instructorInfo, adminInfo, sessionUser } = useAuth();

  if (!isOpen) return null;

  // Staff have no Student/Guardian record: show their real Instructor / user details instead
  const staffInfo = isStaff
    ? {
        name: isInstructor ? (instructorInfo?.name || null) : (adminInfo?.user || sessionUser || null),
        guardian_name: isInstructor ? instructorInfo?.instructor_name : adminInfo?.name,
        email_address: adminInfo?.user || sessionUser || null,
      }
    : null;
  const info = isStudent ? studentProfile : (isGuardian ? guardianInfo : staffInfo);
  const recordLabel = isStudent ? 'Student ID' : isGuardian ? 'Guardian Record' : isInstructor ? 'Instructor Record' : 'User';

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center pt-6 sm:p-4 overflow-y-auto animate-fade-in">
      <div className="bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl max-w-lg w-full max-h-[92dvh] sm:max-h-[92vh] flex flex-col sm:my-auto overflow-hidden shadow-2xl border border-slate-100 dark:border-slate-800 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="p-4 sm:p-5 pb-3 border-b border-slate-100 dark:border-slate-800 shrink-0 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <BadgeCheck className="w-5 h-5 shrink-0 text-brand-600 dark:text-brand-400" />
            <h3 className="font-bold text-sm sm:text-base text-slate-900 dark:text-slate-100 truncate">
              {isStudent ? 'Student Profile & Demographics' : isGuardian ? 'Guardian Account Details' : 'Staff Account Details'}
            </h3>
          </div>
          <button 
            onClick={onClose}
            aria-label="Close"
            className="w-9 h-9 sm:w-8 sm:h-8 shrink-0 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition"
          >
            <X className="w-5 h-5 sm:w-4 sm:h-4" />
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-4 sm:p-5 space-y-4 sm:space-y-5">
          {/* Bio Card */}
          <div className="p-4 rounded-2xl bg-gradient-to-r from-slate-50 to-brand-50/30 dark:from-slate-800/80 dark:to-brand-950/40 border border-slate-100 dark:border-slate-700/60 flex items-center gap-3 sm:gap-4">
            <div className="w-12 h-12 sm:w-14 sm:h-14 overflow-hidden rounded-2xl bg-brand-600 text-white font-bold text-xl flex items-center justify-center shadow-md shadow-brand-500/20 shrink-0">
              {info?.image ? (
                <img src={info.image} alt="User" className="w-full h-full object-cover rounded-2xl" />
              ) : (
                (info?.student_name || info?.guardian_name || 'U').charAt(0).toUpperCase()
              )}
            </div>
            <div className="min-w-0 flex-1">
              <h4 className="font-extrabold text-sm sm:text-base text-slate-900 dark:text-slate-100 truncate">
                {info?.student_name || info?.guardian_name || 'Account Holder'}
              </h4>
              <p className="text-xs text-brand-700 dark:text-brand-300 font-medium break-all">
                {`${recordLabel}: ${info?.name || 'N/A'}`}
              </p>
            </div>
          </div>

          {/* Fields Grid */}
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="p-3 min-w-0 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/60">
                <span className="text-[11px] font-medium text-slate-400 dark:text-slate-400 flex items-center gap-1.5 mb-1">
                  <Mail className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" /> Email Address
                </span>
                <p className="font-semibold text-slate-800 dark:text-slate-200 break-all">
                  {info?.student_email_id || info?.email_address || 'Not Registered'}
                </p>
              </div>

              <div className="p-3 min-w-0 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/60">
                <span className="text-[11px] font-medium text-slate-400 dark:text-slate-400 flex items-center gap-1.5 mb-1">
                  <Phone className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" /> Contact Phone
                </span>
                <p className="font-semibold text-slate-800 dark:text-slate-200 break-words">
                  {info?.student_mobile_number || info?.mobile_number || 'Not Registered'}
                </p>
              </div>

              <div className="p-3 min-w-0 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/60">
                <span className="text-[11px] font-medium text-slate-400 dark:text-slate-400 flex items-center gap-1.5 mb-1">
                  <Calendar className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" /> Date of Birth
                </span>
                <p className="font-semibold text-slate-800 dark:text-slate-200">
                  {info?.date_of_birth || 'Not Specified'}
                </p>
              </div>

              <div className="p-3 min-w-0 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/60">
                <span className="text-[11px] font-medium text-slate-400 dark:text-slate-400 flex items-center gap-1.5 mb-1">
                  <User className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" /> Gender
                </span>
                <p className="font-semibold text-slate-800 dark:text-slate-200">
                  {info?.gender || 'Not Specified'}
                </p>
              </div>

              {isStudent && (
                <>
                  <div className="p-3 min-w-0 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/60">
                    <span className="text-[11px] font-medium text-slate-400 dark:text-slate-400 flex items-center gap-1.5 mb-1">
                      <Heart className="w-3.5 h-3.5 text-rose-500" /> Blood Group
                    </span>
                    <p className="font-semibold text-slate-800 dark:text-slate-200">
                      {info?.blood_group || 'Not Specified'}
                    </p>
                  </div>

                  <div className="p-3 min-w-0 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/60">
                    <span className="text-[11px] font-medium text-slate-400 dark:text-slate-400 flex items-center gap-1.5 mb-1">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" /> Admission Date
                    </span>
                    <p className="font-semibold text-slate-800 dark:text-slate-200">
                      {info?.joining_date || 'Enrolled'}
                    </p>
                  </div>
                </>
              )}

              {isGuardian && (
                <div className="p-3 min-w-0 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/60">
                  <span className="text-[11px] font-medium text-slate-400 dark:text-slate-400 flex items-center gap-1.5 mb-1">
                    <Briefcase className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" /> Occupation
                  </span>
                  <p className="font-semibold text-slate-800 dark:text-slate-200">
                    {info?.occupation || 'Not Specified'}
                  </p>
                </div>
              )}
            </div>

            {/* Address Box */}
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/60 text-xs">
              <span className="text-[11px] font-medium text-slate-400 dark:text-slate-400 flex items-center gap-1.5 mb-1">
                <MapPin className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" /> Registered Residential Address
              </span>
              <p className="font-medium text-slate-800 dark:text-slate-200 mt-1 break-words">
                {[info?.address_line_1, info?.address_line_2, info?.city, info?.state, info?.country, info?.pincode]
                  .filter(Boolean)
                  .join(', ') || 'No primary residential address on file'}
              </p>
            </div>
          </div>
        </div>

        <div className="p-4 sm:p-5 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] sm:pb-5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/70 flex justify-end shrink-0">
          <button
            onClick={onClose}
            className="w-full sm:w-auto min-h-[40px] sm:min-h-0 px-5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 text-white text-xs font-bold transition shadow-xs"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
