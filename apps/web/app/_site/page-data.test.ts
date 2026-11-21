// @vitest-environment node
import { it, expect, vi, beforeEach, afterEach } from 'vitest';
import { notFound } from 'next/navigation';
import { isIsoDate } from '@hktours/core';
import { normaliseCaCert, type Db, type DestinationCounts, type OperatorListing } from '@hktours/db/read';

// The stored pages' loaders (the destinations and operators indexes). Their pages are made at build time and stored,
// so a failed read must throw, never come back as { ok: false }: a page saying "cannot read" would be stored as good.

const mocks = vi.hoisted(() => ({
  storedDb: vi.fn<() => Promise<Db>>(),
  requestDb: vi.fn<() => Promise<Db>>(),
  countToursByDestination: vi.fn<(db: Db, today: string) => Promise<DestinationCounts>>(),
  getOperatorListings: vi.fn<(db: Db, today: string) => Promise<OperatorListing[]>>(),
}));
vi.mock('../../lib/db', () => ({ storedDb: mocks.storedDb, requestDb: mocks.requestDb }));
vi.mock('../../lib/search-page-data', () => ({
  cachedReads: { countToursByDestination: mocks.countToursByDestination, getOperatorListings: mocks.getOperatorListings },
}));

const { loadStoredCounts, loadStoredOperatorListings } = await import('./page-data');

const fakeDb = {} as Db;
const counts: DestinationCounts = { all: { tours: 1, operators: 1 }, destinations: [{ countryId: 'japan', regionId: null, tours: 1, operators: 1 }] };
const listing = (id: OperatorListing['id'], lastGoodRunAt: string | null): OperatorListing => ({
  id, nameZh: id, nameEn: id, color: '#000000', siteUrl: 'https://example.test', lastGoodRunAt, tours: 1, countries: [],
});
/** An invented connection string with a password and a host, neither of which may ever reach a message. */
const URL_WITH_SECRET = 'postgres://someone:hunter2-secret@db.example.test:6543/tours';

let consoleError: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  mocks.storedDb.mockReset().mockResolvedValue(fakeDb);
  mocks.requestDb.mockReset().mockResolvedValue(fakeDb);
  mocks.countToursByDestination.mockReset().mockResolvedValue(counts);
  mocks.getOperatorListings.mockReset().mockResolvedValue([listing('egl', '2026-11-12T18:00:00.000Z'), listing('taste', null)]);
  consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.stubEnv('DATABASE_URL', URL_WITH_SECRET);
});
afterEach(() => { consoleError.mockRestore(); vi.unstubAllEnvs(); });

const loaders = [
  ['destinations index', () => loadStoredCounts(), mocks.countToursByDestination],
  ['operators index', () => loadStoredOperatorListings(), mocks.getOperatorListings],
] as const;

it('the destinations index reads its counts through the stored pages\' handle, never the per-request one', async () => {
  const load = await loadStoredCounts();
  expect(load).toEqual({ ok: true, today: expect.any(String), now: expect.any(String), data: counts });
  expect(isIsoDate(load.today)).toBe(true);
  expect(mocks.countToursByDestination).toHaveBeenCalledWith(fakeDb, load.today);
  expect(mocks.storedDb).toHaveBeenCalledTimes(1);
  expect(mocks.requestDb).not.toHaveBeenCalled();
});

it('the operators index reads the listings through the stored pages\' handle, and keeps only the operators the site shows', async () => {
  const load = await loadStoredOperatorListings();
  expect(load.ok).toBe(true);
  expect(load.data.map(o => o.id)).toEqual(['egl']);
  expect(mocks.getOperatorListings).toHaveBeenCalledWith(fakeDb, load.today);
  expect(mocks.requestDb).not.toHaveBeenCalled();
});

it.each(loaders)('%s: a failed read throws (no { ok: false } exists to render), naming DATABASE_URL and the error code, never its value', async (page, load, read) => {
  read.mockRejectedValue(Object.assign(new Error('connect ECONNREFUSED db.example.test:6543 (someone)'), { code: 'ECONNREFUSED' }));
  const error = await load().then(() => null, (err: unknown) => err as Error);
  expect(error).toBeInstanceOf(Error);
  expect(error!.message).toContain(page);
  expect(error!.message).toContain('DATABASE_URL');
  expect(error!.message).toContain('ECONNREFUSED');
  for (const part of ['hunter2-secret', 'someone', 'db.example.test', '6543', URL_WITH_SECRET]) expect(error!.message).not.toContain(part);
  // The original error (whose text can hold the host and the user) is not attached, so no build log prints it.
  expect(error!.cause).toBeUndefined();
  // Nothing is logged here: Next.js reports the thrown error itself.
  expect(consoleError).not.toHaveBeenCalled();
});

