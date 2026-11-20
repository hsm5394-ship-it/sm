import sys, json, subprocess, numpy as np, matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib import font_manager as fm
from matplotlib.patches import Polygon, Rectangle
from buildings import B

W, H = int(sys.argv[1]), int(sys.argv[2]); OUT = sys.argv[3]
FPS = 30
BOLD = fm.FontProperties(fname="/usr/share/fonts/truetype/nanum/NanumSquareB.ttf")
REG  = fm.FontProperties(fname="/usr/share/fonts/truetype/nanum/NanumSquareR.ttf")
BG, FG, MUT, GRID, GOLD = "#0B1020", "#F5F6F8", "#8A93A6", "#1E2638", "#FFB400"
portrait = H / W > 1.5

# --- 실루엣: (x 상대폭 -0.5~0.5, y 상대높이 0~1) 의 오른쪽 윤곽선
def outline(style):
    if style == "burj":
        return [(0.5,0),(0.5,.12),(.38,.12),(.38,.3),(.27,.3),(.27,.47),(.18,.47),(.18,.6),(.1,.6),(.1,.7),(.05,.7),(.03,.78),(.008,.78),(.004,1)]
    if style == "spire":
        return [(0.5,0),(0.47,.45),(0.38,.68),(0.22,.8),(0.04,.82),(0.01,1)]
    if style == "taper":
        return [(0.5,0),(0.46,.4),(0.36,.85),(0.3,1)]
    if style == "point":
        return [(0.5,0),(0.47,.3),(0.36,.7),(0.15,.92),(0.01,1)]
    if style == "clock":
        return [(0.5,0),(0.5,.35),(0.3,.35),(0.3,.6),(0.24,.62),(0.24,.75),(0.06,.8),(0.01,1)]
    if style == "wtc":
        return [(0.5,0),(0.5,.08),(0.33,.75),(0.28,.77),(0.02,.78),(0.01,1)]
    if style == "pagoda":
        pts = [(0.5,0),(0.5,.3)]
        for k in range(8):
            y0 = .3 + k*.07
            pts += [(0.36, y0), (0.46, y0+.065)]
        return pts + [(0.36,.86),(0.2,.88),(0.03,.9),(0.01,1)]
    if style == "twin":
        return None
    return [(0.5,0),(0.47,.9),(0.42,1)]   # box

def shape_polys(style, cx, w, h, y0, k):
    """화면 좌표 다각형 목록 (왼쪽 밝은 면, 오른쪽 어두운 면)."""
    polys = []
    if style == "twin":
        for dx in (-0.27, 0.27):
            o = [(0.5,0),(0.5,.55),(0.42,.6),(0.42,.72),(0.32,.76),(0.22,.82),(0.12,.86),(0.03,.88),(0.01,1)]
            polys += _mk(o, cx + dx*w*k, 0.42*w, h, y0, k)
        polys.append(("dark", [(cx-0.27*w*k, y0+h*k*.5), (cx+0.27*w*k, y0+h*k*.5),
                               (cx+0.27*w*k, y0+h*k*.53), (cx-0.27*w*k, y0+h*k*.53)]))
        return polys
    return _mk(outline(style), cx, w, h, y0, k)

def _mk(o, cx, w, h, y0, k):
    right = [(cx + x*w*k, y0 + y*h*k) for x, y in o]
    left  = [(cx - x*w*k, y0 + y*h*k) for x, y in o]
    mid_top = (cx, right[-1][1])
    return [("light", left + [mid_top, (cx, y0)]), ("dark", right + [mid_top, (cx, y0)])]

# --- 타임라인
SLOT = 150                       # m 단위 간격
order = list(reversed(B))        # 20위 → 1위
xs = [i * SLOT for i in range(len(order))]
INTRO = 60
DUR = [45 if b[0] > 3 else 70 for b in order]   # 프레임
ZOOM, HOLD = 75, 150
y0 = H * (0.10 if portrait else 0.075)
ytop = H * (0.74 if portrait else 0.655)
kN = (ytop - y0) / 870
kF = W * 0.92 / (xs[-1] + SLOT)

