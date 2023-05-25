frappe.provide("frappe.setup");
frappe.provide("frappe.setup.events");
frappe.provide("frappe.ui");

frappe.setup = {
	slides: [],
	events: {},
	data: {},
	utils: {},
	domains: [],

	on: function (event, fn) {
		if (!frappe.setup.events[event]) {
			frappe.setup.events[event] = [];
		}
		frappe.setup.events[event].push(fn);
	},

	add_slide: function (slide) {
		frappe.setup.slides.push(slide);
	},

	remove_slide: function (slide_name) {
		frappe.setup.slides = frappe.setup.slides.filter((slide) => slide.name !== slide_name);
	},

	run_event: function (event) {
		$.each(frappe.setup.events[event] || [], function (i, fn) {
			fn();
		});
	},
};

// Frappe slides settings
// ======================================================

frappe.setup.get_slides_settings = () => [
	{
		// Welcome slide
		name: "welcome",
		title: __("Welcome!"),

		fields: [
			{
				fieldname: "language",
				label: __("Your Language"),
				fieldtype: "Autocomplete",
				placeholder: __("Select Language"),
				default: "English",
				reqd: 1,
			},
			{
				fieldname: "country",
				label: __("Your Country"),
				fieldtype: "Autocomplete",
				placeholder: __("Select Country"),
				reqd: 1,
			},
			{
				fieldtype: "Section Break",
			},
			{
				fieldname: "timezone",
				label: __("Time Zone"),
				placeholder: __("Select Time Zone"),
				fieldtype: "Select",
				reqd: 1,
			},
			{
				fieldtype: "Column Break",
			},
			{
				fieldname: "currency",
				label: __("Currency"),
				placeholder: __("Select Currency"),
				fieldtype: "Select",
				reqd: 1,
			},
			{
				fieldtype: "Section Break",
			},
			{
				fieldname: "enable_telemetry",
				label: __("Allow Sending Usage Data for Improving Applications"),
				fieldtype: "Check",
				default: 1,
			},
		],

		onload: function (slide) {
			if (frappe.setup.data.regional_data) {
				this.setup_fields(slide);
			} else {
				frappe.setup.utils.load_regional_data(slide, this.setup_fields);
			}

			if (!slide.get_value("language")) {
				let session_language =
					frappe.setup.utils.get_language_name_from_code(
						frappe.boot.lang || navigator.language
					) || "English";
				let language_field = slide.get_field("language");

				language_field.set_input(session_language);
				if (!frappe.setup._from_load_messages) {
					language_field.$input.trigger("change");
				}
				delete frappe.setup._from_load_messages;
				moment.locale(frappe.boot.lang || navigator.language || "en");
			}
			frappe.setup.utils.bind_region_events(slide);
			frappe.setup.utils.bind_language_events(slide);
		},

		setup_fields: function (slide) {
			frappe.setup.utils.setup_region_fields(slide);
			frappe.setup.utils.setup_language_field(slide);
		},
	},

	{
		// Profile slide
		name: "user",
		title: __("Let's set up your account"),
		icon: "far fa-user",
		fields: [
			{
				fieldname: "full_name",
				label: __("Full Name"),
				fieldtype: "Data",
				reqd: 1,
			},
			{
				fieldname: "email",
				label: __("Email Address (Will be your login ID)"),
				fieldtype: "Data",
				options: "Email",
			},
			{
				fieldname: "password",
				label: __("Password"),
				fieldtype: "Password",
			},
		],
		onload: function (slide) {
			if (frappe.session.user !== "Administrator") {
				slide.form.fields_dict.email.$wrapper.toggle(false);
				slide.form.fields_dict.password.$wrapper.toggle(false);

				// remove password field
				delete slide.form.fields_dict.password;

				if (frappe.boot.user.first_name || frappe.boot.user.last_name) {
					slide.form.fields_dict.full_name.set_input(
						[frappe.boot.user.first_name, frappe.boot.user.last_name].join(" ").trim()
					);
				}
				delete slide.form.fields_dict.email;
			} else {
				slide.form.fields_dict.email.df.reqd = 1;
				slide.form.fields_dict.email.refresh();
				slide.form.fields_dict.password.df.reqd = 1;
				slide.form.fields_dict.password.refresh();

				frappe.setup.utils.load_user_details(slide, this.setup_fields);
			}
		},

		setup_fields: function (slide) {
			if (frappe.setup.data.full_name) {
				slide.form.fields_dict.full_name.set_input(frappe.setup.data.full_name);
			}
			if (frappe.setup.data.email) {
				let email = frappe.setup.data.email;
				slide.form.fields_dict.email.set_input(email);
			}
		},
	},
];

