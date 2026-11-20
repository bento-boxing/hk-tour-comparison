import { it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { render } from '@testing-library/react';
import { Mark, markShapes } from './Mark';

const css = () => readFileSync(join(__dirname, 'Mark.module.css'), 'utf8').replace(/\s+/g, ' ');

it('draws the owner\'s mark (version A): the dot, the 辶 route, a gap, then the next leg', () => {
  expect(markShapes).toEqual({
    dot: { cx: 14, cy: 7.5, r: 3.7 },
    route: ['M6 16.5 H16.5 L9.5 26 Q15 28 13 34 Q11.5 38.5 6.5 41.5', 'M6.5 41.5 Q14 45 22 44 H26.5'],
    next: 'M32 44 H44',
    strokeWidth: 4.4,
  });
  const { container } = render(<Mark />);
  const svg = container.querySelector('svg')!;
  expect(svg).toHaveAttribute('viewBox', '0 0 48 48');
  const dot = svg.querySelector('circle')!;
  expect([dot.getAttribute('cx'), dot.getAttribute('cy'), dot.getAttribute('r')]).toEqual(['14', '7.5', '3.7']);
  const paths = [...svg.querySelectorAll('path')];
  expect(paths.map(p => p.getAttribute('d'))).toEqual([...markShapes.route, markShapes.next]);
  for (const p of paths) {
    expect(p).toHaveAttribute('fill', 'none');
    expect(p).toHaveAttribute('stroke-width', '4.4');
    expect(p).toHaveAttribute('stroke-linecap', 'round');
    expect(p).toHaveAttribute('stroke-linejoin', 'round');
  }
});

it('is decorative: hidden from assistive technology and never focusable', () => {
  const { container } = render(<Mark className="x" />);
  const svg = container.querySelector('svg')!;
  expect(svg).toHaveAttribute('aria-hidden', 'true');
  expect(svg).toHaveAttribute('focusable', 'false');
  expect(svg).toHaveClass('x');
});

it('takes its colours from the parent (the header: its text colour and gold), else the page\'s ink with a gold next leg', () => {
  expect(css()).toContain('.dot { fill: var(--mark-primary, var(--ink)); }');
  expect(css()).toContain('.route { stroke: var(--mark-primary, var(--ink)); }');
  expect(css()).toContain('.next { stroke: var(--mark-accent, var(--gold)); }');
});
