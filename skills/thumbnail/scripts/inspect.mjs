#!/usr/bin/env node
// Load a page and print JSON with what's needed to understand it: page type (site or article) with
// article metadata, title, description, language, headings, text sample, logo/icon candidates, brand colors, fonts.
// Usage: node inspect.mjs <url|file>
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { launch, sleep } from './cdp.mjs';

let target = process.argv[2];
if (!target) { console.error('Usage: node inspect.mjs <url|file>'); process.exit(1); }
if (!/^(https?|file):/i.test(target)) {
  target = existsSync(target) ? pathToFileURL(resolve(target)).href : `https://${target}`;
}

const EXTRACT = `(async () => {
  try { await document.fonts.ready; } catch {}
  const abs = (u) => { try { return new URL(u, location.href).href; } catch { return null; } };
  const meta = (sel) => document.querySelector(sel)?.getAttribute('content') || null;
  const txt = (el) => (el?.innerText || el?.textContent || '').replace(/\\s+/g, ' ').trim();

  const icons = [...document.querySelectorAll('link[rel*="icon"], link[rel="apple-touch-icon"], link[rel="mask-icon"]')]
    .map(l => ({ rel: l.rel, href: abs(l.getAttribute('href')), sizes: l.getAttribute('sizes') }));

  const logoImgs = [...document.querySelectorAll('header img, nav img, a[href="/"] img, img[class*="logo" i], img[alt*="logo" i], img[src*="logo" i], [class*="logo" i] img')]
    .slice(0, 6).map(i => ({ src: abs(i.currentSrc || i.src), alt: i.alt, w: i.naturalWidth, h: i.naturalHeight }));
  const logoSvgs = [...document.querySelectorAll('header svg, nav svg, a[href="/"] svg, [class*="logo" i] svg, svg[class*="logo" i]')]
    .filter(s => s.getBoundingClientRect().width >= 20).slice(0, 3).map(s => s.outerHTML.slice(0, 20000));
  // Logos drawn as CSS backgrounds (common in site builders): inline SVG data URIs or image URLs inside the header/home link.
  const logoBackgrounds = [];
  for (const el of document.querySelectorAll('header *, nav *, a[href="/"] *, a[href="./"] *, [class*="logo" i]')) {
    const r = el.getBoundingClientRect(); if (r.width < 24 || r.height < 16 || r.top > 200) continue;
    const bg = getComputedStyle(el).backgroundImage || ''; if (!bg.startsWith('url("') || !bg.endsWith('")')) continue;
    const u = bg.slice(5, -2).split(String.fromCharCode(92, 34)).join(String.fromCharCode(34));
    if (u.startsWith('data:image/svg+xml')) { try { logoBackgrounds.push({ type: 'svg', svg: decodeURIComponent(u.slice(u.indexOf(',') + 1)).slice(0, 30000), w: Math.round(r.width), h: Math.round(r.height) }); } catch {} }
    else logoBackgrounds.push({ type: 'image', src: abs(u), w: Math.round(r.width), h: Math.round(r.height) });
    if (logoBackgrounds.length >= 4) break;
  }

  // Brand colors: count non-neutral colors across visible elements, weighting buttons/links/headers.
  const counts = {};
  const isNeutral = (r, g, b) => Math.max(r, g, b) - Math.min(r, g, b) < 18;
  const add = (c, w) => {
    const m = c && c.match(/rgba?\\((\\d+),\\s*(\\d+),\\s*(\\d+)(?:,\\s*([\\d.]+))?/);
    if (!m) return; if (m[4] !== undefined && Number(m[4]) < 0.5) return;
    const [r, g, b] = [m[1], m[2], m[3]].map(Number);
    if (isNeutral(r, g, b)) return;
    const hex = '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');
    counts[hex] = (counts[hex] || 0) + w;
  };
  const els = [...document.querySelectorAll('body *')].slice(0, 4000);
  for (const el of els) {
    const r = el.getBoundingClientRect(); if (r.width === 0 || r.height === 0) continue;
    const cs = getComputedStyle(el);
    const w = el.matches('button, a.btn, [class*="btn" i], [class*="button" i], [role="button"]') ? 6 : el.matches('a, h1, h2, h3') ? 2 : 1;
    add(cs.backgroundColor, w * Math.min(5, (r.width * r.height) / 20000 + 1));
    add(cs.color, w);
    add(cs.borderTopColor, w * 0.3);
  }
  delete counts['#0000ee']; delete counts['#551a8b']; // browser default link colors
  const brandColors = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([hex]) => hex);
  const bodyBg = getComputedStyle(document.body).backgroundColor;
  const htmlBg = getComputedStyle(document.documentElement).backgroundColor;

  // Fonts actually used by the page + where they come from.
  const fam = (el) => el ? getComputedStyle(el).fontFamily : null;
  const fontStylesheets = [...document.querySelectorAll('link[rel="stylesheet"]')].map(l => l.href).filter(h => /font/i.test(h));
  const fontFaces = [...document.fonts].filter(f => f.status === 'loaded').map(f => f.family.replace(/["']/g, ''));
  const fonts = {
    body: fam(document.body), heading: fam(document.querySelector('h1, h2')),
    loaded: [...new Set(fontFaces)].slice(0, 10), stylesheets: fontStylesheets.slice(0, 5),
    files: performance.getEntriesByType('resource').map(e => e.name).filter(n => /\\.(woff2?|ttf|otf)(\\?|$)/i.test(n)).slice(0, 12),
  };

  // Page type: is this a single article/post rather than a site home page?
  const ld = [];
  for (const sc of document.querySelectorAll('script[type="application/ld+json"]')) {
    try { const j = JSON.parse(sc.textContent); const walk = (o) => { if (!o || typeof o !== 'object') return; if (Array.isArray(o)) return o.forEach(walk); ld.push(o); if (o['@graph']) walk(o['@graph']); }; walk(j); } catch {}
  }
  const ARTICLE_TYPES = ['Article', 'BlogPosting', 'NewsArticle', 'TechArticle', 'Report', 'ScholarlyArticle', 'HowTo'];
  const art = ld.find((o) => [].concat(o['@type'] || []).some((t) => ARTICLE_TYPES.includes(t)));
  const ldImage = art && (typeof art.image === 'string' ? art.image : Array.isArray(art.image) ? (art.image[0]?.url || art.image[0]) : art.image?.url);
  const ldAuthor = art && [].concat(art.author || []).map((a) => (typeof a === 'string' ? a : a?.name)).filter(Boolean).join(', ');
  const articleEl = document.querySelector('article');
  const bodyText = txt(articleEl || document.querySelector('main') || document.body);
  const words = bodyText.split(' ').filter(Boolean).length;
  const path = location.pathname.toLowerCase();
  const pathHint = ['/blog/', '/blogs/', '/post/', '/posts/', '/article', '/news/', '/insights/', '/stories/', '/guides/', '/learn/', '/tutorial', '/\\u0645\\u0642\\u0627\\u0644', '/\\u0645\\u062f\\u0648\\u0646\\u0629'].some((h) => decodeURIComponent(path).includes(h));
  const ogType = meta('meta[property="og:type"]');
  const signals = {
    ogTypeArticle: ogType === 'article',
    jsonLdArticle: !!art,
    publishedTime: !!(meta('meta[property="article:published_time"]') || art?.datePublished || document.querySelector('time[datetime]')),
    articleElement: !!articleEl && txt(articleEl).length > 1200,
    pathHint,
    longForm: words > 500,
  };
  const score = Object.values(signals).filter(Boolean).length;
  const pageInfo = {
    type: (signals.ogTypeArticle || signals.jsonLdArticle || score >= 3) && path !== '/' ? 'article' : 'site',
    signals,
    article: {
      headline: art?.headline || meta('meta[property="og:title"]') || txt(document.querySelector('h1')) || document.title,
      description: art?.description || meta('meta[name="description"]') || meta('meta[property="og:description"]'),
      section: meta('meta[property="article:section"]') || art?.articleSection || null,
      tags: [...document.querySelectorAll('meta[property="article:tag"]')].map((m) => m.content).slice(0, 8),
      author: ldAuthor || meta('meta[name="author"]') || null,
      published: meta('meta[property="article:published_time"]') || art?.datePublished || document.querySelector('time[datetime]')?.getAttribute('datetime') || null,
      coverImage: abs(ldImage || meta('meta[property="og:image"]') || '') || null,
      words, readingMinutes: Math.max(1, Math.round(words / 200)),
      subheadings: [...(articleEl || document).querySelectorAll('h2, h3')].slice(0, 12).map(txt).filter(Boolean),
      images: [...(articleEl || document.querySelector('main') || document).querySelectorAll('img')].filter((i) => i.naturalWidth >= 400).slice(0, 8).map((i) => ({ src: abs(i.currentSrc || i.src), alt: i.alt || '', w: i.naturalWidth, h: i.naturalHeight })),
      codeBlocks: (articleEl || document).querySelectorAll('pre').length,
    },
  };

  return {
    url: location.href,
    page: pageInfo,
    fonts,
    title: document.title,
    lang: document.documentElement.lang || null,
    dir: document.documentElement.dir || getComputedStyle(document.documentElement).direction,
    description: meta('meta[name="description"]') || meta('meta[property="og:description"]'),
    ogTitle: meta('meta[property="og:title"]'),
    siteName: meta('meta[property="og:site_name"]') || meta('meta[name="application-name"]'),
    ogImage: abs(meta('meta[property="og:image"]') || ''),
    themeColor: meta('meta[name="theme-color"]'),
    manifest: abs(document.querySelector('link[rel="manifest"]')?.getAttribute('href') || ''),
    pageBackground: bodyBg !== 'rgba(0, 0, 0, 0)' ? bodyBg : htmlBg,
    brandColors,
    icons, logoImgs, logoSvgs, logoBackgrounds,
    headings: [...document.querySelectorAll('h1, h2')].slice(0, 12).map(txt).filter(Boolean),
    navLinks: [...document.querySelectorAll('nav a, header a')].slice(0, 15).map(txt).filter(Boolean),
    buttons: [...document.querySelectorAll('button, a[class*="btn" i], [role="button"]')].slice(0, 10).map(txt).filter(Boolean),
    textSample: txt(document.querySelector('main') || document.body).slice(0, 3000),
  };
})()`;

const browser = await launch();
try {
  const page = await browser.newPage({ width: 1440, height: 900, scale: 1 });
  await page.goto(target);
  await sleep(1200);
  const data = await page.evaluate(EXTRACT, 30000);
  console.log(JSON.stringify(data, null, 2));
} finally {
  await browser.close();
}
