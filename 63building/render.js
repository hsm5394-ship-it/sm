#!/usr/bin/env node
// Frame-by-frame renderer: Three.js page -> Puppeteer screenshots -> FFmpeg MP4.
// The page is driven by frame number (window.setFrame), so output is deterministic.
//
//   node render.js                         full render  -> output/63building.mp4
//   node render.js --scale 0.5 --from 18 --to 28 --out output/test.mp4
//   node render.js --still 57 --out output/still.png      single frame at t=57s
//   options: --config config.json  --workers 4  --crf 17  --keep-frames
const fs = require('fs'), path = require('path'), http = require('http'), os = require('os');
const { spawnSync } = require('child_process');

const arg = (name, def) => { const i = process.argv.indexOf('--' + name); return i < 0 ? def : (process.argv[i + 1] ?? true); };
const has = name => process.argv.includes('--' + name);
const ROOT = __dirname;
const configPath = arg('config', 'config.json');
const cfg = JSON.parse(fs.readFileSync(path.resolve(ROOT, configPath), 'utf8'));
const scale = +arg('scale', 1);
const even = n => Math.round(n / 2) * 2;
const W = even(cfg.video.width * scale), H = even(cfg.video.height * scale), FPS = cfg.video.fps;
const still = arg('still', null);
const from = Math.round(+arg('from', 0) * FPS), to = Math.round(+arg('to', cfg.video.duration) * FPS);
const out = path.resolve(ROOT, arg('out', still !== null ? 'output/still.png' : 'output/63building.mp4'));
const workers = +arg('workers', Math.max(1, Math.min(4, os.cpus().length)));

function loadPuppeteer() {
  try { return { pptr: require('puppeteer'), exe: process.env.PUPPETEER_EXECUTABLE_PATH }; } catch { /* fall through */ }
  const pptr = require('puppeteer-core');
  const cands = [process.env.PUPPETEER_EXECUTABLE_PATH, process.env.CHROME_PATH, '/opt/pw-browsers/chromium',
    '/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'].filter(Boolean);
  const exe = cands.find(p => { try { return fs.statSync(p).isFile(); } catch { return false; } });
  if (!exe) throw new Error('No Chrome found. Run `npm i puppeteer` or set PUPPETEER_EXECUTABLE_PATH.');
  return { pptr, exe };
}

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.json': 'application/json', '.woff2': 'font/woff2', '.woff': 'font/woff' };
function serve() {
  const server = http.createServer((req, res) => {
    if (req.url === '/favicon.ico') { res.writeHead(204); return res.end(); }
    const p = path.normalize(path.join(ROOT, decodeURIComponent(req.url.split('?')[0])));
    if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(p)] || 'application/octet-stream' });
    fs.createReadStream(p).pipe(res);
  });
  return new Promise(r => server.listen(0, '127.0.0.1', () => r(server)));
}

(async () => {
  const { pptr, exe } = loadPuppeteer();
  const server = await serve();
  const url = `http://127.0.0.1:${server.address().port}/src/index.html?w=${W}&h=${H}&config=/${configPath}`;
  // one browser per worker: background tabs of a shared browser get throttled
  const browsers = [];
  const open = async () => {
    const browser = await pptr.launch({
      executablePath: exe, headless: true,
      args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--hide-scrollbars', '--force-color-profile=srgb']
    });
    browsers.push(browser);
    const page = await browser.newPage();
    page.on('pageerror', e => { console.error('[page error]', e.message); process.exitCode = 1; });
    page.on('console', m => { if (m.type() === 'error') console.error('[page]', m.text()); });
    await page.setViewport({ width: W, height: H, deviceScaleFactor: 1 });
    await page.goto(url);
    await page.waitForFunction('window.READY === true', { timeout: 120000 });
    return page;
  };
  fs.mkdirSync(path.dirname(out), { recursive: true });

  if (still !== null) {
    const page = await open();
    await page.evaluate(t => window.setTime(t), +still);
    await page.screenshot({ path: out, type: out.endsWith('.png') ? 'png' : 'jpeg' });
    console.log('wrote', out);
  } else {
    const dir = path.join(ROOT, 'output', '.frames'); fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
    const total = to - from; let next = from, done = 0; const t0 = Date.now();
    await Promise.all(Array.from({ length: Math.min(workers, total) }, async () => {
      const page = await open();
      while (next < to) {
        const n = next++;
        await page.evaluate(f => window.setFrame(f), n);
        await page.screenshot({ path: path.join(dir, String(n - from).padStart(5, '0') + '.jpg'), type: 'jpeg', quality: 96 });
        if (++done % 30 === 0 || done === total) process.stdout.write(`\rframes ${done}/${total}  ${(done / ((Date.now() - t0) / 1000)).toFixed(1)} fps   `);
      }
    }));
    console.log();
    const ff = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(FPS), '-i', path.join(dir, '%05d.jpg'),
      '-c:v', 'libx264', '-preset', 'slow', '-crf', String(arg('crf', 17)), '-pix_fmt', 'yuv420p', '-movflags', '+faststart', out], { stdio: 'inherit' });
    if (ff.status !== 0) throw new Error('ffmpeg failed');
    if (!has('keep-frames')) fs.rmSync(dir, { recursive: true, force: true });
    console.log('wrote', out);
  }
  await Promise.all(browsers.map(b => b.close())); server.close();
})().catch(e => { console.error(e); process.exit(1); });
