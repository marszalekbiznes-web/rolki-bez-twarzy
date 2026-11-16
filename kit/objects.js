// objects.js: hero objects for voiceover-driven 3D reels. Every builder takes the tokens (TK) and returns
// { group, ...handles } plus an update(t, ...) where the object has its own life. Colours come only from TK.
import { THREE, S, EASE, lerp, clamp01, prog, drift, rng, draw2d, tex, glowSprite } from './engine.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshSurfaceSampler } from 'three/addons/math/MeshSurfaceSampler.js';

export const rgba = (hex, a) => { const c = new THREE.Color(hex); return `rgba(${Math.round(c.r * 255)},${Math.round(c.g * 255)},${Math.round(c.b * 255)},${a})`; };
const metal = (c, r = 0.35) => new THREE.MeshStandardMaterial({ color: c, metalness: 1, roughness: r, side: THREE.DoubleSide });
const P2 = (x, y) => new THREE.Vector2(x, y);
// a turned ring (lathe) along +y, front at y0; parent is usually rotated so +y faces the camera
export function tube(parent, ro, ri, y0, y1, mat, b = 0.018) {
  const m = new THREE.Mesh(new THREE.LatheGeometry([P2(ri, y0), P2(ro - b, y0), P2(ro, y0 - b), P2(ro, y1 + b), P2(ro - b, y1), P2(ri, y1), P2(ri, y0)], 160), mat); parent.add(m); return m;
}
// unlit glass: shows the studio strips as reflections, never a hot light spot
export function glassCap(parent, envTex, Rs, rim, y, op) {
  const th = Math.asin(rim / Rs), m = new THREE.Mesh(new THREE.SphereGeometry(Rs, 160, 48, 0, Math.PI * 2, 0, th),
    new THREE.MeshBasicMaterial({ color: '#05070C', envMap: envTex, combine: THREE.AddOperation, reflectivity: 0.85, transparent: true, opacity: op, depthWrite: false }));
  m.position.y = y - Rs * Math.cos(th); m.userData.noDepth = true; parent.add(m); return m;
}

