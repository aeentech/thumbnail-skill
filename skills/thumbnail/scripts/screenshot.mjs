#!/usr/bin/env node
// Capture a clean viewport screenshot of a page (URL, localhost or file path); banners and chat widgets are hidden.
// Usage: node screenshot.mjs <url|file> --out shot.png [--width 1440] [--height 900] [--scale 2] [--wait 1500]
import { writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { pathToFileURL } from 'node:url';
import { launch, parseArgs, sleep, HIDE_OVERLAYS } from './cdp.mjs';

const args = parseArgs(process.argv.slice(2));
let target = args._[0];
if (!target) { console.error('Usage: node screenshot.mjs <url|file> --out shot.png'); process.exit(1); }
if (!/^(https?|file):/i.test(target)) {
  target = existsSync(target) ? pathToFileURL(resolve(target)).href : `https://${target}`;
}
const out = resolve(args.out || 'screenshot.png');
const width = Number(args.width || 1440);
const height = Number(args.height || 900);
const scale = Number(args.scale || 2);
const wait = Number(args.wait || 1500);

const browser = await launch();
try {
  const page = await browser.newPage({ width, height, scale });
  await page.goto(target);
  // Let fonts, lazy images and entrance animations settle; nudge lazy-loaders.
  await page.evaluate(`(async () => {
    try { await document.fonts.ready; } catch {}
    window.scrollTo(0, 400); await new Promise(r => setTimeout(r, 300)); window.scrollTo(0, 0);
    return true;
  })()`).catch(() => {});
  await page.evaluate(HIDE_OVERLAYS).catch(() => {});
  await sleep(wait);
  await page.evaluate(HIDE_OVERLAYS).catch(() => {});
  await sleep(300);
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, await page.screenshot());
  console.log(out);
} finally {
  await browser.close();
}
