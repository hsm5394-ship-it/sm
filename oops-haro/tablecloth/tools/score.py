#!/usr/bin/env python3
"""Background music and sound effects for 'Oops Haro! - The Tablecloth Disaster'.

Everything is synthesised here (numpy only): no samples, no voices, nothing licensed.
  music   marimba melody, pizzicato strings, shaker / woodblock / soft kick, C major, 120 bpm, 15 bars = 30.000 s
  effects every entry of ../timeline.json "sfx", at its own second

    python3 tools/score.py            ->  audio/oops-haro-score.wav  (48 kHz stereo, exactly 30.000 s)

After the scene clips exist, watch them, move the "t" of any effect that lands off its action in timeline.json,
and run this again.
"""
import json
import os
import wave

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
TL = json.load(open(os.path.join(HERE, "..", "timeline.json")))
SR = 48000
DUR = TL["duration"]
N = int(round(SR * DUR))
BEAT = 60.0 / TL["bpm"]
rng = np.random.default_rng(63)
L = np.zeros(N)
R = np.zeros(N)

NOTE = {"C": 0, "D": 2, "E": 4, "F": 5, "G": 7, "A": 9, "B": 11}


def hz(name):
    semis = NOTE[name[0]] + (1 if "#" in name else 0) + 12 * (int(name[-1]) + 1)
    return 440.0 * 2 ** ((semis - 69) / 12)


def put(t, x, gain=1.0, pan=0.0):
    i = int(round(t * SR))
    if i >= N:
        return
    x = x[: N - i] * gain
    L[i : i + len(x)] += x * np.sqrt(0.5 * (1 - pan))
    R[i : i + len(x)] += x * np.sqrt(0.5 * (1 + pan))


def tt(d):
    return np.arange(int(d * SR)) / SR


def marimba(f, d=0.7, vel=1.0):
    t = tt(d)
    x = np.sin(2 * np.pi * f * t) * np.exp(-t / 0.22) + 0.35 * np.sin(2 * np.pi * 4 * f * t) * np.exp(-t / 0.05)
    return vel * x * np.minimum(1, t / 0.002)


def xylo(f, d=0.9, vel=1.0):
    t = tt(d)
    x = np.sin(2 * np.pi * f * t) * np.exp(-t / 0.28) + 0.5 * np.sin(2 * np.pi * 3 * f * t) * np.exp(-t / 0.07) + 0.2 * np.sin(2 * np.pi * 6.3 * f * t) * np.exp(-t / 0.02)
    return vel * x * np.minimum(1, t / 0.001)


def pizz(f, d=0.5, vel=1.0):
    t = tt(d)
    x = sum(np.sin(2 * np.pi * f * k * t) * np.exp(-t * (7 + 5 * k)) / k for k in range(1, 9))
    return vel * x * np.minimum(1, t / 0.003)


def band(n, lo, hi):
    """White noise with everything outside lo..hi Hz removed."""
    spec = np.fft.rfft(rng.standard_normal(n))
    fr = np.fft.rfftfreq(n, 1 / SR)
    spec[(fr < lo) | (fr > hi)] = 0
    x = np.fft.irfft(spec, n)
    return x / (np.abs(x).max() + 1e-9)


def shaker(vel=1.0):
    t = tt(0.07)
    return vel * band(len(t), 5000, 11000) * np.exp(-t / 0.018)


def wood(f=900, vel=1.0):
    t = tt(0.09)
    return vel * np.sin(2 * np.pi * f * t) * np.exp(-t / 0.015)


def kick(vel=1.0):
    t = tt(0.22)
    return vel * np.sin(2 * np.pi * (48 * t + 60 * 0.03 * (1 - np.exp(-t / 0.03)))) * np.exp(-t / 0.07)


# ------------------------------------------------------------ effects
def sfx_ding(e):
    put(e["t"], xylo(hz("E6"), 1.0), 0.20, 0.1)
    put(e["t"] + 0.09, xylo(hz("G6"), 1.0), 0.16, -0.1)


def sfx_swish(e):
    d = e.get("dur", 1.0)
    t = tt(d)
    env = np.sin(np.pi * np.minimum(1, t / d)) ** 1.5
    x = band(len(t), 900, 4200) * env * (0.75 + 0.25 * np.sin(2 * np.pi * 9 * t))
    put(e["t"], x, 0.085, -0.15)


def tok(f=1250, vel=1.0):
    t = tt(0.09)
    return vel * (np.sin(2 * np.pi * f * t) * np.exp(-t / 0.012) + 0.4 * band(len(t), 2000, 6000) * np.exp(-t / 0.004))


def sfx_tok(e):
    put(e["t"], tok(1250 if not e.get("soft") else 700, 0.5 if e.get("soft") else 1.0), 0.20, 0.1)


def sfx_rattle(e):
    d = e.get("dur", 1.5)
    k = int(d * 7)
    for i in range(k):
        t0 = e["t"] + d * (i + rng.uniform(0, 0.6)) / k
        put(t0, tok(rng.uniform(950, 1700), rng.uniform(0.4, 0.9)), 0.13, rng.uniform(-0.4, 0.4))