frappe.pages["setup-wizard"].on_page_load = function (wrapper) {
	const $wrapper = $(wrapper);
	$wrapper.css({
		height: "80vh",
		display: "flex",
		flexDirection: "column",
		justifyContent: "center",
	});

	let requires = frappe.boot.setup_wizard_requires || [];
	frappe.require(requires, function () {
		frappe.call({
			method: "frappe.desk.page.setup_wizard.setup_wizard.load_languages",
			freeze: true,
			callback: function (r) {
				frappe.setup.data.lang = r.message;

				frappe.setup.run_event("before_load");
				let wizard_settings = {
					parent: wrapper,
					values: { language: frappe.setup.data.default_language || "English" },
					slides: frappe.setup.slides,
					slide_class: frappe.setup.SetupWizardSlide,
					unidirectional: 1,
					done_state: 1,
				};
				frappe.wizard = new frappe.setup.SetupWizard(wizard_settings);
				frappe.setup.run_event("after_load");
				// frappe.wizard.values = test_values_edu;
				frappe.wizard.show_slide(cint(frappe.get_route()[1]));
			},
		});
	});
};

frappe.pages["setup-wizard"].on_page_show = function () {
	frappe.wizard && frappe.wizard.show_slide(cint(frappe.get_route()[1]));
};

frappe.setup.on("before_load", function () {
	// load slides
	frappe.setup.get_slides_settings().forEach((s) => {
		if (!(s.name === "user" && frappe.boot.developer_mode)) {
			// if not user slide with developer mode
			frappe.setup.add_slide(s);
		}
	});
});

