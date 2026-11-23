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
import { bandDates, bandRows } from '../../lib/band-rows';
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
  const rows = bandRows(t, state, site, seasons);
  return render(
    <I18nProvider locale={locale}>
      <SearchBand t={t} heading="h" state={state} rows={rows} dates={bandDates(t, state, rows, seasons, [], '2026-11-22')} />
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
  ] as const)('in %s, a country chosen: its box chosen (white, ✕, named so), its regions, all shown on wide screens (seven: no disclosure there)', (locale, label, chosenName, closed, open) => {
    const { container } = renderBand(locale, { dest: 'japan' });
    const nav = screen.getByRole('navigation', { name: label });
    const chosen = within(nav).getAllByRole('link')[0];
    expect(chosen).toHaveAccessibleName(chosenName);
    expect(chosen).toHaveClass(styles.shortcut, styles.selected);
    expect(chosen.querySelector(`.${styles.clear}`)).toHaveTextContent('✕');
    expect(chosen.querySelector(`.${styles.clear}`)).toHaveAttribute('aria-hidden', 'true');
    const regions = [...nav.querySelectorAll('li')].filter(li => li.querySelector(`.${styles.shortcut}`)).slice(1);
    expect(regions).toHaveLength(7);
    expect(regions.some(li => li.className !== '')).toBe(false);
    expect(nav.querySelector('details')).toBeNull();
    // Phones: the regions' row has the disclosure, closed, the boxes it shows in the HTML.
    const phone = within(container).getByRole('list', { name: label });
    const summary = phone.querySelector('details:not([open]) > summary')!;
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
    expect(screen.queryByRole('list')).toBeNull();
  });
});

// Task 73 (drawings Mobile6Home, Mobile4Results): the same boxes laid out for phones, in their own lists.
/** A phone list's boxes as [the box's name, its count with the unit, its address or null, its accessible name]. */
const phoneItems = (list: HTMLElement) => [...list.querySelectorAll(`li > .${styles.pbox}:not(summary)`)].map(el => [
  el.querySelector(`.${styles.pname}`)?.textContent, el.querySelector(`.${styles.count}`)?.textContent,
  el.tagName === 'A' ? el.getAttribute('href') : null, el.getAttribute('aria-label'),
]);
/** The chips (task 77) as [name, address, accessible name]. */
const chips = (container: HTMLElement, locale: Locale = 'zh-Hant') => [...within(container).getByRole('list', { name: locale === 'en' ? 'Chosen' : '已選取' })
  .querySelectorAll(`li > .${styles.pchip}`)].map(el => [el.querySelector(`.${styles.pname}`)?.textContent, el.getAttribute('href'), el.getAttribute('aria-label')]);
const phoneLists = (container: HTMLElement) => [...container.querySelectorAll(`.${styles.phoneRows} > ul`)].map(ul => ul.getAttribute('aria-label'));

