"""Score for the 63빌딩 film: a calm bed (Amaj9 chords, 84 bpm) at one level, air under the wind while the tower leans,
a soft whoosh as the curtain wall peels and as the five systems slide into a row, a low thud when it stands whole
again, and a quiet click on every button the operator presses.

    python run_sfx.py machines/b63-shared/score.py

Every time comes from b63-film/timeline.json, which mirrors SCRIPT in film.js.
"""

import os

from sfx.score_kit import airy, bed, chords, hz, thud
from sfx.synth import click, whoosh

TIMELINE = "../b63-film/timeline.json"
OUT = os.path.join(os.environ.get("TEARDOWN_OUT", "teardown-out"), "b63-score.wav")
TARGET_LUFS = -14.0
SEED = 63

CHORDS = chords("Amaj9:A2 E3 G#3 B3 C#4/A1", "F#m9:F#2 C#3 E3 G#3 A3/F#1", "Dmaj7:D2 A2 C#3 F#3/D1", "E6sus:E2 A2 B2 C#3 F#3/E1")
MOTIF = [(0.5, hz("C#5")), (1.5, hz("E5")), (2.5, hz("B4"))]


def score(mix, tl):
    dur = tl["duration"]
    left, right, low, drums = bed(dur, 84, CHORDS, MOTIF, motif_voice="epiano", kicks=(0, 2.5), snares=(), hats=8, swing=0.0, keys_vel=0.7, keys_lp=3600)
    mix.put_stereo(0, left, right, 0.12)
    mix.put(0, low, 0.12)
    mix.put(0, drums, 0.04)
    w0, w1 = tl["wind"]
    mix.put(w0, airy(w1 - w0 + 1.2, 300, 900, 0.7), 0.05)
    mix.put(tl["explode"], whoosh(1.8, 400, 2200, 0.5), 0.05)
    mix.put(tl["layout"], whoosh(2.2, 300, 1800, 0.6), 0.05)
    mix.put(tl["rebuild"], whoosh(2.0, 2000, 300, 0.5), 0.05)
    mix.put(tl["rebuild"] + 2.1, thud(70, 0.08, 0.5), 0.09)
    for t in tl["clicks"]:
        mix.put(t, click(2400, 0.025), 0.05)
    for t, _ in tl["slides"]:
        mix.put(t, click(1700, 0.03), 0.045)
