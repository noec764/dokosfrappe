# Copyright (c) 2021, Frappe Technologies Pvt. Ltd. and Contributors
# License: See license.txt

import frappe
from frappe.model.document import Document, bulk_insert


class Country(Document):
	# NOTE: During installation country docs are bulk inserted.
	pass


def import_country_and_currency():
	from frappe.geo.doctype.currency.currency import enable_default_currencies

	countries, currencies = get_countries_and_currencies()

	bulk_insert("Country", countries, ignore_duplicates=True)
	bulk_insert("Currency", currencies, ignore_duplicates=True)

	enable_default_currencies()


def get_countries_and_currencies():
	from frappe.geo.country_info import get_all as get_geo_data

	data = get_geo_data()

	countries = []
	currencies = []

	for name, country in data.items():
		country = frappe._dict(country)
		countries.append(
			frappe.get_doc(
				doctype="Country",
				name=name,
				country_name=name,
				code=country.code,
				date_format=country.date_format or "dd-mm-yyyy",
				time_format=country.time_format or "HH:mm:ss",
				time_zones="\n".join(country.timezones or []),
			)
		)
		if country.currency:
			currencies.append(
				frappe.get_doc(
					doctype="Currency",
					name=country.currency,
					currency_name=country.currency,
					fraction=country.currency_fraction,
					symbol=country.currency_symbol,
					fraction_units=country.currency_fraction_units,
					smallest_currency_fraction_value=country.smallest_currency_fraction_value,
					number_format=country.number_format,
				)
			)

	return countries, currencies
