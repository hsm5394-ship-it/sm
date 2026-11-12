// The film's script with no browser code in it: the stages, the watch's speed through them, watch time as a function
// of film time, and the ticks you can hear. film.js draws from it; make-timeline.mjs writes timeline.json from it.
import {tickTaus} from './kin.js';

export const DURATION = 33;

export const GHOST = {case: 0, lid: 0.1, train: 0.1, escape: 0.1, fork: 0.1, roller: 0.1, balance: 0.07, barrel: 0.1};
// text: which block of the console shows. op: group opacities (1 unless listed). rate: watch seconds per film second.
export const STAGES = [
  {id: 'intro', t: 0, text: 'intro', view: 'dial', rate: 1, op: {}},
  {id: 'flip', t: 3.4, text: 'intro', view: 'back', rate: 1, op: {}},
  {id: 'barrel', t: 5.4, text: 'barrel', view: 'barrel', rate: 1, op: {...GHOST, barrel: 1}},
  {id: 'train', t: 10.6, text: 'train', view: 'train', rate: 120, explode: 0.4, op: {...GHOST, barrel: 1, lid: 1, train: 1, escape: 0.14}},
  {id: 'escape', t: 16.8, text: 'escape', view: 'escape', rate: 0.125, op: {...GHOST, escape: 1, fork: 1, roller: 1, balance: 0.1}},
  {id: 'balance', t: 23.6, text: 'balance', view: 'balance', rate: 1, op: {...GHOST, escape: 1, fork: 1, roller: 1, balance: 1}},
  {id: 'outro', t: 28.2, text: 'outro', view: 'back', rate: 1, op: {}},
  {id: 'dial', t: 29.9, text: 'outro', view: 'dial', rate: 1, op: {}},
];
export const GROUP_KEYS = ['case', 'dial', 'plate', 'barrel', 'lid', 'train', 'escape', 'fork', 'roller', 'balance'];

export const smoother = (x) => {
  const u = Math.min(1, Math.max(0, x));
  return u * u * u * (u * (u * 6 - 15) + 10);
};
export const ss = (a, b, t) => smoother((t - a) / (b - a));
export const stageIndex = (t) => {
  let i = 0;
  while (i < STAGES.length - 1 && STAGES[i + 1].t <= t) i++;
  return i;
};

// ------------------------------------------------------------ watch time: the rate eased between stages, integrated once
const RAMP = 0.8;
export const rateAt = (t) => {
  const i = stageIndex(t);
  const cur = STAGES[i].rate;
  if (i === 0) return cur;
  const prev = STAGES[i - 1].rate;
  // ease in the log of the rate, so 120x -> 1/8x passes through 1x halfway
  return Math.exp(Math.log(prev) + (Math.log(cur) - Math.log(prev)) * ss(STAGES[i].t, STAGES[i].t + RAMP, t));
};
const DT = 1 / 960;
const TAUS = new Float64Array(Math.ceil((DURATION + 1) / DT) + 2);
for (let i = 1; i < TAUS.length; i++) TAUS[i] = TAUS[i - 1] + rateAt((i - 0.5) * DT) * DT;
export const tauAt = (t) => {
  const u = Math.max(0, Math.min(TAUS.length - 2, t / DT));
  const i = Math.floor(u);
  return TAUS[i] + (TAUS[i + 1] - TAUS[i]) * (u - i);
};
// film time of a watch time (tau is monotonic)
const timeOfTau = (tau) => {
  let lo = 0;
  let hi = TAUS.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (TAUS[mid] < tau) lo = mid;
    else hi = mid;
  }
  return (lo + (tau - TAUS[lo]) / (TAUS[hi] - TAUS[lo] || 1)) * DT;
};
/** Film times of the ticks that can be heard one by one: every tick while the watch runs at 1x or slower. */
export const audibleTicks = () => {
  const out = [];
  for (const tau of tickTaus(0, tauAt(DURATION))) {
    const t = timeOfTau(tau);
    if (rateAt(t) <= 1.5 && t < DURATION - 0.05) out.push(+t.toFixed(4));
  }
  return out;
};

