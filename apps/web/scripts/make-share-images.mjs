// Makes the sharing images (og:image) in public/share/ and rewrites lib/share-images.json.
//
// What: one picture per language, 1200×630 PNG: the header's ink with the 跟邊團 mark (app/icon.svg's shapes) and the
// name, over the gold band with one line saying what the site is (dictionary key share.line, read from
// lib/dict.<locale>.ts). Colours from lib/theme.css (the light theme's header and band). No operator's name or logo.
// Each file is named <locale>-<first 8 hex of its SHA-256>.png, so a changed picture gets a new address; the old
// files of that language are removed. lib/share-images.test.ts checks the files, the JSON and the dictionaries agree.
//
// Why a script and committed files rather than Next.js's opengraph-image: drawing Chinese at build time would need a
// CJK font file in the repository (several MB). Here the browser draws with fonts installed on the machine, and only
// the pictures are committed: they hold no font.
//
// How to run (from apps/web), after changing share.line in the dictionaries:
//   node --experimental-websocket scripts/make-share-images.mjs
// It needs Firefox on the PATH (run headless, through WebDriver BiDi) and the Noto Sans CJK fonts installed (Debian
// and Ubuntu: fonts-noto-cjk; the SIL Open Font License); it stops if the browser cannot find them. Node 22 has
// WebSocket built in; Node 20 needs the flag above.
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = join(WEB, 'public/share');
const JSON_OUT = join(WEB, 'lib/share-images.json');
const PORT = Number(process.env.PORT ?? 9334);
const WIDTH = 1200;
const HEIGHT = 630;
const LOCALES = ['zh-Hant', 'zh-Hans', 'en'];
/** The installed font each language's picture is drawn in (the site's own stack names Noto Sans TC / SC first). */
const FONT = { 'zh-Hant': 'Noto Sans CJK TC', 'zh-Hans': 'Noto Sans CJK SC', en: 'Noto Sans CJK TC' };
const LANG = { 'zh-Hant': 'zh-Hant-HK', 'zh-Hans': 'zh-Hans', en: 'en' };

/** A dictionary's value for `key`: written on one line as 'key': '…' (single quotes, no escapes). */
export function dictLine(source, key) {
  const m = new RegExp(`^\\s*'${key.replace(/\./g, '\\.')}': '([^'\\\\]*)',`, 'm').exec(source);
  if (!m) throw new Error(`no plain single-quoted ${key} in the dictionary`);
  return m[1];
}

/** The light theme's value of a token in lib/theme.css (its first :root block). */
function token(css, name) {
  const root = css.slice(css.indexOf(':root {'), css.indexOf('}', css.indexOf(':root {')));
  const m = new RegExp(`${name}:\\s*(#[0-9a-fA-F]{3,8})`).exec(root);
  if (!m) throw new Error(`no ${name} in lib/theme.css`);
  return m[1];
}

function page(locale, line, colours, markShapes) {
  const css = `
    html, body { margin: 0; width: ${WIDTH}px; height: ${HEIGHT}px; overflow: hidden; }
    body { font-family: "${FONT[locale]}", monospace; background: ${colours.ink}; color: ${colours.text}; }
    .top { position: absolute; left: 0; top: 0; width: ${WIDTH}px; height: 420px; display: flex; align-items: center; gap: 36px; padding: 0 96px; box-sizing: border-box; }
    .top svg { width: 176px; height: 176px; flex: none; }
    .name { font-size: 150px; font-weight: 900; letter-spacing: 6px; line-height: 1; }
    .band { position: absolute; left: 0; top: 420px; width: ${WIDTH}px; height: 210px; background: ${colours.gold}; color: ${colours.onGold};
      display: flex; align-items: center; padding: 0 96px; box-sizing: border-box; }
    .line { font-size: 62px; font-weight: 700; line-height: 1.2; white-space: nowrap; }`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" aria-hidden="true">${markShapes}</svg>`;
  return { css, body: `<div class="top">${svg}<div class="name">跟邊團</div></div><div class="band"><div class="line"></div></div>`, line, lang: LANG[locale] };
}

