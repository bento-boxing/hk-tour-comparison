import { it, expect, vi, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { renderToStaticMarkup } from 'react-dom/server';
import { places } from '@hktours/core';
import type { Db, DestinationCounts, OperatorListing, TourCardData } from '@hktours/db/read';
import { I18nProvider } from '../../lib/i18n-client';
import type { Locale } from '../../lib/i18n';
import type { SearchPageData } from '../../lib/search-page-data';
import { parseSearchParams } from '../../lib/search-params';

const mocks = vi.hoisted(() => ({
  requestDb: vi.fn<() => Promise<Db>>(),
  loadSearchPage: vi.fn<(db: Db, raw: Record<string, string | string[] | undefined>, today: string, locale?: string, reads?: unknown) => Promise<SearchPageData>>(),
  getOperatorListings: vi.fn<(db: Db, today: string) => Promise<OperatorListing[]>>(),
}));
vi.mock('../../lib/db', () => ({ requestDb: mocks.requestDb }));
vi.mock('../../lib/search-page-data', () => ({
  loadSearchPage: mocks.loadSearchPage, cachedReads: { name: 'cachedReads', getOperatorListings: mocks.getOperatorListings },
}));
vi.mock('next/navigation', async importOriginal => ({
  ...(await importOriginal<typeof import('next/navigation')>()), // the real notFound and unstable_rethrow
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => '/operators/texpert',
  useSearchParams: () => new URLSearchParams(),
}));

const { OperatorPage, operatorPageMetadata } = await import('./operator-page');

const fakeDb = {} as Db;
beforeAll(() => { vi.setSystemTime(new Date('2026-11-12T04:00:00Z')); });
afterAll(() => { vi.useRealTimers(); });

const tour: TourCardData = {
  key: 'texpert:KIX5', operatorId: 'texpert', url: 'https://example.test/texpert/KIX5', title: 'KIX5', days: 5, nights: 4,
  stops: [{ countryId: 'japan', regionId: 'japan-kansai', cityId: 'japan-kansai-osaka' }],
  start: { kind: 'hk', label: null }, end: { kind: 'hk', label: null },
  fromPriceHkd: 7999, windowPriceHkd: 7999, fallbackPriceHkd: 7999,
  departures: [{ date: '2026-12-18', priceHkd: 7999 }], priceChange: null, lastUpdated: '2026-11-11T19:10:00.000Z',
};

const counts: DestinationCounts = {
  all: { tours: 50, operators: 4 },
  destinations: [{ countryId: 'japan', regionId: null, tours: 32, operators: 3 }, { countryId: 'korea', regionId: null, tours: 8, operators: 2 }],
};

/** The operator's listing: fresh (its last good run 9 hours ago), 1,234 tours, most to Japan. */
const texpert: OperatorListing = {
  id: 'texpert', nameZh: '專業旅運', nameEn: 'Travel Expert', color: '#7d3cc8', siteUrl: 'https://www.example.test',
  lastGoodRunAt: '2026-11-11T19:10:00.000Z', tours: 1234,
  countries: [{ countryId: 'japan', tours: 900 }, { countryId: 'korea', tours: 200 }, { countryId: 'taiwan', tours: 100 }, { countryId: 'china', tours: 34 }],
};
const egl: OperatorListing = { ...texpert, id: 'egl', nameZh: '東瀛遊', nameEn: 'EGL Tours', color: '#d62839', tours: 3, countries: [] };

/** What the loader gives: its state from the address the page hands it, 60 matches (three pages of 24). */
function dataFor(raw: Record<string, string | string[] | undefined>): SearchPageData {
  return {
    state: parseSearchParams(raw, places), tours: [tour], total: 60,
    operators: [{ id: 'texpert', nameZh: '專業旅運', nameEn: 'Travel Expert', color: '#7d3cc8', lastGoodRunAt: texpert.lastGoodRunAt }],
    filterOperators: [], counts,
  };
}

const props = (locale: Locale, id: string, query: Record<string, string> = {}) =>
  ({ locale, params: Promise.resolve({ id }), searchParams: Promise.resolve(query) });

async function renderPage(locale: Locale, id: string, query: Record<string, string> = {}) {
  const element = await OperatorPage(props(locale, id, query));
  return render(<I18nProvider locale={locale}>{element}</I18nProvider>);
}

const metadataFor = (locale: Locale, id: string, query: Record<string, string> = {}) =>
  operatorPageMetadata(locale, props(locale, id, query).params, props(locale, id, query).searchParams);

async function thrown(run: () => Promise<unknown>): Promise<{ digest?: string } | undefined> {
  try { await run(); } catch (err) { return err as { digest?: string }; }
  return undefined;
}

let consoleError: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  mocks.requestDb.mockReset().mockResolvedValue(fakeDb);
  mocks.loadSearchPage.mockReset().mockImplementation(async (_db, raw) => dataFor(raw));
  mocks.getOperatorListings.mockReset().mockResolvedValue([egl, texpert]);
  consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => { consoleError.mockRestore(); });

