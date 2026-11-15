import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within, fireEvent, getDefaultNormalizer } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { places, type Stop } from '@hktours/core';
import type { OperatorInfo, TourCardData } from '@hktours/db';
import { TourCard, MAX_DATE_CHIPS, shiftIntoView, type TourCardProps } from './TourCard';
import { makeT } from '../lib/i18n';

const tZh = makeT('zh-Hant');

const kansai = (cityId: string): Stop => ({ countryId: 'japan', regionId: 'japan-kansai', cityId });
const tour: TourCardData = {
  key: 'egl:KIX5', operatorId: 'egl', url: 'https://www.egltours.com/website/itinerary/KIX5', title: '關西5天',
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
const operator: OperatorInfo = {
  id: 'egl', nameZh: '東瀛遊', nameEn: 'EGL Tours', color: '#d62839', lastGoodRunAt: '2026-11-11T19:10:00Z',
};
const props: TourCardProps = { tour, operator, places, today: '2026-11-12', t: tZh };

// The default normalizer turns the full-width space (U+3000) in '↓ HK$500　比7日前' into ' ' in the
// rendered text but not in the expected string, so those lookups keep whitespace as rendered.
const keepSpaces = { normalizer: getDefaultNormalizer({ collapseWhitespace: false }) };
const cardCss = () => readFileSync(join(__dirname, 'TourCard.module.css'), 'utf8').replace(/\s+/g, ' ');
/** The card's own link (to the operator's page); each departure date is a link too, named by its date. */
const cardLink = () => screen.getByRole('link', { name: /^東瀛遊/ });
/** The card's price is a div; each date's price (its tooltip) is a span, so lookups by price text pick the div. */
const priceDiv = { selector: 'div' };

let user: ReturnType<typeof userEvent.setup>;
beforeEach(() => { user = userEvent.setup(); });

it('shows the facts from the mockup', () => {
  render(<TourCard {...props} />);
  expect(screen.getByText('東瀛遊')).toBeInTheDocument();
  expect(screen.getByText('日本 · 關西')).toBeInTheDocument();
  expect(screen.getByRole('heading')).toHaveTextContent('大阪→京都→奈良→神戶');
  expect(screen.getByText('5日4夜')).toBeInTheDocument();
  expect(screen.getByText(/HK\$7,999/, priceDiv)).toBeInTheDocument();
  expect(screen.getByText('↓ HK$500　比7日前', keepSpaces)).toBeInTheDocument();
  expect(screen.getByText('更新：今日 03:10')).toBeInTheDocument();
});

it('follows the price with 起 and shows the go-to-operator text', () => {
  render(<TourCard {...props} />);
  expect(screen.getByText(/HK\$7,999/, priceDiv)).toHaveTextContent('HK$7,999 起');
  expect(screen.getByText('前往東瀛遊網站 ↗')).toBeInTheDocument();
});

it('shows four date chips and counts the rest', () => {
  render(<TourCard {...props} />);
  expect(MAX_DATE_CHIPS).toBe(4);
  for (const chip of ['12/18', '12/20', '12/23', '12/27']) expect(screen.getByText(chip)).toBeInTheDocument();
  expect(screen.queryByText('12/30')).toBeNull();
  expect(screen.getByText('+2 個出發日')).toBeInTheDocument();
});

it('shows no count when every date fits', () => {
  render(<TourCard {...props} tour={{ ...tour, departures: tour.departures.slice(0, 4) }} />);
  expect(screen.getByText('12/27')).toBeInTheDocument();
  expect(screen.queryByText(/個出發日/)).toBeNull();
});

describe('each departure date shows its own price', () => {
  const dateLinks = () => within(screen.getByRole('group', { name: '出發日期' })).getAllByRole('link');

  it('each date is a link to the operator\'s page in a new tab, named by its date and that date\'s price', () => {
    render(<TourCard {...props} />);
    expect(dateLinks().map(a => a.textContent)).toEqual(['12/18 HK$7,999', '12/20 HK$8,299', '12/23 HK$8,299', '12/27 HK$7,499 起']);
    for (const a of dateLinks()) {
      expect(a).toHaveAttribute('href', tour.url);
      expect(a).toHaveAttribute('target', '_blank');
      expect(a).toHaveAttribute('rel', expect.stringContaining('noopener'));
    }
    expect(screen.getByRole('link', { name: '12/18 HK$7,999' })).toBeInTheDocument();
  });

  it('a date without its own price shows the tour\'s stored from-price with 起, as the departure picker does', () => {
    render(<TourCard {...props} />);
    // fallbackPriceHkd (7,499): the same figure the picker shows for that date, not the card's window price.
    expect(screen.getByRole('link', { name: '12/27 HK$7,499 起' })).toBeInTheDocument();
  });

  it('in English the from-marker comes first, as on the card', () => {
    render(<TourCard {...props} t={makeT('en')} />);
    expect(screen.getByRole('link', { name: '18 Dec HK$7,999' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '27 Dec from HK$7,499' })).toBeInTheDocument();
  });

  it('the "+N" count is plain text, not a link', () => {
    render(<TourCard {...props} />);
    expect(screen.getByText('+2 個出發日').closest('a')).toBeNull();
  });

  it('the dates are one tab stop between the card link and the add button; the arrow keys move between them', async () => {
    render(<TourCard {...props} onAdd={vi.fn()} />);
    await user.tab();
    expect(cardLink()).toHaveFocus();
    await user.tab();
    const links = dateLinks();
    expect(links[0]).toHaveFocus();
    expect(links.map(a => a.tabIndex)).toEqual([0, -1, -1, -1]);
    await user.keyboard('{ArrowRight}');
    expect(links[1]).toHaveFocus();
    await user.keyboard('{End}');
    expect(links[3]).toHaveFocus();
    await user.keyboard('{ArrowRight}'); // stays on the last
    expect(links[3]).toHaveFocus();
    await user.keyboard('{ArrowLeft}');
    expect(links[2]).toHaveFocus();
    expect(links.map(a => a.tabIndex)).toEqual([-1, -1, 0, -1]); // Tab comes back to the date last visited
    await user.keyboard('{Home}');
    expect(links[0]).toHaveFocus();
    await user.tab();
    expect(screen.getByRole('button', { name: '加入行程 ＋' })).toHaveFocus();
  });

  it('a card without a link still shows each date\'s price on focus, without making the dates links', async () => {
    render(<TourCard {...props} tour={{ ...tour, url: 'http://example.com' }} />);
    expect(screen.queryByRole('link')).toBeNull();
    await user.tab();
    expect(screen.getByText('12/18').parentElement).toHaveFocus();
    expect(screen.getByText('12/18').parentElement).toHaveTextContent('12/18 HK$7,999');
  });

  it('keeps a tooltip inside the window: shifts it left or right by what would overflow', () => {
    expect(shiftIntoView(100, 200, 1000)).toBe(0);
    expect(shiftIntoView(-30, 70, 1000)).toBe(38); // 8px margin from the left edge
    expect(shiftIntoView(950, 1050, 1000)).toBe(-58);
    expect(shiftIntoView(0, 1200, 1000)).toBe(8); // wider than the window: keep its start visible
  });

  it('sets the shift when a date is hovered or focused', () => {
    render(<TourCard {...props} />);
    const link = dateLinks()[0];
    const tip = link.lastElementChild as HTMLElement;
    tip.getBoundingClientRect = () => ({ left: -20, right: 60 } as DOMRect);
    fireEvent.pointerEnter(link);
    expect(tip.style.getPropertyValue('--tip-shift')).toBe('28px');
    tip.getBoundingClientRect = () => ({ left: 10, right: 90 } as DOMRect);
    fireEvent.focus(link);
    expect(tip.style.getPropertyValue('--tip-shift')).toBe('0px');
  });

  it('the CSS: dates read as information (help cursor, no button fill, no pressed look); the price appears above the date on hover (pointer devices only) and on keyboard focus, out of the layout', () => {
    const css = cardCss();
    expect(css).toMatch(/\.d \{[^}]*cursor: help/);
    expect(css).not.toMatch(/\.d:active/);
    expect(css).toMatch(/\.tip \{[^}]*position: absolute[^}]*bottom: calc\(100% \+ 6px\)/);
    expect(css).toMatch(/\.tip \{[^}]*background: var\(--charcoal\)[^}]*color: var\(--snow\)/);
    expect(css).toMatch(/\.d:focus-visible \.tip \{/);
    // Hover reveals only where there is a real hover: on a touch screen the first tap must open the operator's page.
    expect(css).toMatch(/@media \(hover: hover\) \{ \.d:hover \.tip \{/);
    expect(css.replace(/@media \(hover: hover\) \{[^@]*\}\s*\}/, '')).not.toMatch(/\.d:hover \.tip/);
  });

  it('the CSS: a click anywhere on the card reaches the card link, except on a date (its own link to the same page) and the add button', () => {
    const css = cardCss();
    expect(css).toMatch(/\.link::after \{[^}]*content: ''[^}]*position: absolute[^}]*inset: 0/);
    expect(css).toMatch(/\.dates \{[^}]*position: relative[^}]*pointer-events: none/);
    expect(css).toMatch(/\.d \{[^}]*pointer-events: auto/);
    expect(css).toMatch(/\.link:focus-visible::after \{[^}]*outline: 2px solid var\(--cerulean\)/);
  });
});

