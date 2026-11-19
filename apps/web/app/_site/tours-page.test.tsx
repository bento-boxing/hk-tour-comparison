import { it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { isIsoDate } from '@hktours/core';
import type { Db, DestinationCounts } from '@hktours/db/read';
import { I18nProvider } from '../../lib/i18n-client';
import type { Locale } from '../../lib/i18n';

const mocks = vi.hoisted(() => ({
  requestDb: vi.fn<() => Promise<Db>>(),
  countToursByDestination: vi.fn<(db: Db, today: string) => Promise<DestinationCounts>>(),
}));
vi.mock('../../lib/db', () => ({ requestDb: mocks.requestDb }));
vi.mock('../../lib/search-page-data', () => ({ cachedReads: { countToursByDestination: mocks.countToursByDestination } }));

const { ToursPage, toursPageMetadata } = await import('./tours-page');

const fakeDb = {} as Db;
/** Invented counts: Japan and two regions, Korea and its region, an area with a tour, France and its only region. */
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
  ],
};

let consoleError: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  mocks.requestDb.mockReset().mockResolvedValue(fakeDb);
  mocks.countToursByDestination.mockReset().mockResolvedValue(counts);
  consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => { consoleError.mockRestore(); });

async function renderPage(locale: Locale) {
  return render(<I18nProvider locale={locale}>{await ToursPage({ locale })}</I18nProvider>);
}

/** Each part of the world's heading, then its countries' and regions' links as [text, href, count]. */
function outline(container: HTMLElement) {
  return [...container.querySelectorAll('section')].map(section => [
    section.querySelector('h2')?.textContent,
    [...section.querySelectorAll('a')].map(a => [a.textContent, a.getAttribute('href'), a.nextElementSibling?.textContent]),
  ]);
}

it('lists every destination with a page of its own, grouped as the country picker groups them, each a link with its count', async () => {
  const { container } = await renderPage('zh-Hant');
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('旅行團目的地');
  expect(screen.getByText('現時列出 20 個旅行團，來自 3 間旅行社。')).toBeInTheDocument();
  expect(outline(container)).toEqual([
    ['中國內地及港澳台', [['中國', '/tours/china', '2 團'], ['北京', '/tours/china-beijing', '1 團']]],
    ['日本及韓國', [
      ['日本', '/tours/japan', '12 團'], ['關東', '/tours/japan-kanto', '5 團'], ['關西', '/tours/japan-kansai', '7 團'],
      ['韓國', '/tours/korea', '5 團'], ['首爾及京畿', '/tours/korea-seoul', '5 團'],
    ]],
    ['歐洲', [['法國', '/tours/france', '1 團']]],
  ]);
  // Not listed: the area (華東), France's only region, and every destination without tours.
  expect(container.textContent).not.toMatch(/華東|泰國|沖繩/);
  expect(mocks.countToursByDestination).toHaveBeenCalledTimes(1);
  const [db, today] = mocks.countToursByDestination.mock.calls[0];
  expect(db).toBe(fakeDb);
  expect(isIsoDate(today)).toBe(true);
});

it.each([
  ['zh-Hans', '旅行团目的地', '中国内地及港澳台', ['中国', '/zh-hans/tours/china', '2 团']],
  ['en', 'Tour destinations', 'Mainland China, Hong Kong, Macau and Taiwan', ['China', '/en/tours/china', '2 tours']],
] as const)('in %s every heading, name, count and link is in that language', async (locale, heading, group, first) => {
  const { container } = await renderPage(locale);
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(heading);
  const [firstGroup] = outline(container);
  expect(firstGroup[0]).toBe(group);
  expect((firstGroup[1] as string[][])[0]).toEqual(first);
  expect(within(container).getByRole('link', { name: locale === 'en' ? 'Beijing' : '北京' })).toHaveAttribute('href', `/${locale === 'en' ? 'en' : 'zh-hans'}/tours/china-beijing`);
});

it.each([
  ['zh-Hant', '旅行團目的地', '按國家及地區瀏覽香港多間旅行社的旅行團，並查看每個目的地現時列出多少個旅行團。', 'https://ganbintuen.com/tours'],
  ['zh-Hans', '旅行团目的地', '按国家和地区浏览香港多家旅行社的旅行团，并查看每个目的地目前列出多少个旅行团。', 'https://ganbintuen.com/zh-hans/tours'],
  ['en', 'Tour destinations', 'Browse group tours from several Hong Kong tour operators by country and region, with how many tours each destination has now.', 'https://ganbintuen.com/en/tours'],
] as const)('in %s: its own title, description and canonical, with the three languages and x-default', async (locale, title, description, canonical) => {
  const meta = await toursPageMetadata(locale);
  expect(meta).toMatchObject({
    title, description,
    alternates: {
      canonical,
      languages: { 'zh-Hant': 'https://ganbintuen.com/tours', 'zh-Hans': 'https://ganbintuen.com/zh-hans/tours', en: 'https://ganbintuen.com/en/tours', 'x-default': 'https://ganbintuen.com/tours' },
    },
  });
  expect(meta).not.toHaveProperty('robots');
});

it('the database being down: the heading and the message, and the page marked noindex', async () => {
  mocks.countToursByDestination.mockRejectedValue(new Error('connection refused'));
  await renderPage('zh-Hant');
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('旅行團目的地');
  expect(screen.getByRole('alert')).toHaveTextContent('暫時未能載入資料，請稍後再試。');
  expect(screen.queryAllByRole('link')).toEqual([]);
  expect((await toursPageMetadata('zh-Hant')).robots).toEqual({ index: false });
  expect(consoleError).toHaveBeenCalledWith(expect.stringContaining('destinations index'), expect.any(Error));
});

it('with no tours at all, the index says so and lists nothing', async () => {
  mocks.countToursByDestination.mockResolvedValue({ all: { tours: 0, operators: 0 }, destinations: [] });
  await renderPage('en');
  expect(screen.getByText('No tours are listed right now.')).toBeInTheDocument();
  expect(screen.queryAllByRole('link')).toEqual([]);
});
