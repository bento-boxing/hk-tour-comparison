import { readFileSync } from 'node:fs';
import { load } from 'cheerio';
import { describe, expect, it } from 'vitest';
import { normaliseTour, places, scrapedTourSchema, type ScrapedTour, type Stop } from '@hktours/core';
import { parse } from './parse';

/** The date the fixtures were saved, from docs/operators/texpert.md. */
const CAPTURED = '2026-11-13';

interface Expected {
  sourceUrl: string;
  verifiedByOwner: boolean;
  scraped: ScrapedTour | null;
  stopNames: string[];
  /** Day-heading tokens the shared normaliser reports as unmatched: attractions, crossings, meals, not places. */
  unmatched: string[];
}

const readFixture = (name: string) => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8');
const readJson = (name: string): Expected => JSON.parse(readFixture(name));

/** City nameZh for each stop, or region nameZh where only a region is known. */
const stopNames = (stops: Stop[]) =>
  stops.map(s => (s.cityId !== null ? places.city(s.cityId)!.nameZh : places.region(s.regionId)!.nameZh));

describe.each(['multi-city', 'simple', 'edge'])('texpert %s', name => {
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
    // The brief asks for []: Travel Expert's headings also name attractions, meals and border crossings,
    // which no places list holds. The hand-written list holds only such names; a real place belongs in data.json.
    expect(r.unmatched).toEqual(expected.unmatched);
  });
  it('carries each day heading as the page gives it, one per itinerary day', () => {
    // Replaces the brief's 80-character limit, which Travel Expert's real headings exceed (up to 142 characters).
    const $ = load(html);
    const headingTexts = $('details summary h3').toArray()
      .map(h3 => $(h3).text().replace(/^Day\s*\d+/, '').replace(/\s+/g, ' ').trim());
    const t = parse(html, expected.sourceUrl, CAPTURED)!;
    expect(t.dayHeadings.length).toBe(t.days);
    expect(t.dayHeadings).toEqual(headingTexts);
  });
});

it('returns null for a non-tour page', () => { expect(parse('<html><body>404</body></html>', 'https://www.texpert.com/x')).toBeNull(); });
it('returns null for empty input without throwing', () => { expect(parse('', 'https://www.texpert.com/x')).toBeNull(); });

it('drops the query string and fragment from the url', () => {
  const url = 'https://www.texpert.com/zh-hk/tour/1386-guangdong-tour-2-day-pure-play-with-special-natural-sea-hot';
  expect(parse(readFixture('simple.html'), `${url}?ref=x#booking`, CAPTURED)!.url).toBe(url);
});

describe('departure status', () => {
  const multiCity = readFixture('multi-city.html');
  const URL_1272 = 'https://www.texpert.com/zh-hk/tour/1272-5-day-hengyang-changsha-zhangjiajie-fenghuang-ancient-city';
  const dates = (html: string) => parse(html, URL_1272, CAPTURED)!.departures.map(d => d.date);
  const allDates = dates(multiCity);
  /** Inside the page, the flight data is a JavaScript string, so its JSON quotes appear as `\"`. */
  const q = (json: string) => json.replaceAll('"', '\\"');
  const FIRST_INVENTORY = q('{"date":"2026-11-27","salePeriod":0,"inventory":9,');
  const HIGHLIGHT_1213 = q('{"type":"HotRecommended","date":"2026-12-13"');

  it('the fixture has the flight data these tests rewrite', () => {
    expect(allDates).toHaveLength(45);
    expect(multiCity.split(FIRST_INVENTORY).length).toBe(2);
    expect(multiCity.split(HIGHLIGHT_1213).length).toBe(2);
    expect(multiCity.split(q('"isSoldOut":false')).length).toBe(3);
  });

  it('drops a date with no seats left', () => {
    const html = multiCity.replace(FIRST_INVENTORY, q('{"date":"2026-11-27","salePeriod":0,"inventory":0,'));
    expect(dates(html)).toEqual(allDates.filter(d => d !== '2026-11-27'));
  });
  it.each(['Full', 'AlreadyFull', 'SoldOut'])('drops a date highlighted as %s', type => {
    const html = multiCity.replace(HIGHLIGHT_1213, q(`{"type":"${type}","date":"2026-12-13"`));
    expect(dates(html)).toEqual(allDates.filter(d => d !== '2026-12-13'));
  });
  it.each(['HotRecommended', 'AlreadyFormed', 'WillFormSoon', 'SomethingNew'])('keeps a date highlighted as %s', type => {
    const html = multiCity.replace(HIGHLIGHT_1213, q(`{"type":"${type}","date":"2026-12-13"`));
    expect(dates(html)).toEqual(allDates);
  });
  it.each([
    ['sold out', '"isSoldOut":false', '"isSoldOut":true'],
    ['not purchasable', '"isPurchasable":true', '"isPurchasable":false'],
    ['expired', '"isExpired":false', '"isExpired":true'],
  ])('keeps the tour but no dates when the tour is %s', (_, from, to) => {
    const t = parse(multiCity.replaceAll(q(from), q(to)), URL_1272, CAPTURED);
    expect(t).toMatchObject({ code: 'TDZC05R', days: 5, departures: [] });
  });
});