// ---------------------------------------------------------------- lens with a working iris (the camera can fly through it)
export function lens(TK, envTex) {
  const ACC = new THREE.Color(TK.accent), g = new THREE.Group(), axis = new THREE.Group(); g.add(axis); axis.rotation.x = Math.PI / 2;
  tube(axis, 1.62, 1.36, 0.00, -0.10, metal('#A9B0BA', 0.28));
  tube(axis, 1.66, 1.30, -0.10, -0.30, metal('#1A1C21', 0.42));
  tube(axis, 1.69, 1.30, -0.30, -1.05, new THREE.MeshStandardMaterial({ color: '#0B0C0F', roughness: 0.82, side: THREE.DoubleSide }));
  const ribs = new THREE.InstancedMesh(new THREE.BoxGeometry(0.05, 0.66, 0.05), new THREE.MeshStandardMaterial({ color: '#111216', roughness: 0.7 }), 110), o = new THREE.Object3D();
  for (let i = 0; i < 110; i++) { const a = i / 110 * Math.PI * 2; o.position.set(Math.cos(a) * 1.705, -0.675, Math.sin(a) * 1.705); o.rotation.y = -a; o.updateMatrix(); ribs.setMatrixAt(i, o.matrix); } axis.add(ribs);
  tube(axis, 1.675, 1.60, -1.10, -1.16, new THREE.MeshBasicMaterial({ color: ACC.clone().multiplyScalar(1.4), toneMapped: false, side: THREE.DoubleSide }));
  tube(axis, 1.64, 1.30, -1.16, -1.90, metal('#16181C', 0.33));
  tube(axis, 1.40, 1.24, -1.90, -2.30, metal('#B9C0CA', 0.22));
  [-0.75, -1.25, -1.75].forEach(y => tube(axis, 1.31, 1.10, y, y - 0.04, new THREE.MeshStandardMaterial({ color: '#07080A', roughness: 0.6, metalness: 0.4, side: THREE.DoubleSide })));
  const R = 1.31, N = 9, isz = 900, ic = document.createElement('canvas'); ic.width = ic.height = isz; const ig = ic.getContext('2d'), it = tex(ic);
  const iris = new THREE.Mesh(new THREE.CircleGeometry(R, 128), new THREE.MeshBasicMaterial({ map: it, transparent: true, side: THREE.DoubleSide })); iris.rotation.x = -Math.PI / 2; iris.position.y = -0.55; axis.add(iris);
  let last = '';
  const drawIris = (k, glowK) => {
    const key = Math.round(k * 400) + ':' + Math.round(glowK * 50); if (key === last) return; last = key;
    const c = isz / 2, sc = c / R, r = lerp(0.035, 1.02, k) * sc, rot = lerp(0.9, 0.0, k);
    ig.setTransform(1, 0, 0, 1, 0, 0); ig.clearRect(0, 0, isz, isz); ig.save(); ig.translate(c, c);
    ig.beginPath(); ig.arc(0, 0, c, 0, Math.PI * 2); const base = ig.createRadialGradient(0, 0, 0, 0, 0, c); base.addColorStop(0, '#202329'); base.addColorStop(1, '#090A0D'); ig.fillStyle = base; ig.fill();
    const con = ig.createConicGradient(rot, 0, 0); for (let i = 0; i <= N; i++) { con.addColorStop(i / N, 'rgba(255,255,255,0.075)'); if (i < N) con.addColorStop((i + 0.92) / N, 'rgba(0,0,0,0.30)'); } ig.fillStyle = con; ig.fill();
    const V = i => { const a = rot + i / N * Math.PI * 2; return [Math.cos(a) * r, Math.sin(a) * r, a]; };
    for (let i = 0; i < N; i++) { const [x, y, a] = V(i); ig.beginPath(); ig.moveTo(x, y); ig.quadraticCurveTo(Math.cos(a + 0.55) * (r + c) * 0.62, Math.sin(a + 0.55) * (r + c) * 0.62, Math.cos(a + 1.05) * c, Math.sin(a + 1.05) * c); ig.strokeStyle = 'rgba(255,255,255,0.13)'; ig.lineWidth = 2.2; ig.stroke(); }
    ig.beginPath(); for (let i = 0; i <= N; i++) { const [x, y] = V(i % N), [px, py] = V((i + N - 1) % N); if (!i) ig.moveTo(x, y); else ig.quadraticCurveTo((x + px) / 2 * 1.06, (y + py) / 2 * 1.06, x, y); } ig.closePath();
    if (glowK > 0.01) { ig.save(); ig.shadowColor = rgba(TK.accentHi, 0.9 * glowK); ig.shadowBlur = 60; ig.strokeStyle = rgba(TK.accentHi, 0.85 * glowK); ig.lineWidth = 5; ig.stroke(); ig.restore(); }
    ig.globalCompositeOperation = 'destination-out'; ig.fillStyle = '#000'; ig.fill(); ig.restore(); it.needsUpdate = true; };
  const glassF = glassCap(axis, envTex, 3.4, 1.37, -0.06, 0.32), glassI = glassCap(axis, envTex, 2.2, 1.12, -0.42, 0.18);
  const coat = new THREE.Mesh(new THREE.CircleGeometry(1.36, 96), new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, map: tex(draw2d(512, 512, g2 => {
    g2.translate(256, 256); const band = (r0, r1, a0, a1, col) => { g2.beginPath(); g2.arc(0, 0, r1, a0, a1); g2.arc(0, 0, r0, a1, a0, true); g2.closePath(); const gr = g2.createLinearGradient(-200, -200, 120, 120); gr.addColorStop(0, col); gr.addColorStop(1, 'rgba(0,0,0,0)'); g2.fillStyle = gr; g2.filter = 'blur(16px)'; g2.fill(); };
    band(170, 215, Math.PI * 1.08, Math.PI * 1.40, 'rgba(190,170,255,0.22)'); band(212, 236, Math.PI * 1.12, Math.PI * 1.32, 'rgba(255,255,255,0.20)'); band(70, 105, Math.PI * 0.18, Math.PI * 0.36, 'rgba(120,255,210,0.10)'); })) }));
  coat.rotation.x = -Math.PI / 2; coat.position.y = 0.05; coat.userData.noDepth = true; axis.add(coat);
  const inner = glowSprite(rgba(TK.accent, 0.8), 3.0, 0); inner.rotation.x = -Math.PI / 2; inner.position.y = -1.6; axis.add(inner);
  return { group: g, drawIris, glassF, glassI, coat, inner };
}

