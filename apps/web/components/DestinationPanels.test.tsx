import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { places, suggestRegions, ALL_REGIONS_LABEL, COUNTRY_GROUPS, type Destination } from '@hktours/core';
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

describe('countries grouped by part of the world', () => {
  /** The flat list as it was before grouping: every country but the hidden ones, in data order. */
  const shownIds = (hidden = ['hongkong']) => places.data.countries.filter(c => !hidden.includes(c.id)).map(c => c.id);

  it('shows each group as a labelled group of its countries, in display order', async () => {
    renderPanels();
    await open();
    const groups = screen.getAllByRole('group');
    const expected = places.countryGroups
      .map(g => ({ id: g.id, ids: g.countries.map(c => c.id).filter(id => id !== 'hongkong') }))
      .filter(g => g.ids.length > 0);
    expect(groups).toHaveLength(expected.length);
    groups.forEach((group, i) => {
      const { id, ids } = expected[i];
      expect(group).toHaveAccessibleName(tZh(`countryGroup.${id}`));
      expect(within(group).getAllByRole('button').map(b => b.getAttribute('data-country'))).toEqual(ids);
    });
  });

  it('puts 日本 and 韓國 under 日本及韓國 and the mainland, Macau and Taiwan under 中國內地及港澳台', async () => {
    renderPanels();
    await open();
    const northeast = screen.getByRole('group', { name: '日本及韓國' });
    expect(within(northeast).getAllByRole('button').map(b => b.textContent)).toEqual(['日本', '韓國']);
    const china = screen.getByRole('group', { name: '中國內地及港澳台' });
    expect(within(china).getAllByRole('button').map(b => b.textContent).sort()).toEqual(['中國', '台灣', '澳門'].sort());
  });

  it('a heading is neither a button nor a link', async () => {
    renderPanels();
    await open();
    for (const label of ['日本及韓國', '歐洲', '中國內地及港澳台']) {
      expect(screen.queryByRole('button', { name: label })).toBeNull();
      expect(screen.queryByRole('link', { name: label })).toBeNull();
      expect(screen.getByText(label).closest('button, a')).toBeNull();
    }
  });

  it('offers exactly the countries the flat list offered, each once', async () => {
    renderPanels();
    await open();
    const offered = screen.getAllByRole('button').map(b => b.getAttribute('data-country')).filter(id => id !== null);
    expect([...offered].sort()).toEqual(shownIds().sort());
  });

  it('a group none of whose countries is offered is not shown', async () => {
    renderPanels(null, ['hongkong', 'japan', 'korea']);
    await open();
    expect(screen.queryByRole('group', { name: '日本及韓國' })).toBeNull();
    expect(screen.queryByText('日本及韓國')).toBeNull();
    expect(screen.getByRole('group', { name: '歐洲' })).toBeInTheDocument();
  });

  it('a group with any offered country is shown, even when others in it are hidden', async () => {
    renderPanels(null, ['china', 'taiwan', 'macau']);
    await open();
    const china = screen.getByRole('group', { name: '中國內地及港澳台' });
    expect(within(china).getAllByRole('button').map(b => b.textContent)).toEqual(['香港']);
  });

  it('the group headings are the dictionary text, which matches the labels in core', () => {
    for (const g of COUNTRY_GROUPS) expect(tZh(`countryGroup.${g.id}`), g.id).toBe(g.nameZh);
  });
});

describe('the panel scrolls inside the viewport', () => {
  const css = () => readFileSync(join(__dirname, 'DestinationPanels.module.css'), 'utf8').replace(/\s+/g, ' ');
  const panelRule = () => /\.panel \{([^}]*)\}/.exec(css())?.[1] ?? '';

  it('has a maximum height within the viewport (dvh, with a vh fallback first), scrolls up and down only, and keeps the scroll to itself', () => {
    const rule = panelRule();
    expect(rule).toMatch(/max-height: min\(70vh, 32rem\);.*max-height: min\(70dvh, 32rem\);/);
    expect(rule).toContain('overflow-y: auto;');
    expect(rule).toContain('overflow-x: hidden;');
    expect(rule).toContain('overscroll-behavior: contain;');
    expect(rule).toContain('max-width: calc(100vw - 32px);'); // no sideways scroll at 375 px
  });

  it('the grouped countries and the region step are both inside the one scrolling panel', async () => {
    renderPanels();
    await open();
    const toggle = screen.getByRole('button', { name: '按國家選擇' });
    const panel = document.getElementById(toggle.getAttribute('aria-controls')!)!;
    for (const group of screen.getAllByRole('group')) expect(panel).toContainElement(group);
    await user.click(within(panel).getByRole('button', { name: '日本' }));
    expect(panel).toContainElement(screen.getByRole('button', { name: '全部地區' }));
    expect(panel).toContainElement(screen.getByRole('list'));
  });

  it('scrolling the panel, or pressing on it (its scrollbar), does not close it', async () => {
    renderPanels();
    await open();
    const toggle = screen.getByRole('button', { name: '按國家選擇' });
    const panel = document.getElementById(toggle.getAttribute('aria-controls')!)!;
    fireEvent.pointerDown(panel);
    fireEvent.mouseDown(panel);
    fireEvent.touchStart(panel);
    fireEvent.wheel(panel);
    fireEvent.scroll(panel);
    fireEvent.pointerUp(panel);
    fireEvent.click(panel);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('button', { name: '日本' })).toBeInTheDocument();
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('a country further down takes keyboard focus normally, so the browser scrolls it into view', async () => {
    renderPanels();
    await open();
    const last = screen.getAllByRole('button').filter(b => b.hasAttribute('data-country')).at(-1)!;
    while (document.activeElement !== last) await user.tab();
    expect(last).toHaveFocus();
    expect(screen.getByRole('button', { name: '按國家選擇' })).toHaveAttribute('aria-expanded', 'true');
  });
});

describe('the panel never reaches past the viewport sideways', () => {
  const css = () => readFileSync(join(__dirname, 'DestinationPanels.module.css'), 'utf8').replace(/\s+/g, ' ');
  const phoneBlock = () => /@media \(max-width: 639px\) \{(.*)\}\s*$/.exec(css())?.[1] ?? '';

  it('from 640 px, beside the search box, it is right-aligned under its button and opens leftwards', () => {
    expect(css()).toMatch(/^[^@]*\.panels \{ position: relative; \}/);
    const panel = /^[^@]*\.panel \{([^}]*)\}/.exec(css())?.[1] ?? '';
    expect(panel).toContain('right: 0;');
    expect(panel).not.toMatch(/(^|[^-])left:/);
    expect(panel).toContain('width: 480px;');
  });

  it('below 640 px it hangs off the left edge of the search row, as wide as the screen allows', () => {
    const block = phoneBlock();
    expect(block).toContain('.panels { position: static; }');
    expect(block).toMatch(/\.panel \{ left: 0; right: auto; \}/);
    // max-width stays calc(100vw - 32px), the page's 16 px gutters, so it ends 16 px from the right edge.
    expect(css()).toContain('max-width: calc(100vw - 32px);');
  });

  it('both pages position their search row, so the panel has the row to hang off', () => {
    for (const page of ['../app/page.module.css', '../app/chain/page.module.css']) {
      const pageCss = readFileSync(join(__dirname, page), 'utf8').replace(/\s+/g, ' ');
      expect(pageCss, page).toMatch(/\.searchRow \{[^}]*position: relative;/);
    }
  });
});
