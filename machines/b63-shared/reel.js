// 63빌딩, the vertical cut for Instagram Reels: 540 x 960 CSS (1080 x 1920 at dpr 2), 28 s. No console: the tower fills
// the frame and one caption at a time says what is happening. Short-form order: the glass is already coming off in the
// first second, each beat changes the state, and the last frame is the first one again so the loop closes.
// A pure function of t, on the same model, stage and numbers as the wide film.
import {runSim} from 'teardown-kit/runtime.js';
import {SWAY_GAIN, SYS} from './console.js';
import {SLOT} from './model.js';
import {createTowerStage} from './stage.js';
import {B, carAt, CARS, floorName, swayAt, trip, floorY} from './tower.js';

const W = 540;
const H = 960;
export const DURATION = 28;
const TR = trip(floorY(60) - floorY(1));
export const SCRIPT = [
  {t: 0, view: 'hero', cap: ['63빌딩,', '다 뜯어보면?'], sub: '서울 여의도 · 1985'},
  {t: 0.9, slide: 'explode', to: 1, dur: 1.8},
  {t: 3.0, cap: ['금색 유리', '13,516장'], sub: '외벽 전체가 이중 반사유리'},
  {t: 5.6, slide: 'layout', to: 1, dur: 2.2},
  {t: 5.6, slide: 'explode', to: 0.3, dur: 2.2},
  {t: 5.8, view: 'row', cap: ['다섯 겹으로', '늘어놓기'], sub: '커튼월 · 철골 · 슬래브 · 코어 · 지하'},
  {t: 8.6, isolate: 'glass', cap: ['1 커튼월'], sub: '금색 이중 반사유리 13,516장'},
  {t: 10.0, isolate: 'frame', cap: ['2 철골'], sub: '1–39층은 오를수록 좁아진다'},
  {t: 11.4, isolate: 'slab', cap: ['3 바닥 슬래브'], sub: '지상 60개 층 · 건물 연면적 166,097㎡'},
  {t: 12.8, isolate: 'core', view: 'core', cap: ['4 코어'], sub: '엘리베이터 분속 540 m = 초속 9 m'},
  {t: 16.2, isolate: 'base', view: 'base', cap: ['5 지하 · 옥탑'], sub: '지하 3개 층 · 안테나 끝 274 m'},
  {t: 18.2, isolate: 'base', view: 'hero', cap: ['다시 조립'], sub: ''},
  {t: 18.2, slide: 'layout', to: 0, dur: 2.0},
  {t: 18.2, slide: 'explode', to: 0, dur: 2.2},
  {t: 20.8, view: 'side', cap: ['강풍엔 옥상이', '30 cm 흔들린다'], sub: '초속 40 m 설계 기준 · 화면은 60배 과장'},
  {t: 21.2, slide: 'wind', to: 40, dur: 1.2},
  {t: 24.2, slide: 'wind', to: 6, dur: 1.0},
  {t: 24.6, view: 'hero', cap: ['60층 + 지하 3층', '= 63빌딩'], sub: '지붕 높이 249.6 m'},
];
const START = {explode: 0, layout: 0, wind: 6};
const D2R = Math.PI / 180;
const smoother = (x) => {
  const u = Math.min(1, Math.max(0, x));
  return u * u * u * (u * (u * 6 - 15) + 10);
};
const ss = (a, b, t) => smoother((t - a) / (b - a));
const slideAt = (key, t) => {
  let v = START[key];
  for (const e of SCRIPT) if (e.slide === key && e.t <= t) v += (e.to - v) * ss(e.t, e.t + e.dur, t);
  return v;
};
const ghostAt = (t) => {
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
// u = seconds on the view, L = how laid out, e = how exploded
const VIEW_FN = {
  hero: (u, L, e) => ({tx: 0, ty: 124, tz: 0, az: 34 + 1.2 * u, el: 9, d: 1240 + 280 * e + 500 * L, sy: 22}),
  row: (u, L, e) => ({tx: 0, ty: 118, tz: 0, az: 61 + 0.8 * u, el: 15, d: 1700, sy: 60}),
  core: (u, L) => ({tx: L * SLOT.core, ty: 136, tz: 0, az: 40 + 1.5 * u, el: 7, d: 1120, sy: 36}),
  base: (u, L) => ({tx: L * SLOT.base, ty: 22, tz: 0, az: 34 + 2 * u, el: 17, d: 520, sy: 36}),
  side: (u) => ({tx: 0, ty: 124, tz: 0, az: 90 + 0.6 * u, el: 4, d: 1300, sy: 22}),
};
const VIEWS = SCRIPT.filter((e) => e.view).map((e) => [e.t, e.view]);
const camAt = (t, L, e) => {
  let i = 0;
  while (i < VIEWS.length - 1 && VIEWS[i + 1][0] <= t) i++;
  const cur = VIEW_FN[VIEWS[i][1]](t - VIEWS[i][0], L, e);
  if (i === 0) return cur;
  const k = ss(VIEWS[i][0], VIEWS[i][0] + 1.8, t);
  if (k >= 1) return cur;
  const a = VIEW_FN[VIEWS[i - 1][1]](t - VIEWS[i - 1][0], L, e);
  const o = {};
  for (const key in cur) o[key] = key === 'az' ? a.az + ((((cur.az - a.az + 540) % 360) - 180) * k) : a[key] + (cur[key] - a[key]) * k;
  return o;
};
const CAPS = SCRIPT.filter((e) => e.cap);

const KR = `'Inter','P63','Apple SD Gothic Neo','Malgun Gothic','Noto Sans KR',sans-serif`;
const MONO = `'JetBrains Mono','P63',monospace`;
const CSS = `
html,body{background:#e6ebee}
#app{font-family:${KR};color:#1f262d;-webkit-font-smoothing:antialiased;font-variant-numeric:tabular-nums}
.rl{position:absolute;inset:0;pointer-events:none}
.rl .tag{position:absolute;left:32px;top:118px;display:flex;align-items:center;gap:8px;font:700 13px ${KR};letter-spacing:.4px}
.rl .tag i{display:block;width:22px;height:22px;border-radius:4px;background:#c9973a;color:#fff;font:800 12px Inter,sans-serif;font-style:normal;text-align:center;line-height:22px}
.rl .cap{position:absolute;left:32px;right:32px;top:150px}
.rl .cap b{display:block;font:800 43px/1.14 ${KR};letter-spacing:-1.2px}
.rl .cap b em{font-style:normal;color:#e3562a}
.rl .cap span{display:block;margin-top:10px;font:600 15px ${KR};color:#4d5862}
.rl .g{position:absolute;top:706px;height:40px;padding:6px 10px;border-radius:6px;background:rgba(250,252,253,.92);border:1px solid #d7dee3}
.rl .g u{display:block;text-decoration:none;font:600 10.5px ${KR};color:#6b7680}
.rl .g s{display:block;text-decoration:none;font:700 15px ${MONO};margin-top:1px;white-space:nowrap}
.rl .bar{position:absolute;left:32px;right:32px;top:756px;height:2px;background:rgba(31,38,45,.12)}
.rl .bar i{display:block;height:2px;background:#e3562a}
`;

export const DEFAULTS = {duration: DURATION, fps: 30, theme: 'light', hud: {enabled: false, title: '63빌딩', subtitle: '릴스'}, director: {enabled: false}, watermark: ''};

export function makeReel() {
  return async ({canvas, capture}) => {
    const st = createTowerStage({canvas});
    const resize = () => st.resize(W, H, capture ? devicePixelRatio || 1 : Math.min(devicePixelRatio || 1, 2));
    resize();
    const style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);
    const ui = document.createElement('div');
    ui.className = 'rl';
    ui.innerHTML = `<div class="tag"><i>63</i>63빌딩 분해도</div><div class="cap"><b></b><span></span></div>
      <div class="g" style="left:32px;width:150px"><u>엘리베이터 A</u><s data-ev></s></div>
      <div class="g" style="left:192px;width:150px"><u>풍속 · 옥상 변위</u><s data-w></s></div>
      <div class="g" style="left:352px;width:156px"><u>1F → 60F</u><s>${TR.dist.toFixed(0)} m · ${TR.T.toFixed(0)}초</s></div>
      <div class="bar"><i></i></div>`;
    document.getElementById('app').appendChild(ui);
    const cap = ui.querySelector('.cap');
    const capB = cap.querySelector('b');
    const capS = cap.querySelector('span');
    const ev = ui.querySelector('[data-ev]');
    const wd = ui.querySelector('[data-w]');
    const bar = ui.querySelector('.bar i');
    // the number in a caption is the accent
    const mark = (line) => line.replace(/(13,516장|30 cm|63빌딩|^\d )/, '<em>$1</em>');
    let shown = -1;
    return {
      resize,
      render(t) {
        const explode = slideAt('explode', t);
        const layout = slideAt('layout', t);
        const wind = slideAt('wind', t);
        const sway = swayAt(wind, t - 4).x; // the roof is at full lean 2.7 s into the gust
        const cam = camAt(t, layout, explode);
        st.frame({time: t, explode, layout, xray: 0, cut: 0, ghost: ghostAt(t), sway: sway * SWAY_GAIN}, {...cam, az: cam.az * D2R, el: cam.el * D2R, sx: 0});
        // the caption: in over 0.4 s, out over the 0.25 s before the next one
        let i = 0;
        while (i < CAPS.length - 1 && CAPS[i + 1].t <= t) i++;
        const c = CAPS[i];
        const next = CAPS[i + 1]?.t ?? DURATION + 9;
        const kin = i === 0 ? 1 : ss(c.t, c.t + 0.4, t);
        const kout = 1 - ss(next - 0.25, next, t);
        if (shown !== i) {
          shown = i;
          capB.innerHTML = c.cap.map(mark).join('<br>');
          capS.textContent = c.sub;
        }
        cap.style.opacity = (kin * kout).toFixed(3);
        cap.style.transform = `translateY(${((1 - kin) * 14).toFixed(2)}px)`;
        const car = carAt(CARS[0], t);
        ev.textContent = `${floorName(car.floor)} · ${Math.abs(car.v).toFixed(1)} m/s`;
        wd.textContent = `${wind.toFixed(0)} m/s · ${(Math.round(sway * 1000) / 10 || 0).toFixed(1)} cm`;
        bar.style.width = `${((t / DURATION) * 100).toFixed(2)}%`;
        return {};
      },
    };
  };
}
export const run = () => runSim(DEFAULTS, makeReel());
void B;
