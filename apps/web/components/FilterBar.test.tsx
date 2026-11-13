import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { it, expect, vi, beforeEach } from 'vitest';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { places } from '@hktours/core';
import type { OperatorInfo } from '@hktours/db/read';
import { translate, type T } from '../lib/i18n';
import type { SearchState } from '../lib/search-params';
import { FilterBar, type FilterBarProps } from './FilterBar';

const t: T = (key, vars) => translate('zh-Hant', key, vars);

const operators: OperatorInfo[] = [
  { id: 'egl', nameZh: '東瀛遊', nameEn: 'EGL Tours', color: '#d62839', lastGoodRunAt: null },
  { id: 'jetour', nameZh: '捷旅', nameEn: 'Jetour', color: '#ee7b06', lastGoodRunAt: null },
  { id: 'texpert', nameZh: '專業旅運', nameEn: 'Travel Expert', color: '#7d3cc8', lastGoodRunAt: null },
  { id: 'bigline', nameZh: '大航假期', nameEn: 'Big Line Holiday', color: '#2a9d4b', lastGoodRunAt: null },
];

const base: SearchState = { filters: {}, sort: 'price', page: 1 };

let onChange: ReturnType<typeof vi.fn<(next: SearchState) => void>>;
let user: ReturnType<typeof userEvent.setup>;
beforeEach(() => { onChange = vi.fn(); user = userEvent.setup(); });

function renderBar(state: SearchState, extra: Partial<FilterBarProps> = {}) {
  // A fixed today, so the year rule of the date pill does not depend on when the tests run.
  return render(<FilterBar state={state} operators={operators} places={places} t={t} onChange={onChange} today="2026-11-12" {...extra} />);
}

const pill = (name: string | RegExp) => screen.getByRole('button', { name });
const css = () => readFileSync(join(__dirname, 'FilterBar.module.css'), 'utf8').replace(/\s+/g, ' ');

it('shows each filter with its current value', () => {
  renderBar({ filters: { daysMin: 4, daysMax: 6 }, sort: 'price', page: 1 });
  expect(pill('日數：4–6日')).toBeInTheDocument();
  expect(pill('旅行社：全部')).toBeInTheDocument();
  expect(pill('排序：價錢 低→高')).toBeInTheDocument();
  expect(pill('出發日期：全部')).toBeInTheDocument();
  expect(pill('價錢：全部')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /清除目的地/ })).toBeNull(); // no destination pill when none is set
});

it('shows the pills in the brief order, destination first', () => {
  renderBar({ filters: { destination: { countryId: 'japan', regionId: 'japan-kansai' } }, sort: 'price', page: 1 });
  const names = screen.getAllByRole('button').map(b => b.getAttribute('aria-label') ?? b.textContent);
  expect(names).toEqual(['清除目的地：日本 → 關西', '出發日期：全部', '日數：全部', '價錢：全部', '旅行社：全部', '排序：價錢 低→高']);
  expect(pill('清除目的地：日本 → 關西')).toHaveTextContent('日本 → 關西 ✕');
});

it('labels a set value in each pill', () => {
  renderBar({
    filters: { dateFrom: '2026-12-01', dateTo: '2026-12-31', priceMin: 5000, priceMax: 12000, operators: ['egl', 'jetour'] },
    sort: 'days', page: 1,
  });
  expect(pill('出發日期：12/1 – 12/31')).toBeInTheDocument();
  expect(pill('價錢：HK$5,000–12,000')).toBeInTheDocument();
  expect(pill('旅行社：東瀛遊、捷旅')).toBeInTheDocument();
  expect(pill('排序：日數 短→長')).toBeInTheDocument();
});

it('labels one-sided ranges', () => {
  const { unmount } = renderBar({ filters: { daysMin: 10, priceMin: 5000, dateFrom: '2026-12-01' }, sort: 'price', page: 1 });
  expect(pill('日數：10日以上')).toBeInTheDocument();
  expect(pill('價錢：HK$5,000以上')).toBeInTheDocument();
  expect(pill('出發日期：12/1 –')).toBeInTheDocument();
  unmount();
  renderBar({ filters: { daysMax: 6, priceMax: 12000, dateTo: '2026-12-31' }, sort: 'price', page: 1 });
  expect(pill('日數：1–6日')).toBeInTheDocument();
  expect(pill('價錢：HK$0–12,000')).toBeInTheDocument();
  expect(pill('出發日期：– 12/31')).toBeInTheDocument();
});

