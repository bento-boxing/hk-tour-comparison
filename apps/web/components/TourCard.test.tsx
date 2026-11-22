import type { ReactElement } from 'react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect, vi, beforeEach, afterEach, type MockInstance } from 'vitest';
import { act, render, screen, within, fireEvent } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { hydrateRoot } from 'react-dom/client';
import userEvent from '@testing-library/user-event';
import { places, type IsoDate, type Stop } from '@hktours/core';
import type { OperatorInfo } from '@hktours/db';
import { TourCard, DATE_CELLS, shiftIntoView, type TourCardProps } from './TourCard';
import styles from './TourCard.module.css';
import type { TourRow } from '../lib/tour-row';
import { makeT } from '../lib/i18n';
import { OPENED_KEY, resetOpenedCache } from '../lib/opened-tours';
import { SAVED_KEY, resetSavedCache } from '../lib/saved-tours';
import { renderAtDocument } from '../lib/render-at-document.test-utils';
import { resetBrowserTodayCache, setBrowserTodayClockForTests } from '../lib/browser-today';

const tZh = makeT('zh-Hant');

const kansai = (cityId: string): Stop => ({ countryId: 'japan', regionId: 'japan-kansai', cityId });
const tour: TourRow = {
  key: 'egl:KIX5', operatorId: 'egl', url: 'https://example.test/egl/KIX5',
  days: 5, nights: 4,
  stops: [kansai('japan-kansai-osaka'), kansai('japan-kansai-kyoto'), kansai('japan-kansai-nara'), kansai('japan-kansai-kobe')],
  start: { kind: 'hk', label: null }, end: { kind: 'hk', label: null },
  fromPriceHkd: 7999, windowPriceHkd: 7999, fallbackPriceHkd: 7499,
  departures: [
    { date: '2026-12-18', priceHkd: 7999 }, { date: '2026-12-20', priceHkd: 8299 },
    { date: '2026-12-23', priceHkd: 8299 }, { date: '2026-12-27', priceHkd: null },
    { date: '2026-12-30', priceHkd: 9999 }, { date: '2027-01-03', priceHkd: 8999 },
  ],
  priceChange: { kind: 'lower', diffHkd: 500, sinceDate: '2026-11-05' },
  lastUpdated: '2026-11-11T19:10:00Z',
};
/** Two more dates than the grid holds: five are shown, the sixth cell counts the other three. */
const eight: TourRow = { ...tour, departures: [...tour.departures, { date: '2027-01-08', priceHkd: 8999 }, { date: '2027-01-10', priceHkd: 8999 }] };
/** Seven countries: five names on the row, then the count of the other two. */
const sevenCountries: Stop[] = ['argentina', 'brazil', 'peru', 'chile', 'morocco', 'antarctica', 'france'].map(countryId => {
  const region = places.data.regions.find(r => r.countryId === countryId)!;
  return { countryId, regionId: region.id, cityId: null };
});
const operator: OperatorInfo = {
  id: 'egl', nameZh: '東瀛遊', nameEn: 'EGL Tours', color: '#d62839', lastGoodRunAt: '2026-11-11T19:10:00Z',
};
const props: TourCardProps = { tour, operator, places, today: '2026-11-12', t: tZh };

/** The row's own link (the gold button to the operator's page); each departure date is a link too, named by its date. */
const cardLink = () => screen.getByRole('link', { name: /^東瀛遊/ });
/** The row's price is a div; each date's price (its tooltip) is a span, so lookups by price text pick the div. */
const priceDiv = { selector: 'div' };
const dateLinks = () => within(screen.getByRole('group', { name: '出發日期' })).getAllByRole('link');
const cells = () => within(screen.getAllByRole('row')[0]).getAllByRole('cell');

/**
 * Puts the server's HTML for `ui` in the page, hydrates it, and runs the checks with the container and the console.error
 * spy (a mismatch is reported there). Whatever happens, the row is unmounted and taken out again and console.error
 * restored, so a failing check never leaves a row behind for the tests after it.
 */
async function hydrated(ui: ReactElement, checks: (container: HTMLElement, errors: MockInstance) => void): Promise<void> {
  const container = document.createElement('div');
  container.innerHTML = renderToString(ui);
  document.body.append(container);
  const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
  let root: ReturnType<typeof hydrateRoot> | undefined;
  try {
    await act(async () => { root = hydrateRoot(container, ui); });
    checks(container, errors);
  } finally {
    if (root) act(() => root!.unmount());
    container.remove();
    errors.mockRestore();
  }
}

/*
 * The stylesheet, read as rules (not compared as text): for each media query ('' outside any), each selector's
 * declarations. The tests below state the layout's rules on it. What only a browser can check (that no two cells
 * overlap, that the rows are the same height, that the columns line up) is measured in a browser, outside the unit
 * tests.
 */
