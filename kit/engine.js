// engine.js: the shared engine for voiceover-driven 3D reels (1080x1920, 30 fps), built on three.js.
// A reel page imports this, builds its world, and exposes the page contract through start():
//   canvas#c, window.ready (Promise), async window.renderAt(t), window.TOTAL, window.EVENTS.
// Everything is a pure function of t, so any frame can be rendered on its own and renders are repeatable.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { BokehPass } from 'three/addons/postprocessing/BokehPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';

export { THREE };
export const W = 1080, H = 1920, FPS = 30, S = 2;   // S: supersampling of 2D textures

// ---------------------------------------------------------------- math and easing
export const clamp01 = v => Math.max(0, Math.min(1, v));
export const lerp = (a, b, k) => a + (b - a) * k;
export const prog = (t, a, b) => clamp01((t - a) / (b - a));
export const rng = seed => () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let x = Math.imul(seed ^ seed >>> 15, 1 | seed); x = x + Math.imul(x ^ x >>> 7, 61 | x) ^ x; return ((x ^ x >>> 14) >>> 0) / 4294967296; };
export function bezier(x1, y1, x2, y2) {           // CSS-style cubic-bezier easing
  const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx, cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
  const sx = u => ((ax * u + bx) * u + cx) * u, sy = u => ((ay * u + by) * u + cy) * u, dx = u => (3 * ax * u + 2 * bx) * u + cx;
  return x => { x = clamp01(x); let u = x; for (let i = 0; i < 8; i++) { const e = sx(u) - x, d = dx(u); if (Math.abs(e) < 1e-6 || Math.abs(d) < 1e-6) break; u -= e / d; }
    u = clamp01(u); return sy(u); };
}
// The house curve: a short ease-in, the fastest part early, then a long settle ("szybko na początku, długo wyhamowuje").
export const EASE = {
  main: bezier(0.33, 0.0, 0.06, 1.0),      // every camera move and object move by default
  land: bezier(0.16, 1.0, 0.30, 1.0),      // entrances that must arrive at once (text, small pops)
  push: bezier(0.55, 0.0, 0.90, 0.45),     // the first half of a dive: gathers speed into a fly-through
  sine: k => 0.5 - 0.5 * Math.cos(Math.PI * clamp01(k)),
  linear: k => clamp01(k),
};

// Fastest point of an easing curve (0..1). A whoosh under a camera move peaks here: at + dur * peakOf().
export function peakOf(ease = EASE.main) { let best = 0, bv = -1; for (let i = 1; i <= 400; i++) { const v = ease(i / 400) - ease((i - 1) / 400); if (v > bv) { bv = v; best = (i - 0.5) / 400; } } return best; }

// Keyframed channel. Moves can overlap: each one adds its own delta, so the value is always continuous.
//   const z = channel(0, [{ at: 1.2, dur: 1.6, to: -8 }, { at: 2.5, dur: 2, to: -20, ease: EASE.push }]);
export function channel(v0, moves) {
  let prev = v0; const ms = moves.map(m => { const d = Array.isArray(m.to) ? m.to.map((v, i) => v - prev[i]) : m.to - prev; prev = m.to; return { ...m, d, e: m.ease || EASE.main }; });
  return t => { let v = Array.isArray(v0) ? v0.slice() : v0;
    for (const m of ms) { const k = m.e((t - m.at) / m.dur); if (k === 0) continue; if (Array.isArray(v)) for (let i = 0; i < v.length; i++) v[i] += m.d[i] * k; else v += m.d * k; }
    return v; };
}
// Idle life: a slow, non-repeating float. amp in units, period in seconds.
export const drift = (t, amp, period, phase = 0) => amp * (Math.sin((t / period + phase) * 2 * Math.PI) * 0.7 + Math.sin((t / period * 1.37 + phase * 2.1) * 2 * Math.PI) * 0.3);

