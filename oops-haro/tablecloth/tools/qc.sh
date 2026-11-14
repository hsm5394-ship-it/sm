#!/usr/bin/env bash
# Checks what a machine can check on the finished film and makes the sheets a person (or Claude) reads for the rest.
#
#   tools/qc.sh Oops_Haro_Tablecloth_30s.mp4
#
# Measured here: container, codecs, size, frame rate, frame count, duration, audio layout, black frames, frozen picture,
# silence. NOT measured here, look at qc/sheet-*.png and listen: character identity and costume, cartoon style, cast
# count, prop count and motion, whether each effect lands on its action, voices, on-screen text, logos, watermarks.
set -uo pipefail
f="${1:?usage: tools/qc.sh film.mp4}"
out="$(dirname "$f")/qc"; mkdir -p "$out"
fail=0
check() { if [ "$2" = "$3" ]; then echo "PASS  $1: $2"; else echo "FAIL  $1: $2 (want $3)"; fail=1; fi; }
v() { ffprobe -v error -select_streams v:0 -show_entries "stream=$1" -of csv=p=0 "$f" | head -1; }
a() { ffprobe -v error -select_streams a:0 -show_entries "stream=$1" -of csv=p=0 "$f" | head -1; }
check "video codec" "$(v codec_name)" h264
check "width" "$(v width)" 1080
check "height" "$(v height)" 1920
check "pixel aspect" "$(v sample_aspect_ratio)" "1:1"
check "frame rate" "$(v r_frame_rate)" "30/1"
check "frames" "$(ffprobe -v error -count_frames -select_streams v:0 -show_entries stream=nb_read_frames -of csv=p=0 "$f")" 900
check "video duration" "$(printf '%.3f' "$(v duration)")" 30.000
check "audio codec" "$(a codec_name)" aac
check "audio channels" "$(a channels)" 2
adur=$(a duration)
if awk -v d="$adur" 'BEGIN{exit !(d>=29.97 && d<=30.03)}'; then echo "PASS  audio duration: ${adur}s (AAC frames are 21 ms, so within 30 ms of 30)"; else echo "FAIL  audio duration: ${adur}s"; fail=1; fi
check "container duration" "$(printf '%.2f' "$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$f")")" 30.00
log=$(ffmpeg -hide_banner -nostats -i "$f" -vf "blackdetect=d=0.1:pix_th=0.08,freezedetect=n=0.001:d=0.75" -af "silencedetect=n=-45dB:d=1" -f null - 2>&1)
n=$(echo "$log" | grep -c "black_start"); check "black stretches (>=0.1 s)" "$n" 0
n=$(echo "$log" | grep -c "freeze_start"); check "frozen picture (>=0.75 s)" "$n" 0
n=$(echo "$log" | grep -c "silence_start"); check "silent stretches (>=1 s)" "$n" 0
echo "$log" | grep -E "black_start|freeze_start|silence_start" | sed 's/^.*\] /      /'
# sheets: 2 frames a second, 20 to a sheet, each stamped with its time, plus the waveform with a 1 s grid
ffmpeg -y -loglevel error -i "$f" -vf "fps=2,scale=216:384,drawtext=text='%{pts\:hms}':x=6:y=6:fontsize=20:fontcolor=white:box=1:boxcolor=black@0.6,tile=10x2" -frames:v 3 "$out/sheet-%d.png"
ffmpeg -y -loglevel error -i "$f" -filter_complex "showwavespic=s=1800x300:split_channels=0:colors=0xe3562a" -frames:v 1 "$out/wave.png"
echo "sheets: $out/sheet-1.png .. sheet-3.png   waveform: $out/wave.png"
[ "$fail" = 0 ] && echo "MEASURED CHECKS: all passed (the visual and listening checks are still to do)" || echo "MEASURED CHECKS: FAILED"
exit $fail
