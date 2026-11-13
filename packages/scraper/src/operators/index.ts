import type { OperatorId } from '@hktours/core';
import type { OperatorScraper } from '../types';
import { jetourScraper } from './jetour';
import { texpertScraper } from './texpert';

/**
 * Every approved, implemented operator, by id. Only these are scraped. To add one, add its
 * line here and its id to the operator matrix in .github/workflows/nightly-scrape.yml.
 */
export const SCRAPERS: Partial<Record<OperatorId, OperatorScraper>> = {
  jetour: jetourScraper,
  texpert: texpertScraper,
};
