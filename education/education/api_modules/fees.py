# Copyright (c) 2015, Frappe Technologies and contributors
# For license information, please see license.txt

import frappe
from frappe import _
from frappe.utils import flt, getdate, today
from education.education.api_modules.common import (
    get_currency_symbol,
    get_posting_date_from_payment_entry_against_sales_invoice,
    get_fees_print_format,
    get_program_from_fee_schedule,
)
from education.education.api_modules.attendance import (
    FEE_MANAGER_ROLES,
    FEE_VIEW_ROLES,
    require_login,
    require_roles,
    has_any_role,
    resolve_student_scope,
)


def _default_currency():
    company = frappe.defaults.get_global_default("company")
    currency = None
    if company:
        currency = frappe.db.get_value("Company", company, "default_currency")
    currency = currency or frappe.defaults.get_global_default("currency")
    return currency, (get_currency_symbol(currency) if currency else "")


def _latest_enrollment_map(student_ids=None):
    filters = {"docstatus": 1}
    if student_ids is not None:
        if not student_ids:
            return {}
        filters["student"] = ["in", student_ids]
    enrollments = frappe.get_all(
        "Program Enrollment",
        filters=filters,
        fields=["student", "program", "student_batch_name", "academic_year"],
        order_by="academic_year desc, creation desc",
    )
    enr_map = {}
    for e in enrollments:
        enr_map.setdefault(e.student, e)
    return enr_map


def _display_status(inv):
    if inv.docstatus == 0:
        return "Draft"
    if flt(inv.outstanding_amount) <= 0:
        return "Paid"
    if inv.status == "Overdue" or (inv.due_date and getdate(inv.due_date) < getdate(today())):
        return "Overdue"
    return "Unpaid" if inv.status in ("Unpaid", "Submitted", None, "") else inv.status


@frappe.whitelist()
def get_fee_structure(program: str, academic_term: str | None = None):
    require_login()
    fee_structure = frappe.db.get_values(
        "Fee Structure",
        {"program": program, "academic_term": academic_term, "docstatus": 1},
        "name",
        as_dict=True,
    )
    return fee_structure[0].name if fee_structure else None


@frappe.whitelist()
def get_fee_components(fee_structure: str):
    require_login()
    if fee_structure:
        return frappe.get_all(
            "Fee Component",
            fields=["fees_category", "description", "amount"],
            filters={"parent": fee_structure, "parenttype": "Fee Structure"},
            order_by="idx",
        )
    return []


@frappe.whitelist()
def get_fee_schedule(program: str, student_category: str | None = None):
    require_login()
    return frappe.get_all(
        "Program Fee",
        fields=["academic_term", "fee_schedule", "due_date", "amount"],
        filters={"parent": program, "student_category": student_category},
        order_by="idx",
    )


@frappe.whitelist(methods=["POST"])
def collect_fees(fees: str, amt: float):
    require_roles(FEE_MANAGER_ROLES, _("Only accounts staff can collect fees."))
    paid_amount = flt(amt) + flt(frappe.db.get_value("Fees", fees, "paid_amount"))
    total_amount = flt(frappe.db.get_value("Fees", fees, "total_amount"))
    frappe.db.set_value("Fees", fees, "paid_amount", paid_amount)
    frappe.db.set_value("Fees", fees, "outstanding_amount", (total_amount - paid_amount))
    return paid_amount


