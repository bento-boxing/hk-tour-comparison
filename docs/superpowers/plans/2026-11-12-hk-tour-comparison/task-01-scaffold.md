# Task 1: Monorepo scaffold

**Goal:** an empty workspace where `pnpm test` and `pnpm typecheck` run and pass, locally and in CI.

**Files:**
- Create: `package.json`, `pnpm-workspace.yaml`, `tsconfig.base.json`, `vitest.workspace.ts`, `.gitignore`, `.nvmrc`
- Create: `packages/core/package.json`, `packages/core/tsconfig.json`, `packages/core/src/index.ts`, `packages/core/src/smoke.test.ts`
- Create: `packages/db/package.json`, `packages/db/tsconfig.json`, `packages/db/src/index.ts`
- Create: `packages/scraper/package.json`, `packages/scraper/tsconfig.json`, `packages/scraper/src/index.ts`
- Create: `.github/workflows/ci.yml`

**Interfaces:**
- Produces: workspace packages named `@hktours/core`, `@hktours/db`, `@hktours/scraper` (`apps/web` is added in Task 20). Root scripts `test` (`vitest run`) and `typecheck` (`tsc -b` across packages). Packages are ESM (`"type": "module"`), TypeScript `strict: true`, and import each other by package name via `workspace:*`.

## Steps

- [ ] **Step 1: Initialise git** — `git init -b main`. `.gitignore` contains: `node_modules`, `dist`, `.next`, `.env*`, `.superpowers/`, `storage/` (Crawlee's working folder), `*.tsbuildinfo`.

- [ ] **Step 2: Write the failing smoke test** in `packages/core/src/smoke.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { CORE_VERSION } from './index';

describe('workspace', () => {
  it('runs tests in packages/core', () => {
    expect(CORE_VERSION).toBe('0.1.0');
  });
});
```

- [ ] **Step 3: Create the workspace files** listed above, without `CORE_VERSION`. `.nvmrc` is `24`. `pnpm-workspace.yaml` includes `packages/*` and `apps/*`. `vitest.workspace.ts` lists `packages/*` and `apps/*`.

- [ ] **Step 4: Run `pnpm install && pnpm test`** — Expected: FAIL, `CORE_VERSION` is not exported.

- [ ] **Step 5: Export `CORE_VERSION = '0.1.0'`** from `packages/core/src/index.ts`. The other two packages' `index.ts` export nothing yet (`export {}`).

- [ ] **Step 6: Run `pnpm test && pnpm typecheck`** — Expected: 1 test passes, typecheck exits 0.

- [ ] **Step 7: Add CI** — `.github/workflows/ci.yml` runs on `push` and `pull_request`: checkout, setup pnpm, setup Node from `.nvmrc` with pnpm cache, `pnpm install --frozen-lockfile`, `pnpm typecheck`, `pnpm test`.

- [ ] **Step 8: Commit** — `git add -A && git commit -m "chore: scaffold pnpm monorepo with vitest and CI"`

**Repository:** the owner has created `git@github.com:bento-boxing/hk-tour-comparison.git`. After the commit, add it as the remote: `git remote add origin git@github.com:bento-boxing/hk-tour-comparison.git`. **Pushing is an owner step**: ask before the first `git push -u origin main`, and confirm the repository is set to public.

The repository address is never sent to operators; the scraper identifies itself only as `tour-comparison-bot/0.1`.

**Done when:** `pnpm test` shows 1 passing test and `pnpm typecheck` exits 0.
