import { it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { isIsoDate } from '@hktours/core';
import type { Db, OperatorListing } from '@hktours/db/read';
import { I18nProvider } from '../../lib/i18n-client';
import type { Locale } from '../../lib/i18n';
import styles from './operators-page.module.css';

// The page is a stored copy (app/(zh-hant)/operators/page.tsx revalidate): it reads through the stored pages' handle,
// and the per-request one fails if it is ever used.
const mocks = vi.hoisted(() => ({
  storedDb: vi.fn<() => Promise<Db>>(),
  requestDb: vi.fn<() => Promise<Db>>(),
  getOperatorListings: vi.fn<(db: Db, today: string) => Promise<OperatorListing[]>>(),
}));
vi.mock('../../lib/db', () => ({ storedDb: mocks.storedDb, requestDb: mocks.requestDb }));
vi.mock('../../lib/search-page-data', () => ({ cachedReads: { getOperatorListings: mocks.getOperatorListings } }));

const { OperatorsPage, operatorsPageMetadata } = await import('./operators-page');

const fakeDb = {} as Db;
const listing = (id: OperatorListing['id'], nameZh: string, nameEn: string, color: string, tours: number): OperatorListing => ({
  id, nameZh, nameEn, color, siteUrl: `https://${id}.example.test`, lastGoodRunAt: '2026-11-12T18:00:00.000Z', tours, countries: [],
});
/**
 * Invented listings in the site's order (as the database gives them: only operators with a good run): a light-coloured
 * tag (dark text), an unusable colour, one with a good run but no tours now (still listed, with 0).
 */
const listings = [
  listing('egl', '東瀛遊', 'EGL Tours', '#d62839', 12),
  listing('jetour', '捷旅', 'Jetour', '#f5d000', 7),
  listing('texpert', '專業旅運', 'Travel Expert', 'red', 1),
  listing('bigline', '大航假期', 'Big Line Holiday', '#2a9d4b', 0),
];

let consoleError: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  mocks.storedDb.mockReset().mockResolvedValue(fakeDb);
  mocks.requestDb.mockReset().mockRejectedValue(new Error('the stored page used the per-request handle'));
  mocks.getOperatorListings.mockReset().mockResolvedValue(listings);
  consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => { consoleError.mockRestore(); vi.unstubAllEnvs(); });

async function renderPage(locale: Locale) {
  return render(<I18nProvider locale={locale}>{await OperatorsPage({ locale })}</I18nProvider>);
}

/** A paragraph whose whole text is `text` (its clauses may be in spans of their own). */
const paragraph = (text: string) => (_: string, el: Element | null) => el?.tagName === 'P' && el.textContent === text;

/** Each operator's link: its text, its address, and its tag's text. */
const operatorLinks = (container: HTMLElement) =>
  [...container.querySelectorAll('ul a')].map(a => [a.textContent, a.getAttribute('href'), a.querySelector(`.${styles.tag}`)?.textContent]);

it.each([
  ['zh-Hant', '旅行社一覽', '現時列出 20 個旅行團，來自 3 間旅行社。', '本網站並非任何旅行社的網站，與各旅行社並無任何關連。', ['按目的地瀏覽', '/tours'], [
    ['東瀛遊12 團', '/operators/egl', '東瀛遊'], ['捷旅7 團', '/operators/jetour', '捷旅'], ['專業旅運1 團', '/operators/texpert', '專業旅運'],
    ['大航假期0 團', '/operators/bigline', '大航假期'],
  ]],
  ['zh-Hans', '旅行社一览', '目前列出 20 个旅行团，来自 3 家旅行社。', '本网站并非任何旅行社的网站，与各旅行社没有任何关联。', ['按目的地浏览', '/zh-hans/tours'], [
    ['東瀛遊12 团', '/zh-hans/operators/egl', '東瀛遊'], ['捷旅7 团', '/zh-hans/operators/jetour', '捷旅'],
    ['專業旅運1 团', '/zh-hans/operators/texpert', '專業旅運'], ['大航假期0 团', '/zh-hans/operators/bigline', '大航假期'],
  ]],
  ['en', 'Tour operators', 'Listing 20 tours from 3 operators.', "This site is not any tour operator's website, and is not affiliated with any of them.", ['Browse by destination', '/en/tours'], [
    ['EGL Tours12 tours', '/en/operators/egl', 'EGL Tours'], ['Jetour7 tours', '/en/operators/jetour', 'Jetour'],
    ['Travel Expert1 tour', '/en/operators/texpert', 'Travel Expert'], ['Big Line Holiday0 tours', '/en/operators/bigline', 'Big Line Holiday'],
  ]],
] as const)('in %s: the heading, the counts, the line saying this is no operator\'s site once, and every operator linking to its page', async (locale, heading, count, notOfficial, browse, links) => {
  const { container } = await renderPage(locale);
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(heading);
  expect(screen.getByText(count)).toBeInTheDocument();
  const line = screen.getByText(paragraph(notOfficial));
  expect(screen.getAllByText(paragraph(notOfficial))).toHaveLength(1);
  // In Chinese each clause stays on one line, the line breaking after the comma.
  expect([...line.querySelectorAll('span')].map(s => s.textContent)).toEqual(locale === 'en' ? [] : notOfficial.split(/(?<=，)/));
  // The other index on a line of its own (never a line starting with a separator).
  const browseLink = screen.getByRole('link', { name: browse[0] });
  expect(browseLink).toHaveAttribute('href', browse[1]);
  expect(browseLink.parentElement?.tagName).toBe('P');
  expect(browseLink.parentElement?.textContent).toBe(browse[0]);
  expect(container.textContent).not.toContain('·');
  expect(operatorLinks(container)).toEqual(links);
  // No images: no logos.
  expect(container.querySelector('img, svg, picture')).toBeNull();
  const [db, today] = mocks.getOperatorListings.mock.calls[0];
  expect(db).toBe(fakeDb);
  expect(isIsoDate(today)).toBe(true);
});

