import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  FileText, 
  Printer, 
  Download, 
  Search, 
  ChevronDown, 
  Users, 
  GraduationCap, 
  CheckCircle2, 
  AlertCircle, 
  Calendar, 
  Award, 
  Sparkles, 
  Layers, 
  BookOpen, 
  Settings, 
  Check, 
  Eye, 
  RefreshCw,
  UserCheck,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  SlidersHorizontal,
  School
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/frappeClient';
import { getGradeBadgeTheme } from '../utils/grades';

export default function StudentReportGenerationTool() {
  const { 
    isStaff, 
    isAdmin, 
    isInstructor, 
    programs, 
    activeProgram,
    activeAcademicYear 
  } = useAuth();

  // Mode: 'single' | 'batch'
  const [generationMode, setGenerationMode] = useState('single');

  // Filters & Setup
  const [metadata, setMetadata] = useState({
    programs: [],
    student_groups: [],
    academic_years: [],
    academic_terms: [],
    grading_scales: [],
  });

  const [selectedProgram, setSelectedProgram] = useState('');
  const [selectedGroup, setSelectedGroup] = useState('');
  const [selectedAcademicYear, setSelectedAcademicYear] = useState('2028-2029');
  const [selectedTerm, setSelectedTerm] = useState('Annual Assessment');
  const [selectedStudentId, setSelectedStudentId] = useState('');

  // Report Card Options
  const [reportOptions, setReportOptions] = useState({
    showMarks: true,
    includeAttendance: true,
    addLetterhead: true,
    includeGradingScaleLegend: true,
    teacherRemarks: 'Satisfactory academic progress. Promoted with commendable consistency.',
  });

  // State: Loaded Report Data
  const [singleReport, setSingleReport] = useState(null);
  const [batchReports, setBatchReports] = useState([]);
  const [batchIndex, setBatchIndex] = useState(0); // active student in batch preview
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // 1. Initial Load: Fetch setup metadata & programs
  useEffect(() => {
    Promise.all([
      api.getAssessmentSetupMetadata(),
      api.getAllPrograms(),
    ])
      .then(([metaRes, progsRes]) => {
        const meta = metaRes || {};
        const progs = Array.isArray(progsRes) ? progsRes : (meta.programs || []);
        
        setMetadata({
          programs: progs,
          student_groups: meta.student_groups || [],
          academic_years: ['2028-2029', '2026-2027'],
          academic_terms: ['Annual Assessment', 'Term 1', 'Term 2'],
          grading_scales: meta.grading_scales || [],
        });

        if (progs.length > 0) {
          const defaultProg = progs.find(p => p.name === 'Standard 6') || progs[0];
          setSelectedProgram(defaultProg.name || defaultProg);
        }
      })
      .catch((err) => {
        console.error('Failed to load report setup metadata:', err);
      });
  }, []);

  // Filtered student groups based on selected program
  const filteredGroups = useMemo(() => {
    if (!selectedProgram) return metadata.student_groups || [];
    return (metadata.student_groups || []).filter(g => !g.program || g.program === selectedProgram);
  }, [metadata.student_groups, selectedProgram]);

  // Auto-select first matching student group when program changes
  useEffect(() => {
    if (filteredGroups.length > 0) {
      setSelectedGroup(filteredGroups[0].name);
    } else {
      setSelectedGroup('');
    }
  }, [filteredGroups]);

  // Students enrolled in selected group
  const [groupStudents, setGroupStudents] = useState([]);
  useEffect(() => {
    if (!selectedGroup) {
      setGroupStudents([]);
      return;
    }
    api.getStudentGroupDetails(selectedGroup)
      .then((data) => {
        const stuList = data?.students || [];
        setGroupStudents(stuList);
        if (stuList.length > 0 && !selectedStudentId) {
          setSelectedStudentId(stuList[0].student);
        }
      })
      .catch(() => {
        setGroupStudents([]);
      });
  }, [selectedGroup]);

  // 2. Generate Report Card(s)
  const handleGenerateReport = async () => {
    setLoading(true);
    setErrorMsg('');

    try {
      if (generationMode === 'single') {
        if (!selectedStudentId) {
          setErrorMsg('Please select a student to generate their report card.');
          setLoading(false);
          return;
        }

        const data = await api.getStudentReportCardData({
          student: selectedStudentId,
          program: selectedProgram || null,
          student_group: selectedGroup || null,
          academic_year: selectedAcademicYear || null,
          academic_term: selectedTerm || null,
        });

        if (!data || !data.student) {
          setErrorMsg('No report data or examination records found for this student.');
          setSingleReport(null);
        } else {
          setSingleReport(data);
        }
      } else {
        // Batch mode: generate for all students in group
        if (!selectedGroup) {
          setErrorMsg('Please select a Student Group / Batch to generate report cards.');
          setLoading(false);
          return;
        }

        const data = await api.getBatchReportCardsData({
          student_group: selectedGroup,
          program: selectedProgram || null,
          academic_year: selectedAcademicYear || null,
          academic_term: selectedTerm || null,
        });

        const list = Array.isArray(data) ? data : [];
        if (list.length === 0) {
          setErrorMsg('No students or report card records found for this group.');
          setBatchReports([]);
        } else {
          setBatchReports(list);
          setBatchIndex(0);
        }
      }
    } catch (err) {
      console.error('Error generating report card:', err);
      setErrorMsg(err.message || 'Failed to generate report card from backend.');
    } finally {
      setLoading(false);
    }
  };

  // Auto-generate on initial selection once student ID is ready
  useEffect(() => {
    if (selectedStudentId && !singleReport && generationMode === 'single') {
      handleGenerateReport();
    }
  }, [selectedStudentId]);

  // Current report to preview in UI
  const activeReport = useMemo(() => {
    if (generationMode === 'single') return singleReport;
    return batchReports[batchIndex] || null;
  }, [generationMode, singleReport, batchReports, batchIndex]);

  // Print Action
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300 print:space-y-0 print:m-0 print:p-0">
      {/* 1. Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 sm:p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm print:hidden">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-2xl bg-amber-50 dark:bg-amber-950/80 text-amber-600 dark:text-amber-400 flex items-center justify-center font-black shadow-xs">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
                  Student Report Generation Tool
                </h1>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300 border border-amber-200/60 dark:border-amber-800">
                  Official Academic Credential
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Official multi-subject Report Cards & Transcripts generator with school header, attendance, grades, and printable PDF cards
              </p>
            </div>
          </div>
        </div>

        {/* Print / Export Action Button */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={handlePrint}
            disabled={!activeReport}
            className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-white text-white dark:text-slate-900 text-xs font-bold shadow-xs transition active:scale-95 flex items-center gap-2 disabled:opacity-50"
          >
            <Printer className="w-4 h-4" />
            <span>{generationMode === 'batch' ? `Print All (${batchReports.length}) Report Cards` : 'Print / Save PDF'}</span>
          </button>
        </div>
      </div>

      {/* 2. Generation Mode Selector & Tool Configuration Controls */}
      <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-5 print:hidden">
        {/* Mode Toggle Pills */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800 flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Mode:</span>
            <div className="inline-flex p-1 bg-slate-100 dark:bg-slate-800 rounded-2xl">
              <button
                type="button"
                onClick={() => setGenerationMode('single')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition ${
                  generationMode === 'single'
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-xs'
                    : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'
                }`}
              >
                Single Student Report Card
              </button>
              <button
                type="button"
                onClick={() => setGenerationMode('batch')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition ${
                  generationMode === 'batch'
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-xs'
                    : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'
                }`}
              >
                Batch Class / Cohort Generation
              </button>
            </div>
          </div>

          <div className="text-xs text-slate-400 font-semibold">
            {generationMode === 'single' ? 'Generate for 1 student' : 'Generate for all students in selected section'}
          </div>
        </div>

        {/* Selection Dropdowns Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Program / Standard */}
          <div className="relative">
            <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1.5 uppercase tracking-wider">
              1. Standard / Class
            </label>
            <select
              value={selectedProgram}
              onChange={(e) => setSelectedProgram(e.target.value)}
              className="w-full appearance-none bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2 text-xs font-bold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500/20 cursor-pointer shadow-xs"
            >
              <option value="">Select Standard</option>
              {metadata.programs.map(p => {
                const name = typeof p === 'string' ? p : (p.program_name || p.name);
                return <option key={name} value={name}>{name}</option>;
              })}
            </select>
            <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 bottom-2.5 pointer-events-none" />
          </div>

          {/* Student Group / Section */}
          <div className="relative">
            <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1.5 uppercase tracking-wider">
              2. Student Group / Batch
            </label>
            <select
              value={selectedGroup}
              onChange={(e) => setSelectedGroup(e.target.value)}
              className="w-full appearance-none bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2 text-xs font-bold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500/20 cursor-pointer shadow-xs"
            >
              <option value="">Select Student Group</option>
              {filteredGroups.map(g => (
                <option key={g.name} value={g.name}>{g.name}</option>
              ))}
            </select>
            <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 bottom-2.5 pointer-events-none" />
          </div>

          {/* Student Selector (in Single Mode) */}
          {generationMode === 'single' ? (
            <div className="relative">
              <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1.5 uppercase tracking-wider">
                3. Student Target
              </label>
              <select
                value={selectedStudentId}
                onChange={(e) => setSelectedStudentId(e.target.value)}
                className="w-full appearance-none bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2 text-xs font-bold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500/20 cursor-pointer shadow-xs"
              >
                <option value="">Select Student</option>
                {groupStudents.map(s => (
                  <option key={s.student} value={s.student}>
                    {s.student_name} ({s.student}) {s.group_roll_number ? `• Roll ${s.group_roll_number}` : ''}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 bottom-2.5 pointer-events-none" />
            </div>
          ) : (
            <div className="flex flex-col justify-end">
              <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                <span>Enrolled in Batch:</span>
                <span className="text-brand-600 dark:text-brand-400 font-extrabold">{groupStudents.length} Students</span>
              </div>
            </div>
          )}

          {/* Academic Year & Term */}
          <div className="grid grid-cols-2 gap-2">
            <div className="relative">
              <label className="block text-[10px] font-bold text-slate-400 mb-1 uppercase">Year</label>
              <select
                value={selectedAcademicYear}
                onChange={(e) => setSelectedAcademicYear(e.target.value)}
                className="w-full appearance-none bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-xl px-2.5 py-1.5 text-xs font-bold text-slate-800 dark:text-slate-200 focus:outline-none"
              >
                <option value="2028-2029">2028-2029</option>
                <option value="2026-2027">2026-2027</option>
              </select>
            </div>

            <div className="relative">
              <label className="block text-[10px] font-bold text-slate-400 mb-1 uppercase">Term</label>
              <select
                value={selectedTerm}
                onChange={(e) => setSelectedTerm(e.target.value)}
                className="w-full appearance-none bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-xl px-2.5 py-1.5 text-xs font-bold text-slate-800 dark:text-slate-200 focus:outline-none"
              >
                <option value="Annual Assessment">Annual</option>
                <option value="Term 1">Term 1</option>
                <option value="Term 2">Term 2</option>
              </select>
            </div>
          </div>
        </div>

        {/* Report Options Toggles Bar */}
        <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-4 text-xs">
          <div className="flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-2 cursor-pointer font-semibold text-slate-700 dark:text-slate-300">
              <input
                type="checkbox"
                checked={reportOptions.showMarks}
                onChange={(e) => setReportOptions(prev => ({ ...prev, showMarks: e.target.checked }))}
                className="rounded text-brand-600 focus:ring-brand-500 w-4 h-4 cursor-pointer"
              />
              <span>Show Numerical Marks</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer font-semibold text-slate-700 dark:text-slate-300">
              <input
                type="checkbox"
                checked={reportOptions.includeAttendance}
                onChange={(e) => setReportOptions(prev => ({ ...prev, includeAttendance: e.target.checked }))}
                className="rounded text-brand-600 focus:ring-brand-500 w-4 h-4 cursor-pointer"
              />
              <span>Include Attendance Summary</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer font-semibold text-slate-700 dark:text-slate-300">
              <input
                type="checkbox"
                checked={reportOptions.addLetterhead}
                onChange={(e) => setReportOptions(prev => ({ ...prev, addLetterhead: e.target.checked }))}
                className="rounded text-brand-600 focus:ring-brand-500 w-4 h-4 cursor-pointer"
              />
              <span>School Emblem Letterhead</span>
            </label>
          </div>

          <button
            type="button"
            onClick={handleGenerateReport}
            disabled={loading}
            className="px-5 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold transition flex items-center gap-1.5 shadow-sm active:scale-95 disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Generate / Refresh Report</span>
          </button>
        </div>
      </div>

      {/* 3. Error Feedback */}
      {errorMsg && (
        <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/80 border border-rose-200 dark:border-rose-800 text-xs font-semibold text-rose-800 dark:text-rose-200 flex items-center gap-2 print:hidden">
          <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* 4. Batch Navigation Bar (in Batch Mode) */}
      {generationMode === 'batch' && batchReports.length > 0 && (
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm flex items-center justify-between print:hidden">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-500">Student Preview:</span>
            <span className="text-xs font-black text-slate-900 dark:text-slate-100">
              {batchIndex + 1} of {batchReports.length}
            </span>
            <span className="text-xs text-slate-400 font-mono">
              ({batchReports[batchIndex]?.student?.student_name})
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setBatchIndex(prev => Math.max(0, prev - 1))}
              disabled={batchIndex === 0}
              className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-30 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setBatchIndex(prev => Math.min(batchReports.length - 1, prev + 1))}
              disabled={batchIndex === batchReports.length - 1}
              className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-30 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* 5. Printable Report Card Document Body */}
      {loading ? (
        <div className="p-20 text-center text-xs text-slate-400 flex flex-col items-center justify-center gap-3 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800">
          <div className="w-8 h-8 border-3 border-brand-500 border-t-transparent rounded-full animate-spin" />
          <span className="font-bold text-sm text-slate-700 dark:text-slate-300">Compiling official academic report card...</span>
        </div>
      ) : !activeReport ? (
        <div className="p-20 text-center text-xs text-slate-400 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800">
          No report card to preview. Select a student and click "Generate / Refresh Report".
        </div>
      ) : (
        /* The Actual Report Card Container */
        <div className="bg-slate-100 dark:bg-slate-950 p-2 sm:p-6 rounded-3xl print:p-0 print:bg-white print:m-0 print:border-none print:shadow-none">
          <div className="max-w-4xl mx-auto bg-white text-slate-900 p-6 sm:p-10 rounded-2xl shadow-xl border border-slate-200 relative print:shadow-none print:border-none print:p-0 print:m-0 print:max-w-none">
            
            {/* Double Border Frame */}
            <div className="border-4 border-double border-slate-800 p-6 sm:p-8 rounded-xl relative overflow-hidden bg-white print:p-4 print:border-4 print:rounded-none report-card-print-frame">
              
              {/* Subtle Watermark */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-[0.03]">
                <GraduationCap className="w-96 h-96 text-slate-900" />
              </div>

              {/* School Header */}
              {reportOptions.addLetterhead && (
                <div className="text-center pb-5 print:pb-2.5 border-b-2 print:border-b-2 border-slate-800 relative z-10 space-y-1.5 print:space-y-1">
                  <div className="inline-flex items-center justify-center w-12 h-12 print:w-9 print:h-9 rounded-2xl bg-slate-900 text-white mb-1 print:mb-0.5 shadow-md">
                    <GraduationCap className="w-7 h-7 print:w-5 print:h-5 text-amber-400" />
                  </div>
                  <h1 className="text-2xl sm:text-3xl font-black uppercase tracking-tight text-slate-900 print:text-xl print:mb-0">
                    {activeReport.school?.name || 'ABC International School'}
                  </h1>
                  <p className="text-xs print:text-[10px] print:leading-tight font-semibold text-slate-600 tracking-wide uppercase">
                    Excellence in Global Learning, Character Building & Holistic Academics
                  </p>
                  <p className="text-[11px] print:text-[8.5px] text-slate-500">
                    {activeReport.school?.affiliation || 'Affiliation No. 2028-EDU-ABC'} · Academic Session {activeReport.school?.academic_year || selectedAcademicYear}
                  </p>

                  <div className="pt-2 print:pt-1">
                    <span className="inline-block px-4 py-1 print:px-3 print:py-0.5 rounded-full bg-slate-900 text-amber-300 text-xs print:text-[9px] font-black uppercase tracking-widest shadow-sm">
                      Official Student Academic Report Card
                    </span>
                  </div>
                </div>
              )}

              {/* Student Demographics Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 print:gap-2.5 py-5 print:py-2.5 border-b border-slate-300 text-xs print:text-[9.5px] relative z-10">
                <div>
                  <span className="text-[10px] print:text-[8px] uppercase font-bold text-slate-500 block">Student Name</span>
                  <span className="font-extrabold text-slate-900 text-sm print:text-[11px] truncate block">
                    {activeReport.student?.student_name}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] print:text-[8px] uppercase font-bold text-slate-500 block">Roll No. / ID</span>
                  <span className="font-bold text-slate-900 font-mono text-xs print:text-[9.5px] block">
                    {activeReport.student?.roll_no ? `Roll: ${activeReport.student.roll_no} • ` : ''}{activeReport.student?.name}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] print:text-[8px] uppercase font-bold text-slate-500 block">Standard / Class</span>
                  <span className="font-bold text-slate-900 text-xs print:text-[9.5px] block">
                    {activeReport.student?.program || selectedProgram}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] print:text-[8px] uppercase font-bold text-slate-500 block">Evaluation Term</span>
                  <span className="font-bold text-slate-900 text-xs print:text-[9.5px] block">
                    {activeReport.student?.academic_term || selectedTerm}
                  </span>
                </div>

                {activeReport.student?.guardian_name && (
                  <div>
                    <span className="text-[10px] print:text-[8px] uppercase font-bold text-slate-500 block">Parent / Guardian</span>
                    <span className="font-bold text-slate-800 text-xs print:text-[9.5px] block truncate">
                      {activeReport.student.guardian_name}
                    </span>
                  </div>
                )}
                {activeReport.student?.guardian_phone && (
                  <div>
                    <span className="text-[10px] print:text-[8px] uppercase font-bold text-slate-500 block">Emergency Contact</span>
                    <span className="font-mono text-slate-700 text-xs print:text-[9.5px] block">
                      {activeReport.student.guardian_phone}
                    </span>
                  </div>
                )}
                <div>
                  <span className="text-[10px] print:text-[8px] uppercase font-bold text-slate-500 block">Academic Session</span>
                  <span className="font-bold text-slate-800 text-xs print:text-[9.5px] block">
                    {activeReport.student?.academic_year || selectedAcademicYear}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] print:text-[8px] uppercase font-bold text-slate-500 block">Issue Date</span>
                  <span className="font-bold text-slate-800 text-xs print:text-[9.5px] block">
                    {new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </span>
                </div>
              </div>

              {/* Attendance Banner */}
              {reportOptions.includeAttendance && activeReport.attendance && (
                <div className="my-4 print:my-2 p-3 print:p-2 rounded-xl bg-slate-50 border border-slate-200 flex flex-wrap items-center justify-between gap-3 print:gap-2 text-xs print:text-[9px] relative z-10">
                  <div className="flex items-center gap-1.5">
                    <UserCheck className="w-4 h-4 print:w-3.5 print:h-3.5 text-emerald-600" />
                    <span className="font-bold text-slate-800">Attendance Dossier:</span>
                  </div>
                  <div className="flex items-center gap-4 print:gap-3 text-slate-700 font-semibold">
                    <span>Working Days: <strong className="text-slate-900">{activeReport.attendance.total || 0}</strong></span>
                    <span>Days Present: <strong className="text-emerald-700">{activeReport.attendance.present || 0}</strong></span>
                    <span>Days Absent: <strong className="text-rose-700">{activeReport.attendance.absent || 0}</strong></span>
                    <span>Attendance Rate: <strong className="text-brand-700">{activeReport.attendance.percentage}%</strong></span>
                  </div>
                </div>
              )}

              {/* Subject Academic Performance Table */}
              <div className="py-4 print:py-2 relative z-10">
                <table className="w-full text-left text-xs print:text-[9.5px] border border-slate-300 border-collapse">
                  <thead>
                    <tr className="bg-slate-100 border-b border-slate-300 text-[11px] print:text-[8.5px] font-bold text-slate-800 uppercase">
                      <th className="py-2.5 print:py-1.5 px-3 print:px-2 w-8 text-center border-r border-slate-300">#</th>
                      <th className="py-2.5 print:py-1.5 px-4 print:px-2.5 border-r border-slate-300">Course / Academic Subject</th>
                      {reportOptions.showMarks && (
                        <>
                          <th className="py-2.5 print:py-1.5 px-3 print:px-2 text-center border-r border-slate-300 w-20 print:w-16">Max Marks</th>
                          <th className="py-2.5 print:py-1.5 px-3 print:px-2 text-center border-r border-slate-300 w-20 print:w-16">Obtained</th>
                          <th className="py-2.5 print:py-1.5 px-3 print:px-2 text-center border-r border-slate-300 w-20 print:w-16">Percentage</th>
                        </>
                      )}
                      <th className="py-2.5 print:py-1.5 px-3 print:px-2 text-center w-16 print:w-12 border-r border-slate-300">Grade</th>
                      <th className="py-2.5 print:py-1.5 px-3 print:px-2.5">Subject Remarks</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {(activeReport.results || []).length === 0 ? (
                      <tr>
                        <td colSpan={reportOptions.showMarks ? 7 : 4} className="py-8 print:py-4 text-center text-slate-400">
                          No course examination results recorded for this academic period.
                        </td>
                      </tr>
                    ) : (
                      (activeReport.results || []).map((row, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/80">
                          <td className="py-2.5 print:py-1 px-3 print:px-2 text-center font-mono text-slate-500 border-r border-slate-200">{idx + 1}</td>
                          <td className="py-2.5 print:py-1 px-4 print:px-2.5 font-bold text-slate-900 border-r border-slate-200">
                            <div>{row.course}</div>
                            {/* Criteria sub-breakdown */}
                            {row.details && row.details.length > 1 && (
                              <div className="text-[10px] print:text-[8px] text-slate-500 font-normal mt-0.5 space-x-2">
                                {row.details.map(d => (
                                  <span key={d.assessment_criteria}>
                                    {d.assessment_criteria}: {d.score}/{d.maximum_score}
                                  </span>
                                ))}
                              </div>
                            )}
                          </td>
                          {reportOptions.showMarks && (
                            <>
                              <td className="py-2.5 print:py-1 px-3 print:px-2 text-center font-mono border-r border-slate-200">{row.maximum_score}</td>
                              <td className="py-2.5 print:py-1 px-3 print:px-2 text-center font-bold font-mono border-r border-slate-200 text-slate-900">{row.total_score}</td>
                              <td className="py-2.5 print:py-1 px-3 print:px-2 text-center font-mono border-r border-slate-200">{row.percentage}%</td>
                            </>
                          )}
                          <td className="py-2.5 print:py-1 px-3 print:px-2 text-center border-r border-slate-200">
                            <span className={`inline-block px-2.5 print:px-1.5 py-0.5 rounded-full text-xs print:text-[8.5px] font-bold border ${getGradeBadgeTheme(row.grade)}`}>
                              {row.grade}
                            </span>
                          </td>
                          <td className="py-2.5 print:py-1 px-3 print:px-2.5 text-slate-600 italic">
                            {row.comment || (row.percentage >= 80 ? 'Exceptional mastery' : row.percentage >= 60 ? 'Good grasp of concepts' : 'Needs practice')}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>

                  {/* Table Footer: Cumulative Totals */}
                  {reportOptions.showMarks && (activeReport.results || []).length > 0 && (
                    <tfoot className="bg-slate-100 font-bold border-t-2 print:border-t-2 border-slate-800 text-slate-900">
                      <tr>
                        <td colSpan={2} className="py-2.5 print:py-1.5 px-4 print:px-2.5 uppercase text-right border-r border-slate-300">
                          Grand Total
                        </td>
                        <td className="py-2.5 print:py-1.5 px-3 print:px-2 text-center font-mono border-r border-slate-300">
                          {activeReport.summary?.total_max}
                        </td>
                        <td className="py-2.5 print:py-1.5 px-3 print:px-2 text-center font-mono border-r border-slate-300 text-brand-700">
                          {activeReport.summary?.total_obtained}
                        </td>
                        <td className="py-2.5 print:py-1.5 px-3 print:px-2 text-center font-mono border-r border-slate-300">
                          {activeReport.summary?.percentage}%
                        </td>
                        <td className="py-2.5 print:py-1.5 px-3 print:px-2 text-center border-r border-slate-300">
                          <span className={`inline-block px-2.5 print:px-1.5 py-0.5 rounded-full text-xs print:text-[8.5px] font-bold border ${getGradeBadgeTheme(activeReport.summary?.grade)}`}>
                            {activeReport.summary?.grade}
                          </span>
                        </td>
                        <td className="py-2.5 print:py-1.5 px-3 print:px-2.5 text-emerald-700">
                          {activeReport.summary?.result_status || 'Promoted'}
                        </td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>

              {/* Performance Summary Banner */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 print:gap-2 my-4 print:my-2 p-4 print:p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-center relative z-10">
                <div>
                  <div className="text-[10px] print:text-[8px] uppercase font-bold text-slate-500">Total Marks</div>
                  <div className="text-base print:text-sm font-black text-slate-900 font-mono">
                    {activeReport.summary?.total_obtained} / {activeReport.summary?.total_max}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] print:text-[8px] uppercase font-bold text-slate-500">Aggregate Percentage</div>
                  <div className="text-base print:text-sm font-black text-brand-700 font-mono">
                    {activeReport.summary?.percentage}%
                  </div>
                </div>
                <div>
                  <div className="text-[10px] print:text-[8px] uppercase font-bold text-slate-500">Cumulative Grade</div>
                  <div className="text-base print:text-sm font-black text-slate-900">
                    Grade {activeReport.summary?.grade}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] print:text-[8px] uppercase font-bold text-slate-500">Final Result</div>
                  <div className="text-base print:text-sm font-black text-emerald-700">
                    {activeReport.summary?.result_status || 'Promoted'}
                  </div>
                </div>
              </div>

              {/* Grading Scale Legend */}
              {reportOptions.includeGradingScaleLegend && activeReport.grading_scale?.intervals && (
                <div className="my-4 print:my-1.5 pt-3 print:pt-1.5 border-t border-slate-200 text-[10px] print:text-[8px] text-slate-600 relative z-10">
                  <div className="font-bold uppercase text-slate-500 mb-1 print:mb-0.5">
                    Grading Scale Key ({activeReport.grading_scale.grading_scale || 'School Scale'}):
                  </div>
                  <div className="flex flex-wrap gap-3 print:gap-1.5">
                    {activeReport.grading_scale.intervals.map(int => (
                      <span key={int.grade} className="px-2 print:px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200 font-mono">
                        <strong className="text-slate-800">{int.grade}</strong>: ≥{int.min_percentage}% ({int.description})
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Remarks & Signatures Footer */}
              <div className="pt-6 print:pt-2.5 border-t-2 print:border-t-2 border-slate-800 relative z-10 space-y-6 print:space-y-2.5">
                <div>
                  <span className="text-[10px] print:text-[8px] uppercase font-bold text-slate-500 block">Class Teacher's General Remarks</span>
                  <p className="text-xs print:text-[9.5px] text-slate-800 italic mt-0.5">
                    "{reportOptions.teacherRemarks}"
                  </p>
                </div>

                {/* Signatures */}
                <div className="grid grid-cols-3 gap-6 print:gap-4 pt-8 print:pt-8 text-center text-xs print:text-[9.5px]">
                  <div className="border-t-2 border-slate-700 pt-2 print:pt-1 font-bold text-slate-700">
                    Class Teacher
                  </div>
                  <div className="border-t-2 border-slate-700 pt-2 print:pt-1 font-bold text-slate-700">
                    Parent / Guardian Signature
                  </div>
                  <div className="border-t-2 border-slate-700 pt-2 print:pt-1 font-bold text-slate-900">
                    Principal & School Seal
                  </div>
                </div>
              </div>

            </div>
          </div>
        </div>
      )}
    </div>
  );
}
