import { it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ReactElement } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Locale } from '../../lib/i18n';
import { ErrorPage } from './error-page';

it.each([
  ['zh-Hant', '暫時未能顯示這一頁', '暫時未能載入資料，請稍後再試。', '再試一次'],
  ['zh-Hans', '暂时无法显示这一页', '暂时无法加载数据，请稍后再试。', '再试一次'],
  // Not "Tours …": the page may be the operators index. The Chinese say 資料 / 数据 (the information), as this does.
  ['en', "This page can't be shown right now", "The information can't be loaded right now. Please try again later.", 'Try again'],
] as const)('in %s: a heading, a message naming no tours (as the pages\' own when nothing can be read, in Chinese), and a button that tries again', async (locale, heading, message, button) => {
  const retry = vi.fn();
  const { container } = render(<ErrorPage locale={locale} retry={retry} />);
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(heading);
  expect(screen.getByRole('alert')).toHaveTextContent(message);
  // No address, no code, no digest: nothing about the cause reaches the visitor.
  expect(container.textContent).toBe(`${heading}${message}${button}`);
  expect(retry).not.toHaveBeenCalled();
  await userEvent.click(screen.getByRole('button', { name: button }));
  expect(retry).toHaveBeenCalledTimes(1);
});

/** Each language's folder under app/, with the language its pages are in. */
const ROOTS: [string, Locale][] = [['(zh-hant)', 'zh-Hant'], ['zh-hans', 'zh-Hans'], ['en', 'en']];

it.each(ROOTS)('app/%s/error.tsx is a client component (as an error boundary must be) that shows the error page in %s, inside the language\'s frame', async (folder, locale) => {
  const file = join(__dirname, '..', folder, 'error.tsx');
  expect(readFileSync(file, 'utf8').startsWith("'use client';\n")).toBe(true);
  const { default: Boundary } = await import(`../${folder}/error.tsx`) as { default: (props: { error: unknown; retry: () => void; reset: () => void }) => ReactElement<Record<string, unknown>> };
  const retry = () => {};
  const element = Boundary({ error: new Error('x'), retry, reset: () => {} });
  expect(element.type).toBe(ErrorPage);
  expect(element.props).toEqual({ locale, retry });
});
