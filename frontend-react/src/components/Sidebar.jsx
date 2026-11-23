import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  CalendarCheck, 
  GraduationCap, 
  CreditCard, 
  UserCheck, 
  Users, 
  ChevronLeft, 
  ChevronRight,
  ChevronDown,
  School,
  Sparkles,
  LogOut,
  User,
  BookOpen,
  CalendarPlus,
  ShieldCheck,
  Award,
  X,
  UserPlus,
  Calculator,
  FileText,
  FolderKanban
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function Sidebar({ onOpenProfile, mobileOpen, onCloseMobile }) {
  const [collapsed, setCollapsed] = useState(false);
  const [reportsToolsOpen, setReportsToolsOpen] = useState(true);
  const { 
    isGuardian, 
    isStudent, 
    isInstructor, 
    isAdmin, 
    isStaff, 
    schoolSettings, 
    studentProfile, 
    instructorInfo,
    adminInfo,
    activeWard, 
    logout 
  } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  let navItems = [];

  if (isStaff) {
    navItems = [
      { id: 'dashboard', path: '/dashboard', label: 'Faculty Overview', icon: LayoutDashboard },
      { id: 'admissions', path: '/admissions', label: 'Admissions & Intake', icon: UserPlus },
      { id: 'schedule', path: '/schedule', label: 'Timetable & Planning', icon: CalendarPlus },
      { id: 'courses', path: '/courses', label: 'Curriculum & Courses', icon: BookOpen },
      { id: 'attendance', path: '/attendance', label: 'Attendance & Leaves', icon: UserCheck },
      { id: 'students', path: '/students', label: 'Student Directory', icon: Users },
      { id: 'fees', path: '/fees', label: 'Fees & Finance', icon: CreditCard },
      { id: 'grades', path: '/grades', label: 'Academic Grades', icon: GraduationCap },
      {
        id: 'reports-tools',
        path: '/reports-tools',
        label: 'Reports & Tools',
        icon: FolderKanban,
        children: [
          { id: 'assessment-tool', path: '/assessment-tool', label: 'Assessment Result Tool', icon: Calculator },
          { id: 'report-card-tool', path: '/report-card-tool', label: 'Report Card Tool', icon: FileText },
          { id: 'attendance-tool', path: '/attendance-tool', label: 'Attendance Tool', icon: UserCheck },
          { id: 'course-scheduling-tool', path: '/course-scheduling-tool', label: 'Course Scheduling Tool', icon: CalendarPlus },
        ]
      },
      { id: 'achievements', path: '/achievements', label: 'Student Achievements', icon: Award },
    ];
  } else if (isGuardian) {
    navItems = [
      { id: 'dashboard', path: '/dashboard', label: 'Ward Overview', icon: LayoutDashboard },
      { id: 'schedule', path: '/schedule', label: 'Ward Timetable', icon: CalendarCheck },
      { id: 'attendance', path: '/attendance', label: 'Attendance & Leaves', icon: UserCheck },
      { id: 'grades', path: '/grades', label: 'Grades & Report Card', icon: GraduationCap },
      { id: 'fees', path: '/fees', label: 'Fees & Invoices', icon: CreditCard },
      { id: 'achievements', path: '/achievements', label: 'Ward Achievements', icon: Award },
      { id: 'students', path: '/students', label: 'My Wards', icon: Users },
    ];
  } else {
    // Student
    navItems = [
      { id: 'dashboard', path: '/dashboard', label: 'My Overview', icon: LayoutDashboard },
      { id: 'schedule', path: '/schedule', label: 'My Timetable', icon: CalendarCheck },
      { id: 'courses', path: '/courses', label: 'Curriculum & Topics', icon: BookOpen },
      { id: 'attendance', path: '/attendance', label: 'Attendance & Leaves', icon: UserCheck },
      { id: 'grades', path: '/grades', label: 'Grades & Results', icon: GraduationCap },
      { id: 'fees', path: '/fees', label: 'Fees & Invoices', icon: CreditCard },
      { id: 'achievements', path: '/achievements', label: 'My Achievements', icon: Award },
      { id: 'students', path: '/students', label: 'My Student Dossier', icon: User },
    ];
  }

  // Determine current person and role title
  let currentPersonName = 'Student';
  let roleTitle = 'Student Portal';

  if (isInstructor) {
    currentPersonName = instructorInfo?.instructor_name || 'Faculty Member';
    roleTitle = 'Faculty / Instructor';
  } else if (isAdmin) {
    currentPersonName = adminInfo?.name || 'Education Admin';
    roleTitle = 'System Administrator';
  } else if (isGuardian) {
    currentPersonName = activeWard?.student_name || 'Ward';
    roleTitle = 'Guardian (Viewing Ward)';
  } else {
    currentPersonName = studentProfile?.student_name || 'Student';
    roleTitle = 'Student Account';
  }

  // Auto-expand Reports & Tools if on one of its sub-pages
  const isReportsToolsActive = location.pathname.startsWith('/assessment-tool') || 
                               location.pathname.startsWith('/report-card-tool') || 
                               location.pathname.startsWith('/attendance-tool') ||
                               location.pathname.startsWith('/course-scheduling-tool') ||
                               location.pathname.startsWith('/reports-tools');

  useEffect(() => {
    if (isReportsToolsActive) {
      setReportsToolsOpen(true);
    }
  }, [location.pathname, isReportsToolsActive]);

  const handleNavClick = (path) => {
    navigate(path);
    if (onCloseMobile) onCloseMobile();
  };

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      {mobileOpen && (
        <div 
          onClick={onCloseMobile}
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-40 lg:hidden transition-opacity duration-200"
          aria-hidden="true"
        />
      )}

      {/* Main Responsive Aside Sidebar */}
      <aside 
        className={`fixed inset-y-0 left-0 z-50 lg:sticky lg:top-0 lg:z-30 h-screen bg-white dark:bg-slate-900 border-r border-slate-200/80 dark:border-slate-800 transition-all duration-300 ease-in-out flex flex-col justify-between w-64 print:hidden ${
          mobileOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full lg:translate-x-0'
        } ${collapsed ? 'lg:w-20' : 'lg:w-64'}`}
      >
        {/* Top Header / Branding */}
        <div>
          <div className="h-16 flex items-center justify-between px-4 border-b border-slate-100 dark:border-slate-800">
            <div 
              className="flex items-center gap-3 overflow-hidden cursor-pointer" 
              onClick={() => handleNavClick('/dashboard')}
            >
              <div className="w-10 h-10 rounded-xl gradient-brand flex items-center justify-center text-white shadow-glow shrink-0">
                {schoolSettings?.logo ? (
                  <img src={schoolSettings.logo} alt="Logo" className="w-7 h-7 object-contain rounded-lg" />
                ) : (
                  <School className="w-5 h-5 text-white" />
                )}
              </div>
              {(!collapsed || mobileOpen) && (
                <div className="flex flex-col min-w-0">
                  <span className="font-bold text-slate-900 dark:text-slate-100 text-sm tracking-tight truncate">
                    {schoolSettings?.name || 'Frappe Academy'}
                  </span>
                  <span className="text-xs text-brand-600 dark:text-brand-400 font-medium flex items-center gap-1">
                    <Sparkles className="w-3 h-3" />
                    EduPortal
                  </span>
                </div>
              )}
            </div>

            {/* Desktop Collapse Button */}
            <button
              onClick={() => setCollapsed(!collapsed)}
              className="hidden lg:flex w-7 h-7 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition"
              title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
            </button>

            {/* Mobile Close Button */}
            <button
              onClick={onCloseMobile}
              className="lg:hidden w-7 h-7 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition"
              title="Close Menu"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Current Active Person Badge */}
          {(!collapsed || mobileOpen) && (
            <div className="mx-3 my-3 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-brand-100 dark:bg-brand-950/80 text-brand-700 dark:text-brand-300 font-semibold text-xs flex items-center justify-center shrink-0">
                {currentPersonName.charAt(0)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">{currentPersonName}</p>
                <p className="text-[10px] text-brand-600 dark:text-brand-400 uppercase tracking-wider font-semibold truncate">
                  {roleTitle}
                </p>
              </div>
            </div>
          )}

          {/* Navigation Links */}
          <nav className="p-3 space-y-1 overflow-y-auto max-h-[calc(100vh-210px)]">
            {navItems.map((item) => {
              const Icon = item.icon;

              // Expandable Group with Sub-Items (e.g. Reports & Tools)
              if (item.children) {
                const isChildActive = item.children.some(c => location.pathname === c.path);
                const isParentActive = location.pathname === item.path || isChildActive;
                const isOpen = reportsToolsOpen;

                return (
                  <div key={item.id} className="space-y-1">
                    <button
                      type="button"
                      onClick={() => {
                        if (collapsed) {
                          setCollapsed(false);
                          setReportsToolsOpen(true);
                        } else {
                          setReportsToolsOpen(!reportsToolsOpen);
                        }
                      }}
                      className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl font-medium text-sm transition-all duration-150 relative group ${
                        isParentActive
                          ? 'bg-brand-50/80 dark:bg-brand-950/60 text-brand-700 dark:text-brand-300 font-semibold'
                          : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-slate-100'
                      }`}
                      title={collapsed && !mobileOpen ? item.label : undefined}
                    >
                      {isParentActive && (
                        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1.5 h-6 bg-brand-600 dark:bg-brand-500 rounded-r-full" />
                      )}
                      <div className="flex items-center gap-3 min-w-0">
                        <Icon className={`w-5 h-5 shrink-0 transition-transform group-hover:scale-110 ${
                          isParentActive ? 'text-brand-600 dark:text-brand-400' : 'text-slate-400 dark:text-slate-500 group-hover:text-slate-600 dark:group-hover:text-slate-300'
                        }`} />
                        {(!collapsed || mobileOpen) && <span className="truncate">{item.label}</span>}
                      </div>

                      {(!collapsed || mobileOpen) && (
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-slate-200/70 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                            {item.children.length}
                          </span>
                          <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
                        </div>
                      )}
                    </button>

                    {/* Sub-Items Collapsible Container */}
                    {isOpen && (!collapsed || mobileOpen) && (
                      <div className="ml-4 pl-3 border-l-2 border-slate-200/80 dark:border-slate-800 space-y-1 py-1 animate-in fade-in slide-in-from-top-1 duration-150">
                        {item.children.map((sub) => {
                          const SubIcon = sub.icon;
                          const isSubActive = location.pathname === sub.path;

                          return (
                            <button
                              key={sub.id}
                              type="button"
                              onClick={() => handleNavClick(sub.path)}
                              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all duration-150 relative ${
                                isSubActive
                                  ? 'bg-brand-600 text-white shadow-xs font-bold'
                                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-200'
                              }`}
                            >
                              <SubIcon className={`w-4 h-4 shrink-0 ${isSubActive ? 'text-white' : 'text-slate-400 dark:text-slate-500'}`} />
                              <span className="truncate">{sub.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              }

              const isActive = location.pathname === item.path || (item.path === '/dashboard' && location.pathname === '/');

              return (
                <button
                  key={item.id}
                  onClick={() => handleNavClick(item.path)}
                  className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-medium text-sm transition-all duration-150 relative group ${
                    isActive
                      ? 'bg-brand-50 dark:bg-brand-950/60 text-brand-700 dark:text-brand-300 shadow-xs font-semibold'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-slate-100'
                  }`}
                  title={collapsed && !mobileOpen ? item.label : undefined}
                >
                  {isActive && (
                    <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1.5 h-6 bg-brand-600 dark:bg-brand-500 rounded-r-full" />
                  )}
                  <Icon className={`w-5 h-5 shrink-0 transition-transform group-hover:scale-110 ${
                    isActive ? 'text-brand-600 dark:text-brand-400' : 'text-slate-400 dark:text-slate-500 group-hover:text-slate-600 dark:group-hover:text-slate-300'
                  }`} />
                  {(!collapsed || mobileOpen) && <span className="truncate">{item.label}</span>}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Footer / User Actions */}
        <div className="p-3 border-t border-slate-100 dark:border-slate-800 space-y-1">
          <button
            onClick={() => {
              onOpenProfile();
              if (onCloseMobile) onCloseMobile();
            }}
            className="w-full flex items-center gap-3 px-3.5 py-2 rounded-xl text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-slate-100 transition"
            title="View Profile Details"
          >
            <User className="w-4 h-4 text-slate-400 shrink-0" />
            {(!collapsed || mobileOpen) && <span className="truncate">Profile Details</span>}
          </button>

          <button
            onClick={logout}
            className="w-full flex items-center gap-3 px-3.5 py-2 rounded-xl text-xs font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition"
            title="Sign out"
          >
            <LogOut className="w-4 h-4 text-rose-500 shrink-0" />
            {(!collapsed || mobileOpen) && <span className="truncate">Log Out</span>}
          </button>
        </div>
      </aside>
    </>
  );
}
