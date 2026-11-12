import { it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import { performance } from 'node:perf_hooks';
import {
  createFetcher, siteOf, MAX_CRAWL_DELAY_MS, REQUEST_DELAY_MS, REQUEST_TIMEOUT_MS, USER_AGENT,
} from './polite-fetch';
import type { Fetcher } from './types';

interface RecordedRequest { path: string; userAgent: string | undefined; start: number; end: number }

interface TestServer {
  url(path: string): string;
  requests: RecordedRequest[];
  close(): Promise<void>;
}

type Handler = (req: IncomingMessage, res: ServerResponse) => void;

/** A local HTTP server on a random port that records each request's path, user-agent, start and end time. */
async function startServer(handler: Handler): Promise<TestServer> {
  const requests: RecordedRequest[] = [];
  const server = createServer((req, res) => {
    const record: RecordedRequest = {
      path: req.url ?? '', userAgent: req.headers['user-agent'], start: performance.now(), end: Infinity,
    };
    requests.push(record);
    res.on('finish', () => { record.end = performance.now(); });
    handler(req, res);
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  return {
    url: path => `http://127.0.0.1:${port}${path}`,
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
    default: return send(res, 404);
  }
};

let main: TestServer;
let logLines: string[];
let f: Fetcher;
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

it('does not crawl a site whose Crawl-delay is over the cap, and says why once', async () => {
  expect(MAX_CRAWL_DELAY_MS).toBe(30_000);
  const glacial = await startServer((req, res) =>
    (req.url === '/robots.txt' ? send(res, 200, 'User-agent: *\nCrawl-delay: 31') : send(res, 200, 'ok')));
  try {
    expect(await f.fetchText(glacial.url('/a'))).toBeNull();
    expect(await f.fetchText(glacial.url('/b'))).toBeNull();
    expect(glacial.requests.map(r => r.path)).toEqual(['/robots.txt']);
    expect(logLines.filter(line => /crawl-delay/i.test(line))).toHaveLength(1);
    expect(logLines).toHaveLength(1);
  } finally {
    await glacial.close();
  }
});

it('USER_AGENT is generic', () => { expect(USER_AGENT).toBe('tour-comparison-bot/0.1'); });

it('uses USER_AGENT by default', async () => {
  const plain = createFetcher({ log: () => {} });
  expect(await plain.fetchText(url('/a'))).toBe('ok-a');
  expect(main.requests.length).toBeGreaterThan(0);
  for (const r of main.requests) expect(r.userAgent).toBe('tour-comparison-bot/0.1');
}, 10_000); // robots.txt, then the page after the default 3 s delay
