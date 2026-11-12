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
 *   --keep <selector> (repeatable, in either form) marks elements whose text is a list of facts,
 *     such as day headings, so it is cut only above KEEP_TEXT_LIMIT characters (see trimFixture).
 *
 * Relative paths are taken from the directory the command was run in. An existing output
 * file is never overwritten. Each run creates its own fetcher, so back-to-back live runs are
 * not spaced: leave at least 3 seconds between runs against the same site.
 */
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { createFetcher } from '../src/polite-fetch';
import { KEEP_TEXT_LIMIT, trimFixture } from '../src/trim-fixture';

const USAGE = [
  'usage: pnpm --filter @hktours/scraper fixture [--keep <selector>]... <url> <output-path>',
  '       pnpm --filter @hktours/scraper fixture [--keep <selector>]... --from <saved-page> <output-path>',
  `--keep (repeatable): text inside matching elements is cut only above ${KEEP_TEXT_LIMIT} characters.`,
  'Each run creates its own fetcher, so back-to-back live runs are not spaced;',
  'leave at least 3 seconds between runs against the same site.',
].join('\n');

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

/** Splits `--keep <selector>` pairs from the other arguments. */
function parseArgs(argv: string[]): { keepSelectors: string[]; args: string[] } {
  const keepSelectors: string[] = [];
  const args: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--') continue;
    if (argv[i] !== '--keep') {
      args.push(argv[i]);
      continue;
    }
    const selector = argv[++i];
    if (selector === undefined || selector.trim() === '' || selector.startsWith('--')) fail(USAGE);
    keepSelectors.push(selector);
  }
  return { keepSelectors, args };
}

async function main(): Promise<void> {
  const { keepSelectors, args } = parseArgs(process.argv.slice(2));
  const fromSavedPage = args[0] === '--from';
  if (args.length !== (fromSavedPage ? 3 : 2)) fail(USAGE);

  // pnpm runs package scripts in the package directory; INIT_CWD is where the command was typed.
  const base = process.env.INIT_CWD ?? process.cwd();
  const output = resolve(base, args[args.length - 1]);
  if (existsSync(output)) fail(`refusing to overwrite ${output}`);

  let html: string;
  if (fromSavedPage) {
    html = await readFile(resolve(base, args[1]), 'utf8');
  } else {
    const fetched = await createFetcher().fetchText(args[0]);
    if (fetched === null) fail(`nothing saved: ${args[0]} was not fetched (see the line above)`);
    html = fetched;
  }

  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, trimFixture(html, { keepSelectors }), { flag: 'wx' }); // wx: fails rather than overwrite
  console.log(`saved ${output}`);
}

await main();
