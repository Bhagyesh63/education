# Copyright (c) 2026, Frappe Technologies and contributors
# For license information, please see license.txt

import frappe


def enforce_private_attachment(doc, method=None):
    """
    Enforces that any file attached to any DocType is always marked as private.
    This guarantees that attachments across all doctypes are saved to /private/files/
    and protected by Frappe permissions.
    """
    attached_to = getattr(doc, "attached_to_doctype", None)
    if attached_to is None and isinstance(doc, dict):
        attached_to = doc.get("attached_to_doctype")

    if attached_to:
        if hasattr(doc, "is_private"):
            doc.is_private = 1
        elif isinstance(doc, dict):
            doc["is_private"] = 1
