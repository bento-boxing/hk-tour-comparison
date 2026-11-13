import { it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { places, suggestRegions, ALL_REGIONS_LABEL, type Destination } from '@hktours/core';
import { DestinationPanels } from './DestinationPanels';
import { destinationLabel } from './DestinationSearch';
import { translate, type T } from '../lib/i18n';

const tZh: T = (key, vars) => translate('zh-Hant', key, vars);
const kansai: Destination = { countryId: 'japan', regionId: 'japan-kansai' };

let onSelect: ReturnType<typeof vi.fn<(dest: Destination) => void>>;
let user: ReturnType<typeof userEvent.setup>;
beforeEach(() => {
  onSelect = vi.fn<(dest: Destination) => void>();
  user = userEvent.setup();
});

const renderPanels = (value: Destination | null = null, hiddenCountryIds?: string[]) =>
  render(<DestinationPanels places={places} t={tZh} value={value} onSelect={onSelect} hiddenCountryIds={hiddenCountryIds} />);

const open = () => user.click(screen.getByRole('button', { name: '按國家選擇' }));

it('lists countries but not Hong Kong', async () => {
  renderPanels();
  const toggle = screen.getByRole('button', { name: '按國家選擇' });
  expect(toggle).toHaveAttribute('aria-expanded', 'false');
  expect(screen.queryByRole('button', { name: '日本' })).not.toBeInTheDocument();
  await open();
  expect(toggle).toHaveAttribute('aria-expanded', 'true');
  expect(screen.getByRole('button', { name: '日本' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: '韓國' })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: '香港' })).not.toBeInTheDocument();
});

it('hides whichever countries it is told to', async () => {
  renderPanels(null, ['japan']);
  await open();
  expect(screen.queryByRole('button', { name: '日本' })).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: '香港' })).toBeInTheDocument();
});

it('choosing a country then a region selects it', async () => {
  renderPanels();
  await open();
  await user.click(screen.getByRole('button', { name: '日本' }));
  await user.click(screen.getByRole('button', { name: '關西' }));
  expect(onSelect).toHaveBeenCalledTimes(1);
  expect(onSelect).toHaveBeenCalledWith(kansai);
  expect(screen.queryByRole('button', { name: '關西' })).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: '按國家選擇' })).toHaveAttribute('aria-expanded', 'false');
});

it('offers all regions first', async () => {
  renderPanels();
  await open();
  await user.click(screen.getByRole('button', { name: '日本' }));
  const regionButtons = within(screen.getByRole('list')).getAllByRole('button');
  expect(regionButtons[0]).toHaveTextContent('全部地區');
  expect(regionButtons.slice(1).map(b => b.textContent)).toEqual(places.regionsOf('japan').map(r => r.nameZh));
  await user.click(regionButtons[0]);
  expect(onSelect).toHaveBeenCalledWith({ countryId: 'japan', regionId: null });
  expect(screen.queryByRole('list')).not.toBeInTheDocument();
});

it('a single-region country selects the whole country straight away, as the search bar does', async () => {
  expect(places.regionsOf('singapore')).toHaveLength(1); // the case this test is about
  renderPanels();
  await open();
  await user.click(screen.getByRole('button', { name: '新加坡' }));
  const whole: Destination = { countryId: 'singapore', regionId: null };
  expect(onSelect).toHaveBeenCalledWith(whole);
  expect(destinationLabel(whole, places)).toBe(`新加坡 → ${ALL_REGIONS_LABEL}`);
  expect(suggestRegions('新加坡', places).map(s => s.destination)).toEqual([whole]);
  expect(screen.queryByRole('button', { name: '全部地區' })).not.toBeInTheDocument();
  expect(screen.queryByRole('list')).not.toBeInTheDocument();
});

it('back returns to the country list', async () => {
  renderPanels();
  await open();
  await user.click(screen.getByRole('button', { name: '日本' }));
  expect(screen.queryByRole('button', { name: '韓國' })).not.toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: '← 返回' }));
  expect(screen.getByRole('button', { name: '日本' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: '韓國' })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: '關西' })).not.toBeInTheDocument();
  expect(onSelect).not.toHaveBeenCalled();
});

it('marks the current selection', async () => {
  renderPanels(kansai);
  await open();
  expect(screen.getByRole('button', { name: '日本' })).toHaveAttribute('aria-current', 'true');
  expect(screen.getByRole('button', { name: '韓國' })).not.toHaveAttribute('aria-current');
  await user.click(screen.getByRole('button', { name: '日本' }));
  expect(screen.getByRole('button', { name: '關西' })).toHaveAttribute('aria-current', 'true');
  expect(screen.getByRole('button', { name: '全部地區' })).not.toHaveAttribute('aria-current');
  expect(screen.getByRole('button', { name: '關東' })).not.toHaveAttribute('aria-current');
});

it('marks all regions as current when the whole country is selected', async () => {
  renderPanels({ countryId: 'japan', regionId: null });
  await open();
  await user.click(screen.getByRole('button', { name: '日本' }));
  expect(screen.getByRole('button', { name: '全部地區' })).toHaveAttribute('aria-current', 'true');
  expect(screen.getByRole('button', { name: '關西' })).not.toHaveAttribute('aria-current');
});

it('works by keyboard alone, keeping focus on the panel', async () => {
  renderPanels();
  await user.tab();
  expect(screen.getByRole('button', { name: '按國家選擇' })).toHaveFocus();
  await user.keyboard('{Enter}');
  // Opening leaves focus on the toggle (disclosure pattern); tab forward to 日本.
  const japan = screen.getByRole('button', { name: '日本' });
  while (document.activeElement !== japan) await user.tab();
  await user.keyboard('{Enter}');
  // Step two takes focus, starting with 全部地區.
  expect(screen.getByRole('button', { name: '全部地區' })).toHaveFocus();
  await user.keyboard('{Escape}');
  expect(screen.queryByRole('list')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: '按國家選擇' })).toHaveFocus();
  expect(onSelect).not.toHaveBeenCalled();
});

it('returns focus to the button after a choice', async () => {
  renderPanels();
  await open();
  await user.click(screen.getByRole('button', { name: '日本' }));
  await user.click(screen.getByRole('button', { name: '關西' }));
  expect(screen.getByRole('button', { name: '按國家選擇' })).toHaveFocus();
});

it('全部地區 is the same text the suggestions use', () => {
  expect(tZh('dest.allRegions')).toBe(ALL_REGIONS_LABEL);
});
