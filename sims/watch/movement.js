// The movement's geometry, built from code in millimetres: plate, barrel with its mainspring, the going train,
// the lever escapement, the balance with a breathing hairspring, and on the other side the dial and hands.
// update(pose, look) poses it; look = {opacity: {group: 0..1}, explode: 0..1}.
import * as THREE from 'three';
import {BAL, BETA_DEG, D2R, ESC, PLATE_R, POS, TAU, TRAIN, Z} from './kin.js';

export const GROUPS = ['case', 'dial', 'plate', 'barrel', 'lid', 'train', 'escape', 'fork', 'roller', 'balance'];
// how far each assembly lifts off the plate when exploded (mm at explode = 1)
const LIFT = {barrel: 0, fourth: 3.5, centre: 8, escape: 10.5, fork: 10.5, third: 14, balance: 20, dial: 0, case: 0};

const COL = {brass: '#d9ad55', steel: '#a9afb8', plate: '#aab0ba', ruby: '#d81e4a', blue: '#2f55a8', dial: '#f7f5ef', ink: '#1d2026', case: '#8f959e'};

function gearGeo(z, m, th, o = {}) {
  const rp = (m * z) / 2;
  const ra = rp + m;
  const rf = rp - 1.25 * m;
  const p = TAU / z;
  const s = new THREE.Shape();
  for (let i = 0; i < z; i++) {
    const a = i * p;
    [[rf, a - 0.3 * p], [ra, a - 0.11 * p], [ra, a + 0.11 * p], [rf, a + 0.3 * p]].forEach(([r, an], j) => {
      const x = r * Math.cos(an);
      const y = r * Math.sin(an);
      if (i === 0 && j === 0) s.moveTo(x, y);
      else s.lineTo(x, y);
    });
  }
  s.closePath();
  if (o.spokes) windows(s, o.spokes, o.hub ?? rp * 0.22, rf - (o.rim ?? m * 2.2), o.spokeW ?? rp * 0.09);
  const g = new THREE.ExtrudeGeometry(s, {depth: th, bevelEnabled: false, curveSegments: 10});
  g.translate(0, 0, -th / 2);
  return g;
}
// n windows between a hub and a rim, leaving n spokes of half-width w
function windows(shape, n, r1, r2, w) {
  for (let i = 0; i < n; i++) {
    const a0 = (i / n) * TAU;
    const a1 = ((i + 1) / n) * TAU;
    const d1 = Math.asin(Math.min(0.9, w / r1));
    const d2 = Math.asin(w / r2);
    const h = new THREE.Path();
    h.moveTo(r1 * Math.cos(a0 + d1), r1 * Math.sin(a0 + d1));
    h.absarc(0, 0, r1, a0 + d1, a1 - d1, false);
    h.lineTo(r2 * Math.cos(a1 - d2), r2 * Math.sin(a1 - d2));
    h.absarc(0, 0, r2, a1 - d2, a0 + d2, true);
    h.closePath();
    shape.holes.push(h);
  }
}
const cyl = (r, z0, z1, seg = 24) => {
  const g = new THREE.CylinderGeometry(r, r, z1 - z0, seg);
  g.rotateX(Math.PI / 2);
  g.translate(0, 0, (z0 + z1) / 2);
  return g;
};
const extrude = (shape, th, z = 0) => {
  const g = new THREE.ExtrudeGeometry(shape, {depth: th, bevelEnabled: false, curveSegments: 48});
  g.translate(0, 0, z - th / 2);
  return g;
};
// a flat spiral ribbon standing on edge: 2 vertices per station
function ribbon(n) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 6), 3));
  g.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(n * 6), 3));
  const idx = [];
  for (let i = 0; i < n - 1; i++) idx.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
  g.setIndex(idx);
  return g;
}
function setSpiral(g, n, r0, r1, a0, sweep, z0, z1) {
  const P = g.attributes.position.array;
  const N = g.attributes.normal.array;
  for (let i = 0; i < n; i++) {
    const u = i / (n - 1);
    const a = a0 + sweep * u;
    const r = r0 + (r1 - r0) * u;
    const c = Math.cos(a);
    const s = Math.sin(a);
    P.set([r * c, r * s, z0, r * c, r * s, z1], i * 6);
    N.set([c, s, 0, c, s, 0], i * 6);
  }
  g.attributes.position.needsUpdate = true;
  g.attributes.normal.needsUpdate = true;
  g.computeBoundingSphere();
}