frappe.setup.SetupWizard = class SetupWizard extends frappe.ui.Slides {
	constructor(args) {
		Object.assign(args, { page_name: "setup-wizard" });
		super(args);

		frappe.set_route("setup-wizard/0");
	}

	make() {
		super.make();
		this.$container.addClass("setup-wizard-slide with-form");
		this.setup_keyboard_nav();
	}

	show_slide(id) {
		super.show_slide(id);
		frappe.set_route(this.page_name, cstr(id));
	}

	translate_buttons() {
		this.text_complete_btn = __("Complete Setup");
		this.text_next_btn = __("Next");
		this.text_prev_btn = __("Previous");

		this.$complete_btn.text(this.text_complete_btn);
		this.$next_btn.text(this.text_next_btn);
		this.$prev_btn.text(this.text_prev_btn);
	}

	refresh_slides() {
		// For Translations, etc.
		if (this.in_refresh_slides || this.current_slide.has_errors(true)) {
			return;
		}
		this.in_refresh_slides = true;

		this.translate_buttons();
		this.update_values();
		frappe.setup.slides = [];
		frappe.setup.run_event("before_load");

		frappe.setup.slides = this.get_setup_slides_filtered_by_domain();

		this.slide_settings = frappe.setup.slides;

		frappe.setup.run_event("after_load");

		// re-render all slide, only remake made slides
		this.slide_instances.forEach((slide, id) => {
			if (slide.made) {
				slide.destroy();
				if (slide.$wrapper) {
					slide.$wrapper.remove();
				}
			}
		});
		this.slide_instances = [];

		this.setup();

		this.current_slide = null;
		this.show_slide(this.current_id);
		setTimeout(() => {
			this.$container.find(".form-control").first().focus();
		}, 200);
		this.in_refresh_slides = false;
	}

	on_complete() {
		frappe.telemetry.capture("initated_client_side", "setup");
		if (this.current_slide.has_errors()) return;
		this.update_values();
		this.show_working_state();
		this.disable_keyboard_nav();
		this.listen_for_setup_stages();

		return frappe.call({
			method: "frappe.desk.page.setup_wizard.setup_wizard.setup_complete",
			args: { args: this.values },
			callback: (r) => {
				if (r.message.status === "ok") {
					this.post_setup_success();
				} else if (r.message.status === "registered") {
					this.update_setup_message(__("starting the setup..."));
				} else if (r.message.fail !== undefined) {
					this.abort_setup(r.message.fail);
				}
			},
			error: () => this.abort_setup(__("Error in setup")),
		});
	}

	post_setup_success() {
		this.set_setup_complete_message(__("Setup Complete"), __("Refreshing..."));
		if (frappe.setup.welcome_page) {
			localStorage.setItem("session_last_route", frappe.setup.welcome_page);
		}
		setTimeout(function () {
			// Reload
			window.location.href = "/app";
		}, 2000);
	}

	abort_setup(fail_msg) {
		this.$working_state.find(".state-icon-container").html("");
		fail_msg = fail_msg ? fail_msg : __("Failed to complete setup");

		this.update_setup_message(__("Could not start up:") + " " + fail_msg);

		this.$working_state.find(".title").html("Setup failed");

		this.$abort_btn.show();
	}

	listen_for_setup_stages() {
		frappe.realtime.on("setup_task", (data) => {
			// console.log('data', data);
			if (data.stage_status) {
				// .html('Process '+ data.progress[0] + ' of ' + data.progress[1] + ': ' + data.stage_status);
				this.update_setup_message(data.stage_status);
				this.set_setup_load_percent(((data.progress[0] + 1) / data.progress[1]) * 100);
			}
			if (data.fail_msg) {
				this.abort_setup(data.fail_msg);
			}
			if (data.status === "ok") {
				this.post_setup_success();
			}
		});
	}

	update_setup_message(message) {
		this.$working_state.find(".setup-message").html(message);
	}

	get_setup_slides_filtered_by_domain() {
		let filtered_slides = [];
		frappe.setup.slides.forEach(function (slide) {
			if (frappe.setup.domains) {
				let active_domains = frappe.setup.domains;
				if (
					!slide.domains ||
					slide.domains.filter((d) => active_domains.includes(d)).length > 0
				) {
					filtered_slides.push(slide);
				}
			} else {
				filtered_slides.push(slide);
			}
		});
		return filtered_slides;
	}

	show_working_state() {
		this.$container.hide();
		this.$slide_progress.hide();
		// frappe.set_route(this.page_name);

		this.$working_state = this.get_message(
			__("Setting up your system"),
			__("Starting Dodock ...")
		).appendTo(this.parent);

		this.set_setup_load_percent(0);
		this.attach_abort_button();

		if (this.current_slide) {
			this.current_slide.hide_slide();
		}
		this.current_id = this.slide_settings.length;
		this.current_slide = null;
	}

	attach_abort_button() {
		this.$abort_btn = $(
			`<button class='btn btn-secondary btn-xs btn-abort text-muted'>${__("Retry")}</button>`
		);
		this.$working_state.find(".content").append(this.$abort_btn);

		this.$abort_btn.on("click", () => {
			$(this.parent).find(".setup-in-progress").remove();
			for (const s of this.slide_instances) {
				s.done = false;
			}
			this.render_progress_dots();
			this.show_slide(0);
			this.$slide_progress.show();
			this.$container.show();
			// frappe.set_route(this.page_name, this.slide_settings.length - 1);
		});

		this.$abort_btn.hide();
	}

	get_message(title, message = "") {
		const loading_html = `<div class="progress-chart">
			<div class="progress">
				<div class="progress-bar"></div>
			</div>
			<style>
				@keyframes progress-bar-stripes {
					50% { opacity: .3; }
				}
				.progress-chart--pending .progress {
					--a: var(--primary);
					background: var(--a);
					animation: progress-bar-stripes 3s linear infinite;
				}
				@media not (prefers-reduced-motion: reduce) {
					@keyframes progress-bar-stripes {
						to { transform: translateX(37px); }
					}
					.progress-chart--pending {
						overflow: hidden;
						border-radius: var(--border-radius);
					}
					.progress-chart--pending .progress {
						margin-left: -37px;
						--b: rgba(255, 255, 255, 0.3);
						background-image: repeating-linear-gradient(65deg, var(--a) 0px, var(--b) 1px, var(--b) 8px, var(--a) 9px, var(--a) 17px);
						animation-duration: 0.8s;
					}
				}
			</style>
		</div>`;

		return $(`<div class="mx-auto slides-default-style slides-wrapper setup-wizard-slide setup-in-progress">
			<div class="content text-center">
				<h1 class="slide-title title">${title}</h1>
				<div class="state-icon-container">${loading_html}</div>
				<p class="setup-message text-muted">${message}</p>
			</div>
		</div>`);
	}

	set_setup_complete_message(title, message) {
		this.$working_state.find(".title").html(title);
		this.$working_state.find(".setup-message").html(message);
		this.set_setup_load_percent(100);
	}

	set_setup_load_percent(percent) {
		this.$working_state
			.find(".progress-chart")
			.toggleClass("progress-chart--pending", percent <= 0);
		this.$working_state.find(".progress-bar").css({ width: percent + "%" });
	}
};

