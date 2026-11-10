"""Score for the tall-building film: a calm bed (Dmaj9 chords, 84 bpm) the whole way, moving air when the wind
rises and under each wide shot, a soft thud on every scene change, a low rumble while the ground shakes.

    python run_sfx.py sims/tower/score.py

Every time comes from tower-film/timeline.json (written from film.js's BEAT).
"""

import os

from sfx.score_kit import airy, bed, chords, hz, rumble, thud

TIMELINE = "../tower-film/timeline.json"
OUT = os.path.join(os.environ.get("TEARDOWN_OUT", "teardown-out"), "tower-score.wav")
TARGET_LUFS = -14.0
SEED = 101

CHORDS = chords("Dmaj9:D2 A2 C#3 E3 F#3/D1", "Bm9:B1 F#2 A2 C#3 D3/B0", "Gmaj7:G2 D3 F#3 B3/G1", "A6sus:A2 D3 E3 F#3 B3/A1")
MOTIF = [(0.5, hz("F#5")), (1.5, hz("A5")), (2.5, hz("E5"))]


def score(mix, tl):
    dur = tl["duration"]
    b = tl["beats"]
    left, right, low, drums = bed(dur, 84, CHORDS, MOTIF, motif_voice="epiano", kicks=(0, 2.5), snares=(), hats=8, swing=0.0, keys_vel=0.7, keys_lp=3600)
    mix.put_stereo(0, left, right, 0.12)
    mix.put(0, low, 0.12)
    mix.put(0, drums, 0.04)
    # the wind coming up, then a breath of it under each wide shot
    mix.put(b["wind"], airy(4.0, 300, 1400, 0.8), 0.05)
    for key in ("weight", "lockedWide", "quakeWide", "close"):
        mix.put(b[key], airy(3.0, 400, 1100, 0.6), 0.025)
    # a soft knock on each scene change
    for key in ("weight", "ghost", "frame", "damper", "locked", "freed", "base", "close"):
        mix.put(b[key], thud(85, 0.07, 0.4), 0.07)
    # the ground
    mix.put(b["quake"], rumble(b["close"] - b["quake"] - 1.0, lambda t: 38 + 6 * (t % 0.7), 1.0), 0.06)
    mix.put(b["quake"], thud(55, 0.25, 0.9), 0.12)
