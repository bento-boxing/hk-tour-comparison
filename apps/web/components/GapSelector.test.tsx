import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MAX_GAP_DAYS } from '@hktours/core';
import { translate, type T } from '../lib/i18n';
import { GapSelector } from './GapSelector';

const t: T = (key, vars) => translate('zh-Hant', key, vars);

let onChange: ReturnType<typeof vi.fn<(gap: { min: number; max: number }) => void>>;
let user: ReturnType<typeof userEvent.setup>;
beforeEach(() => { onChange = vi.fn(); user = userEvent.setup(); });

const min = () => screen.getByRole('combobox', { name: '最少' });
const max = () => screen.getByRole('combobox', { name: '最多' });

it('shows the current gap', () => {
  render(<GapSelector gap={{ min: 1, max: 3 }} onChange={onChange} t={t} />);
  expect(min()).toHaveValue('1');
  expect(max()).toHaveValue('3');
  // Shown as '[1] – [3] 日', the two selects grouped under 休息.
  const group = screen.getByRole('group', { name: '休息' });
  expect(group).toContainElement(min());
  expect(group).toContainElement(max());
  expect(screen.getByText('–')).toBeInTheDocument();
  expect(screen.getByText('日')).toBeInTheDocument();
  expect(min().compareDocumentPosition(max()) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
});

it('changing the maximum calls onChange', async () => {
  render(<GapSelector gap={{ min: 1, max: 3 }} onChange={onChange} t={t} />);
  await user.selectOptions(max(), '5');
  expect(onChange).toHaveBeenCalledTimes(1);
  expect(onChange).toHaveBeenCalledWith({ min: 1, max: 5 });
});

it('changing the minimum calls onChange', async () => {
  render(<GapSelector gap={{ min: 1, max: 3 }} onChange={onChange} t={t} />);
  await user.selectOptions(min(), '0');
  expect(onChange).toHaveBeenCalledWith({ min: 0, max: 3 });
});

it('raising the minimum above the maximum raises the maximum too', async () => {
  render(<GapSelector gap={{ min: 1, max: 3 }} onChange={onChange} t={t} />);
  await user.selectOptions(min(), '5');
  expect(onChange).toHaveBeenCalledWith({ min: 5, max: 5 });
});

it('lowering the maximum below the minimum lowers the minimum too', async () => {
  render(<GapSelector gap={{ min: 2, max: 4 }} onChange={onChange} t={t} />);
  await user.selectOptions(max(), '1');
  expect(onChange).toHaveBeenCalledWith({ min: 1, max: 1 });
});

it('offers 0 to 30', () => {
  render(<GapSelector gap={{ min: 1, max: 3 }} onChange={onChange} t={t} />);
  const expected = Array.from({ length: 31 }, (_, i) => String(i));
  expect(MAX_GAP_DAYS).toBe(30);
  for (const select of [min(), max()]) {
    const options = [...select.querySelectorAll('option')];
    expect(options.map(o => o.value)).toEqual(expected);
    expect(options.map(o => o.textContent)).toEqual(expected);
  }
});

it('works from the keyboard', async () => {
  render(<GapSelector gap={{ min: 1, max: 3 }} onChange={onChange} t={t} />);
  await user.tab();
  expect(min()).toHaveFocus();
  await user.tab();
  expect(max()).toHaveFocus();
});

// A closed native select changes its value on each arrow key (and fires change each time). Applying every step
// would navigate once per key, so keyboard changes wait 400 ms for the visitor to stop.
describe('keyboard changes', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  /** What a browser does for one arrow key on a closed select: keydown, then change with the next value. */
  const arrowTo = (select: HTMLElement, value: number) => {
    fireEvent.keyDown(select, { key: 'ArrowDown' });
    fireEvent.change(select, { target: { value: String(value) } });
  };

  it('stepping through several values applies only the last, 400 ms after the last key', () => {
    render(<GapSelector gap={{ min: 1, max: 3 }} onChange={onChange} t={t} />);
    arrowTo(max(), 4);
    act(() => { vi.advanceTimersByTime(300); });
    arrowTo(max(), 5);
    act(() => { vi.advanceTimersByTime(300); });
    arrowTo(max(), 6);
    expect(max()).toHaveValue('6'); // the select shows each step at once
    act(() => { vi.advanceTimersByTime(399); });
    expect(onChange).not.toHaveBeenCalled();
    act(() => { vi.advanceTimersByTime(1); });
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith({ min: 1, max: 6 });
  });

  it('the pairing rule applies to the shown values while stepping', () => {
    render(<GapSelector gap={{ min: 1, max: 3 }} onChange={onChange} t={t} />);
    arrowTo(min(), 4);
    arrowTo(min(), 5);
    expect(max()).toHaveValue('5');
    act(() => { vi.advanceTimersByTime(400); });
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith({ min: 5, max: 5 });
  });

  it('leaving the select applies a pending change at once', () => {
    render(<GapSelector gap={{ min: 1, max: 3 }} onChange={onChange} t={t} />);
    arrowTo(max(), 7);
    fireEvent.blur(max());
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith({ min: 1, max: 7 });
    act(() => { vi.advanceTimersByTime(1000); });
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('a pointer selection after keyboard use applies at once', () => {
    render(<GapSelector gap={{ min: 1, max: 3 }} onChange={onChange} t={t} />);
    arrowTo(max(), 4);
    fireEvent.pointerDown(max());
    fireEvent.change(max(), { target: { value: '9' } });
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith({ min: 1, max: 9 });
    act(() => { vi.advanceTimersByTime(1000); });
    expect(onChange).toHaveBeenCalledTimes(1); // the pending keyboard step was replaced, not applied as well
  });

  it('a pending change is dropped when the selector goes away', () => {
    const { unmount } = render(<GapSelector gap={{ min: 1, max: 3 }} onChange={onChange} t={t} />);
    arrowTo(max(), 4);
    unmount();
    act(() => { vi.advanceTimersByTime(1000); });
    expect(onChange).not.toHaveBeenCalled();
  });

  it('a new gap from the address replaces the shown values', () => {
    const { rerender } = render(<GapSelector gap={{ min: 1, max: 3 }} onChange={onChange} t={t} />);
    rerender(<GapSelector gap={{ min: 2, max: 8 }} onChange={onChange} t={t} />);
    expect(min()).toHaveValue('2');
    expect(max()).toHaveValue('8');
  });

  it('Tab is not a value change: a pointer selection afterwards still applies at once', () => {
    render(<GapSelector gap={{ min: 1, max: 3 }} onChange={onChange} t={t} />);
    fireEvent.keyDown(max(), { key: 'Tab' });
    fireEvent.change(max(), { target: { value: '9' } });
    expect(onChange).toHaveBeenCalledWith({ min: 1, max: 9 });
  });
});