// ---------------------------------------------------------------- renderer, scenes, post
export function createStage({ tokens, bloom = [0.7, 0.55, 0.82], dof = { aperture: 0.0012, maxblur: 0.010 }, grain = 0.035, vignette = 0.5, env = 0.15 } = {}) {
  const canvas = document.getElementById('c');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1); renderer.setSize(W, H, false);
  renderer.toneMapping = THREE.NeutralToneMapping; renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene(); scene.background = new THREE.Color(tokens.bg);
  scene.environment = studioEnv(renderer, tokens.accent); scene.environmentIntensity = env;
  const camera = new THREE.PerspectiveCamera(35, W / H, 0.05, 600);
  const overlay = new THREE.Scene();                                     // text: screen-locked, never blurred or bloomed
  const ortho = new THREE.OrthographicCamera(0, W, 0, -H, -10, 10);       // x right, y down (use -y), units = px
  const composer = new EffectComposer(renderer); composer.setPixelRatio(1); composer.setSize(W, H);
  composer.addPass(new RenderPass(scene, camera));
  let bokeh = null;
  if (dof) {
    bokeh = new BokehPass(scene, camera, { focus: 10, aperture: dof.aperture, maxblur: dof.maxblur });
    const r0 = bokeh.render.bind(bokeh), hidden = [];
    bokeh.render = (...a) => {                                           // glows, lines and glass do not write depth
      scene.traverse(o => { if (o.visible && o.userData.noDepth) { o.visible = false; hidden.push(o); } });
      r0(...a); hidden.forEach(o => (o.visible = true)); hidden.length = 0; };
    composer.addPass(bokeh);
  }
  const bloomPass = new UnrealBloomPass(new THREE.Vector2(W, H), bloom[0], bloom[1], bloom[2]); composer.addPass(bloomPass);
  const ov = new RenderPass(overlay, ortho); ov.clear = false; ov.clearDepth = true; composer.addPass(ov);
  composer.addPass(new OutputPass());
  const finish = new ShaderPass({ uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uVig: { value: vignette }, uGrain: { value: grain } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
    fragmentShader: `uniform sampler2D tDiffuse; uniform float uTime, uVig, uGrain; varying vec2 vUv;
      float rnd(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233)))*43758.5453); }
      void main(){ vec4 c = texture2D(tDiffuse, vUv); vec2 p = (vUv-0.5)*vec2(0.5625,1.0);
        c.rgb *= mix(1.0-uVig, 1.0, smoothstep(0.62, 0.18, length(p)));
        c.rgb += (rnd(vUv*vec2(1080.,1920.) + fract(uTime*7.13)*91.7) - 0.5) * uGrain; gl_FragColor = c; }` });
  composer.addPass(finish);
  return { renderer, scene, camera, overlay, ortho, composer, bokeh, bloomPass, finish };
}

// Studio reflections for metal and glass: long soft strips, not boxes. One warm key strip, one top strip, one accent rim strip.
export function studioEnv(renderer, accent) {
  const es = new THREE.Scene(); es.background = new THREE.Color('#020203');
  const strip = (w, h, pos, col, k) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(col).multiplyScalar(k), side: THREE.DoubleSide })); m.position.set(...pos); m.lookAt(0, 0, 0); es.add(m); };
  strip(1.4, 9, [-7, 2.5, 5], '#FFF3E6', 2.6);      // key, left front
  strip(12, 0.7, [0, 8, 1], '#FFFFFF', 1.2);        // top line
  strip(0.9, 7, [7, 0.5, -5], accent, 3.2);         // accent rim, right back
  strip(5, 0.35, [2, -6, 6], '#FFFFFF', 0.5);       // faint floor kicker
  return new THREE.PMREMGenerator(renderer).fromScene(es, 0.02).texture;
}

// Camera rig: orbit around a point of interest, like a 3D camera with a target in After Effects.
//   pos = target + dist * (sin(az)cos(el), sin(el), cos(az)cos(el)); roll in radians; fov in degrees.
// Every argument is a function of t (use channel()). focus follows dist unless given.
// frameY: the screen height (px) where the target sits. Default 760 keeps the caption band (y ~1230) free; a lens shift, not a tilt.
export function rig({ target, dist, az, el, roll = () => 0, fov = () => 35, focus = null, life = 0.035, frameY = () => 760 }) {
  const up = new THREE.Vector3(0, 1, 0);
  return (t, camera, bokeh) => {
    const tg = target(t), d = dist(t), a = az(t) + drift(t, life * 0.6, 9.1), e = el(t) + drift(t, life * 0.4, 7.3, 0.3);
    camera.position.set(tg[0] + d * Math.sin(a) * Math.cos(e), tg[1] + d * Math.sin(e), tg[2] + d * Math.cos(a) * Math.cos(e));
    camera.up.copy(up); camera.lookAt(tg[0], tg[1], tg[2]); camera.rotateZ(roll(t));
    camera.fov = fov(t); camera.setViewOffset(W, H, 0, 960 - frameY(t), W, H); camera.updateProjectionMatrix(); camera.updateMatrixWorld();
    if (bokeh) bokeh.uniforms.focus.value = focus ? focus(t) : d;
  };
}

