# Copyright (c) 2018, Frappe Technologies and contributors
# For license information, please see license.txt


import frappe
from frappe import _
from frappe.model.document import Document
from frappe.utils import get_url_to_form


class SlackParameters:
	@staticmethod
	def get_attachments(data, doc_url):
		data.update(
			{
				"attachments": [
					{
						"fallback": _("See the document at {0}").format(doc_url),
						"actions": [
							{
								"type": "button",
								"text": _("Go to the document"),
								"url": doc_url,
								"style": "primary",
							}
						],
					}
				]
			}
		)

	@staticmethod
	def get_error_messages():
		return {
			400: "400: Invalid Payload or User not found",
			403: "403: Action Prohibited",
			404: "404: Channel not found",
			410: "410: The Channel is Archived",
			500: "500: Rollup Error, Slack seems to be down",
		}


class RocketChatParameters:
	@staticmethod
	def get_attachments(data, doc_url):
		data.update({"attachments": [{"title": _("Document link"), "title_link": doc_url}]})

	@staticmethod
	def get_error_messages():
		return {}


class GoogleChatParameters:
	@staticmethod
	def get_attachments(data, doc_url):
		data["text"] = f'{data["text"]}\n<{doc_url}|{_("Document link")}>'

	@staticmethod
	def get_error_messages():
		return {}


class MattermostParameters:
	@staticmethod
	def get_attachments(data, doc_url):
		data["text"] = f'{data["text"]}\n<{doc_url}|{_("Document link")}>'

	@staticmethod
	def get_error_messages():
		return {}


class DiscordParameters:
	@staticmethod
	def get_attachments(data, doc_url):
		from frappe.utils.data import get_url

		data["content"] = data.pop("text")[:2000]

		data["username"] = frappe.get_website_settings("app_name")
		data["avatar_url"] = get_url(
			frappe.get_website_settings("app_logo") or "/assets/frappe/images/dokos-logo-round.png"
		)

		data["embeds"] = [{"title": _("Document link"), "url": doc_url}]

	@staticmethod
	def get_error_messages():
		return {}


class IncomingWebhookURL(Document):
	# begin: auto-generated types
	# This code is auto-generated. Do not modify anything in this block.

	from typing import TYPE_CHECKING

	if TYPE_CHECKING:
		from frappe.types import DF

		service: DF.Literal["Google Chat", "Mattermost", "Rocket.Chat", "Slack", "Discord"]
		webhook_name: DF.Data
		webhook_url: DF.SmallText
	# end: auto-generated types

	def get_service_class(self):
		try:
			return globals()[f'{"".join(e for e in self.service if e.isalnum())}Parameters']()
		except Exception:
			print(frappe.get_traceback())

	def add_attachments(self, data, reference_doctype, reference_name):
		doc_url = get_url_to_form(reference_doctype, reference_name)

		service = self.get_service_class()
		if not service:
			return

		return service.get_attachments(data, doc_url)

	def send(self, message, reference_doctype, reference_name):
		import requests

		data = {"text": message}

		self.add_attachments(data, reference_doctype, reference_name)

		r = requests.post(self.webhook_url, json=data)

		if not r.ok:
			service = self.get_service_class()
			if service and service.get_error_messages():
				err_message = service.get_error_messages().get(r.status_code, r.status_code)
			else:
				err_message = f"{r.status_code}: {r.text}"

			frappe.log_error(err_message, _("{0} Webhook Error").format(self.service))
			return "error"

		return "success"
