import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach } from 'vitest';

// For tests only: a *.test-utils file, which lib/test-utils-guard.test.ts keeps out of the site's code.
// Testing Library's render puts React's root on a div of its own; in the App Router React's root is the
// document itself (Next.js hydrates <html> into it), so React's event listeners sit on the same node as a
// document.addEventListener of the page's own, and an event a component stops in React still reaches that listener.
// What depends on that (a popover's press outside, lib/use-popover-dismiss) is tested here as on the site.

let root: Root | null = null;

/** Renders `ui` inside <html><body>, with React's root on the document, as the App Router does. One at a time. */
export async function renderAtDocument(ui: ReactNode): Promise<void> {
  if (root) throw new Error('renderAtDocument: one root at a time');
  // Any earlier root (an ordinary render in the same file) marked the document as listened to (React adds its
  // selectionchange listener there), and a root on the document would then attach no listeners at all. On the site
  // the document's root is the first and only one, so the mark is cleared here.
  for (const key of Object.keys(document)) if (key.startsWith('_reactListening')) delete (document as unknown as Record<string, unknown>)[key];
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const next = createRoot(document as unknown as Element);
  root = next;
  await act(async () => { next.render(<html><head /><body>{ui}</body></html>); });
}

afterEach(async () => {
  const done = root;
  root = null;
  if (done) await act(async () => { done.unmount(); });
});