// ---------------------------------------------------------------- 2D textures
export const mk = (w, h) => { const c = document.createElement('canvas'); c.width = Math.ceil(w * S); c.height = Math.ceil(h * S); return c; };
export function tex(c) { const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; }
export function draw2d(w, h, fn) { const c = mk(w, h), g = c.getContext('2d'); g.scale(S, S); fn(g, w, h); return c; }
export function radialTex(stops, size = 512) { return tex(draw2d(size, size, (g, w) => { const gr = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2); stops.forEach(([o, c]) => gr.addColorStop(o, c)); g.fillStyle = gr; g.fillRect(0, 0, w, w); })); }
export function glowSprite(color, size, opacity = 1) {   // additive soft glow, no depth
  const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size), new THREE.MeshBasicMaterial({ map: radialTex([[0, color], [0.25, color.replace(/[\d.]+\)$/, '0.35)')], [1, color.replace(/[\d.]+\)$/, '0)')]]), transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending }));
  m.userData.noDepth = true; return m;
}
export function dust(n, box, color, size, opacity, seed = 1) {
  const r = rng(seed), pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { pos[i * 3] = lerp(box[0], box[1], r()); pos[i * 3 + 1] = lerp(box[2], box[3], r()); pos[i * 3 + 2] = lerp(box[4], box[5], r()); }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const dot = draw2d(32, 32, (g) => { const gr = g.createRadialGradient(16, 16, 0, 16, 16, 16); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.4, 'rgba(255,255,255,0.45)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 32, 32); });
  const p = new THREE.Points(geo, new THREE.PointsMaterial({ map: tex(dot), color, size, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending }));
  p.userData.noDepth = true; p.frustumCulled = false; return p;
}

// ---------------------------------------------------------------- kinetic type (screen-locked, word by word on the voice)
// A title shows a few words of what is being said, never the whole sentence. Each word arrives on its own timestamp:
// it rises 26 px and sharpens from a blur, and it leaves the same way, upwards.
export class Type {
  constructor(overlay, tokens) { this.overlay = overlay; this.tk = tokens; this.titles = []; }
  // lines: [[{ t: 'Zero', at: 0.1, accent: true }, ...], ...]; y: centre of the block in px; out: when it leaves
  add({ lines, y, size = 112, out, weight = 600, tracking = -0.03, gap = 0.08, align = 'center' }) {
    const tk = this.tk, font = `${weight} ${size}px "${tk.font}"`, m = document.createElement('canvas').getContext('2d');
    m.font = font; m.letterSpacing = `${tracking * size}px`;
    const asc = size * 0.78, desc = size * 0.24, lh = size * (1 + gap), words = [];
    const blockH = lines.length * lh - gap * size; let y0 = y - blockH / 2;
    lines.forEach(line => {
      const ws = line.map(w => m.measureText(w.t).width), sp = m.measureText(' ').width, total = ws.reduce((a, b) => a + b, 0) + sp * (line.length - 1);
      let x = align === 'center' ? (W - total) / 2 : 90;
      line.forEach((w, i) => { words.push({ ...w, x: x + ws[i] / 2, y: y0 + asc, w: ws[i] }); x += ws[i] + sp; });
      y0 += lh;
    });
    for (const w of words) {
      const pad = 40, cw = w.w + pad * 2, chh = asc + desc + pad * 2, cache = new Map();
      const texFor = blur => { const b = Math.round(blur * 2) / 2; if (cache.has(b)) return cache.get(b);
        const c = draw2d(cw, chh, g => { g.font = font; g.letterSpacing = `${tracking * size}px`; g.textAlign = 'center'; g.textBaseline = 'alphabetic';
          if (b > 0) g.filter = `blur(${b * S}px)`;
          const col = w.accent ? tk.accent : tk.text;
          if (w.accent && tk.glow) { g.save(); g.shadowColor = tk.glow; g.shadowBlur = 28 * S; g.fillStyle = col; g.fillText(w.t, cw / 2, pad + asc); g.restore(); }
          if (!w.accent) { const gr = g.createLinearGradient(0, pad, 0, pad + asc + desc); gr.addColorStop(0, col); gr.addColorStop(0.55, col); gr.addColorStop(1, tk.textLow || col); g.fillStyle = gr; } else g.fillStyle = col;
          g.fillText(w.t, cw / 2, pad + asc); });
        const t = tex(c); cache.set(b, t); return t; };
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(cw, chh), new THREE.MeshBasicMaterial({ map: texFor(0), transparent: true, depthWrite: false, depthTest: false }));
      mesh.position.set(w.x, -(w.y - asc + (asc + desc) / 2), 0);
      w.mesh = mesh; w.texFor = texFor; w.baseY = mesh.position.y; w.out = out; this.overlay.add(mesh);
    }
    this.titles.push({ words, out });
    return this;
  }
  update(t) {
    for (const ti of this.titles) for (const [i, w] of ti.words.entries()) {
      const kin = EASE.land(prog(t, w.at - 0.06, w.at - 0.06 + 0.42));
      const kout = EASE.main(prog(t, ti.out + i * 0.025, ti.out + i * 0.025 + 0.32));
      const vis = kin * (1 - kout), blur = Math.max(1 - kin, kout) * 9;
      w.mesh.visible = vis > 0.002; if (!w.mesh.visible) continue;
      w.mesh.material.opacity = vis; w.mesh.position.y = w.baseY - (1 - kin) * 26 + kout * 34;
      const tx = w.texFor(blur); if (w.mesh.material.map !== tx) { w.mesh.material.map = tx; w.mesh.material.needsUpdate = true; }
    }
  }
}
// Words from words.json by index range, with accents: words(W, 0, 3, { accent: [0] })
export function pick(words, from, to, { accent = [], strip = true } = {}) {
  return words.slice(from, to + 1).map((w, i) => ({ t: strip ? w.w.replace(/[,]$/, '') : w.w, at: w.s, accent: accent.includes(i) }));
}

// ---------------------------------------------------------------- captions (screen-locked, minimal, two levels)
// Every chunk is 1-3 short lines: a small sans line carries the sentence, one big italic serif line carries the key word.
// The block sits in the caption band just below the centre (default y = 1230), so the animation keeps the upper part.
// Words arrive on their own timestamps (fade up from a blur, the big ones also grow from 94%); the chunk leaves together.
export class Captions {
  constructor(overlay, tokens, { y = 1230, small = 46, big = 124, maxW = 900 } = {}) { Object.assign(this, { overlay, tk: tokens, y, small, big, maxW, chunks: [] }); }
  // lines: [{ big: false, words: [{ t, at }] }, { big: true, words: [...] }]; out: time the chunk leaves
  add(lines, out) {
    const tk = this.tk, m = document.createElement('canvas').getContext('2d');
    const spec = L => { const big = !!L.big; let size = big ? this.big : this.small;
      const f = sz => big ? `italic ${tk.bigWeight || 650} ${sz}px "${tk.fontBig}"` : `${tk.smallWeight || 500} ${sz}px "${tk.fontSmall}"`;
      const track = big ? -0.01 : 0.0;
      const meas = sz => { m.font = f(sz); m.letterSpacing = `${track * sz}px`; const ws = L.words.map(w => m.measureText(w.t).width); return { ws, sp: m.measureText(' ').width, tot: ws.reduce((a, b) => a + b, 0) + m.measureText(' ').width * (ws.length - 1) }; };
      let r = meas(size); if (r.tot > this.maxW) { size = Math.floor(size * this.maxW / r.tot); r = meas(size); }
      return { big, size, font: f(size), track, ...r, asc: size * (big ? 0.80 : 0.76), desc: size * (big ? 0.26 : 0.22) }; };
    const S2 = lines.map(spec), gaps = S2.map((L, i) => i ? (L.big || S2[i - 1].big ? 0.02 : 0.18) * L.size : 0);
    const blockH = S2.reduce((a, L, i) => a + L.asc + L.desc + gaps[i], 0); let y0 = this.y - blockH / 2; const words = [];
    S2.forEach((L, li) => { y0 += gaps[li]; let x = (W - L.tot) / 2;
      lines[li].words.forEach((w, i) => { words.push({ ...w, L, cx: x + L.ws[i] / 2, base: y0 + L.asc, ww: L.ws[i] }); x += L.ws[i] + L.sp; });
      y0 += L.asc + L.desc; });
    for (const w of words) {
      const L = w.L, pad = 46, cw = w.ww + pad * 2, chh = L.asc + L.desc + pad * 2, cache = new Map();
      const texFor = blur => { const b = Math.round(blur * 2) / 2; if (cache.has(b)) return cache.get(b);
        const c = draw2d(cw, chh, g => { g.font = L.font; g.letterSpacing = `${L.track * L.size}px`; g.textAlign = 'center'; if (b > 0) g.filter = `blur(${b * S}px)`;
          const x = cw / 2, y = pad + L.asc;
          g.save(); g.shadowColor = 'rgba(0,0,0,0.65)'; g.shadowBlur = 22 * S; g.shadowOffsetY = 4 * S; g.fillStyle = 'rgba(0,0,0,0.01)'; g.fillText(w.t, x, y); g.restore();
          if (L.big) { const gr = g.createLinearGradient(0, pad, 0, pad + L.asc + L.desc); gr.addColorStop(0, tk.accentHi); gr.addColorStop(0.75, tk.accent); g.save(); g.shadowColor = tk.glow; g.shadowBlur = 30 * S; g.fillStyle = gr; g.fillText(w.t, x, y); g.restore(); g.fillStyle = gr; }
          else g.fillStyle = tk.text;
          g.fillText(w.t, x, y); });
        const t = tex(c); cache.set(b, t); return t; };
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(cw, chh), new THREE.MeshBasicMaterial({ map: texFor(0), transparent: true, depthWrite: false, depthTest: false }));
      mesh.position.set(w.cx, -(w.base - L.asc + (L.asc + L.desc) / 2), 0); w.mesh = mesh; w.texFor = texFor; w.y0 = mesh.position.y; this.overlay.add(mesh);
    }
    this.chunks.push({ words, out }); return this;
  }
  update(t) {
    for (const ch of this.chunks) for (const w of ch.words) {
      const kin = EASE.land(prog(t, w.at - 0.05, w.at + 0.33)), kout = EASE.main(prog(t, ch.out, ch.out + 0.26));
      const vis = kin * (1 - kout); w.mesh.visible = vis > 0.002; if (!w.mesh.visible) continue;
      w.mesh.material.opacity = vis; w.mesh.position.y = w.y0 - (1 - kin) * 18 + kout * 14;
      const sc = w.L.big ? lerp(0.94, 1, kin) : 1; w.mesh.scale.setScalar(sc);
      const tx = w.texFor(Math.max(1 - kin, kout) * 8); if (w.mesh.material.map !== tx) { w.mesh.material.map = tx; w.mesh.material.needsUpdate = true; }
    }
  }
}
// Build a caption line from words.json by index range: line(WORDS, 0, 1) or line(WORDS, 0, 1, true) for the big line
export const line = (words, from, to, big = false) => ({ big, words: words.slice(from, to + 1).map(w => ({ t: w.w, at: w.s })) });

// ---------------------------------------------------------------- page contract
export function start({ fonts = [], setup }) {
  // setup() runs after the fonts are loaded (text is measured with the real font) and returns { stage, total, update, events }
  const q = new URLSearchParams(location.search);
  window.ready = Promise.all(fonts.map(f => document.fonts.load(f[0], f[1]))).then(async () => {
    const { stage, total, update, events = [] } = await setup();
    window.TOTAL = total; window.EVENTS = events;
    window.renderAt = async t => { update(t); stage.finish.uniforms.uTime.value = t; stage.composer.render(); };
    if (q.has('t')) window.renderAt(parseFloat(q.get('t')));
    else if (q.has('play')) { const t0 = performance.now(); (function tick() { window.renderAt(((performance.now() - t0) / 1000) % total); requestAnimationFrame(tick); })(); }
    return true; });
}
