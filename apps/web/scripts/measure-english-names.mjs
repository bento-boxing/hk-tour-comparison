// Measures every English place name the destinations directory can show and rewrites lib/english-name-widths.ts.
//
// Why: on phones the directory decides on the server whether a region or a country without regions fits its column
// or takes a whole row (lib/directory-cells.ts). It needs each English name's width, in ems of the name's own font:
// a region at weight 500, a country at weight 900. Chinese needs no table (each character is 1em).
//
// How to run (from apps/web):
//   node --experimental-websocket scripts/measure-english-names.mjs [fonts-folder]
// It needs Firefox on the PATH (run headless, through WebDriver BiDi). Each name is measured in the site's font stack
// (lib/theme.css --font) as the browser resolves it, and, when a fonts folder is given, also with Arimo, Inter and
// Roboto (stand-ins for Arial, Inter and Roboto) put first; the table keeps the widest, rounded up. The folder is
// one where `npm install @fontsource/arimo @fontsource/inter @fontsource/roboto` was run (outside this repository:
// they are not dependencies of the site). Without it only the browser's own fonts are measured: say so in the commit.
// Node 22 has WebSocket built in; Node 20 needs the flag above.
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..');
const DATA = join(WEB, '../../packages/core/src/places/data.json');
const OUT = join(WEB, 'lib/english-name-widths.ts');
const FONTS = process.argv[2];
const PORT = Number(process.env.PORT ?? 9333);

// The names the directory can show: every country; every region that is not an area, in a country with more than
// one region (the only region of a country is never listed). English, or the Chinese name when there is none.
const data = JSON.parse(readFileSync(DATA, 'utf8'));
const en = place => place.nameEn || place.nameZh;
const regionCount = new Map();
for (const r of data.regions) regionCount.set(r.countryId, (regionCount.get(r.countryId) ?? 0) + 1);
const regions = [...new Set(data.regions.filter(r => !r.members && regionCount.get(r.countryId) > 1).map(en))];
const countries = [...new Set(data.countries.map(en))];

const font = /--font:\s*([^;]+);/.exec(readFileSync(join(WEB, 'lib/theme.css'), 'utf8'))[1];
const LATIN = 'U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2212, U+FEFF, U+FFFD';
/** CSS putting one stand-in font first (its Latin files as data: URLs), or '' for the browser's own fonts. */
function standIn(name) {
  if (!name) return '';
  const faces = [500, 900].map(weight => {
    const files = [weight, 700].map(w => join(FONTS, `node_modules/@fontsource/${name}/files/${name}-latin-${w}-normal.woff2`));
    const file = files.find(existsSync);
    if (!file) throw new Error(`no ${name} font file under ${FONTS}`);
    return `@font-face { font-family: 'StandIn'; font-weight: ${weight}; src: url(data:font/woff2;base64,${readFileSync(file).toString('base64')}) format('woff2'); unicode-range: ${LATIN}; }`;
  });
  return `${faces.join('\n')}\nbody { font-family: 'StandIn', ${font}; }`;
}

async function browser() {
  const profile = mkdtempSync(join(tmpdir(), 'measure-names-'));
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
  return {
    async measure(css) {
      // A fresh blank page each time, styled from here (Firefox does not let BiDi open data: pages).
      await send('browsingContext.navigate', { context, url: 'about:blank', wait: 'complete' });
      const style = `body { font-family: ${font}; } ${css} span { white-space: nowrap; }`;
      const expression = `(async () => {
        document.documentElement.lang = 'en';
        const st = document.createElement('style'); st.textContent = ${JSON.stringify(style)}; document.head.append(st);
        const width = (text, size, weight) => { const s = document.createElement('span'); s.textContent = text; s.style.cssText = 'font-size:' + size + 'px;font-weight:' + weight;
          document.body.append(s); const w = s.getBoundingClientRect().width / size; s.remove(); return w; };
        const fonts = [...document.fonts].map(f => f.load()); await Promise.all(fonts); await document.fonts.ready;
        return JSON.stringify({ regions: ${JSON.stringify(regions)}.map(n => width(n, 14, 500)), countries: ${JSON.stringify(countries)}.map(n => width(n, 19, 900)) });
      })()`;
      const r = await send('script.evaluate', { expression, target: { context }, awaitPromise: true, resultOwnership: 'none' });
      if (r.type === 'exception') throw new Error(r.exceptionDetails.text);
      return JSON.parse(r.result.value);
    },
    close() { try { ws.close(); } catch {} ff.kill('SIGKILL'); rmSync(profile, { recursive: true, force: true }); },
  };
}

const b = await browser();
const widest = { regions: regions.map(() => 0), countries: countries.map(() => 0) };
try {
  for (const name of FONTS ? ['', 'arimo', 'inter', 'roboto'] : ['']) {
    const m = await b.measure(standIn(name));
    for (const kind of ['regions', 'countries']) m[kind].forEach((w, i) => { widest[kind][i] = Math.max(widest[kind][i], w); });
    console.log(`measured ${name || 'the browser\'s own fonts'}`);
  }
} finally { b.close(); }

// Keys as written: a plain word unquoted (a quoted 'Peru' reads as a colour name to lib/colour-literals.test.ts).
const key = name => (/^[A-Za-z]+$/.test(name) ? name : `'${name.replace(/'/g, "\\'")}'`);
const rows = (names, widths) => names.map((n, i) => `  ${key(n)}: ${(Math.ceil(widths[i] * 1000) / 1000).toFixed(3)},`).join('\n');
writeFileSync(OUT, `// Generated by scripts/measure-english-names.mjs: do not edit by hand; run it again when English place names change.
// Each English name's width in ems of its own font, the widest of the fonts measured${FONTS ? ' (the browser\'s own, Arimo, Inter, Roboto)' : ' (the browser\'s own only)'}, rounded up:
// regions at weight 500, countries at weight 900. Used by lib/directory-cells.ts; a name missing here takes a whole row on phones.

/** Regions the destinations directory can list. */
export const EN_REGION_EM: Readonly<Record<string, number>> = {
${rows(regions, widest.regions)}
};

/** Countries. */
export const EN_COUNTRY_EM: Readonly<Record<string, number>> = {
${rows(countries, widest.countries)}
};
`);
console.log(`wrote ${OUT}: ${regions.length} regions, ${countries.length} countries`);
