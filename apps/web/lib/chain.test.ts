import { it, expect } from 'vitest';
import type { ChainState, ScrapedDeparture } from '@hktours/core';
import type { OperatorId } from '@hktours/core';
import type { TourCardData } from '@hktours/db/read';
import { chainTotals, nextWindow, resolveChain, restRange, type ResolvedLeg } from './chain';

const today = '2026-11-12';

function card(key: string, days: number, departures: ScrapedDeparture[], fallbackPriceHkd: number): TourCardData {
  const prices = departures.map(d => d.priceHkd ?? fallbackPriceHkd);
  return {
    key, operatorId: key.split(':')[0] as OperatorId, url: `https://example.test/${key}`, title: key, days, nights: days - 1,
    stops: [{ countryId: 'japan', regionId: 'japan-kansai', cityId: 'japan-kansai-osaka' }],
    start: { kind: 'hk', label: null }, end: { kind: 'hk', label: null },
    fromPriceHkd: Math.min(...prices), windowPriceHkd: Math.min(...prices), fallbackPriceHkd,
    departures, priceChange: null, lastUpdated: '2026-11-11T19:10:00Z',
  };
}

const A = card('egl:KIX5', 5, [{ date: '2026-12-18', priceHkd: 7999 }, { date: '2026-12-27', priceHkd: 8999 }], 7999);
const B = card('texpert:SEL5', 5, [{ date: '2026-12-24', priceHkd: 5699 }, { date: '2026-12-25', priceHkd: null }], 5699);
const C = card('bigline:TPE4', 4, [{ date: '2026-12-23', priceHkd: 3980 }], 3980);
const tours = new Map([A, B, C].map(t => [t.key, t]));

const st = (...legs: [string, string][]): ChainState => ({ legs: legs.map(([tourKey, departure]) => ({ tourKey, departure })), gap: { min: 1, max: 3 } });

it('resolves a valid two-leg chain', () => {
  const r = resolveChain(st(['egl:KIX5', '2026-12-18'], ['texpert:SEL5', '2026-12-24']), tours, today);
  expect(r.droppedCount).toBe(0);
  expect(r.legs.map(l => [l.endDate, l.priceHkd, l.priceIsExact, l.gapBefore])).toEqual([
    ['2026-12-22', 7999, true, null], ['2026-12-28', 5699, true, 1],
  ]);
  expect(r.legs.map(l => [l.tour.key, l.departure])).toEqual([['egl:KIX5', '2026-12-18'], ['texpert:SEL5', '2026-12-24']]);
});

it('a departure without its own price uses the from-price and is not exact', () => {
  const r = resolveChain(st(['texpert:SEL5', '2026-12-25']), tours, today);
  expect(r.legs[0]).toMatchObject({ priceHkd: 5699, priceIsExact: false });
});

it('the price of an unpriced departure is the stored fallback price, not the lowest upcoming price', () => {
  // fromPriceHkd is the lowest upcoming price (5000); the operator's stored from-price is 5699.
  const cheap = { ...B, fromPriceHkd: 5000, windowPriceHkd: 5000, fallbackPriceHkd: 5699 };
  const r = resolveChain(st(['texpert:SEL5', '2026-12-25']), new Map([[cheap.key, cheap]]), today);
  expect(r.legs[0]).toMatchObject({ priceHkd: 5699, priceIsExact: false });
});

it('drops a leg whose tour has gone, and everything after it', () => {
  const r = resolveChain(st(['egl:KIX5', '2026-12-18'], ['jetour:GONE', '2026-12-24'], ['bigline:TPE4', '2026-12-23']), tours, today);
  expect(r.legs.map(l => l.tour.key)).toEqual(['egl:KIX5']);
  expect(r.droppedCount).toBe(2);
});

it('drops a leg whose date is no longer offered', () => {
  expect(resolveChain(st(['egl:KIX5', '2026-12-19']), tours, today)).toEqual({ legs: [], droppedCount: 1 });
});

