import { it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { places, buildPlacesIndex, suggestRegions, type Destination } from '@hktours/core';
import { DestinationSearch, destinationLabel } from './DestinationSearch';
import { makeT } from '../lib/i18n';

const tZh = makeT('zh-Hant');
const kansai: Destination = { countryId: 'japan', regionId: 'japan-kansai' };

let onSelect: ReturnType<typeof vi.fn<(dest: Destination | null) => void>>;
let user: ReturnType<typeof userEvent.setup>;
beforeEach(() => {
  onSelect = vi.fn<(dest: Destination | null) => void>();
  user = userEvent.setup();
});

const renderSearch = (value: Destination | null = null, index = places) =>
  render(<DestinationSearch places={index} t={tZh} value={value} onSelect={onSelect} />);

// Task 3's shared-name index: 聖城 in 甲國/甲區 and 乙國/乙區. 甲區 has five cities for the hint tests.
// Each country has a second, empty region, so its regions get region rows (a single-region country
// is offered only as 全部地區).
const tiny = buildPlacesIndex({
  countries: [{ id: 'a', nameZh: '甲國', nameEn: 'A', aliases: [], group: 'europe' }, { id: 'b', nameZh: '乙國', nameEn: 'B', aliases: [], group: 'europe' }],
  regions: [
    { id: 'a-r', countryId: 'a', nameZh: '甲區', nameEn: '', aliases: [] },
    { id: 'b-r', countryId: 'b', nameZh: '乙區', nameEn: '', aliases: [] },
    { id: 'a-s', countryId: 'a', nameZh: '甲二區', nameEn: '', aliases: [] },
    { id: 'b-s', countryId: 'b', nameZh: '乙二區', nameEn: '', aliases: [] },
  ],
  cities: [
    { id: 'a-r-1', regionId: 'a-r', nameZh: '一城', nameEn: '', aliases: [] },
    { id: 'a-r-2', regionId: 'a-r', nameZh: '二城', nameEn: '', aliases: [] },
    { id: 'a-r-3', regionId: 'a-r', nameZh: '三城', nameEn: '', aliases: [] },
    { id: 'a-r-4', regionId: 'a-r', nameZh: '四城', nameEn: '', aliases: [] },
    { id: 'a-r-x', regionId: 'a-r', nameZh: '聖城', nameEn: '', aliases: [] },
    { id: 'b-r-x', regionId: 'b-r', nameZh: '聖城', nameEn: '', aliases: [] },
  ],
});

it('typing a city suggests its region as Country → Region', async () => {
  renderSearch();
  await user.type(screen.getByRole('combobox'), '大阪');
  const option = screen.getAllByRole('option')[0];
  expect(option).toHaveTextContent('日本 → 關西');
  expect(option).toHaveTextContent(/包括 大阪/);
  // As in the mockup, the whole country comes straight after, with no hint.
  expect(screen.getAllByRole('option')[1].textContent).toBe('日本 → 全部地區');
});

it('the hint lists four cities of the region with the matched city first', async () => {
  renderSearch(null, tiny);
  await user.type(screen.getByRole('combobox'), '甲區');
  expect(screen.getAllByRole('option')[0]).toHaveTextContent('甲國 → 甲區 包括 一城、二城、三城、四城');
  await user.clear(screen.getByRole('combobox'));
  await user.type(screen.getByRole('combobox'), '聖城');
  expect(screen.getAllByRole('option')[0]).toHaveTextContent('甲國 → 甲區 包括 聖城、一城、二城、三城');
});

it('the hint separator comes from the dictionary', async () => {
  const tEn = makeT('en');
  render(<DestinationSearch places={tiny} t={tEn} value={null} onSelect={onSelect} />);
  await user.type(screen.getByRole('combobox'), '甲區');
  expect(screen.getAllByRole('option')[0]).toHaveTextContent('A → 甲區 Includes 一城, 二城, 三城, 四城'); // no English region or city names: Chinese
});

it('a city in a single-region country suggests the whole country once', async () => {
  renderSearch();
  const input = screen.getByRole('combobox');
  await user.type(input, '巴黎');
  expect(screen.getAllByRole('option').map(o => o.textContent)).toEqual(['法國 → 全部地區']);
  await user.click(screen.getAllByRole('option')[0]);
  expect(onSelect).toHaveBeenCalledWith({ countryId: 'france', regionId: null });
  expect(input).toHaveValue('法國 → 全部地區');
});

it('selecting an option reports the destination and fills the input', async () => {
  renderSearch();
  const input = screen.getByRole('combobox');
  await user.type(input, '大阪');
  await user.click(screen.getAllByRole('option')[0]);
  expect(onSelect).toHaveBeenCalledTimes(1);
  expect(onSelect).toHaveBeenCalledWith(kansai);
  expect(input).toHaveValue('日本 → 關西');
  expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  expect(input).toHaveAttribute('aria-expanded', 'false');
});

it('typing a country offers all regions first', async () => {
  renderSearch();
  await user.type(screen.getByRole('combobox'), '日本');
  const first = screen.getAllByRole('option')[0];
  expect(first.textContent).toBe('日本 → 全部地區');
  expect(first).not.toHaveTextContent('包括');
});

it('Enter selects the first suggestion; arrows move the highlight', async () => {
  renderSearch();
  const input = screen.getByRole('combobox');
  await user.type(input, '日本');
  const options = screen.getAllByRole('option');
  expect(input).not.toHaveAttribute('aria-activedescendant');
  await user.keyboard('{ArrowDown}{ArrowDown}');
  expect(input).toHaveAttribute('aria-activedescendant', options[1].id);
  expect(options[1]).toHaveAttribute('aria-selected', 'true');
  expect(options[0]).toHaveAttribute('aria-selected', 'false');
  await user.keyboard('{Enter}');
  expect(onSelect).toHaveBeenCalledWith(suggestRegions('日本', places)[1].destination);
  expect(input).toHaveValue(suggestRegions('日本', places)[1].label);
});

it('Enter with nothing highlighted selects the first suggestion', async () => {
  renderSearch();
  await user.type(screen.getByRole('combobox'), '大阪');
  await user.keyboard('{Enter}');
  expect(onSelect).toHaveBeenCalledWith(kansai);
});

it('ignores the Enter that commits an input-method candidate (Chrome, Firefox)', async () => {
  renderSearch();
  const input = screen.getByRole('combobox');
  await user.type(input, '大阪');
  fireEvent.keyDown(input, { key: 'Enter', isComposing: true });
  expect(onSelect).not.toHaveBeenCalled();
});

it('ignores the Enter that commits an input-method candidate (Safari: keyCode 229 after compositionend)', async () => {
  renderSearch();
  const input = screen.getByRole('combobox');
  await user.type(input, '大阪');
  fireEvent.keyDown(input, { key: 'Enter', keyCode: 229 });
  expect(onSelect).not.toHaveBeenCalled();
});

it('the highlight wraps at both ends', async () => {
  renderSearch(null, tiny);
  const input = screen.getByRole('combobox');
  await user.type(input, '聖城');
  const options = screen.getAllByRole('option');
  const [first, last] = [options[0], options[options.length - 1]];
  await user.keyboard('{ArrowUp}');
  expect(input).toHaveAttribute('aria-activedescendant', last.id);
  await user.keyboard('{ArrowDown}');
  expect(input).toHaveAttribute('aria-activedescendant', first.id);
  await user.keyboard('{ArrowUp}');
  expect(input).toHaveAttribute('aria-activedescendant', last.id);
});

it('shows the no-match message and selects nothing on Enter', async () => {
  renderSearch();
  const input = screen.getByRole('combobox');
  await user.type(input, '亞特蘭提斯');
  expect(screen.getByText('沒有相符地區')).toBeInTheDocument();
  expect(screen.queryAllByRole('option')).toHaveLength(0);
  await user.keyboard('{Enter}');
  expect(onSelect).not.toHaveBeenCalled();
  expect(input).toHaveValue('亞特蘭提斯');
});

it('shows no dropdown for whitespace', async () => {
  renderSearch();
  const input = screen.getByRole('combobox');
  await user.type(input, '   ');
  expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  expect(screen.queryByText('沒有相符地區')).not.toBeInTheDocument();
  expect(input).toHaveAttribute('aria-expanded', 'false');
});

it('Escape closes the dropdown and keeps the text', async () => {
  renderSearch();
  const input = screen.getByRole('combobox');
  await user.type(input, '大阪');
  expect(screen.getByRole('listbox')).toBeInTheDocument();
  expect(input).toHaveAttribute('aria-expanded', 'true');
  await user.keyboard('{Escape}');
  expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  expect(input).toHaveAttribute('aria-expanded', 'false');
  expect(input).toHaveValue('大阪');
  expect(onSelect).not.toHaveBeenCalled();
});

it('typing alone does not change the selection', async () => {
  renderSearch();
  await user.type(screen.getByRole('combobox'), '大阪');
  expect(onSelect).not.toHaveBeenCalled();
});

it('shows an outside value and can clear it', async () => {
  const { rerender } = renderSearch(kansai);
  const input = screen.getByRole('combobox');
  expect(input).toHaveValue('日本 → 關西');
  await user.click(screen.getByRole('button', { name: '清除' }));
  expect(onSelect).toHaveBeenCalledWith(null);
  expect(input).toHaveValue('');
  // A new outside value replaces the text.
  rerender(<DestinationSearch places={places} t={tZh} value={{ countryId: 'japan', regionId: null }} onSelect={onSelect} />);
  expect(input).toHaveValue('日本 → 全部地區');
});

it('offers no clear button without a value', () => {
  renderSearch();
  expect(screen.queryByRole('button', { name: '清除' })).not.toBeInTheDocument();
});

it('distinguishes same-named cities in two countries', async () => {
  renderSearch(null, tiny);
  await user.type(screen.getByRole('combobox'), '聖城');
  // Each country's region, followed by that country's own 全部地區.
  const options = screen.getAllByRole('option');
  expect(options.map(o => o.querySelector('span')?.textContent)).toEqual(['甲國 → 甲區', '甲國 → 全部地區', '乙國 → 乙區', '乙國 → 全部地區']);
});

it('is a labelled combobox that controls its listbox', async () => {
  renderSearch();
  const input = screen.getByRole('combobox', { name: '輸入國家、地區或城市' });
  expect(input).toHaveAttribute('placeholder', '輸入國家、地區或城市');
  expect(input).toHaveAttribute('aria-autocomplete', 'list');
  await user.type(input, '大阪');
  expect(input).toHaveAttribute('aria-controls', screen.getByRole('listbox').id);
});

it('shows and tells screen readers which row Enter would pick: the first, then the one the arrows reach', async () => {
  renderSearch();
  await user.type(screen.getByRole('combobox'), '日本');
  const options = screen.getAllByRole('option');
  const highlighted = () => options.map(o => /hit/.test(o.className));
  expect(options.map(o => o.getAttribute('aria-selected'))).toEqual(options.map((_, i) => String(i === 0)));
  expect(highlighted()).toEqual(options.map((_, i) => i === 0));
  await user.keyboard('{ArrowDown}{ArrowDown}');
  expect(options.map(o => o.getAttribute('aria-selected'))).toEqual(options.map((_, i) => String(i === 1)));
  expect(highlighted()).toEqual(options.map((_, i) => i === 1));
});

it('pointing at a row highlights it instead of leaving two rows lit', async () => {
  renderSearch();
  const input = screen.getByRole('combobox');
  await user.type(input, '日本');
  const options = screen.getAllByRole('option');
  await user.hover(options[2]);
  expect(options.filter(o => /hit/.test(o.className))).toEqual([options[2]]);
  expect(options[2]).toHaveAttribute('aria-selected', 'true');
  expect(input).toHaveAttribute('aria-activedescendant', options[2].id);
  await user.keyboard('{Enter}');
  expect(onSelect).toHaveBeenCalledWith(suggestRegions('日本', places)[2].destination);
});

it('destinationLabel names the country and region in the visitor\'s language', () => {
  expect(destinationLabel(kansai, places, tZh)).toBe('日本 → 關西');
  expect(destinationLabel({ countryId: 'japan', regionId: null }, places, tZh)).toBe('日本 → 全部地區');
  expect(destinationLabel(kansai, places, makeT('zh-Hans'))).toBe('日本 → 关西');
  expect(destinationLabel({ countryId: 'korea', regionId: null }, places, makeT('zh-Hans'))).toBe('韩国 → 全部地区');
  expect(destinationLabel(kansai, places, makeT('en'))).toBe('Japan → Kansai');
  expect(destinationLabel({ countryId: 'japan', regionId: null }, places, makeT('en'))).toBe('Japan → All regions');
});

it.each([
  // [language, typed, first suggestion's label and hint]
  ['zh-Hant', '東京', '日本 → 關東 包括 東京'],
  ['zh-Hant', '东京', '日本 → 關東 包括 東京'],
  ['zh-Hant', 'Tokyo', '日本 → 關東 包括 東京'],
  ['zh-Hans', '东京', '日本 → 关东 包括 东京'],
  ['zh-Hans', '東京', '日本 → 关东 包括 东京'],
  ['zh-Hans', 'Tokyo', '日本 → 关东 包括 东京'],
  ['en', 'Tokyo', 'Japan → Kanto Includes Tokyo'],
  ['en', '東京', 'Japan → Kanto Includes Tokyo'],
  ['en', '东京', 'Japan → Kanto Includes Tokyo'],
] as const)('%s: typing %s finds Tokyo, labelled in that language', async (locale, typed, label) => {
  render(<DestinationSearch places={places} t={makeT(locale)} value={null} onSelect={onSelect} />);
  await user.type(screen.getByRole('combobox'), typed);
  const first = screen.getAllByRole('option')[0];
  expect(first.textContent).toMatch(new RegExp(`^${label}`));
  await user.click(first);
  expect(onSelect).toHaveBeenCalledWith({ countryId: 'japan', regionId: 'japan-kanto' });
  expect(screen.getByRole('combobox')).toHaveValue(label.split(/ 包括| Includes/)[0]);
});

it.each([
  ['zh-Hans', '韩国', '韩国 → 全部地区'],
  ['zh-Hans', '韓國', '韩国 → 全部地区'],
  ['en', 'south korea', 'South Korea → All regions'],
  ['en', '韓國', 'South Korea → All regions'],
] as const)('%s: the country search: typing %s offers %s', async (locale, typed, label) => {
  render(<DestinationSearch places={places} t={makeT(locale)} value={null} onSelect={onSelect} />);
  await user.type(screen.getByRole('combobox'), typed);
  expect(screen.getAllByRole('option').map(o => o.textContent)).toContain(label);
});

it('a new language relabels the chosen destination in the box', () => {
  const { rerender } = render(<DestinationSearch places={places} t={tZh} value={kansai} onSelect={onSelect} />);
  expect(screen.getByRole('combobox')).toHaveValue('日本 → 關西');
  rerender(<DestinationSearch places={places} t={makeT('en')} value={kansai} onSelect={onSelect} />);
  expect(screen.getByRole('combobox')).toHaveValue('Japan → Kansai');
});
