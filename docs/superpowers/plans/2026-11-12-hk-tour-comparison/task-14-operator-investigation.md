# Task 14: Operator investigation (gate)

**Goal:** before any operator scraper is written, establish for each of the four operators (a) what its terms of use say about automated access, (b) exactly where its departure dates, prices and day headings come from, and (c) a small set of trimmed test pages. This task is a gate: Tasks 15–18 start only for operators the owner has approved here.

This is a research task. It produces documents and fixtures, not product code, apart from one small fixture-saving script.

**Files:**
- Create: `packages/scraper/scripts/save-fixture.ts`, `packages/scraper/src/trim-fixture.ts`
- Test: `packages/scraper/src/trim-fixture.test.ts`
- Create: `docs/operators/egl.md`, `docs/operators/jetour.md`, `docs/operators/texpert.md`, `docs/operators/bigline.md`
- Create: `packages/scraper/src/operators/<id>/fixtures/*.html` (3 per approved operator)

**Interfaces:**
- Consumes: `createFetcher` (Task 13).
- Produces:

```ts
/** Strips everything not needed to parse facts, so no full copy of an operator page is committed. */
export function trimFixture(html: string): string;
```

and, per operator, a findings document and fixtures that Tasks 15–18 build on.

## Trimming rules (`trimFixture`)

- Remove entirely: `<style>`, `<svg>`, `<img>`, `<picture>`, `<video>`, `<iframe>`, `<noscript>`, `<link>`, HTML comments, and every `<script>` except those whose content is JSON data (type `application/json` or `application/ld+json`, or a script that assigns one large object literal such as page state).
- Remove `style`, `srcset`, `src` and `data-src` attributes.
- In HTML text nodes: any run of text longer than 60 characters is cut to its first 20 characters followed by `…`.
- Inside kept JSON scripts: any string value longer than 120 characters is cut to its first 20 characters followed by `…`. The JSON must remain valid.
- Headings, dates, prices and short labels are therefore kept; descriptive prose and images are not.

## Starting points (found on 2026-11-12, from single sample pages; verify each)

| Operator | Tour page pattern | Where to find tour URLs | Notes |
|---|---|---|---|
| jetour | `https://www.jetour.com.hk/tour/<CODE>` | `https://www.jetour.com.hk/sitemap.xml` (~1,400 URLs) | robots.txt allows everything. Prices and some dates were in the HTML. The sample `/tour/THB` showed 11 prices and 2 dates, so a `/tour/<CODE>` page may be a **list of several tours** for one destination, not a single tour; establish which, and where single-tour pages live. |
| texpert | `https://www.texpert.com/zh-hk/tour/<id>-<slug>` | `https://www.texpert.com/sitemap/sitemap_tour_zh-hk.xml` (117 tours) | robots.txt disallows `/api/`, `/booking/`, `/checkout/`. Prices and many dates in the HTML. Has JSON-LD. |
| bigline | `https://bigline.hk/tour-group/<id>` | `https://bigline.hk/sitemap.xml` → `sitemap-1.xml` (~690 URLs) | robots.txt allows everything. Data is in embedded page state (`__NUXT__`), not plain text. |
| egl | `https://www.egltours.com/website/itinerary/<CODE>` | `https://www.egltours.com/sitemap.xml` (~1,200 URLs, most under `/website/`) | robots.txt disallows `/website/search-result/*` and many booking paths. Price was in the HTML; only **one** date was visible, so departure dates may load from somewhere else. Has JSON-LD. |

## Steps

- [ ] **Step 1: Write the failing test for `trimFixture`** in `trim-fixture.test.ts`:

