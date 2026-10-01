#!/bin/sh
# usage: tools/run.sh plans/pN.json  -> rebuild out/test.html and run the plan
cd "$(dirname "$0")/.."
node build.mjs out/test.html > /dev/null || exit 1
OUT=$(node -e "console.log(JSON.parse(require('fs').readFileSync('$1','utf8')).out)")
rm -rf "$OUT"
(nohup node tools/shot.mjs "$1" > /dev/null 2>&1 &)
sleep 2
until [ -f "$OUT/done.txt" ]; do sleep 2; done
grep -v "X4122\|cannot be represented\|^(2" "$OUT/log.txt"
