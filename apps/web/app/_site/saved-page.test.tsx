import { it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { Db } from '@hktours/db/read';
import { I18nProvider } from '../../lib/i18n-client';
import type { Locale } from '../../lib/i18n';
import { localeHref, siteUrl } from '../../lib/locale-path';
import type { SavedPageData } from '../../lib/saved-page-data';

const mocks = vi.hoisted(() => ({
  requestDb: vi.fn<() => Promise<Db>>(),
  loadSavedPage: vi.fn<(connect: () => Promise<Db>, raw: Record<string, string | string[] | undefined>, today: string, reads?: unknown) => Promise<SavedPageData>>(),
}));
vi.mock('../../lib/db', () => ({ requestDb: mocks.requestDb }));
vi.mock('../../lib/saved-page-data', () => ({ loadSavedPage: mocks.loadSavedPage }));
vi.mock('next/navigation', async importOriginal => ({
  ...(await importOriginal<typeof import('next/navigation')>()),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

const { SavedPage, savedPageMetadata } = await import('./saved-page');

beforeEach(() => { mocks.loadSavedPage.mockReset(); window.localStorage.clear(); });
afterEach(() => { vi.restoreAllMocks(); });

const renderPage = async (locale: Locale, query: Record<string, string> = {}) =>
  render(<I18nProvider locale={locale}>{await SavedPage({ locale, searchParams: Promise.resolve(query) })}</I18nProvider>);

it.each([
  ['zh-Hant', '已收藏的旅行團'],
  ['zh-Hans', '已收藏的旅行团'],
  ['en', 'Saved tours'],
] as const)('%s: titled %s, its own address as canonical, the three languages as alternates, and always noindex', (locale, title) => {
  const canonical = siteUrl(localeHref(locale, '/saved'));
  expect(canonical).toMatch(/\/saved$/);
  const metadata = savedPageMetadata(locale);
  expect(metadata.title).toBe(title);
  expect(metadata.robots).toEqual({ index: false });
  expect(metadata.alternates?.canonical).toBe(canonical);
  expect(Object.keys(metadata.alternates?.languages ?? {})).toHaveLength(4); // three languages and x-default
});

it.each([
  ['zh-Hant', '已收藏的旅行團', '收藏只保存在這個瀏覽器內'],
  ['zh-Hans', '已收藏的旅行团', '收藏只保存在这个浏览器内'],
  ['en', 'Saved tours', 'Saved tours are kept in this browser only'],
] as const)('%s: one h1, and the line saying the list stays in this browser', async (locale, title, intro) => {
  mocks.loadSavedPage.mockResolvedValue({ asked: [], dropped: 0, tours: [], operators: [] });
  await renderPage(locale);
  expect(screen.getAllByRole('heading', { level: 1 }).map(h => h.textContent)).toEqual([title]);
  expect(screen.getByText(new RegExp(intro))).toBeInTheDocument();
});

it('reads the address\'s list through the loader, with the database opened only by the loader', async () => {
  mocks.loadSavedPage.mockResolvedValue({ asked: [], dropped: 0, tours: [], operators: [] });
  await renderPage('zh-Hant', { t: 'egl:KIX5' });
  expect(mocks.loadSavedPage).toHaveBeenCalledTimes(1);
  const [connect, raw] = mocks.loadSavedPage.mock.calls[0];
  expect(connect).toBe(mocks.requestDb);
  expect(raw).toEqual({ t: 'egl:KIX5' });
  expect(mocks.requestDb).not.toHaveBeenCalled();
});

it('when the tours cannot be read: a short message, and the page still says what it is', async () => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  mocks.loadSavedPage.mockRejectedValue(new Error('connection refused'));
  await renderPage('zh-Hant', { t: 'egl:KIX5' });
  expect(screen.getByRole('alert')).toHaveTextContent('暫時未能載入資料，請稍後再試。');
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('已收藏的旅行團');
});