it('fills the pills whose filter is set and outlines the rest', () => {
  renderBar({ filters: { daysMin: 4, daysMax: 6 }, sort: 'price', page: 1 });
  expect(pill('日數：4–6日')).toHaveAttribute('data-on', 'true');
  expect(pill('價錢：全部')).not.toHaveAttribute('data-on');
  expect(pill('排序：價錢 低→高')).not.toHaveAttribute('data-on'); // the default sort counts as unset
  // jsdom does not apply CSS modules, so pin the rules that paint a filled pill.
  expect(css()).toMatch(/\.f\[data-on='true'\] \{[^}]*background: var\(--cerulean\)/);
});

it('choosing a length preset calls onChange with page reset to 1', async () => {
  renderBar({ ...base, page: 3 });
  await user.click(pill('日數：全部'));
  await user.click(screen.getByRole('button', { name: '4–6日' }));
  expect(onChange).toHaveBeenCalledTimes(1);
  expect(onChange).toHaveBeenCalledWith({ filters: { daysMin: 4, daysMax: 6 }, sort: 'price', page: 1 });
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(pill('日數：全部')).toHaveFocus();
});

it('the 10日以上 preset sets only the minimum', async () => {
  renderBar({ filters: { daysMin: 4, daysMax: 6 }, sort: 'price', page: 2 });
  await user.click(pill('日數：4–6日'));
  await user.click(screen.getByRole('button', { name: '10日以上' }));
  expect(onChange).toHaveBeenCalledWith({ filters: { daysMin: 10 }, sort: 'price', page: 1 });
  expect(onChange.mock.calls[0][0].filters).not.toHaveProperty('daysMax');
});

it('typed lengths are applied with the address rules: swapped, and out-of-range values dropped', async () => {
  renderBar({ filters: { operators: ['egl'] }, sort: 'days', page: 4 });
  await user.click(pill('日數：全部'));
  const dialog = screen.getByRole('dialog', { name: '日數' });
  await user.type(within(dialog).getByRole('spinbutton', { name: '由' }), '9');
  await user.type(within(dialog).getByRole('spinbutton', { name: '至' }), '5');
  await user.click(within(dialog).getByRole('button', { name: '套用' }));
  expect(onChange).toHaveBeenCalledWith({ filters: { operators: ['egl'], daysMin: 5, daysMax: 9 }, sort: 'days', page: 1 });
});

it('typed prices are applied, and clearing a range removes it', async () => {
  const { rerender } = renderBar(base);
  await user.click(pill('價錢：全部'));
  const dialog = screen.getByRole('dialog', { name: '價錢' });
  await user.type(within(dialog).getByRole('spinbutton', { name: '由' }), '5000');
  await user.type(within(dialog).getByRole('spinbutton', { name: '至' }), '12000');
  await user.keyboard('{Enter}');
  expect(onChange).toHaveBeenLastCalledWith({ filters: { priceMin: 5000, priceMax: 12000 }, sort: 'price', page: 1 });

  rerender(<FilterBar state={{ filters: { priceMin: 5000, priceMax: 12000 }, sort: 'price', page: 2 }}
    operators={operators} places={places} t={t} onChange={onChange} />);
  await user.click(pill('價錢：HK$5,000–12,000'));
  await user.click(within(screen.getByRole('dialog', { name: '價錢' })).getByRole('button', { name: '清除' }));
  expect(onChange).toHaveBeenLastCalledWith({ filters: {}, sort: 'price', page: 1 });
});

it('the date window is applied from the two date inputs', async () => {
  renderBar(base);
  await user.click(pill('出發日期：全部'));
  const dialog = screen.getByRole('dialog', { name: '出發日期' });
  const from = within(dialog).getByLabelText('由');
  const to = within(dialog).getByLabelText('至');
  expect(from).toHaveAttribute('type', 'date');
  await user.type(from, '2026-12-01');
  await user.type(to, '2026-12-31');
  await user.click(within(dialog).getByRole('button', { name: '套用' }));
  expect(onChange).toHaveBeenCalledWith({ filters: { dateFrom: '2026-12-01', dateTo: '2026-12-31' }, sort: 'price', page: 1 });
});

