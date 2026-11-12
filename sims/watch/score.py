"""Score for the mechanical watch film: a light bed at 75 bpm, so the watch's 5 ticks a second are its sixteenth
notes, a tick on every beat of the escapement you can hear one by one (real time and slow motion), a whir under the
fast-forward, air on the two flips and a bell when the dial comes back.

    python run_sfx.py sims/watch/score.py

Every time comes from timeline.json, which make-timeline.mjs writes from the film's script.
"""

import os

from sfx.score_kit import airy, bed, chords, hz, motor, thud
from sfx.synth import chime, click, whoosh

TIMELINE = "timeline.json"
OUT = os.path.join(os.environ.get("TEARDOWN_OUT", "teardown-out"), "watch-score.wav")
TARGET_LUFS = -14.0
SEED = 23

CHORDS = chords("Dmaj9:D2 A2 C#3 E3 F#3/D1", "Bm9:B1 F#2 A2 C#3 D3/B0", "Gmaj7:G2 D3 F#3 B3/G1", "A6sus:A2 D3 E3 F#3 B3/A1")
MOTIF = [(0.5, hz("F#5")), (1.5, hz("A5")), (2.5, hz("E5"))]


def rate_at(tl, t):
    r = tl["speed"][0]["rate"]
    for s in tl["speed"]:
        if s["t"] <= t:
            r = s["rate"]
    return r


def score(mix, tl):
    dur = tl["duration"]
    b = tl["beats"]
    left, right, low, drums = bed(dur - 0.08, 75, CHORDS, MOTIF, motif_voice="epiano", kicks=(0, 2.5), snares=(), hats=4, swing=0.0, keys_vel=0.7, keys_lp=3600)
    # the bed's first chord lands 0.12 s in: start it 0.08 s late so chords fall on the tick grid (0.2 s)
    mix.put_stereo(0.08, left, right, 0.12)
    mix.put(0.08, low, 0.12)
    mix.put(0.08, drums, 0.03)
    for i, t in enumerate(tl["ticks"]):
        slow = rate_at(tl, t) < 0.5 and b["escape"] + 0.4 < t < b["balance"] + 0.3
        if slow:
            # slow motion: one tick at a time, so each gets a body
            mix.put(t, click(1500, 0.06), 0.16)
            mix.put(t, thud(160, 0.03, 0.2), 0.07)
        else:
            close = b["balance"] <= t < b["outro"]
            mix.put(t, click(3400 if i % 2 == 0 else 2700, 0.03), 0.075 if close else 0.045, pan=-0.15 if i % 2 == 0 else 0.15)
    # fast-forward: the train spinning up, held, and let go
    ff = b["escape"] - b["train"]
    mix.put(b["train"] + 0.2, motor(ff, 240, 1700, 21), 0.022)
    mix.put(b["train"], whoosh(1.2, 500, 2600, 0.7), 0.04)
    mix.put(b["escape"] - 0.2, whoosh(1.3, 2600, 400, 0.3), 0.045)
    for k in ("flip", "barrel", "balance", "outro", "dial"):
        mix.put(b[k], airy(1.4, 600, 1500, 0.6), 0.022)
    mix.put(b["dial"] + 1.2, chime([hz("D5"), hz("F#5"), hz("A5")], 2.2, 0.8), 0.07)
