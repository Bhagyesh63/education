# Copyright (c) 2026, Frappe Technologies and contributors
# For license information, please see license.txt

"""Public (guest) data for the portal landing page.

Everything returned here is meant to be public: school identity and contact
details, the classes offered, open admission drives and public circulars.
No student, guardian or staff personal data is exposed.
"""

import frappe
from frappe.utils import getdate, now_datetime, nowdate

from education.education.api_modules.common import _clean_text


@frappe.whitelist(allow_guest=True, methods=["GET"])
def get_landing_context():
    return {
        "school": _get_school(),
        "contact": _get_contact(),
        "programs": _get_programs(),
        "admissions": get_open_admissions(),
        "notices": _get_public_notices(),
    }


def _get_school():
    name = frappe.db.get_single_value(
        "Education Settings", "school_college_name_abbreviation"
    ) or frappe.defaults.get_global_default("company")
    return {
        "name": name,
        "logo": frappe.db.get_single_value("Education Settings", "school_college_logo"),
        "current_academic_year": frappe.db.get_single_value(
            "Education Settings", "current_academic_year"
        ),
    }


def _get_contact():
    company = frappe.defaults.get_global_default("company")
    if not company:
        return {}
    contact = frappe.db.get_value(
        "Company", company, ["phone_no", "email", "website"], as_dict=True
    ) or {}

    address = None
    address_names = frappe.get_all(
        "Dynamic Link",
        filters={"link_doctype": "Company", "link_name": company, "parenttype": "Address"},
        pluck="parent",
    )
    if address_names:
        address = frappe.get_all(
            "Address",
            filters={"name": ["in", address_names], "disabled": 0},
            fields=["address_line1", "address_line2", "city", "state", "pincode", "country"],
            order_by="is_primary_address desc, modified desc",
            limit=1,
        )
        address = address[0] if address else None

    return {
        "phone": contact.get("phone_no"),
        "email": contact.get("email"),
        "website": contact.get("website"),
        "address": address,
    }


def _get_programs():
    programs = frappe.get_all(
        "Program",
        fields=["name", "program_name", "program_abbreviation"],
        order_by="name asc",
    )
    for p in programs:
        p["course_count"] = frappe.db.count("Program Course", {"parent": p.name})
        p["courses"] = frappe.get_all(
            "Program Course",
            filters={"parent": p.name, "parenttype": "Program"},
            pluck="course_name",
            order_by="idx asc",
        )
    return programs


def get_open_admissions():
    """Published admission drives that are accepting applications today."""
    today = getdate(nowdate())
    drives = frappe.get_all(
        "Student Admission",
        filters={"published": 1},
        fields=[
            "name",
            "title",
            "academic_year",
            "admission_start_date",
            "admission_end_date",
            "enable_admission_application",
            "introduction",
        ],
        order_by="admission_start_date desc",
    )
    open_drives = []
    for d in drives:
        if d.admission_start_date and getdate(d.admission_start_date) > today:
            continue
        if d.admission_end_date and getdate(d.admission_end_date) < today:
            continue
        d["introduction"] = _clean_text(d.introduction, 600)
        d["programs"] = frappe.get_all(
            "Student Admission Program",
            filters={"parent": d.name, "parenttype": "Student Admission"},
            fields=["program", "min_age", "max_age", "application_fee"],
            order_by="idx asc",
        )
        open_drives.append(d)
    return open_drives


def _get_public_notices(limit=5):
    notes = frappe.get_all(
        "Note",
        filters={"public": 1},
        or_filters=[
            ["expire_notification_on", "is", "not set"],
            ["expire_notification_on", ">", now_datetime()],
        ],
        fields=["name", "title", "content", "notify_on_login", "modified"],
        order_by="notify_on_login desc, modified desc",
        limit=limit,
    )
    return [
        {
            "id": n.name,
            "title": n.title,
            "content": _clean_text(n.content, 220),
            "date": str(n.modified).split(" ")[0],
            "pinned": bool(n.notify_on_login),
        }
        for n in notes
    ]