it('ticking operators updates the filter', async () => {
  const { rerender } = renderBar({ ...base, page: 2 });
  await user.click(pill('旅行社：全部'));
  const dialog = screen.getByRole('dialog', { name: '旅行社' });
  expect(within(dialog).getAllByRole('checkbox')).toHaveLength(4);
  await user.click(within(dialog).getByRole('checkbox', { name: '東瀛遊' }));
  expect(onChange).toHaveBeenLastCalledWith({ filters: { operators: ['egl'] }, sort: 'price', page: 1 });

  // The address comes back with egl ticked; the popover stays open for the next tick.
  rerender(<FilterBar state={{ filters: { operators: ['egl'] }, sort: 'price', page: 1 }}
    operators={operators} places={places} t={t} onChange={onChange} />);
  expect(screen.getByRole('checkbox', { name: '東瀛遊' })).toBeChecked();
  await user.click(screen.getByRole('checkbox', { name: '大航假期' }));
  expect(onChange).toHaveBeenLastCalledWith({ filters: { operators: ['egl', 'bigline'] }, sort: 'price', page: 1 });

  await user.click(screen.getByRole('checkbox', { name: '東瀛遊' }));
  expect(onChange).toHaveBeenLastCalledWith({ filters: {}, sort: 'price', page: 1 }); // nothing ticked means all
});

it('each operator checkbox shows its colour dot, and a bad colour falls back to charcoal', async () => {
  renderBar(base, { operators: [operators[0], { ...operators[1], color: 'red;position:fixed' }] });
  await user.click(pill('旅行社：全部'));
  const dots = screen.getByRole('dialog').querySelectorAll<HTMLElement>('[data-dot]');
  expect(dots).toHaveLength(2);
  expect(dots[0].style.getPropertyValue('--c')).toBe('#d62839');
  expect(dots[1].style.getPropertyValue('--c')).toBe('var(--charcoal)');
});

it('choosing a sort order calls onChange with page 1', async () => {
  renderBar({ ...base, page: 5 });
  await user.click(pill('排序：價錢 低→高'));
  const dialog = screen.getByRole('dialog', { name: '排序' });
  expect(within(dialog).getAllByRole('button').map(b => b.textContent))
    .toEqual(['價錢 低→高', '日數 短→長', '出發日期 早→遲', '目的地']);
  expect(within(dialog).getByRole('button', { name: '價錢 低→高' })).toHaveAttribute('aria-pressed', 'true');
  await user.click(within(dialog).getByRole('button', { name: '出發日期 早→遲' }));
  expect(onChange).toHaveBeenCalledWith({ filters: {}, sort: 'date', page: 1 });
});

it('clearing the destination pill removes it', async () => {
  renderBar({ filters: { destination: { countryId: 'japan', regionId: 'japan-kansai' }, daysMin: 4 }, sort: 'days', page: 3 });
  const destination = pill('清除目的地：日本 → 關西');
  expect(destination).toHaveAttribute('data-on', 'true');
  await user.click(destination);
  expect(onChange).toHaveBeenCalledWith({ filters: { daysMin: 4 }, sort: 'days', page: 1 });
  // The pill goes away with the new address, so focus moves on to the next pill rather than being lost.
  expect(pill('出發日期：全部')).toHaveFocus();
});

it('a whole-country destination is labelled 全部地區', () => {
  renderBar({ filters: { destination: { countryId: 'japan', regionId: null } }, sort: 'price', page: 1 });
  expect(pill('清除目的地：日本 → 全部地區')).toBeInTheDocument();
});

it('hides dates and shows exclusion when asked', async () => {
  renderBar({ filters: { excludeCountryIds: ['japan'] }, sort: 'price', page: 1 }, { show: { dates: false, exclude: true } });
  expect(screen.queryByRole('button', { name: /出發日期/ })).toBeNull();
  const exclude = pill('排除：日本');
  expect(exclude).toHaveAttribute('data-on', 'true');
  await user.click(exclude);
  const dialog = screen.getByRole('dialog', { name: '排除' });
  expect(within(dialog).getByRole('checkbox', { name: '日本' })).toBeChecked();
  expect(within(dialog).queryByRole('checkbox', { name: '香港' })).toBeNull();
  await user.click(within(dialog).getByRole('checkbox', { name: '韓國' }));
  expect(onChange).toHaveBeenLastCalledWith({ filters: { excludeCountryIds: ['japan', 'korea'] }, sort: 'price', page: 1 });
});

it('by default shows dates and no exclusion pill', () => {
  renderBar(base);
  expect(pill('出發日期：全部')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /排除/ })).toBeNull();
});

it('an empty exclusion is labelled 無', () => {
  renderBar(base, { show: { exclude: true } });
  expect(pill('排除：無')).not.toHaveAttribute('data-on');
});

it('a popover works from the keyboard: focus moves in, Escape closes it and returns focus to its pill', async () => {
  renderBar(base);
  const sort = pill('排序：價錢 低→高');
  expect(sort).toHaveAttribute('aria-expanded', 'false');
  sort.focus();
  await user.keyboard('{Enter}');
  expect(sort).toHaveAttribute('aria-expanded', 'true');
  expect(screen.getByRole('button', { name: '價錢 低→高' })).toHaveFocus();
  await user.keyboard('{Escape}');
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(sort).toHaveFocus();
  expect(onChange).not.toHaveBeenCalled();
});

