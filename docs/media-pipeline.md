# Media pipeline — scroll-scrub video

[← Wiki home](README.md)

The site's signature effect is **scroll-scrubbed video**: a background clip whose
`currentTime` tracks scroll position. Making that smooth across browsers and
networks is the most involved part of the codebase. Three concerns: **encoding**,
**preloading**, and **per-platform playback**.

## 1. Encoding (`scripts/optimize-videos.sh`)

Source masters (1920×1080) live in `media-src/videos/_original` (git-ignored).
The script re-encodes them for cheap seeking and sane mobile size.

- **GOP=5** (keyframe every 5 frames). Scrubbing seeks to arbitrary frames; the
  decoder must walk forward from the nearest keyframe, so dense keyframes make
  seeks nearly free. Source clips with a keyframe every ~29 frames scrub choppily.
- **NOT all-intra (GOP=1).** All-intra triples the bitrate (the 7–16 Mbps files
  that choked mobile) for no benefit here — the play-chase scrubber plays forward
  (keyframe density irrelevant) and only seeks backward, where GOP=5 is already
  near-free.
- **HEVC, hvc1-tagged** (`-c:v libx265 -tag:v hvc1`). ~40% smaller than h264. The
  site serves **one** source per clip (HEVC only). Tradeoff: plays on Safari/iOS
  and HEVC-capable Chrome; browsers without HEVC fall back to the **poster image**.
  The `hvc1` tag (not the default `hev1`) is mandatory or Safari refuses to play.
- `+faststart` (moov atom up front) so playback/seeking can begin before full
  download.

```bash
brew install ffmpeg
./scripts/optimize-videos.sh                 # GOP=5, maxW=1600, CRF=26
MAXW=1280 HEVC_CRF=27 ./scripts/optimize-videos.sh
```

Output `name.scrub.gop5.hevc.mp4` → upload to the slice's `video_url` in Prismic.
The script is resumable (skips outputs newer than their source).

> Memory note: this matches the project's recorded standard — Prismic-hosted
> clips, GOP=5 + HEVC, never ship all-intra.

## 2. Preloading

Two cooperating layers fill the HTTP cache so scrubbing has bytes to seek through:

### Launch overlay — full download ([useAssetLoader.js](../composables/useAssetLoader.js))
[AppLoader.vue](../components/AppLoader.vue) holds the viewport (scroll locked)
until **every** homepage media URL is *fully* downloaded — not "enough to play at
1×", because scrubbing seeks ahead and plays faster than real-time, so every byte
must be present. `collectMediaUrls` walks the Prismic document for video/image
URLs (device-aware: picks desktop or mobile clip, never both); `startLoading`
streams each via `fetch` with real byte progress, which warms the cache the real
`<video>`/`<img>` elements then reuse. The four logo bars fill with genuine
progress; there is no time cap. Falls back to element-load when `fetch` is
CORS-blocked.

### Background warm-up queue ([utils/scrubVideo.js](../utils/scrubVideo.js))
`prefetchScrubVideo` fetches clips **one at a time** in page order after window
load + idle — used on non-homepage routes. It skips any URL the overlay already
owns (`isManagedAsset`) to avoid duplicate fetches and cache misses, and respects
`navigator.connection.saveData`.

`ScrubScene` additionally attaches each lazy clip's `src` ~1.5 screens out
(3 screens on mobile) via `observeNear`, so deeper sections buffer before they pin.

## 3. Playback — the play-chase scrubber ([useScrubVideo.js](../composables/useScrubVideo.js))

The core problem: **a paused `video.currentTime = t` seek does not repaint on
Android Chrome** — the timestamp moves but the picture freezes. So the scrubber
is platform-split:

- **Forward scroll (most browsers): "play-chase."** Keep the clip *playing*
  toward the scroll-derived target, boosting `playbackRate` (up to 8×, gain 4) to
  catch up. A playing clip paints every frame, so forward scrubbing is smooth.
- **Backward scroll: gated seek.** Can't play in reverse, so seek — but only
  issue a new seek after the previous one paints (`createSeeker`), or re-issuing
  every frame cancels the in-flight seek and nothing completes. Large gaps use
  `fastSeek` (nearest keyframe; ≤5 frames off at GOP=5, invisible mid-flick).
- **WebKit (iOS, macOS Safari): seek in *both* directions.** There the inverse
  holds — paused seeks paint fine, but rate-boosted playback judders. Detected by
  `isSeekScrubEngine()` (UA + iPadOS-masquerades-as-Mac touch-points check).

Other safeguards in the RAF loop:
- **Never chase into an unbuffered region** (`bufferedEndAt` + `BUF_MARGIN`): on a
  slow network the scrub lags smoothly behind and catches up as data arrives,
  rather than stalling the decoder on a frozen frame.
- **Deadband** (0.05s) so it doesn't micro-toggle play/pause at rest.
- **Priming** (`primeScrubVideo`): a muted inline `play()/pause()` kicks the
  decode pipeline — iOS ignores `preload="auto"` and won't paint seeked frames
  until a muted play has run — then waits for a real `duration` before building
  the tween (a lazy `src` arrives seconds after mount; resolving early would build
  a zero-duration scrub).

## Why the loader is so aggressive

Because the scrub seeks to arbitrary timestamps and outpaces real-time playback,
partial buffering isn't enough — a fast scroll into a half-loaded clip would
stall. Hence the overlay fully downloads homepage media up front and the queue
warms the rest, trading a longer initial wait ("Worth the wait.") for a scrub
that never freezes.
</content>
