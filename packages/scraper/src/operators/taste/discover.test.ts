import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { DRY_RUN_LOG, PUBLIC_LOG } from '../../public-log';
import type { Fetcher } from '../../types';
import {
  discoverTours, eventUrl, isTourUrl, listUrl, MAX_LIST_PAGES, readListPage, tourIdOf, tourPageUrl,
} from './discover';
import { rawListPage, type RawCard } from './test-responses';

const SITE = 'https://tastetravel.com.hk';

describe('the request URLs', () => {
  it('are the three path shapes the brief allows, on https://tastetravel.com.hk', () => {
    expect(listUrl(0)).toBe(`${SITE}/tour/select/page/0`);
    expect(listUrl(310)).toBe(`${SITE}/tour/select/page/310`);
    expect(tourPageUrl('693')).toBe(`${SITE}/tour/detail/tour_id/693`);
    expect(eventUrl('693')).toBe(`${SITE}/tour/event/tour_id/693`);
  });
  it.each(['', '69 3', '693/download', '-1', '0693x', '1'.repeat(10)])('refuse a tour id that is not a plain number (%j)', id => {
    expect(() => tourPageUrl(id)).toThrow(/not a Taste Travel tour id/);
    expect(() => eventUrl(id)).toThrow(/not a Taste Travel tour id/);
  });
  it.each([-10, 5, 1.5, NaN])('refuse an offset that is not a multiple of 10 from 0 (%s)', offset => {
    expect(() => listUrl(offset)).toThrow(/not a list offset/);
  });
});

describe('tour pages', () => {
  it('are /tour/detail/tour_id/<n>, which is also the tour\'s identity and link back', () => {
    expect(tourIdOf(`${SITE}/tour/detail/tour_id/1175`)).toBe('1175');
    expect(isTourUrl(`${SITE}/tour/detail/tour_id/693`)).toBe(true);
  });
  it.each([
    'http://tastetravel.com.hk/tour/detail/tour_id/693',
    'https://www.tastetravel.com.hk/tour/detail/tour_id/693',
    `${SITE}/tour/event/tour_id/693`,
    `${SITE}/tour/download/tour_id/693`,
    `${SITE}/tour/whatsapp/tour_id/693`,
    `${SITE}/tour/detail/tour_id/693?x=1`,
    `${SITE}/tour/detail/tour_id/693/`,
    `${SITE}/assets/uploads/tour/693/pdf.pdf`,
  ])('anything else is not one (%s)', url => {
    expect(tourIdOf(url)).toBeNull();
    expect(isTourUrl(url)).toBe(false);
  });
});

