import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  extractStops, normaliseTour, places, scrapedTourSchema, type ScrapedTour, type Stop,
} from '@hktours/core';
import { parse } from './parse';

/** The date the fixtures were saved (Hong Kong), from docs/operators/charming.md. */
const CAPTURED = '2026-11-14';

interface Expected {
  sourceUrl: string;
  verifiedByOwner: boolean;
  notes: string[];
  scraped: ScrapedTour;
  /** Set when normaliseTour skips the tour (the edge fixture's only date is old and full). */
  normalised?: 'no-departures';
  /** normaliseTour's route, or extractStops' over the day headings when normaliseTour skips the tour. */
  stopNames: string[];
  /** Day-heading tokens the shared normaliser reports as unmatched: sights, and the places data.json lacks. */
  unmatched: string[];
}

const readFixture = (name: string) => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8');
const readJson = (name: string): Expected => JSON.parse(readFixture(name));

/** City nameZh for each stop, or region nameZh where only a region is known. */
const stopNames = (stops: Stop[]) =>
  stops.map(s => (s.cityId !== null ? places.city(s.cityId)!.nameZh : places.region(s.regionId)!.nameZh));

describe.each(['multi-city', 'simple', 'edge'])('charming %s', name => {
  const html = readFixture(`${name}.html`);
  const expected = readJson(`${name}.expected.json`);
  const parsed = () => parse(html, expected.sourceUrl, CAPTURED)!;

  it('is not yet verified by the owner, and says why each judgment call was made', () => {
    expect(expected.verifiedByOwner).toBe(false);
    expect(expected.notes.length).toBeGreaterThan(0);
  });
  it('parses to the hand-checked tour', () => {
    expect(parse(html, expected.sourceUrl, CAPTURED)).toEqual(expected.scraped);
  });
  it('passes the shared schema', () => {
    expect(scrapedTourSchema.safeParse(parsed()).success).toBe(true);
  });
  it('yields the hand-checked route', () => {
    const r = normaliseTour(parsed(), places, CAPTURED);
    if (expected.normalised !== undefined) {
      expect(r).toMatchObject({ ok: false, reason: expected.normalised });
      expect(stopNames(extractStops(parsed().dayHeadings, places).stops)).toEqual(expected.stopNames);
    } else {
      expect(r.ok).toBe(true);
      expect(r.ok && stopNames(r.tour.stops)).toEqual(expected.stopNames);
    }
    expect(r.unmatched).toEqual(expected.unmatched);
  });
});

it('the simple fixture keeps every date after the capture date, starting and ending in Hong Kong', () => {
  const expected = readJson('simple.expected.json');
  const r = normaliseTour(parse(readFixture('simple.html'), expected.sourceUrl)!, places, CAPTURED);
  expect(r.ok && r.tour.departures).toHaveLength(12);
  expect(r.ok && [r.tour.start, r.tour.end, r.tour.fromPriceHkd])
    .toEqual([{ kind: 'hk', label: null }, { kind: 'hk', label: null }, 3398]);
});

it('returns null for a non-tour page', () => {
  expect(parse('<html><body>404</body></html>', 'https://www.charming-online.com/?tour=x')).toBeNull();
});
it('returns null for empty input without throwing', () => {
  expect(parse('', 'https://www.charming-online.com/?tour=x')).toBeNull();
});

