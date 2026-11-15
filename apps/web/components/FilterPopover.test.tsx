import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { it, expect, vi, afterEach, describe } from 'vitest';
import { act, render, screen, fireEvent } from '@testing-library/react';
import { FilterPopover, fitShift } from './FilterPopover';

describe('fitShift', () => {
  it('leaves a popover that fits where it is', () => {
    expect(fitShift(100, 240, 1280)).toBe(0);
    expect(fitShift(1032, 240, 1280)).toBe(0); // its right edge exactly 8 px inside
  });

  it('moves one that would run off the right edge back inside, 8 px from it', () => {
    // The reviewer's case: the sort pill at 604 px in a 900 px window, a 400 px popover.
    expect(fitShift(604, 400, 900)).toBe(-112);
    expect(604 - 112 + 400).toBe(900 - 8);
  });

  it('never moves it past the left edge: 8 px from it at most', () => {
    expect(fitShift(100, 400, 410)).toBe(-92);
    expect(fitShift(2, 240, 1280)).toBe(6);
  });

  it('does nothing before layout (no width, as in a test page)', () => {
    expect(fitShift(0, 0, 0)).toBe(0);
    expect(fitShift(600, 400, 0)).toBe(0);
  });
});

describe('the popover keeps inside the window', () => {
  afterEach(() => { vi.restoreAllMocks(); });

  /** A window `viewport` px wide in which the popover would start at `left` and be `width` wide. */
  function layout(viewport: number, left: number, width: number) {
    vi.spyOn(document.documentElement, 'clientWidth', 'get').mockImplementation(() => viewport);
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      if (this.getAttribute('role') !== 'dialog') return new DOMRect(0, 0, 0, 0);
      const applied = parseFloat(this.style.left || '0');
      return new DOMRect(left + applied, 40, width, 200);
    });
  }

  function Pop({ open }: { open: boolean }) {
    return (
      <FilterPopover label="排序：價錢 低→高" title="排序" on={false} open={open} onOpenChange={() => {}} wide>
        {() => <button type="button">低→高</button>}
      </FilterPopover>
    );
  }

  it('is shifted left when it would overflow, and not when it fits', () => {
    layout(900, 604, 400);
    const { rerender } = render(<Pop open />);
    expect(screen.getByRole('dialog').style.left).toBe('-112px');
    rerender(<Pop open={false} />);
    vi.restoreAllMocks();
    layout(1280, 604, 400);
    rerender(<Pop open />);
    expect(screen.getByRole('dialog').style.left).toBe('');
  });

  it('is measured again when the window is resized', () => {
    layout(1280, 604, 400);
    render(<Pop open />);
    expect(screen.getByRole('dialog').style.left).toBe('');
    vi.restoreAllMocks();
    layout(900, 604, 400);
    act(() => { fireEvent(window, new Event('resize')); });
    expect(screen.getByRole('dialog').style.left).toBe('-112px');
    vi.restoreAllMocks();
    layout(1280, 604, 400);
    act(() => { fireEvent(window, new Event('resize')); });
    expect(screen.getByRole('dialog').style.left).toBe('');
  });
});

it('a wide popover is never wider than the window less the page gutters', () => {
  const css = readFileSync(join(__dirname, 'FilterBar.module.css'), 'utf8').replace(/\s+/g, ' ');
  expect(css).toMatch(/\.wide \{ width: min\(400px, calc\(100vw - 32px\)\); \}/);
  expect(css).toMatch(/\.popover \{[^}]*max-width: calc\(100vw - 32px\)/);
});
