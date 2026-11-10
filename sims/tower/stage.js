// The tower and its studio, built from code in metres: 101 floor plates with their glass, 8 mega-columns, the core,
// 11 outrigger and belt truss levels, the spire, the damper ball on its cables, the mat and its 380 piles down into
// the bedrock, the wind as streaks and force arrows. frame(state, cam) bends everything by the first mode's shape
// (model.phi) and draws one frame.
import * as THREE from 'three';
import {dphi, P, phi} from './model.js';

const V3 = THREE.Vector3;
export const COL = {
  bg: '#e8ecef',
  ground: '#dfe4e6',
  grid: '#c7cfd4',
  glass: '#8fb9b4',
  slab: '#cfd8db',
  core: '#8a96a1',
  col: '#69747f',
  truss: '#2f3a44',
  steel: '#3d4852',
  gold: '#d6a13c',
  accent: '#e3462a',
  cool: '#3f7fc0',
  pile: '#9aa3a9',
  rock: '#a8957f',
  wind: '#4f86ad',
};

// ------------------------------------------------------------ the floors: bottom, height, width
export const FLOORS = [];
{
  let y = 0;
  for (let n = 1; n <= 101; n++) {
    let h;
    let w;
    if (n <= 26) {
      h = 4.35;
      w = 63 - 16 * ((y + h / 2) / 113.1); // the lower pyramid tapers in
    } else if (n <= 90) {
      h = 4.2;
      w = 46 + (((n - 27) % 8) + 0.5) * (8.3 / 8); // 8 modules of 8 floors, each flaring out 7 degrees
    } else {
      h = 5.1;
      w = 40 - (n - 91) * 1.8;
    }
    FLOORS.push({n, y, h, w});
    y += h;
  }
}
export const floorY = (n) => FLOORS[n - 1].y;
export const widthAt = (y) => (FLOORS.find((f) => y < f.y + f.h) || FLOORS[100]).w;
export const OUTRIGGERS = [9, 19, 27, 34, 42, 50, 58, 66, 74, 82, 90];
export const COLS = [[22, 11], [22, -11], [-22, 11], [-22, -11], [11, 22], [11, -22], [-11, 22], [-11, -22]];
// the damper: hung from floor 92, the ball's centre in floor 89, its dashpots on floor 87's slab
export const TMD_Y = {top: floorY(92), ball: floorY(89) + 1.0, floor: floorY(88) + 0.3};
export const BALL_R = 2.75;

const GROUND_VERT = /* glsl */ `varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`;
const GROUND_FRAG = /* glsl */ `uniform vec3 uG; uniform vec3 uL; uniform vec3 uBg; uniform vec3 uAcc; uniform float uA; uniform float uQ; varying vec3 vW;
  void main(){
    vec2 g = abs(fract(vW.xz / 50.0 + 0.5) - 0.5) * 50.0;
    float line = 1.0 - smoothstep(0.0, 1.4, min(g.x, g.y));
    float d = length(vW.xz);
    vec3 col = mix(uG, uL, line * 0.7 * (1.0 - smoothstep(300.0, 900.0, d)));
    // the earthquake: rings running out from the foundation
    float q = 0.0;
    if (uQ >= 0.0) {
      for (int i = 0; i < 6; i++) {
        float r = 110.0 * (uQ - float(i) * 1.6);
        if (r > 0.0) q = max(q, (1.0 - smoothstep(0.0, 9.0, abs(d - r))) * (1.0 - smoothstep(200.0, 700.0, r)));
      }
    }
    col = mix(col, uAcc, q * 0.75);
    float fade = smoothstep(700.0, 1500.0, d);
    gl_FragColor = vec4(mix(col, uBg, fade), mix(uA, 1.0, fade * 0.0) * (1.0 - fade) + fade * uA);
  }`;

