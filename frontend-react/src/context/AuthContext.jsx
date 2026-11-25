import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { api, getSessionUser } from '../api/frappeClient';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [sessionUser, setSessionUser] = useState(getSessionUser());
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState(null); // 'Student' | 'Guardian'
  const [guardianInfo, setGuardianInfo] = useState(null);
  const [students, setStudents] = useState([]); // Wards for guardian
  const [activeStudentId, setActiveStudentId] = useState(() => {
    return localStorage.getItem('edu_active_student_id') || null;
  });

  const [studentProfile, setStudentProfile] = useState(null);
  const [programs, setPrograms] = useState([]);
  const [activeProgram, setActiveProgram] = useState(null);
  const [activeAcademicYear, setActiveAcademicYear] = useState(() => {
    return localStorage.getItem('edu_active_academic_year') || null;
  });
  const [activeEnrollmentId, setActiveEnrollmentId] = useState(() => {
    return localStorage.getItem('edu_active_enrollment_id') || null;
  });

  const activeProgramDisplay = useMemo(() => {
    if (!activeProgram) return 'Program';
    if (activeAcademicYear) {
      return `${activeProgram} (${activeAcademicYear})`;
    }
    return activeProgram;
  }, [activeProgram, activeAcademicYear]);

  const [currentEnrollment, setCurrentEnrollment] = useState(null);
  const [studentGroups, setStudentGroups] = useState([]);
  const [schoolSettings, setSchoolSettings] = useState(null);
  const [error, setError] = useState(null);

  const [instructorInfo, setInstructorInfo] = useState(null);
  const [adminInfo, setAdminInfo] = useState(null);


  // Fetch School branding
  useEffect(() => {
    api.getSchoolSettings()
      .then(settings => setSchoolSettings(settings))
      .catch(() => {});
  }, []);

  // Main bootstrap function
  const bootstrap = useCallback(async (forcedUser = null, preloadedContext = null) => {
    setLoading(true);
    setError(null);
    try {
      const user = forcedUser || getSessionUser();
      if (!user && !preloadedContext) {
        setSessionUser(null);
        setRole(null);
        setLoading(false);
        return;
      }
      if (user) {
        setSessionUser(user);
      }

      // 1. Fetch portal context if not preloaded
      const portal = preloadedContext || await api.getPortalContext();
      if (!portal || !portal.role) {
        setRole(null);
        setLoading(false);
        return;
      }

      setRole(portal.role);

      if (portal.role === 'Guardian') {
        setGuardianInfo(portal.guardian || {});
        setInstructorInfo(null);
        setAdminInfo(null);
        const wards = portal.students || [];
        setStudents(wards);

        // Determine active student: keep a previously chosen ward if it belongs to this guardian
        const wardIds = wards.map(w => w.student);
        const savedId = localStorage.getItem('edu_active_student_id');
        let chosenId = (savedId && wardIds.includes(savedId)) ? savedId : (portal.active_student_id || null);
        if (!chosenId || !wardIds.includes(chosenId)) {
          chosenId = wardIds.length ? wardIds[0] : null;
        }
        setActiveStudentId(chosenId);
        if (chosenId) {
          localStorage.setItem('edu_active_student_id', chosenId);
        } else {
          localStorage.removeItem('edu_active_student_id');
          setStudentProfile(null);
          setPrograms([]);
          setActiveProgram(null);
          setActiveAcademicYear(null);
          setActiveEnrollmentId(null);
          setCurrentEnrollment(null);
          setStudentGroups([]);
        }

        if (chosenId && portal.student_info && chosenId === portal.active_student_id) {
          setStudentProfile(portal.student_info);
          setPrograms(portal.programs || []);
          setActiveProgram(portal.active_program || portal.suggested_program || null);
          setActiveAcademicYear(portal.active_academic_year || portal.suggested_academic_year || null);
          setActiveEnrollmentId(portal.active_enrollment_id || portal.suggested_enrollment || null);
          setCurrentEnrollment(portal.enrollment || null);
          setStudentGroups(portal.student_groups || []);
        } else if (chosenId) {
          await loadStudentDetails(chosenId);
        }
      } else if (portal.role === 'Student') {
        setStudents([]);
        setGuardianInfo(null);
        setInstructorInfo(null);
        setAdminInfo(null);
        setActiveStudentId(portal.student || null);
        if (portal.student) {
          localStorage.setItem('edu_active_student_id', portal.student);
        } else {
          localStorage.removeItem('edu_active_student_id');
        }

        // Fast path: if context already carries profile & program details, hydrate synchronously
        if (portal.student_info) {
          setStudentProfile(portal.student_info);
          const studentPrograms = portal.programs || [];
          setPrograms(studentPrograms);
          const activeProg = portal.active_program || portal.suggested_program || (studentPrograms[0]?.program) || null;
          const activeYear = portal.active_academic_year || portal.suggested_academic_year || (studentPrograms[0]?.academic_year) || null;
          const activeEnr = portal.active_enrollment_id || portal.suggested_enrollment || (studentPrograms[0]?.program_enrollment) || null;
          setActiveProgram(activeProg);
          setActiveAcademicYear(activeYear);
          setActiveEnrollmentId(activeEnr);
          setCurrentEnrollment(portal.enrollment || null);
          setStudentGroups(portal.student_groups || []);
        } else if (portal.student) {
          await loadStudentDetails(portal.student);
        } else {
          // Student role without a linked Student record: show empty states, never placeholder data
          setStudentProfile(null);
          setPrograms([]);
          setActiveProgram(null);
          setActiveAcademicYear(null);
          setActiveEnrollmentId(null);
          setCurrentEnrollment(null);
          setStudentGroups([]);
        }
      } else if (portal.role === 'Instructor') {
        setStudents([]);
        setGuardianInfo(null);
        setAdminInfo(null);
        setStudentProfile(null);
        setActiveStudentId(null);
        // Instructor record may be unlinked; fall back to the real user's name, with no record id
        setInstructorInfo(portal.instructor || { name: null, instructor_name: portal.full_name || portal.user || null });
        setActiveProgram(portal.active_program || portal.programs?.[0]?.program || null);
        setActiveAcademicYear(null);
        setActiveEnrollmentId(null);
        setStudentGroups(portal.student_groups || []);
        setPrograms(portal.programs || []);
      } else if (portal.role === 'Administrator') {
        setStudents([]);
        setGuardianInfo(null);
        setInstructorInfo(null);
        setStudentProfile(null);
        setActiveStudentId(null);
        setAdminInfo(portal.admin || { user: portal.user || null, name: portal.full_name || portal.user || null });
        setActiveProgram(portal.active_program || portal.programs?.[0]?.program || null);
        setActiveAcademicYear(null);
        setActiveEnrollmentId(null);
        setStudentGroups(portal.student_groups || []);
        setPrograms(portal.programs || []);
      }
    } catch (err) {
      console.error('Error during portal bootstrap:', err);
      setError(err.message || 'Failed to initialize session');
    } finally {
      setLoading(false);
    }
  }, []);


  // Load student profile & programs
  const loadStudentDetails = async (targetStudentId) => {
    try {
      const profileData = await api.getStudentProfile(targetStudentId);
      if (!profileData) return;

      setStudentProfile(profileData.student || {});
      if (profileData.student?.name) {
        setActiveStudentId(profileData.student.name);
        localStorage.setItem('edu_active_student_id', profileData.student.name);
      }
      const studentPrograms = profileData.programs || [];
      setPrograms(studentPrograms);

      // Select program and academic year
      const studentKey = profileData.student?.name;
      const savedProgram = studentKey ? localStorage.getItem(`edu_active_program_${studentKey}`) : null;
      const savedYear = studentKey ? localStorage.getItem(`edu_active_year_${studentKey}`) : null;
      const savedEnrollment = studentKey ? localStorage.getItem(`edu_active_enrollment_${studentKey}`) : null;

      let chosenProgram = savedProgram;
      let chosenYear = savedYear;
      let chosenEnrollment = savedEnrollment;

      const matching = studentPrograms.find(p => 
        (chosenEnrollment && p.program_enrollment === chosenEnrollment) ||
        (chosenProgram && chosenYear && p.program === chosenProgram && p.academic_year === chosenYear) ||
        (chosenProgram && p.program === chosenProgram)
      );

      if (matching) {
        chosenProgram = matching.program;
        chosenYear = matching.academic_year;
        chosenEnrollment = matching.program_enrollment;
      } else {
        chosenProgram = profileData.suggested_program || (studentPrograms[0]?.program || null);
        chosenYear = profileData.suggested_academic_year || (studentPrograms[0]?.academic_year || null);
        chosenEnrollment = profileData.suggested_enrollment || (studentPrograms[0]?.program_enrollment || null);
      }

      setActiveProgram(chosenProgram);
      setActiveAcademicYear(chosenYear);
      setActiveEnrollmentId(chosenEnrollment);

      if (studentKey) {
        if (chosenProgram) localStorage.setItem(`edu_active_program_${studentKey}`, chosenProgram);
        if (chosenYear) localStorage.setItem(`edu_active_year_${studentKey}`, chosenYear);
        if (chosenEnrollment) localStorage.setItem(`edu_active_enrollment_${studentKey}`, chosenEnrollment);
      }

      if (chosenProgram || chosenEnrollment) {
        await loadProgramContextData(targetStudentId, chosenProgram, chosenYear, chosenEnrollment);
      }
    } catch (err) {
      console.error('Error loading student profile:', err);
    }
  };

  const loadProgramContextData = async (targetStudentId, prog, academicYear = null, enrollmentId = null) => {
    try {
      const context = await api.getProgramContext(targetStudentId, prog, academicYear, enrollmentId);
      if (context) {
        if (context.program) setActiveProgram(context.program);
        if (context.academic_year) setActiveAcademicYear(context.academic_year);
        if (context.program_enrollment) setActiveEnrollmentId(context.program_enrollment);
        setCurrentEnrollment(context.enrollment || null);
        setStudentGroups(context.student_groups || []);
      }
    } catch (err) {
      console.error('Error loading program context:', err);
    }
  };


  // Login handler calling Frappe API
  const login = async (usr, pwd) => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.login(usr, pwd);
      setSessionUser(usr);
      const preloadedContext = res?.context || null;
      await bootstrap(usr, preloadedContext);
      return res;
    } catch (err) {
      setError(err.message || 'Login failed');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // Backward-compatible alias: directory quick-pick sign-in now always uses the real login flow
  const optimisticSignIn = (person, password) => login(person?.email, password);

  // Switch student (for guardians)
  const selectStudent = async (studentId) => {
    setActiveStudentId(studentId);
    localStorage.setItem('edu_active_student_id', studentId);
    setLoading(true);
    await loadStudentDetails(studentId);
    setLoading(false);
  };

  // Switch active academic program
  const selectProgram = async (programOrEnrollment, academicYear = null, enrollmentId = null) => {
    let programName = programOrEnrollment;
    let year = academicYear;
    let enrId = enrollmentId;

    if (typeof programOrEnrollment === 'object' && programOrEnrollment !== null) {
      programName = programOrEnrollment.program;
      year = programOrEnrollment.academic_year;
      enrId = programOrEnrollment.program_enrollment;
    }

    const studentKey = studentProfile?.name || activeStudentId;
    setActiveProgram(programName);
    setActiveAcademicYear(year);
    setActiveEnrollmentId(enrId);

    if (studentKey) {
      if (programName) localStorage.setItem(`edu_active_program_${studentKey}`, programName);
      if (year) localStorage.setItem(`edu_active_year_${studentKey}`, year);
      if (enrId) localStorage.setItem(`edu_active_enrollment_${studentKey}`, enrId);
    }
    await loadProgramContextData(activeStudentId, programName, year, enrId);
  };

  // Administrator preview: hydrate the portal from a real record's context.
  // The backend (get_preview_context) restricts this to System Managers.
  const startPreview = async (targetRole, target) => {
    if (!target) throw new Error('A record must be selected to preview');
    setLoading(true);
    setError(null);
    try {
      const ctx = await api.getPreviewContext(targetRole, target);
      if (targetRole === 'Guardian') {
        localStorage.removeItem('edu_active_student_id');
      }
      await bootstrap(null, ctx);
      return ctx;
    } catch (err) {
      setError(err.message || 'Preview failed');
      setLoading(false);
      throw err;
    }
  };

  const previewAsStudent = (studentId) => startPreview('Student', studentId);
  const previewAsGuardian = (guardianId) => startPreview('Guardian', guardianId);
  const previewAsInstructor = (instructorId) => startPreview('Instructor', instructorId);
  // Admin view is simply the real session context of the logged-in administrator
  const previewAsAdmin = () => bootstrap();

  const logout = async () => {
    try {
      await api.logout();
    } finally {
      setSessionUser(null);
      setRole(null);
      setStudentProfile(null);
      setInstructorInfo(null);
      setAdminInfo(null);
      setGuardianInfo(null);
      setStudents([]);
      localStorage.removeItem('edu_active_student_id');
      window.location.href = '/login';
    }
  };

  useEffect(() => {
    bootstrap();
  }, []);

  const activeWard = students.find(s => s.student === activeStudentId) || null;

  return (
    <AuthContext.Provider value={{
      sessionUser,
      isLoggedIn: !!sessionUser,
      role,
      isStudent: role === 'Student',
      isGuardian: role === 'Guardian',
      isInstructor: role === 'Instructor',
      isAdmin: role === 'Administrator',
      isStaff: role === 'Instructor' || role === 'Administrator',
      guardianInfo,
      instructorInfo,
      adminInfo,
      students,
      activeStudentId,
      activeWard,
      studentProfile,
      programs,
      activeProgram,
      activeAcademicYear,
      activeEnrollmentId,
      activeProgramDisplay,
      currentEnrollment,
      studentGroups,
      schoolSettings,
      loading,
      error,
      login,
      optimisticSignIn,
      selectStudent,
      selectProgram,
      previewAsStudent,
      previewAsGuardian,
      previewAsInstructor,
      previewAsAdmin,
      refresh: bootstrap,
      logout,
    }}>
      {children}
    </AuthContext.Provider>
  );


}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
