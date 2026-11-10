// The tower as a page you drive: the wind slider, the damper switch, an earthquake, four cameras, three ways to see
// through the glass, orbit and zoom. Two towers run under the same wind, one with its damper and one with the ball
// locked, so the chart always shows what the damper is worth. Left alone the page plays SCRIPT as a tour with a
// cursor; any click, drag, wheel or key hands control over, 25 s of quiet hands it back.
import {columns, createSim, overturn, P, phi, QUAKE_DUR, SNUB} from './model.js';
import {createConsole, CUTS, EXAG, OVERLAYS, VIEWS} from './console.js';
import {COLS, createTowerStage, floorY, TMD_Y} from './stage.js';

const W = 1600;
const H = 900;
const IDLE = 25;
const D2R = Math.PI / 180;
const V_MAX = 60;
const SPEED = [1, 10];
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const smoother = (x) => {
  const u = clamp(x, 0, 1);
  return u * u * u * (u * (u * 6 - 15) + 10);
};
const wrap = (d) => ((((d + 180) % 360) + 360) % 360) - 180;

const VIEW_FN = {
  hero: (u) => ({tx: 0, ty: 246, tz: 0, az: 22 + 1.0 * u, el: 7, d: 1240, follow: 0}),
  frame: (u) => ({tx: 0, ty: 262, tz: 0, az: 38 + 1.6 * u, el: 12, d: 430, follow: 0.6}),
  damper: (u) => ({tx: 0, ty: TMD_Y.ball - 0.5, tz: 0, az: 30 + 2.2 * u, el: 1.5, d: 92, follow: 1}),
  base: (u) => ({tx: 0, ty: -8, tz: 0, az: 28 + 1.4 * u, el: 3.5, d: 520, follow: 0}),
};
const CAPTION = {
  hero: '높은 건물은 꼿꼿이 버티지 않습니다. <b>조금씩 휘면서</b> 힘을 땅으로 흘려보냅니다.',
  frame: '<b>아웃리거 트러스</b>가 코어와 메가칼럼을 묶어, 휘려는 힘을 기둥을 누르는 힘으로 바꿉니다.',
  damper: '꼭대기 근처에 매달린 <b>660 t 쇠공</b>이 건물과 엇박자로 흔들리며 진동을 삼킵니다.',
  base: '건물 무게는 <b>말뚝 380개</b>를 타고 지하 80 m, 암반 속까지 내려갑니다.',
};
// the tour: what the operator does, when, and what the caption says
const SCRIPT = [
  {t: 0, caption: CAPTION.hero},
  {t: 3, wind: 50, spot: 'wind', caption: '태풍급 바람 <b>초속 50 m</b>. 꼭대기는 실제로 수십 cm를 오갑니다.'},
  {t: 9, overlay: 'load', caption: '그래도 안 넘어갑니다. 바람이 넘기려는 힘보다 <b>건물 무게가 수십 배</b> 세게 버팁니다.'},
  {t: 15, cut: 'ghost', caption: '유리 안쪽의 뼈대: 가운데 <b>코어</b>, 바깥쪽 <b>메가칼럼 8개</b>.'},
  {t: 18, overlay: 'labels'},
  {t: 19.5, view: 'frame', caption: CAPTION.frame},
  {t: 28, view: 'damper', caption: CAPTION.damper},
  {t: 36, tmd: false, caption: '공을 고정해 보면, 같은 바람인데 흔들림이 <b>거의 두 배</b>로 커집니다.'},
  {t: 39, view: 'hero'},
  {t: 47, tmd: true, caption: '다시 풀어 주면 금세 잦아듭니다.'},
  {t: 52, view: 'base', caption: CAPTION.base},
  {t: 59, quake: true, spot: 'quake', caption: '지진에도 원리는 같습니다. 부러지지 않고 <b>휘었다가 되돌아옵니다</b>.'},
  {t: 66, view: 'hero'},
  {t: 67, cut: 'skin', caption: '무게로 버티고, 뼈대로 나누고, 댐퍼로 잠재운다.'},
  {t: 68, overlay: 'labels'},
];
const DURATION = 73;
const spotOf = (e) => e.spot || e.view || e.cut || e.overlay || (e.tmd !== undefined ? 'tmd' : null);