type Declarations = Record<string, string>;
function parseCss(source: string): Record<string, Record<string, Declarations>> {
  const sheet: Record<string, Record<string, Declarations>> = {};
  const read = (text: string, media: string) => {
    let i = 0;
    for (;;) {
      const open = text.indexOf('{', i);
      if (open < 0) return;
      const prelude = text.slice(i, open).trim().replace(/\s+/g, ' ');
      let depth = 1, j = open + 1;
      for (; depth > 0; j++) depth += text[j] === '{' ? 1 : text[j] === '}' ? -1 : 0;
      const body = text.slice(open + 1, j - 1);
      if (prelude.startsWith('@media')) read(body, prelude.slice('@media'.length).trim());
      // @supports inside a layout: its own key, after the layout's ('(min-width: 1280px) @supports (…)').
      else if (prelude.startsWith('@supports')) read(body, `${media} ${prelude}`.trim());
      else {
        // A selector list ('.add, .save') gives each of its selectors these declarations.
        const rules = (sheet[media] ??= {});
        for (const selector of prelude.split(',').map(x => x.trim())) {
          const declarations = (rules[selector] ??= {});
          for (const d of body.split(';')) {
            const colon = d.indexOf(':');
            if (colon > 0) declarations[d.slice(0, colon).trim()] = d.slice(colon + 1).trim().replace(/\s+/g, ' ');
          }
        }
      }
      i = j;
    }
  };
  read(source.replace(/\/\*[\s\S]*?\*\//g, ''), '');
  return sheet;
}
const sheet = parseCss(readFileSync(join(__dirname, 'TourCard.module.css'), 'utf8'));
const PHONE = '';
const ZOOMED = '(max-width: 319px)';
const TABLET = '(min-width: 640px)';
const WIDE = '(min-width: 1280px)';
/** The row's rule in each layout: from 1280px, the seven columns on Chinese pages, the six of drawing E1 on English ones. */
const ROW: Record<string, string> = { [PHONE]: '.row', [TABLET]: '.row', [WIDE]: '.row:lang(zh)' };
const EN_ROW = '.row:lang(en)';
/** The English wide row's tracks in ch, ex and cap, where the browser has the cap unit. */
const CAP = '(min-width: 1280px) @supports (width: 1cap)';
/** The English wide row's track lists: in ch alone (any browser), then in ch, ex and cap (with the cap unit). */
const enTrackDeclarations = () => [rule(WIDE, EN_ROW), rule(CAP, EN_ROW)].map(d => d['grid-template-columns']);
const rule = (media: string, selector: string): Declarations => sheet[media]?.[selector] ?? {};
const allRules = () => Object.entries(sheet).flatMap(([media, rules]) => Object.entries(rules).map(([selector, d]) => ({ media, selector, d })));
const SEVEN = ['tag', 'days', 'region', 'route', 'dates', 'price', 'actions'];
/** grid-template-areas as rows of names. */
const areaGrid = (value: string) => [...value.matchAll(/'([^']*)'/g)].map(m => m[1].trim().split(/\s+/));
/** A track list split at its top-level spaces: 'max-content minmax(0, 1fr) 210px' → three tracks. */
function trackList(value: string): string[] {
  const out: string[] = [];
  let depth = 0, current = '';
  for (const ch of value) {
    depth += ch === '(' ? 1 : ch === ')' ? -1 : 0;
    if (ch === ' ' && depth === 0) { if (current) out.push(current); current = ''; } else current += ch;
  }
  return current ? [...out, current] : out;
}
const withVars = (value: string, vars: Declarations) => value.replace(/var\((--[\w-]+)\)/g, (_, name: string) => vars[name] ?? name);
const px = (value: string | undefined) => Number(/^(\d+(?:\.\d+)?)px$/.exec(value ?? '')?.[1] ?? Number.NaN);

let user: ReturnType<typeof userEvent.setup>;
beforeEach(() => { user = userEvent.setup(); window.sessionStorage.clear(); resetOpenedCache(); window.localStorage.clear(); resetSavedCache(); });
afterEach(() => { vi.restoreAllMocks(); });

describe('what a row shows, column by column', () => {
  it('the operator, the days, the region, the route, the dates, the price and its change, the buttons', () => {
    render(<TourCard {...props} onAdd={vi.fn()} />);
    const row = cells();
    expect(row).toHaveLength(7);
    expect(row[0]).toHaveTextContent('東瀛遊');
    expect(row[1]).toHaveTextContent(/^5日$/); // the days only: the nights are in the link's name
    expect(row[2]).toHaveTextContent(/^日本 · 關西$/);
    expect(within(row[3]).getByRole('heading')).toHaveTextContent('大阪 → 京都 → 奈良 → 神戶');
    expect(within(row[4]).getAllByRole('link')).toHaveLength(6);
    expect(within(row[5]).getByText(/HK\$7,999/, priceDiv)).toHaveTextContent('HK$7,999 起');
    expect(within(row[5]).getByText('↓ 比7日前平 HK$500')).toBeInTheDocument();
    expect(within(row[6]).getByRole('link')).toHaveTextContent('去旅行社網站 ↗');
    expect(within(row[6]).getAllByRole('button').map(b => b.textContent)).toEqual(['加入行程 +', '收藏']);
  });

  it('no tour code and no tour name anywhere on the row (the owner wants people on the operator\'s page)', () => {
    // The loaders no longer send the name (lib/tour-row.ts); even one handed in is not drawn.
    const { container } = render(<TourCard {...props} tour={{ ...tour, title: '關西5天' } as TourRow} />);
    expect(container.textContent).not.toContain('關西5天');
    expect(container.textContent).not.toContain('KIX5');
    expect(container.querySelector('img')).toBeNull();
  });

  it('a start or end outside Hong Kong is noted under the region, and describes the link', () => {
    render(<TourCard {...props} tour={{ ...tour, start: { kind: 'other', label: '澳門' }, end: { kind: 'other', label: '珠海' } }} />);
    const note = screen.getByText('澳門出發 · 珠海解散');
    expect(note.closest('[role="cell"]')).toHaveTextContent(/^日本 · 關西/);
    expect(cardLink()).toHaveAccessibleDescription(/澳門出發 · 珠海解散/);
  });

  it('an unchanged price shows no note; a change down or up does, in its colour, in each language', () => {
    const { unmount } = render(<TourCard {...props} tour={{ ...tour, priceChange: { kind: 'same', sinceDate: '2026-11-05' } }} />);
    expect(screen.queryByText(/日前/)).toBeNull();
    expect(cardLink()).not.toHaveAttribute('aria-describedby');
    unmount();
    const up = render(<TourCard {...props} tour={{ ...tour, priceChange: { kind: 'higher', diffHkd: 2000, sinceDate: '2026-11-05' } }} />);
    expect(screen.getByText('↑ 比7日前貴 HK$2,000').className).toMatch(/up/);
    up.unmount();
    const en = render(<TourCard {...props} t={makeT('en')} />);
    expect(screen.getByText('↓ HK$500 less than 7 days ago').className).toMatch(/down/);
    en.unmount();
    render(<TourCard {...props} t={makeT('zh-Hans')} />);
    expect(screen.getByText('↓ 比7天前便宜 HK$500')).toBeInTheDocument();
  });

  it('in English the change may take two lines, breaking only between "less" (or "more") and "than … ago" (drawing E1)', () => {
    const { unmount } = render(<TourCard {...props} t={makeT('en')} />);
    const down = screen.getByText(/^↓/).textContent!;
    // One ordinary space, the only place a line may break; every other space is a no-break space.
    expect(down.split(' ')).toEqual(['↓\u00a0HK$500\u00a0less', 'than\u00a07\u00a0days\u00a0ago']);
    unmount();
    render(<TourCard {...props} t={makeT('en')} tour={{ ...tour, priceChange: { kind: 'higher', diffHkd: 12300, sinceDate: '2026-11-11' } }} />);
    expect(screen.getByText(/^↑/).textContent!.split(' ')).toEqual(['↑\u00a0HK$12,300\u00a0more', 'than\u00a01\u00a0day\u00a0ago']);
    // English lets the note wrap there; Chinese keeps it to one line.
    expect(rule(PHONE, '.delta:lang(en)')).toEqual({ 'white-space': 'normal' });
    expect(rule(PHONE, '.delta')['white-space']).toBe('nowrap');
  });

  it('hides the price change when the window price differs from the from-price', () => {
    render(<TourCard {...props} tour={{ ...tour, windowPriceHkd: 8999 }} />);
    expect(screen.queryByText(/比7日前/)).toBeNull();
    expect(screen.getByText(/HK\$8,999/, priceDiv)).toBeInTheDocument();
  });

  it('a note (the chain page\'s rest) goes under the region, where the column has room', () => {
    render(<TourCard {...props} footNote="休息 1–2 日後出發" />);
    expect(screen.getByText('休息 1–2 日後出發').closest('[role="cell"]')).toHaveTextContent(/^日本 · 關西休息 1–2 日後出發$/);
  });

  it('the price and its "from" are one unit: 起 always after the figure, "from" always before it, never on a line of their own', () => {
    const { unmount } = render(<TourCard {...props} t={makeT('en')} tour={{ ...tour, windowPriceHkd: 999999, fromPriceHkd: 999999 }} />);
    const en = screen.getByText(/HK\$999,999/, priceDiv);
    expect(en).toHaveTextContent(/^from HK\$999,999$/);
    expect(en.firstElementChild).toHaveTextContent('from');
    unmount();
    render(<TourCard {...props} />);
    expect(screen.getByText(/HK\$7,999/, priceDiv).lastElementChild).toHaveTextContent('起');
    expect(rule(PHONE, '.price')['white-space']).toBe('nowrap');
  });
});

describe('the region: the country, then its regions (or the countries), at most five names, then +N', () => {
  it('each name is one unit with its dot; units are separated by plain spaces, the only places a line may break', () => {
    const { container } = render(<TourCard {...props} />);
    const units = [...cells()[2].querySelectorAll(`.${styles.place}`)];
    expect(units.map(u => u.textContent)).toEqual(['日本 ·', '關西']);
    expect(units[1].previousSibling?.textContent).toBe(' ');
    expect(container.querySelectorAll(`.${styles.place}`)).toHaveLength(2);
  });

  it('more than five: the count of the rest goes in the last unit, with no dot before it ("摩洛哥 +2"), in every language', () => {
    const { unmount } = render(<TourCard {...props} tour={{ ...tour, stops: sevenCountries }} />);
    expect(cells()[2]).toHaveTextContent(/^阿根廷 · 巴西 · 秘魯 · 智利 · 摩洛哥 \+2$/);
    const last = () => [...cells()[2].querySelectorAll(`.${styles.place}`)].at(-1)!;
    expect(last().textContent).toBe('摩洛哥 +2');
    unmount();
    const en = render(<TourCard {...props} tour={{ ...tour, stops: sevenCountries }} t={makeT('en')} />);
    expect(last().textContent).toBe('Morocco +2');
    expect(cells()[2]).toHaveTextContent(/^Argentina · Brazil · Peru · Chile · Morocco \+2$/);
    en.unmount();
    render(<TourCard {...props} tour={{ ...tour, stops: sevenCountries }} t={makeT('zh-Hans')} />);
    expect(last().textContent).toBe('摩洛哥 +2');
    expect(cells()[2].textContent).not.toMatch(/·\s*\+/);
  });

  it('the wrapping rule: a Chinese name never breaks; an English name may wrap between its own words; nothing breaks inside a word to fit', () => {
    // A unit is kept whole (inline-block, never wider than the column).
    expect(rule(PHONE, '.place')).toMatchObject({ display: 'inline-block', 'max-width': '100%', 'white-space': 'nowrap' });
    // English only: between the words of one name ('Bosnia and Herzegovina'). The page's language picks it.
    expect(rule(PHONE, '.region:lang(en) .place')).toEqual({ 'white-space': 'normal' });
    // No word is ever broken: nothing in the rows sets overflow-wrap, word-break or hyphens (the site-wide check is
    // lib/word-breaks.test.ts).
    for (const { selector, d } of allRules()) {
      expect(d, selector).not.toHaveProperty('overflow-wrap');
      expect(d, selector).not.toHaveProperty('word-break');
      expect(d, selector).not.toHaveProperty('hyphens');
    }
  });
});

describe('the route', () => {
  const eleven = ['osaka', 'kyoto', 'nara', 'kobe', 'osaka', 'kyoto', 'nara', 'kobe', 'osaka', 'kyoto', 'nara'];

  it('every stop, never cut, wrapping onto as many lines as it needs', () => {
    render(<TourCard {...props} tour={{ ...tour, stops: eleven.map(c => kansai(`japan-kansai-${c}`)) }} />);
    expect(screen.getByRole('heading')).toHaveTextContent('大阪 → 京都 → 奈良 → 神戶 → 大阪 → 京都 → 奈良 → 神戶 → 大阪 → 京都 → 奈良');
    expect(cardLink()).toHaveAccessibleName(/大阪、京都、奈良、神戶、大阪、京都、奈良、神戶、大阪、京都、奈良/);
    // Nothing on the route or its cell can hide a stop.
    for (const selector of ['.route', '.routeCell', '.stop']) {
      for (const media of [PHONE, TABLET, WIDE]) {
        expect(rule(media, selector), selector).not.toHaveProperty('overflow');
        expect(rule(media, selector), selector).not.toHaveProperty('text-overflow');
        expect(rule(media, selector), selector).not.toHaveProperty('-webkit-line-clamp');
        expect(rule(media, selector)['white-space'], selector).toBeUndefined();
      }
    }
  });

  it('in Chinese each stop\'s name is one unit, the arrows between them: a line breaks only beside an arrow, never inside a name ("聖 / 地牙哥")', () => {
    render(<TourCard {...props} tour={{ ...tour, stops: eleven.map(c => kansai(`japan-kansai-${c}`)) }} />);
    const heading = screen.getByRole('heading');
    const stops = [...heading.querySelectorAll(`.${styles.stop}`)];
    expect(stops.map(s => s.textContent)).toEqual(eleven.map((_, i) => ['大阪', '京都', '奈良', '神戶'][i % 4]));
    // Name, arrow, name, …: the arrow with a plain space on each side (where the line may break), nothing else.
    expect([...heading.children].map(el => (el.classList.contains(styles.stop) ? 'stop' : el.textContent))).toEqual(
      eleven.flatMap((_, i) => (i === 0 ? ['stop'] : [' → ', 'stop'])),
    );
    expect(heading.childNodes).toHaveLength(eleven.length * 2 - 1);
    // A name wider than the whole column wraps between its words, never inside one.
    expect(rule(PHONE, '.stop')).toEqual({ display: 'inline-block', 'max-width': '100%' });
  });

  it('in English, in the wide row, each "place →" is one unit: the arrow is drawn at the end of the name before it (drawing E1)', () => {
    render(<TourCard {...props} t={makeT('en')} />);
    const heading = screen.getByRole('heading');
    expect(heading).toHaveTextContent('Osaka → Kyoto → Nara → Kobe');
    // In the text once, between the names: a plain space, the arrow in its own element, a plain space. The block
    // layouts break the route there, as on Chinese pages.
    const between = [...heading.children].filter(el => !el.classList.contains(styles.stop));
    expect(between).toHaveLength(3);
    for (const el of between) {
      expect([...el.childNodes].map(n => (n instanceof Element ? n.className : n.textContent))).toEqual([' ', styles.arrowBetween, ' ']);
    }
    // The wide row hides that arrow (its spaces stay: a line may break there, after the arrow) and draws it at the end
    // of the name before it, after a no-break space, so it never starts a line.
    expect(rule(WIDE, '.arrowBetween:lang(en)')).toEqual({ display: 'none' });
    expect(rule(WIDE, '.stop:lang(en):not(:last-child)::after')).toEqual({ content: "'\\a0→'", 'font-weight': '400', color: 'var(--text-muted)' });
    expect(rule(PHONE, '.arrow')).toEqual({ 'font-weight': '400', color: 'var(--text-muted)' });
  });

  it('in English, the route joined with the dictionary separator in the link\'s name; on screen the arrows', () => {
    render(<TourCard {...props} t={makeT('en')} />);
    expect(screen.getByRole('heading')).toHaveTextContent('Osaka → Kyoto → Nara → Kobe');
    expect(screen.getByRole('link', { name: /^EGL Tours/ })).toHaveAccessibleName('EGL Tours: Osaka, Kyoto, Nara, Kobe, 5 days, 4 nights, from HK$7,999');
    // English pages name the operator in English only, on the tag too.
    expect(cells()[0]).toHaveTextContent(/^EGL Tours$/);
  });
});

describe('the dates: three by two, the same on every row', () => {
  it('six or fewer: all of them, each with its weekday (in brackets in Chinese); the chips leave the year out, the names keep it', () => {
    render(<TourCard {...props} />);
    expect(DATE_CELLS).toBe(6);
    expect(dateLinks().map(a => a.querySelector('span')!.textContent)).toEqual(['12/18 (五)', '12/20 (日)', '12/23 (三)', '12/27 (日)', '12/30 (三)', '1/3 (日)']);
    expect(dateLinks().map(a => a.getAttribute('aria-label'))).toEqual([
      '2026年12月18日（五） HK$7,999', '2026年12月20日（日） HK$8,299', '2026年12月23日（三） HK$8,299',
      '2026年12月27日（日） HK$7,499 起', '2026年12月30日（三） HK$9,999', '2027年1月3日（日） HK$8,999',
    ]);
    expect(screen.queryByText(/個$/)).toBeNull();
  });

  it('in Simplified Chinese the chips bracket the weekday too, and the names say 周', () => {
    render(<TourCard {...props} t={makeT('zh-Hans')} />);
    const links = within(screen.getByRole('group', { name: '出发日期' })).getAllByRole('link');
    expect(links[0].querySelector('span')!.textContent).toBe('12/18 (五)');
    expect(links[0]).toHaveAccessibleName('2026年12月18日（周五） HK$7,999');
  });

  it('more than six: five dates, and the sixth cell counts the rest ("+3 個" on screen, "+3 個出發日" read out)', () => {
    render(<TourCard {...props} tour={eight} />);
    expect(dateLinks()).toHaveLength(5);
    expect(screen.getByText('+3 個')).toHaveAttribute('aria-hidden', 'true');
    expect(screen.getByText('+3 個出發日')).toBeInTheDocument();
    expect(screen.getByText('+3 個').closest('a')).toBeNull(); // plain text, not a link
  });

  it('the grid: three equal columns; every chip as wide as its column, its text centred and on one line', () => {
    expect(rule(PHONE, '.dates')['grid-template-columns']).toBe('repeat(3, minmax(0, 1fr))');
    expect(rule(PHONE, '.chip')).toMatchObject({ width: '100%', 'text-align': 'center', 'white-space': 'nowrap' });
  });

  it('each date is a link to the operator\'s page in a new tab; a date without its own price shows the stored from-price with 起', () => {
    render(<TourCard {...props} />);
    for (const a of dateLinks()) {
      expect(a).toHaveAttribute('href', tour.url);
      expect(a).toHaveAttribute('target', '_blank');
      expect(a).toHaveAttribute('rel', expect.stringContaining('noopener'));
    }
    // fallbackPriceHkd (7,499): the same figure the picker shows for that date, not the row's window price.
    expect(dateLinks()[3]).toHaveTextContent('HK$7,499 起');
  });

  it('in English: day first, a three-letter weekday, and "from" before a from-price', () => {
    render(<TourCard {...props} t={makeT('en')} />);
    const links = within(screen.getByRole('group', { name: 'Departure dates' })).getAllByRole('link');
    expect(links.map(a => a.querySelector('span')!.textContent)).toEqual(['18 Dec Fri', '20 Dec Sun', '23 Dec Wed', '27 Dec Sun', '30 Dec Wed', '3 Jan Sun']);
    expect(links[3]).toHaveAccessibleName('Sun 27 Dec 2026 from HK$7,499');
  });

  it('in English the sixth cell reads "+3 more"; in Simplified Chinese "+3 个"', () => {
    const { unmount } = render(<TourCard {...props} tour={eight} t={makeT('en')} />);
    expect(screen.getByText('+3 more')).toBeInTheDocument();
    unmount();
    render(<TourCard {...props} tour={eight} t={makeT('zh-Hans')} />);
    expect(screen.getByText('+3 个')).toBeInTheDocument();
  });

  it('the dates are one tab stop, before the row link and the add button (the order they are drawn in); the arrow keys move between them', async () => {
    render(<TourCard {...props} onAdd={vi.fn()} />);
    await user.tab();
    const links = dateLinks();
    expect(links[0]).toHaveFocus();
    expect(links.map(a => a.tabIndex)).toEqual([0, -1, -1, -1, -1, -1]);
    await user.keyboard('{ArrowRight}');
    expect(links[1]).toHaveFocus();
    await user.keyboard('{End}');
    expect(links[5]).toHaveFocus();
    await user.keyboard('{ArrowRight}'); // stays on the last
    expect(links[5]).toHaveFocus();
    await user.keyboard('{ArrowLeft}');
    expect(links[4]).toHaveFocus();
    expect(links.map(a => a.tabIndex)).toEqual([-1, -1, -1, -1, 0, -1]); // Tab comes back to the date last visited
    await user.keyboard('{Home}');
    expect(links[0]).toHaveFocus();
    await user.tab();
    expect(cardLink()).toHaveFocus();
    await user.tab();
    expect(screen.getByRole('button', { name: '加入行程 +' })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole('button', { name: /^收藏/ })).toHaveFocus();
  });

  it('a mouse (or pen) over a date shows its price; leaving hides it; a finger does not', () => {
    render(<TourCard {...props} />);
    const link = dateLinks()[1];
    fireEvent.pointerEnter(link, { pointerType: 'mouse' });
    expect(link).toHaveAttribute('data-hover');
    fireEvent.pointerLeave(link, { pointerType: 'mouse' });
    expect(link).not.toHaveAttribute('data-hover');
    fireEvent.pointerEnter(link, { pointerType: 'pen' });
    expect(link).toHaveAttribute('data-hover');
    fireEvent.pointerEnter(dateLinks()[2], { pointerType: 'touch' });
    expect(dateLinks()[2]).not.toHaveAttribute('data-hover');
  });

  it('a row without an https address: the dates are plain text, not links and not tab stops; a mouse still shows the price', async () => {
    render(<TourCard {...props} tour={{ ...tour, url: 'http://example.com' }} />);
    expect(screen.queryByRole('link')).toBeNull();
    const chip = screen.getByText('12/18', { exact: false }).parentElement!;
    expect(chip).not.toHaveAttribute('tabindex');
    await user.tab();
    // No date or link to stop at: the first tab stop is 收藏 (no add button here).
    expect(screen.getByRole('button', { name: /^收藏/ })).toHaveFocus();
    expect(chip).toHaveTextContent('12/18 (五) HK$7,999'); // screen readers still read the price with the date
    fireEvent.pointerEnter(chip, { pointerType: 'mouse' });
    expect(chip).toHaveAttribute('data-hover');
  });

  it('keeps a tooltip inside the window: shifts it left or right by what would overflow', () => {
    expect(shiftIntoView(100, 200, 1000)).toBe(0);
    expect(shiftIntoView(-30, 70, 1000)).toBe(38); // 8px margin from the left edge
    expect(shiftIntoView(950, 1050, 1000)).toBe(-58);
    expect(shiftIntoView(0, 1200, 1000)).toBe(8); // wider than the window: keep its start visible
  });

  it('measures the tooltip as it will show, not as the hidden box, when a mouse enters or the date takes focus', () => {
    // A stand-in for the browser: the hidden tooltip measures 16px unless its shown geometry applies while measured.
    const layOut = (tip: HTMLElement, shown: { left: number; right: number }) => {
      tip.getBoundingClientRect = () => (tip.hasAttribute('data-measure')
        ? { left: shown.left, right: shown.right }
        : { left: (shown.left + shown.right) / 2 - 8, right: (shown.left + shown.right) / 2 + 8 }) as DOMRect;
    };
    render(<TourCard {...props} />);
    const [first, second] = dateLinks();
    const tip = first.lastElementChild as HTMLElement;
    layOut(tip, { left: -20, right: 90 });
    fireEvent.pointerEnter(first, { pointerType: 'mouse' });
    expect(tip.style.getPropertyValue('--tip-shift')).toBe('28px');
    expect(tip).not.toHaveAttribute('data-measure');
    const tip2 = second.lastElementChild as HTMLElement;
    layOut(tip2, { left: window.innerWidth - 50, right: window.innerWidth + 40 });
    fireEvent.focus(second);
    expect(tip2.style.getPropertyValue('--tip-shift')).toBe('-48px');
  });

  it('the price shows for a mouse (data-hover), on keyboard focus (:focus-visible, not a tap\'s :focus) and while measured, out of the layout', () => {
    expect(rule(PHONE, '.tip')).toMatchObject({ position: 'absolute', bottom: 'calc(100% + 6px)' });
    for (const selector of ['.d[data-hover] .tip', '.d:focus-visible .tip', '.tip[data-measure]']) {
      expect(rule(PHONE, selector), selector).toMatchObject({ 'clip-path': 'none' });
    }
    // Never on :hover or :focus alone: a finger's tap sets both and would leave the price stuck on screen. No
    // pressed look either: the dates are information, not buttons.
    for (const { selector } of allRules()) {
      expect(selector).not.toMatch(/:hover \.tip|:focus \.tip|\.d:active/);
    }
  });

  it('a departure with a bad date is left out of the dates and the picker', async () => {
    const departures = [{ date: '2026-12-32' as IsoDate, priceHkd: 7999 }, ...tour.departures.slice(0, 2)];
    render(<TourCard {...props} tour={{ ...tour, departures }} onAdd={vi.fn()} />);
    expect(dateLinks()).toHaveLength(2);
    expect(screen.queryByText(/NaN|12\/32/)).toBeNull();
    await user.click(screen.getByRole('button', { name: '加入行程 +' }));
    expect(screen.getByRole('dialog').querySelectorAll('li')).toHaveLength(2);
  });
});

describe('an operator whose data is old', () => {
  // The operator's last good run: 19:10 UTC on 11 Nov (03:10 on 12 Nov in Hong Kong).
  it('more than 36 hours later, a tag 資料為 and that day: beside the operator in the block layouts, under the price in the seven columns; it describes the link', () => {
    render(<TourCard {...props} now="2026-11-13T07:11:00Z" />);
    const [inTag, inPrice] = screen.getAllByText('資料為 11月12日');
    // Never in the route's cell, where it would push a long route down.
    expect(within(cells()[3]).queryByText(/資料為/)).toBeNull();
    expect(cells()[0]).toContainElement(inTag);
    expect(inTag).toHaveClass(styles.staleInTag);
    // Under the price and its note: the last thing in the price cell.
    expect(cells()[5].lastElementChild).toBe(inPrice);
    expect(inPrice).toHaveClass(styles.staleInPrice);
    expect(cardLink()).toHaveAccessibleDescription(/資料為 11月12日/);
  });

  it('each layout shows exactly one of the two: the one beside the operator until the seven columns, then the one under the price, right-aligned', () => {
    expect(rule(PHONE, '.stale')).toMatchObject({ display: 'block', 'white-space': 'nowrap' });
    expect(rule(PHONE, '.staleInPrice')).toEqual({ display: 'none' });
    expect(rule(PHONE, '.tagCell')).toMatchObject({ display: 'flex', 'flex-wrap': 'wrap' });
    expect(rule(TABLET, '.staleInPrice')).toEqual({});
    expect(rule(WIDE, '.staleInTag:lang(zh)')).toEqual({ display: 'none' });
    expect(rule(WIDE, '.staleInPrice:lang(zh)')).toEqual({ display: 'block', margin: '4px 0 0 auto' });
    // Price (21px × 1.35), note (12px × 1.4) and the tag (4px + 12px × 1.4 + its 2px border) fit the content height
    // of the least row, so the tag never makes a row taller.
    const content = px(rule(WIDE, ROW[WIDE])['min-height']) - 2 * Number(/^(\d+)px/.exec(rule(WIDE, ROW[WIDE]).padding)![1]);
    expect(21 * 1.35 + 12 * 1.4 + (4 + 12 * 1.4 + 2)).toBeLessThanOrEqual(content);
    // English, from 1280px (drawing E1): the same, under 'from HK$…' and its note in two lines.
    expect(rule(WIDE, '.staleInTag:lang(en)')).toEqual({ display: 'none' });
    expect(rule(WIDE, '.staleInPrice:lang(en)')).toEqual({ display: 'block', margin: '3px 0 0 auto', 'line-height': '1.3' });
    const en = rule(WIDE, EN_ROW);
    const enContent = px(en['min-height']) - 2 * Number(/^(\d+)px/.exec(en.padding)![1]);
    const lh = (selector: string) => Number(rule(WIDE, selector)['line-height']);
    expect(21 * lh('.price:lang(en)') + 2 * 12 * lh('.delta:lang(en)') + (3 + 12 * lh('.staleInPrice:lang(en)') + 2)).toBeLessThanOrEqual(enContent);
  });

  it('within 36 hours, or without the render\'s time, or with an unreadable time: nothing', () => {
    const { unmount } = render(<TourCard {...props} now="2026-11-13T07:09:00Z" />);
    expect(screen.queryByText(/資料為/)).toBeNull();
    unmount();
    const second = render(<TourCard {...props} />);
    expect(screen.queryByText(/資料為/)).toBeNull();
    second.unmount();
    render(<TourCard {...props} tour={{ ...tour, lastUpdated: 'garbage' }} now="2026-11-20T00:00:00Z" />);
    expect(screen.queryByText(/資料為/)).toBeNull();
  });

  it('in the other languages', () => {
    const { unmount } = render(<TourCard {...props} t={makeT('en')} now="2026-11-14T00:00:00Z" />);
    expect(screen.getAllByText('Data from 12 Nov')).toHaveLength(2);
    unmount();
    render(<TourCard {...props} t={makeT('zh-Hans')} now="2026-11-14T00:00:00Z" />);
    expect(screen.getAllByText('数据为 11月12日')).toHaveLength(2);
  });
});

describe('rows opened this session are tinted', () => {
  const row = () => screen.getAllByRole('row')[0];
  const other: TourRow = { ...tour, key: 'jetour:OSA6', url: 'https://example.test/jetour/OSA6' };
  const jetour: OperatorInfo = { ...operator, id: 'jetour', nameZh: '捷旅', nameEn: 'Jetour', color: '#ee7b06' };
  const two = () => render(<><TourCard {...props} onAdd={vi.fn()} /><TourCard {...props} tour={other} operator={jetour} /></>);
  const rows = () => screen.getAllByRole('row');

  it('an unopened row has no mark and the gold button', () => {
    render(<TourCard {...props} />);
    expect(row()).not.toHaveAttribute('data-opened');
    expect(cardLink()).toHaveTextContent('去旅行社網站 ↗');
    expect(cardLink()).not.toHaveAccessibleDescription(/看過|打開/);
  });

  it('opening the operator\'s page from the row link makes it the last opened: no tag on screen, 上次打開 read out, and 再看一次', async () => {
    render(<TourCard {...props} />);
    await user.click(cardLink());
    expect(row()).toHaveAttribute('data-opened', 'latest');
    expect(cardLink()).toHaveAccessibleDescription(/上次打開/);
    expect(screen.getByText('上次打開').className).toMatch(/visuallyHidden/);
    expect(cardLink()).toHaveTextContent('再看一次 ↗');
    // Its name (operator, route, length, price) is unchanged.
    expect(cardLink()).toHaveAccessibleName('東瀛遊：大阪、京都、奈良、神戶，5日4夜，HK$7,999起');
    expect(JSON.parse(window.sessionStorage.getItem(OPENED_KEY)!)).toEqual(['egl:KIX5']);
  });

  it('opening it from a date counts too; so do a middle click and Enter; a right click does not', async () => {
    const { unmount } = render(<TourCard {...props} />);
    await user.click(dateLinks()[1]);
    expect(row()).toHaveAttribute('data-opened', 'latest');
    unmount(); window.sessionStorage.clear(); resetOpenedCache();
    const middle = render(<TourCard {...props} />);
    fireEvent(cardLink(), new MouseEvent('auxclick', { bubbles: true, button: 2 }));
    expect(row()).not.toHaveAttribute('data-opened');
    fireEvent(cardLink(), new MouseEvent('auxclick', { bubbles: true, button: 1 }));
    expect(row()).toHaveAttribute('data-opened', 'latest');
    middle.unmount(); window.sessionStorage.clear(); resetOpenedCache();
    render(<TourCard {...props} />);
    await user.tab(); // the dates
    await user.tab(); // the row link
    await user.keyboard('{Enter}');
    expect(row()).toHaveAttribute('data-opened', 'latest');
  });

  it('the click itself is left alone: not prevented, so the browser opens the page in a new tab as before', () => {
    render(<TourCard {...props} />);
    const click = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 });
    const prevent = vi.spyOn(click, 'preventDefault');
    const stop = vi.spyOn(click, 'stopPropagation');
    act(() => { cardLink().dispatchEvent(click); });
    expect(prevent).not.toHaveBeenCalled();
    expect(stop).not.toHaveBeenCalled();
    expect(click.defaultPrevented).toBe(false);
    expect(row()).toHaveAttribute('data-opened', 'latest');
    expect(cardLink()).toHaveAttribute('target', '_blank');
  });

  it('adding the tour to a trip (加入行程 and the picker) does not count', async () => {
    render(<TourCard {...props} onAdd={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: '加入行程 +' }));
    await user.click(screen.getByRole('button', { name: /2026年12月18日/ }));
    expect(row()).not.toHaveAttribute('data-opened');
  });

  it('exactly one row is the last opened: opening another makes the first "viewed"; both offer 再看一次', async () => {
    two();
    await user.click(screen.getByRole('link', { name: /^東瀛遊/ }));
    await user.click(screen.getByRole('link', { name: /^捷旅/ }));
    expect(rows().map(c => c.getAttribute('data-opened'))).toEqual(['earlier', 'latest']);
    expect(screen.getByRole('link', { name: /^東瀛遊/ })).toHaveAccessibleDescription(/已看過/);
    expect(screen.getByRole('link', { name: /^捷旅/ })).toHaveAccessibleDescription(/上次打開/);
    expect(screen.getAllByRole('link', { name: /^(東瀛遊|捷旅)/ }).map(a => a.textContent)).toEqual(['再看一次 ↗', '再看一次 ↗']);
    await user.click(screen.getByRole('link', { name: /^東瀛遊/ }));
    expect(rows().map(c => c.getAttribute('data-opened'))).toEqual(['latest', 'earlier']);
  });

  it('the marks survive a re-render from scratch (another page, a language or theme change, a reload), in that language', async () => {
    const { unmount } = two();
    await user.click(screen.getByRole('link', { name: /^東瀛遊/ }));
    await user.click(screen.getByRole('link', { name: /^捷旅/ }));
    unmount();
    resetOpenedCache(); // as after a reload: read again from sessionStorage
    render(<><TourCard {...props} t={makeT('en')} /><TourCard {...props} tour={other} operator={jetour} t={makeT('en')} /></>);
    expect(rows().map(c => c.getAttribute('data-opened'))).toEqual(['earlier', 'latest']);
    expect(screen.getByText('Viewed')).toBeInTheDocument();
    expect(screen.getByText('Last opened')).toBeInTheDocument();
    expect(screen.getAllByText('View again ↗')).toHaveLength(2);
  });

  it('in Simplified Chinese', async () => {
    render(<TourCard {...props} t={makeT('zh-Hans')} />);
    await user.click(screen.getByRole('link', { name: /^東瀛遊/ }));
    expect(screen.getByText('上次打开')).toBeInTheDocument();
    expect(cardLink()).toHaveTextContent('再看一次 ↗');
  });

  it('with storage blocked: the click still opens the page and nothing is marked, as before', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new DOMException('blocked', 'SecurityError'); });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('blocked', 'SecurityError'); });
    render(<TourCard {...props} />);
    await user.click(cardLink());
    expect(row()).not.toHaveAttribute('data-opened');
    expect(cardLink()).toHaveTextContent('去旅行社網站 ↗');
    expect(cardLink()).toHaveAttribute('href', tour.url);
  });

  it('the server renders no mark (it cannot know); marks appear after hydration without a mismatch warning', async () => {
    window.sessionStorage.setItem(OPENED_KEY, JSON.stringify(['egl:KIX5']));
    const html = renderToString(<TourCard {...props} now="2026-11-13T00:00:00Z" />);
    expect(html).not.toContain('data-opened');
    await hydrated(<TourCard {...props} now="2026-11-13T00:00:00Z" />, (container, errors) => {
      expect(errors).not.toHaveBeenCalled();
      expect(container.querySelector('[role="row"]')).toHaveAttribute('data-opened', 'latest');
    });
  });

  it('the tints change colours only: the row\'s background, the chips on the surface, the button outlined; no tag, no greyed text, no size', () => {
    expect(rule(PHONE, ".row[data-opened='earlier']")).toEqual({ background: 'var(--viewed-bg)' });
    expect(rule(PHONE, ".row[data-opened='latest']")).toEqual({ background: 'var(--latest-bg)' });
    expect(rule(PHONE, '.row[data-opened] .chip')).toEqual({ background: 'var(--surface)' });
    expect(rule(PHONE, '.row[data-opened] .go')).toEqual({ background: 'var(--surface)', 'border-color': 'var(--ink)', color: 'var(--ink)' });
    const opened = allRules().filter(r => r.selector.includes('[data-opened'));
    expect(opened).toHaveLength(4);
    for (const { selector, d } of opened) {
      for (const [property, value] of Object.entries(d)) {
        expect(['background', 'border-color', 'color'], `${selector} ${property}`).toContain(property);
        expect(value, selector).not.toMatch(/text-muted/);
      }
    }
  });
});

