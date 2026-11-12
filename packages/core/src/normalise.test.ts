import { it, expect } from 'vitest';
import { normaliseTour, places, buildPlacesIndex } from './index';
import type { ScrapedTour } from './index';

/** The valid tour from schema.test.ts, with a Japan route and one past departure. */
const base: ScrapedTour = {
  operatorId: 'jetour', code: 'THB', url: 'https://www.jetour.com.hk/tour/THB',
  title: '曼谷芭堤雅5天', days: 5, nights: 4,
  dayHeadings: ['香港 → 大阪', '大阪 → 京都'],
  startPoint: null, endPoint: null, fromPriceHkd: 3999,
  departures: [
    { date: '2026-12-22', priceHkd: 8299 },
    { date: '2026-12-18', priceHkd: 7999 },
    { date: '2026-11-01', priceHkd: 5000 },
  ],
};

const today = '2026-11-12';
it('normalises a good tour', () => {
  const r = normaliseTour(base, places, today);
  expect(r.ok).toBe(true);
  if (!r.ok) return;
  expect(r.tour.stops.map(s => s.cityId)).toEqual(['japan-kansai-osaka', 'japan-kansai-kyoto']);
  expect(r.tour.departures.map(d => d.date)).toEqual(['2026-12-18', '2026-12-22']); // past date dropped, sorted
  expect(r.tour.fromPriceHkd).toBe(7999);
  expect(r.tour.start).toEqual({ kind: 'hk', label: null });
});
it('uses the scraped from-price when no departure has a price', () => {
  const r = normaliseTour({ ...base, fromPriceHkd: 6000, departures: [{ date: '2026-12-18', priceHkd: null }] }, places, today);
  expect(r.ok && r.tour.fromPriceHkd).toBe(6000);
});
it('de-duplicates dates keeping the lowest price', () => {
  const r = normaliseTour({ ...base, departures: [{ date: '2026-12-18', priceHkd: 9000 }, { date: '2026-12-18', priceHkd: 8000 }] }, places, today);
  expect(r.ok && r.tour.departures).toEqual([{ date: '2026-12-18', priceHkd: 8000 }]);
});
it.each([
  ['no-stops', { dayHeadings: [] }],
  ['no-stops', { dayHeadings: ['香港 → 亞特蘭提斯'] }],
  ['no-departures', { departures: [] }],
  ['no-departures', { departures: [{ date: '2026-11-11', priceHkd: 5000 }] }],
  ['no-price', { fromPriceHkd: null, departures: [{ date: '2026-12-18', priceHkd: null }] }],
])('rejects with %s', (reason, patch) => {
  const r = normaliseTour({ ...base, ...patch }, places, today);
  expect(r).toMatchObject({ ok: false, reason });
});
it('reports unmatched names on rejection', () => {
  const r = normaliseTour({ ...base, dayHeadings: ['香港 → 亞特蘭提斯'] }, places, today);
  expect(r.unmatched).toEqual(['亞特蘭提斯']);
});
it('drops Shenzhen from the route for a Shenzhen-start tour', () => {
  const r = normaliseTour({ ...base, startPoint: '深圳灣口岸', dayHeadings: ['深圳 → 桂林', '桂林 → 深圳'] }, places, today);
  expect(r.ok && r.tour.stops.map(s => s.cityId)).toEqual(['china-guangxi-guilin']);
  expect(r.ok && r.tour.start.kind).toBe('sz');
});
it('normalises a tour starting at a foreign airport as an other start', () => {
  const r = normaliseTour({ ...base, startPoint: '東京成田機場集合' }, places, today);
  expect(r.ok && r.tour.start).toEqual({ kind: 'other', label: '東京成田機場集合' });
});
it('passes its own index to the start-point rule', () => {
  const withoutTokyo = buildPlacesIndex({
    ...places.data,
    cities: places.data.cities.filter(c => c.id !== 'japan-kanto-tokyo'),
  });
  const r = normaliseTour({ ...base, startPoint: '東京成田機場集合' }, withoutTokyo, today);
  expect(r.ok && r.tour.start).toEqual({ kind: 'hk', label: null });
});
it('reports the raw headings, cut to 40 characters, when nothing was flagged unmatched', () => {
  const heading = 'x'.repeat(45);
  const r = normaliseTour({ ...base, dayHeadings: [heading, 'Day 2'] }, places, today);
  expect(r).toEqual({ ok: false, reason: 'no-stops', unmatched: ['x'.repeat(40), 'Day 2'] });
});
it('drops Shenzhen from the route when only the end point is in Shenzhen', () => {
  const r = normaliseTour({ ...base, endPoint: '羅湖口岸散團', dayHeadings: ['深圳 → 桂林', '桂林 → 深圳'] }, places, today);
  expect(r.ok && r.tour.stops.map(s => s.cityId)).toEqual(['china-guangxi-guilin']);
  expect(r.ok && r.tour.end.kind).toBe('sz');
});
it('keeps Shenzhen on the route of a Hong Kong-start tour', () => {
  const r = normaliseTour({ ...base, dayHeadings: ['香港 → 深圳', '深圳 → 桂林'] }, places, today);
  expect(r.ok && r.tour.stops.map(s => s.cityId)).toEqual(['china-guangdong-shenzhen', 'china-guangxi-guilin']);
});
it('keeps a departure dated today', () => {
  const r = normaliseTour({ ...base, departures: [{ date: today, priceHkd: 7000 }] }, places, today);
  expect(r.ok && r.tour.departures).toEqual([{ date: today, priceHkd: 7000 }]);
});
