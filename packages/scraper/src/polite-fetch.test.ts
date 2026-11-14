import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import { performance } from 'node:perf_hooks';
import {
  createFetcher, siteOf, MAX_CONSECUTIVE_PUSHBACK, MAX_CRAWL_DELAY_MS, REQUEST_DELAY_MS, REQUEST_TIMEOUT_MS, USER_AGENT,
  type PoliteFetcher,
} from './polite-fetch';

interface RecordedRequest {
  path: string; userAgent: string | undefined; start: number; end: number;
  method: string; headers: IncomingMessage['headers']; body: string;
}

interface TestServer {
  url(path: string): string;
  requests: RecordedRequest[];
  close(): Promise<void>;
}

type Handler = (req: IncomingMessage, res: ServerResponse) => void;

/**
 * A local HTTP server on a random port that records each request's path, user-agent, start and end time,
 * method, headers and body (the body is complete once the response has finished).
 * Every server on 127.0.0.1 is one site (see siteOf); one on `localhost` is another.
 */
async function startServer(handler: Handler, host: '127.0.0.1' | 'localhost' = '127.0.0.1'): Promise<TestServer> {
  const requests: RecordedRequest[] = [];
  const server = createServer((req, res) => {
    const record: RecordedRequest = {
      path: req.url ?? '', userAgent: req.headers['user-agent'], start: performance.now(), end: Infinity,
      method: req.method ?? '', headers: req.headers, body: '',
    };
    requests.push(record);
    req.setEncoding('utf8');
    req.on('data', (chunk: string) => { record.body += chunk; });
    res.on('finish', () => { record.end = performance.now(); });
    handler(req, res);
  });
  await new Promise<void>(resolve => server.listen(0, host, resolve));
  const { port } = server.address() as AddressInfo;
  return {
    url: path => `http://${host}:${port}${path}`,
    requests,
    close: () => new Promise<void>(resolve => {
      server.closeAllConnections();
      server.close(() => resolve());
    }),
  };
}

function send(res: ServerResponse, status: number, body = '', headers: Record<string, string> = {}): void {
  res.writeHead(status, { 'content-type': 'text/plain', ...headers });
  res.end(body);
}

let flakyCalls = 0;
/** Bytes that are not valid UTF-8, so decoding them as text would change them. */
const BINARY = Buffer.from([0x25, 0x50, 0x44, 0x46, 0xff, 0xfe, 0x00, 0x80, 0xc3]);

const mainHandler: Handler = (req, res) => {
  switch (req.url) {
    case '/robots.txt': return send(res, 200, 'User-agent: *\nDisallow: /private/');
    case '/a': return send(res, 200, 'ok-a');
    case '/b': return send(res, 200, 'ok-b');
    case '/c': return send(res, 200, 'ok-c');
    case '/private/x': return send(res, 200, 'secret');
    case '/missing': return send(res, 404, 'not found');
    case '/flaky': return ++flakyCalls <= 2 ? send(res, 500, 'boom') : send(res, 200, 'ok');
    case '/blocked': return send(res, 403, 'forbidden');
    case '/too-many': return send(res, 429, 'slow down');
    case '/slow': setTimeout(() => send(res, 200, 'ok-slow'), 300); return;
    case '/hang': return; // never answers
    case '/to-private': return send(res, 302, '', { location: '/private/x' });
    case '/to-a': return send(res, 301, '', { location: '/a' });
    case '/binary': res.writeHead(200, { 'content-type': 'application/pdf' }); res.end(BINARY); return;
    case '/private/binary': res.writeHead(200, { 'content-type': 'application/pdf' }); res.end(BINARY); return;
    case '/echo': { // answers "<method> <body>" once the whole request body has arrived
      let body = '';
      req.on('data', (chunk: string) => { body += chunk; });
      req.on('end', () => send(res, 200, `${req.method} ${body}`));
      return;
    }
    default: return send(res, 404);
  }
};

let main: TestServer;
let logLines: string[];
let f: PoliteFetcher;
const url = (path: string) => main.url(path);
const requestsTo = (path: string) => main.requests.filter(r => r.path === path);

beforeAll(async () => { main = await startServer(mainHandler); });
afterAll(async () => { await main.close(); });
beforeEach(() => {
  main.requests.length = 0;
  flakyCalls = 0;
  logLines = [];
  f = createFetcher({ userAgent: 'test-bot/0.1', delayMs: 200, log: line => logLines.push(line) });
});

/** Start times of the given requests, in order, and checks none overlapped the one before it. */
function expectSpacedAndSerial(requests: RecordedRequest[], minGapMs: number): void {
  const sorted = [...requests].sort((x, y) => x.start - y.start);
  for (let i = 1; i < sorted.length; i++) {
    expect(sorted[i].start - sorted[i - 1].start).toBeGreaterThanOrEqual(minGapMs);
    expect(sorted[i].start).toBeGreaterThanOrEqual(sorted[i - 1].end);
  }
}

it('returns the body', async () => {
  expect(await f.fetchText(url('/a'))).toBe('ok-a');
});