it('the operator tag uses the text colour that meets WCAG AA on the operator\'s colour', () => {
  const { unmount } = render(<TourCard {...props} />);
  expect(screen.getByText('東瀛遊').className).not.toMatch(/opDark/);
  unmount();
  render(<TourCard {...props} operator={{ ...operator, color: '#ee7b06' }} />);
  expect(screen.getByText('東瀛遊').className).toMatch(/opDark/);
  const css = cardCss();
  expect(css).toMatch(/\.op \{[^}]*color: var\(--on-operator-light\)/);
  expect(css).toMatch(/\.opDark \{ color: var\(--on-operator-dark\); \}/);
});

it('links to the operator in a new tab', () => {
  render(<TourCard {...props} />);
  const link = cardLink();
  expect(link).toHaveAttribute('href', 'https://www.egltours.com/website/itinerary/KIX5');
  expect(link).toHaveAttribute('target', '_blank');
  expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'));
});

it('gives the link a short accessible name instead of the whole card text', () => {
  render(<TourCard {...props} />);
  expect(cardLink()).toHaveAccessibleName('東瀛遊：大阪、京都、奈良、神戶，5日4夜，HK$7,999起');
});

it('joins the route in the link name with the dictionary separator', () => {
  const tEn = makeT('en');
  render(<TourCard {...props} t={tEn} />);
  expect(cardLink()).toHaveAccessibleName('東瀛遊 (EGL Tours): Osaka, Kyoto, Nara, Kobe, 5 days, 4 nights, from HK$7,999');
});

