// BUILD_WITHOUT_DATABASE: the setting that lets a build go without the database (CI, which has none, and a local
// build without one). In such a build the stored pages (/tours, /operators) are made per request instead of at build
// time (lib/db.ts storedDb). Not a secret, and for CI and local builds only: a build on Vercel must read the database,
// so next.config.ts refuses it there. No imports: next.config.ts loads this file.

type Env = Record<string, string | undefined>;

/** True when this build was told it has no database: BUILD_WITHOUT_DATABASE=1, exactly. */
export function buildsWithoutDatabase(env: Env = process.env): boolean {
  return env.BUILD_WITHOUT_DATABASE === '1';
}

/** Throws when BUILD_WITHOUT_DATABASE=1 is set on Vercel (Vercel sets VERCEL for its builds). The message names both. */
export function checkBuildWithoutDatabase(env: Env = process.env): void {
  if (buildsWithoutDatabase(env) && env.VERCEL) {
    throw new Error(
      'BUILD_WITHOUT_DATABASE=1 is for CI and local builds only, and this build runs on Vercel (VERCEL is set). Remove it '
      + "from the Vercel project's environment variables: a build there must read the database (DATABASE_URL) to make "
      + 'the stored pages.',
    );
  }
}
