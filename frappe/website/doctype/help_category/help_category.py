# Copyright (c) 2021, Frappe and contributors
# License: MIT. See LICENSE


import frappe
from frappe.website.doctype.help_article.help_article import clear_cache
from frappe.website.website_generator import WebsiteGenerator


class HelpCategory(WebsiteGenerator):
	# begin: auto-generated types
	# This code is auto-generated. Do not modify anything in this block.

	from typing import TYPE_CHECKING

	if TYPE_CHECKING:
		from frappe.types import DF

		category_description: DF.Text | None
		category_name: DF.Data
		help_articles: DF.Int
		login_required: DF.Check
		published: DF.Check
		route: DF.Data | None
	# end: auto-generated types

	website = frappe._dict(condition_field="published", page_title_field="category_name")

	def before_insert(self):
		self.published = 1

	def autoname(self):
		self.name = self.category_name

	def validate(self):
		self.set_route()

	def set_route(self):
		if not self.route:
			self.route = "kb/" + self.scrub(self.category_name)

	def on_update(self):
		clear_cache()
