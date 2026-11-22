import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { render, screen, within } from '@testing-library/react';
import { places } from '@hktours/core';
import type { DestinationCount, DestinationCounts } from '@hktours/db/read';
import { I18nProvider } from '../../lib/i18n-client';
import { makeT, type Locale } from '../../lib/i18n';
import { parseSearchParams } from '../../lib/search-params';
import { seasonWindow } from '../../lib/seasons';
import { bandRows } from '../../lib/band-rows';
import type { SeasonCount } from '../../lib/season-counts';
import styles from './search-band.module.css';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }), usePathname: () => '/' }));

const { SearchBand } = await import('./search-band');

// Task 69 (drawing W3): the band's two rows as rendered (which boxes there are is lib/band-rows.test.ts's).

const line = (countryId: string, regionId: string | null, tours: number): DestinationCount => ({ countryId, regionId, tours, operators: 1 });
const site: DestinationCounts = {
  all: { tours: 3000, operators: 6 },
  destinations: [
    line('china', null, 1463), line('japan', null, 157),
    line('japan', 'japan-kansai', 36), line('japan', 'japan-kanto', 35), line('japan', 'japan-kyushu', 31), line('japan', 'japan-chubu', 30),
    line('japan', 'japan-hokkaido', 24), line('japan', 'japan-okinawa', 23), line('japan', 'japan-tohoku', 15),
    line('korea', null, 1), line('korea', 'korea-seoul', 1),
  ],
};
const christmas = seasonWindow('christmas', 2026)!;
const seasons: SeasonCount[] = [
  { window: christmas, count: { tours: 1306, operators: 8, destinations: [line('japan', null, 48), line('japan', 'japan-kansai', 12)] } },
  { window: seasonWindow('lunar-new-year', 2027)!, count: { tours: 353, operators: 5, destinations: [] } },
];

function renderBand(locale: Locale, query: Record<string, string>) {
  const t = makeT(locale);
  const state = parseSearchParams(query, places);
  return render(
    <I18nProvider locale={locale}>
      <SearchBand t={t} heading="h" state={state} rows={bandRows(t, state, site, seasons)} />
    </I18nProvider>,
  );
}

/** A row's items as [the box's name, its count with the unit, its address or null for no link, its accessible name]. */
const items = (nav: HTMLElement) => [...nav.querySelectorAll(`li > .${styles.shortcut}, li > .${styles.season}`)].map(el => [
  el.querySelector(`.${styles.name}`)?.textContent, el.querySelector(`.${styles.count}`)?.textContent,
  el.tagName === 'A' ? el.getAttribute('href') : null, el.getAttribute('aria-label'),
]);

