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
    currency_symbol: '₹',
  });
  const [adminInvoices, setAdminInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedProgramFilter, setSelectedProgramFilter] = useState('all');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Payment Recording Modal State
  const [payModalOpen, setPayModalOpen] = useState(false);
  const [activeInvoiceForPay, setActiveInvoiceForPay] = useState(null);
  const [payAmount, setPayAmount] = useState('');
  const [payMode, setPayMode] = useState('Cash');
  const [payRefNo, setPayRefNo] = useState('');
  const [submittingPayment, setSubmittingPayment] = useState(false);
  const [paymentError, setPaymentError] = useState('');
  const [paymentSuccessMsg, setPaymentSuccessMsg] = useState('');

  // Submitting Draft Invoice State
  const [submittingInvoiceName, setSubmittingInvoiceName] = useState(null);

  // Student / Guardian Personal State
  const studentId = activeStudentId || studentProfile?.name || 'EDU-STU-2026-00001';
  const [studentInvoices, setStudentInvoices] = useState([]);
  const [printFormat, setPrintFormat] = useState('Tax Invoice');

  // Load Data
  const loadData = async () => {
    setLoading(true);
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
        if (sumRes) setSummary(sumRes);
        if (invRes?.invoices) setAdminInvoices(invRes.invoices);
        if (invRes?.print_format) setPrintFormat(invRes.print_format);
      } else {
        const data = await api.getStudentInvoices(studentId || null);
        if (data?.invoices) setStudentInvoices(data.invoices);
        if (data?.print_format) setPrintFormat(data.print_format);
      }
    } catch (err) {
      console.error('Error fetching fee data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [isManagement, selectedProgramFilter, selectedStatusFilter, studentId]);

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
    setPayMode('Cash');
    setPayRefNo('');
    setPaymentError('');
    setPaymentSuccessMsg('');
    setPayModalOpen(true);
  };

  // Submit Payment
  const handleExecutePayment = async (e) => {
    e.preventDefault();
    if (!activeInvoiceForPay) return;
    setSubmittingPayment(true);
    setPaymentError('');
    setPaymentSuccessMsg('');

    try {
      const res = await api.createPaymentEntry(
        activeInvoiceForPay.name,
        parseFloat(payAmount) || activeInvoiceForPay.outstanding_amount,
        payMode,
        payRefNo || null,
        new Date().toISOString().split('T')[0]
      );

      if (res?.success) {
        setPaymentSuccessMsg(`Payment recorded successfully (${res.payment_entry || 'Settled'}). Status: Paid.`);
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
    const format = printFormat && printFormat !== 'Standard' ? printFormat : 'Tax Invoice';
    const url = `/api/method/frappe.utils.print_format.download_pdf?doctype=${encodeURIComponent(doctype)}&name=${encodeURIComponent(invName)}&format=${encodeURIComponent(format)}&no_letterhead=0`;
    window.open(url, '_blank');
  };

  const currencySymbol = summary?.currency_symbol || '₹';

  // Available programs for filter
  const availablePrograms = Array.from(
    new Set([
      'Standard 7',
      'Standard 6',
      'Standard 5',
      ...(programs || []).map(p => (typeof p === 'object' ? p.program : p)).filter(Boolean)
    ])
  ).filter(Boolean);

  // ==========================================
  // MANAGEMENT / ADMIN VIEW
  // ==========================================
  if (isManagement) {
    return (
      <div className="space-y-6 animate-in fade-in duration-200">
        {/* Header Title */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
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

          <div className="flex items-center gap-2">
            <button
              onClick={loadData}
              disabled={loading}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-750 transition shadow-xs active:scale-95"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {/* 4 Financial KPI Stat Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Total Billed */}
          <div className="glass-panel p-5 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-xs relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Total Billed</span>
              <div className="w-8 h-8 rounded-xl bg-brand-50 dark:bg-brand-950/80 text-brand-600 dark:text-brand-400 flex items-center justify-center">
                <FileText className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2 text-2xl font-black text-slate-900 dark:text-slate-100">
              {currencySymbol}{summary.total_billed.toLocaleString()}
            </div>
            <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1">
              <span>{summary.total_invoices} total invoices generated</span>
            </div>
          </div>

          {/* Total Collected */}
          <div className="glass-panel p-5 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-xs relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Total Collected</span>
              <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                <TrendingUp className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2 text-2xl font-black text-emerald-600 dark:text-emerald-400">
              {currencySymbol}{summary.total_collected.toLocaleString()}
            </div>
            <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400 flex items-center justify-between">
              <span>Collection Rate</span>
              <span className="font-bold text-emerald-600 dark:text-emerald-400">{summary.collection_rate}%</span>
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
          <div className="glass-panel p-5 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-xs relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Outstanding Balance</span>
              <div className="w-8 h-8 rounded-xl bg-amber-50 dark:bg-amber-950/80 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                <Clock className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2 text-2xl font-black text-amber-600 dark:text-amber-400">
              {currencySymbol}{summary.total_outstanding.toLocaleString()}
            </div>
            <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1">
              <span>{summary.unpaid_count} pending settlement</span>
            </div>
          </div>

          {/* Invoices Status Ratio */}
          <div className="glass-panel p-5 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-xs relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Status Breakdown</span>
              <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                <ShieldCheck className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
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
                <span className="text-emerald-500 font-semibold">Zero overdue notices</span>
              )}
            </div>
          </div>
        </div>

        {/* Filter Controls & Search */}
        <div className="glass-panel p-4 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Search bar */}
          <div className="relative flex-1 min-w-[240px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by student name, roll no, or invoice ID..."
              className="w-full bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-700/80 rounded-2xl pl-10 pr-4 py-2 text-xs font-semibold text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500/30 transition"
            />
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Program Filter */}
            <div className="relative">
              <select
                value={selectedProgramFilter}
                onChange={(e) => setSelectedProgramFilter(e.target.value)}
                className="appearance-none bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-700/80 rounded-2xl pl-3.5 pr-8 py-2 text-xs font-semibold text-slate-800 dark:text-slate-200 hover:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30 shadow-xs cursor-pointer transition min-w-[130px]"
              >
                <option value="all">All Programs</option>
                {availablePrograms.map(p => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>

            {/* Status Filter */}
            <div className="relative">
              <select
                value={selectedStatusFilter}
                onChange={(e) => setSelectedStatusFilter(e.target.value)}
                className="appearance-none bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-700/80 rounded-2xl pl-3.5 pr-8 py-2 text-xs font-semibold text-slate-800 dark:text-slate-200 hover:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30 shadow-xs cursor-pointer transition min-w-[120px]"
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
          <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-brand-500" />
              <h2 className="font-bold text-sm text-slate-900 dark:text-slate-100">
                Sales Invoices Registry
              </h2>
            </div>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              {adminInvoices.length} {adminInvoices.length === 1 ? 'record' : 'records'} found
            </span>
          </div>

          {loading ? (
            <div className="p-12 text-center text-slate-400 text-sm">
              <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
              Loading institutional invoices...
            </div>
          ) : adminInvoices.length === 0 ? (
            <div className="p-12 text-center text-slate-500 dark:text-slate-400 text-xs">
              No sales invoices found matching the selected filters.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
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
                        <td className="py-3.5 px-5 font-bold text-slate-900 dark:text-slate-100 font-mono">
                          {inv.name}
                        </td>
                        <td className="py-3.5 px-5">
                          <div className="font-semibold text-slate-900 dark:text-slate-100">
                            {inv.student_name}
                          </div>
                          <div className="text-[10px] text-slate-400 font-mono">
                            {inv.student}
                          </div>
                        </td>
                        <td className="py-3.5 px-5">
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                            {inv.program}
                          </span>
                        </td>
                        <td className="py-3.5 px-5 text-right font-extrabold text-slate-900 dark:text-slate-100">
                          {inv.currency_symbol || currencySymbol}{inv.grand_total?.toLocaleString()}
                        </td>
                        <td className="py-3.5 px-5 text-right font-bold text-amber-600 dark:text-amber-400">
                          {isPaid ? (
                            <span className="text-emerald-600 dark:text-emerald-400">₹0</span>
                          ) : (
                            `${inv.currency_symbol || currencySymbol}${inv.outstanding_amount?.toLocaleString()}`
                          )}
                        </td>
                        <td className="py-3.5 px-5 text-center">
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider inline-block ${
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
                        <td className="py-3.5 px-5 text-slate-500 dark:text-slate-400 text-[11px]">
                          {inv.due_date || 'N/A'}
                        </td>
                        <td className="py-3.5 px-5 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {isDraft && (
                              <button
                                onClick={() => handleSubmitInvoice(inv.name)}
                                disabled={submittingInvoiceName === inv.name}
                                title="Submit Draft Invoice to General Ledger"
                                className="px-2.5 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 dark:hover:bg-blue-900/60 text-[11px] font-semibold transition active:scale-95 flex items-center gap-1"
                              >
                                {submittingInvoiceName === inv.name ? (
                                  <div className="w-3 h-3 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                                ) : (
                                  <Check className="w-3 h-3" />
                                )}
                                <span>Submit</span>
                              </button>
                            )}

                            {!isPaid && (
                              <button
                                onClick={() => openPayModal(inv)}
                                className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-semibold transition active:scale-95 shadow-xs flex items-center gap-1"
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
          )}
        </div>

        {/* Record Payment Modal */}
        {payModalOpen && activeInvoiceForPay && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-7 max-w-md w-full shadow-2xl relative space-y-5">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                    <DollarSign className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">
                      Record Payment Entry
                    </h3>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Invoice: {activeInvoiceForPay.name}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setPayModalOpen(false)}
                  className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {paymentSuccessMsg ? (
                <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-center space-y-2">
                  <CheckCircle2 className="w-8 h-8 text-emerald-600 dark:text-emerald-400 mx-auto" />
                  <p className="text-xs font-bold text-emerald-800 dark:text-emerald-300">
                    {paymentSuccessMsg}
                  </p>
                </div>
              ) : (
                <form onSubmit={handleExecutePayment} className="space-y-4">
                  {paymentError && (
                    <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                      <span>{paymentError}</span>
                    </div>
                  )}

                  {/* Student & Program Summary Box */}
                  <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60 space-y-1 text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Student:</span>
                      <span className="font-bold text-slate-900 dark:text-slate-100">{activeInvoiceForPay.student_name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Program:</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200">{activeInvoiceForPay.program}</span>
                    </div>
                    <div className="flex justify-between pt-1 border-t border-slate-200/60 dark:border-slate-700/60">
                      <span className="text-slate-500 font-semibold">Total Invoice Amount:</span>
                      <span className="font-extrabold text-slate-900 dark:text-slate-100">{currencySymbol}{activeInvoiceForPay.grand_total?.toLocaleString()}</span>
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
                      className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2 text-xs font-bold text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
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
                      className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2 text-xs font-semibold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    >
                      <option value="Cash">Cash</option>
                      <option value="Bank Draft">Bank Draft / Cheque</option>
                      <option value="Credit Card">Credit Card / POS</option>
                      <option value="Wire Transfer">Wire Transfer / NEFT</option>
                    </select>
                  </div>

                  {/* Reference Number */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Reference / Cheque / Transaction No. (Optional)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. CHQ-92841 / TXN-202611"
                      value={payRefNo}
                      onChange={(e) => setPayRefNo(e.target.value)}
                      className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2 text-xs font-semibold text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>

                  <div className="pt-2 flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setPayModalOpen(false)}
                      className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={submittingPayment}
                      className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition shadow-md shadow-emerald-600/20 active:scale-95 flex items-center gap-1.5"
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
  const totalOutstanding = studentInvoices.reduce((acc, inv) => {
    if (inv.status !== 'Paid') {
      return acc + Number(inv.outstanding_amount || inv.grand_total || 0);
    }
    return acc;
  }, 0);

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
                <span className="text-[10px] opacity-75">({w.relation || 'Ward'})</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Outstanding Summary Hero Banner */}
      <div className="relative overflow-hidden rounded-3xl p-6 sm:p-8 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white shadow-xl">
        <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-radial-gradient from-brand-500/20 to-transparent pointer-events-none" />

        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <div className="space-y-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 text-brand-300 text-xs font-semibold backdrop-blur-md">
              <Sparkles className="w-3.5 h-3.5" />
              Tuition Ledger {activeWard?.student_name ? `• ${activeWard.student_name}` : ''}
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              {totalOutstanding > 0 ? 'Outstanding Balance' : 'Tuition Fully Settled'}
            </h2>
            <p className="text-xs text-slate-300 max-w-md">
              {totalOutstanding > 0 
                ? 'Review your fee schedule and settle pending school dues safely online.' 
                : 'All course fees and examination levies are paid in full. Thank you!'}
            </p>
          </div>

          <div className="bg-white/10 backdrop-blur-md p-5 rounded-2xl border border-white/10 shrink-0 text-left sm:text-right">
            <span className="text-xs text-slate-300 font-medium">Total Pending Due</span>
            <div className="text-3xl font-black tracking-tight text-white mt-1">
              {currencySymbol}{totalOutstanding.toLocaleString()}
            </div>
          </div>
        </div>
      </div>

      {/* Invoices List */}
      <div className="glass-panel rounded-3xl border border-slate-200/80 dark:border-slate-800 overflow-hidden shadow-xs">
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-brand-500" />
            <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">Statements & Invoices</h3>
          </div>
          <span className="text-xs text-slate-500 dark:text-slate-400">
            {studentInvoices.length} {studentInvoices.length === 1 ? 'invoice' : 'invoices'} recorded
          </span>
        </div>

        {loading ? (
          <div className="p-12 text-center text-slate-400 text-sm">
            <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            Loading invoices and fee schedule...
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
                <div key={inv.name} className="p-5 sm:px-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition">
                  <div className="flex items-start gap-4">
                    <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 mt-0.5 ${
                      isPaid ? 'bg-emerald-50 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-400' :
                      isOverdue ? 'bg-rose-50 dark:bg-rose-950/80 text-rose-600 dark:text-rose-400' : 'bg-amber-50 dark:bg-amber-950/80 text-amber-600 dark:text-amber-400'
                    }`}>
                      <CreditCard className="w-5 h-5" />
                    </div>

                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-sm text-slate-900 dark:text-slate-100">{inv.name}</span>
                        {inv.program && inv.program !== 'General' && (
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
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
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                        Posting Date: {inv.posting_date || 'N/A'} • {isPaid ? `Paid Date: ${inv.payment_date || 'Settled'}` : `Due: ${inv.due_date || 'On Receipt'}`}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-4 pt-2 sm:pt-0 border-t sm:border-0 border-slate-100 dark:border-slate-800">
                    <div className="text-left sm:text-right">
                      <div className="font-extrabold text-sm text-slate-900 dark:text-slate-100">
                        {inv.currency_symbol || currencySymbol}{Number(inv.grand_total || 0).toLocaleString()}
                      </div>
                      <div className="text-[11px] text-slate-400">
                        {isPaid ? 'Settled in Full' : `Due: ${inv.currency_symbol || currencySymbol}${Number(inv.outstanding_amount || inv.grand_total || 0).toLocaleString()}`}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => downloadPDF(inv)}
                        title="Download Tax Invoice / Receipt PDF"
                        className="p-2 rounded-xl text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                      >
                        <Download className="w-4 h-4" />
                      </button>

                      {!isPaid && (
                        <button
                          onClick={() => openPayModal(inv)}
                          className="px-3.5 py-1.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold transition shadow-xs active:scale-95 flex items-center gap-1.5"
                        >
                          <CreditCard className="w-3.5 h-3.5" />
                          <span>Pay Now</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Pay Modal for Student / Guardian */}
      {payModalOpen && activeInvoiceForPay && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-7 max-w-md w-full shadow-2xl relative space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-brand-600" />
                <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">
                  Online Fee Settlement
                </h3>
              </div>
              <button
                onClick={() => setPayModalOpen(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {paymentSuccessMsg ? (
              <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-center space-y-2">
                <CheckCircle2 className="w-8 h-8 text-emerald-600 dark:text-emerald-400 mx-auto" />
                <p className="text-xs font-bold text-emerald-800 dark:text-emerald-300">
                  {paymentSuccessMsg}
                </p>
              </div>
            ) : (
              <form onSubmit={handleExecutePayment} className="space-y-4">
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60 space-y-1.5 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Invoice:</span>
                    <span className="font-mono font-bold text-slate-900 dark:text-slate-100">{activeInvoiceForPay.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Total Outstanding:</span>
                    <span className="font-extrabold text-amber-600 dark:text-amber-400">
                      {currencySymbol}{activeInvoiceForPay.outstanding_amount?.toLocaleString()}
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Payment Amount ({currencySymbol})
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={payAmount}
                    onChange={(e) => setPayAmount(e.target.value)}
                    className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2 text-xs font-bold text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Payment Gateway / Method
                  </label>
                  <select
                    value={payMode}
                    onChange={(e) => setPayMode(e.target.value)}
                    className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2 text-xs font-semibold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500"
                  >
                    <option value="Credit Card">Online Card / UPI (Gateway)</option>
                    <option value="Wire Transfer">Net Banking / Wire Transfer</option>
                    <option value="Cash">Cash at School Counter</option>
                  </select>
                </div>

                <div className="pt-2 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setPayModalOpen(false)}
                    className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submittingPayment}
                    className="px-5 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold transition shadow-md shadow-brand-600/20 active:scale-95 flex items-center gap-1.5"
                  >
                    {submittingPayment ? (
                      <>
                        <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        <span>Authorizing...</span>
                      </>
                    ) : (
                      <>
                        <ShieldCheck className="w-3.5 h-3.5" />
                        <span>Authorize Payment</span>
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
