// "Why tall buildings stay up" as a vertical 1080 x 1920 film: the tower (stage.js) under the model's wind
// (model.js), with a caption for every beat, a wind readout, a sway chart and one fact card per scene.
// render(t) is a pure function of t: both towers (damper free, damper locked) are integrated once at load into
// tables on the film's own clock, and every camera move and display toggle is eased from SCRIPT's times.
import {runSim} from 'teardown-kit/runtime.js';
import {columns, createSim, overturn, phi, QUAKE_DUR} from './model.js';
import {COLS, createTowerStage, floorY, TMD_Y} from './stage.js';

export const W = 1080;
export const H = 1920;
export const FPS = 30;
const D2R = Math.PI / 180;
const EXAG = 100;
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const smoother = (x) => {
  const u = clamp(x, 0, 1);
  return u * u * u * (u * (u * 6 - 15) + 10);
};
const ss = (a, b, t) => smoother((t - a) / (b - a));
const lerp = (a, b, k) => a + (b - a) * k;
const fmt = (x, d = 0) => x.toLocaleString('en-US', {minimumFractionDigits: d, maximumFractionDigits: d});

// ------------------------------------------------------------ the film's beats (seconds)
export const BEAT = {
  open: 0,
  wind: 3.0,
  weight: 9.0,
  ghost: 15.0,
  frame: 18.5,
  damper: 26.0,
  locked: 33.5,
  lockedWide: 36.0,
  freed: 44.0,
  base: 48.5,
  quake: 55.0,
  quakeWide: 57.0,
  close: 63.0,
  end: 68.0,
};
export const DURATION = BEAT.end;
const B = BEAT;
const SCENES = [
  {t: B.open, lines: ['높은 건물은 꼿꼿이 버티지 않습니다', '<b>조금씩 휘면서</b> 힘을 흘려보냅니다']},
  {t: B.wind + 0.6, lines: ['태풍급 바람, <b>초속 50 m</b>', '꼭대기가 <b>10 cm 넘게</b> 흔들립니다']},
  {t: B.weight, lines: ['그래도 안 넘어갑니다', '<b>무게</b>가 바람보다 훨씬 세게 버팁니다'], card: 'weight'},
  {t: B.ghost, lines: ['유리 속에는 뼈대가 있습니다', '가운데 <b>코어</b>, 바깥 <b>메가칼럼 8개</b>']},
  {t: B.frame, lines: ['<b>아웃리거</b>가 둘을 묶어', '휘는 힘을 기둥을 누르는 힘으로 바꿉니다'], card: 'cols'},
  {t: B.damper, lines: ['꼭대기 근처에 매달린 <b>660톤 쇠공</b>', '건물과 엇박자로 흔들립니다'], card: 'ball'},
  {t: B.locked, lines: ['이 댐퍼가 없다면?', '같은 바람에 흔들림이 <b>약 두 배</b>'], card: 'sway'},
  {t: B.freed, lines: ['댐퍼가 있으면', '이만큼 <b>잔잔해집니다</b>'], card: 'sway'},
  {t: B.base, lines: ['무게는 <b>말뚝 380개</b>를 타고', '지하 80 m 암반까지 내려갑니다'], card: 'base'},
  {t: B.quake, lines: ['지진에도 원리는 같습니다', '부러지지 않고 <b>휘었다가 되돌아옵니다</b>']},
  {t: B.close, lines: ['<b>무게</b>로 버티고 · <b>뼈대</b>로 나누고', '<b>댐퍼</b>로 잠재운다']},
];
const windAt = (t) => lerp(12, 50, ss(B.wind, B.wind + 2.6, t));
// sim seconds per film second: slower while the ground shakes so the quake reads
const speedAt = (t) => lerp(5, 2, ss(B.quake - 0.4, B.quake, t) * (1 - ss(B.close - 0.6, B.close, t)));
// 0 = the tower with its damper, 1 = its twin with the ball locked
const lockedAt = (t) => ss(B.locked, B.locked + 0.7, t) * (1 - ss(B.freed, B.freed + 0.7, t));

