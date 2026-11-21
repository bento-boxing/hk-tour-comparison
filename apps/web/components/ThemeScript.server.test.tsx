// @vitest-environment node
import { it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { THEME_SCRIPT } from '../lib/theme';
import { ThemeScript } from './ThemeScript';

// On the server (no window): what the served HTML holds.

it('on the server: a plain <script> with the theme script, no type (so the browser runs it), nothing else', () => {
  expect(typeof window).toBe('undefined');
  expect(renderToStaticMarkup(<ThemeScript />)).toBe(`<script>${THEME_SCRIPT}</script>`);
});
