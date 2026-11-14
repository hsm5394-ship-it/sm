// The 63빌딩 console, laid out at 1600 x 900: the badge and title, the building's elevation with the live car and lean,
// the express elevator's speed profile, the wind panel, the five systems you can pull out, views, display toggles,
// the three sliders (분해, 나열, 바람) and the labels with leaders into the model. update(s) redraws every live part.
import {B, CARS, depthAt, floorName, floorY, trip, VMAX, ZONES} from './tower.js';

export const C = {ink: '#1f262d', mute: '#7c8792', faint: '#ccd4da', line: '#d7dee3', panel: 'rgba(250,252,253,.95)', or: '#e3562a', gold: '#c9973a'};
export const SYS = ['glass', 'frame', 'slab', 'core', 'base'];
export const SYS_LABEL = {
  glass: ['커튼월', '금색 이중 반사유리 13,516장'],
  frame: ['철골 구조', '기둥 · 보, 1–39F 폭 감소'],
  slab: ['바닥 슬래브', '지상 60개 층 · 연면적 166,097㎡'],
  core: ['코어 · 엘리베이터', '분속 540 m 고속 승강기'],
  base: ['지하 · 옥탑', '지하 3개 층 · 안테나 274 m'],
};
export const VIEWS = ['hero', 'front', 'side', 'plan', 'core', 'deck'];
export const VIEW_LABEL = {hero: '전경', front: '정면', side: '측면', plan: '평면', core: '코어', deck: '전망층'};
export const DISPLAY = ['cut', 'xray', 'labels', 'orbit'];
export const DISPLAY_LABEL = {cut: '단면', xray: 'X-RAY', labels: '라벨', orbit: '회전'};
export const SLIDERS = ['explode', 'layout', 'wind'];
export const WIND_MAX = 40;
export const SWAY_GAIN = 60; // how much the lean is exaggerated on screen

const KR = `'Inter','P63','Apple SD Gothic Neo','Malgun Gothic','Noto Sans KR',sans-serif`;
const MONO = `'JetBrains Mono','P63','Apple SD Gothic Neo','Malgun Gothic',monospace`;
const CSS = `
#app{font-family:${KR};color:${C.ink};-webkit-font-smoothing:antialiased;font-variant-numeric:tabular-nums}
.ui{position:absolute;inset:0;pointer-events:none}
.mo{font-family:${MONO}}
.cp{position:absolute;background:${C.panel};border:1px solid ${C.line};border-radius:6px;box-shadow:0 2px 10px rgba(60,80,100,.08)}
.ph{position:absolute;display:flex;align-items:center;gap:8px;font:700 12px ${KR};letter-spacing:.6px}
.ph i{display:block;width:3px;height:13px;background:${C.or}}
.pn{position:absolute;font:500 9.5px ${MONO};color:${C.mute};letter-spacing:1px}
.sm{position:absolute;font:500 10px ${MONO};letter-spacing:.6px;color:${C.mute};white-space:nowrap}
.big{position:absolute;font:700 25px ${KR};letter-spacing:-.4px;white-space:nowrap;line-height:1}
.big small{font:600 11px ${MONO};color:${C.mute};margin-left:4px;letter-spacing:.4px}
.bt{position:absolute;height:24px;display:flex;align-items:center;justify-content:center;border:1px solid ${C.faint};border-radius:4px;background:#fff;font:700 11px ${KR};letter-spacing:.4px;color:${C.ink};white-space:nowrap}
.sy{position:absolute;height:38px;border:1px solid ${C.faint};border-radius:4px;background:#fff}
.sy b{position:absolute;left:30px;top:5px;font:700 12px ${KR}}
.sy span{position:absolute;left:30px;top:21px;font:500 9.5px ${KR};color:${C.mute};white-space:nowrap}
.sy i{position:absolute;left:10px;top:12px;width:12px;height:12px;border-radius:2px}
.call{position:absolute;white-space:nowrap}
.call b{display:flex;align-items:center;gap:6px;font:700 12px ${KR};color:${C.ink}}
.call b i{display:block;width:6px;height:6px;background:${C.or}}
.call span{display:block;font:500 9.5px ${KR};color:#5d6872;margin-top:2px}
.cur{position:absolute;left:0;top:0;z-index:50;filter:drop-shadow(0 1px 2px rgba(0,0,0,.3))}
.ring{position:absolute;width:34px;height:34px;margin:-17px 0 0 -17px;border-radius:50%;border:1.5px solid ${C.or};opacity:0;z-index:49}
`;
const el = (h) => {
  const d = document.createElement('div');
  d.innerHTML = h.trim();
  return d.firstElementChild;
};
const SYS_COL = {glass: C.gold, frame: '#56636f', slab: '#d8dde3', core: C.or, base: '#9aa3ad'};