frappe.setup.SetupWizardSlide = class SetupWizardSlide extends frappe.ui.Slide {
	make() {
		super.make();
		this.setup_telemetry_events();
	}

	setup_telemetry_events() {
		let me = this;
		this.fields.filter(frappe.model.is_value_type).forEach((field) => {
			me.get_input(field.fieldname).on("change", function () {
				frappe.telemetry.capture(`${field.fieldname}_set`, "setup");
				if (field.fieldname == "enable_telemetry" && !me.get_value("enable_telemetry")) {
					frappe.telemetry.disable();
				}
			});
		});
	}
};

frappe.setup.utils = {
	load_regional_data: function (slide, callback) {
		frappe.call({
			method: "frappe.geo.country_info.get_country_timezone_info",
			callback: function (data) {
				frappe.setup.data.regional_data = data.message;
				callback(slide);
			},
		});
	},

	load_user_details: function (slide, callback) {
		frappe.call({
			method: "frappe.desk.page.setup_wizard.setup_wizard.load_user_details",
			freeze: true,
			callback: function (r) {
				frappe.setup.data.full_name = r.message.full_name;
				frappe.setup.data.email = r.message.email;
				callback(slide);
			},
		});
	},

	setup_language_field: function (slide) {
		let language_field = slide.get_field("language");
		language_field.df.options = frappe.setup.data.lang.languages;
		language_field.set_options();
	},

	setup_region_fields: function (slide) {
		/*
			Set a slide's country, timezone and currency fields
		*/
		let data = frappe.setup.data.regional_data;
		let country_field = slide.get_field("country");
		let translated_countries = [];

		Object.keys(data.country_info)
			.sort()
			.forEach((country) => {
				translated_countries.push({
					label: __(country),
					value: country,
				});
			});

		country_field.set_data(translated_countries);

		slide
			.get_input("currency")
			.empty()
			.add_options(
				frappe.utils.unique($.map(data.country_info, (opts) => opts.currency).sort())
			);

		slide.get_input("timezone").empty().add_options(data.all_timezones);

		// set values if present
		if (frappe.wizard.values.country) {
			country_field.set_input(frappe.wizard.values.country);
		} else if (data.default_country) {
			country_field.set_input(data.default_country);
		}

		slide.get_field("currency").set_input(frappe.wizard.values.currency);
		slide.get_field("timezone").set_input(frappe.wizard.values.timezone);
	},

	get_language_name_from_code: function (language_code) {
		return frappe.setup.data.lang.codes_to_names[language_code] || "English";
	},

	bind_language_events: function (slide) {
		slide
			.get_input("language")
			.unbind("change")
			.on("change", function () {
				clearTimeout(slide.language_call_timeout);
				slide.language_call_timeout = setTimeout(() => {
					let lang = $(this).val() || "English";
					frappe._messages = {};
					frappe.call({
						method: "frappe.desk.page.setup_wizard.setup_wizard.load_messages",
						freeze: true,
						args: {
							language: lang,
						},
						callback: function () {
							frappe.setup._from_load_messages = true;
							frappe.wizard.refresh_slides();
						},
					});
				}, 500);
			});
	},

	bind_region_events: function (slide) {
		/*
			Bind a slide's country, timezone and currency fields
		*/
		slide.get_input("country").on("change", function () {
			let country = slide.get_input("country").val();
			let $timezone = slide.get_input("timezone");
			let data = frappe.setup.data.regional_data;

			$timezone.empty();

			if (!country) return;
			// add country specific timezones first
			const timezone_list = data.country_info[country].timezones || [];
			$timezone.add_options(timezone_list.sort());
			slide.get_field("currency").set_input(data.country_info[country].currency);
			slide.get_field("currency").$input.trigger("change");

			// add all timezones at the end, so that user has the option to change it to any timezone
			$timezone.add_options(data.all_timezones);

			slide.get_field("timezone").set_input($timezone.val());

			// temporarily set date format
			frappe.boot.sysdefaults.date_format =
				data.country_info[country].date_format || "dd-mm-yyyy";
		});

		slide.get_input("currency").on("change", function () {
			let currency = slide.get_input("currency").val();
			if (!currency) return;
			frappe.model.with_doc("Currency", currency, function () {
				frappe.provide("locals.:Currency." + currency);
				let currency_doc = frappe.model.get_doc("Currency", currency);
				let number_format = currency_doc.number_format;
				if (number_format === "#.###") {
					number_format = "#.###,##";
				} else if (number_format === "#,###") {
					number_format = "#,###.##";
				}

				frappe.boot.sysdefaults.number_format = number_format;
				locals[":Currency"][currency] = $.extend({}, currency_doc);
			});
		});
	},
};
