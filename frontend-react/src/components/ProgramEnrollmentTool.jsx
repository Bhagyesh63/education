import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/frappeClient';
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  ChevronLeft,
  ClipboardList,
  GraduationCap,
  Loader2,
  RefreshCw,
  Search,
  SkipForward,
  UserPlus,
  Users,
  X,
  XCircle,
} from 'lucide-react';

// Portal version of the desk "Program Enrollment Tool":
//  * Program Enrollment -> promote / re-enroll students of a class into a new class / year / term
//  * Student Applicant  -> admit Approved applicants as Students and enroll them

const SOURCE_ENROLLMENT = 'Program Enrollment';
const SOURCE_APPLICANT = 'Student Applicant';

const selectCls =
  'w-full min-h-[38px] px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm sm:text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500/30 disabled:opacity-60';

function Field({ label, hint, children }) {
  return (
    <label className="block space-y-1 min-w-0">
      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">{label}</span>
      {children}
      {hint && <span className="block text-[11px] text-slate-400">{hint}</span>}
    </label>
  );
}

const nextYearOf = (years, current) => {
  // academic years are returned newest first; pick the one starting right after `current`
  const cur = years.find((y) => y.name === current);
  if (!cur) return '';
  const later = years
    .filter((y) => y.year_start_date > cur.year_start_date)
    .sort((a, b) => a.year_start_date.localeCompare(b.year_start_date));
  return later[0]?.name || '';
};

