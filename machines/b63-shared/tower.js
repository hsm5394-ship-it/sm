// 63빌딩 (63 SQUARE, Yeouido, Seoul) in numbers. Metres, seconds. No three.js in here: one set of functions poses the
// model, draws the charts and fills the readouts.
//
// Published: roof 249.6 m (commonly rounded to 249 m), antenna tip 274 m, 60 floors above ground + 3 below (= 63),
// completed 1985, 166,097 m2 gross floor area, 13,516 gold double-reflective panes, elevators at 540 m/min,
// floors 1..39 narrow as they rise, designed to sway about 30 cm at the top in a 40 m/s wind.
// Not published in anything I could reach: the plan dimensions. LONG, DEPTH_TOP and DEPTH_BASE are estimates from
// the building's proportions and are marked as such on the page.

export const B = {
  roof: 249.6,
  tip: 274,
  floors: 60,
  basements: 3,
  year: 1985,
  gfa: 166097,
  panes: 13516,
  taperTop: 39, // the last floor that is narrower than the one below it
  long: 62, // estimate
  depthTop: 22, // estimate
  depthBase: 44, // estimate
  basementH: 4.6,
  vmaxMin: 540, // m/min
  accel: 1.0, // m/s2, a comfortable passenger elevator
  dwell: 5,
  swayMax: 0.3, // m at the roof ...
  swayWind: 40, // ... in this wind, m/s
  period: 6.0, // s, about 0.1 s per storey
};
export const FLOOR_H = B.roof / B.floors; // 4.16 m average, floor to floor
export const VMAX = B.vmaxMin / 60; // 9 m/s

/** Height of floor n's slab above ground. Floor 1 is the ground slab (0), floor 61 the roof. Basements: 0, -1, -2. */
export const floorY = (n) => (n >= 1 ? (n - 1) * FLOOR_H : n * B.basementH - B.basementH);
export const Y_TAPER = floorY(B.taperTop + 1);

/** The short dimension of the plan at height y: flared at the ground, straight from floor 40 up. */
export const depthAt = (y) => {
  const u = Math.min(1, Math.max(0, 1 - y / Y_TAPER));
  return B.depthTop + (B.depthBase - B.depthTop) * Math.pow(u, 2.1);
};
export const plateArea = (n) => B.long * depthAt(floorY(n));

// ------------------------------------------------------------ what each floor is for
export const ZONES = [
  {id: 'base', from: -2, to: 0, name: '지하 B1–B3', sub: '주차 · 기계실 · 상가', col: '#8a94a3'},
  {id: 'lobby', from: 1, to: 3, name: '1–3F 로비', sub: '로비 · 연회 · 상업', col: '#c7a35a'},
  {id: 'low', from: 4, to: 20, name: '4–20F 저층 오피스', sub: '기준층 사무실', col: '#b4bfca'},
  {id: 'ref1', from: 21, to: 21, name: '21F 피난안전구역', sub: '2012 설치', col: '#e3562a'},
  {id: 'mid', from: 22, to: 37, name: '22–37F 중층 오피스', sub: '기준층 사무실', col: '#b4bfca'},
  {id: 'ref2', from: 38, to: 38, name: '38F 피난안전구역', sub: '2012 설치', col: '#e3562a'},
  {id: 'high', from: 39, to: 56, name: '39–56F 고층 오피스', sub: '폭이 일정한 구간', col: '#b4bfca'},
  {id: 'dine', from: 57, to: 59, name: '57–59F 레스토랑', sub: '스카이 라운지', col: '#c7a35a'},
  {id: 'deck', from: 60, to: 60, name: '60F 전망층', sub: '한강 전망', col: '#e0b84c'},
];
export const zoneOf = (n) => ZONES.find((z) => n >= z.from && n <= z.to);

// ------------------------------------------------------------ the elevators
// One trip: accelerate at B.accel to VMAX, cruise, brake. If the run is too short to reach VMAX the profile is a triangle.
export function trip(dist) {
  const ta = Math.min(VMAX / B.accel, Math.sqrt(dist / B.accel));
  const v = B.accel * ta;
  const da = 0.5 * B.accel * ta * ta;
  const tc = (dist - 2 * da) / v;
  return {dist, ta, tc, v, T: 2 * ta + tc};
}
const along = (tr, t) => {
  if (t <= 0) return [0, 0];
  if (t >= tr.T) return [tr.dist, 0];
  if (t < tr.ta) return [0.5 * B.accel * t * t, B.accel * t];
  if (t < tr.ta + tr.tc) return [0.5 * B.accel * tr.ta * tr.ta + tr.v * (t - tr.ta), tr.v];
  const r = tr.T - t;
  return [tr.dist - 0.5 * B.accel * r * r, B.accel * r];
};
// The cars drawn. x is the shaft's place along the core, lo/hi the floors it shuttles between.
export const CARS = [
  {id: 'A', x: -13.5, lo: 1, hi: 60, phase: 0, express: true},
  {id: 'B', x: -8.1, lo: 1, hi: 20, phase: 7},
  {id: 'C', x: -2.7, lo: 1, hi: 38, phase: 19},
  {id: 'D', x: 2.7, lo: -2, hi: 21, phase: 31},
  {id: 'E', x: 8.1, lo: 1, hi: 56, phase: 12},
  {id: 'F', x: 13.5, lo: 1, hi: 60, phase: 41, express: true},
].map((c) => {
  const tr = trip(floorY(c.hi) - floorY(c.lo));
  return {...c, tr, cycle: 2 * (tr.T + B.dwell)};
});
/** Car c at time t: height, signed speed, the floor it is passing, 0..1 through its cycle. */
export function carAt(c, t) {
  const u = (((t + c.phase) % c.cycle) + c.cycle) % c.cycle;
  const y0 = floorY(c.lo);
  let d;
  let v;
  if (u < c.tr.T) [d, v] = along(c.tr, u);
  else if (u < c.tr.T + B.dwell) [d, v] = [c.tr.dist, 0];
  else if (u < 2 * c.tr.T + B.dwell) {
    [d, v] = along(c.tr, u - c.tr.T - B.dwell);
    d = c.tr.dist - d;
    v = -v;
  } else [d, v] = [0, 0];
  const y = y0 + d;
  const f = y >= 0 ? Math.round(y / FLOOR_H) + 1 : Math.round(y / B.basementH);
  return {y, v, floor: f, u: u / c.cycle, t: u};
}
export const floorName = (f) => (f >= 1 ? `${f}F` : `B${1 - f}`);

// ------------------------------------------------------------ the wind
/** Roof displacement in metres at time t in a steady wind v (m/s): a mean lean plus the first mode rocking on it. */
export function swayAt(v, t) {
  const amp = B.swayMax * Math.pow(Math.min(v, 60) / B.swayWind, 2);
  return {amp, x: amp * (0.45 + 0.55 * Math.sin((2 * Math.PI * t) / B.period))};
}