const CSS = `
html,body{background:#e8ecef;overflow:hidden}
#app{position:absolute!important;inset:auto!important;left:0;top:0;width:${W}px;height:${H}px;transform-origin:0 0}
#gl{touch-action:none;cursor:grab}
#gl.drag{cursor:grabbing}
.tourchip{position:absolute;left:800px;top:28px;transform:translateX(-50%);display:flex;align-items:center;gap:7px;height:24px;padding:0 12px;border:1px solid #d5dbdf;border-radius:4px;background:rgba(250,251,252,.95);color:#1d2329;font:700 10px 'JetBrains Mono','Malgun Gothic','Apple SD Gothic Neo',monospace;letter-spacing:1px;white-space:nowrap;cursor:pointer;pointer-events:auto}
.tourchip i{display:block;width:6px;height:6px;border-radius:50%;background:#e3462a}
.tourchip.on i{animation:blink 1.2s steps(2) infinite}
@keyframes blink{50%{opacity:.15}}
.turn{position:fixed;left:0;right:0;bottom:14px;text-align:center;font:600 12px/1.4 sans-serif;color:#7b858d;display:none}
@media (orientation:portrait) and (max-width:820px){.turn{display:block}}
`;

// the parts a callout can name: [name, sub, point in metres]
const PARTS = {
  hero: [
    ['첨탑 끝 508 m', '101층 · 지붕 438 m', [0, 506, 0]],
    ['동조질량댐퍼', '660 t 쇠공 · 87–92층', [0, TMD_Y.ball, 0]],
    ['아웃리거 층', '8층마다 · 모두 11곳', [22, floorY(58) + 4, 22]],
    ['메가칼럼', '2.4 × 3.0 m · 8개', [22, 70, 11]],
  ],
  frame: [
    ['코어', '기둥 16개를 묶은 중심 뼈대', [-11.25, floorY(63), 11.25]],
    ['아웃리거 트러스', '코어 ↔ 메가칼럼', [17, floorY(58) + 4, 11]],
    ['벨트 트러스', '바깥 기둥을 한 바퀴 묶음', [-22, floorY(66) + 4, 22]],
    ['메가칼럼', '빨강: 더 눌림 · 파랑: 덜 눌림', [22, floorY(54), 11]],
  ],
  damper: [
    ['쇠공 660 t', '지름 5.5 m · 철판 41겹', [0, TMD_Y.ball + 1.6, 2.2], 'ball'],
    ['케이블 8가닥', '92층에 매달림', [3.2, TMD_Y.top - 6, 3.0]],
    ['유압 댐퍼 8개', '공의 움직임을 열로 바꿈', [6.6, TMD_Y.floor + 1.2, 4.4]],
    ['범퍼 링', '공이 너무 멀리 못 가게 막음', [-1.75, TMD_Y.ball - 4.25, 0]],
  ],
  base: [
    ['매트 기초', '두께 약 4.5 m 콘크리트 판', [44, -2.3, 46]],
    ['말뚝 380개', '지름 1.5 m · 깊이 80 m', [42.7, -34, 42.3]],
    ['암반', '말뚝 끝이 박히는 단단한 층', [-42.7, -64, 42.3]],
  ],
};

