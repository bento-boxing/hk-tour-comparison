/**
 * The site's public address and contact, for the website (metadata, robots.txt, sitemap, footer, about page) and
 * the scraper (its User-Agent). They live here, in core, because the scraper must not import the website.
 *
 * They are settings, not code (since 2026-11-20): the repository is public, and a copy run unchanged must not
 * crawl operators' sites in this site's name. Each program passes its environment to resolveSiteIdentity once,
 * at start, and refuses to run when it throws. There is no default and no fallback, in any environment: a test
 * passes its own invented values.
 */

/** The site's identity, as resolveSiteIdentity returns it. */
export interface SiteIdentity {
  /** The site's address: `https://` and the host (and a port of its own, if any), nothing after it, no trailing slash. */
  readonly siteUrl: string;
  /** Where visitors, travel agencies and the owners of the sites the scraper reads write to. */
  readonly contactEmail: string;
}

/** The environment variables resolveSiteIdentity reads, as process.env holds them. */
export type SiteIdentityEnv = Readonly<Record<string, string | undefined>>;

/** What resolveSiteIdentity throws: one line, naming each variable that is missing or malformed, never its value. */
export class SiteIdentityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SiteIdentityError';
  }
}

const README = '(see "Environment variables" in README.md)';

/**
 * Printable ASCII without the space (0x21–0x7E): what an address and a contact may hold, and so nothing that
 * could not go into an HTTP header value as it is (no line break, no control character, no non-ASCII text).
 */
const PRINTABLE_ASCII = /^[\x21-\x7e]+$/;
const UNPRINTABLE = 'holds a space, a control character or a non-ASCII character';

/** One domain label: letters, digits and inner hyphens. */
const LABEL = '[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?';
/**
 * The shape of an e-mail address, deliberately narrower than RFC 5322: the part before the @ is letters, digits,
 * `_`, `+` and `-` in dot-separated pieces; the domain is two or more labels. Nothing that would end the
 * User-Agent's comment (`)`, `;`), start a mailto: link's query (`?`, `#`, `&`, `%`) or need quoting.
 */
const EMAIL = new RegExp(`^[A-Za-z0-9_+-]+(?:\\.[A-Za-z0-9_+-]+)*@${LABEL}(?:\\.${LABEL})+$`);

/**
 * The URL standard's parser, as Node and every browser have it. Core is typed for neither, so it is reached
 * through globalThis; the website's metadata (`new URL(siteUrl)`) uses the same parser.
 */
const WhatwgUrl = (globalThis as unknown as { URL: new (input: string) => { origin: string } }).URL;

/** The origin the URL standard reads `value` as, or null when it refuses it. */
function standardOrigin(value: string): string | null {
  try {
    return new WhatwgUrl(value).origin;
  } catch {
    return null;
  }
}

/** A host name in lower case (two or more labels, or one: `localhost`), then a port of its own if any. */
const HOST_AND_PORT = new RegExp(`^${LABEL}(?:\\.${LABEL})*(?::[1-9][0-9]{0,4})?$`);

/**
 * What is wrong with SITE_URL (already trimmed), or null when it is good. Good is exactly an https origin as a
 * browser writes it: `https://`, a host name in lower case, a port only if it is not 443, and nothing after.
 * The pattern checks below give each common mistake its own message; the last check is the URL standard's
 * parser itself, so that every accepted value satisfies `new URL(value).origin === value` (it refuses, say, a
 * numeric last label, which it reads as an IPv4 address: `https://example.123`).
 */
function siteUrlProblem(value: string): string | null {
  if (value === '') return 'SITE_URL is not set: it must be the site\'s address, such as https://example.org';
  if (!PRINTABLE_ASCII.test(value)) return `SITE_URL ${UNPRINTABLE} (write an international domain in its xn-- form)`;
  if (!value.startsWith('https://')) return 'SITE_URL must start with https:// (such as https://example.org)';
  const rest = value.slice('https://'.length);
  const end = rest.search(/[/?#]/);
  const authority = end === -1 ? rest : rest.slice(0, end);
  const after = end === -1 ? '' : rest.slice(end);
  if (authority.includes('@')) return 'SITE_URL has a user name or password: give https:// and the host alone';
  if (after.includes('#')) return 'SITE_URL has a fragment (#…): give https:// and the host alone';
  if (after.includes('?')) return 'SITE_URL has a query string (?…): give https:// and the host alone';
  // Rejected rather than removed: every address the site writes is SITE_URL plus a path that starts with '/'.
  if (after === '/') return 'SITE_URL ends with a slash: write it without one (https://example.org, not https://example.org/)';
  if (after !== '') return 'SITE_URL has a path: give https:// and the host alone, such as https://example.org';
  if (HOST_AND_PORT.test(authority.toLowerCase()) && authority !== authority.toLowerCase()) {
    return 'SITE_URL has capital letters in its host name: write it in lower case';
  }
  if (!HOST_AND_PORT.test(authority)) return 'SITE_URL is not an address: it must be https:// and a host name, such as https://example.org';
  const port = authority.includes(':') ? Number(authority.slice(authority.indexOf(':') + 1)) : null;
  if (port === 443) return 'SITE_URL names the default port :443: leave it out';
  if (port !== null && port > 65535) return 'SITE_URL has a port above 65535';
  if (standardOrigin(value) !== value) {
    return 'SITE_URL is not an address the URL standard reads as written: a host whose last part is a number or '
      + 'starts with 0x is read as an IP address, and an xn-- label must be valid punycode';
  }
  return null;
}

/** What is wrong with CONTACT_EMAIL (already trimmed), or null when it is good. */
function contactEmailProblem(value: string): string | null {
  if (value === '') return 'CONTACT_EMAIL is not set: it must be the address to write to, such as hello@example.org';
  if (!PRINTABLE_ASCII.test(value)) return `CONTACT_EMAIL ${UNPRINTABLE}`;
  if (!EMAIL.test(value) || value.length > 254 || value.indexOf('@') > 64) {
    return 'CONTACT_EMAIL is not an e-mail address: the address alone, such as hello@example.org (letters, digits, '
      + '".", "_", "+" and "-" before the @)';
  }
  return null;
}

/**
 * The site's identity from `env` (process.env, or a test's own object): SITE_URL and CONTACT_EMAIL, each trimmed.
 * Throws a SiteIdentityError naming every variable that is missing (unset, empty or only spaces) or malformed,
 * on one line that ends with where the README explains them; the message never repeats a value. Reads nothing but those two keys of `env`.
 */
export function resolveSiteIdentity(env: SiteIdentityEnv): SiteIdentity {
  const siteUrl = (env.SITE_URL ?? '').trim();
  const contactEmail = (env.CONTACT_EMAIL ?? '').trim();
  const problems = [siteUrlProblem(siteUrl), contactEmailProblem(contactEmail)].filter(problem => problem !== null);
  if (problems.length > 0) throw new SiteIdentityError(`${problems.join('; ')} ${README}`);
  return { siteUrl, contactEmail };
}
