import frappe


def execute():
	frappe.reload_doc("core", "doctype", "DocType", force=True)
	categories = frappe.get_list("Blog Category")
	for category in categories:
		doc = frappe.get_doc("Blog Category", category["name"])
		doc.set_route()
		doc.save()
