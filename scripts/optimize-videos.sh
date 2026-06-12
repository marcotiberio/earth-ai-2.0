#!/usr/bin/env bash
# Re-encode the scroll-scrub videos for smooth seeking AND sane mobile delivery.
#
# Why: scroll-scrubbing sets video.currentTime to arbitrary frames. The browser
# must decode forward from the nearest keyframe, so a sparse GOP (our source
# clips have a keyframe only every ~29 frames) makes every seek expensive and
# the scrub feels choppy. We re-encode with a keyframe every few frames so seeks
# are nearly free — this is exactly what earth-ai.com ships (hero_keyframe_every_5).
#
# All-intra (GOP=1) is NOT needed: useScrubVideo's play-chase plays forward
# (keyframe density irrelevant) and only seeks on backward scroll, where GOP=5
# is already near-free. All-intra triples the bitrate for nothing — it's what
# caused the 7–16 Mbps files that choked mobile connections.
#
# Each source produces two outputs:
#   <name>.scrub.mp4       h264 (works everywhere)
#   <name>.scrub.hevc.mp4  HEVC, hvc1-tagged (Safari/iOS hardware decode,
#                          ~40% smaller — served when canPlayType allows)
#
# Usage:
#   brew install ffmpeg          # if needed
#   ./scripts/optimize-videos.sh                 # GOP=5 (smooth, good size)
#   MAXW=1280 CRF=24 ./scripts/optimize-videos.sh
#
# Reads the 1920×1080 masters from media-src/videos/_original and writes the
# web outputs one level up, ready to upload to Prismic
# (video_url ← .scrub.mp4, video_url_hevc ← .scrub.hevc.mp4).
set -euo pipefail

DIR="$(cd "$(dirname "$0")/../media-src/videos" && pwd)"
SRC_DIR="${SRC_DIR:-$DIR/_original}" # override to encode another batch, e.g. SRC_DIR=media-src/videos/_new
OUT_DIR="${OUT_DIR:-$DIR}"           # where the .scrub outputs land
GOP="${GOP:-5}"            # keyframe interval in frames
MAXW="${MAXW:-1600}"       # cap width (background video rarely needs > 1600px)
CRF="${CRF:-23}"           # h264 quality: lower = better/bigger (18–28 sane range)
HEVC_CRF="${HEVC_CRF:-26}" # x265 CRF runs ~3 higher than x264 for equal quality

command -v ffmpeg >/dev/null || { echo "ffmpeg not found — 'brew install ffmpeg'"; exit 1; }

shopt -s nullglob
for src in "$SRC_DIR"/*.mp4; do
  case "$src" in *.scrub.*) continue;; esac # never re-encode our own outputs
  base="$OUT_DIR/$(basename "${src%.mp4}")"

  echo "→ $(basename "$src")  (GOP=$GOP, maxW=$MAXW)"

  # Resume support: skip outputs that already exist and are newer than their
  # source. (Delete partials from an interrupted run before re-running.)
  out="$base.scrub.gop$GOP.mp4"
  if [ -f "$out" ] && [ "$out" -nt "$src" ]; then
    echo "   h264: $(basename "$out") exists, skipping"
  else
    ffmpeg -y -i "$src" -an \
      -vf "scale='min($MAXW,iw)':-2" \
      -c:v libx264 -profile:v high -pix_fmt yuv420p \
      -g "$GOP" -keyint_min "$GOP" -sc_threshold 0 \
      -crf "$CRF" -preset slow \
      -movflags +faststart \
      "$out" </dev/null
    printf '   h264: %s → %s\n' \
      "$(du -h "$src" | cut -f1)" "$(du -h "$out" | cut -f1)"
  fi

  # HEVC must be tagged hvc1 (not the default hev1) or Safari refuses to play it.
  hevc="$base.scrub.gop$GOP.hevc.mp4"
  if [ -f "$hevc" ] && [ "$hevc" -nt "$src" ]; then
    echo "   hevc: $(basename "$hevc") exists, skipping"
  else
    ffmpeg -y -i "$src" -an \
      -vf "scale='min($MAXW,iw)':-2" \
      -c:v libx265 -pix_fmt yuv420p -tag:v hvc1 \
      -x265-params "keyint=$GOP:min-keyint=$GOP:scenecut=0:log-level=error" \
      -crf "$HEVC_CRF" -preset medium \
      -movflags +faststart \
      "$hevc" </dev/null
    printf '   hevc: %s → %s\n' \
      "$(du -h "$src" | cut -f1)" "$(du -h "$hevc" | cut -f1)"
  fi
done

echo "Done. Review the outputs, then upload both to Prismic: .scrub.mp4 → video_url, .scrub.hevc.mp4 → video_url_hevc."
