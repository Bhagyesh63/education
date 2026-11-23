import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Users, 
  CheckCircle2, 
  ArrowRight, 
  User, 
  Search, 
  Mail, 
  Calendar, 
  Sparkles, 
  BookOpen, 
  Filter, 
  Phone, 
  MapPin, 
  Shield, 
  Award, 
  Plus, 
  X, 
  ExternalLink, 
  Clock, 
  LayoutGrid, 
  List, 
  GraduationCap, 
  Check, 
  AlertCircle, 
  Eye,
  Hash,
  Activity,
  Layers,
  HeartHandshake,
  Trash2
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/frappeClient';

export default function StudentsView({ onSelectStudent }) {
  const { 
    isStaff, 
    isAdmin, 
    isGuardian, 
    isStudent, 
    students, 
    activeStudentId, 
    selectStudent, 
    studentProfile 
  } = useAuth();
  
  const navigate = useNavigate();

  // State for Staff / Teacher Directory view
  const [directory, setDirectory] = useState([]);
  const [metadata, setMetadata] = useState({ programs: [], academic_years: [], academic_terms: [], student_groups: [] });
  const [loading, setLoading] = useState(isStaff || isStudent);
  const [searchTerm, setSearchTerm] = useState('');
  const [programFilter, setProgramFilter] = useState('all');
  const [groupFilter, setGroupFilter] = useState('all');
  const [viewMode, setViewMode] = useState('grid'); // 'grid' | 'table'

  // Student Profile Dossier Modal State
  const [selectedStudentDetail, setSelectedStudentDetail] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [modalTab, setModalTab] = useState('overview'); // 'overview' | 'courses' | 'enrollments' | 'guardians' | 'attendance' | 'logs'

  // Student Role personal profile state
  const [myDossier, setMyDossier] = useState(null);
  const [myDossierTab, setMyDossierTab] = useState('overview');

  // Enroll in Program Modal State (Single & Bulk)
  const [enrollModalOpen, setEnrollModalOpen] = useState(false);
  const [enrollMode, setEnrollMode] = useState('single'); // 'single' | 'bulk'
  const [bulkSelectedStudents, setBulkSelectedStudents] = useState([]);
  const [bulkSourceFilter, setBulkSourceFilter] = useState('all');
  const [bulkSearch, setBulkSearch] = useState('');
  const [enrollData, setEnrollData] = useState({
    student: '',
    program: '',
    academic_year: '',
    academic_term: '',
    student_group: '',
  });
  const [enrollSubmitting, setEnrollSubmitting] = useState(false);
  const [enrollError, setEnrollError] = useState(null);
  const [enrollSuccess, setEnrollSuccess] = useState(null);

  // Assign Section / Group Modal State
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [assignData, setAssignData] = useState({
    student: '',
    student_name: '',
    student_group: '',
    roll_number: '',
  });
  const [assignSubmitting, setAssignSubmitting] = useState(false);
  const [assignError, setAssignError] = useState(null);
  const [assignSuccess, setAssignSuccess] = useState(null);

  // Add Elective Course Modal / Popover State
  const [showAddCourseModal, setShowAddCourseModal] = useState(false);
  const [availableCoursesData, setAvailableCoursesData] = useState([]);
  const [selectedCourseToEnroll, setSelectedCourseToEnroll] = useState('');
  const [courseActionLoading, setCourseActionLoading] = useState(false);
  const [courseActionMsg, setCourseActionMsg] = useState(null);

  // Create Academic Year Modal State
  const [createYearModalOpen, setCreateYearModalOpen] = useState(false);
  const [newYearData, setNewYearData] = useState({
    academic_year_name: '',
    year_start_date: '',
    year_end_date: '',
  });
  const [createYearSubmitting, setCreateYearSubmitting] = useState(false);
  const [createYearError, setCreateYearError] = useState(null);
  const [createYearSuccess, setCreateYearSuccess] = useState(null);

  // Create Academic Term Modal State
  const [createTermModalOpen, setCreateTermModalOpen] = useState(false);
  const [newTermData, setNewTermData] = useState({
    academic_year: '',
    term_name: 'Term 1',
    term_start_date: '',
    term_end_date: '',
  });
  const [createTermSubmitting, setCreateTermSubmitting] = useState(false);
  const [createTermError, setCreateTermError] = useState(null);
  const [createTermSuccess, setCreateTermSuccess] = useState(null);

  // Create Student Group / Section Modal State
  const [createGroupModalOpen, setCreateGroupModalOpen] = useState(false);
  const [newGroupData, setNewGroupData] = useState({
    student_group_name: '',
    program: '',
    academic_year: '',
    academic_term: '',
    group_based_on: 'Batch',
    max_strength: 40,
    section_letter: 'B',
  });
  const [createGroupSubmitting, setCreateGroupSubmitting] = useState(false);
  const [createGroupError, setCreateGroupError] = useState(null);
  const [createGroupSuccess, setCreateGroupSuccess] = useState(null);

  // Fetch Directory and Metadata for Staff
  const loadDirectoryData = () => {
    if (!isStaff) return;
    setLoading(true);
    Promise.all([
      api.getStudentDirectory(),
      api.getEnrollmentMetadata ? api.getEnrollmentMetadata().catch(() => null) : Promise.resolve(null),
    ])
      .then(([dirData, metaData]) => {
        setDirectory(dirData || []);
        if (metaData) {
          setMetadata(metaData);
        }
      })
      .catch((err) => {
        console.error('Failed to load student directory data:', err);
      })
      .finally(() => {
        setLoading(false);
      });
  };

  useEffect(() => {
    if (isStaff) {
      loadDirectoryData();
    }
  }, [isStaff]);

  // If role is Student, fetch complete dossier for active student
  useEffect(() => {
    if (!isStudent) return;
    setLoading(true);
    const targetStudent = activeStudentId || studentProfile?.name || 'EDU-STU-2026-00001';
    api.getStudentProfile(targetStudent)
      .then((data) => {
        setMyDossier(data);
      })
      .catch((err) => {
        console.error('Failed to load student dossier:', err);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [isStudent, activeStudentId, studentProfile]);

  // Open Full Profile Dossier Modal
  const handleOpenProfileModal = async (studentId) => {
    setLoadingDetail(true);
    setDetailModalOpen(true);
    setModalTab('overview');
    try {
      const data = await api.getStudentProfile(studentId);
      setSelectedStudentDetail(data);
    } catch (err) {
      console.error('Failed to fetch student profile:', err);
    } finally {
      setLoadingDetail(false);
    }
  };

  // Open Program Enrollment Modal (Supports Single & Bulk Cohorts)
  const handleOpenEnrollModal = (targetStudentId = null, initialMode = 'single') => {
    const studentId = targetStudentId || selectedStudentDetail?.student?.name || (directory[0]?.name || '');

    const initialSourceFilter = programFilter && programFilter !== 'all' ? programFilter : 'all';
    setBulkSourceFilter(initialSourceFilter);

    // Smart default for destination program: if on Standard 6, suggest Standard 7; if Standard 5, suggest Standard 6
    let defaultProg = metadata.programs?.[0]?.name || 'Standard 5';
    if (initialSourceFilter === 'Standard 6' && metadata.programs?.some((p) => p.name === 'Standard 7')) {
      defaultProg = 'Standard 7';
    } else if (initialSourceFilter === 'Standard 5' && metadata.programs?.some((p) => p.name === 'Standard 6')) {
      defaultProg = 'Standard 6';
    }

    const defaultYear = metadata.academic_years?.[0]?.name || '2028-2029';
    const defaultSection = metadata.student_groups?.find((sg) => sg.program === defaultProg)?.name || '';

    setEnrollMode(initialMode);
    setEnrollData({
      student: studentId,
      program: defaultProg,
      academic_year: defaultYear,
      academic_term: '',
      student_group: defaultSection,
    });

    if (initialMode === 'bulk') {
      const initialMatching = directory.filter((s) => {
        const progs = Array.isArray(s.programs) ? s.programs : (s.program ? [s.program] : []);
        const isUnenrolled =
          progs.length === 0 ||
          progs.every((p) => !p || p === 'Unassigned' || p === 'Unenrolled');
        if (initialSourceFilter === 'unenrolled') return isUnenrolled;
        if (initialSourceFilter !== 'all') return progs.includes(initialSourceFilter);
        return true;
      });
      setBulkSelectedStudents(initialMatching.map((s) => s.name));
    } else {
      setBulkSelectedStudents(studentId ? [studentId] : []);
    }
    setBulkSearch('');
    setEnrollError(null);
    setEnrollSuccess(null);
    setEnrollModalOpen(true);
  };

  const handleSubmitEnroll = async (e) => {
    e.preventDefault();

    if (enrollMode === 'bulk') {
      if (!bulkSelectedStudents || bulkSelectedStudents.length === 0) {
        setEnrollError('Please select at least one student for bulk enrollment.');
        return;
      }
      if (!enrollData.program || !enrollData.academic_year) {
        setEnrollError('Please select destination Program and Academic Year.');
        return;
      }
      setEnrollSubmitting(true);
      setEnrollError(null);
      try {
        const res = await api.bulkEnrollStudentsInProgram({
          students: bulkSelectedStudents,
          program: enrollData.program,
          academic_year: enrollData.academic_year,
          academic_term: enrollData.academic_term || null,
          student_group: enrollData.student_group || null,
        });

        const enrolledCount = res?.enrolled_count ?? bulkSelectedStudents.length;
        const skippedCount = res?.skipped_count ?? 0;
        setEnrollSuccess(
          `Successfully processed! Enrolled ${enrolledCount} student(s) into ${enrollData.program} (${enrollData.academic_year}).${
            skippedCount > 0 ? ` (${skippedCount} already enrolled and skipped)` : ''
          }`
        );

        loadDirectoryData();
        setTimeout(() => {
          setEnrollModalOpen(false);
          setEnrollSuccess(null);
        }, 2000);
      } catch (err) {
        console.error('Failed to submit bulk enrollment:', err);
        setEnrollError(err.message || 'Failed to complete bulk enrollment.');
      } finally {
        setEnrollSubmitting(false);
      }
    } else {
      // Single student mode
      if (!enrollData.student || !enrollData.program || !enrollData.academic_year) {
        setEnrollError('Please select Student, Program, and Academic Year.');
        return;
      }
      setEnrollSubmitting(true);
      setEnrollError(null);
      try {
        await api.enrollStudentInProgram({
          student: enrollData.student,
          program: enrollData.program,
          academic_year: enrollData.academic_year,
          academic_term: enrollData.academic_term || null,
        });

        // Also assign student to section group if specified
        if (enrollData.student_group && api.assignStudentToGroup) {
          try {
            await api.assignStudentToGroup({
              student: enrollData.student,
              student_group: enrollData.student_group,
            });
          } catch (grpErr) {
            console.warn('Group assignment note:', grpErr);
          }
        }

        setEnrollSuccess(`Successfully enrolled in ${enrollData.program} (${enrollData.academic_year})!`);
        loadDirectoryData();
        if (selectedStudentDetail && selectedStudentDetail.student?.name === enrollData.student) {
          const updated = await api.getStudentProfile(enrollData.student);
          setSelectedStudentDetail(updated);
        }
        setTimeout(() => {
          setEnrollModalOpen(false);
          setEnrollSuccess(null);
        }, 1500);
      } catch (err) {
        console.error('Failed to submit enrollment:', err);
        setEnrollError(err.message || 'Failed to enroll student into program.');
      } finally {
        setEnrollSubmitting(false);
      }
    }
  };

  // Open Assign Section Modal
  const handleOpenAssignModal = (studentObj) => {
    // Find matching group for student's program
    const matchingGroup = metadata.student_groups?.find(sg => 
      studentObj.programs && studentObj.programs.includes(sg.program)
    );
    const defaultGroup = matchingGroup?.name || metadata.student_groups?.[0]?.name || 'Standard 5 - Section A';
    setAssignData({
      student: studentObj.name,
      student_name: studentObj.student_name,
      student_group: defaultGroup,
      roll_number: studentObj.roll_number || '',
    });
    setAssignError(null);
    setAssignSuccess(null);
    setAssignModalOpen(true);
  };

  const handleSubmitAssign = async (e) => {
    e.preventDefault();
    if (!assignData.student || !assignData.student_group) {
      setAssignError('Please select Student and Section / Group.');
      return;
    }
    setAssignSubmitting(true);
    setAssignError(null);
    try {
      await api.assignStudentToGroup({
        student: assignData.student,
        student_group: assignData.student_group,
        roll_number: assignData.roll_number ? parseInt(assignData.roll_number, 10) : null,
      });
      setAssignSuccess(`Assigned to ${assignData.student_group} successfully!`);
      loadDirectoryData();
      if (selectedStudentDetail && selectedStudentDetail.student?.name === assignData.student) {
        const updated = await api.getStudentProfile(assignData.student);
        setSelectedStudentDetail(updated);
      }
      setTimeout(() => {
        setAssignModalOpen(false);
        setAssignSuccess(null);
      }, 1500);
    } catch (err) {
      console.error('Failed to assign section:', err);
      setAssignError(err.message || 'Failed to assign student to section.');
    } finally {
      setAssignSubmitting(false);
    }
  };

  // Elective Course Handlers
  const handleOpenAddCourseModal = async (studentId) => {
    setShowAddCourseModal(true);
    setCourseActionLoading(true);
    setCourseActionMsg(null);
    try {
      const data = await api.getAvailableCoursesForStudent(studentId);
      const list = data?.available_courses || [];
      setAvailableCoursesData(list);
      if (list.length > 0) {
        setSelectedCourseToEnroll(list[0].course);
      } else {
        setSelectedCourseToEnroll('');
      }
    } catch (err) {
      console.error('Failed to fetch available courses:', err);
      setCourseActionMsg({ type: 'error', text: 'Failed to fetch available courses.' });
    } finally {
      setCourseActionLoading(false);
    }
  };

  const handleEnrollCourse = async (studentId) => {
    if (!selectedCourseToEnroll) return;
    setCourseActionLoading(true);
    setCourseActionMsg(null);
    try {
      await api.enrollStudentInCourse({
        student: studentId,
        course: selectedCourseToEnroll,
      });
      setCourseActionMsg({ type: 'success', text: `Enrolled in ${selectedCourseToEnroll} successfully!` });
      const updatedProfile = await api.getStudentProfile(studentId);
      setSelectedStudentDetail(updatedProfile);
      const updatedAvail = await api.getAvailableCoursesForStudent(studentId);
      const list = updatedAvail?.available_courses || [];
      setAvailableCoursesData(list);
      setSelectedCourseToEnroll(list.length > 0 ? list[0].course : '');
      setTimeout(() => setCourseActionMsg(null), 3500);
    } catch (err) {
      setCourseActionMsg({ type: 'error', text: err.message || 'Failed to enroll course.' });
    } finally {
      setCourseActionLoading(false);
    }
  };

  const handleDropCourse = async (studentId, enrollmentId, courseName) => {
    if (!window.confirm(`Are you sure you want to drop course enrollment for ${courseName}?`)) return;
    setCourseActionLoading(true);
    setCourseActionMsg(null);
    try {
      await api.dropCourseEnrollment(enrollmentId);
      setCourseActionMsg({ type: 'success', text: `Dropped ${courseName} successfully.` });
      const updatedProfile = await api.getStudentProfile(studentId);
      setSelectedStudentDetail(updatedProfile);
      setTimeout(() => setCourseActionMsg(null), 3500);
    } catch (err) {
      setCourseActionMsg({ type: 'error', text: err.message || 'Failed to drop course.' });
    } finally {
      setCourseActionLoading(false);
    }
  };

  // Open Create Academic Year Modal
  const handleOpenCreateYearModal = () => {
    let defaultStart = '2029-04-01';
    let defaultEnd = '2030-03-31';
    let defaultName = '2029-2030';

    if (metadata.academic_years && metadata.academic_years.length > 0) {
      const topYear = metadata.academic_years[0];
      if (topYear.year_end_date) {
        const endDateObj = new Date(topYear.year_end_date);
        const nextStartObj = new Date(endDateObj);
        nextStartObj.setDate(nextStartObj.getDate() + 1);
        const nextStartYear = nextStartObj.getFullYear();
        const nextEndYear = nextStartYear + 1;
        defaultStart = `${nextStartYear}-04-01`;
        defaultEnd = `${nextEndYear}-03-31`;
        defaultName = `${nextStartYear}-${nextEndYear}`;
      }
    }

    setNewYearData({
      academic_year_name: defaultName,
      year_start_date: defaultStart,
      year_end_date: defaultEnd,
    });
    setCreateYearError(null);
    setCreateYearSuccess(null);
    setCreateYearModalOpen(true);
  };

  const handleStartDateChange = (startDateStr) => {
    if (!startDateStr) {
      setNewYearData((prev) => ({ ...prev, year_start_date: startDateStr }));
      return;
    }
    const d = new Date(startDateStr);
    const startYear = d.getFullYear();
    const endYear = startYear + 1;
    const computedEnd = `${endYear}-03-31`;
    const computedName = `${startYear}-${endYear}`;
    setNewYearData({
      academic_year_name: computedName,
      year_start_date: startDateStr,
      year_end_date: computedEnd,
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

      // Refresh metadata
      const metaData = await api.getEnrollmentMetadata().catch(() => null);
      if (metaData) {
        setMetadata(metaData);
      } else {
        setMetadata((prev) => ({
          ...prev,
          academic_years: [
            {
              name: createdName,
              academic_year_name: createdName,
              year_start_date: newYearData.year_start_date,
              year_end_date: newYearData.year_end_date,
            },
            ...(prev.academic_years || []),
          ],
        }));
      }

      setEnrollData((prev) => ({ ...prev, academic_year: createdName }));

      setTimeout(() => {
        setCreateYearModalOpen(false);
        setCreateYearSuccess(null);
      }, 1500);
    } catch (err) {
      console.error('Failed to create academic year:', err);
      setCreateYearError(err.message || 'Failed to create academic year.');
    } finally {
      setCreateYearSubmitting(false);
    }
  };

  const handleOpenCreateTermModal = (preselectedYear = null) => {
    const activeYear = preselectedYear || enrollData.academic_year || metadata.academic_years?.[0]?.name || '2026-2027';
    const yearObj = metadata.academic_years?.find((y) => y.name === activeYear);
    let defaultStart = yearObj?.year_start_date || '2026-04-01';
    let defaultEnd = '2026-09-30';
    if (yearObj?.year_start_date) {
      const startD = new Date(yearObj.year_start_date);
      const midD = new Date(startD);
      midD.setMonth(midD.getMonth() + 6);
      midD.setDate(0);
      defaultEnd = midD.toISOString().split('T')[0];
    }

    setNewTermData({
      academic_year: activeYear,
      term_name: 'Term 1',
      term_start_date: defaultStart,
      term_end_date: defaultEnd,
    });
    setCreateTermError(null);
    setCreateTermSuccess(null);
    setCreateTermModalOpen(true);
  };

  const handleTermYearSelect = (yearName) => {
    const yearObj = metadata.academic_years?.find((y) => y.name === yearName);
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
    const yearObj = metadata.academic_years?.find((y) => y.name === newTermData.academic_year);
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

    const yearObj = metadata.academic_years?.find((y) => y.name === newTermData.academic_year);
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

      // Refresh metadata
      const metaData = await api.getEnrollmentMetadata().catch(() => null);
      if (metaData) {
        setMetadata(metaData);
      } else {
        setMetadata((prev) => ({
          ...prev,
          academic_terms: [
            {
              name: createdName,
              academic_year: newTermData.academic_year,
              term_name: newTermData.term_name,
              term_start_date: newTermData.term_start_date,
              term_end_date: newTermData.term_end_date,
            },
            ...(prev.academic_terms || []),
          ],
        }));
      }

      setEnrollData((prev) => ({ ...prev, academic_term: createdName }));

      setTimeout(() => {
        setCreateTermModalOpen(false);
        setCreateTermSuccess(null);
      }, 1500);
    } catch (err) {
      console.error('Failed to create academic term:', err);
      setCreateTermError(err.message || 'Failed to create academic term.');
    } finally {
      setCreateTermSubmitting(false);
    }
  };

  const handleOpenCreateGroupModal = (preselectedProgram = null, preselectedYear = null) => {
    const defaultProg = preselectedProgram || enrollData.program || metadata.programs?.[0]?.name || 'Standard 5';
    const defaultYear = preselectedYear || enrollData.academic_year || metadata.academic_years?.[0]?.name || '2026-2027';
    setNewGroupData({
      student_group_name: `${defaultProg} - Section B`,
      program: defaultProg,
      academic_year: defaultYear,
      academic_term: enrollData.academic_term || '',
      group_based_on: 'Batch',
      max_strength: 40,
      section_letter: 'B',
    });
    setCreateGroupError(null);
    setCreateGroupSuccess(null);
    setCreateGroupModalOpen(true);
  };

  const handleGroupProgramChange = (progName, letter = newGroupData.section_letter || 'B') => {
    const generatedName = progName && letter ? `${progName} - Section ${letter}` : newGroupData.student_group_name;
    setNewGroupData((prev) => ({
      ...prev,
      program: progName,
      section_letter: letter,
      student_group_name: generatedName,
    }));
  };

  const handleSectionLetterClick = (letter) => {
    const prog = newGroupData.program || 'Standard 5';
    setNewGroupData((prev) => ({
      ...prev,
      section_letter: letter,
      student_group_name: `${prog} - Section ${letter}`,
    }));
  };

  const handleSubmitCreateGroup = async (e) => {
    e.preventDefault();
    if (!newGroupData.student_group_name || !newGroupData.program || !newGroupData.academic_year) {
      setCreateGroupError('Please provide Group Name, Program, and Academic Year.');
      return;
    }

    setCreateGroupSubmitting(true);
    setCreateGroupError(null);
    try {
      const res = await api.createStudentGroup(newGroupData);
      const createdName = res?.student_group_name || newGroupData.student_group_name;
      setCreateGroupSuccess(`Student Group "${createdName}" successfully created!`);

      // Refresh metadata
      const metaData = await api.getEnrollmentMetadata().catch(() => null);
      if (metaData) {
        setMetadata(metaData);
      } else {
        setMetadata((prev) => ({
          ...prev,
          student_groups: [
            {
              name: createdName,
              student_group_name: createdName,
              program: newGroupData.program,
              academic_year: newGroupData.academic_year,
            },
            ...(prev.student_groups || []),
          ],
        }));
      }

      setEnrollData((prev) => ({ ...prev, student_group: createdName }));

      setTimeout(() => {
        setCreateGroupModalOpen(false);
        setCreateGroupSuccess(null);
      }, 1500);
    } catch (err) {
      console.error('Failed to create student group:', err);
      setCreateGroupError(err.message || 'Failed to create student group.');
    } finally {
      setCreateGroupSubmitting(false);
    }
  };

  const handlePickWard = async (studentId) => {
    await selectStudent(studentId);
    if (onSelectStudent) {
      onSelectStudent(studentId);
    }
    navigate('/dashboard');
  };

  // =========================================================================
  // 1. STUDENT ROLE VIEW: MY ACADEMIC DOSSIER & PROFILE
  // =========================================================================
  if (isStudent) {
    const student = myDossier?.student || studentProfile || {};
    const programsList = myDossier?.programs || [];
    const guardiansList = myDossier?.guardians || [];
    const studentGroupsList = myDossier?.student_groups || [];
    const coursesList = myDossier?.enrolled_courses || [];
    const attendanceStats = myDossier?.attendance_summary || { total: 0, present: 0, absent: 0, percentage: 100 };
    const logsList = myDossier?.recent_logs || [];

    const initials = (student.student_name || 'Student')
      .split(' ')
      .filter(Boolean)
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2) || 'ST';

    return (
      <div className="space-y-6">
        {/* Hero Identity Banner */}
        <div className="glass-panel p-6 sm:p-8 rounded-3xl border border-slate-200/80 dark:border-slate-800 relative overflow-hidden bg-gradient-to-br from-white/80 via-white/50 to-brand-50/30 dark:from-slate-900/90 dark:via-slate-900/60 dark:to-brand-950/20 shadow-xs">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
            <div className="flex items-center gap-5">
              <div className="w-20 h-20 rounded-3xl bg-gradient-to-tr from-brand-600 via-indigo-600 to-purple-600 text-white flex items-center justify-center font-black text-2xl shadow-xl shadow-brand-500/20 shrink-0 border-2 border-white/40 dark:border-slate-700">
                {student.image ? (
                  <img src={student.image} alt={student.student_name} className="w-full h-full object-cover rounded-3xl" />
                ) : (
                  initials
                )}
              </div>

              <div>
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h2 className="text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
                    {student.student_name || 'Student Name'}
                  </h2>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Enrolled & Active
                  </span>
                </div>

                <div className="flex items-center gap-3 mt-1.5 text-xs text-slate-500 dark:text-slate-400 font-medium flex-wrap">
                  <span className="font-mono bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md text-slate-700 dark:text-slate-300">
                    ID: {student.name || 'EDU-STU-2026-00001'}
                  </span>
                  {studentGroupsList.length > 0 && (
                    <span className="flex items-center gap-1 font-semibold text-brand-600 dark:text-brand-400">
                      <Users className="w-3.5 h-3.5" />
                      {studentGroupsList[0].student_group}
                      {studentGroupsList[0].group_roll_number && ` (Roll #${studentGroupsList[0].group_roll_number})`}
                    </span>
                  )}
                  {student.joining_date && (
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      Admission: {student.joining_date}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="px-4 py-2 rounded-2xl bg-white/80 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700 text-center shadow-xs">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Attendance Health</span>
                <span className={`text-lg font-black ${attendanceStats.percentage >= 75 ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>
                  {attendanceStats.percentage}%
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Metric Cards Row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="glass-panel p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 space-y-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">Class & Syllabus</span>
            <span className="text-sm font-black text-slate-800 dark:text-slate-200 truncate block">
              {myDossier?.suggested_program || 'Standard 5'}
            </span>
            <span className="text-[10px] text-slate-500 font-mono">
              Academic Year: {myDossier?.suggested_academic_year || '2026-2027'}
            </span>
          </div>

          <div className="glass-panel p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 space-y-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">Enrolled Subjects</span>
            <span className="text-sm font-black text-brand-600 dark:text-brand-400 block">
              {coursesList.length || 3} Courses
            </span>
            <span className="text-[10px] text-slate-500 truncate block">
              Core curriculum enrolled
            </span>
          </div>

          <div className="glass-panel p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 space-y-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">Emergency Guardian</span>
            <span className="text-sm font-black text-slate-800 dark:text-slate-200 truncate block">
              {guardiansList[0]?.guardian_name || 'Guardian'}
            </span>
            <span className="text-[10px] text-slate-500">
              {guardiansList[0]?.relation || 'Father'}: {guardiansList[0]?.mobile_number || 'Registered'}
            </span>
          </div>

          <div className="glass-panel p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 space-y-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">Attendance Sessions</span>
            <span className="text-sm font-black text-slate-800 dark:text-slate-200 block">
              {attendanceStats.present} / {attendanceStats.total} Days
            </span>
            <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">
              {attendanceStats.absent} absences recorded
            </span>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-2xl overflow-x-auto w-full">
          {[
            { id: 'overview', label: 'Personal & Contact', icon: User },
            { id: 'courses', label: 'Enrolled Courses', icon: BookOpen },
            { id: 'enrollments', label: 'Program History', icon: GraduationCap },
            { id: 'guardians', label: 'Guardians & Contacts', icon: Shield },
            { id: 'attendance', label: 'Attendance Breakdown', icon: Activity },
            { id: 'logs', label: 'Honors & Student Logs', icon: Award },
          ].map((tab) => {
            const Icon = tab.icon;
            const active = myDossierTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setMyDossierTab(tab.id)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap ${
                  active
                    ? 'bg-white dark:bg-slate-700 text-brand-600 dark:text-brand-300 shadow-xs'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Tab Content Panels */}
        <div className="glass-panel p-6 rounded-3xl border border-slate-200/80 dark:border-slate-800">
          {myDossierTab === 'overview' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-brand-500" />
                  Personal Information
                </h4>
                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div>
                    <span className="text-slate-400 block text-[11px]">Full Name</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">{student.student_name || '—'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">Date of Birth</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">{student.date_of_birth || '—'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">Gender</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">{student.gender || 'Not specified'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">Blood Group</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">{student.blood_group || '—'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">Nationality</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">{student.nationality || 'Indian'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">Enrolled Cohort</span>
                    <span className="font-semibold text-brand-600 dark:text-brand-400">
                      {studentGroupsList[0]?.student_group || 'Standard 5 - Section A'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-brand-500" />
                  Contact & Residential Address
                </h4>
                <div className="space-y-3 text-xs">
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4 text-slate-400 shrink-0" />
                    <span className="font-mono text-slate-700 dark:text-slate-300">{student.student_email_id || 'student@example.com'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Phone className="w-4 h-4 text-slate-400 shrink-0" />
                    <span className="font-mono text-slate-700 dark:text-slate-300">{student.student_mobile_number || 'Not provided'}</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <MapPin className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                    <span className="text-slate-600 dark:text-slate-400 leading-relaxed">
                      {student.address_line_1 ? `${student.address_line_1}, ` : ''}
                      {student.city ? `${student.city}, ` : ''}
                      {student.state ? `${student.state} - ` : ''}
                      {student.pincode || ''}
                      {!student.address_line_1 && !student.city && 'Registered Campus Residence'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {myDossierTab === 'courses' && (
            <div className="space-y-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <BookOpen className="w-3.5 h-3.5 text-brand-500" />
                Active Registered Courses
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {coursesList.map((c, i) => (
                  <div key={i} className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-900 dark:text-slate-100">{c.course_name || c.course}</span>
                      <span className="px-2 py-0.5 rounded-md bg-brand-50 dark:bg-brand-950 text-brand-600 dark:text-brand-400 text-[10px] font-bold">
                        {c.program}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400">Academic Year: {c.academic_year || '2026-2027'}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {myDossierTab === 'enrollments' && (
            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <GraduationCap className="w-3.5 h-3.5 text-brand-500" />
                Program Enrollment History
              </h4>
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {programsList.map((pe, idx) => (
                  <div key={idx} className="py-3 flex items-center justify-between gap-4">
                    <div>
                      <h5 className="font-bold text-xs text-slate-800 dark:text-slate-200">{pe.program}</h5>
                      <span className="text-[11px] font-mono text-slate-400">Enrollment ID: {pe.program_enrollment}</span>
                    </div>
                    <div className="text-right">
                      <span className="px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[10px] font-bold">
                        {pe.academic_year} {pe.academic_term ? `• ${pe.academic_term}` : ''}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {myDossierTab === 'guardians' && (
            <div className="space-y-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5 text-brand-500" />
                Authorized Guardians & Emergency Contacts
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {guardiansList.map((g, idx) => (
                  <div key={idx} className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700 space-y-2">
                    <div className="flex items-center justify-between">
                      <h5 className="font-bold text-sm text-slate-800 dark:text-slate-200">{g.guardian_name}</h5>
                      <span className="px-2 py-0.5 rounded-lg bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 text-[10px] font-bold">
                        {g.relation || 'Parent'}
                      </span>
                    </div>
                    <div className="text-xs text-slate-500 space-y-1">
                      <p className="flex items-center gap-2">
                        <Mail className="w-3.5 h-3.5 text-slate-400" />
                        <span>{g.email_address || 'No email registered'}</span>
                      </p>
                      <p className="flex items-center gap-2">
                        <Phone className="w-3.5 h-3.5 text-slate-400" />
                        <span>{g.mobile_number || 'No phone registered'}</span>
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {myDossierTab === 'attendance' && (
            <div className="space-y-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5 text-brand-500" />
                Attendance Summary & Compliance
              </h4>
              <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700 space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-600 dark:text-slate-400">Total Timetable Sessions Conducted:</span>
                  <span className="font-bold text-slate-900 dark:text-slate-100">{attendanceStats.total} Sessions</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-emerald-600 dark:text-emerald-400">Present Sessions Attended:</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400">{attendanceStats.present}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-rose-600 dark:text-rose-400">Unexcused Absences:</span>
                  <span className="font-bold text-rose-600 dark:text-rose-400">{attendanceStats.absent}</span>
                </div>

                <div className="w-full bg-slate-200 dark:bg-slate-700 h-2 rounded-full overflow-hidden mt-2">
                  <div
                    className="bg-brand-600 h-full rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(100, attendanceStats.percentage)}%` }}
                  />
                </div>
              </div>
            </div>
          )}

          {myDossierTab === 'logs' && (
            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Award className="w-3.5 h-3.5 text-brand-500" />
                Institutional Honors & Activity Logs
              </h4>
              {logsList.length === 0 ? (
                <p className="text-xs text-slate-400 py-4">No recent activity logs or disciplinary notices recorded.</p>
              ) : (
                <div className="space-y-3">
                  {logsList.map((log, idx) => (
                    <div key={idx} className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="px-2 py-0.5 rounded-md bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-400 text-[10px] font-bold uppercase">
                          {log.type}
                        </span>
                        <span className="text-[11px] text-slate-400 font-mono">{log.date}</span>
                      </div>
                      <div 
                        className="text-xs text-slate-700 dark:text-slate-300 pt-1 prose dark:prose-invert max-w-none text-xs"
                        dangerouslySetInnerHTML={{ __html: log.log }}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  // =========================================================================
  // 2. GUARDIAN ROLE VIEW: LINKED WARDS & SELECTOR
  // =========================================================================
  if (isGuardian) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight">
            Linked Students & Wards
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Select a ward to view personalized schedule, attendance, marks, and fee invoices, or inspect their full academic dossier.
          </p>
        </div>

        {students.length === 0 ? (
          <div className="glass-panel rounded-3xl p-12 text-center border border-slate-200/80 dark:border-slate-800">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 flex items-center justify-center mx-auto mb-3">
              <Users className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-sm text-slate-800 dark:text-slate-200">No Wards Linked</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
              Your guardian account does not currently have any student profiles assigned. Please contact the school admissions administrator.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {students.map((ward) => {
              const isSelected = activeStudentId === ward.student;

              return (
                <div
                  key={ward.student}
                  className={`glass-panel p-6 rounded-3xl border transition-all duration-200 relative group overflow-hidden ${
                    isSelected
                      ? 'border-brand-500/80 bg-brand-50/20 dark:bg-brand-950/30 shadow-glow'
                      : 'border-slate-200/80 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-md'
                  }`}
                >
                  {isSelected && (
                    <div className="absolute top-4 right-4 flex items-center gap-1 px-2.5 py-1 rounded-full bg-brand-100 dark:bg-brand-950/80 text-brand-700 dark:text-brand-300 font-bold text-[10px] uppercase tracking-wider">
                      <CheckCircle2 className="w-3.5 h-3.5 text-brand-600 dark:text-brand-400" />
                      Active Portal
                    </div>
                  )}

                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-brand-600 to-indigo-600 text-white overflow-hidden flex items-center justify-center font-bold text-lg shrink-0 shadow-xs">
                      {ward.image ? (
                        <img src={ward.image} alt={ward.student_name} className="w-full h-full object-cover" />
                      ) : (
                        (ward.student_name || 'S').charAt(0).toUpperCase()
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <h3 className="font-bold text-base text-slate-900 dark:text-slate-100 group-hover:text-brand-600 dark:group-hover:text-brand-400 transition truncate">
                        {ward.student_name}
                      </h3>
                      <p className="text-xs text-slate-400 dark:text-slate-500 font-mono mt-0.5 truncate">
                        ID: {ward.student}
                      </p>
                      <span className="inline-block mt-2 px-2.5 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[11px] font-semibold">
                        {ward.relation || 'Ward'}
                      </span>
                    </div>
                  </div>

                  <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                    <button
                      onClick={() => handlePickWard(ward.student)}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-brand-50 dark:bg-brand-950/80 text-brand-600 dark:text-brand-400 text-xs font-bold hover:bg-brand-100 dark:hover:bg-brand-900 transition"
                    >
                      <span>Switch to Ward</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>

                    <button
                      onClick={() => handleOpenProfileModal(ward.student)}
                      className="py-2 px-3 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition flex items-center gap-1"
                      title="View Full Profile Dossier"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Dossier</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Selected Student Profile Modal if triggered from guardian view */}
        {detailModalOpen && renderProfileModal()}
      </div>
    );
  }

  // =========================================================================
  // 3. STAFF / TEACHER / ADMIN VIEW: INSTITUTIONAL STUDENT DIRECTORY
  // =========================================================================
  const filteredStudents = directory.filter((stu) => {
    const matchesSearch = 
      stu.student_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      stu.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (stu.email && stu.email.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (stu.roll_number && String(stu.roll_number).includes(searchTerm));

    const matchesProgram = 
      programFilter === 'all' || 
      (stu.programs && stu.programs.includes(programFilter));

    const matchesGroup = 
      groupFilter === 'all' || 
      (stu.student_groups && stu.student_groups.some(g => g.student_group === groupFilter));

    return matchesSearch && matchesProgram && matchesGroup;
  });

  return (
    <div className="space-y-6">
      {/* Top Banner & Quick Stats */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight flex items-center gap-2">
            Institutional Student Directory
            <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
              v15.2
            </span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Active enrolled students, cohort section rosters, and academic records
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <span className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold border border-slate-200 dark:border-slate-700">
            {directory.length} Registered
          </span>

          {/* Action: Bulk Cohort Enrollment */}
          <button
            onClick={() => handleOpenEnrollModal(null, 'bulk')}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-700 hover:to-indigo-700 text-white text-xs font-bold shadow-md shadow-brand-500/20 transition active:scale-95"
            title="Batch enroll multiple students into a program and section"
          >
            <Users className="w-3.5 h-3.5" />
            <span>Bulk Enrollment</span>
          </button>

          {/* Action: Enroll Single Student in Program */}
          <button
            onClick={() => handleOpenEnrollModal(null, 'single')}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700/60 text-slate-700 dark:text-slate-300 text-xs font-bold shadow-xs transition cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5 text-brand-500" />
            <span>Enroll Single</span>
          </button>

          {/* Action: Create Student Group / Section */}
          <button
            onClick={() => handleOpenCreateGroupModal()}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 text-xs font-bold shadow-xs transition cursor-pointer"
            title="Create a new section or cohort group (e.g. Standard 5 - Section B)"
          >
            <Layers className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>+ Section / Group</span>
          </button>

          {/* Action: Create Academic Year */}
          <button
            onClick={handleOpenCreateYearModal}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl border border-indigo-200 dark:border-indigo-800 bg-indigo-50/50 dark:bg-indigo-950/40 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 text-xs font-bold shadow-xs transition"
            title="Define and create a new academic year period"
          >
            <Calendar className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
            <span>+ Academic Year</span>
          </button>

          {/* Action: Create Academic Term */}
          <button
            onClick={() => handleOpenCreateTermModal()}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl border border-sky-200 dark:border-sky-800 bg-sky-50/50 dark:bg-sky-950/40 hover:bg-sky-100 dark:hover:bg-sky-900/50 text-sky-700 dark:text-sky-300 text-xs font-bold shadow-xs transition"
            title="Define and create a new academic term period"
          >
            <Clock className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
            <span>+ Academic Term</span>
          </button>
        </div>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="glass-panel p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 flex flex-col md:flex-row items-center justify-between gap-3 shadow-xs">
        {/* Search Input */}
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by student name, ID, roll no..."
            className="w-full bg-slate-50 dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-700/80 rounded-xl pl-10 pr-4 py-2 text-xs text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
          />
        </div>

        {/* Filters & Mode Switcher */}
        <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto flex-wrap">
          {/* Program Pills */}
          <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-xl">
            {['all', ...(metadata.programs && metadata.programs.length > 0 
                ? Array.from(new Set(metadata.programs.map(p => p.name || p.program_name).filter(Boolean)))
                : ['Standard 5', 'Standard 6', 'Standard 7'])].map((prog) => (
              <button
                key={prog}
                onClick={() => setProgramFilter(prog)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition whitespace-nowrap ${
                  programFilter === prog
                    ? 'bg-white dark:bg-slate-700 text-brand-600 dark:text-brand-300 shadow-xs'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                {prog === 'all' ? 'All Classes' : prog}
              </button>
            ))}
          </div>

          {/* Section / Cohort Dropdown */}
          <select
            value={groupFilter}
            onChange={(e) => setGroupFilter(e.target.value)}
            className="bg-slate-100 dark:bg-slate-800 border-none text-xs font-semibold text-slate-700 dark:text-slate-300 rounded-xl px-3 py-2 focus:ring-2 focus:ring-brand-500/20 cursor-pointer"
          >
            <option value="all">All Sections</option>
            {metadata.student_groups?.map((sg) => (
              <option key={sg.name} value={sg.name}>
                {sg.student_group_name || sg.name}
              </option>
            ))}
          </select>

          {/* View Mode Switcher */}
          <div className="flex items-center bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-lg transition ${
                viewMode === 'grid'
                  ? 'bg-white dark:bg-slate-700 text-brand-600 dark:text-brand-300 shadow-xs'
                  : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
              }`}
              title="Grid View"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`p-1.5 rounded-lg transition ${
                viewMode === 'table'
                  ? 'bg-white dark:bg-slate-700 text-brand-600 dark:text-brand-300 shadow-xs'
                  : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
              }`}
              title="Table View"
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Directory Grid or Table */}
      {loading ? (
        <div className="p-16 text-center text-slate-400 text-xs">
          <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
          Loading student directory from Frappe backend...
        </div>
      ) : filteredStudents.length === 0 ? (
        <div className="glass-panel rounded-3xl p-12 text-center border border-slate-200/80 dark:border-slate-800">
          <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 flex items-center justify-center mx-auto mb-3">
            <Users className="w-6 h-6" />
          </div>
          <h3 className="font-bold text-sm text-slate-800 dark:text-slate-200">No Students Found</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
            {searchTerm ? `No student matched "${searchTerm}". Try another search term.` : 'No students found in the selected academic filter.'}
          </p>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredStudents.map((stu) => {
            const initials = stu.student_name
              .split(' ')
              .filter(Boolean)
              .map(n => n[0])
              .join('')
              .toUpperCase()
              .slice(0, 2) || 'ST';

            const primaryGroup = stu.student_groups?.[0];

            return (
              <div
                key={stu.name}
                className="glass-panel p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 transition shadow-xs space-y-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-brand-600 to-indigo-500 text-white flex items-center justify-center font-bold text-xs shadow-md shadow-brand-500/20 shrink-0">
                      {initials}
                    </div>
                    <div className="min-w-0">
                      <h4 className="font-bold text-sm text-slate-900 dark:text-slate-100 truncate">
                        {stu.student_name}
                      </h4>
                      <p className="text-[11px] font-mono text-slate-400 dark:text-slate-500 mt-0.5">
                        {stu.name}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {stu.roll_number && (
                      <span className="shrink-0 px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200/60 dark:border-slate-700">
                        Roll #{stu.roll_number}
                      </span>
                    )}
                    <span className="shrink-0 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-emerald-50 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                      Enrolled
                    </span>
                  </div>
                </div>

                {/* Section & Program Badges */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  {primaryGroup && (
                    <span className="px-2 py-0.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 text-[10px] font-semibold border border-indigo-200/60 dark:border-indigo-800">
                      {primaryGroup.student_group}
                    </span>
                  )}
                  {stu.programs && stu.programs.length > 0 ? (
                    stu.programs.map((p, pIdx) => (
                      <span
                        key={pIdx}
                        className="px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[10px] font-semibold border border-slate-200/60 dark:border-slate-700/60 flex items-center gap-1"
                      >
                        <BookOpen className="w-2.5 h-2.5 text-brand-500" />
                        <span>{p}</span>
                      </span>
                    ))
                  ) : (
                    <span className="text-[10px] text-slate-400">Standard Syllabus</span>
                  )}
                </div>

                {/* Contact & Guardian footer */}
                <div className="pt-3 border-t border-slate-100 dark:border-slate-800/80 space-y-1.5 text-xs text-slate-600 dark:text-slate-400">
                  <div className="flex items-center gap-2 truncate">
                    <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="truncate font-mono text-[11px]">{stu.email || 'No email registered'}</span>
                  </div>

                  {stu.guardians && stu.guardians.length > 0 && (
                    <div className="flex items-center gap-2 truncate text-[11px] text-slate-500">
                      <HeartHandshake className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="truncate">{stu.guardians[0].guardian_name} ({stu.guardians[0].relation || 'Parent'})</span>
                    </div>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="pt-2 flex items-center gap-2">
                  <button
                    onClick={() => handleOpenProfileModal(stu.name)}
                    className="flex-1 py-1.5 px-3 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-brand-50 dark:hover:bg-brand-950/80 text-slate-700 dark:text-slate-300 hover:text-brand-600 dark:hover:text-brand-400 text-xs font-bold transition flex items-center justify-center gap-1.5"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>View Dossier</span>
                  </button>

                  <button
                    onClick={() => handleOpenAssignModal(stu)}
                    className="p-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition"
                    title="Assign Cohort / Section"
                  >
                    <Users className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Table View */
        <div className="glass-panel rounded-2xl border border-slate-200/80 dark:border-slate-800 overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-500 uppercase tracking-wider text-[10px] font-bold border-b border-slate-200/80 dark:border-slate-700">
                <tr>
                  <th className="py-3 px-4">Student</th>
                  <th className="py-3 px-4">Roll No</th>
                  <th className="py-3 px-4">Program</th>
                  <th className="py-3 px-4">Section / Cohort</th>
                  <th className="py-3 px-4">Guardian Contact</th>
                  <th className="py-3 px-4">Admission</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                {filteredStudents.map((stu) => (
                  <tr key={stu.name} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition">
                    <td className="py-3 px-4">
                      <div className="font-bold text-slate-900 dark:text-slate-100">{stu.student_name}</div>
                      <div className="font-mono text-[10px] text-slate-400">{stu.name}</div>
                    </td>
                    <td className="py-3 px-4 font-mono font-bold text-slate-700 dark:text-slate-300">
                      {stu.roll_number ? `#${stu.roll_number}` : '—'}
                    </td>
                    <td className="py-3 px-4">
                      {stu.programs?.join(', ') || 'Standard Syllabus'}
                    </td>
                    <td className="py-3 px-4">
                      {stu.student_groups?.[0]?.student_group || 'Unassigned'}
                    </td>
                    <td className="py-3 px-4 text-slate-500">
                      {stu.guardians?.[0] ? `${stu.guardians[0].guardian_name} (${stu.guardians[0].relation})` : '—'}
                    </td>
                    <td className="py-3 px-4 text-slate-400 font-mono text-[11px]">
                      {stu.joining_date || '—'}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => handleOpenProfileModal(stu.name)}
                        className="py-1 px-2.5 rounded-lg bg-brand-50 dark:bg-brand-950 text-brand-600 dark:text-brand-400 font-bold text-[11px] hover:bg-brand-100 transition"
                      >
                        View Dossier
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Render Modals */}
      {detailModalOpen && renderProfileModal()}
      {enrollModalOpen && renderEnrollModal()}
      {assignModalOpen && renderAssignModal()}
      {createYearModalOpen && renderCreateAcademicYearModal()}
      {createTermModalOpen && renderCreateAcademicTermModal()}
      {createGroupModalOpen && renderCreateStudentGroupModal()}
    </div>
  );

  // =========================================================================
  // MODAL 1: COMPLETE STUDENT PROFILE & DOSSIER MODAL
  // =========================================================================
  function renderProfileModal() {
    const student = selectedStudentDetail?.student || {};
    const programsList = selectedStudentDetail?.programs || [];
    const guardiansList = selectedStudentDetail?.guardians || [];
    const studentGroupsList = selectedStudentDetail?.student_groups || [];
    const coursesList = selectedStudentDetail?.enrolled_courses || [];
    const attendanceStats = selectedStudentDetail?.attendance_summary || { total: 0, present: 0, absent: 0, percentage: 100 };
    const logsList = selectedStudentDetail?.recent_logs || [];

    const initials = (student.student_name || 'ST')
      .split(' ')
      .filter(Boolean)
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs overflow-y-auto animate-fade-in">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-3xl max-h-[92vh] flex flex-col shadow-2xl my-auto overflow-hidden">
          {/* Modal Header */}
          <div className="p-4 sm:p-6 bg-gradient-to-r from-brand-600 via-indigo-600 to-purple-600 text-white relative shrink-0">
            <button
              onClick={() => setDetailModalOpen(false)}
              className="absolute top-5 right-5 w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 text-white flex items-center justify-center transition"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-white/20 border-2 border-white/40 flex items-center justify-center font-black text-xl shadow-md">
                {student.image ? (
                  <img src={student.image} alt={student.student_name} className="w-full h-full object-cover rounded-2xl" />
                ) : (
                  initials
                )}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="text-xl font-black truncate">{student.student_name}</h3>
                  <span className="px-2 py-0.5 rounded-md bg-white/20 text-white text-[10px] font-bold uppercase tracking-wider">
                    {student.enabled ? 'Active Student' : 'Inactive'}
                  </span>
                </div>
                <p className="text-xs text-white/80 font-mono mt-0.5">Student ID: {student.name}</p>
                {studentGroupsList[0] && (
                  <p className="text-xs text-white/90 font-semibold mt-1">
                    {studentGroupsList[0].student_group} {studentGroupsList[0].group_roll_number && `• Roll #${studentGroupsList[0].group_roll_number}`}
                  </p>
                )}
              </div>
            </div>

            {/* Quick Action Buttons on Staff */}
            {isStaff && (
              <div className="mt-4 pt-3 border-t border-white/20 flex items-center gap-2">
                <button
                  onClick={() => handleOpenEnrollModal(student.name)}
                  className="px-3 py-1.5 rounded-xl bg-white text-brand-700 hover:bg-white/90 text-xs font-bold transition flex items-center gap-1.5 shadow-xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Enroll in Program</span>
                </button>
              </div>
            )}
          </div>

          {/* Modal Tabs */}
          <div className="flex items-center gap-1 p-2 bg-slate-100 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 overflow-x-auto shrink-0">
            {[
              { id: 'overview', label: 'Overview & Personal', icon: User },
              { id: 'courses', label: 'Enrolled Courses', icon: BookOpen },
              { id: 'enrollments', label: 'Program Enrollments', icon: GraduationCap },
              { id: 'guardians', label: 'Guardians', icon: Shield },
              { id: 'attendance', label: 'Attendance', icon: Activity },
              { id: 'logs', label: 'Student Logs', icon: Award },
            ].map((t) => {
              const Icon = t.icon;
              const active = modalTab === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setModalTab(t.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap ${
                    active
                      ? 'bg-white dark:bg-slate-700 text-brand-600 dark:text-brand-300 shadow-xs'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-800'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{t.label}</span>
                </button>
              );
            })}
          </div>

          {/* Modal Tab Content */}
          <div className="p-4 sm:p-6 flex-1 min-h-0 overflow-y-auto">
            {loadingDetail ? (
              <div className="p-12 text-center text-slate-400 text-xs">
                <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                Loading detailed student record...
              </div>
            ) : modalTab === 'overview' ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
                <div className="space-y-3">
                  <h4 className="font-bold text-slate-400 uppercase tracking-wider text-[11px]">Identity & Demographic Details</h4>
                  <div className="space-y-2">
                    <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                      <span className="text-slate-500">Date of Birth:</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200">{student.date_of_birth || '—'}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                      <span className="text-slate-500">Gender:</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200">{student.gender || 'Not specified'}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                      <span className="text-slate-500">Blood Group:</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200">{student.blood_group || '—'}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                      <span className="text-slate-500">Nationality:</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200">{student.nationality || 'Indian'}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                      <span className="text-slate-500">Date of Admission:</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200">{student.joining_date || '—'}</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <h4 className="font-bold text-slate-400 uppercase tracking-wider text-[11px]">Contact & Address</h4>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 py-1 border-b border-slate-100 dark:border-slate-800">
                      <Mail className="w-3.5 h-3.5 text-slate-400" />
                      <span className="font-mono text-slate-700 dark:text-slate-300">{student.student_email_id || 'No email registered'}</span>
                    </div>
                    <div className="flex items-center gap-2 py-1 border-b border-slate-100 dark:border-slate-800">
                      <Phone className="w-3.5 h-3.5 text-slate-400" />
                      <span className="font-mono text-slate-700 dark:text-slate-300">{student.student_mobile_number || 'No phone registered'}</span>
                    </div>
                    <div className="flex items-start gap-2 py-1">
                      <MapPin className="w-3.5 h-3.5 text-slate-400 mt-0.5 shrink-0" />
                      <span className="text-slate-600 dark:text-slate-400 leading-relaxed">
                        {student.address_line_1 ? `${student.address_line_1}, ` : ''}
                        {student.city ? `${student.city}, ` : ''}
                        {student.state ? `${student.state} - ` : ''}
                        {student.pincode || ''}
                        {!student.address_line_1 && !student.city && 'Registered Campus Residence'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ) : modalTab === 'courses' ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-bold text-slate-400 uppercase tracking-wider text-[11px]">Enrolled Subject Modules</h4>
                    <p className="text-[11px] text-slate-500">Official curriculum course enrollments & active electives</p>
                  </div>
                  {(isStaff || isAdmin) && (
                    <button
                      onClick={() => handleOpenAddCourseModal(student.name)}
                      className="py-1.5 px-3 rounded-xl bg-brand-500 hover:bg-brand-600 text-white font-bold text-xs transition flex items-center gap-1.5 shadow-xs"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Enroll Elective</span>
                    </button>
                  )}
                </div>

                {courseActionMsg && (
                  <div className={`p-3 rounded-xl text-xs font-semibold flex items-center gap-2 animate-fade-in ${
                    courseActionMsg.type === 'error'
                      ? 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
                      : 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                  }`}>
                    {courseActionMsg.type === 'error' ? <AlertCircle className="w-4 h-4 shrink-0" /> : <CheckCircle2 className="w-4 h-4 shrink-0" />}
                    <span>{courseActionMsg.text}</span>
                  </div>
                )}

                {/* Add Elective Course Drawer / Form */}
                {showAddCourseModal && (
                  <div className="p-4 rounded-2xl bg-brand-50/60 dark:bg-brand-950/40 border border-brand-200 dark:border-brand-800/80 space-y-3 animate-fade-in">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs text-brand-900 dark:text-brand-200 flex items-center gap-1.5">
                        <BookOpen className="w-4 h-4 text-brand-600 dark:text-brand-400" />
                        Select Elective Course to Enroll
                      </span>
                      <button
                        onClick={() => setShowAddCourseModal(false)}
                        className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {availableCoursesData.length === 0 ? (
                      <p className="text-xs text-slate-500 italic py-2">
                        All available program courses are already enrolled for this student.
                      </p>
                    ) : (
                      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                        <select
                          value={selectedCourseToEnroll}
                          onChange={(e) => setSelectedCourseToEnroll(e.target.value)}
                          className="flex-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                        >
                          {availableCoursesData.map((c) => (
                            <option key={c.course} value={c.course}>
                              {c.course_name || c.course} {c.is_program_course ? '(Standard Catalog)' : '(Elective)'}
                            </option>
                          ))}
                        </select>
                        <button
                          onClick={() => handleEnrollCourse(student.name)}
                          disabled={courseActionLoading || !selectedCourseToEnroll}
                          className="py-2 px-4 rounded-xl bg-brand-600 hover:bg-brand-500 disabled:opacity-50 text-white font-bold text-xs transition flex items-center justify-center gap-1.5 shadow-xs"
                        >
                          {courseActionLoading ? 'Enrolling...' : 'Confirm Enrollment'}
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* Courses Grid */}
                {coursesList.length === 0 ? (
                  <p className="text-xs text-slate-400 py-3">No courses found for current enrollments.</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {coursesList.map((c, i) => (
                      <div key={i} className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700 flex items-center justify-between group">
                        <div className="space-y-0.5">
                          <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">{c.course_name || c.course}</span>
                          <div className="flex items-center gap-2 text-[10px] text-slate-400 font-mono">
                            <span>Code: {c.course}</span>
                            {c.enrollment_date && (
                              <span>• Enrolled: {c.enrollment_date}</span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded-lg bg-brand-50 dark:bg-brand-950 text-brand-600 dark:text-brand-400 text-[10px] font-bold">
                            {c.program || 'Standard'}
                          </span>
                          {(isStaff || isAdmin) && c.enrollment_id && (
                            <button
                              onClick={() => handleDropCourse(student.name, c.enrollment_id, c.course_name || c.course)}
                              className="p-1 rounded-lg text-slate-300 hover:text-rose-500 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition opacity-0 group-hover:opacity-100"
                              title={`Drop ${c.course_name || c.course}`}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : modalTab === 'enrollments' ? (
              <div className="space-y-3">
                <h4 className="font-bold text-slate-400 uppercase tracking-wider text-[11px]">Program Enrollment Documents</h4>
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {programsList.map((pe, idx) => (
                    <div key={idx} className="py-2.5 flex items-center justify-between">
                      <div>
                        <h5 className="font-bold text-xs text-slate-800 dark:text-slate-200">{pe.program}</h5>
                        <span className="text-[11px] font-mono text-slate-400">{pe.program_enrollment}</span>
                      </div>
                      <span className="px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[10px] font-bold">
                        {pe.academic_year} {pe.academic_term ? `• ${pe.academic_term}` : ''}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : modalTab === 'guardians' ? (
              <div className="space-y-3">
                <h4 className="font-bold text-slate-400 uppercase tracking-wider text-[11px]">Authorized Guardians</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {guardiansList.map((g, idx) => (
                    <div key={idx} className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs text-slate-800 dark:text-slate-200">{g.guardian_name}</span>
                        <span className="px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 text-[10px] font-bold">
                          {g.relation || 'Parent'}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 font-mono">{g.mobile_number || g.email_address || 'No direct phone'}</p>
                    </div>
                  ))}
                </div>
              </div>
            ) : modalTab === 'attendance' ? (
              <div className="space-y-3">
                <h4 className="font-bold text-slate-400 uppercase tracking-wider text-[11px]">Attendance Record</h4>
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700 space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Overall Attendance Compliance:</span>
                    <span className="font-bold text-brand-600 dark:text-brand-400">{attendanceStats.percentage}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Present Sessions Attended:</span>
                    <span className="font-bold text-emerald-600 dark:text-emerald-400">{attendanceStats.present}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Absent Sessions:</span>
                    <span className="font-bold text-rose-600 dark:text-rose-400">{attendanceStats.absent}</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <h4 className="font-bold text-slate-400 uppercase tracking-wider text-[11px]">Student Honors & Logs</h4>
                {logsList.length === 0 ? (
                  <p className="text-xs text-slate-400 py-3">No activity logs recorded.</p>
                ) : (
                  <div className="space-y-2">
                    {logsList.map((log, idx) => (
                      <div key={idx} className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700 space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold text-amber-600 dark:text-amber-400 uppercase text-[10px]">{log.type}</span>
                          <span className="font-mono text-slate-400 text-[10px]">{log.date}</span>
                        </div>
                        <div 
                          className="text-xs text-slate-700 dark:text-slate-300 pt-1"
                          dangerouslySetInnerHTML={{ __html: log.log }}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Modal Footer */}
          <div className="p-4 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end shrink-0">
            <button
              onClick={() => setDetailModalOpen(false)}
              className="px-4 py-2 rounded-xl bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs hover:bg-slate-300 dark:hover:bg-slate-600 transition"
            >
              Close Dossier
            </button>
          </div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // MODAL 2: ENROLL STUDENT IN PROGRAM MODAL
  // =========================================================================
  // =========================================================================
  // MODAL 2: PROGRAM ENROLLMENT MODAL (SINGLE & BULK COHORT)
  // =========================================================================
  function renderEnrollModal() {
    const getStudentPrograms = (student) => {
      if (Array.isArray(student.programs) && student.programs.length > 0) {
        return student.programs;
      }
      if (student.program && student.program !== 'Unassigned' && student.program !== 'Unenrolled') {
        return [student.program];
      }
      return [];
    };

    // Filter directory for bulk selection
    const visibleBulkStudents = directory.filter((s) => {
      const studentProgs = getStudentPrograms(s);
      const isUnenrolled =
        studentProgs.length === 0 ||
        studentProgs.every((p) => !p || p === 'Unassigned' || p === 'Unenrolled');

      // Source filter
      if (bulkSourceFilter === 'unenrolled') {
        if (!isUnenrolled) return false;
      } else if (bulkSourceFilter !== 'all') {
        if (!studentProgs.includes(bulkSourceFilter)) return false;
      }
      // Search filter
      if (bulkSearch) {
        const q = bulkSearch.toLowerCase();
        const matchName = s.student_name?.toLowerCase().includes(q);
        const matchId = s.name?.toLowerCase().includes(q);
        if (!matchName && !matchId) return false;
      }
      return true;
    });

    const isAllVisibleSelected =
      visibleBulkStudents.length > 0 &&
      visibleBulkStudents.every((s) => bulkSelectedStudents.includes(s.name));

    const handleToggleSelectAllVisible = () => {
      if (isAllVisibleSelected) {
        // Deselect visible
        const visibleIds = new Set(visibleBulkStudents.map((s) => s.name));
        setBulkSelectedStudents((prev) => prev.filter((id) => !visibleIds.has(id)));
      } else {
        // Add all visible
        const combined = new Set([...bulkSelectedStudents, ...visibleBulkStudents.map((s) => s.name)]);
        setBulkSelectedStudents(Array.from(combined));
      }
    };

    const handleToggleStudent = (studentId) => {
      setBulkSelectedStudents((prev) =>
        prev.includes(studentId) ? prev.filter((id) => id !== studentId) : [...prev, studentId]
      );
    };

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs overflow-y-auto animate-fade-in">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-2xl max-h-[92vh] flex flex-col shadow-2xl my-auto overflow-hidden">
          {/* Modal Header */}
          <div className="p-4 sm:p-5 pb-3 border-b border-slate-100 dark:border-slate-800 shrink-0 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-brand-50 dark:bg-brand-950/80 text-brand-600 dark:text-brand-400 flex items-center justify-center shadow-xs">
                {enrollMode === 'bulk' ? <Users className="w-5 h-5" /> : <GraduationCap className="w-5 h-5" />}
              </div>
              <div>
                <h3 className="text-base font-extrabold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  {enrollMode === 'bulk' ? 'Bulk Cohort Enrollment' : 'New Program Enrollment'}
                  <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-full bg-brand-50 dark:bg-brand-950/80 text-brand-600 dark:text-brand-400 border border-brand-200/60 dark:border-brand-800">
                    {enrollMode === 'bulk' ? 'Batch Mode' : 'Single Student'}
                  </span>
                </h3>
                <p className="text-xs text-slate-400">
                  {enrollMode === 'bulk'
                    ? 'Batch enroll multiple students into a standard, curriculum courses, and section'
                    : 'Enroll an individual student into an academic program and grade'}
                </p>
              </div>
            </div>
            <button
              onClick={() => setEnrollModalOpen(false)}
              className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <form onSubmit={handleSubmitEnroll} className="flex-1 flex flex-col min-h-0 overflow-hidden text-xs">
            <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
              {/* Mode Switcher Segmented Control */}
              <div className="flex items-center p-1 bg-slate-100 dark:bg-slate-800/80 rounded-2xl border border-slate-200/60 dark:border-slate-700/60">
                <button
                  type="button"
                  onClick={() => setEnrollMode('single')}
                  className={`flex-1 py-1.5 text-xs font-bold rounded-xl transition flex items-center justify-center gap-2 ${
                    enrollMode === 'single'
                      ? 'bg-white dark:bg-slate-900 text-brand-600 dark:text-brand-400 shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                  }`}
                >
                  <User className="w-3.5 h-3.5" />
                  <span>Single Student</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEnrollMode('bulk');
                    if (bulkSelectedStudents.length === 0) {
                      setBulkSelectedStudents(directory.map((s) => s.name));
                    }
                  }}
                  className={`flex-1 py-1.5 text-xs font-bold rounded-xl transition flex items-center justify-center gap-2 ${
                    enrollMode === 'bulk'
                      ? 'bg-white dark:bg-slate-900 text-brand-600 dark:text-brand-400 shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                  }`}
                >
                  <Users className="w-3.5 h-3.5" />
                  <span>Bulk / Cohort Batch ({directory.length})</span>
                </button>
              </div>

              {enrollError && (
                <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{enrollError}</span>
                </div>
              )}

              {enrollSuccess && (
                <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{enrollSuccess}</span>
                </div>
              )}
            {/* SINGLE MODE: Target Student Select */}
            {enrollMode === 'single' ? (
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Target Student <span className="text-rose-500">*</span>
                </label>
                <select
                  value={enrollData.student}
                  onChange={(e) => setEnrollData({ ...enrollData, student: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500/20 font-medium"
                  required
                >
                  {directory.map((s) => {
                    const studentProgs = getStudentPrograms(s);
                    const progStr = studentProgs.length > 0 ? studentProgs.join(', ') : '';
                    return (
                      <option key={s.name} value={s.name}>
                        {s.student_name} ({s.name}) {progStr ? `— Currently in ${progStr}` : '— Unenrolled'}
                      </option>
                    );
                  })}
                </select>
              </div>
            ) : (
              /* BULK MODE: Student Selection Checklist with Filters */
              <div className="space-y-2.5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <label className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                    <span>Select Students to Enroll</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-brand-50 text-brand-700 dark:bg-brand-950/80 dark:text-brand-300 border border-brand-200/60 dark:border-brand-800">
                      {bulkSelectedStudents.length} of {directory.length} Selected
                    </span>
                  </label>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        const visibleIds = visibleBulkStudents.map((s) => s.name);
                        setBulkSelectedStudents(Array.from(new Set([...bulkSelectedStudents, ...visibleIds])));
                      }}
                      className="text-[11px] font-bold text-brand-600 dark:text-brand-400 hover:underline cursor-pointer"
                    >
                      {bulkSourceFilter !== 'all' || bulkSearch
                        ? `Select Visible (${visibleBulkStudents.length})`
                        : `Select All (${directory.length})`}
                    </button>
                    <span className="text-slate-300 dark:text-slate-700">•</span>
                    <button
                      type="button"
                      onClick={() => setBulkSelectedStudents([])}
                      className="text-[11px] font-bold text-slate-500 hover:underline cursor-pointer"
                    >
                      Clear Selection
                    </button>
                  </div>
                </div>

                {/* Bulk Filter Controls */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      value={bulkSearch}
                      onChange={(e) => setBulkSearch(e.target.value)}
                      placeholder="Filter by name or ID..."
                      className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl pl-8 pr-3 py-1.5 text-xs text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                    />
                  </div>

                  <div className="relative">
                    <select
                      value={bulkSourceFilter}
                      onChange={(e) => {
                        const newFilter = e.target.value;
                        setBulkSourceFilter(newFilter);
                        const matching = directory.filter((s) => {
                          const progs = getStudentPrograms(s);
                          const isUnenrolled =
                            progs.length === 0 ||
                            progs.every((p) => !p || p === 'Unassigned' || p === 'Unenrolled');
                          if (newFilter === 'unenrolled') return isUnenrolled;
                          if (newFilter !== 'all') return progs.includes(newFilter);
                          return true;
                        });
                        setBulkSelectedStudents(matching.map((s) => s.name));
                      }}
                      className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                    >
                      <option value="all">All Student Cohorts</option>
                      <option value="unenrolled">Unenrolled Students Only</option>
                      {metadata.programs?.map((p) => (
                        <option key={p.name} value={p.name}>
                          From: {p.program_name || p.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Select All Visible toggle */}
                <div className="flex items-center justify-between px-3 py-1.5 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200/60 dark:border-slate-700/60 text-[11px]">
                  <label className="flex items-center gap-2 cursor-pointer select-none font-semibold text-slate-600 dark:text-slate-300">
                    <input
                      type="checkbox"
                      checked={isAllVisibleSelected}
                      onChange={handleToggleSelectAllVisible}
                      className="w-3.5 h-3.5 rounded text-brand-600 focus:ring-brand-500 accent-brand-600 cursor-pointer"
                    />
                    <span>Toggle Visible ({visibleBulkStudents.length})</span>
                  </label>
                  <span className="text-slate-400">
                    Click students below to toggle selection
                  </span>
                </div>

                {/* Scrollable Student List */}
                <div className="max-h-48 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/80 rounded-2xl border border-slate-200 dark:border-slate-700/80 bg-white dark:bg-slate-900 shadow-inner">
                  {visibleBulkStudents.length === 0 ? (
                    <div className="p-6 text-center text-slate-400">
                      No students match the current filter.
                    </div>
                  ) : (
                    visibleBulkStudents.map((s) => {
                      const isSelected = bulkSelectedStudents.includes(s.name);
                      return (
                        <div
                          key={s.name}
                          onClick={() => handleToggleStudent(s.name)}
                          className={`px-3 py-2 flex items-center justify-between gap-3 cursor-pointer transition ${
                            isSelected
                              ? 'bg-brand-50/60 dark:bg-brand-950/30'
                              : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => {}} // Controlled via parent row onClick
                              className="w-3.5 h-3.5 rounded text-brand-600 focus:ring-brand-500 accent-brand-600 shrink-0 cursor-pointer"
                            />
                            <div className="w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-[10px] flex items-center justify-center shrink-0">
                              {s.student_name ? s.student_name.charAt(0) : 'S'}
                            </div>
                            <div className="min-w-0">
                              <p className="font-bold text-slate-800 dark:text-slate-200 truncate leading-tight">
                                {s.student_name}
                              </p>
                              <p className="text-[10px] font-mono text-slate-400 truncate">
                                {s.name}
                              </p>
                            </div>
                          </div>

                          <div className="shrink-0 flex items-center gap-1 flex-wrap justify-end max-w-[220px]">
                            {(() => {
                              const progs = getStudentPrograms(s);
                              if (progs.length > 0) {
                                return progs.map((prog, pIdx) => (
                                  <span
                                    key={pIdx}
                                    className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-brand-50/80 dark:bg-brand-950/60 text-brand-700 dark:text-brand-300 border border-brand-200/60 dark:border-brand-800/60"
                                  >
                                    {prog}
                                  </span>
                                ));
                              }
                              return (
                                <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 border border-amber-200/60 dark:border-amber-800/60">
                                  Unenrolled
                                </span>
                              );
                            })()}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}

            {/* Target Enrollment Configuration Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
              {/* Destination Program */}
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Destination Standard / Program <span className="text-rose-500">*</span>
                </label>
                <select
                  value={enrollData.program}
                  onChange={(e) => {
                    const newProg = e.target.value;
                    const validGroups = metadata.student_groups?.filter((sg) => sg.program === newProg) || [];
                    const defaultGrp = validGroups.length > 0 ? validGroups[0].name : '';
                    setEnrollData({
                      ...enrollData,
                      program: newProg,
                      student_group: defaultGrp,
                    });
                  }}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500/20 font-medium"
                  required
                >
                  {metadata.programs?.map((p) => (
                    <option key={p.name} value={p.name}>
                      {p.program_name || p.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Target Academic Year */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block font-bold text-slate-700 dark:text-slate-300">
                    Academic Year <span className="text-rose-500">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={handleOpenCreateYearModal}
                    className="text-[11px] font-bold text-brand-600 dark:text-brand-400 hover:underline flex items-center gap-1"
                    title="Define and create a new academic year period"
                  >
                    <Plus className="w-3 h-3" />
                    <span>New Year</span>
                  </button>
                </div>
                <select
                  value={enrollData.academic_year}
                  onChange={(e) => setEnrollData({ ...enrollData, academic_year: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500/20 font-medium"
                  required
                >
                  {metadata.academic_years?.map((ay) => (
                    <option key={ay.name} value={ay.name}>
                      {ay.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Target Section / Student Group */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block font-bold text-slate-700 dark:text-slate-300">
                    Target Section / Cohort (Optional)
                  </label>
                  <button
                    type="button"
                    onClick={() => handleOpenCreateGroupModal(enrollData.program, enrollData.academic_year)}
                    className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                    <span>New Section</span>
                  </button>
                </div>
                <select
                  value={enrollData.student_group}
                  onChange={(e) => setEnrollData({ ...enrollData, student_group: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500/20 font-medium"
                >
                  <option value="">No Section Assignment (Curriculum Only)</option>
                  {metadata.student_groups
                    ?.filter((sg) => !enrollData.program || sg.program === enrollData.program)
                    .map((sg) => (
                      <option key={sg.name} value={sg.name}>
                        {sg.student_group_name || sg.name}
                      </option>
                    ))}
                </select>
                <p className="text-[10px] text-slate-400 mt-1">
                  Assigns enrolled students to this section roster & timetable
                </p>
              </div>

              {/* Academic Term */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block font-bold text-slate-700 dark:text-slate-300">
                    Academic Term (Optional)
                  </label>
                  <button
                    type="button"
                    onClick={() => handleOpenCreateTermModal(enrollData.academic_year)}
                    className="text-[11px] font-bold text-sky-600 dark:text-sky-400 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                    <span>New Term</span>
                  </button>
                </div>
                <select
                  value={enrollData.academic_term}
                  onChange={(e) => setEnrollData({ ...enrollData, academic_term: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500/20 font-medium"
                >
                  <option value="">Full Academic Year</option>
                  {metadata.academic_terms
                    ?.filter((at) => !enrollData.academic_year || at.academic_year === enrollData.academic_year)
                    .map((at) => (
                      <option key={at.name} value={at.name}>
                        {at.name}
                      </option>
                    ))}
                </select>
              </div>
            </div>

            </div>

            {/* Modal Footer (Always Pinned & Visible) */}
            <div className="p-4 sm:p-5 pt-3 border-t border-slate-100 dark:border-slate-800 shrink-0 bg-slate-50/70 dark:bg-slate-900/70 flex items-center justify-between gap-3">
              <span className="text-[11px] text-slate-400 truncate">
                {enrollMode === 'bulk'
                  ? `${bulkSelectedStudents.length} student(s) selected`
                  : 'Individual enrollment record'}
              </span>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setEnrollModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold hover:bg-slate-200 transition text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={enrollSubmitting || (enrollMode === 'bulk' && bulkSelectedStudents.length === 0)}
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-700 hover:to-indigo-700 text-white font-bold transition flex items-center gap-2 shadow-md shadow-brand-500/20 disabled:opacity-50 disabled:cursor-not-allowed text-xs"
                >
                  {enrollSubmitting ? (
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Check className="w-3.5 h-3.5" />
                  )}
                  <span>
                    {enrollSubmitting
                      ? 'Enrolling...'
                      : enrollMode === 'bulk'
                      ? `Enroll Cohort (${bulkSelectedStudents.length})`
                      : 'Submit Enrollment'}
                  </span>
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    );
  }

  // =========================================================================
  // MODAL 3: ASSIGN SECTION & ROLL NUMBER MODAL
  // =========================================================================
  function renderAssignModal() {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs overflow-y-auto animate-fade-in">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-md max-h-[92vh] flex flex-col my-auto overflow-hidden shadow-2xl">
          <div className="p-4 sm:p-5 pb-3 border-b border-slate-100 dark:border-slate-800 shrink-0 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-slate-900 dark:text-slate-100">
                  Assign Section & Cohort
                </h3>
                <p className="text-xs text-slate-400">{assignData.student_name} ({assignData.student})</p>
              </div>
            </div>
            <button
              onClick={() => setAssignModalOpen(false)}
              className="p-1 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <form onSubmit={handleSubmitAssign} className="flex-1 min-h-0 flex flex-col overflow-hidden">
            <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 text-xs">
              {assignError && (
                <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300">
                  {assignError}
                </div>
              )}

              {assignSuccess && (
                <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-700 dark:text-emerald-300">
                  {assignSuccess}
                </div>
              )}

              {/* Student Group */}
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Student Group / Section</label>
                <select
                  value={assignData.student_group}
                  onChange={(e) => setAssignData({ ...assignData, student_group: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  required
                >
                  {metadata.student_groups?.map((sg) => (
                    <option key={sg.name} value={sg.name}>
                      {sg.student_group_name || sg.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Roll Number */}
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Cohort Roll Number</label>
                <input
                  type="number"
                  min="1"
                  max="500"
                  value={assignData.roll_number}
                  onChange={(e) => setAssignData({ ...assignData, roll_number: e.target.value })}
                  placeholder="e.g. 1, 2, 8..."
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 font-mono"
                />
              </div>
            </div>

            <div className="p-4 sm:p-5 pt-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/70 flex items-center justify-end gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setAssignModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold hover:bg-slate-200 transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={assignSubmitting}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold transition flex items-center gap-1.5"
              >
                {assignSubmitting ? (
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Check className="w-3.5 h-3.5" />
                )}
                <span>Save Section Assignment</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  // =========================================================================
  // MODAL 4: CREATE ACADEMIC YEAR MODAL
  // =========================================================================
  function renderCreateAcademicYearModal() {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs overflow-y-auto animate-fade-in">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-md max-h-[92vh] flex flex-col my-auto overflow-hidden shadow-2xl">
          <div className="p-4 sm:p-5 pb-3 border-b border-slate-100 dark:border-slate-800 shrink-0 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shadow-xs">
                <Calendar className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-slate-900 dark:text-slate-100">
                  New Academic Year
                </h3>
                <p className="text-xs text-slate-400">Define an institutional academic calendar year</p>
              </div>
            </div>
            <button
              onClick={() => setCreateYearModalOpen(false)}
              className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <form onSubmit={handleSubmitCreateYear} className="flex-1 min-h-0 flex flex-col overflow-hidden">
            <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 text-xs">
              {createYearError && (
                <div className="p-3 rounded-xl bg-rose-50 text-rose-700 dark:bg-rose-950/80 dark:text-rose-300 text-xs font-semibold border border-rose-200 dark:border-rose-800 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{createYearError}</span>
                </div>
              )}

              {createYearSuccess && (
                <div className="p-3 rounded-xl bg-emerald-50 text-emerald-700 dark:bg-emerald-950/80 dark:text-emerald-300 text-xs font-semibold border border-emerald-200 dark:border-emerald-800 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{createYearSuccess}</span>
                </div>
              )}

              {/* Academic Year Name */}
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Academic Year Title <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. 2029-2030"
                  value={newYearData.academic_year_name}
                  onChange={(e) => setNewYearData({ ...newYearData, academic_year_name: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 font-bold focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-hidden font-mono"
                  required
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  Standard format: YYYY-YYYY (e.g. 2028-2029)
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Year Start Date */}
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Start Date <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={newYearData.year_start_date}
                    onChange={(e) => handleStartDateChange(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 font-medium focus:ring-2 focus:ring-indigo-500/20 outline-hidden font-mono"
                    required
                  />
                </div>

                {/* Year End Date */}
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

              {/* Quick preset buttons */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[10px] text-slate-400 font-semibold">Quick Presets:</span>
                <button
                  type="button"
                  onClick={() => {
                    setNewYearData({
                      academic_year_name: '2028-2029',
                      year_start_date: '2028-04-01',
                      year_end_date: '2029-03-31',
                    });
                  }}
                  className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-[10px] font-mono text-slate-600 dark:text-slate-300 hover:bg-slate-200"
                >
                  2028-2029
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setNewYearData({
                      academic_year_name: '2029-2030',
                      year_start_date: '2029-04-01',
                      year_end_date: '2030-03-31',
                    });
                  }}
                  className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-[10px] font-mono text-slate-600 dark:text-slate-300 hover:bg-slate-200"
                >
                  2029-2030
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setNewYearData({
                      academic_year_name: '2030-2031',
                      year_start_date: '2030-04-01',
                      year_end_date: '2031-03-31',
                    });
                  }}
                  className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-[10px] font-mono text-slate-600 dark:text-slate-300 hover:bg-slate-200"
                >
                  2030-2031
                </button>
              </div>
            </div>

            <div className="p-4 sm:p-5 pt-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/70 flex items-center justify-end gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setCreateYearModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold hover:bg-slate-200 transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={createYearSubmitting}
                className="px-5 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-brand-600 hover:from-indigo-700 hover:to-brand-700 text-white font-bold transition flex items-center gap-1.5 shadow-md shadow-indigo-500/20 disabled:opacity-50"
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
    );
  }

  // =========================================================================
  // MODAL 5: CREATE ACADEMIC TERM MODAL
  // =========================================================================
  function renderCreateAcademicTermModal() {
    const selectedYearObj = metadata.academic_years?.find((y) => y.name === newTermData.academic_year);
    const generatedTermTitle = newTermData.academic_year && newTermData.term_name 
      ? `${newTermData.academic_year} (${newTermData.term_name})`
      : '—';

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs overflow-y-auto animate-fade-in">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-md max-h-[92vh] flex flex-col my-auto overflow-hidden shadow-2xl">
          <div className="p-4 sm:p-5 pb-3 border-b border-slate-100 dark:border-slate-800 shrink-0 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-2xl bg-sky-50 dark:bg-sky-950/80 text-sky-600 dark:text-sky-400 flex items-center justify-center shadow-xs">
                <Clock className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-slate-900 dark:text-slate-100">
                  New Academic Term
                </h3>
                <p className="text-xs text-slate-400">Define a semester or period within an academic year</p>
              </div>
            </div>
            <button
              onClick={() => setCreateTermModalOpen(false)}
              className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <form onSubmit={handleSubmitCreateTerm} className="flex-1 min-h-0 flex flex-col overflow-hidden">
            <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 text-xs">
              {createTermError && (
                <div className="p-3 rounded-xl bg-rose-50 text-rose-700 dark:bg-rose-950/80 dark:text-rose-300 text-xs font-semibold border border-rose-200 dark:border-rose-800 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{createTermError}</span>
                </div>
              )}

              {createTermSuccess && (
                <div className="p-3 rounded-xl bg-emerald-50 text-emerald-700 dark:bg-emerald-950/80 dark:text-emerald-300 text-xs font-semibold border border-emerald-200 dark:border-emerald-800 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{createTermSuccess}</span>
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
                  {metadata.academic_years?.map((ay) => (
                    <option key={ay.name} value={ay.name}>
                      {ay.name} ({ay.year_start_date} ~ {ay.year_end_date})
                    </option>
                  ))}
                </select>
                {selectedYearObj && (
                  <p className="text-[10px] text-slate-400 mt-1">
                    Calendar Period: {selectedYearObj.year_start_date} to {selectedYearObj.year_end_date}
                  </p>
                )}
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
                <span className="text-[10px] text-slate-400 font-semibold block">Presets:</span>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {['Term 1', 'Term 2', 'Semester 1', 'Semester 2', 'Summer Term'].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => applyTermPreset(preset)}
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border transition ${
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
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Term Start Date <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={newTermData.term_start_date}
                    min={selectedYearObj?.year_start_date || undefined}
                    max={selectedYearObj?.year_end_date || undefined}
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
                    min={newTermData.term_start_date || selectedYearObj?.year_start_date || undefined}
                    max={selectedYearObj?.year_end_date || undefined}
                    onChange={(e) => setNewTermData({ ...newTermData, term_end_date: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 font-medium focus:ring-2 focus:ring-sky-500/20 outline-hidden font-mono"
                    required
                  />
                </div>
              </div>

              {/* Live Preview Pill */}
              <div className="p-2.5 rounded-xl bg-sky-50/70 dark:bg-sky-950/40 border border-sky-100 dark:border-sky-900/60 flex items-center justify-between gap-2">
                <span className="text-[10px] font-semibold text-slate-400">Term ID Preview:</span>
                <span className="text-[11px] font-mono font-bold text-sky-700 dark:text-sky-300 truncate">
                  {generatedTermTitle}
                </span>
              </div>
            </div>

            <div className="p-4 sm:p-5 pt-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/70 flex items-center justify-end gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setCreateTermModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold hover:bg-slate-200 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={createTermSubmitting}
                className="px-5 py-2 rounded-xl bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-700 hover:to-indigo-700 text-white font-bold transition flex items-center gap-1.5 shadow-md shadow-sky-500/20 disabled:opacity-50 cursor-pointer"
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
    );
  }

  // =========================================================================
  // MODAL 6: CREATE STUDENT GROUP / SECTION MODAL
  // =========================================================================
  function renderCreateStudentGroupModal() {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs overflow-y-auto animate-fade-in">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-md max-h-[92vh] flex flex-col my-auto overflow-hidden shadow-2xl">
          <div className="p-4 sm:p-5 pb-3 border-b border-slate-100 dark:border-slate-800 shrink-0 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-2xl bg-emerald-50 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shadow-xs">
                <Layers className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-slate-900 dark:text-slate-100">
                  New Section / Student Group
                </h3>
                <p className="text-xs text-slate-400">Create a student cohort or class section</p>
              </div>
            </div>
            <button
              onClick={() => setCreateGroupModalOpen(false)}
              className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <form onSubmit={handleSubmitCreateGroup} className="flex-1 min-h-0 flex flex-col overflow-hidden">
            <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 text-xs">
              {createGroupError && (
                <div className="p-3 rounded-xl bg-rose-50 text-rose-700 dark:bg-rose-950/80 dark:text-rose-300 text-xs font-semibold border border-rose-200 dark:border-rose-800 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{createGroupError}</span>
                </div>
              )}

              {createGroupSuccess && (
                <div className="p-3 rounded-xl bg-emerald-50 text-emerald-700 dark:bg-emerald-950/80 dark:text-emerald-300 text-xs font-semibold border border-emerald-200 dark:border-emerald-800 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{createGroupSuccess}</span>
                </div>
              )}

              {/* Academic Program / Standard */}
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Standard / Program <span className="text-rose-500">*</span>
                </label>
                <select
                  value={newGroupData.program}
                  onChange={(e) => handleGroupProgramChange(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 font-bold focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-hidden"
                  required
                >
                  <option value="">Select Standard / Program...</option>
                  {metadata.programs?.map((p) => (
                    <option key={p.name} value={p.name}>
                      {p.program_name || p.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Quick Section Letter Selector */}
              <div className="space-y-1">
                <span className="text-[10px] text-slate-400 font-semibold block">Quick Section Letter:</span>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {['A', 'B', 'C', 'D', 'E', 'Honor'].map((letter) => (
                    <button
                      key={letter}
                      type="button"
                      onClick={() => handleSectionLetterClick(letter)}
                      className={`px-3 py-1 rounded-lg text-xs font-bold border transition ${
                        newGroupData.section_letter === letter
                          ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-200 cursor-pointer'
                      }`}
                    >
                      Section {letter}
                    </button>
                  ))}
                </div>
              </div>

              {/* Student Group Name */}
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Student Group Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Standard 5 - Section B"
                  value={newGroupData.student_group_name}
                  onChange={(e) => setNewGroupData({ ...newGroupData, student_group_name: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 font-bold focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-hidden font-mono"
                  required
                />
              </div>

              {/* Academic Year & Max Strength */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Academic Year <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={newGroupData.academic_year}
                    onChange={(e) => setNewGroupData({ ...newGroupData, academic_year: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 font-medium focus:ring-2 focus:ring-emerald-500/20 outline-hidden font-mono"
                    required
                  >
                    <option value="">Select Year...</option>
                    {metadata.academic_years?.map((ay) => (
                      <option key={ay.name} value={ay.name}>
                        {ay.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Max Strength
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="200"
                    placeholder="40"
                    value={newGroupData.max_strength}
                    onChange={(e) => setNewGroupData({ ...newGroupData, max_strength: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 font-medium focus:ring-2 focus:ring-emerald-500/20 outline-hidden font-mono"
                  />
                </div>
              </div>

              {/* Academic Term (Optional) */}
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Academic Term (Optional)
                </label>
                <select
                  value={newGroupData.academic_term}
                  onChange={(e) => setNewGroupData({ ...newGroupData, academic_term: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 font-medium focus:ring-2 focus:ring-emerald-500/20 outline-hidden"
                >
                  <option value="">Full Academic Year</option>
                  {metadata.academic_terms
                    ?.filter((at) => !newGroupData.academic_year || at.academic_year === newGroupData.academic_year)
                    .map((at) => (
                      <option key={at.name} value={at.name}>
                        {at.name}
                      </option>
                    ))}
                </select>
              </div>
            </div>

            <div className="p-4 sm:p-5 pt-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/70 flex items-center justify-end gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setCreateGroupModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold hover:bg-slate-200 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={createGroupSubmitting}
                className="px-5 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold transition flex items-center gap-1.5 shadow-md shadow-emerald-500/20 disabled:opacity-50 cursor-pointer"
              >
                {createGroupSubmitting ? (
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Check className="w-3.5 h-3.5" />
                )}
                <span>Create Student Group</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }
}