it('sends the User-Agent on every request, including robots.txt', async () => {
  await f.fetchText(url('/a'));
  await f.fetchText(url('/flaky'));
  await f.fetchText(url('/missing'));
  expect(requestsTo('/robots.txt')).toHaveLength(1);
  expect(main.requests.length).toBeGreaterThanOrEqual(6);
  for (const r of main.requests) expect(r.userAgent).toBe('test-bot/0.1');
});

it('never requests a disallowed path', async () => {
  expect(await f.fetchText(url('/private/x'))).toBeNull();
  expect(main.requests.some(r => r.path === '/private/x')).toBe(false);
});

it('never follows a redirect to a disallowed path', async () => {
  expect(await f.fetchText(url('/to-private'))).toBeNull();
  expect(requestsTo('/to-private')).toHaveLength(1);
  expect(main.requests.some(r => r.path === '/private/x')).toBe(false);
  for (const r of main.requests) expect(r.userAgent).toBe('test-bot/0.1');
});

it('follows an allowed redirect politely, with the User-Agent on every hop', async () => {
  expect(await f.fetchText(url('/to-a'))).toBe('ok-a');
  expect(main.requests.map(r => r.path)).toEqual(['/robots.txt', '/to-a', '/a']);
  for (const r of main.requests) expect(r.userAgent).toBe('test-bot/0.1');
  expectSpacedAndSerial(main.requests, 190);
});

/** Two servers on the same host (127.0.0.1) and different ports: one site, so one queue. */
async function withSecondPort(run: (other: TestServer) => Promise<void>): Promise<void> {
  const other = await startServer((req, res) =>
    (req.url === '/robots.txt' ? send(res, 200, 'User-agent: *\nDisallow: /private/') : send(res, 200, `other${req.url}`)));
  try {
    await run(other);
  } finally {
    await other.close();
  }
}

it('spaces requests across ports of one host when a redirect crosses them', async () => {
  await withSecondPort(async other => {
    const hopping = await startServer((req, res) =>
      (req.url === '/robots.txt' ? send(res, 200, 'User-agent: *\nDisallow:') : send(res, 302, '', { location: other.url('/a') })));
    try {
      expect(await f.fetchText(hopping.url('/go'))).toBe('other/a');
      const all = [...hopping.requests, ...other.requests];
      expect(all.map(r => r.path).sort()).toEqual(['/a', '/go', '/robots.txt', '/robots.txt']);
      for (const r of all) expect(r.userAgent).toBe('test-bot/0.1');
      expectSpacedAndSerial(all, 190);
    } finally {
      await hopping.close();
    }
  });
});

it('never overlaps concurrent requests to two ports of one host', async () => {
  await withSecondPort(async other => {
    const bodies = await Promise.all([f.fetchText(url('/a')), f.fetchText(other.url('/a'))]);
    expect(bodies).toEqual(['ok-a', 'other/a']);
    const all = [...main.requests, ...other.requests];
    expect(all).toHaveLength(4); // a robots.txt and a page on each port
    expectSpacedAndSerial(all, 190);
  });
});

it('queues www.<host> and <host> as one site, whatever the scheme or port', () => {
  expect(siteOf(new URL('https://WWW.Example.com:8443/x'))).toBe('example.com');
  expect(siteOf(new URL('http://example.com/y'))).toBe('example.com');
  expect(siteOf(new URL('http://shop.example.com/y'))).toBe('shop.example.com');
  expect(siteOf(new URL('http://127.0.0.1:1234/'))).toBe('127.0.0.1');
});

it('fetches robots.txt once per host', async () => {
  await f.fetchText(url('/a'));
  await f.fetchText(url('/b'));
  await f.fetchText(url('/c'));
  expect(requestsTo('/robots.txt')).toHaveLength(1);
  expect(main.requests[0].path).toBe('/robots.txt');
});

it('fetches robots.txt once per host even when the first requests start together', async () => {
  await Promise.all([f.fetchText(url('/a')), f.fetchText(url('/b'))]);
  expect(requestsTo('/robots.txt')).toHaveLength(1);
});

it('spaces requests by at least the delay', async () => {
  const bodies = await Promise.all([f.fetchText(url('/a')), f.fetchText(url('/b')), f.fetchText(url('/c'))]);
  expect(bodies).toEqual(['ok-a', 'ok-b', 'ok-c']);
  const pages = main.requests.filter(r => ['/a', '/b', '/c'].includes(r.path));
  expect(pages).toHaveLength(3);
  expectSpacedAndSerial(pages, 190);
  expectSpacedAndSerial(main.requests, 190); // robots.txt is spaced from the pages too
});

it('waits for a slow request to finish before starting the next', async () => {
  const fast = createFetcher({ userAgent: 'test-bot/0.1', delayMs: 50, log: () => {} });
  const bodies = await Promise.all([fast.fetchText(url('/slow')), fast.fetchText(url('/a'))]);
  expect(bodies).toEqual(['ok-slow', 'ok-a']);
  const [slow] = requestsTo('/slow');
  const [a] = requestsTo('/a');
  expect(a.start).toBeGreaterThanOrEqual(slow.end);
  expect(a.start - slow.end).toBeGreaterThanOrEqual(45); // the delay counts from the end of the slow request
});

