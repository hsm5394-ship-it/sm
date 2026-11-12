// The watch film's overlay, laid out at 1080 x 1920 for a vertical short: progress, a two-language title per stage,
// the speed badge and the watch's own clock, labels with leaders into the parts, and a readout card with a live chart.
// Every number comes from kin.js, the same function that poses the parts. update(s) redraws from the frame's state.
import {BAL, clock, ESC, FORK_MAX_DEG, pose, RESERVE_H, TRAIN} from './kin.js';

export const C = {ink: '#1b1e24', mute: '#6f7682', faint: '#c9ced6', line: '#dde1e7', panel: 'rgba(255,255,255,.93)', acc: '#d81e4a'};
const FONT = `Inter,'Watch KR',system-ui,sans-serif`;
const MONO = `'JetBrains Mono','Watch KR',ui-monospace,monospace`;
const CSS = `
html,body{background:#111}
#app{position:absolute!important;inset:50% auto auto 50%!important;width:1080px;height:1920px;transform-origin:50% 50%;overflow:hidden;background:#eceef2;font-family:${FONT};color:${C.ink};-webkit-font-smoothing:antialiased;font-variant-numeric:tabular-nums}
.ui{position:absolute;inset:0;pointer-events:none}
.vig{position:absolute;inset:0;background:radial-gradient(ellipse 75% 55% at 50% 48%,rgba(255,255,255,0) 55%,rgba(150,160,178,.28) 100%)}
.mo{font-family:${MONO}}
.blk{position:absolute;left:64px;right:64px;opacity:0}
.tag{font:700 26px ${MONO};letter-spacing:3px;color:${C.acc};display:flex;align-items:center;gap:14px}
.tag i{display:block;width:8px;height:26px;background:${C.acc}}
.ko{font-weight:800;font-size:78px;line-height:1.14;letter-spacing:-2.5px;margin-top:14px;white-space:nowrap}
.en{font-weight:500;font-size:36px;line-height:1.2;letter-spacing:-.4px;color:${C.mute};margin-top:14px;white-space:nowrap}
.seg{position:absolute;top:150px;height:8px;border-radius:4px;background:${C.faint};overflow:hidden}
.seg i{display:block;height:100%;width:0;background:${C.acc}}
.pill{position:absolute;top:104px;height:34px;display:flex;align-items:center;font:600 22px ${MONO};letter-spacing:2px;color:${C.mute};white-space:nowrap}
.card{position:absolute;left:64px;top:1262px;width:952px;height:262px;background:${C.panel};border:1.5px solid ${C.line};border-radius:20px;box-shadow:0 8px 30px rgba(60,70,90,.10)}
.pan{position:absolute;left:64px;top:1262px;width:952px;height:262px;opacity:0}
.big{position:absolute;left:36px;top:24px;font-weight:800;font-size:112px;line-height:1;letter-spacing:-4px;padding-right:4px;color:${C.acc};white-space:nowrap}
.unit{position:absolute;top:36px;white-space:nowrap}
.unit b{display:block;font-weight:800;font-size:38px;letter-spacing:-1px}
.unit span{display:block;font:600 22px ${MONO};letter-spacing:2px;color:${C.mute};margin-top:6px}
.cap{position:absolute;left:36px;top:156px;white-space:nowrap}
.cap b{display:block;font-weight:700;font-size:34px;letter-spacing:-1px}
.cap span{display:block;font-weight:500;font-size:25px;color:${C.mute};margin-top:8px;letter-spacing:-.2px}
.rows{position:absolute;right:36px;top:26px;width:318px}
.rows div{display:flex;justify-content:space-between;align-items:baseline;height:38px;border-bottom:1.5px solid ${C.line};font:600 19px ${MONO};letter-spacing:0;color:${C.mute};white-space:nowrap}
.rows div b{font:800 25px ${FONT};color:${C.ink};letter-spacing:-.5px}
.call{position:absolute;white-space:nowrap;background:${C.panel};border:1.5px solid ${C.line};border-radius:12px;padding:10px 18px 12px;box-shadow:0 4px 16px rgba(60,70,90,.12)}
.call b{display:block;font-weight:800;font-size:36px;letter-spacing:-1px;line-height:1.15}
.call span{display:block;font:600 19px ${MONO};letter-spacing:1.6px;color:${C.mute};margin-top:4px}
`;
const el = (h) => {
  const d = document.createElement('div');
  d.innerHTML = h.trim();
  return d.firstElementChild;
};

