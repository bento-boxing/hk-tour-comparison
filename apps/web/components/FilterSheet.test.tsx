import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderToString } from 'react-dom/server';
import { it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { places } from '@hktours/core';
import type { OperatorInfo } from '@hktours/db/read';
import { makeT } from '../lib/i18n';
import { searchHref, type SearchState } from '../lib/search-params';
import { seasonSearchHref, seasonWindow } from '../lib/seasons';
import { FilterBar, type FilterBarProps } from './FilterBar';

const t = makeT('zh-Hant');
const operators: OperatorInfo[] = [
  { id: 'egl', nameZh: '東瀛遊', nameEn: 'EGL Tours', color: '#d62839', lastGoodRunAt: null },
  { id: 'jetour', nameZh: '捷旅', nameEn: 'Jetour', color: '#ee7b06', lastGoodRunAt: null },
];
const christmas = seasonWindow('christmas', 2026)!;
const lunar = seasonWindow('lunar-new-year', 2027)!;
const japan = { countryId: 'japan', regionId: null };

let onChange: ReturnType<typeof vi.fn<(next: SearchState) => void>>;
let user: ReturnType<typeof userEvent.setup>;
beforeEach(() => {
  onChange = vi.fn();
  user = userEvent.setup();
  // jsdom has the element but not its modal methods: open and close it as the browser would (close fires 'close').
  HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) { this.setAttribute('open', ''); };
  HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
    if (!this.hasAttribute('open')) return;
    this.removeAttribute('open');
    this.dispatchEvent(new Event('close'));
  };
  window.history.replaceState(null, '');
});
afterEach(() => { window.history.replaceState(null, ''); });

const props = (state: SearchState, extra: Partial<FilterBarProps> = {}): FilterBarProps => ({
  state, operators, places, t, onChange, today: '2026-11-22', total: 2392, seasons: [christmas, lunar],
  hrefFor: s => searchHref(s), ...extra,
});
const renderBar = (state: SearchState, extra: Partial<FilterBarProps> = {}) => render(<FilterBar {...props(state, extra)} />);
const opener = () => screen.getByRole('button', { name: /^篩選/ });
const sheet = () => screen.getByRole('dialog', { name: '篩選' });
const css = (file: string) => readFileSync(join(__dirname, file), 'utf8').replace(/\s+/g, ' ');

it('the phone bar: 篩選 with how many filters are on, the order on its own, and the tours found', () => {
  renderBar({ filters: { destination: japan, dateFrom: '2026-12-01', dateTo: '2026-12-31', daysMin: 3, operators: ['egl', 'jetour'] }, sort: 'date', page: 1 });
  // Three: the dates (a pair is one), the length, the operators (two are one); the destination is the band's.
  expect(opener()).toHaveAccessibleName('篩選（已選 3 項）');
  expect(opener()).toHaveTextContent(/^篩選3/);
  expect(opener()).toHaveAttribute('aria-haspopup', 'dialog');
  // The sort control keeps its full name; phones see the order alone.
  const sort = screen.getByRole('button', { name: '排序：出發日期 早→遲' });
  expect(sort.querySelector('[data-short]')).toHaveAttribute('data-short', '出發日期 早→遲');
  expect(sort.querySelector('[data-short]')).toHaveAttribute('aria-hidden', 'true');
  expect(screen.getByText('2,392 個旅行團')).toBeInTheDocument();
});

it('in English the phone bar shows the order in short; the control is still named in full', () => {
  render(<FilterBar {...props({ filters: {}, sort: 'date-desc', page: 1 }, { t: makeT('en') })} />);
  const sort = screen.getByRole('button', { name: 'Sort by: Departure date, latest first' });
  expect(sort.querySelector('[data-short]')).toHaveAttribute('data-short', 'Latest first');
  expect(screen.getByText('2,392 tours')).toBeInTheDocument();
});

it('no badge with nothing on; no count where the page does not know it', () => {
  renderBar({ filters: {}, sort: 'price', page: 1 }, { total: undefined });
  expect(opener()).toHaveAccessibleName('篩選');
  expect(screen.queryByText(/個旅行團$/)).not.toBeInTheDocument();
});