```ts
it('removes images, styles, svg, iframes and comments', () => {
  const out = trimFixture('<div><!-- x --><style>a{}</style><img src="a.jpg"><svg></svg><iframe></iframe><p>5日4夜</p></div>');
  expect(out).not.toMatch(/<img|<style|<svg|<iframe|<!--/);
  expect(out).toContain('5日4夜');
});
it('keeps JSON scripts and drops code scripts', () => {
  const out = trimFixture('<script>alert(1)</script><script type="application/ld+json">{"name":"x"}</script>');
  expect(out).not.toContain('alert'); expect(out).toContain('"name":"x"');
});
it('cuts long text to 20 characters plus an ellipsis', () => {
  const long = '一'.repeat(61);
  expect(trimFixture(`<p>${long}</p>`)).toContain(`<p>${'一'.repeat(20)}…</p>`);
});
it('keeps short text such as headings, dates and prices', () => {
  const html = '<h3>第一天 香港 → 大阪</h3><span>2026-12-18</span><b>HK$7,999起</b>';
  expect(trimFixture(html)).toBe(html);
});
it('cuts long strings inside JSON and keeps it valid', () => {
  const out = trimFixture(`<script type="application/json">{"desc":"${'a'.repeat(200)}","price":7999}</script>`);
  const json = JSON.parse(out.match(/>(.*)</s)![1]);
  expect(json).toEqual({ desc: 'a'.repeat(20) + '…', price: 7999 });
});
it('removes style and src attributes', () => {
  expect(trimFixture('<div style="color:red" data-src="x">a</div>')).toBe('<div>a</div>');
});
```

- [ ] **Step 2: Run** — Expected: FAIL. **Step 3: Implement `trimFixture`** with cheerio. **Step 4: Run** — Expected: PASS.

- [ ] **Step 5: Write `scripts/save-fixture.ts`** — usage `pnpm --filter @hktours/scraper fixture <url> <output-path>`. It fetches the URL through `createFetcher` (so robots.txt, the User-Agent and the 3-second delay apply), runs `trimFixture`, and writes the file. It refuses to overwrite an existing file.

- [ ] **Step 6: For each operator, read its terms of use.** Find the page (usually linked in the site footer as 條款及細則 / 使用條款 / 免責聲明). In `docs/operators/<id>.md` record: the URL, the date read, and a short quotation of every clause about automated access, copying, reproduction, or use of content. If there is no such clause, say so. Do not paraphrase a restriction away.

- [ ] **Step 7: For each operator, establish where the facts come from.** Using at most 10 page fetches per operator through `createFetcher`, record in `docs/operators/<id>.md`:
  - the tour page URL pattern, and how to tell a tour page from other sitemap URLs;
  - where each of these is found, with the selector or JSON path: tour code, title, days and nights, day headings, start/end point (if stated), the "from" price, departure dates, per-date prices, and how a full or closed date is marked;
  - whether all of it is in the page that was fetched. **If departure dates require a separate request, record that request's URL and check it against robots.txt.** If it is disallowed, or needs a login, a real browser or a token, write `DATES NOT AVAILABLE WITHIN THE RULES` at the top of the document;
  - how many tour pages the sitemap lists.

- [ ] **Step 8: Save three fixtures per operator** with the script, into `packages/scraper/src/operators/<id>/fixtures/`: `multi-city.html` (a tour visiting three or more cities), `simple.html` (a short tour to one or two places), and `edge.html` (the oddest page found: no dates, sold-out dates, a non-Hong Kong start, or missing price). Skip an operator marked `DATES NOT AVAILABLE WITHIN THE RULES`.

- [ ] **Step 9: Commit** — `git add -A && git commit -m "docs: operator investigation, fixture trimming script and fixtures"`

- [ ] **Step 10 — Owner step (gate):** the owner reads the four `docs/operators/*.md` files and, for each operator, writes at the top either `APPROVED <date>` or `DROPPED <date>: <reason>`. An operator whose dates are not available within the rules, or whose terms the owner is not comfortable with, is dropped; its task (15–18) is skipped and the rest of the plan continues without it.

**Done when:** `trimFixture` tests pass, four findings documents exist, each has an owner decision at the top, and every approved operator has three fixtures.
