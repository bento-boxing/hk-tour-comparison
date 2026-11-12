# Task 20: Website scaffold, theme, language and layout

**Goal:** a Next.js app in the workspace with the approved palette, Traditional Chinese text with a developer-only English mode, and the shared page frame (navigation bar and footer).

Open `docs/design/mockup.html` in a browser first. The mockup's `<style>` block is the reference for colours, spacing, radii and font sizes throughout Tasks 20–25.

**Files:**
- Create: `apps/web/package.json`, `apps/web/tsconfig.json`, `apps/web/next.config.ts`, `apps/web/vitest.config.ts` (jsdom, React Testing Library setup)
- Create: `apps/web/app/layout.tsx`, `apps/web/app/page.tsx` (placeholder), `apps/web/app/chain/page.tsx` (placeholder)
- Create: `apps/web/lib/theme.css`, `apps/web/lib/i18n.ts`, `apps/web/lib/dict.zh-Hant.ts`, `apps/web/lib/dict.en.ts`, `apps/web/lib/format.ts`, `apps/web/lib/db.ts`
- Create: `apps/web/components/NavBar.tsx`, `apps/web/components/Footer.tsx`
- Test: `apps/web/lib/i18n.test.ts`, `apps/web/lib/format.test.ts`, `apps/web/components/NavBar.test.tsx`

**Interfaces — Produces:**

```ts
// i18n.ts
export type Locale = 'zh-Hant' | 'en';
/** 'en' only when DEV_LOCALE === 'en' and VERCEL_ENV !== 'production'. Otherwise 'zh-Hant'. */
export function getLocale(env: Record<string, string | undefined>): Locale;
export type DictKey = keyof typeof import('./dict.zh-Hant').default;
/** Replaces {name} placeholders. */
export function translate(locale: Locale, key: DictKey, vars?: Record<string, string | number>): string;
/** The translate function every component receives as its `t` prop. Later tasks call this type `T`. */
export type T = (key: DictKey, vars?: Record<string, string | number>) => string;
export function getT(): T; // uses process.env

// format.ts
export function formatPrice(hkd: number): string;                 // 7999 → 'HK$7,999'
export function formatChipDate(date: IsoDate, today: IsoDate): string; // same year → '12/18'; other year → '2027/1/3'
export function formatLength(days: number, nights: number | null, t): string; // '5日4夜' or '5日'
export function formatUpdated(iso: string, today: IsoDate, t): string;        // '更新：今日 03:10' or '更新：11月11日 03:10', Hong Kong time

// db.ts
export function getDb(): Db; // one createPgDb(process.env.DATABASE_URL) per server process; throws a clear error if unset
```

`dict.zh-Hant.ts` is the source of truth; `dict.en.ts` must have exactly the same keys (enforced by a `satisfies Record<DictKey, string>` and by a test). Components take text only through `t`; no Chinese or English literals in components. Later tasks add keys to both files.

## Theme (`theme.css`)

```css
:root {
  --charcoal: #50514f; --ash: #cbd4c2; --snow: #fffcff; --cerulean: #247ba0; --khaki: #c3b299;
  --text-muted: #7b7c76; --text-faint: #8f908a; --surface: #ffffff; --panel: #f1f3ed;
  --hit: #e6f1f6; --price-down: #1f7a4d; --price-up: #a8432a;
  --op-egl: #d62839; --op-jetour: #ee7b06; --op-texpert: #7d3cc8; --op-bigline: #2a9d4b;
  --radius-card: 10px; --radius-pill: 999px;
  --font: "Noto Sans TC", "PingFang TC", "Microsoft JhengHei", sans-serif;
}
body { background: var(--snow); color: var(--charcoal); font-family: var(--font); margin: 0; }
```

Use plain CSS (CSS modules per component, tokens from `theme.css`). No UI library, no dark mode. System fonts only; do not load web fonts.

## Layout

- `<html lang="zh-Hant">` always, even in developer English mode.
- **Nav bar** (mockup `.bar`): charcoal background, snow text; site name `旅行團比較`, then links `搜尋旅行團` (`/`) and `連續行程` (`/chain`). The current page's link is fully opaque with a 2px khaki underline; the other is 75% opaque.
- **Footer**: `本網站與各旅行社並無任何關連。價錢及出發日期以旅行社網站為準。` in faint text.
- Page content is centred, max width 1100px, 20px side padding; 16px on screens under 640px.

## Dictionary keys for this task

