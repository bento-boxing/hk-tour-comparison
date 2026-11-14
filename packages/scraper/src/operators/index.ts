import type { OperatorId } from '@hktours/core';
import type { OperatorScraper } from '../types';
import { biglineScraper } from './bigline';
import { eglScraper } from './egl';
import { jetourScraper } from './jetour';
import { texpertScraper } from './texpert';

/**
 * Every approved, implemented operator, by id. Only these are scraped. To add one, add its
 * line here and, once a measured crawl has set its first-run floor, its id to the operator matrix
 * in .github/workflows/nightly-scrape.yml (bigline is registered but not yet in the matrix).
 */
export const SCRAPERS: Partial<Record<OperatorId, OperatorScraper>> = {
  bigline: biglineScraper,
  egl: eglScraper,
  jetour: jetourScraper,
  texpert: texpertScraper,
};
