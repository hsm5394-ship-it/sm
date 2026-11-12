// The watch's stage: a pale studio, a key light with soft shadows, the movement floating upright in front of the
// camera. frame(pose, look, cam) poses the movement and draws one frame; project() maps a world point to layout px.
import * as THREE from 'three';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {GTAOPass} from 'three/addons/postprocessing/GTAOPass.js';
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js';
import {Pass} from 'three/addons/postprocessing/Pass.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {buildMovement} from './movement.js';

export const W = 1080;
export const H = 1920;
export const BG = '#eceef2';
const V3 = THREE.Vector3;

export function createWatchStage({canvas}) {
  const renderer = new THREE.WebGLRenderer({canvas, antialias: false, preserveDrawingBuffer: true, powerPreference: 'high-performance'});
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1.02;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.sortObjects = true;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(BG);
  const camera = new THREE.PerspectiveCamera(24, W / H, 5, 900);

  {
    // a soft box studio for the reflections: a big top light, two side strips, a dark floor so metal has contrast
    const env = new THREE.Scene();
    env.background = new THREE.Color('#d9dde4');
    const box = (w, h, pos, k) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({color: new THREE.Color(1, 1, 1).multiplyScalar(k), side: THREE.DoubleSide}));
      m.position.copy(pos);
      m.lookAt(0, 0, 0);
      env.add(m);
    };
    box(14, 14, new V3(0, 14, 4), 2.6);
    box(3, 16, new V3(-12, 3, 8), 3.2);
    box(3, 16, new V3(12, 3, -6), 2.2);
    box(16, 3, new V3(0, -3, 14), 1.4);
    box(30, 30, new V3(0, -14, 0), 0.25);
    const pm = new THREE.PMREMGenerator(renderer);
    scene.environment = pm.fromScene(env, 0.03).texture;
    scene.environmentIntensity = 1.0;
    pm.dispose();
  }
  const sun = new THREE.DirectionalLight('#fffaf2', 2.4);
  sun.castShadow = true;
  const EXT = 30;
  Object.assign(sun.shadow.camera, {left: -EXT, right: EXT, top: EXT, bottom: -EXT, near: 10, far: 400});
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.radius = 3;
  sun.shadow.bias = -0.0006;
  sun.shadow.normalBias = 0.06;
  scene.add(sun, sun.target);
  scene.add(new THREE.HemisphereLight('#ffffff', '#b9c0cc', 0.5));

  const mv = buildMovement();
  scene.add(mv.root);

  // ambient occlusion from the solid parts only: ghosted parts are hidden while it is computed
  const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(4, 4, {type: THREE.HalfFloatType, samples: 4}));
  composer.addPass(new RenderPass(scene, camera));
  const gtao = new GTAOPass(scene, camera, 4, 4);
  gtao.output = GTAOPass.OUTPUT.Default;
  gtao.blendIntensity = 1.0;
  gtao.updateGtaoMaterial({radius: 1.6, distanceExponent: 1.2, thickness: 1.2, scale: 1.15, samples: 16, distanceFallOff: 1.0, screenSpaceRadius: false});
  gtao.updatePdMaterial({lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 5, rings: 2, samples: 16});
  class Toggle extends Pass {
    constructor(fn) {
      super();
      this.needsSwap = false;
      this.fn = fn;
    }
    render() {
      this.fn();
    }
  }
  let hidden = [];
  composer.addPass(new Toggle(() => {
    hidden = mv.ghosts().filter((m) => m.visible);
    for (const m of hidden) m.visible = false;
  }));
  composer.addPass(gtao);
  composer.addPass(new Toggle(() => {
    for (const m of hidden) m.visible = true;
  }));
  composer.addPass(new OutputPass());

  const resize = (pr) => {
    renderer.setPixelRatio(pr);
    renderer.setSize(W, H, false);
    composer.setPixelRatio(pr);
    composer.setSize(W, H);
    camera.aspect = W / H;
    camera.updateProjectionMatrix();
  };

  const off = new V3();
  // cam: {tx, ty, tz (mm), az, el (deg), d (mm), sy (px the subject sits above centre)}
  const frame = (pose, look, cam) => {
    mv.update(pose, look);
    const az = (cam.az * Math.PI) / 180;
    const el = (cam.el * Math.PI) / 180;
    off.set(Math.cos(el) * Math.sin(az), Math.sin(el), Math.cos(el) * Math.cos(az));
    camera.position.set(cam.tx + off.x * cam.d, cam.ty + off.y * cam.d, cam.tz + off.z * cam.d);
    camera.up.set(0, 1, 0);
    camera.lookAt(cam.tx, cam.ty, cam.tz);
    camera.setViewOffset(W, H, 0, cam.sy ?? 0, W, H);
    camera.updateMatrixWorld();
    // the key light rides with the camera, up and to the left, so both faces of the watch are lit the same way
    const right = new V3().crossVectors(off, new V3(0, 1, 0)).normalize().multiplyScalar(-0.38);
    sun.target.position.set(cam.tx, cam.ty, cam.tz);
    sun.position.copy(off).multiplyScalar(1.0).add(right).add(new V3(0, 0.34, 0)).normalize().multiplyScalar(200).add(sun.target.position);
    sun.target.updateMatrixWorld();
    composer.render();
  };
  const pv = new V3();
  const project = (v) => {
    pv.copy(v).project(camera);
    if (pv.z > 1) return null;
    return [(pv.x * 0.5 + 0.5) * W, (-pv.y * 0.5 + 0.5) * H];
  };
  return {renderer, scene, camera, mv, resize, frame, project};
}