// ---------------------------------------------------------------- glass card with a sketch or an image (reel frames, plan frames, inspirations)
export function cardTexture(TK, { w = 360, h = 640, lit = false, draw = null, image = null, r = 26 } = {}) {
  return tex(draw2d(w, h, g => {
    g.beginPath(); g.roundRect(2, 2, w - 4, h - 4, r);
    if (image) { g.save(); g.clip(); const s = Math.max(w / image.width, h / image.height); g.drawImage(image, (w - image.width * s) / 2, (h - image.height * s) / 2, image.width * s, image.height * s); g.restore(); }
    else if (!lit) { const bg = g.createLinearGradient(0, 0, 0, h); bg.addColorStop(0, 'rgba(34,42,62,0.80)'); bg.addColorStop(1, 'rgba(9,12,20,0.92)'); g.fillStyle = bg; g.fill(); }
    const rim = g.createLinearGradient(0, 0, 0, h); rim.addColorStop(0, lit ? rgba(TK.accentHi, 1) : 'rgba(255,255,255,0.38)'); rim.addColorStop(0.35, lit ? rgba(TK.accent, 0.45) : 'rgba(255,255,255,0.12)'); rim.addColorStop(1, lit ? rgba(TK.accent, 0.10) : 'rgba(255,255,255,0.03)');
    g.lineWidth = lit ? 3 : 2; g.strokeStyle = rim; g.stroke();
    if (lit) { const sh = g.createLinearGradient(0, 0, 0, h * 0.6); sh.addColorStop(0, rgba(TK.accent, 0.22)); sh.addColorStop(1, rgba(TK.accent, 0)); g.fillStyle = sh; g.fill(); }
    if (draw) { g.save(); g.translate(w / 2, h / 2); g.strokeStyle = lit ? TK.accentHi : 'rgba(255,255,255,0.10)'; g.fillStyle = lit ? TK.accentHi : 'rgba(255,255,255,0.10)'; g.lineCap = 'round'; g.lineJoin = 'round'; g.lineWidth = 5; if (lit) { g.shadowColor = rgba(TK.accent, 0.95); g.shadowBlur = 30 * S; } draw(g); g.restore(); }
  }));
}
export const GLYPHS = [
  g => { g.beginPath(); g.arc(0, 0, 70, 0, Math.PI * 2); g.stroke(); g.beginPath(); g.arc(0, 0, 10, 0, 7); g.fill(); },
  g => { for (let i = -2; i <= 2; i++) { g.beginPath(); g.moveTo(i * 34, 50 - (i + 3) * 18); g.lineTo(i * 34, 60); g.stroke(); } },
  g => { g.beginPath(); for (let x = -110; x <= 110; x += 4) g.lineTo(x, Math.sin(x / 22) * 34 * Math.cos(x / 140)); g.stroke(); },
  g => { g.beginPath(); g.arc(0, 30, 90, Math.PI * 1.1, Math.PI * 1.9); g.stroke(); g.beginPath(); g.arc(Math.cos(Math.PI * 1.9) * 90, 30 + Math.sin(Math.PI * 1.9) * 90, 11, 0, 7); g.fill(); },
  g => { for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) { g.beginPath(); g.arc((i - 1) * 46, (j - 1) * 46, (i === 1 && j === 1) ? 12 : 6, 0, 7); g.fill(); } },
  g => { g.beginPath(); g.moveTo(-40, -55); g.lineTo(55, 0); g.lineTo(-40, 55); g.closePath(); g.stroke(); },
];

