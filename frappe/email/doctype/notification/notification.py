# Copyright (c) 2021, Frappe Technologies and contributors
# License: MIT. See LICENSE
import json
import os

import frappe
from frappe import _
from frappe.core.doctype.role.role import get_info_based_on_role, get_user_info
from frappe.core.doctype.sms_settings.sms_settings import send_sms
from frappe.desk.doctype.notification_log.notification_log import enqueue_create_notification
from frappe.model.document import Document
from frappe.modules.utils import export_module_json, get_doc_module
from frappe.utils import add_to_date, cast, is_html, nowdate, validate_email_address
from frappe.utils.jinja import validate_template
from frappe.utils.safe_block_eval import safe_block_eval
from frappe.utils.safe_exec import get_safe_globals


class Notification(Document):
	# begin: auto-generated types
	# This code is auto-generated. Do not modify anything in this block.

	from typing import TYPE_CHECKING

	if TYPE_CHECKING:
		from frappe.email.doctype.notification_recipient.notification_recipient import (
			NotificationRecipient,
		)
		from frappe.types import DF

		attach_print: DF.Check
		channel: DF.Literal["Email", "External Collaboration Tool", "System Notification", "SMS"]
		condition: DF.Code | None
		date_changed: DF.Literal
		days_in_advance: DF.Int
		document_type: DF.Link
		enabled: DF.Check
		event: DF.Literal[
			"",
			"New",
			"Save",
			"Submit",
			"Cancel",
			"Days After",
			"Days Before",
			"Value Change",
			"Method",
			"Custom",
		]
		incoming_webhook_url: DF.Link | None
		is_standard: DF.Check
		message: DF.Code | None
		message_editor_type: DF.Literal["HTML Editor", "Block Editor"]
		method: DF.Data | None
		module: DF.Link | None
		print_format: DF.Link | None
		property_value: DF.Data | None
		recipients: DF.Table[NotificationRecipient]
		send_system_notification: DF.Check
		send_to_all_assignees: DF.Check
		sender: DF.Link | None
		sender_email: DF.Data | None
		set_property_after_alert: DF.Literal
		subject: DF.Data | None
		value_changed: DF.Literal
	# end: auto-generated types

	def onload(self):
		"""load message"""
		if self.is_standard and self.enabled and not frappe.conf.developer_mode:
			self.load_standard_message_content()

	def autoname(self):
		if not self.name:
			self.name = self.subject

	def validate(self):
		if self.channel in ("Email", "External Collaboration Tool", "System Notification"):
			validate_template(self.subject)

		self.validate_message_content()

		if self.event in ("Days Before", "Days After") and not self.date_changed:
			frappe.throw(_("Please specify which date field must be checked"))

		if self.event == "Value Change" and not self.value_changed:
			frappe.throw(_("Please specify which value field must be checked"))

		self.validate_forbidden_types()
		self.validate_condition()
		self.validate_standard()
		frappe.cache.hdel("notifications", self.document_type)

	def validate_message_content(self):
		if not self.message_editor_type:
			self.message_editor_type = "HTML Editor"

		if self.message_editor_type == "Block Editor":
			return  # no validation for block editor

		validate_template(self.message)

	def on_update(self):
		frappe.cache.hdel("notifications", self.document_type)
		path = export_module_json(self, self.is_standard, self.module)
		if path:
			# block editor
			if self.message_editor_type == "Block Editor":
				with open(path + ".block.json", "w") as f:
					f.write(self.message_block_editor)
				return  # don't write other files

			# html/md
			if not os.path.exists(path + ".md") and not os.path.exists(path + ".html"):
				with open(path + ".md", "w") as f:
					f.write(self.message)

			# py
			if not os.path.exists(path + ".py"):
				with open(path + ".py", "w") as f:
					f.write(
						"""import frappe

def get_context(context):
	# do your magic here
	pass
"""
					)

	def validate_standard(self):
		if (
			self.is_standard or (getattr(self, "_doc_before_save") and self._doc_before_save.is_standard)
		) and not frappe.conf.developer_mode:
			if getattr(self, "_doc_before_save") and self._doc_before_save.enabled != self.enabled:
				self.db_set("enabled", self.enabled)
				self.reload()
			else:
				frappe.throw(
					_("Cannot edit Standard Notification. To edit, please disable this and duplicate it")
				)

	def validate_condition(self):
		temp_doc = frappe.new_doc(self.document_type)
		if self.condition:
			try:
				safe_block_eval(self.condition, None, get_context(temp_doc.as_dict()))
			except Exception:
				frappe.throw(_("The Condition '{0}' is invalid").format(self.condition))

	def validate_forbidden_types(self):
		forbidden_document_types = ("Email Queue",)
		if self.document_type in forbidden_document_types or frappe.get_meta(self.document_type).istable:
			# currently notifications don't work on child tables as events are not fired for each record of child table

			frappe.throw(_("Cannot set Notification on Document Type {0}").format(self.document_type))

	def get_documents_for_today(self):
		"""get list of documents that will be triggered today"""
		docs = []

		diff_days = self.days_in_advance
		if self.event == "Days After":
			diff_days = -diff_days

		reference_date = add_to_date(nowdate(), days=diff_days)
		reference_date_start = reference_date + " 00:00:00.000000"
		reference_date_end = reference_date + " 23:59:59.000000"

		doc_list = frappe.get_all(
			self.document_type,
			fields="name",
			filters=[
				{self.date_changed: (">=", reference_date_start)},
				{self.date_changed: ("<=", reference_date_end)},
			],
		)

		for d in doc_list:
			doc = frappe.get_doc(self.document_type, d.name)

			if self.condition and not safe_block_eval(self.condition, None, get_context(doc)):
				continue

			docs.append(doc)

		return docs

	def send(self, doc):
		"""Build recipients and send Notification"""

		context = get_context(doc)
		context = {"doc": doc, "alert": self, "comments": None}
		if doc.get("_comments"):
			context["comments"] = json.loads(doc.get("_comments"))

		if self.is_standard:
			self.load_standard_properties(context)

		try:
			if self.channel == "Email":
				self.send_an_email(doc, context)

			if self.channel == "External Collaboration Tool":
				self.send_an_external_collaboration_tool_msg(doc, context)

			if self.channel == "SMS":
				self.send_sms(doc, context)

			if self.channel == "System Notification" or self.send_system_notification:
				self.create_system_notification(doc, context)

		except Exception:
			self.log_error(_("Failed to send Notification"))

		if self.set_property_after_alert:
			allow_update = True
			if (
				doc.docstatus.is_submitted()
				and not doc.meta.get_field(self.set_property_after_alert).allow_on_submit
			):
				allow_update = False

			try:
				if allow_update and not doc.flags.in_notification_update:
					fieldname = self.set_property_after_alert
					value = self.property_value
					if doc.meta.get_field(fieldname).fieldtype in frappe.model.numeric_fieldtypes:
						value = frappe.utils.cint(value)

					doc.reload()
					doc.set(fieldname, value)
					doc.flags.updater_reference = {
						"doctype": self.doctype,
						"docname": self.name,
						"label": _("via Notification"),
					}
					doc.flags.in_notification_update = True
					doc.save(ignore_permissions=True)
					doc.flags.in_notification_update = False
			except Exception:
				self.log_error(_("Document update failed"))

	def create_system_notification(self, doc, context):
		subject = self.subject
		if "{" in subject:
			subject = frappe.render_template(self.subject, context)

		attachments = self.get_attachment(doc)

		recipients, cc, bcc = self.get_list_of_recipients(doc, context)

		users = recipients + cc + bcc

		if not users:
			return

		notification_doc = {
			"type": "Alert",
			"document_type": doc.doctype,
			"document_name": doc.name,
			"subject": subject,
			"from_user": doc.modified_by or doc.owner,
			"email_content": self.render(context),
			"attached_file": attachments and json.dumps(attachments[0]),
		}
		enqueue_create_notification(users, notification_doc)

	def send_an_email(self, doc, context):
		from email.utils import formataddr

		from frappe.core.doctype.communication.email import _make as make_communication

		subject = self.subject
		if "{" in subject:
			subject = frappe.render_template(self.subject, context)

		attachments = self.get_attachment(doc)
		recipients, cc, bcc = self.get_list_of_recipients(doc, context)
		if not (recipients or cc or bcc):
			return

		sender = None
		message = self.render(context)
		if self.sender and self.sender_email:
			sender = formataddr((self.sender, self.sender_email))

		communication = None
		# Add mail notification to communication list
		# No need to add if it is already a communication.
		if doc.doctype != "Communication":
			communication = make_communication(
				doctype=doc.doctype,
				name=doc.name,
				content=message,
				subject=subject,
				sender=sender,
				recipients=recipients,
				communication_medium="Email",
				send_email=False,
				attachments=attachments,
				cc=cc,
				bcc=bcc,
				communication_type="Automated Message",
			).get("name")

		frappe.sendmail(
			recipients=recipients,
			subject=subject,
			sender=sender,
			cc=cc,
			bcc=bcc,
			message=message,
			reference_doctype=doc.doctype,
			reference_name=doc.name,
			attachments=attachments,
			expose_recipients="header",
			print_letterhead=((attachments and attachments[0].get("print_letterhead")) or False),
			communication=communication,
		)

	def make_communication_entry(self, **kwargs):
		"""Make communication entry"""
		try:
			comm = frappe.get_doc(
				{
					"doctype": "Communication",
					"communication_medium": "Email",
					"sender": kwargs.get("sender"),
					"recipients": kwargs.get("recipients"),
					"subject": kwargs.get("subject"),
					"content": kwargs.get("message"),
					"sent_or_received": "Sent",
					"reference_doctype": kwargs.get("doc", {}).get("doctype"),
					"reference_name": kwargs.get("doc", {}).get("name")
					if kwargs.get("doc", {}).get("doctype")
					else None,
				}
			).insert(ignore_permissions=True)

			return comm.name
		except Exception:
			frappe.log_error(frappe.get_traceback(), _("Notification communication creation error"))
			return

	def send_an_external_collaboration_tool_msg(self, doc, context):
		frappe.get_doc("Incoming Webhook URL", self.incoming_webhook_url).send(
			message=self.render(context),
			reference_doctype=doc.doctype,
			reference_name=doc.name,
		)

	def send_sms(self, doc, context):
		send_sms(
			receiver_list=self.get_receiver_list(doc, context),
			msg=frappe.utils.strip_html_tags(frappe.render_template(self.message, context)),
		)

	def get_list_of_recipients(self, doc, context):
		recipients = []
		cc = []
		bcc = []
		for recipient in self.recipients:
			if recipient.condition:
				if not safe_block_eval(recipient.condition, None, context):
					continue
			if recipient.receiver_by_document_field:
				fields = recipient.receiver_by_document_field.split(",")
				# fields from child table
				if len(fields) > 1:
					for d in doc.get(fields[1]):
						email_id = d.get(fields[0])
						if validate_email_address(email_id):
							recipients.append(email_id)
				# field from parent doc
				else:
					email_ids_value = doc.get(fields[0])
					if validate_email_address(email_ids_value):
						email_ids = email_ids_value.replace(",", "\n")
						recipients = recipients + email_ids.split("\n")

			cc.extend(get_emails_from_template(recipient.cc, context))
			bcc.extend(get_emails_from_template(recipient.bcc, context))

			# For sending emails to specified role
			if recipient.receiver_by_role:
				emails = get_info_based_on_role(recipient.receiver_by_role, "email", ignore_permissions=True)

				for email in emails:
					recipients = recipients + email.split("\n")

		if self.send_to_all_assignees:
			recipients = recipients + get_assignees(doc)

		return list(set(recipients)), list(set(cc)), list(set(bcc))

	def get_receiver_list(self, doc, context):
		"""return receiver list based on the doc field and role specified"""
		receiver_list = []
		for recipient in self.recipients:
			if recipient.condition:
				if not safe_block_eval(recipient.condition, None, context):
					continue

			# For sending messages to the owner's mobile phone number
			if recipient.receiver_by_document_field == "owner":
				receiver_list += get_user_info([dict(user_name=doc.get("owner"))], "mobile_no")
			# For sending messages to the number specified in the receiver field
			elif recipient.receiver_by_document_field:
				receiver_list.append(doc.get(recipient.receiver_by_document_field))

			# For sending messages to specified role
			if recipient.receiver_by_role:
				receiver_list += get_info_based_on_role(recipient.receiver_by_role, "mobile_no")

		return receiver_list

	def get_attachment(self, doc):
		"""check print settings are attach the pdf"""
		if not self.attach_print:
			return None

		print_settings = frappe.get_doc("Print Settings", "Print Settings")
		if (doc.docstatus == 0 and not print_settings.allow_print_for_draft) or (
			doc.docstatus == 2 and not print_settings.allow_print_for_cancelled
		):

			# ignoring attachment as draft and cancelled documents are not allowed to print
			status = "Draft" if doc.docstatus == 0 else "Cancelled"
			frappe.throw(
				_(
					"""Not allowed to attach {0} document, please enable Allow Print For {0} in Print Settings"""
				).format(_(status)),
				title=_("Error in Notification"),
			)
		else:
			return [
				{
					"print_format_attachment": 1,
					"doctype": doc.doctype,
					"name": doc.name,
					"print_format": self.print_format,
					"print_letterhead": print_settings.with_letterhead,
					"lang": frappe.db.get_value("Print Format", self.print_format, "default_print_language")
					if self.print_format
					else "en",
				}
			]

	def render(self, context):
		if self.message_editor_type == "Block Editor":
			from frappe.utils.block_editor import block_editor_json_to_html

			return block_editor_json_to_html(self.message_block_editor, context=context, wrap=True)

		return frappe.render_template(self.message, context)

	def get_template(self):
		module = get_doc_module(self.module, self.doctype, self.name)

		def load_template(extn):
			template = ""
			template_path = os.path.join(os.path.dirname(module.__file__), frappe.scrub(self.name) + extn)
			if os.path.exists(template_path):
				with open(template_path) as f:
					template = f.read()
			return template

		if self.message_editor_type == "Block Editor":
			return load_template(".block.json")

		return load_template(".html") or load_template(".md")

	def load_standard_properties(self, context):
		"""load templates and run get_context"""
		module = get_doc_module(self.module, self.doctype, self.name)
		if module:
			if hasattr(module, "get_context"):
				out = module.get_context(context)
				if out:
					context.update(out)

		self.load_standard_message_content()

	def load_standard_message_content(self):
		if self.message_editor_type == "Block Editor":
			self.message_block_editor = self.get_template()
		else:
			self.message = self.get_template()

			if not is_html(self.message) and self.channel != "External Collaboration Tool":
				self.message = frappe.utils.md_to_html(self.message)

	def on_trash(self):
		frappe.cache.hdel("notifications", self.document_type)