function dialTexture() {
  const S = 1024;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const x = c.getContext('2d');
  const k = S / 2 / PLATE_R; // px per mm
  x.fillStyle = COL.dial;
  x.fillRect(0, 0, S, S);
  x.translate(S / 2, S / 2);
  x.strokeStyle = COL.ink;
  x.fillStyle = COL.ink;
  x.lineCap = 'butt';
  for (let i = 0; i < 60; i++) {
    const a = (i / 60) * TAU;
    const five = i % 5 === 0;
    // the small seconds takes the place of the 6 o'clock index
    if (i >= 28 && i <= 32) continue;
    x.lineWidth = (five ? 0.62 : 0.14) * k;
    x.beginPath();
    x.moveTo(Math.sin(a) * (five ? 13.2 : 16.3) * k, -Math.cos(a) * (five ? 13.2 : 16.3) * k);
    x.lineTo(Math.sin(a) * 17.2 * k, -Math.cos(a) * 17.2 * k);
    x.stroke();
  }
  // small seconds at 6: the fourth arbor comes through here
  x.translate(0, -POS.F[1] * k);
  x.lineWidth = 0.1 * k;
  x.beginPath();
  x.arc(0, 0, 4.6 * k, 0, TAU);
  x.stroke();
  for (let i = 0; i < 60; i++) {
    const a = (i / 60) * TAU;
    const five = i % 5 === 0;
    x.lineWidth = (five ? 0.22 : 0.09) * k;
    x.beginPath();
    x.moveTo(Math.sin(a) * (five ? 3.5 : 4.0) * k, -Math.cos(a) * (five ? 3.5 : 4.0) * k);
    x.lineTo(Math.sin(a) * 4.6 * k, -Math.cos(a) * 4.6 * k);
    x.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

export function buildMovement() {
  const root = new THREE.Group();
  const mats = {};
  const meshes = {};
  for (const g of GROUPS) {
    mats[g] = [];
    meshes[g] = [];
  }
  const mat = (group, color, o = {}) => {
    const m = new THREE.MeshStandardMaterial({color, metalness: o.metal ?? 0.85, roughness: o.rough ?? 0.5, envMapIntensity: o.env ?? 0.7, side: o.side ?? THREE.FrontSide, map: o.map ?? null});
    m.userData.base = o.alpha ?? 1;
    mats[group].push(m);
    return m;
  };
  const put = (group, parent, geo, material, shadow = true) => {
    const m = new THREE.Mesh(geo, material);
    m.castShadow = shadow;
    m.receiveShadow = true;
    m.userData.cast = shadow;
    meshes[group].push(m);
    parent.add(m);
    return m;
  };
  // an assembly: a group at a plan position that turns about z and lifts when exploded
  const asm = {};
  const assembly = (name, pos, lift) => {
    const lifter = new THREE.Group();
    lifter.position.set(pos[0], pos[1], 0);
    const spin = new THREE.Group();
    lifter.add(spin);
    root.add(lifter);
    asm[name] = {lifter, spin, lift};
    return spin;
  };

  // ------------------------------------------------------------ main plate and its jewels
  const M = {
    plate: mat('plate', COL.plate, {metal: 0.6, rough: 0.62, env: 0.5}),
  };
  put('plate', root, cyl(PLATE_R, -0.7, 0, 96), M.plate, false);

  // ------------------------------------------------------------ barrel: toothed drum, mainspring inside, lid on top
  {
    const g = assembly('barrel', POS.B, LIFT.barrel);
    const brass = mat('barrel', '#b88a3a', {rough: 0.5});
    const spring = mat('barrel', COL.blue, {metal: 0.7, rough: 0.4, side: THREE.DoubleSide});
    const steel = mat('barrel', COL.steel, {rough: 0.42});
    const lidM = mat('lid', '#b88a3a', {rough: 0.5});
    const {z, m} = TRAIN.barrel;
    put('barrel', g, gearGeo(z, m, 0.38), brass).position.z = Z.barrelGear;
    const wall = new THREE.LatheGeometry([[1.3, 0.3], [7.25, 0.3], [7.25, 2.7], [6.85, 2.7], [6.85, 0.62], [1.3, 0.62]].map(([r, y]) => new THREE.Vector2(r, y)), 96);
    wall.rotateX(Math.PI / 2);
    put('barrel', g, wall, brass);
    put('barrel', g, cyl(1.25, 0.1, 3.0, 32), steel);
    const sg = ribbon(520);
    setSpiral(sg, 520, 1.3, 6.75, 0.4, TAU * 11, 0.7, 2.6);
    put('barrel', g, sg, spring, false);
    const lid = new THREE.Shape();
    lid.absarc(0, 0, 7.25, 0, TAU, false);
    const hole = new THREE.Path();
    hole.absarc(0, 0, 1.25, 0, TAU, true);
    lid.holes.push(hole);
    put('lid', g, extrude(lid, 0.15, 2.78), lidM);
  }

  // ------------------------------------------------------------ going train
  const wheel = (name, group, pos, lift, w, zW, p, zP, arbor, o = {}) => {
    const g = assembly(name, pos, lift);
    const brass = mat(group, o.color ?? COL.brass, {rough: 0.46});
    const steel = mat(group, COL.steel, {rough: 0.4});
    if (w) put(group, g, gearGeo(w.z, w.m, o.th ?? 0.22, {spokes: o.spokes ?? 5, rim: o.rim, hub: o.hub, spokeW: o.spokeW}), brass).position.z = zW;
    if (p) put(group, g, gearGeo(p.z, p.m, 0.5), steel).position.z = zP;
    put(group, g, cyl(arbor[0], arbor[1], arbor[2], 16), steel);
    return g;
  };
  wheel('centre', 'train', POS.C, LIFT.centre, TRAIN.centre, Z.centre, TRAIN.centrePinion, Z.barrelGear + 0.05, [0.3, -2.3, 3.5]);
  wheel('third', 'train', POS.T, LIFT.third, TRAIN.third, Z.third, TRAIN.thirdPinion, Z.centre, [0.17, 1.2, 4.3]);
  wheel('fourth', 'train', POS.F, LIFT.fourth, TRAIN.fourth, Z.fourth, TRAIN.fourthPinion, Z.third, [0.15, -2.0, 4.3]);

  // ------------------------------------------------------------ escape wheel: 15 club teeth leaning into the turn
  {
    const g = assembly('escape', POS.E, LIFT.escape);
    const steel = mat('escape', '#7d8794', {rough: 0.36});
    const wheelM = mat('escape', '#e7b84f', {rough: 0.4});
    const s = new THREE.Shape();
    for (let i = 0; i < ESC.z; i++) {
      const a = (i / ESC.z) * TAU;
      [[ESC.rRoot, a + 2 * D2R], [ESC.rTip, a], [ESC.rTip, a + 3 * D2R], [ESC.rRoot, a + 13 * D2R]].forEach(([r, an], j) => {
        if (i === 0 && j === 0) s.moveTo(r * Math.cos(an), r * Math.sin(an));
        else s.lineTo(r * Math.cos(an), r * Math.sin(an));
      });
    }
    s.closePath();
    windows(s, 3, 0.5, 1.5, 0.16);
    put('escape', g, extrude(s, 0.2, Z.escape), wheelM);
    put('escape', g, gearGeo(TRAIN.escapePinion.z, TRAIN.escapePinion.m, 0.5), steel).position.z = Z.fourth;
    put('escape', g, cyl(0.13, 1.8, 3.9, 12), steel);
  }

  // ------------------------------------------------------------ pallet fork: anchor, lever, two ruby pallets
  {
    const g = assembly('fork', POS.P, LIFT.fork);
    const steel = mat('fork', '#59626f', {rough: 0.42});
    const ruby = mat('fork', COL.ruby, {metal: 0.1, rough: 0.2, env: 1.1});
    // local frame: +x points at the balance, the escape wheel's centre is at (-rTip / cos 30, 0)
    const body = new THREE.Group();
    body.rotation.z = BETA_DEG * D2R;
    g.add(body);
    const s = new THREE.Shape();
    const pts = [[0.3, -0.25], [-0.25, -1.45], [-0.7, -1.4], [-0.3, -0.35], [-0.3, 0.35], [-0.7, 1.4], [-0.25, 1.45], [0.3, 0.25], [2.0, 0.16], [2.2, 0.45], [2.9, 0.45], [2.9, 0.17], [2.35, 0.17], [2.35, -0.17], [2.9, -0.17], [2.9, -0.45], [2.2, -0.45], [2.0, -0.16]];
    pts.forEach(([x, y], i) => (i ? s.lineTo(x, y) : s.moveTo(x, y)));
    s.closePath();
    put('fork', body, extrude(s, 0.15, Z.fork), steel);
    put('fork', body, cyl(0.13, 2.7, 3.9, 12), steel);
    const ex = -ESC.rTip / Math.cos(30 * D2R);
    for (const sgn of [1, -1]) {
      const a = sgn * 30 * D2R;
      const r = ESC.rTip - 0.03 + 0.35;
      const st = put('fork', body, new THREE.BoxGeometry(0.7, ESC.stoneHalfW * 2, 0.36), ruby);
      st.position.set(ex + r * Math.cos(a), r * Math.sin(a), Z.escape + 0.03);
      st.rotation.z = a;
    }
  }

  // ------------------------------------------------------------ balance wheel, roller with its impulse pin, hairspring
  let hair;
  const HN = 360;
  {
    const g = assembly('balance', POS.BAL, LIFT.balance);
    const gold = mat('balance', '#d2a640', {rough: 0.4});
    const steel = mat('balance', COL.steel, {rough: 0.4});
    const steelR = mat('roller', '#c9a03c', {rough: 0.42});
    const ruby = mat('roller', COL.ruby, {metal: 0.1, rough: 0.2, env: 1.1});
    const blue = mat('balance', COL.blue, {metal: 0.7, rough: 0.35, side: THREE.DoubleSide});
    const s = new THREE.Shape();
    s.absarc(0, 0, BAL.R, 0, TAU, false);
    windows(s, 2, 0.55, 4.95, 0.3);
    put('balance', g, extrude(s, 0.5, Z.balance), gold);
    put('roller', g, cyl(0.17, 2.9, 6.3, 12), steelR);
    put('roller', g, cyl(0.95, Z.roller - 0.1, Z.roller + 0.1, 32), steelR);
    // the impulse pin points at the fork when the balance is at rest
    const pin = put('roller', g, cyl(0.12, 3.1, Z.roller, 12), ruby);
    const pa = (BETA_DEG + 180) * D2R;
    pin.position.set(BAL.pinR * Math.cos(pa), BAL.pinR * Math.sin(pa), 0);
    // the hairspring: its outer end is pinned to the plate, so it hangs on the lifter and not on the spinning group
    hair = put('balance', asm.balance.lifter, ribbon(HN), blue, false);
    put('balance', g, cyl(0.6, Z.spring - 0.05, Z.spring + 0.45, 20), steel);
    const stud = put('balance', asm.balance.lifter, cyl(0.16, Z.spring - 0.1, Z.spring + 0.7, 10), steel);
    stud.position.set(3.25 * Math.cos(2.2), 3.25 * Math.sin(2.2), 0);
  }

  // ------------------------------------------------------------ the other side: dial, hands, case ring, crown
  const dialG = new THREE.Group();
  const caseG = new THREE.Group();
  root.add(dialG, caseG);
  const hands = {};
  {
    const face = mat('dial', '#ffffff', {metal: 0, rough: 0.8, env: 0.3, map: dialTexture()});
    const edge = mat('dial', '#e6e2d8', {metal: 0, rough: 0.8, env: 0.3});
    const ink = mat('dial', COL.ink, {metal: 0.3, rough: 0.5});
    const red = mat('dial', COL.ruby, {metal: 0.2, rough: 0.45});
    put('dial', dialG, cyl(PLATE_R + 0.1, -1.15, -0.85, 96), edge, false);
    const f = put('dial', dialG, new THREE.CircleGeometry(PLATE_R + 0.1, 96), face, false);
    f.rotation.y = Math.PI;
    f.position.z = -1.16;
    const hand = (len, w, tail, z, m, pos = [0, 0]) => {
      const s = new THREE.Shape();
      s.moveTo(-w / 2, -tail);
      s.lineTo(w / 2, -tail);
      s.lineTo(w * 0.28, len);
      s.lineTo(-w * 0.28, len);
      s.closePath();
      const h = put('dial', dialG, extrude(s, 0.12, z), m);
      h.position.set(pos[0], pos[1], 0);
      const cap = put('dial', dialG, cyl(w * 0.9, z - 0.12, z + 0.1, 20), m);
      cap.position.set(pos[0], pos[1], 0);
      return h;
    };
    hands.hour = hand(8.6, 1.5, 1.6, -1.55, ink);
    hands.min = hand(13.8, 1.1, 1.8, -1.85, ink);
    hands.sec = hand(3.9, 0.36, 1.0, -1.5, red, POS.F);
  }
  {
    const steel = mat('case', COL.case, {metal: 0.9, rough: 0.34, env: 0.9});
    const ring = new THREE.LatheGeometry([[18.5, -3.4], [20.6, -3.4], [21.4, -2.6], [21.4, 0.2], [20.4, 0.9], [18.5, 0.9]].map(([r, y]) => new THREE.Vector2(r, y)), 128);
    ring.rotateX(Math.PI / 2);
    put('case', caseG, ring, steel);
    const lugs = new THREE.Group();
    caseG.add(lugs);
    // the crown at 3 o'clock on the dial side, which is -x seen from the movement side
    const crown = new THREE.CylinderGeometry(1.9, 1.9, 2.4, 28);
    crown.rotateZ(Math.PI / 2);
    put('case', caseG, crown, steel).position.set(-23.2, 0, -1.2);
    const stem = new THREE.CylinderGeometry(0.7, 0.7, 1.2, 12);
    stem.rotateZ(Math.PI / 2);
    put('case', caseG, stem, steel).position.set(-21.7, 0, -1.2);
  }

  const applied = {};
  const setOpacity = (group, o) => {
    if (applied[group] === o) return;
    applied[group] = o;
    for (const m of mats[group]) {
      m.opacity = o;
      if (m.transparent !== o < 0.995) m.needsUpdate = true;
      m.transparent = o < 0.995;
      m.depthWrite = o > 0.55;
    }
    for (const m of meshes[group]) {
      m.visible = o > 0.012;
      m.castShadow = m.userData.cast && o > 0.55;
      m.renderOrder = o < 0.995 ? 5 : 0;
    }
  };

  const update = (p, look = {}) => {
    const e = look.explode ?? 0;
    for (const k in asm) asm[k].lifter.position.z = asm[k].lift * e;
    dialG.position.z = LIFT.dial * e;
    caseG.position.z = LIFT.case * e;
    asm.barrel.spin.rotation.z = p.barrel;
    asm.centre.spin.rotation.z = p.centre;
    asm.third.spin.rotation.z = p.third;
    asm.fourth.spin.rotation.z = p.fourth;
    asm.escape.spin.rotation.z = p.escape;
    asm.fork.spin.rotation.z = p.fork;
    asm.balance.spin.rotation.z = p.bal;
    // the hairspring winds and unwinds: the stud end stays, the collet end turns with the balance
    setSpiral(hair.geometry, HN, 3.25, 0.6, 2.2, -(BAL.springTurns * TAU - p.bal), Z.spring, Z.spring + 0.4);
    hands.hour.rotation.z = p.hands.hour;
    hands.min.rotation.z = p.hands.min;
    hands.sec.rotation.z = p.hands.sec;
    const op = look.opacity ?? {};
    for (const g of GROUPS) setOpacity(g, op[g] ?? 1);
  };

  // where a part is in the world right now, for the labels
  const anchor = (name, dx = 0, dy = 0, z = 0) => {
    const a = name === 'dial' ? {lifter: dialG} : asm[name];
    const base = name === 'dial' ? [0, 0] : [a.lifter.position.x, a.lifter.position.y];
    return new THREE.Vector3(base[0] + dx, base[1] + dy, z + a.lifter.position.z);
  };
  const ghosts = () => GROUPS.flatMap((g) => ((applied[g] ?? 1) < 0.995 ? meshes[g] : []));
  return {root, update, anchor, asm, ghosts};
}
