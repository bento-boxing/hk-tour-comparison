/**
 * Saves a trimmed operator page as a test fixture.
 *
 *   pnpm --filter @hktours/scraper fixture <url> <output-path>
 *     fetches <url> through the polite fetcher (robots.txt, honest User-Agent, 3-second spacing),
 *     trims it with trimFixture and writes it to <output-path>.
 *
 *   pnpm --filter @hktours/scraper fixture --from <saved-page> <output-path>
 *     trims a page already fetched through the polite fetcher and saved untrimmed outside the
 *     repository, so the same URL is never requested twice.
 *
 * Relative paths are taken from the directory the command was run in. An existing output
 * file is never overwritten.
 */
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { createFetcher } from '../src/polite-fetch';
import { trimFixture } from '../src/trim-fixture';

const USAGE = [
  'usage: pnpm --filter @hktours/scraper fixture <url> <output-path>',
  '       pnpm --filter @hktours/scraper fixture --from <saved-page> <output-path>',
].join('\n');

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2).filter(arg => arg !== '--');
  if (args.length !== 2 && !(args.length === 3 && args[0] === '--from')) fail(USAGE);

  // pnpm runs package scripts in the package directory; INIT_CWD is where the command was typed.
  const base = process.env.INIT_CWD ?? process.cwd();
  const output = resolve(base, args[args.length - 1]);
  if (existsSync(output)) fail(`refusing to overwrite ${output}`);

  let html: string;
  if (args[0] === '--from') {
    html = await readFile(resolve(base, args[1]), 'utf8');
  } else {
    const fetched = await createFetcher().fetchText(args[0]);
    if (fetched === null) fail(`nothing saved: ${args[0]} was not fetched (see the line above)`);
    html = fetched;
  }

  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, trimFixture(html), { flag: 'wx' }); // wx: fails rather than overwrite
  console.log(`saved ${output}`);
}

await main();
