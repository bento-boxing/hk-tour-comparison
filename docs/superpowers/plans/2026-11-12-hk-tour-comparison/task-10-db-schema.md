# Task 10: Database schema and test database

**Goal:** the Postgres schema, a tiny database interface that works against both Supabase and an in-memory test database, and a migration runner.

**Files:**
- Create: `packages/db/migrations/0001_init.sql`
- Create: `packages/db/src/db.ts`, `packages/db/src/migrate.ts`, `packages/db/src/test-db.ts`
- Test: `packages/db/src/schema.test.ts`
- Modify: `packages/db/src/index.ts` (re-export `db.ts`, `migrate.ts`; export `test-db.ts` from a separate entry `@hktours/db/test` so PGlite never ships to production)
- Add dependencies in `packages/db`: `pg`, `@types/pg`, `@hktours/core`; dev: `@electric-sql/pglite`

**Interfaces — Produces:**

```ts
export interface Db {
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]>;
  /** Runs fn inside BEGIN/COMMIT; rolls back and rethrows if fn throws. */
  transaction<T>(fn: (tx: Db) => Promise<T>): Promise<T>;
  /** Multi-statement SQL with no parameters (migrations). */
  exec(sql: string): Promise<void>;
  close(): Promise<void>;
}
export function createPgDb(connectionString: string): Db;      // db.ts, uses pg.Pool, max 3 connections
export async function migrate(db: Db): Promise<string[]>;      // migrate.ts, returns names applied this call
export async function createTestDb(): Promise<Db>;             // test-db.ts, fresh in-memory PGlite, migrated
```

Rules for every query in this package:
- Positional parameters (`$1`), never string concatenation.
- Select `date` columns as text (`date::text`) so callers always get `'YYYY-MM-DD'` strings, identically on `pg` and PGlite.

`migrate` applies every `migrations/*.sql` in filename order that is not yet recorded in a `schema_migrations(name text primary key, applied_at timestamptz)` table, each in a transaction.

## Schema (`0001_init.sql`)

```sql
create table operators (
  id text primary key,
  name_zh text not null,
  name_en text not null,
  site_url text not null,
  color text not null,
  last_good_run_at timestamptz
);
insert into operators (id, name_zh, name_en, site_url, color) values
  ('egl',     '東瀛遊',   'EGL Tours',        'https://www.egltours.com',  '#d62839'),
  ('jetour',  '捷旅',     'Jetour',           'https://www.jetour.com.hk', '#ee7b06'),
  ('texpert', '專業旅運', 'Travel Expert',    'https://www.texpert.com',   '#7d3cc8'),
  ('bigline', '大航假期', 'Big Line Holiday', 'https://www.bigline.hk',    '#2a9d4b');

create table tours (
  id bigint generated always as identity primary key,
  operator_id text not null references operators(id),
  code text not null,
  url text not null,
  title text not null,
  days int not null check (days between 1 and 60),
  nights int,
  from_price_hkd int not null check (from_price_hkd >= 100),
  start_kind text not null check (start_kind in ('hk','sz','other')),
  start_label text,
  end_kind text not null check (end_kind in ('hk','sz','other')),
  end_label text,
  active boolean not null default true,
  first_seen date not null,
  last_seen date not null,
  unique (operator_id, code)
);
create index tours_active_idx on tours (active, from_price_hkd);

create table tour_stops (
  tour_id bigint not null references tours(id) on delete cascade,
  position int not null,
  country_id text not null,
  region_id text not null,
  city_id text,
  primary key (tour_id, position)
);
create index tour_stops_region_idx on tour_stops (region_id);
create index tour_stops_country_idx on tour_stops (country_id);

create table departures (
  tour_id bigint not null references tours(id) on delete cascade,
  date date not null,
  price_hkd int check (price_hkd is null or price_hkd >= 100),
  primary key (tour_id, date)
);
create index departures_date_idx on departures (date);

create table price_snapshots (
  tour_id bigint not null references tours(id) on delete cascade,
  date date not null,
  price_hkd int not null,
  primary key (tour_id, date)
);

create table scrape_runs (
  id bigint generated always as identity primary key,
  operator_id text not null references operators(id),
  run_date date not null,
  started_at timestamptz not null,
  finished_at timestamptz not null,
  pages_fetched int not null,
  tours_saved int not null,
  parse_failures int not null,
  ok boolean not null,
  reasons text[] not null default '{}'
);
create index scrape_runs_operator_idx on scrape_runs (operator_id, run_date desc);

create table unmatched_places (
  operator_id text not null references operators(id),
  name text not null,
  example_tour_code text not null,
  seen_count int not null default 1,
  last_seen date not null,
  primary key (operator_id, name)
);

alter table operators        enable row level security;
alter table tours            enable row level security;
alter table tour_stops       enable row level security;
alter table departures       enable row level security;
alter table price_snapshots  enable row level security;
alter table scrape_runs      enable row level security;
alter table unmatched_places enable row level security;
```

Row level security is enabled with no policies so Supabase's public REST API exposes nothing. The scraper and the website connect with the database connection string (server-side only), which is not subject to these policies.

## Steps

- [ ] **Step 1: Write the failing tests** in `schema.test.ts`:

```ts
let db: Db;
beforeEach(async () => { db = await createTestDb(); });
afterEach(async () => { await db.close(); });

it('seeds four operators with their colours', async () => {
  const rows = await db.query<{ id: string; color: string }>('select id, color from operators order by id');
  expect(rows).toEqual([
    { id: 'bigline', color: '#2a9d4b' }, { id: 'egl', color: '#d62839' },
    { id: 'jetour', color: '#ee7b06' }, { id: 'texpert', color: '#7d3cc8' },
  ]);
});
it('migrate is idempotent', async () => { expect(await migrate(db)).toEqual([]); });
it('rejects a duplicate (operator, code)', async () => { /* insert the same tour twice → second rejects */ });
it('rejects days = 0 and from_price_hkd = 50', async () => { /* each insert rejects */ });
it('deleting a tour cascades to stops, departures and snapshots', async () => { /* counts go to 0 */ });
it('returns dates as YYYY-MM-DD strings when selected as text', async () => {
  /* insert a departure on 2026-12-18; select date::text → '2026-12-18' */
});
it('transaction rolls back on throw', async () => {
  await expect(db.transaction(async tx => {
    await tx.query("update operators set color = '#000000' where id = 'egl'");
    throw new Error('boom');
  })).rejects.toThrow('boom');
  const [row] = await db.query<{ color: string }>("select color from operators where id = 'egl'");
  expect(row.color).toBe('#d62839');
});
```

Write the commented tests in full.

- [ ] **Step 2: Run** `pnpm vitest run packages/db` — Expected: FAIL.
- [ ] **Step 3: Write the migration** exactly as above, and implement `db.ts`, `migrate.ts`, `test-db.ts`. Check PGlite's current API in its documentation for running parameterised queries, multi-statement SQL and transactions.
- [ ] **Step 4: Run the tests** — Expected: PASS.
- [ ] **Step 5: Commit** — `git commit -am "feat(db): schema, Db interface, migrations, in-memory test db"`
