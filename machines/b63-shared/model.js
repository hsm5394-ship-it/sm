// 63빌딩 built from tower.js: five systems, each a group that can be peeled off, lined up, ghosted or cut.
//   glass  the gold curtain wall, four facades
//   frame  steel columns following the flare, floor beams
//   slab   60 floor plates tinted by what the floor is for
//   core   the concrete core, the shafts and the cars riding in them
//   base   three basements, the podium, the roof plant and the antenna
// x runs along the long side, z across the flare, y up. update(state) poses everything.
import * as THREE from 'three';
import {B, carAt, CARS, depthAt, FLOOR_H, floorY, zoneOf} from './tower.js';

export const SYSTEMS = ['glass', 'frame', 'slab', 'core', 'base'];
export const ACCENT = '#e3562a';
// where each system stands when the building is laid out in a row
export const SLOT = {glass: -190, frame: -95, slab: 0, core: 95, base: 190};
const CORE = {w: 34, d: 9};
const LIFT = B.basements * B.basementH + 9; // how far the tower rises off its basements when exploded

function paneTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#fff';
  g.fillRect(0, 0, 128, 128);
  // a floor: a vision pane over a slightly darker spandrel band, a mullion each side
  g.fillStyle = '#d9d2c2';
  g.fillRect(0, 98, 128, 30);
  g.fillStyle = '#6f6656';
  g.fillRect(0, 0, 9, 128);
  g.fillRect(0, 122, 128, 6);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