describe('three layouts, switched by the window\'s width', () => {
  /** Where each of the seven cells sits in a layout's grid: each must be one rectangle. */
  function placements(media: string, row = ROW[media]) {
    const grid = areaGrid(rule(media, row)['grid-template-areas']);
    const at: Record<string, { rows: Set<number>; cols: Set<number>; count: number }> = {};
    grid.forEach((line, r) => line.forEach((name, c) => {
      const p = (at[name] ??= { rows: new Set(), cols: new Set(), count: 0 });
      p.rows.add(r); p.cols.add(c); p.count++;
    }));
    return { grid, at };
  }

  it('below 640px a block; from 640px two columns; from 1280px one aligned row: seven columns in Chinese, six in English with the region above the route', () => {
    expect(Object.keys(sheet)).toEqual([PHONE, ZOOMED, TABLET, WIDE, CAP]);
    expect(placements(PHONE).grid[0]).toHaveLength(2);
    expect(placements(TABLET).grid[0]).toHaveLength(3);
    expect(placements(WIDE).grid).toEqual([SEVEN]);
    // The drawing E1: the region over the route in one column; every other cell spans both lines.
    expect(placements(WIDE, EN_ROW).grid).toEqual([
      ['tag', 'days', 'region', 'dates', 'price', 'actions'],
      ['tag', 'days', 'route', 'dates', 'price', 'actions'],
    ]);
  });

  it('every layout places each of the seven cells exactly once, as one rectangle, with as many tracks as its areas have columns', () => {
    for (const [media, selector] of [[PHONE, ROW[PHONE]], [TABLET, ROW[TABLET]], [WIDE, ROW[WIDE]], [WIDE, EN_ROW]]) {
      const { grid, at } = placements(media, selector);
      expect(grid.every(line => line.length === grid[0].length), media).toBe(true);
      expect(Object.keys(at).sort(), media).toEqual([...SEVEN].sort());
      for (const [name, p] of Object.entries(at)) {
        const rows = [...p.rows], cols = [...p.cols];
        expect(Math.max(...rows) - Math.min(...rows) + 1, `${media} ${name}`).toBe(rows.length);
        expect(Math.max(...cols) - Math.min(...cols) + 1, `${media} ${name}`).toBe(cols.length);
        expect(p.count, `${media} ${name}`).toBe(rows.length * cols.length);
      }
      const row = rule(media, selector);
      expect(trackList(withVars(row['grid-template-columns'], row)), media).toHaveLength(grid[0].length);
    }
  });

  it('each cell is placed by its own area name, in the order a screen reader reads them', () => {
    render(<TourCard {...props} onAdd={vi.fn()} />);
    const placedBy = (area: string) => Object.entries(sheet[PHONE]).find(([, d]) => d['grid-area'] === area)![0].slice(1);
    SEVEN.forEach((area, i) => expect(cells()[i], area).toHaveClass(styles[placedBy(area)]));
  });

  it('on a phone: the operator and the days, then the price, the region, the route, the dates and the buttons, each button at most 360px', () => {
    expect(placements(PHONE).grid.map(line => [...new Set(line)].join(' '))).toEqual(['tag days', 'price', 'region', 'route', 'dates', 'actions']);
    expect(px(rule(PHONE, '.actions > *')['max-width'])).toBeLessThanOrEqual(360);
    expect(px(rule(PHONE, '.dates')['max-width'])).toBeLessThanOrEqual(360);
  });

  it('on a tablet: the facts on the left; the price and the buttons stacked in a right-hand column of at most 360px', () => {
    const { grid } = placements(TABLET);
    expect(grid.map(line => line.at(-1))).toEqual(['price', 'price', 'actions', 'actions']);
    expect(grid.flatMap(line => line.slice(0, -1))).not.toContain('price');
    const right = trackList(rule(TABLET, '.row')['grid-template-columns']).at(-1);
    expect(px(right)).toBeLessThanOrEqual(360);
    expect(rule(TABLET, '.actions')['flex-direction']).toBe('column');
  });

  it('from 1280px, on Chinese pages: the same seven tracks on every row; only the route flexes', () => {
    const row = rule(WIDE, ROW[WIDE]);
    const zh = trackList(withVars(row['grid-template-columns'], row));
    expect(zh).toHaveLength(7);
    expect(zh[SEVEN.indexOf('route')]).toBe('minmax(0, 1fr)');
    // The actions track is the owner's drawing's 182px (RowsB13): wide enough for 加入行程 + and 收藏 as two equal
    // buttons with 8px inside each, measured in the browser.
    expect(zh[SEVEN.indexOf('actions')]).toBe('182px');
    expect(zh.filter((_, i) => i !== SEVEN.indexOf('route')).every(track => px(track) > 0)).toBe(true);
    // The tracks are the row's alone (the dates' own grid is inside their cell): nothing a row holds can change them,
    // so every row has the same ones.
    const setters = allRules().filter(({ d }) => 'grid-template-columns' in d || Object.keys(d).some(p => p.startsWith('--col-')));
    expect(setters.map(r => `${r.media} ${r.selector}`)).toEqual([' .row', ' .dates', `${ZOOMED} .dates`, `${TABLET} .row`, `${WIDE} .row:lang(zh)`, `${WIDE} .row:lang(en)`, `${CAP} .row:lang(en)`]);
  });

  it('from 1280px, on English pages (drawing E1): six tracks, the same on every row, in the row font\'s own units with the drawing\'s px as floors', () => {
    const row = rule(WIDE, EN_ROW);
    const SIX = ['tag', 'days', 'route', 'dates', 'price', 'actions'];
    const [fallback, tracks] = enTrackDeclarations().map(trackList);
    // Each track: the drawing's px at least, else the narrowest of three lengths in the row font's units (ch, ex,
    // cap), each factor the least that holds the column's longest text in Arimo, Inter, Roboto and DejaVu Sans (+1%).
    expect(Object.fromEntries(SIX.map((name, i) => [name, tracks[i]]))).toEqual({
      tag: 'max(148px, min(15.3ch, 19.4ex, 12.4cap))',
      days: 'max(76px, min(7.8ch, 9.9ex, 6.3cap))',
      route: 'minmax(0, 1fr)',
      dates: 'max(264px, min(30.1ch, 37.9ex, 24.4cap))',
      price: 'max(164px, min(18.1ch, 23ex, 14.9cap))',
      actions: 'max(182px, min(21.3ch, 26.5ex, 17.2cap))',
    });
    // Outside @supports, for a browser without the cap unit: the same, in ch alone.
    SIX.forEach((name, i) => {
      if (name === 'route') return expect(fallback[i]).toBe('minmax(0, 1fr)');
      const [, floor, ch] = /^max\((\d+px), min\(([\d.]+ch),/.exec(tracks[i])!;
      expect(fallback[i], name).toBe(`max(${floor}, ${ch})`);
    });
    // Nothing a row holds sizes another row: the wide tracks are lengths, no content-sized track and no subgrid.
    for (const declaration of enTrackDeclarations()) expect(declaration).not.toMatch(/subgrid|max-content|min-content|fit-content|auto/);
    expect(JSON.stringify([sheet[WIDE], sheet[CAP]])).not.toMatch(/subgrid|grid-column/);
    expect(sheet[CAP]).toEqual({ '.row:lang(en)': { 'grid-template-columns': tracks.join(' ') } });
    // The region's line, then the route; the Chinese row's least height and top and bottom padding; at every wide
    // width one tighter spacing than the drawing's (16px gap, 18px sides), so the route keeps its room: a 12px gap and
    // 12px at the sides.
    expect(row).toMatchObject({ 'grid-template-rows': 'auto 1fr', 'column-gap': '12px', padding: '12px', 'min-height': '102px' });
    expect(Number.parseFloat(rule(WIDE, ROW[WIDE]).padding)).toBe(Number.parseFloat(row.padding));
    // No line before the route, unlike the Chinese row.
    expect(rule(WIDE, '.routeCell:lang(en)')).toEqual({});
  });

  it('in the English wide row the price change is as narrow as its longest unbreakable part: two lines, a column gap from the buttons', () => {
    expect(rule(WIDE, '.delta:lang(en)')).toEqual({ width: 'min-content', 'margin-left': 'auto', 'line-height': '1.25' });
    // The pair's columns are equal and never narrower than a button's words with its 8px padding.
    expect(rule(PHONE, '.add').padding).toBe('0 8px');
    expect(rule(PHONE, '.pair')).toMatchObject({ 'grid-auto-columns': '1fr' });
    // The change's right edge is the price column's: a column gap, at least 12px, from the buttons.
    expect(Number.parseFloat(rule(WIDE, EN_ROW)['column-gap'])).toBeGreaterThanOrEqual(12);
  });

  it('every wide rule is for one language: :lang(zh) (both Chinese pages) or :lang(en); no rule names another language', () => {
    const wide = Object.keys(sheet[WIDE]);
    for (const selector of wide) expect(selector).toMatch(/:lang\((zh|en)\)/);
    expect(wide.filter(s => s.includes(':lang(en)')).length).toBeGreaterThan(5);
    // :lang(zh) matches both Chinese pages (<html lang="zh-Hant-HK">, <html lang="zh-Hans">), never lang="en".
    for (const { selector } of allRules()) expect(selector).not.toMatch(/:lang\((?!zh\)|en\))/);
  });

  it('in the English wide row: the drawing E1\'s type: the operator 13px on one line; the region 14px, muted, over the route 17px', () => {
    expect(rule(WIDE, '.op:lang(en)')).toMatchObject({ 'font-size': '13px', 'white-space': 'nowrap' });
    expect(rule(WIDE, '.region:lang(en)')).toMatchObject({ 'font-size': '14px' });
    expect(rule(WIDE, '.region:lang(en) .place')).toEqual({ color: 'var(--text-muted)' });
    expect(rule(WIDE, '.route:lang(en)')).toEqual({ 'font-size': '17px' });
    // The dates as in the Chinese row: one 3 × 2 grid as wide as the track, boxes as tall as their text.
    expect(rule(WIDE, '.dates:lang(en)')).toEqual(rule(WIDE, '.dates:lang(zh)'));
    expect(rule(WIDE, '.d:lang(en)')).toEqual({ 'min-height': '0' });
  });

  it('a zoomed phone (below 320px): two dates a line, so no chip spills', () => {
    expect(sheet[ZOOMED]).toEqual({ '.dates': { 'grid-template-columns': 'repeat(2, minmax(0, 1fr))' } });
  });

  it('from 1280px every row is as tall as its stacked buttons at least; the thin line before the route spans the row', () => {
    for (const lang of ['zh', 'en']) {
      const vertical = Number(/^(\d+)px/.exec(rule(WIDE, `.row:lang(${lang})`).padding)![1]);
      const stacked = px(rule(WIDE, `.go:lang(${lang})`)['min-height']) + px(rule(TABLET, '.actions').gap) + px(rule(WIDE, `.add:lang(${lang})`)['min-height']);
      expect(px(rule(WIDE, `.row:lang(${lang})`)['min-height']), lang).toBe(stacked + 2 * vertical);
    }
    expect(rule(WIDE, '.routeCell:lang(zh)')).toMatchObject({ 'align-self': 'stretch', 'border-left': '1px solid var(--line)' });
  });

  it('text never shrinks to fit: no layout changes a font size but the English wide row\'s, to the drawing E1\'s fixed sizes; no size follows the window', () => {
    for (const { media, selector, d } of allRules()) {
      if (media !== PHONE) {
        expect(d, `${media} ${selector}`).not.toHaveProperty('font');
        if (!(media === WIDE && selector.includes(':lang(en)'))) expect(d, `${media} ${selector}`).not.toHaveProperty('font-size');
      }
      expect(d['font-size'] ?? '', selector).not.toMatch(/vw|vh|clamp|%/);
    }
    const sized = Object.entries(sheet[WIDE]).filter(([, d]) => 'font-size' in d).map(([selector, d]) => `${selector} ${d['font-size']}`);
    expect(sized).toEqual(['.op:lang(en) 13px', '.region:lang(en) 14px', '.route:lang(en) 17px']);
  });

  it('nothing is cut off: only the visually hidden helpers clip; no ellipsis or line clamp anywhere', () => {
    const clipping = allRules().filter(({ d }) => /hidden|clip/.test(d.overflow ?? '')).map(r => r.selector);
    expect(clipping).toEqual(['.visuallyHidden', '.tip']);
    for (const { selector, d } of allRules()) {
      expect(d, selector).not.toHaveProperty('text-overflow');
      expect(d, selector).not.toHaveProperty('-webkit-line-clamp');
      expect(d, selector).not.toHaveProperty('line-clamp');
    }
  });

  it('only the route and the region may take more lines (and the English price change two): every other cell\'s text keeps to one line', () => {
    for (const selector of ['.days', '.price', '.delta', '.stale', '.chip', '.more', '.go', '.add', '.save']) {
      expect(rule(PHONE, selector)['white-space'], selector).toBe('nowrap');
    }
    // The English change breaks at its one ordinary space only (the dictionary's no-break spaces; tested above).
    const wraps = allRules().filter(({ d }) => d['white-space'] === 'normal').map(r => `${r.media} ${r.selector}`);
    expect(wraps).toEqual([' .region:lang(en) .place', ' .delta:lang(en)']);
  });

  it('44px touch targets in the block layouts (the dates, the gold button, 加入行程, 收藏); 36px buttons in the wide rows', () => {
    for (const selector of ['.d', '.go', '.add', '.save']) expect(rule(PHONE, selector)['min-height'], selector).toBe('44px');
    for (const lang of ['zh', 'en']) {
      expect(rule(WIDE, `.go:lang(${lang})`)['min-height']).toBe('36px');
      expect(rule(WIDE, `.add:lang(${lang})`)['min-height']).toBe('36px');
      expect(rule(WIDE, `.save:lang(${lang})`)['min-height']).toBe('36px');
    }
  });

  it('the actions: the gold button, then 加入行程 and 收藏 side by side on one line (the drawing\'s second line)', () => {
    render(<TourCard {...props} onAdd={vi.fn()} />);
    const actions = cardLink().parentElement!;
    expect(actions.children).toHaveLength(2);
    expect(actions.children[0]).toBe(cardLink());
    const pair = actions.children[1];
    expect(pair).toHaveClass(styles.pair);
    expect(pair).toContainElement(screen.getByRole('button', { name: '加入行程 +' }));
    expect(pair).toContainElement(screen.getByRole('button', { name: /^收藏/ }));
    // The two buttons are the pair's only items in its grid (its status line is out of the layout).
    const inFlow = [...pair.children].filter(el => !el.className.includes(styles.visuallyHidden));
    expect(inFlow).toHaveLength(2);
  });

  it('the pair: equal columns that are never narrower than their words, so 加入行程 is never cut and nothing moves when a tour is saved', () => {
    expect(rule(PHONE, '.pair')).toMatchObject({ display: 'grid', 'grid-auto-flow': 'column', 'grid-auto-columns': '1fr' });
    // 8px between the words (or star) and the border, at least, in every layout (the owner's minimum).
    expect(rule(PHONE, '.add').padding).toBe('0 8px');
    for (const { media, selector, d } of allRules().filter(r => r.media !== PHONE || !['.add', '.save'].includes(r.selector))) {
      if (/^\.(add|save)\b/.test(selector)) expect(d, `${media} ${selector}`).not.toHaveProperty('padding');
    }
    // On a phone the pair takes the wider share of a line it shares with the gold button.
    expect(px(rule(PHONE, '.actions > .pair')['flex-basis'])).toBeGreaterThan(px(rule(PHONE, '.actions > .go')['flex-basis']));
    expect(rule(TABLET, '.actions > .pair')).toMatchObject({ flex: 'none' });
    // 1fr, not minmax(0, 1fr): a column's least width is its button's words.
    for (const { selector, d } of allRules().filter(r => r.selector.startsWith('.pair'))) {
      expect(JSON.stringify(d), selector).not.toMatch(/minmax\(0/);
      expect(d, selector).not.toHaveProperty('grid-template-columns');
    }
    // The two buttons look alike: the same box, the same text.
    for (const property of ['min-height', 'padding', 'border', 'font-size', 'font-weight', 'white-space']) {
      expect(rule(PHONE, '.save')[property], property).toBe(rule(PHONE, '.add')[property]);
    }
  });
});

describe('收藏 (save)', () => {
  const save = () => screen.getByRole('button', { name: /收藏「/ });
  const stored = () => JSON.parse(window.localStorage.getItem(SAVED_KEY) ?? '[]').map((s: { key: string }) => s.key);

  it('a toggle with a star and a word, never the star alone; its name says which tour', () => {
    render(<TourCard {...props} onAdd={vi.fn()} />);
    const button = save();
    expect(button).toHaveAttribute('type', 'button');
    expect(button).toHaveAttribute('aria-pressed', 'false');
    expect(button).toHaveTextContent(/^收藏$/);
    expect(button).toHaveAccessibleName('收藏「東瀛遊：大阪、京都、奈良、神戶，5日4夜」');
    const star = button.querySelector('svg')!;
    expect(star).toHaveAttribute('aria-hidden', 'true');
    expect(star).toHaveClass(styles.star);
    // Outside the row link.
    expect(cardLink().contains(button)).toBe(false);
  });

  it('a press saves the tour in this browser, with its label; the word turns 已收藏, the name stays, aria-pressed says it', async () => {
    render(<TourCard {...props} />);
    await user.click(save());
    expect(save()).toHaveAttribute('aria-pressed', 'true');
    expect(save()).toHaveTextContent(/^已收藏$/);
    expect(save()).toHaveAccessibleName('收藏「東瀛遊：大阪、京都、奈良、神戶，5日4夜」');
    expect(stored()).toEqual(['egl:KIX5']);
    // The label kept beside the key is the site's own text: the same as the name's, no code, no tour title.
    expect(JSON.parse(window.localStorage.getItem(SAVED_KEY)!)[0].label).toBe('東瀛遊：大阪、京都、奈良、神戶，5日4夜');
    await user.click(save());
    expect(save()).toHaveAttribute('aria-pressed', 'false');
    expect(stored()).toEqual([]);
  });

  it('works from the keyboard: Enter and Space', async () => {
    render(<TourCard {...props} />);
    save().focus();
    await user.keyboard('{Enter}');
    expect(save()).toHaveAttribute('aria-pressed', 'true');
    await user.keyboard(' ');
    expect(save()).toHaveAttribute('aria-pressed', 'false');
  });

  it('never opens the operator\'s page: no navigation, the row link\'s click does not fire, and the row is not marked opened', async () => {
    const linkClicks = vi.fn();
    render(<TourCard {...props} />);
    cardLink().addEventListener('click', linkClicks);
    const pressed = new MouseEvent('click', { bubbles: true, cancelable: true });
    act(() => { save().dispatchEvent(pressed); });
    expect(linkClicks).not.toHaveBeenCalled();
    expect(pressed.defaultPrevented).toBe(false); // a plain button: there is nothing to prevent
    expect(screen.getAllByRole('row')[0]).not.toHaveAttribute('data-opened');
    expect(window.sessionStorage.length).toBe(0);
    expect(save()).toHaveAttribute('aria-pressed', 'true');
  });

  it('each row is its own tour: saving one leaves the others as they are', async () => {
    const other: TourRow = { ...tour, key: 'jetour:OSA6', url: 'https://example.test/jetour/OSA6' };
    render(<><TourCard {...props} /><TourCard {...props} tour={other} operator={{ ...operator, id: 'jetour', nameZh: '捷旅' }} /></>);
    await user.click(screen.getByRole('button', { name: /^收藏「捷旅/ }));
    expect(screen.getByRole('button', { name: /^收藏「捷旅/ })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /^收藏「東瀛遊/ })).toHaveAttribute('aria-pressed', 'false');
    expect(stored()).toEqual(['jetour:OSA6']);
  });

  it('shows what was saved before (another page, a reload), and follows a change made in another tab', () => {
    window.localStorage.setItem(SAVED_KEY, JSON.stringify([{ key: 'egl:KIX5', savedAt: 1 }]));
    render(<TourCard {...props} />);
    expect(save()).toHaveAttribute('aria-pressed', 'true');
    act(() => {
      window.localStorage.setItem(SAVED_KEY, '[]');
      window.dispatchEvent(new StorageEvent('storage', { key: SAVED_KEY }));
    });
    expect(save()).toHaveAttribute('aria-pressed', 'false');
  });

  it('in Simplified Chinese and English', async () => {
    const { unmount } = render(<TourCard {...props} t={makeT('zh-Hans')} />);
    expect(screen.getByRole('button', { name: '收藏「東瀛遊：大阪、京都、奈良、神户，5天4晚」' })).toHaveTextContent(/^收藏$/);
    unmount();
    render(<TourCard {...props} t={makeT('en')} />);
    const button = screen.getByRole('button', { name: 'Save EGL Tours: Osaka, Kyoto, Nara, Kobe, 5 days, 4 nights' });
    expect(button).toHaveTextContent(/^Save$/);
    await user.click(button);
    expect(button).toHaveTextContent(/^Saved$/);
    expect(button).toHaveAccessibleName('Save EGL Tours: Osaka, Kyoto, Nara, Kobe, 5 days, 4 nights');
    expect(button).toHaveAttribute('aria-pressed', 'true');
  });

  it('where the browser keeps nothing (site data blocked): no button, and 加入行程 keeps its place', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new DOMException('blocked', 'SecurityError'); });
    render(<TourCard {...props} onAdd={vi.fn()} />);
    expect(screen.queryByRole('button', { name: /收藏/ })).toBeNull();
    expect(screen.getByRole('button', { name: '加入行程 +' })).toBeInTheDocument();
  });

  it('storage full: the press changes nothing and the button says so plainly, in the same box; the next press tries again', async () => {
    render(<TourCard {...props} />);
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('full', 'QuotaExceededError'); });
    await user.click(save());
    expect(save()).toHaveAttribute('aria-pressed', 'false');
    expect(save()).toHaveTextContent(/^空間已滿$/);
    expect(save().querySelector('svg')).toBeNull();
    expect(save()).toHaveAttribute('title', '瀏覽器的儲存空間已滿，未能更改收藏。');
    // Screen readers hear why, from a status line out of the layout.
    const status = save().parentElement!.querySelector('[aria-live="polite"]')!;
    expect(status).toHaveTextContent('瀏覽器的儲存空間已滿，未能更改收藏。');
    expect(status).toHaveClass(styles.visuallyHidden);
    expect(stored()).toEqual([]);
    setItem.mockRestore();
    await user.click(save());
    expect(save()).toHaveTextContent(/^已收藏$/);
    expect(status).toHaveTextContent(/^$/);
  });

  it('storage full with tours already saved: they still show as saved; removing fails the same way', async () => {
    window.localStorage.setItem(SAVED_KEY, JSON.stringify([{ key: 'egl:KIX5', savedAt: 1 }]));
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('full', 'QuotaExceededError'); });
    render(<TourCard {...props} />);
    expect(save()).toHaveAttribute('aria-pressed', 'true');
    await user.click(save());
    expect(save()).toHaveAttribute('aria-pressed', 'true');
    expect(save()).toHaveTextContent(/^空間已滿$/);
  });

  it('the server renders it unpressed (it cannot know); after hydration it shows the saved state without a mismatch warning', async () => {
    window.localStorage.setItem(SAVED_KEY, JSON.stringify([{ key: 'egl:KIX5', savedAt: 1 }]));
    const html = renderToString(<TourCard {...props} />);
    expect(html).toContain('aria-pressed="false"');
    expect(html).toContain('收藏');
    expect(html).not.toContain('已收藏');
    await hydrated(<TourCard {...props} />, (container, errors) => {
      expect(errors).not.toHaveBeenCalled();
      expect(container.querySelector('button[aria-pressed]')).toHaveAttribute('aria-pressed', 'true');
      expect(container.querySelector('button[aria-pressed]')).toHaveTextContent('已收藏');
    });
  });

  it('saved: colours only (the pale gold, the gold outline, a deeper gold under the pointer, the star filled); nothing changes a size', () => {
    expect(rule(PHONE, ".save[aria-pressed='true']")).toEqual({ background: 'var(--saved-bg)', 'border-color': 'var(--saved-line)' });
    // The hover comes after, so a saved button shows the pointer too.
    expect(rule(PHONE, ".save[aria-pressed='true']:hover")).toEqual({ background: 'var(--saved-hover)' });
    const order = Object.keys(sheet[PHONE]);
    expect(order.indexOf(".save[aria-pressed='true']:hover")).toBeGreaterThan(order.indexOf(".save[aria-pressed='true']"));
    expect(rule(PHONE, ".save[aria-pressed='true'] .star")).toEqual({ fill: 'var(--saved-star)' });
    expect(rule(PHONE, '.star')).toMatchObject({ width: '14px', height: '14px', fill: 'none', stroke: 'currentColor' });
    // Its own colours, not the most recent row's gold tint, so it shows on that row too (lib/theme.test.ts).
    expect(JSON.stringify(rule(PHONE, ".save[aria-pressed='true']"))).not.toMatch(/latest-bg/);
  });
});

