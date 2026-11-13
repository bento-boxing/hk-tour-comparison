'use client';

import { useEffect, useId, useRef, type FocusEvent, type ReactNode } from 'react';
import { usePopoverDismiss, type DismissReason } from '../lib/use-popover-dismiss';
import styles from './FilterBar.module.css';

/** How a popover was closed ('outside': focus stays where it went; otherwise it returns to the pill). */
type CloseReason = DismissReason | 'done';

const FOCUSABLE = 'button:not([disabled]), input:not([disabled])';

export interface FilterPopoverProps {
  /** The pill's text, e.g. '日數：4–6日'; also its accessible name. */
  label: string;
  /** The popover's heading and accessible name, e.g. '日數'. */
  title: string;
  /** Filled (cerulean) when the pill's filter is set. */
  on: boolean;
  wide?: boolean;
  /** Controlled by the filter bar, which keeps at most one popover open. */
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The popover's content; call `done` after applying a choice to close it and return focus to the pill. */
  children: (done: () => void) => ReactNode;
}

/**
 * A filter pill (mockup `.f`) that opens a non-modal dialog below it, dismissed like the card's
 * DeparturePicker (lib/use-popover-dismiss): focus moves to the first control inside; Escape inside it,
 * or pressing the pill again, closes it and returns focus to the pill; a press outside, or focus moving
 * to anything other than the popover and its pill (Tab), closes it and leaves focus where it went.
 */
export function FilterPopover({ label, title, on, wide, open, onOpenChange, children }: FilterPopoverProps) {
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
    <div className={styles.slot} onBlur={onBlur}>
      <button
        ref={pillRef}
        type="button"
        className={styles.f}
        data-on={on ? 'true' : undefined}
        aria-expanded={open}
        aria-haspopup="dialog"
        // While open, a press on the pill must not count as "outside" (which would close the popover only
        // for this click to reopen it): the click below closes it instead.
        onPointerDown={e => { if (open) e.stopPropagation(); }}
        onClick={() => (open ? close('done') : onOpenChange(true))}
      >
        {label}
      </button>
      {open && (
        <PopoverPanel title={title} wide={wide} onClose={close}>
          {children(() => close('done'))}
        </PopoverPanel>
      )}
    </div>
  );
}

function PopoverPanel({ title, wide, onClose, children }: { title: string; wide?: boolean; onClose: (reason: DismissReason) => void; children: ReactNode }) {
  const titleId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const onKeyDown = usePopoverDismiss(rootRef, onClose);

  useEffect(() => {
    rootRef.current?.querySelector<HTMLElement>(FOCUSABLE)?.focus();
  }, []);

  return (
    <div
      ref={rootRef}
      role="dialog"
      aria-labelledby={titleId}
      className={wide ? `${styles.popover} ${styles.wide}` : styles.popover}
      onKeyDown={onKeyDown}
    >
      <span id={titleId} className={styles.title}>{title}</span>
      {children}
    </div>
  );
}