it.each([['an unknown id', 'atlantis'], ['a capitalised id', 'EGL'], ['a destination', 'japan'], ['an inherited name', 'constructor'], ['__proto__', '__proto__']])(
  '%s (%s) is a real 404, from the page and from its metadata, with no database read', async (_, id) => {
    for (const locale of ['zh-Hant', 'zh-Hans', 'en'] as const) {
      expect((await thrown(() => OperatorPage(props(locale, id))))?.digest).toBe('NEXT_HTTP_ERROR_FALLBACK;404');
      expect((await thrown(() => metadataFor(locale, id)))?.digest).toBe('NEXT_HTTP_ERROR_FALLBACK;404');
    }
    expect(mocks.requestDb).not.toHaveBeenCalled();
  },
);

it.each([
  // The database's listings hold only operators with a good run (packages/db getOperatorListings).
  ['not in the listings', [egl]],
  // … and the page checks again, so one never scraped cannot get a page even if it came through.
  ['never had a good run', [egl, { ...texpert, lastGoodRunAt: null, tours: 0, countries: [] }]],
] as [string, OperatorListing[]][])('an operator the site does not list (%s) is a 404 in every language, without reading its tours', async (_, listings) => {
  mocks.getOperatorListings.mockResolvedValue(listings);
  for (const locale of ['zh-Hant', 'zh-Hans', 'en'] as const) {
    expect((await thrown(() => OperatorPage(props(locale, 'texpert'))))?.digest).toBe('NEXT_HTTP_ERROR_FALLBACK;404');
    expect((await thrown(() => metadataFor(locale, 'texpert')))?.digest).toBe('NEXT_HTTP_ERROR_FALLBACK;404');
  }
  expect(mocks.loadSearchPage).not.toHaveBeenCalled();
});

it('the operator comes from the path: an op in the query cannot change it, and the other filters (the destination too) are read', async () => {
  await renderPage('zh-Hant', 'texpert', { op: 'egl,jetour', dest: 'japan', dmin: '5' });
  expect(mocks.loadSearchPage).toHaveBeenCalledTimes(1);
  expect(mocks.loadSearchPage.mock.calls[0][1]).toEqual({ dest: 'japan', dmin: '5', op: 'texpert' });
  expect(mocks.getOperatorListings).toHaveBeenCalledWith(fakeDb, '2026-11-12');
  // The heading names the path's operator, never the query's.
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('專業旅運的旅行團');
  expect(screen.getByRole('combobox')).toHaveValue('日本 → 全部地區');
});

/** A paragraph whose whole text is `text` (its clauses may be in spans of their own). */
const paragraph = (text: string) => (_: string, el: Element | null) => el?.tagName === 'P' && el.textContent === text;

it.each([
  ['zh-Hant', '專業旅運的旅行團', '現時列出 1,234 個旅行團。', ['本頁並非專業旅運的網站，', '本網站與專業旅運並無任何關連。'], '去專業旅運的官方網站 ↗', '的官方網站 ↗'],
  ['zh-Hans', '專業旅運的旅行团', '目前列出 1,234 个旅行团。', ['本页并非專業旅運的网站，', '本网站与專業旅運没有任何关联。'], '去專業旅運的官方网站 ↗', '的官方网站 ↗'],
  ['en', 'Group tours from Travel Expert', '1,234 tours listed now.', ['This is not the Travel Expert website, and this site is not affiliated with Travel Expert.'], 'Travel Expert official site ↗', 'official site ↗'],
] as const)('in %s: the band\'s heading and count, the line saying this is not the operator\'s site, and the link to it', async (locale, heading, count, clauses, official, kept) => {
  await renderPage(locale, 'texpert');
  const band = screen.getByRole('region', { name: heading });
  expect(within(band).getByRole('heading', { level: 1 })).toHaveTextContent(heading);
  expect(within(band).getByText(count)).toBeInTheDocument();
  // In Chinese each clause is kept on one line (a nowrap span), the line breaking between them; English is plain text.
  const line = within(band).getByText(paragraph(clauses.join('')));
  expect([...line.querySelectorAll('span')].map(s => s.textContent)).toEqual(locale === 'en' ? [] : clauses);
  expect(line.querySelectorAll('wbr')).toHaveLength(locale === 'en' ? 0 : 1);
  const link = within(band).getByRole('link', { name: official });
  expect(link).toHaveAttribute('href', 'https://www.example.test/');
  expect(link).toHaveAttribute('target', '_blank');
  expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  // The words after the name are kept together, so a wrap comes after the name ("official site ↗" never alone).
  expect(link.querySelector('span span')?.textContent).toBe(kept);
  // Fresh data: no stale note. No destination shortcuts: they would leave the operator's page.
  expect(within(band).queryByText(/^(資料為|数据为|Data from)/)).not.toBeInTheDocument();
  expect(within(band).queryByRole('navigation')).not.toBeInTheDocument();
  expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
});

