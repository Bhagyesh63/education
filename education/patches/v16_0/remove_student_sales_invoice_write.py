import frappe
from frappe.permissions import update_permission_property


def execute():
    """Students could edit Sales Invoices (granted by an older patch / after_install).
    They only need to read and print their own invoices (row-level scoped)."""
    if frappe.db.exists(
        "Custom DocPerm", {"parent": "Sales Invoice", "role": "Student", "permlevel": 0}
    ):
        update_permission_property("Sales Invoice", "Student", 0, "write", 0)
        for ptype in ("create", "delete", "submit", "cancel", "amend"):
            update_permission_property("Sales Invoice", "Student", 0, ptype, 0)
