frappe.email_defaults = {
	GMail: {
		email_server: "imap.gmail.com",
		incoming_port: 993,
		use_ssl: 1,
		enable_outgoing: 1,
		smtp_server: "smtp.gmail.com",
		smtp_port: 587,
		use_tls: 1,
		use_imap: 1,
	},
	"Outlook.com": {
		email_server: "imap-mail.outlook.com",
		use_ssl: 1,
		enable_outgoing: 1,
		smtp_server: "smtp-mail.outlook.com",
		smtp_port: 587,
		use_tls: 1,
		use_imap: 1,
	},
	Sendgrid: {
		enable_outgoing: 1,
		smtp_server: "smtp.sendgrid.net",
		smtp_port: 587,
		use_tls: 1,
	},
	SparkPost: {
		enable_incoming: 0,
		enable_outgoing: 1,
		smtp_server: "smtp.sparkpostmail.com",
		smtp_port: 587,
		use_tls: 1,
	},
	"Yahoo Mail": {
		email_server: "imap.mail.yahoo.com",
		use_ssl: 1,
		enable_outgoing: 1,
		smtp_server: "smtp.mail.yahoo.com",
		smtp_port: 587,
		use_tls: 1,
		use_imap: 1,
	},
	"Yandex.Mail": {
		email_server: "imap.yandex.com",
		use_ssl: 1,
		enable_outgoing: 1,
		smtp_server: "smtp.yandex.com",
		smtp_port: 587,
		use_tls: 1,
		use_imap: 1,
	},
};

frappe.email_defaults_pop = {
	GMail: {
		email_server: "pop.gmail.com",
	},
	"Outlook.com": {
		email_server: "pop3-mail.outlook.com",
	},
	"Yahoo Mail": {
		email_server: "pop.mail.yahoo.com",
	},
	"Yandex.Mail": {
		email_server: "pop.yandex.com",
	},
};

function oauth_access(frm) {
	return frappe.call({
		method: "frappe.email.oauth.oauth_access",
		args: {
			email_account: frm.doc.name,
			service: frm.doc.service || "",
		},
		callback: function (r) {
			if (!r.exc) {
				window.open(r.message.url, "_self");
			}
		},
	});
}

function set_default_max_attachment_size(frm, field) {
	if (frm.doc.__islocal && !frm.doc[field]) {
		frappe.call({
			method: "frappe.core.api.file.get_max_file_size",
			callback: function (r) {
				if (!r.exc) {
					frm.set_value(field, Number(r.message) / (1024 * 1024));
				}
			},
		});
	}
}