describe('the row link', () => {
  it('links to the operator in a new tab, with a short accessible name instead of the whole row\'s text', () => {
    render(<TourCard {...props} />);
    const link = cardLink();
    expect(link).toHaveAttribute('href', 'https://example.test/egl/KIX5');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'));
    expect(link).toHaveAccessibleName('東瀛遊：大阪、京都、奈良、神戶，5日4夜，HK$7,999起');
  });

  it('in English it reads "Operator\'s site"', () => {
    render(<TourCard {...props} t={makeT('en')} />);
    expect(screen.getByRole('link', { name: /^EGL Tours/ })).toHaveTextContent("Operator's site ↗");
  });

  it('is described by the price change (the dates follow it as links of their own)', () => {
    render(<TourCard {...props} />);
    expect(cardLink()).toHaveAccessibleDescription(/↓ 比7日前平 HK\$500/);
    expect(cardLink()).not.toHaveAccessibleDescription(/12\/18|出發$|解散/);
  });

  it('a row with no change, no note, no old data and no mark has no dangling description ids', () => {
    render(<TourCard {...props} tour={{ ...tour, priceChange: null, departures: [] }} />);
    expect(cardLink()).not.toHaveAttribute('aria-describedby');
  });

  it('a click anywhere on the row reaches the row link, except on a date (its own link) and the add button', () => {
    expect(rule(PHONE, '.row').position).toBe('relative');
    expect(rule(PHONE, '.go::after')).toEqual({ content: "''", position: 'absolute', inset: '0' });
    expect(rule(PHONE, '.datesCell')).toMatchObject({ position: 'relative', 'z-index': '1', 'pointer-events': 'none' });
    expect(rule(PHONE, '.d')['pointer-events']).toBe('auto');
    // 加入行程 and 收藏 are above the stretched link (their pair, raised further while the picker is open).
    expect(rule(PHONE, '.pair')).toMatchObject({ position: 'relative', 'z-index': '1' });
    expect(rule(PHONE, '.pair[data-open]')).toEqual({ 'z-index': '30' });
    // Keyboard focus on the row link rings the button and the whole row.
    expect(rule(PHONE, '.row:has(.go:focus-visible)')).toEqual({ 'box-shadow': 'inset 0 0 0 2px var(--focus)' });
  });

  it.each(['javascript:alert(1)', 'data:text/html,x', 'http://example.com', '/website/itinerary/KIX5'])(
    'a non-https url (%s) gives no link, and the rest of the row still works',
    async url => {
      const onAdd = vi.fn();
      const { container } = render(<TourCard {...props} tour={{ ...tour, url }} onAdd={onAdd} />);
      expect(screen.queryByRole('link')).toBeNull();
      expect(container.querySelector('[href]')).toBeNull();
      expect(screen.queryByText('去旅行社網站 ↗')).toBeNull(); // no promise of a link that is not there
      expect(screen.getByRole('heading')).toHaveTextContent('大阪 → 京都 → 奈良 → 神戶');
      expect(screen.getByText(/HK\$7,999/, priceDiv)).toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: '加入行程 +' }));
      await user.click(screen.getByRole('button', { name: /2026年12月18日/ }));
      expect(onAdd).toHaveBeenCalledWith('2026-12-18');
    },
  );

  it('accepts an https url in any letter case', () => {
    render(<TourCard {...props} tour={{ ...tour, url: 'HTTPS://example.test/x' }} />);
    expect(cardLink()).toHaveAttribute('href', 'HTTPS://example.test/x');
  });
});

