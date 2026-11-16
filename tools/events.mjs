// Lista zdarzeń sceny do sound designu: node tools/events.mjs "<strona.html>" work/events.json
// Strona wystawia window.EVENTS = [{ name, t, kind }] liczone z tych samych stałych co animacja,
// kind: move (ruch → whoosh, t = najszybsza klatka), event (zdarzenie → tekstura), build (narastanie → riser kończy się na t).
import fs from 'node:fs'; import { openPage } from './browser.mjs';
const [page, out] = process.argv.slice(2);
const { pg, close } = await openPage(page);
const evs = await pg.evaluate('window.EVENTS || []'); evs.sort((a, b) => a.t - b.t);
fs.writeFileSync(out, JSON.stringify(evs, null, 1)); await close();
for (const e of evs) console.log(`${e.t.toFixed(2).padStart(6)}  ${(e.kind || '').padEnd(6)} ${e.name}`);
console.log(`${evs.length} zdarzeń -> ${out}`);
