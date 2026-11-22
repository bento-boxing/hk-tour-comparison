import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { render, screen, within } from '@testing-library/react';
import { places } from '@hktours/core';
import type { ListedCount } from '@hktours/db/read';
import { I18nProvider } from '../../lib/i18n-client';
import { makeT, type Locale } from '../../lib/i18n';
import { parseSearchParams } from '../../lib/search-params';
import { seasonWindow, type SeasonId } from '../../lib/seasons';
import type { SeasonCount } from '../../lib/season-counts';
import styles from './search-band.module.css';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }), usePathname: () => '/' }));

const { SearchBand } = await import('./search-band');

// Task 68: the band's seasons (drawing Home2 "B" on wide screens, Home3PhoneGrid "P1" on phones) and its phone layout.

const shortcuts = [
  { destination: { countryId: 'china', regionId: null }, count: { tours: 1463, operators: 8 } },
  { destination: { countryId: 'japan', regionId: null }, count: { tours: 157, operators: 6 } },
  { destination: { countryId: 'korea', regionId: null }, count: { tours: 1, operators: 1 } },
];
const season = (id: SeasonId, year: number, tours: number): SeasonCount => ({ window: seasonWindow(id, year)!, count: { tours, operators: tours > 0 ? 2 : 0 } as ListedCount });

function renderBand(locale: Locale, seasons?: SeasonCount[], withShortcuts = true) {
  return render(
    <I18nProvider locale={locale}>
      <SearchBand
        t={makeT(locale)} heading="h" state={parseSearchParams({}, places)}
        shortcuts={withShortcuts ? shortcuts : undefined} seasons={seasons}
      />
    </I18nProvider>,
  );
}

/** A box as [its name, its count with the unit, its address]. */
const box = (a: Element) => [a.querySelector(`.${styles.name}`)?.textContent, a.querySelector(`.${styles.count}`)?.textContent, a.getAttribute('href')];

describe('the seasons on the band', () => {
  it.each([
    ['zh-Hant', '節日旅行團', [['聖誕', '1,306 團', '/seasons/christmas'], ['農曆新年', '353 團', '/seasons/lunar-new-year'], ['復活節', '1 團', '/seasons/easter']]],
    ['zh-Hans', '节日旅行团', [['圣诞', '1,306 团', '/zh-hans/seasons/christmas'], ['农历新年', '353 团', '/zh-hans/seasons/lunar-new-year'], ['复活节', '1 团', '/zh-hans/seasons/easter']]],
    ['en', 'Holiday tours', [['Christmas', '1,306 tours', '/en/seasons/christmas'], ['Lunar New Year', '353 tours', '/en/seasons/lunar-new-year'], ['Easter', '1 tour', '/en/seasons/easter']]],
  ] as const)('in %s: a navigation landmark named by its visible label, a box per season linking to its page, the count with its unit', (locale, label, boxes) => {
    renderBand(locale, [season('christmas', 2026, 1306), season('lunar-new-year', 2027, 353), season('easter', 2027, 1)]);
    const nav = screen.getByRole('navigation', { name: label });
    expect(within(nav).getByText(label)).toHaveClass(styles.label);
    const links = within(nav).getAllByRole('link');
    expect(links.map(box)).toEqual(boxes);
    for (const link of links) expect(link).toHaveClass(styles.season);
    // The accessible name reads the count with its unit (the unit is only visually hidden on wide screens).
    expect(links[0]).toHaveAccessibleName(`${boxes[0][0]} ${boxes[0][1]}`);
  });

  it('only the seasons with tours now, in the calendar order of their windows (in January Christmas is next December\'s, so last)', () => {
    renderBand('zh-Hant', [season('christmas', 2027, 4), season('lunar-new-year', 2027, 0), season('easter', 2027, 9)]);
    const links = within(screen.getByRole('navigation', { name: '節日旅行團' })).getAllByRole('link');
    expect(links.map(a => box(a)[0])).toEqual(['復活節', '聖誕']);
  });

  it('no season with tours: no row at all, and no label', () => {
    renderBand('zh-Hant', [season('christmas', 2026, 0), season('lunar-new-year', 2027, 0), season('easter', 2027, 0)]);
    expect(screen.queryByRole('navigation', { name: '節日旅行團' })).toBeNull();
    expect(screen.queryByText('節日旅行團')).toBeNull();
    // The destinations are still there.
    expect(screen.getByRole('navigation', { name: '熱門目的地' })).toBeInTheDocument();
  });

  it('only with the shortcuts: a band without them (a season\'s or an operator\'s page) shows no seasons either', () => {
    renderBand('zh-Hant', [season('christmas', 2026, 5)], false);
    expect(screen.queryByRole('navigation')).toBeNull();
  });
});

