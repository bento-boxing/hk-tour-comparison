import { describe, expect, it } from 'vitest';
import type { Fetcher } from '../../types';
import { discover, isNotAGroupTour, isTourUrl, listUrl, MAX_LIST_PAGES, PER_PAGE } from './discover';

// Real links from the site's REST list (docs/operators/charming.md), plus off-site and non-tour variants.
it.each([
  ['https://www.charming-online.com/?tour=f-26-mono-008-ghtg', true],
  ['https://www.charming-online.com/?tour=f-25-eur-010-gerd_gere', true],
  ['https://www.charming-online.com/?tour=6%e5%a4%a9%e6%9d%9c%e6%8b%9c%e6%82%a0%e9%96%92%e4%b9%8b%e6%97%85-gdxd', true],
  ['https://www.charming-online.com/?tour=f-26-mono-008-ghtg&tour-destination=italy', true], // a listing's link
  ['https://www.charming-online.com/?tour=f-26-mono-008-ghtg#booking', true],
  ['https://www.charming-online.com/?tour-destination=italy', false],
  ['https://www.charming-online.com/?page_id=31', false],
  ['https://www.charming-online.com/?page_id=2101&tour=x', false], // robots.txt disallows page 2101
  ['https://www.charming-online.com/?page_id=48197&tcode=GHTG11M-261226&pid=47697', false],
  ['https://www.charming-online.com/?tour=', false],
  ['https://www.charming-online.com/?tour=a/../b', false],
  ['https://www.charming-online.com/wp/?tour=f-26-mono-008-ghtg', false],
  ['https://www.charming-online.com/index.php?rest_route=/wp/v2/tour', false],
  ['http://www.charming-online.com/?tour=f-26-mono-008-ghtg', false],
  ['https://charming-online.com/?tour=f-26-mono-008-ghtg', false],
  ['https://www.charming-online.com.example.test/?tour=f-26-mono-008-ghtg', false],
  ['not a url', false],
])('isTourUrl(%s) is %s', (url, expected) => {
  expect(isTourUrl(url)).toBe(expected);
});

it('listUrl asks for 100 posts per page, only the fields discover reads, in an envelope', () => {
  expect(PER_PAGE).toBe(100);
  expect(listUrl(3)).toBe(
    'https://www.charming-online.com/index.php?rest_route=/wp/v2/tour&per_page=100&_fields=id,slug,link,modified&_envelope&page=3');
});

/** `n` posts whose links are `?tour=t<start + i>`. */
const posts = (start: number, n: number, extra: unknown[] = []) => [
  ...Array.from({ length: n }, (_, i) => ({
    id: 50000 - start - i, slug: `t${start + i}`, link: `https://www.charming-online.com/?tour=t${start + i}`,
    modified: '2026-11-11T16:05:42',
  })),
  ...extra,
];
/** A list page as the site answers it with `_envelope` (shape seen 2026-11-14, e01-envelope-p1.raw). */
const envelope = (body: unknown, { pages = 3 as unknown, total = 289 as unknown, status = 200 } = {}) => JSON.stringify({
  body, status, headers: { 'X-WP-Total': total, 'X-WP-TotalPages': pages, Link: '<…>; rel="next"', Allow: 'GET' },
});

/** A fetcher answering the list pages given (by page number), null for any other URL; records every URL asked. */
function listFetcher(pages: Record<number, string | null>): { fetcher: Fetcher; asked: string[] } {
  const asked: string[] = [];
  const fetcher: Fetcher = {
    fetchText: async url => {
      asked.push(url);
      const n = Number(/&page=(\d+)$/.exec(url)?.[1]);
      return url === listUrl(n) ? pages[n] ?? null : null;
    },
  };
  return { fetcher, asked };
}

it('discover reads every page up to the page count page 1 gives, keeping each tour link once, in order', async () => {
  const { fetcher, asked } = listFetcher({
    1: envelope(posts(0, 100), { total: 290 }),
    2: envelope(posts(100, 100, [{ id: 1, slug: 't5', link: 'https://www.charming-online.com/?tour=t5' }])),
    3: envelope(posts(200, 89)),
    4: envelope(posts(300, 5)), // past the count: never asked for
  });
  const urls = await discover(fetcher);
  expect(urls).toHaveLength(289);
  expect(urls[0]).toBe('https://www.charming-online.com/?tour=t0');
  expect(urls.at(-1)).toBe('https://www.charming-online.com/?tour=t288');
  expect(asked).toEqual([listUrl(1), listUrl(2), listUrl(3)]);
});

it('discover reads the page and post counts given as digits, in any header case', async () => {
  const body = JSON.stringify({ body: posts(0, 2), status: 200, headers: { 'x-wp-totalpages': '1', 'x-wp-total': '2' } });
  expect(await discover(listFetcher({ 1: body }).fetcher)).toHaveLength(2);
});

it('discover gives each tour link as the tour page itself', async () => {
  const { fetcher } = listFetcher({
    1: envelope([
      { id: 1, link: 'https://www.charming-online.com/?tour=f-26-mono-008-ghtg' },
      { id: 6, link: 'https://www.charming-online.com/?tour=f-25-eur-010-gerd_gere&tour-destination=europe' },
    ], { pages: 1, total: 2 }),
  });
  expect(await discover(fetcher)).toEqual([
    'https://www.charming-online.com/?tour=f-26-mono-008-ghtg',
    'https://www.charming-online.com/?tour=f-25-eur-010-gerd_gere',
  ]);
});