it('returns null for 404 without retrying', async () => {
  expect(await f.fetchText(url('/missing'))).toBeNull();
  expect(requestsTo('/missing')).toHaveLength(1);
});

it('retries 5xx up to twice', async () => {
  expect(await f.fetchText(url('/flaky'))).toBe('ok');
  expect(requestsTo('/flaky')).toHaveLength(3);
  expectSpacedAndSerial(requestsTo('/flaky'), 190);
});

it('gives up after two retries', async () => {
  flakyCalls = -10; // always 500 for this test
  expect(await f.fetchText(url('/flaky'))).toBeNull();
  expect(requestsTo('/flaky')).toHaveLength(3);
});

it.each(['/blocked', '/too-many'])('returns null for %s (403/429) without retrying, and logs it', async path => {
  expect(await f.fetchText(url(path))).toBeNull();
  expect(requestsTo(path)).toHaveLength(1);
  expect(logLines.some(line => line.includes(url(path)))).toBe(true);
});

it('times out a request that never answers, and retries it', async () => {
  const quick = createFetcher({ userAgent: 'test-bot/0.1', delayMs: 20, timeoutMs: 150, log: () => {} });
  expect(await quick.fetchText(url('/hang'))).toBeNull();
  expect(requestsTo('/hang')).toHaveLength(3);
});

it('the request timeout is 30 seconds and the default delay 3 seconds', () => {
  expect(REQUEST_TIMEOUT_MS).toBe(30_000);
  expect(REQUEST_DELAY_MS).toBe(3000);
});

it('allows everything when robots.txt is missing', async () => {
  const bare = await startServer((req, res) => (req.url === '/a' ? send(res, 200, 'ok-a') : send(res, 404)));
  try {
    expect(await f.fetchText(bare.url('/a'))).toBe('ok-a');
    expect(bare.requests.map(r => r.path)).toEqual(['/robots.txt', '/a']);
  } finally {
    await bare.close();
  }
});

it('requests nothing else from a host whose robots.txt cannot be read', async () => {
  const broken = await startServer((req, res) => (req.url === '/a' ? send(res, 200, 'ok-a') : send(res, 500)));
  try {
    expect(await f.fetchText(broken.url('/a'))).toBeNull();
    expect(broken.requests.some(r => r.path === '/a')).toBe(false);
  } finally {
    await broken.close();
  }
});

it('obeys rules for its own User-Agent over the * group', async () => {
  const picky = await startServer((req, res) => {
    if (req.url === '/robots.txt') return send(res, 200, 'User-agent: test-bot\nDisallow: /a\n\nUser-agent: *\nDisallow:');
    send(res, 200, 'ok');
  });
  try {
    expect(await f.fetchText(picky.url('/a'))).toBeNull();
    expect(await f.fetchText(picky.url('/b'))).toBe('ok');
    expect(picky.requests.map(r => r.path)).toEqual(['/robots.txt', '/b']);
  } finally {
    await picky.close();
  }
});

it('waits longer when robots.txt asks for a longer Crawl-delay', async () => {
  const slowHost = await startServer((req, res) =>
    (req.url === '/robots.txt' ? send(res, 200, 'User-agent: *\nCrawl-delay: 0.4') : send(res, 200, 'ok')));
  try {
    await Promise.all([f.fetchText(slowHost.url('/a')), f.fetchText(slowHost.url('/b'))]);
    expectSpacedAndSerial(slowHost.requests.filter(r => r.path !== '/robots.txt'), 390);
  } finally {
    await slowHost.close();
  }
});

const glacialHandler: Handler = (req, res) =>
  (req.url === '/robots.txt' ? send(res, 200, 'User-agent: *\nCrawl-delay: 31') : send(res, 200, 'ok'));

it('does not crawl a site whose Crawl-delay is over the cap, says why once, and names each skipped URL', async () => {
  expect(MAX_CRAWL_DELAY_MS).toBe(30_000);
  const glacial = await startServer(glacialHandler);
  try {
    expect(await f.fetchText(glacial.url('/a'))).toBeNull();
    expect(await f.fetchText(glacial.url('/b'))).toBeNull();
    expect(glacial.requests.map(r => r.path)).toEqual(['/robots.txt']);
    expect(logLines.filter(line => line.startsWith('not crawling'))).toHaveLength(1);
    expect(logLines.filter(line => /crawl-delay 31/i.test(line))).toHaveLength(3); // the site line and one per URL
    for (const path of ['/a', '/b']) {
      const lines = logLines.filter(line => line.includes(glacial.url(path)));
      expect(lines).toHaveLength(1);
      expect(lines[0]).toMatch(/Crawl-delay 31/);
    }
  } finally {
    await glacial.close();
  }
});

