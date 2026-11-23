import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import Sidebar from './components/Sidebar';
import Navbar from './components/Navbar';
import DashboardView from './components/DashboardView';
import ScheduleView from './components/ScheduleView';
import AttendanceView from './components/AttendanceView';
import GradesView from './components/GradesView';
import FeesView from './components/FeesView';
import StudentsView from './components/StudentsView';
import CoursesView from './components/CoursesView';
import AchievementsView from './components/AchievementsView';
import AdmissionsView from './components/AdmissionsView';
import AssessmentResultTool from './components/AssessmentResultTool';
import StudentReportGenerationTool from './components/StudentReportGenerationTool';
import StudentAttendanceTool from './components/StudentAttendanceTool';
import CourseSchedulingTool from './components/CourseSchedulingTool';
import ReportsToolsHub from './components/ReportsToolsHub';
import LoginView from './components/LoginView';
import ProfileModal from './components/ProfileModal';
import LeaveModal from './components/LeaveModal';
import { 
  LogIn, 
  ExternalLink, 
  ShieldAlert, 
  Sparkles, 
  GraduationCap, 
  Users, 
  ArrowRight,
  School
} from 'lucide-react';

function PortalLayout() {
  const { isLoggedIn, role, loading, isGuardian, activeStudentId, previewAsStudent, previewAsGuardian } = useAuth();
  const [profileOpen, setProfileOpen] = useState(false);
  const [leaveModalOpen, setLeaveModalOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  // Close mobile drawer on route change
  useEffect(() => {
    setMobileNavOpen(false);
  }, [location.pathname]);

  // 1. Loading State
  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
        <div className="w-12 h-12 rounded-2xl gradient-brand flex items-center justify-center text-white shadow-glow mb-4 animate-bounce">
          <GraduationCap className="w-6 h-6" />
        </div>
        <div className="w-5 h-5 border-2 border-brand-600 border-t-transparent rounded-full animate-spin mb-3" />
        <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
          Initializing EduPortal...
        </p>
      </div>
    );
  }

  // 2. Not Logged In State -> Redirect to /login
  if (!isLoggedIn) {
    return <Navigate to="/login" replace />;
  }

  // 3. User Logged In but Lacks Student or Guardian Role (e.g. Administrator in Desk)
  if (!role) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-4 text-slate-900 dark:text-slate-100">
        <div className="glass-panel p-8 sm:p-10 rounded-3xl max-w-lg w-full border border-slate-200/80 dark:border-slate-800 shadow-2xl text-center space-y-5 animate-in fade-in zoom-in-95">
          <div className="w-14 h-14 rounded-2xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto shadow-xs">
            <ShieldAlert className="w-7 h-7" />
          </div>

          <div className="space-y-1.5">
            <h2 className="text-xl font-black text-slate-900 dark:text-slate-100">
              Role Permission Notice
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto leading-relaxed">
              Your active session does not currently hold a linked <strong className="text-slate-800 dark:text-slate-200">Student</strong> or <strong className="text-slate-800 dark:text-slate-200">Guardian</strong> profile in this Education site.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60 text-xs text-left space-y-2 text-slate-600 dark:text-slate-300">
            <p className="font-semibold text-slate-800 dark:text-slate-200">Select how you want to proceed:</p>
            <div className="space-y-2 pt-1">
              <button
                onClick={async () => {
                  await previewAsStudent('EDU-STU-2026-00001');
                  navigate('/dashboard');
                }}
                className="w-full py-2.5 px-3 rounded-xl gradient-brand text-white font-bold text-xs shadow-md shadow-brand-500/20 transition active:scale-95 flex items-center justify-center gap-2"
              >
                <GraduationCap className="w-4 h-4" />
                <span>Explore as Student: Rahul Sharma</span>
              </button>

              <button
                onClick={async () => {
                  await previewAsGuardian('Amit Sharma', 'EDU-STU-2026-00001');
                  navigate('/students');
                }}
                className="w-full py-2.5 px-3 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold text-xs shadow-md shadow-indigo-500/20 transition active:scale-95 flex items-center justify-center gap-2"
              >
                <Users className="w-4 h-4" />
                <span>Explore as Guardian: Amit Sharma</span>
              </button>
            </div>
          </div>

          <div className="flex items-center gap-3 pt-1">
            <a
              href="/app"
              className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition flex items-center justify-center gap-1.5"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Open Frappe Desk (/app)
            </a>
            <button
              onClick={() => navigate('/login')}
              className="flex-1 py-2.5 rounded-xl bg-slate-900 dark:bg-slate-800 text-xs font-bold text-white hover:bg-slate-800 dark:hover:bg-slate-700 transition"
            >
              Switch Account
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 4. Guardian must choose a ward before navigating student-scoped pages
  if (isGuardian && !activeStudentId && location.pathname !== '/students') {
    return <Navigate to="/students" replace />;
  }

  // 5. Main Authenticated Portal Layout with Route Outlet
  return (
    <div className="flex min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors duration-200 relative overflow-x-hidden print:bg-white print:overflow-visible print:block print:min-h-0">
      <div className="print:hidden">
        <Sidebar 
          onOpenProfile={() => setProfileOpen(true)}
          mobileOpen={mobileNavOpen}
          onCloseMobile={() => setMobileNavOpen(false)}
        />
      </div>

      <div className="flex-1 flex flex-col min-w-0 w-full overflow-x-hidden print:overflow-visible print:w-full print:block print:m-0 print:p-0">
        <div className="print:hidden">
          <Navbar 
            onOpenLeaveModal={() => setLeaveModalOpen(true)}
            onOpenProfile={() => setProfileOpen(true)}
            onToggleMobileNav={() => setMobileNavOpen(!mobileNavOpen)}
          />
        </div>

        <main className="flex-1 p-3.5 sm:p-6 max-w-7xl w-full mx-auto space-y-6 overflow-x-hidden min-w-0 print:p-0 print:m-0 print:max-w-none print:w-full print:space-y-0 print:overflow-visible print:block">
          <Outlet context={{ openLeaveModal: () => setLeaveModalOpen(true) }} />
        </main>
      </div>

      {/* Global Modals */}
      <ProfileModal isOpen={profileOpen} onClose={() => setProfileOpen(false)} />
      <LeaveModal isOpen={leaveModalOpen} onClose={() => setLeaveModalOpen(false)} />
    </div>
  );
}