describe('flight data', () => {
  /** A page whose flight data is `rows`, split into `self.__next_f.push([1,…])` scripts at the given offsets. */
  const page = (rows: string, splitAt: number[] = [], extraHtml = '') => {
    const cuts = [0, ...splitAt, rows.length];
    const scripts = cuts.slice(1).map((end, i) =>
      `<script>self.__next_f.push([1,${JSON.stringify(rows.slice(cuts[i], end))}])</script>`).join('');
    return `<html><body><h1>3天測試團</h1>
      <details><summary><h3><span><span>Day 1</span><span>深圳口岸集合→廣州</span></span></h3></summary></details>
      <details><summary><h3><span><span>Day 2</span><span>廣州</span></span></h3></summary></details>
      <details><summary><h3><span><span>Day 3</span><span>廣州→深圳灣口岸解散</span></span></h3></summary></details>
      ${extraHtml}
      <script>(self.__next_f=self.__next_f||[]).push([0])</script>${scripts}</body></html>`;
  };
  const tourRow = (code: string) =>
    `4a:["$","$L4e",null,{"code":"${code}","departures":[],"duration":3,"isExpired":false,"minSalePrice":1999,"title":"3天測試團"}]\n`;
  const bookingRow = (prices: string) =>
    `4c:["$","$L50",null,{"id":"9","isSoldOut":false,"isPurchasable":true,"products":[{"id":1,"prices":[${prices}]}]}]\n`;
  const price = (date: string, sellingPrice: unknown) =>
    JSON.stringify({ date, inventory: 9, sellingPrice, serviceFee: 160 });

  it('reads rows that follow a text row with no newline, whose length counts UTF-8 bytes', () => {
    const text = '行程：廣州一天遊\n第二行';
    const rows = `3:I["x"]\n44:T${Buffer.byteLength(text).toString(16)},${text}${tourRow('TEST01')}${bookingRow(price('2027-01-08', 1999))}`;
    expect(parse(page(rows), 'https://www.texpert.com/zh-hk/tour/9-test', CAPTURED)).toMatchObject({
      code: 'TEST01', days: 3, title: '3天測試團',
      departures: [{ date: '2027-01-08', priceHkd: 1999 }],
    });
  });
  it('joins rows split across several scripts', () => {
    const rows = `${tourRow('SPLIT1')}${bookingRow(`${price('2027-01-08', 1999)},${price('2027-01-15', 2099)}`)}`;
    const t = parse(page(rows, [20, rows.indexOf('2027-01-15') + 3]), 'https://www.texpert.com/zh-hk/tour/9-test', CAPTURED);
    expect(t?.code).toBe('SPLIT1');
    expect(t?.departures).toEqual([{ date: '2027-01-08', priceHkd: 1999 }, { date: '2027-01-15', priceHkd: 2099 }]);
  });
  it('takes the selling price, not the service fee, and keeps a date whose price is missing or junk', () => {
    const rows = `${tourRow('PRICE1')}${bookingRow([
      price('2027-01-08', 1999), price('2027-01-09', null), price('2027-01-10', 50), price('2027-01-11', '1999'),
    ].join(','))}`;
    expect(parse(page(rows), 'https://www.texpert.com/zh-hk/tour/9-test', CAPTURED)?.departures).toEqual([
      { date: '2027-01-08', priceHkd: 1999 }, { date: '2027-01-09', priceHkd: null },
      { date: '2027-01-10', priceHkd: null }, { date: '2027-01-11', priceHkd: null },
    ]);
  });
  it('skips a price row whose date is not a real date', () => {
    const rows = `${tourRow('DATE01')}${bookingRow(`${price('2027-02-30', 1999)},${price('soon', 1999)}`)}`;
    expect(parse(page(rows), 'https://www.texpert.com/zh-hk/tour/9-test', CAPTURED)?.departures).toEqual([]);
  });
  it('falls back to the flight duration and minimum price when the page has no JSON-LD', () => {
    const t = parse(page(tourRow('NOLD01')), 'https://www.texpert.com/zh-hk/tour/9-test', CAPTURED);
    expect(t).toMatchObject({ code: 'NOLD01', days: 3, fromPriceHkd: 1999, startPoint: '深圳口岸', endPoint: '深圳灣口岸' });
  });
  it('ignores flight data that is not valid, without throwing', () => {
    const html = page('').replace('</body>', '<script>self.__next_f.push([1,"4a:[{\\"code\\":"])</script></body>');
    expect(parse(html, 'https://www.texpert.com/zh-hk/tour/9-test', CAPTURED)).toBeNull();
  });
  it('returns null when the tour has no day count', () => {
    const rows = '4a:["$","$L4e",null,{"code":"NODAYS","departures":[],"duration":null,"title":"測試團"}]\n';
    expect(parse(page(rows), 'https://www.texpert.com/zh-hk/tour/9-test', CAPTURED)).toBeNull();
  });
});

