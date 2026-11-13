import type { DictKey } from './i18n';

// Developer-only English (DEV_LOCALE=en outside production). Keys must match dict.zh-Hant.ts.
const en = {
  'site.name': 'Tour Compare',
  'nav.search': 'Search tours',
  'nav.chain': 'Chain tours',
  'footer.disclaimer': "Not affiliated with any operator. Confirm prices and dates on the operator's site.",
  'length.daysNights': '{days}D{nights}N',
  'length.days': '{days}D',
  'updated.today': 'Updated today {time}',
  'updated.on': 'Updated {month}/{day} {time}',
  'dest.placeholder': 'Type a country, region or city',
  'dest.none': 'No matching region',
  'dest.includes': 'Includes {cities}',
  'dest.clear': 'Clear',
  'dest.byCountry': 'Browse by country',
  'dest.allRegions': 'All regions',
  'dest.back': '← Back',
  'dest.listSeparator': ', ',
} satisfies Record<DictKey, string>;

export default en;
