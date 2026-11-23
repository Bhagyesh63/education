# Copyright (c) 2015, Frappe Technologies and contributors
# For license information, please see license.txt

import frappe
from frappe.utils import flt
from education.education.api_modules.common import (
    get_currency_symbol,
    get_posting_date_from_payment_entry_against_sales_invoice,
    get_fees_print_format,
    get_program_from_fee_schedule,
    _resolve_portal_student,
    get_guardians_for_user,
)


@frappe.whitelist()
def get_fee_structure(program: str, academic_term: str | None = None):
    fee_structure = frappe.db.get_values(
        "Fee Structure",
        {"program": program, "academic_term": academic_term},
        "name",
        as_dict=True,
    )
    return fee_structure[0].name if fee_structure else None


@frappe.whitelist()
def get_fee_components(fee_structure: str):
    if fee_structure:
        return frappe.get_all(
            "Fee Component",
            fields=["fees_category", "description", "amount"],
            filters={"parent": fee_structure},
            order_by="idx",
        )


@frappe.whitelist()
def get_fee_schedule(program: str, student_category: str | None = None):
    return frappe.get_all(
        "Program Fee",
        fields=["academic_term", "fee_schedule", "due_date", "amount"],
        filters={"parent": program, "student_category": student_category},
        order_by="idx",
    )


@frappe.whitelist()
def collect_fees(fees: str, amt: float):
    paid_amount = flt(amt) + flt(frappe.db.get_value("Fees", fees, "paid_amount"))
    total_amount = flt(frappe.db.get_value("Fees", fees, "total_amount"))
    frappe.db.set_value("Fees", fees, "paid_amount", paid_amount)
    frappe.db.set_value(
        "Fees", fees, "outstanding_amount", (total_amount - paid_amount)
    )
    return paid_amount


