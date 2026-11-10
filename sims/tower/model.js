// The math of a tall building under wind, with Taipei 101 as the reference. No three.js in here.
// One input: the wind speed at roof height (m/s), plus time. Everything on screen reads from these functions.
//
// Published figures: 508 m to the spire tip, 101 floors, a 660 t tuned mass damper hung between floors 87 and 92,
// 8 mega-columns of 2.4 x 3.0 m, 380 piles to 80 m, a first sway period near 6.8 s, about 700,000 t in all.
// Everything else (modal mass, drag, the share of load each part takes) is a simplified engineering estimate.
export const G = 9.81;
export const P = {
  H: 508, // spire tip, m
  roof: 438, // top of floor 101, m
  B: 56, // mean face width the wind sees, m
  base: 63, // tower width at the ground, m
  T1: 6.8, // first sway period, s
  zeta1: 0.01, // the bare frame's own damping
  Mstar: 1.2e8, // first-mode mass referred to the roof, kg (estimate)
  mTmd: 6.6e5, // the damper ball, kg
  W: 7.0e8 * G, // total weight, N
  Wcols: 0.5 * 5.0e8 * G, // gravity carried by the 8 mega-columns at the base, N (estimate: half the superstructure)
  rho: 1.225,
  Cd: 1.3,
  profile: 0.75, // the wind is slower near the ground: mean pressure over the height / pressure at the roof
  arm: 0.55, // height of the wind resultant / roof height
  modal: 0.45, // share of the total wind force that loads the first mode
  outrigger: 0.6, // share of the overturning moment the outriggers hand to the mega-columns (the core bends the rest)
  colX: [22, 22, -22, -22, 11, 11, -11, -11], // mega-column offsets along the wind, m
};
const W1 = (2 * Math.PI) / P.T1;
export const K1 = P.Mstar * W1 * W1;
const C1 = 2 * P.zeta1 * P.Mstar * W1;
const MU = P.mTmd / P.Mstar;
// Den Hartog's tuning for a damper on a lightly damped frame
const W2 = W1 / (1 + MU);
const Z2 = Math.sqrt((3 * MU) / (8 * Math.pow(1 + MU, 3)));
const K2 = P.mTmd * W2 * W2;
const C2 = 2 * Z2 * P.mTmd * W2;
export const SNUB = 1.2;
export const TMD = {mu: MU, period: (2 * Math.PI) / W2, zeta: Z2, length: G / (W2 * W2)};

/** total wind force on the tower, N */
export const windForce = (v) => 0.5 * P.rho * P.Cd * P.B * P.roof * P.profile * v * v;
/** overturning moment at the ground and the moment the weight resists with about the leeward edge, N m */
export const overturn = (v) => {
  const M = windForce(v) * P.arm * P.roof;
  const R = (P.W * P.base) / 2;
  return {M, R, safety: M > 0 ? R / M : Infinity};
};
/** axial force in the windward and leeward face mega-columns, N (compression positive) */
export const columns = (v) => {
  const g = P.Wcols / 8;
  const sum = P.colX.reduce((a, x) => a + x * x, 0);
  const d = (overturn(v).M * P.outrigger * 22) / sum;
  return {gravity: g, windward: g - d, leeward: g + d, delta: d};
};
/** the first mode's shape: 0 at the ground, 1 at the roof */
export const phi = (y) => Math.pow(Math.min(1.16, Math.max(0, y / P.roof)), 1.5);
export const dphi = (y) => (y <= 0 ? 0 : (1.5 / P.roof) * Math.sqrt(Math.min(1.16, y / P.roof)));

// gusts: a fixed set of sines around the mean, a few of them near the tower's own frequency (what makes it resonate)
const F1 = 1 / P.T1;
const GUST = [
  [0.021, 0.1, 0.3], [0.037, 0.09, 1.7], [0.058, 0.08, 4.1], [0.083, 0.06, 2.6], [0.112, 0.045, 5.3],
  [F1 * 0.93, 0.012, 0.9], [F1 * 0.985, 0.014, 3.3], [F1 * 1.0, 0.012, 5.9], [F1 * 1.02, 0.014, 1.2], [F1 * 1.07, 0.012, 4.4],
  [0.21, 0.03, 2.2], [0.29, 0.025, 0.6], [0.41, 0.02, 3.9],
];
export const gust = (t) => GUST.reduce((a, [f, k, p]) => a + k * Math.sin(2 * Math.PI * f * t + p), 0);
/** ground acceleration of the demo earthquake, m/s2; tau = seconds since it started */
export const QUAKE_DUR = 14;
export const quake = (tau) => {
  if (tau < 0 || tau > QUAKE_DUR) return 0;
  const env = Math.pow(Math.sin((Math.PI * tau) / QUAKE_DUR), 1.2) * (tau < 4 ? 1 : Math.exp(-(tau - 4) / 5));
  return env * G * 0.2 * (0.035 * Math.sin(2 * Math.PI * 0.16 * tau) + 0.05 * Math.sin(2 * Math.PI * 0.45 * tau + 1) + 0.06 * Math.sin(2 * Math.PI * 1.1 * tau + 2) + 0.05 * Math.sin(2 * Math.PI * 2.3 * tau + 0.5));
};

/** One tower: x1 roof sway, x2 the ball (absolute). `tmd` false locks the ball to the floor. */
export function createSim(tmd) {
  const s = {tmd, x1: 0, v1: 0, x2: 0, v2: 0, a1: 0, power: 0, acc2: 0, t: 0};
  const H = 1 / 240;
  s.step = (dt, v, quakeTau) => {
    let left = dt;
    while (left > 1e-9) {
      const h = Math.min(H, left);
      left -= h;
      s.t += h;
      const mean = windForce(v) * P.modal;
      const f = mean * (1 + gust(s.t)) - P.Mstar * 1.4 * quake(quakeTau === null ? -1 : quakeTau + (dt - left));
      if (s.tmd) {
        const rel = s.x2 - s.x1;
        // past 1.2 m the ball meets its bumper ring: a stiff, lossy stop (the real one allows 1.5 m)
        const over = Math.max(0, Math.abs(rel) - SNUB);
        const fk = K2 * rel + C2 * (s.v2 - s.v1) + (over > 0 ? Math.sign(rel) * 40 * K2 * over + 6 * C2 * (s.v2 - s.v1) : 0);
        s.a1 = (f - K1 * s.x1 - C1 * s.v1 + fk) / P.Mstar;
        const a2 = -fk / P.mTmd;
        s.v1 += s.a1 * h;
        s.v2 += a2 * h;
        s.x1 += s.v1 * h;
        s.x2 += s.v2 * h;
        s.power += (C2 * (s.v2 - s.v1) ** 2 - s.power) * (h / 6);
      } else {
        s.a1 = (f - K1 * s.x1 - C1 * s.v1) / (P.Mstar + P.mTmd);
        s.v1 += s.a1 * h;
        s.x1 += s.v1 * h;
        s.x2 = s.x1;
        s.v2 = s.v1;
        s.power += (0 - s.power) * (h / 6);
      }
      s.acc2 += (s.a1 * s.a1 - s.acc2) * (h / 25);
    }
  };
  /** start at rest in the mean wind, so a page that opens does not ring */
  s.settle = (v) => {
    s.x1 = s.x2 = (windForce(v) * P.modal) / K1;
    s.v1 = s.v2 = 0;
  };
  /** rms roof acceleration in milli-g */
  s.mg = () => (Math.sqrt(s.acc2) / G) * 1000;
  return s;
}
