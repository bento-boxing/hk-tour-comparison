import { it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { places, buildPlacesIndex, suggestRegions, type Destination } from '@hktours/core';
import { DestinationSearch, destinationLabel } from './DestinationSearch';
import { translate, type T } from '../lib/i18n';

const tZh: T = (key, vars) => translate('zh-Hant', key, vars);
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
const tiny = buildPlacesIndex({
  countries: [{ id: 'a', nameZh: '甲國', nameEn: 'A', aliases: [] }, { id: 'b', nameZh: '乙國', nameEn: 'B', aliases: [] }],
  regions: [
    { id: 'a-r', countryId: 'a', nameZh: '甲區', nameEn: '', aliases: [] },
    { id: 'b-r', countryId: 'b', nameZh: '乙區', nameEn: '', aliases: [] },
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
});

it('the hint lists four cities of the region with the matched city first', async () => {
  renderSearch(null, tiny);
  await user.type(screen.getByRole('combobox'), '甲區');
  expect(screen.getAllByRole('option')[0]).toHaveTextContent('甲國 → 甲區 包括 一城、二城、三城、四城');
  await user.clear(screen.getByRole('combobox'));
  await user.type(screen.getByRole('combobox'), '聖城');
  expect(screen.getAllByRole('option')[0]).toHaveTextContent('甲國 → 甲區 包括 聖城、一城、二城、三城');
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

it('the highlight wraps at both ends', async () => {
  renderSearch(null, tiny);
  const input = screen.getByRole('combobox');
  await user.type(input, '聖城');
  const [first, second] = screen.getAllByRole('option');
  await user.keyboard('{ArrowUp}');
  expect(input).toHaveAttribute('aria-activedescendant', second.id);
  await user.keyboard('{ArrowDown}');
  expect(input).toHaveAttribute('aria-activedescendant', first.id);
  await user.keyboard('{ArrowUp}');
  expect(input).toHaveAttribute('aria-activedescendant', second.id);
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
  const options = screen.getAllByRole('option');
  expect(options).toHaveLength(2);
  expect(options[0]).toHaveTextContent('甲國 → 甲區');
  expect(options[1]).toHaveTextContent('乙國 → 乙區');
});

it('is a labelled combobox that controls its listbox', async () => {
  renderSearch();
  const input = screen.getByRole('combobox', { name: '輸入國家、地區或城市' });
  expect(input).toHaveAttribute('placeholder', '輸入國家、地區或城市');
  expect(input).toHaveAttribute('aria-autocomplete', 'list');
  await user.type(input, '大阪');
  expect(input).toHaveAttribute('aria-controls', screen.getByRole('listbox').id);
});

it('styles the dropdown like the mockup: the row Enter would pick is the hit', async () => {
  renderSearch();
  await user.type(screen.getByRole('combobox'), '日本');
  const options = screen.getAllByRole('option');
  expect(options[0].className).toMatch(/hit/);
  expect(options[1].className).not.toMatch(/hit/);
  await user.keyboard('{ArrowDown}{ArrowDown}');
  expect(options[0].className).not.toMatch(/hit/);
  expect(options[1].className).toMatch(/hit/);
});

it('destinationLabel names the country and region', () => {
  expect(destinationLabel(kansai, places)).toBe('日本 → 關西');
  expect(destinationLabel({ countryId: 'japan', regionId: null }, places)).toBe('日本 → 全部地區');
});