// ------------------------------------------------------------ both towers, integrated once on the film's clock
const DT = 1 / 60;
const N = Math.ceil(DURATION / DT) + 2;
const TAB = {on: new Float32Array(N), off: new Float32Array(N), rel: new Float32Array(N), power: new Float32Array(N), mgOn: new Float32Array(N), mgOff: new Float32Array(N), windX: new Float32Array(N), quake: new Float32Array(N)};
{
  const a = createSim(true);
  const b = createSim(false);
  for (const s of [a, b]) {
    s.settle(windAt(0));
    s.step(240, windAt(0), null);
  }
  let wx = 0;
  let q = -1;
  for (let i = 0; i < N; i++) {
    const t = i * DT;
    TAB.on[i] = a.x1;
    TAB.off[i] = b.x1;
    TAB.rel[i] = a.x2 - a.x1;
    TAB.power[i] = a.power;
    TAB.mgOn[i] = a.mg();
    TAB.mgOff[i] = b.mg();
    TAB.windX[i] = wx;
    TAB.quake[i] = q;
    const v = windAt(t);
    const d = DT * speedAt(t);
    const tau = t >= B.quake && q < QUAKE_DUR + 3 ? Math.max(0, q) : null;
    a.step(d, v, tau !== null && tau < QUAKE_DUR ? tau : null);
    b.step(d, v, tau !== null && tau < QUAKE_DUR ? tau : null);
    if (t >= B.quake) q = q < 0 ? 0 : q + d;
    wx += v * d * 0.9;
  }
}
const look = (A, t) => {
  const u = clamp(t / DT, 0, N - 2);
  const i = Math.floor(u);
  return A[i] + (A[i + 1] - A[i]) * (u - i);
};
/** half the peak-to-peak sway over the 8 s before t */
const ampAt = (A, t) => {
  let lo = Infinity;
  let hi = -Infinity;
  for (let i = Math.max(0, Math.round((t - 8) / DT)); i <= Math.min(N - 1, Math.round(t / DT)); i++) {
    lo = Math.min(lo, A[i]);
    hi = Math.max(hi, A[i]);
  }
  return (hi - lo) / 2;
};

// ------------------------------------------------------------ cameras: target in metres, sy shifts the picture up
const VIEW_FN = {
  hero: (u) => ({tx: 0, ty: 250, tz: 0, az: 22 + 0.9 * u, el: 6, d: 2180, follow: 0, sy: -150}),
  frame: (u) => ({tx: 0, ty: 268, tz: 0, az: 36 + 1.5 * u, el: 11, d: 620, follow: 0.6, sy: -120}),
  damper: (u) => ({tx: 0, ty: TMD_Y.ball - 0.5, tz: 0, az: 30 + 2.0 * u, el: 1.5, d: 112, follow: 1, sy: -10}),
  base: (u) => ({tx: 0, ty: -12, tz: 0, az: 28 + 1.3 * u, el: 3.5, d: 900, follow: 0, sy: -150}),
};
const VIEWS = [[0, 'hero'], [B.frame, 'frame'], [B.damper, 'damper'], [B.lockedWide, 'hero'], [B.base, 'base'], [B.quakeWide, 'hero']];
const camAt = (t) => {
  let i = 0;
  while (i < VIEWS.length - 1 && VIEWS[i + 1][0] <= t) i++;
  const cur = VIEW_FN[VIEWS[i][1]](t - VIEWS[i][0]);
  if (i === 0) return cur;
  const k = ss(VIEWS[i][0], VIEWS[i][0] + 1.8, t);
  if (k >= 1) return cur;
  const prev = VIEW_FN[VIEWS[i - 1][1]](t - VIEWS[i - 1][0]);
  const o = {};
  for (const key in cur) o[key] = key === 'd' ? Math.exp(lerp(Math.log(prev.d), Math.log(cur.d), k)) : lerp(prev[key], cur[key], k);
  return o;
};
const viewAt = (t) => VIEWS.filter(([a]) => a <= t).pop();
const within = (a, b, t, d = 0.7) => ss(a, a + d, t) * (1 - ss(b - d, b, t));