@frappe.whitelist()
def get_documents_for_today(notification):
	notification = frappe.get_doc("Notification", notification)
	notification.check_permission("read")
	return [d.name for d in notification.get_documents_for_today()]


def trigger_daily_alerts():
	trigger_notifications(None, "daily")


def trigger_notifications(doc, method=None):
	if frappe.flags.in_import or frappe.flags.in_patch:
		# don't send notifications while syncing or patching
		return

	if method == "daily":
		doc_list = frappe.get_all(
			"Notification",
			filters={"event": ("in", ("Days Before", "Days After")), "enabled": 1},
		)

		for d in doc_list:
			alert = frappe.get_doc("Notification", d.name)

			for doc in alert.get_documents_for_today():
				evaluate_alert(doc, alert, alert.event)
				frappe.db.commit()


def evaluate_alert(doc: Document, alert, event):
	from jinja2 import TemplateError

	try:
		if frappe.conf.get("mute_notifications"):
			return

		if isinstance(alert, str):
			try:
				alert = frappe.get_doc("Notification", alert)
			except frappe.exceptions.DoesNotExistError:
				# This error can happen when a notification is deleted but doctype cache is not cleared
				return

		context = get_context(doc)
		if alert.condition:
			if not safe_block_eval(alert.condition, None, context):
				return

		if event == "Value Change" and not doc.is_new():
			if not frappe.db.has_column(doc.doctype, alert.value_changed):
				alert.db_set("enabled", 0)
				alert.log_error(
					_("Notification {0} has been disabled due to missing field").format(alert.name)
				)
				return

			doc_before_save = doc.get_doc_before_save()
			field_value_before_save = doc_before_save.get(alert.value_changed) if doc_before_save else None

			fieldtype = doc.meta.get_field(alert.value_changed).fieldtype
			if cast(fieldtype, doc.get(alert.value_changed)) == cast(fieldtype, field_value_before_save):
				# value not changed
				return

		if event != "Value Change" and not doc.is_new():
			# reload the doc for the latest values & comments,
			# except for validate type event.
			doc.reload()

		alert.send(doc)
		if doc.flags.notifications_executed:
			doc.flags.notifications_executed.append(alert.name)
	except TemplateError:
		message = _("Error while evaluating Notification {0}. Please fix your template.").format(
			frappe.utils.get_link_to_form("Notification", alert.name)
		)
		frappe.throw(message, title=_("Error in Notification"))
	except Exception as e:
		title = str(e)
		message = frappe.get_traceback()
		frappe.log_error(message=message, title=title)

		msg = f"<details><summary>{title}</summary>{message}</details>"
		frappe.throw(msg, title=_("Error in Notification"))


def get_context(doc):
	return {
		"doc": doc,
		"nowdate": nowdate,
		"frappe": frappe._dict(
			utils=get_safe_globals().get("frappe").get("utils"),
			db=frappe._dict(
				get_list=get_safe_globals().get("frappe").get("db").get("get_list"),
				get_value=get_safe_globals().get("frappe").get("db").get("get_value"),
			),
		),
	}


@frappe.whitelist()
def send_test_notification(notification, document):
	alert: Notification = frappe.get_doc("Notification", notification)
	doc = frappe.get_doc(alert.document_type, document)
	alert.send(doc)


def get_assignees(doc):
	assignees = []
	assignees = frappe.get_all(
		"ToDo",
		filters={"status": "Open", "reference_name": doc.name, "reference_type": doc.doctype},
		fields=["allocated_to"],
	)

	return [d.allocated_to for d in assignees]


def get_emails_from_template(template, context):
	if not template:
		return ()

	emails = frappe.render_template(template, context) if "{" in template else template
	return filter(None, emails.replace(",", "\n").split("\n"))
