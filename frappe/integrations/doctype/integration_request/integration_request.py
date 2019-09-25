# -*- coding: utf-8 -*-
# Copyright (c) 2015, Frappe Technologies and contributors
# For license information, please see license.txt

from __future__ import unicode_literals
import frappe
from frappe.model.document import Document
import json

class IntegrationRequest(Document):
	def autoname(self):
		if self.flags._name:
			self.name = self.flags._name

	def update_status(self, params, status):
		data = json.loads(self.data)
		data.update(params)

		self.data = json.dumps(data)
		self.status = status
		self.save(ignore_permissions=True)
		frappe.db.commit()

	@frappe.whitelist()
	def retry_webhook(self):
		handlers = frappe.get_hooks("webhooks_handler")
		method = handlers.get(self.integration_request_service, [])
		if method:
			frappe.get_attr(method[0])(**{"doctype": "Integration Request", "docname": self.name})
