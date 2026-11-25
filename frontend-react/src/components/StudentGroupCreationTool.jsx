import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/frappeClient';
import {
  AlertCircle,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  ChevronLeft,
  Layers,
  Loader2,
  SkipForward,
  Users,
  X,
  XCircle,
} from 'lucide-react';

// Portal version of the desk "Student Group Creation Tool": propose one Batch group per
// batch and one Course group per course of a program (optionally per batch), then create
// the selected groups filled with the enrolled students.

const inputCls =
  'w-full min-h-[38px] px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm sm:text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500/30 disabled:opacity-60';

function Field({ label, children, className = '' }) {
  return (
    <label className={`block space-y-1 min-w-0 ${className}`}>
      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">{label}</span>
      {children}
    </label>
  );
}

export default function StudentGroupCreationTool() {
  const [meta, setMeta] = useState(null);
  const [metaError, setMetaError] = useState('');

  const [program, setProgram] = useState('');
  const [academicYear, setAcademicYear] = useState('');
  const [academicTerm, setAcademicTerm] = useState('');
  const [separateGroups, setSeparateGroups] = useState(false);
  const [nameStyle, setNameStyle] = useState('school');

  const [rows, setRows] = useState(null); // proposals + editable fields
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [creating, setCreating] = useState(false);
  const [result, setResult] = useState(null);

  const loadMeta = () => {
    setMetaError('');
    api.getStudentGroupToolMetadata()
      .then((m) => {
        setMeta(m);
        setProgram((p) => p || m?.programs?.[0]?.name || '');
        setAcademicYear((y) => y || m?.current_academic_year || m?.academic_years?.[0]?.name || '');
        setAcademicTerm((t) => t || m?.current_academic_term || '');
      })
      .catch((e) => setMetaError(e.message || 'Could not load programs and academic years.'));
  };
  useEffect(loadMeta, []);

  const terms = (meta?.academic_terms || []).filter((t) => t.academic_year === academicYear);

  // Changing the filters invalidates the proposals.
  useEffect(() => {
    setRows(null);
    setResult(null);
    setError('');
  }, [program, academicYear, academicTerm, separateGroups, nameStyle]);

  const fetchProposals = async ({ keepResult = false } = {}) => {
    setError('');
    if (!keepResult) setResult(null);
    if (!program || !academicYear) {
      setError('Choose a program and an academic year first.');
      return;
    }
    setLoading(true);
    try {
      const res = await api.getStudentGroupProposals({
        program,
        academic_year: academicYear,
        academic_term: academicTerm,
        separate_groups: separateGroups ? 1 : 0,
        name_style: nameStyle,
      });
      setRows(
        (res?.proposals || []).map((p) => ({
          ...p,
          selected: !p.existing_group && p.student_count > 0,
          max_strength: '',
          instructor: p.suggested_instructor || '',
          default_room: '',
        }))
      );
    } catch (e) {
      setRows(null);
      setError(e.message || 'Could not load group proposals.');
    } finally {
      setLoading(false);
    }
  };

  const update = (key, patch) => setRows((cur) => cur.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  const selectable = (rows || []).filter((r) => !r.existing_group);
  const selectedRows = selectable.filter((r) => r.selected);
  const counts = useMemo(
    () => ({
      batch: selectedRows.filter((r) => r.group_based_on === 'Batch').length,
      course: selectedRows.filter((r) => r.group_based_on === 'Course').length,
      students: selectedRows.reduce((n, r) => n + (r.student_count || 0), 0),
    }),
    [selectedRows]
  );

  const validationError = (() => {
    if (!selectedRows.length) return 'Select at least one group.';
    const names = selectedRows.map((r) => r.student_group_name.trim());
    if (names.some((n) => !n)) return 'Every selected group needs a name.';
    if (new Set(names).size !== names.length) return 'Two selected groups have the same name.';
    const over = selectedRows.find((r) => r.max_strength !== '' && Number(r.max_strength) < r.student_count);
    if (over) return `${over.student_group_name}: max strength is below its ${over.student_count} students.`;
    if (selectedRows.some((r) => r.max_strength !== '' && Number(r.max_strength) < 0)) return 'Max strength cannot be negative.';
    return '';
  })();

  const create = async () => {
    setConfirming(false);
    setCreating(true);
    setError('');
    try {
      const res = await api.createStudentGroupsViaTool({
        program,
        academic_year: academicYear,
        academic_term: academicTerm || undefined,
        groups: selectedRows.map((r) => ({
          group_based_on: r.group_based_on,
          batch: r.batch,
          course: r.course,
          student_group_name: r.student_group_name.trim(),
          max_strength: r.max_strength === '' ? undefined : Number(r.max_strength),
          instructor: r.instructor || undefined,
          default_room: r.default_room || undefined,
        })),
      });
      await fetchProposals({ keepResult: true });
      setResult(res);
    } catch (e) {
      setError(e.message || 'Could not create the groups.');
    } finally {
      setCreating(false);
    }
  };

  const sections = [
    { title: 'Batch / section groups', icon: Users, items: (rows || []).filter((r) => r.group_based_on === 'Batch') },
    { title: 'Course / subject groups', icon: BookOpen, items: (rows || []).filter((r) => r.group_based_on === 'Course') },
  ];

  return (
    <div className="space-y-5 sm:space-y-6 min-w-0 pb-24">
      {/* Header */}
      <div className="p-4 sm:p-8 rounded-2xl sm:rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm">
        <Link to="/reports-tools" className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-brand-600 dark:text-slate-400">
          <ChevronLeft className="w-3.5 h-3.5" /> Reports & Tools
        </Link>
        <div className="mt-3 flex flex-wrap items-start gap-3">
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-orange-50 dark:bg-orange-950/60 text-orange-600 dark:text-orange-400 flex items-center justify-center shrink-0">
            <Layers className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
          <div className="min-w-0 flex-1 basis-[240px]">
            <h1 className="text-xl sm:text-3xl font-black text-slate-900 dark:text-slate-100 tracking-tight">Student Group Creation Tool</h1>
            <p className="mt-1 text-xs sm:text-sm text-slate-500 dark:text-slate-400">
              Create section and subject groups for a whole class at once, filled with the enrolled students.
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

      {/* Step 1 */}
      <section className="p-4 sm:p-6 rounded-2xl sm:rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-4">
        <h2 className="text-sm font-extrabold text-slate-900 dark:text-slate-100 uppercase tracking-wider">1. Class and period</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Field label="Program *">
            <select className={inputCls} value={program} onChange={(e) => setProgram(e.target.value)} disabled={!meta}>
              {(meta?.programs || []).map((p) => <option key={p.name} value={p.name}>{p.program_name || p.name}</option>)}
            </select>
          </Field>
          <Field label="Academic Year *">
            <select className={inputCls} value={academicYear} onChange={(e) => { setAcademicYear(e.target.value); setAcademicTerm(''); }} disabled={!meta}>
              {(meta?.academic_years || []).map((y) => <option key={y.name} value={y.name}>{y.name}</option>)}
            </select>
          </Field>
          <Field label="Academic Term">
            <select className={inputCls} value={academicTerm} onChange={(e) => setAcademicTerm(e.target.value)} disabled={!meta}>
              <option value="">Whole year</option>
              {terms.map((t) => <option key={t.name} value={t.name}>{t.name}</option>)}
            </select>
          </Field>
        </div>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
          <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
            <input type="checkbox" className="w-4 h-4 rounded accent-brand-600" checked={separateGroups} onChange={(e) => setSeparateGroups(e.target.checked)} />
            Separate course groups for each batch
          </label>
          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-500 dark:text-slate-400">Names:</span>
            <div className="inline-flex p-0.5 rounded-lg bg-slate-100 dark:bg-slate-800">
              {[
                ['school', 'Standard 5 - Section A'],
                ['desk', 'Standard 5/Section A/Term'],
              ].map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setNameStyle(value)}
                  className={`px-2.5 py-1.5 rounded-md font-semibold ${nameStyle === value ? 'bg-white dark:bg-slate-900 shadow-sm text-brand-700 dark:text-brand-300' : 'text-slate-500'}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={() => fetchProposals()}
          disabled={!meta || loading}
          className="w-full sm:w-auto min-h-[40px] px-5 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold inline-flex items-center justify-center gap-2 disabled:opacity-60"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Layers className="w-4 h-4" />}
          Get Groups
        </button>
      </section>

      {error && (
        <div className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 text-xs text-rose-700 dark:text-rose-300 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" /><span className="break-words min-w-0">{error}</span>
        </div>
      )}

      {result && <ResultPanel result={result} onClose={() => setResult(null)} />}

      {/* Step 2 */}
      {rows && (
        <section className="p-4 sm:p-6 rounded-2xl sm:rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-sm font-extrabold text-slate-900 dark:text-slate-100 uppercase tracking-wider">
              2. Groups to create <span className="text-slate-400 font-semibold normal-case tracking-normal">({selectedRows.length} of {selectable.length} selected)</span>
            </h2>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => setRows((cur) => cur.map((r) => ({ ...r, selected: !r.existing_group && r.student_count > 0 })))} className="min-h-[36px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300">
                Groups with students
              </button>
              <button type="button" onClick={() => setRows((cur) => cur.map((r) => ({ ...r, selected: false })))} className="min-h-[36px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300">
                Clear
              </button>
            </div>
          </div>

          {rows.length === 0 && (
            <p className="p-8 text-center text-sm text-slate-500 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700">
              No batches or courses are set up for this program.
            </p>
          )}

          {sections.map(({ title, icon: Icon, items }) =>
            items.length ? (
              <div key={title} className="space-y-2.5">
                <h3 className="text-xs font-bold text-slate-600 dark:text-slate-300 flex items-center gap-1.5"><Icon className="w-3.5 h-3.5" /> {title}</h3>
                {items.map((r) => (
                  <ProposalRow key={r.key} row={r} meta={meta} onChange={(patch) => update(r.key, patch)} />
                ))}
              </div>
            ) : null
          )}
        </section>
      )}

      {/* Sticky action bar */}
      {rows && rows.length > 0 && (
        <div className="fixed bottom-3 inset-x-3 sm:bottom-5 sm:inset-x-auto sm:right-6 lg:right-10 z-30 print:hidden">
          <div className="p-3 rounded-2xl bg-white/95 dark:bg-slate-900/95 backdrop-blur border border-slate-200 dark:border-slate-700 shadow-xl flex flex-wrap items-center gap-3">
            <span className="text-xs text-slate-600 dark:text-slate-300 min-w-0 flex-1 sm:flex-none">
              {validationError || (
                <>
                  <strong>{counts.batch}</strong> section + <strong>{counts.course}</strong> subject group{counts.course === 1 ? '' : 's'}
                </>
              )}
            </span>
            <button
              type="button"
              onClick={() => setConfirming(true)}
              disabled={!!validationError || creating}
              className="w-full sm:w-auto min-h-[40px] px-5 rounded-xl bg-gradient-to-r from-brand-600 to-indigo-600 text-white text-xs font-bold inline-flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
              Create {selectedRows.length || ''} Group{selectedRows.length === 1 ? '' : 's'}
            </button>
          </div>
        </div>
      )}

      {confirming && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm" onClick={() => setConfirming(false)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="sgt-confirm-title"
            className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-2xl p-5 sm:p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <h3 id="sgt-confirm-title" className="text-base font-black text-slate-900 dark:text-slate-100">Create {selectedRows.length} groups?</h3>
              <button onClick={() => setConfirming(false)} aria-label="Close" className="w-9 h-9 -m-1.5 rounded-xl flex items-center justify-center text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 shrink-0">
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {program} · {academicTerm || academicYear}. Students enrolled in the program are added automatically.
            </p>
            <ul className="text-xs space-y-1.5 max-h-60 overflow-y-auto">
              {selectedRows.map((r) => (
                <li key={r.key} className="flex justify-between gap-3">
                  <span className="font-semibold text-slate-900 dark:text-slate-100 break-words min-w-0">{r.student_group_name}</span>
                  <span className="text-slate-500 shrink-0">{r.student_count} students</span>
                </li>
              ))}
            </ul>
            <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end">
              <button onClick={() => setConfirming(false)} className="min-h-[40px] px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300">Cancel</button>
              <button onClick={create} className="min-h-[40px] px-5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold">Create groups</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ProposalRow({ row, meta, onChange }) {
  const exists = !!row.existing_group;
  return (
    <div className={`rounded-2xl border p-3 sm:p-4 ${exists ? 'border-slate-200/70 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/30' : row.selected ? 'border-brand-300 dark:border-brand-800 bg-brand-50/30 dark:bg-brand-950/20' : 'border-slate-200 dark:border-slate-700'}`}>
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="checkbox"
          aria-label={`Create ${row.student_group_name}`}
          className="w-4 h-4 rounded accent-brand-600 shrink-0"
          checked={row.selected && !exists}
          disabled={exists}
          onChange={(e) => onChange({ selected: e.target.checked })}
        />
        <input
          className={`${inputCls} flex-1 basis-[220px] font-semibold`}
          value={row.student_group_name}
          disabled={exists}
          onChange={(e) => onChange({ student_group_name: e.target.value })}
          aria-label="Group name"
        />
        <span className={`text-[11px] font-bold px-2 py-1 rounded-lg shrink-0 ${row.student_count ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300' : 'bg-slate-100 text-slate-500 dark:bg-slate-800'}`}>
          {row.student_count} student{row.student_count === 1 ? '' : 's'}
        </span>
        {exists && (
          <span className="text-[11px] font-bold px-2 py-1 rounded-lg bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 break-all" title="A group for this batch/course and period already exists">
            Exists: {row.existing_group}
          </span>
        )}
      </div>
      {!exists && row.selected && (
        <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3 sm:pl-7">
          <Field label="Instructor">
            <select className={inputCls} value={row.instructor} onChange={(e) => onChange({ instructor: e.target.value })}>
              <option value="">None</option>
              {(meta?.instructors || []).map((i) => (
                <option key={i.name} value={i.name}>{i.instructor_name}{i.name === row.suggested_instructor ? ' (teaches this)' : ''}</option>
              ))}
            </select>
          </Field>
          <Field label="Default Room">
            <select className={inputCls} value={row.default_room} onChange={(e) => onChange({ default_room: e.target.value })}>
              <option value="">None</option>
              {(meta?.rooms || []).map((r) => <option key={r.name} value={r.name}>{r.room_name}{r.seating_capacity ? ` (${r.seating_capacity})` : ''}</option>)}
            </select>
          </Field>
          <Field label="Max Strength">
            <input
              type="number"
              min="0"
              className={inputCls}
              placeholder="No limit"
              value={row.max_strength}
              onChange={(e) => onChange({ max_strength: e.target.value })}
            />
          </Field>
        </div>
      )}
    </div>
  );
}

function ResultPanel({ result, onClose }) {
  return (
    <section className={`p-4 sm:p-6 rounded-2xl sm:rounded-3xl border shadow-sm space-y-3 ${result.error_count ? 'bg-amber-50/60 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900' : 'bg-emerald-50/60 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900'}`}>
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-sm font-extrabold text-slate-900 dark:text-slate-100 flex items-center gap-2">
          {result.created_count ? <CheckCircle2 className="w-5 h-5 text-emerald-600" /> : <AlertCircle className="w-5 h-5 text-amber-600" />}
          {result.created_count} created{result.skipped_count ? ` · ${result.skipped_count} skipped` : ''}{result.error_count ? ` · ${result.error_count} failed` : ''}
        </h2>
        <button onClick={onClose} aria-label="Dismiss" className="w-9 h-9 -m-1.5 rounded-xl flex items-center justify-center text-slate-500 hover:bg-white/60 dark:hover:bg-slate-800 shrink-0">
          <X className="w-4 h-4" />
        </button>
      </div>
      <ul className="space-y-1.5 text-xs">
        {result.created.map((r) => (
          <li key={r.student_group} className="flex flex-wrap items-center gap-x-2">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            <span className="font-semibold text-slate-900 dark:text-slate-100 break-words">{r.student_group}</span>
            <span className="text-slate-500">{r.student_count} students{r.instructor ? ` · ${r.instructor}` : ''}</span>
          </li>
        ))}
        {result.skipped.map((r) => (
          <li key={`s-${r.student_group_name}`} className="flex flex-wrap items-center gap-x-2">
            <SkipForward className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span className="font-semibold text-slate-900 dark:text-slate-100 break-words">{r.student_group_name}</span>
            <span className="text-slate-500">skipped — {r.reason}</span>
          </li>
        ))}
        {result.errors.map((r) => (
          <li key={`e-${r.student_group_name}`} className="flex flex-wrap items-center gap-x-2">
            <XCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
            <span className="font-semibold text-slate-900 dark:text-slate-100 break-words">{r.student_group_name}</span>
            <span className="text-rose-600 dark:text-rose-400 break-words">{r.error}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