/** A tour page with the site's markup (docs/operators/charming.md): title, day entries, reservation table. */
interface Row { date: string; status?: string; code?: string; now?: string; before?: string }
function page(title: string, days: [label: string, heading: string][], rows: Row[]): string {
  const day = ([label, heading]: [string, string]) => `
    <div class="tour-journeys-day-title"><h3>${label}<span class="icon-arrow arrow-down"><i></i></span></h3></div>
    <div class="tour-journeys-detail"><div class="tour-journeys-detail-inner">
      <div class="tour-journeys-title">${heading}</div><div class="tour-journeys-content"><p>…</p></div>
    </div></div>`;
  const row = ({ date, status = 'HP', code, now, before }: Row) => `
    <div class="reservation-table-tr">
      <div class="reservation-table-td related_date">
        <div class="reservation-table-related_date">${date}</div><div class="reservation-table-status ${status}"></div>
      </div>
      ${code === undefined ? '' : `<div class="reservation-table-td tour_code"><div class="reservation-table-code">${code}</div></div>`}
      <div class="reservation-table-td adt_price">
        ${before === undefined ? '' : `<div class="detail-original-price currency-display">${before}</div>`}
        ${now === undefined ? '' : `<div class="detail-discount-price currency-display">${now}</div>`}
      </div>
      <div class="reservation-table-td chd_price"><div class="detail-discount-price currency-display">1234</div></div>
    </div>`;
  return `<html><body><div class="tour-title">${title}</div>
    <div class="tour-journeys-list"><div class="tour-journeys-list-inner">${days.map(day).join('')}</div></div>
    <div class="single-reservation-table"><div class="reservation-table-container"><div class="reservation-table">
      <div class="reservation-table-tr"><div class="reservation-table-th related_date">出發日期</div></div>
      ${rows.map(row).join('')}
    </div></div></div></body></html>`;
}
const URL_X = 'https://www.charming-online.com/?tour=f-26-test-001-x';
const HK_DAYS: [string, string][] = [['Day 1 (點擊展開行程)', '香港 ~ 廣州'], ['Day 2 (點擊展開行程)', '廣州 ~ 香港']];

it('links to the tour page itself, without a listing parameter or fragment', () => {
  const html = page('2天 測試團 ~ TEST', HK_DAYS, [{ date: '9/01/2027', now: '1998' }]);
  expect(parse(html, `${URL_X}&tour-destination=italy#booking`)!.url).toBe(URL_X);
});

describe('departure rows', () => {
  const dates = (rows: Row[]) => parse(page('2天 測試團 ~ TEST', HK_DAYS, rows), URL_X)!.departures;

  it('reads D/MM/YYYY dates and the adult price after the discount, falling back to the price before it', () => {
    expect(dates([
      { date: '26/12/2026', before: '41998', now: '38998' },
      { date: '9/01/2027', before: '41998' },
      { date: '5/3/2027', now: 'n/a' },
    ])).toEqual([
      { date: '2026-12-26', priceHkd: 38998 },
      { date: '2027-01-09', priceHkd: 41998 },
      { date: '2027-03-05', priceHkd: null },
    ]);
  });
  it('drops a full (FU) date, past or future, and keeps every other status, known or not', () => {
    expect(dates([
      { date: '30/11/2023', status: 'FU', now: '9998' },
      { date: '13/12/2026', status: 'FU', now: '2998' },
      { date: '15/12/2026', status: 'GT', now: '3298' },
      { date: '18/12/2026', status: 'GP', now: '3298' },
      { date: '20/12/2026', status: 'HP', now: '3598' },
      { date: '22/12/2026', status: 'XX', now: '3598' },
    ]).map(d => d.date)).toEqual(['2026-12-15', '2026-12-18', '2026-12-20', '2026-12-22']);
  });
  it('keeps a past date for normaliseTour to drop', () => {
    expect(dates([{ date: '6/11/2026', status: 'GT', now: '12998' }])).toEqual([{ date: '2026-11-06', priceHkd: 12998 }]);
  });
  it('skips a row whose date is not a real date', () => {
    expect(dates([{ date: '31/02/2027', now: '1998' }, { date: 'soon', now: '1998' }, { date: '1/03/2027', now: '1998' }]))
      .toEqual([{ date: '2027-03-01', priceHkd: 1998 }]);
  });
  it('gives no departures for a table with no dates', () => {
    expect(dates([])).toEqual([]);
  });
});