it('describes the link with the price change (the dates follow it as links of their own)', () => {
  render(<TourCard {...props} />);
  const link = cardLink();
  expect(link).toHaveAccessibleDescription(/↓ HK\$500\s比7日前/);
  expect(link).not.toHaveAccessibleDescription(/12\/18|出發$|解散/);
});

it('describes the link with the start or end note when there is one', () => {
  render(<TourCard {...props} tour={{ ...tour, start: { kind: 'other', label: '澳門' }, end: { kind: 'other', label: '珠海' } }} />);
  expect(cardLink()).toHaveAccessibleDescription(/澳門出發 · 珠海解散/);
});

it('a card with no change line and no dates has no dangling description ids', () => {
  render(<TourCard {...props} tour={{ ...tour, priceChange: null, departures: [] }} />);
  expect(cardLink()).not.toHaveAttribute('aria-describedby');
});

it.each(['javascript:alert(1)', 'data:text/html,x', 'http://example.com', '/website/itinerary/KIX5'])(
  'a non-https url (%s) gives no link, and the rest of the card still works',
  async url => {
    const onAdd = vi.fn();
    const { container } = render(<TourCard {...props} tour={{ ...tour, url }} onAdd={onAdd} />);
    expect(screen.queryByRole('link')).toBeNull();
    expect(container.querySelector('[href]')).toBeNull();
    expect(screen.queryByText('前往東瀛遊網站 ↗')).toBeNull(); // no promise of a link that is not there
    expect(screen.getByText('更新：今日 03:10')).toBeInTheDocument();
    expect(screen.getByRole('heading')).toHaveTextContent('大阪→京都→奈良→神戶');
    expect(screen.getByText(/HK\$7,999/, priceDiv)).toBeInTheDocument();
    expect(screen.getByText('12/18')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '加入行程 ＋' }));
    await user.click(screen.getByRole('button', { name: /2026年12月18日/ }));
    expect(onAdd).toHaveBeenCalledWith('2026-12-18');
  },
);

