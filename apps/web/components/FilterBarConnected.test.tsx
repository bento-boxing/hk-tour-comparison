import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { OperatorInfo } from '@hktours/db/read';
import { I18nProvider } from '../lib/i18n-client';
import { FixedOperatorProvider, FixedSeasonProvider } from '../lib/search-address';
import { seasonWindow } from '../lib/seasons';
import type { SearchState } from '../lib/search-params';
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
  await user.click(screen.getByRole('button', { name: '天數：全部' }));
  await user.click(screen.getByRole('button', { name: '4–6天' }));
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

describe('on an operator\'s page (FixedOperatorProvider)', () => {
  const renderOn = (locale: 'zh-Hant' | 'zh-Hans' | 'en', state: SearchState) => render(
    <I18nProvider locale={locale}>
      <FixedOperatorProvider operator="egl">
        <FilterBarConnected state={state} operators={operators} today="2026-11-12" />
      </FixedOperatorProvider>
    </I18nProvider>,
  );
  const onEgl = (filters: SearchState['filters']): SearchState => ({ filters: { ...filters, operators: ['egl'] }, sort: 'days', page: 3 });

  it.each([
    ['zh-Hant', '天數：全部', '4–6天', '/operators/egl?dmin=4&dmax=6&sort=days'],
    ['zh-Hans', '天数：不限', '4–6天', '/zh-hans/operators/egl?dmin=4&dmax=6&sort=days'],
    ['en', 'Length: Any', '4–6 days', '/en/operators/egl?dmin=4&dmax=6&sort=days'],
  ] as const)('in %s a change stays on the operator\'s page, with no op in the address', async (locale, pill, option, href) => {
    const user = userEvent.setup();
    renderOn(locale, onEgl({}));
    await user.click(screen.getByRole('button', { name: pill }));
    await user.click(screen.getByRole('button', { name: option }));
    expect(push).toHaveBeenCalledWith(href, { scroll: false });
  });

  it('offers no operator filter: the operator is the page\'s', () => {
    renderOn('zh-Hant', onEgl({}));
    expect(screen.queryByRole('button', { name: /^旅行社：/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '天數：全部' })).toBeInTheDocument();
  });

  it('the destination is a filter here: its ✕ stays on the page, and a typed value keeps it in the query', async () => {
    const user = userEvent.setup();
    renderOn('zh-Hant', onEgl({ destination: { countryId: 'japan', regionId: 'japan-kansai' }, daysMin: 4 }));
    await user.click(screen.getByRole('button', { name: '清除目的地：日本 → 關西' }));
    expect(push).toHaveBeenLastCalledWith('/operators/egl?dmin=4&sort=days', { scroll: false });
    await user.click(screen.getByRole('button', { name: '價錢：全部' }));
    await user.type(screen.getByRole('spinbutton', { name: '至' }), '9000');
    await user.click(screen.getByRole('button', { name: '套用' }));
    expect(push).toHaveBeenLastCalledWith('/operators/egl?dest=japan-kansai&dmin=4&pmax=9000&sort=days', { scroll: false });
  });
});

describe('on a season\'s page (FixedSeasonProvider)', () => {
  const christmas = seasonWindow('christmas', 2026)!;
  const renderOn = (locale: 'zh-Hant' | 'zh-Hans' | 'en', state: SearchState) => render(
    <I18nProvider locale={locale}>
      <FixedSeasonProvider season={christmas}>
        <FilterBarConnected state={state} operators={operators} today="2026-11-22" />
      </FixedSeasonProvider>
    </I18nProvider>,
  );
  const onChristmas = (filters: SearchState['filters']): SearchState =>
    ({ filters: { ...filters, dateFrom: christmas.from, dateTo: christmas.to }, sort: 'days', page: 3 });

  it.each([
    ['zh-Hant', '天數：全部', '4–6天', '/seasons/christmas?dmin=4&dmax=6&sort=days'],
    ['zh-Hans', '天数：不限', '4–6天', '/zh-hans/seasons/christmas?dmin=4&dmax=6&sort=days'],
    ['en', 'Length: Any', '4–6 days', '/en/seasons/christmas?dmin=4&dmax=6&sort=days'],
  ] as const)('in %s a change that keeps the season\'s days stays on its page, with no from or to in the address', async (locale, pill, option, href) => {
    const user = userEvent.setup();
    renderOn(locale, onChristmas({}));
    await user.click(screen.getByRole('button', { name: pill }));
    await user.click(screen.getByRole('button', { name: option }));
    expect(push).toHaveBeenCalledWith(href, { scroll: false });
  });

  it('the departure dates show the season\'s days as chosen; other dates go to the search page with them, and clearing them too', async () => {
    const user = userEvent.setup();
    renderOn('zh-Hant', onChristmas({ destination: { countryId: 'japan', regionId: null }, daysMin: 4 }));
    await user.click(screen.getByRole('button', { name: '出發日期：12/19 – 12/27' }));
    let dialog = screen.getByRole('dialog', { name: '出發日期' });
    const to = within(dialog).getByLabelText('至');
    await user.clear(to);
    await user.type(to, '2026-12-31');
    await user.click(within(dialog).getByRole('button', { name: '套用' }));
    expect(push).toHaveBeenLastCalledWith('/tours/japan?from=2026-12-19&to=2026-12-31&dmin=4&sort=days', { scroll: false });
    await user.click(screen.getByRole('button', { name: '出發日期：12/19 – 12/27' }));
    dialog = screen.getByRole('dialog', { name: '出發日期' });
    await user.click(within(dialog).getByRole('button', { name: '清除' }));
    expect(push).toHaveBeenLastCalledWith('/tours/japan?dmin=4&sort=days', { scroll: false });
  });

  it('the destination is a filter here: its ✕ stays on the page', async () => {
    const user = userEvent.setup();
    renderOn('en', onChristmas({ destination: { countryId: 'japan', regionId: 'japan-kansai' }, daysMin: 4 }));
    await user.click(screen.getByRole('button', { name: 'Clear destination: Japan → Kansai' }));
    expect(push).toHaveBeenLastCalledWith('/en/seasons/christmas?dmin=4&sort=days', { scroll: false });
    // The operator filter stays: the path fixes only the dates.
    expect(screen.getByRole('button', { name: /^Operators: / })).toBeInTheDocument();
  });
});
