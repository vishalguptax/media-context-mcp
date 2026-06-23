<p align="center">
  <img src="./assets/banner.svg" alt="media-context-mcp" width="100%">
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/media-context-mcp"><img src="https://img.shields.io/npm/v/media-context-mcp.svg" alt="npm"></a>
  <a href="https://github.com/vishalguptax/media-context-mcp/actions/workflows/ci.yml"><img src="https://github.com/vishalguptax/media-context-mcp/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
  <a href="./LICENSE"><img src="https://img.shields.io/badge/license-Apache--2.0-blue.svg" alt="license"></a>
</p>

Your coding agent can't watch a screen recording, sit through a voice note, or reliably read the tiny text in a busy screenshot. **media-context-mcp** does that part for it — it pulls frames, transcribes speech, and OCRs on-screen text, then hands back compact, low-token context.

Everything runs locally with `ffmpeg`, `yt-dlp`, Whisper, and Tesseract. No API keys, no uploads.

## Install

**1. Add the server to your client** (Claude Code shown; every other client uses the same `npx -y media-context-mcp` command — see the **[installation guide](./docs/installation.md)**):

```bash
claude mcp add media-context -- npx -y media-context-mcp
```

**2. Install the media tools it drives.** One command, via your OS package manager (winget / brew / apt):

```bash
npx media-context-mcp setup            # ffmpeg + yt-dlp + tesseract
npx media-context-mcp setup --whisper  # also audio transcription (large — pulls PyTorch)
```

The npm package itself is tiny — `setup` pulls in the binaries so nothing is bundled. Prefer to install by hand? Only `ffmpeg` is strictly required:

| Tool | Unlocks | |
|------|---------|--|
| `ffmpeg` + `ffprobe` | frames, scenes — everything | **required** |
| `yt-dlp` | URL sources (YouTube, Vimeo, …) | optional |
| `tesseract` | OCR of on-screen text | optional |
| `whisper` | audio transcripts | optional |

Ask for a feature whose tool is missing and the server tells you the exact command. Run the `check_media_deps` tool to see what's detected — full commands in the [installation guide](./docs/installation.md#dependencies).

## Examples

You talk to your agent in plain language; it picks the options. Here's what runs underneath — and why.

**Summarize a recording.** The default samples the whole clip into one or two montage images — cheapest possible overview.

```json
{ "source": "demo.mp4" }
```

**Read the exact error in a screen recording.** `detail: high` switches to full-size stills; `ocr` returns the text verbatim, so the model quotes the real error string instead of guessing from blurry pixels.

```json
{ "source": "bug.mp4", "detail": "high", "ocr": true }
```

**Transcribe a voice note or podcast.** Audio is detected automatically — you get the transcript, no images.

```json
{ "source": "standup.m4a" }
```

**Find a sub-second UI glitch.** `filmstrip` stacks a dense burst of frames, cropped to the control, into one strip — so a 100 ms flicker shows up as a frame that disagrees with its neighbours.

```json
{ "source": "slider.mp4", "mode": "filmstrip",
  "startSec": 5.6, "endSec": 7.4, "fps": 12,
  "crop": { "x": 0, "y": 1730, "width": 1080, "height": 360 } }
```

More recipes and the full option reference are in the **[usage guide](./docs/usage.md)**.

## Use it as a library

The engine works without the MCP layer:

```ts
import { analyzeMedia } from "media-context-mcp";

const { summary, images, ocrText } = await analyzeMedia({
  source: "demo.mp4",
  ocr: true,
});
```

`images` are base64 PNG/WebP you can send to any vision model; `ocrText` is the recovered on-screen text. A runnable script lives in [`examples/try.mjs`](./examples/try.mjs):

```bash
node examples/try.mjs demo.mp4 --ocr --detail
```

## How it works

Models read images and text, not raw media. So the server samples the source with `ffmpeg`, tiles the frames into a few downscaled montages, and returns them as image blocks plus a short summary — a 5-minute clip becomes 1–2 images instead of hundreds of stills. Audio goes through Whisper; on-screen text is read by Tesseract off full-resolution frames; URLs are fetched with `yt-dlp`. Each call works in a temp directory that's deleted when it returns.

```
src/
  index.ts     bin entry — MCP stdio server
  server.ts    MCP wiring + tool schemas
  core.ts      analyzeMedia() — the orchestration
  lib.ts       public library exports
  pipeline/    media · source · ffmpeg · transcript · ocr
  system/      exec · deps · bins · workspace
```

## Development

```bash
npm install
npm run build
npm test
```

Tests cover the pipeline end-to-end; the ffmpeg/tesseract integration ones skip themselves if the binaries aren't installed. Issues and PRs welcome.

## Open-core

The engine in this repo is free and open — no caps on duration, resolution, or features. Anything paid in the future (a hosted/team service, batch CI analysis, automated glitch detection) would be a separate product on top; it won't paywall what's here.

## License

[Apache-2.0](./LICENSE) © Vishal Gupta
