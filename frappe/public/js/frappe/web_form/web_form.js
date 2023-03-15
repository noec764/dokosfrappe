frappe.provide("frappe.ui");
frappe.provide("frappe.web_form");
import EventEmitterMixin from "../../frappe/event_emitter";

export default class WebForm extends frappe.ui.FieldGroup {
	constructor(opts) {
		super();
		Object.assign(this, opts);
		frappe.web_form = this;
		frappe.web_form.events = {};
		Object.assign(frappe.web_form.events, EventEmitterMixin);
		this.current_section = 0;
		this.is_multi_step_form = false;
	}

	prepare(web_form_doc, doc) {
		Object.assign(this, web_form_doc);
		this.fields = web_form_doc.web_form_fields;
		this.doc = doc;
	}

	make() {
		this.parent.empty();
		super.make();
		this.set_page_breaks();
		this.set_field_values();

		if (this.is_new || this.in_edit_mode) {
			this.setup_primary_action();
			this.setup_discard_action();
		}

		this.setup_previous_next_button();
		this.toggle_section();

		// webform client script
		frappe.init_client_script && frappe.init_client_script();
		this.setup_listeners();
		frappe.web_form.events.trigger("after_load");
		this.after_load && this.after_load();
	}

	on(fieldname, handler) {
		let field = this.fields_dict[fieldname];
		field.df.change = () => {
			handler(field, field.value);
			this.make_form_dirty();
		};
	}

	setup_listeners() {
		// setup change event for all fields if not already set through client script
		this.fields.forEach((field) => {
			if (!field.change) {
				field.change = () => {
					this.make_form_dirty();
				};
			}
		});
	}

	make_form_dirty() {
		frappe.form_dirty = true;
		$(".indicator-pill.orange").removeClass("hide");
	}

	set_page_breaks() {
		this.page_breaks = $(".page-break");

		if (this.page_breaks.length) {
			this.page_breaks.each((i, page_break) => {
				if (!$(page_break).find("form").length) {
					$(page_break).remove();
				}
			});
		}

		this.page_breaks = $(".page-break");
		this.is_multi_step_form = !!this.page_breaks.length;
	}

	setup_previous_next_button() {
		let me = this;

		if (!me.is_multi_step_form) {
			return;
		}

		this.$next_button = $(`<button class="btn btn-default btn-next btn-sm ml-2">
			${__("Next")}
		</button>`);

		this.$previous_button = $(`<button class="btn btn-default btn-previous btn-sm">
			${__("Previous")}
		</button>`);

		this.$next_button.insertAfter(".web-form-footer .right-area .discard-btn");
		this.in_view_mode && $(".web-form-footer .right-area").append(this.$next_button);
		$(".web-form-footer .left-area").prepend(this.$previous_button);

		this.$previous_button.on("click", () => {
			/**
				The eslint utility cannot figure out if this is an infinite loop in backwards and
				throws an error. Disabling for-direction just for this section.
				for-direction doesnt throw an error if the values are hardcoded in the
				reverse for-loop, but in this case its a dynamic loop.
				https://eslint.org/docs/rules/for-direction
			*/
			/* eslint-disable for-direction */
			for (let idx = me.current_section; idx < me.sections.length; idx--) {
				let is_empty = me.is_previous_section_empty(idx);
				me.current_section =
					me.current_section > 0 ? me.current_section - 1 : me.current_section;

				if (!is_empty) {
					break;
				}
			}
			/* eslint-enable for-direction */
			me.toggle_section();
			return false;
		});

		this.$next_button.on("click", () => {
			let is_validated = me.validate_section();

			if (!is_validated) return false;

			for (let idx = me.current_section; idx < me.sections.length; idx++) {
				let is_empty = me.is_next_section_empty(idx);
				me.current_section =
					me.current_section < me.sections.length
						? me.current_section + 1
						: me.current_section;

				if (!is_empty) {
					break;
				}
			}
			me.toggle_section();
			return false;
		});
	}

	set_field_values() {
		if (this.doc.name) this.set_values(this.doc);
		else return;
	}

