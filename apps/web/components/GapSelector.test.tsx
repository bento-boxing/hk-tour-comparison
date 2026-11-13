import { it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
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
