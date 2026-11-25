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
    activeAcademicYear,
    activeStudentId,
    studentProfile,
    students,
    schoolSettings
  } = useAuth();

  // Students / guardians may only generate their own (or their wards') report cards
  const portalStudents = useMemo(() => {
    if (isStaff) return null;
    if (Array.isArray(students) && students.length > 0) {
      return students.map(w => ({ student: w.student, student_name: w.student_name }));
    }
    if (studentProfile?.name) {
      return [{ student: studentProfile.name, student_name: studentProfile.student_name }];
    }
    return [];
  }, [isStaff, students, studentProfile]);

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
  const [selectedAcademicYear, setSelectedAcademicYear] = useState(activeAcademicYear || '');
  const [selectedTerm, setSelectedTerm] = useState(''); // '' = all terms
  const [selectedStudentId, setSelectedStudentId] = useState('');

  // Report Card Options
  const [reportOptions, setReportOptions] = useState({
    showMarks: true,
    includeAttendance: true,
    addLetterhead: true,
    includeGradingScaleLegend: true,
    teacherRemarks: '',
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
          academic_years: meta.academic_years || [],
          academic_terms: meta.academic_terms || [],
          grading_scales: meta.grading_scales || [],
        });

        if (isStaff && progs.length > 0) {
          const defaultProg = progs.find(p => (p.name || p) === activeProgram) || progs[0];
          setSelectedProgram(defaultProg.name || defaultProg);
        }
      })
      .catch((err) => {
        console.error('Failed to load report setup metadata:', err);
        setErrorMsg(err.message || 'Failed to load report setup data.');
      });
  }, []);

  // Filtered student groups based on selected program
  // Groups of the selected program first (class/section batches before course groups),
  // program-less groups (clubs/activities) last so they are never the default
  const filteredGroups = useMemo(() => {
    const groups = (metadata.student_groups || []).filter(g => !selectedProgram || !g.program || g.program === selectedProgram);
    const rank = g => (g.program && g.program === selectedProgram ? 0 : g.program ? 1 : 2) * 2 + (g.group_based_on === 'Batch' ? 0 : 1);
    return [...groups].sort((a, b) => rank(a) - rank(b) || String(a.name).localeCompare(String(b.name)));
  }, [metadata.student_groups, selectedProgram]);

  // Auto-select first matching student group when program changes
  useEffect(() => {
    if (filteredGroups.length > 0) {
      setSelectedGroup(filteredGroups[0].name);
    } else {
      setSelectedGroup('');
    }
  }, [filteredGroups]);

  // Terms belonging to the selected academic year
  const filteredTerms = useMemo(() => {
    return (metadata.academic_terms || []).filter(t => !selectedAcademicYear || !t.academic_year || t.academic_year === selectedAcademicYear);
  }, [metadata.academic_terms, selectedAcademicYear]);

  useEffect(() => {
    if (selectedTerm && !filteredTerms.some(t => t.name === selectedTerm)) {
      setSelectedTerm('');
    }
  }, [filteredTerms]);

  // Students enrolled in selected group (staff) or the user's own / ward records (portal)
  const [groupStudents, setGroupStudents] = useState([]);
  useEffect(() => {
    if (!isStaff) {
      const list = portalStudents || [];
      setGroupStudents(list);
      const preferred = list.find(s => s.student === activeStudentId) || list[0];
      if (preferred && !list.some(s => s.student === selectedStudentId)) {
        setSelectedStudentId(preferred.student);
      }
      return;
    }
    if (!selectedGroup) {
      setGroupStudents([]);
      return;
    }
    api.getStudentGroupDetails(selectedGroup)
      .then((data) => {
        const stuList = data?.students || [];
        setGroupStudents(stuList);
        if (stuList.length > 0 && !stuList.some(s => s.student === selectedStudentId)) {
          setSelectedStudentId(stuList[0].student);
        }
      })
      .catch((err) => {
        console.error('Failed to load student group roster:', err);
        setGroupStudents([]);
      });
  }, [selectedGroup, isStaff, portalStudents, activeStudentId]);

  // Students / guardians pick among the selected student's own program enrollments
  const [portalPrograms, setPortalPrograms] = useState(null); // null = not loaded yet
  useEffect(() => {
    if (isStaff || !selectedStudentId) return;
    let cancelled = false;
    setPortalPrograms(null);
    api.getStudentPrograms(selectedStudentId)
      .then((rows) => {
        if (cancelled) return;
        const list = [...new Set((Array.isArray(rows) ? rows : []).map(r => r.program).filter(Boolean))];
        setPortalPrograms(list);
        setSelectedProgram(prev => (list.includes(prev) ? prev : (list.includes(activeProgram) ? activeProgram : (list[0] || ''))));
      })
      .catch(() => { if (!cancelled) setPortalPrograms([]); });
    return () => { cancelled = true; };
  }, [isStaff, selectedStudentId, activeProgram]);

  // 2. Generate Report Card(s)
  const requestSeq = useRef(0);
  const handleGenerateReport = async () => {
    const seq = ++requestSeq.current;
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
          student_group: isStaff ? (selectedGroup || null) : null,
          academic_year: selectedAcademicYear || null,
          academic_term: selectedTerm || null,
        });

        if (seq !== requestSeq.current) return; // a newer request superseded this one
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

        if (seq !== requestSeq.current) return;
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
      if (seq !== requestSeq.current) return;
      console.error('Error generating report card:', err);
      setErrorMsg(err.message || 'Failed to generate report card from backend.');
      if (generationMode === 'single') setSingleReport(null);
    } finally {
      if (seq === requestSeq.current) setLoading(false);
    }
  };

  // Auto-generate whenever the target student (or, for students / guardians, their program) changes
  useEffect(() => {
    if (!selectedStudentId || generationMode !== 'single') return;
    if (!isStaff && portalPrograms === null) return; // wait for the student's own programs
    handleGenerateReport();
  }, [selectedStudentId, isStaff ? null : selectedProgram, portalPrograms === null]);

  // Current report to preview in UI
  const activeReport = useMemo(() => {
    if (generationMode === 'single') return singleReport;
    return batchReports[batchIndex] || null;
  }, [generationMode, singleReport, batchReports, batchIndex]);

  // Print Action
  const handlePrint = () => {
    window.print();
  };

  // One printable report card document
  const renderReportCard = (report, key, extraClass) => (
    <div key={key} data-report-card={report.student?.name} className={`bg-slate-100 dark:bg-slate-950 p-2 sm:p-6 rounded-3xl print:p-0 print:bg-white print:m-0 print:border-none print:shadow-none ${extraClass}`}>
      <div className="max-w-4xl mx-auto bg-white text-slate-900 p-3 sm:p-10 rounded-2xl shadow-xl border border-slate-200 relative print:shadow-none print:border-none print:p-0 print:m-0 print:max-w-none">
      
        {/* Double Border Frame */}
        <div className="border-4 border-double border-slate-800 p-3 sm:p-8 rounded-xl relative overflow-hidden bg-white print:p-4 print:border-4 print:rounded-none report-card-print-frame">
        
          {/* Subtle Watermark */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-[0.03]">
            <GraduationCap className="w-60 h-60 sm:w-96 sm:h-96 print:w-96 print:h-96 text-slate-900" />
          </div>

          {/* School Header */}
          {reportOptions.addLetterhead && (
            <div className="text-center pb-5 print:pb-2.5 border-b-2 print:border-b-2 border-slate-800 relative z-10 space-y-1.5 print:space-y-1">
              <div className="inline-flex items-center justify-center w-12 h-12 print:w-9 print:h-9 rounded-2xl bg-slate-900 text-white mb-1 print:mb-0.5 shadow-md">
                <GraduationCap className="w-7 h-7 print:w-5 print:h-5 text-amber-400" />
              </div>
              <h1 className="text-xl sm:text-3xl font-black uppercase tracking-tight text-slate-900 break-words print:text-xl print:mb-0">
                {report.school?.name || schoolSettings?.name || ''}
              </h1>
              {report.school?.address && (
                <p className="text-xs print:text-[10px] print:leading-tight font-semibold text-slate-600 tracking-wide uppercase break-words">
                  {report.school.address}
                </p>
              )}
              {(report.school?.academic_year || selectedAcademicYear) && (
                <p className="text-[11px] print:text-[8.5px] text-slate-500">
                  Academic Session {report.school?.academic_year || selectedAcademicYear}
                </p>
              )}

              <div className="pt-2 print:pt-1">
                <span className="inline-block max-w-full px-3 sm:px-4 py-1 print:px-3 print:py-0.5 rounded-full bg-slate-900 text-amber-300 text-[11px] sm:text-xs print:text-[9px] font-black uppercase tracking-wider sm:tracking-widest shadow-sm">
                  Official Student Academic Report Card
                </span>
              </div>
            </div>
          )}

          {/* Student Demographics Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 print:grid-cols-4 gap-3 sm:gap-4 print:gap-2.5 py-4 sm:py-5 print:py-2.5 border-b border-slate-300 text-xs print:text-[9.5px] relative z-10">
            <div className="min-w-0">
              <span className="text-[11px] print:text-[8px] uppercase font-bold text-slate-500 block">Student Name</span>
              <span className="font-extrabold text-slate-900 text-sm print:text-[11px] truncate block" title={report.student?.student_name}>
                {report.student?.student_name}
              </span>
            </div>
            <div className="min-w-0">
              <span className="text-[11px] print:text-[8px] uppercase font-bold text-slate-500 block">Roll No. / ID</span>
              <span className="font-bold text-slate-900 font-mono text-xs print:text-[9.5px] block break-all">
                {report.student?.roll_no ? `Roll: ${report.student.roll_no} • ` : ''}{report.student?.name}
              </span>
            </div>
            <div className="min-w-0">
              <span className="text-[11px] print:text-[8px] uppercase font-bold text-slate-500 block">Standard / Class</span>
              <span className="font-bold text-slate-900 text-xs print:text-[9.5px] block">
                {report.student?.program || selectedProgram}
              </span>
            </div>
            <div className="min-w-0">
              <span className="text-[11px] print:text-[8px] uppercase font-bold text-slate-500 block">Evaluation Term</span>
              <span className="font-bold text-slate-900 text-xs print:text-[9.5px] block">
                {report.student?.academic_term || selectedTerm || 'All Terms'}
              </span>
            </div>

            {report.student?.guardian_name && (
              <div className="min-w-0">
                <span className="text-[11px] print:text-[8px] uppercase font-bold text-slate-500 block">Parent / Guardian</span>
                <span className="font-bold text-slate-800 text-xs print:text-[9.5px] block truncate" title={report.student.guardian_name}>
                  {report.student.guardian_name}
                </span>
              </div>
            )}
            {report.student?.guardian_phone && (
              <div className="min-w-0">
                <span className="text-[11px] print:text-[8px] uppercase font-bold text-slate-500 block">Emergency Contact</span>
                <span className="font-mono text-slate-700 text-xs print:text-[9.5px] block break-all">
                  {report.student.guardian_phone}
                </span>
              </div>
            )}
            <div className="min-w-0">
              <span className="text-[11px] print:text-[8px] uppercase font-bold text-slate-500 block">Academic Session</span>
              <span className="font-bold text-slate-800 text-xs print:text-[9.5px] block">
                {report.student?.academic_year || selectedAcademicYear}
              </span>
            </div>
            <div className="min-w-0">
              <span className="text-[11px] print:text-[8px] uppercase font-bold text-slate-500 block">Issue Date</span>
              <span className="font-bold text-slate-800 text-xs print:text-[9.5px] block">
                {new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
              </span>
            </div>
          </div>

          {/* Attendance Banner */}
          {reportOptions.includeAttendance && report.attendance && (
            <div className="my-4 print:my-2 p-3 print:p-2 rounded-xl bg-slate-50 border border-slate-200 flex flex-wrap items-center justify-between gap-3 print:gap-2 text-xs print:text-[9px] relative z-10">
              <div className="flex items-center gap-1.5">
                <UserCheck className="w-4 h-4 print:w-3.5 print:h-3.5 text-emerald-600" />
                <span className="font-bold text-slate-800">Attendance Dossier:</span>
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 print:gap-3 text-slate-700 font-semibold">
                <span>Working Days: <strong className="text-slate-900">{report.attendance.total || 0}</strong></span>
                <span>Days Present: <strong className="text-emerald-700">{report.attendance.present || 0}</strong></span>
                <span>Days Absent: <strong className="text-rose-700">{report.attendance.absent || 0}</strong></span>
                <span>Attendance Rate: <strong className="text-brand-700">{report.attendance.percentage === null || report.attendance.percentage === undefined ? '—' : `${report.attendance.percentage}%`}</strong></span>
              </div>
            </div>
          )}

          {/* Subject Academic Performance Table */}
          <div className="py-4 print:py-2 relative z-10 overflow-x-auto print:overflow-visible">
            <table className="w-full min-w-[560px] print:min-w-0 text-left text-xs print:text-[9.5px] border border-slate-300 border-collapse">
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
                {(report.results || []).length === 0 ? (
                  <tr>
                    <td colSpan={reportOptions.showMarks ? 7 : 4} className="py-8 print:py-4 text-center text-slate-400">
                      No course examination results recorded for this academic period.
                    </td>
                  </tr>
                ) : (
                  (report.results || []).map((row, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/80">
                      <td className="py-2.5 print:py-1 px-3 print:px-2 text-center font-mono text-slate-500 border-r border-slate-200">{idx + 1}</td>
                      <td className="py-2.5 print:py-1 px-4 print:px-2.5 font-bold text-slate-900 border-r border-slate-200">
                        <div>{row.course}</div>
                {row.assessment_group && (
                  <div className="text-[11px] print:text-[8px] text-slate-500 font-semibold">{row.assessment_group}</div>
                )}
                        {/* Criteria sub-breakdown */}
                        {row.details && row.details.length > 1 && (
                          <div className="text-[11px] print:text-[8px] text-slate-500 font-normal mt-0.5 space-x-2">
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
                        {row.comment || row.grade_description || '—'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>

              {/* Table Footer: Cumulative Totals */}
              {reportOptions.showMarks && (report.results || []).length > 0 && (
                <tfoot className="bg-slate-100 font-bold border-t-2 print:border-t-2 border-slate-800 text-slate-900">
                  <tr>
                    <td colSpan={2} className="py-2.5 print:py-1.5 px-4 print:px-2.5 uppercase text-right border-r border-slate-300">
                      Grand Total
                    </td>
                    <td className="py-2.5 print:py-1.5 px-3 print:px-2 text-center font-mono border-r border-slate-300">
                      {report.summary?.total_max}
                    </td>
                    <td className="py-2.5 print:py-1.5 px-3 print:px-2 text-center font-mono border-r border-slate-300 text-brand-700">
                      {report.summary?.total_obtained}
                    </td>
                    <td className="py-2.5 print:py-1.5 px-3 print:px-2 text-center font-mono border-r border-slate-300">
                      {report.summary?.percentage === null || report.summary?.percentage === undefined ? '—' : `${report.summary.percentage}%`}
                    </td>
                    <td className="py-2.5 print:py-1.5 px-3 print:px-2 text-center border-r border-slate-300">
                      <span className={`inline-block px-2.5 print:px-1.5 py-0.5 rounded-full text-xs print:text-[8.5px] font-bold border ${getGradeBadgeTheme(report.summary?.grade)}`}>
                        {report.summary?.grade}
                      </span>
                    </td>
                    <td className={`py-2.5 print:py-1.5 px-3 print:px-2.5 ${report.summary?.result_status === 'Needs Improvement' ? 'text-rose-700' : 'text-emerald-700'}`}>
                      {report.summary?.result_status || '—'}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>

          {/* Performance Summary Banner */}
          <div className="grid grid-cols-2 sm:grid-cols-4 print:grid-cols-4 gap-3 print:gap-2 my-4 print:my-2 p-3 sm:p-4 print:p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-center relative z-10">
            <div>
              <div className="text-[11px] print:text-[8px] uppercase font-bold text-slate-500">Total Marks</div>
              <div className="text-sm sm:text-base print:text-sm font-black break-words text-slate-900 font-mono">
                {report.summary?.total_obtained} / {report.summary?.total_max}
              </div>
            </div>
            <div>
              <div className="text-[11px] print:text-[8px] uppercase font-bold text-slate-500">Aggregate Percentage</div>
              <div className="text-sm sm:text-base print:text-sm font-black break-words text-brand-700 font-mono">
                {report.summary?.percentage === null || report.summary?.percentage === undefined ? '—' : `${report.summary.percentage}%`}
              </div>
            </div>
            <div>
              <div className="text-[11px] print:text-[8px] uppercase font-bold text-slate-500">Cumulative Grade</div>
              <div className="text-sm sm:text-base print:text-sm font-black break-words text-slate-900">
                {report.summary?.grade ? `Grade ${report.summary.grade}` : '—'}
              </div>
            </div>
            <div>
              <div className="text-[11px] print:text-[8px] uppercase font-bold text-slate-500">Final Result</div>
              <div className={`text-sm sm:text-base print:text-sm font-black break-words ${report.summary?.result_status === 'Needs Improvement' ? 'text-rose-700' : 'text-emerald-700'}`}>
                {report.summary?.result_status || '—'}
              </div>
            </div>
          </div>

          {/* Grading Scale Legend */}
          {reportOptions.includeGradingScaleLegend && report.grading_scale?.intervals?.length > 0 && (
            <div className="my-4 print:my-1.5 pt-3 print:pt-1.5 border-t border-slate-200 text-[11px] print:text-[8px] text-slate-600 relative z-10">
              <div className="font-bold uppercase text-slate-500 mb-1 print:mb-0.5">
                Grading Scale Key ({report.grading_scale.grading_scale}):
              </div>
              <div className="flex flex-wrap gap-3 print:gap-1.5">
                {report.grading_scale.intervals.map(int => (
                  <span key={int.grade} className="px-2 print:px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200 font-mono">
                    <strong className="text-slate-800">{int.grade}</strong>: ≥{int.min_percentage}%{int.description ? ` (${int.description})` : ''}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Remarks & Signatures Footer */}
          <div className="pt-6 print:pt-2.5 border-t-2 print:border-t-2 border-slate-800 relative z-10 space-y-6 print:space-y-2.5">
            {reportOptions.teacherRemarks.trim() && (
              <div className="min-w-0">
                <span className="text-[11px] print:text-[8px] uppercase font-bold text-slate-500 block">Class Teacher's General Remarks</span>
                <p className="text-xs print:text-[9.5px] text-slate-800 italic mt-0.5">
                  "{reportOptions.teacherRemarks.trim()}"
                </p>
              </div>
            )}

            {/* Signatures */}
            <div className="grid grid-cols-1 sm:grid-cols-3 print:grid-cols-3 gap-8 sm:gap-6 print:gap-4 pt-8 print:pt-8 text-center text-xs print:text-[9.5px]">
              <div className="border-t-2 border-slate-700 pt-2 print:pt-1 font-bold text-slate-700">
                Class Teacher{report.student?.class_teacher ? ` (${report.student.class_teacher})` : ''}
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
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-300 print:space-y-0 print:m-0 print:p-0">
      {/* 1. Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 sm:p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm print:hidden">
        <div className="space-y-1 min-w-0">
          <div className="flex items-start sm:items-center gap-2">
            <div className="w-10 h-10 shrink-0 rounded-2xl bg-amber-50 dark:bg-amber-950/80 text-amber-600 dark:text-amber-400 flex items-center justify-center font-black shadow-xs">
              <FileText className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
                  Student Report Generation Tool
                </h1>
                <span className="px-2 py-0.5 rounded-full text-[11px] sm:text-[10px] font-bold bg-amber-50 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300 border border-amber-200/60 dark:border-amber-800">
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
        <div className="flex items-center gap-2.5 w-full sm:w-auto">
          <button
            onClick={handlePrint}
            disabled={!activeReport}
            className="w-full sm:w-auto justify-center min-h-[36px] px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-white text-white dark:text-slate-900 text-xs font-bold shadow-xs transition active:scale-95 flex items-center gap-2 disabled:opacity-50"
          >
            <Printer className="w-4 h-4" />
            <span>{generationMode === 'batch' ? `Print All (${batchReports.length}) Report Cards` : 'Print / Save PDF'}</span>
          </button>
        </div>
      </div>

      {/* 2. Generation Mode Selector & Tool Configuration Controls */}
      <div className="p-4 sm:p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-5 print:hidden">
        {/* Mode Toggle Pills */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800 flex-wrap gap-3">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 w-full sm:w-auto">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Mode:</span>
            <div className="flex sm:inline-flex w-full sm:w-auto p-1 bg-slate-100 dark:bg-slate-800 rounded-2xl">
              <button
                type="button"
                onClick={() => setGenerationMode('single')}
                className={`flex-1 sm:flex-none min-h-[36px] sm:min-h-0 px-2.5 sm:px-3.5 py-1.5 rounded-xl text-xs font-bold transition ${
                  generationMode === 'single'
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-xs'
                    : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'
                }`}
              >
                Single Student Report Card
              </button>
              <button
                type="button"
                disabled={!isStaff}
                title={isStaff ? undefined : 'Batch generation is available to staff'}
                onClick={() => setGenerationMode('batch')}
                className={`flex-1 sm:flex-none min-h-[36px] sm:min-h-0 px-2.5 sm:px-3.5 py-1.5 rounded-xl text-xs font-bold transition ${
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
              disabled={!isStaff && !(portalPrograms && portalPrograms.length > 1)}
              onChange={(e) => setSelectedProgram(e.target.value)}
              className="w-full appearance-none bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2 text-xs font-bold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500/20 cursor-pointer shadow-xs"
            >
              {(isStaff || !portalPrograms?.length) && <option value="">Select Standard</option>}
              {(isStaff ? metadata.programs : (portalPrograms || [])).map(p => {
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
              disabled={!isStaff}
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
              <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between gap-2">
                <span>Enrolled in Batch:</span>
                <span className="text-brand-600 dark:text-brand-400 font-extrabold">{groupStudents.length} Students</span>
              </div>
            </div>
          )}

          {/* Academic Year & Term */}
          <div className="grid grid-cols-2 gap-2">
            <div className="relative">
              <label className="block text-[11px] sm:text-[10px] font-bold text-slate-400 mb-1 uppercase">Year</label>
              <select
                value={selectedAcademicYear}
                onChange={(e) => setSelectedAcademicYear(e.target.value)}
                className="w-full appearance-none bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-xl px-2.5 py-1.5 text-xs font-bold text-slate-800 dark:text-slate-200 focus:outline-none"
              >
                <option value="">{metadata.academic_years.length ? 'Enrollment Year' : 'No Academic Years'}</option>
                {metadata.academic_years.map(y => (
                  <option key={y.name || y} value={y.name || y}>{y.name || y}</option>
                ))}
              </select>
            </div>

            <div className="relative">
              <label className="block text-[11px] sm:text-[10px] font-bold text-slate-400 mb-1 uppercase">Term</label>
              <select
                value={selectedTerm}
                onChange={(e) => setSelectedTerm(e.target.value)}
                className="w-full appearance-none bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-xl px-2.5 py-1.5 text-xs font-bold text-slate-800 dark:text-slate-200 focus:outline-none"
              >
                <option value="">All Terms</option>
                {filteredTerms.map(t => (
                  <option key={t.name} value={t.name}>{t.term_name || t.name}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Report Options Toggles Bar */}
        <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-4 text-xs">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-3 w-full lg:w-auto lg:flex-1 min-w-0">
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

            <input
              type="text"
              value={reportOptions.teacherRemarks}
              onChange={(e) => setReportOptions(prev => ({ ...prev, teacherRemarks: e.target.value }))}
              placeholder="Class teacher's general remarks (optional)"
              className="w-full sm:w-auto sm:min-w-[240px] bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-1.5 text-xs font-medium text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
            />
          </div>

          <button
            type="button"
            onClick={handleGenerateReport}
            disabled={loading}
            className="w-full sm:w-auto justify-center min-h-[36px] px-5 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold transition flex items-center gap-1.5 shadow-sm active:scale-95 disabled:opacity-50"
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
          <span className="min-w-0 break-words">{errorMsg}</span>
        </div>
      )}

      {/* 4. Batch Navigation Bar (in Batch Mode) */}
      {generationMode === 'batch' && batchReports.length > 0 && (
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-wrap items-center justify-between gap-3 print:hidden">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 min-w-0 flex-1">
            <span className="text-xs font-bold text-slate-500">Student Preview:</span>
            <span className="text-xs font-black text-slate-900 dark:text-slate-100">
              {batchIndex + 1} of {batchReports.length}
            </span>
            <span className="text-xs text-slate-400 font-mono truncate max-w-full" title={batchReports[batchIndex]?.student?.student_name}>
              ({batchReports[batchIndex]?.student?.student_name})
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setBatchIndex(prev => Math.max(0, prev - 1))}
              disabled={batchIndex === 0}
              className="p-2 sm:p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-30 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setBatchIndex(prev => Math.min(batchReports.length - 1, prev + 1))}
              disabled={batchIndex === batchReports.length - 1}
              className="p-2 sm:p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-30 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* 5. Printable Report Card Document Body */}
      {loading ? (
        <div className="p-8 sm:p-20 text-center text-xs text-slate-400 flex flex-col items-center justify-center gap-3 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800">
          <div className="w-8 h-8 border-3 border-brand-500 border-t-transparent rounded-full animate-spin" />
          <span className="font-bold text-sm text-slate-700 dark:text-slate-300">Compiling official academic report card...</span>
        </div>
      ) : !activeReport ? (
        <div className="p-8 sm:p-20 text-center text-xs text-slate-400 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800">
          No report card to preview. Select a student and click "Generate / Refresh Report".
        </div>
      ) : (
        generationMode === 'batch' && batchReports.length > 0 ? (
          // Batch: preview one card on screen, but print every card (one per page)
          <>
            {batchReports.map((rep, idx) => renderReportCard(
              rep,
              `${rep.student?.name}-${idx}`,
              `${idx === batchIndex ? '' : 'hidden print:block'} ${idx < batchReports.length - 1 ? 'print:break-after-page' : ''}`,
            ))}
          </>
        ) : renderReportCard(activeReport, 'single', '')
      )}
    </div>
  );
}
