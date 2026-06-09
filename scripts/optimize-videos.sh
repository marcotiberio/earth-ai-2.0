#!/usr/bin/env bash
# Re-encode the scroll-scrub videos for smooth seeking.
#
# Why: scroll-scrubbing sets video.currentTime to arbitrary frames. The browser
# must decode forward from the nearest keyframe, so a sparse GOP (our source
# clips have a keyframe only every ~29 frames) makes every seek expensive and
# the scrub feels choppy. We re-encode with a keyframe every few frames so seeks
# are nearly free — this is exactly what earth-ai.com ships (hero_keyframe_every_5).
#
# Usage:
#   brew install ffmpeg          # if needed
#   ./scripts/optimize-videos.sh                 # GOP=5 (smooth, good size)
#   GOP=1 ./scripts/optimize-videos.sh           # all-intra (glassiest, larger)
#   MAXW=1280 CRF=24 ./scripts/optimize-videos.sh
#
# Writes *.scrub.mp4 next to each source so you can compare before replacing.
set -euo pipefail

DIR="$(cd "$(dirname "$0")/../public/videos" && pwd)"
GOP="${GOP:-5}"        # keyframe interval in frames
MAXW="${MAXW:-1600}"   # cap width (background video rarely needs > 1600px)
CRF="${CRF:-23}"       # quality: lower = better/bigger (18–28 sane range)

command -v ffmpeg >/dev/null || { echo "ffmpeg not found — 'brew install ffmpeg'"; exit 1; }

shopt -s nullglob
for src in "$DIR"/*.mp4; do
  case "$src" in *.scrub.mp4) continue;; esac
  out="${src%.mp4}.scrub.mp4"
  echo "→ $(basename "$src")  (GOP=$GOP, maxW=$MAXW, CRF=$CRF)"
  ffmpeg -y -i "$src" -an \
    -vf "scale='min($MAXW,iw)':-2" \
    -c:v libx264 -profile:v high -pix_fmt yuv420p \
    -g "$GOP" -keyint_min "$GOP" -sc_threshold 0 \
    -crf "$CRF" -preset slow \
    -movflags +faststart \
    "$out" </dev/null
  printf '   %s → %s\n' \
    "$(du -h "$src"  | cut -f1)" "$(du -h "$out" | cut -f1)"
done

echo "Done. Review the *.scrub.mp4 files, then replace the originals and update the video paths in Prismic."