it('a Crawl-delay over the cap on one port refuses the whole site, other ports included', async () => {
  const glacial = await startServer(glacialHandler);
  const plain = await startServer((req, res) =>
    (req.url === '/robots.txt' ? send(res, 200, 'User-agent: *\nDisallow:') : send(res, 200, 'ok')));
  try {
    expect(await f.fetchText(glacial.url('/a'))).toBeNull();
    expect(await f.fetchText(plain.url('/a'))).toBeNull();
    expect(await f.fetchText(plain.url('/b'))).toBeNull();
    expect(plain.requests).toEqual([]); // not even its robots.txt: the whole site is refused
    for (const path of ['/a', '/b']) {
      expect(logLines.filter(line => line.includes(plain.url(path)) && /Crawl-delay 31/.test(line))).toHaveLength(1);
    }
  } finally {
    await glacial.close();
    await plain.close();
  }
});

it('a page already queued when its site is refused is not sent', async () => {
  const glacial = await startServer(glacialHandler);
  const plain = await startServer((req, res) =>
    (req.url === '/robots.txt' ? send(res, 200, 'User-agent: *\nDisallow:') : send(res, 200, 'ok')));
  try {
    expect(await f.fetchText(plain.url('/a'))).toBe('ok'); // before the refusal: fine
    // plain's rules are known, so /b queues at once, behind glacial's robots.txt, which refuses the site.
    const bodies = await Promise.all([f.fetchText(glacial.url('/a')), f.fetchText(plain.url('/b'))]);
    expect(bodies).toEqual([null, null]);
    expect(plain.requests.map(r => r.path)).toEqual(['/robots.txt', '/a']);
    expect(glacial.requests.map(r => r.path)).toEqual(['/robots.txt']);
  } finally {
    await glacial.close();
    await plain.close();
  }
});

it('a refused site reached through a redirect is not requested, and the requested URL is logged', async () => {
  const glacial = await startServer(glacialHandler);
  const hopping = await startServer((req, res) =>
    (req.url === '/robots.txt' ? send(res, 200, 'User-agent: *\nDisallow:') : send(res, 302, '', { location: glacial.url('/a') })));
  try {
    const start = hopping.url('/go');
    expect(await f.fetchText(start)).toBeNull();
    expect(glacial.requests.map(r => r.path)).toEqual(['/robots.txt']);
    const lines = logLines.filter(line => line.includes(start));
    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain(glacial.url('/a'));
    expect(lines[0]).toMatch(/Crawl-delay 31/);
  } finally {
    await glacial.close();
    await hopping.close();
  }
});

it('a page on an origin with unreadable robots.txt is logged by URL', async () => {
  const broken = await startServer((_req, res) => send(res, 500));
  try {
    expect(await f.fetchText(broken.url('/a'))).toBeNull();
    const lines = logLines.filter(line => line.includes(broken.url('/a')));
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatch(/robots\.txt unreadable/);
  } finally {
    await broken.close();
  }
});

/**
 * A site that pushes back: `/<status>/<name>` answers with that status (a 503 at `/503-retry-after/<name>`
 * carries Retry-After), `/ok/<name>` answers 200, robots.txt allows everything.
 */
const pushbackHandler: Handler = (req, res) => {
  const path = req.url ?? '';
  if (path === '/robots.txt') return send(res, 200, 'User-agent: *\nDisallow:');
  if (path.startsWith('/ok/')) return send(res, 200, `ok${path}`);
  if (path.startsWith('/503-retry-after/')) return send(res, 503, 'busy', { 'retry-after': '120' });
  const status = Number(path.split('/')[1]);
  return send(res, Number.isInteger(status) && status >= 200 ? status : 404);
};

/** Fetches the paths one after another, as a scraper's run does, and returns the bodies. */
async function fetchInTurn(server: TestServer, paths: string[]): Promise<(string | null)[]> {
  const bodies: (string | null)[] = [];
  for (const path of paths) bodies.push(await f.fetchText(server.url(path)));
  return bodies;
}

const pagesAsked = (server: TestServer) => server.requests.map(r => r.path).filter(path => path !== '/robots.txt');
const refusalLines = () => logLines.filter(line => line.startsWith('not crawling'));

it('three 429s in a row refuse the site: the 4th URL is never requested, and the refusal is said once', async () => {
  expect(MAX_CONSECUTIVE_PUSHBACK).toBe(3);
  const pushy = await startServer(pushbackHandler);
  try {
    const bodies = await fetchInTurn(pushy, ['/429/1', '/429/2', '/429/3', '/ok/4', '/ok/5']);
    expect(bodies).toEqual([null, null, null, null, null]);
    expect(pagesAsked(pushy)).toEqual(['/429/1', '/429/2', '/429/3']);
    expect(refusalLines()).toHaveLength(1);
    expect(refusalLines()[0]).toMatch(/answered with HTTP 429 3 times in a row and is not being requested further/);
    for (const path of ['/ok/4', '/ok/5']) {
      expect(logLines.filter(line => line.includes(pushy.url(path)) && /3 times in a row/.test(line))).toHaveLength(1);
    }
  } finally {
    await pushy.close();
  }
});

