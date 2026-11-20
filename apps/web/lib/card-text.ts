import {
  daysBetween, isIsoDate, tourRegions,
  type IsoDate, type PlacesIndex, type PriceChange, type ScrapedDeparture, type Stop, type TourPoint,
} from '@hktours/core';
import { WEEKDAY_KEYS, formatHkDay, formatPrice, monthName } from './format';
import { DEFAULT_LOCALE, makeT, type Locale, type T } from './i18n';
import { placeName, retiredRegion } from './place-names';

// The text pieces of a tour card. Pure: no React, no clock, no local-timezone Date arithmetic.

/**
 * One name per stop, in the visitor's language: the city's, or the region's when the stop has no city.
 * An unknown city falls back to its region, a retired region (retiredRegion) to the name it had; a stop whose
 * region is unknown otherwise is left out, never shown as an id. When no stop is left, the first known country.
 */
export function routeNames(stops: Stop[], places: PlacesIndex, locale: Locale = DEFAULT_LOCALE): string[] {
  const names = stops.flatMap(s => {
    const place = (s.cityId === null ? undefined : places.city(s.cityId)) ?? places.region(s.regionId);
    if (place) return [placeName(place, locale)];
    const retired = retiredRegion(s.regionId);
    return retired ? [retired.name[locale]] : [];
  });
  return names.length > 0 ? names : firstCountryName(stops, places, locale);
}

/** The first stop's country the places list knows, in `locale`, as a one-name list; empty when there is none. */
function firstCountryName(stops: Stop[], places: PlacesIndex, locale: Locale): string[] {
  const country = stops.map(s => places.country(s.countryId)).find(c => c !== undefined);
  return country ? [placeName(country, locale)] : [];
}

/** At most this many names in a row's region column; the rest are counted ('+2'). */
export const MAX_REGION_NAMES = 5;

/**
 * The places of a row's region column, in the visitor's language, as separate names (each is shown unbroken; lines
 * break only between names). A tour within one country: the country once, then its regions in route order
 * ('中國', '廣西', '廣東'), but not a region named like its country ('法國', not '法國', '法國'). A tour across several
 * countries: the countries only, in route order ('阿根廷', '巴西', '秘魯'). At most MAX_REGION_NAMES names; `more`
 * counts the rest. Empty for a tour without stops.
 * A stop with a known city counts in its city's current region, so a stop saved before a region was split (task 37:
 * `china-central`; task 40: `china-northeast` and `china-northwest`, and a Hangzhou stop still saved under
 * `china-shanghai`, now 上海 alone) names the province. Without a known city, a retired region (retiredRegion) counts
 * under the name it had, unless a region that replaced it is already on the row; any other unknown region is not
 * counted. When nothing is counted, the first known country alone. No id is ever shown.
 */
export function regionParts(stops: Stop[], places: PlacesIndex, t: T = makeT(DEFAULT_LOCALE)): { names: string[]; more: number } {
  const current = stops.map(s => (s.cityId === null ? s : { ...s, regionId: places.city(s.cityId)?.regionId ?? s.regionId }));
  const onRow = new Set(current.map(s => s.regionId));
  const counted = current.filter(s => places.region(s.regionId) !== undefined
    || retiredRegion(s.regionId)?.replacedBy.every(id => !onRow.has(id)) === true);
  const regions = tourRegions(counted);
  const countryName = (id: string) => {
    const country = places.country(id);
    return country ? placeName(country, t.locale) : null;
  };
  let names: string[];
  if (regions.length === 0) {
    names = firstCountryName(stops, places, t.locale);
  } else {
    const countries = [...new Set(regions.map(r => r.countryId))];
    if (countries.length > 1) {
      names = countries.flatMap(id => countryName(id) ?? []);
    } else {
      const country = places.country(countries[0]);
      const regionNames = regions.flatMap(r => {
        const region = r.regionId === null ? undefined : places.region(r.regionId);
        // A region named like its country (法國 · 法國) is not named twice.
        if (region && country && region.nameZh === country.nameZh) return [];
        const name = region ? placeName(region, t.locale) : r.regionId === null ? null : retiredRegion(r.regionId)?.name[t.locale] ?? null;
        return name === null ? [] : [name];
      });
      names = [...(country ? [placeName(country, t.locale)] : []), ...new Set(regionNames)];
    }
  }
  return { names: names.slice(0, MAX_REGION_NAMES), more: Math.max(0, names.length - MAX_REGION_NAMES) };
}

