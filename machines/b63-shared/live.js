// 63빌딩 as a page you drive: the film's tower, site and console in real time. The three sliders take it apart, lay it
// out and raise the wind; the five systems isolate; six views, four display modes, an orbit you drag, a zoom on the
// wheel. Left alone it plays the film's script as an auto tour with the operator's cursor; a click, drag, wheel or key
// hands control to the visitor, 25 s of quiet hands it back.
import {warmComposer} from 'teardown-kit/warm.js';
import {createConsole, DISPLAY, SLIDERS, SYS, VIEWS, WIND_MAX} from './console.js';
import {DURATION, makeCursor, makeFrame, ss, START, tourState, VIEW_FN} from './film.js';
import {createTowerStage} from './stage.js';

const W = 1600;
const H = 900;
const IDLE = 25;
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const wrap = (d) => ((((d + 180) % 360) + 360) % 360) - 180;

const CSS = `
html,body{background:#e6ebee;overflow:hidden}
#app{position:absolute!important;inset:auto!important;left:0;top:0;width:${W}px;height:${H}px;transform-origin:0 0}
#gl{touch-action:none;cursor:grab}
#gl.drag{cursor:grabbing}
.bt,.sy{pointer-events:auto;cursor:pointer}
.bt:hover,.sy:hover{filter:brightness(.96)}
.hit{position:absolute;pointer-events:auto;cursor:ew-resize;touch-action:none}
.tourchip{position:absolute;left:800px;top:112px;transform:translateX(-50%);display:flex;align-items:center;gap:7px;height:24px;padding:0 12px;border:1px solid #d7dee3;border-radius:4px;background:rgba(250,252,253,.95);color:#1f262d;font:700 11px 'Inter','P63','Apple SD Gothic Neo','Malgun Gothic',sans-serif;white-space:nowrap;cursor:pointer;pointer-events:auto}
.tourchip i{display:block;width:6px;height:6px;border-radius:50%;background:#e3562a}
.tourchip.on i{animation:blink 1.2s steps(2) infinite}
@keyframes blink{50%{opacity:.15}}
.turn{position:fixed;left:0;right:0;bottom:14px;text-align:center;font:600 12px/1.4 'Inter','P63',sans-serif;color:#7c8792;display:none}
@media (orientation:portrait) and (max-width:820px){.turn{display:block}}
`;

