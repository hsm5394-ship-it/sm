// HOW A MECHANICAL WATCH KEEPS TIME, a 33 s vertical film. The dial, then the back, then the four things that make
// the tick: mainspring, gear train (fast-forward), escapement (slow motion), balance (real time). A pure function of t.
import {runSim} from 'teardown-kit/runtime.js';
import {createConsole} from './console.js';
import {BAL, D2R, ESC, pose} from './kin.js';
import {DURATION, GROUP_KEYS, rateAt, ss, stageIndex, STAGES, tauAt} from './script.js';
import {createWatchStage} from './stage.js';

export const DEFAULTS = {duration: DURATION, fps: 60, theme: 'light', accent: '#d81e4a', hud: {enabled: false, title: 'watch', subtitle: ''}, director: {enabled: false}, watermark: ''};

// ------------------------------------------------------------ look: group opacities and the explode, eased per stage
const FADE = 0.9;
export const lookAt = (t) => {
  const i = stageIndex(t);
  const k = i ? ss(STAGES[i].t, STAGES[i].t + FADE, t) : 1;
  const a = STAGES[Math.max(0, i - 1)];
  const b = STAGES[i];
  const opacity = {};
  for (const g of GROUP_KEYS) {
    const o = (a.op[g] ?? 1) + ((b.op[g] ?? 1) - (a.op[g] ?? 1)) * k;
    opacity[g] = Math.round(o * 200) / 200;
  }
  return {opacity, explode: (a.explode ?? 0) + ((b.explode ?? 0) - (a.explode ?? 0)) * k};
};

// ------------------------------------------------------------ camera: one view per stage, u = seconds on it
export const VIEW_FN = {
  dial: (u) => ({tx: 0, ty: 0, tz: -1, az: 190 - 1.2 * u, el: 5, d: 262, sy: 40}),
  back: (u) => ({tx: 0, ty: 0, tz: 1.5, az: 12 + 2 * u, el: 12, d: 262, sy: 40}),
  barrel: (u) => ({tx: -4.6, ty: 2.6, tz: 1.5, az: -16 + 2.2 * u, el: 24, d: 176, sy: 40}),
  train: (u) => ({tx: -1.5, ty: -1.6, tz: 3.5, az: 22 - 2.4 * u, el: 20, d: 196, sy: 40}),
  escape: (u) => ({tx: 4.7, ty: -4.3, tz: 3.4, az: -6 + 1.2 * u, el: 30, d: 68, sy: 100}),
  balance: (u) => ({tx: 5.4, ty: -2.4, tz: 4.4, az: -24 + 2.5 * u, el: 28, d: 124, sy: 40}),
};
const MOVE = 1.6;
const blend = (a, b, k) => {
  const o = {};
  const turn = ((b.az - a.az + 540) % 360) - 180;
  for (const key in b) o[key] = key === 'az' ? a.az + turn * k : a[key] + (b[key] - a[key]) * k;
  // pull back a little through a big turn so the watch stays inside the frame
  o.d += Math.max(a.d, b.d) * 0.1 * Math.min(1, Math.abs(turn) / 120) * Math.sin(Math.PI * k);
  return o;
};
export const camAt = (t) => {
  const i = stageIndex(t);
  const cur = VIEW_FN[STAGES[i].view](t - STAGES[i].t);
  if (i === 0) return cur;
  const k = ss(STAGES[i].t, STAGES[i].t + MOVE, t);
  if (k >= 1) return cur;
  return blend(VIEW_FN[STAGES[i - 1].view](t - STAGES[i - 1].t), cur, k);
};