it('篩選 opens a modal sheet with every section, a history entry for Back, and the one-tap choices', async () => {
  renderBar({ filters: {}, sort: 'price', page: 1 });
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  await user.click(opener());
  const dialog = sheet();
  expect(opener()).toHaveAttribute('aria-expanded', 'true');
  expect(window.history.state).toMatchObject({ filterSheet: true });
  const groups = within(dialog).getAllByRole('group').map(g => g.getAttribute('aria-labelledby') && within(g).getByRole('heading').textContent);
  expect(groups).toEqual(['出發日期', '日數', '價錢（每人）', '旅行社', '可出行日期']);
  const chips = within(dialog).getAllByRole('button', { pressed: false }).map(b => b.textContent);
  expect(chips).toEqual([
    '聖誕', '農曆新年', '本月', '下月', '1–3日', '4–6日', '7–9日', '10日以上', 'HK$1,000以下', 'HK$3,000以下', 'HK$5,000以下', 'HK$10,000以下',
  ]);
  expect(within(dialog).getByRole('checkbox', { name: '東瀛遊' })).not.toBeChecked();
  expect(within(dialog).getByRole('button', { name: '關閉' })).toBeInTheDocument();
});

it('the choices are applied together by 顯示結果: one change, after the sheet\'s history entry is gone', async () => {
  renderBar({ filters: { destination: japan, priceMin: 500 }, sort: 'days', page: 3 });
  await user.click(opener());
  const dialog = sheet();
  await user.click(within(dialog).getByRole('button', { name: '聖誕' }));
  await user.click(within(dialog).getByRole('button', { name: '4–6日' }));
  await user.click(within(dialog).getByRole('button', { name: 'HK$3,000以下' })); // a ceiling: the lowest price goes
  await user.click(within(dialog).getByRole('checkbox', { name: '捷旅' }));
  await user.type(within(dialog).getByLabelText('最遲回來'), '2027-01-03');
  expect(within(dialog).getByRole('button', { name: '聖誕' })).toHaveAttribute('aria-pressed', 'true');
  expect(within(dialog).getByLabelText('由', { selector: '[type=date]' })).toHaveValue('2026-12-19');
  expect(onChange).not.toHaveBeenCalled();
  await user.click(within(dialog).getByRole('button', { name: '顯示結果' }));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  await waitFor(() => expect(onChange).toHaveBeenCalledTimes(1));
  expect(searchHref(onChange.mock.calls[0]![0])).toBe(
    '/tours/japan?from=2026-12-19&to=2026-12-27&tto=2027-01-03&dmin=4&dmax=6&pmax=3000&op=jetour&sort=days',
  );
  expect(window.history.state?.filterSheet).toBeUndefined();
  expect(opener()).toHaveFocus();
});

it('applied on the home page, whose stored copy gives way to a per-request copy (a new bar), focus is on the new 篩選', async () => {
  window.history.replaceState(null, '', '/');
  const first = renderBar({ filters: {}, sort: 'price', page: 1 });
  await user.click(opener());
  await user.click(within(sheet()).getByRole('button', { name: '4–6日' }));
  await user.click(within(sheet()).getByRole('button', { name: '顯示結果' }));
  await waitFor(() => expect(onChange).toHaveBeenCalledTimes(1));
  // The old page re-renders on the old address (put back after Back over the sheet's entry): nothing is used up.
  first.rerender(<FilterBar {...props({ filters: {}, sort: 'price', page: 1 })} />);
  (document.activeElement as HTMLElement | null)?.blur();
  // Then the new address, and the per-request copy's own bar.
  window.history.pushState(null, '', '/?dmin=4&dmax=6');
  first.unmount();
  renderBar({ filters: { daysMin: 4, daysMax: 6 }, sort: 'price', page: 1 });
  expect(opener()).toHaveFocus();
  // Used up: a later page's bar leaves the focus alone.
  (document.activeElement as HTMLElement | null)?.blur();
  window.history.pushState(null, '', '/tours/japan');
  renderBar({ filters: {}, sort: 'price', page: 1 });
  expect(document.body).toHaveFocus();
  window.history.replaceState(null, '', '/');
});

it('a one-tap choice pressed again empties its fields; this month and next month are Hong Kong months', async () => {
  renderBar({ filters: { daysMin: 4, daysMax: 6 }, sort: 'price', page: 1 });
  await user.click(opener());
  const dialog = sheet();
  const days = within(dialog).getByRole('button', { name: '4–6日' });
  expect(days).toHaveAttribute('aria-pressed', 'true');
  await user.click(days);
  expect(days).toHaveAttribute('aria-pressed', 'false');
  await user.click(within(dialog).getByRole('button', { name: '下月' }));
  await user.click(within(dialog).getByRole('button', { name: '顯示結果' }));
  await waitFor(() => expect(onChange).toHaveBeenCalledTimes(1));
  expect(searchHref(onChange.mock.calls[0]![0])).toBe('/?from=2026-12-01&to=2026-12-31');
});