fig = plt.figure(figsize=(W/100, H/100), dpi=100, facecolor=BG)
ax = fig.add_axes([0, 0, 1, 1]); ax.set_xlim(0, W); ax.set_ylim(0, H); ax.axis("off")
proc = subprocess.Popen(["ffmpeg","-y","-loglevel","error","-f","rawvideo","-pix_fmt","rgba",
    "-s",f"{W}x{H}","-r",str(FPS),"-i","-","-c:v","libx264","-pix_fmt","yuv420p",
    "-crf","18","-preset","medium","-movflags","+faststart",OUT], stdin=subprocess.PIPE)
FRAME = [0]
def emit():
    fig.canvas.draw(); proc.stdin.write(fig.canvas.buffer_rgba().tobytes()); FRAME[0] += 1
def ease(t): t = max(0, min(1, t)); return t*t*(3-2*t)
def eout(t): t = max(0, min(1, t)); return 1 - (1-t)**3

def colors(b, current):
    if b[0] == 6:  return ("#FFC93C", "#D99A00")          # 롯데월드타워 강조
    if current:    return ("#7FD3FF", "#3A8FCC")
    return ("#5A6B8C", "#3A4763")

def header(alpha=1.0):
    t = H * (0.958 if portrait else 0.955)
    ax.text(W*0.06, t, "세계에서 가장 높은 건물", fontproperties=BOLD, fontsize=W/21, color=FG, va="top", alpha=alpha)
    ax.text(W*0.74, t, "TOP 20", fontproperties=BOLD, fontsize=W/21, color=GOLD, va="top", alpha=alpha)
    ax.text(W*0.06, t - W*0.075, "2026년 기준 · 완공 건물 · 건축 높이(CTBUH)",
            fontproperties=REG, fontsize=W/46, color=MUT, va="top", alpha=alpha)

def scene(cx_m, k, shown, cur_idx=None, rise=1.0, card=None, list_alpha=0.0, labels=True):
    ax.clear(); ax.set_xlim(0, W); ax.set_ylim(0, H); ax.axis("off")
    ax.add_patch(Rectangle((0, 0), W, H, color=BG, zorder=0))
    X = lambda xm: W/2 + (xm - cx_m) * k
    # 높이 눈금
    step = 100 if k > 0.6 else 200
    for m in range(step, 900, step):
        yy = y0 + m*k
        if yy > H*0.93 - (H*0.12 if card else 0): break
        ax.plot([0, W], [yy, yy], color=GRID, lw=1.2, zorder=1)
        ax.text(W*0.015, yy + 4, f"{m}m", fontproperties=REG, fontsize=W/62, color=MUT, va="bottom", zorder=1)
    ax.add_patch(Rectangle((0, 0), W, y0, color="#141B2E", zorder=5))
    ax.plot([0, W], [y0, y0], color="#3A4763", lw=2, zorder=6)
    for i in range(shown):
        b = order[i]; xm = xs[i]; sx = X(xm)
        if sx < -200 or sx > W + 200: continue
        h = b[3] * (rise if i == cur_idx else 1.0)
        lc, dc = colors(b, i == cur_idx)
        for kind, pts in shape_polys(b[5], sx, b[6], h, y0, k):
            ax.add_patch(Polygon(pts, closed=True, fc=lc if kind == "light" else dc, ec="none", zorder=3))
        if labels and (i != cur_idx or rise > 0.15):
            ax.text(sx, y0 - H*0.012, f"{b[0]}", ha="center", va="top", fontproperties=BOLD,
                    fontsize=max(W/70, W/34 * min(1, k/kN)), color=GOLD if b[0] == 6 else FG, zorder=7)
    if card:
        b, a, val = card
        if portrait:
            ty = H * 0.835
            ax.text(W*0.06, ty, f"{b[0]}위", fontproperties=BOLD, fontsize=W/11, color=GOLD, va="center", alpha=a)
            nx = W*(0.27 if b[0] < 10 else 0.37)
            ax.text(nx, ty + W*0.03, b[1], fontproperties=BOLD, fontsize=W/22, color=FG, va="center", alpha=a)
            ax.text(nx, ty - W*0.035, f"{b[2]} · {b[4]}년", fontproperties=REG, fontsize=W/40, color=MUT, va="center", alpha=a)
            ax.text(W*0.94, ty - W*0.15, f"{val:.1f}m", ha="right", fontproperties=BOLD, fontsize=W/13, color=FG, va="center", alpha=a)
        else:
            ty = H * 0.79
            ax.text(W*0.06, ty, f"{b[0]}위", fontproperties=BOLD, fontsize=W/12, color=GOLD, va="center", alpha=a)
            ax.text(W*0.94, ty, f"{val:.1f}m", ha="right", fontproperties=BOLD, fontsize=W/13, color=FG, va="center", alpha=a)
            ax.text(W*0.06, ty - W*0.085, b[1], fontproperties=BOLD, fontsize=W/24, color=FG, va="center", alpha=a)
            ax.text(W*0.94, ty - W*0.085, f"{b[2]} · {b[4]}년", ha="right", fontproperties=REG, fontsize=W/46, color=MUT, va="center", alpha=a)
    header()
    if list_alpha > 0:
        top = H * (0.84 if portrait else 0.78); lh = H * (0.04 if portrait else 0.044)
        for j, b in enumerate(B):
            col, row = divmod(j, 10)
            xx = W * (0.04 + 0.49 * col); yy = top - row * lh
            c = GOLD if b[0] == 6 else FG
            ax.text(xx, yy, f"{b[0]:>2}", fontproperties=BOLD, fontsize=W/40, color=GOLD, alpha=list_alpha, va="center")
            ax.text(xx + W*0.05, yy, b[1], fontproperties=REG, fontsize=W/54, color=c, alpha=list_alpha, va="center")
            ax.text(xx + W*0.445, yy, f"{b[3]:g}m", ha="right", fontproperties=BOLD, fontsize=W/54, color=c, alpha=list_alpha, va="center")
    emit()

