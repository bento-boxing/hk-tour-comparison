import { createHash } from 'node:crypto';

/**
 * How a log line shows text that may carry an operator's wording: a page's address before its tour code is known,
 * and the message of an error raised by code we do not control. The nightly run's log is public (GitHub Actions)
 * and holds tour codes and place names only, never an operator's wording; once a page's tour code is known, its
 * log lines name it by that code instead. A real run uses PUBLIC_LOG; a dry run, whose output is not public, uses
 * DRY_RUN_LOG, which prints everything whole, followed by the same reference wherever PUBLIC_LOG hides a part, so a
 * reference in the public log can be looked up in a dry run's output.
 */
export interface LogView {
  address(url: string): string;
  message(text: string): string;
}

/** `(ref 1a2b3c4d)`: the first 8 hex characters of the text's SHA-256. The same text always gets the same one. */
export function logRef(text: string): string {
  return `(ref ${createHash('sha256').update(text).digest('hex').slice(0, 8)})`;
}

/** `https://` or `http://`, an ASCII host name or IP address, and a port: no user name, password or other text. */
const ORIGIN = /^https?:\/\/[A-Za-z0-9.-]+(?::\d+)?(?=[/?#]|$)/;
/** What separates the pieces of a path, query and fragment. */
const SEPARATOR = /([/?=&#])/;
/**
 * A piece kept as it is: ASCII letters, digits and dots, with at most one `-` or `_` (`OnlineBooking`, `HTJKS25`,
 * `tour-group`, `zh-hk`, `rest_route`, `sitemap.xml`). Anything else is hidden: percent-encoded or non-ASCII text
 * (Charming's older addresses are percent-encoded titles), and a piece of three or more words (Travel Expert's
 * addresses end in the English title, hyphen-joined).
 */
const PLAIN_PIECE = /^[A-Za-z0-9.]*(?:[-_][A-Za-z0-9.]*)?$/;
const HIDDEN = '*';

/** The address with each piece that is not plain as `*`, or null when nothing is hidden. */
function hiddenForm(url: string): string | null {
  const origin = ORIGIN.exec(url)?.[0];
  if (origin === undefined) return HIDDEN;
  let hid = false;
  const rest = url.slice(origin.length).split(SEPARATOR).map((piece, i) => {
    if (i % 2 === 1 || PLAIN_PIECE.test(piece)) return piece; // odd indexes are the separators themselves
    hid = true;
    return HIDDEN;
  });
  return hid ? origin + rest.join('') : null;
}

/** Printable ASCII without `"`, `%` or `://`: no quotation of what was read, no encoded text, no address. */
const PLAIN_MESSAGE = /^(?!.*:\/\/)[ !#-$&-~]*$/;

/** The public run log: plain text as it is; anything else with its non-plain part as `*`, and a reference. */
export const PUBLIC_LOG: LogView = {
  address: url => {
    const hidden = hiddenForm(url);
    return hidden === null ? url : `${hidden} ${logRef(url)}`;
  },
  message: text => (PLAIN_MESSAGE.test(text) ? text : `${HIDDEN} ${logRef(text)}`),
};

/** A dry run's log (not public): everything whole, followed by the reference wherever PUBLIC_LOG hides a part. */
export const DRY_RUN_LOG: LogView = {
  address: url => (hiddenForm(url) === null ? url : `${url} ${logRef(url)}`),
  message: text => (PLAIN_MESSAGE.test(text) ? text : `${text} ${logRef(text)}`),
};