it('drops a leg that overlaps the previous one', () => {
  const r = resolveChain(st(['egl:KIX5', '2026-12-18'], ['bigline:TPE4', '2026-12-23']), tours, today);
  expect(r.legs).toHaveLength(2); // 12-23 is the day after 12-22: gap 0, allowed
  expect(r.legs[1].gapBefore).toBe(0);
  const r2 = resolveChain(st(['egl:KIX5', '2026-12-27'], ['texpert:SEL5', '2026-12-24']), tours, today);
  expect(r2.legs).toHaveLength(1);
  expect(r2.droppedCount).toBe(1);
});

it('a leg that starts on the last day of the previous one overlaps it and is dropped', () => {
  const D = card('jetour:D1', 3, [{ date: '2026-12-22', priceHkd: 2000 }], 2000);
  const r = resolveChain(st(['egl:KIX5', '2026-12-18'], ['jetour:D1', '2026-12-22']), new Map([[A.key, A], [D.key, D]]), today);
  expect(r).toMatchObject({ droppedCount: 1 });
  expect(r.legs).toHaveLength(1);
});

it('drops a leg that departs before today, with everything after it', () => {
  // getToursByKeys lists only upcoming departures, but resolveChain does not rely on that.
  const r = resolveChain(st(['egl:KIX5', '2026-12-18'], ['texpert:SEL5', '2026-12-24']), tours, '2026-12-20');
  expect(r).toEqual({ legs: [], droppedCount: 2 });
});

it('drops a leg that departs today, with everything after it', () => {
  const r = resolveChain(st(['egl:KIX5', '2026-12-18'], ['texpert:SEL5', '2026-12-24']), tours, '2026-12-18');
  expect(r).toEqual({ legs: [], droppedCount: 2 });
});

it('an empty chain resolves to nothing', () => {
  expect(resolveChain(st(), tours, today)).toEqual({ legs: [], droppedCount: 0 });
});

it('never throws on invalid dates or tour data: the bad leg is dropped with everything after it', () => {
  const badDays = { ...C, key: 'bigline:BAD', days: Number.NaN };
  const hugeDays = { ...C, key: 'bigline:HUGE', days: 1e12 };
  const badDate = { ...C, key: 'bigline:BADDATE', departures: [{ date: '2026-02-30', priceHkd: 100 }] };
  const noPrice = { ...C, key: 'bigline:NOPRICE', departures: [{ date: '2026-12-23', priceHkd: null }], fallbackPriceHkd: Number.NaN };
  const map = new Map([[A.key, A], ...[badDays, hugeDays, badDate, noPrice].map(t => [t.key, t] as const)]);
  const cases: [string, string][] = [
    ['bigline:BAD', '2026-12-23'], ['bigline:HUGE', '2026-12-23'], ['bigline:BADDATE', '2026-02-30'],
    ['bigline:NOPRICE', '2026-12-23'], ['egl:KIX5', 'not-a-date'], ['egl:KIX5', '2026-13-01'],
  ];
  for (const leg of cases) {
    const r = resolveChain(st(['egl:KIX5', '2026-12-18'], leg, ['egl:KIX5', '2026-12-27']), map, today);
    expect(r, leg.join('@')).toMatchObject({ droppedCount: 2 });
    expect(r.legs.map(l => l.tour.key)).toEqual(['egl:KIX5']);
  }
  // An invalid today: nothing can be checked against it, so every leg is dropped.
  expect(resolveChain(st(['egl:KIX5', '2026-12-18']), tours, 'today')).toEqual({ legs: [], droppedCount: 1 });
  // Not even a list of legs.
  expect(resolveChain({ legs: null, gap: { min: 1, max: 3 } } as unknown as ChainState, tours, today)).toEqual({ legs: [], droppedCount: 0 });
});

