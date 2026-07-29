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
# Output: a single HEVC clip, hvc1-tagged — our delivery standard (~40% smaller
# than the equivalent h264). The site serves one source per video now, so the
# encode is HEVC-only. Note the support tradeoff: HEVC plays on Safari/iOS and
# HEVC-capable Chrome (hardware decode); browsers without it fall back to the
# poster image rather than the clip.
#
#   <name>.scrub.gop<GOP>.hevc.mp4         HEVC, hvc1-tagged → upload to video_url
#   <name>.scrub.mobile.gop<GOP>.hevc.mp4  smaller scrub     → upload to video_url_mobile
#   <name>.autoplay.hevc.mp4               low-res linear    → upload to video_url_autoplay
#
# The MOBILE scrub is the same dense-GOP scrub clip at a phone-sized frame —
# served to phones via video_url_mobile when MOBILE_VIDEO_ENABLED is on (falls
# back to the desktop clip when absent). The AUTOPLAY clip feeds the 'autoplay'
# media tier (moderate connections): it loops muted and streams progressively, so
# it needs neither the scrub tier's dense GOP nor its resolution — a normal
# keyframe interval, a smaller frame and a higher CRF make it markedly lighter.
# Set MOBILE=0 or AUTOPLAY=0 to skip either.
#
# Usage:
#   brew install ffmpeg          # if needed
#   ./scripts/optimize-videos.sh                 # desktop + mobile scrub + autoplay
#   MAXW=1280 HEVC_CRF=27 ./scripts/optimize-videos.sh
#   MOBILE=0 AUTOPLAY=0 ./scripts/optimize-videos.sh   # desktop scrub only
#
# Reads the 1920×1080 masters from media-src/videos/_original and writes the
# web outputs one level up, ready to upload to Prismic (.hevc.mp4 → video_url).
set -euo pipefail

DIR="$(cd "$(dirname "$0")/../media-src/videos" && pwd)"
SRC_DIR="${SRC_DIR:-$DIR/_original}" # override to encode another batch, e.g. SRC_DIR=media-src/videos/_new
OUT_DIR="${OUT_DIR:-$DIR}"           # where the .scrub outputs land
GOP="${GOP:-5}"            # keyframe interval in frames
MAXW="${MAXW:-1600}"       # cap width (background video rarely needs > 1600px)
HEVC_CRF="${HEVC_CRF:-26}" # x265 quality: lower = better/bigger (x265 CRF runs ~3 higher than x264 for equal quality)

MOBILE="${MOBILE:-1}"                # also emit a phone-sized scrub encode
MOBILE_MAXW="${MOBILE_MAXW:-1080}"   # phone-sized scrub (still GOP=$GOP for seeking)
MOBILE_CRF="${MOBILE_CRF:-27}"       # a touch more compression than desktop

AUTOPLAY="${AUTOPLAY:-1}"              # also emit the low-res linear autoplay clip
AUTOPLAY_MAXW="${AUTOPLAY_MAXW:-960}"  # autoplay tier is smaller than the scrub tier
AUTOPLAY_CRF="${AUTOPLAY_CRF:-30}"     # more compression — it plays, never scrubs
AUTOPLAY_GOP="${AUTOPLAY_GOP:-48}"     # linear playback needs no dense keyframes

command -v ffmpeg >/dev/null || { echo "ffmpeg not found — 'brew install ffmpeg'"; exit 1; }

shopt -s nullglob
for src in "$SRC_DIR"/*.mp4; do
  case "$src" in *.scrub.*|*.autoplay.*) continue;; esac # never re-encode our own outputs
  base="$OUT_DIR/$(basename "${src%.mp4}")"

  echo "→ $(basename "$src")  (GOP=$GOP, maxW=$MAXW)"

  # Resume support: skip outputs that already exist and are newer than their
  # source. (Delete partials from an interrupted run before re-running.)
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

  # Mobile SCRUB encode: the same dense GOP (it still scrubs, so backward seeks
  # must stay cheap) but a phone-sized frame and slightly higher CRF. Served to
  # phones via video_url_mobile when MOBILE_VIDEO_ENABLED is on; the code falls
  # back to the desktop clip when it's absent. hvc1-tagged like the others.
  if [ "$MOBILE" = "1" ]; then
    mob="$base.scrub.mobile.gop$GOP.hevc.mp4"
    if [ -f "$mob" ] && [ "$mob" -nt "$src" ]; then
      echo "   mobile: $(basename "$mob") exists, skipping"
    else
      ffmpeg -y -i "$src" -an \
        -vf "scale='min($MOBILE_MAXW,iw)':-2" \
        -c:v libx265 -pix_fmt yuv420p -tag:v hvc1 \
        -x265-params "keyint=$GOP:min-keyint=$GOP:scenecut=0:log-level=error" \
        -crf "$MOBILE_CRF" -preset medium \
        -movflags +faststart \
        "$mob" </dev/null
      printf '   mobile: %s → %s\n' \
        "$(du -h "$src" | cut -f1)" "$(du -h "$mob" | cut -f1)"
    fi
  fi

  # Low-res AUTOPLAY encode for the 'autoplay' media tier. It loops muted and
  # streams progressively (never scrubs), so a normal keyframe interval, a
  # smaller frame and a higher CRF keep it much lighter than the scrub clip.
  # hvc1-tagged like the scrub output so Safari/iOS play it.
  if [ "$AUTOPLAY" = "1" ]; then
    auto="$base.autoplay.hevc.mp4"
    if [ -f "$auto" ] && [ "$auto" -nt "$src" ]; then
      echo "   autoplay: $(basename "$auto") exists, skipping"
    else
      ffmpeg -y -i "$src" -an \
        -vf "scale='min($AUTOPLAY_MAXW,iw)':-2" \
        -c:v libx265 -pix_fmt yuv420p -tag:v hvc1 \
        -x265-params "keyint=$AUTOPLAY_GOP:min-keyint=$AUTOPLAY_GOP:scenecut=0:log-level=error" \
        -crf "$AUTOPLAY_CRF" -preset medium \
        -movflags +faststart \
        "$auto" </dev/null
      printf '   autoplay: %s → %s\n' \
        "$(du -h "$src" | cut -f1)" "$(du -h "$auto" | cut -f1)"
    fi
  fi
done

echo "Done. Review the outputs, then upload to Prismic:"
echo "  .scrub.gop$GOP.hevc.mp4         → video_url"
echo "  .scrub.mobile.gop$GOP.hevc.mp4  → video_url_mobile"
echo "  .autoplay.hevc.mp4              → video_url_autoplay"