// the parts a callout names, per view: [name, sub, point in metres, tag]
const PARTS = {
  hero: [
    ['동조질량댐퍼', '660 t 쇠공', [0, TMD_Y.ball, 0]],
    ['아웃리거 층', '모두 11곳', [22, floorY(58) + 4, 22]],
    ['메가칼럼', '8개', [22, 70, 11]],
  ],
  frame: [
    ['코어', '중심 뼈대', [-11.25, floorY(63), 11.25]],
    ['아웃리거 트러스', '코어 ↔ 메가칼럼', [17, floorY(58) + 4, 11]],
    ['메가칼럼', '빨강: 더 눌림', [22, floorY(54), 11]],
  ],
  damper: [
    ['쇠공 660 t', '지름 5.5 m', [0, TMD_Y.ball + 1.6, 2.2], 'ball'],
    ['유압 댐퍼', '움직임을 열로', [6.6, TMD_Y.floor + 1.2, 4.4]],
    ['케이블', '92층에 매달림', [3.2, TMD_Y.top - 6, 3.0]],
  ],
  base: [
    ['매트 기초', '두께 약 4.5 m', [44, -2.3, 46]],
    ['말뚝 380개', '깊이 80 m', [42.7, -34, 42.3]],
    ['암반', '단단한 층', [-42.7, -66, 42.3]],
  ],
};

const ACC = '#e3462a';
const INK = '#1d2329';
const DIM = '#6f7982';
const KO = "'Inter','Apple SD Gothic Neo','Malgun Gothic','Noto Sans KR','Noto Sans CJK KR','WenQuanYi Zen Hei',sans-serif";
const CSS = `
html,body{background:#e8ecef;overflow:hidden}
#app{position:absolute!important;inset:auto!important;left:0;top:0;width:${W}px;height:${H}px}
.f{position:absolute;inset:0;color:${INK};font-family:${KO};-webkit-font-smoothing:antialiased}
.f .ttl{position:absolute;left:56px;top:150px}
.f .ttl i{display:block;width:84px;height:6px;background:${ACC};margin-bottom:20px}
.f .ttl{text-shadow:0 0 10px #e8ecef,0 0 10px #e8ecef,0 0 18px #e8ecef,0 0 18px #e8ecef}
.f .ttl h1{margin:0;font-size:76px;font-weight:800;letter-spacing:-2.6px;line-height:1.05;white-space:nowrap}
.f .ttl p{margin:14px 0 0;font-size:27px;font-weight:600;letter-spacing:.4px;color:${DIM};white-space:nowrap}
.f .card{position:absolute;background:rgba(250,251,252,.94);border:2px solid #d5dbdf;border-radius:14px;padding:22px 26px}
.f .cap{font-size:26px;font-weight:700;color:${DIM};white-space:nowrap}
.f .num{font-size:118px;font-weight:800;letter-spacing:-5px;line-height:1;color:${ACC};white-space:nowrap}
.f .num small{font-size:34px;font-weight:700;letter-spacing:0;color:${INK};margin-left:10px}
.f .sub{font-size:27px;font-weight:700;margin-top:8px;white-space:nowrap}
.f .sway b{font-size:64px;font-weight:800;letter-spacing:-2px;color:${ACC};line-height:1.1;display:block;white-space:nowrap}
.f .fact{left:40px;top:1270px;width:1000px;height:204px;box-sizing:border-box}
.f .row{display:flex;justify-content:space-between;align-items:baseline;font-size:34px;font-weight:700;white-space:nowrap}
.f .row + .bar + .row{margin-top:16px}
.f .row span:last-child{font-weight:800}
.f .bar{position:relative;height:18px;background:#e3e8eb;border-radius:4px;margin-top:8px;overflow:hidden}
.f .bar u{position:absolute;left:0;top:0;bottom:0;border-radius:4px}
.f .two{display:flex;gap:28px;height:100%;align-items:center}
.f .two div{flex:1}
.f .two .v{font-size:76px;font-weight:800;letter-spacing:-3px;line-height:1.05;white-space:nowrap}
.f .two .l{font-size:30px;font-weight:700;color:${DIM};white-space:nowrap}
.f .caption{position:absolute;left:40px;width:1000px;top:1496px;height:176px;display:flex;flex-direction:column;justify-content:center;text-align:center;font-size:47px;font-weight:800;letter-spacing:-1.4px;line-height:1.36;white-space:nowrap;background:rgba(250,251,252,.94);border:2px solid #d5dbdf;border-radius:14px;box-sizing:border-box}
.f .caption b{color:${ACC}}
.f .scale{position:absolute;right:56px;top:586px;text-align:right;font-size:25px;font-weight:700;line-height:1.35;color:${DIM};white-space:nowrap}
.f .scale b{color:${ACC}}
.f .co{position:absolute;font-size:36px;font-weight:800;line-height:1.2;letter-spacing:-.8px;white-space:nowrap;text-shadow:0 0 8px #e8ecef,0 0 8px #e8ecef,0 0 14px #e8ecef,0 0 14px #e8ecef}
.f .co small{display:block;font-size:26px;font-weight:700;letter-spacing:-.2px;color:#4d565e}
.f canvas{display:block}
.f .lines{position:absolute;left:0;top:0}
`;
const el = (tag, cls, html, parent) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html !== undefined) e.innerHTML = html;
  parent.appendChild(e);
  return e;
};
const cv = (w, h, parent) => {
  const c = el('canvas', '', undefined, parent);
  c.width = w * 2;
  c.height = h * 2;
  c.style.width = `${w}px`;
  c.style.height = `${h}px`;
  const g = c.getContext('2d');
  g.scale(2, 2);
  return {c, g, w, h};
};
const windClass = (v) => (v < 14 ? '산들바람' : v < 25 ? '강풍' : v < 33 ? '태풍 (중)' : v < 44 ? '태풍 (강)' : '태풍 (매우 강)');
const bar = (label, value, k, col) => `<div class="row"><span>${label}</span><span>${value}</span></div><div class="bar"><u style="width:${clamp(k, 0, 1) * 100}%;background:${col}"></u></div>`;

