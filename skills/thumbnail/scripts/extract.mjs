#!/usr/bin/env node
// Extract the visual identity of a website so a thumbnail can be art-directed from it.
//
// Usage:
//   node extract.mjs <url|file> --out <dir> [--sections 8] [--wait 2000]
//   node extract.mjs <url|file> --out <dir> --selector "<css>" [--name my-part] [--transparent]
//
// Default mode writes into <dir>:
//   hero.png                 first viewport (1440x900 @2x), banners/chat widgets hidden
//   sections/section-NN.png  the whole page sliced into viewport-high sections (1440 wide) — look at these to find distinctive parts
//   elements/*.png           auto-detected distinctive parts @2x: hero visual, repeated card groups + single cards, code blocks, large SVG/illustrations, media
//   images/*                 the largest real images used by the page (originals, downloaded)
//   fonts/* + fonts.css      the page's own @font-face files (same-origin sheets) rewritten to local paths
//   extract.json             design tokens + an index of everything above
//   overview.png             contact sheet of all captures (labelled with their file names) for a single-view review
//
// Selector mode captures one specific element (first match) @2x into <dir>/elements/<name>.png.
import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { resolve, join, extname } from 'node:path';
import { pathToFileURL } from 'node:url';
import { launch, parseArgs, sleep, HIDE_OVERLAYS } from './cdp.mjs';

const args = parseArgs(process.argv.slice(2));
let target = args._[0];
if (!target || !args.out) { console.error('Usage: node extract.mjs <url|file> --out <dir> [--selector css --name x]'); process.exit(1); }
if (!/^(https?|file):/i.test(target)) target = existsSync(target) ? pathToFileURL(resolve(target)).href : `https://${target}`;
const out = resolve(args.out);
const wait = Number(args.wait || 2000);
const maxSections = Number(args.sections || 8);
for (const d of ['', 'sections', 'elements', 'images', 'fonts']) mkdirSync(join(out, d), { recursive: true });

// Make fixed/sticky headers static so they don't overlay element captures further down the page.
const UNFIX = `(() => { for (const el of document.querySelectorAll('body *')) { const p = getComputedStyle(el).position; if (p === 'fixed' || p === 'sticky') { el.dataset.thumbPos = p; el.style.setProperty('position', 'absolute', 'important'); } } return true; })()`;

// Scroll through the page so lazy content and scroll animations render.
const WARM = `(async () => {
  try { await document.fonts.ready; } catch {}
  const H = () => document.documentElement.scrollHeight;
  for (let y = 0; y < Math.min(H(), 14000); y += Math.round(innerHeight * 0.7)) { window.scrollTo(0, y); await new Promise(r => setTimeout(r, 160)); }
  window.scrollTo(0, 0); await new Promise(r => setTimeout(r, 400));
  for (const img of document.querySelectorAll('img[loading="lazy"]')) img.loading = 'eager';
  return H();
})()`;

