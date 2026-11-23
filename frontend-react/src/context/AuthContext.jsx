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

        // Determine active student
        let chosenId = portal.active_student_id || activeStudentId;
        const wardIds = wards.map(w => w.student);
        if (!chosenId || !wardIds.includes(chosenId)) {
          chosenId = wardIds.length ? wardIds[0] : null;
        }
        setActiveStudentId(chosenId);
        if (chosenId) {
          localStorage.setItem('edu_active_student_id', chosenId);
        }

        if (portal.student_info) {
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
        if (portal.student) {
          setActiveStudentId(portal.student);
          localStorage.setItem('edu_active_student_id', portal.student);
        }

        // Fast path: if context already carries profile & program details, hydrate synchronously
        if (portal.student_info) {
          setStudentProfile(portal.student_info);
          const studentPrograms = portal.programs || [];
          setPrograms(studentPrograms);
          const activeProg = portal.active_program || portal.suggested_program || (studentPrograms[0]?.program) || 'Standard 5';
          const activeYear = portal.active_academic_year || portal.suggested_academic_year || (studentPrograms[0]?.academic_year) || null;
          const activeEnr = portal.active_enrollment_id || portal.suggested_enrollment || (studentPrograms[0]?.program_enrollment) || null;
          setActiveProgram(activeProg);
          setActiveAcademicYear(activeYear);
          setActiveEnrollmentId(activeEnr);
          setCurrentEnrollment(portal.enrollment || null);
          setStudentGroups(portal.student_groups || []);
        } else {
          await loadStudentDetails(portal.student || null);
        }
      } else if (portal.role === 'Instructor') {
        setStudents([]);
        setGuardianInfo(null);
        setAdminInfo(null);
        setInstructorInfo(portal.instructor || { instructor_name: portal.full_name || 'Faculty Member' });
        setActiveProgram(portal.active_program || portal.programs?.[0]?.program || null);
        setActiveAcademicYear(null);
        setActiveEnrollmentId(null);
        setStudentGroups(portal.student_groups || []);
        setPrograms(portal.programs || []);
      } else if (portal.role === 'Administrator') {
        setStudents([]);
        setGuardianInfo(null);
        setInstructorInfo(null);
        setAdminInfo(portal.admin || { name: portal.full_name || 'Education Admin' });
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
  }, [activeStudentId]);


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


  // Instant Optimistic Sign In for maximum snappiness
  const optimisticSignIn = async (person, password) => {
    setError(null);
    const resolvedRole = person.role === 'Student' 
      ? 'Student' 
      : (person.role.includes('Faculty') || person.role.includes('Teacher')) 
        ? 'Instructor' 
        : 'Guardian';
    
    setSessionUser(person.email);
    setRole(resolvedRole);

    if (resolvedRole === 'Student') {
      const stuId = person.studentId || 'EDU-STU-2026-00001';
      setActiveStudentId(stuId);
      localStorage.setItem('edu_active_student_id', stuId);
      setStudentProfile({ 
        name: stuId, 
        student_name: person.name, 
        student_email_id: person.email 
      });
      setActiveProgram('Standard 5');
      setPrograms([{ program: 'Standard 5' }, { program: 'Standard 6' }]);
      setStudentGroups([{ label: 'Standard 5 - Section A' }]);
    } else if (resolvedRole === 'Instructor') {
      setInstructorInfo({ name: person.name, instructor_name: person.name });
      setActiveProgram('Standard 5');
      setPrograms([{ program: 'Standard 5' }, { program: 'Standard 6' }]);
      setStudentGroups([{ label: 'Standard 5 - Section A' }, { label: 'Standard 6 - Section A' }]);
    } else if (resolvedRole === 'Guardian') {
      setGuardianInfo({ name: 'EDU-GRD-2026-00001', guardian_name: person.name });
      setStudents([{ student: 'EDU-STU-2026-00001', student_name: 'Rahul Sharma', relation: 'Father' }]);
      setActiveStudentId('EDU-STU-2026-00001');
      setActiveProgram('Standard 5');
    }

    setLoading(false);

    try {
      const res = await api.login(person.email, password);
      const preloadedContext = res?.context || null;
      if (preloadedContext) {
        await bootstrap(person.email, preloadedContext);
      }
      return res;
    } catch (err) {
      setSessionUser(null);
      setRole(null);
      setError(err.message || 'Login failed');
      throw err;
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

  const previewAsStudent = async (studentId = 'EDU-STU-2026-00001') => {
    setLoading(true);
    setRole('Student');
    setActiveStudentId(studentId);
    await loadStudentDetails(studentId);
    setLoading(false);
  };

  const previewAsGuardian = async (guardianName = 'Amit Sharma', studentId = 'EDU-STU-2026-00001') => {
    setLoading(true);
    setRole('Guardian');
    setGuardianInfo({ name: 'EDU-GRD-2026-00001', guardian_name: guardianName });
    setStudents([{ student: studentId, student_name: 'Rahul Sharma', relation: 'Father' }]);
    setActiveStudentId(studentId);
    await loadStudentDetails(studentId);
    setLoading(false);
  };

  const previewAsInstructor = async (instructorName = 'Rajesh Patel') => {
    setLoading(true);
    setRole('Instructor');
    setInstructorInfo({ name: instructorName, instructor_name: instructorName });
    setActiveAcademicYear(null);
    setActiveEnrollmentId(null);
    try {
      const [progs, groups] = await Promise.all([
        api.getAllPrograms().catch(() => []),
        api.getAllStudentGroups().catch(() => []),
      ]);
      const mappedProgs = (progs || []).map(p => ({ program: p.name || p.program }));
      const mappedGroups = (groups || []).map(g => ({ label: g.name || g.label }));
      setPrograms(mappedProgs);
      setStudentGroups(mappedGroups);
      setActiveProgram(mappedProgs[0]?.program || null);
    } catch {
      setPrograms([]);
      setStudentGroups([]);
    }
    setLoading(false);
  };

  const previewAsAdmin = async () => {
    setLoading(true);
    setRole('Administrator');
    setAdminInfo({ name: 'Education Admin' });
    setActiveAcademicYear(null);
    setActiveEnrollmentId(null);
    try {
      const [progs, groups] = await Promise.all([
        api.getAllPrograms().catch(() => []),
        api.getAllStudentGroups().catch(() => []),
      ]);
      const mappedProgs = (progs || []).map(p => ({ program: p.name || p.program }));
      const mappedGroups = (groups || []).map(g => ({ label: g.name || g.label }));
      setPrograms(mappedProgs);
      setStudentGroups(mappedGroups);
      setActiveProgram(mappedProgs[0]?.program || null);
    } catch {
      setPrograms([]);
      setStudentGroups([]);
    }
    setLoading(false);
  };

  const logout = async () => {
    try {
      await api.logout();
    } finally {
      setSessionUser(null);
      setRole(null);
      setStudentProfile(null);
      setInstructorInfo(null);
      setAdminInfo(null);
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
