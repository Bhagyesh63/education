import { todayISO } from '../utils/date';
import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  GraduationCap, 
  Award, 
  CheckCircle2, 
  BarChart3, 
  FileText,
  Percent,
  TrendingUp,
  Sparkles,
  Filter,
  ChevronDown,
  Search,
  Users,
  BookOpen,
  Layers,
  Printer,
  X,
  Plus,
  Edit3,
  Check,
  AlertCircle,
  Calculator,
  Eye,
  MessageSquareQuote,
  MessageSquare
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/frappeClient';
import { calculateGradeFromScale, getGradeBadgeTheme, isPassingGrade, getGradeDescription, getPassPercentage, isPassingPercentage } from '../utils/grades';

export default function GradesView() {
  const { 
    studentProfile, 
    activeStudentId, 
    activeProgram, 
    activeAcademicYear,
    programs, 
    students,
    selectStudent,
    isGuardian, 
    isStaff, 
    isInstructor, 
    isAdmin,
    schoolSettings
  } = useAuth();
  const navigate = useNavigate();

  const [allResults, setAllResults] = useState([]);
  const [dbPrograms, setDbPrograms] = useState([]);
  const [selectedProgramFilter, setSelectedProgramFilter] = useState('all');
  const [selectedCourseFilter, setSelectedCourseFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [showReportCard, setShowReportCard] = useState(false);
  const [selectedReportStudent, setSelectedReportStudent] = useState(null);
  const [selectedDetailResult, setSelectedDetailResult] = useState(null);

  // Backend Grading Scale intervals state
  const [gradingScaleData, setGradingScaleData] = useState(null);
  const [gradingScaleLoading, setGradingScaleLoading] = useState(false);
  const [planGradingScaleData, setPlanGradingScaleData] = useState(null);

  // Grade Assessment Modal State (Teacher / Faculty / Admin)
  const [showGradeModal, setShowGradeModal] = useState(false);
  const [assessmentPlans, setAssessmentPlans] = useState([]);
  const [selectedPlanId, setSelectedPlanId] = useState('');
  const [planCriteria, setPlanCriteria] = useState([]);
  const [planStudents, setPlanStudents] = useState([]);
  const [scoresState, setScoresState] = useState({}); // { [studentId]: { [criteria]: score, comment: '' } }
  const [plansLoading, setPlansLoading] = useState(false);
  const [evalLoading, setEvalLoading] = useState(false);
  const [evalSaving, setEvalSaving] = useState(false);
  const [evalSuccessMsg, setEvalSuccessMsg] = useState('');
  const [evalSearch, setEvalSearch] = useState('');

  // Assessment Plan Creator & Gradebook Standard Filter State
  const [gradebookProgramFilter, setGradebookProgramFilter] = useState('all');
  const [isCreatePlanModalOpen, setIsCreatePlanModalOpen] = useState(false);
  const [planMeta, setPlanMeta] = useState({
    programs: [],
    student_groups: [],
    courses: [],
    assessment_groups: [],
    grading_scales: [],
    criteria: [],
  });
  const [creatingPlan, setCreatingPlan] = useState(false);
  const [createPlanError, setCreatePlanError] = useState('');
  const [createPlanForm, setCreatePlanForm] = useState({
    program: '',
    student_group: '',
    course: '',
    assessment_name: '',
    assessment_group: '',
    grading_scale: '',
    schedule_date: todayISO(),
    criteria_preset: '',
  });

  // Official report card meta (school header, attendance, class teacher) for the report card modal
  const [reportCardMeta, setReportCardMeta] = useState(null);
  const [reportCardMetaLoading, setReportCardMetaLoading] = useState(false);
  const [resultsError, setResultsError] = useState('');

  // Fetch all registered academic programs so future classes are automatically present
  useEffect(() => {
    api.getAllPrograms()
      .then((progs) => {
        if (Array.isArray(progs) && progs.length > 0) {
          setDbPrograms(progs);
        }
      })
      .catch(() => {});
  }, []);

  const fetchResults = () => {
    setLoading(true);
    // For staff: fetch all results across students.
    // For student/guardian: fetch specifically for active ward / student
    const studentId = isStaff ? null : (activeStudentId || studentProfile?.name || null);
    if (!isStaff && !studentId) {
      setAllResults([]);
      setLoading(false);
      return;
    }
    setResultsError('');

    api.getAssessmentResults(studentId, null, null)
      .then((data) => {
        setAllResults(Array.isArray(data) ? data : []);
      })
      .catch((err) => {
        console.error('Error fetching assessment results:', err);
        setAllResults([]);
        setResultsError(err.message || 'Unable to load assessment results.');
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchResults();
  }, [studentProfile?.name, activeStudentId, isStaff]);

  // Fetch active grading scale intervals from backend
  useEffect(() => {
    let isMounted = true;
    setGradingScaleLoading(true);
    api.getGradingScaleIntervals({
      program: selectedProgramFilter !== 'all' ? selectedProgramFilter : (activeProgram || null),
      course: selectedCourseFilter !== 'all' ? selectedCourseFilter : null,
    })
      .then((data) => {
        if (isMounted) setGradingScaleData(data || null);
      })
      .catch((err) => {
        console.error('Error fetching grading scale intervals:', err);
        if (isMounted) setGradingScaleData(null);
      })
      .finally(() => {
        if (isMounted) setGradingScaleLoading(false);
      });

    return () => { isMounted = false; };
  }, [selectedProgramFilter, selectedCourseFilter, activeProgram]);

  // When selected assessment plan changes in teacher gradebook modal, fetch its specific grading scale
  useEffect(() => {
    if (!selectedPlanId || !showGradeModal) {
      setPlanGradingScaleData(null);
      return;
    }
    api.getGradingScaleIntervals({ assessment_plan: selectedPlanId })
      .then((data) => setPlanGradingScaleData(data || null))
      .catch((err) => {
        console.error('Error fetching plan grading scale intervals:', err);
        setPlanGradingScaleData(null);
      });
  }, [selectedPlanId, showGradeModal]);

  // Load Assessment Plans for Teacher Gradebook
  const loadAssessmentPlans = () => {
    if (!isStaff) return Promise.resolve([]);
    setPlansLoading(true);
    return api.getAssessmentPlans()
      .then((data) => {
        setAssessmentPlans(data || []);
        if (data && data.length > 0 && !selectedPlanId) {
          setSelectedPlanId(data[0].name);
        }
        return data || [];
      })
      .catch((err) => {
        console.error('Error loading assessment plans:', err);
        return [];
      })
      .finally(() => setPlansLoading(false));
  };

  const openCreatePlanModal = async (initialProgram = null) => {
    setIsCreatePlanModalOpen(true);
    setCreatePlanError('');
    try {
      const metaData = await api.getAssessmentSetupMetadata();
      if (metaData) {
        setPlanMeta(metaData);
        const targetProg = initialProgram
          || (gradebookProgramFilter !== 'all' ? gradebookProgramFilter : null)
          || (selectedProgramFilter !== 'all' ? selectedProgramFilter : null)
          || activeProgram
          || metaData.programs?.[0]?.name
          || '';
        const matchingGroups = (metaData.student_groups || []).filter(g => !targetProg || g.program === targetProg);
        const targetGroup = matchingGroups[0]?.name || '';
        const targetCourse = metaData.courses?.[0]?.name || '';
        const courseScale = (metaData.courses || []).find(c => c.name === targetCourse)?.default_grading_scale;

        setCreatePlanForm({
          program: targetProg,
          student_group: targetGroup,
          course: targetCourse,
          assessment_name: '',
          assessment_group: (metaData.assessment_groups || []).find(ag => targetProg && ag.name.includes(targetProg))?.name || (metaData.assessment_groups?.[0]?.name || ''),
          grading_scale: courseScale || metaData.grading_scales?.[0]?.name || '',
          schedule_date: todayISO(),
          criteria_preset: metaData.criteria?.[0]?.name || '',
        });
      }
    } catch (err) {
      console.error('Failed to load assessment setup metadata:', err);
    }
  };

  const handleCreateAssessmentPlan = async (e) => {
    e.preventDefault();
    if (!createPlanForm.student_group) {
      setCreatePlanError('Please select a student group / section.');
      return;
    }
    if (!createPlanForm.course) {
      setCreatePlanError('Please select a course / subject.');
      return;
    }
    if (!createPlanForm.criteria_preset) {
      setCreatePlanError('Please select an assessment criteria (configure Assessment Criteria in Frappe first).');
      return;
    }

    setCreatingPlan(true);
    setCreatePlanError('');

    try {
      const criteriaList = [
        { assessment_criteria: createPlanForm.criteria_preset, maximum_score: 100.0 },
      ];

      const res = await api.createAssessmentPlan({
        student_group: createPlanForm.student_group,
        course: createPlanForm.course,
        program: createPlanForm.program,
        assessment_group: createPlanForm.assessment_group || undefined,
        grading_scale: createPlanForm.grading_scale || undefined,
        assessment_name: createPlanForm.assessment_name || undefined,
        schedule_date: createPlanForm.schedule_date,
        criteria: JSON.stringify(criteriaList),
      });

      const updatedPlans = await loadAssessmentPlans();

      if (res && res.name) {
        setSelectedPlanId(res.name);
        if (createPlanForm.program) {
          setGradebookProgramFilter(createPlanForm.program);
        }
      } else if (updatedPlans.length > 0) {
        setSelectedPlanId(updatedPlans[0].name);
      }

      setIsCreatePlanModalOpen(false);
      setShowGradeModal(true);
    } catch (err) {
      console.error('Error creating assessment plan:', err);
      setCreatePlanError(err.message || 'Failed to create assessment plan');
    } finally {
      setCreatingPlan(false);
    }
  };

  // Unique programs among assessment plans
  const uniquePlanPrograms = useMemo(() => {
    const progs = new Set([
      ...(planMeta.programs || []).map(p => p.name).filter(Boolean),
      ...(programs || []).map(p => (typeof p === 'object' ? p.program : p)).filter(Boolean),
      ...assessmentPlans.map(p => p.program).filter(Boolean),
      ...(dbPrograms || []).map(p => p.name).filter(Boolean),
    ]);
    return Array.from(progs).sort();
  }, [programs, assessmentPlans, dbPrograms, planMeta.programs]);

  // Filtered assessment plans for the Gradebook modal dropdown
  const filteredAssessmentPlans = useMemo(() => {
    if (gradebookProgramFilter === 'all') return assessmentPlans;
    return assessmentPlans.filter(p => p.program === gradebookProgramFilter);
  }, [assessmentPlans, gradebookProgramFilter]);

  useEffect(() => {
    if (isStaff) {
      loadAssessmentPlans();
    }
  }, [isStaff]);

  // When selected assessment plan changes, load students and criteria
  useEffect(() => {
    if (!selectedPlanId || !showGradeModal) return;

    const currentPlan = assessmentPlans.find(p => p.name === selectedPlanId);
    if (!currentPlan) return;

    setEvalLoading(true);
    setEvalSuccessMsg('');

    Promise.all([
      api.getAssessmentDetails(selectedPlanId),
      api.getAssessmentStudents(selectedPlanId, currentPlan.student_group)
    ])
      .then(([criteria, studentsList]) => {
        setPlanCriteria(criteria || []);
        setPlanStudents(studentsList || []);

        // Initialize scores state from existing results
        const initialScores = {};
        (studentsList || []).forEach(stu => {
          const stuDetails = stu.assessment_details || {};
          const criteriaScores = {};
          (criteria || []).forEach(c => {
            const val = stuDetails[c.assessment_criteria]?.[0] || '';
            criteriaScores[c.assessment_criteria] = val !== '' ? String(val) : '';
          });
          initialScores[stu.student] = {
            criteria: criteriaScores,
            comment: stuDetails.comment || '',
            name: stu.name || null,
            docstatus: stu.docstatus || 0,
          };
        });
        setScoresState(initialScores);
      })
      .catch(err => {
        console.error('Error loading assessment plan evaluation details:', err);
      })
      .finally(() => setEvalLoading(false));
  }, [selectedPlanId, showGradeModal]);

  const activePlanDoc = useMemo(() => {
    return assessmentPlans.find(p => p.name === selectedPlanId) || null;
  }, [assessmentPlans, selectedPlanId]);

  const totalMaxScore = useMemo(() => {
    return planCriteria.reduce((sum, c) => sum + Number(c.maximum_score || 0), 0);
  }, [planCriteria]);

  const handleScoreChange = (studentId, criteriaName, val, maxScore) => {
    let numVal = val;
    if (val !== '') {
      const parsed = parseFloat(val);
      if (!isNaN(parsed)) {
        if (parsed > maxScore) numVal = String(maxScore);
        else if (parsed < 0) numVal = '0';
      }
    }

    setScoresState(prev => {
      const studentObj = prev[studentId] || { criteria: {}, comment: '' };
      return {
        ...prev,
        [studentId]: {
          ...studentObj,
          criteria: {
            ...studentObj.criteria,
            [criteriaName]: numVal,
          }
        }
      };
    });
  };

  const handleCommentChange = (studentId, comment) => {
    setScoresState(prev => {
      const studentObj = prev[studentId] || { criteria: {}, comment: '' };
      return {
        ...prev,
        [studentId]: {
          ...studentObj,
          comment,
        }
      };
    });
  };

  // Derive letter grade from backend Grading Scale intervals
  const getOverallGrade = (pct, intervals = gradingScaleData?.intervals) => {
    return calculateGradeFromScale(pct, intervals);
  };

  const getGradeTheme = (grade) => {
    return getGradeBadgeTheme(grade);
  };



  // Save marks for all students in the assessment plan
  const handleSaveMarks = async (submitAfterSave = false) => {
    if (!selectedPlanId || !activePlanDoc) return;

    setEvalSaving(true);
    setEvalSuccessMsg('');

    try {
      // Save each student's score
      for (const stu of planStudents) {
        const stuEntry = scoresState[stu.student];
        if (!stuEntry) continue;

        let total = 0;
        const detailsPayload = {};
        Object.entries(stuEntry.criteria || {}).forEach(([crit, val]) => {
          const num = parseFloat(val) || 0;
          total += num;
          detailsPayload[crit] = num;
        });

        const payload = {
          student: stu.student,
          assessment_details: detailsPayload,
          total_score: total,
          comment: stuEntry.comment || '',
        };

        await api.markAssessmentResult(selectedPlanId, JSON.stringify(payload));
      }

      if (submitAfterSave) {
        await api.submitAssessmentResults(selectedPlanId, activePlanDoc.student_group);
        setEvalSuccessMsg(`Assessment results submitted & published successfully for ${activePlanDoc.course}!`);
      } else {
        setEvalSuccessMsg(`Student marks saved as draft for ${activePlanDoc.course}!`);
      }

      fetchResults();
      loadAssessmentPlans();

      setTimeout(() => {
        setEvalSuccessMsg('');
        if (submitAfterSave) {
          setShowGradeModal(false);
        }
      }, 1500);
    } catch (err) {
      console.error('Error saving assessment marks:', err);
      alert(err.message || 'Failed to save student assessment marks');
    } finally {
      setEvalSaving(false);
    }
  };

  // Determine available programs dynamically
  const availablePrograms = Array.from(
    new Set([
      ...(dbPrograms || []).map(p => typeof p === 'string' ? p : (p.program_name || p.name || p.program)),
      ...(programs || []).map(p => typeof p === 'string' ? p : (p.program || p.name)),
      ...allResults.map(r => typeof r === 'string' ? r : (r.program || r.name)).filter(Boolean)
    ])
  ).filter(p => typeof p === 'string' && p.trim().length > 0).sort();

  // Determine available courses dynamically
  const availableCourses = Array.from(
    new Set(allResults.map(r => r.course).filter(Boolean))
  ).sort();

  // Filter results by Program, Course, and Search Query
  const displayedResults = allResults.filter((r) => {
    if (selectedProgramFilter !== 'all' && r.program !== selectedProgramFilter) {
      return false;
    }
    if (selectedCourseFilter !== 'all' && r.course !== selectedCourseFilter) {
      return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const matchName = (r.student_name || '').toLowerCase().includes(q);
      const matchId = (r.student || '').toLowerCase().includes(q);
      const matchCourse = (r.course || '').toLowerCase().includes(q);
      const matchGroup = (r.student_group || '').toLowerCase().includes(q);
      if (!matchName && !matchId && !matchCourse && !matchGroup) {
        return false;
      }
    }
    return true;
  });

  // Calculate statistics
  let totalScore = 0;
  let maxScore = 0;
  const subjectScores = {};
  const uniqueStudentsSet = new Set();
  let passedCount = 0;
  let distinctionCount = 0;

  const intervals = gradingScaleData?.intervals || [];
  const passPercentage = getPassPercentage(intervals, gradingScaleData?.pass_percentage);
  const topGrade = intervals[0]?.grade || null;
  const secondTopGrade = intervals[1]?.grade || null;
  // Prefer the grade Frappe stored on the Assessment Result; derive from the scale only if missing
  const gradeForResult = (r, pct) => r?.grade || calculateGradeFromScale(pct, intervals);

  displayedResults.forEach((r) => {
    const score = Number(r.total_score || 0);
    const max = Number(r.maximum_score || 0);
    totalScore += score;
    maxScore += max;

    if (r.student) uniqueStudentsSet.add(r.student);

    const pct = max > 0 ? (score / max) * 100 : 0;
    const grade = gradeForResult(r, pct);
    const passedByPct = isPassingPercentage(pct, intervals, passPercentage);
    if (passedByPct === null ? isPassingGrade(grade, intervals) : passedByPct) passedCount += 1;
    if (grade && (grade === topGrade || grade === secondTopGrade)) distinctionCount += 1;

    if (r.course) {
      if (!subjectScores[r.course]) {
        subjectScores[r.course] = { total: 0, max: 0, count: 0 };
      }
      subjectScores[r.course].total += score;
      subjectScores[r.course].max += max;
      subjectScores[r.course].count += 1;
    }
  });

  const overallPercentage = maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : null;
  const overallGrade = overallPercentage === null ? '—' : calculateGradeFromScale(overallPercentage, intervals);
  const overallGradeDescription = getGradeDescription(overallGrade, intervals);
  const overallPassed = overallPercentage === null ? null : isPassingPercentage(overallPercentage, intervals, passPercentage);

  let topCourse = null;
  let topCourseAvg = -1;
  Object.entries(subjectScores).forEach(([course, stat]) => {
    const avg = stat.max > 0 ? Math.round((stat.total / stat.max) * 100) : 0;
    if (avg > topCourseAvg) {
      topCourseAvg = avg;
      topCourse = course;
    }
  });

  const passRate = displayedResults.length > 0 ? Math.round((passedCount / displayedResults.length) * 100) : null;

  // Extract unique students for Teacher/Staff and Guardian student switcher
  const uniqueStudents = useMemo(() => {
    const map = new Map();
    (allResults || []).forEach(r => {
      if (r.student && !map.has(r.student)) {
        map.set(r.student, {
          id: r.student,
          name: r.student_name || r.student,
          program: r.program || '',
        });
      }
    });

    if (Array.isArray(students) && students.length > 0) {
      students.forEach(w => {
        if (w.student && !map.has(w.student)) {
          map.set(w.student, {
            id: w.student,
            name: w.student_name || w.student,
            program: w.program || '',
          });
        }
      });
    }

    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [allResults, students, activeProgram]);

  // Target Student ID for Report Card
  const activeReportTargetId = useMemo(() => {
    if (selectedReportStudent) return selectedReportStudent;
    if (isStaff) {
      return displayedResults[0]?.student || allResults[0]?.student || null;
    }
    return activeStudentId || studentProfile?.name || null;
  }, [selectedReportStudent, isStaff, displayedResults, allResults, activeStudentId, studentProfile?.name]);

  const studentReportResults = useMemo(() => {
    return (allResults || []).filter(r => r.student === activeReportTargetId);
  }, [allResults, activeReportTargetId]);

  const reportCardStats = useMemo(() => {
    let tot = 0;
    let mx = 0;
    studentReportResults.forEach(r => {
      tot += Number(r.total_score || 0);
      mx += Number(r.maximum_score || 0);
    });
    const pct = mx > 0 ? Math.round((tot / mx) * 100) : null;
    
    const info = uniqueStudents.find(s => s.id === activeReportTargetId) || {
      id: activeReportTargetId,
      name: studentReportResults[0]?.student_name || reportCardMeta?.student?.student_name || studentProfile?.student_name || '',
      program: studentReportResults[0]?.program || '',
    };

    return {
      total: tot,
      max: mx,
      percentage: pct,
      studentName: info.name,
      studentId: info.id,
      program: studentReportResults[0]?.program || info.program || reportCardMeta?.student?.program || activeProgram || '',
    };
  }, [studentReportResults, uniqueStudents, activeReportTargetId, studentProfile?.student_name, activeProgram, reportCardMeta]);

  // Load the official report card meta (school, attendance, class teacher) for the open report card
  useEffect(() => {
    if (!showReportCard || !activeReportTargetId) {
      setReportCardMeta(null);
      return;
    }
    let cancelled = false;
    setReportCardMetaLoading(true);
    api.getStudentReportCardData({ student: activeReportTargetId })
      .then((data) => { if (!cancelled) setReportCardMeta(data || null); })
      .catch((err) => {
        console.error('Error loading report card details:', err);
        if (!cancelled) setReportCardMeta(null);
      })
      .finally(() => { if (!cancelled) setReportCardMetaLoading(false); });
    return () => { cancelled = true; };
  }, [showReportCard, activeReportTargetId]);

  // Filter evaluation students in modal
  const filteredPlanStudents = useMemo(() => {
    if (!evalSearch.trim()) return planStudents;
    const q = evalSearch.toLowerCase().trim();
    return planStudents.filter(s =>
      (s.student_name || '').toLowerCase().includes(q) ||
      (s.student || '').toLowerCase().includes(q)
    );
  }, [planStudents, evalSearch]);

  return (
    <div className="space-y-6">
      {/* Guardian Ward Switcher Pill */}
      {isGuardian && students && students.length > 1 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 shrink-0">Viewing Ward:</span>
          {students.map((w) => {
            const isSelected = (activeStudentId || studentProfile?.name) === w.student;
            return (
              <button
                key={w.student}
                onClick={() => selectStudent(w.student)}
                className={`min-h-[36px] sm:min-h-0 px-3.5 py-1.5 rounded-full text-xs font-semibold transition flex items-center gap-1.5 shrink-0 ${
                  isSelected
                    ? 'bg-brand-600 text-white shadow-xs'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                <span className="truncate max-w-[160px] sm:max-w-none" title={w.student_name}>{w.student_name}</span>
                <span className="text-[11px] sm:text-[10px] opacity-75">({w.relation || 'Ward'})</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Top Banner */}
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
        <div className="min-w-0 flex-1 basis-[260px]">
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
            <h2 className="text-lg sm:text-xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight">
              {isStaff ? 'Class Assessment & Student Grades' : 'Academic Performance'}
            </h2>
            <span className="px-2.5 py-0.5 rounded-full text-[11px] sm:text-[10px] font-bold whitespace-nowrap bg-brand-50 dark:bg-brand-950/80 text-brand-600 dark:text-brand-400 border border-brand-200/60 dark:border-brand-800">
              {displayedResults.length} Results Recorded
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {isStaff 
              ? 'Institutional examination records, criteria mark evaluation, and printable report cards' 
              : 'Published examination scores and formal subject evaluations'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Teacher Gradebook & Exam Setup Actions */}
          {isStaff && (
            <>
              <button
                onClick={() => openCreatePlanModal()}
                className="flex flex-1 sm:flex-none justify-center items-center gap-1.5 min-h-[36px] sm:min-h-0 px-3.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-bold shadow-xs transition active:scale-95 shrink-0 whitespace-nowrap border border-slate-200/80 dark:border-slate-700"
                title="Create a new assessment plan for any standard"
              >
                <Plus className="w-3.5 h-3.5 text-brand-600 dark:text-brand-400" />
                <span>+ Assessment Plan</span>
              </button>

              <button
                onClick={() => navigate('/assessment-tool')}
                className="flex flex-1 sm:flex-none justify-center items-center gap-1.5 min-h-[36px] sm:min-h-0 px-3.5 py-1.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold shadow-xs transition active:scale-95 shrink-0 whitespace-nowrap"
              >
                <Calculator className="w-3.5 h-3.5" />
                <span>Assessment Result Tool</span>
              </button>
            </>
          )}

          <button
            onClick={() => navigate('/report-card-tool')}
            className="flex flex-1 sm:flex-none justify-center items-center gap-1.5 min-h-[36px] sm:min-h-0 px-3.5 py-1.5 rounded-xl whitespace-nowrap bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-white text-white dark:text-slate-900 text-xs font-bold shadow-xs transition active:scale-95 shrink-0"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Report Card Tool</span>
          </button>
        </div>
      </div>

      {/* Filter Toolbar Card */}
      <div className="glass-panel p-3.5 sm:p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 flex flex-col lg:flex-row lg:items-center justify-between gap-3 shadow-xs">
        {/* Left: Program & Course Dropdowns + Reset */}
        <div className="flex flex-wrap items-center gap-2.5 min-w-0">
          {/* Program / Standard Dropdown */}
          <div className="relative w-full sm:w-auto">
            <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 dark:text-slate-500">
              <Layers className="w-4 h-4" />
            </div>
            <select
              id="program-filter-dropdown"
              value={selectedProgramFilter}
              onChange={(e) => setSelectedProgramFilter(e.target.value)}
              className="appearance-none bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-700/80 rounded-xl pl-9 pr-8 py-2 text-xs font-semibold text-slate-800 dark:text-slate-100 hover:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30 shadow-xs cursor-pointer transition w-full sm:w-auto sm:min-w-[170px] min-h-[36px] sm:min-h-0 truncate"
            >
              <option value="all">All Standards & Programs</option>
              {availablePrograms.map((prog) => (
                <option key={prog} value={prog}>
                  {prog}
                </option>
              ))}
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          {/* Course / Subject Dropdown */}
          <div className="relative w-full sm:w-auto">
            <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 dark:text-slate-500">
              <BookOpen className="w-4 h-4" />
            </div>
            <select
              id="course-filter-dropdown"
              value={selectedCourseFilter}
              onChange={(e) => setSelectedCourseFilter(e.target.value)}
              className="appearance-none bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-700/80 rounded-xl pl-9 pr-8 py-2 text-xs font-semibold text-slate-800 dark:text-slate-100 hover:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30 shadow-xs cursor-pointer transition w-full sm:w-auto sm:min-w-[140px] min-h-[36px] sm:min-h-0 truncate"
            >
              <option value="all">All Subjects</option>
              {availableCourses.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          {/* Reset Filters Button */}
          {(selectedProgramFilter !== 'all' || selectedCourseFilter !== 'all' || searchQuery) && (
            <button
              onClick={() => {
                setSelectedProgramFilter('all');
                setSelectedCourseFilter('all');
                setSearchQuery('');
              }}
              className="px-2.5 py-1.5 rounded-xl text-xs font-semibold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 border border-rose-200/60 dark:border-rose-900/50 hover:bg-rose-100 dark:hover:bg-rose-900/60 transition shrink-0"
            >
              Reset Filters
            </button>
          )}
        </div>

        {/* Right: Student Search for Staff */}
        {isStaff && (
          <div className="relative w-full lg:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search student or roll ID..."
              className="w-full bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-700/80 rounded-xl pl-9 pr-7 py-2 text-xs font-medium text-slate-800 dark:text-slate-100 placeholder-slate-400 hover:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30 shadow-xs transition"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xs font-bold"
                title="Clear search"
              >
                ✕
              </button>
            )}
          </div>
        )}
      </div>

      {/* Active Grading Scale Indicator Banner */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-1">
        <div className="flex flex-wrap items-center gap-2 text-xs min-w-0">
          <span className="font-semibold text-slate-500 dark:text-slate-400">Grading Scale:</span>
          {gradingScaleLoading ? (
            <span className="text-slate-400 text-xs animate-pulse">Loading scale...</span>
          ) : gradingScaleData?.grading_scale ? (
            <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 font-bold border border-emerald-200/60 dark:border-emerald-800 text-[11px] break-words max-w-full">
              {gradingScaleData.grading_scale}
            </span>
          ) : (
            <span className="text-amber-600 dark:text-amber-400 font-semibold text-[11px]">
              Grade unavailable
            </span>
          )}
        </div>
        {intervals.length > 0 && (
          <div className="hidden md:flex flex-wrap items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
            <span className="font-medium">Scale Boundaries:</span>
            {intervals.map((inv) => (
              <span key={inv.grade} className="font-mono bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-[10px]">
                <strong>{inv.grade}</strong>: ≥{inv.min_percentage}%
              </span>
            ))}
          </div>
        )}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        {/* Card 1: Average */}
        <div className="glass-panel p-3 sm:p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 min-w-0">
          <span className="block text-[11px] sm:text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase break-words">
            {isStaff ? 'Class Average' : 'Cumulative Avg'}
          </span>
          <div className="mt-2 text-xl sm:text-2xl font-black text-brand-600 dark:text-brand-400">
            {overallPercentage === null ? '—' : `${overallPercentage}%`}
          </div>
          <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">
            Overall Grade: <span className="font-bold text-emerald-600 dark:text-emerald-400">{overallGrade}</span>
          </p>
        </div>

        {/* Card 2: Count */}
        <div className="glass-panel p-3 sm:p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 min-w-0">
          <span className="block text-[11px] sm:text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase break-words">
            {isStaff ? 'Assessments Recorded' : 'Exams Recorded'}
          </span>
          <div className="mt-2 text-xl sm:text-2xl font-black text-slate-900 dark:text-slate-100">
            {displayedResults.length}
          </div>
          <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">
            {isStaff 
              ? `Across ${uniqueStudentsSet.size} student${uniqueStudentsSet.size !== 1 ? 's' : ''}` 
              : 'Subjects assessed'}
          </p>
        </div>

        {/* Card 3: Top Subject */}
        <div className="glass-panel p-3 sm:p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 min-w-0">
          <span className="block text-[11px] sm:text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase break-words">Top Subject</span>
          <div className="mt-2 text-base font-black text-emerald-600 dark:text-emerald-400 truncate" title={topCourse || undefined}>
            {topCourse || 'None'}
          </div>
          <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">
            {topCourseAvg >= 0 ? `Avg: ${topCourseAvg}% score` : 'No data recorded'}
          </p>
        </div>

        {/* Card 4: Standing / Pass Rate */}
        <div className="glass-panel p-3 sm:p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 min-w-0">
          <span className="block text-[11px] sm:text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase break-words">
            {isStaff ? 'Class Pass Rate' : 'Standing'}
          </span>
          <div className="mt-2 text-base font-black text-indigo-600 dark:text-indigo-400 break-words sm:truncate">
            {isStaff
              ? (passRate === null ? '—' : `${passRate}% Passed`)
              : (overallPercentage === null
                  ? 'No results yet'
                  : (overallGradeDescription || `Grade ${overallGrade}`))}
          </div>
          <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">
            {isStaff
              ? (topGrade
                  ? `${distinctionCount} scored Grade ${secondTopGrade || topGrade} or above`
                  : 'Grading scale unavailable')
              : (overallPassed === null
                  ? (gradingScaleData?.grading_scale ? 'Awaiting published results' : 'Grading scale unavailable')
                  : `${overallPassed ? 'Above' : 'Below'} pass mark (${passPercentage}%)`)}
          </p>
        </div>
      </div>

      {/* Teacher Guidance & Feedback Highlight Banner (For Student & Guardian) */}
      {!isStaff && displayedResults.some(r => r.comment && r.comment.trim() !== '') && (
        <div className="p-4 sm:p-5 rounded-3xl bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border border-amber-500/30 dark:border-amber-500/20 backdrop-blur-xs flex flex-col sm:flex-row sm:items-start justify-between gap-4 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-start gap-3.5 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-sm mt-0.5">
              <MessageSquareQuote className="w-5 h-5" />
            </div>
            <div className="space-y-1 min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-black uppercase tracking-wider text-amber-800 dark:text-amber-300">
                  Teacher's Guidance &amp; Subject Remarks
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold break-words max-w-full bg-amber-200/80 dark:bg-amber-900/80 text-amber-900 dark:text-amber-200 border border-amber-300/50 dark:border-amber-700">
                  {displayedResults.find(r => r.comment && r.comment.trim() !== '')?.course}
                </span>
                <span className="text-[11px] sm:text-[10px] text-slate-400 font-mono break-all">
                  {displayedResults.find(r => r.comment && r.comment.trim() !== '')?.assessment_group}
                </span>
              </div>
              <p className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-slate-100 italic leading-snug break-words">
                "{displayedResults.find(r => r.comment && r.comment.trim() !== '')?.comment}"
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Official feedback from your course instructor for this examination period.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setSelectedDetailResult(displayedResults.find(r => r.comment && r.comment.trim() !== ''))}
            className="w-full sm:w-auto justify-center self-start sm:self-center px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-xs shrink-0"
          >
            <Eye className="w-3.5 h-3.5" />
            <span>View Breakdown</span>
          </button>
        </div>
      )}

      {/* Graded Assessments Table */}
      <div className="glass-panel rounded-3xl border border-slate-200/80 dark:border-slate-800 overflow-hidden shadow-xs">
        <div className="px-4 sm:px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <GraduationCap className="w-4 h-4 shrink-0 text-brand-600 dark:text-brand-400" />
            <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">
              {isStaff ? 'All Student Assessment Records' : 'Graded Assessments'}
            </h3>
          </div>
          <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
            {displayedResults.length} record{displayedResults.length !== 1 ? 's' : ''} shown
          </span>
        </div>

        {loading ? (
          <div className="p-8 sm:p-12 text-center text-slate-400 text-sm">
            <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            Loading assessment scores and student grades...
          </div>
        ) : resultsError ? (
          <div className="p-8 sm:p-12 text-center text-xs text-rose-600 dark:text-rose-400 space-y-2">
            <AlertCircle className="w-6 h-6 mx-auto" />
            <p className="font-semibold break-words">{resultsError}</p>
            <button
              onClick={fetchResults}
              className="px-4 py-2 sm:px-3 sm:py-1 rounded-lg bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 font-semibold"
            >
              Retry
            </button>
          </div>
        ) : displayedResults.length === 0 ? (
          <div className="p-8 sm:p-12 text-center">
            <GraduationCap className="w-10 h-10 text-slate-300 dark:text-slate-700 mx-auto mb-2" />
            <p className="text-xs font-semibold text-slate-600 dark:text-slate-400">
              No published assessment results match the current filters.
            </p>
            {(selectedProgramFilter !== 'all' || selectedCourseFilter !== 'all' || searchQuery) && (
              <button
                onClick={() => {
                  setSelectedProgramFilter('all');
                  setSelectedCourseFilter('all');
                  setSearchQuery('');
                }}
                className="mt-3 px-3.5 py-1.5 rounded-xl bg-brand-50 dark:bg-brand-950/60 border border-brand-200/60 dark:border-brand-800 text-brand-600 dark:text-brand-400 text-xs font-semibold hover:bg-brand-100 transition"
              >
                Clear all filters
              </button>
            )}
          </div>
        ) : (
          <>
          {/* Mobile stacked card list (< md) */}
          <div className="md:hidden divide-y divide-slate-100 dark:divide-slate-800">
            {displayedResults.map((row, idx) => {
              const pct = row.maximum_score > 0 ? Math.round((row.total_score / row.maximum_score) * 100) : 0;
              const calculatedGrade = gradeForResult(row, pct);
              return (
                <div key={row.name || idx} className="p-4 space-y-3 text-xs">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 space-y-0.5">
                      {isStaff && (
                        <div className="flex items-baseline gap-1.5 min-w-0">
                          <span className="font-bold text-slate-900 dark:text-slate-100 truncate" title={row.student_name || row.student}>
                            {row.student_name || row.student}
                          </span>
                          <span className="text-[11px] text-slate-400 font-mono truncate shrink-0 max-w-[45%]" title={row.student}>
                            {row.student}
                          </span>
                        </div>
                      )}
                      <div className="font-bold text-sm text-slate-900 dark:text-slate-100 break-words">
                        {row.course}
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5 pt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                        <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 font-semibold text-slate-600 dark:text-slate-300 break-words max-w-full">
                          {row.program || '—'}
                        </span>
                        <span className="font-medium break-words min-w-0">{row.assessment_group || '—'}</span>
                      </div>
                    </div>
                    <span className={`shrink-0 inline-block px-3 py-1 rounded-full text-xs font-bold border ${getGradeBadgeTheme(calculatedGrade)}`}>
                      {calculatedGrade}
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="shrink-0 font-semibold text-slate-800 dark:text-slate-200">
                      <span>{row.total_score}</span>
                      <span className="text-slate-400 font-normal"> / {row.maximum_score}</span>
                      <span className="text-[11px] text-slate-400 ml-1.5 font-medium">({pct}%)</span>
                    </div>
                    <div className="flex-1 bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                      <div
                        className="bg-brand-600 dark:bg-brand-500 h-full rounded-full transition-all duration-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>

                  {row.comment && row.comment.trim() !== '' ? (
                    <div className="flex items-start gap-2 p-2.5 rounded-xl bg-amber-50/60 dark:bg-amber-950/30 border border-amber-200/60 dark:border-amber-900/60">
                      <MessageSquareQuote className="w-3.5 h-3.5 mt-0.5 shrink-0 text-amber-600 dark:text-amber-400" />
                      <p className="min-w-0 font-bold text-slate-900 dark:text-slate-100 italic leading-snug break-words">
                        "{row.comment}"
                      </p>
                    </div>
                  ) : (
                    <p className="text-slate-400 dark:text-slate-500 text-[11px] italic">No feedback provided</p>
                  )}

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedDetailResult(row)}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 min-h-[36px] px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300 transition"
                      title="View score breakdown & feedback details"
                    >
                      <Eye className="w-3.5 h-3.5 text-brand-600 dark:text-brand-400" />
                      <span>Details</span>
                    </button>
                    {isStaff && (
                      <button
                        onClick={() => {
                          setSelectedReportStudent(row.student);
                          setShowReportCard(true);
                        }}
                        className="flex-1 inline-flex items-center justify-center gap-1.5 min-h-[36px] px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300 transition"
                        title={`Generate report card for ${row.student_name || row.student}`}
                      >
                        <FileText className="w-3.5 h-3.5 text-brand-600 dark:text-brand-400" />
                        <span>Report Card</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Desktop / tablet table (md+) */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[750px]">
              <thead>
                <tr className="bg-slate-50/70 dark:bg-slate-800/60 border-b border-slate-100 dark:border-slate-800 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  {isStaff && <th className="py-3 px-6">Student</th>}
                  <th className="py-3 px-6">Course / Subject</th>
                  <th className="py-3 px-6">Program / Class</th>
                  <th className="py-3 px-6">Assessment Group</th>
                  <th className="py-3 px-6 text-center">Score</th>
                  <th className="py-3 px-6 text-center">Progress</th>
                  <th className="py-3 px-6 text-center">Grade</th>
                  <th className="py-3 px-6">Teacher's Remarks / Feedback</th>
                  <th className="py-3 px-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                {displayedResults.map((row, idx) => {
                  const pct = row.maximum_score > 0 ? Math.round((row.total_score / row.maximum_score) * 100) : 0;
                  const studentInitial = (row.student_name || row.student || 'S').trim().charAt(0).toUpperCase();

                  return (
                    <tr key={row.name || idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition">
                      {/* Student info for staff */}
                      {isStaff && (
                        <td className="py-3.5 px-6">
                          <div className="flex items-center gap-2.5">
                            <div className="w-7 h-7 rounded-lg bg-brand-50 dark:bg-brand-950/80 border border-brand-200/60 dark:border-brand-800 text-brand-600 dark:text-brand-400 flex items-center justify-center text-xs font-bold shrink-0">
                              {studentInitial}
                            </div>
                            <div className="min-w-0">
                              <div className="font-bold text-slate-900 dark:text-slate-100 truncate max-w-[200px]" title={row.student_name || row.student}>
                                {row.student_name || row.student}
                              </div>
                              <div className="text-[11px] sm:text-[10px] text-slate-400 font-mono">
                                {row.student}
                              </div>
                            </div>
                          </div>
                        </td>
                      )}

                      {/* Course / Subject */}
                      <td className="py-3.5 px-6 font-bold text-slate-900 dark:text-slate-100">
                        {row.course}
                      </td>

                      {/* Program */}
                      <td className="py-3.5 px-6">
                        <span className="px-2.5 py-1 rounded-md bg-slate-100 dark:bg-slate-800 text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                          {row.program || '—'}
                        </span>
                      </td>

                      {/* Assessment Group */}
                      <td className="py-3.5 px-6 text-slate-600 dark:text-slate-300 font-medium">
                        {row.assessment_group || '—'}
                      </td>

                      {/* Score */}
                      <td className="py-3.5 px-6 text-center font-semibold text-slate-800 dark:text-slate-200">
                        <span>{row.total_score}</span>
                        <span className="text-slate-400 font-normal"> / {row.maximum_score}</span>
                        <span className="text-[11px] text-slate-400 ml-1.5 font-medium">({pct}%)</span>
                      </td>

                      {/* Progress Bar */}
                      <td className="py-3.5 px-6 text-center">
                        <div className="w-24 bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden mx-auto">
                          <div 
                            className="bg-brand-600 dark:bg-brand-500 h-full rounded-full transition-all duration-500" 
                            style={{ width: `${pct}%` }} 
                          />
                        </div>
                      </td>

                      {/* Grade Badge */}
                      <td className="py-3.5 px-6 text-center">
                        {(() => {
                          const calculatedGrade = gradeForResult(row, pct);
                          return (
                            <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold border ${getGradeBadgeTheme(calculatedGrade)}`}>
                              {calculatedGrade}
                            </span>
                          );
                        })()}
                      </td>

                      {/* Teacher's Remarks / Feedback */}
                      <td className="py-3.5 px-6">
                        {row.comment && row.comment.trim() !== '' ? (
                          <div className="flex items-start gap-2 max-w-xs">
                            <span className="p-1 rounded-md bg-amber-50 dark:bg-amber-950/80 border border-amber-200/60 dark:border-amber-800 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5">
                              <MessageSquareQuote className="w-3.5 h-3.5" />
                            </span>
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-slate-900 dark:text-slate-100 italic leading-snug break-words">
                                "{row.comment}"
                              </p>
                              <span className="text-[11px] sm:text-[10px] text-amber-600 dark:text-amber-400 font-semibold block">
                                Teacher's Feedback
                              </span>
                            </div>
                          </div>
                        ) : (
                          <span className="text-slate-400 dark:text-slate-500 text-[11px] italic">
                            No feedback provided
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setSelectedDetailResult(row)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-[11px] font-bold text-slate-700 dark:text-slate-300 transition"
                            title="View score breakdown & feedback details"
                          >
                            <Eye className="w-3 h-3 text-brand-600 dark:text-brand-400" />
                            <span>Details</span>
                          </button>

                          {isStaff && (
                            <button
                              onClick={() => {
                                setSelectedReportStudent(row.student);
                                setShowReportCard(true);
                              }}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-[11px] font-bold text-slate-700 dark:text-slate-300 transition"
                              title={`Generate report card for ${row.student_name || row.student}`}
                            >
                              <FileText className="w-3 h-3 text-brand-600 dark:text-brand-400" />
                              <span>Card</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          </>
        )}
      </div>

      {/* Teacher / Faculty Grade Assessment Modal */}
      {showGradeModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-4xl w-full p-4 sm:p-6 shadow-2xl border border-slate-100 dark:border-slate-800 space-y-4 sm:space-y-5 animate-in fade-in zoom-in-95 max-h-[90vh] overflow-y-auto overscroll-contain flex flex-col">
            {/* Modal Header */}
            <div className="flex items-start justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-800 shrink-0">
              <div className="space-y-1 min-w-0">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 shrink-0 rounded-xl bg-brand-50 dark:bg-brand-950/80 text-brand-600 dark:text-brand-400 flex items-center justify-center font-bold">
                    <Edit3 className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-bold text-base text-slate-900 dark:text-slate-100">
                      Class Assessment Gradebook
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Evaluate student marks across examination criteria and compute grades
                    </p>
                  </div>
                </div>
              </div>

              <button
                onClick={() => setShowGradeModal(false)}
                className="w-9 h-9 sm:w-8 sm:h-8 shrink-0 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Plan Selector & Quick Metadata Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
              <div className="flex flex-wrap items-center gap-3 min-w-0">
                {/* Standard Filter Dropdown */}
                <div className="relative w-full sm:w-auto">
                  <label className="block text-[11px] sm:text-[10px] uppercase font-bold text-slate-400 mb-0.5">
                    Standard / Class
                  </label>
                  <select
                    value={gradebookProgramFilter}
                    onChange={(e) => {
                      const val = e.target.value;
                      setGradebookProgramFilter(val);
                      const matching = val === 'all' 
                        ? assessmentPlans 
                        : assessmentPlans.filter(p => p.program === val);
                      if (matching.length > 0) {
                        setSelectedPlanId(matching[0].name);
                      }
                    }}
                    className="appearance-none bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl pl-3 pr-8 py-1.5 text-xs font-bold text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500/20 cursor-pointer shadow-xs w-full sm:w-auto sm:min-w-[130px]"
                  >
                    <option value="all">All Standards</option>
                    {uniquePlanPrograms.map(prog => (
                      <option key={prog} value={prog}>{prog}</option>
                    ))}
                  </select>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 bottom-2.5 pointer-events-none" />
                </div>

                {/* Assessment Plan Selector */}
                <div className="relative w-full sm:w-auto min-w-0">
                  <div className="flex items-center justify-between mb-0.5">
                    <label className="block text-[11px] sm:text-[10px] uppercase font-bold text-slate-400">
                      Assessment Plan
                    </label>
                    <button
                      type="button"
                      onClick={() => openCreatePlanModal(gradebookProgramFilter !== 'all' ? gradebookProgramFilter : null)}
                      className="text-[11px] font-bold text-brand-600 dark:text-brand-400 hover:underline flex items-center gap-0.5 ml-2"
                      title="Create Assessment Plan for this standard"
                    >
                      <Plus className="w-3 h-3" />
                      <span>New Plan</span>
                    </button>
                  </div>
                  <select
                    value={selectedPlanId}
                    onChange={(e) => setSelectedPlanId(e.target.value)}
                    className="appearance-none bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl pl-3 pr-8 py-1.5 text-xs font-bold text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500/20 cursor-pointer shadow-xs w-full sm:w-auto sm:min-w-[280px] max-w-full truncate"
                  >
                    {filteredAssessmentPlans.length === 0 ? (
                      <option value="">No plans found for {gradebookProgramFilter}</option>
                    ) : (
                      filteredAssessmentPlans.map(p => (
                        <option key={p.name} value={p.name}>
                          {p.program ? `[${p.program}] ` : ''}{p.course} • {p.student_group} ({p.name})
                        </option>
                      ))
                    )}
                  </select>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 bottom-2.5 pointer-events-none" />
                </div>

                {activePlanDoc && (
                  <div className="sm:pt-3 flex flex-wrap items-center gap-2">
                    <span className="px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 text-xs font-bold border border-indigo-200/60 dark:border-indigo-800">
                      Max: {totalMaxScore} marks
                    </span>
                    <span className="px-2.5 py-1 rounded-lg break-words max-w-full bg-emerald-50 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 text-xs font-bold border border-emerald-200/60 dark:border-emerald-800">
                      Scale: {planGradingScaleData?.grading_scale || activePlanDoc.grading_scale || 'Grading Scale'}
                    </span>
                  </div>
                )}
              </div>

              {/* Search inside roster */}
              <div className="relative w-full sm:w-60 shrink-0">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Filter student..."
                  value={evalSearch}
                  onChange={(e) => setEvalSearch(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 rounded-xl pl-8 pr-3 py-1.5 text-xs text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
                />
              </div>
            </div>

            {/* Student Mark Entry Table */}
            <div className="flex-1 min-h-[220px] overflow-auto border border-slate-200 dark:border-slate-800 rounded-2xl">
              {evalLoading ? (
                <div className="p-10 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                  <div className="w-4 h-4 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
                  <span>Loading class gradebook...</span>
                </div>
              ) : filteredPlanStudents.length === 0 ? (
                <div className="p-10 text-center text-xs text-slate-400">
                  No enrolled students found for this assessment plan.
                </div>
              ) : (
                <table className="w-full min-w-[640px] text-left text-xs">
                  <thead className="sticky top-0 bg-slate-100 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 z-10">
                    <tr className="text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase">
                      <th className="py-2.5 px-4 w-12 text-center">Roll</th>
                      <th className="py-2.5 px-3 sm:px-4 sticky left-0 z-10 bg-slate-100 dark:bg-slate-800">Student</th>
                      {planCriteria.map(c => (
                        <th key={c.assessment_criteria} className="py-2.5 px-3 text-center min-w-[110px]">
                          <div>{c.assessment_criteria}</div>
                          <div className="text-[11px] sm:text-[10px] text-slate-400 font-normal">Max: {c.maximum_score}</div>
                        </th>
                      ))}
                      <th className="py-2.5 px-3 text-center w-24">Total</th>
                      <th className="py-2.5 px-3 text-center w-20">Grade</th>
                      <th className="py-2.5 px-3 min-w-[140px]">Comment</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {filteredPlanStudents.map((stu, idx) => {
                      const stuEntry = scoresState[stu.student] || { criteria: {}, comment: '' };
                      
                      let currentTotal = 0;
                      planCriteria.forEach(c => {
                        currentTotal += parseFloat(stuEntry.criteria[c.assessment_criteria] || 0) || 0;
                      });

                      const pct = totalMaxScore > 0 ? Math.round((currentTotal / totalMaxScore) * 100) : 0;
                      const planIntervals = planGradingScaleData?.intervals || intervals;
                      const calculatedGrade = calculateGradeFromScale(pct, planIntervals);

                      return (
                        <tr key={stu.student} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                          <td className="py-2.5 px-4 text-center font-mono text-slate-500 font-bold">
                            {stu.group_roll_number || idx + 1}
                          </td>
                          <td className="py-2.5 px-3 sm:px-4 sticky left-0 z-[1] bg-white dark:bg-slate-900">
                            <div className="font-bold text-slate-900 dark:text-slate-100 truncate max-w-[140px] sm:max-w-none" title={stu.student_name}>{stu.student_name}</div>
                            <div className="text-[11px] sm:text-[10px] text-slate-400 font-mono">{stu.student}</div>
                          </td>

                          {planCriteria.map(c => {
                            const val = stuEntry.criteria[c.assessment_criteria] || '';
                            return (
                              <td key={c.assessment_criteria} className="py-2 px-3 text-center">
                                <input
                                  type="number"
                                  min="0"
                                  max={c.maximum_score}
                                  step="0.5"
                                  value={val}
                                  onChange={(e) => handleScoreChange(stu.student, c.assessment_criteria, e.target.value, c.maximum_score)}
                                  placeholder="0"
                                  className="w-16 px-2 py-1 text-center font-bold text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 shadow-xs"
                                />
                              </td>
                            );
                          })}

                          <td className="py-2 px-3 text-center font-bold text-slate-900 dark:text-slate-100">
                            <span>{currentTotal}</span>
                            <span className="text-[11px] sm:text-[10px] text-slate-400 ml-1">({pct}%)</span>
                          </td>

                          <td className="py-2 px-3 text-center">
                            <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-bold border ${getGradeTheme(calculatedGrade)}`}>
                              {calculatedGrade}
                            </span>
                          </td>

                          <td className="py-2 px-3">
                            <input
                              type="text"
                              value={stuEntry.comment || ''}
                              onChange={(e) => handleCommentChange(stu.student, e.target.value)}
                              placeholder="Remarks..."
                              className="w-full px-2 py-1 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            {evalSuccessMsg && (
              <div className="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/80 border border-emerald-200 dark:border-emerald-800 text-xs font-semibold text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-500" />
                <span className="min-w-0 break-words">{evalSuccessMsg}</span>
              </div>
            )}

            {/* Modal Bottom Actions */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-slate-100 dark:border-slate-800 shrink-0">
              <span className="text-xs text-slate-500 dark:text-slate-400">
                {planStudents.length} students enrolled in {activePlanDoc?.student_group}
              </span>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowGradeModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                >
                  Close
                </button>

                <button
                  type="button"
                  onClick={() => handleSaveMarks(false)}
                  disabled={evalSaving || evalLoading}
                  className="flex-1 sm:flex-none px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-bold transition disabled:opacity-50"
                >
                  {evalSaving ? 'Saving...' : 'Save Draft'}
                </button>

                <button
                  type="button"
                  onClick={() => handleSaveMarks(true)}
                  disabled={evalSaving || evalLoading}
                  className="w-full sm:w-auto justify-center whitespace-nowrap px-5 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold shadow-xs transition active:scale-95 disabled:opacity-50 flex items-center gap-2"
                >
                  {evalSaving ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Submitting...</span>
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
        </div>
      )}

      {/* Official Term Report Card Modal */}
      {showReportCard && (
        <div 
          className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 overflow-y-auto overscroll-contain p-2 sm:p-4 md:p-6"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowReportCard(false);
          }}
        >
          <div className="min-h-full flex items-start justify-center py-2 sm:py-6">
            <div className="bg-white text-slate-900 rounded-2xl sm:rounded-3xl max-w-3xl w-full p-4 sm:p-7 shadow-2xl border border-slate-200 relative print:p-0 print:border-0 print:shadow-none print:m-0 print:max-w-none">
              
              {/* Sticky Controls Header */}
              <div className="sticky top-0 bg-white/95 backdrop-blur-md z-30 pb-3 mb-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 print:hidden">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Official Examination Credential
                  </span>

                  {/* Student Switcher for Teachers/Staff or Guardians with multiple wards */}
                  {(isStaff || (isGuardian && uniqueStudents.length > 1)) && (
                    <div className="flex items-center gap-1.5 ml-0 sm:ml-2 min-w-0 max-w-full">
                      <span className="text-xs font-bold text-slate-700 shrink-0">Student:</span>
                      <div className="relative min-w-0">
                        <select
                          value={activeReportTargetId}
                          onChange={(e) => setSelectedReportStudent(e.target.value)}
                          className="appearance-none max-w-[220px] sm:max-w-xs truncate bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-xl pl-3 pr-7 py-1.5 sm:py-1 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500/20 cursor-pointer shadow-xs transition"
                        >
                          {uniqueStudents.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.name} ({s.id})
                            </option>
                          ))}
                        </select>
                        <ChevronDown className="w-3 h-3 text-slate-500 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2 ml-auto">
                  <button
                    onClick={() => window.print()}
                    className="flex items-center gap-1.5 min-h-[36px] sm:min-h-0 px-3.5 py-1.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold shadow-xs transition active:scale-95"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>Print / Save PDF</span>
                  </button>
                  <button
                    onClick={() => setShowReportCard(false)}
                    className="p-2 sm:p-1.5 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition"
                    title="Close"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Printable Document Body */}
              <div className="border-2 sm:border-4 border-double border-slate-300 p-3 sm:p-7 rounded-2xl relative overflow-hidden bg-white">
                {/* Watermark */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-[0.03]">
                  <GraduationCap className="w-60 h-60 sm:w-96 sm:h-96 print:w-96 print:h-96 text-slate-900" />
                </div>

                {/* School Header */}
                <div className="text-center pb-5 border-b-2 border-slate-800 relative z-10 space-y-1">
                  <div className="inline-flex items-center justify-center w-11 h-11 rounded-2xl bg-slate-900 text-white mb-1 shadow-xs">
                    <GraduationCap className="w-6 h-6 text-amber-400" />
                  </div>
                  <h1 className="text-lg sm:text-2xl font-black uppercase tracking-tight text-slate-900 break-words">
                    {reportCardMeta?.school?.name || schoolSettings?.name || (reportCardMetaLoading ? 'Loading…' : '')}
                  </h1>
                  {reportCardMeta?.school?.address && (
                    <p className="text-[11px] sm:text-xs font-semibold text-slate-600 tracking-wide uppercase break-words">
                      {reportCardMeta.school.address}
                    </p>
                  )}
                  {(reportCardMeta?.student?.academic_year || activeAcademicYear) && (
                    <p className="text-[11px] text-slate-500">
                      Academic Session {reportCardMeta?.student?.academic_year || activeAcademicYear}
                    </p>
                  )}
                  <div className="pt-1.5">
                    <span className="inline-block max-w-full px-3.5 py-1 rounded-full bg-slate-900 text-amber-300 text-[11px] sm:text-xs font-black uppercase tracking-wider sm:tracking-widest">
                      Progress Report Card
                    </span>
                  </div>
                </div>

                {/* Student Demographics Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 print:grid-cols-4 gap-3 sm:gap-4 py-4 sm:py-5 border-b border-slate-200 text-xs relative z-10">
                  <div className="min-w-0">
                    <span className="text-[11px] sm:text-[10px] uppercase font-bold text-slate-400 block">Student Name</span>
                    <span className="font-extrabold text-slate-900 text-xs sm:text-sm truncate block" title={reportCardStats.studentName}>
                      {reportCardStats.studentName}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <span className="text-[11px] sm:text-[10px] uppercase font-bold text-slate-400 block">Student ID / Roll</span>
                    <span className="font-bold text-slate-900 font-mono text-xs truncate block" title={reportCardStats.studentId}>
                      {reportCardStats.studentId}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <span className="text-[11px] sm:text-[10px] uppercase font-bold text-slate-400 block">Standard / Class</span>
                    <span className="font-bold text-slate-900 text-xs truncate block" title={reportCardStats.program}>
                      {reportCardStats.program}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <span className="text-[11px] sm:text-[10px] uppercase font-bold text-slate-400 block">Evaluation Term</span>
                    <span className="font-bold text-slate-900 text-xs truncate block">
                      {reportCardMeta?.student?.academic_term || 'All Terms'}
                    </span>
                  </div>
                </div>

                {/* Academic Performance Table */}
                <div className="py-4 relative z-10">
                  <div className="overflow-x-auto print:overflow-visible rounded-lg border border-slate-200">
                    <table className="w-full min-w-[520px] print:min-w-0 text-left text-xs">
                      <thead>
                        <tr className="bg-slate-100 border-b border-slate-200 text-[11px] font-bold text-slate-700 uppercase">
                          <th className="py-2.5 px-3 w-12 text-center">S.No</th>
                          <th className="py-2.5 px-3 sm:px-4">Subject / Course</th>
                          <th className="py-2.5 px-3 text-center">Max Marks</th>
                          <th className="py-2.5 px-3 text-center">Obtained</th>
                          <th className="py-2.5 px-3 text-center">Percentage</th>
                          <th className="py-2.5 px-3 text-center">Grade</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {studentReportResults.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="py-6 text-center text-slate-400 text-xs">
                              No examination records found for this student.
                            </td>
                          </tr>
                        ) : (
                          studentReportResults.map((row, idx) => {
                            const pct = row.maximum_score > 0 ? Math.round((row.total_score / row.maximum_score) * 100) : 0;
                            return (
                              <tr key={idx} className="hover:bg-slate-50/80">
                                <td className="py-2.5 px-3 text-center font-mono text-slate-500">{idx + 1}</td>
                                <td className="py-2.5 px-3 sm:px-4 font-bold text-slate-900">{row.course}</td>
                                <td className="py-2.5 px-3 text-center font-medium">{row.maximum_score}</td>
                                <td className="py-2.5 px-3 text-center font-bold text-slate-900">{row.total_score}</td>
                                <td className="py-2.5 px-3 text-center font-semibold">{pct}%</td>
                                <td className="py-2.5 px-3 text-center font-black">{gradeForResult(row, pct)}</td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                      <tfoot>
                        <tr className="bg-slate-100 font-bold border-t-2 border-slate-800 text-slate-900">
                          <td colSpan={2} className="py-3 px-3 sm:px-4 uppercase font-black">
                            Grand Aggregate
                          </td>
                          <td className="py-3 px-3 text-center">{reportCardStats.max}</td>
                          <td className="py-3 px-3 text-center font-black text-brand-700">{reportCardStats.total}</td>
                          <td className="py-3 px-3 text-center font-black">{reportCardStats.percentage === null ? '—' : `${reportCardStats.percentage}%`}</td>
                          <td className="py-3 px-3 text-center font-black text-emerald-700 text-sm">
                            {reportCardStats.percentage === null ? '—' : calculateGradeFromScale(reportCardStats.percentage, intervals)}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>

                {/* Official Grading Scale Legend */}
                {intervals.length > 0 && (
                  <div className="bg-slate-50 border border-slate-200 p-2.5 rounded-xl text-[11px] sm:text-[10px] text-slate-600 flex flex-wrap items-center justify-between gap-2 relative z-10">
                    <span className="font-bold text-slate-700 uppercase">Grading Scale ({gradingScaleData?.grading_scale}):</span>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      {intervals.map((inv) => (
                        <span key={inv.grade} className="font-mono">
                          <strong className="text-slate-900">{inv.grade}</strong>: ≥{inv.min_percentage}% {inv.description ? `(${inv.description})` : ''}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Result Summary & Endorsement */}
                <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="min-w-0">
                    <span className="text-[11px] sm:text-[10px] uppercase font-bold text-slate-400 block">Overall Assessment Result</span>
                    {(() => {
                      if (reportCardStats.percentage === null) {
                        return (
                          <span className="text-xs sm:text-sm font-black uppercase tracking-wide text-slate-500">
                            No published results
                          </span>
                        );
                      }
                      const aggregateGrade = calculateGradeFromScale(reportCardStats.percentage, intervals);
                      const passed = isPassingPercentage(reportCardStats.percentage, intervals, passPercentage);
                      const description = getGradeDescription(aggregateGrade, intervals);
                      return (
                        <span className={`text-xs sm:text-sm font-black uppercase tracking-wide ${passed === false ? 'text-rose-700' : 'text-emerald-700'}`}>
                          {passed === null ? `Grade ${aggregateGrade}` : (passed ? 'Passed' : 'Needs Improvement')}
                          {description ? ` · ${description}` : ''}
                        </span>
                      );
                    })()}
                    <p className="text-[11px] text-slate-500 mt-0.5 break-words">
                      {passPercentage !== null
                        ? `Pass mark under ${gradingScaleData?.grading_scale}: ${passPercentage}%`
                        : 'Grading scale unavailable'}
                      {reportCardMeta?.attendance?.percentage !== null && reportCardMeta?.attendance?.percentage !== undefined
                        ? ` · Attendance ${reportCardMeta.attendance.percentage}% (${reportCardMeta.attendance.present}/${reportCardMeta.attendance.total} days)`
                        : ''}
                    </p>
                  </div>
                  <div className="text-left sm:text-right shrink-0">
                    <span className="text-[11px] sm:text-[10px] uppercase font-bold text-slate-400 block">Cumulative Score</span>
                    <span className="text-base sm:text-lg font-black text-slate-900">
                      {reportCardStats.total} / {reportCardStats.max}
                    </span>
                  </div>
                </div>

                {/* Official Signatures */}
                <div className="pt-8 sm:pt-10 grid grid-cols-1 sm:grid-cols-3 print:grid-cols-3 gap-6 text-center text-xs relative z-10">
                  <div>
                    <div className="border-b border-slate-400 pb-1 mb-1 font-serif italic text-slate-600 text-xs sm:text-sm min-h-[1.5rem]">
                      {reportCardMeta?.student?.class_teacher || '\u00a0'}
                    </div>
                    <span className="text-[11px] sm:text-[10px] uppercase font-bold text-slate-500 block">Class Teacher</span>
                  </div>
                  <div>
                    <div className="border-b border-slate-400 pb-1 mb-1 font-serif italic text-slate-600 text-xs sm:text-sm min-h-[1.5rem]">
                      {'\u00a0'}
                    </div>
                    <span className="text-[11px] sm:text-[10px] uppercase font-bold text-slate-500 block">Controller of Exams</span>
                  </div>
                  <div>
                    <div className="border-b border-slate-400 pb-1 mb-1 font-serif italic text-slate-600 text-xs sm:text-sm min-h-[1.5rem]">
                      {'\u00a0'}
                    </div>
                    <span className="text-[11px] sm:text-[10px] uppercase font-bold text-slate-500 block">Principal</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Create Assessment Plan */}
      {isCreatePlanModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-lg w-full shadow-2xl border border-slate-100 dark:border-slate-800 max-h-[92vh] flex flex-col my-auto overflow-hidden animate-in fade-in zoom-in-95">
            {/* Header */}
            <div className="p-4 sm:p-5 pb-3 border-b border-slate-100 dark:border-slate-800 shrink-0 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-8 h-8 shrink-0 rounded-xl bg-brand-50 dark:bg-brand-950/80 text-brand-600 dark:text-brand-400 flex items-center justify-center font-bold">
                  <Plus className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-slate-900 dark:text-slate-100">
                    Create Assessment Plan
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Configure exams & grading for any program or section
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsCreatePlanModalOpen(false)}
                className="w-9 h-9 sm:w-8 sm:h-8 shrink-0 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateAssessmentPlan} className="flex-1 min-h-0 flex flex-col overflow-hidden">
              <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3.5">
                {createPlanError && (
                  <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-400 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span className="min-w-0 break-words">{createPlanError}</span>
                  </div>
                )}

                {/* Program & Student Group Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Standard / Program */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Standard / Program *
                    </label>
                    <div className="relative">
                      <select
                        value={createPlanForm.program}
                        onChange={(e) => {
                          const newProg = e.target.value;
                          const matchingGroups = (planMeta.student_groups || []).filter(g => g.program === newProg);
                          setCreatePlanForm(prev => ({
                            ...prev,
                            program: newProg,
                            student_group: matchingGroups[0]?.name || '',

                          }));
                        }}
                        className="w-full appearance-none bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 pr-8 text-xs font-bold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500"
                      >
                        {uniquePlanPrograms.map(p => (
                          <option key={p} value={p}>{p}</option>
                        ))}
                      </select>
                      <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    </div>
                  </div>

                  {/* Student Group / Section */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Class Section / Group *
                    </label>
                    <div className="relative">
                      <select
                        value={createPlanForm.student_group}
                        onChange={(e) => setCreatePlanForm({ ...createPlanForm, student_group: e.target.value })}
                        className="w-full appearance-none bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 pr-8 text-xs font-bold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500"
                        required
                      >
                        {(planMeta.student_groups || [])
                          .filter(g => !createPlanForm.program || g.program === createPlanForm.program)
                          .map(g => (
                            <option key={g.name} value={g.name}>{g.student_group_name || g.name}</option>
                          ))}
                      </select>
                      <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    </div>
                  </div>
                </div>

                {/* Course & Grading Scale */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Course */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Course / Subject *
                    </label>
                    <div className="relative">
                      <select
                        value={createPlanForm.course}
                        onChange={(e) => {
                          const newCourse = e.target.value;
                          setCreatePlanForm(prev => ({
                            ...prev,
                            course: newCourse,
                            grading_scale: (planMeta.courses || []).find(c => c.name === newCourse)?.default_grading_scale || prev.grading_scale,
                          }));
                        }}
                        className="w-full appearance-none bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 pr-8 text-xs font-bold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500"
                        required
                      >
                        {(planMeta.courses || []).map(c => (
                          <option key={c.name} value={c.name}>{c.course_name || c.name}</option>
                        ))}
                      </select>
                      <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    </div>
                  </div>

                  {/* Grading Scale */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Grading Scale
                    </label>
                    <div className="relative">
                      <select
                        value={createPlanForm.grading_scale}
                        onChange={(e) => setCreatePlanForm({ ...createPlanForm, grading_scale: e.target.value })}
                        className="w-full appearance-none bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 pr-8 text-xs font-bold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500"
                      >
                        {(planMeta.grading_scales || []).map(gs => (
                          <option key={gs.name} value={gs.name}>{gs.name}</option>
                        ))}
                      </select>
                      <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    </div>
                  </div>
                </div>

                {/* Assessment Name */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Assessment Name
                  </label>
                  <input
                    type="text"
                    value={createPlanForm.assessment_name}
                    onChange={(e) => setCreatePlanForm({ ...createPlanForm, assessment_name: e.target.value })}
                    placeholder="Defaults to Course - Student Group"
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-medium text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>

                {/* Date & Evaluation Scheme */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Schedule Date */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Evaluation Date
                    </label>
                    <input
                      type="date"
                      value={createPlanForm.schedule_date}
                      onChange={(e) => setCreatePlanForm({ ...createPlanForm, schedule_date: e.target.value })}
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500"
                    />
                  </div>

                  {/* Criteria Preset */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Criteria Preset
                    </label>
                    <div className="relative">
                      <select
                        value={createPlanForm.criteria_preset}
                        onChange={(e) => setCreatePlanForm({ ...createPlanForm, criteria_preset: e.target.value })}
                        className="w-full appearance-none bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 pr-8 text-xs font-bold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500"
                      >
                        {(planMeta.criteria || []).length === 0 && (
                          <option value="">No Assessment Criteria configured</option>
                        )}
                        {(planMeta.criteria || []).map(c => (
                          <option key={c.name} value={c.name}>{c.assessment_criteria || c.name} (100 Marks)</option>
                        ))}
                      </select>
                      <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Footer Actions */}
              <div className="p-4 sm:p-5 pt-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/70 flex flex-col-reverse sm:flex-row sm:items-center justify-end gap-2 sm:gap-2.5 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsCreatePlanModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creatingPlan}
                  className="justify-center px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold shadow-xs transition active:scale-95 disabled:opacity-50 flex items-center gap-1.5"
                >
                  {creatingPlan ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Creating Plan...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Create & Open Gradebook</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Student / Guardian Result Breakdown & Feedback Modal */}
      {selectedDetailResult && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-xl w-full max-h-[90vh] overflow-y-auto overscroll-contain p-5 sm:p-6 shadow-2xl border border-slate-100 dark:border-slate-800 space-y-5 animate-in fade-in zoom-in-95">
            {/* Header */}
            <div className="flex items-start justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 shrink-0 rounded-2xl bg-brand-50 dark:bg-brand-950/80 text-brand-600 dark:text-brand-400 flex items-center justify-center font-bold shadow-xs">
                  <GraduationCap className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-extrabold text-base text-slate-900 dark:text-slate-100 break-words">
                    {selectedDetailResult.course}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 break-words">
                    {selectedDetailResult.assessment_name || selectedDetailResult.assessment_group || 'Assessment'}{selectedDetailResult.program ? ` · ${selectedDetailResult.program}` : ''}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedDetailResult(null)}
                className="shrink-0 p-2 sm:p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Score & Grade Summary */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-3 sm:p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 text-center">
              <div>
                <span className="text-[11px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Score</span>
                <span className="text-sm sm:text-base font-black text-slate-900 dark:text-slate-100 font-mono break-words">
                  {selectedDetailResult.total_score} / {selectedDetailResult.maximum_score}
                </span>
              </div>
              <div>
                <span className="text-[11px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Percentage</span>
                <span className="text-sm sm:text-base font-black text-brand-600 dark:text-brand-400 font-mono">
                  {selectedDetailResult.maximum_score > 0 ? Math.round((selectedDetailResult.total_score / selectedDetailResult.maximum_score) * 100) : 0}%
                </span>
              </div>
              <div className="col-span-2 sm:col-span-1">
                <span className="text-[11px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Final Grade</span>
                <span className={`inline-block px-2.5 py-0.5 mt-0.5 rounded-full text-xs font-black border ${getGradeBadgeTheme(selectedDetailResult.grade)}`}>
                  {selectedDetailResult.grade}
                </span>
              </div>
            </div>

            {/* Teacher's Formal Remarks / Feedback */}
            <div className="space-y-2">
              <label className="text-xs font-extrabold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <MessageSquareQuote className="w-4 h-4 text-amber-500" />
                <span>Instructor's Feedback &amp; Remarks</span>
              </label>
              <div className="p-4 rounded-2xl bg-amber-50/70 dark:bg-amber-950/40 border border-amber-200/80 dark:border-amber-800/80">
                {selectedDetailResult.comment && selectedDetailResult.comment.trim() !== '' ? (
                  <p className="text-sm font-bold text-slate-900 dark:text-slate-100 italic leading-relaxed break-words">
                    "{selectedDetailResult.comment}"
                  </p>
                ) : (
                  <p className="text-xs text-slate-400 dark:text-slate-500 italic">
                    No specific written feedback was entered for this result.
                  </p>
                )}
              </div>
            </div>

            {/* Criteria Breakdown if available */}
            {selectedDetailResult.details && selectedDetailResult.details.length > 0 && (
              <div className="space-y-2">
                <label className="text-xs font-extrabold uppercase tracking-wider text-slate-500">
                  Criteria Score Breakdown
                </label>
                <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200/80 dark:border-slate-800 rounded-2xl overflow-hidden">
                  {selectedDetailResult.details.map((d, i) => (
                    <div key={i} className="p-3 bg-white dark:bg-slate-900 flex items-center justify-between gap-3 text-xs">
                      <span className="font-semibold text-slate-700 dark:text-slate-300 min-w-0 break-words">
                        {d.assessment_criteria}
                      </span>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="font-mono font-bold text-slate-900 dark:text-slate-100">
                          {d.score} / {d.maximum_score}
                        </span>
                        {d.grade && (
                          <span className={`px-2 py-0.5 rounded text-[11px] sm:text-[10px] font-bold border ${getGradeBadgeTheme(d.grade)}`}>
                            {d.grade}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Footer */}
            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedDetailResult(null)}
                className="w-full sm:w-auto px-5 py-2 rounded-xl bg-slate-900 dark:bg-slate-800 text-white font-bold text-xs hover:bg-slate-800 transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
