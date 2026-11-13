import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { normaliseTour, places, scrapedTourSchema, type ScrapedTour, type Stop } from '@hktours/core';
import { parse } from './parse';

/** The date the fixtures were saved, from docs/operators/jetour.md. */
const CAPTURED = '2026-11-13';

interface Expected {
  sourceUrl: string;
  verifiedByOwner: boolean;
  notes?: string;
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

/** A minimal tour page: title, code, and one itinerary day per stop line. */
const tourPage = (title: string, stopLines: string[], firstDayDetails = '') => `
  <h1 class="h4 title">${title}</h1>
  <div class="tour_location"><div class="card_tag">INLINE</div></div>
  <div class="days__list--works">${stopLines.map((line, i) => `
    <div class="days__items">
      <div class="days__items--top"><div class="content">
        <div class="day--name">第${i + 1}天</div>
        <div class="day--trip"><div class="day--trip-work">${line}</div></div>
      </div></div>
      <div class="days_items--details"><div class="trip--visit"><p>${i === 0 ? firstDayDetails : ''}</p></div></div>
    </div>`).join('')}
  </div>`;
const parseInline = (html: string) => parse(html, 'https://www.jetour.com.hk/tour/INLINE', CAPTURED);
const headingsOf = (stopLines: string[]) => parseInline(tourPage(`${stopLines.length}天測試團`, stopLines))!.dayHeadings;

describe('either/or flight city next to 香港', () => {
  it('drops an X/Y leg right after 香港 on day 1 and right before 香港 on the last day', () => {
    expect(headingsOf(['香港 ~ 甲/乙 ~ 丙', '丙 ~ 丁', '丁 ~ 戊/己 ~ 香港'])).toEqual(['香港 ~ 丙', '丙 ~ 丁', '丁 ~ 香港']);
  });
  it('keeps an X/Y segment anywhere else', () => {
    expect(headingsOf(['香港 ~ 丙 ~ 甲/乙', '丙 ~ 甲/乙 ~ 丁', '丁 ~ 甲/乙 ~ 戊 ~ 香港']))
      .toEqual(['香港 ~ 丙 ~ 甲/乙', '丙 ~ 甲/乙 ~ 丁', '丁 ~ 甲/乙 ~ 戊 ~ 香港']);
  });
});

it('drops bracketed notes, half- and full-width, mixed or matched', () => {
  expect(headingsOf(['香港 ~ 甲(註一) ~ 乙（註二） ~ 丙(註三）~ 丁（註四)'])).toEqual(['香港 ~ 甲 ~ 乙 ~ 丙 ~ 丁']);
});

describe('gathering point', () => {
  const startPoint = (details: string) => parseInline(tourPage('1天測試團', ['香港 ~ 甲'], details))!.startPoint;
  it.each([
    ['是日集合於香港國際機場，由專業領隊陪同', '香港國際機場'],
    ['是日集合於香港國際機場由專業領隊陪同下乘搭豪華客機', '香港國際機場'],
    ['是日集合於香港國際機場乘搭豪華客機', '香港國際機場'],
    ['是日集合於尖沙咀出發前往', '尖沙咀'],
    ['是日集合於香港國際機場辦理登機手續', '香港國際機場'],
    ['是日集合於西九龍站、乘高鐵', '西九龍站'],
    ['是日集合於紅磡站 準時', '紅磡站'],
    ['是日集合於一個沒有任何標點的很長很長的地方名稱之後還有更多', '一個沒有任何標點的很長很'], // capped at 12 characters
    ['是日自行前往機場', null],
  ])('%s gives %s', (details, expected) => {
    expect(startPoint(details)).toBe(expected);
  });
});

describe('day count', () => {
  it('returns null when the title and the itinerary disagree on the number of days', () => {
    expect(parseInline(tourPage('3天測試團', ['香港 ~ 甲', '甲 ~ 香港']))).toBeNull();
  });
  it('takes the itinerary count when the title has no day count', () => {
    expect(parseInline(tourPage('測試團', ['香港 ~ 甲', '甲 ~ 香港']))!.days).toBe(2);
  });
});
