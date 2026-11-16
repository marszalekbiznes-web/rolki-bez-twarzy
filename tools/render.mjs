// Render do MP4: node tools/render.mjs "<strona.html?parametry>" <wyjście.mp4> [--from 0] [--to KONIEC] [--fps 30] [--audio ready/vo.wav] [--gpu]
// Klatki idą do ffmpeg jako JPEG; x264 CRF 15, yuv420p, faststart. Fragment (--from/--to) renderuje się tak samo jak całość.
import { spawn } from 'node:child_process'; import { openPage } from './browser.mjs';
const argv = process.argv.slice(2), opt = (n, d) => { const i = argv.indexOf(n); if (i < 0) return d; const v = argv[i + 1]; argv.splice(i, 2); return v; };
const gpu = argv.includes('--gpu'); if (gpu) argv.splice(argv.indexOf('--gpu'), 1);
const FPS = +opt('--fps', 30), FROM = +opt('--from', 0), TO0 = opt('--to', null), AUDIO = opt('--audio', null);
const [page, out] = argv; const { pg, frame, close } = await openPage(page, { gpu });
const TOTAL = await pg.evaluate('window.TOTAL'), TO = TO0 == null ? TOTAL : Math.min(+TO0, TOTAL), f0 = Math.round(FROM * FPS), n = Math.round(TO * FPS) - f0;
const aud = AUDIO ? ['-ss', String(FROM), '-t', String(n / FPS), '-i', AUDIO, '-map', '0:v', '-map', '1:a', '-c:a', 'aac', '-b:a', '256k'] : [];
const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-', ...aud,
  '-c:v', 'libx264', '-preset', 'medium', '-crf', '15', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-t', String(n / FPS), out], { stdio: ['pipe', 'inherit', 'inherit'] });
const done = new Promise((ok, no) => ff.on('close', c => c ? no(new Error('ffmpeg ' + c)) : ok())); const t0 = Date.now();
for (let f = 0; f < n; f++) {
  const buf = Buffer.from(await frame((f0 + f) / FPS, 'image/jpeg', 0.93), 'base64'); if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
  if (f % 30 === 0) { const per = (Date.now() - t0) / 1000 / Math.max(1, f); process.stdout.write(`\r${f}/${n} klatek, ${per.toFixed(2)} s/klatkę, zostało ~${((n - f) * per / 60).toFixed(1)} min   `); }
}
ff.stdin.end(); await done; await close(); console.log(`\nZAPISANO ${out} (${n} klatek, ${((Date.now() - t0) / 60000).toFixed(1)} min)`);
