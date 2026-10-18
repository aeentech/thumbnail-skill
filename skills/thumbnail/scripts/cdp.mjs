// Minimal zero-dependency Chrome DevTools Protocol helper.
// Requires Node 22+ (global WebSocket) and an installed Chrome / Chromium / Edge / Brave.
import { spawn, execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir, homedir } from 'node:os';
import { join } from 'node:path';

const WIN = [process.env.PROGRAMFILES, process.env['PROGRAMFILES(X86)'], process.env.LOCALAPPDATA].filter(Boolean);
const CANDIDATES = [
  process.env.CHROME_PATH,
  // macOS
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  join(homedir(), 'Applications/Google Chrome.app/Contents/MacOS/Google Chrome'),
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser',
  // Linux
  '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser',
  '/snap/bin/chromium', '/usr/bin/microsoft-edge', '/usr/bin/brave-browser',
  // Windows
  ...WIN.flatMap((d) => [
    join(d, 'Google/Chrome/Application/chrome.exe'),
    join(d, 'Microsoft/Edge/Application/msedge.exe'),
    join(d, 'BraveSoftware/Brave-Browser/Application/brave.exe'),
  ]),
].filter(Boolean);

const ON_PATH = ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser', 'microsoft-edge', 'brave-browser', 'chrome', 'msedge'];

export function findChrome() {
  const p = CANDIDATES.find((c) => existsSync(c));
  if (p) return p;
  for (const name of ON_PATH) {
    try {
      const out = execFileSync(process.platform === 'win32' ? 'where' : 'which', [name], { stdio: ['ignore', 'pipe', 'ignore'] }).toString().split(/\r?\n/)[0].trim();
      if (out) return out;
    } catch {}
  }
  throw new Error('No Chromium-based browser found (Chrome, Edge, Brave or Chromium). Install one or set CHROME_PATH to its executable.');
}

