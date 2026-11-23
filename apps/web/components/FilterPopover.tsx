'use client';

import { useEffect, useId, useLayoutEffect, useRef, useState, type FocusEvent, type ReactNode, type RefObject } from 'react';
import { usePopoverDismiss, type DismissReason } from '../lib/use-popover-dismiss';
import styles from './FilterBar.module.css';

/** How a popover was closed ('outside': focus stays where it went; otherwise it returns to the pill). */
type CloseReason = DismissReason | 'done';

const FOCUSABLE = 'button:not([disabled]), input:not([disabled])';

/** The least room kept between a popover and either side of the window, in px. */
const EDGE = 8;

/**
 * How far to move a popover sideways (px, negative = left) so it stays inside a window `viewport` px wide:
 * none when it fits where it hangs (from its pill's left edge, `naturalLeft` px from the window's left);
 * otherwise just enough that its right edge is EDGE px inside, and never so far that its left edge is
 * nearer than EDGE. Zero before layout (no width), as in a test page.
 */
export function fitShift(naturalLeft: number, width: number, viewport: number): number {
  if (viewport <= 0 || width <= 0) return 0;
  const left = Math.max(EDGE, Math.min(naturalLeft, viewport - EDGE - width));
  return left - naturalLeft;
}

export interface FilterPopoverProps {
  /** The pill's text, e.g. '日數：4–6日'; also its accessible name. */
  label: string;
  /** The popover's heading and accessible name, e.g. '日數'. */
  title: string;
  /** Filled (the chosen colour) when the box's filter is set. */
  on: boolean;
  wide?: boolean;
  /**
   * The sort control: set apart at the right end of the row by a heavier outline, bold text and a sort icon
   * (mock-up Rows), and never filled. Its popover hangs from its right edge.
   */
  sort?: boolean;
  /**
   * What phones show in place of `label` (the sort control in the phone bar shows '價錢 低→高' or 'Cheapest first',
   * not '排序：價錢 低→高'). `label` stays the accessible name, hidden from sight under 1024px only.
   */
  shortLabel?: string;
  /** Controlled by the filter bar, which keeps at most one popover open. */
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The popover's content; call `done` after applying a choice to close it and return focus to the pill. */
  children: (done: () => void) => ReactNode;
}

/**
 * A filter box (mock-up Rows) that opens a non-modal dialog below it, dismissed like the card's
 * DeparturePicker (lib/use-popover-dismiss): focus moves to the first control inside; Escape inside it,
 * or pressing the pill again, closes it and returns focus to the pill; a press outside, or focus moving
 * to anything other than the popover and its pill (Tab), closes it and leaves focus where it went.
 */
export function FilterPopover({ label, title, on, wide, sort, shortLabel, open, onOpenChange, children }: FilterPopoverProps) {
  const pillRef = useRef<HTMLButtonElement>(null);

  const close = (reason: CloseReason) => {
    onOpenChange(false);
    if (reason !== 'outside') pillRef.current?.focus({ preventScroll: true });
  };

  // focusout bubbles, so this sees focus leaving the pill or anything in the popover. A null relatedTarget
  // (the window lost focus, or a press on something unfocusable, which the pointerdown rule handles) keeps it open.
  const onBlur = (e: FocusEvent<HTMLDivElement>) => {
    const next = e.relatedTarget;
    if (open && next instanceof Node && !e.currentTarget.contains(next)) close('outside');
  };

  return (
    <div className={sort ? `${styles.slot} ${styles.sortSlot}` : styles.slot} onBlur={onBlur}>
      <button
        ref={pillRef}
        type="button"
        className={sort ? `${styles.f} ${styles.sort}` : styles.f}
        data-on={on && !sort ? 'true' : undefined}
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => (open ? close('done') : onOpenChange(true))}
      >
        {sort && <SortIcon />}
        {shortLabel ? (
          // One box, as the bare text was: the row lays it out exactly as before. Under 1024px the label is hidden
          // from sight and the short text shows instead, drawn by CSS from data-short (not part of the name).
          <span className={styles.pillText}>
            <span className={styles.pillFull}>{label}</span>
            <span className={styles.pillShort} data-short={shortLabel} aria-hidden="true" />
          </span>
        ) : label}
      </button>
      {open && (
        <PopoverPanel title={title} wide={wide} openerRef={pillRef} onClose={close}>
          {children(() => close('done'))}
        </PopoverPanel>
      )}
    </div>
  );
}

/** Two arrows, down and up (mock-up Rows), in the control's text colour. */
function SortIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" focusable="false" className={styles.sortIcon}>
      <path
        d="M7 5v14M7 19l-3-3M7 19l3-3M17 19V5M17 5l-3 3M17 5l3 3"
        fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
      />
    </svg>
  );
}

function PopoverPanel({ title, wide, openerRef, onClose, children }: {
  title: string; wide?: boolean; openerRef: RefObject<HTMLElement | null>; onClose: (reason: DismissReason) => void; children: ReactNode;
}) {
  const titleId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  // A press on the pill is not outside: the pill's click closes the popover.
  const onKeyDown = usePopoverDismiss(rootRef, onClose, openerRef);
  // The CSS hangs the popover from its pill's left edge; a pill near the right of the window would push it
  // off the screen, so it is measured before it is painted (and again on resize) and moved back inside.
  const [shift, setShift] = useState(0);

  useLayoutEffect(() => {
    const fit = () => {
      const el = rootRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const applied = parseFloat(el.style.left || '0');
      setShift(fitShift(rect.left - applied, rect.width, document.documentElement.clientWidth));
    };
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, []);

  useEffect(() => {
    rootRef.current?.querySelector<HTMLElement>(FOCUSABLE)?.focus();
  }, []);

  return (
    <div
      ref={rootRef}
      role="dialog"
      aria-labelledby={titleId}
      className={wide ? `${styles.popover} ${styles.wide}` : styles.popover}
      style={shift !== 0 ? { left: `${shift}px` } : undefined}
      onKeyDown={onKeyDown}
    >
      <span id={titleId} className={styles.title}>{title}</span>
      {children}
    </div>
  );
}