describe('the destinations\' row', () => {
  it.each([
    ['zh-Hant', '熱門目的地', ['中國', '1,463 團'], ['韓國', '1 團'], '所有目的地 →'],
    ['zh-Hans', '热门目的地', ['中国', '1,463 团'], ['韩国', '1 团'], '所有目的地 →'],
    ['en', 'Popular destinations', ['China', '1,463 tours'], ['South Korea', '1 tour'], 'All destinations →'],
  ] as const)('in %s: named by its label (熱門目的地), each box\'s count with its unit, then the index', (locale, label, first, last, all) => {
    renderBand(locale);
    const nav = screen.getByRole('navigation', { name: label });
    const links = within(within(nav).getByRole('list')).getAllByRole('link');
    expect(box(links[0]).slice(0, 2)).toEqual(first);
    expect(box(links[2]).slice(0, 2)).toEqual(last);
    expect(links[0]).toHaveAccessibleName(`${first[0]} ${first[1]}`);
    // Wide screens: the index after the boxes, the list's last item.
    expect(links.at(-1)).toHaveTextContent(all);
    expect(links.at(-1)!.closest('li')).toHaveClass(styles.allItem);
    // Phones: the same link in the label row, after the label and before the boxes (the order they are seen in).
    const row = within(nav).getByText(label).parentElement!;
    expect(row).toHaveClass(styles.labelRow);
    const phoneLink = within(row).getByRole('link');
    expect(phoneLink).toHaveTextContent(all);
    expect(phoneLink).toHaveClass(styles.phoneAll);
    expect(phoneLink.getAttribute('href')).toBe(links.at(-1)!.getAttribute('href'));
    expect(row.compareDocumentPosition(within(nav).getByRole('list')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});

/** search-band.module.css without comments, whitespace collapsed. */
const css = () => readFileSync(join(__dirname, 'search-band.module.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\s+/g, ' ');
/** The rules inside one @media block. */
const media = (query: string) => {
  const text = css();
  const at = text.indexOf(`@media (${query}) {`);
  expect(at).toBeGreaterThanOrEqual(0);
  let depth = 0;
  for (let i = text.indexOf('{', at); i < text.length; i++) {
    if (text[i] === '{') depth++;
    if (text[i] === '}' && --depth === 0) return text.slice(at, i + 1);
  }
  return '';
};

describe('the look', () => {
  it('wide screens: the seasons outlined in --on-gold (no fill), the shortcuts\' shape and size; the unit and the destinations\' label for screen readers only', () => {
    const text = css();
    expect(text).toMatch(/\.season \{[^}]*min-height: 32px; padding: 2px 10px; border: 2px solid var\(--on-gold\); border-radius: 6px; color: var\(--on-gold\); font-size: 15px; font-weight: 700;/);
    expect(text).not.toMatch(/\.season \{[^}]*background/);
    expect(text).toMatch(/\.season:focus-visible \{ outline: 2px solid var\(--on-gold\)/);
    expect(media('min-width: 640px')).toMatch(/\.unit, \.popularLabel \{ position: absolute; width: 1px; height: 1px;[^}]*clip-path: inset\(50%\)/);
    expect(media('min-width: 640px')).toContain('.phoneAll { display: none; }');
  });

  it('phones (drawing P1): groups 18px apart, the button full width, four columns of destinations and three of seasons (two of each in English), boxes at least 52px, 44px to touch the index', () => {
    const phone = media('max-width: 639px');
    expect(phone).toContain('.inner { padding-top: 18px; padding-bottom: 16px; gap: 18px; }');
    expect(phone).toContain('.panelsBox { flex-basis: 100%; --toggle-width: 100%; --toggle-height: 48px; }');
    expect(phone).toContain('.shortcutList { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); align-items: stretch; gap: 8px; }');
    expect(phone).toContain('.seasonList { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); align-items: stretch; gap: 8px; }');
    expect(phone).toContain('.band:lang(en) .shortcutList, .band:lang(en) .seasonList { grid-template-columns: repeat(2, minmax(0, 1fr)); }');
    expect(phone).toMatch(/\.shortcut, \.season \{[^}]*min-height: 52px;/);
    expect(phone).toContain('.label { margin: 0 0 8px; font-size: 13px; font-weight: 700;');
    expect(phone).toMatch(/\.name \{ font-size: 15px; font-weight: 700;/);
    expect(phone).toMatch(/\.count \{ margin-left: 0; font-size: 12px;/);
    expect(phone).toContain('.all { min-height: 44px;');
    // The fifth destination on, and the list's own index link, are not shown: the label row has the link.
    expect(phone).toContain('.shortcutList > li:nth-child(n + 5) { display: none; }');
    // The label row in normal flow, wrapping with large text, pulled up into the gap above and never over the boxes
    // (no absolute positioning, no negative bottom margin).
    expect(phone).toContain('.labelRow { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; column-gap: 12px; margin: -12px 0 0; }');
    expect(css()).not.toMatch(/position: absolute; top:/);
    // Large text: side padding in every box, and a name breaks (hyphenated, else anywhere) rather than run past its box.
    expect(phone).toMatch(/\.shortcut, \.season \{[^}]*padding: 6px 4px;/);
    expect(phone).toContain('.season { padding: 4px 6px; }');
    expect(phone).toMatch(/\.name \{[^}]*hyphens: auto; overflow-wrap: anywhere; \}/);
    // A count may put its unit under its number rather than run past the box.
    expect(phone).toContain('.count { margin-left: 0; font-size: 12px; font-weight: 500; }');
    // Never below 13px, and no name cut short.
    expect(media('max-width: 359px')).toContain('.name { font-size: 14px; }');
    expect(css()).not.toMatch(/text-overflow|ellipsis/);
  });

  it('the 按國家選擇 button reads the band\'s width and height hooks, falling back to its own size elsewhere', () => {
    const panels = readFileSync(join(__dirname, '../../components/DestinationPanels.module.css'), 'utf8').replace(/\s+/g, ' ');
    expect(panels).toContain('width: var(--toggle-width, auto); height: var(--toggle-height, var(--search-height, 46px));');
    // On phones its words wrap at very large text sizes (it grows taller) instead of running wider than the window.
    expect(panels).toMatch(/@media \(max-width: 639px\) \{.*\.toggle \{ height: auto; min-height: var\(--toggle-height, var\(--search-height, 46px\)\); white-space: normal; \}/);
  });
});
