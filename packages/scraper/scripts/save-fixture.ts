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
 *   Allow-list mode (in either form; not together with --keep): only what the parser reads keeps its text.
 *     --allow <selector>             text inside matching elements is kept (cut above KEEP_TEXT_LIMIT)
 *     --allow-max <n> <selector>     the same, but cut above n characters
 *     --allow-key <key>              JSON string values under this key are kept
 *   Each is repeatable. Each operator's lists are in docs/operators/<id>.md.
 *
 * Relative paths are taken from the directory the command was run in. An existing output
 * file is never overwritten. Each run creates its own fetcher, so back-to-back live runs are
 * not spaced: leave at least 3 seconds between runs against the same site.
 */
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { createFetcher } from '../src/polite-fetch';
import { KEEP_TEXT_LIMIT, trimFixture, type AllowList, type TrimOptions } from '../src/trim-fixture';

const USAGE = [
  'usage: pnpm --filter @hktours/scraper fixture [--keep <selector>]... <url> <output-path>',
  '       pnpm --filter @hktours/scraper fixture [--keep <selector>]... --from <saved-page> <output-path>',
  `--keep (repeatable): text inside matching elements is cut only above ${KEEP_TEXT_LIMIT} characters.`,
  'Allow-list mode, instead of --keep: --allow <selector>, --allow-max <n> <selector>, --allow-key <key> (each repeatable);',
  `only text in allowed elements (cut above ${KEEP_TEXT_LIMIT}, or n, characters) and JSON strings under allowed keys is kept.`,
  'Each run creates its own fetcher, so back-to-back live runs are not spaced;',
  'leave at least 3 seconds between runs against the same site.',
].join('\n');

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

/** The value after an option, which must be present and not another option. */
function optionValue(argv: string[], at: number): string {
  const value = argv[at];
  if (value === undefined || value.trim() === '' || value.startsWith('--')) fail(USAGE);
  return value;
}

/** Splits the trim options (`--keep`, `--allow`, `--allow-max`, `--allow-key`) from the other arguments. */
function parseArgs(argv: string[]): { trim: TrimOptions; args: string[] } {
  const keepSelectors: string[] = [];
  const allow: Required<AllowList> = { selectors: [], jsonKeys: [] };
  const args: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--') continue;
    if (arg === '--keep') keepSelectors.push(optionValue(argv, ++i));
    else if (arg === '--allow') allow.selectors.push(optionValue(argv, ++i));
    else if (arg === '--allow-key') allow.jsonKeys.push(optionValue(argv, ++i));
    else if (arg === '--allow-max') {
      const maxChars = Number(optionValue(argv, ++i));
      if (!Number.isInteger(maxChars) || maxChars < 1) fail(USAGE);
      allow.selectors.push({ selector: optionValue(argv, ++i), maxChars });
    } else args.push(arg);
  }
  const allowListGiven = allow.selectors.length > 0 || allow.jsonKeys.length > 0;
  if (allowListGiven && keepSelectors.length > 0) fail(USAGE);
  return { trim: allowListGiven ? { allow } : { keepSelectors }, args };
}

async function main(): Promise<void> {
  const { trim, args } = parseArgs(process.argv.slice(2));
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
  await writeFile(output, trimFixture(html, trim), { flag: 'wx' }); // wx: fails rather than overwrite
  console.log(`saved ${output}`);
}

await main();