# --- 인트로
for f in range(INTRO):
    a = min(1, f/12) * min(1, (INTRO - f)/10)
    ax.clear(); ax.set_xlim(0, W); ax.set_ylim(0, H); ax.axis("off")
    ax.add_patch(Rectangle((0, 0), W, H, color=BG))
    ax.text(W/2, H*0.58, "세계에서 가장 높은", ha="center", fontproperties=BOLD, fontsize=W/13, color=FG, alpha=a)
    ax.text(W/2, H*0.50, "건물 TOP 20", ha="center", fontproperties=BOLD, fontsize=W/10, color=GOLD, alpha=a)
    ax.text(W/2, H*0.43, "20위부터 1위까지, 높이로 비교", ha="center", fontproperties=REG, fontsize=W/32, color=MUT, alpha=a)
    emit()
race0 = FRAME[0] / FPS
events = []
cx_prev = xs[0]
for i, b in enumerate(order):
    events.append(FRAME[0] / FPS)
    n = DUR[i]
    for f in range(n):
        t = f / n
        cx = cx_prev + (xs[i] - cx_prev) * ease(t / 0.35)
        r = eout(t / 0.45)
        a = min(1, f / 8)
        scene(cx, kN, i + 1, cur_idx=i, rise=max(0.001, r), card=(b, a, b[3] * r))
    cx_prev = xs[i]
end0 = FRAME[0] / FPS
cxF = (xs[-1]) / 2
for f in range(ZOOM):
    t = ease(f / ZOOM)
    k = kN * (kF / kN) ** t
    scene(cx_prev + (cxF - cx_prev) * t, k, len(order), card=None, list_alpha=0)
for f in range(HOLD):
    scene(cxF, kF, len(order), list_alpha=min(1, f / 15))
fig.savefig(OUT.replace(".mp4", "_last.png"), facecolor=BG)
proc.stdin.close(); proc.wait()
json.dump({"dur": FRAME[0]/FPS, "race0": race0, "end0": end0 + ZOOM/FPS,
           "events": [e for e, b in zip(events, order) if b[0] <= 3]}, open(OUT + ".json", "w"))
print("done", OUT, FRAME[0]/FPS)