describe('gathering and dismissal points', () => {
  const page = (headings: string[]) => `<h1>測試團</h1>
    <script type="application/ld+json">[{"@type":["Product","TouristTrip"],"offers":{"@type":"Offer","price":999},
      "additionalProperty":{"@type":"PropertyValue","propertyID":"tourDurationDays","value":${headings.length}}}]</script>
    ${headings.map((h, i) => `<details><summary><h3><span><span>Day ${i + 1}</span><span>${h}</span></span></h3></summary></details>`).join('')}
    <script>self.__next_f.push([1,${JSON.stringify('4a:{"code":"PTS001","duration":9}\n')}])</script>`;
  const points = (...headings: string[]) => {
    const t = parse(page(headings), 'https://www.texpert.com/zh-hk/tour/9-test', CAPTURED)!;
    return [t.startPoint, t.endPoint];
  };

  it('reads them from the first and last day headings', () => {
    expect(points('(地鐵) 福田口岸集合 > 廣州', '廣州 > 深圳灣口岸散 團。結束愉快行程！')).toEqual(['福田口岸', '深圳灣口岸']);
  });
  it('is null when a heading names no gathering or dismissal place', () => {
    expect(points('廣州 > 佛山', '佛山 > 廣州')).toEqual([null, null]);
    expect(points('集合 > 廣州', '廣州 > 散團')).toEqual([null, null]);
  });
  it('is null when the text before the marker is too long to be a place', () => {
    expect(points('早上於指定地點與領隊及其他團友一同乘車前往口岸集合 > 廣州', '廣州')).toEqual([null, null]);
  });
  it('reads the days from JSON-LD and the from price from a single Offer', () => {
    expect(parse(page(['廣州', '佛山']), 'https://www.texpert.com/zh-hk/tour/9-test', CAPTURED))
      .toMatchObject({ days: 2, fromPriceHkd: 999, title: '測試團' });
  });
});
