import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { DRY_RUN_LOG, logRef, PUBLIC_LOG } from './public-log';

const sha8 = (text: string) => createHash('sha256').update(text).digest('hex').slice(0, 8);
/** An invented title, percent-encoded as Charming's older addresses are. */
const encodedSlug = encodeURIComponent('5天測試之旅-abcd').toLowerCase();

describe('logRef', () => {
  it('is the first 8 hex characters of the text\'s SHA-256, so the same text always gets the same reference', () => {
    expect(logRef('https://www.example.com/a')).toBe(`(ref ${sha8('https://www.example.com/a')})`);
    expect(logRef('https://www.example.com/a')).toBe(logRef('https://www.example.com/a'));
    expect(logRef('https://www.example.com/a')).not.toBe(logRef('https://www.example.com/b'));
  });
});

describe('PUBLIC_LOG.address: an address as the public run log may print it', () => {
  it.each([
    'https://www.jetour.com.hk/tour/BSBO',
    'https://www.egltours.com/website/itinerary/HTJKS25',
    'https://www.sunflower.com.hk/OnlineBooking/?TourCode=ABCD05XY',
    'https://www.sunflower.com.hk/App/Tour/Get?Region=&Area=&Subarea=&keyword=',
    'https://www.yummyholiday.net/#/pages/detail/detail?id=6033',
    'https://bigline.hk/tour-group/19259',
    'https://www.texpert.com/zh-hk/tour/',
    'https://www.jetour.com.hk/sitemap.xml',
    'http://127.0.0.1:8080/loop?hop=6',
  ])('keeps %s whole: every piece is plain', (url) => {
    expect(PUBLIC_LOG.address(url)).toBe(url);
  });

  it('hides a percent-encoded piece (a title in the address) and adds a reference to the whole address', () => {
    const url = `https://www.charming-online.com/?tour=${encodedSlug}`;
    expect(PUBLIC_LOG.address(url)).toBe(`https://www.charming-online.com/?tour=* (ref ${sha8(url)})`);
  });

  it('hides a piece of several hyphen-joined words (an English title) but keeps a code and the fixed path', () => {
    const url = 'https://www.example.com/zh-hk/tour/12-sample-autumn-trip-5-days?lang=en';
    expect(PUBLIC_LOG.address(url)).toBe(`https://www.example.com/zh-hk/tour/*?lang=en (ref ${sha8(url)})`);
  });

  it.each([
    ['non-ASCII text', 'https://www.example.com/tour/測試之旅', 'https://www.example.com/tour/*'],
    ['a fragment with text', 'https://www.example.com/a#測試', 'https://www.example.com/a#*'],
    ['a comma list', 'https://www.example.com/list?_fields=id,slug&page=2', 'https://www.example.com/list?_fields=*&page=2'],
    ['a plus sign (a space in a query)', 'https://www.example.com/s?q=autumn+trip', 'https://www.example.com/s?q=*'],
    ['two underscores', 'https://www.example.com/a_b_c', 'https://www.example.com/*'],
  ])('hides %s', (_name, url, shown) => {
    expect(PUBLIC_LOG.address(url)).toBe(`${shown} (ref ${sha8(url)})`);
  });

  it.each([
    ['text that is not an address', '測試 page'],
    ['an address with a user name', 'https://user:secret@www.example.com/a'],
    ['an address with a non-ASCII host', 'https://測試.example.com/a'],
    ['an empty text', ''],
  ])('hides %s altogether', (_name, text) => {
    expect(PUBLIC_LOG.address(text)).toBe(`* (ref ${sha8(text)})`);
  });
});

describe('DRY_RUN_LOG.address: the whole address, with the reference the public log gives it', () => {
  it('prints a plain address as it is', () => {
    expect(DRY_RUN_LOG.address('https://www.jetour.com.hk/tour/BSBO')).toBe('https://www.jetour.com.hk/tour/BSBO');
  });
  it('prints an address the public log hides in full, followed by the same reference', () => {
    const url = `https://www.charming-online.com/?tour=${encodedSlug}`;
    expect(DRY_RUN_LOG.address(url)).toBe(`${url} (ref ${sha8(url)})`);
    expect(PUBLIC_LOG.address(url).endsWith(logRef(url))).toBe(true);
  });
});

describe('PUBLIC_LOG.message: an error\'s message as the public run log may print it', () => {
  it.each([
    'the detail has no valid tour code',
    'not in tonight\'s listing',
    'TypeError: fetch failed',
    'dates for 2026-12: the API answered code 500',
    'selector not found',
  ])('keeps %s: plain ASCII text', (text) => {
    expect(PUBLIC_LOG.message(text)).toBe(text);
  });

  it.each([
    ['a quotation (JSON.parse quotes what it read)', 'Unexpected token \'<\', "<html><tit"... is not valid JSON'],
    ['non-ASCII text', 'no price for 測試'],
    ['a percent sign', 'cannot read 5%e6%b8%ac'],
    ['an address', 'Failed to parse URL from https://www.example.com/a'],
    ['a line break', 'first\nsecond'],
  ])('hides %s, with a reference', (_name, text) => {
    expect(PUBLIC_LOG.message(text)).toBe(`* (ref ${sha8(text)})`);
  });

  it('DRY_RUN_LOG prints a hidden message whole, with the same reference, and a plain one as it is', () => {
    const text = 'no price for 測試';
    expect(DRY_RUN_LOG.message(text)).toBe(`${text} (ref ${sha8(text)})`);
    expect(DRY_RUN_LOG.message('selector not found')).toBe('selector not found');
  });
});
