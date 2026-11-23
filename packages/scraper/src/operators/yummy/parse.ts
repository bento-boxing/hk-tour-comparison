import {
  isIsoDate, TOUR_CODE_PATTERN,
  type IsoDate, type ScrapedDeparture, type ScrapedTour,
} from '@hktours/core';
import { isCount, jsonPrice, objectAt, type JsonObject } from '../shared/json';
import { jsonText } from '../shared/text';
import { tourIdOf, tourPageUrl } from './discover';
import { tourOrNull } from '../shared/joined';
import { splitTour } from './fetch-page';

// Sources: docs/operators/yummy.md, "Where each fact comes from". The text is fetchPage's join of the tour's
// detail and dates answers. Only the paths below are read; the API's other fields (booking counts, prose, image
// and PDF paths) never are, even in an answer that was not trimmed.

const OK = 1;
/**
 * `group_enroll_status`, as the tour page's script labels it: 0 收客中 (taking bookings), 1 快成團 (nearly
 * confirmed), 2 已成團 (confirmed), 3 已满客 (full), 4 已取消 (cancelled).
 */
const FULL = 3;
const CANCELLED = 4;
/**
 * Of several groups on one date, the site's calendar shows the one with the best status, best first (the page's
 * own order: 2 > 1 > 0 > 3); of equal statuses, we take the lowest price. Cancelled groups are dropped first.
 */
const SHOWN_FIRST = [2, 1, 0, 3];
/** Between the names of `dist_list`: ASCII and full-width commas. */
const LIST_SEPARATOR = /[,，]/;

/** The title the tour page shows: `website_name` when `is_website_name` is 1 and it has text, else `name`. */
function title(data: JsonObject): string {
  const websiteName = jsonText(data.website_name);
  return data.is_website_name === 1 && websiteName !== '' ? websiteName : jsonText(data.name);
}

/**
 * The tour's city list (`日本,東京,富士`), one name per entry in the operator's order, for the shared place
 * matching. Yummy Holiday has no day headings (owner decision 2026-11-14: reduced fields), so these stand in
 * for them; the shared rules read each entry as they would a heading's piece, a country name (`日本`) giving no
 * stop, and a province giving none when one of its cities is listed (see dropRegionWithListedCity below).
 */
function cityList(distList: unknown): string[] {
  return typeof distList === 'string'
    ? distList.split(LIST_SEPARATOR).map(name => jsonText(name)).filter(name => name !== '')
    : [];
}

interface Group { date: IsoDate; status: number; priceHkd: number | null }

/** The group the site would show of a date's groups (none cancelled): best status, then lowest price. */
function shownGroup(groups: Group[]): Group {
  const rank = (group: Group) => SHOWN_FIRST.indexOf(group.status);
  return groups.reduce((best, group) => {
    if (rank(group) !== rank(best)) return rank(group) < rank(best) ? group : best;
    if (group.priceHkd === null) return best;
    return best.priceHkd === null || group.priceHkd < best.priceHkd ? group : best;
  });
}

/**
 * One departure per date that can be booked, in date order, at the price of the group the site would show; or
 * why the groups cannot be read. Cancelled groups are dropped; a date whose remaining groups are all full is left
 * out. A group without a real date is skipped. Past dates are kept: normaliseTour drops them.
 */
function readDepartures(dates: unknown): ScrapedDeparture[] | string {
  const answer = objectAt(dates);
  const list = objectAt(answer.data).list;
  if (answer.code !== OK || !Array.isArray(list)) return 'the dates answered a code other than 1, or no list';
  const byDate = new Map<IsoDate, Group[]>();
  for (const row of list.map(objectAt)) {
    const status = row.group_enroll_status;
    if (!isCount(status) || status < 0 || status > CANCELLED) return 'a group has an unknown status (not 0 to 4)';
    const date = row.start_date;
    if (status === CANCELLED || typeof date !== 'string' || !isIsoDate(date)) continue;
    byDate.set(date, [...(byDate.get(date) ?? []), { date, status, priceHkd: jsonPrice(row.price) }]);
  }
  return [...byDate.values()]
    .map(shownGroup)
    .filter(group => group.status !== FULL) // the best is full only when every group left is
    .map(({ date, priceHkd }) => ({ date, priceHkd }))
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

/**
 * One Yummy Holiday tour (fetchPage's text for its tour page) as a ScrapedTour, or why it is not one. The reasons
 * are fixed texts, never anything from the answer, so they can be logged.
 */
export function readTour(text: string, url: string): ScrapedTour | { why: string } {
  const id = tourIdOf(url);
  if (id === null) return { why: 'not a Yummy Holiday tour page' };
  const tour = splitTour(text);
  if (tour === null) return { why: 'not the joined detail and dates text' };
  const detail = objectAt(tour.detail);
  const data = objectAt(detail.data);
  if (detail.code !== OK) return { why: 'the detail answered a code other than 1' };
  if (!isCount(data.id) || String(data.id) !== id) return { why: 'the detail is for another tour' };

  const code = jsonText(data.code);
  if (!TOUR_CODE_PATTERN.test(code)) return { why: 'the detail has no valid tour code' };
  const days = data.daycount;
  if (!isCount(days) || days < 1) return { why: 'the detail has no day count of at least 1' };
  const departures = readDepartures(tour.dates);
  if (typeof departures === 'string') return { why: departures };

  return {
    operatorId: 'yummy',
    code,
    url: tourPageUrl(id),
    title: title(data),
    days,
    nights: null,
    dayHeadings: cityList(data.dist_list),
    // The API names no gathering place (only the transport, `vehicle_name`, which is not read): no stated start
    // or end, which the shared rules read as Hong Kong, as for any operator that does not state one.
    startPoint: null,
    endPoint: null,
    fromPriceHkd: jsonPrice(data.price),
    departures,
    // Owner decision 2026-11-14: the list is a set of place tags, and a province given beside its own cities
    // (`雲南,大理,瀘沽湖,麗江,昆明`) is not a stop of its own; normaliseTour drops it, wherever it sits.
    dropRegionWithListedCity: true,
  };
}

/**
 * One Yummy Holiday tour as a ScrapedTour; null when it is not one (see readTour for the reasons). `_today` is
 * accepted for the shared parser signature; every date carries its year.
 */
export function parse(text: string, url: string, _today?: IsoDate): ScrapedTour | null {
  return tourOrNull(readTour(text, url));
}