// pg's own messages for errors that carry no code, and anything else without a code: a fixed word, never the text.
const UNCODED = [
  ['Query read timeout', 'query timeout'],
  ['Connection terminated due to connection timeout', 'connection timeout'],
  ['timeout expired', 'connection timeout'],
  ['Connection terminated unexpectedly', 'connection closed'],
  ['Connection terminated', 'connection closed'],
  ['getaddrinfo failed for db.example.test as someone', 'unrecognised error'],
] as const;

it.each(loaders.flatMap(([page, load, read]) => UNCODED.map(([message, word]) => [page, message, word, load, read] as const)))(
  '%s: an error without a code, %j, is reported as (%s), from a closed list, never its text', async (_page, message, word, load, read) => {
    read.mockRejectedValue(new Error(message));
    const error = await load().then(() => null, (err: unknown) => err as Error);
    expect(error!.message).toContain(`could not be read (${word});`);
    expect(error!.message).not.toContain(message);
    for (const part of ['db.example.test', 'someone']) expect(error!.message).not.toContain(part);
  });

it.each(loaders)('%s: something thrown that is not an Error is an unrecognised error', async (_page, load, read) => {
  read.mockRejectedValue('db.example.test refused');
  const error = await load().then(() => null, (err: unknown) => err as Error);
  expect(error!.message).toContain('(unrecognised error)');
  expect(error!.message).not.toContain('db.example.test');
});

it.each(loaders)('%s: when the handle itself cannot be made (a malformed DATABASE_CA_CERT), its own value-free message is passed on, naming that setting', async (page, load, read) => {
  vi.stubEnv('DATABASE_CA_CERT', 'garbage-cert-value-123');
  // The real error @hktours/db throws for such a value.
  let handleError: unknown;
  try { normaliseCaCert(process.env.DATABASE_CA_CERT); } catch (err) { handleError = err; }
  expect(handleError).toBeInstanceOf(Error);
  mocks.storedDb.mockRejectedValue(handleError);
  const error = await load().then(() => null, (err: unknown) => err as Error);
  expect(error!.message).toMatch(new RegExp(`^${page}: the database settings cannot be used: DATABASE_CA_CERT is not a PEM certificate`));
  expect(error!.message).not.toMatch(/could not be read/);
  for (const part of ['garbage-cert-value-123', 'hunter2-secret', 'someone', 'db.example.test']) expect(error!.message).not.toContain(part);
  expect(error!.cause).toBeUndefined();
  expect(read).not.toHaveBeenCalled();
});

it('the destinations index: an answer with no tours at all is a failed read (no rows), so it is never stored', async () => {
  mocks.countToursByDestination.mockResolvedValue({ all: { tours: 0, operators: 0 }, destinations: [] });
  await expect(loadStoredCounts()).rejects.toThrow(/^destinations index: the database answered with no rows \(nothing listed now\)\. This page is stored/);
});

it('the operators index: an answer with no operator listing tours (none, or all at 0, or only ones the site does not show) is a failed read', async () => {
  for (const listings of [[], [{ ...listing('egl', '2026-11-12T18:00:00.000Z'), tours: 0 }], [listing('taste', null)]]) {
    mocks.getOperatorListings.mockResolvedValue(listings);
    await expect(loadStoredOperatorListings()).rejects.toThrow(/^operators index: the database answered with no rows/);
  }
  // One operator with tours is enough, even beside others at 0.
  mocks.getOperatorListings.mockResolvedValue([{ ...listing('jetour', '2026-11-12T18:00:00.000Z'), tours: 0 }, listing('egl', '2026-11-12T18:00:00.000Z')]);
  expect((await loadStoredOperatorListings()).data.map(o => o.id)).toEqual(['jetour', 'egl']);
});

it.each(loaders)('%s: without DATABASE_URL, the message says that variable is missing and how to build without a database', async (_page, load) => {
  vi.stubEnv('DATABASE_URL', '');
  mocks.storedDb.mockRejectedValue(new Error('DATABASE_URL is not set: the website needs it to read tours from the database.'));
  const error = await load().then(() => null, (err: unknown) => err as Error);
  expect(error!.message).toMatch(/DATABASE_URL is not set/);
  expect(error!.message).toContain('BUILD_WITHOUT_DATABASE=1');
});

it.each(loaders)('%s: Next.js\'s own signals (such as "render this per request" or a 404) pass through unchanged', async (_page, load) => {
  let signal: unknown;
  try { notFound(); } catch (err) { signal = err; }
  mocks.storedDb.mockRejectedValue(signal);
  await expect(load()).rejects.toBe(signal);
});