def sfx_brass(e):
    # two short muted notes falling a semitone: wah-wah
    for j, (name, at) in enumerate((("B3", 0.0), ("A#3", 0.34))):
        d = 0.3 if j == 0 else 0.62
        t = tt(d)
        f = hz(name) * (1 - (0.03 * t / d if j else 0))
        ph = 2 * np.pi * np.cumsum(f * np.ones(len(t))) / SR
        bright = 3 + 5 * np.exp(-t / 0.12)
        x = sum(np.sin(k * ph) / k * np.clip(bright - k + 1, 0, 1) for k in range(1, 9))
        env = np.minimum(1, t / 0.02) * np.minimum(1, (d - t) / 0.08)
        put(e["t"] + at, x * env, 0.11, 0.0)


def sfx_boing(e):
    d = 0.75
    t = tt(d)
    f = 190 + 260 * np.exp(-t / 0.5) + 70 * np.sin(2 * np.pi * 11 * t) * np.exp(-t / 0.35)
    ph = 2 * np.pi * np.cumsum(f) / SR
    x = (np.sin(ph) + 0.3 * np.sin(2 * ph)) * np.exp(-t / 0.28) * np.minimum(1, t / 0.004)
    put(e["t"], x, 0.17, 0.0)


def sfx_ending(e):
    for i, name in enumerate(("C6", "E6", "G6", "C7")):
        put(e["t"] + i * 0.11, xylo(hz(name), 1.0), 0.19, -0.3 + 0.2 * i)
    put(e["t"] + 0.44, pizz(hz("C3"), 0.6), 0.2, 0.0)


SFX = {"ding": sfx_ding, "swish": sfx_swish, "tok": sfx_tok, "rattle": sfx_rattle, "brass": sfx_brass, "boing": sfx_boing, "ending": sfx_ending}

# ------------------------------------------------------------ music: 15 bars of 4/4, the last one is the button
CHORDS = [("C", ["C4", "E4", "G4"], "C2"), ("A", ["A3", "C4", "E4"], "A2"), ("F", ["F3", "A3", "C4"], "F2"), ("G", ["G3", "B3", "D4"], "G2")]
# melody: (beat in the bar, note); two 4-bar phrases that answer each other
PHRASE_A = [[(0, "E5"), (0.5, "G5"), (1, "C6"), (2, "G5"), (3, "E5")], [(0, "C5"), (0.5, "E5"), (1, "A5"), (2.5, "E5"), (3, "C5")],
            [(0, "A5"), (1, "F5"), (1.5, "A5"), (2, "C6"), (3, "A5")], [(0, "G5"), (1, "B5"), (2, "D6"), (2.5, "B5"), (3, "G5")]]
PHRASE_B = [[(0, "G5"), (1, "E5"), (1.5, "G5"), (2, "C6"), (3.5, "G5")], [(0, "E5"), (1, "C5"), (2, "E5"), (2.5, "A5"), (3, "E5")],
            [(0, "F5"), (0.5, "A5"), (1, "C6"), (2, "A5"), (3, "F5")], [(0, "D5"), (1, "G5"), (2, "B5"), (3, "D6")]]
for bar in range(14):
    t0 = bar * 4 * BEAT
    _, tri, root = CHORDS[bar % 4]
    mel = (PHRASE_A if (bar // 4) % 2 == 0 else PHRASE_B)[bar % 4]
    for b, name in mel:
        put(t0 + b * BEAT, marimba(hz(name)), 0.17, -0.25)
    # pizzicato: bass on 1 and 3, the chord plucked on the off-beats
    for b in (0, 2):
        put(t0 + b * BEAT, pizz(hz(root), 0.55), 0.22, 0.0)
    for b in (1, 3):
        for name in tri:
            put(t0 + b * BEAT, pizz(hz(name), 0.35), 0.07, 0.3)
    # percussion comes in after the first bar so the first ding is in the clear
    if bar >= 1:
        for b in np.arange(0, 4, 0.5):
            put(t0 + b * BEAT, shaker(0.5 if b % 1 else 0.9), 0.045, 0.35)
        put(t0, kick(), 0.2, 0.0)
        put(t0 + 2 * BEAT, kick(0.7), 0.2, 0.0)
        put(t0 + 3.5 * BEAT, wood(900), 0.07, -0.4)
        if bar % 2:
            put(t0 + 1.5 * BEAT, wood(1200), 0.06, 0.4)
# bar 15: land on C and leave the last second to the ending effect
t0 = 14 * 4 * BEAT
for name in ("C5", "E5", "G5"):
    put(t0, marimba(hz(name), 1.0), 0.14, -0.2)
put(t0, pizz(hz("C2"), 0.8), 0.24, 0.0)
put(t0, kick(), 0.2, 0.0)

for e in TL["sfx"]:
    SFX[e["kind"]](e)

# a 10 ms fade at each end so the file starts and stops without a click, then peak at -1.5 dBFS
fade = int(0.01 * SR)
for ch in (L, R):
    ch[:fade] *= np.linspace(0, 1, fade)
    ch[-fade:] *= np.linspace(1, 0, fade)
peak = max(np.abs(L).max(), np.abs(R).max())
g = 10 ** (-1.5 / 20) / peak
out = os.path.join(HERE, "..", "audio", "oops-haro-score.wav")
pcm = (np.stack([L, R], 1) * g * 32767).astype("<i2")
with wave.open(out, "wb") as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes(pcm.tobytes())
print(f"wrote {os.path.relpath(out)}: {len(pcm) / SR:.3f} s, {len(TL['sfx'])} effects")
