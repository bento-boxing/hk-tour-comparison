import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { it, expect, vi, beforeEach } from 'vitest';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { places } from '@hktours/core';
import type { OperatorInfo } from '@hktours/db/read';
import { makeT } from '../lib/i18n';
import type { SearchState } from '../lib/search-params';
import { FilterBar, type FilterBarProps } from './FilterBar';
import { renderAtDocument } from '../lib/render-at-document.test-utils';

const t = makeT('zh-Hant');

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
  // First the phones' 篩選 (not drawn from 640px: see the phone bar's tests).
  expect(names).toEqual(['篩選', '清除目的地：日本 → 關西', '出發日期：全部', '可出行日期：全部', '日數：全部', '價錢：全部', '旅行社：全部', '排序：價錢 低→高']);
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

it('fills the boxes whose filter is set and outlines the rest', () => {
  renderBar({ filters: { daysMin: 4, daysMax: 6 }, sort: 'price', page: 1 });
  expect(pill('日數：4–6日')).toHaveAttribute('data-on', 'true');
  expect(pill('價錢：全部')).not.toHaveAttribute('data-on');
  // jsdom does not apply CSS modules, so pin the rules that paint a filled box.
  expect(css()).toMatch(/\.f\[data-on='true'\] \{ background: var\(--selected-bg\); color: var\(--on-selected\);/);
});

it('the sort control comes last, at the right end of the row, set apart by a heavier outline, bold text and an icon; never filled', () => {
  renderBar({ filters: { daysMin: 4 }, sort: 'days-desc', page: 1 });
  const buttons = screen.getAllByRole('button');
  const sort = pill('排序：日數 長→短');
  expect(buttons.at(-1)).toBe(sort);
  expect(sort).not.toHaveAttribute('data-on'); // not filled, even when not the default order
  // The icon is drawn, hidden from screen readers: the name is the text alone.
  expect(sort.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  expect(sort).toHaveAccessibleName('排序：日數 長→短');
  expect(pill('日數：4日以上').querySelector('svg')).toBeNull();
  expect(css()).toMatch(/\.sortSlot \{ margin-left: auto; \}/);
  expect(css()).toMatch(/\.sort \{[^}]*border: 2px solid var\(--ink\); font-weight: 700;/);
  expect(css()).toMatch(/\.sortSlot \.popover \{ left: auto; right: 0; \}/);
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

it('each operator checkbox shows its colour dot, and a bad colour falls back to the operator fallback grey (--op-fallback)', async () => {
  renderBar(base, { operators: [operators[0], { ...operators[1], color: 'red;position:fixed' }] });
  await user.click(pill('旅行社：全部'));
  const dots = screen.getByRole('dialog').querySelectorAll<HTMLElement>('[data-dot]');
  expect(dots).toHaveLength(2);
  expect(dots[0].style.getPropertyValue('--c')).toBe('#d62839');
  expect(dots[1].style.getPropertyValue('--c')).toBe('var(--op-fallback)');
});

it('choosing a sort order calls onChange with page 1', async () => {
  renderBar({ ...base, page: 5 });
  await user.click(pill('排序：價錢 低→高'));
  const dialog = screen.getByRole('dialog', { name: '排序' });
  // Four rows, one per order, each with its two directions: short visible text, the full order as the name.
  const rows = within(dialog).getAllByRole('listitem');
  expect(rows.map(r => [r.querySelector('[data-sort-name]')?.textContent, ...within(r).getAllByRole('button').map(b => b.textContent)])).toEqual([
    ['價錢', '低→高', '高→低'],
    ['日數', '短→長', '長→短'],
    ['出發日期', '早→遲', '遲→早'],
    ['目的地', '筆劃少→多', '筆劃多→少'],
  ]);
  expect(within(dialog).getAllByRole('button').map(b => b.getAttribute('aria-label'))).toEqual([
    '價錢 低→高', '價錢 高→低', '日數 短→長', '日數 長→短', '出發日期 早→遲', '出發日期 遲→早', '目的地 筆劃少→多', '目的地 筆劃多→少',
  ]);
  expect(within(dialog).getByRole('button', { name: '價錢 低→高' })).toHaveAttribute('aria-pressed', 'true');
  expect(within(dialog).getByRole('button', { name: '價錢 高→低' })).toHaveAttribute('aria-pressed', 'false');
  await user.click(within(dialog).getByRole('button', { name: '出發日期 早→遲' }));
  expect(onChange).toHaveBeenCalledWith({ filters: {}, sort: 'date', page: 1 });
});

it('a reversed order is chosen the same way and named in full on the pill', async () => {
  renderBar({ filters: { daysMin: 4 }, sort: 'price-desc', page: 3 });
  const sort = pill('排序：價錢 高→低');
  await user.click(sort);
  const dialog = screen.getByRole('dialog', { name: '排序' });
  expect(within(dialog).getByRole('button', { name: '價錢 高→低' })).toHaveAttribute('aria-pressed', 'true');
  await user.click(within(dialog).getByRole('button', { name: '目的地 筆劃多→少' }));
  expect(onChange).toHaveBeenCalledWith({ filters: { daysMin: 4 }, sort: 'destination-desc', page: 1 });
  expect(screen.queryByRole('dialog')).toBeNull();
});

it('the sort rows lay out as a name and two equal buttons, lined up under each other', () => {
  expect(css()).toMatch(/\.sortRows \{[^}]*display: grid; grid-template-columns: auto 1fr 1fr;/);
  expect(css()).toMatch(/\.sortRow \{[^}]*grid-column: 1 \/ -1;[^}]*grid-template-columns: subgrid;/);
});

it.each([
  ['en', 'Sort by: Price, lowest first', 'Departure date', 'Latest first', 'Departure date, latest first', 'Sort by: Destination, Z–A'],
  ['zh-Hans', '排序：价格 低→高', '出发日期', '晚→早', '出发日期 晚→早', '排序：目的地 Z→A'],
] as const)('%s: the sort rows and pill', async (locale, sortPill, dateRow, latest, latestName, destDescPill) => {
  const { unmount } = render(<FilterBar state={base} operators={operators} places={places} t={makeT(locale)} onChange={onChange} today="2026-11-12" />);
  await user.click(pill(sortPill));
  const dialog = screen.getByRole('dialog');
  expect(within(dialog).getByText(dateRow)).toBeInTheDocument();
  expect(within(dialog).getByRole('button', { name: latestName })).toHaveTextContent(latest);
  unmount();
  render(<FilterBar state={{ ...base, sort: 'destination-desc' }} operators={operators} places={places} t={makeT(locale)} onChange={onChange} today="2026-11-12" />);
  expect(pill(destDescPill)).toBeInTheDocument();
});

it('the travel-dates pill shows its window, and is filled when set', () => {
  renderBar({ filters: { travelFrom: '2026-12-20', travelTo: '2027-01-03' }, sort: 'price', page: 1 });
  expect(pill('可出行日期：12/20 – 2027/1/3')).toHaveAttribute('data-on', 'true');
  expect(pill('出發日期：全部')).not.toHaveAttribute('data-on');
});

it('the travel window is applied from its two date inputs, with the other filters kept', async () => {
  renderBar({ filters: { dateFrom: '2026-12-01', operators: ['egl'] }, sort: 'date', page: 4 });
  await user.click(pill('可出行日期：全部'));
  const dialog = screen.getByRole('dialog', { name: '可出行日期' });
  expect(dialog).toHaveTextContent('只列出出發及回程都在這段日子內的旅行團');
  const from = within(dialog).getByLabelText('由');
  const to = within(dialog).getByLabelText('至');
  expect(from).toHaveAttribute('type', 'date');
  expect(from).toHaveFocus();
  // Focus lands on 由, so the note is read with each input.
  expect(from).toHaveAccessibleDescription('只列出出發及回程都在這段日子內的旅行團');
  expect(to).toHaveAccessibleDescription('只列出出發及回程都在這段日子內的旅行團');
  await user.type(from, '2027-01-12');
  await user.type(to, '2027-01-15');
  await user.click(within(dialog).getByRole('button', { name: '套用' }));
  expect(onChange).toHaveBeenCalledWith({
    filters: { dateFrom: '2026-12-01', travelFrom: '2027-01-12', travelTo: '2027-01-15', operators: ['egl'] }, sort: 'date', page: 1,
  });
});

it('the other ranges have no note and no description', async () => {
  renderBar(base);
  await user.click(pill('價錢：全部'));
  expect(screen.getByRole('spinbutton', { name: '由' })).not.toHaveAttribute('aria-describedby');
});

it('a travel window typed back to front is swapped; 清除 removes it', async () => {
  const { rerender } = renderBar(base);
  await user.click(pill('可出行日期：全部'));
  let dialog = screen.getByRole('dialog', { name: '可出行日期' });
  await user.type(within(dialog).getByLabelText('由'), '2027-01-15');
  await user.type(within(dialog).getByLabelText('至'), '2027-01-12');
  await user.keyboard('{Enter}');
  expect(onChange).toHaveBeenLastCalledWith({ filters: { travelFrom: '2027-01-12', travelTo: '2027-01-15' }, sort: 'price', page: 1 });

  rerender(<FilterBar state={{ filters: { travelFrom: '2027-01-12', travelTo: '2027-01-15', daysMin: 3 }, sort: 'price', page: 2 }}
    operators={operators} places={places} t={t} onChange={onChange} today="2026-11-12" />);
  await user.click(pill('可出行日期：2027/1/12 – 2027/1/15'));
  dialog = screen.getByRole('dialog', { name: '可出行日期' });
  expect(within(dialog).getByLabelText('由')).toHaveValue('2027-01-12');
  await user.click(within(dialog).getByRole('button', { name: '清除' }));
  expect(onChange).toHaveBeenLastCalledWith({ filters: { daysMin: 3 }, sort: 'price', page: 1 });
});

it.each([
  ['zh-Hans', '可出行日期：12/20 – 12/27', '只列出出发和回程都在这段日子内的旅行团'],
  ['en', 'Travel dates: 20 Dec – 27 Dec', 'Only tours that leave and come back within these dates'],
] as const)('%s: the travel-dates pill and its note', async (locale, travelPill, note) => {
  render(<FilterBar state={{ filters: { travelFrom: '2026-12-20', travelTo: '2026-12-27' }, sort: 'price', page: 1 }}
    operators={operators} places={places} t={makeT(locale)} onChange={onChange} today="2026-11-12" />);
  await user.click(pill(travelPill));
  expect(screen.getByRole('dialog')).toHaveTextContent(note);
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
  expect(screen.queryByRole('button', { name: /可出行日期/ })).toBeNull(); // the chain page sets its own window
  const exclude = pill('排除：日本');
  expect(exclude).toHaveAttribute('data-on', 'true');
  await user.click(exclude);
  const dialog = screen.getByRole('dialog', { name: '排除' });
  expect(within(dialog).getByRole('checkbox', { name: '日本' })).toBeChecked();
  expect(within(dialog).queryByRole('checkbox', { name: '香港' })).toBeNull();
  await user.click(within(dialog).getByRole('checkbox', { name: '韓國' }));
  expect(onChange).toHaveBeenLastCalledWith({ filters: { excludeCountryIds: ['japan', 'korea'] }, sort: 'price', page: 1 });
});

it('the exclusion list groups the countries by part of the world, as the destination panel does', async () => {
  renderBar(base, { show: { dates: false, exclude: true } });
  await user.click(pill('排除：無'));
  const dialog = screen.getByRole('dialog', { name: '排除' });
  const groups = within(dialog).getAllByRole('group');
  const expected = places.countryGroups
    .map(g => ({ id: g.id, ids: g.countries.map(c => c.id).filter(id => id !== 'hongkong') }))
    .filter(g => g.ids.length > 0);
  expect(groups).toHaveLength(expected.length);
  groups.forEach((group, i) => {
    expect(group).toHaveAccessibleName(t(`countryGroup.${expected[i].id}`));
    expect(within(group).getAllByRole('checkbox').map(c => c.closest('label')?.textContent))
      .toEqual(expected[i].ids.map(id => places.country(id)?.nameZh));
  });
  const northeast = within(dialog).getByRole('group', { name: '日本及韓國' });
  expect(within(northeast).getAllByRole('checkbox').map(c => c.closest('label')?.textContent)).toEqual(['日本', '韓國']);
  expect(within(dialog).queryByRole('checkbox', { name: '香港' })).toBeNull();
  await user.click(within(northeast).getByRole('checkbox', { name: '韓國' }));
  expect(onChange).toHaveBeenLastCalledWith({ filters: { excludeCountryIds: ['korea'] }, sort: base.sort, page: 1 });
});

it('by default shows dates and no exclusion pill', () => {
  renderBar(base);
  expect(pill('出發日期：全部')).toBeInTheDocument();
  expect(pill('可出行日期：全部')).toBeInTheDocument();
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

it('with React\'s root on the document (as on the site), a press on the open pill closes it for good, mouse or finger', async () => {
  await renderAtDocument(<FilterBar state={base} operators={operators} places={places} t={t} onChange={onChange} today="2026-11-12" />);
  for (const key of ['[MouseLeft]', '[TouchA]']) {
    const press = (target: Element) => user.pointer({ keys: key, target });
    const days = pill('日數：全部');
    await press(days);
    const dialog = screen.getByRole('dialog', { name: '日數' });
    await press(within(dialog).getByRole('spinbutton', { name: '由' }));
    await user.keyboard('5');
    expect(within(dialog).getByRole('spinbutton', { name: '由' })).toHaveValue(5);
    await press(days);
    expect(screen.queryByRole('dialog')).toBeNull(); // not closed and opened again (a new popover, the 5 gone)
    expect(days).toHaveAttribute('aria-expanded', 'false');
    expect(days).toHaveFocus();
  }
  expect(onChange).not.toHaveBeenCalled();
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
  await user.tab({ shift: true }); // on to the 可出行日期 pill: outside
  expect(pill('可出行日期：全部')).toHaveFocus();
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

it.each([
  ['en', 'Exclude: Japan', 'Japan and Korea', 'South Korea', 'Operators: EGL Tours', 'EGL Tours', 'Clear destination: Japan → Kansai'],
  ['zh-Hans', '排除：日本', '日本及韩国', '韩国', '旅行社：東瀛遊', '東瀛遊', '清除目的地：日本 → 关西'],
] as const)('%s: pills, countries and operators in the visitor\'s language', async (locale, excludePill, group, korea, opsPill, opName, destPill) => {
  render(
    <FilterBar
      state={{ filters: { excludeCountryIds: ['japan'], operators: ['egl'], destination: { countryId: 'japan', regionId: 'japan-kansai' } }, sort: 'price', page: 1 }}
      operators={operators} places={places} t={makeT(locale)} onChange={onChange} today="2026-11-12" show={{ dates: false, exclude: true }}
    />,
  );
  expect(pill(destPill)).toBeInTheDocument();
  await user.click(pill(opsPill));
  expect(screen.getByRole('checkbox', { name: opName })).toBeChecked();
  await user.click(pill(excludePill));
  const northeast = screen.getByRole('group', { name: group });
  expect(within(northeast).getByRole('checkbox', { name: korea })).not.toBeChecked();
});

it.each([
  ['zh-Hant', '出發日期：12/1 – 2027/1/3', '日數：1日以上', '日數：1日', '日數：4–6日'],
  ['zh-Hans', '出发日期：12/1 – 2027/1/3', '天数：1天以上', '天数：1天', '天数：4–6天'],
  ['en', 'Departure dates: 1 Dec – 3 Jan 2027', 'Length: 1 day or more', 'Length: 1 day', 'Length: 4–6 days'],
] as const)('%s: dates and lengths in the pills', (locale, dates, plus, one, range) => {
  const bar = (filters: SearchState['filters']) =>
    render(<FilterBar state={{ filters, sort: 'price', page: 1 }} operators={operators} places={places} t={makeT(locale)} onChange={onChange} today="2026-11-12" />);
  const first = bar({ dateFrom: '2026-12-01', dateTo: '2027-01-03', daysMin: 1 });
  expect(pill(dates)).toBeInTheDocument();
  expect(pill(plus)).toBeInTheDocument();
  first.unmount();
  const second = bar({ daysMax: 1 });
  expect(pill(one)).toBeInTheDocument();
  second.unmount();
  bar({ daysMin: 4, daysMax: 6 });
  expect(pill(range)).toBeInTheDocument();
});
