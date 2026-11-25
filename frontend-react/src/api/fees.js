import { frappeCall } from './client';

export const feesApi = {
  getStudentInvoices: (student) => 
    frappeCall('education.education.api.get_student_invoices', { student }),

  getFeeStructure: (program, academic_term) => 
    frappeCall('education.education.api.get_fee_structure', { program, academic_term }),

  getFeeComponents: (fee_structure) => 
    frappeCall('education.education.api.get_fee_components', { fee_structure }),

  getFeeSchedule: (program, student_category) => 
    frappeCall('education.education.api.get_fee_schedule', { program, student_category }),

  collectFees: (fees, amt) => 
    frappeCall('education.education.api.collect_fees', { fees, amt }),

  getFeeDashboardSummary: (program) => 
    frappeCall('education.education.api.get_fee_dashboard_summary', { program }),

  getAllInvoicesForAdmin: (program, status, search) => 
    frappeCall('education.education.api.get_all_invoices_for_admin', { program, status, search }),

  createPaymentEntry: (sales_invoice, paid_amount, mode_of_payment, reference_no, reference_date) => 
    frappeCall('education.education.api.create_payment_entry', {
      sales_invoice,
      paid_amount,
      mode_of_payment,
      reference_no,
      reference_date,
    }),

  submitSalesInvoice: (sales_invoice) => 
    frappeCall('education.education.api.submit_sales_invoice', { sales_invoice }),

  getPaymentModes: () =>
    frappeCall('education.education.api.get_payment_modes'),
};

export default feesApi;