@frappe.whitelist(allow_guest=True)
def get_student_invoices(student: str = None):
    current_user = frappe.session.user
    user_roles = frappe.get_roles() if current_user else []

    is_staff = any(
        r in user_roles
        for r in [
            "System Manager",
            "Administrator",
            "Education Manager",
            "Academics User",
            "Instructor",
            "Accounts User",
            "Accounts Manager",
        ]
    )

    if not is_staff and current_user not in ("Guest", "Administrator"):
        # Resolve student for Student or Guardian
        if "Student" in user_roles:
            portal_stu = _resolve_portal_student()
            if portal_stu:
                student = portal_stu
        elif "Guardian" in user_roles:
            guardians = get_guardians_for_user(current_user)
            if guardians:
                wards = frappe.get_all(
                    "Student Guardian",
                    filters={"guardian": ["in", guardians], "parenttype": "Student"},
                    pluck="parent",
                )
                if wards:
                    if not student or student not in wards:
                        student = wards[0]

    # Fallback default if not specified or guest demo
    student = student or "EDU-STU-2026-00001"
    student_sales_invoices = []

    filters = {
        "docstatus": ["!=", 2],
    }
    if student and student != "all":
        filters["student"] = student

    sales_invoice_list = frappe.get_all(
        "Sales Invoice",
        filters=filters,
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

    for si in sales_invoice_list:
        student_program_invoice_status = {}
        student_program_invoice_status["name"] = si.name
        student_program_invoice_status["invoice"] = si.name
        student_program_invoice_status["doctype"] = "Sales Invoice"

        out_amt = flt(si.outstanding_amount)
        inv_status = si.status
        if si.docstatus == 0:
            inv_status = "Unpaid"
            out_amt = flt(si.grand_total)
        elif out_amt <= 0:
            inv_status = "Paid"

        student_program_invoice_status["status"] = inv_status
        prog = get_program_from_fee_schedule(si.fee_schedule)
        if not prog and si.student:
            prog = frappe.db.get_value(
                "Program Enrollment",
                {"student": si.student, "docstatus": 1},
                "program",
            )
        student_program_invoice_status["program"] = prog or "General"
        symbol = get_currency_symbol(si.get("currency", "INR"))
        student_program_invoice_status["currency"] = si.get("currency", "INR")
        student_program_invoice_status["currency_symbol"] = symbol
        student_program_invoice_status["grand_total"] = flt(si.grand_total)
        student_program_invoice_status["outstanding_amount"] = out_amt
        student_program_invoice_status["posting_date"] = (
            str(si.posting_date) if si.get("posting_date") else "-"
        )
        student_program_invoice_status["amount"] = (
            symbol + " " + str(out_amt if inv_status != "Paid" else flt(si.grand_total))
        )
        if inv_status == "Paid":
            pay_date = get_posting_date_from_payment_entry_against_sales_invoice(si.name)
            student_program_invoice_status["payment_date"] = (
                str(pay_date)
                if pay_date
                else (str(si.posting_date) if si.get("posting_date") else "-")
            )
            student_program_invoice_status["due_date"] = "-"
        else:
            student_program_invoice_status["due_date"] = (
                str(si.due_date) if si.due_date else "-"
            )
            student_program_invoice_status["payment_date"] = "-"

        student_sales_invoices.append(student_program_invoice_status)

    # Also support native Education 'Fees' records if any exist
    fee_filters = {
        "docstatus": 1,
    }
    if student and student != "all":
        fee_filters["student"] = student

    fees_list = frappe.get_all(
        "Fees",
        filters=fee_filters,
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
        fee_status = "Paid" if flt(fee.outstanding_amount) <= 0 else "Unpaid"
        symbol = get_currency_symbol(fee.get("currency") or "INR")
        student_sales_invoices.append({
            "name": fee.name,
            "invoice": fee.name,
            "doctype": "Fees",
            "status": fee_status,
            "program": fee.get("program") or "General",
            "currency": fee.get("currency") or "INR",
            "currency_symbol": symbol,
            "grand_total": fee.grand_total,
            "outstanding_amount": fee.outstanding_amount,
            "amount": symbol + " " + str(
                fee.grand_total if fee_status == "Paid" else fee.outstanding_amount
            ),
            "posting_date": str(fee.posting_date) if fee.posting_date else "-",
            "payment_date": str(fee.posting_date) if fee_status == "Paid" else "-",
            "due_date": str(fee.due_date) if fee.due_date and fee_status != "Paid" else "-",
        })

    print_format = get_fees_print_format() or "Tax Invoice"

    return {"invoices": student_sales_invoices, "print_format": print_format}


@frappe.whitelist(allow_guest=True)
def get_fee_dashboard_summary(program: str = None):
    """Returns aggregated fee stats for admin dashboard."""
    conditions = "WHERE docstatus != 2 AND student IS NOT NULL"
    params = []
    
    # Get all sales invoices
    invoices = frappe.db.sql(
        f"""
        SELECT 
            name, student, grand_total, outstanding_amount, status, docstatus, posting_date, due_date
        FROM `tabSales Invoice`
        {conditions}
        ORDER BY creation DESC
        """,
        as_dict=True,
    )

    total_billed = 0.0
    total_collected = 0.0
    total_outstanding = 0.0
    paid_count = 0
    unpaid_count = 0
    overdue_count = 0
    draft_count = 0

    for inv in invoices:
        gt = flt(inv.grand_total)
        out = flt(inv.outstanding_amount)
        if inv.docstatus == 1:
            total_billed += gt
            total_collected += (gt - out)
            total_outstanding += out
            if inv.status == "Paid" or out <= 0:
                paid_count += 1
            elif inv.status == "Overdue":
                overdue_count += 1
                unpaid_count += 1
            else:
                unpaid_count += 1
        elif inv.docstatus == 0:
            draft_count += 1
            total_billed += gt
            total_outstanding += gt

    collection_rate = round((total_collected / total_billed * 100), 1) if total_billed > 0 else 0.0

    return {
        "total_billed": total_billed,
        "total_collected": total_collected,
        "total_outstanding": total_outstanding,
        "collection_rate": collection_rate,
        "total_invoices": len(invoices),
        "paid_count": paid_count,
        "unpaid_count": unpaid_count,
        "overdue_count": overdue_count,
        "draft_count": draft_count,
        "currency": "INR",
        "currency_symbol": "₹",
    }


@frappe.whitelist(allow_guest=True)
def get_all_invoices_for_admin(program: str = None, status: str = None, search: str = None):
    """Returns detailed invoice list for admin with student metadata."""
    filters = {"docstatus": ["!=", 2]}
    if status and status != "all":
        if status == "Draft":
            filters["docstatus"] = 0
        else:
            filters["status"] = status
            filters["docstatus"] = 1

    invoices = frappe.get_all(
        "Sales Invoice",
        filters=filters,
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
        order_by="docstatus asc, status desc, creation desc",
        limit_page_length=200,
    )

    # Student metadata map
    students = frappe.get_all("Student", fields=["name", "student_name", "student_mobile_number"])
    student_map = {s.name: s for s in students}

    # Latest enrollment map
    enrollments = frappe.get_all(
        "Program Enrollment",
        fields=["student", "program", "student_batch_name"],
        order_by="academic_year desc, creation desc",
    )
    enr_map = {}
    for e in enrollments:
        if e.student not in enr_map:
            enr_map[e.student] = e

    result = []
    for inv in invoices:
        stu_id = inv.student
        stu_info = student_map.get(stu_id, {})
        stu_name = stu_info.get("student_name") or inv.customer or "Student"
        enr = enr_map.get(stu_id, {})
        prog = enr.get("program") or "General"
        batch = enr.get("student_batch_name") or "-"

        # Filter by program if specified
        if program and program != "all" and prog != program:
            continue

        # Filter by search query if specified
        if search:
            q = search.lower().strip()
            if not (q in inv.name.lower() or q in stu_name.lower() or q in (stu_id or "").lower()):
                continue

        display_status = inv.status
        if inv.docstatus == 0:
            display_status = "Draft"
        elif flt(inv.outstanding_amount) <= 0:
            display_status = "Paid"

        symbol = get_currency_symbol(inv.currency or "INR")

        result.append({
            "name": inv.name,
            "invoice": inv.name,
            "student": stu_id,
            "student_name": stu_name,
            "customer": inv.customer,
            "program": prog,
            "batch": batch,
            "grand_total": flt(inv.grand_total),
            "outstanding_amount": flt(inv.outstanding_amount),
            "status": display_status,
            "docstatus": inv.docstatus,
            "posting_date": str(inv.posting_date) if inv.posting_date else "-",
            "due_date": str(inv.due_date) if inv.due_date else "-",
            "currency_symbol": symbol,
        })

    print_format = get_fees_print_format() or "Tax Invoice"
    return {"invoices": result, "print_format": print_format}


@frappe.whitelist(allow_guest=True)
def create_payment_entry(
    sales_invoice: str,
    paid_amount: float = None,
    mode_of_payment: str = "Cash",
    reference_no: str = None,
    reference_date: str = None,
):
    """Creates and submits an official ERPNext Payment Entry against a Sales Invoice."""
    from erpnext.accounts.doctype.payment_entry.payment_entry import get_payment_entry

    if not frappe.db.exists("Sales Invoice", sales_invoice):
        frappe.throw(f"Sales Invoice {sales_invoice} does not exist.")

    inv = frappe.get_doc("Sales Invoice", sales_invoice)

    # If the invoice is still draft, submit it first
    if inv.docstatus == 0:
        inv.submit()

    inv.reload()
    if flt(inv.outstanding_amount) <= 0:
        return {
            "success": True,
            "message": "Invoice is already fully settled.",
            "status": "Paid",
            "outstanding_amount": 0,
        }

    pe = get_payment_entry("Sales Invoice", sales_invoice)
    pe.mode_of_payment = mode_of_payment or "Cash"

    # Ensure company account is resolved
    if not pe.paid_to:
        default_acc = frappe.db.get_value(
            "Mode of Payment Account",
            {"parent": pe.mode_of_payment, "company": inv.company},
            "default_account",
        )
        if default_acc:
            pe.paid_to = default_acc
        else:
            pe.paid_to = frappe.db.get_value("Company", inv.company, "default_cash_account") or "Cash - samarth"

    if paid_amount and flt(paid_amount) > 0:
        amt = flt(paid_amount)
        pe.paid_amount = amt
        pe.received_amount = amt
        if pe.references:
            pe.references[0].allocated_amount = amt

    if reference_no:
        pe.reference_no = reference_no
    if reference_date:
        pe.reference_date = reference_date

    pe.insert(ignore_permissions=True)
    pe.submit()
    frappe.db.commit()

    inv.reload()

    return {
        "success": True,
        "payment_entry": pe.name,
        "invoice": inv.name,
        "status": inv.status,
        "outstanding_amount": flt(inv.outstanding_amount),
        "grand_total": flt(inv.grand_total),
    }


@frappe.whitelist(allow_guest=True)
def submit_sales_invoice(sales_invoice: str):
    """Submits a draft sales invoice."""
    if not frappe.db.exists("Sales Invoice", sales_invoice):
        frappe.throw(f"Sales Invoice {sales_invoice} does not exist.")
    inv = frappe.get_doc("Sales Invoice", sales_invoice)
    if inv.docstatus == 0:
        inv.submit()
        frappe.db.commit()
    return {"success": True, "name": inv.name, "status": inv.status}


