#!/usr/bin/env bash
# Joins the generated scene clips into the final film and checks it.
#
#   tools/assemble.sh                 reads clips/manifest.txt, writes Oops_Haro_Tablecloth_30s.mp4
#   CLIPS=dir OUT=file tools/assemble.sh
#
# Every clip is conformed to 1080x1920, 30 fps, square pixels and cut to an exact number of frames, so the joined
# picture is exactly 900 frames = 30.000 s. Cuts are hard cuts: no fades, no speed changes. The clips' own audio is
# dropped (generated clips often carry stray voices or noise) and audio/oops-haro-score.wav is laid under the picture.
set -euo pipefail
cd "$(dirname "$0")/.."
CLIPS="${CLIPS:-clips}"
OUT="${OUT:-Oops_Haro_Tablecloth_30s.mp4}"
SCORE="${SCORE:-audio/oops-haro-score.wav}"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

[ -f "$SCORE" ] || { echo "missing $SCORE: run python3 tools/score.py"; exit 1; }
total=0; i=0; : > "$WORK/list.txt"
while read -r file keep skip; do
  case "$file" in ''|\#*) continue;; esac
  [ -f "$CLIPS/$file" ] || { echo "missing clip: $CLIPS/$file"; exit 1; }
  frames=$(awk -v k="$keep" 'BEGIN{printf "%d", k*30+0.5}')
  have=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$CLIPS/$file" < /dev/null)
  awk -v h="$have" -v k="$keep" -v s="${skip:-0}" 'BEGIN{exit !(h+0.02 >= k+s)}' || { echo "$file is ${have}s, shorter than the ${keep}s (+${skip:-0}s skip) the manifest keeps"; exit 1; }
  i=$((i+1)); part=$(printf "%s/part-%02d.mp4" "$WORK" "$i")
  ffmpeg -nostdin -y -loglevel error -ss "${skip:-0}" -i "$CLIPS/$file" -an \
    -vf "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,fps=30,setsar=1" \
    -frames:v "$frames" -c:v libx264 -crf 16 -preset slow -pix_fmt yuv420p "$part"
  got=$(ffprobe -v error -count_frames -select_streams v:0 -show_entries stream=nb_read_frames -of csv=p=0 "$part" < /dev/null)
  [ "$got" = "$frames" ] || { echo "$file gave $got frames, wanted $frames"; exit 1; }
  echo "file '$part'" >> "$WORK/list.txt"
  total=$((total+frames))
done < "$CLIPS/manifest.txt"
[ "$i" -gt 0 ] || { echo "clips/manifest.txt lists no clips yet"; exit 1; }
[ "$total" = 900 ] || { echo "the manifest keeps $total frames ($(awk -v t="$total" 'BEGIN{print t/30}') s); it must be 900 (30 s)"; exit 1; }

ffmpeg -y -loglevel error -f concat -safe 0 -i "$WORK/list.txt" -i "$SCORE" -map 0:v -map 1:a \
  -c:v libx264 -crf 18 -preset slow -profile:v high -pix_fmt yuv420p -r 30 -frames:v 900 \
  -c:a aac -b:a 256k -ar 48000 -ac 2 -af "apad=whole_dur=30,atrim=0:30" -t 30 -movflags +faststart "$OUT"
echo "wrote $OUT"
tools/qc.sh "$OUT"
