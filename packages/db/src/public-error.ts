import { createHash } from 'node:crypto';

/**
 * Printing an unexpected error in a public log (the nightly workflow's logs on GitHub Actions: the migrate job and
 * each scrape job). Node would print an uncaught error whole, and a database error's `detail`, `where` or `hint` can
 * quote the row it was given, an operator's tour title included. Used by migrate-cli.ts and by the scraper's CLI
 * (packages/scraper/src/cli.ts), whose public-log.ts also takes logRef and the plain-message rule from here.
 */

/** `1a2b3c4d`: the first 8 hex characters of the text's SHA-256. The same text always gets the same one. */
export function refId(text: string): string {
  return createHash('sha256').update(text).digest('hex').slice(0, 8);
}

/** `(ref 1a2b3c4d)`, refId's form in a log line. */
export function logRef(text: string): string {
  return `(ref ${refId(text)})`;
}

/** Printable ASCII without `"`, `%` or `://`: no quotation of what was read, no encoded text, no address. */
const PLAIN_MESSAGE = /^(?!.*:\/\/)[ !#-$&-~]*$/;

export function isPlainMessage(text: string): boolean {
  return PLAIN_MESSAGE.test(text);
}

/** The message as it is when plain, else `* (ref …)`. */
export function publicMessage(text: string): string {
  return isPlainMessage(text) ? text : `* ${logRef(text)}`;
}

/** A schema name: a table, column, constraint, schema or routine name as this project's migrations write them. */
const IDENTIFIER = /^[A-Za-z0-9_]{1,63}$/;
/**
 * The fields of an error that hold no row data, printed when their value has the expected shape: SQLSTATE or Node's
 * error code (`23505`, `ECONNREFUSED`, `SELF_SIGNED_CERT_IN_CHAIN`), severity, and the schema names node-postgres
 * gives. Never `detail`, `where`, `hint`, `internalQuery`, the query or its parameters: they can hold row values.
 */
const FIELDS: [name: string, shape: RegExp][] = [
  ['code', /^[A-Z0-9_]{1,40}$/],
  ['severity', /^[A-Z]{1,10}$/],
  ['schema', IDENTIFIER],
  ['table', IDENTIFIER],
  ['column', IDENTIFIER],
  ['constraint', IDENTIFIER],
  ['routine', IDENTIFIER],
];
/** The fields whose values a database message quotes: `unique constraint "tours_pkey"`, `column "title"`. */
const QUOTABLE = ['schema', 'table', 'column', 'constraint'];

const fieldOf = (error: unknown, name: string): unknown =>
  (typeof error === 'object' && error !== null ? (error as Record<string, unknown>)[name] : undefined);

/**
 * The message as it is when plain, or when its only non-plain parts are `"…"` quotes of a schema name the error's own
 * fields give (node-postgres quotes the constraint, column or table it names); else `* (ref …)`.
 */
function errorMessage(message: string, named: Set<string>): string {
  const unquoted = message.replace(/"([^"]*)"/g, (quote, name: string) => (named.has(name) ? '' : quote));
  return isPlainMessage(unquoted) ? message : `* ${logRef(message)}`;
}

/** `TypeError (code X, table t): message`, by the rules above. */
function headline(error: unknown): string {
  const kind = error instanceof Error ? error.name : typeof error;
  const message = error instanceof Error ? error.message : String(error);
  const shown = FIELDS.flatMap(([name, shape]) => {
    const value = fieldOf(error, name);
    return typeof value === 'string' && shape.test(value) ? [[name, value] as const] : [];
  });
  const named = new Set(shown.filter(([name]) => QUOTABLE.includes(name)).map(([, value]) => value));
  const fields = shown.length === 0 ? '' : ` (${shown.map(([name, value]) => `${name} ${value}`).join(', ')})`;
  return `${publicMessage(kind)}${fields}: ${errorMessage(message, named)}`;
}

/**
 * An unexpected error as a public log may print it: its headline (kind, the fields above, the message by the rule
 * above), its cause's headline one level deep (`  cause: …`; for `fetch failed` it holds the real reason), then the
 * error's stack `at` lines (where in the code: file names and line numbers only).
 */
export function unexpectedErrorLines(error: unknown): string[] {
  const lines = [headline(error)];
  const cause = fieldOf(error, 'cause');
  if (cause !== undefined) lines.push(`  cause: ${headline(cause)}`);
  const stack = error instanceof Error ? error.stack ?? '' : '';
  for (const line of stack.split('\n')) if (/^ {4}at [ -~]*$/.test(line)) lines.push(line);
  return lines;
}
