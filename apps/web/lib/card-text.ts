import {
  daysBetween, isIsoDate, tourRegions,
  type IsoDate, type PlacesIndex, type PriceChange, type ScrapedDeparture, type Stop, type TourPoint,
} from '@hktours/core';
import { formatPrice, monthName } from './format';
import { DEFAULT_LOCALE, makeT, type DictKey, type Locale, type T } from './i18n';
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

/**
 * The first `country · region` of the route, e.g. '日本 · 關西', and '日本 · 關西 +2' when two more
 * regions follow; just '法國' when the region's name is the country's. Empty for a tour without stops.
 * Names are in `t`'s language; `t` defaults to the zh-Hant text.
 * A stop with a known city counts in its city's current region, so a stop saved before a region was split (task 37:
 * `china-central`; task 40: `china-northeast` and `china-northwest`, and a Hangzhou stop still saved under
 * `china-shanghai`, now 上海 alone) names the province. Without a known city, a retired region (retiredRegion) counts
 * under the name it had, unless a region that replaced it is already on the card; any other unknown region is not
 * counted. When nothing is counted, the label is the first known country alone. No id is ever shown.
 */
export function regionLabel(stops: Stop[], places: PlacesIndex, t: T = makeT(DEFAULT_LOCALE)): string {
  const current = stops.map(s => (s.cityId === null ? s : { ...s, regionId: places.city(s.cityId)?.regionId ?? s.regionId }));
  const onCard = new Set(current.map(s => s.regionId));
  const counted = current.filter(s => places.region(s.regionId) !== undefined
    || retiredRegion(s.regionId)?.replacedBy.every(id => !onCard.has(id)) === true);
  const [first, ...rest] = tourRegions(counted);
  if (!first) return firstCountryName(stops, places, t.locale)[0] ?? '';
  const country = places.country(first.countryId);
  const region = first.regionId === null ? undefined : places.region(first.regionId);
  const countryText = country ? placeName(country, t.locale) : null;
  const regionText = first.regionId === null ? null
    : region ? placeName(region, t.locale) : retiredRegion(first.regionId)?.name[t.locale] ?? null;
  // A region named like its country (法國 · 法國) is not named twice.
  const sameName = region !== undefined && country !== undefined ? region.nameZh === country.nameZh : regionText === countryText;
  const label = regionText === null || sameName ? countryText ?? ''
    : countryText === null ? regionText : `${countryText} · ${regionText}`;
  return rest.length === 0 ? label : `${label} ${t('card.moreRegions', { n: rest.length })}`;
}

export type PriceTone = 'down' | 'up' | 'same';

/**
 * '↓ HK$500　比7日前', '↑ HK$300　比7日前' or '— 與7日前相同', where 7 is the days from `sinceDate` to today.
 * Null when there is no change, or when the dates or amount are unusable (never throws).
 */
export function priceChangeText(change: PriceChange | null, today: IsoDate, t: T): { text: string; tone: PriceTone } | null {
  if (change === null || !isIsoDate(change.sinceDate) || !isIsoDate(today)) return null;
  const days = daysBetween(change.sinceDate, today);
  if (days < 1) return null;
  if (change.kind === 'same') return { text: t('card.same', { days }), tone: 'same' };
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

const WEEKDAY_KEYS = [
  'date.weekday.0', 'date.weekday.1', 'date.weekday.2', 'date.weekday.3',
  'date.weekday.4', 'date.weekday.5', 'date.weekday.6',
] as const satisfies readonly DictKey[];

/** '2026年12月18日（五）' (en: 'Fri 18 Dec 2026'). The weekday comes from the date read as UTC. Null for a bad date. */
export function departureDateText(date: IsoDate, t: T): string | null {
  if (!isIsoDate(date)) return null;
  const [year, month, day] = date.split('-').map(Number);
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return t('date.long', { year, month, day, weekday: t(WEEKDAY_KEYS[weekday]), monthName: monthName(month, t) });
}