async function browser() {
  const profile = mkdtempSync(join(tmpdir(), 'share-images-'));
  writeFileSync(join(profile, 'user.js'), 'user_pref("browser.shell.checkDefaultBrowser", false);\nuser_pref("app.update.enabled", false);\n');
  const ff = spawn('firefox', ['--headless', '--no-remote', '--profile', profile, `--remote-debugging-port=${PORT}`], { stdio: ['ignore', 'pipe', 'pipe'] });
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Firefox did not start')), 60000);
    const seen = chunk => { if (String(chunk).includes('WebDriver BiDi listening')) { clearTimeout(timer); resolve(); } };
    ff.stderr.on('data', seen); ff.stdout.on('data', seen);
  });
  const ws = new WebSocket(`ws://127.0.0.1:${PORT}/session`);
  await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
  let id = 0;
  const pending = new Map();
  ws.onmessage = event => {
    const m = JSON.parse(event.data);
    if (m.id == null || !pending.has(m.id)) return;
    const { resolve, reject } = pending.get(m.id); pending.delete(m.id);
    if (m.type === 'error') reject(new Error(`${m.error}: ${m.message}`)); else resolve(m.result);
  };
  const send = (method, params = {}) => new Promise((resolve, reject) => { const n = ++id; pending.set(n, { resolve, reject }); ws.send(JSON.stringify({ id: n, method, params })); });
  await send('session.new', { capabilities: {} });
  const context = (await send('browsingContext.getTree', {})).contexts[0].context;
  await send('browsingContext.setViewport', { context, viewport: { width: WIDTH, height: HEIGHT }, devicePixelRatio: 1 });
  return {
    /** Draws one picture on a blank page (Firefox does not let BiDi open data: pages) and returns its PNG bytes. */
    async draw({ css, body, line, lang, font }) {
      await send('browsingContext.navigate', { context, url: 'about:blank', wait: 'complete' });
      const expression = `(async () => {
        document.documentElement.lang = ${JSON.stringify(lang)};
        const st = document.createElement('style'); st.textContent = ${JSON.stringify(css)}; document.head.append(st);
        document.body.innerHTML = ${JSON.stringify(body)};
        document.querySelector('.line').textContent = ${JSON.stringify(line)};
        await document.fonts.ready;
        // The named font must be installed: the same text in it and in the fallback alone must differ in width.
        const probe = f => { const s = document.createElement('span'); s.style.cssText = 'position:absolute;font-size:40px;font-family:' + f; s.textContent = '跟邊團 Ag'; document.body.append(s); const w = s.getBoundingClientRect().width; s.remove(); return w; };
        const installed = probe(${JSON.stringify(`"${font}", monospace`)}) !== probe('monospace');
        // A line too long for 62px is set smaller, 2px at a time, until it keeps the same margin on the right as on
        // the left (96px), down to 44px.
        const el = document.querySelector('.line');
        for (let size = 62; size > 44 && el.getBoundingClientRect().right > ${WIDTH} - 96; size -= 2) el.style.fontSize = (size - 2) + 'px';
        const line = el.getBoundingClientRect();
        await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
        return JSON.stringify({ installed, lineRight: line.right });
      })()`;
      const r = await send('script.evaluate', { expression, target: { context }, awaitPromise: true, resultOwnership: 'none' });
      if (r.type === 'exception') throw new Error(r.exceptionDetails.text);
      const facts = JSON.parse(r.result.value);
      if (!facts.installed) throw new Error(`the font ${font} is not installed (Debian/Ubuntu: fonts-noto-cjk)`);
      if (facts.lineRight > WIDTH - 96) throw new Error(`share.line is too long for the picture: ${JSON.stringify(line)}`);
      const shot = await send('browsingContext.captureScreenshot', { context, origin: 'viewport' });
      return Buffer.from(shot.data, 'base64');
    },
    close() { try { ws.close(); } catch {} ff.kill('SIGKILL'); rmSync(profile, { recursive: true, force: true }); },
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const theme = readFileSync(join(WEB, 'lib/theme.css'), 'utf8');
  const colours = { ink: token(theme, '--header-bg'), text: token(theme, '--header-text'), gold: token(theme, '--gold'), onGold: token(theme, '--on-gold') };
  const accent = token(theme, '--header-accent');
  // The mark's shapes from app/icon.svg (its test pins them to components/Mark.tsx): the ink parts in the header's
  // text colour, the gold next leg in the header's accent.
  const icon = readFileSync(join(WEB, 'app/icon.svg'), 'utf8');
  const g = /<g[^>]*>([\s\S]*?)<\/g>/.exec(icon)[1];
  const iconInk = /fill="(#[0-9a-f]{6})"/i.exec(/<circle[^>]*>/.exec(g)[0])[1];
  const markShapes = g.replaceAll(`"${iconInk}"`, `"${colours.text}"`).replaceAll(`"${token(theme, '--gold')}"`, `"${accent}"`);
  mkdirSync(OUT_DIR, { recursive: true });
  const b = await browser();
  const made = {};
  try {
    for (const locale of LOCALES) {
      const line = dictLine(readFileSync(join(WEB, `lib/dict.${locale}.ts`), 'utf8'), 'share.line');
      const png = await b.draw({ ...page(locale, line, colours, markShapes), font: FONT[locale] });
      if (png.readUInt32BE(16) !== WIDTH || png.readUInt32BE(20) !== HEIGHT) throw new Error(`the picture is not ${WIDTH}×${HEIGHT}`);
      const sha256 = createHash('sha256').update(png).digest('hex');
      const file = `share/${locale}-${sha256.slice(0, 8)}.png`;
      for (const old of readdirSync(OUT_DIR)) if (old.startsWith(`${locale}-`) && old.endsWith('.png')) unlinkSync(join(OUT_DIR, old));
      writeFileSync(join(WEB, 'public', file), png);
      made[locale] = { file, width: WIDTH, height: HEIGHT, bytes: png.length, sha256, line };
      console.log(`wrote public/${file} (${png.length} bytes): ${line}`);
    }
  } finally { b.close(); }
  writeFileSync(JSON_OUT, `${JSON.stringify(made, null, 2)}\n`);
  console.log(`wrote ${JSON_OUT}`);
}