export function runLive() {
  document.documentElement.lang = 'ko';
  document.title = '초고층은 왜 안 쓰러질까 · 타이베이 101 시뮬레이터';
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);
  const app = document.getElementById('app');
  const canvas = document.createElement('canvas');
  canvas.id = 'gl';
  app.appendChild(canvas);
  const st = createTowerStage({canvas});
  const ui = createConsole(app);
  const tourChip = document.createElement('div');
  tourChip.className = 'tourchip';
  ui.root.appendChild(tourChip);
  const note = document.createElement('div');
  note.className = 'turn';
  note.textContent = '휴대폰을 가로로 돌리면 전체 화면이 보입니다';
  document.body.appendChild(note);

  // ------------------------------------------------------------ fit and quality
  const TIERS = [{pr: 2, shadow: 2048}, {pr: 1.25, shadow: 1024}, {pr: 1, shadow: 512}];
  const light = matchMedia('(pointer: coarse)').matches || Math.min(innerWidth, innerHeight) < 700;
  let tier = light ? 1 : 0;
  let scale = 1;
  const fit = () => {
    scale = Math.min(innerWidth / W, innerHeight / H);
    app.style.transform = `translate(${(innerWidth - W * scale) / 2}px, ${(innerHeight - H * scale) / 2}px) scale(${scale})`;
    st.resize(W, H, clamp((devicePixelRatio || 1) * scale, 0.75, TIERS[tier].pr));
    ui.measure();
  };
  const applyTier = () => {
    st.setQuality(TIERS[tier]);
    fit();
  };
  applyTier();
  addEventListener('resize', fit);

  // ------------------------------------------------------------ state
  const S = {v: 12, vT: 12, speed: 5, tmd: true, paused: false, view: 'hero', viewAt: 0, cut: 'skin', overlay: {wind: 1, load: 0, labels: 0}, exag: 100, quake: null};
  const simOn = createSim(true);
  const simOff = createSim(false);
  const NH = 400;
  const hist = {n: NH, on: new Array(NH).fill(0), off: new Array(NH).fill(0)};
  let histAcc = 0;
  const prime = () => {
    for (const s of [simOn, simOff]) {
      s.settle(S.v);
      s.step(240, S.v, null);
    }
    hist.on.fill(simOn.x1);
    hist.off.fill(simOff.x1);
  };
  prime();
  let T = 0;
  let windX = 0;
  const cam = {...VIEW_FN.hero(0)};
  const off = {az: 0, el: 0, k: 1};
  const ease = {skin: 1, ground: 1, load: 0, arrow: 0, wind: 1, labels: 0, U: 0};
  let caption = CAPTION.hero;
  let ring = {t: -9, x: 0, y: 0};
  const cur = {x: 900, y: 620};
  const pulse = (k) => {
    if (ui.spots[k]) ring = {t: T, x: ui.spots[k][0], y: ui.spots[k][1]};
  };
  const setView = (v) => {
    S.view = v;
    S.viewAt = T;
    Object.assign(off, {az: 0, el: 0, k: 1});
    // the inside views need the glass out of the way
    if (v !== 'hero' && S.cut === 'skin') S.cut = 'ghost';
  };
  const startQuake = () => (S.quake = 0);
  const apply = (e) => {
    if (e.wind !== undefined) S.vT = e.wind;
    if (e.overlay) S.overlay[e.overlay] = S.overlay[e.overlay] ? 0 : 1;
    if (e.cut) S.cut = e.cut;
    if (e.view) setView(e.view);
    if (e.tmd !== undefined) S.tmd = e.tmd;
    if (e.quake) startQuake();
    if (e.caption) caption = e.caption;
    const k = spotOf(e);
    if (k) pulse(k);
  };

  // ------------------------------------------------------------ the tour
  const AP = {on: true, t0: 0, i: 0};
  let lastInput = 0;
  const startTour = () => {
    Object.assign(S, {vT: 12, speed: 5, tmd: true, paused: false, cut: 'skin', exag: 100, quake: null});
    Object.assign(S.overlay, {wind: 1, load: 0, labels: 0});
    S.view = 'hero';
    S.viewAt = T;
    Object.assign(off, {az: 0, el: 0, k: 1});
    Object.assign(AP, {on: true, t0: T, i: 0});
  };
  const takeOver = () => {
    lastInput = T;
    AP.on = false;
  };
  tourChip.addEventListener('pointerdown', (e) => {
    e.stopPropagation();
    lastInput = T;
    if (AP.on) takeOver();
    else startTour();
  });
  addEventListener('pointerdown', (e) => {
    if (e.target !== tourChip) takeOver();
  });

  // ------------------------------------------------------------ controls
  const click = (k, fn) =>
    ui.btn[k].addEventListener('click', () => {
      takeOver();
      pulse(k);
      fn();
    });
  for (const v of VIEWS)
    click(v, () => {
      setView(v);
      caption = CAPTION[v];
    });
  for (const c of CUTS) click(c, () => (S.cut = c));
  for (const o of OVERLAYS) click(o, () => (S.overlay[o] = S.overlay[o] ? 0 : 1));
  for (const x of EXAG) click(`x${x}`, () => (S.exag = x));
  click('tmd', () => {
    S.tmd = !S.tmd;
    caption = S.tmd ? '댐퍼를 풀었습니다. 왼쪽 그래프의 빨간 선이 지금 건물입니다.' : '공을 고정했습니다. 같은 바람인데 흔들림이 서서히 커집니다.';
  });
  click('quake', () => {
    startQuake();
    caption = '땅이 흔들립니다. 주기가 긴 초고층은 빠른 지진동을 <b>느리게 휘면서</b> 받아냅니다.';
  });
  click('play', () => (S.paused = !S.paused));
  click('calm', () => {
    S.vT = 0;
    caption = '바람이 없으면 남는 것은 <b>무게</b>뿐입니다. 기둥 8개가 똑같이 나눠 집니다.';
  });
  const slider = (node, fn) => {
    const move = (e) => {
      const r = node.getBoundingClientRect();
      fn(clamp((e.clientX - r.left) / r.width, 0, 1));
      lastInput = T;
    };
    node.addEventListener('pointerdown', (e) => {
      takeOver();
      node.setPointerCapture(e.pointerId);
      const up = () => {
        node.removeEventListener('pointermove', move);
        node.removeEventListener('pointerup', up);
      };
      node.addEventListener('pointermove', move);
      node.addEventListener('pointerup', up);
      move(e);
    });
  };
  slider(ui.slWind, (k) => (S.vT = S.v = Math.round(k * V_MAX)));
  slider(ui.slSpeed, (k) => (S.speed = SPEED[0] + k * (SPEED[1] - SPEED[0])));
  addEventListener('keydown', (e) => {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    const key = e.key.toLowerCase();
    const v = {1: 'hero', 2: 'frame', 3: 'damper', 4: 'base'}[key];
    if (v) ui.btn[v].click();
    else if (key === ' ') ui.btn.play.click();
    else if (key === 'd') ui.btn.tmd.click();
    else if (key === 'q') ui.btn.quake.click();
    else if (key === 'arrowright') {
      takeOver();
      S.vT = clamp(S.vT + 5, 0, V_MAX);
    } else if (key === 'arrowleft') {
      takeOver();
      S.vT = clamp(S.vT - 5, 0, V_MAX);
    } else return;
    e.preventDefault();
  });
  let drag = null;
  canvas.addEventListener('pointerdown', (e) => {
    drag = {x: e.clientX, y: e.clientY};
    canvas.setPointerCapture(e.pointerId);
    canvas.classList.add('drag');
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!drag) return;
    off.az -= ((e.clientX - drag.x) / scale) * 0.3;
    off.el = clamp(off.el + ((e.clientY - drag.y) / scale) * 0.2, -30, 70);
    drag = {x: e.clientX, y: e.clientY};
    lastInput = T;
  });
  const endDrag = () => {
    drag = null;
    canvas.classList.remove('drag');
  };
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);
  canvas.addEventListener(
    'wheel',
    (e) => {
      e.preventDefault();
      takeOver();
      off.k = clamp(off.k * Math.exp(e.deltaY * 0.0012), 0.35, 2.2);
    },
    {passive: false},
  );

  // ------------------------------------------------------------ callouts: two columns, stacked so none touch
  const callouts = (U, rel, o) => {
    if (o < 0.02) return [];
    const pts = [];
    for (const [name, sub, p, tag] of PARTS[S.view]) {
      const at = st.project(p[0] + U * phi(p[1]) + (tag === 'ball' ? rel : 0), p[1], p[2]);
      if (at && at[0] > 340 && at[0] < 1260 && at[1] > 90 && at[1] < 800) pts.push({name, sub, at});
    }
    const out = [];
    const stack = (col, x) => {
      let y = 110;
      for (const c of col.sort((a, b) => a.at[1] - b.at[1])) {
        y = Math.max(y, Math.min(760, c.at[1] - 14));
        out.push({...c, label: [x, y], o});
        y += 46;
      }
    };
    // alternate sides down the tower so leaders stay short and never cross
    const sorted = pts.sort((a, b) => a.at[1] - b.at[1]);
    stack(sorted.filter((_, i) => i % 2 === 0), 560);
    stack(sorted.filter((_, i) => i % 2 === 1), 1040);
    return out;
  };

  // ------------------------------------------------------------ the frame
  startTour();
  let last = performance.now();
  let snap = false;
  // for review captures: jump the tour ahead by sec seconds
  const skip = (sec) => {
    AP.t0 -= sec;
    S.viewAt -= sec;
    for (let i = 0; i < sec * 10; i++) {
      S.v += (S.vT - S.v) * 0.1;
      for (const s of [simOn, simOff]) s.step(0.1 * S.speed, S.v, null);
      hist.on.push(simOn.x1);
      hist.on.shift();
      hist.off.push(simOff.x1);
      hist.off.shift();
    }
    snap = true;
  };
  const perf = {n: 0, sum: 0, slow: 0, age: 0};
  const frame = (now) => {
    const dt = Math.min(0.1, Math.max(0, (now - last) / 1000));
    last = now;
    T += dt;
    if (tier < TIERS.length - 1) {
      perf.age += dt;
      if (perf.age > 0.8) {
        perf.sum += dt;
        perf.n++;
        if (perf.sum >= 0.5 && perf.n >= 6) {
          perf.slow = perf.sum / perf.n > 0.024 ? perf.slow + 1 : 0;
          perf.sum = 0;
          perf.n = 0;
          if (perf.slow >= 2) {
            tier++;
            applyTier();
            Object.assign(perf, {age: 0, slow: 0});
          }
        }
      }
    }

    const ed = snap ? 100 : dt;
    snap = false;
    // the operator
    let cursor = {x: -99, y: -99, press: false};
    if (AP.on) {
      const c = T - AP.t0;
      if (c >= DURATION) startTour();
      else {
        while (AP.i < SCRIPT.length && SCRIPT[AP.i].t <= c) apply(SCRIPT[AP.i++]);
        const next = SCRIPT.slice(AP.i).find((e) => spotOf(e));
        const k = next && ui.spots[spotOf(next)];
        if (k && next.t - c < 1.1) {
          const a = 1 - Math.exp(-dt / 0.14);
          cur.x += (k[0] - cur.x) * a;
          cur.y += (k[1] - cur.y) * a;
        }
        cursor = {x: cur.x, y: cur.y, press: T - ring.t < 0.14};
      }
    } else if (T - lastInput > IDLE) startTour();
    const rk = Math.max(0, 1 - (T - ring.t) / 0.55);
    Object.assign(cursor, {ring: rk, ringX: ring.x, ringY: ring.y});

    // the physics: both towers under the same wind and the same ground
    S.v += (S.vT - S.v) * (1 - Math.exp(-dt / 0.9));
    if (Math.abs(S.vT - S.v) < 0.05) S.v = S.vT;
    const dts = S.paused ? 0 : dt * S.speed;
    if (dts > 0) {
      simOn.step(dts, S.v, S.quake);
      simOff.step(dts, S.v, S.quake);
      if (S.quake !== null) {
        S.quake += dts;
        if (S.quake > QUAKE_DUR + 4) S.quake = null;
      }
      windX += S.v * dts * 0.9;
      histAcc += dts;
      while (histAcc >= 0.1) {
        histAcc -= 0.1;
        hist.on.push(simOn.x1);
        hist.on.shift();
        hist.off.push(simOff.x1);
        hist.off.shift();
      }
    }
    const sim = S.tmd ? simOn : simOff;
    const amp = (a) => (Math.max(...a) - Math.min(...a)) / 2;
    const cols = columns(S.v);
    const tint = COLS.map(([x]) => clamp(((x / 22) * cols.delta) / (0.3 * cols.gravity), -1, 1) * ease.load);

    // eased display state (a debug skip lands every ease at once)
    const k3 = 1 - Math.exp(-ed / 0.28);
    ease.skin += ((S.cut === 'ghost' ? 0.1 : 1) - ease.skin) * k3;
    ease.ground += ((S.view === 'base' ? 0.12 : 1) - ease.ground) * k3;
    ease.load += (S.overlay.load - ease.load) * k3;
    ease.arrow += ((S.overlay.load && S.view !== 'damper' ? 1 : 0) - ease.arrow) * k3;
    ease.wind += (S.overlay.wind - ease.wind) * k3;
    const since = T - S.viewAt;
    ease.labels += ((S.overlay.labels && since > 1.0 ? 1 : 0) - ease.labels) * (1 - Math.exp(-ed / 0.2));
    // the bend eases when the damper or the exaggeration switches, never jumps
    ease.U += (sim.x1 * S.exag - ease.U) * (1 - Math.exp(-ed / 0.12));
    const rel = S.tmd ? clamp(simOn.x2 - simOn.x1, -1.45, 1.45) : 0;

    // camera
    const tgt = VIEW_FN[S.view](since);
    tgt.az += off.az;
    tgt.el = clamp(tgt.el + off.el, -20, 88);
    tgt.d *= off.k;
    const kc = 1 - Math.exp(-ed / 0.4);
    cam.az += wrap(tgt.az - cam.az) * kc;
    for (const key of ['tx', 'ty', 'tz', 'el', 'd', 'follow']) cam[key] += (tgt[key] - cam[key]) * kc;

    st.frame(
      {U: ease.U, rel, v: S.v, windX, skin: ease.skin, section: S.cut === 'section', ground: ease.ground, streaks: ease.wind, arrows: ease.arrow, tint, quake: S.quake === null ? -1 : S.quake},
      {...cam, az: cam.az * D2R, el: cam.el * D2R},
    );
    ui.update({
      v: S.v, vMax: V_MAX, speed: S.speed, speedK: (S.speed - SPEED[0]) / (SPEED[1] - SPEED[0]),
      x: sim.x1, ampOn: amp(hist.on), ampOff: amp(hist.off), mg: sim.mg(), hist,
      ot: overturn(S.v), cols, tmd: S.tmd, rel, power: simOn.power, snub: SNUB,
      paused: S.paused, quake: S.quake === null ? -1 : S.quake, view: S.view, cut: S.cut, overlay: S.overlay, exag: S.exag,
      caption, callouts: callouts(ease.U, rel, ease.labels), cursor,
    });
    if (tourChip.classList.contains('on') !== AP.on || !tourChip.firstChild) {
      tourChip.classList.toggle('on', AP.on);
      tourChip.innerHTML = AP.on ? '<i></i>자동 투어 중 · 클릭하면 직접 조작' : '▶ 자동 투어 다시 보기';
    }
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
  window.LIVE = {skip, st, S, simOn, simOff, cam, startTour, takeOver, P, get T() {
    return T;
  }, set T(v) {
    T = v;
  }, AP};
}
