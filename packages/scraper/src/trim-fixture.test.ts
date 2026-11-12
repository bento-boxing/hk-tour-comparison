import { load } from 'cheerio';
import { expect, it } from 'vitest';
import { trimFixture } from './trim-fixture';

it('removes images, styles, svg, iframes and comments', () => {
  const out = trimFixture('<div><!-- x --><style>a{}</style><img src="a.jpg"><svg></svg><iframe></iframe><p>5日4夜</p></div>');
  expect(out).not.toMatch(/<img|<style|<svg|<iframe|<!--/);
  expect(out).toContain('5日4夜');
});

it('removes picture, video, noscript and link elements', () => {
  const out = trimFixture('<link rel="stylesheet" href="a.css"><picture><source srcset="a.webp"></picture><video></video><noscript>x</noscript><p>ok</p>');
  expect(out).toBe('<p>ok</p>');
});

it('keeps JSON scripts and drops code scripts', () => {
  const out = trimFixture('<script>alert(1)</script><script type="application/ld+json">{"name":"x"}</script>');
  expect(out).not.toContain('alert'); expect(out).toContain('"name":"x"');
});

it('keeps a script that assigns one object literal as page state', () => {
  const out = trimFixture('<script>window.__STATE__ = {"tour":{"code":"ABC"}};</script><script>var a = 1; f(a);</script>');
  expect(out).toContain('"code":"ABC"');
  expect(out).not.toContain('f(a)');
});

it('keeps a Nuxt 2 state script, a function call returning the state, and cuts its long strings', () => {
  const state = `window.__NUXT__=(function(a,b){return {data:[{code:"ABC",desc:"${'x'.repeat(130)}"}]}}("y",2));`;
  const out = trimFixture(`<script>${state}</script>`);
  expect(out).toContain('code:"ABC"');
  expect(out).toContain(`desc:"${'x'.repeat(20)}…"`);
  expect(out).toContain('("y",2));');
});

it('drops a script that assigns an object and then runs code', () => {
  expect(trimFixture('<script>window.a = {"b":1}; track(a);</script><p>x</p>')).toBe('<p>x</p>');
});

it('keeps the document structure of a full page', () => {
  const out = trimFixture('<!DOCTYPE html><html lang="zh-HK"><head><title>行程</title><link rel="icon" href="x"></head><body><h1>大阪</h1></body></html>');
  expect(out).toBe('<!DOCTYPE html><html lang="zh-HK"><head><title>行程</title></head><body><h1>大阪</h1></body></html>');
});

it('cuts long text to 20 characters plus an ellipsis', () => {
  const long = '一'.repeat(61);
  expect(trimFixture(`<p>${long}</p>`)).toContain(`<p>${'一'.repeat(20)}…</p>`);
});

it('keeps text of exactly 60 characters', () => {
  const sixty = '一'.repeat(60);
  expect(trimFixture(`<p>${sixty}</p>`)).toBe(`<p>${sixty}</p>`);
});

it('keeps short text such as headings, dates and prices', () => {
  const html = '<h3>第一天 香港 → 大阪</h3><span>2026-12-18</span><b>HK$7,999起</b>';
  expect(trimFixture(html)).toBe(html);
});

it('cuts long strings inside JSON and keeps it valid', () => {
  const out = trimFixture(`<script type="application/json">{"desc":"${'a'.repeat(200)}","price":7999}</script>`);
  const json = JSON.parse(out.match(/>(.*)</s)![1]);
  expect(json).toEqual({ desc: 'a'.repeat(20) + '…', price: 7999 });
});

it('cuts long strings nested in arrays and objects inside JSON', () => {
  const out = trimFixture(`<script type="application/ld+json">[{"a":{"b":["${'b'.repeat(121)}","short"]}}]</script>`);
  const json = JSON.parse(out.match(/>(.*)</s)![1]);
  expect(json).toEqual([{ a: { b: ['b'.repeat(20) + '…', 'short'] } }]);
});

it('removes style and src attributes', () => {
  expect(trimFixture('<div style="color:red" data-src="x">a</div>')).toBe('<div>a</div>');
});

