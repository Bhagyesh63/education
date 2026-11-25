import { todayISO } from '../utils/date';
import React, { useState, useEffect, useMemo } from 'react';
import { 
  BookOpen, CheckCircle, Clock, ChevronDown, ChevronUp, 
  FileText, Video, HelpCircle, Sparkles, Plus, X, Play, 
  Award, Check, AlertCircle, ArrowRight, ArrowLeft, RotateCcw, 
  ExternalLink, User, Calendar, Trash2, Layers, CheckCircle2,
  Lock, Users, Search, GraduationCap, BarChart2, ShieldAlert,
  Info, Settings2
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/frappeClient';

// Helper to convert any YouTube URL into an embed URL
function getYouTubeEmbedUrl(url) {
  if (!url) return '';
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=|shorts\/)([^#&?]*).*/;
  const match = url.match(regExp);
  if (match && match[2] && match[2].length === 11) {
    return `https://www.youtube.com/embed/${match[2]}?autoplay=0&rel=0`;
  }
  return url;
}

// Helper to format duration seconds or minutes nicely
function formatDuration(duration) {
  if (!duration) return 'Self-paced';
  const num = Number(duration);
  if (isNaN(num) || num <= 0) return 'Self-paced';
  if (num > 120) {
    const mins = Math.floor(num / 60);
    const secs = Math.floor(num % 60);
    return `${mins}m ${secs > 0 ? `${secs}s` : ''}`;
  }
  return `${Math.round(num)} mins`;
}

export default function CoursesView() {
  const { 
    activeProgram, 
    programs,
    isStaff, 
    isStudent, 
    isGuardian,
    students,
    selectStudent,
    instructorInfo, 
    sessionUser, 
    activeStudentId, 
    studentProfile,
  } = useAuth();

  const [selectedProgram, setSelectedProgram] = useState(activeProgram || '');
  const [allProgramsList, setAllProgramsList] = useState([]);
  const [courseSearch, setCourseSearch] = useState('');
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [expandedIndex, setExpandedIndex] = useState(0);

  // Modal states for Viewing content
  const [viewingContent, setViewingContent] = useState(null); // { type, title, courseName, details, loading, error }
  
  // Interactive Quiz State
  const [quizAnswers, setQuizAnswers] = useState({});
  const [quizSubmitted, setQuizSubmitted] = useState(false);
  const [quizQuestionIndex, setQuizQuestionIndex] = useState(0);
  const [isSubmittingQuiz, setIsSubmittingQuiz] = useState(false);
  const [quizStatus, setQuizStatus] = useState(null); // { is_locked, attempts_used, max_attempts, attempts_remaining, highest_score, is_teacher }
  const [quizActiveTab, setQuizActiveTab] = useState('take'); // 'submissions' | 'take'
  const [quizSubmissionsData, setQuizSubmissionsData] = useState({ submissions: [], stats: {} });
  const [submissionsLoading, setSubmissionsLoading] = useState(false);
  const [submissionSearch, setSubmissionSearch] = useState('');
  const [quizSubmitResult, setQuizSubmitResult] = useState(null);

  // Teacher Action Modals
  const [isAddMaterialOpen, setIsAddMaterialOpen] = useState(false);
  const [isAddTopicOpen, setIsAddTopicOpen] = useState(false);
  const [selectedCourseForAction, setSelectedCourseForAction] = useState('');
  const [selectedTopicForAction, setSelectedTopicForAction] = useState('');

  // Add Material Form State
  const [materialType, setMaterialType] = useState('Article'); // 'Article' | 'Video' | 'Quiz'
  const [materialTitle, setMaterialTitle] = useState('');
  const [articleAuthor, setArticleAuthor] = useState('');
  const [articleContent, setArticleContent] = useState('');
  const [videoProvider, setVideoProvider] = useState('YouTube');
  const [videoUrl, setVideoUrl] = useState('');
  const [videoDuration, setVideoDuration] = useState('');
  const [videoDescription, setVideoDescription] = useState('');
  const [quizPassingScore, setQuizPassingScore] = useState(75);
  const [quizMaxAttempts, setQuizMaxAttempts] = useState(2);
  const [quizDuration, setQuizDuration] = useState('');
  const [quizQuestions, setQuizQuestions] = useState([
    {
      question: '',
      question_type: 'Single Correct Answer',
      options: [
        { option: '', is_correct: true },
        { option: '', is_correct: false },
        { option: '', is_correct: false },
        { option: '', is_correct: false },
      ],
      explanation: '',
    }
  ]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState(null);
  const [actionSuccessMsg, setActionSuccessMsg] = useState(null);

  // Add Topic Form State
  const [newTopicTitle, setNewTopicTitle] = useState('');
  const [newTopicDesc, setNewTopicDesc] = useState('');
  const [isTopicSubmitting, setIsTopicSubmitting] = useState(false);
  const [topicError, setTopicError] = useState(null);

  // Create Standard / Program Modal State
  const [isCreateProgramOpen, setIsCreateProgramOpen] = useState(false);
  const [newProgramName, setNewProgramName] = useState('');
  const [newProgramAbbr, setNewProgramAbbr] = useState('');
  const [newProgramDept, setNewProgramDept] = useState('');
  const [createProgramSubmitting, setCreateProgramSubmitting] = useState(false);
  const [createProgramError, setCreateProgramError] = useState(null);
  const [createProgramSuccess, setCreateProgramSuccess] = useState(null);
  const [newProgramSelectedCourses, setNewProgramSelectedCourses] = useState([]);
  const [autoCreateCoreCourses, setAutoCreateCoreCourses] = useState(false);

  // Manage Program Courses Modal State
  const [isManageProgramCoursesOpen, setIsManageProgramCoursesOpen] = useState(false);
  const [programLinkedCourses, setProgramLinkedCourses] = useState([]);
  const [allAvailableCourses, setAllAvailableCourses] = useState([]);
  const [selectedCourseToAssign, setSelectedCourseToAssign] = useState('');
  const [manageCoursesLoading, setManageCoursesLoading] = useState(false);
  const [manageCoursesMsg, setManageCoursesMsg] = useState(null);

  // Delete / Remove Course Modal State
  const [courseToDelete, setCourseToDelete] = useState(null); // { name, courseTitle, program }
  const [deleteCourseSubmitting, setDeleteCourseSubmitting] = useState(false);
  const [deleteCourseError, setDeleteCourseError] = useState(null);
  const [alsoDeleteCompletely, setAlsoDeleteCompletely] = useState(false);

  // Create Course Modal State
  const [isCreateCourseOpen, setIsCreateCourseOpen] = useState(false);
  const [newCourseName, setNewCourseName] = useState('');
  const [newCourseProgram, setNewCourseProgram] = useState('');
  const [newCourseDept, setNewCourseDept] = useState('');
  const [newCourseGradingScale, setNewCourseGradingScale] = useState('');
  const [newCourseDesc, setNewCourseDesc] = useState('');
  const [createCourseSubmitting, setCreateCourseSubmitting] = useState(false);
  const [createCourseError, setCreateCourseError] = useState(null);
  const [createCourseSuccess, setCreateCourseSuccess] = useState(null);

  // Quick Schedule Lecture Modal State
  const [isQuickScheduleOpen, setIsQuickScheduleOpen] = useState(false);
  const [scheduleTargetCourse, setScheduleTargetCourse] = useState(null);
  const [scheduleMeta, setScheduleMeta] = useState({ instructors: [], student_groups: [], rooms: [] });
  const [scheduleFormData, setScheduleFormData] = useState({
    course: '',
    student_group: '',
    instructor: '',
    schedule_date: todayISO(),
    from_time: '09:00:00',
    to_time: '10:00:00',
    room: '',
  });
  const [quickScheduleSubmitting, setQuickScheduleSubmitting] = useState(false);
  const [quickScheduleError, setQuickScheduleError] = useState(null);
  const [quickScheduleSuccess, setQuickScheduleSuccess] = useState(null);

  // Create Academic Year Modal State
  const [isCreateYearOpen, setIsCreateYearOpen] = useState(false);
  const [newYearData, setNewYearData] = useState({
    academic_year_name: '',
    year_start_date: '',
    year_end_date: '',
  });
  const [yearPresetBase, setYearPresetBase] = useState(() => new Date().getFullYear());
  const [createYearSubmitting, setCreateYearSubmitting] = useState(false);
  const [createYearError, setCreateYearError] = useState(null);
  const [createYearSuccess, setCreateYearSuccess] = useState(null);

  // Create Academic Term Modal State
  const [isCreateTermOpen, setIsCreateTermOpen] = useState(false);
  const [availableAcademicYears, setAvailableAcademicYears] = useState([]);
  const [newTermData, setNewTermData] = useState({
    academic_year: '',
    term_name: 'Term 1',
    term_start_date: '',
    term_end_date: '',
  });
  const [createTermSubmitting, setCreateTermSubmitting] = useState(false);
  const [createTermError, setCreateTermError] = useState(null);
  const [createTermSuccess, setCreateTermSuccess] = useState(null);

  // Sync selectedProgram with activeProgram or ward
  useEffect(() => {
    if (activeProgram) {
      setSelectedProgram(activeProgram);
    }
  }, [activeProgram]);

  // Staff can browse every program; students / guardians only see their own enrolments
  useEffect(() => {
    if (!isStaff) {
      setAllProgramsList([]);
      return;
    }
    api.getAllPrograms()
      .then((data) => {
        if (data && Array.isArray(data)) {
          setAllProgramsList(data.map(p => p.name || p.program_name));
        }
      })
      .catch((err) => console.error('Failed to load programs:', err));
  }, [isStaff]);

  const availableProgramsList = useMemo(() => {
    return Array.from(new Set([
      ...(programs || []).map(p => typeof p === 'object' ? p.program : p).filter(Boolean),
      ...allProgramsList
    ])).filter(Boolean).sort();
  }, [programs, allProgramsList]);

  // Default to the first available program once the list is known
  useEffect(() => {
    if (!selectedProgram && availableProgramsList.length > 0) {
      setSelectedProgram(activeProgram || availableProgramsList[0]);
    }
  }, [availableProgramsList, selectedProgram, activeProgram]);

  const fetchProgramCourses = async (progParam) => {
    const prog = progParam || selectedProgram || activeProgram;
    setLoadError(null);
    if (!prog) {
      setCourses([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const curriculum = await api.getProgramCurriculumDetails(prog);
      if (Array.isArray(curriculum)) {
        setCourses(curriculum);
        setLoading(false);
        return;
      }

      const courseNames = await api.getCourseListBasedOnProgram(prog);
      if (!courseNames || !courseNames.length) {
        setCourses([]);
        setLoading(false);
        return;
      }

      const coursePromises = courseNames.map(async (cName) => {
        try {
          const courseDoc = await api.getCourseDetails(cName);
          const rawTopics = courseDoc?.topics || [];
          const topicsWithContent = await Promise.all(
            rawTopics.map(async (t) => {
              try {
                const topicDoc = await api.getTopicDetails(t.topic || t.topic_name);
                return {
                  name: t.topic || t.topic_name,
                  title: topicDoc?.topic_name || t.topic || t.topic_name,
                  description: topicDoc?.description || '',
                  contents: (topicDoc?.topic_content || []).map(tc => ({
                    title: tc.content,
                    type: (tc.content_type || 'Article').toLowerCase(),
                    status: 'Available',
                  }))
                };
              } catch {
                return {
                  name: t.topic || t.topic_name,
                  title: t.topic || t.topic_name,
                  description: '',
                  contents: []
                };
              }
            })
          );

          return {
            name: cName,
            courseName: courseDoc?.course_name || cName,
            department: courseDoc?.department || '',
            description: courseDoc?.description || '',
            topicsCount: topicsWithContent.length,
            topics: topicsWithContent,
          };
        } catch {
          return {
            name: cName,
            courseName: cName,
            department: '',
            description: '',
            topicsCount: 0,
            topics: [],
          };
        }
      });

      const resolvedCourses = await Promise.all(coursePromises);
      setCourses(resolvedCourses);
    } catch (err) {
      console.error('Error fetching curriculum courses:', err);
      setCourses([]);
      setLoadError(err.message || 'Failed to load the curriculum for this program.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProgramCourses(selectedProgram);
  }, [selectedProgram]);

  // Load teacher submissions for quiz
  const loadSubmissions = async (quizName, courseName) => {
    setSubmissionsLoading(true);
    try {
      const res = await api.getQuizStudentSubmissions(quizName, courseName);
      setQuizSubmissionsData(res || { submissions: [], stats: {} });
    } catch (err) {
      console.error('Error loading quiz submissions:', err);
    } finally {
      setSubmissionsLoading(false);
    }
  };

  // Handler to open and fetch content details (Article, Video, Quiz)
  const handleOpenContent = async (item, courseName, defaultTab = null) => {
    const isQuiz = item.type === 'quiz';
    const initialTab = defaultTab || (isStaff ? 'submissions' : 'take');

    setViewingContent({
      type: item.type,
      title: item.title,
      courseName: courseName || '',
      details: null,
      loading: true,
      error: null,
    });
    setQuizAnswers({});
    setQuizSubmitted(false);
    setQuizQuestionIndex(0);
    setQuizSubmitResult(null);
    setQuizActiveTab(initialTab);
    setQuizStatus(null);
    setSubmissionSearch('');

    try {
      const data = await api.getLearningContentDetails(item.type, item.title);
      if (!data || !data.title) {
        setViewingContent(prev => ({
          ...prev,
          loading: false,
          error: 'Content could not be loaded. Please verify it is published in the system.'
        }));
        return;
      }

      setViewingContent(prev => ({
        ...prev,
        details: data,
        loading: false,
      }));

      if (isQuiz) {
        if (data.quiz_status) {
          setQuizStatus(data.quiz_status);
        }
        if (isStaff) {
          loadSubmissions(item.title, courseName);
        }
      }
    } catch (err) {
      console.error('Error fetching learning content:', err);
      setViewingContent(prev => ({
        ...prev,
        loading: false,
        error: 'Network or permission error while loading content.'
      }));
    }
  };

  // Close any active content viewer
  const handleCloseViewer = () => {
    setViewingContent(null);
    setQuizAnswers({});
    setQuizSubmitted(false);
    setQuizQuestionIndex(0);
    setQuizStatus(null);
    setQuizSubmitResult(null);
  };

  // Handle quiz option click
  const handleQuizSelectOption = (qIndex, optionText) => {
    if (quizSubmitted || quizStatus?.is_locked) return;
    setQuizAnswers(prev => ({
      ...prev,
      [qIndex]: optionText,
    }));
  };

  // Submit quiz to backend to store in Quiz Activity
  const handleSubmitQuiz = async () => {
    if (!viewingContent?.title) return;
    setIsSubmittingQuiz(true);
    try {
      const studentTarget = isStudent ? (activeStudentId || studentProfile?.name) : null;
      const res = await api.submitQuizAssessment(
        viewingContent.title,
        quizAnswers,
        viewingContent.courseName || '',
        studentTarget,
        0
      );

      if (res && res.success) {
        setQuizSubmitResult(res);
        setQuizSubmitted(true);
        setQuizStatus(prev => ({
          ...prev,
          attempts_used: res.attempts_used,
          max_attempts: res.max_attempts,
          attempts_remaining: Math.max(0, res.max_attempts - res.attempts_used),
          is_locked: res.is_locked,
          highest_score: Math.max(prev?.highest_score || 0, res.score),
        }));

        if (isStaff) {
          loadSubmissions(viewingContent.title, viewingContent.courseName);
        }
      } else {
        alert(res?.message || 'Failed to submit quiz assessment.');
      }
    } catch (err) {
      console.error('Error submitting quiz:', err);
      alert(err.message || 'Error occurred while saving your quiz to database.');
    } finally {
      setIsSubmittingQuiz(false);
    }
  };

  // Calculate Quiz Score locally if needed
  const getQuizResults = () => {
    if (quizSubmitResult) {
      return {
        correct: quizSubmitResult.correct_count,
        total: quizSubmitResult.total_questions,
        percent: quizSubmitResult.score,
        passed: quizSubmitResult.passed,
        passingScore: viewingContent?.details?.passing_score || 70,
        isLocked: quizSubmitResult.is_locked,
        attemptsUsed: quizSubmitResult.attempts_used,
        maxAttempts: quizSubmitResult.max_attempts,
        preview: quizSubmitResult.preview,
      };
    }

    if (!viewingContent?.details?.questions) return { correct: 0, total: 0, percent: 0, passed: false };
    const questions = viewingContent.details.questions;
    let correct = 0;
    questions.forEach((q, idx) => {
      const chosen = quizAnswers[idx];
      const correctOpt = (q.options || []).find(o => o.is_correct);
      if (chosen && correctOpt && chosen === correctOpt.option) {
        correct++;
      }
    });
    const total = questions.length;
    const percent = total > 0 ? Math.round((correct / total) * 100) : 0;
    const passingScore = viewingContent.details.passing_score || 70;
    const passed = percent >= passingScore;
    return { 
      correct, 
      total, 
      percent, 
      passed, 
      passingScore, 
      isLocked: quizStatus?.is_locked,
      attemptsUsed: quizStatus?.attempts_used || 1,
      maxAttempts: quizStatus?.max_attempts || 2,
      preview: isStaff,
    };
  };

  // Open Add Material Modal for specific course/topic
  const handleOpenAddMaterial = (courseName, topicName = '') => {
    setSelectedCourseForAction(courseName);
    setSelectedTopicForAction(topicName);
    setMaterialType('Article');
    setMaterialTitle('');
    setArticleAuthor(instructorInfo?.instructor_name || sessionUser || 'Faculty Instructor');
    setArticleContent('');
    setVideoProvider('YouTube');
    setVideoUrl('');
    setVideoDuration('');
    setVideoDescription('');
    setQuizPassingScore(75);
    setQuizMaxAttempts(2);
    setQuizDuration('');
    setQuizQuestions([
      {
        question: '',
        question_type: 'Single Correct Answer',
        options: [
          { option: '', is_correct: true },
          { option: '', is_correct: false },
          { option: '', is_correct: false },
          { option: '', is_correct: false },
        ],
        explanation: '',
      }
    ]);
    setFormError(null);
    setIsAddMaterialOpen(true);
  };

  // Open Add Topic Modal
  const handleOpenAddTopic = (courseName = '') => {
    setSelectedCourseForAction(courseName || (courses[0]?.name || ''));
    setNewTopicTitle('');
    setNewTopicDesc('');
    setTopicError(null);
    setIsAddTopicOpen(true);
  };

  // Handle adding another question in quiz form
  const handleAddQuizQuestion = () => {
    setQuizQuestions(prev => [
      ...prev,
      {
        question: '',
        question_type: 'Single Correct Answer',
        options: [
          { option: '', is_correct: true },
          { option: '', is_correct: false },
          { option: '', is_correct: false },
          { option: '', is_correct: false },
        ],
        explanation: '',
      }
    ]);
  };

  const handleRemoveQuizQuestion = (qIdx) => {
    if (quizQuestions.length <= 1) return;
    setQuizQuestions(prev => prev.filter((_, i) => i !== qIdx));
  };

  const handleQuestionChange = (qIdx, field, value) => {
    setQuizQuestions(prev => {
      const copy = [...prev];
      copy[qIdx] = { ...copy[qIdx], [field]: value };
      return copy;
    });
  };

  const handleOptionChange = (qIdx, optIdx, text) => {
    setQuizQuestions(prev => {
      const copy = [...prev];
      const opts = [...copy[qIdx].options];
      opts[optIdx] = { ...opts[optIdx], option: text };
      copy[qIdx].options = opts;
      return copy;
    });
  };

  const handleSetCorrectOption = (qIdx, optIdx) => {
    setQuizQuestions(prev => {
      const copy = [...prev];
      const opts = copy[qIdx].options.map((o, idx) => ({
        ...o,
        is_correct: idx === optIdx
      }));
      copy[qIdx].options = opts;
      return copy;
    });
  };

  // Submit Add Material
  const handleSubmitAddMaterial = async (e) => {
    e.preventDefault();
    if (!materialTitle.trim()) {
      setFormError('Please enter a title for the material.');
      return;
    }

    let finalTopic = selectedTopicForAction;
    if (!finalTopic) {
      setFormError('Please choose or enter a topic module for this content.');
      return;
    }

    setIsSubmitting(true);
    setFormError(null);

    let detailsPayload = {};
    if (materialType === 'Article') {
      if (!articleContent.trim()) {
        setFormError('Please provide content for the article.');
        setIsSubmitting(false);
        return;
      }
      detailsPayload = {
        author: articleAuthor.trim() || 'Instructor',
        content: `<div class="ql-editor read-mode"><p>${articleContent.replace(/\n\n/g, '</p><p>').replace(/\n/g, '<br/>')}</p></div>`,
      };
    } else if (materialType === 'Video') {
      if (!videoUrl.trim()) {
        setFormError('Please provide a valid Video URL.');
        setIsSubmitting(false);
        return;
      }
      detailsPayload = {
        provider: videoProvider,
        url: videoUrl.trim(),
        duration: videoDuration ? parseFloat(videoDuration) : 0,
        description: `<p>${videoDescription.trim() || materialTitle}</p>`,
      };
    } else if (materialType === 'Quiz') {
      for (let i = 0; i < quizQuestions.length; i++) {
        const q = quizQuestions[i];
        if (!q.question.trim()) {
          setFormError(`Question #${i + 1} prompt cannot be empty.`);
          setIsSubmitting(false);
          return;
        }
        const hasOptions = q.options.some(o => o.option.trim());
        if (!hasOptions) {
          setFormError(`Question #${i + 1} must have at least one valid option.`);
          setIsSubmitting(false);
          return;
        }
        const hasCorrect = q.options.some(o => o.is_correct && o.option.trim());
        if (!hasCorrect) {
          setFormError(`Question #${i + 1} must have a marked correct option with text.`);
          setIsSubmitting(false);
          return;
        }
      }

      detailsPayload = {
        passing_score: parseFloat(quizPassingScore) || 75,
        max_attempts: parseInt(quizMaxAttempts) || 2,
        duration: quizDuration ? parseFloat(quizDuration) : null,
        questions: quizQuestions.map(q => ({
          question: `<p>${q.question.trim()}</p>`,
          question_type: q.question_type || 'Single Correct Answer',
          options: q.options.filter(o => o.option.trim()).map(o => ({
            option: o.option.trim(),
            is_correct: o.is_correct,
            explanation: q.explanation || '',
          })),
        })),
      };
    }

    try {
      const res = await api.createTopicLearningMaterial(
        finalTopic,
        materialType,
        materialTitle.trim(),
        detailsPayload,
        selectedCourseForAction
      );

      if (res && res.success) {
        setIsAddMaterialOpen(false);
        setActionSuccessMsg(`Successfully created & added ${materialType} '${materialTitle}' to ${finalTopic}!`);
        setTimeout(() => setActionSuccessMsg(null), 4000);
        await fetchProgramCourses();
      } else {
        setFormError(res?.message || 'Failed to save material to topic.');
      }
    } catch (err) {
      console.error('Error creating material:', err);
      setFormError(err.message || 'Error occurred while saving to backend.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Submit Add Topic
  const handleSubmitAddTopic = async (e) => {
    e.preventDefault();
    if (!newTopicTitle.trim()) {
      setTopicError('Please enter a topic title.');
      return;
    }
    if (!selectedCourseForAction) {
      setTopicError('Please select a course for this topic.');
      return;
    }

    setIsTopicSubmitting(true);
    setTopicError(null);

    try {
      const res = await api.createCourseTopic(
        selectedCourseForAction,
        newTopicTitle.trim(),
        newTopicDesc.trim()
      );

      if (res && res.success) {
        setIsAddTopicOpen(false);
        setActionSuccessMsg(`Successfully added topic '${newTopicTitle}' to ${selectedCourseForAction}!`);
        setTimeout(() => setActionSuccessMsg(null), 4000);
        await fetchProgramCourses();
      } else {
        setTopicError(res?.message || 'Failed to create topic.');
      }
    } catch (err) {
      console.error('Error creating topic:', err);
      setTopicError(err.message || 'Error creating topic on server.');
    } finally {
      setIsTopicSubmitting(false);
    }
  };

  // =========================================================================
  // CREATE STANDARD / PROGRAM HANDLERS
  // =========================================================================
  const handleOpenCreateProgram = async () => {
    setNewProgramName('');
    setNewProgramAbbr('');
    setNewProgramDept('');
    setNewProgramSelectedCourses([]);
    setAutoCreateCoreCourses(false);
    setCreateProgramError(null);
    setCreateProgramSuccess(null);
    setIsCreateProgramOpen(true);
    try {
      const allCourses = await (api.getAllAvailableCourses ? api.getAllAvailableCourses() : Promise.resolve([]));
      const list = Array.isArray(allCourses) ? allCourses : (allCourses?.message || []);
      setAllAvailableCourses(list);
    } catch {
      // ignore
    }
  };

  const handleSubmitCreateProgram = async (e) => {
    e.preventDefault();
    if (!newProgramName.trim()) {
      setCreateProgramError('Please enter a Program / Standard name (e.g. Standard 8).');
      return;
    }
    setCreateProgramSubmitting(true);
    setCreateProgramError(null);
    try {
      const progName = newProgramName.trim();
      let coursesToAttach = [...newProgramSelectedCourses];

      // Auto-create standard-specific courses if requested
      if (autoCreateCoreCourses) {
        const coreNames = ['English', 'Mathematics', 'Science'];
        for (const core of coreNames) {
          const specificCourseName = `${core} - ${progName}`;
          try {
            await api.createCourse({
              course_name: specificCourseName,
              program: progName,
            });
            coursesToAttach.push(specificCourseName);
          } catch (createErr) {
            console.warn(`Note creating ${specificCourseName}:`, createErr);
          }
        }
      }

      const res = await api.createProgram({
        program_name: progName,
        program_abbreviation: newProgramAbbr.trim() || undefined,
        department: newProgramDept.trim() || undefined,
        courses: coursesToAttach.length > 0 ? coursesToAttach : undefined,
        create_default_section: true,
      });

      const createdName = res?.program?.name || progName;
      setCreateProgramSuccess(`Standard / Program "${createdName}" created successfully! Section A also initialized.`);
      setAllProgramsList(prev => Array.from(new Set([...prev, createdName])));
      setSelectedProgram(createdName);
      fetchProgramCourses(createdName);

      setTimeout(() => {
        setIsCreateProgramOpen(false);
        setCreateProgramSuccess(null);
      }, 1500);
    } catch (err) {
      console.error('Failed to create program:', err);
      setCreateProgramError(err.message || 'Failed to create academic program.');
    } finally {
      setCreateProgramSubmitting(false);
    }
  };

  // =========================================================================
  // MANAGE PROGRAM COURSES HANDLERS
  // =========================================================================
  const handleOpenManageProgramCourses = async () => {
    setIsManageProgramCoursesOpen(true);
    setManageCoursesLoading(true);
    setManageCoursesMsg(null);
    try {
      const [progCourses, allCourses] = await Promise.all([
        api.getProgramCourses ? api.getProgramCourses(selectedProgram) : Promise.resolve([]),
        api.getAllAvailableCourses ? api.getAllAvailableCourses() : Promise.resolve([]),
      ]);
      const pCourses = Array.isArray(progCourses) ? progCourses : (progCourses?.message || []);
      const aCourses = Array.isArray(allCourses) ? allCourses : (allCourses?.message || []);
      setProgramLinkedCourses(pCourses);
      setAllAvailableCourses(aCourses);

      const unlinked = aCourses.filter(ac => !pCourses.some(pc => (pc.name || pc.course) === (ac.name || ac.course)));
      setSelectedCourseToAssign(unlinked.length > 0 ? (unlinked[0].name || unlinked[0].course) : '');
    } catch (err) {
      console.error('Failed to load program courses:', err);
      setManageCoursesMsg({ type: 'error', text: 'Failed to load courses for this standard.' });
    } finally {
      setManageCoursesLoading(false);
    }
  };

  const handleAssignCourseToProgram = async () => {
    if (!selectedCourseToAssign) return;
    setManageCoursesLoading(true);
    setManageCoursesMsg(null);
    try {
      await api.assignCourseToProgram({
        program_name: selectedProgram,
        course: selectedCourseToAssign,
      });
      setManageCoursesMsg({ type: 'success', text: `Course "${selectedCourseToAssign}" assigned to ${selectedProgram} successfully!` });
      // Refresh list
      const progCourses = await api.getProgramCourses(selectedProgram);
      const pCourses = Array.isArray(progCourses) ? progCourses : (progCourses?.message || []);
      setProgramLinkedCourses(pCourses);

      const unlinked = allAvailableCourses.filter(ac => !pCourses.some(pc => (pc.name || pc.course) === (ac.name || ac.course)));
      setSelectedCourseToAssign(unlinked.length > 0 ? (unlinked[0].name || unlinked[0].course) : '');

      fetchProgramCourses(selectedProgram);
      setTimeout(() => setManageCoursesMsg(null), 3000);
    } catch (err) {
      console.error('Failed to assign course to program:', err);
      setManageCoursesMsg({ type: 'error', text: err.message || 'Failed to assign course.' });
    } finally {
      setManageCoursesLoading(false);
    }
  };

  const handleRemoveCourseFromProgram = async (courseName) => {
    if (!window.confirm(`Are you sure you want to remove "${courseName}" from ${selectedProgram}?`)) return;
    setManageCoursesLoading(true);
    setManageCoursesMsg(null);
    try {
      await api.removeCourseFromProgram({
        program_name: selectedProgram,
        course: courseName,
      });
      setManageCoursesMsg({ type: 'success', text: `Course "${courseName}" removed from ${selectedProgram}.` });
      // Refresh list
      const progCourses = await api.getProgramCourses(selectedProgram);
      const pCourses = Array.isArray(progCourses) ? progCourses : (progCourses?.message || []);
      setProgramLinkedCourses(pCourses);

      const unlinked = allAvailableCourses.filter(ac => !pCourses.some(pc => (pc.name || pc.course) === (ac.name || ac.course)));
      setSelectedCourseToAssign(unlinked.length > 0 ? (unlinked[0].name || unlinked[0].course) : '');

      fetchProgramCourses(selectedProgram);
      setTimeout(() => setManageCoursesMsg(null), 3000);
    } catch (err) {
      console.error('Failed to remove course from program:', err);
      setManageCoursesMsg({ type: 'error', text: err.message || 'Failed to remove course.' });
    } finally {
      setManageCoursesLoading(false);
    }
  };

  const handleInitiateDeleteCourse = (course) => {
    setCourseToDelete({
      name: course.name,
      courseTitle: course.courseName || course.name,
      program: selectedProgram,
    });
    setAlsoDeleteCompletely(false);
    setDeleteCourseError(null);
  };

  const handleConfirmDeleteCourse = async () => {
    if (!courseToDelete) return;
    setDeleteCourseSubmitting(true);
    setDeleteCourseError(null);
    try {
      if (alsoDeleteCompletely) {
        await api.deleteCourse(courseToDelete.name);
        setActionSuccessMsg(`Course "${courseToDelete.courseTitle}" permanently deleted from system.`);
      } else {
        await api.removeCourseFromProgram({
          program_name: courseToDelete.program || selectedProgram,
          course: courseToDelete.name,
        });
        setActionSuccessMsg(`Course "${courseToDelete.courseTitle}" removed from ${courseToDelete.program || selectedProgram}.`);
      }
      setTimeout(() => setActionSuccessMsg(null), 4000);
      setCourseToDelete(null);
      setAlsoDeleteCompletely(false);
      // Immediately filter out locally and re-fetch
      setCourses(prev => prev.filter(c => c.name !== courseToDelete.name));
      fetchProgramCourses(courseToDelete.program || selectedProgram);
    } catch (err) {
      console.error('Failed to remove course:', err);
      setDeleteCourseError(err.message || 'Failed to remove course.');
    } finally {
      setDeleteCourseSubmitting(false);
    }
  };

  // =========================================================================
  // CREATE COURSE HANDLERS
  // =========================================================================
  const handleOpenCreateCourse = () => {
    setNewCourseName('');
    setNewCourseProgram(selectedProgram || availableProgramsList[0] || '');
    setNewCourseDept('');
    setNewCourseGradingScale('');
    setNewCourseDesc('');
    setCreateCourseError(null);
    setCreateCourseSuccess(null);
    setIsCreateCourseOpen(true);
  };

  const handleSubmitCreateCourse = async (e) => {
    e.preventDefault();
    if (!newCourseName.trim()) {
      setCreateCourseError('Please enter a course title (e.g. Social Studies, Computer Science).');
      return;
    }
    setCreateCourseSubmitting(true);
    setCreateCourseError(null);
    try {
      const targetProg = newCourseProgram || selectedProgram;
      const res = await api.createCourse({
        course_name: newCourseName.trim(),
        program: targetProg,
        department: newCourseDept.trim() || undefined,
        default_grading_scale: newCourseGradingScale.trim() || undefined,
        description: newCourseDesc.trim() || undefined,
      });

      const courseName = res?.course?.name || newCourseName.trim();
      setCreateCourseSuccess(`Course "${courseName}" created and added to ${targetProg}!`);
      fetchProgramCourses(targetProg);

      setTimeout(() => {
        setIsCreateCourseOpen(false);
        setCreateCourseSuccess(null);
      }, 1500);
    } catch (err) {
      console.error('Failed to create course:', err);
      setCreateCourseError(err.message || 'Failed to create course.');
    } finally {
      setCreateCourseSubmitting(false);
    }
  };

  // =========================================================================
  // QUICK SCHEDULE LECTURE HANDLERS
  // =========================================================================
  const handleOpenQuickSchedule = async (courseItem) => {
    const courseName = typeof courseItem === 'object' ? courseItem.name : courseItem;
    setScheduleTargetCourse(courseItem);
    setQuickScheduleError(null);
    setQuickScheduleSuccess(null);

    try {
      const meta = await api.getScheduleMetadata();
      if (meta) {
        setScheduleMeta(meta);
        const matchingGroup = (meta.student_groups || []).find(g => g.program === selectedProgram && g.course === courseName)
          || (meta.student_groups || []).find(g => g.program === selectedProgram)
          || meta.student_groups?.[0];

        // Instructor field is a Link to Instructor -> use the record ID, never a display name
        const courseFaculty = meta.course_instructors?.[courseName] || [];
        const defaultInstructor = instructorInfo?.name || meta.current_instructor || courseFaculty[0]?.name || meta.instructors?.[0]?.name || '';

        setScheduleFormData({
          course: courseName,
          student_group: matchingGroup?.name || '',
          instructor: defaultInstructor,
          schedule_date: todayISO(),
          from_time: '09:00:00',
          to_time: '10:00:00',
          room: matchingGroup?.default_room || meta.rooms?.[0]?.name || '',
        });
      }
    } catch (err) {
      console.error('Failed to load schedule metadata:', err);
      setQuickScheduleError(err.message || 'Failed to load scheduling options.');
    }

    setIsQuickScheduleOpen(true);
  };

  const handleSubmitQuickSchedule = async (e) => {
    e.preventDefault();
    if (!scheduleFormData.course || !scheduleFormData.student_group || !scheduleFormData.instructor || !scheduleFormData.schedule_date) {
      setQuickScheduleError('Please complete all required schedule fields.');
      return;
    }
    setQuickScheduleSubmitting(true);
    setQuickScheduleError(null);
    try {
      await api.createCourseSchedule(scheduleFormData);
      setQuickScheduleSuccess(`Lecture successfully scheduled for ${scheduleFormData.course} on ${scheduleFormData.schedule_date}!`);
      setTimeout(() => {
        setIsQuickScheduleOpen(false);
        setQuickScheduleSuccess(null);
      }, 1500);
    } catch (err) {
      console.error('Failed to schedule lecture:', err);
      setQuickScheduleError(err.message || 'Failed to schedule lecture.');
    } finally {
      setQuickScheduleSubmitting(false);
    }
  };

  // =========================================================================
  // CREATE ACADEMIC YEAR HANDLERS
  // =========================================================================
  // Builds an April-March academic year starting in the given calendar year
  const buildYearPreset = (startYear) => ({
    academic_year_name: `${startYear}-${startYear + 1}`,
    year_start_date: `${startYear}-04-01`,
    year_end_date: `${startYear + 1}-03-31`,
  });

  const handleOpenCreateYear = async () => {
    // Suggest the year following the latest Academic Year on record (or the current year)
    let baseYear = new Date().getFullYear();
    try {
      const years = await api.getAcademicYears();
      const ends = (Array.isArray(years) ? years : [])
        .map((y) => (y.year_end_date ? new Date(y.year_end_date).getFullYear() : null))
        .filter(Boolean);
      if (ends.length) baseYear = Math.max(...ends);
    } catch (err) {
      console.error('Failed to load academic years:', err);
    }
    setYearPresetBase(baseYear);
    setNewYearData(buildYearPreset(baseYear));
    setCreateYearError(null);
    setCreateYearSuccess(null);
    setIsCreateYearOpen(true);
  };

  const handleYearStartDateChange = (startDateStr) => {
    if (!startDateStr) {
      setNewYearData((prev) => ({ ...prev, year_start_date: startDateStr }));
      return;
    }
    const d = new Date(startDateStr);
    const startYear = d.getFullYear();
    const endYear = startYear + 1;
    setNewYearData({
      academic_year_name: `${startYear}-${endYear}`,
      year_start_date: startDateStr,
      year_end_date: `${endYear}-03-31`,
    });
  };

  const handleSubmitCreateYear = async (e) => {
    e.preventDefault();
    if (!newYearData.academic_year_name || !newYearData.year_start_date || !newYearData.year_end_date) {
      setCreateYearError('Please provide Academic Year Name, Start Date, and End Date.');
      return;
    }
    if (newYearData.year_start_date > newYearData.year_end_date) {
      setCreateYearError('Year End Date cannot be earlier than Year Start Date.');
      return;
    }
    setCreateYearSubmitting(true);
    setCreateYearError(null);
    try {
      const res = await api.createAcademicYear(newYearData);
      const createdName = res?.academic_year_name || newYearData.academic_year_name;
      setCreateYearSuccess(`Academic Year "${createdName}" successfully created!`);
      setTimeout(() => {
        setIsCreateYearOpen(false);
        setCreateYearSuccess(null);
      }, 1500);
    } catch (err) {
      console.error('Failed to create academic year:', err);
      setCreateYearError(err.message || 'Failed to create academic year.');
    } finally {
      setCreateYearSubmitting(false);
    }
  };

  // =========================================================================
  // CREATE ACADEMIC TERM HANDLERS
  // =========================================================================
  const handleOpenCreateTerm = async () => {
    try {
      const years = await api.getAcademicYears().catch(() => []);
      const yearList = Array.isArray(years) ? years : [];
      setAvailableAcademicYears(yearList);
      
      const defaultYear = yearList[0]?.name || '';
      const yearObj = yearList.find((y) => y.name === defaultYear);
      let defaultStart = yearObj?.year_start_date || '';
      let defaultEnd = '';
      if (yearObj?.year_start_date) {
        const startD = new Date(yearObj.year_start_date);
        const midD = new Date(startD);
        midD.setMonth(midD.getMonth() + 6);
        midD.setDate(0);
        defaultEnd = midD.toISOString().split('T')[0];
      }

      setNewTermData({
        academic_year: defaultYear,
        term_name: 'Term 1',
        term_start_date: defaultStart,
        term_end_date: defaultEnd,
      });
      setCreateTermError(null);
      setCreateTermSuccess(null);
      setIsCreateTermOpen(true);
    } catch (err) {
      console.error('Failed to prepare academic term creation:', err);
    }
  };

  const handleTermYearSelect = (yearName) => {
    const yearObj = availableAcademicYears.find((y) => y.name === yearName);
    let start = yearObj?.year_start_date || '';
    let end = '';
    if (start) {
      const startD = new Date(start);
      const midD = new Date(startD);
      midD.setMonth(midD.getMonth() + 6);
      midD.setDate(0);
      end = midD.toISOString().split('T')[0];
    }
    setNewTermData((prev) => ({
      ...prev,
      academic_year: yearName,
      term_start_date: start,
      term_end_date: end,
    }));
  };

  const applyTermPreset = (termName) => {
    const yearObj = availableAcademicYears.find((y) => y.name === newTermData.academic_year);
    let start = newTermData.term_start_date;
    let end = newTermData.term_end_date;

    if (yearObj?.year_start_date && yearObj?.year_end_date) {
      const yearStart = new Date(yearObj.year_start_date);
      if (termName === 'Term 1' || termName === 'Semester 1') {
        start = yearObj.year_start_date;
        const mid = new Date(yearStart);
        mid.setMonth(mid.getMonth() + 6);
        mid.setDate(0);
        end = mid.toISOString().split('T')[0];
      } else if (termName === 'Term 2' || termName === 'Semester 2') {
        const mid = new Date(yearStart);
        mid.setMonth(mid.getMonth() + 6);
        mid.setDate(1);
        start = mid.toISOString().split('T')[0];
        end = yearObj.year_end_date;
      }
    }

    setNewTermData((prev) => ({
      ...prev,
      term_name: termName,
      term_start_date: start,
      term_end_date: end,
    }));
  };

  const handleSubmitCreateTerm = async (e) => {
    e.preventDefault();
    if (!newTermData.academic_year || !newTermData.term_name || !newTermData.term_start_date || !newTermData.term_end_date) {
      setCreateTermError('Please fill all required fields (Academic Year, Term Name, Start Date, End Date).');
      return;
    }
    if (newTermData.term_start_date > newTermData.term_end_date) {
      setCreateTermError('Term End Date cannot be earlier than Term Start Date.');
      return;
    }

    const yearObj = availableAcademicYears.find((y) => y.name === newTermData.academic_year);
    if (yearObj) {
      if (yearObj.year_start_date && newTermData.term_start_date < yearObj.year_start_date) {
        setCreateTermError(`Term Start Date cannot be earlier than Academic Year start (${yearObj.year_start_date}).`);
        return;
      }
      if (yearObj.year_end_date && newTermData.term_end_date > yearObj.year_end_date) {
        setCreateTermError(`Term End Date cannot be later than Academic Year end (${yearObj.year_end_date}).`);
        return;
      }
    }

    setCreateTermSubmitting(true);
    setCreateTermError(null);
    try {
      const res = await api.createAcademicTerm(newTermData);
      const createdName = res?.name || `${newTermData.academic_year} (${newTermData.term_name})`;
      setCreateTermSuccess(`Academic Term "${createdName}" successfully created!`);
      setTimeout(() => {
        setIsCreateTermOpen(false);
        setCreateTermSuccess(null);
      }, 1500);
    } catch (err) {
      console.error('Failed to create academic term:', err);
      setCreateTermError(err.message || 'Failed to create academic term.');
    } finally {
      setCreateTermSubmitting(false);
    }
  };

  // Filter student submissions
  const filteredSubmissions = (quizSubmissionsData.submissions || []).filter(sub => {
    if (!submissionSearch.trim()) return true;
    const q = submissionSearch.toLowerCase();
    return (
      (sub.student_name && sub.student_name.toLowerCase().includes(q)) ||
      (sub.student && sub.student.toLowerCase().includes(q)) ||
      (sub.student_email && sub.student_email.toLowerCase().includes(q)) ||
      (sub.program && sub.program.toLowerCase().includes(q))
    );
  });

  // Filter courses and topics by search query
  const filteredCourses = useMemo(() => {
    if (!courseSearch.trim()) return courses;
    const q = courseSearch.toLowerCase().trim();
    return courses.filter(c => {
      const matchCourse = (c.courseName || '').toLowerCase().includes(q) || (c.name || '').toLowerCase().includes(q) || (c.department || '').toLowerCase().includes(q);
      const matchTopic = (c.topics || []).some(t => 
        (t.title || '').toLowerCase().includes(q) || 
        (t.description || '').toLowerCase().includes(q) ||
        (t.contents || []).some(cnt => (cnt.title || '').toLowerCase().includes(q))
      );
      return matchCourse || matchTopic;
    });
  }, [courses, courseSearch]);

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
                onClick={() => {
                  selectStudent(w.student);
                  if (w.program) setSelectedProgram(w.program);
                }}
                className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition flex items-center gap-1.5 shrink-0 ${
                  isSelected
                    ? 'bg-brand-600 text-white shadow-xs'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                <span>{w.student_name}</span>
                <span className="text-[11px] opacity-75">({w.relation || 'Ward'})</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Top Header & Quick Actions
          Row 1: title | class switcher + search (wraps). Row 2: staff actions (always wraps).
          Rows are sized by the content area, not the viewport, so they never overflow
          when the sidebar takes space or the browser is zoomed. */}
      <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
        <div className="min-w-0 flex-1 basis-[260px]">
          <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
            <h2 className="text-lg sm:text-xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight break-words">
              Curriculum & Learning Syllabus
            </h2>
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-brand-50 text-brand-700 dark:bg-brand-950/80 dark:text-brand-300 border border-brand-200/60 dark:border-brand-800">
              {filteredCourses.length} Courses
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 break-words">
            Active courses, interactive modules, and topic materials for <span className="font-semibold text-slate-700 dark:text-slate-300">{selectedProgram || activeProgram || 'Current Academic Session'}</span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
          {/* Program Switcher Dropdown */}
          <div className="relative flex-1 min-w-[150px] sm:flex-none">
            <select
              value={selectedProgram}
              onChange={(e) => setSelectedProgram(e.target.value)}
              className="appearance-none bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-700/80 rounded-xl pl-3.5 pr-8 py-2 text-xs font-semibold text-slate-800 dark:text-slate-100 hover:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30 shadow-xs cursor-pointer transition w-full sm:w-auto min-w-[150px]"
            >
              {availableProgramsList.map((prog) => (
                <option key={prog} value={prog}>
                  {prog}
                </option>
              ))}
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          {/* Search courses / topics */}
          <div className="relative flex-1 min-w-[180px] sm:flex-none sm:min-w-[200px]">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search syllabus..."
              value={courseSearch}
              onChange={(e) => setCourseSearch(e.target.value)}
              className="w-full bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-700/80 rounded-xl pl-8 pr-3 py-2 sm:py-1.5 text-xs text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500/30 shadow-xs"
            />
            {courseSearch && (
              <button
                onClick={() => setCourseSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

        </div>
      </div>

          {/* Staff / Teacher Action Buttons (own row, wraps at any width) */}
          {isStaff && (
            <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2 w-full">
              <button
                onClick={handleOpenCreateProgram}
                className="px-3 py-1.5 rounded-xl border border-indigo-200 dark:border-indigo-800 bg-indigo-50/50 dark:bg-indigo-950/40 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 text-xs font-bold text-indigo-700 dark:text-indigo-300 transition-all flex items-center justify-center gap-1.5 shadow-xs"
                title="Create a new academic Standard or Grade (e.g. Standard 7)"
              >
                <GraduationCap className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                <span>+ Standard</span>
              </button>

              <button
                onClick={handleOpenManageProgramCourses}
                className="px-3 py-1.5 rounded-xl border border-violet-200 dark:border-violet-800 bg-violet-50/50 dark:bg-violet-950/40 hover:bg-violet-100 dark:hover:bg-violet-900/50 text-xs font-bold text-violet-700 dark:text-violet-300 transition-all flex items-center justify-center gap-1.5 shadow-xs"
                title={`Manage courses assigned to ${selectedProgram || 'Standard'}`}
              >
                <Settings2 className="w-3.5 h-3.5 text-violet-600 dark:text-violet-400" />
                <span>Manage Standard Courses</span>
              </button>

              <button
                onClick={handleOpenCreateYear}
                className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-300 transition-all flex items-center justify-center gap-1.5 shadow-xs"
                title="Define and create a new academic year period"
              >
                <Calendar className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                <span>+ Academic Year</span>
              </button>

              <button
                onClick={handleOpenCreateTerm}
                className="px-3 py-1.5 rounded-xl border border-sky-200 dark:border-sky-800 bg-sky-50/50 dark:bg-sky-950/40 hover:bg-sky-100 dark:hover:bg-sky-900/50 text-xs font-bold text-sky-700 dark:text-sky-300 transition-all flex items-center justify-center gap-1.5 shadow-xs"
                title="Define and create a new academic term period"
              >
                <Clock className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
                <span>+ Academic Term</span>
              </button>

              <button
                onClick={handleOpenCreateCourse}
                className="px-3 py-1.5 rounded-xl border border-brand-200 dark:border-brand-800 bg-brand-50/50 dark:bg-brand-950/40 hover:bg-brand-100 dark:hover:bg-brand-900/50 text-xs font-bold text-brand-700 dark:text-brand-300 transition-all flex items-center justify-center gap-1.5 shadow-xs"
                title="Create a new course / subject for this curriculum"
              >
                <BookOpen className="w-3.5 h-3.5 text-brand-600 dark:text-brand-400" />
                <span>+ Course</span>
              </button>

              <button
                onClick={() => handleOpenAddTopic(filteredCourses[0]?.name || courses[0]?.name || '')}
                className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-300 transition-all flex items-center justify-center gap-1.5 shadow-xs"
              >
                <Layers className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                <span>+ Topic</span>
              </button>

              <button
                onClick={() => handleOpenAddMaterial(filteredCourses[0]?.name || courses[0]?.name || '', filteredCourses[0]?.topics?.[0]?.name || courses[0]?.topics?.[0]?.name || '')}
                className="px-3.5 py-2 sm:py-1.5 rounded-xl bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-700 hover:to-indigo-700 text-white text-xs font-bold transition-all shadow-md shadow-brand-500/20 flex items-center justify-center gap-1.5 active:scale-95"
              >
                <Plus className="w-4 h-4" />
                <span>+ Material</span>
              </button>
            </div>
          )}
      </div>

      {/* Success Notification Banner */}
      {actionSuccessMsg && (
        <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/80 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs font-semibold flex items-center justify-between gap-3 shadow-xs animate-in fade-in duration-200">
          <div className="flex items-center gap-2 min-w-0">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span className="break-words min-w-0">{actionSuccessMsg}</span>
          </div>
          <button onClick={() => setActionSuccessMsg(null)} className="p-1.5 -m-1.5 shrink-0 text-emerald-600 hover:text-emerald-800">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Main Course List */}
      {loading ? (
        <div className="p-16 text-center text-slate-400 text-sm">
          <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          Loading course syllabus from backend...
        </div>
      ) : loadError ? (
        <div className="glass-panel rounded-3xl p-12 text-center border border-rose-200/80 dark:border-rose-900/60">
          <div className="w-14 h-14 rounded-2xl bg-rose-50 dark:bg-rose-950/60 text-rose-500 flex items-center justify-center mx-auto mb-3">
            <AlertCircle className="w-7 h-7" />
          </div>
          <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">Could not load courses</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">{loadError}</p>
          <button
            onClick={() => fetchProgramCourses(selectedProgram)}
            className="mt-4 px-4 py-2.5 sm:py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold transition"
          >
            Retry
          </button>
        </div>
      ) : !selectedProgram && !activeProgram ? (
        <div className="glass-panel rounded-3xl p-12 text-center border border-slate-200/80 dark:border-slate-800">
          <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 flex items-center justify-center mx-auto mb-3">
            <GraduationCap className="w-7 h-7" />
          </div>
          <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">No program enrollment found</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-xs mx-auto">
            {isStaff ? 'No programs have been created yet. Use "+ Standard" to create one.' : 'You are not enrolled in any program yet, so there is no syllabus to show.'}
          </p>
        </div>
      ) : filteredCourses.length === 0 ? (
        <div className="glass-panel rounded-3xl p-12 text-center border border-slate-200/80 dark:border-slate-800">
          <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 flex items-center justify-center mx-auto mb-3">
            <BookOpen className="w-7 h-7" />
          </div>
          <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">No courses listed</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-xs mx-auto">
            {courseSearch ? 'No courses match your search criteria.' : `No courses are linked to ${selectedProgram || activeProgram || 'this program'}.`}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredCourses.map((course, idx) => {
            const isExpanded = expandedIndex === idx;

            return (
              <div 
                key={course.name}
                className="glass-panel rounded-3xl border border-slate-200/80 dark:border-slate-800 overflow-hidden transition-all duration-200 shadow-xs"
              >
                {/* Course Header Bar */}
                <div 
                  onClick={() => setExpandedIndex(isExpanded ? -1 : idx)}
                  className="p-5 sm:p-6 cursor-pointer flex flex-wrap items-center justify-between gap-4 hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition"
                >
                  <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1 basis-[240px]">
                    <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-brand-50 dark:bg-brand-950/80 text-brand-600 dark:text-brand-400 flex items-center justify-center shrink-0">
                      <BookOpen className="w-5 h-5 sm:w-6 sm:h-6" />
                    </div>

                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 break-words min-w-0">
                          {course.courseName}
                        </h3>
                        {course.name !== course.courseName && (
                          <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-[11px] font-mono font-semibold break-all">
                            {course.name}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 break-words">
                        {course.department && (
                          <>Department: <span className="font-semibold text-slate-700 dark:text-slate-300">{course.department}</span> • </>
                        )}
                        {course.topicsCount} Registered Topic{course.topicsCount === 1 ? '' : 's'}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-start sm:justify-end gap-2 sm:gap-3 max-w-full">
                    <span className="text-xs font-semibold text-brand-600 dark:text-brand-400 bg-brand-50 dark:bg-brand-950/80 px-3 py-1 rounded-xl">
                      {course.topicsCount > 0 ? `${course.topicsCount} Topics` : 'Active Subject'}
                    </span>

                    {/* Teacher Quick Actions on course header */}
                    {isStaff && (
                      <div className="flex flex-wrap items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => handleOpenQuickSchedule(course)}
                          className="px-2.5 py-2 sm:py-1 text-[11px] font-bold text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/80 rounded-lg transition flex items-center gap-1 border border-indigo-200/50 dark:border-indigo-800/50 shadow-2xs"
                          title="Schedule a lecture for this course in timetable"
                        >
                          <Calendar className="w-3 h-3" />
                          <span>Schedule Lecture</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleOpenAddMaterial(course.name, course.topics?.[0]?.name || '')}
                          className="px-2.5 py-2 sm:py-1 text-[11px] font-bold text-brand-600 hover:text-brand-700 dark:text-brand-400 hover:bg-brand-50 dark:hover:bg-brand-950/80 rounded-lg transition"
                        >
                          + Add Material
                        </button>

                        <button
                          type="button"
                          onClick={() => handleInitiateDeleteCourse(course)}
                          className="px-2.5 py-2 sm:py-1 text-[11px] font-bold text-rose-600 hover:text-rose-700 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/80 rounded-lg transition flex items-center gap-1 border border-rose-200/50 dark:border-rose-800/50 shadow-2xs"
                          title={`Delete / Remove ${course.courseName || course.name} from ${selectedProgram}`}
                        >
                          <Trash2 className="w-3 h-3 text-rose-500" />
                          <span>Delete</span>
                        </button>
                      </div>
                    )}

                    <div className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 flex items-center justify-center shrink-0">
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </div>
                  </div>
                </div>

                {/* Collapsible Topic List */}
                {isExpanded && (
                  <div className="border-t border-slate-100 dark:border-slate-800/80 bg-slate-50/40 dark:bg-slate-900/40 p-5 sm:p-6 space-y-4 animate-in fade-in duration-200">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                        Topic Modules & Learning Materials
                      </h4>
                      <div className="flex items-center gap-3">
                        <span className="text-[11px] text-slate-400">
                          {course.topics.length} Module{course.topics.length === 1 ? '' : 's'}
                        </span>
                        {isStaff && (
                          <button
                            type="button"
                            onClick={() => handleOpenAddTopic(course.name)}
                            className="text-[11px] font-bold text-brand-600 hover:underline dark:text-brand-400 flex items-center gap-1"
                          >
                            <Plus className="w-3 h-3" /> Add Topic
                          </button>
                        )}
                      </div>
                    </div>

                    {course.topics.length === 0 ? (
                      <div className="p-8 rounded-2xl bg-white dark:bg-slate-800/80 border border-dashed border-slate-200 dark:border-slate-700 text-center space-y-2">
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          No specific syllabus topics have been registered yet for this subject.
                        </p>
                        {isStaff && (
                          <button
                            type="button"
                            onClick={() => handleOpenAddTopic(course.name)}
                            className="mt-2 inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-brand-50 dark:bg-brand-950/80 text-brand-600 dark:text-brand-400 text-xs font-bold hover:bg-brand-100 transition"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            Create First Topic Module
                          </button>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {course.topics.map((tItem, tIdx) => (
                          <div 
                            key={tIdx}
                            className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-800/90 border border-slate-200/70 dark:border-slate-700/60 space-y-3.5 shadow-xs"
                          >
                            {/* Topic Title Bar */}
                            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2 sm:gap-3">
                              <div className="min-w-0">
                                <h5 className="text-sm font-bold text-slate-900 dark:text-slate-100 break-words">
                                  {tItem.title}
                                </h5>
                                {tItem.description && (
                                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 break-words">
                                    {tItem.description}
                                  </p>
                                )}
                              </div>
                              <div className="flex flex-wrap items-center gap-2 shrink-0">
                                <span className="px-2 py-0.5 rounded-full text-[11px] font-bold uppercase bg-emerald-50 text-emerald-700 dark:bg-emerald-950/80 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                                  Active Topic
                                </span>
                                {isStaff && (
                                  <button
                                    type="button"
                                    onClick={() => handleOpenAddMaterial(course.name, tItem.name)}
                                    className="px-2.5 py-2 sm:py-1 rounded-lg bg-slate-100 hover:bg-brand-50 dark:bg-slate-700 dark:hover:bg-brand-950/80 text-[11px] font-bold text-slate-600 hover:text-brand-600 dark:text-slate-300 dark:hover:text-brand-400 transition flex items-center gap-1"
                                    title="Add content to this topic"
                                  >
                                    <Plus className="w-3 h-3" />
                                    <span>Add Content</span>
                                  </button>
                                )}
                              </div>
                            </div>

                            {/* Topic Contents (Articles, Videos, Quizzes) */}
                            {tItem.contents.length > 0 ? (
                              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 pt-1 border-t border-slate-100 dark:border-slate-700/60">
                                {tItem.contents.map((c, cIdx) => (
                                  <div 
                                    key={cIdx}
                                    onClick={() => handleOpenContent(c, course.name)}
                                    role="button"
                                    tabIndex={0}
                                    className="p-3 rounded-2xl bg-slate-50/80 hover:bg-white dark:bg-slate-700/40 dark:hover:bg-slate-700/90 border border-slate-200/70 hover:border-brand-500/50 dark:border-slate-600/50 transition-all cursor-pointer flex items-center gap-3 group shadow-2xs hover:shadow-md"
                                  >
                                    {/* Icon badge */}
                                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-105 ${
                                      c.type === 'video' ? 'bg-indigo-100 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-400' :
                                      c.type === 'quiz' ? 'bg-amber-100 text-amber-600 dark:bg-amber-950 dark:text-amber-400' :
                                      'bg-emerald-100 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400'
                                    }`}>
                                      {c.type === 'video' ? <Video className="w-4 h-4" /> :
                                       c.type === 'quiz' ? <HelpCircle className="w-4 h-4" /> :
                                       <FileText className="w-4 h-4" />}
                                    </div>

                                    {/* Text info */}
                                    <div className="min-w-0 flex-1">
                                      <p className="font-semibold text-xs text-slate-800 dark:text-slate-100 truncate group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors">
                                        {c.label || c.title}
                                      </p>
                                      <div className="flex flex-wrap items-center gap-x-1.5 mt-0.5">
                                        <span className="text-[11px] capitalize font-medium text-slate-400 dark:text-slate-400">
                                          {c.type}
                                        </span>
                                        <span className="text-[11px] text-slate-300 dark:text-slate-600">•</span>
                                        <span className="text-[11px] text-brand-600 dark:text-brand-400 font-bold group-hover:underline">
                                          {c.type === 'video' ? 'Watch Video' : 
                                           c.type === 'quiz' ? (isStaff ? 'Marks & Preview' : 'Take Assessment') : 
                                           'Read Article'}
                                        </span>
                                      </div>
                                    </div>

                                    {/* Interactive Arrow Indicator */}
                                    <div className="w-6 h-6 rounded-lg flex items-center justify-center text-slate-300 dark:text-slate-600 group-hover:text-brand-500 group-hover:translate-x-0.5 transition-all shrink-0">
                                      <ArrowRight className="w-3.5 h-3.5" />
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div className="p-4 rounded-xl bg-slate-50/50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-700/50 text-xs text-slate-400 text-center flex flex-col sm:flex-row items-center justify-between gap-2">
                                <span>No materials added to this topic yet.</span>
                                {isStaff && (
                                  <button
                                    onClick={() => handleOpenAddMaterial(course.name, tItem.name)}
                                    className="text-[11px] font-bold text-brand-600 dark:text-brand-400 hover:underline"
                                  >
                                    + Add Article / Video / Quiz
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 1. ARTICLE READER MODAL                                                   */}
      {/* ========================================================================= */}
      {viewingContent && viewingContent.type === 'article' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto animate-fade-in">
          <div className="glass-panel w-full max-w-3xl max-h-[92vh] rounded-3xl border border-slate-200 dark:border-slate-700 shadow-2xl flex flex-col my-auto overflow-hidden bg-white dark:bg-slate-900">
            {/* Header */}
            <div className="p-5 sm:p-6 border-b border-slate-100 dark:border-slate-800 flex items-start justify-between gap-4">
              <div className="space-y-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 flex items-center gap-1">
                    <FileText className="w-3 h-3" />
                    Learning Article
                  </span>
                  {viewingContent.details?.publish_date && (
                    <span className="text-[11px] text-slate-400 flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {viewingContent.details.publish_date}
                    </span>
                  )}
                </div>
                <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100 break-words">
                  {viewingContent.details?.title || viewingContent.title}
                </h3>
                {viewingContent.details?.author && (
                  <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5" />
                    <span>Authored by <strong className="text-slate-700 dark:text-slate-300">{viewingContent.details.author}</strong></span>
                  </p>
                )}
              </div>
              <button 
                onClick={handleCloseViewer}
                className="w-9 h-9 sm:w-8 sm:h-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 flex items-center justify-center shrink-0 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="p-4 sm:p-8 overflow-y-auto space-y-4 flex-1">
              {viewingContent.loading ? (
                <div className="py-16 text-center text-slate-400 text-sm">
                  <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                  Loading article text...
                </div>
              ) : viewingContent.error ? (
                <div className="p-6 rounded-2xl bg-rose-50 text-rose-700 dark:bg-rose-950/80 dark:text-rose-300 text-xs text-center">
                  {viewingContent.error}
                </div>
              ) : (
                <div 
                  className="learning-content-body prose dark:prose-invert max-w-none text-slate-800 dark:text-slate-200 break-words [&_img]:max-w-full [&_img]:h-auto [&_pre]:overflow-x-auto [&_table]:block [&_table]:overflow-x-auto [&_iframe]:max-w-full"
                  dangerouslySetInnerHTML={{ __html: viewingContent.details?.content || '<p>No content provided in this article.</p>' }}
                />
              )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs text-slate-400 flex items-center gap-1">
                <CheckCircle className="w-3.5 h-3.5 text-emerald-500" /> Finished reading
              </span>
              <button
                onClick={handleCloseViewer}
                className="px-5 py-2.5 sm:py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold transition shadow-xs"
              >
                Done Reading
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. VIDEO PLAYER MODAL                                                     */}
      {/* ========================================================================= */}
      {viewingContent && viewingContent.type === 'video' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/75 backdrop-blur-sm overflow-y-auto animate-fade-in">
          <div className="glass-panel w-full max-w-4xl max-h-[92vh] rounded-3xl border border-slate-200 dark:border-slate-700 shadow-2xl flex flex-col my-auto overflow-hidden bg-white dark:bg-slate-900">
            {/* Header */}
            <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                  <Play className="w-4 h-4 fill-current" />
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-x-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                      {viewingContent.details?.provider || 'Video'} Lesson
                    </span>
                    {viewingContent.details?.duration > 0 && (
                      <span className="text-[11px] font-semibold text-slate-400 flex items-center gap-0.5">
                        <Clock className="w-2.5 h-2.5" />
                        {formatDuration(viewingContent.details.duration)}
                      </span>
                    )}
                  </div>
                  <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100 truncate">
                    {viewingContent.details?.title || viewingContent.title}
                  </h3>
                </div>
              </div>
              <button 
                onClick={handleCloseViewer}
                className="w-9 h-9 sm:w-8 sm:h-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 flex items-center justify-center shrink-0 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Video Player Area */}
            <div className="p-4 sm:p-6 overflow-y-auto space-y-4">
              {viewingContent.loading ? (
                <div className="py-20 text-center text-slate-400 text-sm">
                  <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                  Loading video lesson...
                </div>
              ) : viewingContent.error ? (
                <div className="p-6 rounded-2xl bg-rose-50 text-rose-700 dark:bg-rose-950/80 dark:text-rose-300 text-xs text-center">
                  {viewingContent.error}
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Embedded Player */}
                  <div className="relative w-full aspect-video rounded-2xl overflow-hidden bg-black shadow-xl border border-slate-800">
                    {viewingContent.details?.url ? (
                      viewingContent.details.url.includes('youtu') ? (
                        <iframe
                          src={getYouTubeEmbedUrl(viewingContent.details.url)}
                          title={viewingContent.details.title}
                          className="w-full h-full border-0"
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                          allowFullScreen
                        />
                      ) : viewingContent.details.url.match(/\.(mp4|webm|ogg)$/i) ? (
                        <video 
                          src={viewingContent.details.url} 
                          controls 
                          className="w-full h-full"
                        />
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center text-slate-300">
                          <p className="text-xs mb-3">External web video link:</p>
                          <a 
                            href={viewingContent.details.url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="px-4 py-2.5 sm:py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold inline-flex items-center gap-1.5 transition"
                          >
                            <span>Open Video in New Tab</span>
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        </div>
                      )
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-slate-400 text-xs">
                        No video link configured for this lesson.
                      </div>
                    )}
                  </div>

                  {/* Description / Notes */}
                  {viewingContent.details?.description && (
                    <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 space-y-1">
                      <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Lesson Notes & Summary</h4>
                      <div 
                        className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed break-words [&_img]:max-w-full [&_img]:h-auto"
                        dangerouslySetInnerHTML={{ __html: viewingContent.details.description }}
                      />
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex items-center justify-end">
              <button
                onClick={handleCloseViewer}
                className="px-5 py-2.5 sm:py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition shadow-xs"
              >
                Close Player
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. INTERACTIVE QUIZ ASSESSMENT & TEACHER SUBMISSIONS MODAL                 */}
      {/* ========================================================================= */}
      {viewingContent && viewingContent.type === 'quiz' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/70 backdrop-blur-sm overflow-y-auto animate-fade-in">
          <div className="glass-panel w-full max-w-3xl max-h-[92vh] rounded-3xl border border-slate-200 dark:border-slate-700 shadow-2xl flex flex-col my-auto overflow-hidden bg-white dark:bg-slate-900">
            {/* Header with Title and Mode Switcher */}
            <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex items-start justify-between gap-3 sm:gap-4">
              <div className="space-y-1.5 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-400 border border-amber-200 dark:border-amber-800 flex items-center gap-1">
                    <HelpCircle className="w-3 h-3" />
                    Quiz Assessment
                  </span>

                  {/* Attempts Indicator */}
                  {!isStaff && quizStatus && (
                    <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold flex items-center gap-1 ${
                      quizStatus.is_locked
                        ? 'bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
                        : 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800'
                    }`}>
                      {quizStatus.is_locked ? <Lock className="w-2.5 h-2.5" /> : <Clock className="w-2.5 h-2.5" />}
                      <span>
                        {quizStatus.is_locked 
                          ? `Max Attempts Reached (${quizStatus.attempts_used}/${quizStatus.max_attempts})`
                          : `Attempt ${quizStatus.attempts_used + 1} of ${quizStatus.max_attempts}`}
                      </span>
                    </span>
                  )}

                  <span className="text-[11px] text-slate-400 font-semibold">
                    Passing: {viewingContent.details?.passing_score || 70}%
                  </span>
                </div>

                <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100 truncate">
                  {viewingContent.details?.title || viewingContent.title}
                </h3>
              </div>

              <button 
                onClick={handleCloseViewer}
                className="w-9 h-9 sm:w-8 sm:h-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 flex items-center justify-center shrink-0 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Teacher Tabs (Student Submissions vs Preview Mode) */}
            {isStaff && (
              <div className="px-3 sm:px-5 pt-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex items-center gap-2 overflow-x-auto">
                <button
                  type="button"
                  onClick={() => setQuizActiveTab('submissions')}
                  className={`pb-2.5 px-3 text-xs font-bold border-b-2 flex items-center gap-1.5 whitespace-nowrap shrink-0 transition ${
                    quizActiveTab === 'submissions'
                      ? 'border-brand-600 text-brand-600 dark:border-brand-400 dark:text-brand-400'
                      : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  <Users className="w-3.5 h-3.5" />
                  <span>Student Marks & Submissions ({quizSubmissionsData.submissions?.length || 0})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setQuizActiveTab('take')}
                  className={`pb-2.5 px-3 text-xs font-bold border-b-2 flex items-center gap-1.5 whitespace-nowrap shrink-0 transition ${
                    quizActiveTab === 'take'
                      ? 'border-brand-600 text-brand-600 dark:border-brand-400 dark:text-brand-400'
                      : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  <Play className="w-3.5 h-3.5" />
                  <span>Teacher Preview Mode</span>
                </button>
              </div>
            )}

            {/* Modal Body */}
            <div className="p-4 sm:p-6 overflow-y-auto space-y-6 flex-1">
              {viewingContent.loading ? (
                <div className="py-16 text-center text-slate-400 text-sm">
                  <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                  Loading assessment data...
                </div>
              ) : viewingContent.error ? (
                <div className="p-6 rounded-2xl bg-rose-50 text-rose-700 dark:bg-rose-950/80 dark:text-rose-300 text-xs text-center">
                  {viewingContent.error}
                </div>
              ) : isStaff && quizActiveTab === 'submissions' ? (
                /* ========================================================= */
                /* TAB 1: TEACHER VIEW - ALL STUDENT MARKS & SUBMISSIONS     */
                /* ========================================================= */
                <div className="space-y-5">
                  {/* KPI Summary Cards */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200/70 dark:border-slate-700/60">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">Total Attempts</span>
                      <p className="text-xl font-extrabold text-slate-900 dark:text-slate-100 mt-0.5">
                        {quizSubmissionsData.stats?.total_attempts || 0}
                      </p>
                    </div>
                    <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200/70 dark:border-slate-700/60">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">Students Tested</span>
                      <p className="text-xl font-extrabold text-brand-600 dark:text-brand-400 mt-0.5">
                        {quizSubmissionsData.stats?.unique_students || 0}
                      </p>
                    </div>
                    <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200/70 dark:border-slate-700/60">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">Class Average</span>
                      <p className="text-xl font-extrabold text-indigo-600 dark:text-indigo-400 mt-0.5">
                        {quizSubmissionsData.stats?.avg_score || 0}%
                      </p>
                    </div>
                    <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200/70 dark:border-slate-700/60">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">Pass Rate</span>
                      <p className="text-xl font-extrabold text-emerald-600 dark:text-emerald-400 mt-0.5">
                        {quizSubmissionsData.stats?.pass_rate || 0}%
                      </p>
                    </div>
                  </div>

                  {/* Search / Filter toolbar */}
                  <div className="flex items-center justify-between gap-3">
                    <div className="relative flex-1 max-w-sm">
                      <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        placeholder="Search student name or ID..."
                        value={submissionSearch}
                        onChange={(e) => setSubmissionSearch(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 focus:outline-hidden focus:ring-2 focus:ring-brand-500/20"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => loadSubmissions(viewingContent.title, viewingContent.courseName)}
                      className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition flex items-center gap-1.5"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>Refresh</span>
                    </button>
                  </div>

                  {/* Submissions Table */}
                  {submissionsLoading ? (
                    <div className="py-12 text-center text-slate-400 text-xs">
                      <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                      Loading student submissions...
                    </div>
                  ) : filteredSubmissions.length === 0 ? (
                    <div className="p-8 text-center rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-dashed border-slate-200 dark:border-slate-700 space-y-1.5">
                      <GraduationCap className="w-8 h-8 text-slate-300 mx-auto" />
                      <p className="text-xs font-bold text-slate-600 dark:text-slate-300">
                        No student submissions recorded yet
                      </p>
                      <p className="text-[11px] text-slate-400 max-w-xs mx-auto">
                        When enrolled students attempt this quiz, their marks, percentages, and attempt history will appear here.
                      </p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto rounded-2xl border border-slate-200/80 dark:border-slate-700/80">
                      <table className="w-full min-w-[640px] text-left text-xs">
                        <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-400 font-semibold border-b border-slate-200/80 dark:border-slate-700/80">
                          <tr>
                            <th className="p-3">Student</th>
                            <th className="p-3">Class / Program</th>
                            <th className="p-3">Attempt</th>
                            <th className="p-3">Score & Status</th>
                            <th className="p-3">Date Submitted</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                          {filteredSubmissions.map((sub, sIdx) => {
                            const isPass = sub.status === 'Pass';
                            return (
                              <tr key={sIdx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition">
                                <td className="p-3 font-semibold text-slate-900 dark:text-slate-100">
                                  <div className="flex items-center gap-2.5">
                                    <div className="w-7 h-7 rounded-lg bg-brand-50 dark:bg-brand-950/80 text-brand-600 dark:text-brand-400 flex items-center justify-center font-bold text-xs shrink-0">
                                      {sub.student_name ? sub.student_name[0] : 'S'}
                                    </div>
                                    <div className="min-w-0">
                                      <p className="truncate">{sub.student_name}</p>
                                      <span className="text-[11px] text-slate-400 font-mono block">{sub.student}</span>
                                    </div>
                                  </div>
                                </td>
                                <td className="p-3 text-slate-600 dark:text-slate-300">
                                  <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-[11px] font-semibold">
                                    {sub.program}
                                  </span>
                                </td>
                                <td className="p-3 text-slate-600 dark:text-slate-300 font-medium">
                                  Attempt #{sub.attempt_number}
                                </td>
                                <td className="p-3">
                                  <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                                    isPass 
                                      ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/80 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                                      : 'bg-rose-50 text-rose-700 dark:bg-rose-950/80 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
                                  }`}>
                                    {isPass ? <Check className="w-3 h-3 stroke-[3]" /> : <X className="w-3 h-3 stroke-[3]" />}
                                    <span>{sub.score} ({sub.status})</span>
                                  </span>
                                </td>
                                <td className="p-3 text-slate-400 text-[11px]">
                                  {sub.activity_date ? sub.activity_date.split('.')[0] : 'Recently'}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              ) : !isStaff && quizStatus?.is_locked && !quizSubmitted ? (
                /* ========================================================= */
                /* LOCKED SCREEN: STUDENT EXHAUSTED ALL ATTEMPTS             */
                /* ========================================================= */
                <div className="p-5 sm:p-8 text-center space-y-4 rounded-3xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
                  <div className="w-14 h-14 rounded-2xl bg-amber-100 dark:bg-amber-950/80 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto shadow-sm">
                    <Lock className="w-7 h-7" />
                  </div>

                  <div className="space-y-1">
                    <h4 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-slate-100">
                      Maximum Attempts Completed ({quizStatus.attempts_used} / {quizStatus.max_attempts})
                    </h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                      You have used all allowed attempts for this assessment. Re-opening or re-taking this quiz is not permitted.
                    </p>
                  </div>

                  <div className="inline-flex items-center gap-3 p-3.5 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xs">
                    <Award className="w-5 h-5 text-brand-600 shrink-0" />
                    <div className="text-left">
                      <span className="text-[11px] text-slate-400 block font-semibold uppercase">Highest Recorded Score</span>
                      <span className="text-sm font-extrabold text-slate-900 dark:text-slate-100">
                        {quizStatus.highest_score}% {quizStatus.highest_score >= (viewingContent.details?.passing_score || 70) ? '(Passed)' : '(Completed)'}
                      </span>
                    </div>
                  </div>

                  {quizStatus.history && quizStatus.history.length > 0 && (
                    <div className="max-w-md mx-auto pt-3 border-t border-slate-200/60 dark:border-slate-700/60 space-y-2">
                      <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Attempt Log</span>
                      {quizStatus.history.map((h, hIdx) => (
                        <div key={hIdx} className="p-2.5 rounded-xl bg-white dark:bg-slate-800 flex items-center justify-between gap-2 text-xs">
                          <span className="font-semibold text-slate-700 dark:text-slate-300">Attempt #{hIdx + 1}</span>
                          <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                            h.status === 'Pass' 
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                              : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                          }`}>
                            {h.score} ({h.status})
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : !quizSubmitted ? (
                /* ========================================================= */
                /* ACTIVE QUIZ TAKING / PREVIEW MODE                         */
                /* ========================================================= */
                <div className="space-y-5">
                  {/* Teacher Preview Notice */}
                  {isStaff && (
                    <div className="p-3 rounded-2xl bg-amber-50 dark:bg-amber-950/80 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-300 text-xs flex items-center gap-2">
                      <Info className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400" />
                      <span>
                        <strong>Teacher Preview Mode:</strong> You are testing this quiz as an instructor. Answers and marks will not be stored in the student database.
                      </span>
                    </div>
                  )}

                  {/* Progress Indicator */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400 font-semibold">
                      <span>Question {quizQuestionIndex + 1} of {viewingContent.details?.questions?.length || 1}</span>
                      <span>{Math.round(((quizQuestionIndex + 1) / (viewingContent.details?.questions?.length || 1)) * 100)}% Complete</span>
                    </div>
                    <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                      <div 
                        className="bg-brand-500 h-full transition-all duration-300 rounded-full"
                        style={{ width: `${((quizQuestionIndex + 1) / (viewingContent.details?.questions?.length || 1)) * 100}%` }}
                      />
                    </div>
                  </div>

                  {/* Current Question */}
                  {(() => {
                    const currentQ = viewingContent.details.questions[quizQuestionIndex];
                    if (!currentQ) return null;
                    const selectedAns = quizAnswers[quizQuestionIndex];

                    return (
                      <div className="space-y-4">
                        <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                          <h4 
                            className="text-sm font-bold text-slate-900 dark:text-slate-100 leading-snug break-words [&_img]:max-w-full [&_img]:h-auto"
                            dangerouslySetInnerHTML={{ __html: currentQ.question }}
                          />
                        </div>

                        {/* Options */}
                        <div className="space-y-2.5">
                          {(currentQ.options || []).map((opt, optIdx) => {
                            const optionLetter = String.fromCharCode(65 + optIdx);
                            const isSelected = selectedAns === opt.option;

                            return (
                              <button
                                key={optIdx}
                                type="button"
                                onClick={() => handleQuizSelectOption(quizQuestionIndex, opt.option)}
                                className={`w-full p-3.5 rounded-2xl border text-left text-xs font-medium transition-all flex items-center gap-3 ${
                                  isSelected 
                                    ? 'border-brand-500 bg-brand-50/80 text-brand-900 dark:bg-brand-950/80 dark:text-brand-100 ring-2 ring-brand-500/20 shadow-sm'
                                    : 'border-slate-200/80 dark:border-slate-700/80 bg-white dark:bg-slate-800/80 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-750'
                                }`}
                              >
                                <span className={`w-7 h-7 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 transition-colors ${
                                  isSelected
                                    ? 'bg-brand-600 text-white'
                                    : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400'
                                }`}>
                                  {optionLetter}
                                </span>
                                <span className="flex-1 min-w-0 break-words">{opt.option}</span>
                                {isSelected && (
                                  <div className="w-5 h-5 rounded-full bg-brand-600 text-white flex items-center justify-center shrink-0">
                                    <Check className="w-3 h-3 stroke-[3]" />
                                  </div>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              ) : (
                /* ========================================================= */
                /* ASSESSMENT SUBMITTED RESULTS MODE                         */
                /* ========================================================= */
                (() => {
                  const { correct, total, percent, passed, passingScore, isLocked, attemptsUsed, maxAttempts, preview } = getQuizResults();

                  return (
                    <div className="space-y-6">
                      {/* Result Banner */}
                      <div className={`p-5 sm:p-6 rounded-3xl text-center space-y-2 border ${
                        passed
                          ? 'bg-emerald-50 dark:bg-emerald-950/70 border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200'
                          : 'bg-amber-50 dark:bg-amber-950/70 border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200'
                      }`}>
                        <div className={`w-14 h-14 rounded-2xl mx-auto flex items-center justify-center shadow-md ${
                          passed ? 'bg-emerald-500 text-white' : 'bg-amber-500 text-white'
                        }`}>
                          {passed ? <Award className="w-7 h-7" /> : <AlertCircle className="w-7 h-7" />}
                        </div>
                        <h4 className="text-lg font-extrabold tracking-tight">
                          {passed ? '🎉 Congratulations! You Passed!' : 'Assessment Completed'}
                        </h4>
                        <p className="text-xs max-w-sm mx-auto opacity-90">
                          {preview ? (
                            <span>[Teacher Preview] You scored <span className="font-extrabold text-sm">{percent}%</span> ({correct} of {total} correct).</span>
                          ) : (
                            <span>You scored <span className="font-extrabold text-sm">{percent}%</span> ({correct} of {total} correct). Required passing threshold is {passingScore}%.</span>
                          )}
                        </p>

                        {!preview && (
                          <div className="pt-2">
                            {isLocked ? (
                              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900">
                                <Lock className="w-3 h-3" /> All {maxAttempts} Attempts Exhausted • Final Score Saved
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300">
                                Attempt {attemptsUsed} of {maxAttempts} Completed
                              </span>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Question by Question Review */}
                      <div className="space-y-3">
                        <h5 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                          Assessment Review & Correct Answers
                        </h5>

                        {quizSubmitResult && !quizSubmitResult.answers_revealed && (
                          <p className="text-[11px] text-slate-500 dark:text-slate-400">
                            Correct answers are shown once you pass the quiz or use your last attempt.
                          </p>
                        )}

                        {viewingContent.details.questions.map((q, qIdx) => {
                          // The server grades the attempt; students only receive the answer key
                          // (correct_option / explanation) once answers are revealed.
                          const review = quizSubmitResult?.review?.find((r) => r.index === qIdx);
                          const chosenAns = review ? review.selected : quizAnswers[qIdx];
                          const localCorrect = (q.options || []).find(o => o.is_correct);
                          const correctOpt = review
                            ? (review.correct_option ? { option: review.correct_option } : null)
                            : localCorrect;
                          const isCorrect = review ? review.is_correct : chosenAns === localCorrect?.option;
                          const explanation = review?.explanation;

                          return (
                            <div 
                              key={qIdx}
                              className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-100 dark:border-slate-800 space-y-2 text-xs"
                            >
                              <div className="flex items-start justify-between gap-2">
                                <span 
                                  className="font-bold text-slate-800 dark:text-slate-200 min-w-0 break-words"
                                  dangerouslySetInnerHTML={{ __html: `Q${qIdx + 1}: ${q.question}` }}
                                />
                                <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold shrink-0 ${
                                  isCorrect 
                                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                    : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                                }`}>
                                  {isCorrect ? 'Correct (+1)' : 'Incorrect (0)'}
                                </span>
                              </div>

                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-slate-200/60 dark:border-slate-700/60">
                                <div className="min-w-0 break-words">
                                  <span className="text-[11px] text-slate-400 block">Your Answer:</span>
                                  <span className={`font-semibold ${isCorrect ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                                    {chosenAns || '(No option selected)'}
                                  </span>
                                </div>
                                {!isCorrect && correctOpt && (
                                  <div className="min-w-0 break-words">
                                    <span className="text-[11px] text-slate-400 block">Correct Answer:</span>
                                    <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                                      {correctOpt.option}
                                    </span>
                                  </div>
                                )}
                              </div>
                              {explanation && (
                                <p className="pt-2 border-t border-slate-200/60 dark:border-slate-700/60 text-slate-600 dark:text-slate-300 break-words">
                                  <span className="text-[11px] text-slate-400 block">Explanation:</span>
                                  {explanation}
                                </p>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()
              )}
            </div>

            {/* Quiz Footer Controls */}
            {viewingContent.details?.questions?.length > 0 && (
              <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex flex-wrap items-center justify-between gap-2">
                {isStaff && quizActiveTab === 'submissions' ? (
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-3 w-full">
                    <span className="text-xs text-slate-400">
                      Submissions are saved directly in Frappe database (<code className="text-brand-600 dark:text-brand-400">Quiz Activity</code>).
                    </span>
                    <button
                      type="button"
                      onClick={handleCloseViewer}
                      className="px-5 py-2.5 sm:py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold transition shadow-xs"
                    >
                      Close Window
                    </button>
                  </div>
                ) : !isStaff && quizStatus?.is_locked && !quizSubmitted ? (
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-3 w-full">
                    <span className="text-xs text-slate-400 flex items-center gap-1.5">
                      <Lock className="w-3.5 h-3.5 text-slate-400" />
                      Attempts locked for this quiz.
                    </span>
                    <button
                      type="button"
                      onClick={handleCloseViewer}
                      className="px-5 py-2.5 sm:py-2 rounded-xl bg-slate-700 hover:bg-slate-800 text-white text-xs font-bold transition shadow-xs"
                    >
                      Close
                    </button>
                  </div>
                ) : !quizSubmitted ? (
                  <>
                    <button
                      type="button"
                      disabled={quizQuestionIndex === 0}
                      onClick={() => setQuizQuestionIndex(prev => Math.max(0, prev - 1))}
                      className="px-3.5 py-2.5 sm:py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-white dark:hover:bg-slate-800 transition flex items-center gap-1.5"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" />
                      Previous
                    </button>

                    {quizQuestionIndex < viewingContent.details.questions.length - 1 ? (
                      <button
                        type="button"
                        onClick={() => setQuizQuestionIndex(prev => prev + 1)}
                        className="px-4 py-2.5 sm:py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-xs"
                      >
                        <span>Next Question</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={isSubmittingQuiz}
                        onClick={handleSubmitQuiz}
                        className="px-5 py-2.5 sm:py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-xs font-bold transition shadow-md shadow-emerald-500/20 flex items-center gap-1.5 disabled:opacity-50"
                      >
                        {isSubmittingQuiz ? (
                          <>
                            <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            <span>Submitting...</span>
                          </>
                        ) : (
                          <>
                            <CheckCircle className="w-3.5 h-3.5" />
                            <span>Submit Assessment</span>
                          </>
                        )}
                      </button>
                    )}
                  </>
                ) : (
                  <>
                    {/* Retake button: ONLY shown if NOT locked and attempts remain */}
                    {(isStaff || !quizStatus?.is_locked) ? (
                      <button
                        type="button"
                        onClick={() => {
                          setQuizAnswers({});
                          setQuizSubmitted(false);
                          setQuizQuestionIndex(0);
                          setQuizSubmitResult(null);
                        }}
                        className="px-4 py-2.5 sm:py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-800 transition flex items-center gap-1.5"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>{isStaff ? 'Retake Preview' : `Retake Quiz (${quizStatus?.attempts_remaining || 1} left)`}</span>
                      </button>
                    ) : (
                      <span className="text-xs text-slate-400 font-semibold flex items-center gap-1.5">
                        <Lock className="w-3.5 h-3.5 text-rose-500" />
                        All attempts used ({quizStatus?.attempts_used}/{quizStatus?.max_attempts})
                      </span>
                    )}

                    <button
                      type="button"
                      onClick={handleCloseViewer}
                      className="px-5 py-2.5 sm:py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold transition shadow-xs"
                    >
                      Done & Close
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. TEACHER / STAFF: ADD LEARNING MATERIAL MODAL                           */}
      {/* ========================================================================= */}
      {isAddMaterialOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/70 backdrop-blur-sm overflow-y-auto animate-fade-in">
          <div className="glass-panel w-full max-w-2xl max-h-[92vh] rounded-3xl border border-slate-200 dark:border-slate-700 shadow-2xl flex flex-col my-auto overflow-hidden bg-white dark:bg-slate-900">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 pb-3 border-b border-slate-100 dark:border-slate-800 shrink-0 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <h3 className="text-base font-extrabold text-slate-900 dark:text-slate-100 break-words">
                  Add Learning Material
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Publish an Article, Video Lesson, or Quiz Assessment to the syllabus.
                </p>
              </div>
              <button 
                onClick={() => setIsAddMaterialOpen(false)}
                className="w-9 h-9 sm:w-8 sm:h-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 flex items-center justify-center shrink-0 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSubmitAddMaterial} className="flex-1 min-h-0 flex flex-col overflow-hidden">
              <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
              {formError && (
                <div className="p-3.5 rounded-2xl bg-rose-50 text-rose-700 dark:bg-rose-950/80 dark:text-rose-300 text-xs font-medium border border-rose-200 dark:border-rose-800 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span className="min-w-0 break-words">{formError}</span>
                </div>
              )}

              {/* Course & Topic Selection */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Course / Subject</label>
                  <select
                    value={selectedCourseForAction}
                    onChange={(e) => {
                      setSelectedCourseForAction(e.target.value);
                      const targetC = courses.find(c => c.name === e.target.value);
                      setSelectedTopicForAction(targetC?.topics?.[0]?.name || '');
                    }}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 font-medium focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-hidden"
                  >
                    {courses.map(c => (
                      <option key={c.name} value={c.name}>{c.courseName} ({c.name})</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Topic Module</label>
                  {(() => {
                    const activeC = courses.find(c => c.name === selectedCourseForAction);
                    const topicList = activeC?.topics || [];

                    if (topicList.length === 0) {
                      return (
                        <input
                          type="text"
                          placeholder="e.g. Unit 1: Foundations"
                          value={selectedTopicForAction}
                          onChange={(e) => setSelectedTopicForAction(e.target.value)}
                          className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 font-medium focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-hidden"
                          required
                        />
                      );
                    }

                    return (
                      <select
                        value={selectedTopicForAction}
                        onChange={(e) => setSelectedTopicForAction(e.target.value)}
                        className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 font-medium focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-hidden"
                      >
                        {topicList.map(t => (
                          <option key={t.name} value={t.name}>{t.title}</option>
                        ))}
                      </select>
                    );
                  })()}
                </div>
              </div>

              {/* Material Type Segmented Tabs */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Content Type</label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-1 sm:gap-2 p-1 rounded-2xl bg-slate-100 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700">
                  {[
                    { id: 'Article', icon: FileText, label: 'Article / Note' },
                    { id: 'Video', icon: Video, label: 'Video Lesson' },
                    { id: 'Quiz', icon: HelpCircle, label: 'Interactive Quiz' },
                  ].map(tab => {
                    const Icon = tab.icon;
                    const isActive = materialType === tab.id;
                    return (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setMaterialType(tab.id)}
                        className={`py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                          isActive 
                            ? 'bg-white dark:bg-slate-700 text-brand-600 dark:text-brand-400 shadow-xs'
                            : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                        }`}
                      >
                        <Icon className="w-3.5 h-3.5" />
                        <span>{tab.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Title Field */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  {materialType} Title <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder={
                    materialType === 'Article' ? 'e.g. Introduction to Prime Numbers' :
                    materialType === 'Video' ? 'e.g. Visual Explanation of Prime Factorization' :
                    'e.g. Prime Numbers Mastery Quiz'
                  }
                  value={materialTitle}
                  onChange={(e) => setMaterialTitle(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 font-medium focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-hidden"
                  required
                />
              </div>

              {/* ARTICLE FORM FIELDS */}
              {materialType === 'Article' && (
                <div className="space-y-4 animate-in fade-in duration-150">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Author</label>
                    <input
                      type="text"
                      value={articleAuthor}
                      onChange={(e) => setArticleAuthor(e.target.value)}
                      placeholder="Author name (defaults to you)"
                      className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 font-medium focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-hidden"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      Article Content & Syllabus Notes <span className="text-rose-500">*</span>
                    </label>
                    <textarea
                      rows={6}
                      value={articleContent}
                      onChange={(e) => setArticleContent(e.target.value)}
                      placeholder="Write your study notes, key principles, definitions, or bullet points here..."
                      className="w-full p-3.5 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 font-medium focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-hidden"
                      required
                    />
                  </div>
                </div>
              )}

              {/* VIDEO FORM FIELDS */}
              {materialType === 'Video' && (
                <div className="space-y-4 animate-in fade-in duration-150">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Video Platform</label>
                      <select
                        value={videoProvider}
                        onChange={(e) => setVideoProvider(e.target.value)}
                        className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 font-medium focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-hidden"
                      >
                        <option value="YouTube">YouTube</option>
                        <option value="Vimeo">Vimeo</option>
                        <option value="Custom">Direct Link / MP4</option>
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Duration (Minutes)</label>
                      <input
                        type="number"
                        min="1"
                        placeholder="e.g. 15"
                        value={videoDuration}
                        onChange={(e) => setVideoDuration(e.target.value)}
                        className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 font-medium focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-hidden"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      Video URL <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="url"
                      placeholder="https://www.youtube.com/watch?v=... or https://youtu.be/..."
                      value={videoUrl}
                      onChange={(e) => setVideoUrl(e.target.value)}
                      className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 font-medium focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-hidden"
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Description & Learning Outcomes</label>
                    <textarea
                      rows={3}
                      value={videoDescription}
                      onChange={(e) => setVideoDescription(e.target.value)}
                      placeholder="Summary of concepts covered in this video..."
                      className="w-full p-3 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 font-medium focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-hidden"
                    />
                  </div>
                </div>
              )}

              {/* QUIZ FORM FIELDS */}
              {materialType === 'Quiz' && (
                <div className="space-y-5 animate-in fade-in duration-150">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Passing Score (%)</label>
                      <input
                        type="number"
                        min="1"
                        max="100"
                        value={quizPassingScore}
                        onChange={(e) => setQuizPassingScore(e.target.value)}
                        className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 font-medium focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-hidden"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Max Attempts</label>
                      <input
                        type="number"
                        min="1"
                        max="10"
                        value={quizMaxAttempts}
                        onChange={(e) => setQuizMaxAttempts(e.target.value)}
                        className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 font-medium focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-hidden"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Time Limit (Mins)</label>
                      <input
                        type="number"
                        min="1"
                        placeholder="Optional"
                        value={quizDuration}
                        onChange={(e) => setQuizDuration(e.target.value)}
                        className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 font-medium focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-hidden"
                      />
                    </div>
                  </div>

                  {/* Dynamic Questions Builder */}
                  <div className="space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                        Questions ({quizQuestions.length})
                      </label>
                      <button
                        type="button"
                        onClick={handleAddQuizQuestion}
                        className="text-xs font-bold text-brand-600 hover:text-brand-700 dark:text-brand-400 flex items-center gap-1"
                      >
                        <Plus className="w-3.5 h-3.5" /> Add Another Question
                      </button>
                    </div>

                    {quizQuestions.map((qItem, qIdx) => (
                      <div 
                        key={qIdx}
                        className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700 space-y-3"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                            Question #{qIdx + 1}
                          </span>
                          {quizQuestions.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleRemoveQuizQuestion(qIdx)}
                              className="p-2 -m-2 rounded-lg text-slate-400 hover:text-rose-500 transition"
                              title="Delete Question"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>

                        <input
                          type="text"
                          placeholder="Type your question prompt here..."
                          value={qItem.question}
                          onChange={(e) => handleQuestionChange(qIdx, 'question', e.target.value)}
                          className="w-full px-3 py-2 text-xs rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 font-medium focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-hidden"
                          required
                        />

                        {/* 4 Options */}
                        <div className="space-y-2">
                          <span className="text-[11px] font-semibold text-slate-400">
                            Options (Check radio button for the Correct Answer):
                          </span>
                          {qItem.options.map((opt, optIdx) => (
                            <div key={optIdx} className="flex items-center gap-2">
                              <input
                                type="radio"
                                name={`correct_opt_${qIdx}`}
                                checked={opt.is_correct}
                                onChange={() => handleSetCorrectOption(qIdx, optIdx)}
                                className="w-4 h-4 text-brand-600 focus:ring-brand-500 cursor-pointer"
                                title="Mark as correct answer"
                              />
                              <input
                                type="text"
                                placeholder={`Option ${String.fromCharCode(65 + optIdx)}`}
                                value={opt.option}
                                onChange={(e) => handleOptionChange(qIdx, optIdx, e.target.value)}
                                className="flex-1 min-w-0 px-3 py-1.5 text-xs rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 font-medium focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-hidden"
                                required
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              </div>

              {/* Form Action Buttons */}
              <div className="p-4 sm:p-5 pt-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/70 flex flex-wrap items-center justify-end gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsAddMaterialOpen(false)}
                  className="px-4 py-2.5 sm:py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2.5 sm:py-2 rounded-xl bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-700 hover:to-indigo-700 text-white text-xs font-bold transition shadow-md shadow-brand-500/20 flex items-center gap-2 disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Publishing...</span>
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4" />
                      <span>Publish to Topic</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 5. TEACHER / STAFF: ADD TOPIC MODAL                                       */}
      {/* ========================================================================= */}
      {isAddTopicOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/70 backdrop-blur-sm overflow-y-auto animate-fade-in">
          <div className="glass-panel w-full max-w-md max-h-[92vh] flex flex-col my-auto rounded-3xl border border-slate-200 dark:border-slate-700 shadow-2xl overflow-hidden bg-white dark:bg-slate-900">
            <div className="p-4 sm:p-5 pb-3 border-b border-slate-100 dark:border-slate-800 shrink-0 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <h3 className="text-base font-extrabold text-slate-900 dark:text-slate-100 break-words">
                  Add Course Topic Module
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Register a new topic unit to attach materials to.
                </p>
              </div>
              <button 
                onClick={() => setIsAddTopicOpen(false)}
                className="w-9 h-9 sm:w-8 sm:h-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 flex items-center justify-center shrink-0 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitAddTopic} className="flex-1 min-h-0 flex flex-col overflow-hidden">
              <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
                {topicError && (
                  <div className="p-3 rounded-xl bg-rose-50 text-rose-700 dark:bg-rose-950/80 dark:text-rose-300 text-xs font-medium border border-rose-200 dark:border-rose-800">
                    {topicError}
                  </div>
                )}

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Course / Subject</label>
                  <select
                    value={selectedCourseForAction}
                    onChange={(e) => setSelectedCourseForAction(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 font-medium focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-hidden"
                  >
                    {courses.map(c => (
                      <option key={c.name} value={c.name}>{c.courseName} ({c.name})</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Topic Title</label>
                  <input
                    type="text"
                    placeholder="e.g. Geometry & Angles"
                    value={newTopicTitle}
                    onChange={(e) => setNewTopicTitle(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 font-medium focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-hidden"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Description (Optional)</label>
                  <textarea
                    rows={2}
                    placeholder="Summary of this syllabus chapter..."
                    value={newTopicDesc}
                    onChange={(e) => setNewTopicDesc(e.target.value)}
                    className="w-full p-3 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 font-medium focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-hidden"
                  />
                </div>
              </div>

              <div className="p-4 sm:p-5 pt-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/70 flex flex-wrap items-center justify-end gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsAddTopicOpen(false)}
                  className="px-4 py-2.5 sm:py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isTopicSubmitting}
                  className="px-5 py-2.5 sm:py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold transition shadow-xs flex items-center gap-1.5 disabled:opacity-50"
                >
                  {isTopicSubmitting ? 'Creating...' : '+ Create Topic'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: CREATE STANDARD / PROGRAM */}
      {isCreateProgramOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs overflow-y-auto animate-fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-md max-h-[92vh] flex flex-col my-auto overflow-hidden shadow-2xl">
            <div className="p-4 sm:p-5 pb-3 border-b border-slate-100 dark:border-slate-800 shrink-0 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shadow-xs shrink-0">
                  <GraduationCap className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-base font-extrabold text-slate-900 dark:text-slate-100 break-words">
                    New Standard / Program
                  </h3>
                  <p className="text-xs text-slate-400">Add an academic grade to the curriculum</p>
                </div>
              </div>
              <button
                onClick={() => setIsCreateProgramOpen(false)}
                className="p-2 sm:p-1.5 shrink-0 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitCreateProgram} className="flex-1 min-h-0 flex flex-col overflow-hidden">
              <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 text-xs">
                {createProgramError && (
                  <div className="p-3 rounded-xl bg-rose-50 text-rose-700 dark:bg-rose-950/80 dark:text-rose-300 text-xs font-semibold border border-rose-200 dark:border-rose-800 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span className="min-w-0 break-words">{createProgramError}</span>
                  </div>
                )}

                {createProgramSuccess && (
                  <div className="p-3 rounded-xl bg-emerald-50 text-emerald-700 dark:bg-emerald-950/80 dark:text-emerald-300 text-xs font-semibold border border-emerald-200 dark:border-emerald-800 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span className="min-w-0 break-words">{createProgramSuccess}</span>
                  </div>
                )}

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Program / Standard Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Standard 7, Grade 8, Secondary..."
                    value={newProgramName}
                    onChange={(e) => setNewProgramName(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 font-medium focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-hidden"
                    required
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Abbreviation (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. STD-7 (Auto-generated if empty)"
                    value={newProgramAbbr}
                    onChange={(e) => setNewProgramAbbr(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 font-medium focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-hidden"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Department (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Primary School, Junior High..."
                    value={newProgramDept}
                    onChange={(e) => setNewProgramDept(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 font-medium focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-hidden"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex flex-wrap items-center justify-between gap-x-2">
                    <span>Curriculum Courses & Subjects</span>
                    <span className="text-[11px] font-normal text-slate-400">Optional</span>
                  </label>
                  
                  {/* Option A: Auto-generate standard-specific courses */}
                  <label className="flex items-start gap-2.5 p-3 rounded-2xl bg-indigo-50/60 dark:bg-indigo-950/40 border border-indigo-200/70 dark:border-indigo-900/50 cursor-pointer mb-2.5 transition hover:bg-indigo-50 dark:hover:bg-indigo-950/60">
                    <input
                      type="checkbox"
                      checked={autoCreateCoreCourses}
                      onChange={(e) => setAutoCreateCoreCourses(e.target.checked)}
                      className="mt-0.5 rounded-sm border-indigo-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <div>
                      <p className="font-bold text-indigo-950 dark:text-indigo-200 text-xs">
                        Auto-generate standard-specific core courses
                      </p>
                      <p className="text-[11px] text-indigo-700/80 dark:text-indigo-300/80 mt-0.5 leading-relaxed">
                        Creates dedicated courses (<span className="font-mono">{newProgramName ? `Mathematics - ${newProgramName}` : 'Mathematics - [Standard]'}</span>, English, Science) so learning topics and materials are isolated to this standard.
                      </p>
                    </div>
                  </label>

                  {/* Option B: Pick existing courses */}
                  <div className="space-y-1.5">
                    <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Or select existing courses to link:</p>
                    <div className="max-h-36 overflow-y-auto p-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 space-y-1">
                      {allAvailableCourses.length === 0 ? (
                        <p className="text-slate-400 text-[11px] italic p-1">No courses available</p>
                      ) : (
                        allAvailableCourses.map((c) => {
                          const cName = c.name || c.course;
                          const isChecked = newProgramSelectedCourses.includes(cName);
                          return (
                            <label
                              key={cName}
                              className={`flex items-center justify-between gap-2 p-2 rounded-lg cursor-pointer transition ${
                                isChecked ? 'bg-brand-50/70 dark:bg-brand-950/50 text-brand-700 dark:text-brand-300' : 'hover:bg-slate-100 dark:hover:bg-slate-700/50 text-slate-700 dark:text-slate-300'
                              }`}
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setNewProgramSelectedCourses(prev => [...prev, cName]);
                                    } else {
                                      setNewProgramSelectedCourses(prev => prev.filter(x => x !== cName));
                                    }
                                  }}
                                  className="rounded-sm border-slate-300 text-brand-600 focus:ring-brand-500"
                                />
                                <span className="font-semibold break-words min-w-0">{c.course_name || cName}</span>
                              </div>
                              {c.department && (
                                <span className="text-[11px] text-slate-400 bg-slate-200/50 dark:bg-slate-700/50 px-1.5 py-0.5 rounded-sm shrink-0">
                                  {c.department}
                                </span>
                              )}
                            </label>
                          );
                        })
                      )}
                    </div>
                  </div>
                </div>

                <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60 text-[11px] text-slate-500 dark:text-slate-400 space-y-1">
                  <p className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                    <span>Automatic Section A Setup</span>
                  </p>
                  <p>
                    Creates default cohort section <span className="font-mono text-slate-700 dark:text-slate-300">"{newProgramName ? `${newProgramName} - Section A` : 'Section A'}"</span> so you can immediately enroll students and schedule lectures.
                  </p>
                </div>
              </div>

              <div className="p-4 sm:p-5 pt-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/70 flex flex-wrap items-center justify-end gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsCreateProgramOpen(false)}
                  className="px-4 py-2.5 sm:py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createProgramSubmitting}
                  className="px-5 py-2.5 sm:py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold transition shadow-xs flex items-center gap-1.5 disabled:opacity-50"
                >
                  {createProgramSubmitting ? (
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Plus className="w-3.5 h-3.5" />
                  )}
                  <span>Create Standard</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: MANAGE STANDARD COURSES */}
      {isManageProgramCoursesOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs overflow-y-auto animate-fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-lg max-h-[92vh] flex flex-col my-auto overflow-hidden shadow-2xl">
            <div className="p-4 sm:p-5 pb-3 border-b border-slate-100 dark:border-slate-800 shrink-0 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-10 h-10 rounded-2xl bg-violet-50 dark:bg-violet-950/80 text-violet-600 dark:text-violet-400 flex items-center justify-center shadow-xs shrink-0">
                  <Settings2 className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-base font-extrabold text-slate-900 dark:text-slate-100 break-words">
                    Manage Courses: {selectedProgram || 'Standard'}
                  </h3>
                  <p className="text-xs text-slate-400">Curriculum subjects linked to this standard</p>
                </div>
              </div>
              <button
                onClick={() => setIsManageProgramCoursesOpen(false)}
                className="p-2 sm:p-1.5 shrink-0 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 text-xs">
              {manageCoursesMsg && (
                <div className={`p-3 rounded-xl text-xs font-semibold border flex items-center gap-2 ${
                  manageCoursesMsg.type === 'error'
                    ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/80 dark:text-rose-300 border-rose-200 dark:border-rose-800'
                    : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/80 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                }`}>
                  {manageCoursesMsg.type === 'error' ? <AlertCircle className="w-4 h-4 shrink-0" /> : <CheckCircle2 className="w-4 h-4 shrink-0" />}
                  <span>{manageCoursesMsg.text}</span>
                </div>
              )}

              {/* SECTION: ASSIGN NEW / EXISTING COURSE */}
              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h4 className="font-bold text-slate-800 dark:text-slate-200 text-xs flex items-center gap-1.5 min-w-0">
                    <Plus className="w-3.5 h-3.5 text-violet-600 dark:text-violet-400" />
                    <span className="break-words min-w-0">Assign Course to {selectedProgram}</span>
                  </h4>
                  <button
                    type="button"
                    onClick={() => {
                      setIsManageProgramCoursesOpen(false);
                      handleOpenCreateCourse();
                    }}
                    className="text-[11px] font-bold text-brand-600 dark:text-brand-400 hover:underline flex items-center gap-1"
                  >
                    <span>+ New Subject</span>
                  </button>
                </div>

                {allAvailableCourses.filter(ac => !programLinkedCourses.some(pc => (pc.name || pc.course) === (ac.name || ac.course))).length === 0 ? (
                  <p className="text-[11px] text-slate-400 italic">All available courses are currently assigned to this standard.</p>
                ) : (
                  <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
                    <select
                      value={selectedCourseToAssign}
                      onChange={(e) => setSelectedCourseToAssign(e.target.value)}
                      className="flex-1 min-w-0 w-full sm:w-auto px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 font-medium focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 outline-hidden"
                    >
                      {allAvailableCourses
                        .filter(ac => !programLinkedCourses.some(pc => (pc.name || pc.course) === (ac.name || ac.course)))
                        .map(c => (
                          <option key={c.name || c.course} value={c.name || c.course}>
                            {c.course_name || c.name} {c.program ? `(${c.program})` : ''}
                          </option>
                        ))}
                    </select>
                    <button
                      type="button"
                      disabled={manageCoursesLoading || !selectedCourseToAssign}
                      onClick={handleAssignCourseToProgram}
                      className="px-3.5 py-2.5 sm:py-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-white font-bold transition shadow-xs flex items-center justify-center gap-1.5 disabled:opacity-50 shrink-0"
                    >
                      {manageCoursesLoading ? (
                        <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <Plus className="w-3.5 h-3.5" />
                      )}
                      <span>Assign</span>
                    </button>
                  </div>
                )}
              </div>

              {/* SECTION: CURRENTLY LINKED COURSES */}
              <div>
                <h4 className="font-bold text-slate-700 dark:text-slate-300 mb-2 flex flex-wrap items-center justify-between gap-2">
                  <span>Currently Assigned Courses</span>
                  <span className="text-[11px] font-normal text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">
                    {programLinkedCourses.length} {programLinkedCourses.length === 1 ? 'Course' : 'Courses'}
                  </span>
                </h4>

                {programLinkedCourses.length === 0 ? (
                  <div className="p-6 text-center rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
                    <BookOpen className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
                    <p className="text-slate-500 dark:text-slate-400 font-medium text-xs">No courses currently linked to {selectedProgram}.</p>
                    <p className="text-slate-400 text-[11px] mt-1">Assign an existing course above or create a new one.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {programLinkedCourses.map((c) => {
                      const cName = c.name || c.course;
                      return (
                        <div
                          key={cName}
                          className="p-3 rounded-2xl bg-white dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 flex items-center justify-between gap-3 shadow-xs hover:border-violet-300 dark:hover:border-violet-700 transition"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-8 h-8 rounded-xl bg-violet-50 dark:bg-violet-950/60 text-violet-600 dark:text-violet-400 flex items-center justify-center shrink-0">
                              <BookOpen className="w-4 h-4" />
                            </div>
                            <div className="min-w-0">
                              <p className="font-bold text-slate-900 dark:text-slate-100 truncate text-xs">
                                {c.course_name || cName}
                              </p>
                              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5">
                                <span className="text-[11px] text-slate-400 font-mono break-all">
                                  {cName}
                                </span>
                                {c.department && (
                                  <span className="text-[11px] text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-700/50 px-1.5 py-px rounded-sm">
                                    {c.department}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          <button
                            type="button"
                            disabled={manageCoursesLoading}
                            onClick={() => handleRemoveCourseFromProgram(cName)}
                            className="p-2 sm:p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/50 border border-transparent hover:border-rose-200 dark:hover:border-rose-800/50 transition shrink-0 disabled:opacity-40"
                            title={`Remove ${cName} from ${selectedProgram}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            <div className="p-4 sm:p-5 pt-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/70 flex items-center justify-end shrink-0">
              <button
                type="button"
                onClick={() => setIsManageProgramCoursesOpen(false)}
                className="px-5 py-2.5 sm:py-2 rounded-xl bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-100 font-bold text-xs transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: CONFIRM DELETE / REMOVE COURSE FROM STANDARD */}
      {courseToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs overflow-y-auto animate-fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-md max-h-[90vh] flex flex-col my-auto overflow-hidden shadow-2xl">
            <div className="p-4 sm:p-5 pb-3 border-b border-slate-100 dark:border-slate-800 shrink-0 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-10 h-10 rounded-2xl bg-rose-50 dark:bg-rose-950/80 text-rose-600 dark:text-rose-400 flex items-center justify-center shadow-xs shrink-0">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-base font-extrabold text-slate-900 dark:text-slate-100 break-words">
                    Remove Course from {courseToDelete.program || selectedProgram}
                  </h3>
                  <p className="text-xs text-slate-400">Curriculum standard subject management</p>
                </div>
              </div>
              <button
                onClick={() => setCourseToDelete(null)}
                className="p-2 sm:p-1.5 shrink-0 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-5 space-y-4 text-xs">
              {deleteCourseError && (
                <div className="p-3 rounded-xl bg-rose-50 text-rose-700 dark:bg-rose-950/80 dark:text-rose-300 text-xs font-semibold border border-rose-200 dark:border-rose-800 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span className="min-w-0 break-words">{deleteCourseError}</span>
                </div>
              )}

              <div className="p-4 rounded-2xl bg-rose-50/50 dark:bg-rose-950/30 border border-rose-100 dark:border-rose-900/40">
                <p className="font-semibold text-slate-800 dark:text-slate-200 leading-relaxed break-words">
                  Are you sure you want to remove <span className="font-bold text-rose-600 dark:text-rose-400">"{courseToDelete.courseTitle}"</span> from <span className="font-bold text-slate-900 dark:text-slate-100">{courseToDelete.program || selectedProgram}</span>?
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">
                  This course and its syllabus will no longer be attached to <span className="font-semibold text-slate-700 dark:text-slate-300">{courseToDelete.program || selectedProgram}</span>.
                </p>
              </div>

              {/* Option to also delete completely from catalog */}
              <label className="flex items-start gap-2.5 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60 cursor-pointer transition hover:bg-slate-100 dark:hover:bg-slate-800">
                <input
                  type="checkbox"
                  checked={alsoDeleteCompletely}
                  onChange={(e) => setAlsoDeleteCompletely(e.target.checked)}
                  className="mt-0.5 rounded-sm border-slate-300 text-rose-600 focus:ring-rose-500"
                />
                <div>
                  <p className="font-bold text-slate-800 dark:text-slate-200 text-xs">
                    Also delete course entirely from school catalog
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    Permanently removes the course document itself from the system.
                  </p>
                </div>
              </label>
            </div>

            <div className="p-4 sm:p-5 pt-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/70 flex flex-wrap items-center justify-end gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setCourseToDelete(null)}
                className="px-4 py-2.5 sm:py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleteCourseSubmitting}
                onClick={handleConfirmDeleteCourse}
                className="px-5 py-2.5 sm:py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold transition shadow-xs flex items-center gap-1.5 disabled:opacity-50"
              >
                {deleteCourseSubmitting ? (
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Trash2 className="w-3.5 h-3.5" />
                )}
                <span>{alsoDeleteCompletely ? 'Delete Course Completely' : 'Remove from Standard'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: CREATE COURSE / SUBJECT */}
      {isCreateCourseOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs overflow-y-auto animate-fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-lg max-h-[92vh] flex flex-col my-auto overflow-hidden shadow-2xl">
            <div className="p-4 sm:p-5 pb-3 border-b border-slate-100 dark:border-slate-800 shrink-0 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-10 h-10 rounded-2xl bg-brand-50 dark:bg-brand-950/80 text-brand-600 dark:text-brand-400 flex items-center justify-center shadow-xs shrink-0">
                  <BookOpen className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-base font-extrabold text-slate-900 dark:text-slate-100 break-words">
                    Create New Course / Subject
                  </h3>
                  <p className="text-xs text-slate-400">Add course syllabus to academic program</p>
                </div>
              </div>
              <button
                onClick={() => setIsCreateCourseOpen(false)}
                className="p-2 sm:p-1.5 shrink-0 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitCreateCourse} className="flex-1 min-h-0 flex flex-col overflow-hidden">
              <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 text-xs">
                {createCourseError && (
                  <div className="p-3 rounded-xl bg-rose-50 text-rose-700 dark:bg-rose-950/80 dark:text-rose-300 text-xs font-semibold border border-rose-200 dark:border-rose-800 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span className="min-w-0 break-words">{createCourseError}</span>
                  </div>
                )}

                {createCourseSuccess && (
                  <div className="p-3 rounded-xl bg-emerald-50 text-emerald-700 dark:bg-emerald-950/80 dark:text-emerald-300 text-xs font-semibold border border-emerald-200 dark:border-emerald-800 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span className="min-w-0 break-words">{createCourseSuccess}</span>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="sm:col-span-2">
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Course / Subject Title <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Social Studies, Computer Science, Biology..."
                      value={newCourseName}
                      onChange={(e) => setNewCourseName(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 font-medium focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-hidden"
                      required
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Link to Standard / Program <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={newCourseProgram}
                      onChange={(e) => setNewCourseProgram(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 font-medium focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-hidden"
                      required
                    >
                      {availableProgramsList.map((prog) => (
                        <option key={prog} value={prog}>
                          {prog}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Grading Scale
                    </label>
                    <input
                      type="text"
                      value={newCourseGradingScale}
                      placeholder="Leave empty to use the default grading scale"
                      onChange={(e) => setNewCourseGradingScale(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 font-medium focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-hidden"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Department (Optional)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Sciences, Humanities, Languages..."
                      value={newCourseDept}
                      onChange={(e) => setNewCourseDept(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 font-medium focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-hidden"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Course Syllabus Description (Optional)
                    </label>
                    <textarea
                      rows={2}
                      placeholder="Overview of learning outcomes, curriculum units..."
                      value={newCourseDesc}
                      onChange={(e) => setNewCourseDesc(e.target.value)}
                      className="w-full p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 font-medium focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-hidden"
                    />
                  </div>
                </div>
              </div>

              <div className="p-4 sm:p-5 pt-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/70 flex flex-wrap items-center justify-end gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsCreateCourseOpen(false)}
                  className="px-4 py-2.5 sm:py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createCourseSubmitting}
                  className="px-5 py-2.5 sm:py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold transition shadow-xs flex items-center gap-1.5 disabled:opacity-50"
                >
                  {createCourseSubmitting ? (
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Plus className="w-3.5 h-3.5" />
                  )}
                  <span>Create Course</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: QUICK SCHEDULE LECTURE */}
      {isQuickScheduleOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs overflow-y-auto animate-fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-md max-h-[92vh] flex flex-col my-auto overflow-hidden shadow-2xl">
            <div className="p-4 sm:p-5 pb-3 border-b border-slate-100 dark:border-slate-800 shrink-0 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shadow-xs shrink-0">
                  <Calendar className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-base font-extrabold text-slate-900 dark:text-slate-100 break-words">
                    Schedule Class Lecture
                  </h3>
                  <p className="text-xs text-slate-400">Register lecture session in timetable</p>
                </div>
              </div>
              <button
                onClick={() => setIsQuickScheduleOpen(false)}
                className="p-2 sm:p-1.5 shrink-0 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitQuickSchedule} className="flex-1 min-h-0 flex flex-col overflow-hidden">
              <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 text-xs">
                {quickScheduleError && (
                  <div className="p-3 rounded-xl bg-rose-50 text-rose-700 dark:bg-rose-950/80 dark:text-rose-300 text-xs font-semibold border border-rose-200 dark:border-rose-800 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span className="min-w-0 break-words">{quickScheduleError}</span>
                  </div>
                )}

                {quickScheduleSuccess && (
                  <div className="p-3 rounded-xl bg-emerald-50 text-emerald-700 dark:bg-emerald-950/80 dark:text-emerald-300 text-xs font-semibold border border-emerald-200 dark:border-emerald-800 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span className="min-w-0 break-words">{quickScheduleSuccess}</span>
                  </div>
                )}

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Subject / Course <span className="text-rose-500">*</span>
                  </label>
                  <div className="px-3.5 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-bold flex flex-wrap items-center justify-between gap-x-2 gap-y-0.5">
                    <span className="break-words min-w-0">{scheduleFormData.course}</span>
                    <span className="text-[11px] text-slate-400 uppercase font-mono break-all">{selectedProgram}</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Student Group / Section <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={scheduleFormData.student_group}
                      onChange={(e) => setScheduleFormData({ ...scheduleFormData, student_group: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 font-medium focus:ring-2 focus:ring-indigo-500/20 outline-hidden"
                      required
                    >
                      {scheduleMeta.student_groups?.map((g) => (
                        <option key={g.name} value={g.name}>
                          {g.student_group_name || g.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Instructor <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={scheduleFormData.instructor}
                      onChange={(e) => setScheduleFormData({ ...scheduleFormData, instructor: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 font-medium focus:ring-2 focus:ring-indigo-500/20 outline-hidden"
                      required
                    >
                      {scheduleMeta.instructors?.map((inst) => (
                        <option key={inst.name} value={inst.name}>
                          {inst.instructor_name || inst.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Lecture Date <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="date"
                      value={scheduleFormData.schedule_date}
                      onChange={(e) => setScheduleFormData({ ...scheduleFormData, schedule_date: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 font-medium focus:ring-2 focus:ring-indigo-500/20 outline-hidden font-mono"
                      required
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                      From Time <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="time"
                      value={scheduleFormData.from_time}
                      onChange={(e) => setScheduleFormData({ ...scheduleFormData, from_time: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 font-medium font-mono"
                      required
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                      To Time <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="time"
                      value={scheduleFormData.to_time}
                      onChange={(e) => setScheduleFormData({ ...scheduleFormData, to_time: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 font-medium font-mono"
                      required
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Classroom / Room
                    </label>
                    <select
                      value={scheduleFormData.room}
                      onChange={(e) => setScheduleFormData({ ...scheduleFormData, room: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 font-medium"
                    >
                      {scheduleMeta.rooms?.map((rm) => (
                        <option key={rm.name} value={rm.name}>
                          {rm.room_name || rm.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <div className="p-4 sm:p-5 pt-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/70 flex flex-wrap items-center justify-end gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsQuickScheduleOpen(false)}
                  className="px-4 py-2.5 sm:py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={quickScheduleSubmitting}
                  className="px-5 py-2.5 sm:py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold transition shadow-xs flex items-center gap-1.5 disabled:opacity-50"
                >
                  {quickScheduleSubmitting ? (
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Calendar className="w-3.5 h-3.5" />
                  )}
                  <span>Schedule Lecture</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: CREATE ACADEMIC YEAR */}
      {isCreateYearOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs overflow-y-auto animate-fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-md max-h-[92vh] flex flex-col my-auto overflow-hidden shadow-2xl">
            <div className="p-4 sm:p-5 pb-3 border-b border-slate-100 dark:border-slate-800 shrink-0 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shadow-xs shrink-0">
                  <Calendar className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-base font-extrabold text-slate-900 dark:text-slate-100 break-words">
                    New Academic Year
                  </h3>
                  <p className="text-xs text-slate-400">Define an institutional academic calendar year</p>
                </div>
              </div>
              <button
                onClick={() => setIsCreateYearOpen(false)}
                className="p-2 sm:p-1.5 shrink-0 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitCreateYear} className="flex-1 min-h-0 flex flex-col overflow-hidden">
              <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 text-xs">
                {createYearError && (
                  <div className="p-3 rounded-xl bg-rose-50 text-rose-700 dark:bg-rose-950/80 dark:text-rose-300 text-xs font-semibold border border-rose-200 dark:border-rose-800 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span className="min-w-0 break-words">{createYearError}</span>
                  </div>
                )}

                {createYearSuccess && (
                  <div className="p-3 rounded-xl bg-emerald-50 text-emerald-700 dark:bg-emerald-950/80 dark:text-emerald-300 text-xs font-semibold border border-emerald-200 dark:border-emerald-800 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span className="min-w-0 break-words">{createYearSuccess}</span>
                  </div>
                )}

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Academic Year Title <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder={`e.g. ${yearPresetBase}-${yearPresetBase + 1}`}
                    value={newYearData.academic_year_name}
                    onChange={(e) => setNewYearData({ ...newYearData, academic_year_name: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 font-bold focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-hidden font-mono"
                    required
                  />
                  <p className="text-[11px] text-slate-400 mt-1">
                    Standard format: YYYY-YYYY (e.g. {yearPresetBase}-{yearPresetBase + 1})
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Start Date <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="date"
                      value={newYearData.year_start_date}
                      onChange={(e) => handleYearStartDateChange(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 font-medium focus:ring-2 focus:ring-indigo-500/20 outline-hidden font-mono"
                      required
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                      End Date <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="date"
                      value={newYearData.year_end_date}
                      onChange={(e) => setNewYearData({ ...newYearData, year_end_date: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 font-medium focus:ring-2 focus:ring-indigo-500/20 outline-hidden font-mono"
                      required
                    />
                  </div>
                </div>

                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[11px] text-slate-400 font-semibold">Presets:</span>
                  {[yearPresetBase, yearPresetBase + 1].map((startYear) => (
                    <button
                      key={startYear}
                      type="button"
                      onClick={() => setNewYearData(buildYearPreset(startYear))}
                      className="px-2.5 py-1.5 sm:px-2 sm:py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-[11px] font-mono text-slate-600 dark:text-slate-300 hover:bg-slate-200"
                    >
                      {startYear}-{startYear + 1}
                    </button>
                  ))}
                </div>
              </div>

              <div className="p-4 sm:p-5 pt-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/70 flex flex-wrap items-center justify-end gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsCreateYearOpen(false)}
                  className="px-4 py-2.5 sm:py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold hover:bg-slate-200 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createYearSubmitting}
                  className="px-5 py-2.5 sm:py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-brand-600 hover:from-indigo-700 hover:to-brand-700 text-white font-bold transition flex items-center gap-1.5 shadow-md shadow-indigo-500/20 disabled:opacity-50"
                >
                  {createYearSubmitting ? (
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Check className="w-3.5 h-3.5" />
                  )}
                  <span>Create Academic Year</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: CREATE ACADEMIC TERM */}
      {isCreateTermOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs overflow-y-auto animate-fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-md max-h-[92vh] flex flex-col my-auto overflow-hidden shadow-2xl">
            <div className="p-4 sm:p-5 pb-3 border-b border-slate-100 dark:border-slate-800 shrink-0 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-10 h-10 rounded-2xl bg-sky-50 dark:bg-sky-950/80 text-sky-600 dark:text-sky-400 flex items-center justify-center shadow-xs shrink-0">
                  <Clock className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-base font-extrabold text-slate-900 dark:text-slate-100 break-words">
                    New Academic Term
                  </h3>
                  <p className="text-xs text-slate-400">Define a semester or period within an academic year</p>
                </div>
              </div>
              <button
                onClick={() => setIsCreateTermOpen(false)}
                className="p-2 sm:p-1.5 shrink-0 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitCreateTerm} className="flex-1 min-h-0 flex flex-col overflow-hidden">
              <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 text-xs">
                {createTermError && (
                  <div className="p-3 rounded-xl bg-rose-50 text-rose-700 dark:bg-rose-950/80 dark:text-rose-300 text-xs font-semibold border border-rose-200 dark:border-rose-800 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span className="min-w-0 break-words">{createTermError}</span>
                  </div>
                )}

                {createTermSuccess && (
                  <div className="p-3 rounded-xl bg-emerald-50 text-emerald-700 dark:bg-emerald-950/80 dark:text-emerald-300 text-xs font-semibold border border-emerald-200 dark:border-emerald-800 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span className="min-w-0 break-words">{createTermSuccess}</span>
                  </div>
                )}

                {/* Academic Year Selection */}
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Parent Academic Year <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={newTermData.academic_year}
                    onChange={(e) => handleTermYearSelect(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 font-bold focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 outline-hidden font-mono"
                    required
                  >
                    <option value="">Select Academic Year...</option>
                    {availableAcademicYears.map((ay) => (
                      <option key={ay.name} value={ay.name}>
                        {ay.name} ({ay.year_start_date} ~ {ay.year_end_date})
                      </option>
                    ))}
                  </select>
                  {(() => {
                    const y = availableAcademicYears.find((item) => item.name === newTermData.academic_year);
                    return y ? (
                      <p className="text-[11px] text-slate-400 mt-1">
                        Calendar Period: {y.year_start_date} to {y.year_end_date}
                      </p>
                    ) : null;
                  })()}
                </div>

                {/* Term Name */}
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Term / Semester Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Term 1, Semester 1, Summer Term"
                    value={newTermData.term_name}
                    onChange={(e) => setNewTermData({ ...newTermData, term_name: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 font-bold focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 outline-hidden"
                    required
                  />
                </div>

                {/* Quick Preset Badges */}
                <div className="space-y-1">
                  <span className="text-[11px] text-slate-400 font-semibold block">Presets:</span>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {['Term 1', 'Term 2', 'Semester 1', 'Semester 2', 'Summer Term'].map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => applyTermPreset(preset)}
                        className={`px-2.5 py-1.5 sm:py-1 rounded-lg text-[11px] font-bold border transition ${
                          newTermData.term_name === preset
                            ? 'bg-sky-500 text-white border-sky-500 shadow-xs'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-200 cursor-pointer'
                        }`}
                      >
                        {preset}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Term Start Date & End Date */}
                {(() => {
                  const y = availableAcademicYears.find((item) => item.name === newTermData.academic_year);
                  return (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                          Term Start Date <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="date"
                          value={newTermData.term_start_date}
                          min={y?.year_start_date || undefined}
                          max={y?.year_end_date || undefined}
                          onChange={(e) => setNewTermData({ ...newTermData, term_start_date: e.target.value })}
                          className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 font-medium focus:ring-2 focus:ring-sky-500/20 outline-hidden font-mono"
                          required
                        />
                      </div>

                      <div>
                        <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                          Term End Date <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="date"
                          value={newTermData.term_end_date}
                          min={newTermData.term_start_date || y?.year_start_date || undefined}
                          max={y?.year_end_date || undefined}
                          onChange={(e) => setNewTermData({ ...newTermData, term_end_date: e.target.value })}
                          className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 font-medium focus:ring-2 focus:ring-sky-500/20 outline-hidden font-mono"
                          required
                        />
                      </div>
                    </div>
                  );
                })()}

                {/* Live Preview Pill */}
                <div className="p-2.5 rounded-xl bg-sky-50/70 dark:bg-sky-950/40 border border-sky-100 dark:border-sky-900/60 flex items-center justify-between gap-2">
                  <span className="text-[11px] font-semibold text-slate-400 shrink-0">Term ID Preview:</span>
                  <span className="text-[11px] font-mono font-bold text-sky-700 dark:text-sky-300 truncate min-w-0">
                    {newTermData.academic_year && newTermData.term_name 
                      ? `${newTermData.academic_year} (${newTermData.term_name})`
                      : '—'}
                  </span>
                </div>
              </div>

              <div className="p-4 sm:p-5 pt-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/70 flex flex-wrap items-center justify-end gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsCreateTermOpen(false)}
                  className="px-4 py-2.5 sm:py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold hover:bg-slate-200 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createTermSubmitting}
                  className="px-5 py-2.5 sm:py-2 rounded-xl bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-700 hover:to-indigo-700 text-white font-bold transition flex items-center gap-1.5 shadow-md shadow-sky-500/20 disabled:opacity-50 cursor-pointer"
                >
                  {createTermSubmitting ? (
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Check className="w-3.5 h-3.5" />
                  )}
                  <span>Create Academic Term</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
