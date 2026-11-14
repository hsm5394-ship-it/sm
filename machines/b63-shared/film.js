// 63빌딩, the film: the tower (model.js) on its site plan (stage.js) under the console (console.js). The operator
// makes the glass thin, turns to the end view and raises the wind so the tower leans, peels the curtain wall, lays the
// five systems out in a row, names them, picks the core to watch the cars, and puts it all back. A pure function of t.
import {runSim} from 'teardown-kit/runtime.js';
import {createConsole, DISPLAY, SWAY_GAIN, SYS, SYS_LABEL} from './console.js';
import {SLOT} from './model.js';
import {createTowerStage} from './stage.js';
import {carAt, CARS, swayAt} from './tower.js';

export const SCRIPT = [
  {t: 0, view: 'hero'},
  {t: 2.4, display: 'xray'},
  {t: 4.6, view: 'side'},
  {t: 5.2, slide: 'wind', to: 36, dur: 1.2},
  {t: 8.4, slide: 'wind', to: 6, dur: 1.0},
  {t: 8.9, display: 'xray'},
  {t: 9.3, view: 'hero'},
  {t: 9.9, slide: 'explode', to: 1, dur: 1.8},
  {t: 12.2, display: 'labels'},
  {t: 15.2, display: 'labels'},
  {t: 15.6, slide: 'layout', to: 1, dur: 2.2},
  {t: 15.6, slide: 'explode', to: 0.3, dur: 2.2, quiet: true},
  {t: 16.0, view: 'front'},
  {t: 18.4, isolate: 'glass'},
  {t: 19.5, isolate: 'frame'},
  {t: 20.6, isolate: 'slab'},
  {t: 21.7, isolate: 'core'},
  {t: 22.1, view: 'core'},
  {t: 25.2, isolate: 'core'},
  {t: 25.6, slide: 'layout', to: 0, dur: 2.0},
  {t: 25.6, slide: 'explode', to: 0, dur: 2.2, quiet: true},
  {t: 26.0, view: 'hero'},
  {t: 26.5, display: 'orbit'},
];
export const DURATION = 30;
export const START = {explode: 0, layout: 0, wind: 6};
export const DEFAULTS = {duration: DURATION, fps: 60, theme: 'light', hud: {enabled: false, title: '63빌딩', subtitle: '분해 시뮬레이터'}, director: {enabled: false}, watermark: ''};
const D2R = Math.PI / 180;
export const smoother = (x) => {
  const u = Math.min(1, Math.max(0, x));
  return u * u * u * (u * (u * 6 - 15) + 10);
};
export const ss = (a, b, t) => smoother((t - a) / (b - a));

// ------------------------------------------------------------ the script's state at film time t
export const slideAt = (key, t) => {
  let v = START[key];
  for (const e of SCRIPT) if (e.slide === key && e.t <= t) v += (e.to - v) * ss(e.t, e.t + e.dur, t);
  return v;
};
export const displayAt = (t) => {
  const out = Object.fromEntries(DISPLAY.map((k) => [k, 0]));
  for (const e of SCRIPT) if (e.display && e.t <= t) out[e.display] = out[e.display] ? 0 : 1;
  return out;
};
const lastFlip = (key, t) => SCRIPT.filter((e) => e.display === key && e.t <= t).pop()?.t ?? -9;
export const easedDisplay = (key, t, dur = 0.7) => {
  const on = displayAt(t)[key];
  const k = ss(lastFlip(key, t), lastFlip(key, t) + dur, t);
  return on ? k : 1 - k;
};
// the picked system, and how far every other one has faded: each eases from where it was when the pick changed
export const pickedAt = (t) => {
  let cur = null;
  for (const e of SCRIPT) if (e.isolate && e.t <= t) cur = cur === e.isolate ? null : e.isolate;
  return cur;
};
export const ghostAt = (t) => {
  const g = Object.fromEntries(SYS.map((k) => [k, 0]));
  let cur = null;
  for (const e of SCRIPT)
    if (e.isolate && e.t <= t) {
      cur = cur === e.isolate ? null : e.isolate;
      const k = ss(e.t, e.t + 0.6, t);
      for (const s of SYS) g[s] += ((cur && cur !== s ? 1 : 0) - g[s]) * k;
    }
  return g;
};