describe('readListPage', () => {
  it('keeps the cards with a tour code and a day count, by tour id, and counts the others by kind', () => {
    const page = readListPage(rawListPage({
      next: true,
      cards: [
        { href: 1159, title: 'FYA10 - 雲南十天', days: '10天' },
        { href: 1114, title: 'SJS12 - ', days: '12天' }, // an empty title is still a tour
        { href: 2001, title: '郵輪套票', days: '5天' },
        { href: 2002, title: 'HTL01 - 酒店', days: null },
        { href: `${SITE}/tour/download/tour_id/2003`, title: 'ABC03 - 下載', days: '3天' },
        { href: 2004, title: '門票', days: null },
      ],
    }));
    expect(page.tours).toEqual([{ id: '1159', code: 'FYA10' }, { id: '1114', code: 'SJS12' }]);
    expect(page.leftOut).toEqual({ 'no tour code': 2, 'no day count': 1, 'not a tour page link': 1 });
    expect(page.next).toBe(true);
    expect(page.total).toBe(311);
  });

  // The same codes as a tour page's `團號：` (public.ts): letters, digits, `_` and `-`, 1 to 40 of them.
  it.each([
    ['FYA10 - 雲南十天', 'FYA10'],
    ['SJS12 - ', 'SJS12'],
    ['SJS12 -', 'SJS12'],
    ['CAK-03 - 江門3天', 'CAK-03'],
    ['CAK_03 - 江門3天', 'CAK_03'],
    ['A - 江門3天', 'A'],
    ['CAK03 - 江門-開平3天', 'CAK03'],
    ['CAK03 - 江門 - 開平3天', 'CAK03'],
    ['CAK-03 - 江門 - 開平3天', 'CAK-03'],
    ['CAK03  -  江門3天', 'CAK03'],
    [`${'A'.repeat(40)} - 江門3天`, 'A'.repeat(40)],
  ])('reads the tour code of a card titled %j as %j', (title, code) => {
    const page = readListPage(rawListPage({ cards: [{ href: 1159, title, days: '3天' }] }));
    expect(page.tours).toEqual([{ id: '1159', code }]);
    expect(page.leftOut).toEqual({});
  });

  it.each([
    '郵輪套票', '江門3天', 'CAK03-江門3天', 'CAK03 -江門3天', 'CAK03 江門3天', 'CAK.03 - 江門3天', '團號 CAK03 - 江門3天',
    `${'A'.repeat(41)} - 江門3天`, ' - 江門3天',
  ])('finds no tour code in a card titled %j', title => {
    const page = readListPage(rawListPage({ cards: [{ href: 1159, title, days: '3天' }] }));
    expect(page.tours).toEqual([]);
    expect(page.leftOut).toEqual({ 'no tour code': 1 });
  });

  it('sees the last page by its missing next-page link (下一頁)', () => {
    expect(readListPage(rawListPage({ offset: 310, next: false })).next).toBe(false);
    expect(readListPage(rawListPage({ offset: 150, next: true })).next).toBe(true);
  });

  it('reads which page the site says it is, from the pager\'s current-page marker (a.selected)', () => {
    expect(readListPage(rawListPage({ offset: 0, next: true })).current).toBe(1);
    expect(readListPage(rawListPage({ offset: 150, next: true })).current).toBe(16);
    expect(readListPage(rawListPage({ offset: 310 })).current).toBe(32);
    expect(readListPage(rawListPage({ current: null })).current).toBeNull();
  });

  it('throws, with a fixed text, for a page that is not a list page', () => {
    expect(() => readListPage('<html><body>Attention Required!</body></html>')).toThrow('taste: not a list page');
  });
});

/** A fetcher answering list pages by offset; anything else is null. */
function listFetcher(pages: Record<number, string>) {
  const asked: string[] = [];
  const options: unknown[] = [];
  const fetcher: Fetcher = {
    fetchText: async (url, opts) => {
      asked.push(url);
      options.push(opts);
      const offset = /\/tour\/select\/page\/(\d+)$/.exec(url)?.[1];
      return offset === undefined ? null : pages[Number(offset)] ?? null;
    },
    postJson: async url => { throw new Error(`POSTed ${url}`); },
  };
  return { fetcher, asked, options };
}
const cards = (from: number, n: number): RawCard[] =>
  Array.from({ length: n }, (_, i) => ({ href: from + i, title: `T${String(from + i).padStart(4, '0')}03 - 三天`, days: '3天' }));

