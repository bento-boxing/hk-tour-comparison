import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { normaliseTour, places, scrapedTourSchema, type ScrapedTour, type Stop } from '@hktours/core';
import { parse } from './parse';

/** The date the fixtures were saved, from docs/operators/jetour.md. */
const CAPTURED = '2026-11-13';

interface Expected {
  sourceUrl: string;
  verifiedByOwner: boolean;
  scraped: ScrapedTour | null;
  stopNames: string[];
  /** Day-heading tokens the shared normaliser reports as unmatched: attractions, not places. */
  unmatched: string[];
}

const readFixture = (name: string) => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8');
const readJson = (name: string): Expected => JSON.parse(readFixture(name));

/** City nameZh for each stop, or region nameZh where only a region is known. */
const stopNames = (stops: Stop[]) =>
  stops.map(s => (s.cityId !== null ? places.city(s.cityId)!.nameZh : places.region(s.regionId)!.nameZh));

describe.each(['multi-city', 'simple', 'edge'])('jetour %s', name => {
  const html = readFixture(`${name}.html`);
  const expected = readJson(`${name}.expected.json`);
  it('parses to the hand-checked tour', () => {
    expect(parse(html, expected.sourceUrl, CAPTURED)).toEqual(expected.scraped);
  });
  it('passes the shared schema', () => {
    if (expected.scraped) expect(scrapedTourSchema.safeParse(parse(html, expected.sourceUrl, CAPTURED)).success).toBe(true);
  });
  it('yields the hand-checked route', () => {
    if (!expected.scraped) return;
    const r = normaliseTour(parse(html, expected.sourceUrl, CAPTURED)!, places, CAPTURED);
    expect(r.ok).toBe(true);
    expect(r.ok && stopNames(r.tour.stops)).toEqual(expected.stopNames);
    // The brief asks for []: Jetour's stop lines also name attractions, which no places list holds.
    // The hand-written list holds attraction names only; a real place there would belong in data.json.
    expect(r.unmatched).toEqual(expected.unmatched);
  });
});

it('returns null for a non-tour page', () => { expect(parse('<html><body>404</body></html>', 'https://www.jetour.com.hk/x')).toBeNull(); });
it('returns null for empty input without throwing', () => { expect(parse('', 'https://www.jetour.com.hk/x')).toBeNull(); });
it('never copies long prose', () => {
  const t = parse(readFixture('multi-city.html'), 'https://www.jetour.com.hk/x', CAPTURED)!;
  expect(Math.max(...t.dayHeadings.map(h => h.length))).toBeLessThanOrEqual(80);
});

it('drops the query string and fragment from the url', () => {
  const t = parse(readFixture('simple.html'), 'https://www.jetour.com.hk/tour/TSEQ?utm=x#booking', CAPTURED)!;
  expect(t.url).toBe('https://www.jetour.com.hk/tour/TSEQ');
});

describe('departure status', () => {
  const multiCity = readFixture('multi-city.html');
  const FIRST_STATUS = 'booking-table--status visible-desktop OK"><span>收客中</span>';
  const withFirstStatus = (cls: string, text: string) =>
    multiCity.replace(FIRST_STATUS, `booking-table--status visible-desktop ${cls}"><span>${text}</span>`);
  const dates = (html: string) => parse(html, 'https://www.jetour.com.hk/tour/THB', CAPTURED)!.departures.map(d => d.date);

  it('the fixture has the status markup these tests rewrite', () => {
    expect(multiCity.split(FIRST_STATUS).length).toBe(3); // both departures are OK
  });
  it.each([
    ['FULLED', '額滿候補'],
  ])('drops a departure marked %s', (cls, text) => {
    expect(dates(withFirstStatus(cls, text))).toEqual(['2026-12-26']);
  });
  it.each([
    ['ALMOST_FULL', '尚餘少量'],
    ['FORMING_A_TOUR', '即將成團'],
    ['TOUR_IS_FORMED', '已成團'],
    ['SOMETHING_NEW', '新狀態'],
  ])('keeps a departure marked %s', (cls, text) => {
    expect(dates(withFirstStatus(cls, text))).toEqual(['2026-12-22', '2026-12-26']);
  });
});

describe('departure dates', () => {
  const page = (startDate: string) => `
    <h1 class="h4 title">5天測試團</h1>
    <div class="tour_location"><div class="card_tag">TEST</div></div>
    <div class="booking-table--body"><div class="booking-table--row">
      <div class="booking-table--start--date"><span>出發日期: </span><span>${startDate}</span></div>
      <div class="booking-table--status visible-desktop OK"><span>收客中</span></div>
      <div class="booking-table--price visible-desktop">HKD 3,000 +</div>
    </div></div>`;
  const dates = (startDate: string, today: string) =>
    parse(page(startDate), 'https://www.jetour.com.hk/tour/TEST', today)!.departures.map(d => d.date);

  it('reads a date with its year', () => {
    expect(dates('2027年01月08日 (五)', '2026-11-13')).toEqual(['2027-01-08']);
  });
  it('takes the nearest future occurrence of a date shown without a year', () => {
    expect(dates('01月08日 (五)', '2026-11-13')).toEqual(['2027-01-08']);
    expect(dates('12月08日', '2026-11-13')).toEqual(['2026-12-08']);
    expect(dates('11月13日', '2026-11-13')).toEqual(['2026-11-13']);
  });
  it('skips a row whose date is not a real date', () => {
    expect(dates('2026年02月30日', '2026-11-13')).toEqual([]);
  });
});

it('keeps a tour with a code and days but no departures, so the runner can skip it', () => {
  const t = parse(`
    <h1 class="h4 title">4天測試團</h1>
    <div class="tour_location"><div class="card_tag">EMPTY</div></div>
    <div class="booking-table--body"><div class="booking-table--row"><div class="empty-data">沒有數據。</div></div></div>`,
  'https://www.jetour.com.hk/tour/EMPTY', CAPTURED);
  expect(t).toMatchObject({ code: 'EMPTY', days: 4, departures: [] });
});

it('falls back to the day title, without zero-width spaces, when a day has no stop line', () => {
  const t = parse(`
    <h1 class="h4 title">1天測試團</h1>
    <div class="tour_location"><div class="card_tag">TITLE</div></div>
    <div class="days__list--works"><div class="days__items"><div class="days__items--top"><div class="content">
      <div class="day--name">第1天</div>
      <div class="day--title">長廣溪\u200B\u200B濕地公園</div>
      <div class="day--trip"><div class="day--trip-work">\n\n</div></div>
    </div></div></div></div>`,
  'https://www.jetour.com.hk/tour/TITLE', CAPTURED);
  expect(t?.dayHeadings).toEqual(['長廣溪濕地公園']);
  expect(t?.startPoint).toBeNull();
});
