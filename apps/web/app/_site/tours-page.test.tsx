import { it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { render, screen, within } from '@testing-library/react';
import { isIsoDate, places } from '@hktours/core';
import type { Db, DestinationCounts } from '@hktours/db/read';
import { I18nProvider } from '../../lib/i18n-client';
import type { Locale } from '../../lib/i18n';
import { localeHref } from '../../lib/locale-path';
import { destinationPath, listedDestinations } from '../../lib/destinations';
import styles from './tours-page.module.css';

// The page is a stored copy (app/(zh-hant)/tours/page.tsx revalidate): it reads through the stored pages' handle, and
// the per-request one fails if it is ever used.
const mocks = vi.hoisted(() => ({
  storedDb: vi.fn<() => Promise<Db>>(),
  requestDb: vi.fn<() => Promise<Db>>(),
  countToursByDestination: vi.fn<(db: Db, today: string) => Promise<DestinationCounts>>(),
}));
vi.mock('../../lib/db', () => ({ storedDb: mocks.storedDb, requestDb: mocks.requestDb }));
vi.mock('../../lib/search-page-data', () => ({ cachedReads: { countToursByDestination: mocks.countToursByDestination } }));

const { ToursPage, toursPageMetadata } = await import('./tours-page');

const fakeDb = {} as Db;
/**
 * Invented counts: Japan and two regions, Korea and its region, an area with a tour, France and its only region,
 * Macau (no regions).
 */
const counts: DestinationCounts = {
  all: { tours: 20, operators: 3 },
  destinations: [
    { countryId: 'china', regionId: null, tours: 2, operators: 1 },
    { countryId: 'china', regionId: 'china-area-east', tours: 1, operators: 1 },
    { countryId: 'china', regionId: 'china-beijing', tours: 1, operators: 1 },
    { countryId: 'france', regionId: null, tours: 1, operators: 1 },
    { countryId: 'france', regionId: 'france-france', tours: 1, operators: 1 },
    { countryId: 'japan', regionId: null, tours: 12, operators: 3 },
    { countryId: 'japan', regionId: 'japan-kansai', tours: 7, operators: 2 },
    { countryId: 'japan', regionId: 'japan-kanto', tours: 5, operators: 2 },
    { countryId: 'korea', regionId: null, tours: 5, operators: 2 },
    { countryId: 'korea', regionId: 'korea-seoul', tours: 5, operators: 2 },
    { countryId: 'macau', regionId: null, tours: 3, operators: 1 },
  ],
};

let consoleError: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  mocks.storedDb.mockReset().mockResolvedValue(fakeDb);
  mocks.requestDb.mockReset().mockRejectedValue(new Error('the stored page used the per-request handle'));
  mocks.countToursByDestination.mockReset().mockResolvedValue(counts);
  consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => { consoleError.mockRestore(); vi.unstubAllEnvs(); });

async function renderPage(locale: Locale) {
  return render(<I18nProvider locale={locale}>{await ToursPage({ locale })}</I18nProvider>);
}

/** A link as [its text, its address, the count after it]. */
const entry = (a: Element) => [a.textContent, a.getAttribute('href'), a.nextElementSibling?.textContent];

/**
 * Each part of the world: its heading; its countries with regions, each [country, ...its regions]; then its
 * countries without regions (one grid).
 */
function outline(container: HTMLElement) {
  return [...container.querySelectorAll('section')].map(section => [
    section.querySelector('h2')?.textContent,
    [...section.querySelectorAll(`.${styles.countries} > li`)].map(li => [
      entry(li.querySelector(`.${styles.countryLine} > a`)!),
      ...[...li.querySelectorAll(`.${styles.regions} > li > a`)].map(entry),
    ]),
    [...section.querySelectorAll(`.${styles.plain} > li > a`)].map(entry),
  ]);
}

/** Every address the page links to in its sections (the destinations), in page order. */
const destinationHrefs = (container: HTMLElement) => [...container.querySelectorAll('section a')].map(a => a.getAttribute('href'));

