import { it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { OperatorInfo, TourCardData } from '@hktours/db/read';
import { I18nProvider } from '../lib/i18n-client';
import type { Locale } from '../lib/i18n';
import { ResultsConnected } from './ResultsConnected';
import { resetTripCache, takeTripAction } from '../lib/remembered-trip';

const push = vi.fn<(href: string) => void>();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));

beforeAll(() => { vi.setSystemTime(new Date('2026-11-12T04:00:00Z')); });
afterAll(() => { vi.useRealTimers(); });
beforeEach(() => { push.mockReset(); resetTripCache(); });

const operators: OperatorInfo[] = [{ id: 'egl', nameZh: '東瀛遊', nameEn: 'EGL Tours', color: '#d62839', lastGoodRunAt: null }];
const tour: TourCardData = {
  key: 'egl:KIX5', operatorId: 'egl', url: 'https://example.test/egl/KIX5', title: 'KIX5', days: 5, nights: 4,
  stops: [{ countryId: 'japan', regionId: 'japan-kansai', cityId: 'japan-kansai-osaka' }],
  start: { kind: 'hk', label: null }, end: { kind: 'hk', label: null },
  fromPriceHkd: 7999, windowPriceHkd: 7999, fallbackPriceHkd: 7999,
  departures: [{ date: '2026-12-18', priceHkd: 7999 }], priceChange: null, lastUpdated: '2026-11-11T19:10:00Z',
};

it.each([
  ['zh-Hant', '加入行程 +', '/chain?legs=egl%3AKIX5%402026-12-18&gap=1-3'],
  ['zh-Hans', '加入行程 +', '/zh-hans/chain?legs=egl%3AKIX5%402026-12-18&gap=1-3'],
  ['en', '+ Add to trip', '/en/chain?legs=egl%3AKIX5%402026-12-18&gap=1-3'],
] as const)('in %s, picking a date starts a chain on the chaining page in the same language', async (locale: Locale, add, href) => {
  const user = userEvent.setup();
  render(
    <I18nProvider locale={locale}>
      <ResultsConnected tours={[tour]} total={1} operators={operators} today="2026-11-12" />
    </I18nProvider>,
  );
  await user.click(screen.getByRole('button', { name: add }));
  await user.click(screen.getByRole('button', { name: /18/ }));
  expect(push).toHaveBeenCalledWith(href);
  // Task 71: starting a trip is the visitor's own action, so the trip page remembers it (lib/remembered-trip).
  expect(takeTripAction()).toBe(true);
});