	set_default_values() {
		let defaults = {};
		for (let df of this.fields) {
			if (df.default) {
				defaults[df.fieldname] = df.default;
			}
		}
		let values = frappe.utils.get_query_params();
		delete values.new;
		Object.assign(defaults, values);
		return this.set_values(values);
	}

	setup_primary_action() {
		$(".web-form").on("submit", () => this.save());
	}

	setup_discard_action() {
		$(".web-form-footer .discard-btn").on("click", () => this.discard_form());
	}

	discard_form() {
		let path = window.location.href;
		// remove new or edit after last / from url
		path = path.substring(0, path.lastIndexOf("/"));

		if (frappe.form_dirty) {
			frappe.warn(
				__("Discard?"),
				__("Are you sure you want to discard the changes?"),
				() => (window.location.href = path),
				__("Discard", null, "Button in web form")
			);
		} else {
			window.location.href = path;
		}
		return false;
	}

	validate_section() {
		if (this.allow_incomplete) return true;

		let fields = $(`.form-page:eq(${this.current_section}) .form-control`);
		let errors = [];
		let invalid_values = [];

		for (let field of fields) {
			let fieldname = $(field).attr("data-fieldname");
			if (!fieldname) continue;

			field = this.fields_dict[fieldname];

			if (field.get_value) {
				let value = field.get_value();
				if (
					field.df.reqd &&
					is_null(typeof value === "string" ? strip_html(value) : value)
				)
					errors.push(__(field.df.label));

				if (
					field.df.reqd &&
					field.df.fieldtype === "Text Editor" &&
					is_null(strip_html(cstr(value)))
				)
					errors.push(__(field.df.label));

				if (field.df.invalid) invalid_values.push(__(field.df.label));
			}
		}

		const error_sections = [];

		if (errors.length) {
			error_sections.push({
				title: __("Missing values for fields", null, "Web Form"),
				message: "<ul><li>" + errors.join("<li>") + "</ul>",
			})
		}
		if (invalid_values.length) {
			error_sections.push({
				title: __("Invalid values for fields", null, "Web Form"),
				message: "<ul><li>" + invalid_values.join("<li>") + "</ul>",
			})
		}

		if (error_sections.length) {
			let title, message;
			if (error_sections.length === 1) {
				title = error_sections[0].title;
				message = error_sections[0].message;
			} else {
				title = __("Error", null, "Web Form")
				message = error_sections.map(section => {
					return `<b>${section.title}</b><br/>${section.message}`;
				}).join("<br>");
			}
			frappe.msgprint({
				title: title,
				message: message,
				indicator: "orange",
			});
		}

		return !(error_sections.length);
	}

	toggle_section() {
		if (!this.is_multi_step_form) return;

		this.render_progress_dots();
		this.toggle_previous_button();
		this.hide_form_pages();
		this.show_form_page();
		this.toggle_buttons();
	}

	render_progress_dots() {
		if (!this.is_multi_step_form) return;
		$(".center-area.paging").empty();

		if (this.in_view_mode) {
			let paging_text = __("Page {0} of {1}", [
				this.current_section + 1,
				this.page_breaks.length + 1,
			]);
			$(".center-area.paging").append(`<div>${paging_text}</div>`);
			return;
		}

		this.$slide_progress = $(`<div class="slides-progress"></div>`).appendTo(
			$(".center-area.paging")
		);
		this.$slide_progress.empty();

		if (this.page_breaks.length < 1) return;

		for (let i = 0; i <= this.page_breaks.length; i++) {
			let $dot = $(`<div class="slide-step">
				<div class="slide-step-indicator"></div>
				<div class="slide-step-complete">${frappe.utils.icon("tick", "xs")}</div>
			</div>`).attr({ "data-step-id": i });

			if (i < this.current_section) {
				$dot.addClass("step-success");
			}
			if (i === this.current_section) {
				$dot.addClass("active");
			}
			this.$slide_progress.append($dot);
		}
	}

	toggle_buttons() {
		for (let idx = this.current_section; idx <= this.page_breaks.length; idx++) {
			if (this.is_next_section_empty(idx)) {
				this.show_save_and_hide_next_button();
			} else {
				this.show_next_and_hide_save_button();
				break;
			}
		}
	}