it('a 2xx answer between pushbacks starts the count again', async () => {
  const pushy = await startServer(pushbackHandler);
  try {
    const paths = ['/429/1', '/429/2', '/ok/3', '/429/4', '/429/5', '/ok/6'];
    const bodies = await fetchInTurn(pushy, paths);
    expect(bodies).toEqual([null, null, 'ok/ok/3', null, null, 'ok/ok/6']);
    expect(pagesAsked(pushy)).toEqual(paths);
    expect(refusalLines()).toEqual([]);
  } finally {
    await pushy.close();
  }
});

it('a 204 also starts the count again; a 404 neither counts nor resets', async () => {
  const pushy = await startServer(pushbackHandler);
  try {
    await fetchInTurn(pushy, ['/429/1', '/429/2', '/204/3', '/429/4', '/404/5', '/429/6', '/ok/7']);
    expect(pagesAsked(pushy)).toEqual(['/429/1', '/429/2', '/204/3', '/429/4', '/404/5', '/429/6', '/ok/7']);
    expect(refusalLines()).toEqual([]);
    await fetchInTurn(pushy, ['/429/8', '/404/9', '/429/10', '/429/11', '/ok/12']);
    expect(pagesAsked(pushy).slice(7)).toEqual(['/429/8', '/404/9', '/429/10', '/429/11']);
    expect(refusalLines()).toHaveLength(1);
  } finally {
    await pushy.close();
  }
});

it.each([
  ['403s', ['/403/1', '/403/2', '/403/3'], 403],
  ['a mix of 403, 429 and 503', ['/403/1', '/429/2', '/503-retry-after/3'], 503],
])('%s count the same as 429s', async (_name, pushbacks, lastStatus) => {
  const pushy = await startServer(pushbackHandler);
  try {
    await fetchInTurn(pushy, [...pushbacks, '/ok/4']);
    expect(pagesAsked(pushy)).toEqual(pushbacks);
    expect(refusalLines()).toHaveLength(1);
    expect(refusalLines()[0]).toContain(`HTTP ${lastStatus} 3 times in a row`);
  } finally {
    await pushy.close();
  }
});

it('a 503 with Retry-After is final, not retried', async () => {
  const pushy = await startServer(pushbackHandler);
  try {
    expect(await f.fetchText(pushy.url('/503-retry-after/1'))).toBeNull();
    expect(pagesAsked(pushy)).toEqual(['/503-retry-after/1']);
    expect(logLines.some(line => line.startsWith('retry'))).toBe(false);
  } finally {
    await pushy.close();
  }
});

it('a 503 without Retry-After is retried, and each 503 answer counts toward the three', async () => {
  const pushy = await startServer(pushbackHandler);
  try {
    expect(await fetchInTurn(pushy, ['/503/1', '/ok/2'])).toEqual([null, null]);
    expect(pagesAsked(pushy)).toEqual(['/503/1', '/503/1', '/503/1']);
    expect(refusalLines()).toHaveLength(1);
    expect(refusalLines()[0]).toContain('HTTP 503 3 times in a row');
  } finally {
    await pushy.close();
  }
});

it('robots.txt answers do not count toward the three', async () => {
  // Both servers are on 127.0.0.1, so one site. The first one's robots.txt answers 503 three times
  // (the request and two retries): that origin is not crawled, but the site is not refused.
  const busyRobots = await startServer((_req, res) => send(res, 503, 'busy'));
  const pushy = await startServer(pushbackHandler);
  try {
    expect(await f.fetchText(busyRobots.url('/ok/1'))).toBeNull();
    expect(busyRobots.requests.map(r => r.path)).toEqual(['/robots.txt', '/robots.txt', '/robots.txt']);
    expect(await f.fetchText(pushy.url('/ok/2'))).toBe('ok/ok/2');
    expect(logLines.some(line => /times in a row/.test(line))).toBe(false);
  } finally {
    await busyRobots.close();
    await pushy.close();
  }
});

it('a site refused after pushback does not affect another site', async () => {
  const pushy = await startServer(pushbackHandler);
  const elsewhere = await startServer(pushbackHandler, 'localhost');
  try {
    await fetchInTurn(pushy, ['/429/1', '/429/2', '/429/3']);
    expect(refusalLines()).toHaveLength(1);
    expect(await f.fetchText(elsewhere.url('/ok/1'))).toBe('ok/ok/1');
    expect(await f.fetchText(elsewhere.url('/429/2'))).toBeNull();
    expect(await f.fetchText(elsewhere.url('/ok/3'))).toBe('ok/ok/3');
    expect(pagesAsked(elsewhere)).toEqual(['/ok/1', '/429/2', '/ok/3']);
  } finally {
    await pushy.close();
    await elsewhere.close();
  }
});

it('fetchBytes returns the exact bytes, through the same robots.txt check, queue and User-Agent', async () => {
  const bytes = createFetcher({ userAgent: 'test-bot/0.1', delayMs: 200, log: line => logLines.push(line) });
  expect(await bytes.fetchBytes(url('/private/binary'))).toBeNull();
  expect(Buffer.from((await bytes.fetchBytes(url('/binary')))!)).toEqual(BINARY);
  expect(await bytes.fetchBytes(url('/missing'))).toBeNull();
  expect(main.requests.map(r => r.path)).toEqual(['/robots.txt', '/binary', '/missing']);
  for (const r of main.requests) expect(r.userAgent).toBe('test-bot/0.1');
  expectSpacedAndSerial(main.requests, 190);
});

