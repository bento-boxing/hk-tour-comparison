import { daysBetween, isIsoDate, tourRegions, type IsoDate, type PlacesIndex, type PriceChange, type Stop, type TourPoint } from '@hktours/core';
import { formatPrice } from './format';
import { makeT, type DictKey, type T } from './i18n';

// The text pieces of a tour card. Pure: no React, no clock, no local-timezone Date arithmetic.

/** One name per stop: the city's nameZh, or the region's when the stop has no city. Unknown ids fall back to the region, then the id. */
export function routeNames(stops: Stop[], places: PlacesIndex): string[] {
  return stops.map(s => {
    const city = s.cityId === null ? undefined : places.city(s.cityId);
    return city?.nameZh ?? places.region(s.regionId)?.nameZh ?? s.regionId;
  });
}

/**
 * The first `country · region` of the route, e.g. '日本 · 關西', and '日本 · 關西 +2' when two more
 * regions follow; just '法國' when the region's name is the country's. Empty for a tour without stops.
 * `t` defaults to the public zh-Hant text.
 */
export function regionLabel(stops: Stop[], places: PlacesIndex, t: T = makeT('zh-Hant')): string {
  const [first, ...rest] = tourRegions(stops);
  if (!first) return '';
  const country = places.country(first.countryId)?.nameZh ?? first.countryId;
  const region = first.regionId === null ? null : places.region(first.regionId)?.nameZh ?? first.regionId;
  // A region named like its country (法國 · 法國) is not named twice.
  const label = region === null || region === country ? country : `${country} · ${region}`;
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

const WEEKDAY_KEYS = [
  'date.weekday.0', 'date.weekday.1', 'date.weekday.2', 'date.weekday.3',
  'date.weekday.4', 'date.weekday.5', 'date.weekday.6',
] as const satisfies readonly DictKey[];

const MONTH_KEYS = [
  'date.month.1', 'date.month.2', 'date.month.3', 'date.month.4', 'date.month.5', 'date.month.6',
  'date.month.7', 'date.month.8', 'date.month.9', 'date.month.10', 'date.month.11', 'date.month.12',
] as const satisfies readonly DictKey[];

/** '2026年12月18日（五）' (en: 'Fri 18 Dec 2026'). The weekday comes from the date read as UTC. Null for a bad date. */
export function departureDateText(date: IsoDate, t: T): string | null {
  if (!isIsoDate(date)) return null;
  const [year, month, day] = date.split('-').map(Number);
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return t('date.long', { year, month, day, weekday: t(WEEKDAY_KEYS[weekday]), monthName: t(MONTH_KEYS[month - 1]) });
}
