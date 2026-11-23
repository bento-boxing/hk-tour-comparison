import { it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { IsoDate, ScrapedDeparture } from '@hktours/core';
import { DeparturePicker, type PickerCloseReason } from './DeparturePicker';
import { makeT } from '../lib/i18n';

const tZh = makeT('zh-Hant');

const departures: ScrapedDeparture[] = [
  { date: '2026-12-18', priceHkd: 7999 },
  { date: '2026-12-20', priceHkd: null },
  { date: '2026-12-23', priceHkd: 8299 },
];

let onPick: ReturnType<typeof vi.fn<(date: IsoDate) => void>>;
let onClose: ReturnType<typeof vi.fn<(reason: PickerCloseReason) => void>>;
let user: ReturnType<typeof userEvent.setup>;
beforeEach(() => {
  onPick = vi.fn<(date: IsoDate) => void>();
  onClose = vi.fn<(reason: PickerCloseReason) => void>();
  user = userEvent.setup();
});

const renderPicker = (list = departures, today: IsoDate = '2026-11-12') =>
  render(<DeparturePicker departures={list} fallbackPriceHkd={7999} today={today} t={tZh} onPick={onPick} onClose={onClose} />);

it('is a dialog titled 選擇出發日期', () => {
  renderPicker();
  expect(screen.getByRole('dialog', { name: '選擇出發日期' })).toBeInTheDocument();
});

it('lists every departure with weekday and price', () => {
  renderPicker();
  const first = screen.getByRole('button', { name: /2026年12月18日/ });
  expect(first).toHaveTextContent('2026年12月18日（五）');
  expect(first).toHaveTextContent('HK$7,999');
  expect(first).not.toHaveTextContent('起');
  expect(screen.getByRole('button', { name: /2026年12月23日（三）/ })).toHaveTextContent('HK$8,299');
  expect(screen.getAllByRole('listitem')).toHaveLength(3);
});

it('names each date button with its date and price', () => {
  renderPicker();
  expect(screen.getByRole('button', { name: '2026年12月18日（五） HK$7,999' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: '2026年12月20日（日） HK$7,999 起' })).toBeInTheDocument();
});

it('shows the fallback price with 起 when a date has no price', () => {
  renderPicker();
  expect(screen.getByRole('button', { name: /2026年12月20日/ })).toHaveTextContent('HK$7,999 起');
});

it('calls onPick with the ISO date', async () => {
  renderPicker();
  await user.click(screen.getByRole('button', { name: /2026年12月23日/ }));
  expect(onPick).toHaveBeenCalledTimes(1);
  expect(onPick).toHaveBeenCalledWith('2026-12-23');
  expect(onClose).not.toHaveBeenCalled();
});

it('closes on Escape', async () => {
  renderPicker();
  await user.keyboard('{Escape}');
  expect(onClose).toHaveBeenCalledTimes(1);
  expect(onClose).toHaveBeenCalledWith('escape');
  expect(onPick).not.toHaveBeenCalled();
});

it.each([
  ['isComposing', { isComposing: true }],
  ['keyCode 229 (Safari, after compositionend)', { keyCode: 229 }],
])('an Escape that ends an IME composition (%s) does not close', (_, init) => {
  renderPicker();
  fireEvent.keyDown(screen.getByRole('button', { name: /2026年12月18日/ }), { key: 'Escape', ...init });
  expect(onClose).not.toHaveBeenCalled();
});

it('closes on a click outside, not on a click inside', async () => {
  render(<><p>outside</p><DeparturePicker departures={departures} fallbackPriceHkd={7999} today="2026-11-12" t={tZh} onPick={onPick} onClose={onClose} /></>);
  await user.click(screen.getByText('選擇出發日期'));
  expect(onClose).not.toHaveBeenCalled();
  await user.click(screen.getByText('outside'));
  expect(onClose).toHaveBeenCalledTimes(1);
  expect(onClose).toHaveBeenCalledWith('outside');
});

it('has a close button', async () => {
  renderPicker();
  await user.click(screen.getByRole('button', { name: '關閉' }));
  expect(onClose).toHaveBeenCalledTimes(1);
  expect(onClose).toHaveBeenCalledWith('closeButton');
});

it('focuses the first date on open', () => {
  renderPicker();
  expect(screen.getByRole('button', { name: /2026年12月18日/ })).toHaveFocus();
});

it('the dates can be reached with Tab and chosen with Enter', async () => {
  renderPicker();
  await user.tab();
  expect(screen.getByRole('button', { name: /2026年12月20日/ })).toHaveFocus();
  await user.keyboard('{Enter}');
  expect(onPick).toHaveBeenCalledWith('2026-12-20');
});

it('still opens with exactly one departure', () => {
  renderPicker([{ date: '2026-12-18', priceHkd: 7999 }]);
  expect(screen.getByText('選擇出發日期')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /2026年12月18日（五）/ })).toHaveFocus();
});