describe('the operator\'s colour', () => {
  const card = (container: HTMLElement) => container.querySelector<HTMLElement>('[role="row"]')!;

  it('paints the tag only, no stripe down the row\'s edge; its text is the colour that meets WCAG AA on it', () => {
    const { container, unmount } = render(<TourCard {...props} />);
    expect(card(container).style.getPropertyValue('--c')).toBe('#d62839');
    expect(screen.getByText('東瀛遊').className).not.toMatch(/opDark/);
    const users = allRules().filter(({ d }) => Object.values(d).some(v => v.includes('var(--c)')));
    expect(users.map(r => [r.selector, r.d.background])).toEqual([['.op', 'var(--c)']]);
    expect(rule(PHONE, '.opDark')).toEqual({ color: 'var(--on-operator-dark)' });
    unmount();
    render(<TourCard {...props} operator={{ ...operator, color: '#ee7b06' }} />);
    expect(screen.getByText('東瀛遊').className).toMatch(/opDark/);
  });

  it('comes from the operator record, so a new operator needs no CSS', () => {
    const { container } = render(<TourCard {...props} operator={{ ...operator, color: '#0F8B8D' }} />);
    expect(card(container).style.getPropertyValue('--c')).toBe('#0F8B8D');
  });

  it.each(['red;position:fixed;inset:0', 'red', '#fff', '#d62839;', 'url(x)', ''])(
    'a colour that is not #rrggbb (%j) falls back to the fixed operator fallback grey, with light tag text',
    color => {
      const { container } = render(<TourCard {...props} operator={{ ...operator, color }} />);
      expect(card(container).style.getPropertyValue('--c')).toBe('var(--op-fallback)');
      expect(screen.getByText('東瀛遊').className).not.toMatch(/opDark/);
      expect(card(container).getAttribute('style')).not.toMatch(/position|inset/);
    },
  );
});