@frappe.whitelist()
def get_student_invoices(student: str = None):
    """Invoices for a student. Students see only their own, guardians only their
    wards, staff / accounts users any student (a specific student is required)."""
    scope = resolve_student_scope(student, staff_roles=FEE_VIEW_ROLES)
    default_currency, default_symbol = _default_currency()
    print_format = get_fees_print_format() or "Standard"

    empty = {
        "invoices": [],
        "print_format": print_format,
        "currency": default_currency,
        "currency_symbol": default_symbol,
        "total_outstanding": 0,
        "total_billed": 0,
        "total_paid": 0,
    }
    if not scope:
        # Portal user without linked students, or staff without a target student
        return empty

    student_names = dict(
        frappe.get_all(
            "Student", filters={"name": ["in", scope]}, fields=["name", "student_name"], as_list=True
        )
    )
    enr_map = _latest_enrollment_map(scope)

    sales_invoice_list = frappe.get_all(
        "Sales Invoice",
        filters={"docstatus": ["!=", 2], "student": ["in", scope]},
        fields=[
            "name",
            "status",
            "docstatus",
            "student",
            "due_date",
            "posting_date",
            "fee_schedule",
            "outstanding_amount",
            "currency",
            "grand_total",
        ],
        order_by="posting_date desc, creation desc",
    )

    invoices = []
    for si in sales_invoice_list:
        inv_status = _display_status(si)
        out_amt = flt(si.grand_total) if si.docstatus == 0 else max(flt(si.outstanding_amount), 0)
        currency = si.currency or default_currency
        symbol = get_currency_symbol(currency) if currency else default_symbol
        prog = get_program_from_fee_schedule(si.fee_schedule) if si.fee_schedule else None
        if not prog:
            prog = (enr_map.get(si.student) or {}).get("program")

        row = {
            "name": si.name,
            "invoice": si.name,
            "doctype": "Sales Invoice",
            "student": si.student,
            "student_name": student_names.get(si.student, si.student),
            "status": inv_status,
            "docstatus": si.docstatus,
            "program": prog or "",
            "fee_schedule": si.fee_schedule or "",
            "currency": currency,
            "currency_symbol": symbol,
            "grand_total": flt(si.grand_total),
            "outstanding_amount": out_amt,
            "paid_amount": flt(si.grand_total) - out_amt,
            "posting_date": str(si.posting_date) if si.posting_date else "",
            "amount": f"{symbol} {out_amt if inv_status != 'Paid' else flt(si.grand_total)}",
        }
        if inv_status == "Paid":
            pay_date = get_posting_date_from_payment_entry_against_sales_invoice(si.name)
            row["payment_date"] = str(pay_date) if pay_date else ""
            row["due_date"] = str(si.due_date) if si.due_date else ""
        else:
            row["due_date"] = str(si.due_date) if si.due_date else ""
            row["payment_date"] = ""
        invoices.append(row)

    # Native Education 'Fees' records, if any
    fees_list = frappe.get_all(
        "Fees",
        filters={"docstatus": 1, "student": ["in", scope]},
        fields=[
            "name",
            "student",
            "program",
            "due_date",
            "posting_date",
            "outstanding_amount",
            "grand_total",
            "currency",
        ],
        order_by="posting_date desc",
    )
    for fee in fees_list:
        fee_status = "Paid" if flt(fee.outstanding_amount) <= 0 else (
            "Overdue" if fee.due_date and getdate(fee.due_date) < getdate(today()) else "Unpaid"
        )
        currency = fee.currency or default_currency
        symbol = get_currency_symbol(currency) if currency else default_symbol
        invoices.append({
            "name": fee.name,
            "invoice": fee.name,
            "doctype": "Fees",
            "student": fee.student,
            "student_name": student_names.get(fee.student, fee.student),
            "status": fee_status,
            "docstatus": 1,
            "program": fee.program or "",
            "currency": currency,
            "currency_symbol": symbol,
            "grand_total": flt(fee.grand_total),
            "outstanding_amount": max(flt(fee.outstanding_amount), 0),
            "paid_amount": flt(fee.grand_total) - max(flt(fee.outstanding_amount), 0),
            "amount": f"{symbol} {fee.grand_total if fee_status == 'Paid' else fee.outstanding_amount}",
            "posting_date": str(fee.posting_date) if fee.posting_date else "",
            "payment_date": "",
            "due_date": str(fee.due_date) if fee.due_date else "",
        })

    billed = sum(i["grand_total"] for i in invoices if i["docstatus"] == 1)
    outstanding = sum(i["outstanding_amount"] for i in invoices if i["docstatus"] == 1)
    return {
        **empty,
        "invoices": invoices,
        "total_billed": billed,
        "total_outstanding": outstanding,
        "total_paid": billed - outstanding,
    }


