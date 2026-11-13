import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { it, expect, vi, beforeEach } from 'vitest';
import { render, screen, getDefaultNormalizer } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { places, type Stop } from '@hktours/core';
import type { OperatorInfo, TourCardData } from '@hktours/db';
import { TourCard, MAX_DATE_CHIPS, type TourCardProps } from './TourCard';
import { translate, type T } from '../lib/i18n';

const tZh: T = (key, vars) => translate('zh-Hant', key, vars);

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

let user: ReturnType<typeof userEvent.setup>;
beforeEach(() => { user = userEvent.setup(); });

it('shows the facts from the mockup', () => {
  render(<TourCard {...props} />);
  expect(screen.getByText('東瀛遊')).toBeInTheDocument();
  expect(screen.getByText('日本 · 關西')).toBeInTheDocument();
  expect(screen.getByRole('heading')).toHaveTextContent('大阪→京都→奈良→神戶');
  expect(screen.getByText('5日4夜')).toBeInTheDocument();
  expect(screen.getByText(/HK\$7,999/)).toBeInTheDocument();
  expect(screen.getByText('↓ HK$500　比7日前', keepSpaces)).toBeInTheDocument();
  expect(screen.getByText('更新：今日 03:10')).toBeInTheDocument();
});

it('follows the price with 起 and shows the go-to-operator text', () => {
  render(<TourCard {...props} />);
  expect(screen.getByText(/HK\$7,999/)).toHaveTextContent('HK$7,999 起');
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

it('links to the operator in a new tab', () => {
  render(<TourCard {...props} />);
  const link = screen.getByRole('link');
  expect(link).toHaveAttribute('href', 'https://www.egltours.com/website/itinerary/KIX5');
  expect(link).toHaveAttribute('target', '_blank');
  expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'));
});

it('gives the link a short accessible name instead of the whole card text', () => {
  render(<TourCard {...props} />);
  expect(screen.getByRole('link')).toHaveAccessibleName('東瀛遊：大阪、京都、奈良、神戶，5日4夜，HK$7,999起');
});

it('joins the route in the link name with the dictionary separator', () => {
  const tEn: T = (key, vars) => translate('en', key, vars);
  render(<TourCard {...props} t={tEn} />);
  expect(screen.getByRole('link')).toHaveAccessibleName('東瀛遊: 大阪, 京都, 奈良, 神戶, 5D4N, from HK$7,999');
});

it('describes the link with the price change and the dates', () => {
  render(<TourCard {...props} />);
  const link = screen.getByRole('link');
  expect(link).toHaveAccessibleDescription(/↓ HK\$500\s比7日前/);
  expect(link).toHaveAccessibleDescription(/12\/18.*12\/27.*\+2 個出發日/);
  expect(link).not.toHaveAccessibleDescription(/出發$|解散/);
});

it('describes the link with the start or end note when there is one', () => {
  render(<TourCard {...props} tour={{ ...tour, start: { kind: 'other', label: '澳門' }, end: { kind: 'other', label: '珠海' } }} />);
  expect(screen.getByRole('link')).toHaveAccessibleDescription(/澳門出發 · 珠海解散/);
});

it('a card with no change line and no dates has no dangling description ids', () => {
  render(<TourCard {...props} tour={{ ...tour, priceChange: null, departures: [] }} />);
  expect(screen.getByRole('link')).not.toHaveAttribute('aria-describedby');
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
    expect(screen.getByText(/HK\$7,999/)).toBeInTheDocument();
    expect(screen.getByText('12/18')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '加入行程 ＋' }));
    await user.click(screen.getByRole('button', { name: /2026年12月18日/ }));
    expect(onAdd).toHaveBeenCalledWith('2026-12-18');
  },
);

it('accepts an https url in any letter case', () => {
  render(<TourCard {...props} tour={{ ...tour, url: 'HTTPS://www.egltours.com/x' }} />);
  expect(screen.getByRole('link')).toHaveAttribute('href', 'HTTPS://www.egltours.com/x');
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
  'a colour that is not #rrggbb (%j) falls back to charcoal',
  color => {
    const { container } = render(<TourCard {...props} operator={{ ...operator, color }} />);
    const card = container.querySelector('article')!;
    expect(card.style.getPropertyValue('--c')).toBe('var(--charcoal)');
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
  expect(screen.getByRole('link').contains(button)).toBe(false);
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
  await user.tab(); // the link
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
  expect(screen.getByText(/HK\$8,999/)).toBeInTheDocument();
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
  expect(screen.getByText(/HK\$7,999/)).toBeInTheDocument();
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