const ANALYZE = `(() => {
  const vw = innerWidth, vh = innerHeight;
  const abs = (u) => { try { return new URL(u, location.href).href; } catch { return null; } };
  const vis = (el) => { const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none' && +cs.opacity > 0.05; };
  const docRect = (el) => { const r = el.getBoundingClientRect(); return { x: Math.max(0, r.left + scrollX), y: Math.max(0, r.top + scrollY), width: Math.min(r.width, vw), height: r.height }; };
  const txt = (el) => (el?.innerText || '').replace(/\\s+/g, ' ').trim();
  let uid = 0; const mark = (el) => { if (!el.dataset.thumbId) el.dataset.thumbId = 't' + (++uid); return el.dataset.thumbId; };

  // ---------- tokens ----------
  const colorCount = {}, radii = {}, shadows = {}, gradients = new Set();
  const addC = (c, w) => { const m = c && c.match(/rgba?\\((\\d+),\\s*(\\d+),\\s*(\\d+)(?:,\\s*([\\d.]+))?/); if (!m || (m[4] !== undefined && +m[4] < 0.4)) return;
    const hex = '#' + [m[1], m[2], m[3]].map(v => (+v).toString(16).padStart(2, '0')).join(''); colorCount[hex] = (colorCount[hex] || 0) + w; };
  const all = [...document.querySelectorAll('body *')].slice(0, 6000);
  for (const el of all) {
    if (!vis(el)) continue; const cs = getComputedStyle(el); const r = el.getBoundingClientRect(); const area = r.width * r.height;
    addC(cs.backgroundColor, Math.min(8, area / 15000 + 0.2)); addC(cs.color, 0.5);
    if (parseFloat(cs.borderTopLeftRadius) > 0 && area > 2000) radii[cs.borderTopLeftRadius] = (radii[cs.borderTopLeftRadius] || 0) + 1;
    if (cs.boxShadow !== 'none' && area > 4000) shadows[cs.boxShadow] = (shadows[cs.boxShadow] || 0) + 1;
    if (/gradient\\(/.test(cs.backgroundImage) && area > 8000 && gradients.size < 8) gradients.add(cs.backgroundImage.slice(0, 400));
  }
  delete colorCount['#0000ee']; delete colorCount['#551a8b'];
  const top = (o, n) => Object.entries(o).sort((a, b) => b[1] - a[1]).slice(0, n).map(([k]) => k);
  const btn = [...document.querySelectorAll('a, button')].filter(vis).find(b => { const cs = getComputedStyle(b); return cs.backgroundColor !== 'rgba(0, 0, 0, 0)' && b.getBoundingClientRect().width > 80 && txt(b).length < 30; });
  const bcs = btn && getComputedStyle(btn);
  const tokens = {
    pageBackground: getComputedStyle(document.body).backgroundColor !== 'rgba(0, 0, 0, 0)' ? getComputedStyle(document.body).backgroundColor : getComputedStyle(document.documentElement).backgroundColor,
    colors: top(colorCount, 12), radii: top(radii, 4), shadows: top(shadows, 3), gradients: [...gradients],
    button: btn ? { text: txt(btn), background: bcs.backgroundColor, color: bcs.color, radius: bcs.borderRadius, border: bcs.border, font: bcs.fontFamily, weight: bcs.fontWeight } : null,
    fonts: { body: getComputedStyle(document.body).fontFamily, heading: getComputedStyle(document.querySelector('h1, h2') || document.body).fontFamily, headingWeight: getComputedStyle(document.querySelector('h1, h2') || document.body).fontWeight },
    headingStyle: (() => { const h = document.querySelector('h1'); if (!h) return null; const cs = getComputedStyle(h); return { text: txt(h), size: cs.fontSize, weight: cs.fontWeight, letterSpacing: cs.letterSpacing, transform: cs.textTransform, color: cs.color, backgroundImage: cs.backgroundImage !== 'none' ? cs.backgroundImage.slice(0, 300) : null }; })(),
  };

  // ---------- images ----------
  const imgs = [];
  for (const im of document.querySelectorAll('img')) {
    if (!vis(im)) continue; const r = im.getBoundingClientRect(); const src = abs(im.currentSrc || im.src);
    if (!src || src.startsWith('data:') && src.length < 2000) continue;
    imgs.push({ src, alt: im.alt || '', w: im.naturalWidth, h: im.naturalHeight, area: Math.round(r.width * r.height), y: Math.round(r.top + scrollY), kind: 'img' });
  }
  for (const el of [document.documentElement, document.body, ...all]) {
    if (!vis(el)) continue; const r = el.getBoundingClientRect();
    if (r.width * r.height < 20000) continue;
    for (const pseudo of [null, '::before', '::after']) {
      const bg = getComputedStyle(el, pseudo).backgroundImage;
      for (const m of (bg || '').matchAll(/url\\(["']?([^"')]+)["']?\\)/g))
        imgs.push({ src: abs(m[1]), alt: '', w: 0, h: 0, area: Math.round(r.width * r.height), y: Math.round(r.top + scrollY), kind: pseudo ? 'background' + pseudo : 'background' });
    }
  }
  // Images referenced from readable stylesheets (backgrounds set by builders, sliders, hover states...).
  for (const sh of document.styleSheets) {
    let rules; try { rules = sh.cssRules; } catch { continue; }
    const walk = (rs) => { for (const r of rs) { if (r.cssRules) walk(r.cssRules); const t = r.style && r.style.backgroundImage; if (!t) continue;
      for (const m of t.matchAll(/url\\(["']?([^"')]+)["']?\\)/g)) if (/\\.(png|jpe?g|webp|avif|svg)(\\?|$)/i.test(m[1])) imgs.push({ src: (() => { try { return new URL(m[1], sh.href || location.href).href; } catch { return null; } })(), alt: '', w: 0, h: 0, area: 1, y: 0, kind: 'css-background' }); } };
    walk(rules);
  }
  for (const v of document.querySelectorAll('video[poster]')) imgs.push({ src: abs(v.poster), alt: 'video poster', w: 0, h: 0, area: 0, y: Math.round(v.getBoundingClientRect().top + scrollY), kind: 'poster' });
  const seen = new Set();
  const images = imgs.filter(i => i.src && (i.area >= 2500 || i.kind === 'css-background') && !seen.has(i.src) && seen.add(i.src)).sort((a, b) => b.area - a.area).slice(0, 16);

  // ---------- distinctive elements ----------
  const els = [];
  const push = (el, kind, extra = {}) => { const r = el.getBoundingClientRect(); if (r.width < 40 || r.height < 40) return; els.push({ id: mark(el), kind, rect: docRect(el), text: txt(el).slice(0, 160), ...extra }); };

  // hero visual: largest media in the first 1.4 viewports
  const media = [...document.querySelectorAll('img, video, canvas, svg, picture, [style*="background-image"]')].filter(vis)
    .map(el => ({ el, r: el.getBoundingClientRect() })).filter(o => o.r.top + scrollY < vh * 1.4 && o.r.width * o.r.height > 40000 && !o.el.closest('header, nav'))
    .sort((a, b) => b.r.width * b.r.height - a.r.width * a.r.height);
  if (media[0]) push(media[0].el, 'hero-visual', { tag: media[0].el.tagName.toLowerCase() });

  // repeated card groups: parents with >= 3 similar-sized visible children
  const groups = [];
  for (const p of document.querySelectorAll('body *')) {
    const kids = [...p.children].filter(vis); if (kids.length < 3 || kids.length > 24) continue;
    const rs = kids.map(k => k.getBoundingClientRect()); const w0 = rs[0].width, h0 = rs[0].height;
    if (w0 * h0 < 12000 || w0 > vw * 0.5) continue;
    const similar = rs.filter(r => Math.abs(r.width - w0) / w0 < 0.12 && Math.abs(r.height - h0) / h0 < 0.25).length;
    if (similar < 3) continue;
    const styled = kids.some(k => { const cs = getComputedStyle(k); return cs.backgroundColor !== 'rgba(0, 0, 0, 0)' || cs.borderStyle !== 'none' || cs.boxShadow !== 'none'; });
    groups.push({ p, kids, score: similar * (styled ? 2 : 1) * Math.sqrt(w0 * h0) });
  }
  groups.sort((a, b) => b.score - a.score);
  const usedGroups = [], usedSigs = new Set();
  for (const g of groups) {
    if (usedGroups.some(u => u.contains(g.p) || g.p.contains(u))) continue;
    const sig = txt(g.kids[0]).slice(0, 80);
    if (sig && usedSigs.has(sig)) continue; usedSigs.add(sig);
    usedGroups.push(g.p); push(g.p, 'card-group', { count: g.kids.length });
    g.kids.slice(0, 3).forEach(k => push(k, 'card'));
    if (usedGroups.length >= 3) break;
  }

  // code blocks, big illustrations, prominent headings with special styling, stats
  [...document.querySelectorAll('pre, [class*="code" i] pre, code')].filter(vis).filter(c => c.getBoundingClientRect().height > 120).slice(0, 2)
    .forEach(c => push(c.closest('pre') || c, 'code', { code: (c.innerText || '').slice(0, 1200) }));
  [...document.querySelectorAll('svg')].filter(vis).filter(s => { const r = s.getBoundingClientRect(); return r.width * r.height > 60000 && !s.closest('header, nav'); }).slice(0, 2).forEach(s => push(s, 'illustration'));
  [...document.querySelectorAll('canvas, video')].filter(vis).filter(s => s.getBoundingClientRect().width * s.getBoundingClientRect().height > 60000).slice(0, 2).forEach(s => push(s, 'media'));
  const header = document.querySelector('header, nav'); if (header && vis(header)) push(header, 'header');
  const footer = document.querySelector('footer'); if (footer && vis(footer)) push(footer, 'footer');

  return {
    url: location.href, title: document.title, lang: document.documentElement.lang || null,
    dir: document.documentElement.dir || getComputedStyle(document.documentElement).direction,
    docHeight: document.documentElement.scrollHeight, tokens, images, elements: els,
    headings: [...document.querySelectorAll('h1, h2, h3')].filter(vis).slice(0, 20).map(txt).filter(Boolean),
  };
})()`;

