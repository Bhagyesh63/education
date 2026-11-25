import React, { useState, useRef, useEffect } from 'react';
import { 
  BookOpen, 
  ChevronDown, 
  Users, 
  PlusCircle, 
  Check, 
  Sun, 
  Moon,
  Menu
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useLocation } from 'react-router-dom';

export default function Navbar({ onOpenLeaveModal, onOpenProfile, onToggleMobileNav }) {
  const location = useLocation();
  const currentTab = location.pathname.replace(/^\//, '') || 'dashboard';

  const { 
    isGuardian, 
    students, 
    activeStudentId, 
    selectStudent, 
    programs, 
    activeProgram, 
    activeAcademicYear,
    activeEnrollmentId,
    activeProgramDisplay,
    selectProgram, 
    sessionUser, 
    studentProfile 
  } = useAuth();

  const [programDropdownOpen, setProgramDropdownOpen] = useState(false);
  const [wardDropdownOpen, setWardDropdownOpen] = useState(false);

  const progRef = useRef(null);
  const wardRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (progRef.current && !progRef.current.contains(event.target)) {
        setProgramDropdownOpen(false);
      }
      if (wardRef.current && !wardRef.current.contains(event.target)) {
        setWardDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const { isDark, toggleTheme } = useTheme();

  const titles = {
    dashboard: 'Academic Dashboard',
    schedule: 'Weekly Schedule & Classes',
    courses: 'Curriculum & Courses',
    attendance: 'Attendance & Leaves',
    grades: 'Grades & Assessment Results',
    'reports-tools': 'Reports & Tools',
    'assessment-tool': 'Assessment Result Tool',
    'report-card-tool': 'Student Report Generation Tool',
    fees: 'Tuition Fees & Invoices',
    students: 'Linked Wards & Students',
    achievements: 'Student Achievements & Awards',
  };

  const activeWard = students.find(s => s.student === activeStudentId);

  return (
    <header className="h-14 sm:h-16 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800 sticky top-0 z-20 px-2.5 sm:px-5 lg:px-6 flex items-center justify-between gap-2 sm:gap-4 w-full max-w-full min-w-0 print:hidden">
      {/* Left: Mobile Menu Toggle & Tab Title */}
      <div className="flex items-center gap-1.5 sm:gap-3 min-w-0 flex-1">
        <button
          onClick={onToggleMobileNav}
          className="lg:hidden w-9 h-9 flex items-center justify-center -ml-1 sm:ml-0 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition shrink-0"
          title="Open Menu"
          aria-label="Open menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        <h1
          className="text-sm sm:text-base md:text-lg font-bold text-slate-900 dark:text-slate-100 tracking-tight truncate min-w-0"
          title={titles[currentTab] || 'Academic Portal'}
        >
          {titles[currentTab] || 'Academic Portal'}
        </h1>
        <span className="hidden xl:inline-block w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-slate-700 shrink-0" />
        <span className="hidden xl:inline-block text-xs font-medium text-slate-500 dark:text-slate-400 capitalize shrink-0">
          {currentTab}
        </span>
      </div>

      {/* Right: Program Picker, Ward Picker, Quick Action, Profile */}
      <div className="flex items-center gap-1 sm:gap-2 md:gap-3 shrink-0">
        {/* Academic Program & Year Selector Pill */}
        {programs && programs.length > 0 && (
          <div className="relative" ref={progRef}>
            <button
              onClick={() => setProgramDropdownOpen(!programDropdownOpen)}
              className="flex items-center justify-center gap-1.5 sm:gap-2 w-9 h-9 sm:w-auto sm:h-auto px-0 sm:px-3 sm:py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 text-xs font-semibold text-slate-700 dark:text-slate-200 transition"
              title="Switch Academic Program / Year"
              aria-label="Switch Academic Program / Year"
            >
              <BookOpen className="w-4 h-4 sm:w-3.5 sm:h-3.5 text-brand-600 dark:text-brand-400 shrink-0" />
              <span className="hidden sm:inline max-w-[110px] md:max-w-[140px] xl:max-w-[200px] truncate">{activeProgramDisplay || activeProgram || 'Program'}</span>
              <ChevronDown className="hidden sm:block w-3.5 h-3.5 text-slate-400 shrink-0" />
            </button>

            {programDropdownOpen && (
              <div className="fixed inset-x-2 top-14 sm:absolute sm:inset-x-auto sm:top-auto sm:right-0 mt-2 sm:w-64 max-h-[70vh] overflow-y-auto glass-dropdown rounded-2xl p-1.5 shadow-xl animate-in fade-in zoom-in-95 duration-150 z-50">
                <div className="px-3 py-1.5 text-[11px] uppercase font-bold text-slate-400 tracking-wider">
                  Academic Enrollments
                </div>
                {programs.map((p, idx) => {
                  const isSelected = (activeEnrollmentId && p.program_enrollment === activeEnrollmentId) ||
                    (p.program === activeProgram && (!p.academic_year || p.academic_year === activeAcademicYear));
                  return (
                    <button
                      key={p.program_enrollment || `${p.program}-${p.academic_year || idx}`}
                      onClick={() => {
                        selectProgram(p);
                        setProgramDropdownOpen(false);
                      }}
                      className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 sm:py-2 text-xs rounded-xl transition ${
                        isSelected
                          ? 'bg-brand-50 dark:bg-brand-950/60 text-brand-700 dark:text-brand-300 font-semibold'
                          : 'text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800'
                      }`}
                    >
                      <div className="flex flex-col text-left min-w-0">
                        <span className="truncate font-semibold">{p.program}</span>
                        {p.academic_year && (
                          <span className="text-[11px] text-slate-400 dark:text-slate-400">{p.academic_year}</span>
                        )}
                      </div>
                      {isSelected && <Check className="w-3.5 h-3.5 text-brand-600 dark:text-brand-400 shrink-0" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}


        {/* Guardian Quick Ward Switcher */}
        {isGuardian && students.length > 1 && (
          <div className="relative" ref={wardRef}>
            <button
              onClick={() => setWardDropdownOpen(!wardDropdownOpen)}
              className="flex items-center justify-center gap-1.5 sm:gap-2 w-9 h-9 sm:w-auto sm:h-auto px-0 sm:px-3 sm:py-1.5 rounded-xl border border-indigo-100 dark:border-indigo-900 bg-indigo-50/70 dark:bg-indigo-950/60 hover:bg-indigo-100 text-xs font-semibold text-indigo-700 dark:text-indigo-300 transition"
            >
              <Users className="w-4 h-4 sm:w-3.5 sm:h-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
              <span className="hidden sm:inline max-w-[90px] md:max-w-[120px] truncate">{activeWard?.student_name || 'Ward'}</span>
              <ChevronDown className="hidden sm:block w-3.5 h-3.5 text-indigo-400 shrink-0" />
            </button>

            {wardDropdownOpen && (
              <div className="fixed inset-x-2 top-14 sm:absolute sm:inset-x-auto sm:top-auto sm:right-0 mt-2 sm:w-60 max-h-[70vh] overflow-y-auto glass-dropdown rounded-2xl p-1.5 shadow-xl animate-in fade-in zoom-in-95 duration-150 z-50">
                <div className="px-3 py-1.5 text-[11px] uppercase font-bold text-slate-400 tracking-wider">
                  Switch Student Record
                </div>
                {students.map((s) => (
                  <button
                    key={s.student}
                    onClick={() => {
                      selectStudent(s.student);
                      setWardDropdownOpen(false);
                    }}
                    className={`w-full flex items-center gap-2.5 px-3 py-2.5 sm:py-2 text-xs rounded-xl transition ${
                      activeStudentId === s.student
                        ? 'bg-brand-50 dark:bg-brand-950/60 text-brand-700 dark:text-brand-300 font-semibold'
                        : 'text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800'
                    }`}
                  >
                    <div className="w-6 h-6 rounded-full bg-brand-100 dark:bg-brand-900 text-brand-700 dark:text-brand-300 font-bold text-[11px] flex items-center justify-center shrink-0">
                      {s.student_name?.charAt(0)}
                    </div>
                    <div className="text-left flex-1 min-w-0">
                      <p className="truncate font-medium">{s.student_name}</p>
                      <p className="text-[11px] text-slate-400 truncate">{s.relation || 'Ward'}</p>
                    </div>
                    {activeStudentId === s.student && <Check className="w-3.5 h-3.5 text-brand-600 dark:text-brand-400 shrink-0" />}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Quick Leave Application Action Button */}
        <button
          onClick={onOpenLeaveModal}
          title="Request Leave"
          aria-label="Request Leave"
          className="flex items-center justify-center gap-1.5 w-9 h-9 xl:w-auto xl:h-auto px-0 xl:px-3.5 xl:py-1.5 rounded-xl bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 text-white font-medium text-xs shadow-sm shadow-brand-500/25 transition active:scale-95 shrink-0"
        >
          <PlusCircle className="w-4 h-4 xl:w-3.5 xl:h-3.5 shrink-0" />
          <span className="hidden xl:inline whitespace-nowrap">Request Leave</span>
        </button>

        {/* Dark Mode Toggle Button */}
        <button
          onClick={toggleTheme}
          className="w-9 h-9 flex items-center justify-center rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition shrink-0"
          title={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
          aria-label={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
        >
          {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-600" />}
        </button>

        {/* User Avatar & Profile Trigger */}
        <button
          onClick={onOpenProfile}
          className="flex items-center justify-center gap-1.5 p-0.5 sm:p-1 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition shrink-0"
          title="Open Profile"
          aria-label="Open Profile"
        >
          <div className="w-8 h-8 rounded-full overflow-hidden bg-slate-900 text-white flex items-center justify-center text-xs font-semibold shadow-sm">
            {studentProfile?.image ? (
              <img src={studentProfile.image} alt="User" className="w-full h-full object-cover rounded-full" />
            ) : (
              (studentProfile?.student_name || sessionUser || 'U').charAt(0).toUpperCase()
            )}
          </div>
        </button>
      </div>
    </header>
  );
}