describe('加入行程', () => {
  it('has no add button without onAdd (收藏 is then alone on its line)', () => {
    render(<TourCard {...props} />);
    expect(screen.queryByRole('button', { name: /加入行程/ })).toBeNull();
    expect(screen.getAllByRole('button').map(b => b.textContent)).toEqual(['收藏']);
  });

  it('the add button is outside the link and opens the picker; choosing a date adds it and returns focus to the button', async () => {
    const onAdd = vi.fn();
    render(<TourCard {...props} onAdd={onAdd} />);
    const button = screen.getByRole('button', { name: '加入行程 +' });
    expect(cardLink().contains(button)).toBe(false);
    await user.click(button);
    expect(screen.getByText('選擇出發日期')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /2026年12月20日/ }));
    expect(onAdd).toHaveBeenCalledTimes(1);
    expect(onAdd).toHaveBeenCalledWith('2026-12-20');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(button).toHaveFocus();
  });

  it('the picker works from the keyboard and Escape returns focus to the add button without scrolling', async () => {
    const onAdd = vi.fn();
    render(<TourCard {...props} onAdd={onAdd} />);
    const button = screen.getByRole('button', { name: '加入行程 +' });
    expect(button).toHaveAttribute('aria-expanded', 'false');
    await user.tab(); // the departure dates (one tab stop)
    await user.tab(); // the row link
    await user.tab(); // the add button
    expect(button).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(button).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('button', { name: /2026年12月18日/ })).toHaveFocus();
    const focus = vi.spyOn(button, 'focus');
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(button).toHaveFocus();
    expect(focus).toHaveBeenCalledWith({ preventScroll: true });
    expect(onAdd).not.toHaveBeenCalled();
  });

  it('the close button and a second press on the add button close the picker', async () => {
    render(<TourCard {...props} onAdd={vi.fn()} />);
    const button = screen.getByRole('button', { name: '加入行程 +' });
    await user.click(button);
    await user.click(screen.getByRole('button', { name: '關閉' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(button).toHaveFocus();
    await user.click(button);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    await user.click(button);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('with React\'s root on the document (as on the site), a second press on the add button closes the picker for good, mouse or finger', async () => {
    await renderAtDocument(<TourCard {...props} onAdd={vi.fn()} />);
    const button = screen.getByRole('button', { name: '加入行程 +' });
    for (const key of ['[MouseLeft]', '[TouchA]']) {
      await user.pointer({ keys: key, target: button });
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      await user.pointer({ keys: key, target: button });
      expect(screen.queryByRole('dialog')).toBeNull(); // not closed and opened again
      expect(button).toHaveAttribute('aria-expanded', 'false');
      expect(button).toHaveFocus();
    }
  });

  it('a press outside closes it without adding; focus stays on what was pressed', async () => {
    const onAdd = vi.fn();
    render(<><input aria-label="elsewhere" /><TourCard {...props} onAdd={onAdd} /></>);
    const button = screen.getByRole('button', { name: '加入行程 +' });
    await user.click(button);
    const focus = vi.spyOn(button, 'focus');
    await user.click(screen.getByRole('textbox', { name: 'elsewhere' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(onAdd).not.toHaveBeenCalled();
    expect(focus).not.toHaveBeenCalled();
    expect(screen.getByRole('textbox', { name: 'elsewhere' })).toHaveFocus();
  });

  it('the picker lists every departure, not only those on the row, with the stored fallback price and 起 for an unpriced date', async () => {
    render(<TourCard {...props} tour={eight} onAdd={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: '加入行程 +' }));
    expect(screen.getByRole('dialog').querySelectorAll('li')).toHaveLength(8);
    expect(screen.getByRole('button', { name: /2026年12月27日/ })).toHaveTextContent('HK$7,499 起');
  });

  it('keeps its words in every language (the owner found a bare "+" unclear)', () => {
    const { unmount } = render(<TourCard {...props} onAdd={vi.fn()} t={makeT('en')} />);
    expect(screen.getByRole('button', { expanded: false })).toHaveTextContent('+ Add to trip');
    unmount();
    render(<TourCard {...props} onAdd={vi.fn()} t={makeT('zh-Hans')} />);
    expect(screen.getByRole('button', { expanded: false })).toHaveTextContent('加入行程 +');
  });
});

describe('a stored page made before Hong Kong midnight, seen after it', () => {
  // The home page is a stored copy, made up to an hour (or a visit) earlier, with the server's today of that time
  // (here 12 Nov). The browser's own clock says what day it is in Hong Kong now.
  // These rows read the browser's clock (the other tests' is pinned to 2000 by vitest.setup.ts), under fake timers.
  beforeEach(() => { setBrowserTodayClockForTests(null); resetBrowserTodayCache(); });
  const at = (iso: string) => { vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date(iso)); resetBrowserTodayCache(); };
  afterEach(() => { vi.useRealTimers(); resetBrowserTodayCache(); });
  const tomorrow = { date: '2026-11-13', priceHkd: 6999 };
  /** Seven dates, the first on 13 Nov: five chips and +2 on 12 Nov; on 13 Nov the six still to come. */
  const seven: TourRow = { ...tour, departures: [tomorrow, ...tour.departures] };
  const chips = () => dateLinks().map(a => a.querySelector('span')!.textContent);

  it('before midnight: 13 Nov is offered', () => {
    at('2026-11-12T15:59:00Z'); // 23:59 in Hong Kong
    render(<TourCard {...props} tour={seven} onAdd={vi.fn()} />);
    expect(chips()).toEqual(['11/13 (五)', '12/18 (五)', '12/20 (日)', '12/23 (三)', '12/27 (日)']);
    expect(screen.getByText('+2 個')).toBeInTheDocument();
  });

  it('after midnight: no chip or picker entry for 13 Nov, and the +N cell counts only what is still to come', async () => {
    at('2026-11-12T16:20:00Z'); // 00:20 on 13 Nov in Hong Kong
    render(<TourCard {...props} tour={seven} onAdd={vi.fn()} />);
    expect(chips()).toEqual(['12/18 (五)', '12/20 (日)', '12/23 (三)', '12/27 (日)', '12/30 (三)', '1/3 (日)']);
    expect(screen.queryByText(/^\+\d+ 個$/)).toBeNull();
    await user.click(screen.getByRole('button', { name: '加入行程 +' }));
    expect(screen.queryByRole('button', { name: /2026年11月13日/ })).toBeNull();
    expect(within(screen.getByRole('dialog')).getAllByRole('listitem')).toHaveLength(6);
  });

  it('after midnight, with more dates than the row holds: five chips, and +N counts those still to come', () => {
    at('2026-11-12T16:20:00Z');
    render(<TourCard {...props} tour={{ ...eight, departures: [tomorrow, ...eight.departures] }} />);
    expect(chips()).toEqual(['12/18 (五)', '12/20 (日)', '12/23 (三)', '12/27 (日)', '12/30 (三)']);
    expect(screen.getByText('+3 個')).toBeInTheDocument(); // 8 still to come (not +4: 13 Nov is not counted)
  });

  it('a row whose every date has passed says so in the dates\' place, and its picker says so too', async () => {
    at('2026-11-12T16:20:00Z');
    render(<TourCard {...props} tour={{ ...tour, departures: [tomorrow] }} onAdd={vi.fn()} />);
    expect(screen.queryByRole('group', { name: '出發日期' })).toBeNull();
    const cell = cells().find(c => c.className.includes(styles.datesCell))!;
    expect(cell).toHaveTextContent(/^出發日期已過$/);
    await user.click(screen.getByRole('button', { name: '加入行程 +' }));
    expect(screen.getByRole('dialog')).toHaveTextContent('出發日期已過');
    expect(screen.getByRole('button', { name: '關閉' })).toHaveFocus();
    // The row, its link to the operator's page and its price stay as the page has them.
    expect(cardLink()).toHaveAttribute('href', tour.url);
    expect(screen.getByText(/HK\$7,999/, priceDiv)).toBeInTheDocument();
  });

  it('the line in the dates\' place is as tall as the line of chips it replaces, so nothing below moves', () => {
    // Below 1280px a chip's box is at least 44px tall: so is the line, its text centred as a chip's is.
    expect(rule(PHONE, '.d')['min-height']).toBe('44px');
    expect(rule(PHONE, '.passed')).toMatchObject({ display: 'flex', 'align-items': 'center', 'min-height': '44px' });
    // From 1280px the chips are as tall as their text (the row's height comes from its buttons): the line too, its text
    // where a chip's text would be (the dates' 2px, then the chip's 4px).
    for (const lang of ['zh', 'en']) {
      expect(rule(WIDE, `.d:lang(${lang})`)).toEqual({ 'min-height': '0' });
      expect(rule(WIDE, `.passed:lang(${lang})`)).toEqual({ 'min-height': '0', 'padding-top': '6px' });
    }
  });

  it('in every language', () => {
    at('2026-11-12T16:20:00Z');
    const only = { ...tour, departures: [tomorrow] };
    const { unmount } = render(<TourCard {...props} tour={only} t={makeT('en')} />);
    expect(screen.getByText('Departure dates have passed')).toBeInTheDocument();
    unmount();
    render(<TourCard {...props} tour={only} t={makeT('zh-Hans')} />);
    expect(screen.getByText('出发日期已过')).toBeInTheDocument();
  });

  it('a copy up to a week old is corrected: seen on 19 Nov, every date to 19 Nov is gone', () => {
    at('2026-11-18T16:20:00Z'); // 00:20 on 19 Nov in Hong Kong: the page's today (12 Nov) plus 7
    const week: TourRow = { ...tour, departures: [tomorrow, { date: '2026-11-15', priceHkd: 6999 }, { date: '2026-11-19', priceHkd: 6999 }, { date: '2026-11-20', priceHkd: 6999 }] };
    render(<TourCard {...props} tour={week} />);
    expect(chips()).toEqual(['11/20 (五)']);
  });

  it('a browser clock more than a week past the page\'s today, or behind it, is not trusted: the page\'s dates stand', () => {
    at('2026-11-19T16:20:00Z'); // 20 Nov: the page's today plus 8
    const { unmount } = render(<TourCard {...props} tour={seven} />);
    expect(chips()[0]).toBe('11/13 (五)');
    unmount();
    at('2027-11-12T16:20:00Z'); // a year ahead
    const again = render(<TourCard {...props} tour={seven} />);
    expect(chips()[0]).toBe('11/13 (五)');
    again.unmount();
    at('2026-11-10T16:20:00Z'); // behind: 11 Nov
    render(<TourCard {...props} tour={seven} />);
    expect(chips()[0]).toBe('11/13 (五)');
  });

  it('back to rows by a link after midnight: the date is checked at once, not up to a minute later', () => {
    vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] });
    vi.setSystemTime(new Date('2026-11-12T15:50:00Z')); // 23:50 on 12 Nov
    resetBrowserTodayCache();
    const { unmount } = render(<TourCard {...props} tour={seven} />);
    expect(chips()[0]).toBe('11/13 (五)');
    unmount(); // to a page without rows
    vi.setSystemTime(new Date('2026-11-12T16:20:00Z')); // 00:20 on 13 Nov
    render(<TourCard {...props} tour={seven} />);
    expect(chips()[0]).toBe('12/18 (五)');
  });

  it('a page left open across two midnights keeps both days hidden', () => {
    vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] });
    vi.setSystemTime(new Date('2026-11-12T15:59:30Z')); // 23:59:30 on 12 Nov
    resetBrowserTodayCache();
    const two: TourRow = { ...tour, departures: [tomorrow, { date: '2026-11-14', priceHkd: 6999 }, ...tour.departures] };
    render(<TourCard {...props} tour={two} />);
    expect(chips().slice(0, 2)).toEqual(['11/13 (五)', '11/14 (六)']);
    act(() => { vi.advanceTimersByTime(60_000); }); // 00:00:30 on 13 Nov
    expect(chips()[0]).toBe('11/14 (六)');
    act(() => { vi.advanceTimersByTime(24 * 3600_000); }); // 00:00:30 on 14 Nov
    expect(chips()[0]).toBe('12/18 (五)');
  });

  it('once dates are hidden they stay hidden in this page view: a tab open past a week, or a clock set back', () => {
    vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] });
    vi.setSystemTime(new Date('2026-11-18T16:20:00Z')); // 19 Nov: the page's today plus 7
    resetBrowserTodayCache();
    const week: TourRow = { ...tour, departures: [tomorrow, { date: '2026-11-19', priceHkd: 6999 }, ...tour.departures] };
    render(<TourCard {...props} tour={week} />);
    expect(chips()[0]).toBe('12/18 (五)');
    act(() => { vi.advanceTimersByTime(24 * 3600_000); }); // 20 Nov: plus 8, which alone would not be trusted
    expect(chips()[0]).toBe('12/18 (五)');
    act(() => { vi.setSystemTime(new Date('2026-11-12T10:00:00Z')); vi.advanceTimersByTime(60_000); }); // set back to 12 Nov
    expect(chips()[0]).toBe('12/18 (五)');
  });

  it('the server\'s HTML is the stored copy\'s (13 Nov still there); the browser drops it after hydration, without a mismatch', async () => {
    at('2026-11-12T16:20:00Z');
    const html = renderToString(<TourCard {...props} tour={seven} />);
    expect(html).toContain('11/13');
    expect(html).toContain('+2 個');
    await hydrated(<TourCard {...props} tour={seven} />, (container, errors) => {
      expect(errors).not.toHaveBeenCalled();
      expect(container.textContent).not.toContain('11/13');
      expect(container.textContent).not.toContain('+2 個');
    });
  });

  it('a page left open past midnight drops the day\'s dates within a minute', () => {
    vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] });
    vi.setSystemTime(new Date('2026-11-12T15:59:30Z'));
    resetBrowserTodayCache();
    render(<TourCard {...props} tour={seven} />);
    expect(chips()[0]).toBe('11/13 (五)');
    act(() => { vi.advanceTimersByTime(60_000); });
    expect(chips()[0]).toBe('12/18 (五)');
  });
});

