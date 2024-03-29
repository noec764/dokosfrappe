import { createApp } from "vue";
import { bus } from "./bus";

import QuickAccessMenu from "./QuickAccessMenu.vue";

export class QuickAccessMenuSetup {
	constructor(opts = {}) {
		this.setup_menu();
		// this.setup_button()

		this.make();
	}

	make() {
		this.bind_events();
	}

	bind_events() {
		frappe.ui.keys.add_shortcut({
			shortcut: "ctrl+g",
			description: __("Open Awesomebar"),
			action: () => {
				bus.$emit("quick-access-showAt", { anchor: "center" });
			},
		});
		frappe.ui.keys.add_shortcut({
			shortcut: "ctrl+k",
			description: __("Open Awesomebar"),
			action: () => {
				bus.$emit("quick-access-showAt", { anchor: "center" });
			},
		});
	}

	setup_button() {
		const logoLink = document.querySelector("header.navbar a.navbar-home");
		if (logoLink) {
			logoLink.remove();
		}

		const btn = document.querySelector("header.navbar button.navbar-open-menu");
		if (btn) {
			const offsetX = -24;
			const offsetY = -24;
			const minX = 4;
			const minY = 4;
			btn.addEventListener("click", (e) => {
				const dx = Math.max(minX, e.clientX + offsetX);
				const dy = Math.max(minY, e.clientY + offsetY);
				bus.$emit("quick-access-showAt", { anchor: "fixed", dx, dy });
			});
		}
	}

	setup_menu() {
		this.menu = createApp(QuickAccessMenu);
		SetVueGlobals(this.menu);
		this.menu.mount("#modules-menu");

		bus.$emit("quick-access-setItems", [
			...frappe.boot.allowed_workspaces
				.map((w) => ({
					label: w.label,
					title: w.title,
					icon: w.icon,
					route: (w.public ? "/app/" : "/app/private/") + frappe.router.slug(w.name),
					color: w.color,
					public: w.public,
				}))
				.sort((a, b) => a.label.localeCompare(b.label))
				.sort((a, b) => (a.public ? 1 : -1) - (b.public ? 1 : -1)),
		]);
	}
}