// ------------------------------------------------------------ views. u = seconds on the view, L = how laid out
export const VIEW_FN = {
  hero: (u, L, e) => ({tx: 0, ty: 126, tz: 0, az: 34 - 22 * L + 1.2 * u, el: 9, d: 900 + 330 * L + 120 * e, sx: 0, sy: -14}),
  front: (u, L, e) => ({tx: 0, ty: 126, tz: 0, az: 0 + 1.0 * u, el: 5, d: 880 + 300 * L + 60 * e, sx: 0, sy: -14}),
  side: (u, L, e) => ({tx: L * SLOT.glass, ty: 126, tz: 0, az: 90 + 0.8 * u, el: 4, d: 880 + 120 * e, sx: 0, sy: -14}),
  plan: (u, L, e) => ({tx: 0, ty: 180, tz: 0, az: 0 + 1.2 * u, el: 86, d: 620 + 620 * L + 160 * e, sx: 0, sy: -14}),
  core: (u, L, e) => ({tx: L * SLOT.core, ty: 132, tz: 0, az: 18 + 1.5 * u, el: 6, d: 900, sx: 0, sy: -14}),
  deck: (u, L, e) => ({tx: L * SLOT.slab, ty: 232 + 20 * Math.max(L, e), tz: 0, az: 38 + 2.5 * u, el: 14, d: 230, sx: 0, sy: -14}),
};
const VIEWS = SCRIPT.filter((e) => e.view).map((e) => [e.t, e.view]);
const blend = (a, b, k) => {
  const o = {};
  for (const key in b) o[key] = key === 'az' ? a.az + ((((b.az - a.az + 540) % 360) - 180) * k) : a[key] + (b[key] - a[key]) * k;
  return o;
};
export const camAt = (t, L, e, orbit = 0) => {
  let i = 0;
  while (i < VIEWS.length - 1 && VIEWS[i + 1][0] <= t) i++;
  const cur = VIEW_FN[VIEWS[i][1]](t - VIEWS[i][0], L, e);
  let o = cur;
  if (i > 0) {
    const k = ss(VIEWS[i][0], VIEWS[i][0] + 1.8, t);
    if (k < 1) o = blend(VIEW_FN[VIEWS[i - 1][1]](t - VIEWS[i - 1][0], L, e), cur, k);
  }
  if (orbit > 0) o = {...o, az: o.az + 9 * Math.max(0, t - lastFlip('orbit', t)) * orbit};
  return o;
};
export const viewAt = (t) => VIEWS.filter(([a]) => a <= t).pop();

// ------------------------------------------------------------ the operator's pointer
const REST = [[820, 470], [700, 400], [900, 520], [780, 360]];
export function makeCursor(ui) {
  const EV = SCRIPT.filter((e) => e.t > 0 && !e.quiet).map((e) => {
    const key = e.view ?? e.display ?? e.slide ?? e.isolate;
    if (!e.slide) return {t: e.t, spot: ui.spots[key]};
    // a slider: grab the knob where it is, drag it to the new value
    const S = ui.SL[e.slide];
    const max = e.slide === 'wind' ? 40 : 1;
    const from = slideAt(e.slide, e.t - 0.01) / max;
    return {t: e.t, spot: [S.x + from * S.w, S.y], drag: [S.x + (e.to / max) * S.w, S.y], dur: e.dur};
  });
  const WP = [[0, 860, 560]];
  EV.forEach((e, i) => {
    WP.push([e.t - 0.16, ...e.spot]);
    if (e.drag) WP.push([e.t + 0.02, ...e.spot], [e.t + e.dur, ...e.drag], [e.t + e.dur + 0.2, ...e.drag]);
    else WP.push([e.t + 0.22, ...e.spot]);
    WP.push([e.t + (e.dur ?? 0) + 1.5, ...REST[i % REST.length]]);
  });
  WP.sort((a, b) => a[0] - b[0]);
  return (t) => {
    let i = 0;
    while (i < WP.length - 2 && t > WP[i + 1][0]) i++;
    const [t0, x0, y0] = WP[i];
    const [t1, x1, y1] = WP[i + 1];
    const k = ss(t0, t1, t);
    const len = Math.hypot(x1 - x0, y1 - y0);
    const dragging = EV.some((e) => e.drag && t >= e.t && t <= e.t + e.dur + 0.1);
    const bow = dragging ? 0 : Math.sin(Math.PI * k) * Math.min(24, len * 0.07);
    let press = dragging;
    let ring = 0;
    let rx = 0;
    let ry = 0;
    for (const e of EV) {
      if (t >= e.t - 0.07 && t < e.t + 0.09) press = true;
      if (t >= e.t && t < e.t + 0.55) {
        ring = 1 - (t - e.t) / 0.55;
        [rx, ry] = e.spot;
      }
    }
    return {x: x0 + (x1 - x0) * k + (len ? (-(y1 - y0) / len) * bow : 0), y: y0 + (y1 - y0) * k + (len ? ((x1 - x0) / len) * bow : 0), press, ring, ringX: rx, ringY: ry};
  };
}

