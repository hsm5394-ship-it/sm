#!/bin/sh
# usage: sh sheet.sh name "t1 t2 ..."  -> output/check/name_<t>.jpg at 1/2 scale
mkdir -p output/check
for t in $2; do node render.js --scale 0.5 --still $t --out output/check/$1_$t.jpg >/dev/null & done; wait
