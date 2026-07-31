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
- **30fps output** (masters are 60). The scrub picks its frame from scroll
  position, not playback rate — nobody watches these at 1× — so halving the frame
  count is invisible while scrubbing and is the biggest single lever on file
  size. GOP stays at 5 *frames*, so seeks still decode ≤5 frames; keyframes are
  just 167ms apart instead of 83ms, which only shifts `fastSeek`'s landing
  accuracy by a frame or two mid-flick.
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
./scripts/optimize-videos.sh                 # GOP=5, 30fps, maxW=1600, CRF=28
MAXW=1280 HEVC_CRF=30 ./scripts/optimize-videos.sh
FPS=60 HEVC_CRF=26 ./scripts/optimize-videos.sh   # the pre-2026-07 target
```

Output `name.scrub.gop5.fps30.hevc.mp4` → upload to the slice's `video_url` in
Prismic. The script is resumable (skips outputs newer than their source) — the
framerate is in the filename so a target change can't be silently swallowed by
that skip.

> Memory note: this matches the project's recorded standard — Prismic-hosted
> clips, GOP=5 + HEVC, never ship all-intra.

## 2. Preloading

Two cooperating layers fill the HTTP cache so scrubbing has bytes to seek through:

### Launch overlay ([useAssetLoader.js](../composables/useAssetLoader.js))
[AppLoader.vue](../components/AppLoader.vue) holds the viewport (scroll locked)
while the gating media downloads *fully* — not "enough to play at 1×", because
scrubbing seeks ahead and plays faster than real-time, so every byte must be
present. `collectMediaUrls` walks the Prismic document for video/image URLs
(device-aware: picks desktop or mobile clip, never both); `startLoading` streams
each via `fetch` with real byte progress, which warms the cache the real
`<video>`/`<img>` elements then reuse. The four logo bars fill with genuine
progress; there is no time cap. Falls back to element-load when `fetch` is
CORS-blocked.

**What "gating" covers depends on `PERF_MODE`** ([featureFlags.js](../utils/featureFlags.js)):

| | `PERF_MODE = false` (main) | `PERF_MODE = true` |
|---|---|---|
| Overlay waits for | every homepage asset | hero clip + images |
| Downloaded at load | every homepage asset | hero clip + images **only** |
| Rest of the clips | — | fetched as their section nears |
| Cost of a bounce at the hero | ~130 MB desktop / ~58 MB mobile | ~8 MB / ~4 MB |

The second row is the important one and was the CDN-bandwidth bug: `startLoading`
used to kick *every* registered asset and the flag only changed when the overlay
lifted, so the full media set was paid for on every visit regardless. It now
fetches the gating set alone. `isManagedAsset` keys off whether the loader
actually started fetching a URL (not merely registered it), so the deferred clips
aren't mistaken for "already handled" by the lazy path below.

### Background warm-up queue ([utils/scrubVideo.js](../utils/scrubVideo.js))
`prefetchScrubVideo` fetches clips **one at a time** in page order after window
load + idle. It skips any URL the overlay is already pulling (`isManagedAsset`)
to avoid duplicate fetches and cache misses, and respects
`navigator.connection.saveData`.

Under `PERF_MODE` the *blanket* mount-time warm-up is off — it drained the whole
page's clips no matter how far the visitor scrolled, which is precisely the
bandwidth being saved. `ScrubScene` skips it entirely (its `observeNear` src
attach below is then the only thing that pulls the clip); the non-pinned
`VideoScroll` band, whose element is `preload="metadata"` and so relies on the
queue for the body, warms from its own proximity observer instead.

### One download per clip — three conditions, all required
A warmed clip is only free if the `<video>` element can reuse the loader's cache
entry. Three things have to line up, and fixing any one alone still downloads the
clip twice (measured: **16.2 MB over the wire for the 8.1 MB hero**):

| Condition | Why | Where |
|---|---|---|
| `Range: bytes=0-` on the fetch | The element always range-requests (206); a bare fetch gets a 200, and Chrome files those separately | `MEDIA_FETCH_INIT` |
| `crossorigin="anonymous"` on the element | Prismic sends `Vary: Origin`; an element without it sends **no** Origin header, so it can never match | `ScrubScene`, `DrilledStats`, `VideoScroll` |
| The two requests are **sequential** | A cache entry isn't written until its request finishes, so concurrent requests both miss | the launch handshake |

The handshake is `claimLaunch()` / `whenLaunchSettled()`. `AppLoader` claims the
launch *synchronously* (the scrub sections mount during its `await` of the
Prismic document, so a later claim is invisible to them); eager consumers wait
for it instead of racing. This costs no lead time — the overlay locks scrolling
for exactly that window. `whenLaunchSettled()` resolves immediately when nothing
claimed the launch, so a route without the overlay still attaches at once.

Verified end to end: 1 clip over the wire, the element's request a 0-byte disk
cache hit, on desktop unthrottled, desktop 4 Mbps, and iPhone 4 Mbps.

### Proximity attach
`ScrubScene` attaches each lazy clip's `src` ~1.5 screens out (3 screens on
mobile, where slower networks need a longer head start) via `observeNear`, so
deeper sections buffer before they pin. `DrilledStats` does the same at 2 screens
from its own `primeWhenNear`. Under `PERF_MODE` this is the *only* thing that
pulls a non-hero clip, which is what makes the cost proportional to how far the
visitor actually reads.

Verified with a request probe on the built site: a desktop load requests **1**
clip (the hero) and reaches all 7 only after scrolling to the bottom; a phone
viewport requests 2 on load (the 300% margin already covers the second section)
and the rest on scroll.

**The margin widens on slow connections** (`scrubLeadMargin`), because the
default lead only buys single-digit MB against clips of 14–27 MB. It is capped at
700%: an unbounded margin is just the old download-everything behaviour, and
metered data is what a 2G visitor can least afford. An explicit `saveData`
preference keeps the baseline.

Sizing that needs a speed signal, and **the Network Information API is not one**:

- `effectiveType` labels anything above ~0.7 Mbps as `4g`. Verified: Chrome
  throttled to 4 Mbps still reported `4g`, so tiering on it almost never fires.
- `downlink` is unusable at mount. Measured on an unthrottled desktop load:
  `1.45` at `document_start` *and* at `DOMContentLoaded`, settling to `10` only
  by t≈2.2s. A `downlink < 2` test therefore misread a fast connection as slow,
  widened every margin, and pulled a section-2 clip at load that nobody had
  scrolled to.

So the loader measures throughput off the launch downloads themselves
(`observedThroughputMbps`) — real bytes, real CDN, real connection — and the
observers are built when the launch settles rather than at mount, so the
measurement is ready. That costs no runway: scroll is locked until then anyway.
`effectiveType` remains the fallback before the first sample (and the only signal
on Safari/iOS, which expose no connection object).

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
