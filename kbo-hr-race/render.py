import sys, subprocess, numpy as np, matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib import font_manager as fm
from data import D

W, H = int(sys.argv[1]), int(sys.argv[2]); OUT = sys.argv[3]
FPS, PER_YEAR, HOLD = 30, 24, 120
Y0, Y1 = 1982, 2026
for f in ["/usr/share/fonts/truetype/nanum/NanumSquareB.ttf","/usr/share/fonts/truetype/nanum/NanumSquareR.ttf"]:
    fm.fontManager.addfont(f)
BOLD = fm.FontProperties(fname="/usr/share/fonts/truetype/nanum/NanumSquareB.ttf")
REG  = fm.FontProperties(fname="/usr/share/fonts/truetype/nanum/NanumSquareR.ttf")

players = list(D)
cum = {p: {} for p in players}
for p in players:
    t = 0
    for y in range(Y0 - 1, Y1 + 1):
        t += D[p].get(y, 0); cum[p][y] = t

PAL = ["#FF5A5F","#FFB400","#00A699","#7B61FF","#3DA5F4","#FF7AC6","#8BD346","#FF8C42",
       "#2EC4B6","#E9D758","#C77DFF","#5BC0EB","#4361EE","#D4A373","#F72585","#B8C0D0"]
def _rk(y):
    return sorted(players, key=lambda p: -cum[p][y])[:12]
TOPY = {p: set() for p in players}
for y in range(Y0, Y1 + 1):
    for p in _rk(y): TOPY[p].add(y)
order = sorted(players, key=lambda p: min(TOPY[p]) if TOPY[p] else 9999)
COL = {}
for p in order:
    used = {COL[q] for q in COL if TOPY[q] & TOPY[p]}
    free = [c for c in PAL if c not in used]
    # prefer the colour least recently used overall
    COL[p] = free[0] if free else PAL[len(COL) % len(PAL)]
    PAL.remove(COL[p]); PAL.append(COL[p])

def ranks(y):
    s = sorted(players, key=lambda p: (-cum[p][y], min(D[p]) if D[p] else 9999))
    return {p: i for i, p in enumerate(s)}

BG, FG, MUT, GRID = "#0E1117", "#F5F6F8", "#8A93A6", "#232836"
portrait = H / W > 1.5
fig = plt.figure(figsize=(W/100, H/100), dpi=100, facecolor=BG)
ax_rect = [0.24, 0.16, 0.66, 0.58] if portrait else [0.24, 0.11, 0.66, 0.56]
ax = fig.add_axes(ax_rect, facecolor=BG)

POS = {}
def ease(t): return t*t*(3-2*t)

proc = subprocess.Popen(["ffmpeg","-y","-loglevel","error","-f","rawvideo","-pix_fmt","rgba",
    "-s",f"{W}x{H}","-r",str(FPS),"-i","-","-c:v","libx264","-pix_fmt","yuv420p",
    "-crf","18","-preset","medium","-movflags","+faststart",OUT], stdin=subprocess.PIPE)

def draw(ya, yb, t):
    ax.clear(); ax.set_facecolor(BG)
    for txt in list(fig.texts): txt.remove()
    te = ease(t)
    val = {p: cum[p][ya] + (cum[p][yb]-cum[p][ya]) * te for p in players}
    srt = sorted(players, key=lambda p: (-val[p], min(D[p])))
    for i, p in enumerate(srt):
        tgt = min(i, 11)
        POS[p] = tgt if p not in POS else POS[p] + (tgt - POS[p]) * 0.3
    rows = [(p, val[p], POS[p]) for p in players if POS[p] < 10.5 and val[p] > 0]
    vmax = max(v for _, v, _ in rows)
    xmax = vmax * 1.18
    for p, v, r in rows:
        a = max(0.0, min(1.0, (9.9 - r) / 0.5))
        ax.barh(r, v, height=0.78, color=COL[p], alpha=a, zorder=3)
        ax.text(-xmax*0.02, r, p, ha="right", va="center", fontproperties=BOLD,
                fontsize=W/26, color=FG, alpha=a)
        ax.text(v + xmax*0.012, r, f"{int(round(v))}", ha="left", va="center",
                fontproperties=BOLD, fontsize=W/30, color=FG, alpha=a, clip_on=True)
    ax.set_ylim(9.6, -0.6); ax.set_xlim(0, xmax)
    ax.set_yticks([]); ax.tick_params(axis="x", colors=MUT, labelsize=W/60, length=0)
    for lab in ax.get_xticklabels(): lab.set_fontproperties(REG); lab.set_fontsize(W/62)
    ax.xaxis.set_ticks_position("top"); ax.grid(axis="x", color=GRID, lw=1.2, zorder=0)
    for s in ax.spines.values(): s.set_visible(False)
    year = ya if t < 0.5 else yb
    ax.text(0.98, 0.04, str(year), transform=ax.transAxes, ha="right", va="bottom",
            fontproperties=BOLD, fontsize=W/7, color=FG, alpha=0.16, zorder=1)
    top = 0.955 if portrait else 0.95
    fig.text(0.06, top, "KBO 통산 홈런", fontproperties=BOLD, fontsize=W/14, color=FG, va="top")
    fig.text(0.06, top-(0.068 if portrait else 0.10), "TOP 10 변화 1982–2026",
             fontproperties=BOLD, fontsize=W/22, color="#FFB400", va="top")
    fig.text(0.06, top-(0.112 if portrait else 0.165), "프로야구 출범부터 2026 시즌 종료까지 · 정규시즌 기준",
             fontproperties=REG, fontsize=W/48, color=MUT, va="top")
    leader = min(rows, key=lambda x: x[2])[0]
    fig.text(0.06, 0.105 if portrait else 0.055, f"{year}년 통산 1위  {leader}",
             fontproperties=BOLD, fontsize=W/34, color=FG, va="bottom")
    fig.text(0.06, 0.06 if portrait else 0.02, "단위: 개", fontproperties=REG,
             fontsize=W/56, color=MUT, va="bottom")
    fig.canvas.draw()
    proc.stdin.write(fig.canvas.buffer_rgba().tobytes())

for _ in range(30): draw(Y0, Y0, 0)
for y in range(Y0, Y1):
    for i in range(PER_YEAR): draw(y, y+1, i/PER_YEAR)
for _ in range(HOLD): draw(Y1, Y1, 0)
fig.savefig(OUT.replace(".mp4", "_last.png"), facecolor=BG)
proc.stdin.close(); proc.wait(); print("done", OUT)
