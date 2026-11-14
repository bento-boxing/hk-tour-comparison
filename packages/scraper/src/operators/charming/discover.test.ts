import { expect, it } from 'vitest';
import type { Fetcher } from '../../types';
import { discover, isTourUrl, listUrl, MAX_LIST_PAGES, PER_PAGE } from './discover';

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

it('listUrl asks for 100 posts per page, only the fields discover reads', () => {
  expect(PER_PAGE).toBe(100);
  expect(listUrl(3)).toBe(
    'https://www.charming-online.com/index.php?rest_route=/wp/v2/tour&per_page=100&_fields=id,slug,link,modified&page=3');
});

/** A list page of `n` posts whose links are `?tour=t<start + i>`. */
const page = (start: number, n: number, extra: object[] = []) => JSON.stringify([
  ...Array.from({ length: n }, (_, i) => ({
    id: 50000 - start - i, slug: `t${start + i}`, link: `https://www.charming-online.com/?tour=t${start + i}`,
    modified: '2026-11-11T16:05:42',
  })),
  ...extra,
]);

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

it('discover reads list pages until one holds fewer than 100 posts, keeping each tour link once, in order', async () => {
  const { fetcher, asked } = listFetcher({
    1: page(0, 100),
    2: page(100, 100, [{ id: 1, slug: 't5', link: 'https://www.charming-online.com/?tour=t5' }]),
    3: page(200, 89),
  });
  const urls = await discover(fetcher);
  expect(urls).toHaveLength(289);
  expect(urls[0]).toBe('https://www.charming-online.com/?tour=t0');
  expect(urls.at(-1)).toBe('https://www.charming-online.com/?tour=t288');
  expect(asked).toEqual([listUrl(1), listUrl(2), listUrl(3)]);
});

it('discover keeps only links to tour pages on the site', async () => {
  const { fetcher } = listFetcher({
    1: JSON.stringify([
      { id: 1, link: 'https://www.charming-online.com/?tour=f-26-mono-008-ghtg' },
      { id: 2, link: 'https://www.charming-online.com/?page_id=31' },
      { id: 3, link: 'https://elsewhere.example.test/?tour=x' },
      { id: 4, link: 42 },
      { id: 5 },
      'junk',
      { id: 6, link: 'https://www.charming-online.com/?tour=f-25-eur-010-gerd_gere&tour-destination=europe' },
    ]),
  });
  expect(await discover(fetcher)).toEqual([
    'https://www.charming-online.com/?tour=f-26-mono-008-ghtg',
    'https://www.charming-online.com/?tour=f-25-eur-010-gerd_gere',
  ]);
});

it('discover ends the list at a page that is not fetched (WordPress refuses a page past the last)', async () => {
  const { fetcher, asked } = listFetcher({ 1: page(0, 100), 2: page(100, 100) });
  expect(await discover(fetcher)).toHaveLength(200);
  expect(asked).toEqual([listUrl(1), listUrl(2), listUrl(3)]);
});

it('discover ends the list at an answer that is not a JSON list', async () => {
  const { fetcher, asked } = listFetcher({ 1: page(0, 100), 2: '{"code":"rest_post_invalid_page_number"}' });
  expect(await discover(fetcher)).toHaveLength(100);
  expect(asked).toHaveLength(2);
  expect(await discover(listFetcher({ 1: '<html>not json</html>' }).fetcher)).toEqual([]);
});

it(`discover never asks for more than ${MAX_LIST_PAGES} list pages`, async () => {
  const pages = Object.fromEntries(Array.from({ length: MAX_LIST_PAGES + 5 }, (_, i) => [i + 1, page(i * 100, 100)]));
  const { fetcher, asked } = listFetcher(pages);
  expect(await discover(fetcher)).toHaveLength(MAX_LIST_PAGES * 100);
  expect(asked).toHaveLength(MAX_LIST_PAGES);
});

it('discover returns [] when the first list page cannot be fetched', async () => {
  expect(await discover({ fetchText: async () => null })).toEqual([]);
});
