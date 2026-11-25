import React, { useState, useEffect } from 'react';
import { api } from '../api/frappeClient';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { 
  GraduationCap, 
  Users, 
  Lock, 
  Mail, 
  Sparkles, 
  AlertCircle,
  Eye,
  EyeOff,
  BookOpen,
  ArrowRight
} from 'lucide-react';

export default function LoginView() {
  const { login, schoolSettings } = useAuth();
  const navigate = useNavigate();

  // Quick-pick directory of real Student / Faculty / Guardian accounts from the Frappe database.
  // The backend only returns entries when developer_mode is enabled (never any passwords).
  const [directoryData, setDirectoryData] = useState({ students: [], teachers: [], guardians: [] });
  const [directoryLoading, setDirectoryLoading] = useState(true);

  const [activeTab, setActiveTab] = useState('students');
  const [selectedPerson, setSelectedPerson] = useState(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [authStage, setAuthStage] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    let isMounted = true;
    api.getDemoAccounts()
      .then((data) => {
        if (!isMounted) return;
        const dir = {
          students: data?.students || [],
          teachers: data?.teachers || [],
          guardians: data?.guardians || [],
        };
        setDirectoryData(dir);
        const firstTab = ['students', 'teachers', 'guardians'].find(t => dir[t].length > 0);
        if (firstTab) setActiveTab(firstTab);
      })
      .catch(() => {
        if (isMounted) setDirectoryData({ students: [], teachers: [], guardians: [] });
      })
      .finally(() => {
        if (isMounted) setDirectoryLoading(false);
      });
    return () => {
      isMounted = false;
    };
  }, []);

  const directoryCount = directoryData.students.length + directoryData.teachers.length + directoryData.guardians.length;
  const showDirectory = !directoryLoading && directoryCount > 0;

  const handleSelectPerson = (person) => {
    setSelectedPerson(person);
    setEmail(person.email);
    setErrorMsg('');
  };

  const handleCredentialsSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      setErrorMsg('Please enter both Email and Password.');
      return;
    }

    setLoading(true);
    setAuthStage('authenticating');
    setErrorMsg('');

    // Single-trip portal_login: authenticates and returns the pre-hydrated portal context
    try {
      await login(email.trim(), password);
      navigate('/dashboard');
    } catch (err) {
      setErrorMsg(err.message || 'Invalid username or password');
    } finally {
      setLoading(false);
      setAuthStage('');
    }
  };

  return (
    <div className="min-h-screen bg-[#070913] text-slate-100 flex flex-col justify-between relative overflow-x-hidden selection:bg-brand-500 selection:text-white">
      {/* Ambient Radial Glows */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] max-w-full h-[500px] bg-indigo-600/10 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute top-1/3 left-1/3 w-[500px] max-w-full h-[400px] bg-purple-600/10 rounded-full blur-[130px] pointer-events-none" />

      {/* Top Header */}
      <header className="relative z-10 px-4 sm:px-6 py-4 sm:py-5 flex items-center justify-between gap-3 max-w-7xl mx-auto w-full">
        {/* Brand Logo & Name (links back to the public landing page) */}
        <Link to="/" title="Back to home" className="flex items-center gap-2.5 sm:gap-3 min-w-0">
          <div className="w-10 h-10 shrink-0 rounded-2xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-purple-600 p-[1px] shadow-lg shadow-indigo-500/20 flex items-center justify-center">
            <div className="w-full h-full bg-[#0a0d20] rounded-2xl flex items-center justify-center text-white">
              <span className="font-black text-sm bg-gradient-to-r from-blue-400 to-indigo-300 bg-clip-text text-transparent">
                Edu+
              </span>
            </div>
          </div>
          <div className="min-w-0">
            <h1 className="font-extrabold text-sm tracking-tight text-white truncate">
              {schoolSettings?.name || 'EduPortal'}
            </h1>
            <p className="text-[11px] text-slate-500 font-medium uppercase tracking-wider truncate">
              Connected Education Platform
            </p>
          </div>
        </Link>

        {/* Status Indicator */}
        <div className="flex items-center gap-2 shrink-0 px-2.5 sm:px-3.5 py-1.5 rounded-full bg-white/[0.04] border border-white/[0.08] backdrop-blur-md">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="hidden min-[400px]:inline text-[11px] font-medium text-slate-400 whitespace-nowrap">Portal Online</span>
        </div>
      </header>

      {/* Main Login Section */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-3 sm:px-4 py-6 sm:py-8 max-w-2xl mx-auto w-full min-w-0">
        {/* Central Dark Glass Card Container */}
        <div className="w-full bg-[#0e1124]/90 backdrop-blur-xl border border-white/[0.08] rounded-2xl sm:rounded-3xl p-4 sm:p-8 shadow-2xl shadow-black/80 space-y-5 sm:space-y-6">
          
          {/* Header Title */}
          <div className="text-center space-y-1">
            <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
              Institutional Portal Login
            </h2>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              Sign in with your student, faculty, or guardian account credentials
            </p>
          </div>

          {/* Email / Password Form */}
          <form onSubmit={handleCredentialsSubmit} className="space-y-4">
            {errorMsg && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-400 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span className="min-w-0 break-words">{errorMsg}</span>
              </div>
            )}

            {/* Email Address */}
            <div>
              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setSelectedPerson(null);
                  }}
                  placeholder="name@example.com"
                  className="w-full bg-[#070914] border border-white/[0.08] rounded-2xl pl-10 pr-4 py-3 text-base sm:text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition font-mono"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full bg-[#070914] border border-white/[0.08] rounded-2xl pl-10 pr-11 py-3 text-base sm:text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="w-9 h-9 sm:w-5 sm:h-5 flex items-center justify-center text-slate-500 hover:text-slate-300 absolute right-1.5 sm:right-3.5 top-1/2 -translate-y-1/2 transition"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Sign In Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-500 hover:via-indigo-500 hover:to-purple-500 text-white text-xs font-bold tracking-wide shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2 transition-all duration-200 active:scale-[0.99] disabled:opacity-50"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>{authStage === 'launching' ? 'Redirecting to Dashboard...' : 'Authenticating...'}</span>
                </>
              ) : (
                <>
                  <span className="min-w-0 truncate">
                    {selectedPerson 
                      ? `Sign In as ${selectedPerson.name} (${selectedPerson.role})` 
                      : 'Sign In to Portal'}
                  </span>
                  <ArrowRight className="w-4 h-4 shrink-0" />
                </>
              )}
            </button>
          </form>

          {/* School Directory / Role Switcher Section (developer mode only, real accounts) */}
          {showDirectory && (
          <div className="pt-5 border-t border-white/[0.08] space-y-3.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 min-w-0 text-xs font-bold text-slate-300 uppercase tracking-wider">
                <Sparkles className="w-3.5 h-3.5 shrink-0 text-indigo-400" />
                <span>School Directory Accounts</span>
              </div>
              <span className="shrink-0 text-[11px] font-mono bg-white/[0.05] border border-white/[0.08] text-slate-400 px-2 py-0.5 rounded-full">
                All Pwd: password
              </span>
            </div>

            {/* Category Filter Tabs */}
            <div className="flex items-center gap-1.5 p-1 bg-black/40 rounded-xl border border-white/[0.06] overflow-x-auto no-scrollbar">
              <button
                type="button"
                onClick={() => setActiveTab('students')}
                className={`flex-1 shrink-0 whitespace-nowrap min-h-[36px] sm:min-h-0 py-1.5 px-2 sm:px-3 rounded-lg text-xs font-semibold transition flex items-center justify-center gap-1.5 ${
                  activeTab === 'students'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.04]'
                }`}
              >
                <GraduationCap className="hidden min-[400px]:block w-3.5 h-3.5 shrink-0" />
                <span>Students ({directoryData.students.length})</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('teachers')}
                className={`flex-1 shrink-0 whitespace-nowrap min-h-[36px] sm:min-h-0 py-1.5 px-2 sm:px-3 rounded-lg text-xs font-semibold transition flex items-center justify-center gap-1.5 ${
                  activeTab === 'teachers'
                    ? 'bg-purple-600 text-white shadow-xs'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.04]'
                }`}
              >
                <BookOpen className="hidden min-[400px]:block w-3.5 h-3.5 shrink-0" />
                <span>Teachers ({directoryData.teachers.length})</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('guardians')}
                className={`flex-1 shrink-0 whitespace-nowrap min-h-[36px] sm:min-h-0 py-1.5 px-2 sm:px-3 rounded-lg text-xs font-semibold transition flex items-center justify-center gap-1.5 ${
                  activeTab === 'guardians'
                    ? 'bg-rose-600 text-white shadow-xs'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.04]'
                }`}
              >
                <Users className="hidden min-[400px]:block w-3.5 h-3.5 shrink-0" />
                <span>Guardians ({directoryData.guardians.length})</span>
              </button>
            </div>

            {/* Accounts List (Scrollable if many) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[45vh] sm:max-h-56 overflow-y-auto pr-1">
              {directoryData[activeTab].length === 0 && (
                <p className="col-span-full text-center text-[11px] text-slate-500 py-4">
                  No accounts in this category.
                </p>
              )}
              {directoryData[activeTab].map((person) => {
                const isSelected = selectedPerson?.email === person.email;
                return (
                  <button
                    key={`${person.role}-${person.id}`}
                    type="button"
                    onClick={() => handleSelectPerson(person)}
                    className={`text-left p-2.5 min-w-0 rounded-xl transition-all duration-200 flex items-center justify-between border ${
                      isSelected
                        ? 'bg-indigo-950/60 border-indigo-500 text-white shadow-md ring-1 ring-indigo-500/40'
                        : 'bg-[#080a18]/70 hover:bg-[#121630] border-white/[0.05] text-slate-300 hover:border-white/[0.15]'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="text-xs font-bold truncate min-w-0">
                          {person.name}
                        </span>
                        {isSelected && (
                          <span className="text-[11px] bg-indigo-500/30 text-indigo-300 border border-indigo-500/40 px-1.5 py-0.2 rounded font-semibold shrink-0">
                            Selected ✓
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-400 font-mono truncate mt-0.5" title={person.email}>
                        {person.email}
                      </p>
                      <span className="text-[11px] text-slate-500 break-words">
                        {person.badge}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
          )}
        </div>

        {/* Security / Compliance Badge */}
        <p className="mt-4 text-[11px] text-slate-500 text-center font-medium">
          Frappe Education Connected Platform · Role-Based Security Verified
        </p>
      </main>

      {/* Footer */}
      <footer className="relative z-10 px-4 sm:px-6 py-4 border-t border-white/[0.06] text-xs text-slate-500 flex flex-col sm:flex-row items-center justify-between gap-2 max-w-7xl mx-auto w-full text-center sm:text-left">
        <div>
          <strong className="text-slate-400">{schoolSettings?.name || 'EduPortal'}</strong> © 2026. All rights reserved.
        </div>
        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[11px]">
          <span className="hover:text-slate-300 cursor-pointer">Terms</span>
          <span className="hover:text-slate-300 cursor-pointer">Privacy</span>
          <span className="hover:text-slate-300 cursor-pointer">Documentation</span>
          <span className="hover:text-slate-300 cursor-pointer">Support</span>
        </div>
      </footer>
    </div>
  );
}