describe('discoverTours', () => {
  it('reads the list page by page, by offsets of 10 from 0, until the page with no next link', async () => {
    const { fetcher, asked, options } = listFetcher({
      0: rawListPage({ offset: 0, next: true, total: 21, cards: cards(100, 10) }),
      10: rawListPage({ offset: 10, next: true, total: 21, cards: cards(110, 10) }),
      20: rawListPage({ offset: 20, next: false, total: 21, cards: cards(120, 1) }),
    });
    const logs: string[] = [];
    const urls = await discoverTours(fetcher, line => logs.push(line));
    expect(asked).toEqual([listUrl(0), listUrl(10), listUrl(20)]);
    expect(options.every(o => JSON.stringify(o) === JSON.stringify({ sameOriginRedirectsOnly: true }))).toBe(true);
    expect(urls).toEqual(Array.from({ length: 21 }, (_, i) => tourPageUrl(String(100 + i))));
    expect(logs).toEqual(['taste: the list says 21 products, 21 entries found; 3 pages read, 21 tours, 0 left out']);
  });

  it('logs what it left out by kind (fixed texts, so the public log shows them) and a tour listed twice once', async () => {
    const { fetcher } = listFetcher({
      0: rawListPage({ next: true, total: 5, cards: [...cards(100, 2), { href: 900, title: '郵輪套票' }] }),
      10: rawListPage({ offset: 10, total: 5, cards: [...cards(101, 1), { href: 901, title: 'XYZ02 - 酒店', days: null }] }),
    });
    const logs: string[] = [];
    const urls = await discoverTours(fetcher, line => logs.push(line));
    expect(urls).toEqual([tourPageUrl('100'), tourPageUrl('101')]);
    expect(logs).toEqual([
      'taste: left out 2 list entries that are not group tours (no tour code 1, no day count 1)',
      'taste: 1 tour listed on more than one page, kept once',
      'taste: the list says 5 products, 5 entries found; 2 pages read, 2 tours, 2 left out',
    ]);
  });

  it('keeps a tour whose code has `-` or `_` or one character, asking only for its page by tour id', async () => {
    const { fetcher, asked } = listFetcher({
      0: rawListPage({ total: 3, cards: [
        { href: 701, title: 'CAK-03 - 江門3天' }, { href: 702, title: 'CAK_03 - 江門3天' }, { href: 703, title: 'A - 江門3天' },
      ] }),
    });
    const logs: string[] = [];
    expect(await discoverTours(fetcher, line => logs.push(line))).toEqual([tourPageUrl('701'), tourPageUrl('702'), tourPageUrl('703')]);
    expect(asked).toEqual([listUrl(0)]);
    expect(logs).toEqual(['taste: the list says 3 products, 3 entries found; 1 page read, 3 tours, 0 left out']);
  });

  it('ends at an empty page only when it links no next page', async () => {
    const { fetcher, asked } = listFetcher({
      0: rawListPage({ next: true, total: 10, cards: cards(100, 10) }), 10: rawListPage({ offset: 10, next: false, total: 10, cards: [] }),
    });
    expect(await discoverTours(fetcher, () => {})).toHaveLength(10);
    expect(asked).toEqual([listUrl(0), listUrl(10)]);
  });

  it('checks that the site honoured each offset: the first page, a middle page and the last page are the expected ones', async () => {
    const pages: Record<number, string> = {};
    for (let page = 0; page < 32; page++) {
      pages[page * 10] = rawListPage({ offset: page * 10, next: page < 31, total: 311, cards: cards(1000 + page * 10, page < 31 ? 10 : 1) });
    }
    const { fetcher, asked } = listFetcher(pages);
    expect(await discoverTours(fetcher, () => {})).toHaveLength(311);
    expect(asked).toHaveLength(32);
  });

  it('compares the entries found with the product count the list states, and logs that it cannot when there is none', async () => {
    const logs: string[] = [];
    const pages = { 0: rawListPage({ total: null, cards: cards(100, 2) }) };
    expect(await discoverTours(listFetcher(pages).fetcher, line => logs.push(line))).toHaveLength(2);
    expect(logs).toEqual(['taste: the list gives no product count, 2 entries found; 1 page read, 2 tours, 0 left out']);
    // 280 of 311 is within 10%: no error.
    const near: Record<number, string> = {};
    for (let page = 0; page < 28; page++) near[page * 10] = rawListPage({ offset: page * 10, next: page < 27, total: 311, cards: cards(1000 + page * 10, 10) });
    expect(await discoverTours(listFetcher(near).fetcher, () => {})).toHaveLength(280);
  });

  it.each([
    ['a page that is not fetched', { 0: rawListPage({ next: true, cards: cards(100, 10) }) }, 'taste: list page at offset 10 was not fetched'],
    ['a first page with no tour', { 0: rawListPage({ cards: [] }) }, 'taste: the list has no group tour'],
    ['a first page whose entries are none of them tours', { 0: rawListPage({ cards: [{ title: '郵輪套票' }] }) }, 'taste: the list has no group tour'],
    ['a page that repeats the tours of earlier pages', {
      0: rawListPage({ next: true, cards: cards(100, 10) }), 10: rawListPage({ offset: 10, next: true, cards: cards(100, 10) }),
    }, 'taste: list page at offset 10 repeats earlier entries'],
    ['an empty page that still links a next page', {
      0: rawListPage({ next: true, total: 20, cards: cards(100, 10) }), 10: rawListPage({ offset: 10, next: true, total: 20, cards: [] }),
    }, 'taste: list page at offset 10 is empty but links a next page'],
    ['a first page the site gives as another page (an offset not honoured)', {
      0: rawListPage({ offset: 0, current: 2, next: true, cards: cards(100, 10) }),
    }, 'taste: list page at offset 0 is not page 1 (the pager marks page 2)'],
    ['a middle page the site gives as page 1', {
      0: rawListPage({ next: true, cards: cards(100, 10) }), 10: rawListPage({ offset: 10, current: 1, next: true, cards: cards(110, 10) }),
    }, 'taste: list page at offset 10 is not page 2 (the pager marks page 1)'],
    ['a page with no current-page marker', { 0: rawListPage({ current: null, next: true, cards: cards(100, 10) }) },
      'taste: list page at offset 0 is not page 1 (the pager marks no page)'],
    ['a list far shorter than it says (more than 10% missing)', {
      0: rawListPage({ next: true, total: 311, cards: cards(100, 10) }), 10: rawListPage({ offset: 10, total: 311, cards: cards(110, 10) }),
    }, 'taste: the list holds 20 entries, more than 10% fewer than the 311 products it states'],
  ])('throws, with a fixed text, for %s', async (_, pages, why) => {
    await expect(discoverTours(listFetcher(pages).fetcher, () => {})).rejects.toThrow(why);
  });

  it(`never reads more than ${MAX_LIST_PAGES} pages: a list that does not end fails discovery`, async () => {
    const pages: Record<number, string> = {};
    for (let page = 0; page <= MAX_LIST_PAGES + 5; page++) {
      pages[page * 10] = rawListPage({ offset: page * 10, next: true, cards: cards(1000 + page * 10, 10) });
    }
    const { fetcher, asked } = listFetcher(pages);
    await expect(discoverTours(fetcher, () => {})).rejects.toThrow(`taste: the list goes on past ${MAX_LIST_PAGES} pages`);
    expect(asked).toHaveLength(MAX_LIST_PAGES);
  });

  it('prints the same line in a dry run (DRY_RUN_LOG) and a real run (PUBLIC_LOG): it holds no operator text', async () => {
    const pages = { 0: rawListPage({ total: 2, cards: [...cards(100, 1), { href: 900, title: '郵輪套票' }] }) };
    for (const view of [PUBLIC_LOG, DRY_RUN_LOG]) {
      const logs: string[] = [];
      await discoverTours(listFetcher(pages).fetcher, line => logs.push(line), view);
      expect(logs.join('\n')).not.toContain('郵輪');
    }
  });
});

interface ListingExpected { sourceUrl: string; verifiedByOwner: boolean; notes: string[]; tours: { id: string; code: string }[]; leftOut: Record<string, number>; next: boolean; total: number; current: number }
const readFixture = (name: string) => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8');

describe.each(['list-first', 'list-middle', 'list-last'])('taste fixture %s', name => {
  const expected: ListingExpected = JSON.parse(readFixture(`${name}.expected.json`));
  it('reads the hand-checked tours, and whether a next page follows', () => {
    const { tours, leftOut, next, total, current } = readListPage(readFixture(`${name}.html`));
    expect({ tours, leftOut, next, total, current })
      .toEqual({ tours: expected.tours, leftOut: expected.leftOut, next: expected.next, total: expected.total, current: expected.current });
  });
  it('is not yet verified by the owner', () => {
    expect(expected.verifiedByOwner).toBe(false);
    expect(expected.sourceUrl).toMatch(/^https:\/\/tastetravel\.com\.hk\/tour\/select(?:\/page\/\d+)?$/);
  });
});
