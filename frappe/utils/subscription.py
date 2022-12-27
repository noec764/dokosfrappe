import json

import requests

import frappe


@frappe.whitelist()
def remote_login():
	try:
		login_url = frappe.conf.subscription["login_url"]
		if login_url:
			resp = requests.post(login_url)

			if resp.status_code != 200:
				return

			return json.loads(resp.text)["message"]
	except Exception:
		return False

	return False


def enable_manage_subscription():
	if not frappe.db.exists("Navbar Item", {"item_label": "Manage Subscriptions"}):
		return

	navbar_item, hidden = frappe.db.get_value(
		"Navbar Item", {"item_label": "Manage Subscriptions"}, ["name", "hidden"]
	)

	if navbar_item and hidden and frappe.conf.subscription.get("login_url"):
		doc = frappe.get_cached_doc("Navbar Item", navbar_item)
		doc.hidden = False
		doc.save()

	elif navbar_item and not hidden and not frappe.conf.subscription.get("login_url"):
		doc = frappe.get_cached_doc("Navbar Item", navbar_item)
		doc.hidden = True
		doc.save()
