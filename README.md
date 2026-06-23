<p align="center">
  <img src="./assets/banner.svg" alt="media-context-mcp" width="100%">
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/media-context-mcp"><img src="https://img.shields.io/npm/v/media-context-mcp.svg" alt="npm"></a>
  <a href="https://github.com/vishalguptax/media-context-mcp/actions/workflows/ci.yml"><img src="https://github.com/vishalguptax/media-context-mcp/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
  <a href="./LICENSE"><img src="https://img.shields.io/badge/license-Apache--2.0-blue.svg" alt="license"></a>
</p>

Your AI assistant can't watch a video or listen to audio. **media-context-mcp** turns any video, audio, or image — a file or a URL — into compact, model-readable context: frames, transcripts, and on-screen text. Everything runs locally. No API keys, no uploads.

## Install

**1. Add it to your MCP client.** The launch command is always `npx -y media-context-mcp`:

```json
{
  "mcpServers": {
    "media-context": { "command": "npx", "args": ["-y", "media-context-mcp"] }
  }
}
```

Claude Code, Cursor, VS Code, Claude Desktop, Codex, Windsurf, Cline — exact config per client in the **[installation guide](./docs/installation.md)**.

**2. Install the media tools** (one command, uses your OS package manager):

```bash
npx media-context-mcp setup            # ffmpeg, yt-dlp, tesseract
npx media-context-mcp setup --whisper  # add audio transcription
```

That's it. (`check_media_deps` shows what's detected; manual install commands are in the [guide](./docs/installation.md#dependencies).)

## Examples

You just talk to your agent — it reads the tool description and picks the options. Each example shows the **prompt you type** and the call it produces.

**Summarize a recording**

> “What happens in `demo.mp4`?”

```json
{ "source": "demo.mp4" }
```

The default samples the whole clip into one or two montage images — the cheapest overview.

**Read the exact error in a screen recording**

> “The app throws an error in `bug.mp4` around the end — what does it say?”

```json
{ "source": "bug.mp4", "detail": "high", "ocr": true }
```

`detail: high` switches to full-size stills; `ocr` returns the text verbatim, so the model quotes the real error string instead of guessing from blurry pixels.

**Transcribe a voice note or podcast**

> “Transcribe `standup.m4a` and list the action items.”

```json
{ "source": "standup.m4a" }
```

Audio is detected automatically — you get the transcript, no images.

**Analyze a YouTube link**

> “Summarize `https://youtu.be/VIDEO_ID` and give me the transcript.”

```json
{ "source": "https://youtu.be/VIDEO_ID", "transcript": true }
```

**Find a sub-second UI glitch**

> “There's a slider in `slider.mp4` that flickers to the wrong value for a split second around 0:06 — find the frame.”

```json
{ "source": "slider.mp4", "mode": "filmstrip",
  "startSec": 5.6, "endSec": 7.4, "fps": 12,
  "crop": { "x": 0, "y": 1730, "width": 1080, "height": 360 } }
```

`filmstrip` stacks a dense burst of cropped frames into one strip — so a 100 ms flicker shows up as a frame that disagrees with its neighbours.

More recipes, prompts, and the full option reference are in the **[usage guide](./docs/usage.md)**.

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
