'use client';

import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import styles from './FilterBar.module.css';

/** How a popover was closed ('outside': focus stays where the visitor pressed; otherwise it returns to the pill). */
type CloseReason = 'escape' | 'done' | 'outside';

const FOCUSABLE = 'button:not([disabled]), input:not([disabled])';

export interface FilterPopoverProps {
  /** The pill's text, e.g. '日數：4–6日'; also its accessible name. */
  label: string;
  /** The popover's heading and accessible name, e.g. '日數'. */
  title: string;
  /** Filled (cerulean) when the pill's filter is set. */
  on: boolean;
  wide?: boolean;
  /** The popover's content; call `done` after applying a choice to close it and return focus to the pill. */
  children: (done: () => void) => ReactNode;
}

/**
 * A filter pill (mockup `.f`) that opens a non-modal dialog below it. Works the same way as the card's
 * DeparturePicker: focus moves to the first control inside; Escape inside it, or pressing the pill again,
 * closes it and returns focus to the pill; a press outside closes it and leaves focus where the visitor pressed.
 */
export function FilterPopover({ label, title, on, wide, children }: FilterPopoverProps) {
  const [open, setOpen] = useState(false);
  const pillRef = useRef<HTMLButtonElement>(null);

  const close = (reason: CloseReason) => {
    setOpen(false);
    if (reason !== 'outside') pillRef.current?.focus({ preventScroll: true });
  };

  return (
    <div className={styles.slot}>
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
        onClick={() => (open ? close('done') : setOpen(true))}
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

function PopoverPanel({ title, wide, onClose, children }: { title: string; wide?: boolean; onClose: (reason: CloseReason) => void; children: ReactNode }) {
  const titleId = useId();
  const rootRef = useRef<HTMLDivElement>(null);

  // Read through a ref so the document listener below is attached once, not on every render.
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; });

  useEffect(() => {
    rootRef.current?.querySelector<HTMLElement>(FOCUSABLE)?.focus();
  }, []);

  useEffect(() => {
    const onPointerDown = (e: PointerEvent) => {
      if (e.target instanceof Node && !rootRef.current?.contains(e.target)) onCloseRef.current('outside');
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => { document.removeEventListener('pointerdown', onPointerDown); };
  }, []);

  // On the dialog, not the document, so Escape pressed in another widget stays with that widget.
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape' && !e.nativeEvent.isComposing) { e.preventDefault(); e.stopPropagation(); onClose('escape'); }
  };

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