describe('bad data never takes the row down', () => {
  it('a bad price-change date drops only the change', () => {
    render(<TourCard {...props} tour={{ ...tour, priceChange: { kind: 'lower', diffHkd: 500, sinceDate: 'not-a-date' } }} />);
    expect(screen.queryByText(/日前/)).toBeNull();
    expect(screen.getByText(/HK\$7,999/, priceDiv)).toBeInTheDocument();
  });

  it('a bad today drops the change but renders the row', () => {
    render(<TourCard {...props} today="garbage" />);
    expect(screen.queryByText(/日前/)).toBeNull();
    expect(screen.getByRole('heading')).toHaveTextContent('大阪 → 京都 → 奈良 → 神戶');
    expect(dateLinks()).toHaveLength(6);
  });
});

it('reads in each language: the days in their own words, the price\'s "from" where the language puts it', () => {
  const { unmount } = render(<TourCard {...props} t={makeT('en')} />);
  expect(cells()[1]).toHaveTextContent(/^5 days$/);
  expect(screen.getByText(/HK\$7,999/, priceDiv)).toHaveTextContent(/^from HK\$7,999$/);
  expect(screen.getByRole('heading')).toHaveTextContent('Osaka → Kyoto → Nara → Kobe');
  unmount();
  render(<TourCard {...props} t={makeT('zh-Hans')} />);
  expect(cells()[1]).toHaveTextContent(/^5天$/);
  expect(screen.getByText(/HK\$7,999/, priceDiv)).toHaveTextContent(/^HK\$7,999 起$/);
});