it('each tag carries its operator\'s colour, with dark text on a light colour, and only a #rrggbb colour reaches the style', async () => {
  const { container } = await renderPage('zh-Hant');
  const tags = [...container.querySelectorAll<HTMLElement>(`.${styles.tag}`)];
  expect(tags.map(tag => [tag.style.getPropertyValue('--c'), tag.classList.contains(styles.tagDark)])).toEqual([
    // Big Line's green reads better with dark text, as on its rows.
    ['#d62839', false], ['#f5d000', true], ['var(--op-fallback)', false], ['#2a9d4b', true],
  ]);
});

it('an operator never scraped is not on the index, even if the listings held it', async () => {
  mocks.getOperatorListings.mockResolvedValue([...listings, { ...listing('taste', '味力之旅', 'Taste Travel', '#007a7a', 0), lastGoodRunAt: null }]);
  const { container } = await renderPage('zh-Hant');
  expect(operatorLinks(container).map(l => l[1])).toEqual(['/operators/egl', '/operators/jetour', '/operators/texpert', '/operators/bigline']);
  expect(container.textContent).not.toContain('味力之旅');
});

it('with no operator listing tours, the page is not made (an empty answer is a fault: the last good copy stays in use)', async () => {
  mocks.getOperatorListings.mockResolvedValue(listings.map(l => ({ ...l, tours: 0 })));
  await expect(OperatorsPage({ locale: 'en' })).rejects.toThrow(/^operators index: the database answered with no rows/);
});

const site = 'https://example.invalid';
it.each([
  ['zh-Hant', '旅行社一覽', '按旅行社瀏覽香港多間旅行社的旅行團，並查看每間旅行社現時列出多少個旅行團。', `${site}/operators`],
  ['zh-Hans', '旅行社一览', '按旅行社浏览香港多家旅行社的旅行团，并查看每家旅行社目前列出多少个旅行团。', `${site}/zh-hans/operators`],
  ['en', 'Tour operators', 'Browse group tours by Hong Kong tour operator, with how many tours each one lists now.', `${site}/en/operators`],
] as const)('in %s: its own title through the site\'s usual pattern (" | ", as every page but the operators\' own), description, canonical and hreflang; indexable', async (locale, title, description, canonical) => {
  const meta = await operatorsPageMetadata(locale);
  expect(meta.title).toBe(title);
  expect(meta.description).toBe(description);
  expect(meta.openGraph).toMatchObject({ title: `${title} | 跟邊團`, description });
  expect(meta.alternates).toEqual({
    canonical,
    languages: { 'zh-Hant': `${site}/operators`, 'zh-Hans': `${site}/zh-hans/operators`, en: `${site}/en/operators`, 'x-default': `${site}/operators` },
  });
  expect(meta).not.toHaveProperty('robots');
  // Nothing in it depends on the data: it never reads the database.
  expect(mocks.getOperatorListings).not.toHaveBeenCalled();
  expect(mocks.storedDb).not.toHaveBeenCalled();
});

it('the database being down: the page is not made at all (it throws, so no page saying "cannot read" can be stored), and nothing is logged here', async () => {
  vi.stubEnv('DATABASE_URL', 'postgres://invented@127.0.0.1:1/none');
  mocks.getOperatorListings.mockRejectedValue(Object.assign(new Error('connection refused'), { code: 'ECONNREFUSED' }));
  await expect(OperatorsPage({ locale: 'zh-Hant' })).rejects.toThrow(/operators index: the database at DATABASE_URL could not be read \(ECONNREFUSED\)/);
  // Its metadata is the same as with the database up: there is no stored page that could be indexed with the message.
  expect(await operatorsPageMetadata('zh-Hant')).not.toHaveProperty('robots');
  expect(consoleError).not.toHaveBeenCalled();
});