it('accepts an https url in any letter case', () => {
  render(<TourCard {...props} tour={{ ...tour, url: 'HTTPS://www.egltours.com/x' }} />);
  expect(cardLink()).toHaveAttribute('href', 'HTTPS://www.egltours.com/x');
});

it('uses the operator colour for the tag and the left border', () => {
  const { container } = render(<TourCard {...props} />);
  const card = container.querySelector('article')!;
  expect(card.style.getPropertyValue('--c')).toBe('#d62839');
  expect(card).toContainElement(screen.getByText('東瀛遊'));
  // jsdom does not apply CSS modules, so pin the two rules that paint from --c.
  const css = cardCss();
  expect(css).toMatch(/\.card \{[^}]*border-left: 5px solid var\(--c\)/);
  expect(css).toMatch(/\.op \{[^}]*background: var\(--c\)/);
});

it('takes the colour from the operator record, so a new operator needs no CSS', () => {
  const { container } = render(<TourCard {...props} operator={{ ...operator, color: '#0F8B8D' }} />);
  expect(container.querySelector('article')!.style.getPropertyValue('--c')).toBe('#0F8B8D');
});

it.each(['red;position:fixed;inset:0', 'red', '#fff', '#d62839;', 'url(x)', ''])(
  'a colour that is not #rrggbb (%j) falls back to the fixed operator fallback grey, with light tag text',
  color => {
    const { container } = render(<TourCard {...props} operator={{ ...operator, color }} />);
    const card = container.querySelector('article')!;
    expect(card.style.getPropertyValue('--c')).toBe('var(--op-fallback)');
    expect(screen.getByText('東瀛遊').className).not.toMatch(/opDark/);
    expect(card.style.position).toBe('');
    expect(card.getAttribute('style')).not.toMatch(/position|inset/);
  },
);

it('has no add button without onAdd', () => {
  render(<TourCard {...props} />);
  expect(screen.queryByRole('button')).toBeNull();
});

it('the add button is outside the link and opens the picker', async () => {
  const onAdd = vi.fn();
  render(<TourCard {...props} onAdd={onAdd} />);
  const button = screen.getByRole('button', { name: '加入行程 ＋' });
  expect(cardLink().contains(button)).toBe(false);
  await user.click(button);
  expect(screen.getByText('選擇出發日期')).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: /2026年12月18日/ }));
  expect(onAdd).toHaveBeenCalledWith('2026-12-18');
});

it('closes the picker after a date is chosen and returns focus to the add button', async () => {
  const onAdd = vi.fn();
  render(<TourCard {...props} onAdd={onAdd} />);
  const button = screen.getByRole('button', { name: '加入行程 ＋' });
  await user.click(button);
  await user.click(screen.getByRole('button', { name: /2026年12月20日/ }));
  expect(onAdd).toHaveBeenCalledTimes(1);
  expect(onAdd).toHaveBeenCalledWith('2026-12-20');
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(button).toHaveFocus();
});

