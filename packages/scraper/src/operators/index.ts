import type { OperatorId } from '@hktours/core';
import type { OperatorScraper } from '../types';
import { biglineScraper } from './bigline';
import { charmingScraper } from './charming';
import { eglScraper } from './egl';
import { jetourScraper } from './jetour';
import { sunflowerScraper } from './sunflower';
import { tasteScraper } from './taste';
import { texpertScraper } from './texpert';
import { yummyScraper } from './yummy';

/**
 * Every approved, implemented operator, by id. Only these are scraped. To add one, add its
 * line here and, once a measured crawl has set its first-run floor, its id to the operator matrix
 * in .github/workflows/nightly-scrape.yml (every operator below is in the matrix except taste,
 * which awaits its measured practice crawl).
 */
export const SCRAPERS: Partial<Record<OperatorId, OperatorScraper>> = {
  bigline: biglineScraper,
  charming: charmingScraper,
  egl: eglScraper,
  jetour: jetourScraper,
  sunflower: sunflowerScraper,
  taste: tasteScraper,
  texpert: texpertScraper,
  yummy: yummyScraper,
};
