# Copyright (c) 2021, Dokos SAS and contributors
# License: MIT. See LICENSE
import frappe
from frappe.model.document import Document
from frappe.utils import now_datetime
from frappe.utils.seal import get_chained_seal, get_sealed_doc

exclude_from_linked_with = True


class ArchivedDocument(Document):
	# begin: auto-generated types
	# This code is auto-generated. Do not modify anything in this block.

	from typing import TYPE_CHECKING

	if TYPE_CHECKING:
		from frappe.types import DF

		amended_from: DF.Link | None
		data: DF.Code
		hash: DF.Data
		reference_docname: DF.DynamicLink
		reference_doctype: DF.Link
		timestamp: DF.Datetime
		user: DF.Link
	# end: auto-generated types

	def before_insert(self):
		sealed_doc = self.data
		current_seal, chained_seal = get_chained_seal(sealed_doc)

		frappe.db.set_value(
			self.reference_doctype,
			self.reference_docname,
			"_seal",
			current_seal,
			update_modified=False,
		)

		self.hash = chained_seal
		self.data = frappe.as_json(sealed_doc, indent=4)

	def on_trash(self):
		raise frappe.PermissionError

	def on_cancel(self):
		raise frappe.PermissionError


def create_archive(doc):
	sealed_doc = get_sealed_doc(doc)
	if sealed_doc:
		try:
			archive = frappe.get_doc(
				{
					"doctype": "Archived Document",
					"reference_doctype": doc.doctype,
					"reference_docname": doc.name,
					"timestamp": now_datetime(),
					"user": frappe.session.user,
					"data": sealed_doc,
				}
			)
			archive.flags.ignore_permissions = True
			archive.insert()
			archive.submit()
		except frappe.exceptions.LinkValidationError:
			# Don't throw if the reference has been deleted in the meantime
			pass
		except Exception:
			frappe.log_error(frappe.get_traceback(), "Document archiving error")