it('清除全部 empties every field of the sheet (not the destination, not the order), applied by 顯示結果', async () => {
  renderBar({ filters: { destination: japan, travelFrom: '2026-12-01', priceMax: 9000, operators: ['egl'] }, sort: 'days', page: 2 });
  await user.click(opener());
  const dialog = sheet();
  await user.click(within(dialog).getByRole('button', { name: '清除全部' }));
  expect(within(dialog).getByRole('checkbox', { name: '東瀛遊' })).not.toBeChecked();
  expect(onChange).not.toHaveBeenCalled();
  await user.click(within(dialog).getByRole('button', { name: '顯示結果' }));
  await waitFor(() => expect(onChange).toHaveBeenCalledTimes(1));
  expect(searchHref(onChange.mock.calls[0]![0])).toBe('/tours/japan?sort=days');
});

it('closing without a change (×, or 顯示結果 with nothing changed) navigates nowhere; the next opening starts afresh', async () => {
  renderBar({ filters: { daysMin: 3 }, sort: 'price', page: 1 });
  await user.click(opener());
  await user.click(within(sheet()).getByRole('button', { name: '1–3日' }));
  await user.click(within(sheet()).getByRole('button', { name: '關閉' }));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  await user.click(opener());
  expect(within(sheet()).getByRole('button', { name: '1–3日' })).toHaveAttribute('aria-pressed', 'false');
  expect(within(sheet()).getAllByLabelText('由', { selector: '[type=number]' })[0]).toHaveValue(3);
  await user.click(within(sheet()).getByRole('button', { name: '顯示結果' }));
  await act(() => new Promise(r => setTimeout(r, 30)));
  expect(onChange).not.toHaveBeenCalled();
});

it('the browser\'s Back closes the sheet and stays on the page; Forward opens it again', async () => {
  renderBar({ filters: {}, sort: 'price', page: 1 });
  await user.click(opener());
  await user.click(within(sheet()).getByRole('button', { name: '10日以上' }));
  await act(async () => {
    window.history.replaceState(null, ''); // as after the browser goes back to the page's own entry
    window.dispatchEvent(new PopStateEvent('popstate', { state: null }));
  });
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  await act(() => new Promise(r => setTimeout(r, 30)));
  expect(onChange).not.toHaveBeenCalled();
  await act(async () => {
    window.history.replaceState({ filterSheet: true }, '');
    window.dispatchEvent(new PopStateEvent('popstate', { state: { filterSheet: true } }));
  });
  expect(sheet()).toBeInTheDocument();
});

it('reloaded on the sheet\'s history entry, the page opens it again', () => {
  window.history.replaceState({ filterSheet: true }, '');
  renderBar({ filters: {}, sort: 'price', page: 1 });
  expect(sheet()).toBeInTheDocument();
});

it('on a season\'s page: its season is the chosen one-tap, 清除全部 keeps it, and the badge does not count it', async () => {
  const state: SearchState = { filters: { dateFrom: christmas.from, dateTo: christmas.to, daysMin: 4 }, sort: 'price', page: 1 };
  renderBar(state, { fixedDates: christmas, hrefFor: s => seasonSearchHref(christmas, s) });
  expect(opener()).toHaveAccessibleName('篩選（已選 1 項）');
  await user.click(opener());
  expect(within(sheet()).getByRole('button', { name: '聖誕' })).toHaveAttribute('aria-pressed', 'true');
  await user.click(within(sheet()).getByRole('button', { name: '清除全部' }));
  expect(within(sheet()).getByRole('button', { name: '聖誕' })).toHaveAttribute('aria-pressed', 'true');
  await user.click(within(sheet()).getByRole('button', { name: '顯示結果' }));
  await waitFor(() => expect(onChange).toHaveBeenCalledTimes(1));
  expect(seasonSearchHref(christmas, onChange.mock.calls[0]![0])).toBe('/seasons/christmas');
});

it('the trip page\'s sheet: no dates, the countries left out, grouped by part of the world', async () => {
  renderBar({ filters: { excludeCountryIds: ['japan'] }, sort: 'price', page: 1 }, { show: { dates: false, exclude: true }, hrefFor: undefined, total: undefined, seasons: [] });
  expect(opener()).toHaveAccessibleName('篩選（已選 1 項）');
  await user.click(opener());
  expect(within(sheet()).queryByRole('heading', { name: '出發日期' })).not.toBeInTheDocument();
  expect(within(sheet()).queryByRole('heading', { name: '可出行日期' })).not.toBeInTheDocument();
  const exclude = within(sheet()).getByRole('group', { name: '排除' });
  expect(within(exclude).getByRole('group', { name: '日本及韓國' })).toBeInTheDocument();
  await user.click(within(exclude).getByRole('checkbox', { name: '日本' }));
  await user.click(within(exclude).getByRole('checkbox', { name: '韓國' }));
  await user.click(within(sheet()).getByRole('button', { name: '顯示結果' }));
  await waitFor(() => expect(onChange).toHaveBeenCalledTimes(1));
  expect(onChange.mock.calls[0]![0].filters.excludeCountryIds).toEqual(['korea']);
});