it('lists every destination with a page of its own as a directory: countries with their regions, then those without; most tours first', async () => {
  const { container } = await renderPage('zh-Hant');
  expect(outline(container)).toEqual([
    ['中國內地及港澳台', [[['中國', '/tours/china', '2 團'], ['北京', '/tours/china-beijing', '1']]], [['澳門', '/tours/macau', '3 團']]],
    ['日本及韓國', [
      // Kansai (7) before Kanto (5), though Kanto comes first in the data.
      [['日本', '/tours/japan', '12 團'], ['關西', '/tours/japan-kansai', '7'], ['關東', '/tours/japan-kanto', '5']],
      [['韓國', '/tours/korea', '5 團'], ['首爾及京畿', '/tours/korea-seoul', '5']],
    ], []],
    // France's only region is not listed, so France is a country without regions here.
    ['歐洲', [], [['法國', '/tours/france', '1 團']]],
  ]);
  // Not listed: the area (華東), France's only region, and every destination without tours.
  expect(container.textContent).not.toMatch(/華東|泰國|沖繩/);
  expect(mocks.countToursByDestination).toHaveBeenCalledTimes(1);
  const [db, today] = mocks.countToursByDestination.mock.calls[0];
  expect(db).toBe(fakeDb);
  expect(isIsoDate(today)).toBe(true);
});

it('the heading, with the line of counts and the way to the operators index beside it; no separator that could start a line', async () => {
  const { container } = await renderPage('zh-Hant');
  const h1 = screen.getByRole('heading', { level: 1 });
  expect(h1).toHaveTextContent('旅行團目的地');
  const top = h1.parentElement!;
  expect(top).toHaveClass(styles.top);
  expect([...top.children].map(el => [el.tagName, el.textContent])).toEqual([
    ['H1', '旅行團目的地'], ['P', '現時列出 20 個旅行團，來自 3 間旅行社。'], ['P', '按旅行社瀏覽'],
  ]);
  expect(screen.getByRole('link', { name: '按旅行社瀏覽' })).toHaveAttribute('href', '/operators');
  expect(container.textContent).not.toContain('·');
});

it('every count groups thousands, as the rest of the site does: the line of counts and each destination\'s own', async () => {
  mocks.countToursByDestination.mockResolvedValue({
    all: { tours: 2122, operators: 12 },
    destinations: [
      { countryId: 'japan', regionId: null, tours: 1234, operators: 3 }, { countryId: 'japan', regionId: 'japan-kansai', tours: 1001, operators: 2 },
      { countryId: 'japan', regionId: 'japan-kanto', tours: 999, operators: 2 }, { countryId: 'macau', regionId: null, tours: 1500, operators: 1 },
    ],
  });
  const { container, unmount } = await renderPage('zh-Hant');
  expect(screen.getByText('現時列出 2,122 個旅行團，來自 12 間旅行社。')).toBeInTheDocument();
  expect(entry(screen.getByRole('link', { name: '日本' }))).toEqual(['日本', '/tours/japan', '1,234 團']);
  expect(entry(screen.getByRole('link', { name: '關西' }))).toEqual(['關西', '/tours/japan-kansai', '1,001']);
  expect(entry(screen.getByRole('link', { name: '關東' }))).toEqual(['關東', '/tours/japan-kanto', '999']);
  expect(entry(screen.getByRole('link', { name: '澳門' }))).toEqual(['澳門', '/tours/macau', '1,500 團']);
  expect(container.textContent).not.toMatch(/\d{4}/);
  unmount();
  await renderPage('en');
  expect(screen.getByText('Listing 2,122 tours from 12 operators.')).toBeInTheDocument();
  expect(entry(screen.getByRole('link', { name: 'Japan' }))).toEqual(['Japan', '/en/tours/japan', '1,234 tours']);
  expect(entry(screen.getByRole('link', { name: 'Macau' }))).toEqual(['Macau', '/en/tours/macau', '1,500 tours']);
});

