import {
  daysBetween, isIsoDate, tourRegions,
  type IsoDate, type PlacesIndex, type PriceChange, type ScrapedDeparture, type Stop, type TourPoint,
} from '@hktours/core';
import { formatPrice, monthName } from './format';
import { DEFAULT_LOCALE, makeT, type DictKey, type Locale, type T } from './i18n';
import { placeName } from './place-names';

// The text pieces of a tour card. Pure: no React, no clock, no local-timezone Date arithmetic.

/**
 * One name per stop, in the visitor's language: the city's, or the region's when the stop has no city.
 * Unknown ids fall back to the region, then the id.
 */
export function routeNames(stops: Stop[], places: PlacesIndex, locale: Locale = DEFAULT_LOCALE): string[] {
  return stops.map(s => {
    const place = (s.cityId === null ? undefined : places.city(s.cityId)) ?? places.region(s.regionId);
    return place ? placeName(place, locale) : s.regionId;
  });
}

/**
 * The first `country · region` of the route, e.g. '日本 · 關西', and '日本 · 關西 +2' when two more
 * regions follow; just '法國' when the region's name is the country's. Empty for a tour without stops.
 * Names are in `t`'s language; `t` defaults to the zh-Hant text.
 */
export function regionLabel(stops: Stop[], places: PlacesIndex, t: T = makeT(DEFAULT_LOCALE)): string {
  const [first, ...rest] = tourRegions(stops);
  if (!first) return '';
  const country = places.country(first.countryId);
  const region = first.regionId === null ? undefined : places.region(first.regionId);
  const countryText = country ? placeName(country, t.locale) : first.countryId;
  const regionText = first.regionId === null ? null : region ? placeName(region, t.locale) : first.regionId;
  // A region named like its country (法國 · 法國) is not named twice.
  const sameName = region !== undefined && country !== undefined ? region.nameZh === country.nameZh : regionText === countryText;
  const label = regionText === null || sameName ? countryText : `${countryText} · ${regionText}`;
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
