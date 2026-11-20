# 영상용 배경음 합성: 115 BPM 비트 + 베이스 + 패드, 1위 교체 시 벨, 엔딩 상승음
import sys, json, wave, numpy as np
meta = json.load(open(sys.argv[1])); OUT = sys.argv[2]
SR = 44100; dur = meta["dur"]; n = int(SR * dur) + SR
L = np.zeros(n); R = np.zeros(n)
rng = np.random.default_rng(7)
bpm = 115; beat = 60 / bpm
def add(sig, t, pan=0.0, g=1.0):
    i = int(t * SR); j = min(n, i + len(sig)); sig = sig[: j - i] * g
    L[i:j] += sig * (1 - max(0, pan)); R[i:j] += sig * (1 + min(0, pan))
def env(N, a=0.005, d=0.2):
    t = np.arange(N) / SR
    return np.minimum(1, t / a) * np.exp(-t / d)
def kick():
    N = int(0.35 * SR); t = np.arange(N) / SR
    f = 50 + 110 * np.exp(-t * 30)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * env(N, 0.002, 0.12)
def hat():
    N = int(0.06 * SR); x = rng.standard_normal(N); x = np.diff(x, prepend=0)
    return x * env(N, 0.001, 0.015) * 0.5
def clap():
    N = int(0.2 * SR); x = rng.standard_normal(N)
    return x * env(N, 0.002, 0.05) * 0.5
def tone(f, d, kind="saw", a=0.01, dec=0.4):
    N = int(d * SR); t = np.arange(N) / SR
    if kind == "saw":
        x = sum(np.sin(2*np.pi*f*k*t)/k for k in range(1, 7))
    else:
        x = np.sin(2*np.pi*f*t) + 0.3*np.sin(2*np.pi*2*f*t)
    return x * env(N, a, dec)
def hz(m): return 440 * 2 ** ((m - 69) / 12)
prog = [(57,[57,60,64]),(53,[53,57,60]),(48,[48,52,55]),(55,[55,59,62])]  # Am F C G
r0, e0 = meta["race0"], meta["end0"]
# intro pad
for c in prog[0][1]: add(tone(hz(c), r0 + 0.5, "sine", 0.8, 2.0), 0, g=0.07)
t = r0; b = 0
while t < e0:
    bar = (b // 4) % 4; root, ch = prog[bar]
    add(kick(), t, g=0.9)
    if b % 2 == 1: add(clap(), t, g=0.35)
    add(hat(), t + beat/2, pan=0.3, g=0.4)
    add(tone(hz(root - 12), beat*0.9, "saw", 0.005, 0.18), t, g=0.10)
    add(tone(hz(root - 12), beat*0.4, "saw", 0.005, 0.10), t + beat/2, g=0.07)
    if b % 4 == 0:
        for k, c in enumerate(ch): add(tone(hz(c + 12), beat*4, "sine", 0.05, 1.2), t, pan=(k-1)*0.4, g=0.05)
    t += beat; b += 1
for ev in meta["events"]:
    for k, m in enumerate([81, 88, 93]):
        add(tone(hz(m), 1.2, "sine", 0.002, 0.35), ev + k*0.06, g=0.10)
# ending: riser + final chord
N = int(1.5*SR); x = rng.standard_normal(N) * np.linspace(0, 1, N)**2 * 0.15
add(x, max(0, e0 - 1.5))
for c in [57, 64, 69, 72, 76]: add(tone(hz(c), 3.5, "sine", 0.01, 1.6), e0, g=0.08)
add(kick(), e0, g=1.0)
mix = np.stack([L, R], 1)[: int(SR*dur)]
fade = int(0.6*SR); mix[-fade:] *= np.linspace(1, 0, fade)[:, None]
mix /= np.abs(mix).max() / 0.85
with wave.open(OUT, "wb") as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes((mix * 32767).astype("<i2").tobytes())
print("audio", OUT, dur)
