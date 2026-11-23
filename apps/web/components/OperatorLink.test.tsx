import { it, expect, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { OperatorLink } from './OperatorLink';

afterEach(() => { delete (window as Partial<Window>).matchMedia; });

it('leaves for the operator\'s site without a Referer: in a new tab on the wide layout, in this tab on a phone', () => {
  const { unmount } = render(<OperatorLink href="https://example.test/">去東瀛遊的官方網站 ↗</OperatorLink>);
  expect(screen.getByRole('link')).toHaveAttribute('target', '_blank');
  expect(screen.getByRole('link')).toHaveAttribute('rel', 'noopener noreferrer');
  unmount();
  window.matchMedia = vi.fn().mockReturnValue({ matches: true, addEventListener() {}, removeEventListener() {} }) as unknown as typeof window.matchMedia;
  render(<OperatorLink href="https://example.test/">去東瀛遊的官方網站 ↗</OperatorLink>);
  expect(screen.getByRole('link', { name: '去東瀛遊的官方網站 ↗' })).not.toHaveAttribute('target');
  expect(screen.getByRole('link')).toHaveAttribute('rel', 'noopener noreferrer');
});