frappe.ui.form.on("Email Account", {
	service: function (frm) {
		$.each(frappe.email_defaults[frm.doc.service], function (key, value) {
			frm.set_value(key, value);
		});
		if (!frm.doc.use_imap) {
			$.each(frappe.email_defaults_pop[frm.doc.service], function (key, value) {
				frm.set_value(key, value);
			});
		}
		frm.events.show_gmail_message_for_less_secure_apps(frm);
		frm.events.toggle_auth_method(frm);
	},

	use_imap: function (frm) {
		if (!frm.doc.use_imap) {
			$.each(frappe.email_defaults_pop[frm.doc.service], function (key, value) {
				frm.set_value(key, value);
			});
		} else {
			$.each(frappe.email_defaults[frm.doc.service], function (key, value) {
				frm.set_value(key, value);
			});
		}
	},

	enable_incoming: function (frm) {
		frm.trigger("warn_autoreply_on_incoming");
	},

	enable_auto_reply: function (frm) {
		frm.trigger("warn_autoreply_on_incoming");
	},

	notify_if_unreplied: function (frm) {
		frm.set_df_property("send_notification_to", "reqd", frm.doc.notify_if_unreplied);
	},

	onload: function (frm) {
		if (frappe.utils.get_query_params().successful_authorization === "1") {
			frappe.show_alert(__("Successfully Authorized"));
			// FIXME: find better alternative
			window.history.replaceState(null, "", window.location.pathname);
		}

		frm.set_df_property("append_to", "only_select", true);
		frm.set_query(
			"append_to",
			"frappe.email.doctype.email_account.email_account.get_append_to"
		);
		frm.set_query("append_to", "imap_folder", function () {
			return {
				query: "frappe.email.doctype.email_account.email_account.get_append_to",
			};
		});
		if (frm.doc.__islocal) {
			frm.add_child("imap_folder", { folder_name: "INBOX" });
			frm.refresh_field("imap_folder");
		}
		frm.toggle_display(["auth_method"], frm.doc.service === "GMail");
		set_default_max_attachment_size(frm, "attachment_limit");
	},

	refresh: function (frm) {
		frm.events.enable_incoming(frm);
		frm.events.notify_if_unreplied(frm);
		frm.events.show_gmail_message_for_less_secure_apps(frm);
		frm.events.show_oauth_authorization_message(frm);

		if (frappe.route_flags.delete_user_from_locals && frappe.route_flags.linked_user) {
			delete frappe.route_flags.delete_user_from_locals;
			delete locals["User"][frappe.route_flags.linked_user];
		}
	},

	after_save(frm) {
		if (frm.doc.auth_method === "OAuth" && !frm.doc.refresh_token) {
			oauth_access(frm);
		}
	},

	toggle_auth_method: function (frm) {
		if (frm.doc.service !== "GMail") {
			frm.toggle_display(["auth_method"], false);
			frm.doc.auth_method = "Basic";
		} else {
			frm.toggle_display(["auth_method"], true);
		}
	},

	show_gmail_message_for_less_secure_apps: function (frm) {
		frm.dashboard.clear_headline();
		let msg = __(
			"GMail will only work if you enable 2-step authentication and use app-specific password or use OAuth."
		);
		msg += " "
		let cta = __("Read the step by step guide here.");
		msg += __(
			`<a target="_blank" href="https://support.google.com/mail/answer/185833?hl=en">${cta}</a>`
		);
		if (frm.doc.service === "GMail") {
			frm.dashboard.set_headline_alert(msg);
		}
	},

	show_oauth_authorization_message(frm) {
		if (frm.doc.auth_method === "OAuth" && !frm.doc.refresh_token) {
			let msg = __(
				'OAuth has been enabled but not authorised. Please use "Authorise API Access" button to do the same.'
			);
			frm.dashboard.clear_headline();
			frm.dashboard.set_headline_alert(msg, "yellow");
		}
	},

	authorize_api_access: function (frm) {
		oauth_access(frm);
	},

	domain: frappe.utils.debounce((frm) => {
		if (frm.doc.domain) {
			frappe.call({
				method: "get_domain_values",
				doc: frm.doc,
				args: {
					domain: frm.doc.domain,
				},
				callback: function (r) {
					if (!r.exc) {
						for (let field in r.message) {
							frm.set_value(field, r.message[field]);
						}
					}
				},
			});
		}
	}),

	email_sync_option: function (frm) {
		// confirm if the ALL sync option is selected

		if (frm.doc.email_sync_option == "ALL") {
			var msg = __(
				"You are selecting Sync Option as ALL, It will resync all read as well as unread message from server. This may also cause the duplication of Communication (emails)."
			);
			frappe.confirm(msg, null, function () {
				frm.set_value("email_sync_option", "UNSEEN");
			});
		}
	},

	warn_autoreply_on_incoming: function (frm) {
		if (frm.doc.enable_incoming && frm.doc.enable_auto_reply && frm.doc.__islocal) {
			var msg = __(
				"Enabling auto reply on an incoming email account will send automated replies to all the synchronized emails. Do you wish to continue?"
			);
			frappe.confirm(msg, null, function () {
				frm.set_value("enable_auto_reply", 0);
				frappe.show_alert({ message: __("Disabled Auto Reply"), indicator: "blue" });
			});
		}
	},
});
