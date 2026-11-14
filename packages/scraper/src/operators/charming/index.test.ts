import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { places } from '@hktours/core';
import type { Db } from '@hktours/db';
import { createTestDb } from '@hktours/db/test';
import { runOperator } from '../../run-operator';
import type { Fetcher } from '../../types';
import { listUrl } from './discover';
import { charmingScraper } from './index';

const TODAY = '2026-11-14';
const readFixture = (name: string) => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8');
const sourceUrl = (name: string): string => JSON.parse(readFixture(`${name}.expected.json`)).sourceUrl;

it('is registered as charming, with no extra request headers and a provisional first-run floor', () => {
  expect(charmingScraper.id).toBe('charming');
  expect(charmingScraper.requestHeaders).toBeUndefined();
  expect(charmingScraper.fetchPage).toBeUndefined();
  expect(charmingScraper.minExpectedTours).toBe(40);
});

let db: Db;
beforeEach(async () => { db = await createTestDb(); });
afterEach(async () => { await db.close(); });

it('a run reads the REST list, saves the tours with dates and skips the old post as no-departures', async () => {
  const pages = new Map(['simple', 'multi-city', 'edge'].map(name => [sourceUrl(name), readFixture(`${name}.html`)]));
  const posts = [...pages.keys()].map((link, i) => ({ id: i + 1, slug: `s${i}`, link, modified: '2026-11-11T00:00:00' }));
  const list = JSON.stringify({ body: posts, status: 200, headers: { 'X-WP-Total': 3, 'X-WP-TotalPages': 1 } });
  const asked: string[] = [];
  const fetcher: Fetcher = {
    fetchText: async url => {
      asked.push(url);
      return url === listUrl(1) ? list : pages.get(url) ?? null;
    },
  };
  const logs: string[] = [];
  const outcome = await runOperator(
    { ...charmingScraper, minExpectedTours: undefined },
    { db, fetcher, index: places, today: TODAY, now: () => new Date('2026-11-14T00:00:00Z'), log: line => logs.push(line) },
  );

  expect(outcome).toEqual({ operatorId: 'charming', ok: true, reasons: [], toursSaved: 2 });
  expect(asked).toEqual([listUrl(1), ...pages.keys()]); // one list page (3 posts), then each tour page once
  expect(logs).toContain(`charming: skipped ${sourceUrl('edge')}: no-departures`);
  const saved = await db.query<{ code: string; url: string; days: number }>(
    "select code, url, days from tours where operator_id = 'charming' order by code");
  expect(saved).toEqual([
    { code: 'GERE', url: sourceUrl('multi-city'), days: 12 },
    { code: 'PCCGG', url: sourceUrl('simple'), days: 8 },
  ]);
});