export default function ProgramEnrollmentTool() {
  const [meta, setMeta] = useState(null);
  const [metaError, setMetaError] = useState('');

  // source filters
  const [source, setSource] = useState(SOURCE_ENROLLMENT);
  const [program, setProgram] = useState('');
  const [academicYear, setAcademicYear] = useState('');
  const [academicTerm, setAcademicTerm] = useState('');
  const [studentBatch, setStudentBatch] = useState('');

  // target
  const [newProgram, setNewProgram] = useState('');
  const [newAcademicYear, setNewAcademicYear] = useState('');
  const [newAcademicTerm, setNewAcademicTerm] = useState('');
  const [newStudentBatch, setNewStudentBatch] = useState('');
  const [enrollmentDate, setEnrollmentDate] = useState('');
  const [studentGroup, setStudentGroup] = useState('');
  const [submitEnrollments, setSubmitEnrollments] = useState(true);

  // students
  const [students, setStudents] = useState(null);
  const [excluded, setExcluded] = useState({});
  const [selected, setSelected] = useState({});
  const [search, setSearch] = useState('');
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [error, setError] = useState('');

  // enroll
  const [confirming, setConfirming] = useState(false);
  const [enrolling, setEnrolling] = useState(false);
  const [result, setResult] = useState(null);

  const loadMeta = () => {
    setMetaError('');
    api.getProgramEnrollmentToolMetadata()
      .then((m) => {
        setMeta(m);
        const year = m?.academic_years?.[0]?.name || '';
        setAcademicYear((y) => y || year);
        setProgram((p) => p || m?.programs?.[0]?.name || '');
      })
      .catch((e) => setMetaError(e.message || 'Could not load programs and academic years.'));
  };
  useEffect(loadMeta, []);

  const programs = meta?.programs || [];
  const years = meta?.academic_years || [];
  const terms = meta?.academic_terms || [];
  const batches = meta?.student_batches || [];
  const termsFor = (year) => terms.filter((t) => t.academic_year === year);
  const isApplicantSource = source === SOURCE_APPLICANT;

  // Target defaults: next class / next academic year (falls back to the same year).
  useEffect(() => {
    if (!meta || isApplicantSource) return;
    const idx = programs.findIndex((p) => p.name === program);
    setNewProgram(programs[idx + 1]?.name || program);
    setNewAcademicYear(nextYearOf(years, academicYear) || academicYear);
  }, [meta, program, academicYear, isApplicantSource]); // eslint-disable-line react-hooks/exhaustive-deps

  // Applicants are enrolled into the program/year they applied for.
  const targetProgram = isApplicantSource ? program : newProgram;
  const targetYear = isApplicantSource ? academicYear : newAcademicYear;

  useEffect(() => {
    setNewAcademicTerm('');
    setStudentGroup('');
  }, [targetYear, targetProgram]);

  // Enrollment date follows the target term / year start (same as the desk tool).
  useEffect(() => {
    const term = terms.find((t) => t.name === newAcademicTerm);
    const year = years.find((y) => y.name === targetYear);
    setEnrollmentDate(term?.term_start_date || year?.year_start_date || '');
  }, [newAcademicTerm, targetYear, meta]); // eslint-disable-line react-hooks/exhaustive-deps

  // Any change of the source invalidates the fetched list.
  useEffect(() => {
    setStudents(null);
    setSelected({});
    setResult(null);
    setError('');
  }, [source, program, academicYear, academicTerm, studentBatch]);

  const groupsForTarget = (meta?.student_groups || []).filter(
    (g) => (!g.program || g.program === targetProgram) && (!g.academic_year || g.academic_year === targetYear)
  );

  const fetchStudents = async () => {
    setError('');
    setResult(null);
    if (!program || !academicYear) {
      setError('Choose a program and an academic year first.');
      return;
    }
    if (meta?.academic_term_reqd && !academicTerm) {
      setError('Academic Term is required by Education Settings.');
      return;
    }
    setLoadingStudents(true);
    try {
      const res = await api.getProgramEnrollmentToolStudents({
        get_students_from: source,
        program,
        academic_year: academicYear,
        academic_term: academicTerm,
        student_batch: isApplicantSource ? '' : studentBatch,
        new_program: isApplicantSource ? '' : newProgram,
        new_academic_year: isApplicantSource ? '' : newAcademicYear,
        new_academic_term: isApplicantSource ? '' : newAcademicTerm,
      });
      const rows = res?.students || [];
      setStudents(rows);
      setExcluded(res?.excluded || {});
      setSelected(Object.fromEntries(rows.filter((r) => !r.already_enrolled).map((r) => [r.key, true])));
    } catch (e) {
      setStudents(null);
      setError(e.message || 'Could not load students.');
    } finally {
      setLoadingStudents(false);
    }
  };

  // Re-check "already enrolled" flags when the target changes after fetching.
  useEffect(() => {
    if (students && !isApplicantSource) fetchStudents();
  }, [newProgram, newAcademicYear, newAcademicTerm]); // eslint-disable-line react-hooks/exhaustive-deps

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (students || []).filter(
      (s) =>
        !q ||
        (s.student_name || '').toLowerCase().includes(q) ||
        (s.student || s.student_applicant || '').toLowerCase().includes(q)
    );
  }, [students, search]);

  const selectable = (students || []).filter((s) => !s.already_enrolled);
  const selectedRows = selectable.filter((s) => selected[s.key]);
  const allSelected = selectable.length > 0 && selectedRows.length === selectable.length;
  const toggleAll = () =>
    setSelected(allSelected ? {} : Object.fromEntries(selectable.map((s) => [s.key, true])));

  const validationError = (() => {
    if (!selectedRows.length) return 'Select at least one student.';
    if (!isApplicantSource && (!newProgram || !newAcademicYear)) return 'Choose the new program and academic year.';
    if (!isApplicantSource && newProgram === program && newAcademicYear === academicYear && newAcademicTerm === academicTerm)
      return 'The target is the same as the source enrollment.';
    if (!submitEnrollments && studentGroup) return 'Students can only be added to a group when enrollments are submitted.';
    return '';
  })();

  const enroll = async () => {
    setConfirming(false);
    setEnrolling(true);
    setError('');
    try {
      const res = await api.enrollStudentsViaTool({
        get_students_from: source,
        students: selectedRows.map((s) => ({
          student: s.student,
          student_applicant: s.student_applicant,
          student_name: s.student_name,
          student_category: s.student_category,
          student_batch_name: s.student_batch_name,
          current_enrollment: s.current_enrollment,
        })),
        new_program: isApplicantSource ? undefined : newProgram,
        new_academic_year: isApplicantSource ? undefined : newAcademicYear,
        new_academic_term: newAcademicTerm || undefined,
        new_student_batch: newStudentBatch || undefined,
        enrollment_date: enrollmentDate || undefined,
        student_group: studentGroup || undefined,
        submit: submitEnrollments ? 1 : 0,
      });
      setResult(res);
      await fetchStudents();
      setResult(res); // fetchStudents clears it
    } catch (e) {
      setError(e.message || 'Enrollment failed.');
    } finally {
      setEnrolling(false);
    }
  };

  return (
    <div className="space-y-5 sm:space-y-6 min-w-0 pb-24">
      {/* Header */}
      <div className="p-4 sm:p-8 rounded-2xl sm:rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm">
        <Link to="/reports-tools" className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-brand-600 dark:text-slate-400">
          <ChevronLeft className="w-3.5 h-3.5" /> Reports & Tools
        </Link>
        <div className="mt-3 flex flex-wrap items-start gap-3">
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-teal-50 dark:bg-teal-950/60 text-teal-600 dark:text-teal-400 flex items-center justify-center shrink-0">
            <UserPlus className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
          <div className="min-w-0 flex-1 basis-[240px]">
            <h1 className="text-xl sm:text-3xl font-black text-slate-900 dark:text-slate-100 tracking-tight">Program Enrollment Tool</h1>
            <p className="mt-1 text-xs sm:text-sm text-slate-500 dark:text-slate-400">
              Promote students to the next class or academic year, or admit approved applicants — in bulk.
            </p>
          </div>
        </div>
      </div>

      {metaError && (
        <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 text-sm text-rose-700 dark:text-rose-300 flex flex-wrap items-center justify-between gap-3">
          <span className="flex items-center gap-2 min-w-0 break-words"><AlertCircle className="w-4 h-4 shrink-0" />{metaError}</span>
          <button onClick={loadMeta} className="px-3 py-1.5 rounded-lg bg-rose-100 dark:bg-rose-900/60 text-xs font-bold">Retry</button>
        </div>
      )}

      {/* Step 1: source */}
      <section className="p-4 sm:p-6 rounded-2xl sm:rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-4">
        <h2 className="text-sm font-extrabold text-slate-900 dark:text-slate-100 uppercase tracking-wider">1. Get students from</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-1 rounded-2xl bg-slate-100 dark:bg-slate-800/70">
          {[
            { value: SOURCE_ENROLLMENT, label: 'Promote enrolled students', icon: GraduationCap, hint: 'Students of a class → new class / year' },
            { value: SOURCE_APPLICANT, label: 'Admit approved applicants', icon: ClipboardList, hint: 'Approved applications → new students' },
          ].map(({ value, label, icon: Icon, hint }) => (
            <button
              key={value}
              type="button"
              onClick={() => setSource(value)}
              className={`min-h-[44px] px-3 py-2 rounded-xl text-left flex items-center gap-2.5 transition ${
                source === value
                  ? 'bg-white dark:bg-slate-900 shadow-sm text-brand-700 dark:text-brand-300'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span className="min-w-0">
                <span className="block text-xs font-bold">{label}</span>
                <span className="block text-[11px] opacity-75">{hint}</span>
              </span>
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
          <Field label="Program *">
            <select className={selectCls} value={program} onChange={(e) => setProgram(e.target.value)} disabled={!meta}>
              {programs.map((p) => <option key={p.name} value={p.name}>{p.program_name || p.name}</option>)}
            </select>
          </Field>
          <Field label="Academic Year *">
            <select className={selectCls} value={academicYear} onChange={(e) => { setAcademicYear(e.target.value); setAcademicTerm(''); }} disabled={!meta}>
              {years.map((y) => <option key={y.name} value={y.name}>{y.name}</option>)}
            </select>
          </Field>
          <Field label={meta?.academic_term_reqd ? 'Academic Term *' : 'Academic Term'}>
            <select className={selectCls} value={academicTerm} onChange={(e) => setAcademicTerm(e.target.value)} disabled={!meta}>
              <option value="">All terms</option>
              {termsFor(academicYear).map((t) => <option key={t.name} value={t.name}>{t.name}</option>)}
            </select>
          </Field>
          {!isApplicantSource && (
            <Field label="Batch">
              <select className={selectCls} value={studentBatch} onChange={(e) => setStudentBatch(e.target.value)} disabled={!meta}>
                <option value="">All batches</option>
                {batches.map((b) => <option key={b} value={b}>{b}</option>)}
              </select>
            </Field>
          )}
        </div>
        {isApplicantSource && (
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            Only applicants with status <strong>Approved</strong> who have not been admitted yet are listed. They are enrolled in the program and academic year they applied for.
          </p>
        )}
        <button
          type="button"
          onClick={fetchStudents}
          disabled={!meta || loadingStudents}
          className="w-full sm:w-auto min-h-[40px] px-5 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold inline-flex items-center justify-center gap-2 disabled:opacity-60"
        >
          {loadingStudents ? <Loader2 className="w-4 h-4 animate-spin" /> : <Users className="w-4 h-4" />}
          Get Students
        </button>
      </section>

      {error && (
        <div className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 text-xs text-rose-700 dark:text-rose-300 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" /><span className="break-words min-w-0">{error}</span>
        </div>
      )}

      {/* Step 2: students */}
      {students && (
        <section className="p-4 sm:p-6 rounded-2xl sm:rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-sm font-extrabold text-slate-900 dark:text-slate-100 uppercase tracking-wider">
              2. Students <span className="text-slate-400 font-semibold normal-case tracking-normal">({selectedRows.length} of {selectable.length} selected)</span>
            </h2>
            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
              <div className="relative flex-1 sm:flex-none sm:w-56">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search name or ID…"
                  className="w-full min-h-[38px] pl-8 pr-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm sm:text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
                />
              </div>
              <button
                type="button"
                onClick={toggleAll}
                disabled={!selectable.length}
                className="min-h-[38px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50"
              >
                {allSelected ? 'Clear selection' : 'Select all'}
              </button>
            </div>
          </div>

          {(excluded.disabled_students || excluded.already_admitted) && (
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Not listed:{' '}
              {[
                excluded.disabled_students && `${excluded.disabled_students} disabled student(s)`,
                excluded.already_admitted && `${excluded.already_admitted} applicant(s) already admitted`,
              ].filter(Boolean).join(', ')}.
            </p>
          )}

          {students.length === 0 ? (
            <p className="p-8 text-center text-sm text-slate-500 dark:text-slate-400 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700">
              {isApplicantSource
                ? 'No approved applicants waiting for enrollment for this program and year.'
                : 'No submitted enrollments of enabled students for these filters.'}
            </p>
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800 rounded-2xl border border-slate-200/80 dark:border-slate-800 overflow-hidden">
              {visible.map((s) => {
                const disabled = s.already_enrolled;
                return (
                  <li key={s.key}>
                    <label className={`flex items-center gap-3 px-3 sm:px-4 py-3 min-h-[52px] ${disabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/40'}`}>
                      <input
                        type="checkbox"
                        className="w-4 h-4 rounded accent-brand-600 shrink-0"
                        checked={!!selected[s.key] && !disabled}
                        disabled={disabled}
                        onChange={(e) => setSelected((cur) => ({ ...cur, [s.key]: e.target.checked }))}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-semibold text-slate-900 dark:text-slate-100 truncate" title={s.student_name}>{s.student_name}</span>
                        <span className="block text-[11px] text-slate-500 dark:text-slate-400 break-all">
                          {s.student || s.student_applicant}
                          {s.student_batch_name ? ` · ${s.student_batch_name}` : ''}
                          {s.student_category ? ` · ${s.student_category}` : ''}
                        </span>
                      </span>
                      {disabled && (
                        <span className="shrink-0 text-[11px] font-bold px-2 py-1 rounded-lg bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300" title={s.existing_enrollment}>
                          Already enrolled
                        </span>
                      )}
                    </label>
                  </li>
                );
              })}
              {visible.length === 0 && <li className="p-6 text-center text-xs text-slate-500">No students match “{search}”.</li>}
            </ul>
          )}
        </section>
      )}

      {/* Step 3: target */}
      {students && students.length > 0 && (
        <section className="p-4 sm:p-6 rounded-2xl sm:rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-4">
          <h2 className="text-sm font-extrabold text-slate-900 dark:text-slate-100 uppercase tracking-wider">3. Enroll into</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
            {isApplicantSource ? (
              <Field label="Program / Academic Year" hint="From the application">
                <div className={`${selectCls} bg-slate-50 dark:bg-slate-800/60`}>{program} · {academicYear}</div>
              </Field>
            ) : (
              <>
                <Field label="New Program *">
                  <select className={selectCls} value={newProgram} onChange={(e) => setNewProgram(e.target.value)}>
                    {programs.map((p) => <option key={p.name} value={p.name}>{p.program_name || p.name}</option>)}
                  </select>
                </Field>
                <Field label="New Academic Year *">
                  <select className={selectCls} value={newAcademicYear} onChange={(e) => setNewAcademicYear(e.target.value)}>
                    {years.map((y) => <option key={y.name} value={y.name}>{y.name}</option>)}
                  </select>
                </Field>
              </>
            )}
            <Field label="New Academic Term">
              <select className={selectCls} value={newAcademicTerm} onChange={(e) => setNewAcademicTerm(e.target.value)}>
                <option value="">{isApplicantSource ? 'As in application' : 'None'}</option>
                {termsFor(targetYear).map((t) => <option key={t.name} value={t.name}>{t.name}</option>)}
              </select>
            </Field>
            <Field label="New Batch" hint={isApplicantSource ? undefined : 'Empty keeps each student’s current batch'}>
              <select className={selectCls} value={newStudentBatch} onChange={(e) => setNewStudentBatch(e.target.value)}>
                <option value="">{isApplicantSource ? 'None' : 'Keep current batch'}</option>
                {batches.map((b) => <option key={b} value={b}>{b}</option>)}
              </select>
            </Field>
            <Field label="Enrollment Date" hint="Defaults to the term / year start date">
              <input type="date" className={selectCls} value={enrollmentDate} onChange={(e) => setEnrollmentDate(e.target.value)} />
            </Field>
            <Field label="Add to Student Group" hint={groupsForTarget.length ? undefined : 'No groups for this program and year'}>
              <select className={selectCls} value={studentGroup} onChange={(e) => setStudentGroup(e.target.value)} disabled={!groupsForTarget.length}>
                <option value="">Don't add to a group</option>
                {groupsForTarget.map((g) => <option key={g.name} value={g.name}>{g.name}</option>)}
              </select>
            </Field>
          </div>
          <label className="flex items-start gap-2.5 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
            <input type="checkbox" className="w-4 h-4 mt-0.5 rounded accent-brand-600" checked={submitEnrollments} onChange={(e) => setSubmitEnrollments(e.target.checked)} />
            <span>
              <strong>Submit enrollments</strong> — creates course enrollments, sets joining dates and fee records.
              Untick to create drafts for review in the desk (like the desk tool).
            </span>
          </label>
        </section>
      )}

      {/* Result */}
      {result && <ResultPanel result={result} onClose={() => setResult(null)} />}

      {/* Sticky action bar */}
      {students && students.length > 0 && (
        <div className="fixed bottom-3 inset-x-3 sm:bottom-5 sm:inset-x-auto sm:right-6 lg:right-10 z-30 print:hidden">
          <div className="p-3 rounded-2xl bg-white/95 dark:bg-slate-900/95 backdrop-blur border border-slate-200 dark:border-slate-700 shadow-xl flex flex-wrap items-center gap-3">
            <span className="text-xs text-slate-600 dark:text-slate-300 min-w-0 flex-1 sm:flex-none">
              {validationError || (
                <>
                  <strong>{selectedRows.length}</strong> student{selectedRows.length === 1 ? '' : 's'} → <strong>{targetProgram}</strong> ({targetYear})
                </>
              )}
            </span>
            <button
              type="button"
              onClick={() => setConfirming(true)}
              disabled={!!validationError || enrolling}
              className="w-full sm:w-auto min-h-[40px] px-5 rounded-xl bg-gradient-to-r from-brand-600 to-indigo-600 text-white text-xs font-bold inline-flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {enrolling ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
              Enroll {selectedRows.length || ''} Student{selectedRows.length === 1 ? '' : 's'}
            </button>
          </div>
        </div>
      )}

      {/* Confirm dialog */}
      {confirming && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm" onClick={() => setConfirming(false)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="pet-confirm-title"
            className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-2xl p-5 sm:p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <h3 id="pet-confirm-title" className="text-base font-black text-slate-900 dark:text-slate-100">Confirm enrollment</h3>
              <button onClick={() => setConfirming(false)} aria-label="Close" className="w-9 h-9 -m-1.5 rounded-xl flex items-center justify-center text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 shrink-0">
                <X className="w-4 h-4" />
              </button>
            </div>
            <dl className="text-xs space-y-2">
              {[
                ['Students', `${selectedRows.length}${isApplicantSource ? ' approved applicant(s) → new students' : ''}`],
                ['Program', targetProgram],
                ['Academic Year', targetYear],
                ['Academic Term', newAcademicTerm || (isApplicantSource ? 'As in application' : '—')],
                ['Batch', newStudentBatch || (isApplicantSource ? '—' : 'Keep current')],
                ['Enrollment Date', enrollmentDate || 'Term / year start'],
                ['Student Group', studentGroup || '—'],
                ['Status', submitEnrollments ? 'Submitted' : 'Draft'],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-3">
                  <dt className="text-slate-500">{k}</dt>
                  <dd className="font-semibold text-slate-900 dark:text-slate-100 text-right break-words min-w-0">{v}</dd>
                </div>
              ))}
            </dl>
            <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end">
              <button onClick={() => setConfirming(false)} className="min-h-[40px] px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300">Cancel</button>
              <button onClick={enroll} className="min-h-[40px] px-5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold">Enroll now</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ResultPanel({ result, onClose }) {
  const ok = result.enrolled_count > 0;
  return (
    <section
      className={`p-4 sm:p-6 rounded-2xl sm:rounded-3xl border shadow-sm space-y-4 ${
        result.error_count
          ? 'bg-amber-50/60 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900'
          : 'bg-emerald-50/60 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900'
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-2.5 min-w-0">
          {ok ? <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" /> : <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />}
          <div className="min-w-0">
            <h2 className="text-sm font-extrabold text-slate-900 dark:text-slate-100">
              {result.enrolled_count} enrolled{result.skipped_count ? ` · ${result.skipped_count} skipped` : ''}
              {result.error_count ? ` · ${result.error_count} failed` : ''}
            </h2>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              {result.submitted ? 'Enrollments were submitted.' : 'Enrollments were saved as drafts.'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={onClose} aria-label="Dismiss" className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-500 hover:bg-white/60 dark:hover:bg-slate-800">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
      <ul className="space-y-1.5 text-xs">
        {result.enrolled.map((r) => (
          <li key={r.program_enrollment} className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            <span className="font-semibold text-slate-900 dark:text-slate-100">{r.student_name}</span>
            <span className="text-slate-500 break-all">{r.student} → {r.program_enrollment}</span>
          </li>
        ))}
        {result.skipped.map((r) => (
          <li key={`s-${r.student}`} className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <SkipForward className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span className="font-semibold text-slate-900 dark:text-slate-100">{r.student_name || r.student}</span>
            <span className="text-slate-500 break-words">skipped — {r.reason}</span>
          </li>
        ))}
        {result.errors.map((r) => (
          <li key={`e-${r.student}`} className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <XCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
            <span className="font-semibold text-slate-900 dark:text-slate-100">{r.student_name || r.student}</span>
            <span className="text-rose-600 dark:text-rose-400 break-words">{r.error}</span>
          </li>
        ))}
      </ul>
      <p className="text-[11px] text-slate-500 flex items-center gap-1.5">
        <RefreshCw className="w-3 h-3" /> The student list above has been refreshed.
      </p>
    </section>
  );
}
