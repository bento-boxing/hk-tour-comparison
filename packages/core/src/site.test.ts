import { describe, it, expect } from 'vitest';
import { resolveSiteIdentity, SiteIdentityError } from './index';

// Invented values only: nothing here reads the real environment.
const GOOD = { SITE_URL: 'https://example.invalid', CONTACT_EMAIL: 'bot@example.invalid' };

/** The message resolveSiteIdentity throws for `env`, or null when it does not throw. */
function refusal(env: Record<string, string | undefined>): string | null {
  try {
    resolveSiteIdentity(env);
    return null;
  } catch (error) {
    expect(error).toBeInstanceOf(SiteIdentityError);
    return (error as Error).message;
  }
}

describe('resolveSiteIdentity', () => {
  it('returns the two values from the environment object it is given', () => {
    expect(resolveSiteIdentity(GOOD)).toEqual({ siteUrl: 'https://example.invalid', contactEmail: 'bot@example.invalid' });
  });

  it('trims both (a secret pasted with a line break at the end)', () => {
    expect(resolveSiteIdentity({ SITE_URL: '  https://example.invalid\n', CONTACT_EMAIL: '\tbot@example.invalid \r\n' }))
      .toEqual({ siteUrl: 'https://example.invalid', contactEmail: 'bot@example.invalid' });
  });

  it.each([
    ['https://www.example.invalid'],
    ['https://example.invalid:8443'], // a port of its own is part of the address
    ['https://sub.example.co.invalid'],
    ['https://xn--fsq.example.invalid'], // an international domain, written in its xn-- form
  ])('accepts the site address %s as it is', siteUrl => {
    expect(resolveSiteIdentity({ ...GOOD, SITE_URL: siteUrl }).siteUrl).toBe(siteUrl);
  });

  it.each([
    ['first.last@example.invalid'], ['bot+site@mail.example.invalid'], ['a_b-c@example.invalid'], ['BOT@Example.invalid'],
  ])('accepts the contact %s as it is', contactEmail => {
    expect(resolveSiteIdentity({ ...GOOD, CONTACT_EMAIL: contactEmail }).contactEmail).toBe(contactEmail);
  });

  it('has no default: an empty environment is refused, naming both variables on one line', () => {
    const message = refusal({});
    expect(message).toMatch(/^SITE_URL is not set\b.*; CONTACT_EMAIL is not set\b/);
    expect(message).not.toContain('\n');
  });

  it.each([
    ['missing', undefined], ['empty (an unset GitHub secret)', ''], ['only spaces', '   \n'],
  ])('SITE_URL %s: refused as not set', (_name, value) => {
    expect(refusal({ ...GOOD, SITE_URL: value })).toMatch(/^SITE_URL is not set\b/);
  });

  it.each([
    ['missing', undefined], ['empty (an unset GitHub secret)', ''], ['only spaces', ' \t'],
  ])('CONTACT_EMAIL %s: refused as not set', (_name, value) => {
    expect(refusal({ ...GOOD, CONTACT_EMAIL: value })).toMatch(/^CONTACT_EMAIL is not set\b/);
  });

  it.each([
    ['a trailing slash', 'https://example.invalid/', /^SITE_URL ends with a slash: write it without one/],
    ['http', 'http://example.invalid', /^SITE_URL must start with https:\/\//],
    ['no scheme', 'example.invalid', /^SITE_URL must start with https:\/\//],
    ['another scheme', 'ftp://example.invalid', /^SITE_URL must start with https:\/\//],
    ['no host', 'https://', /^SITE_URL is not an address/],
    ['a path', 'https://example.invalid/en', /^SITE_URL has a path/],
    ['a path ending in a slash', 'https://example.invalid/en/', /^SITE_URL has a path/],
    ['a query', 'https://example.invalid?x=1', /^SITE_URL has a query string/],
    ['an empty query', 'https://example.invalid?', /^SITE_URL has a query string/],
    ['a fragment', 'https://example.invalid#top', /^SITE_URL has a fragment/],
    ['a user name', 'https://user@example.invalid', /^SITE_URL has a user name or password/],
    ['a password', 'https://user:secret@example.invalid', /^SITE_URL has a user name or password/],
    ['capitals in the host', 'https://Example.invalid', /^SITE_URL has capital letters in its host name/],
    ['the default port', 'https://example.invalid:443', /^SITE_URL names the default port :443/],
    ['a port out of range', 'https://example.invalid:70000', /^SITE_URL has a port above 65535/],
    ['an empty port', 'https://example.invalid:', /^SITE_URL is not an address/],
    ['a host ending in a dot', 'https://example.invalid.', /^SITE_URL is not an address/],
    ['an underscore in the host', 'https://ex_ample.invalid', /^SITE_URL is not an address/],
    ['a percent-encoded host', 'https://ex%61mple.invalid', /^SITE_URL is not an address/],
    ['backslashes', 'https:\\\\example.invalid', /^SITE_URL must start with https:\/\//],
    ['a single slash', 'https:/example.invalid', /^SITE_URL must start with https:\/\//],
    ['capitals in the scheme', 'HTTPS://example.invalid', /^SITE_URL must start with https:\/\//],
    ['a space inside', 'https://exa mple.invalid', /^SITE_URL holds a space, a control character or a non-ASCII character/],
    ['a line break inside', 'https://example.invalid\r\nX-Injected: 1', /^SITE_URL holds a space, a control character/],
    ['a tab inside', 'https://example\t.invalid', /^SITE_URL holds a space, a control character/],
    ['a NUL', 'https://example.invalid\0', /^SITE_URL holds a space, a control character/],
    ['DEL', 'https://example.invalid\x7f', /^SITE_URL holds a space, a control character/],
    ['a non-ASCII host', 'https://例子.invalid', /^SITE_URL holds .*non-ASCII character.*xn--/],
  ])('SITE_URL with %s is refused, saying why', (_name, value, expected) => {
    expect(refusal({ ...GOOD, SITE_URL: value })).toMatch(expected);
  });

  it.each([
    ['no @', 'bot.example.invalid'],
    ['two @', 'bot@x@example.invalid'],
    ['nothing before the @', '@example.invalid'],
    ['nothing after the @', 'bot@'],
    ['a domain without a dot', 'bot@localhost'],
    ['a domain ending in a dot', 'bot@example.invalid.'],
    ['two dots in a row', 'bot..x@example.invalid'],
    ['a dot first', '.bot@example.invalid'],
    ['angle brackets', '<bot@example.invalid>'],
    ['a mailto: prefix', 'mailto:bot@example.invalid'],
    ['a parenthesis (it would end the User-Agent comment)', 'bot)@example.invalid'],
    ['a semicolon', 'bot;x@example.invalid'],
    ['a question mark (it would start a mailto: query)', 'bot?subject=x@example.invalid'],
    ['a hyphen first in a domain label', 'bot@-example.invalid'],
  ])('CONTACT_EMAIL with %s is refused as not an address', (_name, value) => {
    expect(refusal({ ...GOOD, CONTACT_EMAIL: value })).toMatch(/^CONTACT_EMAIL is not an e-mail address/);
  });

  it.each([
    ['a line break inside', 'bot@example.invalid\nX-Injected: 1'], ['a space inside', 'bot @example.invalid'],
    ['a control character', 'bot\x01@example.invalid'], ['non-ASCII', 'bött@example.invalid'],
  ])('CONTACT_EMAIL with %s is refused before its shape is looked at', (_name, value) => {
    expect(refusal({ ...GOOD, CONTACT_EMAIL: value })).toMatch(/^CONTACT_EMAIL holds a space, a control character or a non-ASCII character/);
  });

  it('never repeats a value it refuses (a secret\'s value stays out of logs and build output)', () => {
    const site = 'https://user:hunter2@example.invalid/secret-path';
    const mail = 'hunter2-mail@nowhere';
    const message = refusal({ SITE_URL: site, CONTACT_EMAIL: mail }) ?? '';
    expect(message).toMatch(/^SITE_URL .*; CONTACT_EMAIL /);
    for (const piece of ['hunter2', 'secret-path', 'nowhere']) expect(message).not.toContain(piece);
  });

  it('reads only the two variables, and only from the object it is given', () => {
    const read: string[] = [];
    const env = new Proxy({ ...GOOD }, { get: (target, key: string) => { read.push(key); return target[key as keyof typeof GOOD]; } });
    resolveSiteIdentity(env);
    expect([...new Set(read)].sort()).toEqual(['CONTACT_EMAIL', 'SITE_URL']);
  });

  it('every accepted value fits in an HTTP header value as it is, and in a User-Agent comment', () => {
    const { siteUrl, contactEmail } = resolveSiteIdentity({ SITE_URL: ' https://example.invalid ', CONTACT_EMAIL: 'a.b+c@example.invalid\n' });
    // RFC 9110 field-value: visible characters, with spaces or tabs only between them. (The scraper's tests send it.)
    const fieldValue = /^[\x21-\x7e\x80-\xff](?:[\t\x20-\x7e\x80-\xff]*[\x21-\x7e\x80-\xff])?$/;
    for (const value of [siteUrl, contactEmail]) {
      expect(value).toMatch(fieldValue);
      expect(value).not.toMatch(/[()\\]/); // nothing that would end or escape a (comment)
    }
  });
});
