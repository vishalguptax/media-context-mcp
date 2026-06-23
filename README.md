# video-context-mcp

An [MCP](https://modelcontextprotocol.io) server that turns a **video file or URL** into compact, low-token visual context an AI agent can actually read — contact-sheet montages, individual frames, scene-change detection, and an optional speech transcript.

Models cannot watch video. This server samples the video with `ffmpeg`, tiles the frames into a few downscaled montage images, and returns them as image content blocks plus a short text summary. A 5-minute clip becomes 1–2 images instead of hundreds of stills.

## Features

- **File or URL** — local path, or any `yt-dlp`-supported URL (YouTube, Vimeo, X, direct mp4, 1000+ sites).
- **Three modes** — `sheet` (montage grids, cheapest, default), `frames` (individual stills), `scenes` (only scene changes).
- **Token control** — bound frame count, grid size and per-frame resolution. Downscaling is the main token lever.
- **Optional transcript** — local OpenAI Whisper, off by default.
- **Safe execution** — no shell; binaries spawned directly with timeouts and output caps. Temp files cleaned up every call.

## Requirements

| Binary    | Needed for                | Install |
|-----------|---------------------------|---------|
| `ffmpeg` + `ffprobe` | all visual analysis | `winget install Gyan.FFmpeg` · `brew install ffmpeg` · `apt install ffmpeg` |
| `yt-dlp`  | URL sources               | `pip install -U yt-dlp` · `winget install yt-dlp.yt-dlp` · `brew install yt-dlp` |
| `whisper` | transcripts (optional)    | `pip install -U openai-whisper` |
| `tesseract` | OCR / on-screen text (optional) | `winget install UB-Mannheim.TesseractOCR` · `brew install tesseract` · `apt install tesseract-ocr` |

Call the `check_video_deps` tool to see what is detected.

## Install

```bash
npm install -g video-context-mcp
# or run on demand with npx (no install)
npx -y video-context-mcp
```

### Claude Code (MCP)

```bash
claude mcp add video-context -- npx -y video-context-mcp
```

### Claude Code (plugin marketplace)

```
/plugin marketplace add <your-org>/video-context-mcp
/plugin install video-context
```

### Generic MCP client config

```json
{
  "mcpServers": {
    "video-context": {
      "command": "npx",
      "args": ["-y", "video-context-mcp"]
    }
  }
}
```

## Tools

### `analyze_video`

| Param | Default | Description |
|-------|---------|-------------|
| `source` | — | Local file path or http(s) URL. |
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

### `check_video_deps`

Reports availability of `ffmpeg`, `ffprobe`, `yt-dlp`, `whisper`, `tesseract` with install hints.

## Use as a library

The analyzer is exported independently of the MCP transport, so any Node program
can call it directly:

```ts
import { analyzeVideo } from "video-context-mcp";

const result = await analyzeVideo({ source: "https://youtu.be/…", mode: "sheet" });
console.log(result.summary);
for (const img of result.images) {
  // img.base64 is a PNG montage, ready to send to any vision model
}
```

`import { createServer } from "video-context-mcp/server"` returns the MCP server
if you want to host it on a custom transport.

## Project layout

```
src/
  index.ts        bin entry — MCP stdio server
  server.ts       MCP wiring + tool schemas
  core.ts         analyzeVideo() orchestration (transport-agnostic)
  lib.ts          public library barrel
  types.ts        shared contracts
  schema.ts       input validation (shared by MCP + library)
  pipeline/       domain: source · ffmpeg · transcript · ocr
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
