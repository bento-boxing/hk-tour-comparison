'use client';

import { useEffect, useRef, type KeyboardEvent, type RefObject } from 'react';

/** 'outside': a press outside the popover (leave focus where the visitor pressed); 'escape': Escape inside it. */
export type DismissReason = 'escape' | 'outside';

/** True for a keydown that belongs to an IME composition. Safari fires compositionend first, then the keydown with keyCode 229. */
export function isImeKeyDown(e: KeyboardEvent): boolean {
  return e.nativeEvent.isComposing || e.keyCode === 229;
}

/**
 * The dismissal shared by the site's non-modal popovers (the card's date picker, the filter popovers):
 * a pointerdown anywhere outside `rootRef` and `openerRef` calls onDismiss('outside'), and the returned handler, put
 * on the popover's onKeyDown, calls onDismiss('escape') for Escape. Escape is handled on the popover, not the
 * document, so Escape pressed in another widget stays with that widget; it is not passed on to enclosing
 * widgets, and an Escape that ends an IME composition is ignored.
 *
 * A press on the opener (the pill or button that toggles the popover) is left to the opener's own click, which
 * closes it: counted as outside, it would close the popover only for that click to open it again, new and empty.
 * The opener cannot keep its press from this listener by stopping it: in the App Router React's root is the
 * document, the very node this listens on, so a press stopped in React still reaches it.
 */
export function usePopoverDismiss(
  rootRef: RefObject<HTMLElement | null>,
  onDismiss: (reason: DismissReason) => void,
  openerRef?: RefObject<HTMLElement | null>,
): (e: KeyboardEvent<HTMLElement>) => void {
  // Read through a ref so the document listener is attached once, not on every render.
  const onDismissRef = useRef(onDismiss);
  useEffect(() => { onDismissRef.current = onDismiss; });

  useEffect(() => {
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target;
      if (!(target instanceof Node) || rootRef.current?.contains(target) || openerRef?.current?.contains(target)) return;
      onDismissRef.current('outside');
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => { document.removeEventListener('pointerdown', onPointerDown); };
  }, [rootRef, openerRef]);

  return e => {
    if (e.key === 'Escape' && !isImeKeyDown(e)) { e.preventDefault(); e.stopPropagation(); onDismissRef.current('escape'); }
  };
}
