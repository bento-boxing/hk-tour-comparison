import { it, expect, vi, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot, hydrateRoot } from 'react-dom/client';
import { THEME_SCRIPT } from '../lib/theme';
import { ThemeScript } from './ThemeScript';

// In the browser. (On the server: ThemeScript.server.test.tsx.)

// React's own roots below (not Testing Library's): tell React this is a test environment for act().
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

afterEach(() => { vi.restoreAllMocks(); document.body.innerHTML = ''; });

const logged = () => [vi.spyOn(console, 'error').mockImplementation(() => {}), vi.spyOn(console, 'warn').mockImplementation(() => {})];

it('hydrating the served <script> keeps it as served (no type: it has run), with no warning', async () => {
  const spies = logged();
  const container = document.createElement('div');
  container.innerHTML = `<script>${THEME_SCRIPT}</script>`; // what the server sent (innerHTML scripts do not run here)
  document.body.append(container);
  await act(async () => { hydrateRoot(container, <ThemeScript />); });
  const script = container.querySelector('script')!;
  expect(script.hasAttribute('type')).toBe(false);
  expect(script.textContent).toBe(THEME_SCRIPT);
  for (const spy of spies) expect(spy).not.toHaveBeenCalled();
});

it('built by React in the browser (a not-found page\'s document): a text/plain script, which does not run, and no "script tag" error', async () => {
  const spies = logged();
  const container = document.createElement('div');
  document.body.append(container);
  await act(async () => { createRoot(container).render(<ThemeScript />); });
  const script = container.querySelector('script')!;
  expect(script).toHaveAttribute('type', 'text/plain');
  expect(script.textContent).toBe(THEME_SCRIPT);
  for (const spy of spies) expect(spy).not.toHaveBeenCalled();
});
