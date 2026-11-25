import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { api } from './api/frappeClient';
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
import ProgramEnrollmentTool from './components/ProgramEnrollmentTool';
import StudentGroupCreationTool from './components/StudentGroupCreationTool';
import ReportsToolsHub from './components/ReportsToolsHub';
import LoginView from './components/LoginView';
import LandingView from './components/LandingView';
import ProfileModal from './components/ProfileModal';
import LeaveModal from './components/LeaveModal';
import { 
  ExternalLink, 
  ShieldAlert, 
  GraduationCap, 
  Users
} from 'lucide-react';

// Administrator preview picker: lists real Student / Guardian records from the backend.
// get_preview_targets is restricted to System Managers server-side; for anyone else the
// request fails and the picker is not rendered.
function PreviewPicker() {
  const { previewAsStudent, previewAsGuardian } = useAuth();
  const navigate = useNavigate();
  const [targets, setTargets] = useState(null);
  const [studentId, setStudentId] = useState('');
  const [guardianId, setGuardianId] = useState('');
  const [busy, setBusy] = useState(false);
  const [previewError, setPreviewError] = useState('');

  useEffect(() => {
    let isMounted = true;
    api.getPreviewTargets()
      .then((data) => {
        if (!isMounted) return;
        setTargets(data || null);
        setStudentId(data?.students?.[0]?.name || '');
        setGuardianId(data?.guardians?.[0]?.name || '');
      })
      .catch(() => {
        if (isMounted) setTargets(null);
      });
    return () => {
      isMounted = false;
    };
  }, []);

  const students = targets?.students || [];
  const guardians = targets?.guardians || [];
  if (!students.length && !guardians.length) return null;

  const selectedStudent = students.find(s => s.name === studentId);
  const selectedGuardian = guardians.find(g => g.name === guardianId);

  const run = async (fn, id, path) => {
    setBusy(true);
    setPreviewError('');
    try {
      await fn(id);
      navigate(path);
    } catch (err) {
      setPreviewError(err.message || 'Preview failed');
    } finally {
      setBusy(false);
    }
  };

  const selectClass = "w-full py-2 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-700 dark:text-slate-200";

  return (
    <div className="p-3 sm:p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60 text-xs text-left space-y-2 text-slate-600 dark:text-slate-300">
      <p className="font-semibold text-slate-800 dark:text-slate-200">Select how you want to proceed:</p>
      {previewError && <p className="text-rose-600 dark:text-rose-400">{previewError}</p>}
      <div className="space-y-2 pt-1">
        {students.length > 0 && (
          <div className="space-y-1.5">
            <select value={studentId} onChange={(e) => setStudentId(e.target.value)} className={selectClass}>
              {students.map(s => (
                <option key={s.name} value={s.name}>
                  {s.student_name}{s.badge ? ` · ${s.badge}` : ''}
                </option>
              ))}
            </select>
            <button
              disabled={busy || !studentId}
              onClick={() => run(previewAsStudent, studentId, '/dashboard')}
              className="w-full min-h-[40px] py-2.5 px-3 rounded-xl gradient-brand text-white font-bold text-xs shadow-md shadow-brand-500/20 transition active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <GraduationCap className="w-4 h-4 shrink-0" />
              <span className="min-w-0 truncate">Explore as Student: {selectedStudent?.student_name || studentId}</span>
            </button>
          </div>
        )}

        {guardians.length > 0 && (
          <div className="space-y-1.5">
            <select value={guardianId} onChange={(e) => setGuardianId(e.target.value)} className={selectClass}>
              {guardians.map(g => (
                <option key={g.name} value={g.name}>
                  {g.guardian_name}{g.badge ? ` · ${g.badge}` : ''}
                </option>
              ))}
            </select>
            <button
              disabled={busy || !guardianId}
              onClick={() => run(previewAsGuardian, guardianId, '/students')}
              className="w-full min-h-[40px] py-2.5 px-3 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold text-xs shadow-md shadow-indigo-500/20 transition active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Users className="w-4 h-4 shrink-0" />
              <span className="min-w-0 truncate">Explore as Guardian: {selectedGuardian?.guardian_name || guardianId}</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function PortalLayout() {
  const { isLoggedIn, role, loading, isGuardian, activeStudentId, error, refresh } = useAuth();
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

  // 3. Session bootstrap failed (network/server error) -> show the real error, not the role notice
  if (!role && error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-3 sm:p-4 text-slate-900 dark:text-slate-100">
        <div className="glass-panel p-5 sm:p-8 rounded-3xl max-w-md w-full border border-slate-200/80 dark:border-slate-800 shadow-2xl text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto">
            <ShieldAlert className="w-7 h-7" />
          </div>
          <h2 className="text-xl font-black">Could not load your portal</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 break-words">{error}</p>
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
            <button
              onClick={() => refresh()}
              className="flex-1 min-h-[40px] py-2.5 rounded-xl gradient-brand text-white text-xs font-bold transition active:scale-95"
            >
              Try Again
            </button>
            <button
              onClick={() => navigate('/login')}
              className="flex-1 min-h-[40px] py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            >
              Back to Login
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 4. User Logged In but Lacks Student or Guardian Role (e.g. Administrator in Desk)
  if (!role) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-3 sm:p-4 text-slate-900 dark:text-slate-100">
        <div className="glass-panel p-5 sm:p-10 rounded-3xl max-w-lg w-full border border-slate-200/80 dark:border-slate-800 shadow-2xl text-center space-y-5 animate-in fade-in zoom-in-95">
          <div className="w-14 h-14 rounded-2xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto shadow-xs">
            <ShieldAlert className="w-7 h-7" />
          </div>

          <div className="space-y-1.5">
            <h2 className="text-lg sm:text-xl font-black text-slate-900 dark:text-slate-100">
              Role Permission Notice
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto leading-relaxed">
              Your active session does not currently hold a linked <strong className="text-slate-800 dark:text-slate-200">Student</strong> or <strong className="text-slate-800 dark:text-slate-200">Guardian</strong> profile in this Education site.
            </p>
          </div>

          <PreviewPicker />

          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 pt-1">
            <a
              href="/app"
              className="flex-1 min-h-[40px] py-2.5 px-3 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition flex items-center justify-center gap-1.5"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Open Frappe Desk (/app)
            </a>
            <button
              onClick={() => navigate('/login')}
              className="flex-1 min-h-[40px] py-2.5 px-3 rounded-xl bg-slate-900 dark:bg-slate-800 text-xs font-bold text-white hover:bg-slate-800 dark:hover:bg-slate-700 transition"
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
    <div className="flex min-h-screen w-full max-w-full bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors duration-200 relative overflow-x-clip print:bg-white print:overflow-visible print:block print:min-h-0">
      <div className="print:hidden">
        <Sidebar 
          onOpenProfile={() => setProfileOpen(true)}
          mobileOpen={mobileNavOpen}
          onCloseMobile={() => setMobileNavOpen(false)}
        />
      </div>

      <div className="flex-1 flex flex-col min-w-0 w-full overflow-x-clip print:overflow-visible print:w-full print:block print:m-0 print:p-0">
        {/* Sticky wrapper: the header's own `sticky` is scoped to this wrapper, so the wrapper must stick */}
        <div className="sticky top-0 z-20 print:hidden">
          <Navbar 
            onOpenLeaveModal={() => setLeaveModalOpen(true)}
            onOpenProfile={() => setProfileOpen(true)}
            onToggleMobileNav={() => setMobileNavOpen(!mobileNavOpen)}
          />
        </div>

        <main className="flex-1 p-3 sm:p-5 lg:p-6 max-w-7xl w-full mx-auto space-y-4 sm:space-y-6 overflow-x-clip min-w-0 print:p-0 print:m-0 print:max-w-none print:w-full print:space-y-0 print:overflow-visible print:block">
          <Outlet context={{ openLeaveModal: () => setLeaveModalOpen(true) }} />
        </main>
      </div>

      {/* Global Modals */}
      <ProfileModal isOpen={profileOpen} onClose={() => setProfileOpen(false)} />
      <LeaveModal isOpen={leaveModalOpen} onClose={() => setLeaveModalOpen(false)} />
    </div>
  );
}


// Route guard for staff-only screens (the backend enforces the same rule; this
// just avoids rendering pages that can only show permission errors).
function RequireStaff() {
  const { isStaff } = useAuth();
  return isStaff ? <Outlet /> : <Navigate to="/dashboard" replace />;
}

export default function App() {
  const [leaveModalOpen, setLeaveModalOpen] = useState(false);

  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            {/* Public landing page (signed-in users are sent on to /dashboard) */}
            <Route path="/" element={<LandingView />} />

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
              <Route path="/report-card-tool" element={<StudentReportGenerationTool />} />
              {/* Staff-only tools: students/guardians are sent back to their dashboard */}
              <Route element={<RequireStaff />}>
                <Route path="/reports-tools" element={<ReportsToolsHub />} />
                <Route path="/assessment-tool" element={<AssessmentResultTool />} />
                <Route path="/attendance-tool" element={<StudentAttendanceTool />} />
                <Route path="/course-scheduling-tool" element={<CourseSchedulingTool />} />
                <Route path="/program-enrollment-tool" element={<ProgramEnrollmentTool />} />
                <Route path="/student-group-tool" element={<StudentGroupCreationTool />} />
              </Route>
              <Route path="/fees" element={<FeesView />} />
              <Route path="/achievements" element={<AchievementsView />} />
              <Route path="/students" element={<StudentsView />} />
              <Route path="/admissions" element={<AdmissionsView />} />
            </Route>

            {/* Catch-all redirect to the landing page */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>

          {/* Root Leave Modal trigger support */}
          <LeaveModal isOpen={leaveModalOpen} onClose={() => setLeaveModalOpen(false)} />
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}
