import { todayISO } from '../utils/date';
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Calculator, 
  CheckCircle2, 
  AlertCircle, 
  Search, 
  ChevronDown, 
  Plus, 
  Save, 
  Check, 
  Download, 
  Printer, 
  Sparkles, 
  Users, 
  BookOpen, 
  Layers, 
  ArrowUpDown, 
  RefreshCw, 
  FileSpreadsheet,
  HelpCircle,
  X,
  Lock,
  Edit2
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/frappeClient';
import { calculateGradeFromScale, getGradeBadgeTheme } from '../utils/grades';

// Validation message for one criterion score ('' when valid)
function scoreError(raw, maxScore) {
  const v = String(raw ?? '').trim();
  if (v === '') return 'every criterion needs a score';
  const num = Number(v);
  if (!Number.isFinite(num)) return `"${v}" is not a number`;
  if (num < 0) return 'scores cannot be negative';
  if (num > Number(maxScore)) return `${num} exceeds the maximum of ${maxScore}`;
  return '';
}

export default function AssessmentResultTool() {
  const { 
    isStaff, 
    isAdmin, 
    isInstructor, 
    programs, 
    activeProgram 
  } = useAuth();

  // State: Assessment Plans & Filters
  const [plans, setPlans] = useState([]);
  const [selectedPlanId, setSelectedPlanId] = useState('');
  const [standardFilter, setStandardFilter] = useState('all');
  const [loadingPlans, setLoadingPlans] = useState(true);

  // State: Selected Plan Data
  const [criteria, setCriteria] = useState([]);
  const [students, setStudents] = useState([]);
  const [gradingScaleData, setGradingScaleData] = useState(null);
  const [loadingPlanData, setLoadingPlanData] = useState(false);

  // State: Scores Grid { [studentId]: { criteria: { [critName]: score }, comment: '', docstatus: 0, name: '' } }
  const [scoresState, setScoresState] = useState({});
  const [originalScores, setOriginalScores] = useState({});
  const [dirty, setDirty] = useState(false);

  // Filter & Search inside the grid
  const [searchStudent, setSearchStudent] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // all, graded, ungraded, submitted, draft

  // Saving / Submitting states
  const [isSaving, setIsSaving] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState(null); // { type: 'success' | 'error', message: '' }

  // Quick Create Assessment Plan Modal
  const [showCreatePlanModal, setShowCreatePlanModal] = useState(false);
  const [planMeta, setPlanMeta] = useState({
    programs: [],
    student_groups: [],
    courses: [],
    grading_scales: [],
    assessment_groups: [],
    criteria: [],
  });
  const [newPlanForm, setNewPlanForm] = useState({
    program: '',
    student_group: '',
    course: '',
    assessment_name: '',
    assessment_group: '',
    grading_scale: '',
    schedule_date: todayISO(),
    from_time: '09:00',
    to_time: '10:00',
    criteria_rows: [],
  });
  const [isCreatingPlan, setIsCreatingPlan] = useState(false);

  // Input ref map for Excel-like keyboard navigation: `inputRefs.current[studentIdx][critIdx]`
  const inputRefs = useRef({});

  // 1. Initial Load: Fetch all Assessment Plans
  const fetchAssessmentPlans = async () => {
    setLoadingPlans(true);
    try {
      const data = await api.getAssessmentPlans('all', 'all', 'all');
      const list = Array.isArray(data) ? data : [];
      setPlans(list);
      if (list.length > 0 && !selectedPlanId) {
        setSelectedPlanId(list[0].name);
      }
    } catch (err) {
      console.error('Failed to load assessment plans:', err);
      setFeedback({ type: 'error', message: 'Failed to load assessment plans from backend.' });
    } finally {
      setLoadingPlans(false);
    }
  };

  useEffect(() => {
    fetchAssessmentPlans();
  }, []);

  // Fetch setup metadata for creating new plans
  useEffect(() => {
    api.getAssessmentSetupMetadata()
      .then((data) => {
        if (data) {
          setPlanMeta(data);
          setNewPlanForm(prev => ({
            ...prev,
            assessment_group: prev.assessment_group || data.assessment_groups?.[0]?.name || '',
            criteria_rows: prev.criteria_rows?.length
              ? prev.criteria_rows
              : (data.criteria?.[0] ? [{ assessment_criteria: data.criteria[0].name, maximum_score: '100' }] : []),
          }));
        }
      })
      .catch((err) => console.error('Failed to load assessment setup metadata:', err));
  }, []);

  // Active Plan Document Object
  const activePlan = useMemo(() => {
    return plans.find(p => p.name === selectedPlanId) || null;
  }, [plans, selectedPlanId]);

  // Unique Standards/Programs from available plans
  const uniqueStandards = useMemo(() => {
    const set = new Set();
    plans.forEach(p => {
      if (p.program) set.add(p.program);
    });
    return Array.from(set).sort();
  }, [plans]);

  // Filtered list of Assessment Plans
  const filteredPlans = useMemo(() => {
    if (standardFilter === 'all') return plans;
    return plans.filter(p => p.program === standardFilter);
  }, [plans, standardFilter]);

  // Total Max Score of Active Plan
  const totalMaxScore = useMemo(() => {
    return criteria.reduce((sum, c) => sum + (parseFloat(c.maximum_score) || 0), 0);
  }, [criteria]);

  // 2. When Selected Assessment Plan changes: Load Students, Criteria, and Grading Scale
  useEffect(() => {
    if (!selectedPlanId || !activePlan) return;

    setLoadingPlanData(true);
    setFeedback(null);
    setDirty(false);

    Promise.all([
      api.getAssessmentDetails(selectedPlanId),
      api.getAssessmentStudents(selectedPlanId, activePlan.student_group),
      api.getGradingScaleIntervals({
        assessment_plan: selectedPlanId,
        grading_scale: activePlan.grading_scale || null,
        course: activePlan.course || null
      })
    ])
      .then(([criteriaRes, studentsRes, scaleRes]) => {
        const critList = Array.isArray(criteriaRes) ? criteriaRes : [];
        const stuList = Array.isArray(studentsRes) ? studentsRes : [];
        
        setCriteria(critList);
        setGradingScaleData(scaleRes || null);
        applyStudentsSnapshot(stuList, critList);
      })
      .catch((err) => {
        console.error('Error loading assessment plan details:', err);
        setFeedback({ type: 'error', message: 'Failed to load student roster or criteria.' });
      })
      .finally(() => {
        setLoadingPlanData(false);
      });
    // Re-run only when the plan identity changes, not when the plan list is refreshed
    // (a refresh after Submit must not wipe the success message).
  }, [selectedPlanId, activePlan?.name, activePlan?.student_group]);

  // Rebuild the marks grid from the backend roster (existing Assessment Result values)
  function applyStudentsSnapshot(stuList, critList = criteria) {
    const list = Array.isArray(stuList) ? stuList : [];
    const initialMap = {};
    list.forEach(stu => {
      const stuDetails = stu.assessment_details || {};
      const critScores = {};
      critList.forEach(c => {
        const val = stuDetails[c.assessment_criteria]?.[0];
        critScores[c.assessment_criteria] = val !== undefined && val !== null ? String(val) : '';
      });
      initialMap[stu.student] = {
        criteria: critScores,
        comment: stuDetails.comment || '',
        docstatus: stu.docstatus || 0,
        resultName: stu.name || null,
      };
    });
    setStudents(list);
    setScoresState(initialMap);
    setOriginalScores(JSON.parse(JSON.stringify(initialMap)));
  }

  // Handlers for Score and Remarks changes
  // Out-of-range values are kept as typed and flagged on the cell; Save refuses them.
  const handleScoreChange = (studentId, critName, rawVal) => {
    const val = rawVal;

    setScoresState(prev => {
      const stu = prev[studentId] || { criteria: {}, comment: '', docstatus: 0 };
      return {
        ...prev,
        [studentId]: {
          ...stu,
          criteria: {
            ...stu.criteria,
            [critName]: val,
          }
        }
      };
    });
    setDirty(true);
  };

  const handleCommentChange = (studentId, val) => {
    setScoresState(prev => {
      const stu = prev[studentId] || { criteria: {}, comment: '', docstatus: 0 };
      return {
        ...prev,
        [studentId]: {
          ...stu,
          comment: val,
        }
      };
    });
    setDirty(true);
  };

  // Keyboard Navigation: Enter moves down, Shift+Enter moves up, Tab moves right
  const handleKeyDown = (e, rowIdx, colIdx) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const targetRow = e.shiftKey ? rowIdx - 1 : rowIdx + 1;
      const nextInput = inputRefs.current[`${targetRow}_${colIdx}`];
      if (nextInput) nextInput.focus();
    }
  };

  // Filtered Students in the Table
  const filteredStudents = useMemo(() => {
    return students.filter(stu => {
      // 1. Search Query filter
      const matchesSearch = !searchStudent || 
        stu.student_name?.toLowerCase().includes(searchStudent.toLowerCase()) ||
        stu.student?.toLowerCase().includes(searchStudent.toLowerCase()) ||
        String(stu.group_roll_number || '').includes(searchStudent);

      if (!matchesSearch) return false;

      // 2. Status filter
      const stuEntry = scoresState[stu.student];
      const isSubmitted = stuEntry?.docstatus === 1;
      const hasAnyScore = Object.values(stuEntry?.criteria || {}).some(v => v !== '');

      if (statusFilter === 'submitted') return isSubmitted;
      if (statusFilter === 'draft') return !isSubmitted && hasAnyScore;
      if (statusFilter === 'ungraded') return !hasAnyScore;
      if (statusFilter === 'graded') return hasAnyScore;

      return true;
    });
  }, [students, scoresState, searchStudent, statusFilter]);

  // Calculate statistics across students
  const stats = useMemo(() => {
    let totalScoreSum = 0;
    let gradedCount = 0;
    let submittedCount = 0;

    students.forEach(stu => {
      const stuEntry = scoresState[stu.student];
      if (!stuEntry) return;

      const hasScore = Object.values(stuEntry.criteria || {}).some(v => v !== '');
      if (hasScore) gradedCount++;
      if (stuEntry.docstatus === 1) submittedCount++;

      let studentTotal = 0;
      criteria.forEach(c => {
        studentTotal += parseFloat(stuEntry.criteria[c.assessment_criteria] || 0) || 0;
      });
      totalScoreSum += studentTotal;
    });

    const avgScore = gradedCount > 0 ? (totalScoreSum / gradedCount).toFixed(1) : 0;
    const avgPct = totalMaxScore > 0 ? Math.round((avgScore / totalMaxScore) * 100) : 0;

    return {
      totalStudents: students.length,
      gradedCount,
      submittedCount,
      pendingCount: students.length - gradedCount,
      avgScore,
      avgPct,
    };
  }, [students, scoresState, criteria, totalMaxScore]);

  // Action: Save Drafts. Returns true when every pending row was saved.
  const handleSaveDrafts = async () => {
    if (!selectedPlanId || !activePlan) return false;

    // Like the desk tool, a result is only recorded once every criterion has a valid score;
    // students left blank are skipped instead of being saved with zero marks.
    const toSave = [];
    const problems = [];
    for (const stu of students) {
      const stuEntry = scoresState[stu.student];
      if (!stuEntry || stuEntry.docstatus === 1) continue;
      const values = criteria.map(c => String(stuEntry.criteria[c.assessment_criteria] ?? '').trim());
      if (values.every(v => v === '')) continue;
      const unchanged = stuEntry.resultName &&
        JSON.stringify(stuEntry) === JSON.stringify(originalScores[stu.student]);
      if (unchanged) continue;
      const errors = criteria.map((c, i) => scoreError(values[i], c.maximum_score)).filter(Boolean);
      if (errors.length) {
        problems.push(`${stu.student_name || stu.student}: ${errors[0]}`);
        continue;
      }
      toSave.push(stu);
    }
    if (problems.length) {
      setFeedback({ type: 'error', message: `Fix these marks before saving — ${problems.join('; ')}` });
      return false;
    }
    if (toSave.length === 0) {
      setDirty(false);
      setFeedback({ type: 'success', message: 'No new or changed marks to save.' });
      return true;
    }

    setIsSaving(true);
    setFeedback(null);

    try {
      let savedCount = 0;
      for (const stu of toSave) {
        const stuEntry = scoresState[stu.student];
        let total = 0;
        const detailsPayload = {};
        criteria.forEach(c => {
          const val = parseFloat(stuEntry.criteria[c.assessment_criteria]);
          total += val;
          detailsPayload[c.assessment_criteria] = val;
        });

        const payload = {
          student: stu.student,
          assessment_details: detailsPayload,
          total_score: total,
          comment: stuEntry.comment || '',
        };

        await api.markAssessmentResult(selectedPlanId, JSON.stringify(payload));
        savedCount++;
      }

      setDirty(false);
      setFeedback({ 
        type: 'success', 
        message: `Successfully saved marks for ${savedCount} student(s) as Draft.` 
      });

      // Reload fresh students state
      const refreshed = await api.getAssessmentStudents(selectedPlanId, activePlan.student_group);
      applyStudentsSnapshot(refreshed);
      return true;
    } catch (err) {
      console.error('Error saving assessment marks:', err);
      setFeedback({ type: 'error', message: err.message || 'Failed to save student marks.' });
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  // Action: Submit & Publish Results
  const handleSubmitResults = async () => {
    if (!selectedPlanId || !activePlan) return;

    if (!window.confirm(`Are you sure you want to officially SUBMIT & PUBLISH marks for ${activePlan.course} (${activePlan.student_group})? Once submitted, results become official and locked.`)) {
      return;
    }

    setIsSubmitting(true);
    setFeedback(null);

    try {
      // First ensure any pending draft marks in the state are saved; abort if that fails
      if (!(await handleSaveDrafts())) return;

      // Submit all results for this group
      const submittedCount = await api.submitAssessmentResults(selectedPlanId, activePlan.student_group);

      setFeedback(submittedCount
        ? { type: 'success', message: `Successfully published ${submittedCount} official Assessment Result(s)!` }
        : { type: 'error', message: 'No draft results to submit. Enter and save marks first.' });

      // Refresh list
      const refreshed = await api.getAssessmentStudents(selectedPlanId, activePlan.student_group);
      applyStudentsSnapshot(refreshed);
      fetchAssessmentPlans();
    } catch (err) {
      console.error('Error submitting assessment results:', err);
      setFeedback({ type: 'error', message: err.message || 'Failed to submit assessment results.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Quick Action: Fill Default Score for empty students
  // `fraction` of each criterion's own maximum (rounded to 0.5), only for blank cells
  const handleQuickFill = (fraction) => {
    setScoresState(prev => {
      const updated = { ...prev };
      students.forEach(stu => {
        const cur = updated[stu.student];
        if (cur && cur.docstatus !== 1) {
          const newCrit = { ...cur.criteria };
          criteria.forEach(c => {
            if (String(newCrit[c.assessment_criteria] ?? '').trim() === '') {
              newCrit[c.assessment_criteria] = String(Math.round(Number(c.maximum_score) * fraction * 2) / 2);
            }
          });
          updated[stu.student] = { ...cur, criteria: newCrit };
        }
      });
      return updated;
    });
    setDirty(true);
  };

  // Export to CSV
  const handleExportCSV = () => {
    if (!activePlan || students.length === 0) return;

    const headers = ['Roll No', 'Student ID', 'Student Name', ...criteria.map(c => `${c.assessment_criteria} (Max ${c.maximum_score})`), 'Total Score', 'Percentage', 'Grade', 'Remarks', 'Status'];
    const rows = students.map((stu, idx) => {
      const stuEntry = scoresState[stu.student] || { criteria: {}, comment: '', docstatus: 0 };
      let currentTotal = 0;
      criteria.forEach(c => {
        currentTotal += parseFloat(stuEntry.criteria[c.assessment_criteria] || 0) || 0;
      });
      const exactPct = totalMaxScore > 0 ? (currentTotal / totalMaxScore) * 100 : 0;
      const pct = Math.round(exactPct);
      const graded = Object.values(stuEntry.criteria).some(v => v !== '');
      const grade = graded ? calculateGradeFromScale(exactPct, gradingScaleData?.intervals || []) : '';
      const status = stuEntry.docstatus === 1 ? 'Submitted' : (graded ? 'Draft' : 'Ungraded');

      return [
        stu.group_roll_number || idx + 1,
        stu.student,
        `"${stu.student_name}"`,
        ...criteria.map(c => stuEntry.criteria[c.assessment_criteria] || '0'),
        currentTotal,
        `${pct}%`,
        grade,
        `"${stuEntry.comment || ''}"`,
        status
      ];
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Marksheet_${activePlan.course}_${activePlan.student_group}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Quick Create Assessment Plan submission
  const handleCreatePlan = async (e) => {
    e.preventDefault();
    if (!newPlanForm.course || !newPlanForm.student_group) {
      alert('Please select Course and Student Group.');
      return;
    }
    const rows = (newPlanForm.criteria_rows || []).filter(r => r.assessment_criteria);
    if (rows.length === 0) {
      alert('Please add at least one Assessment Criteria (configure Assessment Criteria in Frappe first).');
      return;
    }
    if (new Set(rows.map(r => r.assessment_criteria)).size !== rows.length) {
      alert('Each Assessment Criteria can only be added once.');
      return;
    }
    if (rows.some(r => !(Number(r.maximum_score) > 0))) {
      alert('Every criterion needs a maximum score greater than 0.');
      return;
    }
    if (newPlanForm.from_time && newPlanForm.to_time && newPlanForm.from_time >= newPlanForm.to_time) {
      alert('The end time must be after the start time.');
      return;
    }

    setIsCreatingPlan(true);
    try {
      const courseScale = (planMeta.courses || []).find(c => c.name === newPlanForm.course)?.default_grading_scale;
      const res = await api.createAssessmentPlan({
        student_group: newPlanForm.student_group,
        course: newPlanForm.course,
        program: newPlanForm.program || undefined,
        assessment_name: newPlanForm.assessment_name || undefined,
        assessment_group: newPlanForm.assessment_group || undefined,
        grading_scale: newPlanForm.grading_scale || courseScale || undefined,
        schedule_date: newPlanForm.schedule_date || todayISO(),
        from_time: newPlanForm.from_time ? `${newPlanForm.from_time}:00`.slice(0, 8) : undefined,
        to_time: newPlanForm.to_time ? `${newPlanForm.to_time}:00`.slice(0, 8) : undefined,
        criteria: JSON.stringify(rows.map(r => ({ assessment_criteria: r.assessment_criteria, maximum_score: Number(r.maximum_score) }))),
      });

      alert(`Assessment Plan ${res?.name || 'created'} successfully!`);
      setShowCreatePlanModal(false);
      
      // Refresh list and select the new one
      await fetchAssessmentPlans();
      if (res?.name) {
        setStandardFilter('all');
        setSelectedPlanId(res.name);
      }
    } catch (err) {
      console.error('Failed to create assessment plan:', err);
      alert(err.message || 'Failed to create Assessment Plan');
    } finally {
      setIsCreatingPlan(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* 1. Header & Title Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 sm:p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm">
        <div className="space-y-1 min-w-0">
          <div className="flex items-start sm:items-center gap-2">
            <div className="w-10 h-10 shrink-0 rounded-2xl bg-brand-50 dark:bg-brand-950/80 text-brand-600 dark:text-brand-400 flex items-center justify-center font-black shadow-xs">
              <Calculator className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
                  Assessment Result Tool
                </h1>
                <span className="px-2 py-0.5 rounded-full text-[11px] sm:text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800">
                  Official Frappe Tool
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Rapid spreadsheet marks-entry sheet to grade students, calculate percentages, and publish results to backend
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons: New Assessment Plan & Marksheet Export */}
        <div className="flex items-center gap-2.5 flex-wrap w-full sm:w-auto">
          <button
            onClick={() => setShowCreatePlanModal(true)}
            className="flex-1 sm:flex-none justify-center min-h-[36px] px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold transition flex items-center gap-1.5 border border-slate-200 dark:border-slate-700 shadow-2xs"
          >
            <Plus className="w-4 h-4 text-brand-500" />
            <span>+ New Assessment Plan</span>
          </button>

          <button
            onClick={handleExportCSV}
            disabled={!activePlan || students.length === 0}
            className="flex-1 sm:flex-none justify-center min-h-[36px] px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold transition flex items-center gap-1.5 border border-slate-200 dark:border-slate-700 shadow-2xs disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* 2. Top Filter & Selector Controls */}
      <div className="p-4 sm:p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Filter by Standard / Class */}
          <div className="relative">
            <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1.5 uppercase tracking-wider">
              1. Filter by Standard / Class
            </label>
            <select
              value={standardFilter}
              onChange={(e) => {
                const val = e.target.value;
                setStandardFilter(val);
                const matching = val === 'all' ? plans : plans.filter(p => p.program === val);
                if (matching.length > 0) {
                  setSelectedPlanId(matching[0].name);
                }
              }}
              className="w-full appearance-none bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-xl pl-3.5 pr-9 py-2 text-xs truncate font-bold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500/20 cursor-pointer shadow-xs"
            >
              <option value="all">All Standards & Classes</option>
              {uniqueStandards.map(std => (
                <option key={std} value={std}>{std}</option>
              ))}
            </select>
            <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 bottom-2.5 pointer-events-none" />
          </div>

          {/* Assessment Plan Selector */}
          <div className="relative sm:col-span-2">
            <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1.5 uppercase tracking-wider">
              2. Select Assessment Plan (Exam / Test)
            </label>
            <select
              value={selectedPlanId}
              onChange={(e) => setSelectedPlanId(e.target.value)}
              disabled={loadingPlans}
              className="w-full appearance-none bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-xl pl-3.5 pr-9 py-2 text-xs truncate font-bold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500/20 cursor-pointer shadow-xs"
            >
              {filteredPlans.length === 0 ? (
                <option value="">No assessment plans available for this filter</option>
              ) : (
                filteredPlans.map(p => (
                  <option key={p.name} value={p.name}>
                    {p.assessment_name || p.course} • {p.student_group} ({p.name}) {p.schedule_date ? `— ${p.schedule_date}` : ''}
                  </option>
                ))
              )}
            </select>
            <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 bottom-2.5 pointer-events-none" />
          </div>
        </div>

        {/* Selected Plan Metadata Summary Cards */}
        {activePlan && (
          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex flex-wrap items-center gap-2 min-w-0">
              <span className="px-3 py-1 rounded-xl break-words max-w-full bg-brand-50 dark:bg-brand-950/80 text-brand-700 dark:text-brand-300 font-bold border border-brand-200/50 dark:border-brand-800">
                Subject: {activePlan.course}
              </span>
              <span className="px-3 py-1 rounded-xl break-words max-w-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold border border-slate-200 dark:border-slate-700">
                Cohort: {activePlan.student_group}
              </span>
              <span className="px-3 py-1 rounded-xl bg-indigo-50 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 font-bold border border-indigo-200/50 dark:border-indigo-800">
                Max Score: {totalMaxScore} Marks
              </span>
              <span className="px-3 py-1 rounded-xl break-words max-w-full bg-emerald-50 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 font-bold border border-emerald-200/50 dark:border-emerald-800">
                Grading Scale: {gradingScaleData?.grading_scale || activePlan.grading_scale || 'Not configured'}
              </span>
            </div>

            {/* Criteria breakdown chips */}
            {criteria.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400 min-w-0">
                <span className="font-semibold">Criteria:</span>
                {criteria.map(c => (
                  <span key={c.assessment_criteria} className="px-2 py-0.5 rounded-lg break-all bg-slate-100 dark:bg-slate-800 font-mono text-slate-600 dark:text-slate-300">
                    {c.assessment_criteria} (Max {c.maximum_score})
                  </span>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 3. Class Performance KPI Summary Bar */}
      {activePlan && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3 sm:p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className="w-9 h-9 shrink-0 rounded-xl bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold">
              <Users className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="text-[11px] font-semibold text-slate-400 truncate">Total Enrolled</div>
              <div className="text-sm sm:text-base font-black text-slate-900 dark:text-slate-100 break-words">{stats.totalStudents} Students</div>
            </div>
          </div>

          <div className="p-3 sm:p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className="w-9 h-9 shrink-0 rounded-xl bg-amber-50 dark:bg-amber-950 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold">
              <Edit2 className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="text-[11px] font-semibold text-slate-400 truncate">Graded (Draft/Pub)</div>
              <div className="text-sm sm:text-base font-black text-slate-900 dark:text-slate-100 break-words">
                {stats.gradedCount} / {stats.totalStudents}
              </div>
            </div>
          </div>

          <div className="p-3 sm:p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className="w-9 h-9 shrink-0 rounded-xl bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="text-[11px] font-semibold text-slate-400 truncate">Published / Submitted</div>
              <div className="text-sm sm:text-base font-black text-slate-900 dark:text-slate-100 break-words">{stats.submittedCount} Official</div>
            </div>
          </div>

          <div className="p-3 sm:p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className="w-9 h-9 shrink-0 rounded-xl bg-purple-50 dark:bg-purple-950 text-purple-600 dark:text-purple-400 flex items-center justify-center font-bold">
              <Sparkles className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="text-[11px] font-semibold text-slate-400 truncate">Class Average</div>
              <div className="text-sm sm:text-base font-black text-slate-900 dark:text-slate-100 break-words">
                {stats.avgScore} <span className="text-xs font-semibold text-slate-400">({stats.avgPct}%)</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 4. Feedback Notifications */}
      {feedback && (
        <div className={`p-4 rounded-2xl border text-xs font-semibold flex items-center justify-between gap-3 animate-in fade-in duration-200 ${
          feedback.type === 'success' 
            ? 'bg-emerald-50 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-200 border-emerald-200 dark:border-emerald-800' 
            : 'bg-rose-50 dark:bg-rose-950/80 text-rose-800 dark:text-rose-200 border-rose-200 dark:border-rose-800'
        }`}>
          <div className="flex items-center gap-2 min-w-0">
            {feedback.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-500" /> : <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />}
            <span className="min-w-0 break-words">{feedback.message}</span>
          </div>
          <button onClick={() => setFeedback(null)} className="shrink-0 p-1.5 -m-1.5 text-slate-400 hover:text-slate-600">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 5. Spreadsheet Roster & Marks Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl shadow-sm overflow-hidden flex flex-col">
        {/* Table Top Controls: Search, Status Filter, Quick Fill */}
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50 dark:bg-slate-800/40">
          <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
            {/* Student Search */}
            <div className="relative w-full sm:w-64">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search student or roll no..."
                value={searchStudent}
                onChange={(e) => setSearchStudent(e.target.value)}
                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl pl-8 pr-3 py-1.5 text-xs text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
              />
            </div>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full sm:w-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 focus:outline-none"
            >
              <option value="all">All Statuses ({students.length})</option>
              <option value="graded">Graded ({stats.gradedCount})</option>
              <option value="ungraded">Ungraded ({stats.pendingCount})</option>
              <option value="draft">Drafts Pending</option>
              <option value="submitted">Officially Submitted ({stats.submittedCount})</option>
            </select>
          </div>

          {/* Rapid Fill Helpers & Keyboard Tip */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] text-slate-400 hidden lg:inline">
              <kbd className="px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-mono text-[10px]">Enter</kbd> moves down
            </span>

            <div className="flex items-center gap-1 bg-white dark:bg-slate-900 p-1 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold">
              <span className="text-[11px] sm:text-[10px] text-slate-400 px-1">Quick Fill:</span>
              <button 
                type="button"
                onClick={() => handleQuickFill(0.8)}
                className="px-2.5 sm:px-2 py-1.5 sm:py-0.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-[11px] text-slate-700 dark:text-slate-300 font-bold"
              >
                80%
              </button>
              <button 
                type="button"
                onClick={() => handleQuickFill(0.9)}
                className="px-2.5 sm:px-2 py-1.5 sm:py-0.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-[11px] text-slate-700 dark:text-slate-300 font-bold"
              >
                90%
              </button>
            </div>
          </div>
        </div>

        {/* Table Content */}
        <div className="overflow-x-auto min-h-[300px]">
          {loadingPlanData ? (
            <div className="p-16 text-center text-xs text-slate-400 flex flex-col items-center justify-center gap-3">
              <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
              <span>Loading student roster & marksheet...</span>
            </div>
          ) : filteredStudents.length === 0 ? (
            <div className="p-16 text-center text-xs text-slate-400">
              No students found matching your criteria.
            </div>
          ) : (
            <table className="w-full min-w-[760px] text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100/80 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                  <th className="py-3 px-3 w-12 text-center">Roll</th>
                  <th className="py-3 px-3 sm:px-4 min-w-[140px] sm:min-w-[180px] sticky left-0 z-10 bg-slate-100 dark:bg-slate-800 shadow-[1px_0_0_0_rgb(226_232_240)] dark:shadow-[1px_0_0_0_rgb(51_65_85)]">Student Details</th>
                  {criteria.map((c, colIdx) => (
                    <th key={c.assessment_criteria} className="py-3 px-3 text-center min-w-[120px] bg-slate-50/50 dark:bg-slate-800/40">
                      <div className="text-slate-800 dark:text-slate-200 truncate">{c.assessment_criteria}</div>
                      <div className="text-[11px] text-brand-600 dark:text-brand-400 font-mono font-normal">Max: {c.maximum_score}</div>
                    </th>
                  ))}
                  <th className="py-3 px-3 text-center w-28 bg-slate-100 dark:bg-slate-800">
                    <div>Total Marks</div>
                    <div className="text-[11px] text-slate-400 font-normal">Max: {totalMaxScore}</div>
                  </th>
                  <th className="py-3 px-3 text-center w-24">Grade</th>
                  <th className="py-3 px-3 min-w-[150px]">Teacher's Remarks</th>
                  <th className="py-3 px-3 text-center w-28">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredStudents.map((stu, rowIdx) => {
                  const stuEntry = scoresState[stu.student] || { criteria: {}, comment: '', docstatus: 0 };
                  const isLocked = stuEntry.docstatus === 1;

                  // Compute total score and percentage
                  let currentTotal = 0;
                  criteria.forEach(c => {
                    currentTotal += parseFloat(stuEntry.criteria[c.assessment_criteria] || 0) || 0;
                  });

                  const exactPct = totalMaxScore > 0 ? (currentTotal / totalMaxScore) * 100 : 0;
                  const pct = Math.round(exactPct);
                  const hasEnteredMarks = Object.values(stuEntry.criteria).some(v => v !== '');
                  // Grade from the unrounded percentage, exactly as the backend computes it
                  const calculatedGrade = hasEnteredMarks
                    ? calculateGradeFromScale(exactPct, gradingScaleData?.intervals || [])
                    : '—';

                  return (
                    <tr 
                      key={stu.student}
                      className={`hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors ${
                        isLocked ? 'bg-slate-50/30 dark:bg-slate-900/30' : ''
                      }`}
                    >
                      {/* Roll Number */}
                      <td className="py-2.5 px-3 text-center font-mono font-bold text-slate-500">
                        {stu.group_roll_number || rowIdx + 1}
                      </td>

                      {/* Student Info */}
                      <td className="py-2.5 px-3 sm:px-4 sticky left-0 z-[1] bg-white dark:bg-slate-900 shadow-[1px_0_0_0_rgb(241_245_249)] dark:shadow-[1px_0_0_0_rgb(30_41_59)]">
                        <div className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5 min-w-0 max-w-[150px] sm:max-w-none">
                          {isLocked && <Lock className="w-3 h-3 text-emerald-500 shrink-0" title="Officially Submitted & Published" />}
                          <span className="truncate" title={stu.student_name}>{stu.student_name}</span>
                        </div>
                        <div className="text-[11px] text-slate-400 font-mono truncate max-w-[150px] sm:max-w-none" title={stu.student}>{stu.student}</div>
                      </td>

                      {/* Criteria Score Input Cells */}
                      {criteria.map((c, colIdx) => {
                        const val = stuEntry.criteria[c.assessment_criteria] || '';
                        const cellError = !isLocked && val !== '' ? scoreError(val, c.maximum_score) : '';
                        return (
                          <td key={c.assessment_criteria} className="py-2 px-3 text-center bg-slate-50/30 dark:bg-slate-800/20">
                            <input
                              ref={el => { inputRefs.current[`${rowIdx}_${colIdx}`] = el; }}
                              type="number"
                              min="0"
                              max={c.maximum_score}
                              step="0.5"
                              value={val}
                              disabled={isLocked || isSaving || isSubmitting}
                              onChange={(e) => handleScoreChange(stu.student, c.assessment_criteria, e.target.value)}
                              onKeyDown={(e) => handleKeyDown(e, rowIdx, colIdx)}
                              placeholder="—"
                              aria-invalid={cellError ? 'true' : undefined}
                              title={cellError || undefined}
                              className={`w-20 px-2.5 py-1.5 text-center font-bold text-xs rounded-xl border focus:outline-none focus:ring-2 focus:ring-brand-500 transition-all ${
                                isLocked
                                  ? 'bg-slate-100 dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700 cursor-not-allowed'
                                  : cellError
                                    ? 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-400 dark:border-rose-700 shadow-2xs'
                                    : 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 border-slate-300 dark:border-slate-700 shadow-2xs'
                              }`}
                            />
                            {cellError && (
                              <div className="mt-0.5 text-[10px] font-semibold text-rose-600 dark:text-rose-400">{cellError}</div>
                            )}
                          </td>
                        );
                      })}

                      {/* Total Score & Pct */}
                      <td className="py-2.5 px-3 text-center font-bold text-slate-900 dark:text-slate-100 bg-slate-50/50 dark:bg-slate-800/30">
                        <div className="text-xs">{currentTotal}</div>
                        <div className="text-[11px] text-slate-400 font-mono font-normal">({pct}%)</div>
                      </td>

                      {/* Grade Badge */}
                      <td className="py-2.5 px-3 text-center">
                        <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-bold border ${getGradeBadgeTheme(calculatedGrade)}`}>
                          {calculatedGrade}
                        </span>
                      </td>

                      {/* Comment / Remarks */}
                      <td className="py-2 px-3">
                        <input
                          type="text"
                          value={stuEntry.comment || ''}
                          disabled={isLocked || isSaving || isSubmitting}
                          onChange={(e) => handleCommentChange(stu.student, e.target.value)}
                          placeholder="Feedback or remarks..."
                          className="w-full px-2.5 py-1 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:opacity-60"
                        />
                      </td>

                      {/* Status */}
                      <td className="py-2.5 px-3 text-center">
                        {isLocked ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] sm:text-[10px] font-bold whitespace-nowrap bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                            <CheckCircle2 className="w-3 h-3" />
                            Submitted
                          </span>
                        ) : hasEnteredMarks ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] sm:text-[10px] font-bold whitespace-nowrap bg-amber-50 dark:bg-amber-950 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
                            Draft Pending
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] sm:text-[10px] font-bold whitespace-nowrap bg-slate-100 dark:bg-slate-800 text-slate-400">
                            Not Graded
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* 6. Sticky Bottom Action Footer */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
          <div className="text-xs text-slate-500 dark:text-slate-400">
            {dirty && (
              <span className="text-amber-600 dark:text-amber-400 font-bold flex items-center gap-1">
                ● Unsaved changes in marksheet
              </span>
            )}
            {!dirty && (
              <span>All student marks are up to date.</span>
            )}
          </div>

          <div className="flex items-center gap-2.5 flex-wrap w-full sm:w-auto">
            {/* Save Draft Button */}
            <button
              type="button"
              onClick={handleSaveDrafts}
              disabled={isSaving || isSubmitting || !activePlan}
              className="flex-1 sm:flex-none justify-center px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-100 text-xs font-bold transition flex items-center gap-2 border border-slate-200 dark:border-slate-600 disabled:opacity-50"
            >
              <Save className="w-4 h-4 text-slate-500" />
              <span>{isSaving ? 'Saving Drafts...' : 'Save Drafts'}</span>
            </button>

            {/* Submit & Publish Button */}
            <button
              type="button"
              onClick={handleSubmitResults}
              disabled={isSaving || isSubmitting || !activePlan}
              className="flex-1 sm:flex-none justify-center whitespace-nowrap px-6 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-black shadow-md shadow-brand-500/20 transition active:scale-95 flex items-center gap-2 disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Publishing Grades...</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>Submit & Publish Grades</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* 7. Modal: Create New Assessment Plan Quick Wizard */}
      {showCreatePlanModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-lg w-full max-h-[90vh] overflow-y-auto overscroll-contain p-5 sm:p-6 shadow-2xl border border-slate-100 dark:border-slate-800 space-y-5 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-8 h-8 shrink-0 rounded-xl bg-brand-50 dark:bg-brand-950 text-brand-600 dark:text-brand-400 flex items-center justify-center font-bold">
                  <Plus className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">Create Assessment Plan</h3>
                  <p className="text-[11px] text-slate-400">Configure a new exam or test for a student group</p>
                </div>
              </div>
              <button onClick={() => setShowCreatePlanModal(false)} className="shrink-0 p-2 -m-2 rounded-lg text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreatePlan} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Standard / Program</label>
                <select
                  required
                  value={newPlanForm.program}
                  onChange={(e) => setNewPlanForm(prev => ({ ...prev, program: e.target.value }))}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold"
                >
                  <option value="">Select Standard</option>
                  {(planMeta.programs || []).map(p => (
                    <option key={p.name} value={p.name}>{p.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Student Group / Batch</label>
                <select
                  required
                  value={newPlanForm.student_group}
                  onChange={(e) => setNewPlanForm(prev => ({ ...prev, student_group: e.target.value }))}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold"
                >
                  <option value="">Select Student Group</option>
                  {(planMeta.student_groups || [])
                    .filter(g => !newPlanForm.program || g.program === newPlanForm.program)
                    .map(g => (
                      <option key={g.name} value={g.name}>{g.name}</option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Course / Subject</label>
                <select
                  required
                  value={newPlanForm.course}
                  onChange={(e) => setNewPlanForm(prev => ({ ...prev, course: e.target.value }))}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold"
                >
                  <option value="">Select Course</option>
                  {(planMeta.courses || []).map(c => (
                    <option key={c.name} value={c.name}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Assessment Name / Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Mid-Term Examination"
                  value={newPlanForm.assessment_name}
                  onChange={(e) => setNewPlanForm(prev => ({ ...prev, assessment_name: e.target.value }))}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Assessment Group</label>
                <select
                  value={newPlanForm.assessment_group}
                  onChange={(e) => setNewPlanForm(prev => ({ ...prev, assessment_group: e.target.value }))}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold"
                >
                  {(planMeta.assessment_groups || []).map(g => (
                    <option key={g.name} value={g.name}>{g.assessment_group_name || g.name}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Date</label>
                  <input
                    type="date"
                    required
                    value={newPlanForm.schedule_date}
                    onChange={(e) => setNewPlanForm(prev => ({ ...prev, schedule_date: e.target.value }))}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-2 py-2 text-xs font-semibold"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">From</label>
                  <input
                    type="time"
                    required
                    value={newPlanForm.from_time}
                    onChange={(e) => setNewPlanForm(prev => ({ ...prev, from_time: e.target.value }))}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-2 py-2 text-xs font-semibold"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">To</label>
                  <input
                    type="time"
                    required
                    value={newPlanForm.to_time}
                    onChange={(e) => setNewPlanForm(prev => ({ ...prev, to_time: e.target.value }))}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-2 py-2 text-xs font-semibold"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Assessment Criteria &amp; Maximum Scores
                  <span className="ml-1 font-normal text-slate-400">
                    (Total: {(newPlanForm.criteria_rows || []).reduce((sum, r) => sum + (Number(r.maximum_score) || 0), 0)})
                  </span>
                </label>
                {(planMeta.criteria || []).length === 0 && (
                  <div className="text-rose-600">No Assessment Criteria configured</div>
                )}
                <div className="space-y-2">
                  {(newPlanForm.criteria_rows || []).map((row, i) => (
                    <div key={i} className="flex items-center gap-2" data-criteria-row={i}>
                      <select
                        value={row.assessment_criteria}
                        onChange={(e) => setNewPlanForm(prev => ({
                          ...prev,
                          criteria_rows: prev.criteria_rows.map((r, j) => (j === i ? { ...r, assessment_criteria: e.target.value } : r)),
                        }))}
                        className="flex-1 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold"
                      >
                        {(planMeta.criteria || []).map(c => (
                          <option key={c.name} value={c.name}>{c.assessment_criteria || c.name}</option>
                        ))}
                      </select>
                      <input
                        type="number"
                        min="1"
                        step="0.5"
                        aria-label="Maximum score"
                        value={row.maximum_score}
                        onChange={(e) => setNewPlanForm(prev => ({
                          ...prev,
                          criteria_rows: prev.criteria_rows.map((r, j) => (j === i ? { ...r, maximum_score: e.target.value } : r)),
                        }))}
                        className="w-20 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-2 py-2 text-xs font-semibold text-center"
                      />
                      <button
                        type="button"
                        aria-label="Remove criterion"
                        disabled={(newPlanForm.criteria_rows || []).length <= 1}
                        onClick={() => setNewPlanForm(prev => ({ ...prev, criteria_rows: prev.criteria_rows.filter((_, j) => j !== i) }))}
                        className="shrink-0 p-2 rounded-lg text-slate-400 hover:text-rose-600 disabled:opacity-30"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
                {(planMeta.criteria || []).length > (newPlanForm.criteria_rows || []).length && (
                  <button
                    type="button"
                    onClick={() => setNewPlanForm(prev => {
                      const used = new Set(prev.criteria_rows.map(r => r.assessment_criteria));
                      const next = (planMeta.criteria || []).find(c => !used.has(c.name));
                      return next
                        ? { ...prev, criteria_rows: [...prev.criteria_rows, { assessment_criteria: next.name, maximum_score: '10' }] }
                        : prev;
                    })}
                    className="mt-2 text-brand-600 dark:text-brand-400 font-bold"
                  >
                    + Add Criterion
                  </button>
                )}
              </div>

              <div className="flex flex-col-reverse sm:flex-row sm:items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowCreatePlanModal(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 dark:text-slate-400 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreatingPlan}
                  className="px-5 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold transition disabled:opacity-50"
                >
                  {isCreatingPlan ? 'Creating Plan...' : 'Create Assessment Plan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