it('a row of jump links, one per part of the world in order, each to its section (an ASCII id) by an in-page anchor', async () => {
  const { container } = await renderPage('zh-Hant');
  const jump = screen.getByRole('navigation', { name: '跳到' });
  // Before the first section.
  expect(jump.compareDocumentPosition(container.querySelector('section')!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  const links = within(jump).getAllByRole('link');
  expect(links.map(a => [a.textContent, a.getAttribute('href')])).toEqual([
    ['中國內地及港澳台', '#china'], ['日本及韓國', '#northeast-asia'], ['歐洲', '#europe'],
  ]);
  for (const a of links) {
    const id = a.getAttribute('href')!.slice(1);
    expect(id).toMatch(/^[a-z][a-z0-9-]*$/);
    const target = document.getElementById(id)!;
    expect(target.tagName).toBe('SECTION');
    expect(target).toHaveAccessibleName(a.textContent!);
    expect(target.querySelector('h2')).toHaveTextContent(a.textContent!);
  }
  // Every id on the page once.
  const ids = [...container.querySelectorAll('[id]')].map(el => el.id);
  expect(new Set(ids).size).toBe(ids.length);
});

it('links to exactly the destinations it linked to before (the listed ones, as the sitemap), each once, when every place has tours', async () => {
  // Every country and region of the places data with tours: the most links the page can have.
  const everything: DestinationCounts = {
    all: { tours: 9999, operators: 8 },
    destinations: [
      ...places.data.countries.map((c, i) => ({ countryId: c.id, regionId: null, tours: 1 + (i % 40), operators: 1 })),
      ...places.data.regions.map((r, i) => ({ countryId: r.countryId, regionId: r.id, tours: 1 + (i % 30), operators: 1 })),
    ],
  };
  mocks.countToursByDestination.mockResolvedValue(everything);
  for (const locale of ['zh-Hant', 'en'] as const) {
    const { container, unmount } = await renderPage(locale);
    const hrefs = destinationHrefs(container);
    // The page before this directory linked to listedDestinations (the index in data order): the same set.
    const before = listedDestinations(places, everything).map(d => localeHref(locale, destinationPath(d)));
    expect(new Set(hrefs)).toEqual(new Set(before));
    expect(hrefs).toHaveLength(before.length);
    expect(hrefs.length).toBeGreaterThan(150);
    unmount();
  }
});

it.each([
  ['zh-Hans', '旅行团目的地', '跳到', ['中国内地及港澳台', [[['中国', '/zh-hans/tours/china', '2 团'], ['北京', '/zh-hans/tours/china-beijing', '1']]], [['澳门', '/zh-hans/tours/macau', '3 团']]]],
  ['en', 'Tour destinations', 'Jump to', ['Mainland China, Hong Kong, Macau and Taiwan', [[['China', '/en/tours/china', '2 tours'], ['Beijing', '/en/tours/china-beijing', '1']]], [['Macau', '/en/tours/macau', '3 tours']]]],
] as const)('in %s every heading, name, count and link is in that language', async (locale, heading, jumpName, first) => {
  const { container } = await renderPage(locale);
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(heading);
  expect(within(screen.getByRole('navigation', { name: jumpName })).getAllByRole('link')[0]).toHaveTextContent(first[0]);
  expect(outline(container)[0]).toEqual(first);
});

const css = () => readFileSync(join(__dirname, 'tours-page.module.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\s+/g, ' ');

it('the look (drawing D1): no boxes; ink links underlined only under the pointer, with the focus ring; muted tabular counts', () => {
  const text = css();
  // No card backgrounds or borders round a country: only the parts' 2px ink rule and hairlines between countries.
  expect(text).toMatch(/\.group \{[^}]*border-top: 2px solid var\(--ink\)/);
  expect(text).toMatch(/\.country \+ \.country, \.countries \+ \.plain \{ border-top: 1px solid var\(--line\); \}/);
  for (const name of ['country', 'region', 'plainCountry', 'countries', 'regions', 'plain']) {
    const rule = text.match(new RegExp(`\\.${name} \\{([^}]*)\\}`))?.[1] ?? '';
    expect(rule, name).not.toMatch(/background|border-radius|border:/);
  }
  expect(text).toMatch(/\.countryLink, \.regionLink, \.jumpLink \{ color: var\(--ink\); text-decoration: none; \}/);
  expect(text).toMatch(/\.countryLink:hover, \.regionLink:hover, \.jumpLink:hover \{ text-decoration: underline; text-underline-offset: 3px; \}/);
  expect(text).toMatch(/\.countryLink:focus-visible, \.regionLink:focus-visible, \.jumpLink:focus-visible \{ outline: 2px solid var\(--focus\); outline-offset: 2px; \}/);
  // On phones a country without regions: its count close under its name, more room between rows, and the ring on the
  // name's line box (no offset) so it stays clear of the count.
  expect(text).toMatch(/@media \(max-width: 639px\) \{.*\.plainCountry \{[^}]*row-gap: 2px; padding: 0\.32em 0; \}/);
  expect(text).toMatch(/@media \(max-width: 639px\) \{.*\.plainCountry > \.countryLink:focus-visible \{ outline-offset: 0; \}/);
  // The ring's side room: wider by 3px each side, pulled back by the same, so the name does not move.
  expect(text).toMatch(/@media \(max-width: 639px\) \{.*\.plainCountry > \.countryLink \{ padding: 0 3px; margin: 0 -3px; \}/);
  expect(text).toMatch(/\.count, \.regionCount \{[^}]*color: var\(--text-muted\);[^}]*font-variant-numeric: tabular-nums;/);
  // No word is ever broken inside itself (lib/word-breaks.test.ts): names stay whole.
  expect(text).not.toMatch(/overflow-wrap|word-break/);
});

it('the columns: the same everywhere on the page for each kind, in ems of each grid\'s font (they grow with the text), per language', () => {
  const text = css();
  // One track list for every country's regions, and one for the countries without regions: so they line up.
  expect(text).toMatch(/\.regions \{[^}]*grid-template-columns: repeat\(auto-fill, minmax\(min\(var\(--col-region\), 100%\), 1fr\)\); font-size: 15px;/);
  expect(text).toMatch(/\.plain \{[^}]*grid-template-columns: repeat\(auto-fill, minmax\(min\(var\(--col-plain\), 100%\), 1fr\)\);[^}]*font-size: 19px;/);
  // Per language: English names are far longer (Bangkok & Central Thailand, Bosnia and Herzegovina). In ems of
  // 19px (countries) and 15px (regions), each holding a four-digit count with its comma: the measured need plus 12px,
  // rounded up at the third decimal of an em only (never to a whole pixel: 208px instead of 207.3 cost the Chinese
  // countries without regions their fifth column on every desktop). 172 (from before), 130.23, 207.35px; 241.28,
  // 264.75, 353.65px. Never a column width in px.
  expect(text).toMatch(/\.page \{ --col-country: 9\.053em; --col-region: 8\.682em; --col-plain: 10\.913em; \}/);
  expect(text).toMatch(/\.page:lang\(en\) \{ --col-country: 12\.699em; --col-region: 17\.650em; --col-plain: 18\.613em; \}/);
  expect(text).not.toMatch(/--col-[a-z]+: [\d.]+px/);
  // Names may wrap between their words when the text is made much larger; never inside a word (no break rules).
  expect(text).not.toMatch(/\.(countryLink|regionLink) \{[^}]*nowrap/);
});

it('on phones a cell whose name and count need more than its column takes the whole row (.long), in its place, unless a query lets it in', () => {
  expect(css()).toMatch(/@media \(max-width: 639px\) \{.* \.long \{ grid-column: 1 \/ -1; \} \}/);
  expect(css()).toMatch(/@media \(max-width: 639px\) \{.* \.regions, \.plain \{ container-type: inline-size; \}/);
});

it('marks a cell .long, in every language, only where its name and count need more than its phone column', async () => {
  const everyPlace: DestinationCounts = {
    all: { tours: 9999, operators: 8 },
    destinations: [
      ...places.data.countries.map(c => ({ countryId: c.id, regionId: null, tours: 5, operators: 1 })),
      ...places.data.regions.map(r => ({ countryId: r.countryId, regionId: r.id, tours: ({ 'korea-seoul': 1169, 'taiwan-north': 61, 'thailand-bangkok': 144 } as Record<string, number>)[r.id] ?? 3, operators: 1 })),
    ],
  };
  mocks.countToursByDestination.mockResolvedValue(everyPlace);
  const long = (container: HTMLElement) => [...container.querySelectorAll(`section li.${styles.long}`)].map(li => li.querySelector('a')!.getAttribute('href'));
  const en = await renderPage('en');
  const marked = long(en.container);
  expect(marked).toEqual(expect.arrayContaining(['/en/tours/thailand-bangkok', '/en/tours/bosnia', '/en/tours/korea-seoul', '/en/tours/taiwan-north']));
  // Each with its mark, and the page's container queries for the marks (lib/directory-cells.test.ts checks them):
  // "Northern Taiwan 61" is let into its column somewhere, "Bangkok & Central Thailand 144" nowhere.
  const mark = (href: string) => en.container.querySelector(`li:has(> a[href="${href}"])`)!.getAttribute('data-fit');
  const queries = en.container.querySelector('style')!.textContent!;
  for (const li of en.container.querySelectorAll(`section li.${styles.long}`)) expect(li.getAttribute('data-fit')).toMatch(/^(region|plain)-en-\d+$/);
  expect(en.container.querySelectorAll('section li[data-fit]:not([class~="' + styles.long + '"])')).toHaveLength(0);
  expect(queries).toContain(`.${styles.long}[data-fit=${mark('/en/tours/taiwan-north')}]`);
  expect(queries).not.toContain(`[data-fit=${mark('/en/tours/thailand-bangkok')}]`);
  expect(queries).not.toMatch(/[<>&"']/);
  expect(marked).not.toContain('/en/tours/china-inner-mongolia');
  expect(marked).not.toContain('/en/tours/hongkong');
  // Most are ordinary.
  expect(marked.length).toBeLessThan(en.container.querySelectorAll(`.${styles.region}, .${styles.plainCountry}`).length / 4);
  en.unmount();
  // Chinese: only 首爾及京畿 with its four digits.
  const zh = await renderPage('zh-Hant');
  expect(long(zh.container)).toEqual(['/tours/korea-seoul']);
  expect(zh.container.querySelector('style')!.textContent).toContain('[data-fit=region-zh-');
  zh.unmount();
  // No marks (the few short names of the first test), no queries.
  mocks.countToursByDestination.mockResolvedValue(counts);
  const few = await renderPage('zh-Hant');
  expect(few.container.querySelector('style')).toBeNull();
  few.unmount();
});

it('a jump moves the keyboard to the section: each section can take focus (not by Tab) and draws no ring', async () => {
  const { container } = await renderPage('zh-Hant');
  for (const section of container.querySelectorAll('section')) expect(section).toHaveAttribute('tabindex', '-1');
  expect(css()).toMatch(/\.group:focus \{ outline: none; \}/);
});

it('touch targets: jump links 32px tall on wide screens and 44px on phones, as every link of the directory there', () => {
  const text = css();
  expect(text).toMatch(/\.jumpLink \{[^}]*min-height: 32px/);
  expect(text).toMatch(/@media \(max-width: 639px\) \{.*\.jumpLink \{ min-height: 44px; \}/);
  expect(text).toMatch(/@media \(max-width: 639px\) \{.*\.countryLine, \.region, \.plainCountry, \.top > \.browseLine \{ min-height: 44px; \}/);
});

it.each([
  ['zh-Hant', '旅行團目的地', '按國家及地區瀏覽香港多間旅行社的旅行團，並查看每個目的地現時列出多少個旅行團。', 'https://example.invalid/tours'],
  ['zh-Hans', '旅行团目的地', '按国家和地区浏览香港多家旅行社的旅行团，并查看每个目的地目前列出多少个旅行团。', 'https://example.invalid/zh-hans/tours'],
  ['en', 'Tour destinations', 'Browse group tours from several Hong Kong tour operators by country and region, with how many tours each destination has now.', 'https://example.invalid/en/tours'],
] as const)('in %s: its own title, description and canonical, with the three languages and x-default', async (locale, title, description, canonical) => {
  const meta = await toursPageMetadata(locale);
  expect(meta).toMatchObject({
    title, description,
    alternates: {
      canonical,
      languages: { 'zh-Hant': 'https://example.invalid/tours', 'zh-Hans': 'https://example.invalid/zh-hans/tours', en: 'https://example.invalid/en/tours', 'x-default': 'https://example.invalid/tours' },
    },
  });
  expect(meta).not.toHaveProperty('robots');
  // Nothing in it depends on the data: it never reads the database.
  expect(mocks.countToursByDestination).not.toHaveBeenCalled();
  expect(mocks.storedDb).not.toHaveBeenCalled();
});

it('the database being down: the page is not made at all (it throws, so no page saying "cannot read" can be stored), and nothing is logged here', async () => {
  vi.stubEnv('DATABASE_URL', 'postgres://invented@127.0.0.1:1/none');
  mocks.countToursByDestination.mockRejectedValue(Object.assign(new Error('connection refused'), { code: 'ECONNREFUSED' }));
  await expect(ToursPage({ locale: 'zh-Hant' })).rejects.toThrow(/destinations index: the database at DATABASE_URL could not be read \(ECONNREFUSED\)/);
  // Its metadata is the same as with the database up: there is no stored page that could be indexed with the message.
  expect(await toursPageMetadata('zh-Hant')).not.toHaveProperty('robots');
  expect(consoleError).not.toHaveBeenCalled();
});

it('with no tours at all, the page is not made (an empty answer is a fault: the last good copy stays in use)', async () => {
  mocks.countToursByDestination.mockResolvedValue({ all: { tours: 0, operators: 0 }, destinations: [] });
  await expect(ToursPage({ locale: 'en' })).rejects.toThrow(/^destinations index: the database answered with no rows/);
});

it.each([
  ['zh-Hant', '', '旅行團目的地'],
  ['zh-Hans', '/zh-hans', '旅行团目的地'],
  ['en', '/en', 'Tour destinations'],
] as const)('in %s, one breadcrumb trail as structured data: the home page, then this page under its heading', async (locale, prefix, name) => {
  const { container } = await renderPage(locale);
  const blocks = [...container.querySelectorAll('script[type="application/ld+json"]')];
  expect(blocks).toHaveLength(1);
  expect(JSON.parse(blocks[0].textContent!)).toEqual({
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: '跟邊團', item: `https://example.invalid${prefix}` },
      { '@type': 'ListItem', position: 2, name, item: `https://example.invalid${prefix}/tours` },
    ],
  });
});
