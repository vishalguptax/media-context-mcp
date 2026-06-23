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

**1. Add it to your MCP client.** The launch command is always `npx -y media-context-mcp`.

<details open>
<summary><b>Claude Code</b></summary>

```bash
claude mcp add media-context -- npx -y media-context-mcp
```
</details>

<details>
<summary><b>Claude Desktop</b></summary>

Settings → Developer → Edit Config (`claude_desktop_config.json`). The `env` block is optional — only needed if Whisper/Tesseract aren't on your `PATH`:

```json
{
  "mcpServers": {
    "media-context": {
      "command": "npx",
      "args": ["-y", "media-context-mcp"],
      "env": { "WHISPER_BIN": "/path/to/whisper", "TESSERACT_BIN": "/path/to/tesseract" }
    }
  }
}
```
</details>

<details>
<summary><b>Cursor</b> · <b>Windsurf</b> · <b>Cline</b> · other clients</summary>

Add to the client's MCP config (`~/.cursor/mcp.json`, `~/.codeium/windsurf/mcp_config.json`, Cline settings, …):

```json
{
  "mcpServers": {
    "media-context": { "command": "npx", "args": ["-y", "media-context-mcp"] }
  }
}
```
</details>

<details>
<summary><b>VS Code (GitHub Copilot, agent mode)</b></summary>

Create `.vscode/mcp.json` — VS Code uses the `servers` key:

```json
{
  "servers": {
    "media-context": { "command": "npx", "args": ["-y", "media-context-mcp"] }
  }
}
```
</details>

<details>
<summary><b>Codex CLI</b></summary>

`~/.codex/config.toml`:

```toml
[mcp_servers.media-context]
command = "npx"
args = ["-y", "media-context-mcp"]
```
</details>

**2. Install the media tools** (one command, uses your OS package manager):

```bash
npx media-context-mcp setup            # ffmpeg, yt-dlp, tesseract
npx media-context-mcp setup --whisper  # add audio transcription
```

Only `ffmpeg` is required; the rest are optional and unlock one feature each. `check_media_deps` shows what's detected. To install by hand: `ffmpeg`/`ffprobe`, `yt-dlp` (URLs), `tesseract` (OCR), `whisper` (transcripts) — via `winget` / `brew` / `apt` / `pip`.

## Examples

Just ask your assistant in plain language — it picks the right options for you.

- “Summarize `demo.mp4`.” — a quick overview from sampled frames.
- “What error does the app show at the end of `bug.mp4`?” — reads the on-screen text.
- “Transcribe `standup.m4a` and list the action items.” — speech to text.
- “Summarize `https://youtu.be/VIDEO_ID` and include the transcript.” — fetches and transcribes.
- “In `slider.mp4`, find the frame where the slider flickers around 0:06.” — scans a dense burst of frames to catch a sub-second glitch.

Want finer control — modes, cropping, OCR language, sampling rate? It's all in the **[usage guide](./docs/usage.md)**.

## Tools

The server exposes two tools, which your assistant calls automatically:

| Tool | What it does |
|------|--------------|
| **`analyze_media`** | Turn a video, audio, or image (file or URL) into model-readable context. Auto-detects the type — video → montage frames / stills / scene montages / dense filmstrip; audio → Whisper transcript; image → the picture plus optional OCR. Supports cropping, time windows, OCR language, and sampling rate. |
| **`check_media_deps`** | Report which of `ffmpeg`, `yt-dlp`, `whisper`, and `tesseract` are installed, with install hints. |

Everything runs locally, and each call cleans up its temporary files when it returns.

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
