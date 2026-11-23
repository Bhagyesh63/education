import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { 
  LogIn, 
  GraduationCap, 
  Users, 
  School, 
  Lock, 
  Mail, 
  Sparkles, 
  AlertCircle,
  Eye,
  EyeOff,
  BookOpen,
  ShieldCheck,
  ArrowRight,
  CheckCircle2,
  CalendarPlus,
  HelpCircle,
  Award
} from 'lucide-react';

export default function LoginView() {
  const { 
    login, 
    optimisticSignIn,
    previewAsStudent, 
    previewAsGuardian, 
    previewAsInstructor, 
    schoolSettings 
  } = useAuth();
  const navigate = useNavigate();

  // Real institutional directory records from the Frappe Education database
  const directoryData = {
    students: [
      { id: 'rahul', name: 'Rahul Sharma', email: 'rahul.sharma@example.com', badge: 'Standard 5 & 6', role: 'Student' },
      { id: 'priya', name: 'Priya Patel', email: 'priya.patel@example.com', badge: 'Standard 5 & 6', role: 'Student' },
      { id: 'aarav', name: 'Aarav Mehta', email: 'aarav.mehta@example.com', badge: 'Standard 5 & 6', role: 'Student' },
      { id: 'ananya', name: 'Anaya Shah', email: 'ananya.shah@example.com', badge: 'Standard 5 & 6', role: 'Student' },
      { id: 'kavya', name: 'Kavya Joshi', email: 'kavya.joshi@example.com', badge: 'Standard 5 & 6', role: 'Student' },
      { id: 'dev', name: 'Dev Shah', email: 'dev.shah@example.com', badge: 'Standard 5 & 6', role: 'Student' },
      { id: 'isha', name: 'Isha Trivedi', email: 'isha.trivedi@example.com', badge: 'Standard 5 & 6', role: 'Student' },
      { id: 'vihaan', name: 'Vihaan Patel', email: 'vihaan.patel@example.com', badge: 'Standard 5 & 6', role: 'Student' },
      { id: 'diya', name: 'Diya Mehta', email: 'diya.mehta@example.com', badge: 'Standard 5 & 6', role: 'Student' },
      { id: 'rohan', name: 'Rohan Desai', email: 'rohan.desai@example.com', badge: 'Standard 5', role: 'Student' },
      { id: 'aditya', name: 'Aditya Kumar', email: 'aditya.kumar@example.com', badge: 'Standard 5', role: 'Student' },
    ],
    teachers: [
      { id: 'rajesh', name: 'Rajesh Patel', email: 'teacher@example.com', badge: 'Mathematics & Academic Lead', role: 'Teacher / Faculty' },
      { id: 'neha', name: 'Neha Shah', email: 'neha.shah@example.com', badge: 'English Faculty', role: 'Teacher / Faculty' },
      { id: 'amit_v', name: 'Amit Verma', email: 'amit.verma@example.com', badge: 'Science Faculty', role: 'Teacher / Faculty' },
    ],
    guardians: [
      { id: 'amit_g', name: 'Amit Sharma', email: 'amit.sharma@example.com', badge: 'Parent of Rahul Sharma', role: 'Guardian' },
    ],
  };

  const [activeTab, setActiveTab] = useState('students');
  const [selectedPerson, setSelectedPerson] = useState(directoryData.students[0]);
  const [email, setEmail] = useState('rahul.sharma@example.com');
  const [password, setPassword] = useState('password');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [authStage, setAuthStage] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const handleSelectPerson = (person) => {
    setSelectedPerson(person);
    setEmail(person.email);
    setPassword('password');
    setErrorMsg('');
  };

  const handleCredentialsSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      setErrorMsg('Please enter both Email and Password.');
      return;
    }

    setLoading(true);
    setAuthStage('launching');
    setErrorMsg('');

    // Check if entered email matches a known directory person
    const matchedPerson = (selectedPerson && selectedPerson.email.toLowerCase() === email.trim().toLowerCase())
      ? selectedPerson
      : Object.values(directoryData).flat().find(p => p.email.toLowerCase() === email.trim().toLowerCase());

    if (matchedPerson) {
      try {
        // Instant optimistic redirection: 0ms lag!
        const loginPromise = optimisticSignIn(matchedPerson, password);
        navigate('/dashboard');
        loginPromise.catch((err) => {
          navigate('/login');
          setErrorMsg(err.message || 'Invalid username or password');
        });
        return;
      } catch (err) {
        setErrorMsg(err.message || 'Login failed');
        setLoading(false);
        setAuthStage('');
        return;
      }
    }

    // Custom non-directory user: fast single-trip portal_login
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
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[500px] bg-indigo-600/10 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute top-1/3 left-1/3 w-[500px] h-[400px] bg-purple-600/10 rounded-full blur-[130px] pointer-events-none" />

      {/* Top Header */}
      <header className="relative z-10 px-6 py-5 flex items-center justify-between max-w-7xl mx-auto w-full">
        {/* Brand Logo & Name */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-purple-600 p-[1px] shadow-lg shadow-indigo-500/20 flex items-center justify-center">
            <div className="w-full h-full bg-[#0a0d20] rounded-2xl flex items-center justify-center text-white">
              <span className="font-black text-sm bg-gradient-to-r from-blue-400 to-indigo-300 bg-clip-text text-transparent">
                Edu+
              </span>
            </div>
          </div>
          <div>
            <h1 className="font-extrabold text-sm tracking-tight text-white flex items-center gap-1.5">
              {schoolSettings?.name || 'Frappe Academy'}
            </h1>
            <p className="text-[10px] text-slate-500 font-medium uppercase tracking-wider">
              Connected Education Platform
            </p>
          </div>
        </div>

        {/* Status Indicator */}
        <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/[0.04] border border-white/[0.08] backdrop-blur-md">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-[11px] font-medium text-slate-400">Portal Online</span>
        </div>
      </header>

      {/* Main Login Section */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-4 py-8 max-w-2xl mx-auto w-full">
        {/* Central Dark Glass Card Container */}
        <div className="w-full bg-[#0e1124]/90 backdrop-blur-xl border border-white/[0.08] rounded-3xl p-6 sm:p-8 shadow-2xl shadow-black/80 space-y-6">
          
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
                <span>{errorMsg}</span>
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
                  className="w-full bg-[#070914] border border-white/[0.08] rounded-2xl pl-10 pr-4 py-3 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition font-mono"
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
                  className="w-full bg-[#070914] border border-white/[0.08] rounded-2xl pl-10 pr-10 py-3 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="w-5 h-5 text-slate-500 hover:text-slate-300 absolute right-3.5 top-1/2 -translate-y-1/2 transition"
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
                  <span>
                    {selectedPerson 
                      ? `Sign In as ${selectedPerson.name} (${selectedPerson.role})` 
                      : 'Sign In to Portal'}
                  </span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* School Directory / Role Switcher Section */}
          <div className="pt-5 border-t border-white/[0.08] space-y-3.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-300 uppercase tracking-wider">
                <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                <span>School Directory Accounts</span>
              </div>
              <span className="text-[10px] font-mono bg-white/[0.05] border border-white/[0.08] text-slate-400 px-2 py-0.5 rounded-full">
                All Pwd: password
              </span>
            </div>

            {/* Category Filter Tabs */}
            <div className="flex items-center gap-1.5 p-1 bg-black/40 rounded-xl border border-white/[0.06]">
              <button
                type="button"
                onClick={() => setActiveTab('students')}
                className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold transition flex items-center justify-center gap-1.5 ${
                  activeTab === 'students'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.04]'
                }`}
              >
                <GraduationCap className="w-3.5 h-3.5" />
                <span>Students ({directoryData.students.length})</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('teachers')}
                className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold transition flex items-center justify-center gap-1.5 ${
                  activeTab === 'teachers'
                    ? 'bg-purple-600 text-white shadow-xs'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.04]'
                }`}
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span>Teachers ({directoryData.teachers.length})</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('guardians')}
                className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold transition flex items-center justify-center gap-1.5 ${
                  activeTab === 'guardians'
                    ? 'bg-rose-600 text-white shadow-xs'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.04]'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                <span>Guardians ({directoryData.guardians.length})</span>
              </button>
            </div>

            {/* Accounts List (Scrollable if many) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-56 overflow-y-auto pr-1">
              {directoryData[activeTab].map((person) => {
                const isSelected = selectedPerson?.email === person.email;
                return (
                  <button
                    key={person.id}
                    type="button"
                    onClick={() => handleSelectPerson(person)}
                    className={`text-left p-2.5 rounded-xl transition-all duration-200 flex items-center justify-between border ${
                      isSelected
                        ? 'bg-indigo-950/60 border-indigo-500 text-white shadow-md ring-1 ring-indigo-500/40'
                        : 'bg-[#080a18]/70 hover:bg-[#121630] border-white/[0.05] text-slate-300 hover:border-white/[0.15]'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold truncate">
                          {person.name}
                        </span>
                        {isSelected && (
                          <span className="text-[9px] bg-indigo-500/30 text-indigo-300 border border-indigo-500/40 px-1.5 py-0.2 rounded font-semibold shrink-0">
                            Selected ✓
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-slate-400 font-mono truncate mt-0.5">
                        {person.email}
                      </p>
                      <span className="text-[9px] text-slate-500">
                        {person.badge}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Security / Compliance Badge */}
        <p className="mt-4 text-[11px] text-slate-500 text-center font-medium">
          Frappe Education Connected Platform · Role-Based Security Verified
        </p>
      </main>

      {/* Footer */}
      <footer className="relative z-10 px-6 py-4 border-t border-white/[0.06] text-xs text-slate-500 flex flex-col sm:flex-row items-center justify-between gap-2 max-w-7xl mx-auto w-full">
        <div>
          <strong className="text-slate-400">{schoolSettings?.name || 'Frappe Academy'}</strong> © 2026. All rights reserved.
        </div>
        <div className="flex items-center gap-4 text-[11px]">
          <span className="hover:text-slate-300 cursor-pointer">Terms</span>
          <span className="hover:text-slate-300 cursor-pointer">Privacy</span>
          <span className="hover:text-slate-300 cursor-pointer">Documentation</span>
          <span className="hover:text-slate-300 cursor-pointer">Support</span>
        </div>
      </footer>
    </div>
  );
}