export function buildTower() {
  const root = new THREE.Group();
  const clip = new THREE.Plane(new THREE.Vector3(0, 0, -1), 1e4);
  const mats = {};
  const mat = (sys, m) => {
    m.clippingPlanes = [clip];
    m.transparent = true;
    m.userData.base = m.opacity;
    (mats[sys] ||= []).push(m);
    return m;
  };
  const G = Object.fromEntries(SYSTEMS.map((k) => [k, new THREE.Group()]));
  for (const k of SYSTEMS) root.add(G[k]);
  const shadow = (m, cast = true) => {
    m.castShadow = cast;
    m.receiveShadow = true;
    return m;
  };
  const N = B.floors;
  const H = B.roof;

  // ------------------------------------------------------------ glass
  const tex = paneTexture();
  const glassMat = () => mat('glass', new THREE.MeshStandardMaterial({color: '#e6b24a', metalness: 0.85, roughness: 0.42, map: tex, envMapIntensity: 0.9, side: THREE.DoubleSide}));
  const facade = {};
  {
    // the two long faces: 62 m wide, bowing out toward the ground
    const cols = 31;
    for (const s of [1, -1]) {
      const pos = [];
      const uv = [];
      const idx = [];
      for (let j = 0; j <= N; j++) {
        const y = (j / N) * H;
        const z = (s * depthAt(y)) / 2;
        pos.push(-B.long / 2, y, z, B.long / 2, y, z);
        uv.push(0, j, cols, j);
        if (j < N) {
          const a = j * 2;
          if (s > 0) idx.push(a, a + 1, a + 3, a, a + 3, a + 2);
          else idx.push(a, a + 3, a + 1, a, a + 2, a + 3);
        }
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      geo.setIndex(idx);
      geo.computeVertexNormals();
      const m = shadow(new THREE.Mesh(geo, glassMat()));
      facade[s > 0 ? 'south' : 'north'] = m;
      G.glass.add(m);
    }
    // the two ends: as wide as the flare at each height
    for (const s of [1, -1]) {
      const pos = [];
      const uv = [];
      const idx = [];
      for (let j = 0; j <= N; j++) {
        const y = (j / N) * H;
        const d = depthAt(y) / 2;
        pos.push((s * B.long) / 2, y, -d, (s * B.long) / 2, y, d);
        uv.push(0, j, Math.round(depthAt(y) / 1.5), j);
        if (j < N) {
          const a = j * 2;
          if (s < 0) idx.push(a, a + 1, a + 3, a, a + 3, a + 2);
          else idx.push(a, a + 3, a + 1, a, a + 2, a + 3);
        }
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      geo.setIndex(idx);
      geo.computeVertexNormals();
      const m = shadow(new THREE.Mesh(geo, glassMat()));
      facade[s > 0 ? 'east' : 'west'] = m;
      G.glass.add(m);
    }
    const lid = shadow(new THREE.Mesh(new THREE.BoxGeometry(B.long, 0.5, B.depthTop), mat('glass', new THREE.MeshStandardMaterial({color: '#8d8573', roughness: 0.8}))));
    lid.position.y = H + 0.25;
    facade.lid = lid;
    G.glass.add(lid);
  }

  // ------------------------------------------------------------ steel frame: every member one instance of a unit box
  {
    const segs = [];
    const inset = 1.1;
    const colX = Array.from({length: 11}, (_, i) => -B.long / 2 + inset + (i * (B.long - 2 * inset)) / 10);
    for (let j = 0; j < N; j++) {
      const y0 = j * FLOOR_H;
      const y1 = y0 + FLOOR_H;
      const z0 = depthAt(y0) / 2 - inset;
      const z1 = depthAt(y1) / 2 - inset;
      for (const x of colX) for (const s of [1, -1]) segs.push([x, y0, s * z0, x, y1, s * z1, 0.75]);
      // the perimeter beams and the cross beams of the floor above
      for (const s of [1, -1]) segs.push([colX[0], y1, s * z1, colX[10], y1, s * z1, 0.5]);
      for (const x of colX) segs.push([x, y1, -z1, x, y1, z1, x === colX[0] || x === colX[10] ? 0.5 : 0.34]);
    }
    const im = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), mat('frame', new THREE.MeshStandardMaterial({color: '#56636f', metalness: 0.5, roughness: 0.55})), segs.length);
    const a = new THREE.Vector3();
    const b = new THREE.Vector3();
    const q = new THREE.Quaternion();
    const up = new THREE.Vector3(0, 1, 0);
    const m4 = new THREE.Matrix4();
    segs.forEach(([x0, y0, z0, x1, y1, z1, w], i) => {
      a.set(x0, y0, z0);
      b.set(x1, y1, z1);
      const d = b.clone().sub(a);
      const len = d.length();
      q.setFromUnitVectors(up, d.normalize());
      m4.compose(a.add(b).multiplyScalar(0.5), q, new THREE.Vector3(w, len, w));
      im.setMatrixAt(i, m4);
    });
    shadow(im);
    G.frame.add(im);
  }

  // ------------------------------------------------------------ floor plates
  {
    const im = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), mat('slab', new THREE.MeshStandardMaterial({color: '#ffffff', roughness: 0.85})), N);
    const m4 = new THREE.Matrix4();
    const col = new THREE.Color();
    for (let n = 1; n <= N; n++) {
      const y = floorY(n);
      m4.compose(new THREE.Vector3(0, y + 0.2, 0), new THREE.Quaternion(), new THREE.Vector3(B.long - 0.8, 0.4, depthAt(y) - 0.8));
      im.setMatrixAt(n - 1, m4);
      im.setColorAt(n - 1, col.set(zoneOf(n).col));
    }
    shadow(im);
    G.slab.add(im);
  }

  // ------------------------------------------------------------ core, shafts, cars
  const cars = [];
  {
    const y0 = floorY(-2);
    const h = H - y0 + 3;
    const shell = shadow(new THREE.Mesh(new THREE.BoxGeometry(CORE.w, h, CORE.d), mat('core', new THREE.MeshStandardMaterial({color: '#93a0ad', roughness: 0.9, opacity: 0.5, depthWrite: false}))));
    shell.position.y = y0 + h / 2;
    shell.renderOrder = 3;
    G.core.add(shell);
    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(shell.geometry), mat('core', new THREE.LineBasicMaterial({color: '#4a545e'})));
    edges.position.copy(shell.position);
    G.core.add(edges);
    const railMat = mat('core', new THREE.MeshStandardMaterial({color: '#6c7782', roughness: 0.7}));
    const carMat = new THREE.MeshStandardMaterial({color: ACCENT, emissive: ACCENT, emissiveIntensity: 0.55, roughness: 0.5, transparent: true});
    (mats.cars ||= []).push(carMat);
    carMat.userData.base = 1;
    for (const c of CARS) {
      const ya = floorY(c.lo);
      const yb = floorY(c.hi) + FLOOR_H;
      for (const dx of [-1.6, 1.6]) {
        const rail = new THREE.Mesh(new THREE.BoxGeometry(0.22, yb - ya, 0.22), railMat);
        rail.position.set(c.x + dx, (ya + yb) / 2, 0);
        G.core.add(rail);
      }
      const car = new THREE.Mesh(new THREE.BoxGeometry(2.7, 3.4, 3.0), carMat);
      car.position.x = c.x;
      car.renderOrder = 4;
      G.core.add(car);
      cars.push(car);
    }
  }

  // ------------------------------------------------------------ basements, podium, roof plant, antenna
  const baseParts = {};
  {
    const conc = mat('base', new THREE.MeshStandardMaterial({color: '#9aa3ad', roughness: 0.9}));
    const bh = B.basements * B.basementH;
    const pit = new THREE.Group();
    for (let i = 0; i < B.basements; i++) {
      const s = shadow(new THREE.Mesh(new THREE.BoxGeometry(B.long + 26, B.basementH - 0.5, B.depthBase + 22), conc));
      s.position.y = -(i + 0.5) * B.basementH;
      pit.add(s);
    }
    baseParts.pit = pit;
    const podium = shadow(new THREE.Mesh(new THREE.BoxGeometry(46, 13, 26), mat('base', new THREE.MeshStandardMaterial({color: '#cfc6b4', roughness: 0.8}))));
    podium.position.set(-4, 6.5, -(B.depthBase / 2 + 15));
    baseParts.podium = podium;
    const crown = new THREE.Group();
    const plant = shadow(new THREE.Mesh(new THREE.BoxGeometry(40, 5.5, 13), conc));
    plant.position.y = H + 0.5 + 2.75;
    const mast = shadow(new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.9, B.tip - H - 6, 10), mat('base', new THREE.MeshStandardMaterial({color: '#d04b2b', roughness: 0.6}))));
    mast.position.set(-9, H + 6 + (B.tip - H - 6) / 2, 0);
    crown.add(plant, mast);
    baseParts.crown = crown;
    G.base.add(pit, podium, crown);
    baseParts.bh = bh;
  }

  // st: {time, explode 0..1, layout 0..1, xray 0..1, cut 0..1, ghost: {system: 0..1 faded out}, sway (m, exaggerated)}
  const shear = new THREE.Matrix4();
  const update = (st) => {
    const e = st.explode ?? 0;
    const L = st.layout ?? 0;
    // the whole tower leans with the wind: a shear, floors stay level
    shear.identity();
    shear.elements[6] = ((st.sway ?? 0) / H) * (1 - L);
    root.matrixAutoUpdate = false;
    root.matrix.copy(shear);
    root.matrixWorldNeedsUpdate = true;

    const lift = Math.max(e, L) * LIFT;
    for (const k of SYSTEMS) G[k].position.set(L * SLOT[k], k === 'base' ? 0 : lift, 0);
    // glass: each facade leaves along its own normal, the lid goes up
    facade.south.position.z = e * 46;
    facade.north.position.z = -e * 46;
    facade.east.position.x = e * 34;
    facade.west.position.x = -e * 34;
    facade.lid.position.y = H + 0.25 + e * 14;
    // the base: the basements stay in the ground line, the podium slides out, the crown rises
    baseParts.pit.position.y = Math.max(e, L) * (baseParts.bh + 0.5);
    baseParts.podium.position.set(-4 * (1 - L), 6.5 + L * (baseParts.bh + 1), -(B.depthBase / 2 + 15 + e * 40) * (1 - L));
    baseParts.crown.position.y = (lift + e * 26) * (1 - L) - L * (H - baseParts.bh - 14);
    cars.forEach((car, i) => (car.position.y = carAt(CARS[i], st.time).y + 1.7));

    // opacity: x-ray thins the glass, isolate ghosts every other system
    const ghost = st.ghost ?? {};
    const op = (sys) => {
      let o = 1;
      if (sys === 'glass') o *= 1 - 0.86 * (st.xray ?? 0);
      return o * (1 - 0.93 * (ghost[sys === 'cars' ? 'core' : sys] ?? 0));
    };
    for (const sys of Object.keys(mats)) {
      const o = op(sys);
      for (const m of mats[sys]) {
        m.opacity = m.userData.base * o;
        if (!(sys === 'core' && m.userData.base < 1)) m.depthWrite = o > 0.6;
      }
    }
    for (const k of SYSTEMS) G[k].traverse((m) => m.isMesh && (m.castShadow = op(k) > 0.5));
    clip.constant = (st.cut ?? 0) > 0.001 ? 60 * (1 - st.cut) : 1e4;
  };

  // where the labels point, in world space for the current state
  const anchors = (st) => {
    const e = st.explode ?? 0;
    const L = st.layout ?? 0;
    const lift = Math.max(e, L) * LIFT;
    const car = carAt(CARS[0], st.time);
    return {
      glass: [L * SLOT.glass + B.long / 2 + e * 34, lift + 150, 0],
      frame: [L * SLOT.frame - B.long / 2 + 1, lift + 95, depthAt(95) / 2 - 1],
      slab: [L * SLOT.slab + B.long / 2 - 1, lift + floorY(38), 0],
      core: [L * SLOT.core + CORE.w / 2, lift + 200, 0],
      car: [L * SLOT.core + CARS[0].x, lift + car.y + 1.7, 1.5],
      pit: [L * SLOT.base + B.long / 2 + 10, Math.max(e, L) * (baseParts.bh + 0.5) - baseParts.bh / 2, B.depthBase / 2 + 11],
      crown: [L * SLOT.base - 9, baseParts.crown.position.y + H + 18, 0],
      deck: [L * SLOT.slab - B.long / 2 + 1, lift + floorY(60), 0],
      slots: SYSTEMS.map((k) => [k, [SLOT[k], 0, 34]]),
    };
  };
  return {root, update, anchors, clip, mats, G};
}
