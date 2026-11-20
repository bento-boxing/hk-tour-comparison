import styles from './Mark.module.css';

/**
 * The 跟邊團 mark (owner's version A): the 辶 stroke of 邊 drawn as a route, then a gap (the rest
 * days between two tours) before the accent-coloured next leg. app/icon.svg draws the same shapes;
 * its test checks they match these.
 */
export const markShapes = {
  dot: { cx: 14, cy: 7.5, r: 3.7 },
  route: ['M6 16.5 H16.5 L9.5 26 Q15 28 13 34 Q11.5 38.5 6.5 41.5', 'M6.5 41.5 Q14 45 22 44 H26.5'],
  next: 'M32 44 H44',
  strokeWidth: 4.4,
};

const line = { fill: 'none', strokeWidth: markShapes.strokeWidth, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;

/**
 * Decorative: always beside visible text that names the site. Colours come from the parent's
 * `--mark-primary` / `--mark-accent`, defaulting to the page's ink with a gold next leg.
 */
export function Mark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true" focusable="false" className={className}>
      <circle {...markShapes.dot} className={styles.dot} />
      {markShapes.route.map(d => <path key={d} d={d} {...line} className={styles.route} />)}
      <path d={markShapes.next} {...line} className={styles.next} />
    </svg>
  );
}
