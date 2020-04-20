# Copyright (c) 2015, Frappe Technologies Pvt. Ltd. and Contributors
# MIT License. See license.txt

from __future__ import unicode_literals
import frappe

from rq import Queue, Worker
from frappe.utils.background_jobs import get_redis_conn
from frappe.utils import format_datetime, cint, convert_utc_to_user_timezone
from frappe.utils.scheduler import is_scheduler_inactive
from frappe import _

colors = {
	'queued': 'orange',
	'failed': 'red',
	'started': 'blue',
	'finished': 'green'
}

@frappe.whitelist()
def get_info(show_failed=False):
	conn = get_redis_conn()
	queues = Queue.all(conn)
	workers = Worker.all(conn)
	jobs = []

	def add_job(j, name):
		if j.kwargs.get('site')==frappe.local.site:
			jobs.append({
				'job_name': j.kwargs.get('kwargs', {}).get('playbook_method') \
					or j.kwargs.get('kwargs', {}).get('job_type') \
					or str(j.kwargs.get('job_name')),
				'status': j.get_status(), 'queue': name,
				'creation': format_datetime(convert_utc_to_user_timezone(j.created_at)),
				'color': colors[j.get_status()]
			})
			if j.exc_info:
				jobs[-1]['exc_info'] = j.exc_info

	for w in workers:
		j = w.get_current_job()
		if j:
			add_job(j, w.name)

	for q in queues:
		if q.name != 'failed':
			for j in q.get_jobs(): add_job(j, q.name)

	if cint(show_failed):
		for q in queues:
			if q.name == 'failed':
				for j in q.get_jobs()[:10]: add_job(j, q.name)

	return jobs

@frappe.whitelist()
def get_scheduler_status():
	if is_scheduler_inactive():
		return [_("Inactive"), "red"]
	return [_("Active"), "green"]