import { it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { render, screen } from '@testing-library/react';
import { makeT } from '../lib/i18n';
import { Footer } from './Footer';
import styles from './Footer.module.css';

const css = () => readFileSync(join(__dirname, 'Footer.module.css'), 'utf8').replace(/\s+/g, ' ');

it.each([
  ['zh-Hant', '本網站與各旅行社並無任何關連。', '如有意見或查詢，或旅行社需要更正或移除旅行團資料，請電郵至 hello@ganbintuen.com。'],
  ['zh-Hans', '本网站与各旅行社没有任何关联。', '如有意见或疑问，或旅行社需要更正或删除旅行团信息，请发邮件至 hello@ganbintuen.com。'],
  ['en', 'This site is not affiliated with any tour operator.',
    'Questions or feedback, or a tour operator wanting a listing corrected or removed? Write to hello@ganbintuen.com.'],
] as const)('in %s: the disclaimer, then a contact line whose address is a mailto link', (locale, disclaimer, contact) => {
  const { container } = render(<Footer t={makeT(locale)} />);
  const footer = container.querySelector('footer');
  expect(footer).toHaveTextContent(disclaimer);
  const line = screen.getByText((_, el) => el?.tagName === 'P' && el.textContent === contact);
  expect(line).toHaveClass(styles.text, styles.contact);
  const link = screen.getByRole('link', { name: 'hello@ganbintuen.com' });
  expect(link).toHaveAttribute('href', 'mailto:hello@ganbintuen.com');
  expect(link).toHaveClass(styles.link);
  expect(line).toContainElement(link);
  expect(screen.getAllByRole('link')).toHaveLength(1);
  // The disclaimer comes first; the contact line follows it.
  const paragraphs = [...container.querySelectorAll('footer > p')];
  expect(paragraphs).toHaveLength(2);
  expect(paragraphs[1]).toBe(line);
});

it('the contact line is in the footer\'s small faint text, below the disclaimer with no second rule, and its link stays in that colour, underlined, with a visible focus ring', () => {
  const text = css();
  expect(text).toMatch(/\.contact \{ padding-top: 4px; border-top: 0; \}/);
  expect(text).toMatch(/\.link \{ color: inherit; text-decoration: underline; \}/);
  expect(text).toMatch(/\.link:focus-visible \{ outline: 2px solid var\(--cerulean\); outline-offset: 2px; \}/);
});