function createOverlay(app) {
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);
  const root = el('div', 'f', '', app);
  el('div', 'ttl', `<i></i><h1>초고층은 왜<br>안 쓰러질까</h1><p>타이베이 101 · 508 m · 단순화 구조 모델</p>`, root);
  const wind = el('div', 'card', `<div class="cap">바람 세기</div><div class="num"></div><div class="sub"></div>`, root);
  Object.assign(wind.style, {left: '40px', top: '500px', width: '330px'});
  const sway = el('div', 'card sway', `<div class="cap">꼭대기 흔들림</div><b></b>`, root);
  Object.assign(sway.style, {right: '40px', top: '236px', width: '330px'});
  const chart = cv(330, 110, sway);
  const swayNote = el('div', 'cap', '', sway);
  swayNote.style.cssText = 'font-size:23px;margin-top:8px';
  const scale = el('div', 'scale', `건물의 휨은 <b>${EXAG}배</b> 과장<br>실제로는 눈에 안 보입니다`, root);
  const fact = el('div', 'card fact', '', root);
  const caption = el('div', 'caption', '', root);
  const lines = cv(W, H, root);
  lines.c.className = 'lines';
  const pool = [];
  let capKey = -1;
  let factKey = '';

  const update = (s) => {
    wind.children[1].innerHTML = `${fmt(s.v)}<small>m/s</small>`;
    wind.children[2].textContent = `${fmt(s.v * 3.6)} km/h · ${windClass(s.v)}`;
    sway.children[1].textContent = `±${fmt(s.amp * 100)} cm`;
    swayNote.innerHTML = s.locked > 0.5 ? `<span style="color:${INK}">■</span> 댐퍼 없음` : `<span style="color:${ACC}">■</span> 댐퍼 있음`;
    scale.style.opacity = s.scaleO;
    {
      const {g, w, h} = chart;
      g.clearRect(0, 0, w, h);
      const lim = Math.max(0.06, s.chartLim) * 1.12;
      const Y = (x) => h / 2 - (x / lim) * (h / 2 - 4);
      g.strokeStyle = '#d5dbdf';
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(0, h / 2);
      g.lineTo(w, h / 2);
      g.stroke();
      const draw = (a, col, lw, alpha) => {
        g.globalAlpha = alpha;
        g.strokeStyle = col;
        g.lineWidth = lw;
        g.lineJoin = 'round';
        g.beginPath();
        a.forEach((x, i) => (i ? g.lineTo((i / (a.length - 1)) * w, Y(x)) : g.moveTo(0, Y(x))));
        g.stroke();
        g.globalAlpha = 1;
      };
      draw(s.histOff, INK, 2.5, 0.25 + 0.75 * s.locked);
      draw(s.histOn, ACC, 3.5, 1 - 0.6 * s.locked);
    }
    // the caption: the scene's two lines, faded at each change
    if (capKey !== s.scene) {
      capKey = s.scene;
      caption.innerHTML = SCENES[s.scene].lines.map((l) => `<div>${l}</div>`).join('');
    }
    caption.style.opacity = s.capO;
    // the fact card
    fact.style.opacity = s.cardO;
    const key = `${s.card}|${s.cardText}`;
    if (factKey !== key) {
      factKey = key;
      fact.innerHTML = s.cardHtml;
    }
    // callouts
    const {g} = lines;
    g.clearRect(0, 0, W, H);
    let i = 0;
    for (const c of s.callouts) {
      const d = pool[i] || (pool[i] = el('div', 'co', '', root));
      i++;
      d.style.display = 'block';
      d.style.opacity = c.o;
      d.innerHTML = `${c.name}<small>${c.sub}</small>`;
      const right = c.label[0] > c.at[0];
      d.style.left = right ? `${c.label[0]}px` : '';
      d.style.right = right ? '' : `${W - c.label[0]}px`;
      d.style.textAlign = right ? 'left' : 'right';
      d.style.top = `${c.label[1] - 22}px`;
      g.globalAlpha = c.o;
      g.strokeStyle = INK;
      g.lineWidth = 2.5;
      g.beginPath();
      g.moveTo(c.at[0], c.at[1]);
      g.lineTo(c.label[0] + (right ? -12 : 12), c.label[1]);
      g.stroke();
      g.fillStyle = ACC;
      g.beginPath();
      g.arc(c.at[0], c.at[1], 8, 0, Math.PI * 2);
      g.fill();
    }
    g.globalAlpha = 1;
    for (; i < pool.length; i++) pool[i].style.display = 'none';
  };
  return {update};
}