// ------------------------------------------------------------ the labels
const PARTS = [
  {key: 'glass', name: '커튼월', sub: '금색 이중 반사유리 13,516장'},
  {key: 'frame', name: '철골 기둥 · 보', sub: '1–39층은 오를수록 좁아진다'},
  {key: 'slab', name: '38F 피난안전구역', sub: '바닥 슬래브 60개 층 가운데'},
  {key: 'deck', name: '60F 전망층', sub: '지상 약 245 m'},
  {key: 'core', name: '코어', sub: '계단 · 설비 · 승강로'},
  {key: 'car', name: '고속 엘리베이터', sub: '분속 540 m = 초속 9 m'},
  {key: 'pit', name: '지하 3개 층', sub: 'B1 – B3'},
  {key: 'crown', name: '옥탑 · 안테나', sub: '끝 높이 274 m'},
];
export function makeLabels(st) {
  return (state, o) => {
    const A = st.tower.anchors(state);
    const out = [];
    // laid out in a row, every system gets its name under it
    const cap = ss(0.55, 0.95, state.layout);
    if (cap > 0.02)
      for (const [k, p] of A.slots) {
        const at = st.project(...p);
        if (at && at[0] > 340 && at[0] < 1260) out.push({name: SYS_LABEL[k][0], sub: SYS_LABEL[k][1], cap: [at[0], Math.min(722, at[1] + 14)], o: cap * (1 - 0.75 * (state.ghost?.[k] ?? 0))});
      }
    o *= 1 - ss(0.2, 0.6, state.layout);
    if (o < 0.02) return out;
    const pts = PARTS.map((p) => ({p, at: st.project(...A[p.key])})).filter((x) => x.at && x.at[0] > 330 && x.at[0] < 1270 && x.at[1] > 112 && x.at[1] < 752);
    const L = pts.filter((x) => x.at[0] < 800).sort((a, b) => a.at[1] - b.at[1]);
    const R = pts.filter((x) => x.at[0] >= 800).sort((a, b) => a.at[1] - b.at[1]);
    const stack = (col, x, w) => {
      let y = 126;
      for (const c of col) {
        y = Math.max(y, Math.min(700, c.at[1] - 12));
        out.push({name: c.p.name, sub: c.p.sub, at: c.at, label: [x, y], w, o});
        y += 42;
      }
    };
    stack(L, 330, 150);
    stack(R, 1118, 160);
    return out;
  };
}

/** One frame from one state: s = {time, wind, explode, layout, xray, cut, labels, ghost, picked, view, display, cam, cursor, paused}. */
export function makeFrame(ui, st) {
  const labels = makeLabels(st);
  return (s) => {
    const sway = swayAt(s.wind, s.time).x;
    const model = {time: s.time, explode: s.explode, layout: s.layout, xray: s.xray, cut: s.cut, ghost: s.ghost, sway: sway * SWAY_GAIN};
    st.frame(model, {...s.cam, az: s.cam.az * D2R, el: s.cam.el * D2R});
    ui.update({
      car: carAt(CARS[0], s.time),
      wind: s.wind,
      sway,
      explode: s.explode,
      layout: s.layout,
      view: s.view,
      display: s.display,
      isolate: s.picked,
      paused: s.paused ?? false,
      callouts: labels(model, s.labels),
      cursor: s.cursor,
    });
  };
}

/** The whole state of the scripted tour at time t (the film, and the live page's auto tour). */
export function tourState(t, cursorAt) {
  const disp = displayAt(t);
  const explode = slideAt('explode', t);
  const layout = slideAt('layout', t);
  const [vt0, view] = viewAt(t);
  return {
    time: t,
    wind: slideAt('wind', t),
    explode,
    layout,
    xray: easedDisplay('xray', t),
    cut: easedDisplay('cut', t, 0.9),
    labels: easedDisplay('labels', t, 0.5) * ss(vt0 + 1.2, vt0 + 1.8, t),
    ghost: ghostAt(t),
    picked: pickedAt(t),
    view,
    display: disp,
    cam: camAt(t, layout, explode, disp.orbit),
    cursor: cursorAt(t),
  };
}

export function makeFilm() {
  return async ({canvas, capture}) => {
    const st = createTowerStage({canvas});
    const resize = () => st.resize(1600, 900, capture ? devicePixelRatio || 1 : Math.min(devicePixelRatio || 1, 2));
    resize();
    const ui = createConsole(document.getElementById('app'));
    const cursorAt = makeCursor(ui);
    const frame = makeFrame(ui, st);
    window.CS = st;
    return {
      resize,
      render(t) {
        frame(tourState(t, cursorAt));
        return {};
      },
    };
  };
}

export const run = () => runSim(DEFAULTS, makeFilm());
