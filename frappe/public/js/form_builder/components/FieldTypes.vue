<script setup>
import SearchBox from "./SearchBox.vue";
import draggable from "vuedraggable";
import { ref, computed } from "vue";
import { useStore } from "../store";
import { clone_field } from "../utils";

let store = useStore();
let search_text = ref("");

let fields = computed(() => {
	let fields = frappe.model.all_fieldtypes
		.map(fieldtype => {
			// @dokos
			const df = store.get_df(fieldtype);
			df.label = __(fieldtype, null, "DocField");
			return {
				df: df,
				table_columns: [],
			};
		})
		.sort((a, b) => a.df.label.localeCompare(b.df.label))
		.filter(({ df }) => {
			if (in_list(frappe.model.layout_fields, df.fieldtype)) {
				return false;
			}
			if (search_text.value) {
				// @dokos
				if (df.label.toLowerCase().includes(search_text.value.toLowerCase())) {
					return true;
				}
				return false;
			} else {
				return true;
			}
		})

	return [...fields];
});

function on_drag_start(evt) {
	$(evt.item).html('<div class="drop-it-here"></div>');
}

function on_drag_end(evt) {
	let old_html = evt.clone.innerHTML;
	$(evt.item).html(old_html);
}
</script>

<template>
	<SearchBox v-model="search_text" />
	<draggable class="fields-container" :list="fields" :group="{ name: 'fields', pull: 'clone', put: false }" :sort="false"
		:clone="clone_field" item-key="id" :remove-clone-on-hide="false" @start="on_drag_start" @end="on_drag_end">
		<template #item="{ element }">
			<div class="field" :title="element.df.label">
				{{ element.df.label }}
			</div>
		</template>
	</draggable>
</template>

<style lang="scss" scoped>
.fields-container {
	height: calc(100vh - 250px);
	overflow-y: auto;
	display: grid;
	gap: 8px;
	padding: 8px;
	grid-template-columns: 1fr 1fr;
	grid-auto-rows: max-content;

	.field {
		display: block !important;
		background-color: var(--bg-light-gray);
		border-radius: var(--border-radius);
		border: 0.5px solid var(--dark-border-color);
		padding: 0.5rem 0.75rem;
		font-size: var(--text-sm);
		cursor: pointer;

		&.sortable-ghost {
			position: absolute;
			opacity: 0;
		}
	}
}
</style>
