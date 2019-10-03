frappe.provide('frappe.ui.misc');
frappe.ui.misc.about = function() {
	if(!frappe.ui.misc.about_dialog) {
		var d = new frappe.ui.Dialog({title: __("Your application") });

		$(d.body).html(`<div>\
		<p>${__("Open Source Applications for the Web")}</p>
		<p><i class='fa fa-globe fa-fw'></i>
			${ __("Website:") } <a href='https://dokos.io' target='_blank'>https://dokos.io</a></p>
		<p><i class='fa fa-github fa-fw'></i>
			${ __("Source:") } <a href='https://gitlab.com/dokos' target='_blank'>https://gitlab.com/dokos</a></p>
		<hr>
		<h4>${ __("Installed Apps") }</h4>
		<div id='about-app-versions'>${ __("Loading versions...") }</div>
		<hr>\
		<p class='text-muted'>&copy; Dokos SAS and contributors </p>
		</div>`);

		frappe.ui.misc.about_dialog = d;

		frappe.ui.misc.about_dialog.on_page_show = function() {
			if(!frappe.versions) {
				frappe.call({
					method: "frappe.utils.change_log.get_versions",
					callback: function(r) {
						show_versions(r.message);
					}
				})
			} else {
				show_versions(frappe.versions);
			}
		};

		var show_versions = function(versions) {
			var $wrap = $("#about-app-versions").empty();
			$.each(Object.keys(versions).sort(), function(i, key) {
				var v = versions[key];
				if(v.branch) {
					var text = $.format('<p><b>{0}:</b> v{1} ({2})<br></p>',
						[v.title, v.branch_version || v.version, v.branch])
				} else {
					var text = $.format('<p><b>{0}:</b> v{1}<br></p>',
						[v.title, v.version])
				}
				$(text).appendTo($wrap);
			});

			frappe.versions = versions;
		}

	}

	frappe.ui.misc.about_dialog.show();

}
