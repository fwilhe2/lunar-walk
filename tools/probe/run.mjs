#!/usr/bin/env node
/* Drive the app in a headless browser and collect shots.

     node tools/probe/run.mjs DRIVER.mjs [OUT_DIR] [WIDTHxHEIGHT] [TIMEOUT_S]

   Starts a Vite dev server of its own, opens the page with ?probe=low
   (PROBE_QUALITY to change the tier), waits for the opening world, then
   runs the driver: a module whose default export is
   async function drive(probe). OUT_DIR gets probe.log and shots/.

   The browser is the installed Chrome by default; PROBE_BROWSER=firefox
   uses Firefox, PROBE_EXE names the binary. On a box without a GPU,
   Chrome renders with SwiftShader (PROBE_GL=swiftshader) and Firefox
   with LIBGL_ALWAYS_SOFTWARE=1. PROBE_HASH (e.g. '#w=mars&x=100&z=0')
   opens the page at a shared view; PROBE_WORLDS=io,titan is passed to
   the driver as probe.args.worlds. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import puppeteer from 'puppeteer-core';
import { createServer } from 'vite';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const [driverPath, outArg, size = '960x540', timeoutArg = '1800'] = process.argv.slice(2);
if (!driverPath) { console.error('usage: run.mjs DRIVER.mjs [OUT_DIR] [WxH] [TIMEOUT_S]'); process.exit(2); }
const OUT = path.resolve(outArg || path.join(process.env.TMPDIR || '/tmp', 'lunar-walk-probe'));
const [W, H] = size.split('x').map(Number);
fs.mkdirSync(path.join(OUT, 'shots'), { recursive: true });
const LOG = path.join(OUT, 'probe.log');
fs.writeFileSync(LOG, '');
const T0 = Date.now();
const log = (m) => { const line = ((Date.now() - T0) / 1000).toFixed(1) + ' ' + m; fs.appendFileSync(LOG, line + '\n'); console.log(line); };

const firefox = process.env.PROBE_BROWSER === 'firefox';
const EXE = process.env.PROBE_EXE || (firefox
  ? (process.platform === 'darwin' ? '/Applications/Firefox.app/Contents/MacOS/firefox' : 'firefox')
  : process.platform === 'darwin' ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' : 'google-chrome');

const server = await createServer({ root: ROOT, logLevel: 'error', server: { port: 0, strictPort: false } });
await server.listen();
const url = server.resolvedUrls.local[0];
const browser = await puppeteer.launch({
  browser: firefox ? 'firefox' : 'chrome',
  executablePath: EXE,
  headless: true,
  defaultViewport: { width: W, height: H },
  args: firefox ? [] : ['--ignore-gpu-blocklist', `--use-angle=${process.env.PROBE_GL || (process.platform === 'darwin' ? 'metal' : 'swiftshader')}`, `--window-size=${W},${H}`],
});
let failed = false;
const done = async (code) => { await browser.close().catch(() => {}); await server.close(); process.exit(code); };
const timer = setTimeout(() => { log('TIMEOUT'); done(1); }, +timeoutArg * 1000);
try {
  const page = await browser.newPage();
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warn' || m.type() === 'warning') log((m.type() === 'error' ? 'CERR ' : 'CWARN ') + m.text().slice(0, 600)); });
  page.on('pageerror', (e) => { failed = true; log('ERR ' + e.message); });
  page.on('error', (e) => { failed = true; log('CRASH ' + e.message); });
  const q = '?probe=' + (process.env.PROBE_QUALITY || 'low');
  await page.goto(url + q + (process.env.PROBE_HASH || ''));
  await page.waitForFunction(() => window.lw && window.lw.probe, { timeout: 0 });
  await page.evaluate(() => window.lw.probe.idle());
  log('booted ' + await page.evaluate(() => window.lw.quality.label));

  // What a driver gets: the page's API through evaluate(), and shots.
  let n = 0;
  const probe = {
    page,
    args: { worlds: process.env.PROBE_WORLDS ? process.env.PROBE_WORLDS.split(',') : null },
    log,
    eval: (fn, ...a) => page.evaluate(fn, ...a),
    at: (o) => page.evaluate((o) => window.lw.probe.at(o), o),
    idle: (extra) => page.evaluate((e) => window.lw.probe.idle(e), extra),
    frames: (k) => page.evaluate((k) => window.lw.probe.frames(k), k),
    async snap(name, png = false) {
      const data = await page.evaluate((p) => window.lw.probe.snap(p), png);
      const file = path.join(OUT, 'shots', `${String(++n).padStart(3, '0')}-${name}.${png ? 'png' : 'jpg'}`);
      fs.writeFileSync(file, Buffer.from(data.slice(data.indexOf(',') + 1), 'base64'));
      log('shot ' + path.basename(file));
    },
  };
  const { default: drive } = await import(pathToFileURL(path.resolve(driverPath)).href);
  await drive(probe);
  log('DONE');
} catch (e) {
  failed = true;
  log('DRIVER ' + (e.stack || e.message));
}
clearTimeout(timer);
await done(failed ? 1 : 0);