it('without JavaScript: 篩選 is a link to the sheet, a GET form to the page with every field named as the address names it', () => {
  const html = renderToString(<FilterBar {...props({ filters: { destination: japan, daysMin: 3, operators: ['egl'] }, sort: 'days', page: 2, size: 48 })} />);
  expect(html).toMatch(/<a href="#filter-sheet" class="[^"]*">/);
  expect(html).toMatch(/<form(?=[^>]* method="get")(?=[^>]* action="\/tours\/japan")[^>]*>/);
  // The order and the rows per page ride along; the page goes back to 1.
  expect(html).toContain('<input type="hidden" name="sort" value="days"/>');
  expect(html).toContain('<input type="hidden" name="size" value="48"/>');
  expect(html).not.toContain('name="page"');
  for (const name of ['from', 'to', 'tfrom', 'tto', 'dmin', 'dmax', 'pmin', 'pmax', 'op']) expect(html).toContain(`name="${name}"`);
  expect(html).toMatch(/<input(?=[^>]* name="dmin")(?=[^>]* min="1" max="60")(?=[^>]* value="3")[^>]*>/);
  expect(html).toMatch(/<input(?=[^>]* name="op")(?=[^>]* value="egl")(?=[^>]* checked="")[^>]*>/);
  // The one-tap choices need JavaScript; × goes back to the bar; 清除全部 is a link to the cleared address.
  expect(html).not.toContain('aria-pressed');
  expect(html).toMatch(/<a class="[^"]*" href="#filter-bar" aria-label="關閉">×<\/a>/);
  expect(html).toMatch(/<a class="[^"]*" href="\/tours\/japan\?sort=days&amp;size=48">清除全部<\/a>/);
});

it('without JavaScript on a season\'s page, the dates (the path\'s) are not sent; on the trip page 篩選 stays a button', () => {
  const state: SearchState = { filters: { dateFrom: christmas.from, dateTo: christmas.to }, sort: 'price', page: 1 };
  const html = renderToString(<FilterBar {...props(state, { fixedDates: christmas, hrefFor: s => seasonSearchHref(christmas, s) })} />);
  expect(html).toMatch(/<form(?=[^>]* action="\/seasons\/christmas")[^>]*>/);
  expect(html).not.toContain('name="from"');
  expect(html).toContain('name="tfrom"');
  const trip = renderToString(<FilterBar {...props({ filters: {}, sort: 'price', page: 1 }, { show: { dates: false, exclude: true }, hrefFor: undefined })} />);
  expect(trip).not.toContain('href="#filter-sheet"');
  expect(trip).not.toContain('method="get"');
  expect(trip).not.toContain('name="ex"');
});

it('the phone bar and the sheet are not drawn from 640px; under it the bar sticks and the row\'s boxes leave it', () => {
  const bar = css('FilterBar.module.css');
  expect(bar).toMatch(/^.*\.sheetButton, \.countBox, \.pillShort \{ display: none; \}.*@media \(max-width: 639px\)/);
  const phone = bar.slice(bar.indexOf('@media (max-width: 639px)'));
  expect(phone).toMatch(/\.filters \{ position: sticky; top: var\(--notice-h, 0px\);/);
  expect(phone).toContain('.filters > .f, .filters > .slot:not(.sortSlot) { display: none; }');
  expect(phone).toMatch(/scroll-padding-top: calc\(61px \+ 0\.5rem\)/);
  // The short order shows in place of the full name; the count gives way first (a one-line box it wraps out of).
  expect(phone).toContain('.pillShort::before { content: attr(data-short); }');
  expect(phone).toMatch(/\.countBox \{ display: flex; flex: 1 1 0; min-width: 0; flex-wrap: wrap;[^}]*height: 1\.5em; overflow: hidden;/);
  expect(phone).toMatch(/\.sortSlot \{[^}]*flex: 0 1 auto;/);
  const sheetCss = css('FilterSheet.module.css');
  expect(sheetCss).toContain(':global(html):has(.sheet[open]) { overflow: hidden; }');
  // Without JavaScript, in the page under the bar (never over the language notice: nothing is above it).
  expect(sheetCss).toContain('.sheet:target:not([data-js]) { position: static; display: flex;');
  expect(sheetCss).not.toMatch(/z-index/);
});