const cardFor = (card, s) => {
  if (card === 'weight') {
    const o = overturn(s.v);
    return [fmt(o.safety), bar('바람이 넘기려는 힘', `${fmt(o.M / 1e9, 1)} GN·m`, o.M / o.R, ACC) + bar(`무게 70만 t이 버티는 힘 · <b style="color:${ACC}">${fmt(o.safety)}배</b>`, `${fmt(o.R / 1e9)} GN·m`, 1, INK)];
  }
  if (card === 'cols') {
    const c = columns(s.v);
    return [fmt(c.leeward / 1e6), bar('바람 받는 쪽 기둥 · 여전히 눌림', `${fmt(c.windward / 1e6)} MN`, c.windward / (c.gravity * 1.4), '#3f7fc0') + bar('바람 반대쪽 기둥 · 더 눌림', `${fmt(c.leeward / 1e6)} MN`, c.leeward / (c.gravity * 1.4), ACC)];
  }
  if (card === 'ball') {
    const r = `${s.rel >= 0 ? '+' : '−'}${fmt(Math.abs(s.rel) * 100)} cm`;
    const p = `${fmt(s.power / 1000, 1)} kW`;
    return [r + p, `<div class="two"><div><div class="l">공의 위치 (바닥 기준)</div><div class="v">${r}</div></div><div><div class="l">열로 버리는 에너지</div><div class="v" style="color:${ACC}">${p}</div></div></div>`];
  }
  if (card === 'sway') {
    const a = `±${fmt(s.ampOn * 100)} cm`;
    const b = `±${fmt(s.ampOff * 100)} cm`;
    return [a + b, `<div class="two"><div><div class="l">댐퍼 있음</div><div class="v" style="color:${ACC}">${a}</div></div><div><div class="l">댐퍼 없음 · 같은 바람</div><div class="v">${b}</div></div></div>`];
  }
  if (card === 'base') return ['', `<div class="two"><div><div class="l">말뚝</div><div class="v">380개</div></div><div><div class="l">깊이</div><div class="v">80 m</div></div><div><div class="l">건물 무게</div><div class="v" style="color:${ACC}">70만 t</div></div></div>`];
  return ['', ''];
};

