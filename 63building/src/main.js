// Procedural building-assembly animation. Everything is a pure function of the frame number:
// window.setFrame(n) poses the whole scene for frame n and renders it once.
import * as THREE from 'three';

const qs = new URLSearchParams(location.search);
const cfg = await (await fetch(qs.get('config') || '/config.json')).json();
const W = +(qs.get('w') || cfg.video.width), H = +(qs.get('h') || cfg.video.height);
const FPS = cfg.video.fps, DUR = cfg.video.duration;
const B = cfg.building, F = cfg.foundation, C = cfg.colors;

// ---------- small math helpers ----------
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a, b, k) => a + (b - a) * k;
const smooth = k => { k = clamp(k); return k * k * (3 - 2 * k); };
const easeOutCubic = k => 1 - Math.pow(1 - clamp(k), 3);
const easeInCubic = k => Math.pow(clamp(k), 3);
const easeInOut = k => { k = clamp(k); return k < .5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2; };
const easeOutBack = (k, s = 1.4) => { k = clamp(k) - 1; return 1 + (s + 1) * k * k * k + s * k * k; };
function rng(seed) { let a = seed >>> 0; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
// Monotone cubic interpolation through (xs, ys): smooth and never overshoots.
function monotone(xs, ys) {
  const n = xs.length, d = [], m = new Array(n);
  for (let i = 0; i < n - 1; i++) d.push((ys[i + 1] - ys[i]) / (xs[i + 1] - xs[i]));
  m[0] = d[0]; m[n - 1] = d[n - 2];
  for (let i = 1; i < n - 1; i++) m[i] = d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2;
  for (let i = 0; i < n - 1; i++) {
    if (d[i] === 0) { m[i] = m[i + 1] = 0; continue; }
    const a = m[i] / d[i], b = m[i + 1] / d[i], s = a * a + b * b;
    if (s > 9) { const q = 3 / Math.sqrt(s); m[i] = q * a * d[i]; m[i + 1] = q * b * d[i]; }
  }
  return x => {
    x = clamp(x, xs[0], xs[n - 1]);
    let i = 0; while (i < n - 2 && x > xs[i + 1]) i++;
    const h = xs[i + 1] - xs[i], k = (x - xs[i]) / h, k2 = k * k, k3 = k2 * k;
    return (2 * k3 - 3 * k2 + 1) * ys[i] + (k3 - 2 * k2 + k) * h * m[i] + (-2 * k3 + 3 * k2) * ys[i + 1] + (k3 - k2) * h * m[i + 1];
  };
}
// Catmull-Rom style interpolation of keyframes (continuous velocity, no cuts).
function keyTrack(ts, vs) {
  const n = ts.length, m = vs.map((_, i) => {
    const a = Math.max(0, i - 1), b = Math.min(n - 1, i + 1);
    return (i === 0 || i === n - 1) ? 0 : (vs[b] - vs[a]) / (ts[b] - ts[a]);
  });
  return t => {
    t = clamp(t, ts[0], ts[n - 1]);
    let i = 0; while (i < n - 2 && t > ts[i + 1]) i++;
    const h = ts[i + 1] - ts[i], k = (t - ts[i]) / h, k2 = k * k, k3 = k2 * k;
    return (2 * k3 - 3 * k2 + 1) * vs[i] + (k3 - 2 * k2 + k) * h * m[i] + (-2 * k3 + 3 * k2) * vs[i + 1] + (k3 - k2) * h * m[i + 1];
  };
}

// ---------- building dimensions ----------
const N = B.floors;
const ROOF = B.height - B.crownHeight;          // top of the last floor
const FH = ROOF / N;                             // floor-to-floor height
const pT = B.profile.map(p => p.t * ROOF);
const widthX = monotone(pT, B.profile.map(p => p.x));
const widthZ = monotone(pT, B.profile.map(p => p.z));
const hx = y => widthX(y) / 2, hz = y => widthZ(y) / 2;
const CX = B.core.x / 2, CZ = B.core.z / 2;
const PX = F.pit.x / 2, PZ = F.pit.z / 2, BD = B.basementDepth, RD = F.rockDepth;

// ---------- phases ----------
const PH = Object.fromEntries(cfg.phases.map(p => [p.id, p]));
const HOOK_END = PH.hook.end;
const at = (id, frac) => PH[id].start + (PH[id].end - PH[id].start) * frac;
const steelT = f => at('steel', 0.02) + (f / N) * (at('steel', 0.9) - at('steel', 0.02));   // start of story f
const STEEL_STORY = 0.95;

// ---------- renderer / scene ----------
const stage = document.getElementById('stage');
stage.style.width = W + 'px'; stage.style.height = H + 'px';
const ui = document.getElementById('ui');
ui.style.transform = `scale(${W / 1080})`;
const renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('c'), antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(W, H, false);
renderer.domElement.style.width = W + 'px'; renderer.domElement.style.height = H + 'px';
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(cfg.camera.fov, W / H, 5, 40000);
// shift the picture up a little: the free area between the top bar and the caption sits above centre
camera.setViewOffset(W, H, 0, Math.round(H * (cfg.camera.shiftY || 0)), W, H);

// sky (also the reflection environment)
const skyU = {
  top: { value: new THREE.Color() }, hor: { value: new THREE.Color() }, gnd: { value: new THREE.Color() },
  sunDir: { value: new THREE.Vector3(0, 1, 0) }, sunCol: { value: new THREE.Color() }, glow: { value: 0 }
};
const skyMat = new THREE.ShaderMaterial({
  side: THREE.BackSide, depthWrite: false, fog: false, uniforms: skyU,
  vertexShader: `varying vec3 d; void main(){ d = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
  fragmentShader: `varying vec3 d; uniform vec3 top, hor, gnd, sunDir, sunCol; uniform float glow;
    void main(){ vec3 n = normalize(d); float h = n.y;
      vec3 c = mix(hor, top, pow(clamp(h,0.0,1.0), 0.55));
      c = mix(c, gnd, smoothstep(0.0, -0.08, h));
      float s = max(dot(n, normalize(sunDir)), 0.0);
      c += sunCol * (pow(s, 6.0) * 0.35 * glow + pow(s, 60.0) * 0.9 * glow + smoothstep(0.9993, 0.9997, s) * 6.0);
      gl_FragColor = vec4(c, 1.0); }`
});
const sky = new THREE.Mesh(new THREE.SphereGeometry(15000, 32, 16), skyMat); sky.frustumCulled = false; scene.add(sky);
const skyScene = new THREE.Scene(); skyScene.add(new THREE.Mesh(new THREE.SphereGeometry(100, 32, 16), skyMat));
const pmrem = new THREE.PMREMGenerator(renderer); let envRT = null, envMix = -1;
scene.fog = new THREE.Fog(0xffffff, 2500, 11000);

const sun = new THREE.DirectionalLight(0xffffff, 2.5); sun.castShadow = true;
sun.shadow.mapSize.set(4096, 4096); sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.6; sun.shadow.radius = 3;
Object.assign(sun.shadow.camera, { left: -520, right: 520, top: 520, bottom: -520, near: 100, far: 2600 });
scene.add(sun, sun.target); sun.target.position.set(0, 80, 0);
const hemi = new THREE.HemisphereLight(0xffffff, 0xb8b2a4, 0.55); scene.add(hemi);

// ---------- materials ----------
const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0, ...o });
function glassTexture() {
  const c = document.createElement('canvas'); c.width = 256; c.height = 128; const g = c.getContext('2d');
  g.fillStyle = '#fff'; g.fillRect(0, 0, 256, 128);
  g.fillStyle = '#cfcfcf'; g.fillRect(0, 100, 256, 28);              // spandrel band
  g.fillStyle = '#777'; for (let i = 0; i <= 4; i++) g.fillRect(i * 64 - 2, 0, 4, 128); // mullions
  g.fillRect(0, 0, 256, 4); g.fillRect(0, 124, 256, 4);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}
const M = {
  glass: new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 1, roughness: 0.13, map: glassTexture(), envMapIntensity: 1.6 }),
  steel: std(0xffffff, { roughness: 0.6, metalness: 0.15 }),
  conc: std(0xffffff, { roughness: 0.92 }),
  soil: std(C.soil), rock: std(C.rock), ground: std(C.ground), park: std(C.park),
  soilGlass: std('#b89c66', { transparent: true, opacity: 0.5, depthWrite: false }),
  water: std(C.water, { roughness: 0.25, metalness: 0.1, envMapIntensity: 0.9 }),
  bank: std('#c3c7bd'), road: std('#aeb1b2'),
  crane: std(C.crane, { roughness: 0.6 }), dark: std('#4b5058'),
  nb: std(0xffffff, { roughness: 0.9 })
};

// ---------- instanced part system ----------
const unitBox = new THREE.BoxGeometry(1, 1, 1);
const unitCyl = new THREE.CylinderGeometry(0.5, 0.5, 1, 20);
const parts = [];
const batches = {};
function batch(name, geo, mat, max) {
  const mesh = new THREE.InstancedMesh(geo, mat, max);
  mesh.count = 0; mesh.castShadow = mesh.receiveShadow = true; mesh.frustumCulled = false;
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  scene.add(mesh); return (batches[name] = { mesh, n: 0 });
}
batch('steel', unitBox, M.steel, 6000);
batch('conc', unitBox, M.conc, 900);
batch('cyl', unitCyl, M.conc, 200);
batch('glass', unitBox, M.glass, 1300);
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const ZERO = V(0, 0, 0), YAX = V(0, 1, 0);
/** Register one part. o: {pos, quat, scale, color, tIn, dur, from, ex, grow, noHook, back} */
function part(bname, o) {
  const b = batches[bname], p = {
    b, i: b.n++, pos: o.pos, quat: o.quat || new THREE.Quaternion(), scale: o.scale,
    color: new THREE.Color(o.color), tIn: o.tIn, dur: o.dur ?? 0.5, from: o.from || ZERO, ex: o.ex || ZERO,
    grow: !!o.grow, noHook: !!o.noHook, back: o.back ?? 1.4, state: -1, flash: -1
  };
  b.mesh.count = b.n; b.mesh.setColorAt(p.i, p.color); parts.push(p); return p;
}
const boxPart = (bname, x0, x1, y0, y1, z0, z1, o) =>
  part(bname, { pos: V((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2), scale: V(x1 - x0, y1 - y0, z1 - z0), ...o });
function member(bname, a, b, thick, o) {              // a bar from point a to point b
  const d = b.clone().sub(a), len = d.length();
  return part(bname, { pos: a.clone().add(b).multiplyScalar(0.5), quat: new THREE.Quaternion().setFromUnitVectors(YAX, d.normalize()), scale: V(thick, len, thick), ...o });
}
const R = rng(63);
const shade = (hex, amt) => { const c = new THREE.Color(hex); const k = 1 + (R() - 0.5) * amt; return c.multiplyScalar(k); };

// ----- foundation piers -----
{
  const [nx, nz] = F.pierGrid, t0 = at('foundation', 0.44), t1 = at('foundation', 0.82);
  for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
    const x = lerp(-PX + 6, PX - 6, i / (nx - 1)), z = lerp(-PZ + 6, PZ - 6, j / (nz - 1));
    const order = (i + (nz - 1 - j) * 0.35) / (nx - 1 + (nz - 1) * 0.35);
    part('cyl', { pos: V(x, -(RD + BD) / 2, z), scale: V(F.pierDiameter, RD - BD, F.pierDiameter), color: shade(C.concrete, 0.08),
      tIn: lerp(t0, t1, order), dur: 0.55, from: V(0, RD + 40, 0), back: 0.9, noHook: true });
  }
}
// ----- mat foundation + basement levels -----
{
  const bh = BD / B.basements;
  boxPart('conc', -PX, PX, -BD, -BD + 1.6, -PZ, PZ, { color: C.concrete, tIn: at('foundation', 0.86), dur: 0.6, from: V(0, 70, 0), noHook: true });
  const t0 = at('basement', 0.02), t1 = at('basement', 0.40);
  for (let l = 0; l < B.basements; l++) {
    const y0 = -BD + l * bh + (l === 0 ? 1.6 : 0.3), y1 = -BD + (l + 1) * bh - 0.3, tl = lerp(t0, t1, l / B.basements), w = 1.4;
    const wo = { color: shade(C.concrete, 0.05), dur: 0.5, noHook: true };
    boxPart('conc', -PX, -PX + w, y0, y1, -PZ, PZ, { ...wo, tIn: tl, from: V(-60, 0, 0) });
    boxPart('conc', PX - w, PX, y0, y1, -PZ, PZ, { ...wo, tIn: tl + 0.12, from: V(60, 0, 0) });
    boxPart('conc', -PX + w, PX - w, y0, y1, -PZ, -PZ + w, { ...wo, tIn: tl + 0.24, from: V(0, 0, -60) });
    for (let i = 0; i < 6; i++) for (let j = 0; j < 3; j++) {
      const x = lerp(-PX + 9, PX - 9, i / 5), z = lerp(-PZ + 9, PZ - 9, j / 2);
      boxPart('conc', x - 0.7, x + 0.7, y0, y1, z - 0.7, z + 0.7, { ...wo, tIn: tl + 0.3 + i * 0.03 + R() * 0.1, dur: 0.4, from: V(0, 30, 0) });
    }
    if (l < B.basements - 1)   // intermediate basement slab
      boxPart('conc', -PX + w, PX - w, y1, y1 + 0.6, -PZ + w, PZ, { color: C.slab, tIn: tl + 0.62, dur: 0.55, from: V(0, 45, 0), noHook: true });
  }
  // ground-floor slab / plaza: closes the basement
  boxPart('conc', -PX, PX, -0.3, 0.3, -PZ, PZ, { color: C.slab, tIn: at('basement', 0.42), dur: 0.6, from: V(0, 50, 0) });
}
// ----- core -----
const coreSegs = [];
{
  const per = B.core.floorsPerSegment, n = Math.ceil(N / per), pre = Math.min(n, Math.round(n * 0.27));
  for (let s = 0; s < n; s++) {
    const y0 = s * per * FH, y1 = Math.min(ROOF, (s + 1) * per * FH);
    const tIn = s < pre ? lerp(at('basement', 0.5), at('basement', 0.95), s / pre) : steelT(s * per) - 1.4;
    coreSegs.push({ y0, y1, tIn, dur: 0.5 });
    boxPart('conc', -CX, CX, y0, y1 - 0.12, -CZ, CZ, { color: shade(C.concrete, 0.06), tIn, dur: 0.5, from: V(0, 34, 0), ex: V(0, y0 * 0.35, 0), back: 1.1 });
  }
}
// ----- steel frame -----
{
  const inset = 1.3, col = 0.95, beam = 0.7;
  const fx = y => hx(y) - inset, fz = y => hz(y) - inset;
  const exv = p => V(p.x * 0.32, p.y * 0.35, p.z * 0.32 + Math.sign(p.z) * 9);
  for (let f = 0; f < N; f++) {
    const y0 = f * FH, y1 = (f + 1) * FH, tf = steelT(f);
    const cols = [], beams = [];
    const addCol = (x0, z0, x1, z1) => cols.push([V(x0, y0, z0), V(x1, y1, z1)]);
    for (let i = 0; i <= B.baysX; i++) {
      const k = i / B.baysX * 2 - 1;
      for (const s of [-1, 1]) {
        addCol(k * fx(y0), s * fz(y0), k * fx(y1), s * fz(y1));
        const x = k * fx(y1), zEdge = s * fz(y1);
        if (Math.abs(x) <= CX) beams.push([V(x, y1, s * CZ), V(x, y1, zEdge), V(0, 0, s)]);
        const span = fz(y1) - CZ;
        if (span > 13 && i % 2 === 0) { const m0 = s * (CZ + (fz(y0) - CZ) / 2), m1 = s * (CZ + span / 2); addCol(k * fx(y0), m0, k * fx(y1), m1); }
      }
    }
    for (let j = 1; j < B.baysZ; j++) {
      const k = j / B.baysZ * 2 - 1;
      for (const s of [-1, 1]) {
        addCol(s * fx(y0), k * fz(y0), s * fx(y1), k * fz(y1));
        if (Math.abs(k * fz(y1)) <= CZ) beams.push([V(s * CX, y1, k * fz(y1)), V(s * fx(y1), y1, k * fz(y1)), V(s, 0, 0)]);
      }
    }
    for (const s of [-1, 1]) {   // perimeter ring + girders along the core
      beams.push([V(-fx(y1), y1, s * fz(y1)), V(fx(y1), y1, s * fz(y1)), V(0, 0, s)]);
      beams.push([V(s * fx(y1), y1, -fz(y1)), V(s * fx(y1), y1, fz(y1)), V(s, 0, 0)]);
      beams.push([V(-fx(y1), y1, s * CZ), V(fx(y1), y1, s * CZ), V(0, 0, s)]);
    }
    for (const [a, b] of cols) {
      const mid = a.clone().add(b).multiplyScalar(0.5);
      member('steel', a, b, col, { color: shade(C.steel, 0.1), tIn: tf + R() * 0.3, dur: 0.42, from: V(0, 24, 0), ex: exv(mid) });
    }
    for (const [a, b, n] of beams) {
      const mid = a.clone().add(b).multiplyScalar(0.5); mid.y -= beam / 2; a.y -= beam / 2; b.y -= beam / 2;
      member('steel', a, b, beam, { color: shade(C.steel, 0.1), tIn: tf + 0.3 + R() * 0.25, dur: 0.42, from: V(n.x * 30, 7, n.z * 30), ex: exv(mid) });
    }
  }
}
// ----- floor slabs -----
const slabT = f => lerp(at('envelope', 0.02), at('envelope', 0.44), (f - 1) / (N - 1));
for (let f = 1; f <= N; f++) {
  const y = f * FH;
  boxPart('conc', -hx(y) + 2, hx(y) - 2, y - 0.1, y + 0.35, -hz(y) + 2, hz(y) - 2,
    { color: shade(C.slab, 0.04), tIn: slabT(f), dur: 0.5, grow: true, ex: V(0, y * 0.35, 0) });
}
// ----- curtain wall -----
const glassT = f => lerp(at('envelope', 0.34), at('envelope', 0.93), f / (N - 1));
const GLASS_DUR = 0.5;
{
  const basis = new THREE.Matrix4();
  const panel = (bot, top, u, w, thick, o) => {
    const v = top.clone().sub(bot), len = v.length(); v.normalize();
    const n = u.clone().cross(v).normalize(), uu = v.clone().cross(n).normalize();
    basis.makeBasis(uu, v, n);
    const mid = bot.clone().add(top).multiplyScalar(0.5);
    return part('glass', { pos: mid, quat: new THREE.Quaternion().setFromRotationMatrix(basis), scale: V(w, len, thick),
      from: n.clone().multiplyScalar(38), ex: n.clone().multiplyScalar(48).add(V(0, mid.y * 0.35, 0)), dur: GLASS_DUR, back: 1.2, ...o });
  };
  for (let f = 0; f < N; f++) {
    const y0 = f * FH, y1 = (f + 1) * FH, tf = glassT(f), gx = B.glassPanelsX, gz = B.glassPanelsZ;
    const gcol = () => shade(C.glass, 0.12);
    for (const s of [-1, 1]) {
      for (let i = 0; i < gx; i++) {            // long (curved) faces
        const k = (i + 0.5) / gx * 2 - 1;
        panel(V(k * hx(y0), y0, s * hz(y0)), V(k * hx(y1), y1, s * hz(y1)), V(s, 0, 0), (hx(y0) + hx(y1)) / gx, 0.5,
          { color: gcol(), tIn: tf + (s > 0 ? i : gx - 1 - i) / gx * 0.25 + R() * 0.06 });
      }
      for (let j = 0; j < gz; j++) {            // short faces
        const k = (j + 0.5) / gz * 2 - 1;
        panel(V(s * hx(y0), y0, k * hz(y0)), V(s * hx(y1), y1, k * hz(y1)), V(0, 0, -s), (hz(y0) + hz(y1)) / gz, 0.5,
          { color: gcol(), tIn: tf + 0.12 + j * 0.06 + R() * 0.06 });
      }
    }
  }
  // observation-deck band on the top story (brighter glass ring)
  const yb = (N - 0.5) * FH, tb = at('finish', 0.2), bc = '#fff3cf';
  for (const s of [-1, 1]) {
    panel(V(0, yb - 0.9, s * (hz(yb) + 0.25)), V(0, yb + 0.9, s * (hz(yb) + 0.25)), V(s, 0, 0), hx(yb) * 2 + 1, 0.5, { color: bc, tIn: tb + (s + 1) * 0.1 });
    panel(V(s * (hx(yb) + 0.25), yb - 0.9, 0), V(s * (hx(yb) + 0.25), yb + 0.9, 0), V(0, 0, -s), hz(yb) * 2 + 1, 0.5, { color: bc, tIn: tb + 0.1 + (s + 1) * 0.1 });
  }
}
// ----- roof crown & equipment -----
{
  const tx = hx(ROOF), tz = hz(ROOF), cx = tx * 0.82, cz = tz * 0.66, ch = B.crownHeight;
  const ex = V(0, ROOF * 0.35 + 34, 0), o = (tIn, from) => ({ color: shade('#bfb9aa', 0.03), tIn, dur: 0.6, from, ex });
  boxPart('conc', -10, 10, ROOF + 0.35, ROOF + ch * 0.62, -cz, cz, o(at('finish', 0.04), V(0, 40, 0)));
  for (const s of [-1, 1]) for (const k of [-1, 1])
    boxPart('conc', s * (tx - 4.5) - 1.6, s * (tx - 4.5) + 1.6, ROOF + 0.35, ROOF + 2.8, k * tz * 0.45 - 2, k * tz * 0.45 + 2,
      { color: '#8f959c', tIn: at('finish', 0.1) + R() * 0.3, dur: 0.5, from: V(0, 30, 0), ex });
  boxPart('conc', -cx, -10, ROOF + 0.35, ROOF + ch * 0.62, -cz, cz, o(at('finish', 0.66), V(-45, 12, 0)));
  boxPart('conc', 10, cx, ROOF + 0.35, ROOF + ch * 0.62, -cz, cz, o(at('finish', 0.70), V(45, 12, 0)));
  boxPart('conc', -cx * 0.72, cx * 0.72, ROOF + ch * 0.62, ROOF + ch, -cz * 0.75, cz * 0.75, o(at('finish', 0.78), V(0, 45, 0)));
  part('cyl', { pos: V(0, ROOF + ch + 0.15, 0), scale: V(cz * 1.2, 0.3, cz * 1.2), color: '#e8e4d8', tIn: at('finish', 0.86), dur: 0.5, from: V(0, 30, 0), ex });
}

// ---------- terrain ----------
const gbox = (x0, x1, y0, y1, z0, z1, mat, parent = scene, shadow = true) => {
  const m = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0), mat);
  m.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2); m.castShadow = false; m.receiveShadow = shadow; parent.add(m); return m;
};
const HOLE = { x: 80, z0: -64, z1: 124, d: 72 };
const ISL = { cx: -820, cz: 350, rx: 1450, rz: 520 };
const inIsland = (x, z, k = 1) => Math.pow(Math.abs(x - ISL.cx) / (ISL.rx * k), 2.6) + Math.pow(Math.abs(z - ISL.cz) / (ISL.rz * k), 2.6) < 1;
let frontBlock, pitFill;
{
  const sh = new THREE.Shape();
  for (let i = 0; i <= 96; i++) {
    const a = i / 96 * Math.PI * 2, c = Math.cos(a), s = Math.sin(a), e = 2 / 2.6;
    const x = ISL.cx + ISL.rx * Math.sign(c) * Math.pow(Math.abs(c), e), z = ISL.cz + ISL.rz * Math.sign(s) * Math.pow(Math.abs(s), e);
    i ? sh.lineTo(x, -z) : sh.moveTo(x, -z);
  }
  const hole = new THREE.Path();
  hole.moveTo(-HOLE.x, -HOLE.z0); hole.lineTo(-HOLE.x, -HOLE.z1); hole.lineTo(HOLE.x, -HOLE.z1); hole.lineTo(HOLE.x, -HOLE.z0); hole.closePath();
  sh.holes.push(hole);
  const geo = new THREE.ExtrudeGeometry(sh, { depth: HOLE.d, bevelEnabled: false, curveSegments: 4 });
  geo.rotateX(-Math.PI / 2); geo.translate(0, -HOLE.d, 0);
  const island = new THREE.Mesh(geo, [M.ground, M.soil]); island.receiveShadow = true; scene.add(island);

  const wsh = new THREE.Shape(); wsh.moveTo(-20000, -20000); wsh.lineTo(20000, -20000); wsh.lineTo(20000, 20000); wsh.lineTo(-20000, 20000); wsh.closePath();
  wsh.holes.push(hole);   // no water inside the site cut-out
  const water = new THREE.Mesh(new THREE.ShapeGeometry(wsh), M.water); water.rotation.x = -Math.PI / 2; water.position.y = -6; water.receiveShadow = true; scene.add(water);
  gbox(-20000, 20000, -40, 0, -9000, -1180, M.bank); gbox(-20000, 20000, -40, 0, 940, 9000, M.bank);
  // park strip + avenue + bridges (very simplified Yeouido)
  gbox(-1150, -900, 0, 0.6, -60, 760, M.park);
  gbox(-2100, 380, 0, 0.4, 330, 372, M.road); gbox(-160, -130, 0, 0.4, -150, 800, M.road);
  for (const x of [330, -1010, -1900]) { gbox(x - 14, x + 14, 6, 9, -1200, -120, M.road); for (let z = -1100; z < -200; z += 150) gbox(x - 8, x + 8, -8, 6, z - 5, z + 5, M.bank); }

  // site block that stays: soil around the pit, rock below, translucent soil under the pit
  const Z0 = HOLE.z0, HXs = HOLE.x;
  gbox(-HXs, HXs, -HOLE.d, -RD, Z0, PZ, M.rock);
  for (const [x0, x1, z0, z1] of [[-HXs, -PX, Z0, PZ], [PX, HXs, Z0, PZ], [-PX, PX, Z0, -PZ]]) {
    gbox(x0, x1, -RD, -1, z0, z1, M.soil); gbox(x0, x1, -1, 0, z0, z1, M.ground);
  }
  const ug = gbox(-PX, PX, -RD, -BD, -PZ, PZ, M.soilGlass, scene, false); ug.renderOrder = 5;
  // soil that gets excavated (scaled down from the top)
  const fg = new THREE.BoxGeometry(PX * 2, BD, PZ * 2); fg.translate(0, BD / 2, 0);
  pitFill = new THREE.Mesh(fg, [M.soil, M.soil, M.ground, M.soil, M.soil, M.soil]); pitFill.position.y = -BD; pitFill.receiveShadow = true; scene.add(pitFill);
  // front block: slides down to open the section, comes back later
  frontBlock = new THREE.Group(); scene.add(frontBlock);
  gbox(-HXs, HXs, -HOLE.d, -RD, PZ, HOLE.z1, M.rock, frontBlock);
  gbox(-HXs, HXs, -RD, -1, PZ, HOLE.z1, M.soil, frontBlock);
  gbox(-HXs, HXs, -1, 0, PZ, HOLE.z1, M.ground, frontBlock);

  // neighbours: low-saturation boxes
  const rn = rng(7), nb = new THREE.InstancedMesh(unitBox, M.nb, 900), m4 = new THREE.Matrix4(), col = new THREE.Color(); let n = 0;
  const put = (x, z, w, d, h) => {
    m4.compose(V(x, h / 2, z), new THREE.Quaternion(), V(w, h, d)); nb.setMatrixAt(n, m4);
    col.setHSL(0.05 + rn() * 0.55, 0.03 + rn() * 0.07, 0.74 + rn() * 0.12); nb.setColorAt(n++, col);
  };
  for (let tries = 0; n < 420 && tries < 20000; tries++) {
    const x = ISL.cx + (rn() * 2 - 1) * ISL.rx, z = ISL.cz + (rn() * 2 - 1) * ISL.rz;
    if (!inIsland(x, z, 0.93)) continue;
    const dist = Math.hypot(x, z);
    if (Math.abs(x) < 150 && z > -120 && z < 200) continue;
    if (dist < 230) continue;
    if (z > 90 && z < 560 && x > 0.15 * z - 150 && x < 0.95 * z + 150) continue;   // keep the camera's view of the section clear
    if (x > -1175 && x < -875) continue;                                              // park
    if (Math.abs(z - 351) < 40 || Math.abs(x + 145) < 40) continue;                    // roads
    const w = 26 + rn() * 46, d = 26 + rn() * 46;
    const h = dist < 450 ? 12 + rn() * 26 : (dist > 1300 && rn() < 0.14 ? 90 + rn() * 70 : 14 + rn() * (dist < 1100 ? 34 : 55));
    put(x, z, w, d, h);
  }
  for (let i = 0; i < 450; i++) {
    const north = rn() < 0.55, x = -5200 + rn() * 9000, z = north ? -1260 - rn() * 2600 : 1010 + rn() * 2200;
    put(x, z, 40 + rn() * 80, 40 + rn() * 80, 12 + rn() * (rn() < 0.1 ? 130 : 50));
  }
  nb.count = n; nb.castShadow = nb.receiveShadow = true; nb.frustumCulled = false; scene.add(nb);
}

// ---------- tower cranes ----------
const cranes = [];
for (const s of [-1, 1]) {
  const g = new THREE.Group(), mastH = 30, top = new THREE.Group();
  const mk = (geo, mat, x, y, z, parent) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; parent.add(m); return m; };
  const mastG = new THREE.BoxGeometry(2.4, mastH, 2.4); mastG.translate(0, mastH / 2, 0);
  const mast = mk(mastG, M.crane, 0, 0, 0, g);
  top.position.y = mastH; g.add(top);
  mk(new THREE.BoxGeometry(46, 1.5, 1.5), M.crane, 15, 3, 0, top);          // jib + counter-jib
  mk(new THREE.BoxGeometry(1.2, 9, 1.2), M.crane, 0, 5, 0, top);            // tower head
  mk(new THREE.BoxGeometry(5, 3, 3.4), M.dark, -6, 1.4, 0, top);            // counterweight
  mk(new THREE.BoxGeometry(2.6, 2.6, 2.6), M.conc.clone(), 1.6, 1.2, 2.2, top).material.color.set('#e9eef2'); // cab
  mk(new THREE.BoxGeometry(0.25, 13, 0.25), M.dark, 27, -4, 0, top);        // hoist line
  mk(new THREE.BoxGeometry(1.4, 1.4, 1.4), M.dark, 27, -11, 0, top);        // hook block
  g.position.set(s * (CX - 7), 0, 0); scene.add(g);
  cranes.push({ g, mast, top, s });
}
const craneIn = at('basement', 0.46), craneOut = at('finish', 0.34);
function buildTop(t) {
  let y = 0.3;
  for (const c of coreSegs) if (t > c.tIn) y = Math.max(y, c.y0 + (c.y1 - c.y0) * easeOutCubic((t - c.tIn) / c.dur));
  return Math.min(ROOF, y);
}

// ---------- overlay ----------
const $ = id => document.getElementById(id);
$('ttl').textContent = cfg.title;
const TL = cfg.timeline, tlFrac = d => clamp((d - TL.from) / (TL.to - TL.from));
const tickEls = TL.milestones.map(m => {
  const e = document.createElement('div'); e.className = 'tick'; e.innerHTML = m.label.split(' ').map(x => `<div>${x}</div>`).join(''); e.style.left = (tlFrac(m.at) * 100) + '%';
  $('ticks').appendChild(e); return e;
});
const labelEls = (cfg.labels || []).map(l => { const e = document.createElement('div'); e.className = 'lbl'; e.textContent = l.text; $('labels').appendChild(e); return e; });
const fade = (t, a, b, f = 0.35) => clamp((t - a) / f) * clamp((b - t) / f);
let capId = null;
function overlay(t) {
  const ph = cfg.phases.find(p => t < p.end) || cfg.phases.at(-1);
  // timeline
  const date = lerp(ph.date[0], ph.date[1], clamp((t - ph.start) / (ph.end - ph.start)));
  const fr = ph.id === 'hook' ? 0 : tlFrac(date);
  $('fill').style.width = (fr * 100) + '%'; $('knob').style.left = (fr * 100) + '%';
  $('year').textContent = ph.id === 'hook' ? `${Math.floor(TL.milestones[0].at)}–${Math.floor(TL.milestones.at(-1).at)}` : Math.floor(date + 1e-6) + '년';
  TL.milestones.forEach((m, i) => tickEls[i].classList.toggle('on', ph.id !== 'hook' && date >= m.at - 1e-6));
  // captions
  const a = fade(t, ph.start + 0.1, ph.end - 0.05);
  const isStep = !!ph.step;
  $('cap').style.opacity = isStep ? a : 0; $('cap').style.transform = `translateY(${(1 - smooth(clamp((t - ph.start - 0.1) / 0.45))) * 26}px)`;
  if (isStep && capId !== ph.id) { capId = ph.id; $('step').textContent = ph.step; $('ctitle').textContent = ph.title; $('cdesc').textContent = ph.desc; }
  $('hook').style.opacity = ph.hook ? fade(t, 0.25, ph.end - 0.2, 0.4) : 0; if (ph.hook) $('hook').textContent = ph.hook;
  const ea = ph.stats ? clamp((t - ph.start - 0.3) / 0.5) : 0; $('end').style.opacity = ea;
  if (ph.stats && !$('stats').childElementCount) {
    $('etitle').textContent = ph.endingTitle || '';
    ph.stats.forEach(s => { const d = document.createElement('div'); d.className = 'stat'; d.innerHTML = `<b></b><span></span>`; d.children[0].textContent = s.value; d.children[1].textContent = s.label; $('stats').appendChild(d); });
  }
  [...$('stats').children].forEach((d, i) => { const k = easeOutBack(clamp((t - ph.start - 0.5 - i * 0.25) / 0.45)); d.style.transform = `scale(${0.6 + 0.4 * k})`; d.style.opacity = clamp((t - ph.start - 0.5 - i * 0.25) / 0.25); });
  // floor counter
  let cn = null, cl = '';
  if (ph.id === 'steel') { cl = '철골'; cn = 0; for (let f = 0; f < N; f++) if (t >= steelT(f) + STEEL_STORY) cn++; }
  else if (ph.id === 'envelope') { cl = '커튼월'; cn = 0; for (let f = 0; f < N; f++) if (t >= glassT(f) + GLASS_DUR + 0.3) cn++; }
  $('counter').style.opacity = cn === null ? 0 : fade(t, ph.start + 0.2, ph.end - 0.05);
  if (cn !== null) { $('clab').textContent = cl; $('cnum').innerHTML = `${cn}<small> / ${N}층</small>`; }
  // 3D anchored labels
  (cfg.labels || []).forEach((l, i) => {
    const e = labelEls[i], o = fade(t, l.from, l.to);
    e.style.opacity = o; if (o <= 0) return;
    const p = V(...l.pos).project(camera), x = (p.x * 0.5 + 0.5) * 1080, y = (-p.y * 0.5 + 0.5) * 1920;
    e.style.transform = `translate(${x}px, ${y - 46}px) translate(-50%, -100%)`;
  });
}

// ---------- per-frame pose ----------
const CK = cfg.camera.keys, ct = CK.map(k => k.t);
const cam = {
  tx: keyTrack(ct, CK.map(k => k.target[0])), ty: keyTrack(ct, CK.map(k => k.target[1])), tz: keyTrack(ct, CK.map(k => k.target[2])),
  az: keyTrack(ct, CK.map(k => k.az)), el: keyTrack(ct, CK.map(k => k.el)), dist: keyTrack(ct, CK.map(k => k.dist))
};
const m4 = new THREE.Matrix4(), tp = V(0, 0, 0), ts = V(0, 0, 0), tc = new THREE.Color(), WHITE = new THREE.Color(1, 1, 1);
const L = cfg.light, cA = new THREE.Color(), cB = new THREE.Color();
const mixCol = (a, b, k) => cA.set(a).lerp(cB.set(b), k);

function poseParts(t) {
  const hook = t < HOOK_END;
  const exK = easeInOut((t - 0.55) / 2.1), van = clamp((t - (HOOK_END - 1.45)) / 1.1);
  for (const p of parts) {
    let state, sc = 1, flash = 0;
    if (hook) {
      if (p.noHook) state = 0;
      else { state = 1; tp.copy(p.pos).addScaledVector(p.ex, exK + van * 0.5); sc = 1 - easeInCubic(van); ts.copy(p.scale).multiplyScalar(Math.max(sc, 1e-4)); }
    } else {
      const k = (t - p.tIn) / p.dur;
      if (k <= 0) state = 0;
      else if (k >= 1.6) state = 2;
      else {
        state = 1; const e = easeOutBack(k, p.back);
        flash = clamp((k - 0.55) / 0.3) * clamp((1.6 - k) / 0.55);
        if (p.grow) { tp.copy(p.pos); ts.set(p.scale.x * e, p.scale.y, p.scale.z * e); }
        else { tp.copy(p.pos).addScaledVector(p.from, 1 - e); ts.copy(p.scale).multiplyScalar(0.55 + 0.45 * clamp(k * 2.5)); }
      }
    }
    if (state === 0) { if (p.state !== 0) { m4.makeScale(0, 0, 0); p.b.mesh.setMatrixAt(p.i, m4); p.b.dirty = true; } }
    else if (state === 2) { if (p.state !== 2) { m4.compose(p.pos, p.quat, p.scale); p.b.mesh.setMatrixAt(p.i, m4); p.b.dirty = true; } }
    else { m4.compose(tp, p.quat, ts); p.b.mesh.setMatrixAt(p.i, m4); p.b.dirty = true; }
    if (flash !== p.flash) { tc.copy(p.color).lerp(WHITE, flash * 0.55); p.b.mesh.setColorAt(p.i, tc); p.b.cdirty = true; p.flash = flash; }
    p.state = state;
  }
  for (const b of Object.values(batches)) {
    if (b.dirty) { b.mesh.instanceMatrix.needsUpdate = true; b.dirty = false; }
    if (b.cdirty) { b.mesh.instanceColor.needsUpdate = true; b.cdirty = false; }
  }
}

function pose(t) {
  poseParts(t);
  // ground section: open during foundation/basement, closed again when steel starts
  const open = easeInOut((t - (PH.foundation.start - 0.6)) / 1.5) * (1 - easeInOut((t - (PH.steel.start - 0.6)) / 1.8));
  frontBlock.position.y = -(HOLE.d - 8) * open;
  const dig = t < HOOK_END ? 0 : easeInOut((t - at('foundation', 0.2)) / (at('foundation', 0.42) - at('foundation', 0.2)));
  pitFill.scale.y = Math.max(1e-4, 1 - dig); pitFill.visible = dig < 0.999;
  // cranes
  const topY = buildTop(t);
  cranes.forEach((c, i) => {
    const kin = easeOutBack(clamp((t - craneIn - i * 0.25) / 0.6), 1.0), kout = clamp((t - craneOut - i * 0.5) / 2.2);
    c.g.visible = t >= HOOK_END && t > craneIn + i * 0.25 && kout < 1;
    c.g.position.y = topY + (1 - kin) * 60;
    c.top.rotation.y = (c.s > 0 ? 0.3 : Math.PI - 0.3) + Math.sin(t * 0.8 + i * 2.1) * 0.9 + t * 0.15 * c.s;
    const j = easeInOut(kout / 0.5), m = easeInOut((kout - 0.45) / 0.55);
    c.top.position.y = 30 * (1 - m) + j * 26; c.top.scale.setScalar(Math.max(1e-3, 1 - easeInCubic(kout / 0.55)));
    c.mast.scale.y = Math.max(1e-3, 1 - m);
  });
  // light + sky
  const k = smooth((t - L.sunsetFrom) / (L.sunsetTo - L.sunsetFrom));
  const d = V(...L.day.dir).lerp(V(...L.sunset.dir), k).normalize();
  sun.position.copy(sun.target.position).addScaledVector(d, 1300);
  sun.color.copy(mixCol(L.day.color, L.sunset.color, k)); sun.intensity = lerp(L.day.intensity, L.sunset.intensity, k);
  skyU.sunDir.value.copy(d); skyU.sunCol.value.copy(mixCol('#fff1d0', '#ff8a3c', k)); skyU.glow.value = lerp(0.5, 2.2, k);
  skyU.top.value.copy(mixCol('#6fa8dc', '#6f86c4', k)); skyU.hor.value.copy(mixCol('#dcebf5', '#ffd3a6', k)); skyU.gnd.value.copy(mixCol('#c9c6ba', '#c9ab94', k));
  scene.fog.color.copy(skyU.hor.value);
  hemi.color.copy(mixCol('#eaf2ff', '#ffd2b0', k)); hemi.intensity = lerp(0.55, 0.7, k); renderer.toneMappingExposure = lerp(1.0, 1.18, k);
  const q = Math.round(k * 200);
  if (q !== envMix) { envMix = q; const old = envRT; envRT = pmrem.fromScene(skyScene, 0, 1, 500); scene.environment = envRT.texture; old && old.dispose(); }
  // camera
  const az = cam.az(t) * Math.PI / 180, el = cam.el(t) * Math.PI / 180, dist = cam.dist(t);
  const tg = V(cam.tx(t), cam.ty(t), cam.tz(t));
  camera.position.set(tg.x + dist * Math.sin(az) * Math.cos(el), tg.y + dist * Math.sin(el), tg.z + dist * Math.cos(az) * Math.cos(el));
  camera.lookAt(tg); camera.updateMatrixWorld();
  overlay(t);
}

window.TOTAL_FRAMES = Math.round(DUR * FPS);
window.setFrame = n => { pose(n / FPS); renderer.render(scene, camera); };
window.setTime = t => { pose(t); renderer.render(scene, camera); };
await document.fonts.load('900 40px KR', '63빌딩은 가'); await document.fonts.load('700 40px KR', '63빌딩은 가→'); await document.fonts.ready;
window.setFrame(+(qs.get('frame') || 0));
window.READY = true;
if (qs.has('play')) { let n = +(qs.get('frame') || 0); const loop = () => { window.setFrame(n = (n + 1) % window.TOTAL_FRAMES); requestAnimationFrame(loop); }; loop(); }