it.each([
  ['zh-Hant', '資料為 11月10日'], ['zh-Hans', '数据为 11月10日'], ['en', 'Data from 10 Nov'],
] as const)('in %s an operator whose last good run is older than the rows\' limit gets the rows\' note in the band', async (locale, note) => {
  mocks.getOperatorListings.mockResolvedValue([{ ...texpert, lastGoodRunAt: '2026-11-09T19:10:00.000Z' }]);
  await renderPage(locale, 'texpert');
  expect(within(screen.getByRole('region', { name: /專業旅運|Travel Expert/ })).getAllByText(note)).toHaveLength(1);
});

it('the note under the list dates the update by this operator\'s run, not by the latest of every operator', async () => {
  // texpert ran on 11 Nov (Hong Kong); another operator, whose rows are not on this page, on 12 Nov.
  mocks.getOperatorListings.mockResolvedValue([{ ...texpert, lastGoodRunAt: '2026-11-11T10:00:00.000Z' }]);
  mocks.loadSearchPage.mockImplementation(async (_db, raw) => ({
    ...dataFor(raw),
    operators: [
      { id: 'texpert', nameZh: '專業旅運', nameEn: 'Travel Expert', color: '#7d3cc8', lastGoodRunAt: '2026-11-11T10:00:00.000Z' },
      { id: 'egl', nameZh: '東瀛遊', nameEn: 'EGL Tours', color: '#d62839', lastGoodRunAt: '2026-11-11T19:10:00.000Z' },
    ],
  }));
  await renderPage('zh-Hant', 'texpert');
  expect(screen.getByText(/^資料更新：/)).toHaveTextContent(/^資料更新：11月11日 ·/);
});

it('a home address that is not an http(s) address gives no link', async () => {
  mocks.getOperatorListings.mockResolvedValue([{ ...texpert, siteUrl: 'javascript:alert(1)' }]);
  await renderPage('zh-Hant', 'texpert');
  expect(screen.queryByRole('link', { name: /官方網站/ })).not.toBeInTheDocument();
  expect(screen.getByText(paragraph('本頁並非專業旅運的網站，本網站與專業旅運並無任何關連。'))).toBeInTheDocument();
});

it.each([
  ['zh-Hant', '/operators/texpert?dest=japan&page=2', '/operators/texpert?dest=japan&size=48'],
  ['zh-Hans', '/zh-hans/operators/texpert?dest=japan&page=2', '/zh-hans/operators/texpert?dest=japan&size=48'],
  ['en', '/en/operators/texpert?dest=japan&page=2', '/en/operators/texpert?dest=japan&size=48'],
] as const)('in %s paging and the rows-per-page choice stay on the operator\'s page, with no op in the address', async (locale, next, size) => {
  await renderPage(locale, 'texpert', { dest: 'japan', op: 'egl' });
  const hrefs = screen.getAllByRole('link').map(a => a.getAttribute('href'));
  expect(hrefs).toContain(next);
  expect(hrefs).toContain(size);
  expect(hrefs.filter(h => h?.includes('op='))).toEqual([]);
});

it('the filter row has no operator filter', async () => {
  await renderPage('zh-Hant', 'texpert');
  expect(screen.queryByRole('button', { name: /^旅行社：/ })).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: '日數：全部' })).toBeInTheDocument();
});