// Collect @font-face rules from readable stylesheets + Google Fonts links.
const FONTS = `(() => {
  const faces = [], google = [], blocked = [];
  for (const sh of document.styleSheets) {
    if (sh.href && /fonts\\.googleapis\\.com/.test(sh.href)) { google.push(sh.href); continue; }
    let rules; try { rules = sh.cssRules; } catch { if (sh.href) blocked.push(sh.href); continue; }
    const walk = (rs) => { for (const r of rs) { if (r.type === 5) faces.push({ css: r.cssText, base: sh.href || location.href }); else if (r.cssRules) walk(r.cssRules); } };
    walk(rules);
  }
  const used = new Set([...document.fonts].filter(f => f.status === 'loaded').map(f => f.family.replace(/["']/g, '')));
  return { faces, google, blocked, used: [...used] };
})()`;

const safe = (s) => s.replace(/[^a-z0-9.-]+/gi, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'file';

async function download(url, dir, base) {
  try {
    const res = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0 thumbnail-skill' } });
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    let ext = extname(new URL(url).pathname).toLowerCase();
    const ct = res.headers.get('content-type') || '';
    if (!ext || ext.length > 6) ext = ct.includes('svg') ? '.svg' : ct.includes('png') ? '.png' : ct.includes('webp') ? '.webp' : ct.includes('avif') ? '.avif' : ct.includes('woff2') ? '.woff2' : '.jpg';
    const name = `${base}${ext}`;
    writeFileSync(join(dir, name), buf);
    return name;
  } catch { return null; }
}

const browser = await launch();
try {
  const page = await browser.newPage({ width: 1440, height: 900, scale: 2 });
  await page.goto(target);
  await page.evaluate(WARM, 60000).catch(() => {});
  await page.evaluate(HIDE_OVERLAYS).catch(() => {});
  await sleep(wait);
  await page.evaluate(HIDE_OVERLAYS).catch(() => {});

  if (args.selector) {
    const sel = JSON.stringify(args.selector);
    const rect = await page.evaluate(`(() => { const el = document.querySelector(${sel}); if (!el) return null; el.scrollIntoView({ block: 'center' }); const r = el.getBoundingClientRect(); return { x: Math.max(0, r.left + scrollX), y: Math.max(0, r.top + scrollY), width: Math.min(r.width, innerWidth), height: r.height }; })()`);
    if (!rect) { console.error(`No element matches ${args.selector}`); process.exit(2); }
    await sleep(600);
    const file = join(out, 'elements', `${safe(args.name || args.selector)}.png`);
    writeFileSync(file, await page.capture(rect, { transparent: !!args.transparent }));
    console.log(file);
  } else {
    writeFileSync(join(out, 'hero.png'), await page.screenshot());
    await page.evaluate(UNFIX).catch(() => {});
    const data = await page.evaluate(ANALYZE, 60000);

    // Page sections (1x, for browsing).
    const H = Math.min(data.docHeight, 900 * maxSections);
    data.sections = [];
    for (let y = 0, i = 1; y < H; y += 900, i++) {
      const name = `sections/section-${String(i).padStart(2, '0')}.png`;
      writeFileSync(join(out, name), await page.capture({ x: 0, y, width: 1440, height: Math.min(900, data.docHeight - y) }, { scale: 0.5 }));
      data.sections.push({ file: name, y });
    }

    // Element crops (2x).
    let n = 0;
    for (const el of data.elements) {
      const r = el.rect; if (r.height > 2600) r.height = 2600;
      const name = `elements/${String(++n).padStart(2, '0')}-${el.kind}.png`;
      try { writeFileSync(join(out, name), await page.capture(r)); el.file = name; } catch {}
    }

    // Original images.
    let k = 0;
    for (const im of data.images) { im.file = await download(im.src, join(out, 'images'), `${String(++k).padStart(2, '0')}-${safe(im.alt || new URL(im.src).pathname.split('/').pop().replace(/\.[a-z0-9]+$/i, '') || 'image')}`); if (im.file) im.file = `images/${im.file}`; }

    // Fonts.
    const f = await page.evaluate(FONTS).catch(() => ({ faces: [], google: [], blocked: [], used: [] }));
    for (const href of f.blocked || []) {
      try { const css = await (await fetch(href)).text(); for (const m of css.matchAll(/@font-face\s*\{[^}]*\}/g)) f.faces.push({ css: m[0], base: href }); } catch {}
    }
    const usedSet = new Set(f.used);
    f.faces = f.faces.filter(face => { const m = face.css.match(/font-family:\s*["']?([^;"'}]+)/); return m && usedSet.has(m[1].trim()); }).slice(0, 24);
    const css = [];
    let fi = 0;
    for (const face of f.faces) {
      let rule = face.css;
      const urls = [...rule.matchAll(/url\(["']?([^"')]+)["']?\)/g)].map(m => m[1]).filter(u => !u.startsWith('data:'));
      for (const u of urls) {
        const absu = new URL(u, face.base).href;
        const local = await download(absu, join(out, 'fonts'), `font-${++fi}`);
        if (local) rule = rule.split(u).join(`fonts/${local}`);
      }
      css.push(rule);
    }
    writeFileSync(join(out, 'fonts.css'), css.join('\n'));
    data.fonts = { used: f.used, google: f.google, fontsCss: css.length ? 'fonts.css' : null, faceCount: css.length };
    for (const e of data.elements) delete e.id;
    writeFileSync(join(out, 'extract.json'), JSON.stringify(data, null, 2));

    // Contact sheet: every capture on one labelled image, so the whole kit can be reviewed in a single view.
    const tiles = [
      { file: 'hero.png', label: 'hero' },
      ...data.sections.map((x) => ({ file: x.file, label: x.file.replace('sections/', '') })),
      ...data.elements.filter((e) => e.file).map((e) => ({ file: e.file, label: e.file.replace('elements/', '') })),
      ...data.images.filter((i) => i.file && !/\.svg$/i.test(i.file)).map((i) => ({ file: i.file, label: i.file.replace('images/', '').slice(0, 34) })),
    ];
    const esc = (t) => t.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    const sheet = `<!doctype html><html><head><meta charset="utf-8"><style>
      body{margin:0;background:#1d1d21;font:12px/1.3 -apple-system,Segoe UI,Arial,sans-serif;color:#ddd}
      .g{display:grid;grid-template-columns:repeat(5,300px);gap:10px;padding:10px;width:1560px}
      .t{background:#2a2a30;border-radius:6px;overflow:hidden}
      .t div{height:190px;background:#fff center/contain no-repeat}
      .t p{margin:0;padding:5px 7px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    </style></head><body><div class="g">${tiles.map((t) => `<div class="t"><div style="background-image:url('${encodeURI(t.file)}')"></div><p>${esc(t.label)}</p></div>`).join('')}</div></body></html>`;
    writeFileSync(join(out, 'overview.html'), sheet);
    await page.setViewport({ width: 1580, height: 900, scale: 1 });
    await page.goto(pathToFileURL(join(out, 'overview.html')).href);
    await sleep(600);
    const sheetH = await page.evaluate('document.documentElement.scrollHeight');
    writeFileSync(join(out, 'overview.png'), await page.capture({ x: 0, y: 0, width: 1580, height: sheetH }));

    console.log(JSON.stringify({ out, overview: 'overview.png', sections: data.sections.length, elements: data.elements.filter(e => e.file).length, images: data.images.filter(i => i.file).length, fontFaces: css.length }));
  }
} finally {
  await browser.close();
}
