# Copyright (c) 2021, Frappe Technologies and contributors
# License: MIT. See LICENSE

import frappe
from frappe import _
from frappe.model.document import Document


class ModuleProfile(Document):
	# begin: auto-generated types
	# This code is auto-generated. Do not modify anything in this block.

	from typing import TYPE_CHECKING

	if TYPE_CHECKING:
		from frappe.core.doctype.block_module.block_module import BlockModule
		from frappe.types import DF

		block_modules: DF.Table[BlockModule]
		module_profile_name: DF.Data
	# end: auto-generated types

	def onload(self):
		# @dokos: Get modules from Workspaces
		modules = frappe.get_all(
			"Workspace",
			pluck="module",
			filters={"for_user": ""},
			distinct=1,
		)

		all_modules = [{"name": m, "label": _(m)} for m in modules if m]
		all_modules.sort(key=lambda x: x["label"])
		self.set_onload("all_modules", all_modules)