it.each([
  ['zh-Hant', '清除所有篩選', '/operators/texpert'], ['zh-Hans', '清除所有筛选条件', '/zh-hans/operators/texpert'], ['en', 'Clear all filters', '/en/operators/texpert'],
] as const)('in %s, when the filters match nothing, "clear all filters" keeps the operator', async (locale, clear, href) => {
  mocks.loadSearchPage.mockImplementation(async (_db, raw) => ({ ...dataFor(raw), tours: [], total: 0 }));
  await renderPage(locale, 'texpert', { dmin: '30' });
  expect(screen.getByRole('link', { name: clear })).toHaveAttribute('href', href);
});

it.each([
  ['zh-Hant', '專業旅運的旅行團', '現時沒有列出專業旅運的旅行團。 查看所有旅行團', ['查看所有旅行團', '/'], '去專業旅運的官方網站 ↗'],
  ['zh-Hans', '專業旅運的旅行团', '目前没有列出專業旅運的旅行团。 查看所有旅行团', ['查看所有旅行团', '/zh-hans'], '去專業旅運的官方网站 ↗'],
  ['en', 'Group tours from Travel Expert', 'No group tours from Travel Expert are listed right now. See all tours', ['See all tours', '/en'], 'Travel Expert official site ↗'],
] as const)('in %s an operator with a good run but no tours now: the band, then one plain line with a link to every tour; nothing to filter', async (locale, heading, line, [all, href], official) => {
  mocks.getOperatorListings.mockResolvedValue([{ ...texpert, tours: 0, countries: [] }]);
  const { container } = await renderPage(locale, 'texpert', { dmin: '5', sort: 'days' });
  expect(mocks.loadSearchPage).not.toHaveBeenCalled(); // no tours to read
  const band = screen.getByRole('region', { name: heading });
  expect(within(band).getByRole('link', { name: official })).toBeInTheDocument();
  expect(within(band).queryByRole('combobox')).not.toBeInTheDocument();
  expect(screen.getByText(paragraph(line))).toBeInTheDocument();
  expect(screen.getByRole('link', { name: all })).toHaveAttribute('href', href);
  // No filters, no sort, no "clear all filters", no "nothing matches".
  expect(container.querySelector('button[aria-haspopup]')).toBeNull();
  expect(container.textContent).not.toMatch(/篩選|筛选|filter|找不到|Sort|排序/i);
});

it('when the database cannot be read: a neutral heading (the site\'s name, not the index\'s), the visitor\'s message, and noindex', async () => {
  mocks.requestDb.mockRejectedValue(new Error('DATABASE_URL is not set'));
  await renderPage('zh-Hant', 'texpert');
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/^跟邊團$/);
  expect(screen.getByRole('alert')).toHaveTextContent('暫時未能載入資料，請稍後再試。');
  const metadata = await metadataFor('zh-Hant', 'texpert');
  expect(metadata.robots).toEqual({ index: false });
  // No title of its own: the layout's, the site's name.
  expect(metadata.title).toBeUndefined();
  expect(metadata.openGraph).toMatchObject({ title: '跟邊團' });
});

const site = 'https://example.invalid';
it.each([
  ['zh-Hant', '專業旅運旅行團一覽｜跟邊團', '跟邊團是個人製作的旅行團比較網站，並非專業旅運官方網站。現時列出專業旅運的 1,234 個旅行團，目的地包括日本、韓國及台灣。', `${site}/operators/texpert`],
  ['zh-Hans', '專業旅運旅行团一览｜跟邊團', '跟邊團是个人制作的旅行团比较网站，并非專業旅運官方网站。目前列出專業旅運的 1,234 个旅行团，目的地包括日本、韩国和台湾。', `${site}/zh-hans/operators/texpert`],
  ['en', 'Group tours from Travel Expert | 跟邊團', 'An independent comparison site, not the Travel Expert website. Listing 1,234 group tours from Travel Expert, to destinations including Japan, South Korea and Taiwan.', `${site}/en/operators/texpert`],
] as const)('in %s the metadata: the owner\'s title, a description saying what the site is then the data, canonical without the query, hreflang, indexable', async (locale, title, description, canonical) => {
  const metadata = await metadataFor(locale, 'texpert', { dest: 'japan', page: '2' });
  expect(metadata.title).toEqual({ absolute: title });
  expect(metadata.description).toBe(description);
  expect(metadata.openGraph).toMatchObject({ title, description });
  expect(metadata.alternates).toEqual({
    canonical,
    languages: {
      'zh-Hant': `${site}/operators/texpert`, 'zh-Hans': `${site}/zh-hans/operators/texpert`, en: `${site}/en/operators/texpert`,
      'x-default': `${site}/operators/texpert`,
    },
  });
  expect(metadata.robots).toBeUndefined();
});