/** How old an operator's last good run may be before its rows are marked: 36 hours (a missed night, and some). */
export const STALE_AFTER_HOURS = 36;

/**
 * The day an operator's data dates from ('11月17日'), when its last good run (`lastUpdated`) is more than
 * STALE_AFTER_HOURS before `now`; null while it is fresh, or for a time that cannot be read. Both are ISO timestamps;
 * `now` comes from the server's render, so the server and the browser mark the same rows.
 */
export function staleSince(lastUpdated: string, now: string, t: T): string | null {
  const age = Date.parse(now) - Date.parse(lastUpdated);
  if (!Number.isFinite(age) || age <= STALE_AFTER_HOURS * 3600_000) return null;
  return formatHkDay(lastUpdated, t);
}

/**
 * When the list's data was last updated: the latest good run of any operator, as a day ('11月19日'); null when no
 * operator has had one.
 */
export function lastUpdateDay(operators: { lastGoodRunAt: string | null }[], t: T): string | null {
  const times = operators.flatMap(o => (o.lastGoodRunAt === null || Number.isNaN(Date.parse(o.lastGoodRunAt)) ? [] : [o.lastGoodRunAt]));
  if (times.length === 0) return null;
  const latest = times.reduce((a, b) => (Date.parse(b) > Date.parse(a) ? b : a));
  return formatHkDay(latest, t);
}

export type PriceTone = 'down' | 'up';

/**
 * '↓ 比7日前平 HK$500' or '↑ 比7日前貴 HK$300', where 7 is the days from `sinceDate` to today. Null when the price
 * is unchanged (a row notes only a change), when there is no comparison, or when the dates or amount are unusable
 * (never throws).
 */
export function priceChangeText(change: PriceChange | null, today: IsoDate, t: T): { text: string; tone: PriceTone } | null {
  if (change === null || !isIsoDate(change.sinceDate) || !isIsoDate(today)) return null;
  const days = daysBetween(change.sinceDate, today);
  if (days < 1) return null;
  if (change.kind === 'same') return null;
  if (change.kind !== 'lower' && change.kind !== 'higher') return null;
  if (!Number.isFinite(change.diffHkd) || change.diffHkd <= 0) return null;
  const amount = formatPrice(change.diffHkd);
  return change.kind === 'lower'
    ? { text: t('card.lower', { amount, days }), tone: 'down' }
    : { text: t('card.higher', { amount, days }), tone: 'up' };
}

/** Where the tour starts or ends when that is not Hong Kong or Shenzhen; null when there is nothing to say. */
export function startNote(start: TourPoint, end: TourPoint, t: T): string | null {
  const startLabel = start.kind === 'other' && start.label ? start.label : null;
  const endLabel = end.kind === 'other' && end.label ? end.label : null;
  const parts: string[] = [];
  if (startLabel) parts.push(t('card.startsAt', { place: startLabel }));
  if (endLabel && endLabel !== startLabel) parts.push(t('card.endsAt', { place: endLabel }));
  return parts.length === 0 ? null : parts.join(' · ');
}

/**
 * What a departure costs, as the card's date tooltip and the departure picker show it: its own price, or, when
 * the operator lists none for that date, the tour's stored from-price (`fallbackPriceHkd`) marked 起 / from.
 */
export function departurePrice(departure: ScrapedDeparture, fallbackPriceHkd: number): { hkd: number; from: boolean } {
  return departure.priceHkd === null ? { hkd: fallbackPriceHkd, from: true } : { hkd: departure.priceHkd, from: false };
}

/** '2026年12月18日（五）' (en: 'Fri 18 Dec 2026'). The weekday comes from the date read as UTC. Null for a bad date. */
export function departureDateText(date: IsoDate, t: T): string | null {
  if (!isIsoDate(date)) return null;
  const [year, month, day] = date.split('-').map(Number);
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return t('date.long', { year, month, day, weekday: t(WEEKDAY_KEYS[weekday]), monthName: monthName(month, t) });
}