it('chainTotals', () => {
  const legs = resolveChain(st(['egl:KIX5', '2026-12-18'], ['texpert:SEL5', '2026-12-24']), tours, today).legs;
  expect(chainTotals(legs)).toEqual({ priceHkd: 13698, priceIsExact: true, tourDays: 10, spanDays: 11 });
  const legs2 = resolveChain(st(['egl:KIX5', '2026-12-18'], ['texpert:SEL5', '2026-12-25']), tours, today).legs;
  expect(chainTotals(legs2)).toMatchObject({ priceIsExact: false, spanDays: 12 });
  expect(chainTotals([])).toEqual({ priceHkd: 0, priceIsExact: true, tourDays: 0, spanDays: 0 });
});

it('a single leg spans its own days', () => {
  const legs = resolveChain(st(['egl:KIX5', '2026-12-18']), tours, today).legs;
  expect(chainTotals(legs)).toEqual({ priceHkd: 7999, priceIsExact: true, tourDays: 5, spanDays: 5 });
});

it('nextWindow follows the last leg and the gap', () => {
  const legs = resolveChain(st(['egl:KIX5', '2026-12-18']), tours, today).legs;
  expect(nextWindow(legs, { min: 1, max: 3 })).toEqual({ from: '2026-12-24', to: '2026-12-26' });
  expect(nextWindow(legs, { min: 0, max: 0 })).toEqual({ from: '2026-12-23', to: '2026-12-23' });
  expect(nextWindow([], { min: 1, max: 3 })).toBeNull();
});

it('chainTotals and nextWindow never throw on hand-made legs: they stop at the first invalid one', () => {
  const [good] = resolveChain(st(['egl:KIX5', '2026-12-18']), tours, today).legs;
  const broken: ResolvedLeg[] = [
    { ...good, endDate: '2026-12-32' },
    { ...good, departure: 'x' },
    { ...good, priceHkd: Number.NaN },
    { ...good, tour: { ...good.tour, days: Number.NaN } },
  ];
  for (const bad of broken) {
    expect(chainTotals([good, bad])).toEqual({ priceHkd: 7999, priceIsExact: true, tourDays: 5, spanDays: 5 });
    expect(nextWindow([good, bad], { min: 1, max: 3 })).toEqual({ from: '2026-12-24', to: '2026-12-26' });
    expect(chainTotals([bad])).toEqual({ priceHkd: 0, priceIsExact: true, tourDays: 0, spanDays: 0 });
    expect(nextWindow([bad], { min: 1, max: 3 })).toBeNull();
  }
  expect(chainTotals(null as unknown as ResolvedLeg[])).toEqual({ priceHkd: 0, priceIsExact: true, tourDays: 0, spanDays: 0 });
  expect(nextWindow(null as unknown as ResolvedLeg[], { min: 1, max: 3 })).toBeNull();
});

it('nextWindow cleans a hand-made gap (swapped, out of range, not numbers)', () => {
  const legs = resolveChain(st(['egl:KIX5', '2026-12-18']), tours, today).legs;
  expect(nextWindow(legs, { min: 3, max: 1 })).toEqual({ from: '2026-12-24', to: '2026-12-26' });
  expect(nextWindow(legs, { min: -5, max: 99 })).toEqual({ from: '2026-12-23', to: '2027-01-22' });
  expect(nextWindow(legs, { min: Number.NaN, max: 2 })).toEqual({ from: '2026-12-24', to: '2026-12-26' }); // the default gap
  // A last leg that ends at the edge of the calendar has no window rather than a broken one.
  const edge = { ...legs[0], departure: '9999-12-20', endDate: '9999-12-24' };
  expect(nextWindow([edge], { min: 10, max: 20 })).toBeNull();
});

it('restRange gives the free days before the earliest and latest of these departures', () => {
  expect(restRange('2026-12-22', ['2026-12-24', '2026-12-25'])).toEqual({ min: 1, max: 2 });
  expect(restRange('2026-12-22', ['2026-12-24'])).toEqual({ min: 1, max: 1 });
  expect(restRange('2026-12-22', ['2026-12-26', '2026-12-23', 'bad'])).toEqual({ min: 0, max: 3 });
  expect(restRange('2026-12-22', [])).toBeNull();
  expect(restRange('2026-12-22', ['bad'])).toBeNull();
  expect(restRange('nope', ['2026-12-24'])).toBeNull();
});
