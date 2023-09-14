// Copyright (c) 2019, Frappe Technologies and contributors
// For license information, please see license.txt

frappe.ui.form.on("Google Calendar", {
	refresh: function (frm) {
		frm.trigger("setup_reference_options");

		if (frm.is_new()) {
			frm.dashboard.set_headline(
				__("To use Google Calendar, enable {0}.", [
					`<a href='/app/google-settings'>${__("Google Settings")}</a>`,
				])
			);
		}

		frappe.realtime.on("import_google_calendar", (data) => {
			if (data.progress) {
				frm.dashboard.show_progress(
					"Syncing Google Calendar",
					(data.progress / data.total) * 100,
					__("Syncing {0} of {1}", [data.progress, data.total])
				);
				if (data.progress === data.total) {
					frm.dashboard.hide_progress("Syncing Google Calendar");
				}
			}
		});

		if (frm.doc.refresh_token) {
			frm.add_custom_button(__("Sync Calendar"), function () {
				frappe.show_alert({
					indicator: "green",
					message: __("Syncing"),
				});
				frappe
					.call({
						method: "frappe.integrations.doctype.google_calendar.google_calendar.sync",
						args: {
							g_calendar: frm.doc.name,
						},
					})
					.then((r) => {
						frappe.hide_progress();
						frappe.msgprint(r.message);
					});
			}, __("Actions"));
		}

		if (frm.doc.next_sync_token) {
			frm.add_custom_button(__("Reset the synchronization settings"), function () {
				frm.set_value("next_sync_token", null)
				frappe.show_alert({
					indicator: "green",
					message: __("Please save this document to reset the synchronization token"),
				});
			}, __("Actions"));
		}
	},
	authorize_google_calendar_access: function (frm) {
		let reauthorize = 0;
		if (frm.doc.authorization_code) {
			reauthorize = 1;
		}

		frappe.call({
			method: "frappe.integrations.doctype.google_calendar.google_calendar.authorize_access",
			args: {
				g_calendar: frm.doc.name,
				reauthorize: reauthorize,
			},
			callback: function (r) {
				if (!r.exc) {
					frm.save();
					window.open(r.message.url);
				}
			},
		});
	},
	setup_reference_options(frm) {
		frappe
			.xcall(
				"frappe.integrations.doctype.google_calendar.google_calendar.get_reference_options"
			)
			.then((r) => {
				frm.fields_dict.reference_document.df.options = r;
				frm.refresh_field("reference_document");
			});
	},
});