describe('the rows', () => {
  it.each([
    ['zh-Hant', '熱門目的地', '節日旅行團', ['中國', '1,463 團', '/tours/china', null], ['聖誕', '1,306 團', '/seasons/christmas', null]],
    ['zh-Hans', '热门目的地', '节日旅行团', ['中国', '1,463 团', '/zh-hans/tours/china', null], ['圣诞', '1,306 团', '/zh-hans/seasons/christmas', null]],
    ['en', 'Popular destinations', 'Holiday tours', ['China', '1,463 tours', '/en/tours/china', null], ['Christmas', '1,306 tours', '/en/seasons/christmas', null]],
  ] as const)('in %s, nothing chosen: two navigation landmarks, each named by its label; the counts read with their unit; no link to the index', (locale, where, when, first, season) => {
    const { container } = renderBand(locale, {});
    expect(items(screen.getByRole('navigation', { name: where }))[0]).toEqual([...first]);
    expect(items(screen.getByRole('navigation', { name: when }))[0]).toEqual([...season]);
    expect(within(screen.getByRole('navigation', { name: where })).getAllByRole('link')[0]).toHaveAccessibleName(`${first[0]} ${first[1]}`);
    // No 所有目的地 → (the footer links the destinations index), and no disclosure without a chosen country.
    expect(container.querySelector('a[href$="/tours"]')).toBeNull();
    expect(container.querySelector('details')).toBeNull();
  });

  it.each([
    ['zh-Hant', '日本地區', '日本 157 團，已選取，按此取消', '全部 7 個地區', '收起'],
    ['zh-Hans', '日本地区', '日本 157 团，已选取，按此取消', '全部 7 个地区', '收起'],
    ['en', 'Regions of Japan', 'Japan, 157 tours, selected: press to remove', 'All 7 regions', 'Show fewer'],
  ] as const)('in %s, a country chosen: its box chosen (white, ✕, named so), its regions, and the disclosure, closed, its links all in the HTML', (locale, label, chosenName, closed, open) => {
    renderBand(locale, { dest: 'japan' });
    const nav = screen.getByRole('navigation', { name: label });
    const chosen = within(nav).getAllByRole('link')[0];
    expect(chosen).toHaveAccessibleName(chosenName);
    expect(chosen).toHaveClass(styles.shortcut, styles.selected);
    expect(chosen.querySelector(`.${styles.clear}`)).toHaveTextContent('✕');
    expect(chosen.querySelector(`.${styles.clear}`)).toHaveAttribute('aria-hidden', 'true');
    // All seven regions are links in the HTML, the ones past the first three marked to show once opened (phones).
    const regions = [...nav.querySelectorAll('li')].filter(li => li.querySelector(`.${styles.shortcut}`)).slice(1);
    expect(regions).toHaveLength(7);
    expect(regions.map(li => li.classList.contains(styles.moreOnPhone))).toEqual([false, false, false, true, true, true, true]);
    const details = nav.querySelector('details')!;
    expect(details).not.toHaveAttribute('open');
    expect(details.closest('li')).toHaveClass(styles.moreItem, styles.hideOnWide); // seven regions: all shown on wide screens
    const summary = details.querySelector('summary')!;
    expect(summary.querySelector(`.${styles.moreClosed}`)).toHaveTextContent(closed);
    expect(summary.querySelector(`.${styles.moreOpen}`)).toHaveTextContent(open);
  });

  it('a season chosen: its box chosen; a destination with nothing in it faded: plain text, not a link, not focusable', () => {
    renderBand('zh-Hant', { from: christmas.from, to: christmas.to });
    const where = screen.getByRole('navigation', { name: '熱門目的地' });
    expect(items(where).slice(0, 3)).toEqual([
      ['中國', '0 團', null, null], ['日本', '48 團', '/seasons/christmas?dest=japan', null], ['韓國', '0 團', null, null],
    ]);
    const faded = where.querySelector(`li > .${styles.faded}`)!;
    expect(faded.tagName).toBe('SPAN');
    expect(faded).not.toHaveAttribute('tabindex');
    const when = screen.getByRole('navigation', { name: '節日旅行團' });
    expect(items(when)).toEqual([
      ['聖誕', '1,306 團', '/', '聖誕 1,306 團，已選取，按此取消'], ['農曆新年', '353 團', '/seasons/lunar-new-year', null],
    ]);
    expect(within(when).getAllByRole('link')[0]).toHaveClass(styles.season, styles.selected);
  });

  it('a band given no rows (an operator\'s page) has none', () => {
    render(<I18nProvider locale="zh-Hant"><SearchBand t={makeT('zh-Hant')} heading="h" /></I18nProvider>);
    expect(screen.queryByRole('navigation')).toBeNull();
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
  it('wide screens: seasons outlined in --on-gold; a chosen box white with an ink border and ring, ✕ after its count; a faded box', () => {
    const text = css();
    expect(text).toMatch(/\.season \{[^}]*min-height: 32px; padding: 2px 10px; border: 2px solid var\(--on-gold\); border-radius: 6px; color: var\(--on-gold\); font-size: 15px; font-weight: 700;/);
    expect(text).toContain('.selected { background: var(--band-field-bg); color: var(--on-gold); border: 2px solid var(--on-gold); box-shadow: 0 0 0 2px var(--on-gold); }');
    expect(text).toContain('.shortcut.selected { padding: 2px 10px; }');
    expect(text).toContain('.clear { margin-left: 8px; font-weight: 700; }');
    expect(text).toContain('.faded { opacity: 0.4; }');
    expect(media('min-width: 640px')).toMatch(/\.unit, \.whereLabel \{ position: absolute; width: 1px; height: 1px;[^}]*clip-path: inset\(50%\)/);
  });

  it('the disclosure hides its regions only while closed, and only where the browser can tell (:has): elsewhere all show', () => {
    expect(media('min-width: 640px')).toContain('.shortcutList:not(:has(details[open])) > .moreOnWide { display: none; }');
    expect(media('max-width: 639px')).toContain('.shortcutList:not(:has(details[open])) > .moreOnPhone { display: none; }');
    expect(css()).toContain('.more[open] .moreClosed, .more:not([open]) .moreOpen { display: none; }');
    expect(media('max-width: 639px')).toContain('.more > summary { min-height: 44px; font-size: 14px; }');
  });

  it('phones (drawings P1 and W3): groups 18px apart, the button full width, four columns (two in English), three for the seasons (two in English), boxes at least 52px, ✕ in the corner', () => {
    const phone = media('max-width: 639px');
    expect(phone).toContain('.inner { padding-top: 18px; padding-bottom: 16px; gap: 18px; }');
    expect(phone).toContain('.panelsBox { flex-basis: 100%; --toggle-width: 100%; --toggle-height: 48px; }');
    expect(phone).toContain('.shortcutList { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); align-items: stretch; gap: 8px; }');
    expect(phone).toContain('.seasonList { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); align-items: stretch; gap: 8px; }');
    expect(phone).toContain('.band:lang(en) .shortcutList, .band:lang(en) .seasonList { grid-template-columns: repeat(2, minmax(0, 1fr)); }');
    expect(phone).toMatch(/\.shortcut, \.season \{[^}]*min-height: 52px;/);
    expect(phone).toContain('.shortcutList > .hideOnPhone { display: none; }');
    expect(phone).toContain('.clear { position: absolute; top: 2px; right: 6px; margin: 0; font-size: 14px; line-height: 1; }');
    expect(phone).toContain('.shortcut.selected { padding: calc(1.2em + 4px) 2px 4px; }');
    expect(phone).toMatch(/\.name \{[^}]*hyphens: auto; overflow-wrap: anywhere; \}/);
    expect(media('max-width: 359px')).toContain('.name { font-size: 14px; }');
    expect(css()).not.toMatch(/text-overflow|ellipsis/);
  });

  it('the 按國家選擇 button reads the band\'s width and height hooks, and wraps at very large text on phones', () => {
    const panels = readFileSync(join(__dirname, '../../components/DestinationPanels.module.css'), 'utf8').replace(/\s+/g, ' ');
    expect(panels).toContain('width: var(--toggle-width, auto); height: var(--toggle-height, var(--search-height, 46px));');
    expect(panels).toMatch(/@media \(max-width: 639px\) \{.*\.toggle \{ height: auto; min-height: var\(--toggle-height, var\(--search-height, 46px\)\); white-space: normal; \}/);
  });
});
