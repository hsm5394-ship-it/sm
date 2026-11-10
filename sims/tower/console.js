// The overlay: a fixed 1600 x 900 layout of panels, charts, buttons and callouts. update(s) redraws it from the
// frame's state; nothing here computes physics.
export const VIEWS = ['hero', 'frame', 'damper', 'base'];
export const CUTS = ['skin', 'ghost', 'section'];
export const OVERLAYS = ['wind', 'load', 'labels'];
export const EXAG = [1, 100, 300];
const LABEL = {
  hero: '전체', frame: '골조', damper: '댐퍼', base: '기초',
  skin: '외피', ghost: '투시', section: '단면',
  wind: '바람', load: '하중', labels: '이름표',
};
const ACC = '#e3462a';
const INK = '#1d2329';
const DIM = '#7b858d';

const CSS = `
.ui{position:absolute;inset:0;pointer-events:none;color:${INK};font-family:'Inter','Apple SD Gothic Neo','Malgun Gothic','Noto Sans KR','WenQuanYi Zen Hei',sans-serif;-webkit-font-smoothing:antialiased}
.ui .mono{font-family:'JetBrains Mono','Apple SD Gothic Neo','Malgun Gothic','Noto Sans KR','WenQuanYi Zen Hei',monospace}
.ui .panel{position:absolute;width:274px;background:rgba(250,251,252,.93);border:1px solid #d5dbdf;border-radius:6px;padding:13px 14px}
.ui .cap{font-size:10px;font-weight:700;letter-spacing:.5px;color:${DIM};display:flex;justify-content:space-between;gap:8px;white-space:nowrap}
.ui .cap b{color:${INK};font-weight:700}
.ui .big{font-size:34px;font-weight:800;letter-spacing:-1px;line-height:1.05;color:${ACC}}
.ui .big small{font-size:13px;font-weight:700;letter-spacing:.3px;color:${INK};margin-left:6px}
.ui .note{font-size:11.5px;line-height:1.45;color:#4d565e;margin-top:6px}
.ui .row{display:flex;justify-content:space-between;align-items:baseline;font-size:11.5px;margin-top:5px;white-space:nowrap}
.ui .row span:last-child{font-weight:700}
.ui canvas{display:block}
.ui .ttl{position:absolute;left:36px;top:30px}
.ui .ttl i{display:block;width:44px;height:3px;background:${ACC};margin-bottom:10px}
.ui .ttl h1{margin:0;font-size:27px;font-weight:800;letter-spacing:-.8px;white-space:nowrap}
.ui .ttl p{margin:7px 0 0;font-size:10px;font-weight:600;letter-spacing:1.3px;color:${DIM};white-space:nowrap}
.ui .windnum{position:absolute;left:36px;top:108px;width:274px}
.ui .windnum .v{font-size:66px;font-weight:800;letter-spacing:-3px;line-height:1;color:${ACC}}
.ui .windnum .u{font-size:15px;font-weight:700;margin-left:6px}
.ui .windnum .k{position:absolute;right:0;top:8px;text-align:right;font-size:11px;font-weight:700;letter-spacing:.6px;color:${DIM};line-height:1.6}
.ui .windnum .k b{display:block;color:${INK};font-size:12px}
.ui .bar{position:relative;height:9px;background:#e3e8eb;border-radius:2px;margin-top:5px;overflow:hidden}
.ui .bar u{position:absolute;left:0;top:0;bottom:0;background:${INK};border-radius:2px}
.ui .bar.acc u{background:${ACC}}
.ui .bar.cool u{background:#3f7fc0}
.ui .bt{pointer-events:auto;cursor:pointer;user-select:none;display:inline-flex;align-items:center;justify-content:center;height:26px;padding:0 10px;border:1px solid #c9d1d6;border-radius:3px;background:#fff;font-size:11.5px;font-weight:700;letter-spacing:.3px;color:${INK};white-space:nowrap}
.ui .bt:hover{filter:brightness(.96)}
.ui .bt.on{background:${INK};border-color:${INK};color:#fff}
.ui .bt.hot.on{background:${ACC};border-color:${ACC}}
.ui .grp{display:flex;gap:5px;margin-top:6px;flex-wrap:wrap}
.ui .grp .bt{flex:1}
.ui .sl{position:relative;height:22px;margin-top:4px;pointer-events:auto;cursor:ew-resize;touch-action:none}
.ui .sl:before{content:'';position:absolute;left:0;right:0;top:10px;height:2px;background:#cfd6da}
.ui .sl u{position:absolute;left:0;top:10px;height:2px;background:${ACC}}
.ui .sl s{position:absolute;top:4px;width:8px;height:14px;margin-left:-4px;background:${ACC};border-radius:1px}
.ui .caption{position:absolute;left:330px;width:940px;bottom:58px;text-align:center;font-size:18px;font-weight:700;letter-spacing:-.3px;line-height:1.4;color:${INK}}
.ui .caption span{display:inline-block;padding:7px 16px;border-radius:6px;background:rgba(250,251,252,.92);border:1px solid #d5dbdf}
.ui .caption b{color:${ACC}}
.ui .hint{position:absolute;left:330px;width:940px;bottom:12px;text-align:center;font-size:10px;font-weight:600;letter-spacing:1.4px;color:#9aa3aa}
.ui .scale{position:absolute;left:330px;width:940px;bottom:34px;text-align:center;font-size:10.5px;font-weight:700;letter-spacing:1px;color:${DIM}}
.ui .scale b{color:${ACC}}
.ui .co{position:absolute;font-size:12px;font-weight:800;line-height:1.25;white-space:nowrap;text-shadow:0 0 5px #e8ecef,0 0 5px #e8ecef,0 0 9px #e8ecef}
.ui .co small{display:block;font-size:10px;font-weight:600;letter-spacing:.4px;color:#5d676f}
.ui .lines{position:absolute;left:0;top:0}
.ui .cursor{position:absolute;width:22px;height:22px;margin:-2px 0 0 -3px;pointer-events:none}
.ui .ring{position:absolute;width:44px;height:44px;margin:-22px 0 0 -22px;border:2px solid ${ACC};border-radius:50%;pointer-events:none}
`;