/** The origin of a test server's URL: an exact origin key, since a bare host name means https only. */
const originOf = (serverUrl: string) => new URL(serverUrl).origin;

/**
 * A fetcher that adds `x-site-key: k1` to every page request to the origin `origin` (by default the main
 * server's), and tries (and fails) to replace the User-Agent there.
 */
function fetcherWithExtraHeaders(origin = originOf(url('/'))): PoliteFetcher {
  return createFetcher({
    userAgent: 'test-bot/0.1', delayMs: 200, log: line => logLines.push(line),
    extraHeaders: { [origin]: { 'x-site-key': 'k1', 'User-Agent': 'Mozilla/5.0 pretend' } },
  });
}

it('extraHeaders go on every page request and every redirect hop to their host, but never on robots.txt', async () => {
  const h = fetcherWithExtraHeaders();
  expect(await h.fetchText(url('/to-a'))).toBe('ok-a');
  expect(main.requests.map(r => [r.path, r.headers['x-site-key']])).toEqual([
    ['/robots.txt', undefined], ['/to-a', 'k1'], ['/a', 'k1'],
  ]);
});

it('extraHeaders never go to another host, even when a redirect leads there, nor to its robots.txt', async () => {
  const elsewhere = await startServer((req, res) =>
    (req.url === '/robots.txt' ? send(res, 200, 'User-agent: *\nDisallow:') : send(res, 200, `elsewhere${req.url}`)), 'localhost');
  const hopping = await startServer((req, res) =>
    (req.url === '/robots.txt' ? send(res, 200, 'User-agent: *\nDisallow:') : send(res, 302, '', { location: elsewhere.url('/a') })));
  try {
    const h = fetcherWithExtraHeaders(originOf(hopping.url('/')));
    expect(await h.fetchText(hopping.url('/go'))).toBe('elsewhere/a');
    expect(hopping.requests.map(r => [r.path, r.headers['x-site-key']])).toEqual([['/robots.txt', undefined], ['/go', 'k1']]);
    expect(elsewhere.requests.map(r => [r.path, r.headers['x-site-key']])).toEqual([['/robots.txt', undefined], ['/a', undefined]]);
    expect(await h.postJson(elsewhere.url('/b'), {})).toBe('elsewhere/b');
    expect(elsewhere.requests.at(-1)!.headers['x-site-key']).toBeUndefined();
  } finally {
    await elsewhere.close();
    await hopping.close();
  }
});

it('a host-name key means https on the default port only: an http:// request to that host gets none', async () => {
  const local = await startServer((req, res) => send(res, req.url === '/robots.txt' ? 404 : 200, 'ok'), 'localhost');
  try {
    const h = createFetcher({
      userAgent: 'test-bot/0.1', delayMs: 200, log: line => logLines.push(line),
      extraHeaders: { LocalHost: { 'x-site-key': 'k2' } },
    });
    expect(await h.fetchText(local.url('/a'))).toBe('ok');
    expect(await h.postJson(local.url('/b'), {})).toBe('ok');
    expect(local.requests.map(r => r.headers['x-site-key'])).toEqual([undefined, undefined, undefined]);
  } finally {
    await local.close();
  }
});

it('a redirect to http:// on the same host, or to another port of it, gets none of an origin\'s headers', async () => {
  await withSecondPort(async other => {
    const hopping = await startServer((req, res) =>
      (req.url === '/robots.txt' ? send(res, 200, 'User-agent: *\nDisallow:') : send(res, 302, '', { location: other.url('/a') })));
    try {
      const h = fetcherWithExtraHeaders(originOf(hopping.url('/')));
      expect(await h.fetchText(hopping.url('/go'))).toBe('other/a');
      expect(hopping.requests.find(r => r.path === '/go')!.headers['x-site-key']).toBe('k1');
      expect(other.requests.find(r => r.path === '/a')!.headers['x-site-key']).toBeUndefined();
    } finally {
      await hopping.close();
    }
  });
});

it('an origin key is matched exactly, its host whatever its case', async () => {
  const local = await startServer((req, res) => send(res, req.url === '/robots.txt' ? 404 : 200, 'ok'), 'localhost');
  try {
    const port = new URL(local.url('/')).port;
    const h = createFetcher({
      userAgent: 'test-bot/0.1', delayMs: 200, log: line => logLines.push(line),
      extraHeaders: { [`http://LocalHost:${port}`]: { 'x-site-key': 'k2' } },
    });
    expect(await h.fetchText(local.url('/a'))).toBe('ok');
    expect(await h.fetchText(url('/a'))).toBe('ok-a');
    expect(local.requests.map(r => r.headers['x-site-key'])).toEqual([undefined, 'k2']);
    expect(requestsTo('/a')[0].headers['x-site-key']).toBeUndefined();
  } finally {
    await local.close();
  }
});

it.each(['example.com:8443', 'example.com/path', 'not a host', 'ftp://example.com'])(
  'refuses an extraHeaders key that is neither a host name nor an http(s) origin: %s', key => {
    expect(() => createFetcher({ extraHeaders: { [key]: { 'x-site-key': 'k' } } })).toThrow(/neither a host name nor an origin/);
  });