export default function App() {
  const [leaveModalOpen, setLeaveModalOpen] = useState(false);

  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            {/* Default root site -> always redirect to /login */}
            <Route path="/" element={<Navigate to="/login" replace />} />

            {/* Public Role-Based Login Route */}
            <Route path="/login" element={<LoginView />} />

            {/* Authenticated Portal Routes */}
            <Route element={<PortalLayout />}>
              <Route path="/dashboard" element={<DashboardView />} />
              <Route path="/schedule" element={<ScheduleView />} />
              <Route path="/courses" element={<CoursesView />} />
              <Route 
                path="/attendance" 
                element={<AttendanceView onOpenLeaveModal={() => setLeaveModalOpen(true)} />} 
              />
              <Route path="/grades" element={<GradesView />} />
              <Route path="/reports-tools" element={<ReportsToolsHub />} />
              <Route path="/assessment-tool" element={<AssessmentResultTool />} />
              <Route path="/report-card-tool" element={<StudentReportGenerationTool />} />
              <Route path="/attendance-tool" element={<StudentAttendanceTool />} />
              <Route path="/course-scheduling-tool" element={<CourseSchedulingTool />} />
              <Route path="/fees" element={<FeesView />} />
              <Route path="/achievements" element={<AchievementsView />} />
              <Route path="/students" element={<StudentsView />} />
              <Route path="/admissions" element={<AdmissionsView />} />
            </Route>

            {/* Catch-all redirect to /login */}
            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>

          {/* Root Leave Modal trigger support */}
          <LeaveModal isOpen={leaveModalOpen} onClose={() => setLeaveModalOpen(false)} />
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}