def _invoices_for_program(program=None):
    """All non-cancelled student Sales Invoices, optionally limited to a program
    (resolved through the fee schedule or the student's latest enrollment)."""
    invoices = frappe.get_all(
        "Sales Invoice",
        filters={"docstatus": ["!=", 2], "student": ["is", "set"]},
        fields=[
            "name",
            "student",
            "customer",
            "grand_total",
            "outstanding_amount",
            "status",
            "docstatus",
            "posting_date",
            "due_date",
            "fee_schedule",
            "currency",
        ],
        order_by="creation desc",
        limit_page_length=0,
    )
    enr_map = _latest_enrollment_map(list({i.student for i in invoices}))
    schedule_programs = {}
    for inv in invoices:
        prog = None
        if inv.fee_schedule:
            if inv.fee_schedule not in schedule_programs:
                schedule_programs[inv.fee_schedule] = get_program_from_fee_schedule(inv.fee_schedule)
            prog = schedule_programs[inv.fee_schedule]
        enr = enr_map.get(inv.student) or {}
        inv["program"] = prog or enr.get("program") or ""
        inv["batch"] = enr.get("student_batch_name") or ""
        inv["display_status"] = _display_status(inv)

    if program and program != "all":
        invoices = [i for i in invoices if i.program == program]
    return invoices


@frappe.whitelist()
def get_fee_dashboard_summary(program: str = None):
    """Aggregated fee statistics for the staff fee dashboard."""
    require_roles(FEE_VIEW_ROLES, _("Only school staff can view the fee ledger."))
    invoices = _invoices_for_program(program)

    totals = {"billed": 0.0, "collected": 0.0, "outstanding": 0.0}
    counts = {"Paid": 0, "Unpaid": 0, "Overdue": 0, "Draft": 0}
    for inv in invoices:
        gt = flt(inv.grand_total)
        out = max(flt(inv.outstanding_amount), 0)
        status = inv.display_status
        if inv.docstatus == 1:
            totals["billed"] += gt
            totals["collected"] += gt - out
            totals["outstanding"] += out
        counts[status] = counts.get(status, 0) + 1

    currency, symbol = _default_currency()
    collection_rate = (
        round(totals["collected"] / totals["billed"] * 100, 1) if totals["billed"] > 0 else 0.0
    )
    return {
        "total_billed": totals["billed"],
        "total_collected": totals["collected"],
        "total_outstanding": totals["outstanding"],
        "collection_rate": collection_rate,
        "total_invoices": len(invoices),
        "paid_count": counts.get("Paid", 0),
        "unpaid_count": counts.get("Unpaid", 0) + counts.get("Overdue", 0),
        "overdue_count": counts.get("Overdue", 0),
        "draft_count": counts.get("Draft", 0),
        "draft_amount": sum(flt(i.grand_total) for i in invoices if i.docstatus == 0),
        "currency": currency,
        "currency_symbol": symbol,
        "programs": sorted({i.program for i in invoices if i.program}),
    }


@frappe.whitelist()
def get_all_invoices_for_admin(program: str = None, status: str = None, search: str = None):
    """Detailed invoice list with student metadata (staff only)."""
    require_roles(FEE_VIEW_ROLES, _("Only school staff can view the fee ledger."))
    invoices = _invoices_for_program(program)

    student_ids = list({i.student for i in invoices})
    student_map = {
        s.name: s
        for s in frappe.get_all(
            "Student",
            filters={"name": ["in", student_ids or [""]]},
            fields=["name", "student_name", "student_mobile_number"],
        )
    }

    q = (search or "").lower().strip()
    default_symbol = _default_currency()[1]
    result = []
    for inv in invoices:
        if status and status != "all":
            if status == "Unpaid":
                if inv.display_status not in ("Unpaid", "Overdue"):
                    continue
            elif inv.display_status != status:
                continue

        stu_info = student_map.get(inv.student) or {}
        stu_name = stu_info.get("student_name") or inv.customer or inv.student
        if q and not (
            q in inv.name.lower() or q in (stu_name or "").lower() or q in (inv.student or "").lower()
        ):
            continue

        result.append({
            "name": inv.name,
            "invoice": inv.name,
            "student": inv.student,
            "student_name": stu_name,
            "customer": inv.customer,
            "program": inv.program,
            "batch": inv.batch,
            "grand_total": flt(inv.grand_total),
            "outstanding_amount": flt(inv.grand_total)
            if inv.docstatus == 0
            else max(flt(inv.outstanding_amount), 0),
            "status": inv.display_status,
            "docstatus": inv.docstatus,
            "posting_date": str(inv.posting_date) if inv.posting_date else "",
            "due_date": str(inv.due_date) if inv.due_date else "",
            "currency": inv.currency,
            "currency_symbol": get_currency_symbol(inv.currency) if inv.currency else default_symbol,
        })

    result.sort(key=lambda r: (r["docstatus"] != 0, r["status"] == "Paid"))
    print_format = get_fees_print_format() or "Standard"
    return {"invoices": result[:500], "print_format": print_format}