export function makeFilm() {
  return async ({canvas, capture}) => {
    const st = createTowerStage({canvas});
    const resize = () => st.resize(W, H, capture ? devicePixelRatio || 1 : Math.min(devicePixelRatio || 1, 2));
    resize();
    const ui = createOverlay(document.getElementById('app'));
    return {
      resize,
      render(t) {
        const v = windAt(t);
        const locked = lockedAt(t);
        const xOn = look(TAB.on, t);
        const xOff = look(TAB.off, t);
        const rel = clamp(look(TAB.rel, t), -1.45, 1.45) * (1 - locked);
        const U = lerp(xOn, xOff, locked) * EXAG;
        const [vt, view] = viewAt(t);
        const ghost = within(B.ghost, B.close + 0.7, t);
        const load = within(B.weight, B.damper + 0.7, t) + within(B.lockedWide + 1, B.base + 0.7, t);
        const cols = columns(v);
        const tint = COLS.map(([x]) => clamp(((x / 22) * cols.delta) / (0.3 * cols.gravity), -1, 1) * load);
        const q = look(TAB.quake, t);
        const cam = camAt(t);
        st.frame(
          {U, rel, v, windX: look(TAB.windX, t), skin: 1 - 0.9 * ghost, section: false, ground: 1 - 0.88 * within(B.base, B.quakeWide + 0.9, t, 0.9), streaks: 1, arrows: load * (1 - within(B.damper, B.lockedWide, t)), tint, quake: q >= 0 && t >= B.quake ? q : -1},
          {...cam, az: cam.az * D2R, el: cam.el * D2R},
        );

        // callouts: alternate sides down the picture, stacked so none touch
        const labelO = within(B.ghost + 1.4, B.close, t, 0.5) * ss(vt + 1.5, vt + 2.0, t) * (1 - ss(B.lockedWide - 0.4, B.lockedWide, t) + ss(B.base, B.base + 0.1, t)) * (1 - ss(B.quakeWide - 0.4, B.quakeWide, t));
        const callouts = [];
        if (labelO > 0.02) {
          const pts = [];
          for (const [name, sub, p, tag] of PARTS[view]) {
            const at = st.project(p[0] + U * phi(p[1]) + (tag === 'ball' ? rel : 0), p[1], p[2]);
            if (at && at[0] > 80 && at[0] < W - 80 && at[1] > 700 && at[1] < 1230) pts.push({name, sub, at});
          }
          pts.sort((a, b) => a.at[1] - b.at[1]);
          const stack = (col, x) => {
            let y = 720;
            for (const c of col) {
              y = Math.max(y, Math.min(1190, c.at[1] - 30));
              callouts.push({...c, label: [x, y], o: clamp(labelO, 0, 1)});
              y += 110;
            }
          };
          stack(pts.filter((_, i) => i % 2 === 0), 400);
          stack(pts.filter((_, i) => i % 2 === 1), 690);
        }

        let scene = 0;
        while (scene < SCENES.length - 1 && SCENES[scene + 1].t <= t) scene++;
        const S = SCENES[scene];
        const nextT = scene < SCENES.length - 1 ? SCENES[scene + 1].t : DURATION + 9;
        const capO = ss(S.t, S.t + 0.35, t) * (1 - ss(nextT - 0.25, nextT, t)) || (scene === 0 && t < 0.35 ? 1 : 0);
        const ampOn = ampAt(TAB.on, t);
        const ampOff = ampAt(TAB.off, t);
        const state = {v, rel, power: look(TAB.power, t), ampOn, ampOff};
        const [cardText, cardHtml] = cardFor(S.card, state);
        const n = 121;
        const histOn = [];
        const histOff = [];
        for (let i = 0; i < n; i++) {
          const tt = t - 8 + (8 * i) / (n - 1);
          histOn.push(look(TAB.on, Math.max(0, tt)));
          histOff.push(look(TAB.off, Math.max(0, tt)));
        }
        ui.update({
          v, locked, amp: lerp(ampOn, ampOff, locked), chartLim: Math.max(...histOn.map(Math.abs), ...histOff.map(Math.abs)), histOn, histOff,
          scene, capO: scene === 0 ? 1 - ss(nextT - 0.25, nextT, t) : capO,
          card: S.card || '', cardText, cardHtml, cardO: S.card ? capO : 0,
          scaleO: 1 - within(B.frame, B.lockedWide, t) - within(B.base, B.quakeWide, t),
          callouts,
        });
        return {};
      },
    };
  };
}

export const DEFAULTS = {duration: DURATION, fps: FPS, theme: 'light', hud: {enabled: false, title: '초고층은 왜 안 쓰러질까', subtitle: ''}, director: {enabled: false}, watermark: ''};
export const run = () => runSim(DEFAULTS, makeFilm());