export function createConsole(app) {
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);
  const ui = el(`<div class="ui"></div>`);
  app.appendChild(ui);
  const add = (h) => {
    const n = el(h);
    ui.appendChild(n);
    return n;
  };
  const panel = (x, y, w, h, title, n) => {
    add(`<div class="cp" style="left:${x}px;top:${y}px;width:${w}px;height:${h}px"></div>`);
    add(`<div class="ph" style="left:${x + 14}px;top:${y + 12}px"><i></i>${title}</div>`);
    add(`<div class="pn" style="right:${1600 - x - w + 14}px;top:${y + 15}px">${n}</div>`);
  };
  const btn = {};
  const spots = {};
  const button = (key, x, y, w, label) => {
    btn[key] = add(`<div class="bt" style="left:${x}px;top:${y}px;width:${w}px">${label}</div>`);
    spots[key] = [x + w / 2, y + 12];
  };

  // ------------------------------------------------------------ header
  add(`<div style="position:absolute;left:0;top:0;width:128px;height:92px;background:${C.gold}"></div>`);
  add(`<div style="position:absolute;left:24px;top:20px;color:#fff;font:800 46px Inter,sans-serif;letter-spacing:-2px;line-height:1">63</div>`);
  add(`<div class="mo" style="position:absolute;left:26px;top:70px;color:#fff;font-size:9px;letter-spacing:2.4px">60 + B3</div>`);
  add(`<div class="sm" style="left:150px;top:20px;letter-spacing:2px">SEOUL · YEOUIDO · 1985</div>`);
  add(`<div style="position:absolute;left:149px;top:35px;font:700 33px ${KR};letter-spacing:-.6px;line-height:1">63빌딩 <span style="color:${C.or};font-weight:400">/</span> <span style="font-weight:500;font-size:22px;color:#55606a">63 SQUARE</span></div>`);
  add(`<div style="position:absolute;left:150px;top:76px;font:500 12px ${KR};letter-spacing:.6px;color:#55606a">분해해서 늘어놓고 보는 건물 · 커튼월 / 철골 / 슬래브 / 코어 / 지하·옥탑</div>`);
  add(`<div style="position:absolute;right:124px;top:30px;color:${C.or};font:700 40px Inter,sans-serif;letter-spacing:-1px;line-height:1">249.6<span style="font-size:18px;margin-left:4px">m</span></div>`);
  add(`<div style="position:absolute;left:1490px;top:30px;width:1px;height:44px;background:${C.faint}"></div>`);
  add(`<div class="sm" style="left:1504px;top:31px;line-height:15px">지상 60층<br>지하 3층<br>안테나 274 m</div>`);

  // ------------------------------------------------------------ 01 elevation
  panel(28, 118, 282, 262, '건물 입면', '01');
  const elev = add(`<svg style="position:absolute;left:38px;top:148px" width="128" height="226"></svg>`);
  const stat = (y, label, value, unit) => {
    add(`<div class="sm" style="left:178px;top:${y}px">${label}</div>`);
    return add(`<div class="big" style="left:177px;top:${y + 14}px;font-size:21px">${value}<small>${unit}</small></div>`);
  };
  stat(152, '지붕 높이', '249.6', 'm');
  stat(204, '층수', '60 + 3', '층');
  stat(256, '외벽 유리', '13,516', '장');
  stat(308, '연면적', '166,097', '㎡');

  // ------------------------------------------------------------ 02 elevator
  panel(28, 392, 282, 196, '고속 엘리베이터 A', '02');
  add(`<div class="sm" style="left:42px;top:422px">현재 층</div>`);
  const evFloor = add(`<div class="big" style="left:41px;top:436px">1F</div>`);
  add(`<div class="sm" style="left:122px;top:422px">높이</div>`);
  const evY = add(`<div class="big" style="left:121px;top:436px">0<small>m</small></div>`);
  add(`<div class="sm" style="left:214px;top:422px">속도</div>`);
  const evV = add(`<div class="big" style="left:213px;top:436px">0.0<small>m/s</small></div>`);
  const evChart = add(`<svg style="position:absolute;left:42px;top:472px" width="254" height="92"></svg>`);
  const TR = trip(floorY(60) - floorY(1));
  add(`<div class="sm" style="left:42px;top:568px">1F → 60F ${TR.dist.toFixed(0)} m · ${TR.T.toFixed(1)}초 · 최고 분속 ${B.vmaxMin} m</div>`);

  // ------------------------------------------------------------ 03 wind
  panel(28, 600, 282, 152, '바람과 흔들림', '03');
  add(`<div class="sm" style="left:42px;top:630px">풍속</div>`);
  const wV = add(`<div class="big" style="left:41px;top:644px">0<small>m/s</small></div>`);
  add(`<div class="sm" style="left:150px;top:630px">옥상 변위 (실제)</div>`);
  const wS = add(`<div class="big" style="left:149px;top:644px">0.0<small>cm</small></div>`);
  const wBar = add(`<svg style="position:absolute;left:42px;top:682px" width="254" height="40"></svg>`);
  add(`<div class="sm" style="left:42px;top:730px">설계 ±30 cm @ 40 m/s · 주기 약 ${B.period.toFixed(0)}초 · 화면 ×${SWAY_GAIN}</div>`);

  // ------------------------------------------------------------ 04 systems
  panel(1290, 118, 282, 262, '분해 부품', '04');
  SYS.forEach((k, i) => {
    const y = 150 + i * 44;
    btn[k] = add(`<div class="sy" style="left:1304px;top:${y}px;width:254px"><i style="background:${SYS_COL[k]}"></i><b>${SYS_LABEL[k][0]}</b><span>${SYS_LABEL[k][1]}</span></div>`);
    spots[k] = [1304 + 200, y + 19];
  });

  // ------------------------------------------------------------ 05 views, 06 display
  panel(1290, 392, 282, 106, '보기', '05');
  VIEWS.forEach((k, i) => button(k, 1304 + (i % 3) * 86, 424 + Math.floor(i / 3) * 32, 82, VIEW_LABEL[k]));
  panel(1290, 510, 282, 76, '표시', '06');
  DISPLAY.forEach((k, i) => button(k, 1304 + i * 64.5, 542, 60.5, DISPLAY_LABEL[k]));

  // ------------------------------------------------------------ 07 what the floors are for
  panel(1290, 598, 282, 154, '층별 용도', '07');
  const legend = [ZONES[8], ZONES[7], ZONES[6], ZONES[3], ZONES[1], ZONES[0]];
  legend.forEach((z, i) => {
    const y = 630 + i * 19.5;
    const name = z.id === 'high' ? '4–56F 오피스' : z.id === 'ref1' ? '21F · 38F 피난안전구역' : z.name;
    add(`<div style="position:absolute;left:1304px;top:${y + 2}px;width:10px;height:10px;border-radius:2px;background:${z.col};border:1px solid rgba(0,0,0,.12)"></div>`);
    add(`<div style="position:absolute;left:1322px;top:${y}px;font:600 11px ${KR};white-space:nowrap">${name} <span style="color:${C.mute};font-weight:500">· ${z.id === 'high' ? '기준층 사무실' : z.sub}</span></div>`);
  });

  // ------------------------------------------------------------ the sliders
  panel(28, 764, 1544, 108, '조작', '08');
  btn.play = add(`<div class="bt" style="left:42px;top:812px;width:42px;height:36px;font-size:14px">❚❚</div>`);
  spots.play = [63, 830];
  const SL = {};
  const SL_LABEL = {explode: '분해', layout: '나열', wind: '바람'};
  SLIDERS.forEach((k, i) => {
    const x = 150 + i * 478;
    const w = 330;
    SL[k] = {x, w, y: 836};
    add(`<div style="position:absolute;left:${x}px;top:806px;font:700 13px ${KR}">${SL_LABEL[k]}</div>`);
    add(`<div style="position:absolute;left:${x}px;top:${836 - 2}px;width:${w}px;height:4px;border-radius:2px;background:${C.faint}"></div>`);
    SL[k].fill = add(`<div style="position:absolute;left:${x}px;top:${836 - 2}px;width:0;height:4px;border-radius:2px;background:${C.or}"></div>`);
    SL[k].knob = add(`<div style="position:absolute;left:${x}px;top:${836 - 8}px;width:16px;height:16px;margin-left:-8px;border-radius:50%;background:#fff;border:2px solid ${C.or};box-shadow:0 1px 3px rgba(0,0,0,.2)"></div>`);
    SL[k].val = add(`<div class="mo" style="position:absolute;left:${x + w + 16}px;top:${836 - 8}px;font-size:13px;font-weight:600;white-space:nowrap">0</div>`);
    spots[k] = [x + w, 836];
  });
  add(`<div class="sm" style="left:150px;top:852px">외피를 벗기고 지하를 들어 올린다</div>`);
  add(`<div class="sm" style="left:628px;top:852px">다섯 부품을 한 줄로 늘어놓는다</div>`);
  add(`<div class="sm" style="left:1106px;top:852px">0 – ${WIND_MAX} m/s</div>`);

  // ------------------------------------------------------------ labels, the pointer
  const callSvg = add(`<svg style="position:absolute;inset:0;overflow:visible" width="1600" height="900"></svg>`);
  const callG = add(`<div style="position:absolute;inset:0"></div>`);
  const ring = add(`<div class="ring"></div>`);
  const cur = add(`<div class="cur"><svg width="22" height="22" viewBox="0 0 34 34"><path d="M4 3 L30 13.5 L17.5 17.5 L13.5 30 Z" fill="#111" stroke="#fff" stroke-width="2.2" stroke-linejoin="round"/></svg></div>`);
  const pointer = (c) => {
    cur.style.display = c.x < 0 ? 'none' : 'block';
    cur.style.transform = `translate(${(c.x - 3).toFixed(2)}px, ${(c.y - 2).toFixed(2)}px) scale(${c.press ? 0.88 : 1})`;
    ring.style.left = `${c.ringX}px`;
    ring.style.top = `${c.ringY}px`;
    ring.style.opacity = String(c.ring * 0.85);
    ring.style.transform = `scale(${(0.35 + 0.9 * (1 - c.ring)).toFixed(3)})`;
  };

  // the elevation is drawn once per frame from depthAt(): the end view, where the flare shows
  const EV = {w: 128, h: 226, cx: 62, s: 214 / B.tip};
  const ey = (y) => 220 - y * EV.s;
  const drawElev = (s) => {
    const lean = (y) => (y > 0 ? (s.sway * SWAY_GAIN * (y / B.roof) * EV.s) : 0);
    let h = `<line x1="4" x2="124" y1="${ey(0)}" y2="${ey(0)}" stroke="${C.ink}" stroke-width="1"/>`;
    for (const z of ZONES) {
      const y0 = z.from >= 1 ? floorY(z.from) : floorY(z.from - 1);
      const y1 = z.from >= 1 ? floorY(z.to + 1) : 0;
      let l = '';
      let r = '';
      for (let i = 0; i <= 6; i++) {
        const y = y0 + ((y1 - y0) * i) / 6;
        const d = (z.from >= 1 ? depthAt(y) : B.depthBase + 22) / 2;
        l += `${(EV.cx - d * EV.s + lean(y)).toFixed(1)},${ey(y).toFixed(1)} `;
        r = `${(EV.cx + d * EV.s + lean(y)).toFixed(1)},${ey(y).toFixed(1)} ` + r;
      }
      h += `<polygon points="${l}${r}" fill="${z.col}" stroke="${C.ink}" stroke-width=".5"/>`;
    }
    h += `<line x1="${(EV.cx - 6 * EV.s + lean(B.roof)).toFixed(1)}" x2="${(EV.cx - 6 * EV.s + lean(B.roof)).toFixed(1)}" y1="${ey(B.roof)}" y2="${ey(B.tip)}" stroke="#d04b2b" stroke-width="1.4"/>`;
    for (const [y, t] of [[0, '0'], [100, '100'], [200, '200'], [B.roof, '249.6']]) h += `<line x1="96" x2="102" y1="${ey(y)}" y2="${ey(y)}" stroke="${C.mute}" stroke-width=".8"/><text x="105" y="${ey(y) + 3}" font-size="8" fill="${C.mute}" font-family="JetBrains Mono">${t}</text>`;
    const cy = ey(s.car.y);
    h += `<circle cx="${(EV.cx + lean(s.car.y)).toFixed(1)}" cy="${cy.toFixed(1)}" r="3.4" fill="${C.or}" stroke="#fff" stroke-width="1"/><line x1="8" x2="${(EV.cx + lean(s.car.y) - 5).toFixed(1)}" y1="${cy.toFixed(1)}" y2="${cy.toFixed(1)}" stroke="${C.or}" stroke-width=".8" stroke-dasharray="2 2"/>`;
    elev.innerHTML = h;
  };
  const CH = {w: 254, h: 92, x0: 22, y0: 76};
  const cx = (t) => CH.x0 + (t / TR.T) * (CH.w - CH.x0 - 6);
  const cyv = (v) => CH.y0 - (v / VMAX) * 62;
  const chartBase = `<line x1="${CH.x0}" x2="${CH.w - 4}" y1="${CH.y0}" y2="${CH.y0}" stroke="${C.ink}" stroke-width="1"/><line x1="${CH.x0}" x2="${CH.x0}" y1="8" y2="${CH.y0}" stroke="${C.ink}" stroke-width="1"/>
    <line x1="${CH.x0}" x2="${CH.w - 4}" y1="${cyv(VMAX)}" y2="${cyv(VMAX)}" stroke="${C.mute}" stroke-width=".7" stroke-dasharray="3 3"/>
    <text x="0" y="${cyv(VMAX) + 3}" font-size="8" fill="${C.mute}" font-family="JetBrains Mono">9.0</text><text x="6" y="${CH.y0 + 3}" font-size="8" fill="${C.mute}" font-family="JetBrains Mono">0</text>
    <text x="${cx(TR.ta) - 6}" y="${CH.y0 + 12}" font-size="8" fill="${C.mute}" font-family="JetBrains Mono">${TR.ta.toFixed(0)}s</text><text x="${cx(TR.T) - 18}" y="${CH.y0 + 12}" font-size="8" fill="${C.mute}" font-family="JetBrains Mono">${TR.T.toFixed(1)}s</text>
    <path d="M${cx(0)} ${cyv(0)}L${cx(TR.ta)} ${cyv(VMAX)}L${cx(TR.ta + TR.tc)} ${cyv(VMAX)}L${cx(TR.T)} ${cyv(0)}" fill="rgba(227,86,42,.1)" stroke="${C.or}" stroke-width="1.4"/>`;

  return {
    root: ui,
    btn,
    spots,
    SL,
    update(s) {
      drawElev(s);
      // the express car: where it is on its own speed profile
      const c = s.car;
      evFloor.textContent = floorName(c.floor);
      evY.innerHTML = `${c.y.toFixed(0)}<small>m</small>`;
      evV.innerHTML = `${Math.abs(c.v).toFixed(1)}<small>m/s ${c.v > 0.05 ? '▲' : c.v < -0.05 ? '▼' : '·'}</small>`;
      const A = CARS[0];
      const leg = c.t < A.tr.T ? c.t : c.t < A.tr.T + B.dwell ? A.tr.T : c.t < 2 * A.tr.T + B.dwell ? c.t - A.tr.T - B.dwell : A.tr.T;
      evChart.innerHTML = chartBase + `<line x1="${cx(leg).toFixed(1)}" x2="${cx(leg).toFixed(1)}" y1="8" y2="${CH.y0}" stroke="${C.ink}" stroke-width=".8"/><circle cx="${cx(leg).toFixed(1)}" cy="${cyv(Math.abs(c.v)).toFixed(1)}" r="4" fill="${C.or}" stroke="#fff" stroke-width="1.2"/>`;
      // the wind
      wV.innerHTML = `${s.wind.toFixed(0)}<small>m/s</small>`;
      wS.innerHTML = `${(Math.round(s.sway * 1000) / 10 || 0).toFixed(1)}<small>cm</small>`;
      const mid = 127;
      const px = (m) => mid + (m / B.swayMax) * 110;
      wBar.innerHTML = `<line x1="17" x2="237" y1="20" y2="20" stroke="${C.faint}" stroke-width="4" stroke-linecap="round"/><line x1="${mid}" x2="${mid}" y1="10" y2="30" stroke="${C.ink}" stroke-width="1"/>
        <line x1="${mid}" x2="${px(s.sway).toFixed(1)}" y1="20" y2="20" stroke="${C.or}" stroke-width="4" stroke-linecap="round"/><circle cx="${px(s.sway).toFixed(1)}" cy="20" r="6" fill="#fff" stroke="${C.or}" stroke-width="2"/>
        <text x="6" y="38" font-size="8" fill="${C.mute}" font-family="JetBrains Mono">−30</text><text x="${mid - 3}" y="38" font-size="8" fill="${C.mute}" font-family="JetBrains Mono">0</text><text x="226" y="38" font-size="8" fill="${C.mute}" font-family="JetBrains Mono">+30</text>`;
      // buttons
      const on = (n, v) => {
        n.style.background = v ? C.or : '#fff';
        n.style.color = v ? '#fff' : C.ink;
        n.style.borderColor = v ? C.or : C.faint;
      };
      for (const k of VIEWS) on(btn[k], s.view === k);
      for (const k of DISPLAY) on(btn[k], !!s.display[k]);
      for (const k of SYS) {
        const v = s.isolate === k;
        btn[k].style.borderColor = v ? C.or : C.faint;
        btn[k].style.boxShadow = v ? `inset 0 0 0 1px ${C.or}` : 'none';
        btn[k].style.opacity = s.isolate && !v ? '.55' : '1';
      }
      btn.play.innerHTML = s.paused ? '▶' : '❚❚';
      const sv = {explode: [s.explode, `${Math.round(s.explode * 100)} %`], layout: [s.layout, `${Math.round(s.layout * 100)} %`], wind: [s.wind / WIND_MAX, `${s.wind.toFixed(0)} m/s`]};
      for (const k of SLIDERS) {
        const [u, text] = sv[k];
        SL[k].fill.style.width = `${(u * SL[k].w).toFixed(1)}px`;
        SL[k].knob.style.left = `${(SL[k].x + u * SL[k].w).toFixed(1)}px`;
        SL[k].val.textContent = text;
      }
      // labels: an orange square, the name, the note, a thin leader to the part
      let lh = '';
      let ch = '';
      for (const c2 of s.callouts) {
        if (c2.o < 0.02) continue;
        if (c2.cap) {
          ch += `<div class="call" style="left:${c2.cap[0].toFixed(1)}px;top:${c2.cap[1].toFixed(1)}px;transform:translateX(-50%);text-align:center;opacity:${c2.o.toFixed(2)}"><b style="justify-content:center">${c2.name}</b><span>${c2.sub}</span></div>`;
          continue;
        }
        const [ax, ay] = c2.at;
        const [lx, ly] = c2.label;
        const right = lx > ax;
        const ex = right ? lx - 6 : lx + c2.w + 6;
        lh += `<polyline points="${ax.toFixed(1)},${ay.toFixed(1)} ${ex.toFixed(1)},${(ly + 8).toFixed(1)}" fill="none" stroke="${C.or}" stroke-width=".9" opacity="${c2.o.toFixed(2)}"/><circle cx="${ax.toFixed(1)}" cy="${ay.toFixed(1)}" r="2.6" fill="${C.or}" opacity="${c2.o.toFixed(2)}"/>`;
        ch += `<div class="call" style="left:${lx.toFixed(1)}px;top:${ly.toFixed(1)}px;opacity:${c2.o.toFixed(2)}"><b><i></i>${c2.name}</b><span>${c2.sub}</span></div>`;
      }
      callSvg.innerHTML = lh;
      callG.innerHTML = ch;
      pointer(s.cursor);
    },
    pointer,
  };
}
