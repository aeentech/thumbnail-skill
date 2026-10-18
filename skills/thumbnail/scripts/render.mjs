#!/usr/bin/env node
// Render an HTML composition to PNG + lossless WebP at 2x.
// The canvas size is read from the page's `.canvas` element (set via --w/--h in canvas.html),
// or forced with --width/--height. Default 1080x720.
// The HTML's folder is served over a local HTTP server, so relative assets (images/, fonts/, fonts.css) just work.
// If the page defines window.__ready (canvas.html does), rendering waits until it is true.
//
// Usage: node render.mjs <file.html> [--out file.png] [--width W --height H] [--scale 2] [--no-webp]
import { createServer } from 'node:http';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve, dirname, basename, extname, join, normalize } from 'node:path';
import { launch, parseArgs, sleep, pngToWebp } from './cdp.mjs';

const args = parseArgs(process.argv.slice(2));
const file = args._[0];
if (!file) { console.error('Usage: node render.mjs <file.html> [--out file.png] [--width W --height H] [--scale 2] [--no-webp]'); process.exit(1); }
const htmlPath = resolve(file);
const root = dirname(htmlPath);
const out = resolve(args.out || htmlPath.replace(/\.html?$/i, '.png'));
const scale = Number(args.scale || 2);

const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.avif': 'image/avif', '.gif': 'image/gif', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf', '.otf': 'font/otf' };
const server = createServer(async (req, res) => {
  try {
    const p = normalize(join(root, decodeURIComponent(new URL(req.url, 'http://x').pathname)));
    if (!p.startsWith(root)) { res.writeHead(403).end(); return; }
    const body = await readFile(p);
    res.writeHead(200, { 'content-type': TYPES[extname(p).toLowerCase()] || 'application/octet-stream', 'access-control-allow-origin': '*' });
    res.end(body);
  } catch { res.writeHead(404).end(); }
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const url = `http://127.0.0.1:${server.address().port}/${encodeURIComponent(basename(htmlPath))}`;

async function waitReady(page) {
  const hasReady = await page.evaluate("'__ready' in window");
  for (let i = 0; i < 150; i++) {
    const ok = await page.evaluate(hasReady ? 'window.__ready === true' : `(async () => { await document.fonts.ready; return [...document.images].every(i => i.complete); })()`);
    if (ok) return;
    await sleep(100);
  }
}

const browser = await launch();
try {
  let width = Number(args.width || 0), height = Number(args.height || 0);
  const page = await browser.newPage({ width: width || 1080, height: height || 720, scale });
  await page.goto(url);
  if (!width || !height) {
    const size = await page.evaluate(`(() => { const c = document.querySelector('.canvas'); if (!c) return null; const r = c.getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height) }; })()`);
    width = size?.w || 1080; height = size?.h || 720;
    if (width !== 1080 || height !== 720) { await page.setViewport({ width, height, scale }); await page.goto(url); }
  }
  await waitReady(page);
  const report = await page.evaluate(`(() => ({
    fonts: [...document.fonts].filter(f => f.status === 'loaded').map(f => f.family.replace(/["']/g, '') + ' ' + f.weight),
    failedFonts: [...document.fonts].filter(f => f.status === 'error').map(f => f.family.replace(/["']/g, '')),
    brokenImages: [...document.images].filter(i => !i.naturalWidth).map(i => i.getAttribute('src')),
    overflow: (() => { const c = document.querySelector('.canvas') || document.body; const r = c.getBoundingClientRect();
      return [...c.querySelectorAll('[data-text]')].filter(el => { const e = el.getBoundingClientRect(); return e.right > r.right + 1 || e.left < r.left - 1 || e.bottom > r.bottom + 1 || e.top < r.top - 1; }).map(el => el.dataset.text); })(),
  }))()`);
  await sleep(250);
  const png = await page.screenshot();
  await writeFile(out, png);
  const result = { png: out, size: `${width * scale}x${height * scale}`, canvas: `${width}x${height}` };
  if (!args['no-webp']) {
    const webpPath = out.replace(/\.png$/i, '') + '.webp';
    await writeFile(webpPath, await pngToWebp(page, png));
    result.webp = webpPath;
  }
  console.log(JSON.stringify({ ...result, ...report }));
} finally {
  await browser.close();
  server.close();
}