	is_next_section_empty(section) {
		if (section + 1 > this.page_breaks.length + 1) return true;

		let _section = $(`.form-page:eq(${section + 1})`);
		let visible_controls = _section.find(".frappe-control:not(.hide-control)");

		return !visible_controls.length ? true : false;
	}

	is_previous_section_empty(section) {
		if (section - 1 > this.page_breaks.length + 1) return true;

		let _section = $(`.form-page:eq(${section - 1})`);
		let visible_controls = _section.find(".frappe-control:not(.hide-control)");

		return !visible_controls.length ? true : false;
	}

	show_save_and_hide_next_button() {
		$(".btn-next").hide();
		$(".submit-btn").show();
	}

	show_next_and_hide_save_button() {
		$(".btn-next").show();
		!this.allow_incomplete && $(".submit-btn").hide();
	}

	toggle_previous_button() {
		this.current_section == 0 ? $(".btn-previous").hide() : $(".btn-previous").show();
	}

	show_form_page() {
		$(`.form-page:eq(${this.current_section})`).show();
	}

	hide_form_pages() {
		for (let idx = 0; idx <= this.page_breaks.length; idx++) {
			if (idx !== this.current_section) {
				$(`.form-page:eq(${idx})`).hide();
			}
		}
	}

	save() {
		let is_new = this.is_new;
		let valid = this.validate && this.validate();
		if (!valid && valid !== undefined) {
			frappe.msgprint(
				__("Couldn't save, please check the data you have entered"),
				__("Validation Error")
			);
			return false;
		}

		// validation hack: get_values will check for missing data
		let doc_values = super.get_values(this.allow_incomplete);

		if (!doc_values) return false;

		if (window.saving) return false;

		Object.assign(this.doc, doc_values);
		this.doc.doctype = this.doc_type;
		this.doc.web_form_name = this.name;

		// Save
		window.saving = true;
		frappe.form_dirty = false;

		frappe.call({
			type: "POST",
			method: "frappe.website.doctype.web_form.web_form.accept",
			args: {
				data: this.doc,
				web_form: this.name,
			},
			btn: $("btn-primary"),
			freeze: true,
			callback: (response) => {
				// Check for any exception in response
				if (!response.exc) {
					// Success
					this.handle_success(response.message);
					frappe.web_form.events.trigger("after_save");
					this.after_save && this.after_save();
					// args doctype and docname added to link doctype in file manager
					if (is_new && (response.message.attachment || response.message.file)) {
						frappe.call({
							type: "POST",
							method: "frappe.handler.upload_file",
							args: {
								file_url: response.message.attachment || response.message.file,
								doctype: response.message.doctype,
								docname: response.message.name,
							},
						});
					}
				}
			},
			always: function () {
				window.saving = false;
			},
		});
		return false;
	}

	handle_success(data) {
		if (data && typeof data === "string" && data.startsWith("https://")) {
			window.location.href = data; // old style redirect
			return;
		}
		if (data && (!data.doctype) && data.redirect) {
			window.location.href = data.redirect;
			return;
		}

		if (!this.is_new) {
			$(".success-title").text(__("Updated"));
			$(".success-message").text(__("Your form has been successfully updated"));
		}

		$(".web-form-container").hide();
		$(".success-page").removeClass("hide");

		if (this.success_url) {
			frappe.utils.setup_timer(5, 0, $(".time"));
			setTimeout(() => {
				window.location.href = this.success_url;
			}, 5000);
		} else {
			this.render_success_page(data);
		}
	}

	render_success_page(data) {
		if (this.allow_edit && data.name) {
			$(".success-footer").append(`
				<a href="/${this.route}/${data.name}/edit" class="edit-button btn btn-default btn-md">
					${__("Edit your response", null, "Button in web form")}
				</a>
			`);
		}

		if (this.login_required && !this.allow_multiple && !this.show_list && data.name) {
			$(".success-footer").append(`
				<a href="/${this.route}/${data.name}" class="view-button btn btn-default btn-md">
					${__("View your response", null, "Button in web form")}
				</a>
			`);
		}
	}
}
