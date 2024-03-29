// Copyright (c) 2023, Dokos SAS and Contributors
// See license.txt

import { Calendar } from "@fullcalendar/core";
import timeGridPlugin from "@fullcalendar/timegrid";
import listPlugin from "@fullcalendar/list";
import interactionPlugin from "@fullcalendar/interaction";
import dayGridPlugin from "@fullcalendar/daygrid";

const typecheck = (check, msg) => {
	if (!check) {
		throw new TypeError(msg);
	}
};

// You need to import the CSS for each plugin, thus simply import this whole file and use frappe.ui.BaseWebCalendar
/* noexport */ class BaseWebCalendar {
	/**
	 * @param {object} options
	 * @param {HTMLElement} options.wrapper
	 */
	constructor(options = {}) {
		Object.assign(this, options);
		typecheck(
			this.wrapper instanceof HTMLElement,
			"BaseWebCalendar: option `wrapper` must be an HTMLElement"
		);

		// Check that the methods are implemented
		if (this.getEvents === BaseWebCalendar.prototype.getEvents) {
			throw new Error(
				"BaseWebCalendar: getEvents(info, [callback]): Promise<Array> | Array must be implemented"
			);
		}

		this.locale = this.get_locale();
		this.all_events = [];

		this.options = options;
		this.init(options);
		this.render();
	}

	init() {}

	/**
	 * @param {*} info
	 * @param {*} callback
	 */
	getEvents(info, callback) {}

	onEventsUpdated(events) {
		this.set_min_max_times({ min: "09:00:00", max: "17:00:00" });
	}

	onEventClick(info) {}

	onDateClick(info) {}

	onDatesSet(info) {}

	refetchEvents() {
		this.fullCalendar?.refetchEvents();
	}

	refresh() {
		this.refetchEvents();
	}

	render() {
		this.wrapper.innerHTML = "";
		this.calendar_element = document.createElement("div");
		this.calendar_element.classList.add("base-web-calendar");
		this.wrapper.appendChild(this.calendar_element);

		const calendar_options = this.calendar_options();
		this.fullCalendar = new Calendar(this.calendar_element, calendar_options);
		this.fullCalendar.render();
	}

	get_header_toolbar() {
		return {
			left: frappe.is_mobile() ? "listWeek,listDay" : "dayGridMonth,timeGridWeek,listDay",
			center: frappe.is_mobile() ? "" : "prev,title,next",
			right: frappe.is_mobile() ? "prev,title,next" : "today",
		};
	}

	set_min_max_times(opts = {}) {
		const events = this.all_events || [];

		const minTimes = [];
		const maxTimes = [];
		for (const event of events) {
			if (!event.allDay) {
				minTimes.push(this.format_hms(event.start));
				maxTimes.push(this.format_hms(event.end));
			}
		}

		if (opts.min) {
			minTimes.push(opts.min);
		}
		if (opts.max) {
			maxTimes.push(opts.max);
		}

		const roundTime = (time, func = Math.round) => {
			let [hour, minute] = time.split(":");
			minute = func(minute / 15) * 15;
			if (minute === 60) {
				hour++;
				minute = 0;
			}
			hour = hour.toString().padStart(2, "0");
			minute = minute.toString().padStart(2, "0");
			return `${hour}:${minute}:00`;
		};

		if (minTimes.length) {
			const minTime = minTimes.sort()[0];
			this.set_option("slotMinTime", roundTime(minTime, Math.floor));
		}
		if (maxTimes.length) {
			const maxTime = maxTimes.sort()[maxTimes.length - 1];
			this.set_option("slotMaxTime", roundTime(maxTime, Math.ceil));
		}
	}

	set_option(option, value) {
		this.fullCalendar?.setOption(option, value);
	}

	get_option(option) {
		return this.fullCalendar?.getOption(option);
	}

	destroy() {
		this.fullCalendar?.destroy();
		this.fullCalendar = null;
	}

	format_ymd(date) {
		return moment(date).format("YYYY-MM-DD");
	}

	format_hms(date) {
		return moment(date).format("HH:mm:ss");
	}

	/**
	 * @param {"loading" | "longloading" | "done"} type
	 */
	set_loading_state(state) {
		if (state === "loading") {
			this.calendar_element.setAttribute("loading", "loading");
			// frappe.show_progress(__('Loading...'), 0);
			// frappe.freeze(__("Please wait...", null, "Web calendar"));
		} else if (state === "done") {
			this.calendar_element.removeAttribute("loading");
			// frappe.show_progress(__('Loading...'), 100, 100, undefined, true);
			// frappe.unfreeze()
		}
	}

	get_initial_date() {
		return moment().format("YYYY-MM-DD");
	}

	get_initial_display_view() {
		return frappe.is_mobile() ? "listDay" : "timeGridWeek";
	}

	get_plugins() {
		return [timeGridPlugin, listPlugin, interactionPlugin, dayGridPlugin];
	}

	get_time_zone() {
		return frappe.boot.timeZone || "UTC";
	}

	get_first_day() {
		return frappe.datetime.get_first_day_of_the_week_index();
	}

	get_locale() {
		return frappe.get_cookie("preferred_language") || frappe.boot.lang || "en";
	}

	calendar_options() {
		return {
			// Interface
			plugins: this.get_plugins(),
			initialView: this.get_initial_display_view(),
			contentHeight: "auto",
			headerToolbar: this.get_header_toolbar(),
			buttonText: {
				today: __("Today"),
				month: __("Month"),
				week: __("Week"),
				day: __("Day"),
				resourceTimeGridDay: __("Vertical"),
			},

			// Display
			weekends: true,
			showNonCurrentDates: true,
			displayEventTime: false,
			editable: false,
			selectable: false,

			locale: this.get_locale(),
			firstDay: this.get_first_day(),
			timeZone: this.get_time_zone(),
			initialDate: this.get_initial_date(),

			allDayContent: __("All Day"),
			noEventsContent: __("No events to display"),

			selectAllow: this.getSelectAllow?.bind(this),
			validRange: this.getValidRange?.bind(this),

			// Loading and interaction
			dateClick: (info) => {
				this.onDateClick(info);
			},
			eventClick: (info) => {
				this.onEventClick(info);
			},
			datesSet: (info) => {
				this.onDatesSet(info);
			},
			events: async (info, callback) => {
				this.set_loading_state("loading");

				const apply = (events) => {
					this.all_events = events;
					this.onEventsUpdated(events);
					callback(events);
					this.set_loading_state("done");
				};

				const result = await this.getEvents(info, apply);
				apply(result);
			},
			eventClassNames: "base-web-calendar__event",
		};
	}
}

frappe.provide("frappe.ui");
frappe.ui.BaseWebCalendar = BaseWebCalendar;