// ---------------------------------------------------------------- clock: steel bezel, dark dial, polished hands, an accent seconds hand
export function clock(TK, envTex) {
  const ACC = new THREE.Color(TK.accent), g = new THREE.Group(), axis = new THREE.Group(); g.add(axis); axis.rotation.x = Math.PI / 2;
  const R = 1.7;
  tube(axis, R + 0.13, R - 0.03, 0.12, -0.22, metal('#B4BBC5', 0.24));
  tube(axis, R + 0.09, R - 0.06, -0.22, -0.62, metal('#15171B', 0.38));
  tube(axis, R + 0.095, R + 0.06, -0.30, -0.34, new THREE.MeshBasicMaterial({ color: ACC.clone().multiplyScalar(1.3), toneMapped: false, side: THREE.DoubleSide }));
  const back = new THREE.Mesh(new THREE.CircleGeometry(R + 0.06, 96), new THREE.MeshStandardMaterial({ color: '#0C0D10', metalness: 0.8, roughness: 0.4, side: THREE.DoubleSide })); back.position.z = -0.6; g.add(back);
  const dial = new THREE.Mesh(new THREE.CircleGeometry(R - 0.03, 128), new THREE.MeshBasicMaterial({ map: tex(draw2d(1024, 1024, d => {
    d.translate(512, 512); const bg = d.createRadialGradient(0, -120, 0, 0, 0, 512); bg.addColorStop(0, '#151925'); bg.addColorStop(1, '#06070B'); d.fillStyle = bg; d.beginPath(); d.arc(0, 0, 512, 0, 7); d.fill();
    for (let r = 120; r < 500; r += 9) { d.beginPath(); d.arc(0, 0, r, 0, 7); d.strokeStyle = 'rgba(255,255,255,0.018)'; d.lineWidth = 1; d.stroke(); }
    for (let i = 0; i < 60; i++) { const a = i / 60 * Math.PI * 2, h = i % 5 === 0, r1 = 470, r0 = h ? 405 : 445; d.save(); d.rotate(a); d.beginPath(); d.moveTo(0, -r0); d.lineTo(0, -r1);
      d.strokeStyle = i === 0 ? TK.accentHi : (h ? 'rgba(235,240,248,0.85)' : 'rgba(235,240,248,0.32)'); d.lineWidth = h ? 9 : 3; d.lineCap = 'round'; if (i === 0) { d.shadowColor = TK.accent; d.shadowBlur = 24 * S; } d.stroke(); d.restore(); }
  })) })); dial.position.z = 0.0; g.add(dial);
  const handMat = metal('#DCE1E8', 0.22);
  const mkHand = (w, len, tail, z, mat) => { const geo = new THREE.BoxGeometry(w, len + tail, 0.03); geo.translate(0, (len - tail) / 2, 0); const m = new THREE.Mesh(geo, mat); m.position.z = z; g.add(m); return m; };
  const hourH = mkHand(0.10, 0.92, 0.16, 0.06, handMat), minH = mkHand(0.065, 1.38, 0.2, 0.10, handMat);
  const secMat = new THREE.MeshBasicMaterial({ color: ACC.clone().multiplyScalar(1.8), toneMapped: false }), secH = mkHand(0.024, 1.5, 0.32, 0.14, secMat);
  const ghosts = [1, 2, 3].map(i => { const m = new THREE.Mesh(minH.geometry, new THREE.MeshBasicMaterial({ color: '#C8D2E0', transparent: true, opacity: 0, depthWrite: false })); m.position.z = 0.09 - i * 0.003; m.userData.noDepth = true; g.add(m); return m; });
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.08, 48), metal('#E6EAF0', 0.2)); cap.rotation.x = Math.PI / 2; cap.position.z = 0.17; g.add(cap);
  const glass = glassCap(axis, envTex, 5.5, R - 0.02, 0.10, 0.28);
  // h: hours as a float (10.17 = 10:10); speed (rad/s of the minute hand) draws motion-blur ghosts
  const set = (h, sec, speed = 0) => {
    hourH.rotation.z = -(h / 12) * Math.PI * 2; minH.rotation.z = -((h % 1)) * Math.PI * 2; secH.rotation.z = -(sec / 60) * Math.PI * 2;
    ghosts.forEach((m, i) => { m.rotation.z = minH.rotation.z + Math.sign(speed) * Math.min(0.5, Math.abs(speed) * 0.012) * (i + 1); m.material.opacity = clamp01(Math.abs(speed) / 25) * (0.28 - i * 0.07); });
  };
  return { group: g, set, glass };
}