@frappe.whitelist()
def get_payment_modes():
    """Enabled Modes of Payment configured in ERPNext, plus whether the caller may
    record payments / submit invoices (fee ledger viewers without accounts roles
    get an empty list instead of a PermissionError)."""
    require_roles(FEE_VIEW_ROLES, _("Only school staff can view the fee ledger."))
    can_record = has_any_role(FEE_MANAGER_ROLES)
    modes = (
        frappe.get_all(
            "Mode of Payment",
            filters={"enabled": 1},
            fields=["name", "type"],
            order_by="name asc",
        )
        if can_record
        else []
    )
    return {"can_record_payments": can_record, "modes": modes}


@frappe.whitelist(methods=["POST"])
def create_payment_entry(
    sales_invoice: str,
    paid_amount: float = None,
    mode_of_payment: str = None,
    reference_no: str = None,
    reference_date: str = None,
):
    """Creates and submits an ERPNext Payment Entry against a Sales Invoice
    (accounts / education managers only)."""
    require_roles(FEE_MANAGER_ROLES, _("Only accounts staff can record payments."))
    from erpnext.accounts.doctype.payment_entry.payment_entry import get_payment_entry

    if not frappe.db.exists("Sales Invoice", sales_invoice):
        frappe.throw(_("Sales Invoice {0} does not exist.").format(sales_invoice))
    if not mode_of_payment or not frappe.db.exists("Mode of Payment", mode_of_payment):
        frappe.throw(_("Please select a valid Mode of Payment."))

    inv = frappe.get_doc("Sales Invoice", sales_invoice)
    if inv.docstatus == 0:
        inv.submit()

    inv.reload()
    if flt(inv.outstanding_amount) <= 0:
        return {
            "success": True,
            "message": _("Invoice is already fully settled."),
            "status": "Paid",
            "outstanding_amount": 0,
        }

    amt = flt(paid_amount)
    if amt and amt > flt(inv.outstanding_amount):
        frappe.throw(_("Payment amount cannot exceed the outstanding amount."))

    pe = get_payment_entry("Sales Invoice", sales_invoice)
    pe.mode_of_payment = mode_of_payment

    mop_account = frappe.db.get_value(
        "Mode of Payment Account",
        {"parent": mode_of_payment, "company": inv.company},
        "default_account",
    )
    if mop_account:
        pe.paid_to = mop_account
    if not pe.paid_to:
        pe.paid_to = frappe.db.get_value("Company", inv.company, "default_cash_account")
    if not pe.paid_to:
        frappe.throw(
            _("No account is configured for Mode of Payment {0} in company {1}.").format(
                mode_of_payment, inv.company
            )
        )

    if amt > 0:
        pe.paid_amount = amt
        pe.received_amount = amt
        if pe.references:
            pe.references[0].allocated_amount = amt

    if reference_no:
        pe.reference_no = reference_no
        pe.reference_date = reference_date or today()

    pe.insert(ignore_permissions=True)
    pe.submit()

    inv.reload()
    return {
        "success": True,
        "payment_entry": pe.name,
        "invoice": inv.name,
        "status": inv.status,
        "outstanding_amount": flt(inv.outstanding_amount),
        "grand_total": flt(inv.grand_total),
    }


@frappe.whitelist(methods=["POST"])
def submit_sales_invoice(sales_invoice: str):
    """Submits a draft sales invoice (accounts / education managers only)."""
    require_roles(FEE_MANAGER_ROLES, _("Only accounts staff can submit invoices."))
    if not frappe.db.exists("Sales Invoice", sales_invoice):
        frappe.throw(_("Sales Invoice {0} does not exist.").format(sales_invoice))
    inv = frappe.get_doc("Sales Invoice", sales_invoice)
    if inv.docstatus == 0:
        inv.submit()
    return {"success": True, "name": inv.name, "status": inv.status}