it('the description without known countries, and with no tours (then noindex)', async () => {
  const lead = { zh: '跟邊團是個人製作的旅行團比較網站，並非東瀛遊官方網站。', en: 'An independent comparison site, not the EGL Tours website. ' };
  expect((await metadataFor('zh-Hant', 'egl')).description).toBe(`${lead.zh}現時列出東瀛遊的 3 個旅行團。`);
  expect((await metadataFor('en', 'egl')).description).toBe(`${lead.en}Listing 3 group tours from EGL Tours.`);
  mocks.getOperatorListings.mockResolvedValue([{ ...egl, tours: 1 }]);
  expect((await metadataFor('en', 'egl')).description).toBe(`${lead.en}Listing 1 group tour from EGL Tours.`);
  mocks.getOperatorListings.mockResolvedValue([{ ...egl, tours: 0 }]);
  const none = await metadataFor('zh-Hant', 'egl');
  expect(none.description).toBe(`${lead.zh}現時沒有列出東瀛遊的旅行團。`);
  expect(none.robots).toEqual({ index: false });
  expect((await metadataFor('en', 'egl')).description).toBe(`${lead.en}No group tours from EGL Tours are listed right now.`);
});

// Structured data (task 64): the page's place in the site as a breadcrumb trail, and nothing about the operator itself.

/** The page's JSON-LD blocks: each one's text as written and as parsed. */
const jsonLd = (container: Element) => [...container.querySelectorAll('script[type="application/ld+json"]')]
  .map(script => ({ text: script.innerHTML, data: JSON.parse(script.textContent ?? '') as Record<string, unknown> }));

it.each([
  ['zh-Hant', '', ['跟邊團', '旅行社一覽', '專業旅運的旅行團']],
  ['zh-Hans', '/zh-hans', ['跟邊團', '旅行社一览', '專業旅運的旅行团']],
  ['en', '/en', ['跟邊團', 'Tour operators', 'Group tours from Travel Expert']],
] as const)('in %s, one breadcrumb trail: the home page, the operators index, then this page under its heading', async (locale, prefix, names) => {
  const { container } = await renderPage(locale, 'texpert', { dest: 'japan', page: '2' });
  const blocks = jsonLd(container);
  expect(blocks).toHaveLength(1);
  expect(blocks[0].data).toEqual({
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: names[0], item: `${site}${prefix}` },
      { '@type': 'ListItem', position: 2, name: names[1], item: `${site}${prefix}/operators` },
      { '@type': 'ListItem', position: 3, name: names[2], item: `${site}${prefix}/operators/texpert` },
    ],
  });
  // The last step is the heading the page shows.
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(names[2]);
  // Nothing about the operator as an organisation, and nothing for sale or rated.
  expect(blocks[0].text).not.toMatch(/Organization|Offer|Product|AggregateRating|"ItemList"|FAQPage/);
});

it('an operator listing no tours now keeps its trail; a page whose data could not be read has none (its operator is not known)', async () => {
  mocks.getOperatorListings.mockResolvedValue([{ ...egl, tours: 0 }]);
  const none = await renderPage('zh-Hant', 'egl');
  expect(jsonLd(none.container).map(b => b.data['@type'])).toEqual(['BreadcrumbList']);
  none.unmount();
  mocks.requestDb.mockRejectedValue(new Error('DATABASE_URL is not set'));
  const failed = await renderPage('zh-Hant', 'texpert');
  expect(jsonLd(failed.container)).toEqual([]);
});

it('a hostile operator name from the database cannot end the script or start a tag: it is escaped, and reads back the same', async () => {
  const hostile = '</script><script>alert(1)</script><!-- & \u2028';
  mocks.getOperatorListings.mockResolvedValue([egl, { ...texpert, nameZh: hostile }]);
  const html = renderToStaticMarkup(<I18nProvider locale="zh-Hant">{await OperatorPage(props('zh-Hant', 'texpert'))}</I18nProvider>);
  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html');
  // Exactly the one block, still a single script: nothing in the name made a new element.
  expect(doc.querySelectorAll('script')).toHaveLength(1);
  const [block] = jsonLd(doc.body);
  expect(block.text).not.toMatch(/[<>&\u2028]/);
  expect((block.data.itemListElement as { name: string }[])[2].name).toBe(`${hostile}的旅行團`);
});
