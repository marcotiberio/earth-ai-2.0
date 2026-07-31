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
# FPS: the masters are 60fps, but the scrub picks its frame from scroll position,
# not from playback rate — nobody watches these at 1×. 30fps halves the frame
# count for no perceptible loss while scrubbing, and it is the single biggest
# lever on file size (and therefore on the Prismic CDN bandwidth bill: the 7
# homepage clips were 129 MB per desktop visit at 60fps/CRF 26). Set FPS=60 to
# restore the old target if a specific clip needs it.
#
# GOP stays at 5 FRAMES, so seeks still decode at most 5 frames forward. At 30fps
# that is a keyframe every 167ms rather than 83ms, which only affects fastSeek's
# landing accuracy on a fast flick (≤5/fps s off — still invisible mid-flick).
#
# Output: a single HEVC clip, hvc1-tagged — our delivery standard (~40% smaller
# than the equivalent h264). The site serves one source per video now, so the
# encode is HEVC-only. Note the support tradeoff: HEVC plays on Safari/iOS and
# HEVC-capable Chrome (hardware decode); browsers without it fall back to the
# poster image rather than the clip.
#
#   <name>.scrub.gop<GOP>.hevc.mp4   HEVC, hvc1-tagged → upload to video_url
#
# Usage:
#   brew install ffmpeg          # if needed
#   ./scripts/optimize-videos.sh                 # GOP=5, 30fps, maxW=1600, CRF=28
#   MAXW=1280 HEVC_CRF=30 ./scripts/optimize-videos.sh   # smaller still (mobile)
#   FPS=60 HEVC_CRF=26 ./scripts/optimize-videos.sh      # the pre-2026-07 target
#
# Reads the 1920×1080 masters from media-src/videos/_original and writes the
# web outputs one level up, ready to upload to Prismic (.hevc.mp4 → video_url).
set -euo pipefail

DIR="$(cd "$(dirname "$0")/../media-src/videos" && pwd)"
SRC_DIR="${SRC_DIR:-$DIR/_original}" # override to encode another batch, e.g. SRC_DIR=media-src/videos/_new
OUT_DIR="${OUT_DIR:-$DIR}"           # where the .scrub outputs land
GOP="${GOP:-5}"            # keyframe interval in frames
FPS="${FPS:-30}"           # output framerate (see FPS note above; masters are 60)
MAXW="${MAXW:-1600}"       # cap width (background video rarely needs > 1600px)
HEVC_CRF="${HEVC_CRF:-28}" # x265 quality: lower = better/bigger (x265 CRF runs ~3 higher than x264 for equal quality)

command -v ffmpeg >/dev/null || { echo "ffmpeg not found — 'brew install ffmpeg'"; exit 1; }

shopt -s nullglob
for src in "$SRC_DIR"/*.mp4; do
  case "$src" in *.scrub.*) continue;; esac # never re-encode our own outputs
  base="$OUT_DIR/$(basename "${src%.mp4}")"

  echo "→ $(basename "$src")  (GOP=$GOP, ${FPS}fps, maxW=$MAXW, CRF=$HEVC_CRF)"

  # Resume support: skip outputs that already exist and are newer than their
  # source. (Delete partials from an interrupted run before re-running.)
  # The framerate is in the filename alongside the GOP so a target change can't
  # be silently swallowed by that skip — an existing 60fps output is a different
  # file, not a hit.
  # HEVC must be tagged hvc1 (not the default hev1) or Safari refuses to play it.
  hevc="$base.scrub.gop$GOP.fps$FPS.hevc.mp4"
  if [ -f "$hevc" ] && [ "$hevc" -nt "$src" ]; then
    echo "   hevc: $(basename "$hevc") exists, skipping"
  else
    # fps before scale: drop frames first, then scale only the ones we keep.
    ffmpeg -y -i "$src" -an \
      -vf "fps=$FPS,scale='min($MAXW,iw)':-2" \
      -c:v libx265 -pix_fmt yuv420p -tag:v hvc1 \
      -x265-params "keyint=$GOP:min-keyint=$GOP:scenecut=0:log-level=error" \
      -crf "$HEVC_CRF" -preset medium \
      -movflags +faststart \
      "$hevc" </dev/null
    printf '   hevc: %s → %s\n' \
      "$(du -h "$src" | cut -f1)" "$(du -h "$hevc" | cut -f1)"
  fi
done

echo "Done. Review the outputs, then upload to Prismic: .scrub.gop$GOP.fps$FPS.hevc.mp4 → video_url."
