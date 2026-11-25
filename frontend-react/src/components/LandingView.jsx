import React, { useEffect, useMemo, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { api } from '../api/frappeClient';
import { useAuth } from '../context/AuthContext';
import {
  ArrowRight,
  Bell,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  AlertCircle,
  ClipboardList,
  Globe,
  GraduationCap,
  Mail,
  MapPin,
  Phone,
  Pin,
  School,
  ShieldCheck,
  Users,
  X,
} from 'lucide-react';

// Public landing page. Everything school-specific (name, logo, classes, admissions,
// notices, contact) comes from education.education.api.get_landing_context.

const formatDate = (value) => {
  if (!value) return '';
  const d = new Date(`${value}T00:00:00`);
  return Number.isNaN(d.getTime())
    ? value
    : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
};

const formatMoney = (amount) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount || 0);

// "Mathematics - Std 5" -> "Mathematics"
const subjectName = (course) => String(course || '').replace(/\s*-\s*Std\s*\d+\s*$/i, '');

const initials = (name) =>
  String(name || '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('') || 'E';

const PORTAL_ROLES = [
  {
    icon: GraduationCap,
    title: 'Students',
    points: ['Daily timetable and classes', 'Topics, articles, videos and quizzes', 'Attendance, grades and report cards'],
  },
  {
    icon: Users,
    title: 'Parents & Guardians',
    points: ["Follow each child's attendance and results", 'Fee invoices and payment status', 'Apply for leave and read school notices'],
  },
  {
    icon: ClipboardList,
    title: 'Teachers & Staff',
    points: ['Mark attendance and enter marks', 'Plan schedules and assessments', 'Admissions, report cards and fee ledger'],
  },
];

export default function LandingView() {
  const { isLoggedIn, loading: authLoading } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [applyDrive, setApplyDrive] = useState(null);

  const load = () => {
    setLoading(true);
    setError('');
    api.getLandingContext()
      .then((res) => setData(res || null))
      .catch((err) => setError(err.message || 'Could not load school information.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (data?.school?.name) document.title = `${data.school.name} • EduPortal`;
  }, [data?.school?.name]);

  // Signed-in users skip the landing page and go straight to their portal.
  if (!authLoading && isLoggedIn) return <Navigate to="/dashboard" replace />;

  const school = data?.school || {};
  const contact = data?.contact || {};
  const programs = data?.programs || [];
  const admissions = data?.admissions || [];
  const notices = data?.notices || [];
  const classRange =
    programs.length > 1
      ? `${programs[0].program_name} to ${programs[programs.length - 1].program_name}`
      : programs[0]?.program_name;
  const openDrive = admissions.find((d) => d.enable_admission_application);

  return (
    <div className="min-h-screen bg-[#070918] text-slate-200 font-sans relative overflow-x-clip">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] max-w-full h-[600px] bg-indigo-600/10 rounded-full blur-[160px] pointer-events-none" />
      <div className="absolute top-[40%] -left-40 w-[500px] max-w-full h-[500px] bg-purple-600/10 rounded-full blur-[140px] pointer-events-none" />

      {/* Header */}
      <header className="relative z-10 border-b border-white/[0.06] bg-[#070918]/70 backdrop-blur-xl sticky top-0">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between gap-3 sm:gap-4">
          <a href="#top" className="flex items-center gap-3 min-w-0">
            {school.logo ? (
              <img src={school.logo} alt="" className="w-10 h-10 shrink-0 rounded-2xl object-cover bg-white/5" />
            ) : (
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-purple-600 flex items-center justify-center text-white font-black text-sm shrink-0">
                {initials(school.name)}
              </div>
            )}
            <div className="min-w-0">
              <p className="font-extrabold text-sm text-white truncate">{school.name || (loading ? '' : 'EduPortal')}</p>
              <p className="text-[11px] text-slate-500 uppercase tracking-wider font-medium">EduPortal</p>
            </div>
          </a>
          <nav className="hidden md:flex items-center gap-6 text-xs font-semibold text-slate-400">
            <a href="#classes" className="hover:text-white transition">Classes</a>
            <a href="#admissions" className="hover:text-white transition">Admissions</a>
            <a href="#notices" className="hover:text-white transition">Notices</a>
            <a href="#contact" className="hover:text-white transition">Contact</a>
          </nav>
          <Link
            to="/login"
            className="min-h-[36px] px-3 sm:px-4 py-2 rounded-xl bg-white text-slate-900 text-xs font-bold hover:bg-slate-200 transition flex items-center gap-1.5 shrink-0 whitespace-nowrap"
          >
            Sign in <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
        {/* Mobile section links (desktop uses the inline nav above) */}
        <nav className="md:hidden max-w-7xl mx-auto px-4 pb-2 flex items-center gap-1 overflow-x-auto no-scrollbar text-xs font-semibold text-slate-400">
          <a href="#classes" className="shrink-0 px-2.5 py-2 rounded-lg hover:text-white hover:bg-white/5 transition">Classes</a>
          <a href="#admissions" className="shrink-0 px-2.5 py-2 rounded-lg hover:text-white hover:bg-white/5 transition">Admissions</a>
          <a href="#notices" className="shrink-0 px-2.5 py-2 rounded-lg hover:text-white hover:bg-white/5 transition">Notices</a>
          <a href="#contact" className="shrink-0 px-2.5 py-2 rounded-lg hover:text-white hover:bg-white/5 transition">Contact</a>
        </nav>
      </header>

      <main id="top" className="relative z-10">
        {error && (
          <div className="mx-4 sm:mx-auto max-w-3xl mt-8 p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-sm text-rose-300 flex flex-wrap items-center justify-between gap-3">
            <span className="flex items-center gap-2 min-w-0 break-words"><AlertCircle className="w-4 h-4 shrink-0" />{error}</span>
            <button onClick={load} className="shrink-0 min-h-[36px] px-3 py-1.5 rounded-lg bg-rose-500/20 text-xs font-bold hover:bg-rose-500/30">Retry</button>
          </div>
        )}

        {/* Hero */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 pt-16 pb-14 sm:pt-24 sm:pb-20 text-center">
          {school.current_academic_year && (
            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.04] border border-white/[0.08] text-[11px] font-semibold text-slate-400">
              <CalendarDays className="w-3.5 h-3.5 text-indigo-400" />
              Academic Year {school.current_academic_year}
            </span>
          )}
          <h1 className="mt-5 text-[1.75rem] leading-tight sm:text-5xl font-black tracking-tight text-white break-words">
            {loading && !school.name ? (
              <span className="inline-block h-12 w-80 max-w-full rounded-xl bg-white/5 animate-pulse" />
            ) : (
              <>
                Welcome to{' '}
                <span className="bg-gradient-to-r from-blue-400 via-indigo-300 to-purple-400 bg-clip-text text-transparent">
                  {school.name}
                </span>
              </>
            )}
          </h1>
          {classRange && (
            <p className="mt-4 text-sm sm:text-base text-slate-400 max-w-2xl mx-auto">
              Classes {classRange} · {programs.reduce((n, p) => n + (p.course_count || 0), 0)} subjects taught across {programs.length} classes.
              Students, parents and teachers stay connected through EduPortal.
            </p>
          )}
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              to="/login"
              className="w-full sm:w-auto px-6 py-3 rounded-2xl bg-gradient-to-r from-blue-600 to-purple-600 text-white text-sm font-bold shadow-lg shadow-indigo-500/25 hover:opacity-95 transition flex items-center justify-center gap-2"
            >
              Sign in to EduPortal <ArrowRight className="w-4 h-4" />
            </Link>
            {openDrive && (
              <button
                onClick={() => setApplyDrive(openDrive)}
                className="w-full sm:w-auto px-6 py-3 rounded-2xl border border-white/15 text-white text-sm font-bold hover:bg-white/5 transition flex items-center justify-center gap-2"
              >
                <ClipboardList className="w-4 h-4" /> Apply for Admission
              </button>
            )}
          </div>
        </section>

        {/* Portal roles */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 pb-16">
          <div className="grid gap-4 md:grid-cols-3">
            {PORTAL_ROLES.map(({ icon: Icon, title, points }) => (
              <div key={title} className="rounded-2xl sm:rounded-3xl bg-white/[0.03] border border-white/[0.07] p-5 sm:p-6">
                <div className="w-10 h-10 rounded-xl bg-indigo-500/15 text-indigo-300 flex items-center justify-center">
                  <Icon className="w-5 h-5" />
                </div>
                <h3 className="mt-4 font-extrabold text-white">{title}</h3>
                <ul className="mt-3 space-y-2">
                  {points.map((p) => (
                    <li key={p} className="text-xs text-slate-400 flex items-start gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 mt-0.5 shrink-0" />
                      {p}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        {/* Classes */}
        <section id="classes" className="max-w-7xl mx-auto px-4 sm:px-6 py-16 scroll-mt-20">
          <SectionTitle icon={BookOpen} title="Classes & Curriculum" subtitle="Subjects offered in each class this academic year" />
          {loading && !programs.length ? (
            <SkeletonGrid />
          ) : programs.length === 0 ? (
            <Empty text="Class information will be published soon." />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {programs.map((p) => (
                <div key={p.name} className="rounded-2xl sm:rounded-3xl bg-white/[0.03] border border-white/[0.07] p-4 sm:p-5 min-w-0">
                  <div className="flex items-start sm:items-center justify-between gap-2">
                    <h3 className="font-extrabold text-white min-w-0 break-words">{p.program_name}</h3>
                    <span className="shrink-0 whitespace-nowrap text-[11px] font-bold px-2 py-0.5 rounded-full bg-indigo-500/15 text-indigo-300">
                      {p.course_count} subjects
                    </span>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-1.5">
                    {(p.courses || []).map((c) => (
                      <span key={c} className="text-[11px] px-2.5 py-1 rounded-lg bg-white/[0.05] border border-white/[0.06] text-slate-300">
                        {subjectName(c)}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Admissions */}
        <section id="admissions" className="max-w-7xl mx-auto px-4 sm:px-6 py-16 scroll-mt-20">
          <SectionTitle icon={ClipboardList} title="Admissions" subtitle="Open admission drives and eligibility" />
          {loading && !admissions.length ? (
            <SkeletonGrid count={1} />
          ) : admissions.length === 0 ? (
            <Empty text="There are no open admission drives right now. Please check back later or contact the school office." />
          ) : (
            <div className="space-y-4">
              {admissions.map((d) => (
                <div key={d.name} className="rounded-2xl sm:rounded-3xl bg-gradient-to-br from-indigo-600/10 to-purple-600/5 border border-indigo-500/20 p-4 sm:p-6 min-w-0">
                  <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                    <div className="min-w-0">
                      <h3 className="text-base sm:text-lg font-extrabold text-white break-words">{d.title}</h3>
                      <p className="mt-1 text-xs text-slate-400 flex items-start sm:items-center gap-1.5">
                        <CalendarDays className="w-3.5 h-3.5 shrink-0 mt-px sm:mt-0" />
                        {d.admission_start_date ? `${formatDate(d.admission_start_date)} – ` : 'Until '}
                        {d.admission_end_date ? formatDate(d.admission_end_date) : 'further notice'}
                        {d.academic_year ? ` · Academic Year ${d.academic_year}` : ''}
                      </p>
                      {d.introduction && <p className="mt-3 text-sm text-slate-300 max-w-2xl break-words">{d.introduction}</p>}
                    </div>
                    {d.enable_admission_application ? (
                      <button
                        onClick={() => setApplyDrive(d)}
                        className="w-full sm:w-auto justify-center px-5 py-2.5 rounded-xl bg-white text-slate-900 text-xs font-bold hover:bg-slate-200 transition flex items-center gap-1.5 self-stretch sm:self-start"
                      >
                        Apply Online <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    ) : (
                      <span className="text-xs text-slate-400 self-start">Apply at the admissions office</span>
                    )}
                  </div>
                  {d.programs?.length > 0 && (
                    <div className="mt-5 -mx-4 px-4 sm:mx-0 sm:px-0 overflow-x-auto">
                      <table className="w-full min-w-[300px] text-xs">
                        <thead>
                          <tr className="text-left text-slate-500 border-b border-white/[0.08]">
                            <th className="py-2 pr-4 font-semibold">Class</th>
                            <th className="py-2 pr-4 font-semibold">Age</th>
                            <th className="py-2 font-semibold text-right">Application fee</th>
                          </tr>
                        </thead>
                        <tbody>
                          {d.programs.map((p) => (
                            <tr key={p.program} className="border-b border-white/[0.04] last:border-0">
                              <td className="py-2 pr-4 text-white font-semibold break-words">{p.program}</td>
                              <td className="py-2 pr-4 text-slate-300">
                                {p.min_age || p.max_age ? `${p.min_age || '—'} – ${p.max_age || '—'} years` : '—'}
                              </td>
                              <td className="py-2 text-right text-slate-300 whitespace-nowrap">{p.application_fee ? formatMoney(p.application_fee) : 'Free'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Notices */}
        <section id="notices" className="max-w-7xl mx-auto px-4 sm:px-6 py-16 scroll-mt-20">
          <SectionTitle icon={Bell} title="Notices & Events" subtitle="Latest circulars from the school office" />
          {loading && !notices.length ? (
            <SkeletonGrid />
          ) : notices.length === 0 ? (
            <Empty text="No notices at the moment." />
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {notices.map((n) => (
                <article key={n.id} className="rounded-2xl sm:rounded-3xl bg-white/[0.03] border border-white/[0.07] p-4 sm:p-5 min-w-0">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[11px] font-semibold text-slate-500">{formatDate(n.date)}</span>
                    {n.pinned && (
                      <span className="shrink-0 text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 flex items-center gap-1">
                        <Pin className="w-3 h-3" /> Important
                      </span>
                    )}
                  </div>
                  <h3 className="mt-2 font-bold text-white break-words">{n.title}</h3>
                  {n.content && <p className="mt-1.5 text-xs text-slate-400 leading-relaxed break-words">{n.content}</p>}
                </article>
              ))}
            </div>
          )}
        </section>
      </main>

      {/* Contact / footer */}
      <footer id="contact" className="relative z-10 border-t border-white/[0.06] mt-8 scroll-mt-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10 grid gap-8 md:grid-cols-3">
          <div>
            <p className="font-extrabold text-white flex items-center gap-2 min-w-0 break-words">
              <School className="w-4 h-4 shrink-0 text-indigo-400" /> {school.name}
            </p>
            {contact.address && (
              <p className="mt-3 text-xs text-slate-400 flex items-start gap-2 leading-relaxed">
                <MapPin className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                <span>
                  {[contact.address.address_line1, contact.address.address_line2]
                    .filter((line) => line && line !== school.name)
                    .join(', ')}
                  {[contact.address.address_line1, contact.address.address_line2].some((l) => l && l !== school.name) && <br />}
                  {[contact.address.city, contact.address.state, contact.address.pincode].filter(Boolean).join(', ')}
                </span>
              </p>
            )}
          </div>
          <div className="space-y-2 text-xs text-slate-400">
            <p className="font-bold text-white text-sm">Contact</p>
            {contact.phone && (
              <a href={`tel:${contact.phone.replace(/\s+/g, '')}`} className="flex items-center gap-2 py-1 hover:text-white">
                <Phone className="w-3.5 h-3.5 shrink-0" /> {contact.phone}
              </a>
            )}
            {contact.email && (
              <a href={`mailto:${contact.email}`} className="flex items-center gap-2 hover:text-white break-all">
                <Mail className="w-3.5 h-3.5 shrink-0" /> {contact.email}
              </a>
            )}
            {contact.website && (
              <a href={contact.website} target="_blank" rel="noreferrer" className="flex items-center gap-2 hover:text-white break-all">
                <Globe className="w-3.5 h-3.5 shrink-0" /> {contact.website.replace(/^https?:\/\//, '')}
              </a>
            )}
            {!contact.phone && !contact.email && !contact.website && <p>Contact details will be published soon.</p>}
          </div>
          <div className="space-y-2 text-xs text-slate-400">
            <p className="font-bold text-white text-sm">EduPortal</p>
            <Link to="/login" className="flex items-center gap-2 py-1 hover:text-white">
              <ShieldCheck className="w-3.5 h-3.5 shrink-0" /> Sign in for students, parents and staff
            </Link>
            {openDrive && (
              <button onClick={() => setApplyDrive(openDrive)} className="flex items-center gap-2 py-1 text-left hover:text-white">
                <ClipboardList className="w-3.5 h-3.5 shrink-0" /> Apply for admission
              </button>
            )}
          </div>
        </div>
        <p className="text-center text-[11px] text-slate-600 px-4 pb-8 break-words">
          {school.name} © {new Date().getFullYear()}. All rights reserved.
        </p>
      </footer>

      {applyDrive && <ApplyModal drive={applyDrive} onClose={() => setApplyDrive(null)} />}
    </div>
  );
}

function SectionTitle({ icon: Icon, title, subtitle }) {
  return (
    <div className="mb-6">
      <h2 className="text-xl sm:text-2xl font-black text-white flex items-center gap-2">
        <Icon className="w-5 h-5 shrink-0 text-indigo-400" /> {title}
      </h2>
      {subtitle && <p className="mt-1 text-xs text-slate-500">{subtitle}</p>}
    </div>
  );
}

function SkeletonGrid({ count = 3 }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="h-32 rounded-2xl sm:rounded-3xl bg-white/[0.03] border border-white/[0.05] animate-pulse" />
      ))}
    </div>
  );
}

function Empty({ text }) {
  return <p className="rounded-2xl sm:rounded-3xl border border-dashed border-white/10 p-6 sm:p-8 text-center text-sm text-slate-500">{text}</p>;
}

const inputCls =
  'w-full min-w-0 px-3 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.1] text-base sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-400';

function ApplyModal({ drive, onClose }) {
  const programs = useMemo(() => (drive.programs || []).map((p) => p.program), [drive]);
  const [form, setForm] = useState({
    first_name: '',
    last_name: '',
    program: programs[0] || '',
    date_of_birth: '',
    gender: '',
    student_email_id: '',
    student_mobile_number: '',
    city: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.first_name.trim() || !form.program) {
      setError('Please enter the student name and choose a class.');
      return;
    }
    if (!form.student_email_id.trim() && !form.student_mobile_number.trim()) {
      setError('Please give an email address or mobile number so the school can contact you.');
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        ...Object.fromEntries(Object.entries(form).map(([k, v]) => [k, typeof v === 'string' ? v.trim() : v])),
        academic_year: drive.academic_year,
        student_admission: drive.name,
      };
      Object.keys(payload).forEach((k) => payload[k] === '' && delete payload[k]);
      const res = await api.createStudentApplicant(payload);
      setResult(res);
    } catch (err) {
      setError(err.message || 'Could not submit the application. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center pt-6 sm:p-4 bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="apply-title"
        className="w-full max-w-lg max-h-[92dvh] sm:max-h-[90vh] overflow-y-auto overscroll-contain rounded-t-3xl sm:rounded-3xl bg-[#0e1124] border border-white/[0.08] shadow-2xl px-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:p-6 sm:pt-0"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 -mx-4 sm:-mx-6 px-4 sm:px-6 pt-4 sm:pt-6 pb-3 bg-[#0e1124] flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 id="apply-title" className="text-base sm:text-lg font-black text-white">Apply for Admission</h2>
            <p className="text-xs text-slate-400 mt-0.5 break-words">{drive.title}</p>
          </div>
          <button onClick={onClose} aria-label="Close" className="w-9 h-9 shrink-0 flex items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-white/5">
            <X className="w-5 h-5 sm:w-4 sm:h-4" />
          </button>
        </div>

        {result ? (
          <div className="mt-3 text-center space-y-3">
            <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto" />
            <p className="text-white font-bold">Application submitted</p>
            <p className="text-sm text-slate-400">
              Your application number is <strong className="text-white">{result.name}</strong>. The admissions office
              will contact you using the details you provided.
            </p>
            <button onClick={onClose} className="mt-2 px-5 py-2.5 rounded-xl bg-white text-slate-900 text-xs font-bold">
              Done
            </button>
          </div>
        ) : (
          <form onSubmit={submit} className="mt-2 space-y-3">
            {error && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300 flex items-center gap-2 break-words">
                <AlertCircle className="w-4 h-4 shrink-0" /> {error}
              </div>
            )}
            <div className="grid grid-cols-1 min-[400px]:grid-cols-2 gap-3">
              <Field label="Student first name *">
                <input className={inputCls} value={form.first_name} onChange={set('first_name')} required autoFocus />
              </Field>
              <Field label="Last name">
                <input className={inputCls} value={form.last_name} onChange={set('last_name')} />
              </Field>
            </div>
            <div className="grid grid-cols-1 min-[400px]:grid-cols-2 gap-3">
              <Field label="Class applying for *">
                <select className={inputCls} value={form.program} onChange={set('program')} required>
                  {programs.map((p) => (
                    <option key={p} value={p} className="bg-[#0e1124]">{p}</option>
                  ))}
                </select>
              </Field>
              <Field label="Date of birth">
                <input type="date" className={inputCls} value={form.date_of_birth} onChange={set('date_of_birth')} />
              </Field>
            </div>
            <div className="grid grid-cols-1 min-[400px]:grid-cols-2 gap-3">
              <Field label="Gender">
                <select className={inputCls} value={form.gender} onChange={set('gender')}>
                  <option value="" className="bg-[#0e1124]">Select</option>
                  <option value="Male" className="bg-[#0e1124]">Male</option>
                  <option value="Female" className="bg-[#0e1124]">Female</option>
                  <option value="Other" className="bg-[#0e1124]">Other</option>
                </select>
              </Field>
              <Field label="City">
                <input className={inputCls} value={form.city} onChange={set('city')} />
              </Field>
            </div>
            <Field label="Parent / student email">
              <input type="email" className={inputCls} value={form.student_email_id} onChange={set('student_email_id')} />
            </Field>
            <Field label="Parent / student mobile">
              <input type="tel" className={inputCls} value={form.student_mobile_number} onChange={set('student_mobile_number')} />
            </Field>
            <p className="text-[11px] text-slate-500">* Required. Provide an email or a mobile number so the school can reach you.</p>
            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 text-white text-sm font-bold disabled:opacity-60"
            >
              {submitting ? 'Submitting…' : 'Submit Application'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label className="block space-y-1">
      <span className="text-[11px] font-semibold text-slate-400">{label}</span>
      {children}
    </label>
  );
}
