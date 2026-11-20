import sys, subprocess, numpy as np, matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib import font_manager as fm

W, H = int(sys.argv[1]), int(sys.argv[2]); OUT = sys.argv[3]
STAT = sys.argv[4] if len(sys.argv) > 4 else "hr"
if STAT == "hit":
    from data_hit import D
    LBL, SUB_INTRO = "안타", "45시즌, 안타 순위의 역사"
elif STAT == "sb":
    from data_sb import D
    LBL, SUB_INTRO = "도루", "45시즌, 대도들의 역사"
else:
    from data import D
    LBL, SUB_INTRO = "홈런", "45시즌, 홈런 순위의 역사"
import matplotlib.patches
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

ST = {"frame": 0, "leader": None, "banner": None, "events": []}
GOLD = "#FFB400"
def emit():
    fig.canvas.draw()
    proc.stdin.write(fig.canvas.buffer_rgba().tobytes())
    ST["frame"] += 1

def draw(ya, yb, t):
    ax.set_visible(True)
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
    xmax = vmax * (1.24 if vmax >= 1000 else 1.18)
    for p, v, r in rows:
        a = max(0.0, min(1.0, (9.9 - r) / 0.5))
        ax.barh(r, v, height=0.78, color=COL[p], alpha=a, zorder=3)
        ax.text(-xmax*0.02, r, p, ha="right", va="center", fontproperties=BOLD,
                fontsize=W/26, color=FG, alpha=a)
        ax.text(v + xmax*0.012, r, f"{int(round(v))}", ha="left", va="center",
                fontproperties=BOLD, fontsize=W/30, color=FG, alpha=a)
    ax.set_ylim(9.6, -0.6); ax.set_xlim(0, xmax)
    ax.set_yticks([]); ax.tick_params(axis="x", colors=MUT, labelsize=W/60, length=0)
    for lab in ax.get_xticklabels(): lab.set_fontproperties(REG); lab.set_fontsize(W/62)
    ax.xaxis.set_ticks_position("top"); ax.grid(axis="x", color=GRID, lw=1.2, zorder=0)
    for s in ax.spines.values(): s.set_visible(False)
    year = ya if t < 0.5 else yb
    ax.text(0.98, 0.04, str(year), transform=ax.transAxes, ha="right", va="bottom",
            fontproperties=BOLD, fontsize=W/7, color=FG, alpha=0.16, zorder=1)
    top = 0.955 if portrait else 0.95
    fig.text(0.06, top, f"KBO 통산 {LBL}", fontproperties=BOLD, fontsize=W/14, color=FG, va="top")
    fig.text(0.06, top-(0.068 if portrait else 0.10), "TOP 10 변화 1982–2026",
             fontproperties=BOLD, fontsize=W/22, color="#FFB400", va="top")
    fig.text(0.06, top-(0.112 if portrait else 0.165), "프로야구 출범부터 2026 시즌 종료까지 · 정규시즌 기준",
             fontproperties=REG, fontsize=W/48, color=MUT, va="top")
    leader = srt[0]
    if ST["leader"] is not None and leader != ST["leader"]:
        ST["banner"] = (leader, ST["frame"], int(round(val[leader])))
        ST["events"].append(ST["frame"] / FPS)
    ST["leader"] = leader
    if ST["banner"]:
        name, f0, _ = ST["banner"]; k = ST["frame"] - f0
        if k < 75:
            a = min(1, k / 6) * min(1, (75 - k) / 12)
            pop = 1 + 0.25 * max(0, 1 - k / 8)
            by = 0.792 if portrait else 0.058
            fig.text(0.94, by, f"새 통산 1위  {name}", ha="right", va="center",
                     fontproperties=BOLD, fontsize=W/30*pop, color=BG, alpha=a,
                     bbox=dict(boxstyle="round,pad=0.45", fc=GOLD, ec="none", alpha=a))
    # year progress bar
    prog = ((ya - Y0) + te) / (Y1 - Y0)
    py = 0.135 if portrait else 0.088
    fig.patches.clear()
    fig.patches.append(matplotlib.patches.Rectangle((0.06, py), 0.88, 0.004, transform=fig.transFigure, color=GRID, figure=fig))
    fig.patches.append(matplotlib.patches.Rectangle((0.06, py), 0.88*prog, 0.004, transform=fig.transFigure, color=GOLD, figure=fig))
    fig.text(0.06, 0.09 if portrait else 0.045, f"{year}년 통산 1위  {leader}",
             fontproperties=BOLD, fontsize=W/34, color=FG, va="bottom")
    showing = ST["banner"] and ST["frame"] - ST["banner"][1] < 75
    if portrait or not showing: fig.text(0.94, 0.09 if portrait else 0.045, "단위: 개", fontproperties=REG, ha="right",
             fontsize=W/50, color=MUT, va="bottom")
    emit()

def card(kind, a):
    ax.set_visible(False); fig.patches.clear()
    for txt in list(fig.texts): txt.remove()
    cy = 0.5
    if kind == "intro":
        fig.text(0.5, cy+0.10, "KBO", ha="center", fontproperties=BOLD, fontsize=W/9, color=FG, alpha=a)
        fig.text(0.5, cy+0.02, f"통산 {LBL} TOP 10", ha="center", fontproperties=BOLD, fontsize=W/13, color=FG, alpha=a)
        fig.text(0.5, cy-0.06, "1982 → 2026", ha="center", fontproperties=BOLD, fontsize=W/15, color=GOLD, alpha=a)
        fig.text(0.5, cy-0.13, SUB_INTRO, ha="center", fontproperties=REG, fontsize=W/34, color=MUT, alpha=a)
    else:
        fin = sorted(players, key=lambda p: -cum[p][Y1])[:3]
        fig.text(0.5, cy+0.16, "2026 시즌 종료 기준", ha="center", fontproperties=REG, fontsize=W/32, color=MUT, alpha=a)
        fig.text(0.5, cy+0.08, f"KBO 통산 {LBL} 1위", ha="center", fontproperties=BOLD, fontsize=W/18, color=FG, alpha=a)
        fig.text(0.5, cy-0.03, f"{fin[0]} {cum[fin[0]][Y1]}", ha="center", fontproperties=BOLD, fontsize=W/8, color=GOLD, alpha=a)
        sub = "   ".join(f"{i+2}위 {p} {cum[p][Y1]}" for i, p in enumerate(fin[1:]))
        fig.text(0.5, cy-0.11, sub, ha="center", fontproperties=REG, fontsize=W/30, color=FG, alpha=a)
        fig.text(0.5, 0.08, "KBO 정규시즌 기록", ha="center", fontproperties=REG, fontsize=W/44, color=MUT, alpha=a)
    emit()

INTRO = 66
for i in range(INTRO): card("intro", min(1, i/12) * min(1, (INTRO-i)/10))
RACE0 = ST["frame"] / FPS
for _ in range(24): draw(Y0, Y0, 0)
for y in range(Y0, Y1):
    for i in range(PER_YEAR): draw(y, y+1, i/PER_YEAR)
for _ in range(HOLD): draw(Y1, Y1, 0)
fig.savefig(OUT.replace(".mp4", "_last.png"), facecolor=BG)
END0 = ST["frame"] / FPS
for i in range(105): card("end", min(1, i/12))
proc.stdin.close(); proc.wait()
import json; json.dump({"dur": ST["frame"]/FPS, "race0": RACE0, "end0": END0,
    "events": ST["events"]}, open(OUT + ".json", "w"))
print("done", OUT, ST["frame"]/FPS, ST["events"])