const el = (tag, cls, html, parent) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html !== undefined) e.innerHTML = html;
  if (parent) parent.appendChild(e);
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
const fmt = (x, d = 0) => x.toLocaleString('en-US', {minimumFractionDigits: d, maximumFractionDigits: d});
const windClass = (v) => (v < 5 ? '잔잔함' : v < 14 ? '산들바람 ~ 센바람' : v < 25 ? '강풍' : v < 33 ? '태풍 (중)' : v < 44 ? '태풍 (강)' : v < 54 ? '태풍 (매우 강)' : '태풍 (초강력)');
const feel = (mg) => (mg < 0.5 ? '전혀 못 느낌' : mg < 1.5 ? '거의 못 느낌' : mg < 3 ? '예민한 사람은 느낌' : mg < 6 ? '대부분 느낌' : '불쾌함 · 멀미');

export function createConsole(app) {
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);
  const root = el('div', 'ui', '', app);
  const btn = {};
  const spots = {};

  el('div', 'ttl', `<i></i><h1>초고층은 왜 안 쓰러질까</h1><p class="mono">TAIPEI 101 · 508 M · 101층 · 단순화 구조 모델</p>`, root);
  const wind = el('div', 'windnum', `<span class="v">0</span><span class="u">m/s</span><div class="k mono"><b></b><span></span></div>`, root);
  const windV = wind.querySelector('.v');
  const windK = wind.querySelector('.k b');
  const windC = wind.querySelector('.k span');

  // ---------------------------------------------------------- left: sway, overturning, controls
  const p1 = el('div', 'panel', `<div class="cap"><span>꼭대기 흔들림</span><b class="mono" id="swayNow"></b></div>`, root);
  Object.assign(p1.style, {left: '36px', top: '196px'});
  const chart = cv(246, 92, p1);
  chart.c.style.marginTop = '8px';
  el('div', 'row', `<span><i style="display:inline-block;width:14px;height:2px;background:${ACC};vertical-align:middle;margin-right:5px"></i>댐퍼 켬</span><span id="ampOn"></span>`, p1);
  el('div', 'row', `<span><i style="display:inline-block;width:14px;height:2px;background:#9aa3aa;vertical-align:middle;margin-right:5px"></i>댐퍼 끔 (같은 바람)</span><span id="ampOff"></span>`, p1);
  el('div', 'row', `<span>체감 가속도</span><span id="acc"></span>`, p1);

  const p2 = el('div', 'panel', `<div class="cap"><span>넘어뜨리는 힘 vs 버티는 무게</span></div>
    <div class="row"><span>바람이 넘기려는 힘</span><span id="mOt"></span></div><div class="bar acc"><u id="bOt"></u></div>
    <div class="row"><span>무게가 버티는 힘</span><span id="mRe"></span></div><div class="bar"><u style="width:100%"></u></div>
    <div class="note">무게 70만 t이 바람보다 <b id="sf" style="color:${ACC};font-size:15px"></b> 세게 버팁니다.</div>`, root);
  Object.assign(p2.style, {left: '36px', top: '424px'});

  const p3 = el('div', 'panel', '', root);
  Object.assign(p3.style, {left: '36px', top: '596px'});
  el('div', 'cap', `<span>바람 세기</span><b class="mono" id="vLab"></b>`, p3);
  const slWind = el('div', 'sl', '<u></u><s></s>', p3);
  el('div', 'cap', `<span>시간 배속</span><b class="mono" id="spLab"></b>`, p3).style.marginTop = '8px';
  const slSpeed = el('div', 'sl', '<u></u><s></s>', p3);
  const g3 = el('div', 'grp', '', p3);
  btn.tmd = el('div', 'bt hot', '', g3);
  btn.quake = el('div', 'bt', '지진 일으키기', g3);
  const g3b = el('div', 'grp', '', p3);
  btn.play = el('div', 'bt', '', g3b);
  btn.calm = el('div', 'bt', '바람 끄기', g3b);

  // ---------------------------------------------------------- right: damper, columns, views
  const p4 = el('div', 'panel', `<div class="cap"><span>동조질량댐퍼</span><b class="mono">660 t · 87–92층</b></div>`, root);
  Object.assign(p4.style, {left: '1290px', top: '30px'});
  const pend = cv(246, 112, p4);
  pend.c.style.marginTop = '6px';
  el('div', 'row', `<span>공의 위치 (바닥 기준)</span><span id="rel"></span>`, p4);
  el('div', 'row', `<span>열로 버리는 에너지</span><span id="pw"></span>`, p4);
  el('div', 'note', '건물이 한쪽으로 갈 때 공은 뒤처져 반대로 당기고, 그 움직임을 유압 댐퍼가 열로 바꿉니다.', p4);

  const p5 = el('div', 'panel', `<div class="cap"><span>메가칼럼이 받는 힘</span><b class="mono">기둥 1개</b></div>
    <div class="row"><span>바람 받는 쪽 <i style="color:#3f7fc0">■</i></span><span id="nW"></span></div><div class="bar cool"><u id="bW"></u></div>
    <div class="row"><span>바람 반대쪽 <i style="color:${ACC}">■</i></span><span id="nL"></span></div><div class="bar acc"><u id="bL"></u></div>
    <div class="note" id="colNote"></div>`, root);
  Object.assign(p5.style, {left: '1290px', top: '296px'});

  const p6 = el('div', 'panel', '', root);
  Object.assign(p6.style, {left: '1290px', top: '490px'});
  const group = (title, keys, cls = '') => {
    el('div', 'cap', `<span>${title}</span>`, p6).style.marginTop = p6.children.length > 1 ? '10px' : '0';
    const g = el('div', 'grp', '', p6);
    for (const k of keys) btn[k] = el('div', `bt ${cls}`, LABEL[k] ?? k, g);
  };
  group('카메라', VIEWS);
  group('건물 보기', CUTS);
  group('겹쳐 보기', OVERLAYS, 'hot');
  el('div', 'cap', `<span>휨 과장 (실제는 눈에 안 보임)</span>`, p6).style.marginTop = '10px';
  const gx = el('div', 'grp', '', p6);
  for (const x of EXAG) btn[`x${x}`] = el('div', 'bt', x === 1 ? '실제' : `×${x}`, gx);

  const scale = el('div', 'scale mono', '', root);
  const caption = el('div', 'caption', '', root);
  el('div', 'hint mono', '드래그 회전 · 스크롤 확대 · 스페이스 일시정지', root);
  const lines = cv(1600, 900, root);
  lines.c.className = 'lines';
  const coPool = [];
  const cursor = el('div', 'cursor', `<svg viewBox="0 0 22 22" width="22" height="22"><path d="M3 2l14 8-6 1.6L8.4 18z" fill="#1d2329" stroke="#fff" stroke-width="1.4" stroke-linejoin="round"/></svg>`, root);
  const ring = el('div', 'ring', '', root);

  const $ = (id) => root.querySelector(`#${id}`);
  const N = {swayNow: $('swayNow'), ampOn: $('ampOn'), ampOff: $('ampOff'), acc: $('acc'), mOt: $('mOt'), bOt: $('bOt'), mRe: $('mRe'), sf: $('sf'), vLab: $('vLab'), spLab: $('spLab'), rel: $('rel'), pw: $('pw'), nW: $('nW'), nL: $('nL'), bW: $('bW'), bL: $('bL'), colNote: $('colNote')};
  const setSl = (s, k) => {
    s.children[0].style.width = `${k * 100}%`;
    s.children[1].style.left = `${k * 100}%`;
  };
  // where the tour's cursor clicks: the centre of each control, in stage pixels
  const measure = () => {
    const r0 = app.getBoundingClientRect();
    const k = r0.width / 1600 || 1;
    const centre = (e) => {
      const r = e.getBoundingClientRect();
      return [(r.left + r.width / 2 - r0.left) / k, (r.top + r.height / 2 - r0.top) / k];
    };
    for (const key in btn) spots[key] = centre(btn[key]);
    spots.wind = centre(slWind);
    spots.speed = centre(slSpeed);
    return {wind: slWind.getBoundingClientRect(), k};
  };

  let cap = '';
  const update = (s) => {
    windV.textContent = fmt(s.v);
    windK.textContent = `${fmt(s.v * 3.6)} km/h`;
    windC.textContent = windClass(s.v);
    N.vLab.textContent = `${fmt(s.v)} m/s`;
    N.spLab.textContent = `×${fmt(s.speed, 1)}`;
    setSl(slWind, s.v / s.vMax);
    setSl(slSpeed, s.speedK);
    N.swayNow.textContent = `${s.x >= 0 ? '+' : '−'}${fmt(Math.abs(s.x) * 100)} cm`;
    N.ampOn.textContent = `±${fmt(s.ampOn * 100)} cm`;
    N.ampOff.textContent = `±${fmt(s.ampOff * 100)} cm`;
    N.acc.textContent = `${fmt(s.mg, 1)} milli-g · ${feel(s.mg)}`;
    N.mOt.textContent = `${fmt(s.ot.M / 1e9, 1)} GN·m`;
    N.mRe.textContent = `${fmt(s.ot.R / 1e9, 0)} GN·m`;
    N.bOt.style.width = `${Math.min(100, (s.ot.M / s.ot.R) * 100)}%`;
    N.sf.textContent = s.v < 3 ? '—' : s.ot.safety > 999 ? '999배 이상' : `${fmt(s.ot.safety)}배`;
    N.rel.textContent = s.tmd ? `${s.rel >= 0 ? '+' : '−'}${fmt(Math.abs(s.rel) * 100)} cm` : '고정됨';
    N.pw.textContent = s.tmd ? `${fmt(s.power / 1000, 2)} kW` : '0 kW';
    N.nW.textContent = `${fmt(s.cols.windward / 1e6)} MN`;
    N.nL.textContent = `${fmt(s.cols.leeward / 1e6)} MN`;
    N.bW.style.width = `${(s.cols.windward / (s.cols.gravity * 1.5)) * 100}%`;
    N.bL.style.width = `${(s.cols.leeward / (s.cols.gravity * 1.5)) * 100}%`;
    N.colNote.innerHTML = `바람이 없을 때는 둘 다 ${fmt(s.cols.gravity / 1e6)} MN. 바람 받는 쪽도 <b>여전히 눌려 있어</b> 뿌리째 들리지 않습니다.`;
    btn.tmd.textContent = s.tmd ? '댐퍼 켜짐' : '댐퍼 꺼짐 (고정)';
    btn.tmd.classList.toggle('on', s.tmd);
    btn.play.textContent = s.paused ? '▶ 재생' : '❚❚ 일시정지';
    btn.quake.classList.toggle('on', s.quake >= 0);
    for (const k of VIEWS) btn[k].classList.toggle('on', s.view === k);
    for (const k of CUTS) btn[k].classList.toggle('on', s.cut === k);
    for (const k of OVERLAYS) btn[k].classList.toggle('on', !!s.overlay[k]);
    for (const x of EXAG) btn[`x${x}`].classList.toggle('on', s.exag === x);
    scale.innerHTML = s.exag === 1 ? '건물의 휨: 실제 비율' : `건물의 휨을 <b>${s.exag}배</b> 과장해서 그림 · 댐퍼 공은 실제 비율`;
    if (cap !== s.caption) {
      cap = s.caption;
      caption.innerHTML = `<span>${cap}</span>`;
    }

    // sway history: the last 40 s of both towers under the same wind
    {
      const {g, w, h} = chart;
      g.clearRect(0, 0, w, h);
      const lim = Math.max(0.05, ...s.hist.off.map(Math.abs), ...s.hist.on.map(Math.abs)) * 1.15;
      const Y = (x) => h / 2 - (x / lim) * (h / 2 - 3);
      g.strokeStyle = '#d9dfe3';
      g.lineWidth = 1;
      g.beginPath();
      g.moveTo(0, h / 2);
      g.lineTo(w, h / 2);
      g.stroke();
      const draw = (a, col, lw) => {
        g.strokeStyle = col;
        g.lineWidth = lw;
        g.beginPath();
        a.forEach((x, i) => (i ? g.lineTo((i / (s.hist.n - 1)) * w, Y(x)) : g.moveTo(0, Y(x))));
        g.stroke();
      };
      draw(s.hist.off, '#9aa3aa', 1.2);
      draw(s.hist.on, ACC, 1.7);
      g.fillStyle = DIM;
      g.font = "600 9px 'JetBrains Mono',monospace";
      g.fillText(`+${fmt(lim * 100)} cm`, 2, 10);
      g.fillText(`−${fmt(lim * 100)} cm`, 2, h - 3);
      g.textAlign = 'right';
      g.fillText('최근 40초', w - 2, 10);
      g.textAlign = 'left';
    }
    // the damper from the side: floor, cables, ball, the 1.2 m bumper travel
    {
      const {g, w, h} = pend;
      g.clearRect(0, 0, w, h);
      const k = 34; // px per metre of travel (the ball itself is drawn smaller than scale)
      const cx = w / 2;
      const top = 8;
      const by = 62;
      const R = 21;
      g.strokeStyle = '#c3cbd0';
      g.lineWidth = 1;
      g.setLineDash([3, 3]);
      for (const d of [-s.snub, s.snub]) {
        g.beginPath();
        g.moveTo(cx + d * k, top + 10);
        g.lineTo(cx + d * k, by + R + 12);
        g.stroke();
      }
      g.setLineDash([]);
      g.fillStyle = INK;
      g.fillRect(cx - 70, top, 140, 3);
      const bx = cx + s.rel * k;
      g.strokeStyle = INK;
      g.lineWidth = 1.2;
      for (const d of [-20, 20]) {
        g.beginPath();
        g.moveTo(cx + d, top + 3);
        g.lineTo(bx + d * 0.6, by - R * 0.75);
        g.stroke();
      }
      g.fillStyle = '#d6a13c';
      g.beginPath();
      g.arc(bx, by, R, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = ACC;
      g.lineWidth = 2.5;
      g.beginPath();
      g.moveTo(cx, by + R + 8);
      g.lineTo(bx, by + R + 8);
      g.stroke();
      g.fillStyle = INK;
      g.fillRect(cx - 0.5, by + R + 3, 1, 10);
      g.fillStyle = DIM;
      g.font = "600 9px 'JetBrains Mono',monospace";
      g.textAlign = 'center';
      g.fillText(`−${s.snub} m`, cx - s.snub * k, h - 2);
      g.fillText(`+${s.snub} m`, cx + s.snub * k, h - 2);
      g.fillText('0', cx, h - 2);
      g.textAlign = 'left';
    }
    // callouts: a dot on the part, a leader, a name
    {
      const {g} = lines;
      g.clearRect(0, 0, 1600, 900);
      let i = 0;
      for (const c of s.callouts) {
        const d = coPool[i] || (coPool[i] = el('div', 'co', '', root));
        i++;
        d.style.display = 'block';
        d.style.opacity = c.o;
        d.innerHTML = `${c.name}<small>${c.sub}</small>`;
        const right = c.label[0] > c.at[0];
        d.style.left = right ? `${c.label[0]}px` : '';
        d.style.right = right ? '' : `${1600 - c.label[0]}px`;
        d.style.textAlign = right ? 'left' : 'right';
        d.style.top = `${c.label[1] - 9}px`;
        g.globalAlpha = c.o;
        g.strokeStyle = INK;
        g.lineWidth = 1;
        g.beginPath();
        g.moveTo(c.at[0], c.at[1]);
        g.lineTo(c.label[0] + (right ? -6 : 6), c.label[1]);
        g.stroke();
        g.fillStyle = ACC;
        g.beginPath();
        g.arc(c.at[0], c.at[1], 3.2, 0, Math.PI * 2);
        g.fill();
      }
      g.globalAlpha = 1;
      for (; i < coPool.length; i++) coPool[i].style.display = 'none';
    }
    cursor.style.transform = `translate(${s.cursor.x}px,${s.cursor.y}px) scale(${s.cursor.press ? 0.86 : 1})`;
    ring.style.display = s.cursor.ring > 0.01 ? 'block' : 'none';
    ring.style.transform = `translate(${s.cursor.ringX}px,${s.cursor.ringY}px) scale(${1.25 - s.cursor.ring * 0.7})`;
    ring.style.opacity = s.cursor.ring;
  };
  return {root, btn, spots, slWind, slSpeed, measure, update};
}
