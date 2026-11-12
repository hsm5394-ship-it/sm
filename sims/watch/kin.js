// The mechanical watch movement as numbers: a classic hand-wound 18,000 vibrations/hour going train with a Swiss lever
// escapement. One input, the watch time tau (seconds), poses everything. Lengths in mm, angles in radians unless a
// name ends in Deg. No three.js in here.
//
// Going train (teeth / pinion leaves):
//   barrel 84 -> centre pinion 12      barrel turns once in 7 h, 6.57 turns = 46 h of reserve
//   centre wheel 64 -> third pinion 8  centre arbor: 1 rev / hour, carries the minute hand
//   third wheel 60 -> fourth pinion 8  fourth arbor: 1 rev / minute, carries the seconds hand
//   fourth wheel 70 -> escape pinion 7 escape wheel: 10 rev / minute
//   escape wheel 15 teeth, one tooth released per 2 beats: 15 * 2 * 10 = 300 beats/min = 5 beats/s = 18,000 /h
export const D2R = Math.PI / 180;
export const TAU = Math.PI * 2;

export const TRAIN = {
  barrel: {z: 84, m: 0.19},
  centrePinion: {z: 12, m: 0.19},
  centre: {z: 64, m: 0.14},
  thirdPinion: {z: 8, m: 0.14},
  third: {z: 60, m: 0.12},
  fourthPinion: {z: 8, m: 0.12},
  fourth: {z: 70, m: 0.1},
  escapePinion: {z: 7, m: 0.1},
};
export const ESC = {z: 15, rTip: 2.4, rRoot: 1.8, stepDeg: 12, stoneHalfW: 0.175};
export const BAL = {hz: 2.5, ampDeg: 270, liftDeg: 26, R: 5.6, pinR: 0.75, forkL: 2.65, springTurns: 8};
export const RESERVE_H = 46;
export const PLATE_R = 18.3;

const cd = (a, b) => (a.m * (a.z + b.z)) / 2;
const dir = (deg) => [Math.cos(deg * D2R), Math.sin(deg * D2R)];
const add = (p, d, k) => [p[0] + d[0] * k, p[1] + d[1] * k];
const ang = (a, b) => Math.atan2(b[1] - a[1], b[0] - a[0]);

// Plan positions, seen from the movement side (x right, y up). The fourth wheel sits at 6 o'clock under the small
// seconds; the third wheel is where its two meshes put it (two circles intersecting).
const C = [0, 0];
const B = add(C, dir(150), cd(TRAIN.barrel, TRAIN.centrePinion));
const F = [0, -8.2];
const T = (() => {
  const r1 = cd(TRAIN.centre, TRAIN.thirdPinion);
  const r2 = cd(TRAIN.third, TRAIN.fourthPinion);
  const y = (F[1] * F[1] - r2 * r2 + r1 * r1) / (2 * F[1]);
  return [-Math.sqrt(r1 * r1 - y * y), y];
})();
const E = add(F, dir(25), cd(TRAIN.fourth, TRAIN.escapePinion));
export const BETA_DEG = 65; // the line escape wheel -> pallet fork -> balance
// the pallets embrace 2.5 teeth (60 deg), so the fork pivots where the two tangents meet
const P = add(E, dir(BETA_DEG), ESC.rTip / Math.cos(30 * D2R));
const BALC = add(P, dir(BETA_DEG), BAL.pinR + BAL.forkL);
export const POS = {C, B, T, F, E, P, BAL: BALC};

// Heights above the main plate (z = 0 is the plate's top face)
export const Z = {barrelGear: 0.5, fourth: 2.5, centre: 3.1, escape: 3.3, fork: 3.45, third: 3.7, roller: 3.75, balance: 5.0, spring: 5.55};

// b meshes a: a has a tooth centred on its local angle 0, so does b. alpha is the direction a -> b.
const mesh = (thA, zA, zB, alpha) => alpha + Math.PI - Math.PI / zB - ((thA - alpha) * zA) / zB;
const A_FE = ang(F, E);
const A_FT = ang(F, T);
const A_TC = ang(T, C);
const A_CB = ang(C, B);

const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const sstep = (a, b, x) => {
  const u = clamp((x - a) / (b - a), 0, 1);
  return u * u * (3 - 2 * u);
};

export const FORK_MAX_DEG = (BAL.pinR / BAL.forkL) * BAL.liftDeg; // 7.4 deg each side
// a tooth's leading corner rests on the upstream face of the entry stone when the step count is even
const ESC_PHASE = (BETA_DEG + 30) * D2R + ESC.stoneHalfW / ESC.rTip;

export const START = 10 * 3600 + 8 * 60 + 37; // the hands read 10:08:37 at tau = 0

/** Everything the movement does at watch time tau (seconds since the film's start). */
export function pose(tau) {
  const balDeg = BAL.ampDeg * Math.sin(TAU * BAL.hz * tau);
  // the balance crosses centre 5 times a second; crossing k happens at tau = k / 5
  const k = Math.round(2 * BAL.hz * tau);
  const s = k % 2 === 0 ? 1 : -1;
  // 0..1 through the lift angle of crossing k: unlock first, then impulse and drop
  const x = clamp(((s * balDeg) / BAL.liftDeg + 1) / 2, 0, 1);
  const steps = k + sstep(0.22, 1, x);
  const forkDeg = -FORK_MAX_DEG * clamp(balDeg / BAL.liftDeg, -1, 1);

  const fourth = steps * ESC.stepDeg * D2R * (TRAIN.escapePinion.z / TRAIN.fourth.z);
  const escPinion = mesh(fourth, TRAIN.fourth.z, TRAIN.escapePinion.z, A_FE);
  const escape0 = mesh(0, TRAIN.fourth.z, TRAIN.escapePinion.z, A_FE);
  const escape = ESC_PHASE + (escPinion - escape0);
  const third = mesh(fourth, TRAIN.fourthPinion.z, TRAIN.third.z, A_FT);
  const centre = mesh(third, TRAIN.thirdPinion.z, TRAIN.centre.z, A_TC);
  const barrel = mesh(centre, TRAIN.centrePinion.z, TRAIN.barrel.z, A_CB);

  // the hands: seconds on the fourth arbor, minutes on the centre arbor, hours through the 12:1 motion works
  const secRate = fourth; // rad, 6 deg per second on average
  const now = START + (secRate / TAU) * 60;
  const hands = {
    sec: (START / 60) * TAU + secRate,
    min: (START / 3600) * TAU + secRate / 60,
    hour: (START / 43200) * TAU + secRate / 720,
  };
  return {tau, balDeg, bal: balDeg * D2R, k, x, steps, forkDeg, fork: forkDeg * D2R, fourth, escPinion, escape, third, centre, barrel, hands, now, inLift: x > 0.001 && x < 0.999};
}

/** Tick times (watch seconds) in [a, b): the drop at the end of each crossing's lift, a hair after centre. */
export const tickTaus = (a, b) => {
  const out = [];
  for (let k = Math.ceil(a * 2 * BAL.hz); k / (2 * BAL.hz) < b; k++) out.push(k / (2 * BAL.hz));
  return out;
};

export const clock = (now) => {
  const s = Math.floor(now);
  const p = (n) => String(n).padStart(2, '0');
  return `${p(Math.floor(s / 3600) % 12 || 12)}:${p(Math.floor(s / 60) % 60)}:${p(s % 60)}`;
};
