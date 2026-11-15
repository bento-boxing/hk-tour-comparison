import { isPlainMessage, logRef, refId } from '@hktours/db/public-error';

export { logRef } from '@hktours/db/public-error';

/**
 * How a log line shows text that may carry an operator's wording: a page's address before its tour code is known,
 * the message of an error raised by code we do not control, and other operator wording (Sunflower's listing labels).
 * The nightly run's log is public (GitHub Actions); once a page's tour code is known, its log lines name it by that
 * code instead. A real run uses PUBLIC_LOG; a dry run, whose output is not public, uses DRY_RUN_LOG, which prints
 * everything whole, followed by the same reference wherever PUBLIC_LOG hides a part. A dry run's `page {…}` lines
 * also carry each page's reference (`ref`), so a reference in the public log can be looked up in a dry run's output.
 * The reference and the plain-message rule are shared with the database package (public-error.ts there).
 */
export interface LogView {
  address(url: string): string;
  message(text: string): string;
  /** Operator wording that is neither an address nor a message: PUBLIC_LOG prints `publicForm` (counts, say). */
  wording(text: string, publicForm: string): string;
}

/**
 * The text an address's reference is taken from: an http(s) address as `new URL` writes it (non-ASCII text
 * percent-encoded, a host in lower case), so one page has one reference however a line got its address (the fetcher's
 * retry line has it rewritten); any other text as it is.
 */
function canonical(text: string): string {
  try {
    const url = new URL(text);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : text;
  } catch {
    return text;
  }
}

/** `1a2b3c4d`: an address's reference, as a dry run's `page` line carries it. */
export function addressRefId(url: string): string {
  return refId(canonical(url));
}

/** `(ref 1a2b3c4d)`: an address's reference, as a log line carries it. */
export function addressRef(url: string): string {
  return logRef(canonical(url));
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

/** The public run log: plain text as it is; anything else with its non-plain part as `*`, and a reference. */
export const PUBLIC_LOG: LogView = {
  address: url => {
    const hidden = hiddenForm(url);
    return hidden === null ? url : `${hidden} ${addressRef(url)}`;
  },
  message: text => (isPlainMessage(text) ? text : `${HIDDEN} ${logRef(text)}`),
  wording: (_text, publicForm) => publicForm,
};

/** A dry run's log (not public): everything whole, followed by the reference wherever PUBLIC_LOG hides a part. */
export const DRY_RUN_LOG: LogView = {
  address: url => (hiddenForm(url) === null ? url : `${url} ${addressRef(url)}`),
  message: text => (isPlainMessage(text) ? text : `${text} ${logRef(text)}`),
  wording: text => text,
};
