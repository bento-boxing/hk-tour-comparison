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
  // First-run floor, PROVISIONAL: about a third of the 573 tour pages in the 2026-11-12 sitemap
  // (docs/operators/egl.md), assuming most have dates on sale, as all three samples did. No crawl has
  // measured EGL yet; replace this with a third of the tours with dates once the measured crawl has run.
  minExpectedTours: 190,
};
