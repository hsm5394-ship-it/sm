// The studio: a pale sky-grey room, a site plan drawn on the floor (50 m grid, the plot, the Han to the north), one
// sun with a soft shadow that follows the building. frame(state, cam) poses the tower and draws one frame.
import * as THREE from 'three';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {buildTower} from './model.js';

const V3 = THREE.Vector3;
export const COL = {bg: '#e6ebee', ground: '#dfe5e8', mark: '#b9c4cb', river: '#b7d0de', shadow: '#3d4a57'};

const GROUND_VERT = /* glsl */ `varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`;
const GROUND_FRAG = /* glsl */ `uniform vec3 uG; uniform vec3 uM; uniform vec3 uR; uniform vec3 uBg; uniform vec3 uC; uniform float uFade; varying vec3 vW;
  float line(float v, float period, float w){ float f = abs(fract(v / period + 0.5) - 0.5) * period; return 1.0 - smoothstep(w, w * 2.2, f); }
  void main(){
    vec2 p = vW.xz;
    float m = max(line(p.x, 50.0, 0.35), line(p.y, 50.0, 0.35)) * 0.55;
    // the plot outline
    vec2 q = abs(p - vec2(0.0, -6.0)) - vec2(86.0, 62.0);
    float box = max(q.x, q.y);
    m = max(m, (1.0 - smoothstep(0.0, 1.2, abs(box))) * 0.9);
    vec3 col = mix(uG, uM, m);
    // the Han, north of the plot
    float river = smoothstep(-150.0, -158.0, p.y);
    float wave = 0.5 + 0.5 * sin(p.x * 0.09 + sin(p.y * 0.05) * 2.0);
    col = mix(col, uR * (0.97 + 0.05 * wave), river);
    float d = length(p - uC.xz);
    gl_FragColor = vec4(mix(col, uBg, smoothstep(uFade * 0.55, uFade, d)), 1.0);
  }`;

export function createTowerStage({canvas}) {
  const renderer = new THREE.WebGLRenderer({canvas, antialias: false, preserveDrawingBuffer: true, powerPreference: 'high-performance'});
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.localClippingEnabled = true;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(COL.bg);
  const camera = new THREE.PerspectiveCamera(26, 16 / 9, 4, 6000);
  const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(4, 4, {type: THREE.HalfFloatType, samples: 4}));
  composer.addPass(new RenderPass(scene, camera));
  composer.addPass(new OutputPass());

  {
    // what the gold glass reflects: a bright sky, a warm west, a cool east, a pale floor
    const env = new THREE.Scene();
    env.background = new THREE.Color('#dfe8ee');
    const card = (w, h, pos, col, k) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({color: new THREE.Color(col).multiplyScalar(k), side: THREE.DoubleSide}));
      m.position.copy(pos);
      m.lookAt(0, 0, 0);
      env.add(m);
    };
    card(16, 16, new V3(0, 14, 0), '#ffffff', 2.2);
    card(6, 14, new V3(-13, 5, 6), '#ffe9c4', 2.6);
    card(6, 14, new V3(13, 4, -5), '#cfe2f2', 1.6);
    card(20, 3, new V3(0, 1.5, 14), '#fff4dc', 1.4);
    const g = new THREE.Mesh(new THREE.CircleGeometry(40, 32), new THREE.MeshBasicMaterial({color: '#c9d0d4', side: THREE.DoubleSide}));
    g.rotation.x = -Math.PI / 2;
    g.position.y = -2;
    env.add(g);
    const pm = new THREE.PMREMGenerator(renderer);
    scene.environment = pm.fromScene(env, 0.03).texture;
    scene.environmentIntensity = 0.9;
    pm.dispose();
  }
  const SUN_DIR = new V3(0.5, 0.74, 0.62).normalize();
  const sun = new THREE.DirectionalLight('#fff3df', 2.4);
  sun.castShadow = true;
  let EXT = 330;
  Object.assign(sun.shadow.camera, {left: -EXT, right: EXT, top: EXT, bottom: -EXT, near: 10, far: 1600});
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.bias = -0.0006;
  sun.shadow.normalBias = 0.6;
  scene.add(sun, sun.target);
  scene.add(new THREE.HemisphereLight('#f6fbff', '#c9c2b4', 0.75));

  const groundMat = new THREE.ShaderMaterial({
    vertexShader: GROUND_VERT,
    fragmentShader: GROUND_FRAG,
    uniforms: {uG: {value: new THREE.Color(COL.ground)}, uM: {value: new THREE.Color(COL.mark)}, uR: {value: new THREE.Color(COL.river)}, uBg: {value: new THREE.Color(COL.bg)}, uC: {value: new V3()}, uFade: {value: 900}},
    toneMapped: false,
  });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(8000, 8000), groundMat);
  ground.rotation.x = -Math.PI / 2;
  scene.add(ground);
  const shade = new THREE.Mesh(new THREE.PlaneGeometry(8000, 8000), new THREE.ShadowMaterial({color: COL.shadow, opacity: 0.26, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -8}));
  shade.rotation.x = -Math.PI / 2;
  shade.receiveShadow = true;
  scene.add(shade);

  const tower = buildTower();
  scene.add(tower.root);

  const size = {w: 1600, h: 900};
  const resize = (w, h, pr) => {
    size.w = w;
    size.h = h;
    renderer.setPixelRatio(pr);
    renderer.setSize(w, h, false);
    composer.setPixelRatio(pr);
    composer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };

  // cam: {tx, ty, tz, az, el (radians), d (m), sx, sy (px shift of the picture)}
  const frame = (st, cam) => {
    tower.update(st);
    const {tx, ty, tz} = cam;
    camera.position.set(tx + cam.d * Math.cos(cam.el) * Math.sin(cam.az), ty + cam.d * Math.sin(cam.el), tz + cam.d * Math.cos(cam.el) * Math.cos(cam.az));
    camera.lookAt(tx, ty, tz);
    camera.setViewOffset(size.w, size.h, -(cam.sx ?? 0), -(cam.sy ?? 0), size.w, size.h);
    camera.updateMatrixWorld();
    groundMat.uniforms.uC.value.set(tx, 0, tz);
    groundMat.uniforms.uFade.value = Math.max(700, cam.d * 1.5);
    sun.target.position.set(0, 100, 0);
    sun.position.copy(sun.target.position).addScaledVector(SUN_DIR, 700);
    sun.target.updateMatrixWorld();
    composer.render();
  };
  const pv = new V3();
  const project = (x, y, z) => {
    pv.set(x, y, z).project(camera);
    if (pv.z > 1) return null;
    return [(pv.x * 0.5 + 0.5) * size.w, (-pv.y * 0.5 + 0.5) * size.h];
  };
  const setQuality = ({samples, shadow}) => {
    if (samples !== undefined)
      for (const t of [composer.renderTarget1, composer.renderTarget2]) {
        t.samples = samples;
        t.dispose();
      }
    if (shadow !== undefined) {
      sun.shadow.mapSize.set(shadow, shadow);
      sun.shadow.map?.dispose();
      sun.shadow.map = null;
    }
  };
  return {renderer, scene, camera, tower, composer, sun, resize, frame, project, size, setQuality};
}
