import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MAX_GAP_DAYS } from '@hktours/core';
import { translate, type T } from '../lib/i18n';
import { GapSelector } from './GapSelector';

const t: T = (key, vars) => translate('zh-Hant', key, vars);

let onChange: ReturnType<typeof vi.fn<(gap: { min: number; max: number }) => void>>;
let user: ReturnType<typeof userEvent.setup>;
beforeEach(() => { onChange = vi.fn(); user = userEvent.setup(); });

const min = () => screen.getByRole('textbox', { name: '最少' });
const max = () => screen.getByRole('textbox', { name: '最多' });
const renderGap = (gap = { min: 1, max: 3 }) => render(<GapSelector gap={gap} onChange={onChange} t={t} />);

/** Replaces a field's text by typing, as a visitor would, leaving focus in the field. */
const typeInto = async (field: HTMLElement, text: string) => {
  await user.clear(field);
  if (text !== '') await user.type(field, text);
};

describe('the fields', () => {
  it('shows the current gap as [1] – [3] 日, grouped under 休息', () => {
    renderGap();
    expect(min()).toHaveValue('1');
    expect(max()).toHaveValue('3');
    const group = screen.getByRole('group', { name: '休息' });
    expect(group).toContainElement(min());
    expect(group).toContainElement(max());
    expect(screen.getByText('–')).toBeInTheDocument();
    expect(screen.getByText('日')).toBeInTheDocument();
    expect(min().compareDocumentPosition(max()) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('are text fields that bring up the number pad: inputmode numeric, pattern [0-9]*', () => {
    renderGap();
    for (const field of [min(), max()]) {
      expect(field.tagName).toBe('INPUT');
      expect(field).toHaveAttribute('type', 'text');
      expect(field).toHaveAttribute('inputmode', 'numeric');
      expect(field).toHaveAttribute('pattern', '[0-9]*');
    }
    expect(screen.queryByRole('combobox')).toBeNull();
    expect(screen.queryByRole('spinbutton')).toBeNull();
  });

  it('work from the keyboard: Tab goes from minimum to maximum', async () => {
    renderGap();
    await user.tab();
    expect(min()).toHaveFocus();
    await user.tab();
    expect(max()).toHaveFocus();
  });

  it('are narrow, at least 44 px tall, and use only theme colours', () => {
    const css = readFileSync(join(__dirname, 'GapSelector.module.css'), 'utf8').replace(/\s+/g, ' ');
    expect(css).toMatch(/\.input \{[^}]*min-height: 44px/);
    expect(css).toMatch(/\.input \{[^}]*width: [^;]*ch/);
    expect(css).not.toMatch(/#[0-9a-f]{3,8}\b/i);
    expect(css).not.toMatch(/rgb|hsl/i);
  });
});

describe('typing', () => {
  it('strips anything that is not a digit', async () => {
    renderGap();
    await typeInto(max(), 'a1-.e2 ');
    expect(max()).toHaveValue('12');
  });

  it('accepts full-width digits from a Chinese input method as digits', async () => {
    renderGap();
    await user.clear(max());
    fireEvent.change(max(), { target: { value: '１２' } });
    expect(max()).toHaveValue('12');
  });

  it('applies nothing while typing: 1 on the way to 10 does not reload the list', async () => {
    renderGap();
    await typeInto(max(), '10');
    expect(max()).toHaveValue('10');
    expect(onChange).not.toHaveBeenCalled();
  });

  it('allows an empty field while typing, changing nothing', async () => {
    renderGap();
    await typeInto(min(), '');
    expect(min()).toHaveValue('');
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe('applying', () => {
  it('Enter applies the typed value', async () => {
    renderGap();
    await typeInto(max(), '10');
    await user.keyboard('{Enter}');
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith({ min: 1, max: 10 });
    expect(max()).toHaveFocus();
  });

  it('leaving the field applies the typed value', async () => {
    renderGap();
    await typeInto(min(), '0');
    await user.tab();
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith({ min: 0, max: 3 });
  });

  it('a number above the limit becomes the limit', async () => {
    expect(MAX_GAP_DAYS).toBe(30);
    renderGap();
    await typeInto(max(), '99');
    await user.keyboard('{Enter}');
    expect(onChange).toHaveBeenCalledWith({ min: 1, max: 30 });
    expect(max()).toHaveValue('30');
  });

  it('an empty field goes back to the value it had, applying nothing', async () => {
    renderGap();
    await typeInto(min(), '');
    await user.tab();
    expect(min()).toHaveValue('1');
    await typeInto(max(), '');
    await user.keyboard('{Enter}');
    expect(max()).toHaveValue('3');
    expect(onChange).not.toHaveBeenCalled();
  });

  it('a minimum above the maximum moves the maximum to match', async () => {
    renderGap();
    await typeInto(min(), '5');
    await user.keyboard('{Enter}');
    expect(onChange).toHaveBeenCalledWith({ min: 5, max: 5 });
    expect(max()).toHaveValue('5');
  });

  it('a maximum below the minimum moves the minimum to match', async () => {
    renderGap();
    await typeInto(max(), '0');
    await user.keyboard('{Enter}');
    expect(onChange).toHaveBeenCalledWith({ min: 0, max: 0 });
    expect(min()).toHaveValue('0');
  });

  it('leading zeros are read as the number', async () => {
    renderGap();
    await typeInto(max(), '05');
    await user.tab();
    expect(onChange).toHaveBeenCalledWith({ min: 1, max: 5 });
    expect(max()).toHaveValue('5');
  });

  it('the same value again applies nothing, so leaving a field untouched does not reload', async () => {
    renderGap();
    await user.click(min());
    await user.tab();
    await typeInto(max(), '3');
    await user.keyboard('{Enter}');
    await typeInto(max(), '45');
    await user.keyboard('{Enter}'); // 30
    await typeInto(max(), '31');
    await user.keyboard('{Enter}'); // 30 again
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith({ min: 1, max: 30 });
  });

  it('an Enter that commits an input-method candidate applies nothing', () => {
    renderGap();
    fireEvent.change(max(), { target: { value: '7' } });
    fireEvent.keyDown(max(), { key: 'Enter', isComposing: true });
    fireEvent.keyDown(max(), { key: 'Enter', keyCode: 229 }); // Safari: keyCode 229 after compositionend
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.keyDown(max(), { key: 'Enter' });
    expect(onChange).toHaveBeenCalledWith({ min: 1, max: 7 });
  });

  it('editing one field then the other applies each against the latest values', async () => {
    renderGap();
    await typeInto(min(), '4');
    await user.tab(); // applies 4–4
    await typeInto(max(), '9');
    await user.tab();
    expect(onChange.mock.calls).toEqual([[{ min: 4, max: 4 }], [{ min: 4, max: 9 }]]);
  });
});

describe('the address', () => {
  it('a new gap from the address replaces the shown values', () => {
    const { rerender } = renderGap();
    rerender(<GapSelector gap={{ min: 2, max: 8 }} onChange={onChange} t={t} />);
    expect(min()).toHaveValue('2');
    expect(max()).toHaveValue('8');
  });

  it('a new gap from the address leaves a field being typed in alone', async () => {
    const { rerender } = renderGap();
    await typeInto(max(), '1');
    rerender(<GapSelector gap={{ min: 2, max: 8 }} onChange={onChange} t={t} />);
    expect(min()).toHaveValue('2');
    expect(max()).toHaveValue('1');
  });
});
