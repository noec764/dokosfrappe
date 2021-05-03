export default {
	name: 'Validation Test',
	custom: 1,
	actions: [],
	creation: '2019-03-15 06:29:07.215072',
	doctype: 'DocType',
	editable_grid: 1,
	engine: 'InnoDB',
	fields: [
		{
			fieldname: 'email',
			fieldtype: 'Data',
			label: 'Email',
			options: 'Email'
		},
		{
			fieldname: 'URL',
			fieldtype: 'Data',
			label: 'URL',
			options: 'URL'
		},
		{
			fieldname: 'Phone',
			fieldtype: 'Data',
			label: 'Phone',
			options: 'Phone'
		},
		{
			fieldname: 'person_name',
			fieldtype: 'Data',
			label: 'Person Name',
			options: 'Name'
		},
		{
			fieldname: 'read_only_url',
			fieldtype: 'Data',
			label: 'Read Only URL',
			options: 'URL',
			read_only: '1',
			default: 'https://frappe.io'
		}
	],
	issingle: 1,
	links: [],
	modified: '2021-04-19 14:40:53.127615',
	modified_by: 'Administrator',
	module: 'Custom',
	owner: 'Administrator',
	permissions: [
		{
			create: 1,
			delete: 1,
			email: 1,
			print: 1,
			read: 1,
			role: 'System Manager',
			share: 1,
			write: 1
		}
	],
	quick_entry: 1,
	sort_field: 'modified',
	sort_order: 'ASC',
	track_changes: 1
};