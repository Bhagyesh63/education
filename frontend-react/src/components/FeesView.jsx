import { todayISO } from '../utils/date';
import React, { useState, useEffect, useMemo } from 'react';
import { 
  CreditCard, 
  Download, 
  CheckCircle2, 
  AlertTriangle, 
  Clock, 
  ShieldCheck, 
  Sparkles,
  Layers,
  Filter,
  Search,
  RefreshCw,
  PlusCircle,
  FileText,
  DollarSign,
  TrendingUp,
  X,
  Check,
  ChevronDown,
  Building,
  User,
  Calendar,
  AlertCircle
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/frappeClient';

export default function FeesView() {
  const { 
    isStaff, 
    isAdmin, 
    isGuardian, 
    students, 
    selectStudent,
    activeWard,
    activeStudentId,
    studentProfile,
    programs
  } = useAuth();

  const isManagement = isStaff || isAdmin;

  // Management State
  const [summary, setSummary] = useState({
    total_billed: 0,
    total_collected: 0,
    total_outstanding: 0,
    collection_rate: 0,
    total_invoices: 0,
    paid_count: 0,
    unpaid_count: 0,
    overdue_count: 0,
    draft_count: 0,
    currency_symbol: '',
    programs: [],
  });
  const [summaryLoaded, setSummaryLoaded] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [dbPrograms, setDbPrograms] = useState([]);
  const [paymentModes, setPaymentModes] = useState([]);
  const [canRecordPayments, setCanRecordPayments] = useState(false);
  const [adminInvoices, setAdminInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedProgramFilter, setSelectedProgramFilter] = useState('all');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Payment Recording Modal State
  const [payModalOpen, setPayModalOpen] = useState(false);
  const [activeInvoiceForPay, setActiveInvoiceForPay] = useState(null);
  const [payAmount, setPayAmount] = useState('');
  const [payMode, setPayMode] = useState('');
  const [payRefNo, setPayRefNo] = useState('');
  const [submittingPayment, setSubmittingPayment] = useState(false);
  const [paymentError, setPaymentError] = useState('');
  const [paymentSuccessMsg, setPaymentSuccessMsg] = useState('');

  // Submitting Draft Invoice State
  const [submittingInvoiceName, setSubmittingInvoiceName] = useState(null);

  // Student / Guardian Personal State
  const studentId = activeStudentId || studentProfile?.name || null;
  const [studentInvoices, setStudentInvoices] = useState([]);
  const [studentLedger, setStudentLedger] = useState(null); // { total_outstanding, currency_symbol, ... }
  const [printFormat, setPrintFormat] = useState('Standard');

  // Load Data
  const loadData = async () => {
    setLoading(true);
    setLoadError('');
    try {
      if (isManagement) {
        const [sumRes, invRes] = await Promise.all([
          api.getFeeDashboardSummary(selectedProgramFilter === 'all' ? null : selectedProgramFilter),
          api.getAllInvoicesForAdmin(
            selectedProgramFilter === 'all' ? null : selectedProgramFilter,
            selectedStatusFilter === 'all' ? null : selectedStatusFilter,
            searchQuery
          )
        ]);
        if (sumRes) {
          setSummary(prev => ({ ...prev, ...sumRes }));
          setSummaryLoaded(true);
        }
        setAdminInvoices(Array.isArray(invRes?.invoices) ? invRes.invoices : []);
        if (invRes?.print_format) setPrintFormat(invRes.print_format);
      } else if (studentId) {
        const data = await api.getStudentInvoices(studentId);
        setStudentInvoices(Array.isArray(data?.invoices) ? data.invoices : []);
        setStudentLedger(data || null);
        if (data?.print_format) setPrintFormat(data.print_format);
      } else {
        setStudentInvoices([]);
        setStudentLedger(null);
      }
    } catch (err) {
      console.error('Error fetching fee data:', err);
      setLoadError(err.message || 'Unable to load fee records.');
      if (isManagement) setAdminInvoices([]);
      else setStudentInvoices([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [isManagement, selectedProgramFilter, selectedStatusFilter, studentId]);

  // Programs for the ledger filter and the configured Modes of Payment (management only)
  useEffect(() => {
    if (!isManagement) return;
    api.getAllPrograms()
      .then((progs) => setDbPrograms(Array.isArray(progs) ? progs : []))
      .catch(() => setDbPrograms([]));
    api.getPaymentModes()
      .then((res) => {
        setPaymentModes(Array.isArray(res?.modes) ? res.modes : []);
        setCanRecordPayments(!!res?.can_record_payments);
      })
      .catch(() => {
        setPaymentModes([]);
        setCanRecordPayments(false);
      });
  }, [isManagement]);

  // Handle Search Debounce for Admin
  useEffect(() => {
    if (!isManagement) return;
    const timer = setTimeout(() => {
      api.getAllInvoicesForAdmin(
        selectedProgramFilter === 'all' ? null : selectedProgramFilter,
        selectedStatusFilter === 'all' ? null : selectedStatusFilter,
        searchQuery
      ).then(res => {
        if (res?.invoices) setAdminInvoices(res.invoices);
      }).catch(err => console.error(err));
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Open Payment Modal
  const openPayModal = (inv) => {
    setActiveInvoiceForPay(inv);
    setPayAmount(String(inv.outstanding_amount > 0 ? inv.outstanding_amount : inv.grand_total));
    setPayMode(paymentModes.find(m => m.type === 'Cash')?.name || paymentModes[0]?.name || '');
    setPayRefNo('');
    setPaymentError('');
    setPaymentSuccessMsg('');
    setPayModalOpen(true);
  };

  // Submit Payment
  const handleExecutePayment = async (e) => {
    e.preventDefault();
    if (!activeInvoiceForPay) return;
    if (!payMode) {
      setPaymentError('No Mode of Payment is configured. Please set one up in ERPNext.');
      return;
    }
    if (selectedPayModeIsBank && !payRefNo.trim()) {
      setPaymentError('A reference / transaction number is required for bank payments.');
      return;
    }
    setSubmittingPayment(true);
    setPaymentError('');
    setPaymentSuccessMsg('');

    try {
      const res = await api.createPaymentEntry(
        activeInvoiceForPay.name,
        parseFloat(payAmount) || activeInvoiceForPay.outstanding_amount,
        payMode,
        payRefNo || null,
        todayISO()
      );

      if (res?.success) {
        setPaymentSuccessMsg(
          res.payment_entry
            ? `Payment ${res.payment_entry} recorded. Invoice status: ${res.status}${res.outstanding_amount > 0 ? ` (outstanding ${currencySymbol}${Number(res.outstanding_amount).toLocaleString()})` : ''}.`
            : (res.message || 'Invoice is already settled.')
        );
        setTimeout(() => {
          setPayModalOpen(false);
          loadData();
        }, 1200);
      } else {
        setPaymentError(res?.message || 'Failed to record payment');
      }
    } catch (err) {
      console.error('Payment entry error:', err);
      setPaymentError(err.message || 'Payment submission failed. Check cash/bank account configurations.');
    } finally {
      setSubmittingPayment(false);
    }
  };

  // Submit Draft Invoice
  const handleSubmitInvoice = async (invName) => {
    setSubmittingInvoiceName(invName);
    try {
      const res = await api.submitSalesInvoice(invName);
      if (res?.success) {
        loadData();
      }
    } catch (err) {
      console.error('Error submitting invoice:', err);
      alert(err.message || 'Failed to submit sales invoice');
    } finally {
      setSubmittingInvoiceName(null);
    }
  };

  // Download PDF
  const downloadPDF = (inv) => {
    const invName = inv.invoice || inv.name;
    const doctype = inv.doctype || 'Sales Invoice';
    const format = printFormat || 'Standard';
    const url = `/api/method/frappe.utils.print_format.download_pdf?doctype=${encodeURIComponent(doctype)}&name=${encodeURIComponent(invName)}&format=${encodeURIComponent(format)}&no_letterhead=0`;
    window.open(url, '_blank');
  };

  const currencySymbol = (isManagement ? summary?.currency_symbol : studentLedger?.currency_symbol) || '';
  const selectedPayModeIsBank = paymentModes.find(m => m.name === payMode)?.type === 'Bank';
  const fmtMoney = (val) => `${currencySymbol}${Number(val || 0).toLocaleString()}`;
  const kpi = (val) => (summaryLoaded ? fmtMoney(val) : '—');

  // Available programs for filter (real Programs + programs present on invoices)
  const availablePrograms = Array.from(
    new Set([
      ...(dbPrograms || []).map(p => p.name || p.program_name).filter(Boolean),
      ...(summary.programs || []),
      ...(programs || []).map(p => (typeof p === 'object' ? p.program : p)).filter(Boolean)
    ])
  ).filter(Boolean).sort();

  // ==========================================
  // MANAGEMENT / ADMIN VIEW
  // ==========================================
  if (isManagement) {
    return (
      <div className="space-y-6 animate-in fade-in duration-200">
        {/* Header Title */}
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
          <div className="min-w-0 flex-1 basis-[260px]">
            <div className="flex items-center flex-wrap gap-2">
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
                Fees & Finance
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-brand-50 text-brand-700 dark:bg-brand-950/80 dark:text-brand-300 border border-brand-200/60 dark:border-brand-800">
                Institutional Ledger
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Institutional tuition ledger, sales invoice registry, and double-entry payment reconciliation.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={loadData}
              disabled={loading}
              className="flex items-center justify-center gap-1.5 px-3 py-2 min-h-[36px] rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-750 transition shadow-xs active:scale-95"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {/* 4 Financial KPI Stat Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {/* Total Billed */}
          <div className="glass-panel p-4 sm:p-5 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-xs relative overflow-hidden min-w-0">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 min-w-0">Total Billed</span>
              <div className="w-8 h-8 rounded-xl bg-brand-50 dark:bg-brand-950/80 text-brand-600 dark:text-brand-400 flex items-center justify-center shrink-0">
                <FileText className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2 text-2xl font-black text-slate-900 dark:text-slate-100 break-words">
              {kpi(summary.total_billed)}
            </div>
            <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1">
              <span>{summary.total_invoices} total invoices generated</span>
            </div>
          </div>

          {/* Total Collected */}
          <div className="glass-panel p-4 sm:p-5 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-xs relative overflow-hidden min-w-0">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 min-w-0">Total Collected</span>
              <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                <TrendingUp className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2 text-2xl font-black text-emerald-600 dark:text-emerald-400 break-words">
              {kpi(summary.total_collected)}
            </div>
            <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400 flex items-center justify-between">
              <span>Collection Rate</span>
              <span className="font-bold text-emerald-600 dark:text-emerald-400">{summaryLoaded ? `${summary.collection_rate}%` : '—'}</span>
            </div>
            {/* Progress Bar */}
            <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full mt-2 overflow-hidden">
              <div 
                className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                style={{ width: `${Math.min(summary.collection_rate, 100)}%` }}
              />
            </div>
          </div>

          {/* Total Outstanding */}
          <div className="glass-panel p-4 sm:p-5 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-xs relative overflow-hidden min-w-0">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 min-w-0">Outstanding Balance</span>
              <div className="w-8 h-8 rounded-xl bg-amber-50 dark:bg-amber-950/80 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                <Clock className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2 text-2xl font-black text-amber-600 dark:text-amber-400 break-words">
              {kpi(summary.total_outstanding)}
            </div>
            <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1">
              <span>{summary.unpaid_count} pending settlement</span>
            </div>
          </div>

          {/* Invoices Status Ratio */}
          <div className="glass-panel p-4 sm:p-5 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-xs relative overflow-hidden min-w-0">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 min-w-0">Status Breakdown</span>
              <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                <ShieldCheck className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline flex-wrap gap-x-2 gap-y-1">
              <span className="text-2xl font-black text-slate-900 dark:text-slate-100">{summary.paid_count}</span>
              <span className="text-xs font-semibold text-slate-500">Paid</span>
              <span className="text-slate-300 dark:text-slate-700">|</span>
              <span className="text-xl font-black text-amber-600">{summary.draft_count}</span>
              <span className="text-xs font-semibold text-slate-500">Draft</span>
            </div>
            <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
              {summary.overdue_count > 0 ? (
                <span className="text-rose-500 font-bold">{summary.overdue_count} Overdue invoices</span>
              ) : (
                <span className="text-emerald-500 font-semibold">{summaryLoaded ? 'No overdue invoices' : '—'}</span>
              )}
            </div>
          </div>
        </div>

        {/* Filter Controls & Search */}
        <div className="glass-panel p-4 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Search bar */}
          <div className="relative flex-1 min-w-0 md:min-w-[240px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by student name, roll no, or invoice ID..."
              className="w-full min-h-[36px] bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-700/80 rounded-2xl pl-10 pr-4 py-2 text-xs font-semibold text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500/30 transition"
            />
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Program Filter */}
            <div className="relative flex-1 min-w-0 md:flex-none">
              <select
                value={selectedProgramFilter}
                onChange={(e) => setSelectedProgramFilter(e.target.value)}
                className="appearance-none bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-700/80 rounded-2xl pl-3.5 pr-8 py-2 text-xs font-semibold text-slate-800 dark:text-slate-200 hover:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30 shadow-xs cursor-pointer transition w-full md:w-auto min-h-[36px] min-w-0 md:min-w-[130px]"
              >
                <option value="all">All Programs</option>
                {availablePrograms.map(p => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>

            {/* Status Filter */}
            <div className="relative flex-1 min-w-0 md:flex-none">
              <select
                value={selectedStatusFilter}
                onChange={(e) => setSelectedStatusFilter(e.target.value)}
                className="appearance-none bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-700/80 rounded-2xl pl-3.5 pr-8 py-2 text-xs font-semibold text-slate-800 dark:text-slate-200 hover:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30 shadow-xs cursor-pointer transition w-full md:w-auto min-h-[36px] min-w-0 md:min-w-[120px]"
              >
                <option value="all">All Statuses</option>
                <option value="Paid">Paid</option>
                <option value="Unpaid">Unpaid</option>
                <option value="Draft">Draft</option>
                <option value="Overdue">Overdue</option>
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>
        </div>

        {/* Master Invoices Table */}
        <div className="glass-panel rounded-3xl border border-slate-200/80 dark:border-slate-800 overflow-hidden shadow-xs">
          <div className="px-4 sm:px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <CreditCard className="w-4 h-4 shrink-0 text-brand-500" />
              <h2 className="font-bold text-sm text-slate-900 dark:text-slate-100">
                Sales Invoices Registry
              </h2>
            </div>
            <span className="text-xs text-slate-500 dark:text-slate-400 shrink-0">
              {adminInvoices.length} {adminInvoices.length === 1 ? 'record' : 'records'} found
            </span>
          </div>

          {loading ? (
            <div className="p-12 text-center text-slate-400 text-sm">
              <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
              Loading institutional invoices...
            </div>
          ) : loadError ? (
            <div className="p-12 text-center text-rose-600 dark:text-rose-400 text-xs">
              {loadError}
            </div>
          ) : adminInvoices.length === 0 ? (
            <div className="p-12 text-center text-slate-500 dark:text-slate-400 text-xs">
              No sales invoices found matching the selected filters.
            </div>
          ) : (
            <>
            {/* Mobile stacked ledger (< md) */}
            <ul className="md:hidden divide-y divide-slate-100 dark:divide-slate-800">
              {adminInvoices.map((inv) => {
                const isPaid = inv.status === 'Paid';
                const isDraft = inv.status === 'Draft' || inv.docstatus === 0;
                const isOverdue = inv.status === 'Overdue';

                return (
                  <li key={inv.name} className="p-4 space-y-3 text-xs">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-semibold text-sm text-slate-900 dark:text-slate-100 break-words">
                          {inv.student_name}
                        </div>
                        <div className="text-[11px] text-slate-400 font-mono break-all">
                          {inv.name}{inv.student ? ` · ${inv.student}` : ''}
                        </div>
                      </div>
                      <span className={`shrink-0 px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider ${
                        isPaid
                          ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/80 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800'
                          : isDraft
                          ? 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-300 dark:border-slate-700'
                          : isOverdue
                          ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/80 dark:text-rose-400 border border-rose-200 dark:border-rose-800'
                          : 'bg-amber-50 text-amber-700 dark:bg-amber-950/80 dark:text-amber-400 border border-amber-200 dark:border-amber-800'
                      }`}>
                        {inv.status}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-x-3 gap-y-2">
                      <div className="min-w-0">
                        <div className="text-[11px] text-slate-400">Billed</div>
                        <div className="font-extrabold text-slate-900 dark:text-slate-100 break-words">
                          {inv.currency_symbol || currencySymbol}{inv.grand_total?.toLocaleString()}
                        </div>
                      </div>
                      <div className="min-w-0">
                        <div className="text-[11px] text-slate-400">Outstanding</div>
                        <div className={`font-bold break-words ${isPaid ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>
                          {isPaid
                            ? `${inv.currency_symbol || currencySymbol}0`
                            : `${inv.currency_symbol || currencySymbol}${inv.outstanding_amount?.toLocaleString()}`}
                        </div>
                      </div>
                      <div className="min-w-0">
                        <div className="text-[11px] text-slate-400">Program</div>
                        <div className="font-semibold text-slate-700 dark:text-slate-300 break-words">{inv.program || '—'}</div>
                      </div>
                      <div className="min-w-0">
                        <div className="text-[11px] text-slate-400">Due Date</div>
                        <div className="font-semibold text-slate-700 dark:text-slate-300">{inv.due_date || '—'}</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {canRecordPayments && isDraft && (
                        <button
                          onClick={() => handleSubmitInvoice(inv.name)}
                          disabled={submittingInvoiceName === inv.name}
                          title="Submit Draft Invoice to General Ledger"
                          className="flex-1 min-h-[36px] px-3 py-2 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 dark:hover:bg-blue-900/60 text-xs font-semibold transition active:scale-95 flex items-center justify-center gap-1.5"
                        >
                          {submittingInvoiceName === inv.name ? (
                            <div className="w-3 h-3 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <Check className="w-3.5 h-3.5" />
                          )}
                          <span>Submit</span>
                        </button>
                      )}

                      {canRecordPayments && !isPaid && (
                        <button
                          onClick={() => openPayModal(inv)}
                          className="flex-1 min-h-[36px] px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition active:scale-95 shadow-xs flex items-center justify-center gap-1.5 whitespace-nowrap"
                        >
                          <DollarSign className="w-3.5 h-3.5" />
                          <span>Record Payment</span>
                        </button>
                      )}

                      <button
                        onClick={() => downloadPDF(inv)}
                        title="Download Official Tax Invoice PDF"
                        aria-label="Download Official Tax Invoice PDF"
                        className="shrink-0 w-9 h-9 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition flex items-center justify-center"
                      >
                        <Download className="w-4 h-4" />
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>

            <div className="hidden md:block overflow-x-auto">
              <table className="w-full md:min-w-[960px] text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50/75 dark:bg-slate-800/40 text-slate-500 dark:text-slate-400 font-semibold border-b border-slate-100 dark:border-slate-800">
                    <th className="py-3 px-5">Invoice</th>
                    <th className="py-3 px-5">Student / Customer</th>
                    <th className="py-3 px-5">Program</th>
                    <th className="py-3 px-5 text-right">Billed Amount</th>
                    <th className="py-3 px-5 text-right">Outstanding</th>
                    <th className="py-3 px-5 text-center">Status</th>
                    <th className="py-3 px-5">Due Date</th>
                    <th className="py-3 px-5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {adminInvoices.map((inv) => {
                    const isPaid = inv.status === 'Paid';
                    const isDraft = inv.status === 'Draft' || inv.docstatus === 0;
                    const isOverdue = inv.status === 'Overdue';

                    return (
                      <tr key={inv.name} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition">
                        <td className="py-3.5 px-5 font-bold text-slate-900 dark:text-slate-100 font-mono whitespace-nowrap">
                          {inv.name}
                        </td>
                        <td className="py-3.5 px-5">
                          <div className="font-semibold text-slate-900 dark:text-slate-100">
                            {inv.student_name}
                          </div>
                          <div className="text-[11px] text-slate-400 font-mono break-all">
                            {inv.student}
                          </div>
                        </td>
                        <td className="py-3.5 px-5">
                          <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 break-words">
                            {inv.program}
                          </span>
                        </td>
                        <td className="py-3.5 px-5 text-right font-extrabold text-slate-900 dark:text-slate-100 whitespace-nowrap">
                          {inv.currency_symbol || currencySymbol}{inv.grand_total?.toLocaleString()}
                        </td>
                        <td className="py-3.5 px-5 text-right font-bold text-amber-600 dark:text-amber-400 whitespace-nowrap">
                          {isPaid ? (
                            <span className="text-emerald-600 dark:text-emerald-400">{inv.currency_symbol || currencySymbol}0</span>
                          ) : (
                            `${inv.currency_symbol || currencySymbol}${inv.outstanding_amount?.toLocaleString()}`
                          )}
                        </td>
                        <td className="py-3.5 px-5 text-center">
                          <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider inline-block ${
                            isPaid
                              ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/80 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800'
                              : isDraft
                              ? 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-300 dark:border-slate-700'
                              : isOverdue
                              ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/80 dark:text-rose-400 border border-rose-200 dark:border-rose-800'
                              : 'bg-amber-50 text-amber-700 dark:bg-amber-950/80 dark:text-amber-400 border border-amber-200 dark:border-amber-800'
                          }`}>
                            {inv.status}
                          </span>
                        </td>
                        <td className="py-3.5 px-5 text-slate-500 dark:text-slate-400 text-[11px] whitespace-nowrap">
                          {inv.due_date || '—'}
                        </td>
                        <td className="py-3.5 px-5 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {canRecordPayments && isDraft && (
                              <button
                                onClick={() => handleSubmitInvoice(inv.name)}
                                disabled={submittingInvoiceName === inv.name}
                                title="Submit Draft Invoice to General Ledger"
                                className="px-2.5 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 dark:hover:bg-blue-900/60 text-[11px] font-semibold transition active:scale-95 flex items-center gap-1 whitespace-nowrap"
                              >
                                {submittingInvoiceName === inv.name ? (
                                  <div className="w-3 h-3 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                                ) : (
                                  <Check className="w-3 h-3" />
                                )}
                                <span>Submit</span>
                              </button>
                            )}

                            {canRecordPayments && !isPaid && (
                              <button
                                onClick={() => openPayModal(inv)}
                                className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-semibold transition active:scale-95 shadow-xs flex items-center gap-1 whitespace-nowrap"
                              >
                                <DollarSign className="w-3 h-3" />
                                <span>Record Payment</span>
                              </button>
                            )}

                            <button
                              onClick={() => downloadPDF(inv)}
                              title="Download Official Tax Invoice PDF"
                              className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                            >
                              <Download className="w-3.5 h-3.5" />
                            </button>
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

        {/* Record Payment Modal */}
        {payModalOpen && activeInvoiceForPay && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 sm:p-7 max-w-md w-full max-h-[90vh] overflow-y-auto my-auto shadow-2xl relative space-y-5">
              <div className="flex items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-8 h-8 shrink-0 rounded-xl bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                    <DollarSign className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">
                      Record Payment Entry
                    </h3>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 break-all">
                      Invoice: {activeInvoiceForPay.name}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setPayModalOpen(false)}
                  aria-label="Close"
                  className="p-2 sm:p-1.5 shrink-0 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {paymentSuccessMsg ? (
                <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-center space-y-2">
                  <CheckCircle2 className="w-8 h-8 text-emerald-600 dark:text-emerald-400 mx-auto" />
                  <p className="text-xs font-bold text-emerald-800 dark:text-emerald-300 break-words">
                    {paymentSuccessMsg}
                  </p>
                </div>
              ) : (
                <form onSubmit={handleExecutePayment} className="space-y-4">
                  {paymentError && (
                    <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                      <span className="min-w-0 break-words">{paymentError}</span>
                    </div>
                  )}

                  {/* Student & Program Summary Box */}
                  <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60 space-y-1 text-xs">
                    <div className="flex justify-between gap-3">
                      <span className="text-slate-500 shrink-0">Student:</span>
                      <span className="font-bold text-slate-900 dark:text-slate-100 text-right min-w-0 break-words">{activeInvoiceForPay.student_name}</span>
                    </div>
                    <div className="flex justify-between gap-3">
                      <span className="text-slate-500 shrink-0">Program:</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200 text-right min-w-0 break-words">{activeInvoiceForPay.program}</span>
                    </div>
                    <div className="flex justify-between gap-3 pt-1 border-t border-slate-200/60 dark:border-slate-700/60">
                      <span className="text-slate-500 font-semibold">Total Invoice Amount:</span>
                      <span className="font-extrabold text-slate-900 dark:text-slate-100 text-right shrink-0">{fmtMoney(activeInvoiceForPay.grand_total)}</span>
                    </div>
                    <div className="flex justify-between gap-3">
                      <span className="text-slate-500 font-semibold">Outstanding:</span>
                      <span className="font-extrabold text-amber-600 dark:text-amber-400 text-right shrink-0">{fmtMoney(activeInvoiceForPay.outstanding_amount)}</span>
                    </div>
                  </div>

                  {/* Payment Amount Input */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Amount to Pay ({currencySymbol}) *
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={payAmount}
                      onChange={(e) => setPayAmount(e.target.value)}
                      className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2 min-h-[36px] text-xs font-bold text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>

                  {/* Mode of Payment Dropdown */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Mode of Payment *
                    </label>
                    <select
                      value={payMode}
                      onChange={(e) => setPayMode(e.target.value)}
                      className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2 min-h-[36px] text-xs font-semibold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    >
                      {paymentModes.length === 0 && (
                        <option value="">No Mode of Payment configured</option>
                      )}
                      {paymentModes.map(m => (
                        <option key={m.name} value={m.name}>{m.name}{m.type ? ` (${m.type})` : ''}</option>
                      ))}
                    </select>
                  </div>

                  {/* Reference Number */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Reference / Cheque / Transaction No. {selectedPayModeIsBank ? '*' : '(Optional)'}
                    </label>
                    <input
                      type="text"
                      placeholder="Cheque / UTR / transaction reference"
                      value={payRefNo}
                      onChange={(e) => setPayRefNo(e.target.value)}
                      className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2 min-h-[36px] text-xs font-semibold text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>

                  <div className="pt-2 flex flex-col-reverse sm:flex-row sm:items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setPayModalOpen(false)}
                      className="w-full sm:w-auto min-h-[36px] px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={submittingPayment}
                      className="w-full sm:w-auto min-h-[36px] px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition shadow-md shadow-emerald-600/20 active:scale-95 flex items-center justify-center gap-1.5"
                    >
                      {submittingPayment ? (
                        <>
                          <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          <span>Posting Entry...</span>
                        </>
                      ) : (
                        <>
                          <Check className="w-3.5 h-3.5" />
                          <span>Confirm & Submit Payment</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  // ==========================================
  // STUDENT / GUARDIAN PORTAL VIEW
  // ==========================================
  const totalOutstanding = studentLedger && studentLedger.total_outstanding !== undefined
    ? Number(studentLedger.total_outstanding || 0)
    : studentInvoices.reduce((acc, inv) => (
        inv.status !== 'Paid' && inv.docstatus === 1 ? acc + Number(inv.outstanding_amount || 0) : acc
      ), 0);

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Guardian Ward Switcher */}
      {isGuardian && students && students.length > 1 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 shrink-0">Viewing Ward:</span>
          {students.map((w) => {
            const isSelected = (studentId === w.student);
            return (
              <button
                key={w.student}
                onClick={() => selectStudent(w.student)}
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

      {/* Outstanding Summary Hero Banner */}
      <div className="relative overflow-hidden rounded-3xl p-5 sm:p-8 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white shadow-xl">
        <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-radial-gradient from-brand-500/20 to-transparent pointer-events-none" />

        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4 sm:gap-6">
          <div className="space-y-2 min-w-0">
            <span className="inline-flex max-w-full items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 text-brand-300 text-xs font-semibold backdrop-blur-md break-words">
              <Sparkles className="w-3.5 h-3.5 shrink-0" />
              Tuition Ledger {activeWard?.student_name ? `• ${activeWard.student_name}` : ''}
            </span>
            <h2 className="text-xl sm:text-3xl font-extrabold tracking-tight break-words">
              {loading
                ? 'Loading Fee Ledger…'
                : studentInvoices.length === 0
                ? 'No Fee Invoices'
                : totalOutstanding > 0 ? 'Outstanding Balance' : 'Tuition Fully Settled'}
            </h2>
            <p className="text-xs text-slate-300 max-w-md">
              {loading
                ? 'Fetching invoices from the school accounts ledger.'
                : studentInvoices.length === 0
                ? 'No fee invoices have been raised for this student yet.'
                : totalOutstanding > 0
                ? 'Review your invoices and settle pending dues with the school accounts office.'
                : 'All raised invoices are paid in full. Thank you!'}
            </p>
          </div>

          <div className="bg-white/10 backdrop-blur-md p-4 sm:p-5 rounded-2xl border border-white/10 sm:shrink-0 min-w-0 text-left sm:text-right">
            <span className="text-xs text-slate-300 font-medium">Total Pending Due</span>
            <div className="text-2xl sm:text-3xl font-black tracking-tight text-white mt-1 break-words">
              {loading ? '—' : fmtMoney(totalOutstanding)}
            </div>
          </div>
        </div>
      </div>

      {/* Invoices List */}
      <div className="glass-panel rounded-3xl border border-slate-200/80 dark:border-slate-800 overflow-hidden shadow-xs">
        <div className="px-4 sm:px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <CreditCard className="w-4 h-4 shrink-0 text-brand-500" />
            <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">Statements & Invoices</h3>
          </div>
          <span className="text-xs text-slate-500 dark:text-slate-400 shrink-0">
            {studentInvoices.length} {studentInvoices.length === 1 ? 'invoice' : 'invoices'} recorded
          </span>
        </div>

        {loading ? (
          <div className="p-12 text-center text-slate-400 text-sm">
            <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            Loading invoices and fee schedule...
          </div>
        ) : loadError ? (
          <div className="p-12 text-center text-rose-600 dark:text-rose-400 text-xs">
            {loadError}
          </div>
        ) : !studentId ? (
          <div className="p-12 text-center text-slate-500 dark:text-slate-400 text-xs">
            No student profile is linked to this account.
          </div>
        ) : studentInvoices.length === 0 ? (
          <div className="p-12 text-center text-slate-500 dark:text-slate-400 text-xs">
            No fee invoices generated yet for this student account.
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {studentInvoices.map((inv) => {
              const isPaid = inv.status === 'Paid';
              const isOverdue = inv.status === 'Overdue';

              return (
                <div key={inv.name} className="p-4 sm:p-5 sm:px-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition">
                  <div className="flex items-start gap-3 sm:gap-4 min-w-0">
                    <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 mt-0.5 ${
                      isPaid ? 'bg-emerald-50 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-400' :
                      isOverdue ? 'bg-rose-50 dark:bg-rose-950/80 text-rose-600 dark:text-rose-400' : 'bg-amber-50 dark:bg-amber-950/80 text-amber-600 dark:text-amber-400'
                    }`}>
                      <CreditCard className="w-5 h-5" />
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-sm text-slate-900 dark:text-slate-100 break-all">{inv.name}</span>
                        {inv.program && inv.program !== 'General' && (
                          <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 break-words">
                            {inv.program}
                          </span>
                        )}
                        <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider ${
                          isPaid ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/80 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800' :
                          isOverdue ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/80 dark:text-rose-400 border border-rose-200 dark:border-rose-800' :
                          'bg-amber-50 text-amber-700 dark:bg-amber-950/80 dark:text-amber-400 border border-amber-200 dark:border-amber-800'
                        }`}>
                          {inv.status}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 break-words">
                        Posting Date: {inv.posting_date || '—'} • {isPaid ? `Paid Date: ${inv.payment_date || '—'}` : `Due: ${inv.due_date || '—'}`}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between sm:justify-end gap-x-4 gap-y-2 pt-2 sm:pt-0 border-t sm:border-0 sm:shrink-0 border-slate-100 dark:border-slate-800">
                    <div className="text-left sm:text-right">
                      <div className="font-extrabold text-sm text-slate-900 dark:text-slate-100">
                        {inv.currency_symbol || currencySymbol}{Number(inv.grand_total || 0).toLocaleString()}
                      </div>
                      <div className="text-[11px] text-slate-400">
                        {isPaid ? 'Settled in Full' : `Due: ${inv.currency_symbol || currencySymbol}${Number(inv.outstanding_amount || 0).toLocaleString()}`}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        onClick={() => downloadPDF(inv)}
                        title="Download Tax Invoice / Receipt PDF"
                        aria-label="Download Tax Invoice / Receipt PDF"
                        className="p-2 rounded-xl text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                      >
                        <Download className="w-4 h-4" />
                      </button>

                      {!isPaid && (
                        <span
                          title="Payments are recorded by the school accounts office"
                          className="px-3.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-bold flex items-center gap-1.5 whitespace-nowrap"
                        >
                          <Building className="w-3.5 h-3.5" />
                          <span>Pay at Accounts Office</span>
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

    </div>
  );
}
