import { it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderToString } from 'react-dom/server';
import { places } from '@hktours/core';
import { makeT } from '../lib/i18n';
import { parseSearchParams, type SearchState } from '../lib/search-params';
import { seasonWindow, type SeasonWindow } from '../lib/seasons';
import { DateField, type DateChoices } from './DateField';

// Task 78 (the owner's drawings M22, M24, M25): the phone's 幾時出發？ field and its date sheet.

const t = makeT('zh-Hant');
const christmas = seasonWindow('christmas', 2026)!;
const lunar = seasonWindow('lunar-new-year', 2027)!;
const choices: DateChoices = {
  value: null,
  festivals: [
    { key: 'christmas', name: '聖誕', days: '12/19–27', window: christmas, tours: 58, enabled: true },
    { key: 'lunar-new-year', name: '農曆新年', days: '2/3–10', window: lunar, tours: 0, enabled: false },
  ],
  months: [{ key: '2026-12', label: '12月', from: '2026-12-01', to: '2026-12-31' }, { key: '2027-01', label: '1月', from: '2027-01-01', to: '2027-01-31' }],
  travel: true,
};

let onApply: ReturnType<typeof vi.fn<(next: SearchState, festival: SeasonWindow | null) => void>>;
let user: ReturnType<typeof userEvent.setup>;
beforeEach(() => {
  onApply = vi.fn();
  user = userEvent.setup();
  HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) { this.setAttribute('open', ''); };
  HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
    if (!this.hasAttribute('open')) return;
    this.removeAttribute('open');
    this.dispatchEvent(new Event('close'));
  };
  window.history.replaceState(null, '');
});
afterEach(() => { window.history.replaceState(null, ''); });

const state = (query: Record<string, string>) => parseSearchParams(query, places);
const renderField = (query: Record<string, string> = {}, extra: Partial<Parameters<typeof DateField>[0]> = {}) =>
  render(<DateField t={t} places={places} state={state(query)} choices={choices} onApply={onApply} clearHref="/" fallbackHref="#filter-sheet" {...extra} />);
const sheet = () => screen.getByRole('dialog', { name: '幾時出發？' });
const settle = () => act(() => new Promise(r => setTimeout(r, 60)));
const apply = async () => { await user.click(within(sheet()).getByRole('button', { name: '顯示結果' })); await settle(); };

it('without JavaScript the field leads to the filter sheet\'s in-page form; no sheet is made', () => {
  const html = renderToString(<DateField t={t} places={places} state={state({})} choices={choices} onApply={() => {}} fallbackHref="#filter-sheet" />);
  expect(html).toMatch(/<a [^>]*href="#filter-sheet"[^>]*>.*幾時出發？<\/span><\/a>/);
  expect(html).not.toContain('<dialog');
});

it('the field opens the sheet: 節日 (days and counts; none here faded, not pressable), 月份, 自訂日期, 這段日子是; a history entry for Back', async () => {
  renderField();
  await user.click(screen.getByRole('button', { name: '幾時出發？' }));
  expect(window.history.state).toMatchObject({ dateSheet: true });
  const titles = within(sheet()).getAllByRole('heading', { level: 3 }).map(h => h.textContent);
  expect(titles).toEqual(['節日', '月份', '自訂日期', '這段日子是']);
  const festivals = within(within(sheet()).getByRole('group', { name: '節日' })).getAllByRole('button');
  expect(festivals.map(b => [b.textContent, b.hasAttribute('disabled')])).toEqual([['聖誕12/19–27 · 58 團', false], ['農曆新年2/3–10 · 0 團', true]]);
  expect(within(within(sheet()).getByRole('group', { name: '這段日子是' })).getByRole('button', { name: '這幾天出發' })).toHaveAttribute('aria-pressed', 'true');
  expect(within(sheet()).getByText('出發和回程都在這幾天之內')).toBeInTheDocument();
});

it('a festival leaving in its days: its window as the departure window, and the festival (its season page)', async () => {
  // Both windows set (a wide screen, an old link): the sheet starts in the departure mode, from the departure window.
  renderField({ dest: 'japan', from: '2027-01-02', to: '2027-01-08', tfrom: '2027-01-01', tto: '2027-01-09' });
  await user.click(screen.getByRole('button', { name: '幾時出發？' }));
  await user.click(within(sheet()).getByRole('button', { name: /^聖誕/ }));
  await apply();
  expect(onApply).toHaveBeenCalledTimes(1);
  const [next, festival] = onApply.mock.calls[0];
  // The travel window goes: one window at a time.
  expect(next.filters).toEqual({ destination: { countryId: 'japan', regionId: null }, dateFrom: christmas.from, dateTo: christmas.to });
  expect(festival).toEqual(christmas);
});