it('a press outside closes the popover and leaves focus where the visitor pressed', async () => {
  render(<><input aria-label="elsewhere" /><FilterBar state={base} operators={operators} places={places} t={t} onChange={onChange} /></>);
  await user.click(pill('旅行社：全部'));
  await user.click(screen.getByRole('textbox', { name: 'elsewhere' }));
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(screen.getByRole('textbox', { name: 'elsewhere' })).toHaveFocus();
});

it('pressing the open pill again closes its popover; opening another closes the first', async () => {
  renderBar(base);
  await user.click(pill('日數：全部'));
  await user.click(pill('日數：全部'));
  expect(screen.queryByRole('dialog')).toBeNull();
  await user.click(pill('日數：全部'));
  await user.click(pill('價錢：全部'));
  expect(screen.getAllByRole('dialog')).toHaveLength(1);
  expect(screen.getByRole('dialog', { name: '價錢' })).toBeInTheDocument();
});

it('an Escape that ends an IME composition (keyCode 229) leaves the popover open', async () => {
  renderBar(base);
  await user.click(pill('價錢：全部'));
  fireEvent.keyDown(screen.getByRole('spinbutton', { name: '由' }), { key: 'Escape', keyCode: 229 });
  fireEvent.keyDown(screen.getByRole('spinbutton', { name: '由' }), { key: 'Escape', isComposing: true });
  expect(screen.getByRole('dialog', { name: '價錢' })).toBeInTheDocument();
});

it('tabbing out of a popover closes it; moving between the popover and its own pill does not', async () => {
  renderBar(base);
  pill('日數：全部').focus();
  await user.keyboard('{Enter}');
  expect(screen.getByRole('button', { name: '1–3日' })).toHaveFocus();
  await user.tab({ shift: true }); // back to its own pill
  expect(pill('日數：全部')).toHaveFocus();
  expect(screen.getByRole('dialog', { name: '日數' })).toBeInTheDocument();
  await user.tab({ shift: true }); // on to the 出發日期 pill: outside
  expect(pill('出發日期：全部')).toHaveFocus();
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(onChange).not.toHaveBeenCalled();
});

it('focus leaving the window (no new element) keeps the popover open', async () => {
  renderBar(base);
  await user.click(pill('排序：價錢 低→高'));
  fireEvent.blur(screen.getByRole('button', { name: '價錢 低→高' }), { relatedTarget: null });
  expect(screen.getByRole('dialog', { name: '排序' })).toBeInTheDocument();
});

it('only one popover is open at a time, however the next pill is opened', async () => {
  renderBar(base);
  await user.click(pill('日數：全部'));
  // A click with no press and no focus change (e.g. from assistive technology) opens the next popover.
  act(() => { pill('價錢：全部').click(); });
  expect(screen.getAllByRole('dialog')).toHaveLength(1);
  expect(screen.getByRole('dialog', { name: '價錢' })).toBeInTheDocument();
  expect(pill('日數：全部')).toHaveAttribute('aria-expanded', 'false');
});

it('a 由 date later than the 至 date is swapped, not dropped', async () => {
  renderBar({ filters: { dateFrom: '2026-12-01', dateTo: '2026-12-10' }, sort: 'price', page: 2 }, { today: '2026-11-12' });
  await user.click(pill('出發日期：12/1 – 12/10'));
  const dialog = screen.getByRole('dialog', { name: '出發日期' });
  const from = within(dialog).getByLabelText('由');
  const to = within(dialog).getByLabelText('至');
  await user.clear(from);
  await user.type(from, '2026-12-31');
  await user.clear(to);
  await user.type(to, '2026-12-20');
  await user.click(within(dialog).getByRole('button', { name: '套用' }));
  expect(onChange).toHaveBeenCalledWith({ filters: { dateFrom: '2026-12-20', dateTo: '2026-12-31' }, sort: 'price', page: 1 });
});

it('the date pill shows the year of a date outside the current Hong Kong year', () => {
  const { unmount } = renderBar({ filters: { dateFrom: '2026-12-20', dateTo: '2027-01-10' }, sort: 'price', page: 1 }, { today: '2026-11-12' });
  expect(pill('出發日期：12/20 – 2027/1/10')).toBeInTheDocument();
  unmount();
  renderBar({ filters: { dateFrom: '2027-02-01' }, sort: 'price', page: 1 }, { today: '2026-11-12' });
  expect(pill('出發日期：2027/2/1 –')).toBeInTheDocument();
});