it('the picker works from the keyboard and Escape returns focus to the add button', async () => {
  const onAdd = vi.fn();
  render(<TourCard {...props} onAdd={onAdd} />);
  const button = screen.getByRole('button', { name: '加入行程 ＋' });
  expect(button).toHaveAttribute('aria-expanded', 'false');
  await user.tab(); // the card link
  await user.tab(); // the departure dates (one tab stop)
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

it('the close button returns focus to the add button without scrolling', async () => {
  render(<TourCard {...props} onAdd={vi.fn()} />);
  const button = screen.getByRole('button', { name: '加入行程 ＋' });
  await user.click(button);
  const focus = vi.spyOn(button, 'focus');
  await user.click(screen.getByRole('button', { name: '關閉' }));
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(button).toHaveFocus();
  expect(focus).toHaveBeenCalledWith({ preventScroll: true });
});

it('clicking the add button again closes the picker', async () => {
  render(<TourCard {...props} onAdd={vi.fn()} />);
  const button = screen.getByRole('button', { name: '加入行程 ＋' });
  await user.click(button);
  expect(screen.getByRole('dialog')).toBeInTheDocument();
  await user.click(button);
  expect(screen.queryByRole('dialog')).toBeNull();
});

it('clicking outside the picker closes it without adding or moving focus back', async () => {
  const onAdd = vi.fn();
  render(<><p>elsewhere</p><TourCard {...props} onAdd={onAdd} /></>);
  const button = screen.getByRole('button', { name: '加入行程 ＋' });
  await user.click(button);
  const focus = vi.spyOn(button, 'focus');
  await user.click(screen.getByText('elsewhere'));
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(onAdd).not.toHaveBeenCalled();
  expect(focus).not.toHaveBeenCalled();
  expect(button).not.toHaveFocus();
});

it('pressing another control outside leaves focus on that control', async () => {
  render(<><input aria-label="elsewhere" /><TourCard {...props} onAdd={vi.fn()} /></>);
  await user.click(screen.getByRole('button', { name: '加入行程 ＋' }));
  await user.click(screen.getByRole('textbox', { name: 'elsewhere' }));
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(screen.getByRole('textbox', { name: 'elsewhere' })).toHaveFocus();
});

it('the picker lists every departure, with the stored fallback price and 起 for an unpriced date', async () => {
  render(<TourCard {...props} onAdd={vi.fn()} />);
  await user.click(screen.getByRole('button', { name: '加入行程 ＋' }));
  const dialog = screen.getByRole('dialog');
  expect(dialog.querySelectorAll('li')).toHaveLength(6);
  // fallbackPriceHkd (7,499), not fromPriceHkd (7,999).
  expect(screen.getByRole('button', { name: /2026年12月27日/ })).toHaveTextContent('HK$7,499 起');
});

it('hides the price change when the window price differs from the from-price', () => {
  render(<TourCard {...props} tour={{ ...tour, windowPriceHkd: 8999 }} />);
  expect(screen.queryByText(/比7日前/)).toBeNull();
  expect(screen.getByText(/HK\$8,999/, priceDiv)).toBeInTheDocument();
});

it('shows no price change line when there is no change data', () => {
  render(<TourCard {...props} tour={{ ...tour, priceChange: null }} />);
  expect(screen.queryByText(/日前/)).toBeNull();
});

it('shows the start note only for a non-HK, non-Shenzhen start', () => {
  const { unmount } = render(<TourCard {...props} />);
  expect(screen.queryByText(/出發$/)).toBeNull();
  unmount();
  render(<TourCard {...props} tour={{ ...tour, start: { kind: 'other', label: '澳門外港碼頭' } }} />);
  expect(screen.getByText('澳門外港碼頭出發')).toBeInTheDocument();
});

it('shows a footNote and, beneath it, the updated time', () => {
  render(<TourCard {...props} footNote="休息 1–2 日後出發" />);
  const note = screen.getByText('休息 1–2 日後出發');
  const updated = screen.getByText('更新：今日 03:10');
  expect(note.parentElement).toBe(updated.parentElement); // together, on the footer's left side
  expect(note.compareDocumentPosition(updated) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy(); // the note first
  expect(screen.getByText('前往東瀛遊網站 ↗').previousElementSibling).toBe(note.parentElement);
});

it('a footNote with a bad last-updated timestamp shows the foot note alone', () => {
  render(<TourCard {...props} tour={{ ...tour, lastUpdated: 'garbage' }} footNote="休息 1–2 日後出發" />);
  expect(screen.getByText('休息 1–2 日後出發')).toBeInTheDocument();
  expect(screen.queryByText(/更新/)).toBeNull();
});

it('renders no image and no description', () => {
  const { container } = render(<TourCard {...props} />);
  expect(container.querySelector('img')).toBeNull();
  expect(screen.queryByText(tour.title)).toBeNull();
});

it('shows a long route in full', () => {
  const ten = ['osaka', 'kyoto', 'nara', 'kobe', 'osaka', 'kyoto', 'nara', 'kobe', 'osaka', 'kyoto'];
  render(<TourCard {...props} tour={{ ...tour, stops: ten.map(c => kansai(`japan-kansai-${c}`)) }} />);
  expect(screen.getByRole('heading')).toHaveTextContent('大阪→京都→奈良→神戶→大阪→京都→奈良→神戶→大阪→京都');
  const css = cardCss();
  expect(css).toMatch(/\.route \{[^}]*overflow-wrap: anywhere/);
  expect(css).not.toMatch(/\.route \{[^}]*(text-overflow|white-space: nowrap)/);
});

it('a bad price-change date drops only the change line', () => {
  render(<TourCard {...props} tour={{ ...tour, priceChange: { kind: 'lower', diffHkd: 500, sinceDate: 'not-a-date' } }} />);
  expect(screen.queryByText(/日前/)).toBeNull();
  expect(screen.getByText(/HK\$7,999/, priceDiv)).toBeInTheDocument();
  expect(screen.getByText('更新：今日 03:10')).toBeInTheDocument();
});

it('a bad last-updated timestamp drops only the updated text', () => {
  render(<TourCard {...props} tour={{ ...tour, lastUpdated: 'garbage' }} />);
  expect(screen.queryByText(/更新/)).toBeNull();
  expect(screen.getByText('前往東瀛遊網站 ↗')).toBeInTheDocument();
  expect(screen.getByText('↓ HK$500　比7日前', keepSpaces)).toBeInTheDocument();
});

it('a bad today drops the change line and the updated text but renders the card', () => {
  render(<TourCard {...props} today="garbage" />);
  expect(screen.queryByText(/日前/)).toBeNull();
  expect(screen.getByRole('heading')).toHaveTextContent('大阪→京都→奈良→神戶');
  expect(screen.getByText(/12\/18$/)).toBeInTheDocument();
});

it('a departure with a bad date is left out of the chips and the picker', async () => {
  const departures = [{ date: '2026-12-32', priceHkd: 7999 }, ...tour.departures.slice(0, 2)];
  render(<TourCard {...props} tour={{ ...tour, departures }} onAdd={vi.fn()} />);
  expect(screen.getByText('12/18')).toBeInTheDocument();
  expect(screen.queryByText(/NaN|12\/32/)).toBeNull();
  await user.click(screen.getByRole('button', { name: '加入行程 ＋' }));
  expect(screen.getByRole('dialog').querySelectorAll('li')).toHaveLength(2);
});

it('in English: day-first chip dates, "from" before the price, and the add button', () => {
  render(<TourCard {...props} t={makeT('en')} onAdd={() => {}} />);
  const dates = within(screen.getByRole('group', { name: 'Departure dates' })).getAllByRole('link').map(a => a.firstChild!.textContent);
  expect(dates).toEqual(['18 Dec', '20 Dec', '23 Dec', '27 Dec']);
  expect(screen.getByText('+2 more dates')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: '27 Dec from HK$7,499' })).toBeInTheDocument();
  expect(screen.getByText(/HK\$7,999/, priceDiv).closest('div')).toHaveTextContent(/^from HK\$7,999$/);
  expect(screen.getByRole('button', { name: '+ Add to trip' })).toBeInTheDocument();
});

it('in Simplified Chinese the chips and the price read as in Traditional', () => {
  render(<TourCard {...props} t={makeT('zh-Hans')} />);
  expect(screen.getByText('12/18')).toBeInTheDocument();
  expect(screen.getByText(/HK\$7,999/, priceDiv).closest('div')).toHaveTextContent(/^HK\$7,999 起$/);
});