// ------------------------------------------------------------ labels: a name in two languages on a leader into the part
// at: world point from the movement's anchors. pos: the label's centre, layout px.
const R = BAL.R;
export const LABELS = {
  barrel: [
    {ko: '배럴', en: 'BARREL · 84 TEETH', at: (m) => m.anchor('barrel', -5.2, 4.9, 1.6), pos: [420, 600]},
    {ko: '태엽', en: 'MAINSPRING', at: (m) => m.anchor('barrel', 3.4, -1.6, 2.7), pos: [800, 1150]},
  ],
  train: [
    {ko: '센터 휠', en: 'CENTRE WHEEL · 1 REV / HOUR', at: (m) => m.anchor('centre', 2.2, 3.6, 3.2), pos: [740, 590]},
    {ko: '3번 휠', en: 'THIRD WHEEL', at: (m) => m.anchor('third', -3.3, 0.6, 3.8), pos: [260, 780]},
    {ko: '4번 휠', en: 'FOURTH WHEEL · 1 REV / MIN', at: (m) => m.anchor('fourth', -2.6, -2.0, 2.6), pos: [240, 1190]},
    {ko: '이스케이프 휠', en: 'ESCAPE WHEEL · 10 REV / MIN', at: (m) => m.anchor('escape', 1.6, -1.3, 3.4), pos: [800, 1190]},
  ],
  escape: [
    {ko: '이스케이프 휠', en: 'ESCAPE WHEEL · 15 TEETH', at: (m) => m.anchor('escape', -1.4, -1.5, 3.4), pos: [250, 1195]},
    {ko: '팔레트 포크', en: 'PALLET FORK', at: (m) => m.anchor('fork', 1.0 * Math.cos(65 * D2R), 1.0 * Math.sin(65 * D2R), 3.55), pos: [850, 900]},
    {ko: '루비 팔레트', en: 'RUBY PALLETS', at: (m) => m.anchor('escape', ESC.rTip * Math.cos(95 * D2R), ESC.rTip * Math.sin(95 * D2R) + 0.3, 3.5), pos: [210, 760]},
  ],
  balance: [
    {ko: '밸런스 휠', en: 'BALANCE WHEEL', at: (m) => m.anchor('balance', R * 0.72, R * 0.68, 5.25), pos: [760, 620]},
    {ko: '헤어스프링', en: 'HAIRSPRING', at: (m) => m.anchor('balance', -1.9, 1.0, 5.95), pos: [230, 700]},
  ],
};

export const textAt = (t) => {
  // each text block fades in after its stage starts and out just before the next block's stage
  const w = {};
  const blocks = [];
  for (const s of STAGES) {
    const last = blocks[blocks.length - 1];
    if (last && last.text === s.text) continue;
    if (last) last.t1 = s.t;
    blocks.push({text: s.text, t0: s.t, t1: DURATION + 9});
  }
  for (const b of blocks) w[b.text] = ss(b.t0 + (b.t0 ? 0.25 : -1), b.t0 + 0.6, t) * (1 - ss(b.t1 - 0.1, b.t1 + 0.25, t));
  return w;
};

export function makeFilm() {
  return async ({cfg, canvas, capture}) => {
    const st = createWatchStage({canvas});
    const resize = () => st.resize(capture ? devicePixelRatio || 1 : Math.min(devicePixelRatio || 1, 2));
    resize();
    const ui = createConsole(document.getElementById('app'));
    window.WATCH = st;
    return {
      resize,
      render(t) {
        const tau = tauAt(t);
        const p = pose(tau);
        const look = lookAt(t);
        // cfg.cam / cfg.op: a fixed camera or group opacities for review stills (capture --config)
        const cam = cfg.cam ?? camAt(t);
        if (cfg.op) Object.assign(look.opacity, cfg.op);
        st.frame(p, look, cam);
        const i = stageIndex(t);
        const weights = textAt(t);
        const callouts = [];
        for (const key in LABELS) {
          const o = weights[key] * ss(STAGES.find((s) => s.text === key).t + 1.2, STAGES.find((s) => s.text === key).t + 1.8, t);
          if (o < 0.01) continue;
          for (const l of LABELS[key]) {
            const a = st.project(l.at(st.mv));
            if (a) callouts.push({ko: l.ko, en: l.en, at: a, label: l.pos, o});
          }
        }
        ui.update({t, stage: STAGES[i].id, step: ['barrel', 'train', 'escape', 'balance'].indexOf(STAGES[i].text), weights, pose: p, tau, rate: rateAt(t), callouts});
        return {};
      },
    };
  };
}

export const run = () => runSim(DEFAULTS, makeFilm());
