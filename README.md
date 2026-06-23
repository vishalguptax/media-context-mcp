# media-context-mcp

A **100% local, zero-API** [MCP](https://modelcontextprotocol.io) server that turns a **video, audio, or image** file/URL into compact, low-token context an AI agent can actually read. No cloud upload, no keys, no per-call cost — everything runs on your machine via `ffmpeg`, `yt-dlp`, Whisper and Tesseract.

Models cannot watch video. This server samples it with `ffmpeg`, tiles the frames into a few downscaled montage images, and returns them as image blocks plus a short summary — a 5-minute clip becomes 1–2 images instead of hundreds of stills. Audio comes back as a transcript; images come back with optional OCR.

Built for developers analyzing **app/screen recordings**: use `detail:"high"` + `ocr:true` to read exact UI text, errors and code instead of squinting at thumbnails.

## Features

- **Any media, file or URL** — video, audio, or image. Local path, or any `yt-dlp`-supported URL (YouTube, Vimeo, X, direct files, 1000+ sites).
- **Video modes** — `sheet` (montage grids, cheapest, default), `frames` (individual stills), `scenes` (only scene changes).
- **Audio** — local Whisper speech transcript.
- **Image** — the picture plus optional OCR of on-screen text.
- **OCR** — Tesseract reads UI text/menus/code off full-resolution frames; ideal for screen recordings.
- **Token control** — montage tiling + bounded frame count, grid, resolution, and `webp`/`jpeg`/`png` output.
- **Private & safe** — nothing leaves your machine; no shell, binaries spawned directly with timeouts and output caps; temp files cleaned every call.

## Requirements

| Binary    | Needed for                | Install |
|-----------|---------------------------|---------|
| `ffmpeg` + `ffprobe` | all visual analysis | `winget install Gyan.FFmpeg` · `brew install ffmpeg` · `apt install ffmpeg` |
| `yt-dlp`  | URL sources               | `pip install -U yt-dlp` · `winget install yt-dlp.yt-dlp` · `brew install yt-dlp` |
| `whisper` | transcripts (optional)    | `pip install -U openai-whisper` |
| `tesseract` | OCR / on-screen text (optional) | `winget install UB-Mannheim.TesseractOCR` · `brew install tesseract` · `apt install tesseract-ocr` |

Call the `check_media_deps` tool to see what is detected.

## Install

```bash
npm install -g media-context-mcp
# or run on demand with npx (no install)
npx -y media-context-mcp
```

### Claude Code (MCP)

```bash
claude mcp add media-context -- npx -y media-context-mcp
```

### Claude Code (plugin marketplace)

```
/plugin marketplace add <your-org>/media-context-mcp
/plugin install media-context
```

### Generic MCP client config

```json
{
  "mcpServers": {
    "media-context": {
      "command": "npx",
      "args": ["-y", "media-context-mcp"]
    }
  }
}
```

## Tools

### `analyze_media`

Auto-detects the media type. **Video** → frames/montage (+ optional transcript/OCR); **audio** → transcript; **image** → the picture (+ optional OCR). Returns a text summary, image blocks, and transcript/OCR text blocks as applicable.

| Param | Default | Description |
|-------|---------|-------------|
| `source` | — | Local file path (video/audio/image) or http(s) URL. |
| `context` | — | Optional note framing the analysis, e.g. "signup flow, focus on the validation error". Echoed atop the summary. |
| `detail` | — | `high` = readable stills for screen recordings (frames + scale 900 + png); `low` = cheap montage. Fills only fields you leave unset. |
| `mode` | `sheet` | `sheet` \| `frames` \| `scenes`. |
| `format` | `webp` | `webp` (smallest) \| `jpeg` \| `png` (crisp text). |
| `maxFrames` | `30` | Upper bound on sampled frames over the window. |
| `grid` | `5` | Tiles per row/column for montage modes. |
| `scale` | `320` | Per-frame width in px before tiling. Lower = fewer tokens. |
| `sceneThreshold` | `0.4` | Scene-change sensitivity (`scenes` mode). |
| `startSec` / `endSec` | — | Restrict to a time window. |
| `transcript` | `false` | Also run Whisper. |
| `whisperModel` | `small` | `tiny` \| `base` \| `small` \| `medium` \| `large`. |
| `ocr` | `false` | Extract on-screen text via Tesseract — ideal for app recordings. Implies `detail:high`. |
| `ocrLang` | `eng` | Tesseract language code(s), e.g. `eng+deu`. |
| `ocrPsm` | `3` | Page-segmentation mode. `3` auto, `6` uniform block, `11` sparse/scattered UI labels. |
| `ocrMaxFrames` | `12` | Frames to OCR, sampled at full resolution independently of the display images. |
| `maxDurationSec` | `3600` | Reject URL downloads longer than this. |
| `maxFileSizeMb` | `500` | Abort a URL download past this size. |

Returns a text summary, up to 12 image blocks, and transcript / OCR text blocks when requested.

### Analyzing app / screen recordings

Screen recordings are text-heavy and detail-critical, so the token-cheap montage default is the wrong tool. Use:

```jsonc
{ "source": "demo.mp4", "detail": "high", "ocr": true,
  "context": "checkout flow, focus on the error dialog" }
```

`detail:high` gives readable full-size stills; `ocr:true` pulls exact on-screen
text (menus, errors, code) as cheap, accurate text instead of making the model
squint at pixels.

OCR runs on its **own full-resolution frames** (sampled separately from the
display images, then upscaled-if-small and sharpened), so you can keep `scale`
low for cheap images and still get accurate text. Tune `ocrPsm` if a layout
reads poorly — `6` for a solid block of text, `11` for scattered labels.

### `check_media_deps`

Reports availability of `ffmpeg`, `ffprobe`, `yt-dlp`, `whisper`, `tesseract` with install hints.

## Use as a library

The analyzer is exported independently of the MCP transport, so any Node program
can call it directly:

```ts
import { analyzeMedia } from "media-context-mcp";

const result = await analyzeMedia({ source: "https://youtu.be/…", mode: "sheet" });
console.log(result.summary);
for (const img of result.images) {
  // img.base64 is a PNG montage, ready to send to any vision model
}
```

`import { createServer } from "media-context-mcp/server"` returns the MCP server
if you want to host it on a custom transport.

## Project layout

```
src/
  index.ts        bin entry — MCP stdio server
  server.ts       MCP wiring + tool schemas
  core.ts         analyzeMedia() orchestration (transport-agnostic)
  lib.ts          public library barrel
  types.ts        shared contracts
  schema.ts       input validation (shared by MCP + library)
  pipeline/       domain: media (classify) · source · ffmpeg · transcript · ocr
  system/         infra: exec · deps · bins · workspace
```

## Token tips

- Stay in `sheet` mode and keep `scale` low (256–320) for gist.
- Drop into `frames` or a narrow `startSec`/`endSec` window only when you need detail on a moment.
- `scenes` is cheapest for slide decks or static screencasts.

## Development

```bash
npm install
npm run build
node dist/index.js   # stdio server
```

## License

MIT
