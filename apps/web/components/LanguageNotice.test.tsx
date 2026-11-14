import { it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { render, screen } from '@testing-library/react';
import { makeT } from '../lib/i18n';
import { LanguageNotice } from './LanguageNotice';
import styles from './LanguageNotice.module.css';

const css = () => readFileSync(join(__dirname, 'LanguageNotice.module.css'), 'utf8').replace(/\s+/g, ' ');

it('is absent in Traditional Chinese, with no space kept for it', () => {
  const { container } = render(<LanguageNotice t={makeT('zh-Hant')} />);
  expect(container).toBeEmptyDOMElement();
});

it.each([
  ['zh-Hans', '旅行团一般以粤语进行，详情请向旅行社查询。'],
  ['en', 'Tours are normally conducted in Cantonese. Check with the operator.'],
] as const)('in %s: a note (not an alert) in that language, fixed, with an unseen copy in the flow that offsets the page', (locale, text) => {
  const { container } = render(<LanguageNotice t={makeT(locale)} />);
  const note = screen.getByRole('note');
  expect(note).toHaveTextContent(text);
  expect(screen.queryByRole('alert')).toBeNull();
  expect(screen.queryByRole('button')).toBeNull(); // it cannot be dismissed
  expect(note).toHaveClass(styles.fixed);
  // The offset: the same text in the same box, in the page flow, hidden from assistive technology.
  const spacer = container.querySelector('[data-notice-spacer]');
  expect(spacer).not.toBeNull();
  expect(spacer).toHaveAttribute('aria-hidden', 'true');
  expect(spacer).toHaveClass(styles.notice, styles.spacer);
  expect(spacer).not.toHaveClass(styles.fixed);
  expect(spacer).toHaveTextContent(text);
  expect(note).toHaveClass(styles.notice);
});

it('is fixed to the top of the window, full width, above every other layer, in snow on #800000', () => {
  expect(css()).toMatch(/\.fixed \{ position: fixed; top: 0; left: 0; right: 0; z-index: 1000; \}/);
  expect(css()).toMatch(/\.notice \{[^}]*background: var\(--notice-maroon\);[^}]*color: var\(--snow\);/);
  // The spacer stays in the flow (not fixed, not display: none), so it takes the notice's height.
  expect(css()).toMatch(/\.spacer \{ visibility: hidden; \}/);
  // Every other layer in the site is below it.
  const dir = __dirname;
  for (const file of readdirSync(dir).filter(f => f.endsWith('.module.css') && f !== 'LanguageNotice.module.css')) {
    for (const m of readFileSync(join(dir, file), 'utf8').matchAll(/z-index:\s*(\d+)/g)) expect(Number(m[1]), file).toBeLessThan(1000);
  }
});

it('#800000 is used for the notice only', () => {
  const roots = [join(__dirname), join(__dirname, '../app'), join(__dirname, '../lib')];
  const users: string[] = [];
  for (const dir of roots) {
    for (const file of readdirSync(dir).filter(f => /\.(css|tsx?)$/.test(f) && !f.includes('.test.'))) {
      const text = readFileSync(join(dir, file), 'utf8');
      if (/#800000|--notice-maroon/i.test(text)) users.push(file);
    }
  }
  expect(users.sort()).toEqual(['LanguageNotice.module.css', 'theme.css']);
});