| Key | zh-Hant | en |
|---|---|---|
| `site.name` | 旅行團比較 | Tour Compare |
| `nav.search` | 搜尋旅行團 | Search tours |
| `nav.chain` | 連續行程 | Chain tours |
| `footer.disclaimer` | 本網站與各旅行社並無任何關連。價錢及出發日期以旅行社網站為準。 | Not affiliated with any operator. Confirm prices and dates on the operator's site. |
| `length.daysNights` | {days}日{nights}夜 | {days}D{nights}N |
| `length.days` | {days}日 | {days}D |
| `updated.today` | 更新：今日 {time} | Updated today {time} |
| `updated.on` | 更新：{month}月{day}日 {time} | Updated {month}/{day} {time} |

## Steps

- [ ] **Step 1: Create the Next.js app** in `apps/web` (App Router, TypeScript, no Tailwind, no `src/` directory), package name `@hktours/web`, depending on `@hktours/core` and `@hktours/db`. Configure Next to transpile the two workspace packages. Add Vitest with jsdom and `@testing-library/react`, `@testing-library/user-event`, `@testing-library/jest-dom`.

- [ ] **Step 2: Write the failing tests.**

```ts
// i18n.test.ts
it.each([
  [{}, 'zh-Hant'],
  [{ DEV_LOCALE: 'en' }, 'en'],
  [{ DEV_LOCALE: 'en', VERCEL_ENV: 'preview' }, 'en'],
  [{ DEV_LOCALE: 'en', VERCEL_ENV: 'production' }, 'zh-Hant'],
  [{ DEV_LOCALE: 'fr' }, 'zh-Hant'],
  [{ DEV_LOCALE: 'EN' }, 'zh-Hant'],
])('getLocale(%j) → %s', (env, locale) => { expect(getLocale(env)).toBe(locale); });
it('both dictionaries have identical keys and no empty values', () => {
  expect(Object.keys(en).sort()).toEqual(Object.keys(zh).sort());
  for (const v of [...Object.values(en), ...Object.values(zh)]) expect(v.length).toBeGreaterThan(0);
});
it('translate fills placeholders', () => {
  expect(translate('zh-Hant', 'length.daysNights', { days: 5, nights: 4 })).toBe('5日4夜');
});

// format.test.ts
it('formatPrice', () => { expect(formatPrice(7999)).toBe('HK$7,999'); expect(formatPrice(12500)).toBe('HK$12,500'); });
it('formatChipDate', () => {
  expect(formatChipDate('2026-12-18', '2026-11-12')).toBe('12/18');
  expect(formatChipDate('2027-01-03', '2026-11-12')).toBe('2027/1/3');
});
it('formatLength', () => { expect(formatLength(5, 4, tZh)).toBe('5日4夜'); expect(formatLength(5, null, tZh)).toBe('5日'); });
it('formatUpdated uses Hong Kong time', () => {
  expect(formatUpdated('2026-11-11T19:10:00Z', '2026-11-12', tZh)).toBe('更新：今日 03:10');
  expect(formatUpdated('2026-11-10T19:10:00Z', '2026-11-12', tZh)).toBe('更新：11月11日 03:10');
});

// NavBar.test.tsx
it('shows the site name and both links', () => {
  render(<NavBar current="search" t={tZh} />);
  expect(screen.getByText('旅行團比較')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: '搜尋旅行團' })).toHaveAttribute('href', '/');
  expect(screen.getByRole('link', { name: '連續行程' })).toHaveAttribute('href', '/chain');
});
it('marks the current page', () => {
  render(<NavBar current="chain" t={tZh} />);
  expect(screen.getByRole('link', { name: '連續行程' })).toHaveAttribute('aria-current', 'page');
  expect(screen.getByRole('link', { name: '搜尋旅行團' })).not.toHaveAttribute('aria-current');
});
```

- [ ] **Step 3: Run** `pnpm --filter @hktours/web test` — Expected: FAIL.
- [ ] **Step 4: Implement** the files listed. The two pages render the layout with an empty body for now.
- [ ] **Step 5: Run** `pnpm test && pnpm typecheck && pnpm --filter @hktours/web build` — Expected: all pass; the build succeeds without `DATABASE_URL` (no page queries the database yet).
- [ ] **Step 6: Look at it.** `pnpm --filter @hktours/web dev`, open `/` and `/chain`, compare the nav bar with the mockup. Then `DEV_LOCALE=en pnpm --filter @hktours/web dev` and confirm the text is English and there is no language switcher anywhere.
- [ ] **Step 7: Commit** — `git add -A && git commit -m "feat(web): Next.js scaffold, theme, zh-Hant text with dev-only English"`
