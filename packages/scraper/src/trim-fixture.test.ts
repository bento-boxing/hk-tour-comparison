import { load } from 'cheerio';
import { describe, expect, it } from 'vitest';
import { KEEP_TEXT_LIMIT, trimFixture, type AllowList } from './trim-fixture';

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

it('keeps a script that assigns one array literal', () => {
  expect(trimFixture('<script>var tours = [{"code":"ABC"}];</script>')).toBe('<script>var tours = [{"code":"ABC"}];</script>');
});

it('drops a script that assigns the result of a function call, which is code', () => {
  const state = 'window.__NUXT__=(function(a,b){return {data:[{code:"ABC"}]}}("y",2));';
  expect(trimFixture(`<script>${state}</script><p>x</p>`)).toBe('<p>x</p>');
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

it('removes every inline event handler attribute', () => {
  const html = '<form onsubmit="return send(this)" ONCLICK="go()"><input onchange="c()" name="q"><button onClick="z()">ok</button></form>';
  expect(trimFixture(html)).toBe('<form><input name="q"><button>ok</button></form>');
});

it('keeps text inside elements matching a keep selector up to KEEP_TEXT_LIMIT characters', () => {
  const stops = '無錫 ~ 長廣溪濕地公園 ~ 太湖珍珠館(購物店) ~ 紫砂博物館(購物店) ~ 湖州(車程約2.5小時) ~ 太湖漁人碼頭燈光夜秀';
  const prose = '一'.repeat(61);
  const html = `<div class="day--trip-work">${stops}</div><h3 class="day"><span>Day 1</span><span>${prose}</span></h3><p>${prose}</p>`;
  expect(trimFixture(html, { keepSelectors: ['.day--trip-work', 'h3.day'] })).toBe(
    `<div class="day--trip-work">${stops}</div><h3 class="day"><span>Day 1</span><span>${prose}</span></h3><p>${'一'.repeat(20)}…</p>`,
  );
});

it('cuts text inside kept elements only above KEEP_TEXT_LIMIT characters', () => {
  expect(KEEP_TEXT_LIMIT).toBe(300);
  const opts = { keepSelectors: ['h3'] };
  expect(trimFixture(`<h3>${'一'.repeat(300)}</h3>`, opts)).toBe(`<h3>${'一'.repeat(300)}</h3>`);
  expect(trimFixture(`<h3>${'一'.repeat(301)}</h3>`, opts)).toBe(`<h3>${'一'.repeat(20)}…</h3>`);
});

it('keeps the text of kept elements whole where flight data repeats it, and still cuts other long strings', () => {
  const heading = `福田口岸集合 > ${'長沙 > '.repeat(30)}衡陽東`;
  const row = `4c:["$","h3",null,{"children":${JSON.stringify(heading)},"desc":"${'描'.repeat(121)}"}]\n`;
  const html = `<html><body><h3>${heading}</h3>${push(row)}</body></html>`;
  const out = trimFixture(html, { keepSelectors: ['h3'] });
  expect(load(out)('h3').text()).toBe(heading);
  expect(flightPayload(out)).toBe(`4c:["$","h3",null,{"children":${JSON.stringify(heading)},"desc":"${'描'.repeat(20)}…"}]\n`);
});

describe('allow-list mode', () => {
  const allow = (selectors: AllowList['selectors'], jsonKeys: string[] = []) => ({ allow: { selectors, jsonKeys } });

  it('keeps text only inside elements matching an allow selector', () => {
    const html = '<div><h1 class="title">5天 大阪</h1><p>短句</p><span class="tag">THB</span><span>其他</span></div>';
    expect(trimFixture(html, allow(['h1.title', '.tag']))).toBe(
      '<div><h1 class="title">5天 大阪</h1><p></p><span class="tag">THB</span><span></span></div>');
  });

  it('keeps the text of every element inside an allowed element', () => {
    const html = '<h3><span>Day 1</span><span>深圳 → 廣州</span></h3><p><b>x</b></p>';
    expect(trimFixture(html, allow(['h3']))).toBe('<h3><span>Day 1</span><span>深圳 → 廣州</span></h3><p><b></b></p>');
  });

  it('keeps whitespace between elements, collapsed, but no text outside allowed elements', () => {
    const html = '<div>\n    <p>說明</p>\n    <h3>香港 → 大阪</h3>\n  </div>';
    expect(trimFixture(html, allow(['h3']))).toBe('<div>\n<p></p>\n<h3>香港 → 大阪</h3>\n</div>');
  });

  it('cuts allowed text above KEEP_TEXT_LIMIT, or above the limit given with its selector', () => {
    const html = `<h3>${'一'.repeat(300)}</h3><h4>${'二'.repeat(301)}</h4><p>是日集合於香港國際機場，由專業領隊陪同下乘搭豪華客機</p><i>是日集合於</i>`;
    const out = trimFixture(html, allow(['h3', 'h4', { selector: 'p', maxChars: 20 }, { selector: 'i', maxChars: 20 }]));
    expect(out).toBe(`<h3>${'一'.repeat(300)}</h3><h4>${'二'.repeat(20)}…</h4><p>是日集合於香港國際機場，由專業領隊陪同下…</p><i>是日集合於</i>`);
  });

  it('drops text-carrying attributes outside allowed elements and keeps those inside', () => {
    const html = '<a href="/tour/THB" class="x" title="標題" aria-label="按鈕">x</a><input placeholder="搜尋" value="v" name="q">'
      + '<meta name="description" content="描述"><img alt="相片"><h1 title="大阪">大阪</h1>';
    expect(trimFixture(html, allow(['h1']))).toBe(
      '<a href="/tour/THB" class="x"></a><input name="q"><meta name="description"><h1 title="大阪">大阪</h1>');
  });

  it('drops any other attribute holding Chinese text outside allowed elements, percent-encoded or not', () => {
    expect(trimFixture('<span class="row" data-name="普通座位" data-id="1704">x</span>', allow([]))).toBe(
      '<span class="row" data-id="1704"></span>');
    const greeting = `https://wa.me/85200000000?text=${encodeURIComponent('你好！我想查詢')}`;
    expect(trimFixture(`<a class="wa" href="${greeting}">x</a><a href="/tour/THB?x=%ZZ">y</a>`, allow([]))).toBe(
      '<a class="wa"></a><a href="/tour/THB?x=%ZZ"></a>');
  });

  it('still removes images, styles, comments, inline event handlers and code scripts', () => {
    const html = '<div onclick="go()"><!-- c --><style>a{}</style><img src="a.jpg"><script>track()</script><h1>x</h1></div>';
    expect(trimFixture(html, allow(['h1']))).toBe('<div><h1>x</h1></div>');
  });

  it('keeps a JSON string only under an allowed key; numbers, booleans and structure stay', () => {
    const data = {
      '@context': 'https://schema.org',
      '@graph': [{
        '@type': ['Product', 'TouristTrip'], name: '大阪五天', description: '行程介紹',
        offers: { '@type': 'Offer', price: 7999, priceCurrency: 'HKD' },
        additionalProperty: { propertyID: 'tourDurationDays', value: 5 },
        open: true, nothing: null,
      }],
    };
    const out = trimFixture(`<script type="application/ld+json">${JSON.stringify(data)}</script>`,
      allow([], ['@type', 'propertyID']));
    expect(JSON.parse(load(out, null, false)('script').text())).toEqual({
      '@context': '',
      '@graph': [{
        '@type': ['Product', 'TouristTrip'], name: '', description: '',
        offers: { '@type': 'Offer', price: 7999, priceCurrency: '' },
        additionalProperty: { propertyID: 'tourDurationDays', value: 5 },
        open: true, nothing: null,
      }],
    });
  });

  it('keeps every string nested under an allowed key, cut above KEEP_TEXT_LIMIT', () => {
    const data = { departures: [{ date: '2026-12-18', label: 'x' }], long: { code: 'A'.repeat(301) }, other: 'y' };
    const out = trimFixture(`<script type="application/json">${JSON.stringify(data)}</script>`, allow([], ['departures', 'code']));
    expect(JSON.parse(load(out, null, false)('script').text())).toEqual({
      departures: [{ date: '2026-12-18', label: 'x' }], long: { code: 'A'.repeat(20) + '…' }, other: '',
    });
  });

  it('keeps a JSON string that holds a colon or a quote intact', () => {
    const data = { code: 'a:"b"', note: 'c:"d"' };
    const out = trimFixture(`<script type="application/json">${JSON.stringify(data)}</script>`, allow([], ['code']));
    expect(JSON.parse(load(out, null, false)('script').text())).toEqual({ code: 'a:"b"', note: '' });
  });

  it('applies the JSON keys to page state assigned in a script, quoted or unquoted keys alike', () => {
    const out = trimFixture(`<script>window.__STATE__ = {tour: {"code": 'ABC', name: '大阪', 'days': 5}};</script>`, allow([], ['code']));
    expect(out).toBe(`<script>window.__STATE__ = {tour: {"code": 'ABC', name: '', 'days': 5}};</script>`);
  });

  it('applies the JSON keys to JSON held in an attribute', () => {
    const plans = JSON.stringify([{ dayNumber: 1, title: '直航北海道', description: '長' }]);
    const $ = load(trimFixture(`<div data-plans-json='${plans}'></div>`, allow([], ['title'])), null, false);
    expect(JSON.parse($('div').attr('data-plans-json')!)).toEqual([{ dayNumber: 1, title: '直航北海道', description: '' }]);
  });

  it('applies the JSON keys to flight data and blanks text rows, with their byte length rewritten', () => {
    const text = '長'.repeat(70);
    const rows = `5:T${Buffer.byteLength(text).toString(16)},${text}`
      + '4a:["$","div",null,{"code":"TDZC05R","title":"5天","prices":[{"date":"2026-11-27","sellingPrice":999}],"desc":"描述"}]\n'
      + '2:I["123","chunk.js"]\n';
    const out = trimFixture(`<html><body>${push(rows)}</body></html>`, allow([], ['code', 'date']));
    expect(flightPayload(out)).toBe(
      '5:T0,4a:["","",null,{"code":"TDZC05R","title":"","prices":[{"date":"2026-11-27","sellingPrice":999}],"desc":""}]\n'
      + '2:I["",""]\n');
  });

  it('never writes a closing script tag inside kept flight data', () => {
    const payload = '7:["$","p",null,{"code":"</script><b>"}]\n';
    const out = trimFixture(`<html><body>${push(payload)}</body></html>`, allow([], ['code']));
    expect(out.match(/<\/script>/g)).toHaveLength(1);
    expect(flightPayload(out)).toBe('7:["","",null,{"code":"</script><b>"}]\n');
  });
});
