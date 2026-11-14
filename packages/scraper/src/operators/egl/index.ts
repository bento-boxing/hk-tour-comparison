import type { OperatorScraper } from '../../types';
import { discover } from './discover';
import { fetchPage, splitPage } from './fetch-page';
import { parse } from './parse';

export { datesUrl, discover, isTourUrl } from './discover';
export { fetchPage, joinPage, splitPage } from './fetch-page';
export { pageTourCode, parse } from './parse';

/**
 * EGL Tours 東瀛遊, www.egltours.com. Findings: docs/operators/egl.md.
 * Each tour takes two requests: the page, and its dates JSON (fetchPage joins them for parse).
 */
export const eglScraper: OperatorScraper = {
  id: 'egl',
  discover,
  fetchPage,
  parse: (text, url) => {
    const page = splitPage(text);
    return page === null ? null : parse(page.html, page.datesJson, url);
  },
  // First-run floor: a third of the tours that would have been saved in the 2026-11-13 practice crawl
  // (495 of 573 pages; docs/operators/egl.md, "Practice crawl").
  minExpectedTours: 165,
};
