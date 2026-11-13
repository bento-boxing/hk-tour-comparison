import type { OperatorScraper } from '../../types';
import { discover } from './discover';
import { parse } from './parse';

export { discover, isTourUrl } from './discover';
export { parse } from './parse';

/** Travel Expert 專業旅運, www.texpert.com. Findings: docs/operators/texpert.md. */
export const texpertScraper: OperatorScraper = {
  id: 'texpert',
  discover,
  parse: (html, url) => parse(html, url),
};