const TEXT = {
  intro: {tag: 'HOW IT WORKS', ko: '기계식 시계는<br>어떻게 갈까?', en: 'How does a mechanical watch keep time?'},
  barrel: {tag: 'STEP 1 / 4', ko: '태엽이 힘을 저장한다', en: 'The mainspring stores the energy'},
  train: {tag: 'STEP 2 / 4', ko: '기어가 힘을 전달한다', en: 'The gear train carries it along'},
  escape: {tag: 'STEP 3 / 4', ko: '탈진기가 한 칸씩 풀어 준다', en: 'The escapement lets it out, tick by tick'},
  balance: {tag: 'STEP 4 / 4', ko: '밸런스 휠이 박자를 정한다', en: 'The balance wheel sets the beat'},
  outro: {tag: 'THAT IS A WATCH', ko: '하루에 432,000번', en: '432,000 ticks a day, counted by gears'},
};
const beatsPerSec = 2 * BAL.hz;
const PANEL = {
  intro: {big: 'clock', mono: true, cap: ['배터리도 전자회로도 없다', 'No battery. No electronics.']},
  barrel: {
    big: String(RESERVE_H), unit: ['시간', 'HOURS OF POWER'], cap: ['한 번 감으면 46시간 동안 풀린다', 'One full wind unwinds for 46 hours'],
    rows: [['배럴 BARREL', `${TRAIN.barrel.z} 톱니`], ['피니언 PINION', `${TRAIN.centrePinion.z} 톱니`], ['배럴 1회전 1 TURN', `${TRAIN.barrel.z / TRAIN.centrePinion.z} 시간`]],
  },
  train: {
    big: `×${(TRAIN.centre.z / TRAIN.thirdPinion.z) * (TRAIN.third.z / TRAIN.fourthPinion.z) * (TRAIN.fourth.z / TRAIN.escapePinion.z)}`, unit: ['배 빨라진다', 'TIMES FASTER'],
    cap: ['센터 휠 1바퀴에 이스케이프 휠 600바퀴', '600 escape-wheel turns per centre-wheel turn'],
    rows: [['센터 CENTRE', '1회전 / 시간'], ['4번 FOURTH', '1회전 / 분'], ['이스케이프 ESC.', '10회전 / 분']],
  },
  escape: {big: `${ESC.stepDeg}°`, unit: ['한 번에 톱니 반 칸', 'HALF A TOOTH / TICK'], cap: ['포크가 톱니를 잡았다 놓는 소리가 ‘똑딱’', 'The fork catching a tooth is the tick you hear'], chart: 'escape'},
  balance: {big: String(beatsPerSec), unit: ['번 / 초', 'TICKS PER SECOND'], cap: ['헤어스프링이 휠을 되돌린다 · 시간당 18,000번', 'The hairspring swings it back · 18,000 an hour'], chart: 'balance'},
  outro: {big: 'clock', mono: true, cap: ['이 박자를 세는 것이 곧 시간이다', 'Counting that beat is telling the time']},
};