it.each([
  ['a page link', { id: 2, link: 'https://www.charming-online.com/?page_id=31' }],
  ['an off-site link', { id: 3, link: 'https://elsewhere.example.test/?tour=x' }],
  ['a link that is not text', { id: 4, link: 42 }],
  ['no link', { id: 5 }],
  ['not a post', 'junk'],
])('discover throws when a post has %s: the posts linking a tour page fall short of X-WP-Total', async (_, post) => {
  const { fetcher } = listFetcher({ 1: envelope([{ id: 1, link: 'https://www.charming-online.com/?tour=a' }, post], { pages: 1, total: 2 }) });
  await expect(discover(fetcher)).rejects.toThrow(/links 1 tour pages, but says it holds 2 posts/);
});

// Real slugs from the 2026-11-14 practice crawl (docs/operators/charming.md, "The 109 null pages").
const link = (slug: string) => `https://www.charming-online.com/?tour=${encodeURIComponent(slug).toLowerCase()}`;
it.each([
  ['康養度假體驗套餐-3天2晚單人價錢：9300-雙人價錢：15200', true], // a spa package
  ['臻享單日放鬆之旅-價錢：1480', true],
  ['臻林-悅康會籍', true], // a membership
  ['機票及郵輪套票', true],
  ['加拿大航空《溫哥華機票-1晚酒店》優越之選-lcpa', true],
  ['122回-100-日-北歐峽灣與北極圈', true], // Peace Boat world cruise
  ['9-晚-希臘精選之旅《海洋奧德賽號》', true], // cruise only
  ['5晚-沖繩、石垣精選《海洋光譜號》', true],
  ['2-3晚三亞海上遊-5晚沖繩那霸及宮古島-rwkh-2', true],
  ['6天杜拜悠閒之旅-gdxd', false],
  ['f-26-cruise-023-grcll', false], // a group tour with a cruise in it
  ['8天-呼倫貝爾．漠河．滿洲里．北極村邂逅極光-pcmhp', false],
  ['2天1晚高端退休考察遊-mchsc', false],
  ['f-26-mono-008-ghtg', false],
])('isNotAGroupTour(%s) is %s', (slug, expected) => {
  expect(isNotAGroupTour(link(slug))).toBe(expected);
});

it('discover leaves out the posts that are not group tours, counted in X-WP-Total, logging each with its rule', async () => {
  const spa = link('中醫入門套餐-單人價錢：5100-雙人價錢：8100');
  const cruise = link('9-晚-希臘精選之旅《海洋奧德賽號》');
  const { fetcher } = listFetcher({ 1: envelope([
    { id: 1, link: link('f-26-mono-008-ghtg') }, { id: 2, link: spa }, { id: 3, link: cruise },
  ], { pages: 1, total: 3 }) });
  const logs: string[] = [];
  expect(await discover(fetcher, line => logs.push(line))).toEqual([link('f-26-mono-008-ghtg')]);
  expect(logs).toEqual([
    `charming: excluded ${spa}: not a group tour (priced in the slug)`,
    `charming: excluded ${cruise}: not a group tour (cruise counted in nights)`,
  ]);
});

describe('discover throws rather than return part of the list', () => {
  it.each([
    ['a page is not fetched', { 1: envelope(posts(0, 100)), 2: null, 3: envelope(posts(200, 89)) }, /page 2 was not fetched/],
    ['a page is not JSON', { 1: envelope(posts(0, 100)), 2: '<html>busy</html>', 3: envelope(posts(200, 89)) }, /page 2 is not JSON/],
    ['a page answers an error', {
      1: envelope(posts(0, 100)), 2: envelope({ code: 'rest_post_invalid_page_number', data: { status: 400 } }, { status: 400 }),
    }, /page 2 is not a list of posts \(status 400\)/],
    ['a page is not an envelope (the parameter ignored)', { 1: JSON.stringify(posts(0, 100)) }, /page 1 is not a list of posts/],
    ['page 1 is not fetched', {}, /page 1 was not fetched/],
    ['page 1 gives no page count', { 1: JSON.stringify({ body: posts(0, 3), status: 200, headers: {} }) }, /no page count/],
    ['page 1 gives a page count of 0', { 1: envelope([], { pages: 0 }) }, /no page count/],
    ['page 1 gives a page count that is not a whole number', { 1: envelope(posts(0, 3), { pages: '2.5' }) }, /no page count/],
    [`the list has more than ${MAX_LIST_PAGES} pages`, { 1: envelope(posts(0, 100), { pages: MAX_LIST_PAGES + 1 }) }, /21 pages, more than the 20/],
    ['page 1 gives no post count', { 1: envelope(posts(0, 3), { pages: 1, total: null }) }, /no post count/],
    ['a page answers 200 with fewer posts than the count', {
      1: envelope(posts(0, 100)), 2: envelope(posts(100, 100)), 3: envelope(posts(200, 50)),
    }, /links 250 tour pages, but says it holds 289 posts/],
  ] as [string, Record<number, string | null>, RegExp][])('when %s', async (_, pages, message) => {
    await expect(discover(listFetcher(pages).fetcher)).rejects.toThrow(message);
  });
});