describe('codes and variants', () => {
  it('reads the code after the last `~` or `～`, and the days from the title', () => {
    const t = parse(page('11天 【城鄉薈萃】意大利深度遊 ～ GHTG', HK_DAYS, [{ date: '9/01/2027', now: '35998' }]), URL_X)!;
    expect([t.code, t.days, t.title]).toEqual(['GHTG', 11, '11天 【城鄉薈萃】意大利深度遊 ～ GHTG']);
  });
  it('takes the longest variant, with only its own rows (codes whose day count has a leading zero, too)', () => {
    const t = parse(page('3/4 天 溫哥華/維多利亞 冬季逍遙遊 ～ WVJ3/4', HK_DAYS, [
      { date: '1/12/2026', code: 'WVJ03O-261201', now: '2798' },
      { date: '1/12/2026', code: 'WVJ04O-261201', now: '3798' },
      { date: '8/12/2026', code: 'WVJ04O-261208', status: 'FU', now: '3798' },
    ]), URL_X)!;
    expect([t.code, t.days, t.departures]).toEqual(['WVJ4', 4, [{ date: '2026-12-01', priceHkd: 3798 }]]);
  });
  it('takes the first variant when the variants have the same day count', () => {
    const t = parse(page('6天 雲南 ~ PCYBK/L', HK_DAYS, [
      { date: '1/12/2026', code: 'PCYBK06R-261201', now: '5998' },
      { date: '1/12/2026', code: 'PCYBL06R-261201', now: '6998' },
    ]), URL_X)!;
    expect([t.code, t.days, t.departures]).toEqual(['PCYBK', 6, [{ date: '2026-12-01', priceHkd: 5998 }]]);
  });
  it('expands full codes after the slash as they are', () => {
    expect(parse(page('8/9天 華中 ~ GCCTV/GCCTW', HK_DAYS, [{ date: '1/12/2026', code: 'GCCTW09R-261201', now: '5998' }]), URL_X)!.code)
      .toBe('GCCTW');
  });
  it('leaves out the days a label tags with the other variant only', () => {
    const t = parse(page('2/3天 測試團 ~ TSTA/B', [
      ['Day 1', '香港 ~ 巴黎'], ['Day 2 - TSTA', '巴黎 ~ 香港'], ['Day 2 - TSTB', '巴黎 ~ 倫敦'], ['Day 3 - TSTB', '倫敦 ~ 香港'],
    ], [{ date: '1/12/2026', code: 'TSTB03E-261201', now: '9998' }]), URL_X)!;
    expect(t.dayHeadings).toEqual(['香港 ~ 巴黎', '巴黎 ~ 倫敦', '倫敦 ~ 香港']);
  });
  it('takes the longest variant that has rows, when the longest has none', () => {
    const t = parse(page('11/12天 歐洲 ~ GERD/E', HK_DAYS, [{ date: '19/12/2026', code: 'GERD11E-261219', now: '39898' }]), URL_X)!;
    expect([t.code, t.days, t.departures]).toEqual(['GERD', 11, [{ date: '2026-12-19', priceHkd: 39898 }]]);
  });
  it('takes, among variants as long with rows on the same dates, the one with the lowest price over all its rows', () => {
    const t = parse(page('19天 北極圈 ~ GSAOA/B/O《2027》', HK_DAYS, [
      { date: '10/06/2027', code: 'GSAOB19K-270610', now: '90000' },
      { date: '10/06/2027', code: 'GSAOO19K-270610', now: '80000' },
      { date: '17/06/2027', code: 'GSAOB19K-270617', now: '91000' },
      { date: '17/06/2027', code: 'GSAOO19K-270617', status: 'FU', now: '81000' }, // full still counts for the choice
    ]), URL_X, CAPTURED)!;
    expect([t.code, t.days, t.departures.map(d => d.priceHkd)]).toEqual(['GSAOO', 19, [80000]]);
  });
  it('keeps the same code from night to night: a cheaper row that passes does not flip the choice', () => {
    const rows = [
      { date: '10/12/2026', code: 'GSAOA19K-261210', now: '90000' },
      { date: '10/12/2026', code: 'GSAOB19K-261210', now: '50000' },
      { date: '10/06/2027', code: 'GSAOA19K-270610', now: '90000' },
      { date: '10/06/2027', code: 'GSAOB19K-270610', now: '95000' },
    ];
    const html = page('19天 北極圈 ~ GSAOA/B', HK_DAYS, rows);
    const codes = ['2026-11-14', '2026-12-11', '2027-01-01'].map(today => parse(html, URL_X, today)!.code);
    expect(codes).toEqual(['GSAOB', 'GSAOB', 'GSAOB']);
  });
  it('takes the first of variants as long whose rows are on different dates, whatever the prices', () => {
    const t = parse(page('19天 北極圈 ~ GSAOA/B', HK_DAYS, [
      { date: '10/06/2027', code: 'GSAOA19K-270610', now: '90000' },
      { date: '17/06/2027', code: 'GSAOB19K-270617', now: '50000' },
    ]), URL_X, CAPTURED)!;
    expect(t.code).toBe('GSAOA');
  });
  it('takes the first on a tie of lowest prices', () => {
    const t = parse(page('19天 北極圈 ~ GSAOA/B', HK_DAYS, [
      { date: '10/06/2027', code: 'GSAOA19K-270610', now: '85000' },
      { date: '10/06/2027', code: 'GSAOB19K-270610', now: '85000' },
    ]), URL_X, CAPTURED)!;
    expect(t.code).toBe('GSAOA');
  });
  it('gives a row to the longest code that starts it, followed by a digit (GVRB/GVRBX)', () => {
    const t = parse(page('8/10天 加拿大 ~ GVRB/GVRBX', HK_DAYS, [
      { date: '2/01/2027', code: 'GVRB08A-270102', now: '12000' },
      { date: '5/01/2027', code: 'GVRBX10A-270105', now: '15000' },
    ]), URL_X)!;
    expect([t.code, t.days, t.departures]).toEqual(['GVRBX', 10, [{ date: '2027-01-05', priceHkd: 15000 }]]);
  });
  it('is null when a table with no code column lists an open upcoming date for variants of different lengths (GAKA/GAKVA)', () => {
    const title = '11/14天 【CEO系列】津巴布韋、肯尼亞 ~ GAKA/GAKVA';
    expect(parse(page(title, HK_DAYS, [{ date: '13/12/2026', now: '60000' }]), URL_X, CAPTURED)).toBeNull();
    expect(parse(page(title, HK_DAYS, [{ date: '13/08/2026', now: '60000' }]), URL_X)).toBeNull(); // no today: every date counts
    expect(parse(page(title, HK_DAYS, []), URL_X)).toMatchObject({ code: 'GAKVA', days: 14, departures: [] });
  });
  it('gives the longest variant with no departures when those rows are all past or full (skipped as no-departures)', () => {
    const title = '11/14天 【CEO系列】津巴布韋、肯尼亞 ~ GAKA/GAKVA';
    const rows = [{ date: '13/08/2026', status: 'FU', now: '60000' }, { date: '1/11/2026', now: '60000' }, { date: '20/12/2026', status: 'FU', now: '60000' }];
    expect(parse(page(title, HK_DAYS, rows), URL_X, CAPTURED)).toMatchObject({ code: 'GAKVA', days: 14, departures: [] });
  });
  it('gives rows that two variants with the same letters and days could both claim to the first only', () => {
    const t = parse(page('5天 測試團 ~ ABC1/2', HK_DAYS, [
      { date: '1/12/2026', code: 'ABC05X-261201', now: '5000' },
      { date: '8/12/2026', code: 'ABC05X-261208', now: '6000' },
    ]), URL_X)!;
    expect([t.code, t.departures.map(d => d.date)]).toEqual(['ABC1', ['2026-12-01', '2026-12-08']]);
    const split = parse(page('5天 測試團 ~ ABC1/2', HK_DAYS, [
      { date: '1/12/2026', code: 'ABC105X-261201', now: '5000' },
      { date: '8/12/2026', code: 'ABC205X-261208', now: '6000' },
    ]), URL_X)!;
    expect([split.code, split.departures.map(d => d.date)]).toEqual(['ABC1', ['2026-12-01']]);
  });
  it('gives every row to the longest variant when the table has no code column (cabin grades on the same dates)', () => {
    const t = parse(page('11天 河船 ~ GRCSB/A/S', HK_DAYS, [
      { date: '1/12/2026', now: '30000' }, { date: '8/12/2026', status: 'FU', now: '30000' },
    ]), URL_X)!;
    expect([t.code, t.departures]).toEqual(['GRCSB', [{ date: '2026-12-01', priceHkd: 30000 }]]);
  });
  it('gives no departures, not null, for a page with variants and no dated rows', () => {
    expect(parse(page('5天 越南 ~ ZSGN/ZSGB', HK_DAYS, []), URL_X)).toMatchObject({ code: 'ZSGN', days: 5, departures: [] });
  });
  it('reads a variant code before the day label, and a tag naming two variants', () => {
    const t = parse(page('2/3天 測試團 ~ TSTA/B', [
      ['TSTA Day 1', '香港 ~ 羅馬'], ['TSTB Day 1', '香港 ~ 巴黎'], ['Day 2 - TSTA/B', '巴黎 ~ 倫敦'], ['TSTB Day 3', '倫敦 ~ 香港'],
    ], [{ date: '1/12/2026', code: 'TSTB03E-261201', now: '9998' }]), URL_X)!;
    expect(t.dayHeadings).toEqual(['香港 ~ 巴黎', '巴黎 ~ 倫敦', '倫敦 ~ 香港']);
  });
  it('is null when no row is the chosen variant\'s (its codes are not read as expected)', () => {
    expect(parse(page('11/12天 歐洲 ~ GERD/E', HK_DAYS, [{ date: '19/12/2026', code: 'ZZZ12E-261219', now: '45498' }]), URL_X))
      .toBeNull();
  });
  it.each([
    ['GHTH', '10天 意大利深度遊 ~ GHTH 《農曆新年2027》'],
    ['PCJSC', '12天 南疆【一年一度胡楊季】秘境遊 ~ PCJSC【南疆旅遊團｜售罄加開・最後一團】'],
    ['GEFM', '10天 德國、奧地利[金秋阿爾卑斯] ~ GEFM (增遊法國童話夢幻小鎮:科爾馬)'],
    ['CODE', '10天 意大利 ~ 羅馬 ~ ABC (假期) ~ CODE'],
  ])('reads the code %s before a bracketed note at the end of the title', (code, title) => {
    expect(parse(page(title, HK_DAYS, [{ date: '9/01/2027', now: '1998' }]), URL_X)?.code).toBe(code);
  });
  it.each([
    ['no code', '11天 意大利深度遊'],
    ['a note that is not in brackets after the code', '11天 意大利深度遊 ~ GHTG 農曆新年'],
    ['a code with a space', '11天 意大利深度遊 ~ GH TG'],
    ['day counts that do not pair with the codes', '11/12/13天 歐洲 ~ GERD/E'],
    ['two day counts for one code', '6/7天 洛磯山 ~ RWB6'],
  ])('is null for a title with %s', (_, title) => {
    expect(parse(page(title, HK_DAYS, [{ date: '9/01/2027', now: '1998' }]), URL_X)).toBeNull();
  });
  it('takes the days from the last day label when the title gives none (`Day 5/6`: 6)', () => {
    const t = parse(page('杜拜悠閒之旅 ~ GDXD', [['Day 1', '香港 ~ 杜拜'], ['Day 5/6', '杜拜 ~ 香港']], []), URL_X)!;
    expect(t.days).toBe(6);
  });
});