export function runLive() {
  document.title = '63빌딩 분해 시뮬레이터';
  document.documentElement.lang = 'ko';
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);
  const app = document.getElementById('app');
  const canvas = document.createElement('canvas');
  canvas.id = 'gl';
  app.appendChild(canvas);
  const st = createTowerStage({canvas});
  const ui = createConsole(app);
  const tourCursor = makeCursor(ui);
  const drawFrame = makeFrame(ui, st);

  // ------------------------------------------------------------ quality tiers
  const TIERS = [
    {samples: 4, shadow: 2048, pr: 2},
    {samples: 2, shadow: 1024, pr: 1.5},
    {samples: 0, shadow: 1024, pr: 1},
  ];
  const light = matchMedia('(pointer: coarse)').matches || Math.min(innerWidth, innerHeight) < 700;
  let tier = light ? 1 : 0;
  let scale = 1;
  const fit = () => {
    scale = Math.min(innerWidth / W, innerHeight / H);
    app.style.transform = `translate(${(innerWidth - W * scale) / 2}px, ${(innerHeight - H * scale) / 2}px) scale(${scale})`;
    st.resize(W, H, clamp((devicePixelRatio || 1) * scale, 0.75, TIERS[tier].pr));
  };
  const applyTier = () => {
    const {pr, ...q} = TIERS[tier];
    st.setQuality(q);
    fit();
  };
  applyTier();
  addEventListener('resize', fit);
  const toStage = (cx, cy) => {
    const r = app.getBoundingClientRect();
    return [(cx - r.left) / scale, (cy - r.top) / scale];
  };
  const tourChip = document.createElement('div');
  tourChip.className = 'tourchip';
  ui.root.appendChild(tourChip);
  const note = document.createElement('div');
  note.className = 'turn';
  note.textContent = '휴대폰을 가로로 돌리면 전체 화면이 보입니다';
  document.body.appendChild(note);

  // ------------------------------------------------------------ state
  let T = 0; // wall clock of the page
  let sim = 0; // the building's clock: elevators, sway
  let paused = false;
  let view = 'hero';
  let viewAt0 = 0;
  const val = {...START};
  const disp = Object.fromEntries(DISPLAY.map((k) => [k, {on: 0, t: -9}]));
  let picked = null;
  const ghost = Object.fromEntries(SYS.map((k) => [k, 0]));
  const off = {az: 0, el: 0, k: 1};
  const cam = {...VIEW_FN.hero(0, 0, 0)};
  let ring = {t: -9, x: 0, y: 0};
  const eased = (k, dur = 0.7) => {
    const d = disp[k];
    const x = ss(d.t, d.t + dur, T);
    return d.on ? x : 1 - x;
  };
  const pulse = (k) => (ring = {t: T, x: ui.spots[k][0], y: ui.spots[k][1]});

  // ------------------------------------------------------------ the tour
  const AP = {on: true, t0: 0};
  let lastInput = 0;
  let tour = null;
  const startTour = () => {
    AP.on = true;
    AP.t0 = T;
    paused = false;
    Object.assign(off, {az: 0, el: 0, k: 1});
  };
  // taking over keeps everything the tour had set: the sliders, the toggles, the picked system, the view
  const takeOver = () => {
    lastInput = T;
    if (!AP.on || !tour) return;
    AP.on = false;
    sim = tour.time;
    for (const k of SLIDERS) val[k] = tour[k];
    for (const k of DISPLAY) disp[k] = {on: tour.display[k], t: T - 5};
    picked = tour.picked;
    Object.assign(ghost, tour.ghost);
    view = tour.view;
    viewAt0 = T - 3;
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
  for (const v of VIEWS)
    ui.btn[v].addEventListener('click', () => {
      takeOver();
      pulse(v);
      view = v;
      viewAt0 = T;
      Object.assign(off, {az: 0, el: 0, k: 1});
    });
  for (const k of DISPLAY)
    ui.btn[k].addEventListener('click', () => {
      takeOver();
      pulse(k);
      disp[k] = {on: disp[k].on ? 0 : 1, t: T};
    });
  for (const k of SYS)
    ui.btn[k].addEventListener('click', () => {
      takeOver();
      pulse(k);
      picked = picked === k ? null : k;
    });
  ui.btn.play.addEventListener('click', () => {
    takeOver();
    pulse('play');
    paused = !paused;
  });
  for (const k of SLIDERS) {
    const S = ui.SL[k];
    const d = document.createElement('div');
    d.className = 'hit';
    Object.assign(d.style, {left: `${S.x - 12}px`, top: `${S.y - 16}px`, width: `${S.w + 24}px`, height: '32px'});
    const move = (e) => {
      const [x] = toStage(e.clientX, e.clientY);
      val[k] = clamp((x - S.x) / S.w, 0, 1) * (k === 'wind' ? WIND_MAX : 1);
      lastInput = T;
    };
    d.addEventListener('pointerdown', (e) => {
      takeOver();
      d.setPointerCapture(e.pointerId);
      const up = () => {
        removeEventListener('pointermove', move);
        removeEventListener('pointerup', up);
      };
      addEventListener('pointermove', move);
      addEventListener('pointerup', up);
      move(e);
    });
    ui.root.appendChild(d);
  }
  addEventListener('keydown', (e) => {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    const key = e.key.toLowerCase();
    const v = VIEWS[Number(key) - 1];
    if (v) ui.btn[v].click();
    else if (key === ' ') ui.btn.play.click();
    else if (key === 'c') ui.btn.cut.click();
    else if (key === 'x') ui.btn.xray.click();
    else if (key === 'l') ui.btn.labels.click();
    else if (key === 'o') ui.btn.orbit.click();
    else if (key === 'e') {
      takeOver();
      val.explode = val.explode > 0.5 ? 0 : 1;
    } else if (key === 'n') {
      takeOver();
      val.layout = val.layout > 0.5 ? 0 : 1;
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
    off.el = clamp(off.el + ((e.clientY - drag.y) / scale) * 0.2, -12, 80);
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
      off.k = clamp(off.k * Math.exp(e.deltaY * 0.0012), 0.25, 2.2);
    },
    {passive: false},
  );

  // ------------------------------------------------------------ the frame
  startTour();
  // the sliders ease toward what the visitor set, so E and N keys and jumps on the track never snap
  const shown = {...START};
  let last = performance.now();
  const perf = {n: 0, sum: 0, slow: 0, age: 0};
  const frame = (now) => {
    const dt = Math.min(0.1, Math.max(0, (now - last) / 1000));
    last = now;
    T += dt;
    if (tier < TIERS.length - 1) {
      perf.age += dt;
      if (perf.age > 0.6) {
        perf.sum += dt;
        perf.n++;
        if (perf.sum >= 0.5 && perf.n >= 6) {
          perf.slow = perf.sum / perf.n > 0.022 ? perf.slow + 1 : 0;
          perf.sum = 0;
          perf.n = 0;
          if (perf.slow >= (perf.age < 6 ? 1 : 2)) {
            tier++;
            applyTier();
            Object.assign(perf, {age: 0, slow: 0});
          }
        }
      }
    }
    let s;
    if (AP.on) {
      const c = T - AP.t0;
      const cyc = c % DURATION;
      tour = tourState(cyc, tourCursor);
      s = tour;
      if (c > DURATION && cyc < 0.8) {
        const end = tourCursor(DURATION - 0.01);
        const k = ss(0, 0.8, cyc);
        s.cursor = {...s.cursor, x: end.x + (s.cursor.x - end.x) * k, y: end.y + (s.cursor.y - end.y) * k};
      }
      Object.assign(shown, {explode: s.explode, layout: s.layout, wind: s.wind});
      const k = 1 - Math.exp(-dt / 0.18);
      cam.az += wrap(s.cam.az - cam.az) * k;
      for (const key of ['tx', 'ty', 'tz', 'el', 'd', 'sx', 'sy']) cam[key] += (s.cam[key] - cam[key]) * k;
      s.cam = cam;
    } else {
      if (T - lastInput > IDLE) startTour();
      if (!paused) sim += dt;
      const ks = 1 - Math.exp(-dt / 0.22);
      for (const key of SLIDERS) shown[key] += (val[key] - shown[key]) * ks;
      const tgt = VIEW_FN[view](T - viewAt0, shown.layout, shown.explode);
      tgt.az += off.az + (disp.orbit.on ? 9 * (T - disp.orbit.t) : 0);
      tgt.el = clamp(tgt.el + off.el, -8, 88);
      tgt.d *= off.k;
      const k = 1 - Math.exp(-dt / 0.4);
      cam.az += wrap(tgt.az - cam.az) * k;
      for (const key of ['tx', 'ty', 'tz', 'el', 'd', 'sx', 'sy']) cam[key] += (tgt[key] - cam[key]) * k;
      const kg = 1 - Math.exp(-dt / 0.2);
      for (const key of SYS) ghost[key] += ((picked && picked !== key ? 1 : 0) - ghost[key]) * kg;
      const rk = Math.max(0, 1 - (T - ring.t) / 0.55);
      s = {
        time: sim,
        wind: shown.wind,
        explode: shown.explode,
        layout: shown.layout,
        xray: eased('xray'),
        cut: eased('cut', 0.9),
        labels: eased('labels', 0.5),
        ghost,
        picked,
        view,
        display: Object.fromEntries(DISPLAY.map((x) => [x, disp[x].on])),
        cam,
        cursor: {x: -99, y: -99, press: false, ring: rk, ringX: ring.x, ringY: ring.y},
        paused,
      };
    }
    drawFrame(s);
    if (tourChip.classList.contains('on') !== AP.on || !tourChip.firstChild) {
      tourChip.classList.toggle('on', AP.on);
      tourChip.innerHTML = AP.on ? '<i></i>자동 투어 중 · 아무 곳이나 누르면 직접 조작' : '▶ 자동 투어 다시 보기';
    }
    if (!window.SIM_SHOWN) {
      window.SIM_SHOWN = true;
      dispatchEvent(new Event('simframe'));
    }
    requestAnimationFrame(frame);
  };
  // every shader compiles at once before the first frame (kit/warm.js)
  warmComposer(st.renderer, st.composer, st.scene, st.camera).then(() => requestAnimationFrame(frame));
  window.LIVE = {st, cam, startTour, takeOver, get tier() {
    return tier;
  }, get T() {
    return T;
  }};
}
