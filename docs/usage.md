# Usage

You normally just describe what you want and the agent calls `analyze_media` for you. The JSON blocks below show the options it picks, so you can steer it ("use filmstrip mode", "crop to the toolbar") when you need to.

## Recipes

### Summarize a video

```json
{ "source": "demo.mp4" }
```

The default `sheet` mode samples the whole clip and tiles the frames into one or two montage images — the cheapest way to get the gist. Good for "what is this video about?".

### Read on-screen text from a screen recording

```json
{ "source": "bug.mp4", "detail": "high", "ocr": true,
  "context": "checkout flow, focus on the error dialog" }
```

`detail: "high"` switches from cheap montages to full-size stills; `ocr: true` runs Tesseract over full-resolution frames and returns the text verbatim. The model quotes the real error string instead of guessing from blurry pixels. `context` is echoed at the top of the result to frame the analysis.

### Transcribe audio

```json
{ "source": "standup.m4a", "whisperModel": "small" }
```

Audio files (and audio-only URLs) are detected automatically; you get the transcript, no images. Bump `whisperModel` to `medium`/`large` for accuracy, drop to `tiny`/`base` for speed.

### Analyze a YouTube (or any) URL

```json
{ "source": "https://youtu.be/VIDEO_ID", "transcript": true }
```

`yt-dlp` downloads the video, frames are sampled as usual, and `transcript: true` adds the spoken text.

### Pull text out of a screenshot

```json
{ "source": "stacktrace.png", "ocr": true }
```

Returns the (downscaled) image plus a clean text copy. Vision models can already read screenshots, so reach for this when the text is small/dense and you want it exact.

### Catch a sub-second UI glitch

```json
{ "source": "slider.mp4", "mode": "filmstrip",
  "startSec": 5.6, "endSec": 7.4, "fps": 12,
  "crop": { "x": 0, "y": 1730, "width": 1080, "height": 360 } }
```

`filmstrip` samples a dense burst of frames from a narrow window, crops them to the affected control, and stacks them into one vertical strip. A flicker that lasts ~100 ms — invisible to ordinary sampling — shows up as a frame whose value disagrees with its neighbours. Widen `fps` or the window if you miss it.

## Modes

| Mode | What it does | Reach for it when |
|------|--------------|-------------------|
| `sheet` (default) | Tiles sampled frames into montage grids | A cheap overview of any video |
| `frames` | Individual full stills | You need detail on specific moments |
| `scenes` | Montages of scene-change frames only | Slide decks, static screencasts |
| `filmstrip` | Dense near-native-fps vertical strip | Hunting a transient UI glitch |

## Tuning OCR

OCR reads its own full-resolution frames (independent of the display images), upscales small text, and sharpens before recognition. If a layout reads poorly, set `ocrPsm`:

- `3` (default) — automatic page segmentation
- `6` — a single uniform block of text
- `11` — sparse, scattered labels (toolbars, badges)

Use `ocrLang` for non-English (`"eng+deu"`, `"jpn"`, …). `ocrMaxFrames` bounds how many frames are OCR'd.

## Full option reference

| Param | Default | Description |
|-------|---------|-------------|
| `source` | — | Local file path (video/audio/image) or http(s) URL. |
| `context` | — | Note framing the analysis; echoed atop the summary. |
| `detail` | — | `high` = readable stills for screen recordings (frames + scale 900 + png); `low` = cheap montage. Fills only fields you leave unset. |
| `mode` | `sheet` | `sheet` · `frames` · `scenes` · `filmstrip`. |
| `format` | `webp` | `webp` (smallest) · `jpeg` · `png` (crisp text). |
| `maxFrames` | `30` | Upper bound on sampled frames over the window. |
| `grid` | `5` | Tiles per row/column for montage modes. |
| `scale` | `320` | Per-frame width in px before tiling. Lower = fewer tokens. |
| `sceneThreshold` | `0.4` | Scene-change sensitivity (`scenes` mode). |
| `fps` | auto | Explicit sampling rate; pair high (10–15) with `filmstrip`. |
| `crop` | — | `{x,y,width,height}` pixel rect — zoom into a UI region. |
| `stripRows` | `18` | Tiles stacked per image in `filmstrip` mode. |
| `startSec` / `endSec` | — | Restrict to a time window. |
| `transcript` | `false` | Also run Whisper (video). |
| `whisperModel` | `small` | `tiny` · `base` · `small` · `medium` · `large`. |
| `ocr` | `false` | Extract on-screen text via Tesseract. Implies `detail:high`. |
| `ocrLang` | `eng` | Tesseract language code(s), e.g. `eng+deu`. |
| `ocrPsm` | `3` | Page segmentation: `3` auto · `6` block · `11` sparse. |
| `ocrMaxFrames` | `12` | Frames to OCR (full-res, independent of display images). |
| `maxDurationSec` | `3600` | Reject URL downloads longer than this. |
| `maxFileSizeMb` | `500` | Abort a URL download past this size. |

## Library API

```ts
import { analyzeMedia } from "media-context-mcp";

const result = await analyzeMedia({ source: "demo.mp4", ocr: true });
// result.summary    — text summary
// result.images     — [{ mimeType, base64 }] ready for any vision model
// result.transcript — { text, model } when transcript/audio
// result.ocrText    — recovered on-screen text when ocr:true
// result.warnings   — non-fatal notes (skipped transcript, capped images, …)
```

Types are exported from the package root; `createServer()` from `media-context-mcp/server` returns the MCP server for a custom transport.