describe('extraHeaders that cannot be sent', () => {
  const throwing = {} as Record<string, string>;
  Object.defineProperty(throwing, 'x-site-key', { enumerable: true, get: () => { throw new Error('boom'); } });
  it.each([
    ['a value with a line break', { 'x-site-key': 'k1\r\nx-injected: yes' }],
    ['a name that is not a header name', { 'bad name': 'k1' }],
    ['a value that throws when read', throwing],
  ])('fail that request once, logged, with nothing sent, and the queue keeps going: %s', async (_name, headers) => {
    const h = createFetcher({
      userAgent: 'test-bot/0.1', delayMs: 200, log: line => logLines.push(line), extraHeaders: { [originOf(url('/'))]: headers },
    });
    expect(await h.fetchText(url('/a'))).toBeNull();
    expect(await h.postJson(url('/echo'), {})).toBeNull();
    expect(main.requests.map(r => r.path)).toEqual(['/robots.txt']); // robots.txt never carries extra headers
    expect(logLines.some(line => line.startsWith('retry'))).toBe(false);
    expect(logLines.filter(line => line.includes(url('/a')) && /extra headers/.test(line))).toHaveLength(1);
    expect(logLines.join('\n')).not.toMatch(/injected|boom/); // the value is never logged
    const other = await startServer((_req, res) => send(res, 200, 'ok'), 'localhost');
    try {
      expect(await h.fetchText(other.url('/a'))).toBe('ok'); // other hosts are unaffected
    } finally {
      await other.close();
    }
  });
  it('do not break the site\'s queue: requests queued behind one each fail once, in turn', async () => {
    const h = createFetcher({
      userAgent: 'test-bot/0.1', delayMs: 200, log: line => logLines.push(line),
      extraHeaders: { [originOf(url('/'))]: { 'x-site-key': 'bad\nvalue' } },
    });
    const answers = await Promise.all([h.fetchText(url('/a')), h.postJson(url('/echo'), {}), h.fetchBytes(url('/b'))]);
    expect(answers).toEqual([null, null, null]);
    expect(main.requests.map(r => r.path)).toEqual(['/robots.txt']);
    for (const path of ['/a', '/echo', '/b']) {
      expect(logLines.filter(line => line.includes(url(path)) && /extra headers/.test(line))).toHaveLength(1);
    }
  });
});

it('extraHeaders cannot replace the User-Agent', async () => {
  const h = fetcherWithExtraHeaders();
  expect(await h.fetchText(url('/a'))).toBe('ok-a');
  expect(await h.fetchBytes(url('/b'))).not.toBeNull();
  expect(await h.postJson(url('/echo'), {})).not.toBeNull();
  expect(main.requests).toHaveLength(4);
  for (const r of main.requests) expect(r.userAgent).toBe('test-bot/0.1');
});

it('without extraHeaders nothing beyond the User-Agent is added', async () => {
  await f.fetchText(url('/a'));
  expect(requestsTo('/a')[0].headers['x-site-key']).toBeUndefined();
  expect(requestsTo('/a')[0].method).toBe('GET');
});

it('postJson POSTs the body as JSON with the User-Agent and extraHeaders, and returns the answer text', async () => {
  const h = fetcherWithExtraHeaders();
  const answer = await h.postJson(url('/echo'), { pageNo: 1, productId: '9109', yearMonth: '2026-12' });
  expect(answer).toBe('POST {"pageNo":1,"productId":"9109","yearMonth":"2026-12"}');
  const [post] = requestsTo('/echo');
  expect(post.method).toBe('POST');
  expect(post.headers['content-type']).toBe('application/json');
  expect(post.headers['x-site-key']).toBe('k1');
  expect(post.userAgent).toBe('test-bot/0.1');
});

it('postJson obeys robots.txt: a disallowed path is never requested', async () => {
  expect(await f.postJson(url('/private/x'), {})).toBeNull();
  expect(main.requests.map(r => r.path)).toEqual(['/robots.txt']);
  expect(logLines.some(line => line.includes(url('/private/x')) && /disallowed/.test(line))).toBe(true);
});

it('postJson shares the site queue with GETs: one at a time, spaced by the delay', async () => {
  const bodies = await Promise.all([f.fetchText(url('/a')), f.postJson(url('/echo'), { n: 1 }), f.fetchText(url('/b'))]);
  expect(bodies).toEqual(['ok-a', 'POST {"n":1}', 'ok-b']);
  expect(main.requests).toHaveLength(4);
  expectSpacedAndSerial(main.requests, 190);
});

it('postJson is never retried, even after a 5xx, and never follows a redirect', async () => {
  expect(await f.postJson(url('/flaky'), {})).toBeNull();
  expect(requestsTo('/flaky')).toHaveLength(1);
  expect(await f.postJson(url('/to-a'), {})).toBeNull();
  expect(requestsTo('/to-a')).toHaveLength(1);
  expect(requestsTo('/a')).toHaveLength(0);
  expect(logLines.some(line => line.startsWith('retry'))).toBe(false);
  expect(logLines.filter(line => line.startsWith('not fetched'))).toHaveLength(2);
});