// ---------------------------------------------------------------- hourglass with falling sand
export function hourglass(TK, envTex) {
  const g = new THREE.Group(), prof = [];
  for (let i = 0; i <= 60; i++) { const u = i / 60, y = lerp(-1, 1, u), a = Math.abs(y); prof.push(P2(0.05 + 0.5 * Math.pow(Math.sin(Math.min(1, a / 0.9) * Math.PI / 2), 1.6) * (a > 0.93 ? 1 - (a - 0.93) * 6 : 1), y)); }
  const glassM = new THREE.Mesh(new THREE.LatheGeometry(prof, 128), new THREE.MeshBasicMaterial({ color: '#0A1020', envMap: envTex, combine: THREE.AddOperation, reflectivity: 1.0, transparent: true, opacity: 0.55, depthWrite: false, side: THREE.DoubleSide }));
  glassM.userData.noDepth = true; g.add(glassM);
  const plateMat = metal('#2A2D33', 0.3), trim = metal('#B4BBC5', 0.25);
  [1.06, -1.06].forEach(y => { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.68, 0.68, 0.1, 96), plateMat); p.position.y = y; g.add(p); const t2 = new THREE.Mesh(new THREE.TorusGeometry(0.68, 0.012, 8, 96), trim); t2.rotation.x = Math.PI / 2; t2.position.y = y + Math.sign(y) * 0.05; g.add(t2); });
  for (let i = 0; i < 3; i++) { const a = i / 3 * Math.PI * 2 + 0.5, rod = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 2.12, 16), trim); rod.position.set(Math.cos(a) * 0.6, 0, Math.sin(a) * 0.6); g.add(rod); }
  const NS = 2600, r = rng(4), pos = new Float32Array(NS * 3), seeds = Array.from({ length: NS }, () => [r(), r(), r()]);
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const sand = new THREE.Points(geo, new THREE.PointsMaterial({ color: new THREE.Color(TK.sand || '#EBD9BF'), size: 0.022, transparent: true, opacity: 0.95, depthWrite: false })); sand.userData.noDepth = true; sand.frustumCulled = false; g.add(sand);
  const radiusAt = y => 0.05 + 0.5 * Math.pow(Math.sin(Math.min(1, Math.abs(y) / 0.9) * Math.PI / 2), 1.6);
  // f: share of sand still on top (1 -> 0); t: time for the falling stream
  const set = (f, t) => {
    const nTop = Math.floor(NS * 0.86 * f), nStream = 160, topLevel = lerp(0.1, 0.82, Math.sqrt(f)), pile = 0.86 * (1 - f);
    for (let i = 0; i < NS; i++) { const [a, b, c] = seeds[i]; let x, y, z;
      if (i < nTop) { y = lerp(0.08, topLevel, Math.pow(a, 0.8)); const rr = radiusAt(y) * 0.92 * Math.sqrt(b); x = Math.cos(c * 6.283) * rr; z = Math.sin(c * 6.283) * rr; y -= 0.25 * (rr / 0.55) * (1 - y / 1) * 0.3; }
      else if (i < nTop + nStream && f > 0.01 && f < 0.999) { const k = ((a + t * 1.7) % 1); y = lerp(0.04, -0.98 + pile * 0.7, k); x = (b - 0.5) * 0.02; z = (c - 0.5) * 0.02; }
      else { const h = Math.max(0.02, pile * 0.7), yy = -0.98 + h * Math.pow(a, 1.6); const rr = Math.min(radiusAt(yy) * 0.92, (1 - (yy + 0.98) / (h + 0.001)) * 0.55) * Math.sqrt(b); x = Math.cos(c * 6.283) * rr; z = Math.sin(c * 6.283) * rr; y = yy; }
      pos[i * 3] = x; pos[i * 3 + 1] = y; pos[i * 3 + 2] = z; }
    geo.attributes.position.needsUpdate = true; };
  return { group: g, set };
}

// ---------------------------------------------------------------- 3D models: dark sculpture look (keeps the model's normal map, drops its colours)
export async function loadModel(url, { size = 2, color = '#171A21', roughness = 0.45, sheen = null } = {}) {
  const gl = await new GLTFLoader().loadAsync(url); const root = gl.scene; root.updateMatrixWorld(true);
  const meshes = []; root.traverse(o => { if (o.isMesh) meshes.push(o); });
  const geos = meshes.map(m => { const gg = m.geometry.clone(); gg.applyMatrix4(m.matrixWorld); return { gg, src: m.material }; });
  const box = new THREE.Box3(); geos.forEach(({ gg }) => { gg.computeBoundingBox(); box.union(gg.boundingBox); });
  const c = box.getCenter(new THREE.Vector3()), s = size / Math.max(...box.getSize(new THREE.Vector3()).toArray());
  const group = new THREE.Group(), out = [];
  geos.forEach(({ gg, src }) => { gg.translate(-c.x, -c.y, -c.z); gg.scale(s, s, s);
    const mat = new THREE.MeshPhysicalMaterial({ color, roughness, metalness: 0.15, normalMap: src.normalMap || null, normalScale: new THREE.Vector2(1.2, 1.2), aoMap: src.aoMap || null, side: THREE.DoubleSide, ...(sheen ? { sheen: 1, sheenColor: new THREE.Color(sheen), sheenRoughness: 0.4 } : {}) });
    const m = new THREE.Mesh(gg, mat); group.add(m); out.push(m); });
  return { group, meshes: out };
}
// n points spread over a model's surface (for particle versions of the model)
export function surfacePoints(meshes, n, seed = 1) {
  const r = rng(seed), pts = new Float32Array(n * 3), v = new THREE.Vector3(), samplers = meshes.map(m => new MeshSurfaceSampler(m).setRandomGenerator(r).build());
  const areas = meshes.map(m => m.geometry.attributes.position.count); const tot = areas.reduce((a, b) => a + b, 0);
  for (let i = 0; i < n; i++) { let k = r() * tot, j = 0; while (k > areas[j]) k -= areas[j++]; samplers[Math.min(j, samplers.length - 1)].sample(v); pts[i * 3] = v.x; pts[i * 3 + 1] = v.y; pts[i * 3 + 2] = v.z; }
  return pts;
}
// soft round particle sprite
export function dotTexture() { return tex(draw2d(32, 32, g => { const gr = g.createRadialGradient(16, 16, 0, 16, 16, 16); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.35, 'rgba(255,255,255,0.6)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 32, 32); })); }