describe('day headings and start and end points', () => {
  const tour = (days: [string, string][]) =>
    parse(page('5天 冬季 洛磯山 皇御之旅 ~ RWC5', days, [{ date: '18/12/2026', now: '9198' }]), URL_X)!;

  it('keeps only day entries (full-width digits too), not notes such as the gathering time and place', () => {
    const t = tour([
      ['Day 1 (點擊展開行程)', '香港 ~ 南京'], ['Day ４ (點擊展開行程)', '南京 ~ 香港'],
      ['集合時間及地點', '集合時間及地點(早上)'], ['旅遊須知', '旅遊須知：'],
    ]);
    expect(t.dayHeadings).toEqual(['香港 ~ 南京', '南京 ~ 香港']);
  });
  it('a tour joined abroad (`原居地`, home city) starts and ends at its first and last place, which are not stops', () => {
    const t = tour([
      ['Day 1', '原居地 ~ 溫哥華'], ['Day 2', '溫哥華 ~ 三文灣 / 灰熊鎮'], ['Day 3', '三文灣 / 灰熊鎮 ~ 班夫'],
      ['Day 4', '班夫 ~ 卡加利'], ['Day 5', '卡加利 ~ 溫哥華 ~ 原居地'],
    ]);
    expect([t.startPoint, t.endPoint]).toEqual(['溫哥華', '溫哥華']);
    const r = normaliseTour(t, places, CAPTURED);
    expect(r.ok && [r.tour.start, r.tour.end]).toEqual([{ kind: 'other', label: '溫哥華' }, { kind: 'other', label: '溫哥華' }]);
    // 三文灣 (Salmon Arm) is in the places list since the EGL review round; 灰熊鎮 is not.
    expect(r.ok && stopNames(r.tour.stops)).toEqual(['三文灣', '班夫', '卡加利']);
  });
  it('a start and end abroad without `原居地` count only when the page gives a gathering time and place', () => {
    const days: [string, string][] = [['Day 1', '溫哥華 ~ 基隆那'], ['Day 2', '甘露市 ~ 溫哥華']];
    expect([tour(days).startPoint, tour(days).endPoint]).toEqual([null, null]);
    const gathering = tour([...days, ['集合時間及地點', '集合時間及地點(早上)']]);
    expect([gathering.startPoint, gathering.endPoint]).toEqual(['溫哥華', '溫哥華']);
  });
  it('a Hong Kong tour whose last heading names only sights abroad ends in Hong Kong, not there', () => {
    const t = tour([['Day 1', '香港 ~ 青島（八大關風景區）'], ['Day 2', '青島（中山公園- 龍江路- 雲上海天）']]);
    expect([t.startPoint, t.endPoint]).toEqual(['香港', null]);
    const r = normaliseTour(t, places, CAPTURED);
    expect(r.ok && [r.tour.start, r.tour.end]).toEqual([{ kind: 'hk', label: null }, { kind: 'hk', label: null }]);
  });
  it('the start and end points lose bracketed notes, and are null when too long to be a place', () => {
    const t = tour([['Day 1', '香港 ~ 羅馬[意大利]'], ['Day 2', '米蘭 ~ 是日早上自由活動後前往機場乘搭客機返回香港']]);
    expect([t.startPoint, t.endPoint]).toEqual(['香港', null]);
    expect(tour([['Day 1', '深圳灣口岸[集合] ~ 佛山'], ['Day 2', '佛山 ~ 深圳灣口岸']]).startPoint).toBe('深圳灣口岸');
  });
  it('removes bracketed notes before splitting at `~`, so a `~` inside brackets splits nothing', () => {
    const t = tour([['集合時間及地點', '集合時間及地點'], ['Day 1', '原居地 ~ 溫哥華'], ['Day 2', '溫哥華(市區 ~ 史丹利公園)']]);
    expect(t.endPoint).toBe('溫哥華');
  });
  it('drops the either/or flight leg next to Hong Kong on the first and last days only', () => {
    const t = tour([
      ['Day 1', '香港 ~ 杭州/ 上海 ~ 寧波'], ['Day 2', '寧波 ~ 比薩/路加'], ['Day 3', '德清 ~ 上海/ 杭州 ~ 香港'],
    ]);
    expect(t.dayHeadings).toEqual(['香港 ~ 寧波', '寧波 ~ 比薩/路加', '德清 ~ 香港']);
  });
  it('keeps a first or last day with no either/or leg next to Hong Kong as the page gives it', () => {
    const t = tour([['Day 1', '香港 ~ 羅馬[意大利] ~ 杭州/上海'], ['Day 2', '米蘭 ～ 自由購物 ～ 香港']]);
    expect(t.dayHeadings).toEqual(['香港 ~ 羅馬[意大利] ~ 杭州/上海', '米蘭 ～ 自由購物 ～ 香港']);
  });
});
