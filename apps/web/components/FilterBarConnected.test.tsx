import { it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { OperatorInfo } from '@hktours/db/read';
import { I18nProvider } from '../lib/i18n-client';
import { FilterBarConnected } from './FilterBarConnected';

const push = vi.fn<(href: string, opts?: { scroll?: boolean }) => void>();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }), usePathname: () => '/' }));

const operators: OperatorInfo[] = [{ id: 'egl', nameZh: '東瀛遊', nameEn: 'EGL Tours', color: '#d62839', lastGoodRunAt: null }];

beforeEach(() => { push.mockReset(); });

it('a change goes into the address on the destination\'s page, with the page dropped, without scrolling to the top', async () => {
  const user = userEvent.setup();
  render(
    <I18nProvider locale="zh-Hant">
      <FilterBarConnected state={{ filters: { destination: { countryId: 'japan', regionId: 'japan-kansai' } }, sort: 'days', page: 3 }} operators={operators} today="2026-11-12" />
    </I18nProvider>,
  );
  await user.click(screen.getByRole('button', { name: '日數：全部' }));
  await user.click(screen.getByRole('button', { name: '4–6日' }));
  expect(push).toHaveBeenCalledWith('/tours/japan-kansai?dmin=4&dmax=6&sort=days', { scroll: false });
});

it('clearing the last filter goes back to the bare address', async () => {
  const user = userEvent.setup();
  render(
    <I18nProvider locale="zh-Hant">
      <FilterBarConnected state={{ filters: { operators: ['egl'] }, sort: 'price', page: 2 }} operators={operators} today="2026-11-12" />
    </I18nProvider>,
  );
  await user.click(screen.getByRole('button', { name: '旅行社：東瀛遊' }));
  await user.click(screen.getByRole('checkbox', { name: '東瀛遊' }));
  expect(push).toHaveBeenCalledWith('/', { scroll: false });
});

it.each([
  ['zh-Hans', '/zh-hans/tours/japan-kansai?dmin=4&dmax=6&sort=days', '天数：不限', '4–6天'],
  ['en', '/en/tours/japan-kansai?dmin=4&dmax=6&sort=days', 'Length: Any', '4–6 days'],
] as const)('in %s the new address stays in the language: %s', async (locale, href, pill, option) => {
  const user = userEvent.setup();
  render(
    <I18nProvider locale={locale}>
      <FilterBarConnected state={{ filters: { destination: { countryId: 'japan', regionId: 'japan-kansai' } }, sort: 'days', page: 3 }} operators={operators} today="2026-11-12" />
    </I18nProvider>,
  );
  await user.click(screen.getByRole('button', { name: pill }));
  await user.click(screen.getByRole('button', { name: option }));
  expect(push).toHaveBeenCalledWith(href, { scroll: false });
});

it.each([
  ['zh-Hant', '清除目的地：日本 → 關西', '/?dmin=4&op=egl&sort=days'],
  ['zh-Hans', '清除目的地：日本 → 关西', '/zh-hans?dmin=4&op=egl&sort=days'],
  ['en', 'Clear destination: Japan → Kansai', '/en?dmin=4&op=egl&sort=days'],
] as const)('in %s the destination pill\'s ✕ goes to the search page with the other filters kept: %s', async (locale, pill, href) => {
  const user = userEvent.setup();
  render(
    <I18nProvider locale={locale}>
      <FilterBarConnected
        state={{ filters: { destination: { countryId: 'japan', regionId: 'japan-kansai' }, daysMin: 4, operators: ['egl'] }, sort: 'days', page: 2 }}
        operators={operators} today="2026-11-12"
      />
    </I18nProvider>,
  );
  await user.click(screen.getByRole('button', { name: pill }));
  expect(push).toHaveBeenCalledWith(href, { scroll: false });
});

it('a typed value on a destination\'s page keeps the destination (the bar round-trips it through the query)', async () => {
  const user = userEvent.setup();
  render(
    <I18nProvider locale="en">
      <FilterBarConnected state={{ filters: { destination: { countryId: 'japan', regionId: null } }, sort: 'price', page: 1 }} operators={operators} today="2026-11-12" />
    </I18nProvider>,
  );
  await user.click(screen.getByRole('button', { name: 'Price: Any' }));
  await user.type(screen.getByRole('spinbutton', { name: 'To' }), '9000');
  await user.click(screen.getByRole('button', { name: 'Apply' }));
  expect(push).toHaveBeenCalledWith('/en/tours/japan?pmax=9000', { scroll: false });
});