it('cuts long strings inside JSON held in an attribute and keeps it valid', () => {
  const plans = JSON.stringify([{ dayNumber: 1, title: '直航北海道', description: '長'.repeat(121) }]);
  const $ = load(trimFixture(`<div data-plans-json='${plans}'></div>`), null, false);
  expect(JSON.parse($('div').attr('data-plans-json')!)).toEqual([{ dayNumber: 1, title: '直航北海道', description: '長'.repeat(20) + '…' }]);
});

it('cuts long prose in content, alt and title attributes but not in links', () => {
  const prose = '字'.repeat(61);
  const href = `/tour/${'a'.repeat(70)}`;
  const out = trimFixture(`<meta name="description" content="${prose}"><a href="${href}" title="${prose}">x</a>`);
  expect(out).toBe(`<meta name="description" content="${'字'.repeat(20)}…"><a href="${href}" title="${'字'.repeat(20)}…">x</a>`);
});

/** The flight data payload of every `self.__next_f.push([1,"…"])` script in the page, in order. */
function flightPayload(html: string): string {
  const $ = load(html);
  return $('script').toArray()
    .map(s => /^self\.__next_f\.push\(\[1,(".*")\]\)$/s.exec($(s).text()))
    .filter(m => m !== null)
    .map(m => JSON.parse(m[1]) as string)
    .join('');
}

/** A flight data script as Next.js writes it: the payload as a JSON string with `<` escaped. */
const push = (payload: string) => `<script>self.__next_f.push([1,${JSON.stringify(payload).replace(/</g, '\\u003c')}])</script>`;

it('keeps Next.js flight data, merged into one script, with long strings cut', () => {
  const row1 = `4a:["$","div",null,{"code":"TDZC05R","prices":[{"date":"2026-11-27","sellingPrice":999}],"desc":"${'描'.repeat(121)}"}]\n`;
  const row2 = '4b:["$","h1",null,{"children":"5天 張家界"}]\n';
  const html = `<html><head></head><body><script>(self.__next_f=self.__next_f||[]).push([0])</script>${push(row1)}${push(row2)}</body></html>`;
  const out = trimFixture(html);
  expect(out.match(/self\.__next_f\.push\(\[1,/g)).toHaveLength(1);
  expect(flightPayload(out)).toBe(
    `4a:["$","div",null,{"code":"TDZC05R","prices":[{"date":"2026-11-27","sellingPrice":999}],"desc":"${'描'.repeat(20)}…"}]\n${row2}`,
  );
});

it('cuts the text of a flight data text row and rewrites its byte length', () => {
  const text = '長'.repeat(70);
  const payload = `5:T${Buffer.byteLength(text).toString(16)},${text}6:["$","p",null,{"children":"$5"}]\n`;
  const out = trimFixture(`<html><body>${push(payload)}</body></html>`);
  const cut = '長'.repeat(20) + '…';
  expect(flightPayload(out)).toBe(`5:T${Buffer.byteLength(cut).toString(16)},${cut}6:["$","p",null,{"children":"$5"}]\n`);
});

it('never writes a closing script tag inside kept flight data', () => {
  const payload = '7:["$","p",null,{"children":"</script><b>"}]\n';
  const out = trimFixture(`<html><body>${push(payload)}</body></html>`);
  expect(out.match(/<\/script>/g)).toHaveLength(1);
  expect(flightPayload(out)).toBe(payload);
});

it('collapses indentation to one line break, except in pre', () => {
  const out = trimFixture('<div>\n      <span>第1天</span>\n\n      <span>HKD 20,998 +</span>\n    </div><pre>a\n\n  b</pre>');
  expect(out).toBe('<div>\n<span>第1天</span>\n<span>HKD 20,998 +</span>\n</div><pre>a\n\n  b</pre>');
});

it('still cuts long text inside pre', () => {
  expect(trimFixture(`<pre>${'一'.repeat(61)}</pre>`)).toBe(`<pre>${'一'.repeat(20)}…</pre>`);
});

it('removes src and srcset attributes from elements that are kept', () => {
  expect(trimFixture('<source src="a" srcset="b"><a href="/tour/X">X</a>')).toBe('<source><a href="/tour/X">X</a>');
});
