// Klatki kontrolne: node tools/shoot.mjs "<strona.html?parametry>" <folder> <t1> <t2> ... [--gpu]
// Potem: python3 tools/check_motion.py lub obejrzyj PNG. Czas w sekundach na przyciętym lektorze.
import fs from 'node:fs'; import path from 'node:path'; import { openPage } from './browser.mjs';
const argv = process.argv.slice(2), gpu = argv.includes('--gpu'), args = argv.filter(a => a !== '--gpu');
const [page, out, ...times] = args; fs.mkdirSync(out, { recursive: true });
const { frame, close } = await openPage(page, { gpu });
for (const t of times) { const t0 = Date.now(); fs.writeFileSync(path.join(out, `${(+t).toFixed(2)}.png`), Buffer.from(await frame(+t), 'base64')); console.log(`t=${t}s  ${Date.now() - t0} ms`); }
await close();