it('leaves out a date that is today', () => {
  renderPicker([{ date: '2026-11-12', priceHkd: 6999 }, ...departures], '2026-11-12');
  expect(screen.queryByRole('button', { name: /2026年11月12日/ })).toBeNull();
  expect(screen.getAllByRole('listitem')).toHaveLength(3);
});

it('leaves out dates before today', () => {
  renderPicker([{ date: '2026-11-11', priceHkd: 6999 }, ...departures], '2026-11-12');
  expect(screen.queryByRole('button', { name: /2026年11月11日/ })).toBeNull();
  expect(screen.getAllByRole('listitem')).toHaveLength(3);
});

it('with no date left after today (a page made before midnight, opened after it), says so, with focus on the close button', () => {
  renderPicker([{ date: '2026-11-12', priceHkd: 6999 }], '2026-11-12');
  expect(screen.queryByRole('list')).toBeNull();
  expect(screen.getByRole('dialog')).toHaveTextContent('出發日期已過');
  expect(screen.getByRole('button', { name: '關閉' })).toHaveFocus();
});

it('reads naturally in English', () => {
  const tEn = makeT('en');
  render(<DeparturePicker departures={departures} fallbackPriceHkd={7999} today="2026-11-12" t={tEn} onPick={onPick} onClose={onClose} />);
  expect(screen.getByRole('dialog', { name: 'Choose a departure date' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Fri 18 Dec 2026 HK$7,999' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Sun 20 Dec 2026 from HK$7,999' })).toBeInTheDocument();
});

it('without onPick (a phone card\'s list of all its dates): titled as asked, each date a link to the operator\'s page; focus on the first', () => {
  render(<DeparturePicker
    departures={departures} fallbackPriceHkd={7999} today="2026-11-12" t={tZh} onClose={onClose} title="出發日期"
    link={{ href: 'https://example.test/egl/KIX5', target: '_blank', rel: 'noopener noreferrer' }}
  />);
  const dialog = screen.getByRole('dialog', { name: '出發日期' });
  const links = screen.getAllByRole('link');
  expect(links).toHaveLength(3);
  expect(links[0]).toHaveFocus();
  expect(links[1]).toHaveTextContent('2026年12月20日（日） HK$7,999 起');
  for (const a of links) expect(a).toHaveAttribute('href', 'https://example.test/egl/KIX5');
  expect(screen.queryByRole('button', { name: /2026年/ })).toBeNull();
  expect(dialog.className).not.toMatch(/start/);
});

it('without onPick or a link: the dates as text; opened from the left (placement start) it grows rightwards', () => {
  render(<DeparturePicker departures={departures} fallbackPriceHkd={7999} today="2026-11-12" t={tZh} onClose={onClose} placement="start" />);
  expect(screen.queryAllByRole('link')).toHaveLength(0);
  expect(screen.getAllByRole('listitem')).toHaveLength(3);
  expect(screen.getByRole('button', { name: '關閉' })).toHaveFocus();
  expect(screen.getByRole('dialog').className).toMatch(/start/);
});

it('on a phone it is scrolled fully into view as it opens; not from 1024px', () => {
  const scroll = vi.fn();
  Element.prototype.scrollIntoView = scroll;
  try {
    for (const [phone, calls] of [[true, 1], [false, 0]] as const) {
      scroll.mockClear();
      window.matchMedia = vi.fn().mockReturnValue({ matches: phone }) as unknown as typeof window.matchMedia;
      const { unmount } = renderPicker();
      expect(window.matchMedia).toHaveBeenCalledWith('(max-width: 1023px)');
      expect(scroll).toHaveBeenCalledTimes(calls);
      if (calls) {
        expect(scroll).toHaveBeenCalledWith({ block: 'nearest' });
        expect(scroll.mock.contexts[0]).toBe(screen.getByRole('dialog'));
        // Marked for the bottom bar, which slides away while it is open (components/TabBar.module.css).
        expect(screen.getByRole('dialog')).toHaveAttribute('data-departure-picker');
      }
      unmount();
    }
  } finally {
    delete (Element.prototype as Partial<Element>).scrollIntoView;
    delete (window as Partial<Window>).matchMedia;
  }
});