export function createTowerStage({canvas}) {
  const renderer = new THREE.WebGLRenderer({canvas, antialias: true, preserveDrawingBuffer: true, powerPreference: 'high-performance'});
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.localClippingEnabled = true;
  renderer.setClearColor(COL.bg, 1);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(COL.bg);
  const camera = new THREE.PerspectiveCamera(26, 16 / 9, 2, 9000);

  const SUN_DIR = new V3(-0.42, 0.78, 0.46).normalize();
  const sun = new THREE.DirectionalLight('#fff7ec', 2.4);
  sun.castShadow = true;
  Object.assign(sun.shadow.camera, {left: -460, right: 460, top: 460, bottom: -460, near: 10, far: 2400});
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.6;
  sun.position.copy(SUN_DIR).multiplyScalar(1200).add(new V3(0, 200, 0));
  sun.target.position.set(0, 200, 0);
  scene.add(sun, sun.target);
  scene.add(new THREE.HemisphereLight('#ffffff', '#c9d1d6', 1.25));
  const fill = new THREE.DirectionalLight('#dfe9f2', 0.7);
  fill.position.set(0.6, 0.3, 0.7);
  scene.add(fill);

  // ------------------------------------------------------------ ground, shadow catcher, bedrock, the town
  const groundMat = new THREE.ShaderMaterial({
    vertexShader: GROUND_VERT,
    fragmentShader: GROUND_FRAG,
    uniforms: {uG: {value: new THREE.Color(COL.ground)}, uL: {value: new THREE.Color(COL.grid)}, uBg: {value: new THREE.Color(COL.bg)}, uAcc: {value: new THREE.Color(COL.accent)}, uA: {value: 1}, uQ: {value: -1}},
    transparent: true,
    toneMapped: false,
    side: THREE.DoubleSide,
  });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(4000, 4000), groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.renderOrder = 1;
  scene.add(ground);
  const shadeMat = new THREE.ShadowMaterial({color: '#48535c', opacity: 0.26, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -8});
  const shade = new THREE.Mesh(new THREE.PlaneGeometry(4000, 4000), shadeMat);
  shade.rotation.x = -Math.PI / 2;
  shade.receiveShadow = true;
  shade.renderOrder = 2;
  scene.add(shade);
  const rockMat = new THREE.MeshLambertMaterial({color: COL.rock, transparent: true, opacity: 0.42, depthWrite: false});
  const rock = new THREE.Mesh(new THREE.BoxGeometry(520, 46, 520), rockMat);
  rock.position.y = -48 - 23;
  rock.renderOrder = 0.5;
  scene.add(rock);

  const lambert = (color, o = {}) => new THREE.MeshLambertMaterial({color, ...o});
  const unitBox = new THREE.BoxGeometry(1, 1, 1);
  const mat4 = (p, s, q) => new THREE.Matrix4().compose(new V3(...p), q || new THREE.Quaternion(), new V3(...s));
  const XAXIS = new V3(1, 0, 0);
  /** a box member from a to b, t thick */
  const beam = (a, b, t) => {
    const A = new V3(...a);
    const B = new V3(...b);
    const d = B.clone().sub(A);
    const q = new THREE.Quaternion().setFromUnitVectors(XAXIS, d.clone().normalize());
    return {m: new THREE.Matrix4().compose(A.clone().add(B).multiplyScalar(0.5), q, new V3(d.length(), t, t)), yc: (a[1] + b[1]) / 2};
  };
  const box = (p, s) => ({m: mat4(p, s), yc: p[1]});

  // the town around it, for scale
  {
    let seed = 20;
    const r = () => {
      seed = (seed * 16807) % 2147483647;
      return seed / 2147483647;
    };
    const items = [];
    for (let i = 0; i < 56; i++) {
      const a = r() * Math.PI * 2;
      const d = 140 + r() * 250;
      const w = 22 + r() * 34;
      const h = 8 + r() * r() * 46;
      items.push(mat4([Math.cos(a) * d, h / 2, Math.sin(a) * d], [w, h, 22 + r() * 34]));
    }
    var town = new THREE.InstancedMesh(unitBox, lambert('#d3dade'), items.length);
    items.forEach((m, i) => town.setMatrixAt(i, m));
    town.castShadow = true;
    scene.add(town);
  }

  // ------------------------------------------------------------ everything that bends with the tower
  const tower = new THREE.Group();
  scene.add(tower);
  const bent = [];
  const tmpB = new THREE.Matrix4();
  const tmpM = new THREE.Matrix4();
  const inst = (geo, mat, items, shadow = true) => {
    const mesh = new THREE.InstancedMesh(geo, mat, items.length);
    mesh.frustumCulled = false;
    mesh.castShadow = shadow;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    tower.add(mesh);
    bent.push({mesh, items});
    return mesh;
  };
  const clip = new THREE.Plane(new V3(0, 0, -1), 0);
  const glassMat = new THREE.MeshStandardMaterial({color: COL.glass, roughness: 0.42, metalness: 0, transparent: true, side: THREE.DoubleSide});
  const slabMat = new THREE.MeshStandardMaterial({color: COL.slab, roughness: 0.8, metalness: 0, transparent: true});
  const skin = inst(unitBox, glassMat, FLOORS.map((f) => box([0, f.y + f.h / 2 + 0.2, 0], [f.w, f.h - 0.5, f.w])));
  const voidFloor = (n) => n >= 89 && n <= 92;
  const slabs = inst(unitBox, slabMat, FLOORS.filter((f) => !voidFloor(f.n)).map((f) => box([0, f.y, 0], [f.w + 0.7, 0.55, f.w + 0.7])));
  skin.renderOrder = 5;
  slabs.renderOrder = 4;

  const colMat = lambert('#ffffff');
  const colItems = [];
  for (const f of FLOORS.filter((x) => x.n <= 90)) for (const [x, z] of COLS) colItems.push(box([x, f.y + f.h / 2, z], Math.abs(x) > 20 ? [2.4, f.h + 0.02, 3.0] : [3.0, f.h + 0.02, 2.4]));
  const megacols = inst(unitBox, colMat, colItems);
  const colBase = new THREE.Color(COL.col);
  const colHot = new THREE.Color(COL.accent);
  const colCool = new THREE.Color(COL.cool);
  const tmpC = new THREE.Color();
  megacols.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(colItems.length * 3), 3);

  const coreItems = [];
  const GRID = [-11.25, -3.75, 3.75, 11.25];
  for (const f of FLOORS) {
    const y = f.y + f.h / 2;
    if (f.n <= 87) for (const x of GRID) for (const z of GRID) coreItems.push(box([x, y, z], [1.3, f.h + 0.02, 1.3]));
    else if (f.n <= 92) {
      for (const x of GRID) for (const z of GRID) if (Math.abs(x) > 10 || Math.abs(z) > 10) coreItems.push(box([x, y, z], [1.0, f.h + 0.02, 1.0]));
    } else for (const x of [-6, 6]) for (const z of [-6, 6]) coreItems.push(box([x, y, z], [1.0, f.h + 0.02, 1.0]));
  }
  // the core's bracing: a ring of beams on every floor
  for (const f of FLOORS.filter((x) => x.n <= 87)) {
    const y = f.y + f.h - 0.5;
    for (const s of [-11.25, 11.25]) {
      coreItems.push(beam([-11.25, y, s], [11.25, y, s], 0.6), beam([s, y, -11.25], [s, y, 11.25], 0.6));
    }
  }
  inst(unitBox, lambert(COL.core), coreItems);

  const trussItems = [];
  for (const n of OUTRIGGERS) {
    const f = FLOORS[n - 1];
    const y0 = f.y + 0.4;
    const y1 = f.y + f.h * 2 - 0.4; // two storeys deep
    for (const [x, z] of COLS) {
      const alongX = Math.abs(x) > 20;
      const a = alongX ? [Math.sign(x) * 11.25, 0, z > 0 ? 11.25 : -11.25] : [x > 0 ? 11.25 : -11.25, 0, Math.sign(z) * 11.25];
      const b = [x, 0, z];
      trussItems.push(beam([a[0], y0, a[2]], [b[0], y0, b[2]], 1.0), beam([a[0], y1, a[2]], [b[0], y1, b[2]], 1.0), beam([a[0], y0, a[2]], [b[0], y1, b[2]], 0.9), beam([a[0], y1, a[2]], [b[0], y0, b[2]], 0.9));
    }
    // the belt: a ring through the mega-columns
    for (const y of [y0, y1]) for (const s of [-22, 22]) trussItems.push(beam([-22, y, s], [22, y, s], 0.9), beam([s, y, -22], [s, y, 22], 0.9));
  }
  inst(unitBox, lambert(COL.truss), trussItems);

  // the spire
  const spireItems = [];
  for (let i = 0; i < 10; i++) {
    const y = P.roof + i * 7;
    const w = 7 - i * 0.62;
    spireItems.push(box([0, y + 3.5, 0], [w, 7.02, w]));
  }
  inst(unitBox, lambert('#aab4bb'), spireItems);

  // ------------------------------------------------------------ the damper
  const tmd = new THREE.Group();
  scene.add(tmd);
  const ball = new THREE.Group();
  tmd.add(ball);
  {
    const s = new THREE.Mesh(new THREE.SphereGeometry(BALL_R, 48, 32), new THREE.MeshStandardMaterial({color: COL.gold, roughness: 0.45, metalness: 0}));
    s.castShadow = true;
    ball.add(s);
    // the ball is 41 stacked steel plates: mark the seams
    const seam = lambert('#a87a22');
    for (let i = -4; i <= 4; i++) {
      const y = i * 0.55;
      const r = Math.sqrt(BALL_R * BALL_R - y * y) + 0.01;
      const t = new THREE.Mesh(new THREE.TorusGeometry(r, 0.035, 6, 64), seam);
      t.rotation.x = Math.PI / 2;
      t.position.y = y;
      ball.add(t);
    }
    const cradle = new THREE.Mesh(new THREE.TorusGeometry(BALL_R * 0.93, 0.22, 10, 48), lambert(COL.steel));
    cradle.rotation.x = Math.PI / 2;
    cradle.position.y = -1.0;
    ball.add(cradle);
  }
  const unitCyl = new THREE.CylinderGeometry(1, 1, 1, 12);
  const YAXIS = new V3(0, 1, 0);
  const strut = (mat, r) => {
    const m = new THREE.Mesh(unitCyl, mat);
    m.userData.r = r;
    tmd.add(m);
    return m;
  };
  const tA = new V3();
  const tB = new V3();
  const tD = new V3();
  const place = (m, a, b) => {
    tD.copy(b).sub(a);
    const len = tD.length();
    m.position.copy(a).addScaledVector(tD, 0.5);
    m.quaternion.setFromUnitVectors(YAXIS, tD.multiplyScalar(1 / len));
    m.scale.set(m.userData.r, len, m.userData.r);
  };
  const cableMat = lambert('#2b333a');
  const CABLES = [];
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) for (const k of [-0.45, 0.45]) CABLES.push({m: strut(cableMat, 0.13), top: new V3(sx * 3.0 + k, TMD_Y.top, sz * 3.0 - k), at: new V3(sx * 1.75 + k * 0.5, -1.0, sz * 1.75 - k * 0.5)});
  const rodMat = lambert('#c9d0d5');
  const sleeveMat = lambert(COL.accent);
  const DASH = [];
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
    DASH.push({rod: strut(rodMat, 0.14), sleeve: strut(sleeveMat, 0.34), foot: new V3(Math.cos(a) * 8.2, TMD_Y.floor, Math.sin(a) * 8.2), at: new V3(Math.cos(a) * 1.9, -2.0, Math.sin(a) * 1.9)});
  }
  // the bumper ring under the ball and the frame it stands on
  {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.75, 0.3, 10, 48), lambert(COL.steel));
    ring.rotation.x = Math.PI / 2;
    ring.position.y = TMD_Y.ball - BALL_R - 1.5;
    tmd.add(ring);
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.6, TMD_Y.ball - BALL_R - 1.5 - TMD_Y.floor, 16), lambert(COL.steel));
    post.position.y = (TMD_Y.ball - BALL_R - 1.5 + TMD_Y.floor) / 2;
    tmd.add(post);
    // the pin under the ball that rides inside the ring
    const pin = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 1.8, 16), lambert(COL.steel));
    pin.position.y = -BALL_R - 0.8;
    ball.add(pin);
  }

  // ------------------------------------------------------------ the foundation
  const under = new THREE.Group();
  scene.add(under);
  {
    const matSlab = new THREE.Mesh(new THREE.BoxGeometry(92, 4.5, 92), lambert('#b4bcc1'));
    matSlab.position.y = -2.3;
    under.add(matSlab);
    const geo = new THREE.CylinderGeometry(0.75, 0.75, 75.5, 10);
    const piles = new THREE.InstancedMesh(geo, lambert(COL.pile), 380);
    let i = 0;
    for (let a = 0; a < 20; a++) for (let b = 0; b < 19; b++) piles.setMatrixAt(i++, mat4([(a - 9.5) * 4.5, -4.5 - 37.75, (b - 9) * 4.7], [1, 1, 1]));
    under.add(piles);
  }

  // ------------------------------------------------------------ the wind
  const N_STREAK = 300;
  const streakMat = new THREE.MeshBasicMaterial({color: COL.wind, transparent: true, opacity: 0.5, depthWrite: false});
  const streaks = new THREE.InstancedMesh(unitBox, streakMat, N_STREAK);
  streaks.frustumCulled = false;
  streaks.renderOrder = 6;
  scene.add(streaks);
  const SEED = [];
  {
    let seed = 7;
    const r = () => {
      seed = (seed * 16807) % 2147483647;
      return seed / 2147483647;
    };
    for (let i = 0; i < N_STREAK; i++) SEED.push([r() * 760, 15 + r() * 500, -190 + r() * 380, 0.6 + r() * 0.8]);
  }
  const arrowMat = new THREE.MeshBasicMaterial({color: COL.accent, transparent: true});
  const ARROWS = [];
  {
    const head = new THREE.ConeGeometry(4.2, 11, 14);
    head.rotateZ(-Math.PI / 2);
    for (let i = 0; i < 9; i++) {
      const y = 40 + i * 48;
      const shaft = new THREE.Mesh(unitBox, arrowMat);
      const tip = new THREE.Mesh(head, arrowMat);
      scene.add(shaft, tip);
      ARROWS.push({y, shaft, tip});
    }
  }

  const size = {w: 1600, h: 900};
  const resize = (w, h, pr) => {
    size.w = w;
    size.h = h;
    renderer.setPixelRatio(pr);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };

  let sectionOn = null;
  /**
   * st: {U roof sway in metres as drawn, rel ball offset from its floor (m), v wind m/s, windX metres the air has
   * moved, skin 0..1 glass opacity, section bool, ground 0..1, streaks 0..1, arrows 0..1, tint[8] -1..1 per
   * mega-column, quake seconds since it began or -1}
   * cam: {tx, ty, tz, az, el, d, sx, sy} in metres and radians
   */
  const frame = (st, cam) => {
    const U = st.U;
    for (const {mesh, items} of bent) {
      for (let i = 0; i < items.length; i++) {
        const {m, yc} = items[i];
        const u = U * phi(yc);
        const s = U * dphi(yc);
        tmpB.set(1, s, 0, u - s * yc, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1);
        mesh.setMatrixAt(i, tmpM.multiplyMatrices(tmpB, m));
      }
      mesh.instanceMatrix.needsUpdate = true;
    }
    // glass and slabs: solid, ghosted, or cut along the wind
    if (sectionOn !== st.section) {
      sectionOn = st.section;
      for (const m of [glassMat, slabMat]) {
        m.clippingPlanes = st.section ? [clip] : [];
        m.needsUpdate = true;
      }
    }
    glassMat.opacity = st.skin;
    glassMat.depthWrite = st.skin > 0.95;
    slabMat.opacity = 0.16 + 0.84 * st.skin;
    slabMat.depthWrite = st.skin > 0.95;
    skin.castShadow = st.skin > 0.5;
    for (let i = 0; i < megacols.count; i++) {
      const k = st.tint[i % 8];
      tmpC.copy(colBase).lerp(k > 0 ? colHot : colCool, Math.min(1, Math.abs(k)));
      megacols.setColorAt(i, tmpC);
    }
    megacols.instanceColor.needsUpdate = true;

    // the damper rides its floor; the ball swings at true scale
    tmd.position.x = U * phi(TMD_Y.ball);
    ball.position.set(st.rel, TMD_Y.ball, 0);
    for (const c of CABLES) place(c.m, c.top, tA.copy(c.at).add(ball.position));
    for (const d of DASH) {
      tA.copy(d.at).add(ball.position);
      place(d.rod, d.foot, tA);
      tD.copy(tA).sub(d.foot).normalize();
      place(d.sleeve, d.foot, tB.copy(d.foot).addScaledVector(tD, 3.4));
    }

    groundMat.uniforms.uA.value = st.ground;
    groundMat.uniforms.uQ.value = st.quake;
    groundMat.depthWrite = st.ground > 0.95;
    shadeMat.opacity = 0.26 * st.ground;
    town.visible = st.ground > 0.5;
    rock.visible = st.ground < 0.95;
    under.visible = st.ground < 0.95;
    rockMat.opacity = 0.42 * (1 - st.ground);

    // the wind: streaks that stop at the windward face, arrows sized by the pressure at their height
    streaks.visible = st.streaks > 0.02 && st.v > 0.5;
    if (streaks.visible) {
      streakMat.opacity = 0.5 * st.streaks * Math.min(1, st.v / 12);
      for (let i = 0; i < N_STREAK; i++) {
        const [x0, y, z, k] = SEED[i];
        const len = (5 + st.v * 0.75) * k;
        let x = ((x0 + st.windX * k) % 760) - 380;
        const w = widthAt(Math.min(y, P.roof - 1)) / 2 + 2;
        const hit = y < P.roof && Math.abs(z) < w && x + len / 2 > -w + U * phi(y);
        tmpM.makeScale(hit ? 0 : len, 0.5, 0.5).setPosition(x, y, z);
        streaks.setMatrixAt(i, tmpM);
      }
      streaks.instanceMatrix.needsUpdate = true;
    }
    arrowMat.opacity = st.arrows;
    for (const a of ARROWS) {
      const len = 85 * Math.pow(st.v / 60, 2) * Math.pow(a.y / P.roof, 0.3);
      const on = st.arrows > 0.02 && len > 3;
      a.shaft.visible = a.tip.visible = on;
      if (!on) continue;
      const face = -widthAt(a.y) / 2 - 4 + U * phi(a.y);
      a.tip.position.set(face - 5.5, a.y, 0);
      a.shaft.position.set(face - 11 - len / 2, a.y, 0);
      a.shaft.scale.set(len, 2.6, 2.6);
    }

    const tx = cam.tx + U * phi(cam.ty) * (cam.follow ?? 0);
    camera.position.set(tx + cam.d * Math.cos(cam.el) * Math.sin(cam.az), cam.ty + cam.d * Math.sin(cam.el), cam.tz + cam.d * Math.cos(cam.el) * Math.cos(cam.az));
    camera.lookAt(tx, cam.ty, cam.tz);
    camera.setViewOffset(size.w, size.h, -(cam.sx ?? 0), -(cam.sy ?? 0), size.w, size.h);
    camera.updateMatrixWorld();
    renderer.render(scene, camera);
  };
  const pv = new V3();
  const project = (x, y, z) => {
    pv.set(x, y, z).project(camera);
    if (pv.z > 1) return null;
    return [(pv.x * 0.5 + 0.5) * size.w, (-pv.y * 0.5 + 0.5) * size.h];
  };
  const setQuality = ({shadow}) => {
    sun.shadow.mapSize.set(shadow, shadow);
    sun.shadow.map?.dispose();
    sun.shadow.map = null;
  };
  return {renderer, scene, camera, resize, frame, project, size, setQuality};
}