it('postJson answers count toward pushback, and a refused site gets no more POSTs or GETs', async () => {
  const pushy = await startServer(pushbackHandler);
  try {
    for (const path of ['/429/1', '/403/2', '/429/3']) expect(await f.postJson(pushy.url(path), {})).toBeNull();
    expect(refusalLines()).toHaveLength(1);
    expect(await f.postJson(pushy.url('/ok/4'), {})).toBeNull();
    expect(await f.fetchText(pushy.url('/ok/5'))).toBeNull();
    expect(pagesAsked(pushy)).toEqual(['/429/1', '/403/2', '/429/3']);
  } finally {
    await pushy.close();
  }
});

describe('postJson with a body that is not JSON', () => {
  const circular: Record<string, unknown> = {};
  circular.self = circular;
  it.each([
    ['a circular object', circular],
    ['a BigInt', { n: 1n }],
    ['undefined', undefined],
    ['a function', () => 1],
  ])('returns null, logged, without asking robots.txt or sending anything: %s', async (_name, body) => {
    expect(await f.postJson(url('/echo'), body)).toBeNull();
    expect(main.requests).toEqual([]);
    expect(logLines.filter(line => line.includes(url('/echo')) && /not JSON/.test(line))).toHaveLength(1);
  });
});

it('postJson is not retried after a timeout, and the next request to the site is still spaced', async () => {
  const quick = createFetcher({ userAgent: 'test-bot/0.1', delayMs: 200, timeoutMs: 150, log: line => logLines.push(line) });
  expect(await quick.postJson(url('/hang'), {})).toBeNull();
  expect(await quick.fetchText(url('/a'))).toBe('ok-a');
  expect(requestsTo('/hang')).toHaveLength(1);
  expect(logLines.some(line => line.startsWith('retry'))).toBe(false);
  const [hang] = requestsTo('/hang');
  const [a] = requestsTo('/a');
  expect(a.start - hang.start).toBeGreaterThanOrEqual(150 + 190); // the timeout, then the delay
});

it('postJson is not retried after a network error, and the next request to the site is still spaced', async () => {
  const dropping = await startServer((req, res) => {
    if (req.url === '/robots.txt') return send(res, 200, 'User-agent: *\nDisallow:');
    if (req.url === '/drop') return req.socket.destroy();
    return send(res, 200, 'ok');
  });
  try {
    expect(await f.postJson(dropping.url('/drop'), {})).toBeNull();
    expect(await f.fetchText(dropping.url('/a'))).toBe('ok');
    expect(dropping.requests.map(r => r.path)).toEqual(['/robots.txt', '/drop', '/a']);
    expect(logLines.some(line => line.startsWith('retry'))).toBe(false);
    const [drop, a] = dropping.requests.slice(1);
    expect(a.start - drop.start).toBeGreaterThanOrEqual(190);
  } finally {
    await dropping.close();
  }
});

it('postJson waits for the site\'s Crawl-delay', async () => {
  const slowHost = await startServer((req, res) =>
    (req.url === '/robots.txt' ? send(res, 200, 'User-agent: *\nCrawl-delay: 0.4') : send(res, 200, 'ok')));
  try {
    await Promise.all([slowHost.url('/a'), slowHost.url('/b'), slowHost.url('/c')].map(u => f.postJson(u, {})));
    expectSpacedAndSerial(slowHost.requests.filter(r => r.path !== '/robots.txt'), 390);
    expect(slowHost.requests.filter(r => r.method === 'POST')).toHaveLength(3);
  } finally {
    await slowHost.close();
  }
});

it('a POST already queued when its site is refused is not sent', async () => {
  const glacial = await startServer(glacialHandler);
  const plain = await startServer((req, res) =>
    (req.url === '/robots.txt' ? send(res, 200, 'User-agent: *\nDisallow:') : send(res, 200, 'ok')));
  try {
    expect(await f.postJson(plain.url('/a'), {})).toBe('ok'); // before the refusal: fine
    const answers = await Promise.all([f.fetchText(glacial.url('/a')), f.postJson(plain.url('/b'), {})]);
    expect(answers).toEqual([null, null]);
    expect(plain.requests.map(r => r.path)).toEqual(['/robots.txt', '/a']);
    expect(logLines.filter(line => line.includes(plain.url('/b')) && /Crawl-delay 31/.test(line))).toHaveLength(1);
  } finally {
    await glacial.close();
    await plain.close();
  }
});

it('USER_AGENT is generic', () => { expect(USER_AGENT).toBe('tour-comparison-bot/0.1'); });

it('uses USER_AGENT by default', async () => {
  const plain = createFetcher({ log: () => {} });
  expect(await plain.fetchText(url('/a'))).toBe('ok-a');
  expect(main.requests.length).toBeGreaterThan(0);
  for (const r of main.requests) expect(r.userAgent).toBe('tour-comparison-bot/0.1');
}, 10_000); // robots.txt, then the page after the default 3 s delay
