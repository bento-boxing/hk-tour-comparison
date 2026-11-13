import { it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { IsoDate, ScrapedDeparture } from '@hktours/core';
import { DeparturePicker, type PickerCloseReason } from './DeparturePicker';
import { translate, type T } from '../lib/i18n';

const tZh: T = (key, vars) => translate('zh-Hant', key, vars);

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

it('reads sensibly in developer English', () => {
  const tEn: T = (key, vars) => translate('en', key, vars);
  render(<DeparturePicker departures={departures} fallbackPriceHkd={7999} today="2026-11-12" t={tEn} onPick={onPick} onClose={onClose} />);
  expect(screen.getByRole('dialog', { name: 'Choose a departure date' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Fri 18 Dec 2026 HK$7,999' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Sun 20 Dec 2026 HK$7,999 from' })).toBeInTheDocument();
});