it('a month, then "整個旅程都在這幾天內": the travel window, not a season page', async () => {
  renderField();
  await user.click(screen.getByRole('button', { name: '幾時出發？' }));
  await user.click(within(sheet()).getByRole('button', { name: '12月' }));
  await user.click(within(sheet()).getByRole('button', { name: '整個旅程都在這幾天內' }));
  await apply();
  expect(onApply.mock.calls[0]).toEqual([{ filters: { travelFrom: '2026-12-01', travelTo: '2026-12-31' }, sort: 'price', page: 1 }, null]);
});

it('a festival in the whole-trip mode is the travel window, and no festival', async () => {
  renderField();
  await user.click(screen.getByRole('button', { name: '幾時出發？' }));
  await user.click(within(sheet()).getByRole('button', { name: /^聖誕/ }));
  await user.click(within(sheet()).getByRole('button', { name: '整個旅程都在這幾天內' }));
  await apply();
  expect(onApply.mock.calls[0]).toEqual([{ filters: { travelFrom: christmas.from, travelTo: christmas.to }, sort: 'price', page: 1 }, null]);
});

it('own dates through the address rules (a reversed pair is swapped); a season page\'s own days give way to them', async () => {
  renderField({ from: christmas.from, to: christmas.to, dmin: '3' });
  await user.click(screen.getByRole('button', { name: '幾時出發？' }));
  const [from, to] = within(sheet()).getAllByLabelText(/^(由|至)$/);
  await user.clear(from);
  await user.type(from, '2027-03-10');
  await user.clear(to);
  await user.type(to, '2027-03-01');
  await apply();
  expect(onApply.mock.calls[0]).toEqual([{ filters: { dateFrom: '2027-03-01', dateTo: '2027-03-10', daysMin: 3 }, sort: 'price', page: 1 }, null]);
});

it('the sheet starts from the page\'s dates: the departure window, else the travel window in its mode; 清除 empties them', async () => {
  renderField({ tfrom: '2026-12-01', tto: '2026-12-31' }, { choices: { ...choices, value: '12/1 – 12/31 內來回' } });
  await user.click(screen.getByRole('button', { name: '12/1 – 12/31 內來回' }));
  expect(within(sheet()).getByRole('button', { name: '12月' })).toHaveAttribute('aria-pressed', 'true');
  expect(within(sheet()).getByRole('button', { name: '整個旅程都在這幾天內' })).toHaveAttribute('aria-pressed', 'true');
  await user.click(within(sheet()).getByRole('button', { name: '清除' }));
  expect(within(sheet()).getByRole('button', { name: '12月' })).toHaveAttribute('aria-pressed', 'false');
  await apply();
  expect(onApply.mock.calls[0]).toEqual([{ filters: {}, sort: 'price', page: 1 }, null]);
});

it('chosen dates show in the field, with ✕ (its own target): a link the server made, or else a button that clears them', async () => {
  renderField({ from: '2026-12-01', to: '2026-12-31' }, { choices: { ...choices, value: '12/1 – 12/31 出發' }, clearHref: '/tours/japan' });
  expect(screen.getByRole('link', { name: '清除日期：12/1 – 12/31 出發' })).toHaveAttribute('href', '/tours/japan');
  render(<DateField t={t} places={places} state={state({ dest: 'japan', from: '2026-12-01', to: '2026-12-31' })} choices={{ ...choices, value: 'x' }} onApply={onApply} />);
  await user.click(screen.getByRole('button', { name: '清除日期：x' }));
  expect(onApply).toHaveBeenCalledWith({ filters: { destination: { countryId: 'japan', regionId: null } }, sort: 'price', page: 1 }, null);
});

it('without the travel window (the trip\'s first tour): no 這段日子是; a festival is only its dates', async () => {
  renderField({}, { choices: { ...choices, travel: false } });
  await user.click(screen.getByRole('button', { name: '幾時出發？' }));
  expect(within(sheet()).queryByRole('group', { name: '這段日子是' })).toBeNull();
  await user.click(within(sheet()).getByRole('button', { name: /^聖誕/ }));
  await apply();
  expect(onApply.mock.calls[0][0].filters).toEqual({ dateFrom: christmas.from, dateTo: christmas.to });
});

it('Escape or Back closes it without a choice', async () => {
  renderField();
  await user.click(screen.getByRole('button', { name: '幾時出發？' }));
  await user.click(within(sheet()).getByRole('button', { name: '12月' }));
  await act(async () => {
    window.history.replaceState(null, '');
    window.dispatchEvent(new PopStateEvent('popstate', { state: null }));
  });
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  await settle();
  expect(onApply).not.toHaveBeenCalled();
});

it('festivals without counts (the trip\'s first tour): their days only; one with no tours at all stays faded', async () => {
  renderField({}, { choices: { ...choices, travel: false, festivals: choices.festivals.map(f => ({ ...f, tours: null })) } });
  await user.click(screen.getByRole('button', { name: '幾時出發？' }));
  const festivals = within(within(sheet()).getByRole('group', { name: '節日' })).getAllByRole('button');
  expect(festivals.map(b => [b.textContent, b.hasAttribute('disabled')])).toEqual([['聖誕12/19–27', false], ['農曆新年2/3–10', true]]);
});
