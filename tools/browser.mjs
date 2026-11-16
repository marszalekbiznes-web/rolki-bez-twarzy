// Shared: a static server for the repo folder and a headless Chrome that can draw WebGL.
// CPU (SwiftShader) by default, which works everywhere incl. cloud sandboxes; --gpu uses the real graphics card (much faster).
import puppeteer from 'puppeteer-core';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf', '.otf': 'font/otf', '.glb': 'model/gltf-binary', '.gltf': 'model/gltf+json', '.wav': 'audio/wav', '.mp3': 'audio/mpeg' };
export function findChrome() {
  const fixed = ['/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'];
  const pw = fs.existsSync('/opt/pw-browsers') ? fs.readdirSync('/opt/pw-browsers').filter(d => d.startsWith('chromium-')).map(d => `/opt/pw-browsers/${d}/chrome-linux64/chrome`) : [];   // Playwright's Chromium in cloud sandboxes
  return process.env.CHROME || [...fixed, ...pw].find(p => fs.existsSync(p));
}
export async function openPage(page, { gpu = false } = {}) {
  const ROOT = process.cwd();
  const server = http.createServer((req, res) => { const p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
    if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(p).toLowerCase()] || 'application/octet-stream' }); fs.createReadStream(p).pipe(res); });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const chrome = findChrome(); if (!chrome) throw new Error('Nie znaleziono Chrome. Ustaw zmienną CHROME=/ścieżka/do/chrome');
  const flags = gpu ? ['--enable-gpu', '--ignore-gpu-blocklist', ...(process.platform === 'darwin' ? ['--use-angle=metal'] : [])]
                    : ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];
  const browser = await puppeteer.launch({ executablePath: chrome, headless: 'new', protocolTimeout: 600000, args: ['--no-sandbox', '--disable-dev-shm-usage', ...flags] });
  const pg = await browser.newPage(); await pg.setViewport({ width: 1080, height: 1920, deviceScaleFactor: 1 });
  pg.on('pageerror', e => console.log('[błąd strony]', e.message));
  pg.on('console', m => { if (m.type() === 'error') console.log('[konsola]', m.text()); });
  await pg.goto(`http://127.0.0.1:${server.address().port}/${page}`, { waitUntil: 'load' });
  await pg.waitForFunction('window.ready !== undefined', { timeout: 180000 }); await pg.evaluate('window.ready');
  const frame = (t, type = 'image/png', q = 0.93) => pg.evaluate(async (t, type, q) => { await window.renderAt(t); return document.getElementById('c').toDataURL(type, q).split(',')[1]; }, t, type, q);
  const close = async () => { await browser.close(); server.close(); };
  return { pg, frame, close };
}