export async function launch() {
  const userDir = mkdtempSync(join(tmpdir(), 'thumb-chrome-'));
  const proc = spawn(findChrome(), [
    '--headless=new',
    '--remote-debugging-port=0',
    `--user-data-dir=${userDir}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--hide-scrollbars',
    '--mute-audio',
    '--font-render-hinting=none',
    '--allow-file-access-from-files',
    'about:blank',
  ], { stdio: ['ignore', 'ignore', 'pipe'] });

  const wsUrl = await new Promise((resolve, reject) => {
    let buf = '';
    const t = setTimeout(() => reject(new Error('Chrome did not start in time')), 20000);
    proc.stderr.on('data', (d) => {
      buf += d.toString();
      const m = buf.match(/DevTools listening on (ws:\/\/\S+)/);
      if (m) { clearTimeout(t); resolve(m[1]); }
    });
    proc.on('exit', (code) => { clearTimeout(t); reject(new Error(`Chrome exited (${code})`)); });
  });

  const ws = new WebSocket(wsUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });

  let id = 0;
  const pending = new Map();
  const listeners = [];
  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      msg.error ? reject(new Error(msg.error.message)) : resolve(msg.result);
    } else if (msg.method) {
      for (const l of [...listeners]) l(msg);
    }
  };
  const send = (method, params = {}, sessionId) => new Promise((resolve, reject) => {
    const msgId = ++id;
    pending.set(msgId, { resolve, reject });
    ws.send(JSON.stringify({ id: msgId, method, params, ...(sessionId ? { sessionId } : {}) }));
  });
  const waitFor = (method, sessionId, timeout = 30000) => new Promise((resolve) => {
    const t = setTimeout(() => { off(); resolve(null); }, timeout);
    const l = (msg) => { if (msg.method === method && msg.sessionId === sessionId) { clearTimeout(t); off(); resolve(msg.params); } };
    const off = () => { const i = listeners.indexOf(l); if (i >= 0) listeners.splice(i, 1); };
    listeners.push(l);
  });

  async function newPage({ width, height, scale = 1 }) {
    const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
    const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
    const s = (m, p) => send(m, p, sessionId);
    await s('Page.enable');
    await s('Runtime.enable');
    await s('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: scale, mobile: false });

    return {
      async goto(url, timeout = 45000) {
        const loaded = waitFor('Page.loadEventFired', sessionId, timeout);
        await s('Page.navigate', { url });
        await loaded;
      },
      async evaluate(expression, timeout = 20000) {
        let timer;
        const r = await Promise.race([
          s('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }),
          new Promise((_, rej) => { timer = setTimeout(() => rej(new Error('evaluate timeout')), timeout); }),
        ]).finally(() => clearTimeout(timer));
        if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || 'evaluate failed');
        return r.result.value;
      },
      async screenshot() {
        const { data } = await s('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false, fromSurface: true });
        return Buffer.from(data, 'base64');
      },
      async setViewport({ width, height, scale = 1 }) {
        await s('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: scale, mobile: false });
      },
      // Capture a document-coordinate region (may lie outside the viewport).
      async capture({ x, y, width, height }, { transparent = false, scale = 1 } = {}) {
        if (transparent) await s('Emulation.setDefaultBackgroundColorOverride', { color: { r: 0, g: 0, b: 0, a: 0 } });
        const { data } = await s('Page.captureScreenshot', {
          format: 'png', captureBeyondViewport: true, fromSurface: true,
          clip: { x, y, width, height, scale },
        });
        if (transparent) await s('Emulation.setDefaultBackgroundColorOverride', {});
        return Buffer.from(data, 'base64');
      },
    };
  }

  async function close() {
    try { await Promise.race([send('Browser.close').catch(() => {}), new Promise((r) => setTimeout(r, 1500).unref())]); } catch {}
    try { ws.close(); } catch {}
    try { proc.kill('SIGKILL'); } catch {}
    // Chrome helper processes can keep the stderr pipe open; don't let it hold the Node event loop.
    try { proc.stderr.destroy(); } catch {}
    proc.unref();
    await new Promise((r) => setTimeout(r, 300));
    try { rmSync(userDir, { recursive: true, force: true }); } catch {}
  }

  return { newPage, close };
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const k = a.slice(2);
      const v = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true;
      out[k] = v;
    } else out._.push(a);
  }
  return out;
}

// Encode a PNG buffer as lossless WebP using the browser's encoder (quality 1.0 = lossless in Chromium).
export async function pngToWebp(page, png) {
  const b64 = await page.evaluate(`(async () => {
    const img = new Image(); img.src = 'data:image/png;base64,${png.toString('base64')}'; await img.decode();
    const c = new OffscreenCanvas(img.naturalWidth, img.naturalHeight);
    c.getContext('2d').drawImage(img, 0, 0);
    const blob = await c.convertToBlob({ type: 'image/webp', quality: 1 });
    if (blob.type !== 'image/webp') throw new Error('WebP encoding is not supported by this browser');
    const bytes = new Uint8Array(await blob.arrayBuffer()); let s = '';
    for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(s);
  })()`, 120000);
  return Buffer.from(b64, 'base64');
}

// Page script that hides cookie/consent banners, chat widgets and small floating corner buttons so captures are clean.
// Keywords cover English plus common Arabic consent wording (written as Unicode escapes).
const OVERLAY_WORDS = [
  'cookie', 'consent', 'gdpr', 'intercom', 'crisp', 'tawk', 'drift', 'hubspot-messages',
  'whatsapp', 'wa\\.me', 'joinchat', 'chat-widget', 'tidio', 'zendesk', 'livechat',
  '\u0645\u0644\u0641\u0627\u062a \u062a\u0639\u0631\u064a\u0641', // "cookie files" (ar)
  '\u0627\u0644\u0643\u0648\u0643\u064a\u0632', // "cookies" (ar)
  '\u0645\u0644\u0641\u0627\u062a \u0627\u0644\u0627\u0631\u062a\u0628\u0627\u0637', // "tracking files" (ar)
].join('|');

export const HIDE_OVERLAYS = `(() => {
  const rx = new RegExp(${JSON.stringify(OVERLAY_WORDS)}, 'i');
  for (const el of document.querySelectorAll('body *')) {
    const cs = getComputedStyle(el);
    if ((cs.position === 'fixed' || cs.position === 'sticky') && el.tagName !== 'HEADER' && el.tagName !== 'NAV') {
      const sig = el.id + ' ' + el.className + ' ' + (el.getAttribute('href') || '') + ' ' +
        [...el.querySelectorAll('a[href]')].slice(0, 3).map((a) => a.href).join(' ') + ' ' + (el.innerText || '').slice(0, 300);
      const r = el.getBoundingClientRect();
      const floatingButton = cs.position === 'fixed' && r.width <= 140 && r.height <= 260 && r.bottom > innerHeight - 200 && (r.left < 160 || r.right > innerWidth - 160);
      if ((rx.test(sig) && r.height < innerHeight * 0.9) || floatingButton) el.style.setProperty('display', 'none', 'important');
    }
  }
  for (const f of document.querySelectorAll('iframe[src*="intercom"], iframe[src*="tawk"], iframe[title*="chat" i]')) f.style.display = 'none';
  return true;
})()`;