describe('phones', () => {
  /** The phone date field's button and its ✕ (task 78). */
  const dateBox = (container: HTMLElement) => [...container.querySelectorAll<HTMLElement>(`.${styles.phoneOnly} button[aria-haspopup="dialog"]`)]
    .find(b => !b.textContent?.includes('⌕')) ?? null;

  it('nothing chosen (home): the search box, then the 幾時出發？ field; no destination or festival boxes (task 78: they are in their sheets)', () => {
    const { container } = renderBand('zh-Hant', {});
    expect(phoneLists(container)).toEqual([]);
    const openers = [...container.querySelectorAll(`.${styles.phoneOnly} button[aria-haspopup="dialog"]`)].map(b => b.textContent);
    expect(openers).toEqual(['⌕想去邊？輸入國家、地區或城市', '幾時出發？']);
    // The wide search row and season row are still there (hidden on phones by CSS).
    expect(container.querySelector(`.${styles.searchRow}.${styles.wideOnly}`)).not.toBeNull();
    expect(screen.getByRole('navigation', { name: '節日旅行團' })).toHaveClass(styles.wideOnly);
    expect(dateBox(container)).not.toBeNull();
  });

  it.each([
    ['zh-Hant', '日本 157 團，已選取，按此取消', '日本地區', '全部 7', '全部 7 個地區'],
    ['en', 'Japan, 157 tours, selected: press to remove', 'Regions of Japan', 'All 7', 'All 7 regions'],
  ] as const)('in %s, a country chosen: its chip first, then three regions and 全部 {n} ▾ (the rest once opened); then the date field', (locale, chosenName, label, short, full) => {
    const { container } = renderBand(locale, { dest: 'japan' });
    expect(phoneLists(container)).toEqual([locale === 'en' ? 'Chosen' : '已選取', label]);
    const chosen = within(container).getByRole('list', { name: locale === 'en' ? 'Chosen' : '已選取' });
    expect(within(chosen).getByRole('link')).toHaveAccessibleName(chosenName);
    expect(within(chosen).getByRole('link')).toHaveClass(styles.pchip);
    // The chip shows the name and ✕ (the count is in the heading's line and in its accessible name).
    expect(within(chosen).getByRole('link').textContent).toBe(locale === 'en' ? 'Japan✕' : '日本✕');
    expect(within(chosen).getByRole('link').querySelector(`.${styles.pclear}`)).toHaveAttribute('aria-hidden', 'true');
    const regions = within(container).getByRole('list', { name: label });
    const items = [...regions.children];
    // Three, the disclosure, then the four it shows.
    expect(items.map(li => (li.querySelector('details') ? 'more' : li.classList.contains(styles.pmoreItem) ? 'hidden' : 'shown')))
      .toEqual(['shown', 'shown', 'shown', 'more', 'hidden', 'hidden', 'hidden', 'hidden']);
    expect(phoneItems(regions)[0]).toEqual([locale === 'en' ? 'Kansai' : '關西', locale === 'en' ? '36 tours' : '36 團', locale === 'en' ? '/en/tours/japan-kansai' : '/tours/japan-kansai', null]);
    const summary = regions.querySelector('summary')!;
    expect(summary.textContent).toContain(`${short} ▾`);
    expect(summary).toHaveTextContent(full);
    // The date field comes after the regions.
    expect(regions.compareDocumentPosition(dateBox(container)!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('a region chosen (task 77): the country\'s chip (to no destination) and the region\'s (to its country); the others in the regions row', () => {
    const { container } = renderBand('zh-Hant', { dest: 'japan-kyushu' });
    expect(chips(container)).toEqual([
      ['日本', '/', '日本 157 團，已選取，按此取消'], ['九州', '/tours/japan', '九州 31 團，已選取，按此取消'],
    ]);
    const regions = within(container).getByRole('list', { name: '日本地區' });
    expect(phoneItems(regions).map(i => i[0])).toEqual(['關西', '關東', '中部北陸', '北海道', '沖繩', '東北']);
    expect(regions.querySelectorAll(`.${styles.pmoreItem}`)).toHaveLength(3);
    // The country's own box is not on phones (the chosen region's ✕ goes there).
    expect(phoneItems(regions).some(i => i[0] === '日本')).toBe(false);
  });

  it('a country, a region and a season (task 78): the two chips (the season is no chip); the field shows the season, its ✕ keeps the destination', () => {
    const { container } = renderBand('en', { dest: 'japan-kansai', from: christmas.from, to: christmas.to });
    expect(chips(container, 'en')).toEqual([
      ['Japan', '/en/seasons/christmas', 'Japan, 48 tours, selected: press to remove'],
      ['Kansai', '/en/seasons/christmas?dest=japan', 'Kansai, 12 tours, selected: press to remove'],
    ]);
    expect(dateBox(container)).toHaveTextContent('Christmas · 19 Dec – 27 Dec');
    expect(screen.getByRole('link', { name: 'Clear dates: Christmas · 19 Dec – 27 Dec' })).toHaveAttribute('href', '/en/tours/japan-kansai');
    // The chosen region is not repeated in the regions row.
    expect(phoneItems(within(container).getByRole('list', { name: 'Regions of Japan' })).some(i => i[0] === 'Kansai')).toBe(false);
  });

  it.each([
    [{ from: '2026-12-01', to: '2026-12-31', dmin: '3' }, '12/1 – 12/31 出發', '/?dmin=3'],
    [{ tfrom: '2026-12-01', tto: '2026-12-31' }, '12/1 – 12/31 內來回', '/'],
    // Both windows (a wide screen, an old link): the departure window; ✕ clears both.
    [{ from: '2026-12-01', to: '2026-12-31', tfrom: '2026-12-01', tto: '2027-01-05' }, '12/1 – 12/31 出發', '/'],
  ] as const)('dates chosen %#: the field shows them in words, ✕ goes to the page without them', (query, text, clear) => {
    const { container } = renderBand('zh-Hant', { ...query });
    expect(dateBox(container)).toHaveTextContent(text);
    expect(screen.getByRole('link', { name: `清除日期：${text}` })).toHaveAttribute('href', clear);
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
    expect(media('min-width: 1024px')).toMatch(/\.unit, \.whereLabel \{ position: absolute; width: 1px; height: 1px;[^}]*clip-path: inset\(50%\)/);
  });

  it('the disclosure hides its regions only while closed, and only where the browser can tell (:has): elsewhere all show', () => {
    expect(media('min-width: 1024px')).toContain('.shortcutList:not(:has(details[open])) > .moreOnWide { display: none; }');
    expect(media('max-width: 1023px')).toContain('.prow:not(:has(details[open])) > .pmoreItem { display: none; }');
    expect(css()).toContain('.more[open] .moreClosed, .more:not([open]) .moreOpen { display: none; }');
    expect(media('max-width: 1023px')).toContain('.pmore[open] .moreClosed, .pmore:not([open]) .moreOpen { display: none; }');
  });

  it('each width draws only its own parts: the phone layout nowhere from 1024px, the wide parts nowhere under it', () => {
    expect(media('min-width: 1024px')).toContain('.phoneOnly { display: none; }');
    expect(media('max-width: 1023px')).toContain('.lede, .wideOnly { display: none; }');
  });

  it('phones (task 73, drawings Mobile6Home and Mobile4Results): 20px heading, 13px line, rows 10px apart; boxes 40px, name and count side by side; chips, then four columns (two in English)', () => {
    const phone = media('max-width: 1023px');
    expect(phone).toContain('.inner { padding-top: 12px; padding-bottom: 14px; gap: 10px; }');
    expect(phone).toContain('.heading { font-size: 20px; letter-spacing: 0; line-height: 1.3; }');
    expect(phone).toContain('.line { font-size: 13px; line-height: 1.5; }');
    expect(phone).toContain('.phoneRows { display: flex; flex-direction: column; gap: 10px; }');
    expect(phone).toContain('.prow { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); align-items: stretch; gap: 8px;');
    // The chips (task 77): one wrapping row, as wide as their names, 40px tall, at least 44px to touch.
    expect(phone).toContain('.pchips { display: flex; flex-wrap: wrap; gap: 8px;');
    expect(phone).toMatch(/\.pchip \{[^}]*min-width: 44px;[^}]*min-height: 40px;[^}]*border: 2px solid var\(--on-gold\);[^}]*background: var\(--band-field-bg\); box-shadow: 0 0 0 2px var\(--on-gold\);/);
    expect(phone).toContain(".pchip::before { content: ''; position: absolute; inset: -4px 0; }");
    expect(phone).toContain('.band:lang(en) .pregionRow { grid-template-columns: repeat(2, minmax(0, 1fr)); }');
    expect(phone).toMatch(/\.pbox \{[^}]*min-height: 40px; display: flex; flex-wrap: wrap;[^}]*border: 2px solid var\(--on-gold\);/);
    expect(phone).toContain('.pregion { background: var(--header-bg); border-color: var(--header-bg); color: var(--header-text); }');
    // The count's unit for screen readers only.
    expect(phone).toMatch(/\.pbox \.unit \{ position: absolute; width: 1px; height: 1px;[^}]*clip-path: inset\(50%\)/);
    expect(css()).not.toMatch(/text-overflow|ellipsis/);
  });
});
