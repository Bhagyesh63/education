import React, { useState, useEffect, useMemo } from 'react';
import { 
  UserPlus, 
  Search, 
  Filter, 
  Calendar, 
  GraduationCap, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Sparkles, 
  Eye, 
  Plus, 
  X, 
  Check, 
  AlertCircle, 
  UserCheck, 
  Mail, 
  Phone, 
  MapPin, 
  ArrowRight, 
  Layers, 
  ExternalLink,
  School,
  FileText
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/frappeClient';

export default function AdmissionsView() {
  const { isStaff, isAdmin } = useAuth();
  const canManage = isStaff || isAdmin;

  const [activeTab, setActiveTab] = useState('applicants'); // 'applicants' | 'drives'
  const [applicants, setApplicants] = useState([]);
  const [admissionsList, setAdmissionsList] = useState([]);
  const [academicYears, setAcademicYears] = useState([]);
  const [dbPrograms, setDbPrograms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [programFilter, setProgramFilter] = useState('all');
  const [driveFilter, setDriveFilter] = useState('all');
  const [loadError, setLoadError] = useState(null);

  // Modal states
  const [selectedApplicant, setSelectedApplicant] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);

  // New Application Modal
  const [showNewAppModal, setShowNewAppModal] = useState(false);
  const [submittingApp, setSubmittingApp] = useState(false);
  const [appForm, setAppForm] = useState({
    first_name: '',
    middle_name: '',
    last_name: '',
    program: '',
    academic_year: '',
    student_email_id: '',
    student_mobile_number: '',
    date_of_birth: '',
    gender: 'Male',
    student_admission: '',
    city: '',
    state: '',
    country: 'India',
  });

  // New Drive Modal
  const [showNewDriveModal, setShowNewDriveModal] = useState(false);
  const [submittingDrive, setSubmittingDrive] = useState(false);
  const [driveForm, setDriveForm] = useState({
    title: '',
    academic_year: '',
    admission_start_date: '',
    admission_end_date: '',
    programs: [],
    introduction: '',
  });

  // Action status message
  const [feedback, setFeedback] = useState(null);
  const [actionLoadingId, setActionLoadingId] = useState(null);

  const showNotification = (msg, type = 'success') => {
    setFeedback({ msg, type });
    setTimeout(() => setFeedback(null), 4000);
  };

  const loadAllData = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const getApps = typeof api.getStudentApplicants === 'function' ? api.getStudentApplicants() : Promise.resolve([]);
      const getDrives = typeof api.getAdmissionsList === 'function' ? api.getAdmissionsList() : Promise.resolve([]);
      const getYears = typeof api.getAllAcademicYears === 'function'
        ? api.getAllAcademicYears()
        : typeof api.getAcademicYears === 'function'
        ? api.getAcademicYears()
        : Promise.resolve([]);
      const getProgs = typeof api.getAllPrograms === 'function' ? api.getAllPrograms() : Promise.resolve([]);

      const [appsData, drivesData, yearsData, progsData] = await Promise.all([
        getApps.catch(e => {
          console.warn('Failed to load applicants:', e);
          setLoadError(e.message || 'Failed to load applicants.');
          return [];
        }),
        getDrives.catch(e => { console.warn('Failed to load drives:', e); return []; }),
        getYears.catch(e => { console.warn('Failed to load academic years:', e); return []; }),
        getProgs.catch(e => { console.warn('Failed to load programs:', e); return []; }),
      ]);

      const unpackList = (val) => {
        if (Array.isArray(val)) return val;
        if (val && Array.isArray(val.message)) return val.message;
        if (val && Array.isArray(val.data)) return val.data;
        return [];
      };

      const apps = unpackList(appsData);
      const drives = unpackList(drivesData);
      const years = unpackList(yearsData);
      const progs = unpackList(progsData);

      setApplicants(apps);
      setAdmissionsList(drives);
      setAcademicYears(years);
      
      const mappedProgs = progs.map(p => (typeof p === 'string' ? p : (p?.name || p?.program))).filter(Boolean);
      setDbPrograms(mappedProgs);

      // Default dropdown values
      if (mappedProgs.length > 0) {
        setAppForm(prev => ({ ...prev, program: prev.program || mappedProgs[0] }));
      }
      if (years.length > 0) {
        const firstYear = years[0]?.name || years[0]?.academic_year || years[0]?.academic_year_name || '';
        setAppForm(prev => ({ ...prev, academic_year: prev.academic_year || firstYear }));
      }
    } catch (err) {
      console.error('Error loading admissions data:', err);
      showNotification('Failed to load admissions data', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllData();
  }, []);

  // Filtered applicants
  const filteredApplicants = useMemo(() => {
    return applicants.filter(app => {
      const matchesStatus = statusFilter === 'all' || app.application_status === statusFilter;
      const matchesProg = programFilter === 'all' || app.program === programFilter;
      const matchesDrive = driveFilter === 'all' || app.student_admission === driveFilter;
      const matchesSearch = !searchQuery || 
        (app.title || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (app.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (app.student_email_id || '').toLowerCase().includes(searchQuery.toLowerCase());
      return matchesStatus && matchesProg && matchesDrive && matchesSearch;
    });
  }, [applicants, statusFilter, programFilter, driveFilter, searchQuery]);

  // Metric counts
  const metrics = useMemo(() => {
    const total = applicants.length;
    const applied = applicants.filter(a => a.application_status === 'Applied').length;
    const approved = applicants.filter(a => a.application_status === 'Approved').length;
    const admitted = applicants.filter(a => a.application_status === 'Admitted').length;
    const rejected = applicants.filter(a => a.application_status === 'Rejected').length;
    return { total, applied, approved, admitted, rejected };
  }, [applicants]);

  // Open applicant detail dossier
  const handleOpenDetail = async (applicantName) => {
    setShowDetailModal(true);
    setDetailLoading(true);
    setSelectedApplicant(null);
    try {
      const details = await api.getApplicantDetails(applicantName);
      setSelectedApplicant(details);
    } catch (err) {
      console.error('Error fetching applicant details:', err);
      showNotification(err.message || 'Failed to load applicant dossier', 'error');
    } finally {
      setDetailLoading(false);
    }
  };

  // Status update
  const handleUpdateStatus = async (applicantName, newStatus) => {
    setActionLoadingId(applicantName);
    try {
      await api.updateApplicantStatus(applicantName, newStatus);
      showNotification(`Application status updated to ${newStatus}`);
      await loadAllData();
      if (selectedApplicant?.name === applicantName) {
        setSelectedApplicant(prev => ({ ...prev, application_status: newStatus }));
      }
    } catch (err) {
      console.error('Error updating status:', err);
      showNotification(err.message || 'Status update failed', 'error');
    } finally {
      setActionLoadingId(null);
    }
  };

  // Admit and Enroll applicant
  const handleAdmitAndEnroll = async (applicantName) => {
    setActionLoadingId(applicantName);
    try {
      const res = await api.admitAndEnrollApplicant(applicantName);
      if (res?.status === 'already_enrolled') {
        showNotification(res.message || 'Student is already enrolled');
      } else {
        showNotification(`Student successfully enrolled! ID: ${res.student}`);
      }
      await loadAllData();
      if (selectedApplicant?.name === applicantName) {
        const refreshed = await api.getApplicantDetails(applicantName);
        setSelectedApplicant(refreshed);
      }
    } catch (err) {
      console.error('Error enrolling student:', err);
      showNotification(err.message || 'Enrollment failed', 'error');
    } finally {
      setActionLoadingId(null);
    }
  };

  // Submit new application
  const handleCreateApplicant = async (e) => {
    e.preventDefault();
    if (!appForm.first_name || !appForm.program || !appForm.academic_year) {
      showNotification('First Name, Program, and Academic Year are mandatory.', 'error');
      return;
    }
    setSubmittingApp(true);
    try {
      await api.createStudentApplicant(appForm);
      showNotification('Student Application submitted successfully!');
      setShowNewAppModal(false);
      setAppForm({
        first_name: '',
        middle_name: '',
        last_name: '',
        program: dbPrograms[0] || '',
        academic_year: academicYears[0]?.name || '',
        student_email_id: '',
        student_mobile_number: '',
        date_of_birth: '',
        gender: 'Male',
        student_admission: '',
        city: '',
        state: '',
        country: 'India',
      });
      await loadAllData();
    } catch (err) {
      console.error('Error submitting application:', err);
      showNotification(err.message || 'Failed to submit application', 'error');
    } finally {
      setSubmittingApp(false);
    }
  };

  // Submit new admission drive
  const handleCreateDrive = async (e) => {
    e.preventDefault();
    if (!driveForm.title || !driveForm.academic_year) {
      showNotification('Title and Academic Year are required.', 'error');
      return;
    }
    setSubmittingDrive(true);
    try {
      await api.createStudentAdmission(driveForm);
      showNotification('Admission Drive campaign created successfully!');
      setShowNewDriveModal(false);
      setDriveForm({
        title: '',
        academic_year: academicYears[0]?.name || '',
        admission_start_date: '',
        admission_end_date: '',
        programs: [],
        introduction: '',
      });
      await loadAllData();
    } catch (err) {
      console.error('Error creating admission drive:', err);
      showNotification(err.message || 'Failed to create admission drive', 'error');
    } finally {
      setSubmittingDrive(false);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'Applied':
        return 'bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border-blue-200 dark:border-blue-800';
      case 'Approved':
        return 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800';
      case 'Admitted':
        return 'bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 border-purple-200 dark:border-purple-800';
      case 'Rejected':
        return 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border-rose-200 dark:border-rose-800';
      default:
        return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700';
    }
  };

  return (
    <div className="space-y-6 max-w-full overflow-hidden">
      {/* Toast Notification Banner */}
      {feedback && (
        <div className={`p-4 rounded-2xl flex items-center justify-between gap-3 text-xs font-semibold shadow-lg transition-all animate-in fade-in duration-200 ${
          feedback.type === 'error'
            ? 'bg-rose-500 text-white'
            : 'bg-emerald-600 text-white shadow-emerald-500/20'
        }`}>
          <div className="flex items-center gap-2 min-w-0">
            {feedback.type === 'error' ? <AlertCircle className="w-4 h-4 shrink-0" /> : <Check className="w-4 h-4 shrink-0" />}
            <span className="min-w-0 break-words">{feedback.msg}</span>
          </div>
          <button onClick={() => setFeedback(null)} className="p-2 sm:p-1 hover:bg-white/20 rounded-lg shrink-0">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Header Banner */}
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
        <div className="min-w-0 flex-1 basis-[260px]">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl gradient-brand flex items-center justify-center text-white shadow-glow shrink-0">
              <UserPlus className="w-5 h-5" />
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight min-w-0 break-words">
              Admissions & Applicant Intake
            </h1>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {canManage
              ? 'Manage prospective student applications, admission drives, review dossiers, and enroll verified candidates.'
              : 'Track the status of your submitted applications and browse open admission drives.'}
          </p>
        </div>

        {/* Action Buttons for Staff */}
        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            onClick={() => setShowNewAppModal(true)}
            className="flex-1 sm:flex-none justify-center whitespace-nowrap py-2.5 px-4 rounded-xl gradient-brand text-white font-bold text-xs shadow-md shadow-brand-500/20 hover:opacity-95 active:scale-95 transition flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>New Application</span>
          </button>

          {canManage && (
            <button
              onClick={() => setShowNewDriveModal(true)}
              className="flex-1 sm:flex-none justify-center whitespace-nowrap py-2.5 px-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs hover:bg-slate-50 dark:hover:bg-slate-800 transition flex items-center gap-1.5 shadow-xs"
            >
              <School className="w-4 h-4 text-brand-600 dark:text-brand-400" />
              <span>Create Admission Drive</span>
            </button>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5 sm:gap-4">
        <div className="glass-panel p-3.5 sm:p-4 rounded-2xl border border-slate-200/70 dark:border-slate-800 flex items-center justify-between gap-2 shadow-xs">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{canManage ? 'Total Inquiries' : 'My Applications'}</p>
            <p className="text-xl sm:text-2xl font-black text-slate-900 dark:text-slate-100 mt-0.5">{metrics.total}</p>
          </div>
          <div className="w-9 h-9 sm:w-10 sm:h-10 shrink-0 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300">
            <UserPlus className="w-5 h-5" />
          </div>
        </div>

        <div className="glass-panel p-3.5 sm:p-4 rounded-2xl border border-slate-200/70 dark:border-slate-800 flex items-center justify-between gap-2 shadow-xs">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wider">Pending Review</p>
            <p className="text-xl sm:text-2xl font-black text-blue-700 dark:text-blue-300 mt-0.5">{metrics.applied}</p>
          </div>
          <div className="w-9 h-9 sm:w-10 sm:h-10 shrink-0 rounded-xl bg-blue-50 dark:bg-blue-950/80 flex items-center justify-center text-blue-600 dark:text-blue-400">
            <Clock className="w-5 h-5" />
          </div>
        </div>

        <div className="glass-panel p-3.5 sm:p-4 rounded-2xl border border-slate-200/70 dark:border-slate-800 flex items-center justify-between gap-2 shadow-xs">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Approved</p>
            <p className="text-xl sm:text-2xl font-black text-emerald-700 dark:text-emerald-300 mt-0.5">{metrics.approved}</p>
          </div>
          <div className="w-9 h-9 sm:w-10 sm:h-10 shrink-0 rounded-xl bg-emerald-50 dark:bg-emerald-950/80 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>

        <div className="glass-panel p-3.5 sm:p-4 rounded-2xl border border-slate-200/70 dark:border-slate-800 flex items-center justify-between gap-2 shadow-xs">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold text-purple-600 dark:text-purple-400 uppercase tracking-wider">Admitted Students</p>
            <p className="text-xl sm:text-2xl font-black text-purple-700 dark:text-purple-300 mt-0.5">{metrics.admitted}</p>
          </div>
          <div className="w-9 h-9 sm:w-10 sm:h-10 shrink-0 rounded-xl bg-purple-50 dark:bg-purple-950/80 flex items-center justify-center text-purple-600 dark:text-purple-400">
            <GraduationCap className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Tabs Switcher */}
      <div className="flex items-center gap-2 border-b border-slate-200/80 dark:border-slate-800 pb-2 overflow-x-auto">
        <button
          onClick={() => setActiveTab('applicants')}
          className={`py-2 px-3 sm:px-4 rounded-xl text-xs font-bold transition flex items-center gap-2 whitespace-nowrap shrink-0 ${
            activeTab === 'applicants'
              ? 'bg-brand-50 dark:bg-brand-950/60 text-brand-700 dark:text-brand-300 border border-brand-200 dark:border-brand-800 shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <UserPlus className="w-4 h-4" />
          <span>Student Applicants ({filteredApplicants.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('drives')}
          className={`py-2 px-3 sm:px-4 rounded-xl text-xs font-bold transition flex items-center gap-2 whitespace-nowrap shrink-0 ${
            activeTab === 'drives'
              ? 'bg-brand-50 dark:bg-brand-950/60 text-brand-700 dark:text-brand-300 border border-brand-200 dark:border-brand-800 shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <School className="w-4 h-4" />
          <span>Admission Drives ({admissionsList.length})</span>
        </button>
      </div>

      {/* Tab 1: Applicants Review */}
      {activeTab === 'applicants' && (
        <div className="space-y-4">
          {/* Controls bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            {/* Search */}
            <div className="relative flex-1 min-w-0 sm:min-w-[200px]">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search applicant name, email, or ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 rounded-xl text-xs bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 focus:outline-hidden focus:ring-2 focus:ring-brand-500"
              />
            </div>

            {/* Filter by Status */}
            <div className="flex items-center gap-2 flex-wrap">
              {['all', 'Applied', 'Approved', 'Admitted', 'Rejected'].map((st) => (
                <button
                  key={st}
                  onClick={() => setStatusFilter(st)}
                  className={`py-2 sm:py-1.5 px-3 rounded-lg text-xs font-semibold capitalize transition ${
                    statusFilter === st
                      ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                      : 'bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  {st}
                </button>
              ))}

              {/* Filter by Admission Drive */}
              {driveFilter !== 'all' && (
                <button
                  onClick={() => setDriveFilter('all')}
                  className="py-2 sm:py-1.5 px-3 rounded-lg text-xs font-semibold max-w-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 flex items-center gap-1"
                  title="Clear admission drive filter"
                >
                  <span className="truncate max-w-[140px]">{admissionsList.find((d) => d.name === driveFilter)?.title || driveFilter}</span>
                  <X className="w-3 h-3" />
                </button>
              )}

              {/* Filter by Program */}
              <select
                value={programFilter}
                onChange={(e) => setProgramFilter(e.target.value)}
                className="py-2 sm:py-1.5 px-3 rounded-lg text-xs max-w-full bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 text-slate-700 dark:text-slate-300 font-medium focus:outline-hidden"
              >
                <option value="all">All Programs</option>
                {dbPrograms.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Applicants Table / Cards */}
          {loading ? (
            <div className="glass-panel p-12 text-center text-xs text-slate-400 rounded-3xl">
              <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              Loading applicants from database...
            </div>
          ) : loadError ? (
            <div className="glass-panel p-12 text-center text-xs text-slate-400 rounded-3xl border border-rose-200/70 dark:border-rose-900/60 space-y-2">
              <AlertCircle className="w-10 h-10 text-rose-400 mx-auto mb-2" />
              <p className="font-bold text-slate-700 dark:text-slate-300 text-sm">Unable to load applications</p>
              <p className="text-slate-500">{loadError}</p>
              <button
                onClick={loadAllData}
                className="mt-2 py-1.5 px-3 rounded-lg text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition"
              >
                Retry
              </button>
            </div>
          ) : filteredApplicants.length === 0 ? (
            <div className="glass-panel p-12 text-center text-xs text-slate-400 rounded-3xl border border-slate-200/70 dark:border-slate-800 space-y-2">
              <UserPlus className="w-10 h-10 text-slate-300 dark:text-slate-700 mx-auto mb-2" />
              <p className="font-bold text-slate-700 dark:text-slate-300 text-sm">No applications found</p>
              <p className="text-slate-500">
                {applicants.length === 0
                  ? (canManage ? 'No student applications have been submitted yet.' : 'You have not submitted any applications yet.')
                  : 'There are no applicant submissions matching the current filters.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredApplicants.map((app) => (
                <div
                  key={app.name}
                  className="glass-panel p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs hover:shadow-md transition flex flex-col justify-between space-y-4"
                >
                  <div>
                    {/* Header */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <span className="text-[11px] font-mono text-slate-400 dark:text-slate-500 font-semibold uppercase break-all">
                          {app.name}
                        </span>
                        <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100 truncate" title={app.title || `${app.first_name} ${app.last_name || ''}`}>
                          {app.title || `${app.first_name} ${app.last_name || ''}`}
                        </h3>
                      </div>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${getStatusBadge(app.application_status)} shrink-0`}>
                        {app.application_status}
                      </span>
                    </div>

                    {/* Details */}
                    <div className="mt-3 space-y-1.5 text-xs text-slate-600 dark:text-slate-400">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <GraduationCap className="w-3.5 h-3.5 text-brand-500 shrink-0" />
                        <span className="font-semibold text-slate-800 dark:text-slate-200 truncate">{app.program}</span>
                        {app.academic_year && <span className="text-slate-400 shrink-0">({app.academic_year})</span>}
                      </div>

                      {app.student_email_id && (
                        <div className="flex items-center gap-1.5 min-w-0 text-[11px]">
                          <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="truncate" title={app.student_email_id}>{app.student_email_id}</span>
                        </div>
                      )}

                      {app.student_admission && (
                        <div className="flex items-center gap-1.5 min-w-0 text-[11px]">
                          <School className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="truncate" title={app.student_admission}>{app.student_admission}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Actions Footer */}
                  <div className="pt-3 border-t border-slate-100 dark:border-slate-800/80 flex flex-wrap items-center justify-between gap-2">
                    <button
                      onClick={() => handleOpenDetail(app.name)}
                      className="py-2 sm:py-1.5 px-3 rounded-lg text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition flex items-center gap-1"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Review</span>
                    </button>

                    <div className="flex flex-wrap items-center gap-1.5">
                      {canManage && app.application_status === 'Applied' && (
                        <>
                          <button
                            disabled={actionLoadingId === app.name}
                            onClick={() => handleUpdateStatus(app.name, 'Approved')}
                            className="py-2 sm:py-1.5 px-2.5 rounded-lg text-xs font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 transition"
                            title="Approve Application"
                          >
                            Approve
                          </button>
                          <button
                            disabled={actionLoadingId === app.name}
                            onClick={() => handleUpdateStatus(app.name, 'Rejected')}
                            className="py-2 sm:py-1.5 px-2 rounded-lg text-xs font-bold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition"
                            title="Reject"
                          >
                            Reject
                          </button>
                        </>
                      )}

                      {canManage && app.application_status === 'Approved' && (
                        <button
                          disabled={actionLoadingId === app.name}
                          onClick={() => handleAdmitAndEnroll(app.name)}
                          className="py-2 sm:py-1.5 px-3 rounded-lg text-xs font-bold gradient-brand text-white shadow-xs hover:opacity-90 active:scale-95 transition flex items-center gap-1 whitespace-nowrap"
                        >
                          <UserCheck className="w-3.5 h-3.5" />
                          <span>Admit & Enroll</span>
                        </button>
                      )}

                      {app.application_status === 'Admitted' && (
                        <span className="text-[11px] font-semibold text-purple-600 dark:text-purple-400 flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Enrolled
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Admission Drives (Student Admission) */}
      {activeTab === 'drives' && (
        <div className="space-y-4">
          {loading ? (
            <div className="glass-panel p-12 text-center text-xs text-slate-400 rounded-3xl">
              <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              Loading admission drives...
            </div>
          ) : admissionsList.length === 0 && (
            <div className="glass-panel p-12 text-center text-xs text-slate-400 rounded-3xl border border-slate-200/70 dark:border-slate-800 space-y-2">
              <School className="w-10 h-10 text-slate-300 dark:text-slate-700 mx-auto mb-2" />
              <p className="font-bold text-slate-700 dark:text-slate-300 text-sm">No admission drives</p>
              <p className="text-slate-500">
                {canManage ? 'Create an admission drive to start accepting applications.' : 'There are no open admission drives at the moment.'}
              </p>
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {!loading && admissionsList.map((drive) => (
              <div
                key={drive.name}
                className="glass-panel p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col justify-between space-y-4"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <span className="text-[10px] font-mono text-slate-400 uppercase font-semibold">
                        Drive Campaign
                      </span>
                      <h3 className="font-bold text-base text-slate-900 dark:text-slate-100 break-words">
                        {drive.title}
                      </h3>
                      <p className="text-xs text-brand-600 dark:text-brand-400 font-semibold mt-0.5">
                        Academic Year: {drive.academic_year}
                      </p>
                    </div>

                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${
                      drive.published
                        ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200'
                        : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border-slate-200'
                    }`}>
                      {drive.published ? 'Published' : 'Internal'}
                    </span>
                  </div>

                  {/* Dates */}
                  <div className="mt-4 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60 grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase font-semibold">Applications Open</span>
                      <p className="font-bold text-slate-800 dark:text-slate-200 mt-0.5">
                        {drive.admission_start_date || 'Open'}
                      </p>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase font-semibold">Deadline</span>
                      <p className="font-bold text-slate-800 dark:text-slate-200 mt-0.5">
                        {drive.admission_end_date || 'Ongoing'}
                      </p>
                    </div>
                  </div>

                  {/* Programs */}
                  {drive.programs && drive.programs.length > 0 && (
                    <div className="mt-3">
                      <span className="text-[10px] text-slate-400 uppercase font-semibold">Eligible Programs:</span>
                      <div className="flex flex-wrap gap-1.5 mt-1">
                        {drive.programs.map((p) => (
                          <span
                            key={p}
                            className="text-[11px] font-semibold py-0.5 px-2 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800"
                          >
                            {p}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {drive.introduction && (
                    <div
                      className="mt-3 text-xs text-slate-600 dark:text-slate-400 line-clamp-2"
                      dangerouslySetInnerHTML={{ __html: drive.introduction }}
                    />
                  )}
                </div>

                <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs text-slate-500">
                    {drive.applicant_count != null ? (
                      <>
                        <strong className="text-slate-900 dark:text-slate-100">{drive.applicant_count}</strong> applicants received
                      </>
                    ) : (
                      drive.enable_admission_application ? 'Accepting applications' : 'Applications closed'
                    )}
                  </span>

                  <button
                    onClick={() => {
                      setStatusFilter('all');
                      setDriveFilter(drive.name);
                      setActiveTab('applicants');
                    }}
                    className="py-2 sm:py-0 text-xs font-bold text-brand-600 dark:text-brand-400 hover:text-brand-700 flex items-center gap-1 transition whitespace-nowrap"
                  >
                    <span>View Applicants</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Applicant Dossier Review Modal */}
      {showDetailModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4">
          <div className="glass-panel max-w-2xl w-full max-h-[90vh] flex flex-col overflow-y-auto rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="p-4 sm:p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3 shrink-0">
              <div className="min-w-0">
                <span className="text-[10px] font-mono font-semibold text-slate-400 uppercase">
                  Application Dossier
                </span>
                <h3 className="font-black text-base sm:text-lg text-slate-900 dark:text-slate-100 break-words">
                  {selectedApplicant?.title || selectedApplicant?.name || 'Applicant Details'}
                </h3>
              </div>
              <button
                onClick={() => setShowDetailModal(false)}
                className="w-9 h-9 sm:w-8 sm:h-8 shrink-0 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center text-slate-400"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {detailLoading ? (
              <div className="p-12 text-center text-xs text-slate-400">
                <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                Loading dossier...
              </div>
            ) : selectedApplicant ? (
              <div className="p-4 sm:p-6 space-y-5 flex-1 min-h-0 overflow-y-auto">
                {/* Status Bar */}
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/60 flex items-center justify-between gap-3">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400">Application Status</span>
                    <p className="font-black text-sm text-slate-900 dark:text-slate-100 mt-0.5">
                      {selectedApplicant.application_status}
                    </p>
                  </div>
                  <span className={`text-xs font-bold px-3 py-1 rounded-full border shrink-0 ${getStatusBadge(selectedApplicant.application_status)}`}>
                    {selectedApplicant.application_status}
                  </span>
                </div>

                {/* Personal & Academic Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div className="space-y-3 p-4 rounded-2xl bg-white/70 dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-800">
                    <h4 className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5 text-xs">
                      <GraduationCap className="w-4 h-4 text-brand-600" />
                      Academic Placement
                    </h4>
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase font-semibold">Target Program:</span>
                      <p className="font-bold text-slate-800 dark:text-slate-200 break-words">{selectedApplicant.program}</p>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase font-semibold">Academic Year:</span>
                      <p className="font-bold text-slate-800 dark:text-slate-200">{selectedApplicant.academic_year || 'Current'}</p>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase font-semibold">Admission Drive:</span>
                      <p className="font-bold text-slate-800 dark:text-slate-200 break-words">{selectedApplicant.student_admission || 'Direct Admission'}</p>
                    </div>
                  </div>

                  <div className="space-y-3 p-4 rounded-2xl bg-white/70 dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-800">
                    <h4 className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5 text-xs">
                      <UserCheck className="w-4 h-4 text-emerald-600" />
                      Candidate Identity
                    </h4>
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase font-semibold">Email Address:</span>
                      <p className="font-bold text-slate-800 dark:text-slate-200 break-all">{selectedApplicant.student_email_id || 'Not provided'}</p>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase font-semibold">Date of Birth & Gender:</span>
                      <p className="font-bold text-slate-800 dark:text-slate-200">
                        {selectedApplicant.date_of_birth || 'N/A'} {selectedApplicant.gender ? `(${selectedApplicant.gender})` : ''}
                      </p>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase font-semibold">Location:</span>
                      <p className="font-bold text-slate-800 dark:text-slate-200">
                        {[selectedApplicant.city, selectedApplicant.state, selectedApplicant.country].filter(Boolean).join(', ') || 'N/A'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Enrolled Student Notice */}
                {selectedApplicant.enrolled_student && (
                  <div className="p-4 rounded-2xl bg-purple-50 dark:bg-purple-950/60 border border-purple-200 dark:border-purple-800 flex items-center justify-between gap-3 text-xs">
                    <div className="min-w-0">
                      <span className="font-bold text-purple-900 dark:text-purple-200">Official Student Record Created</span>
                      <p className="text-purple-700 dark:text-purple-300 mt-0.5 break-words">
                        Linked ID: <strong>{selectedApplicant.enrolled_student.name}</strong> ({selectedApplicant.enrolled_student.student_name})
                      </p>
                    </div>
                    <span className="px-2.5 py-1 rounded-lg bg-purple-600 text-white font-bold text-[10px] shrink-0">
                      Enrolled
                    </span>
                  </div>
                )}

                {/* Actions Footer (staff only) */}
                {canManage && (
                <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    {selectedApplicant.application_status !== 'Approved' && selectedApplicant.application_status !== 'Admitted' && (
                      <button
                        onClick={() => handleUpdateStatus(selectedApplicant.name, 'Approved')}
                        className="py-2 px-4 rounded-xl text-xs font-bold bg-emerald-600 text-white hover:bg-emerald-700 transition"
                      >
                        Approve Application
                      </button>
                    )}

                    {selectedApplicant.application_status !== 'Rejected' && selectedApplicant.application_status !== 'Admitted' && (
                      <button
                        onClick={() => handleUpdateStatus(selectedApplicant.name, 'Rejected')}
                        className="py-2 px-3 rounded-xl text-xs font-bold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition"
                      >
                        Reject
                      </button>
                    )}
                  </div>

                  {selectedApplicant.application_status === 'Approved' && (
                    <button
                      onClick={() => handleAdmitAndEnroll(selectedApplicant.name)}
                      className="py-2.5 px-5 rounded-xl gradient-brand text-white font-black text-xs shadow-md shadow-brand-500/20 hover:opacity-90 active:scale-95 transition flex items-center justify-center gap-1.5"
                    >
                      <UserCheck className="w-4 h-4" />
                      <span>Admit & Enroll Student</span>
                    </button>
                  )}
                </div>
                )}
              </div>
            ) : (
              <div className="p-12 text-center text-xs text-slate-400 space-y-2">
                <AlertCircle className="w-8 h-8 text-rose-400 mx-auto" />
                <p className="font-bold text-slate-700 dark:text-slate-300 text-sm">Application dossier unavailable</p>
                <p className="text-slate-500">This application could not be loaded or you do not have access to it.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* New Application Modal */}
      {showNewAppModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4">
          <div className="glass-panel max-w-xl w-full max-h-[90vh] flex flex-col overflow-y-auto rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="p-4 sm:p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3 shrink-0">
              <div className="min-w-0">
                <h3 className="font-black text-base sm:text-lg text-slate-900 dark:text-slate-100 break-words">
                  New Student Application Form
                </h3>
                <p className="text-xs text-slate-500">Submit an application for admission</p>
              </div>
              <button
                onClick={() => setShowNewAppModal(false)}
                className="w-9 h-9 sm:w-8 sm:h-8 shrink-0 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center text-slate-400"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateApplicant} className="p-4 sm:p-6 space-y-4 flex-1 min-h-0 overflow-y-auto text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">First Name *</label>
                  <input
                    type="text"
                    required
                    value={appForm.first_name}
                    onChange={(e) => setAppForm(prev => ({ ...prev, first_name: e.target.value }))}
                    className="w-full p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs focus:ring-2 focus:ring-brand-500"
                    placeholder="Candidate's first name"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">Last Name</label>
                  <input
                    type="text"
                    value={appForm.last_name}
                    onChange={(e) => setAppForm(prev => ({ ...prev, last_name: e.target.value }))}
                    className="w-full p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs focus:ring-2 focus:ring-brand-500"
                    placeholder="Candidate's last name"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">Program *</label>
                  <select
                    required
                    value={appForm.program}
                    onChange={(e) => setAppForm(prev => ({ ...prev, program: e.target.value }))}
                    className="w-full p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs focus:ring-2 focus:ring-brand-500"
                  >
                    {dbPrograms.map((p) => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">Academic Year *</label>
                  <select
                    required
                    value={appForm.academic_year}
                    onChange={(e) => setAppForm(prev => ({ ...prev, academic_year: e.target.value }))}
                    className="w-full p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs focus:ring-2 focus:ring-brand-500"
                  >
                    {academicYears.map((y) => {
                      const yName = y.name || y.academic_year;
                      return <option key={yName} value={yName}>{yName}</option>;
                    })}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">Email Address</label>
                  <input
                    type="email"
                    value={appForm.student_email_id}
                    onChange={(e) => setAppForm(prev => ({ ...prev, student_email_id: e.target.value }))}
                    className="w-full p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs focus:ring-2 focus:ring-brand-500"
                    placeholder="applicant@example.com"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">Mobile Number</label>
                  <input
                    type="tel"
                    value={appForm.student_mobile_number}
                    onChange={(e) => setAppForm(prev => ({ ...prev, student_mobile_number: e.target.value }))}
                    className="w-full p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs focus:ring-2 focus:ring-brand-500"
                    placeholder="+91 9876543210"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">Date of Birth</label>
                  <input
                    type="date"
                    value={appForm.date_of_birth}
                    onChange={(e) => setAppForm(prev => ({ ...prev, date_of_birth: e.target.value }))}
                    className="w-full p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs focus:ring-2 focus:ring-brand-500"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">Gender</label>
                  <select
                    value={appForm.gender}
                    onChange={(e) => setAppForm(prev => ({ ...prev, gender: e.target.value }))}
                    className="w-full p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs focus:ring-2 focus:ring-brand-500"
                  >
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">City</label>
                  <input
                    type="text"
                    value={appForm.city}
                    onChange={(e) => setAppForm(prev => ({ ...prev, city: e.target.value }))}
                    className="w-full p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs focus:ring-2 focus:ring-brand-500"
                    placeholder="City"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">Admission Drive</label>
                  <select
                    value={appForm.student_admission}
                    onChange={(e) => setAppForm(prev => ({ ...prev, student_admission: e.target.value }))}
                    className="w-full p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs focus:ring-2 focus:ring-brand-500"
                  >
                    <option value="">Direct / Standard Admission</option>
                    {admissionsList.map((d) => (
                      <option key={d.name} value={d.name}>{d.title}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowNewAppModal(false)}
                  className="py-2 px-4 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingApp}
                  className="py-2.5 px-5 rounded-xl gradient-brand text-white font-bold text-xs shadow-md shadow-brand-500/20 hover:opacity-90 active:scale-95 transition"
                >
                  {submittingApp ? 'Submitting...' : 'Submit Application'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* New Admission Drive Modal */}
      {showNewDriveModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4">
          <div className="glass-panel max-w-xl w-full max-h-[90vh] flex flex-col overflow-y-auto rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="p-4 sm:p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3 shrink-0">
              <div className="min-w-0">
                <h3 className="font-black text-base sm:text-lg text-slate-900 dark:text-slate-100 break-words">
                  Create Admission Drive Campaign
                </h3>
                <p className="text-xs text-slate-500">Publish a new student intake cycle</p>
              </div>
              <button
                onClick={() => setShowNewDriveModal(false)}
                className="w-9 h-9 sm:w-8 sm:h-8 shrink-0 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center text-slate-400"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateDrive} className="p-4 sm:p-6 space-y-4 flex-1 min-h-0 overflow-y-auto text-xs">
              <div>
                <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">Campaign Title *</label>
                <input
                  type="text"
                  required
                  value={driveForm.title}
                  onChange={(e) => setDriveForm(prev => ({ ...prev, title: e.target.value }))}
                  className="w-full p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs focus:ring-2 focus:ring-brand-500"
                  placeholder="e.g. Academic Admissions 2027–2028"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">Academic Year *</label>
                <select
                  required
                  value={driveForm.academic_year}
                  onChange={(e) => setDriveForm(prev => ({ ...prev, academic_year: e.target.value }))}
                  className="w-full p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs focus:ring-2 focus:ring-brand-500"
                >
                  <option value="">Select Academic Year</option>
                  {academicYears.map((y) => {
                    const yName = y.name || y.academic_year;
                    return <option key={yName} value={yName}>{yName}</option>;
                  })}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">Start Date</label>
                  <input
                    type="date"
                    value={driveForm.admission_start_date}
                    onChange={(e) => setDriveForm(prev => ({ ...prev, admission_start_date: e.target.value }))}
                    className="w-full p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs focus:ring-2 focus:ring-brand-500"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">End Date / Deadline</label>
                  <input
                    type="date"
                    value={driveForm.admission_end_date}
                    onChange={(e) => setDriveForm(prev => ({ ...prev, admission_end_date: e.target.value }))}
                    className="w-full p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs focus:ring-2 focus:ring-brand-500"
                  />
                </div>
              </div>

              <div>
                <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">Programs Offered</label>
                <div className="flex flex-wrap gap-2 pt-1">
                  {dbPrograms.map((prog) => {
                    const isSelected = driveForm.programs.includes(prog);
                    return (
                      <button
                        type="button"
                        key={prog}
                        onClick={() => {
                          setDriveForm(prev => ({
                            ...prev,
                            programs: isSelected
                              ? prev.programs.filter(p => p !== prog)
                              : [...prev.programs, prog]
                          }));
                        }}
                        className={`py-1.5 px-3 rounded-xl text-xs font-semibold border transition ${
                          isSelected
                            ? 'bg-brand-600 text-white border-brand-600 shadow-xs'
                            : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        {prog} {isSelected ? '✓' : '+'}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowNewDriveModal(false)}
                  className="py-2 px-4 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingDrive}
                  className="py-2.5 px-5 rounded-xl gradient-brand text-white font-bold text-xs shadow-md shadow-brand-500/20 hover:opacity-90 active:scale-95 transition"
                >
                  {submittingDrive ? 'Publishing...' : 'Create Campaign'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
