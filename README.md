<p align="center">
  <img src="./assets/banner.svg" alt="media-context-mcp" width="100%">
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/media-context-mcp"><img src="https://img.shields.io/npm/v/media-context-mcp.svg" alt="npm"></a>
  <a href="https://github.com/vishalguptax/media-context-mcp/actions/workflows/ci.yml"><img src="https://github.com/vishalguptax/media-context-mcp/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
  <a href="./LICENSE"><img src="https://img.shields.io/badge/license-Apache--2.0-blue.svg" alt="license"></a>
</p>

<p align="center">
  Give your AI assistant eyes and ears — analyze any <b>video, audio, or image</b>, entirely on your machine.
</p>

---

Your assistant can read text and look at a picture, but it can't watch a video or listen to audio. **media-context-mcp** fills that gap. Point it at a file or a URL and it hands back clean, model-ready context — sampled frames, a transcript, or the text on screen — without sending anything to the cloud.

## Features

- **Any source** — video, audio, or images; a local file or a URL (YouTube, Vimeo, direct links, and 1000+ more).
- **See video** — a quick montage overview, full-resolution stills, scene-change shots, or a dense filmstrip that catches glitches lasting a fraction of a second.
- **Hear audio** — turn speech in a clip, voice note, or podcast into text.
- **Read screens** — pull the exact text off a UI, an error dialog, or a screenshot.
- **Cheap by design** — frames are tiled and downscaled, so a long clip costs a couple of images instead of hundreds.
- **Private & local** — everything runs on your machine. No API keys, no uploads.
- **Works everywhere** — any MCP client: Claude, Cursor, VS Code, and more.

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

Settings → Developer → Edit Config (`claude_desktop_config.json`). The `env` block is optional — only needed if the transcription / text-recognition tools aren't on your `PATH`:

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

**2. Run setup** — one command installs what the server needs via your OS package manager:

```bash
npx media-context-mcp setup          # everything for files + URLs + text
npx media-context-mcp setup --audio  # also enable transcription
```

`check_media_deps` shows what's ready at any time. Prefer to install by hand?

<details>
<summary>Manual dependencies</summary>

The package ships no binaries — it drives tools on your machine. Only `ffmpeg` is required; the rest are optional, one feature each.

| Tool | For | Install |
|------|-----|---------|
| `ffmpeg` + `ffprobe` | **required** | `winget install Gyan.FFmpeg` · `brew install ffmpeg` · `apt install ffmpeg` |
| `yt-dlp` | URLs | `winget install yt-dlp.yt-dlp` · `brew install yt-dlp` · `pip install -U yt-dlp` |
| `tesseract` | on-screen text | `winget install UB-Mannheim.TesseractOCR` · `brew install tesseract` · `apt install tesseract-ocr` |
| `whisper` | transcription | `pip install -U openai-whisper` |
</details>

## Examples

Just ask your assistant in plain language — it picks the right options for you.

- “Summarize `demo.mp4`.” — a quick overview from sampled frames.
- “What error does the app show at the end of `bug.mp4`?” — reads the on-screen text.
- “Transcribe `standup.m4a` and list the action items.” — speech to text.
- “Summarize `https://youtu.be/VIDEO_ID` and include the transcript.” — fetches and transcribes.
- “In `slider.mp4`, find the frame where the slider flickers around 0:06.” — scans a dense burst of frames to catch a sub-second glitch.

Want finer control — modes, cropping, language, sampling rate? It's all in the **[usage guide](./docs/usage.md)**.

## Tools

The server exposes two tools, which your assistant calls automatically.

| Tool | What it does |
|------|--------------|
| **`analyze_media`** | Turn a video, audio, or image — file or URL — into model-readable context. Auto-detects the type: video → frames, stills, scene montages, or a dense filmstrip; audio → a transcript; image → the picture plus optional text recognition. Supports cropping, time windows, language, and sampling rate. |
| **`check_media_deps`** | Report which optional capabilities (URL fetching, transcription, text recognition) are ready, with setup hints. |

Everything runs locally, and each call cleans up its temporary files when it returns.

## Development

```bash
npm install
npm run build
npm test
```

Tests cover the pipeline end-to-end; the integration ones skip themselves when the optional tools aren't installed. Issues and PRs welcome.

## License

[Apache-2.0](./LICENSE) © Vishal Gupta. Free and open — use it however you like.