export function createConsole(app) {
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);
  const fit = () => (app.style.transform = `translate(-50%,-50%) scale(${Math.min(innerWidth / 1080, innerHeight / 1920)})`);
  fit();
  addEventListener('resize', fit);
  const ui = el(`<div class="ui"></div>`);
  app.appendChild(ui);
  const add = (h, parent = ui) => {
    const n = el(h);
    parent.appendChild(n);
    return n;
  };
  add(`<div class="vig"></div>`);
  const svg = add(`<svg style="position:absolute;left:0;top:0" width="1080" height="1920"></svg>`);

  // ------------------------------------------------------------ header: series line, progress, speed, the watch's clock
  add(`<div class="pill" style="left:64px">시계의 원리 · HOW A WATCH WORKS</div>`);
  const clk = add(`<div class="pill" style="right:64px;color:${C.ink};font-weight:700"></div>`);
  const segs = [0, 1, 2, 3].map((i) => add(`<div class="seg" style="left:${64 + i * 242}px;width:226px"><i></i></div>`).firstElementChild);
  const speed = add(`<div class="mo" style="position:absolute;left:64px;top:486px;height:46px;padding:0 18px;display:flex;align-items:center;gap:12px;border-radius:23px;background:${C.ink};color:#fff;font-weight:700;font-size:22px;letter-spacing:1.5px;white-space:nowrap"></div>`);

  // ------------------------------------------------------------ titles, one block per stage
  const blocks = {};
  for (const k in TEXT) {
    const t = TEXT[k];
    blocks[k] = add(`<div class="blk" style="top:196px"><div class="tag"><i></i>${t.tag}</div><div class="ko">${t.ko}</div><div class="en">${t.en}</div></div>`);
  }

  // ------------------------------------------------------------ readout card
  add(`<div class="card"></div>`);
  const pans = {};
  const clocks = [];
  const charts = {};
  for (const k in PANEL) {
    const p = PANEL[k];
    const n = add(`<div class="pan"></div>`);
    const big = add(`<div class="big ${p.mono ? 'mo' : ''}" style="${p.mono ? 'font-size:96px;letter-spacing:-3px;top:30px;color:' + C.ink : ''}">${p.big === 'clock' ? '' : p.big}</div>`, n);
    if (p.big === 'clock') clocks.push(big);
    if (p.unit) add(`<div class="unit" style="left:${36 + big.offsetWidth + 22}px"><b>${p.unit[0]}</b><span>${p.unit[1]}</span></div>`, n);
    add(`<div class="cap"><b>${p.cap[0]}</b><span>${p.cap[1]}</span></div>`, n);
    if (p.rows) add(`<div class="rows">${p.rows.map(([a, b]) => `<div>${a}<b>${b}</b></div>`).join('')}</div>`, n);
    if (p.chart) {
      const c = add(`<canvas width="760" height="240" style="position:absolute;right:30px;top:20px;width:352px;height:111px"></canvas>`, n);
      charts[k] = c.getContext('2d');
    }
    pans[k] = n;
  }

  const calls = [];
  const callLayer = add(`<div style="position:absolute;inset:0"></div>`);

  // ------------------------------------------------------------ charts: the last stretch of watch time, drawn from pose()
  const drawChart = (kind, tau) => {
    const x = charts[kind];
    const CW = 760;
    const CH = 240;
    x.clearRect(0, 0, CW, CH);
    const span = kind === 'balance' ? 1.0 : 0.62; // watch seconds across the chart
    const mid = kind === 'balance' ? 132 : 150;
    x.font = `600 30px JetBrains Mono, 'Watch KR'`;
    x.fillStyle = C.mute;
    x.textBaseline = 'top';
    x.fillText(kind === 'balance' ? `밸런스 각도 BALANCE ±${BAL.ampDeg}°` : `포크 FORK ±${FORK_MAX_DEG.toFixed(1)}° · 휠 WHEEL`, 0, 0);
    x.strokeStyle = C.line;
    x.lineWidth = 3;
    x.beginPath();
    x.moveTo(0, mid);
    x.lineTo(CW, mid);
    x.stroke();
    const N = 380;
    const trace = (fn, color, lw) => {
      x.strokeStyle = color;
      x.lineWidth = lw;
      x.lineJoin = 'round';
      x.beginPath();
      for (let i = 0; i <= N; i++) {
        const p = pose(tau - span * (1 - i / N));
        const y = fn(p);
        if (i) x.lineTo((i / N) * (CW - 16), y);
        else x.moveTo(0, y);
      }
      x.stroke();
    };
    if (kind === 'balance') {
      // a dot on every centre crossing: that is where the tick happens
      trace((p) => mid - (p.balDeg / BAL.ampDeg) * 82, C.ink, 5);
      x.fillStyle = C.acc;
      for (let k = Math.ceil((tau - span) * beatsPerSec); k / beatsPerSec <= tau; k++) {
        const px = (1 - (tau - k / beatsPerSec) / span) * (CW - 16);
        x.beginPath();
        x.arc(px, mid, 10, 0, 7);
        x.fill();
      }
    } else {
      const s0 = pose(tau - span).steps;
      trace((p) => 214 - (p.steps - Math.floor(s0)) * 26, C.acc, 6);
      trace((p) => 96 - (p.forkDeg / FORK_MAX_DEG) * 34, C.ink, 5);
    }
    x.fillStyle = kind === 'balance' ? C.ink : C.acc;
    const now = pose(tau);
    x.beginPath();
    x.arc(CW - 16, kind === 'balance' ? mid - (now.balDeg / BAL.ampDeg) * 82 : 214 - (now.steps - Math.floor(pose(tau - span).steps)) * 26, 9, 0, 7);
    x.fill();
  };

  const speedText = (rate) => {
    if (rate > 1.5) return `<i style="display:block;width:12px;height:12px;border-radius:6px;background:#ff8fa8"></i> 빨리 감기 FAST ×${Math.round(rate)}`;
    if (rate < 0.7) return `<i style="display:block;width:12px;height:12px;border-radius:6px;background:#ff8fa8"></i> 슬로 모션 SLOW ×1/${Math.round(1 / rate)}`;
    return `<i style="display:block;width:12px;height:12px;border-radius:6px;background:#ff8fa8"></i> 실시간 REAL TIME`;
  };
  let lastSpeed = '';

  const update = (s) => {
    clk.textContent = clock(s.pose.now);
    for (const c of clocks) c.textContent = clock(s.pose.now);
    const sp = speedText(s.rate);
    if (sp !== lastSpeed) speed.innerHTML = lastSpeed = sp;
    speed.style.top = s.weights.intro > 0.5 ? '486px' : '396px';
    speed.style.opacity = 1 - Math.max(0, ...Object.values(s.weights).map((w) => (w > 0.001 && w < 0.999 ? 1 - w : 0)));
    segs.forEach((g, i) => (g.style.width = s.step > i || s.weights.outro > 0.01 ? '100%' : s.step === i ? '100%' : '0'));
    segs.forEach((g, i) => (g.style.opacity = s.step === i || s.weights.outro > 0.01 ? 1 : 0.38));
    for (const k in blocks) {
      const w = s.weights[k] ?? 0;
      blocks[k].style.opacity = w;
      blocks[k].style.transform = `translateY(${(1 - w) * 16}px)`;
      pans[k].style.opacity = w;
      if (w > 0.01 && charts[k]) drawChart(k, s.tau);
    }
    // labels and their leaders
    let lines = '';
    s.callouts.forEach((c, i) => {
      let n = calls[i];
      if (!n) {
        n = add(`<div class="call"><b></b><span></span></div>`, callLayer);
        calls[i] = n;
        n.dataset.k = '';
      }
      if (n.dataset.k !== c.ko) {
        n.dataset.k = c.ko;
        n.firstElementChild.textContent = c.ko;
        n.lastElementChild.textContent = c.en;
        n.dataset.w = '';
      }
      n.style.display = 'block';
      if (!n.dataset.w) n.dataset.w = n.offsetWidth;
      const w = +n.dataset.w;
      const h = 86;
      const lx = Math.min(1080 - 40 - w, Math.max(40, c.label[0] - w / 2));
      const ly = c.label[1] - h / 2;
      n.style.left = `${lx}px`;
      n.style.top = `${ly}px`;
      n.style.opacity = c.o;
      // the leader leaves the label's edge nearest the part
      const cx = Math.min(lx + w - 24, Math.max(lx + 24, c.at[0]));
      const cy = c.at[1] > ly + h / 2 ? ly + h : ly;
      lines += `<g opacity="${c.o.toFixed(3)}"><path d="M${cx.toFixed(1)} ${cy.toFixed(1)}L${c.at[0].toFixed(1)} ${c.at[1].toFixed(1)}" stroke="${C.ink}" stroke-width="2.5" fill="none"/><circle cx="${c.at[0].toFixed(1)}" cy="${c.at[1].toFixed(1)}" r="9" fill="${C.acc}" stroke="#fff" stroke-width="3"/></g>`;
    });
    for (let i = s.callouts.length; i < calls.length; i++) calls[i].style.display = 'none';
    svg.innerHTML = lines;
  };
  return {update};
}
