'use client';

import { useSyncExternalStore } from 'react';
import { PHONE_MEDIA } from './breakpoints';

// Where a link to an operator's page opens (task 76): on the phone layout in the same tab, so the phone's Back button
// returns to this site; on the wide layout in a new tab, as before. The server cannot know the visitor's width (the
// stored pages are the same for everyone), so it renders the wide layout's '_blank'; once the page's scripts run, a
// phone's links drop it. Without JavaScript every such link opens a new tab, as before.

function subscribe(listener: () => void): () => void {
  if (typeof window.matchMedia !== 'function') return () => {};
  const query = window.matchMedia(PHONE_MEDIA);
  query.addEventListener('change', listener);
  return () => query.removeEventListener('change', listener);
}

const inBrowser = (): '_blank' | undefined =>
  typeof window.matchMedia === 'function' && window.matchMedia(PHONE_MEDIA).matches ? undefined : '_blank';
const onServer = (): '_blank' => '_blank';

/** The `target` of a link to an operator's page: none (the same tab) on the phone layout, '_blank' on the wide one. */
export function useOperatorLinkTarget(): '_blank' | undefined {
  return useSyncExternalStore(subscribe, inBrowser, onServer);
}
