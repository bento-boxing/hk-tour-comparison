import type { OperatorScraper } from '../../types';
import { discover } from './discover';
import { parse } from './parse';

export { discover, isTourUrl } from './discover';
export { parse } from './parse';

/** Jetour 捷旅, www.jetour.com.hk. Findings: docs/operators/jetour.md. */
export const jetourScraper: OperatorScraper = {
  id: 'jetour',
  discover,
  parse: (html, url) => parse(html, url),
};
