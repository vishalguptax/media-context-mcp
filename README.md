<p align="center">
  <img src="./assets/banner.svg" alt="media-context-mcp — local MCP server to analyze video, audio and images for AI assistants" width="100%">
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/media-context-mcp"><img src="https://img.shields.io/npm/v/media-context-mcp.svg" alt="npm"></a>
  <a href="https://github.com/vishalguptax/media-context-mcp/actions/workflows/ci.yml"><img src="https://github.com/vishalguptax/media-context-mcp/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
  <a href="./LICENSE"><img src="https://img.shields.io/badge/license-Apache--2.0-blue.svg" alt="license"></a>
</p>

<p align="center">
  Give your AI assistant eyes and ears — analyze any <b>video, audio, or image</b>, entirely on your machine.
</p>

<p align="center">
  <a href="#-install"><b>Install</b></a> ·
  <a href="#-examples">Examples</a> ·
  <a href="#-tools">Tools</a> ·
  <a href="./docs/usage.md">Usage guide</a> ·
  <a href="https://www.npmjs.com/package/media-context-mcp">npm</a> ·
  <a href="https://lobehub.com/mcp/vishalguptax-media-context-mcp">LobeHub</a>
</p>

---

Your assistant can read text and look at a picture, but it can't watch a video or listen to audio. **media-context-mcp** fills that gap: point it at a file or a URL and it hands back clean, model-ready context — sampled frames, a transcript, or the text on screen — without sending anything to the cloud.

## 🚀 Install

Two steps — add the server, then install the tools it drives.

### 1 · Add the server to your client

```bash
# Claude Code
claude mcp add media-context -- npx -y media-context-mcp
```

<details>
<summary><b>Other clients</b> — Claude Desktop · Cursor · VS Code · Windsurf · Cline · Codex</summary>

The launch command is always `npx -y media-context-mcp`.

**Claude Desktop** — Settings → Developer → Edit Config (`claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "media-context": { "command": "npx", "args": ["-y", "media-context-mcp"] }
  }
}
```

**Cursor / Windsurf / Cline** — add to the client's MCP config (`~/.cursor/mcp.json`, `~/.codeium/windsurf/mcp_config.json`, Cline settings):

```json
{
  "mcpServers": {
    "media-context": { "command": "npx", "args": ["-y", "media-context-mcp"] }
  }
}
```

**VS Code (Copilot, agent mode)** — `.vscode/mcp.json` (uses the `servers` key):

```json
{
  "servers": {
    "media-context": { "command": "npx", "args": ["-y", "media-context-mcp"] }
  }
}
```

**Codex CLI** — `~/.codex/config.toml`:

```toml
[mcp_servers.media-context]
command = "npx"
args = ["-y", "media-context-mcp"]
```
</details>

<sub>**Claude Code plugin** (one command): `/plugin marketplace add vishalguptax/media-context-mcp` then `/plugin install media-context`. &nbsp;•&nbsp; **Per-project**: add `--scope project` (writes `.mcp.json`) or commit a `.cursor/mcp.json` / `.vscode/mcp.json` so your team shares it.</sub>

### 2 · Install the media tools

One command installs everything the server uses, via your OS package manager:

```bash
npx media-context-mcp setup          # ffmpeg + URL download + on-screen text (OCR)
npx media-context-mcp setup --audio  # also enable transcription
```

The server **finds the tools automatically afterward** — even in the off-`PATH` places installers use (Tesseract in Program Files, Whisper in a Python Scripts folder) — so OCR and transcripts just work, no env vars to set. Run `check_media_deps` to see what's ready; `setup --uninstall` removes the tools again.

<details>
<summary>Install by hand, or point at a custom path</summary>

The package ships no binaries — only `ffmpeg` is required; the rest are optional, one feature each.

| Tool | For | Install |
|------|-----|---------|
| `ffmpeg` + `ffprobe` | **required** | `winget install Gyan.FFmpeg` · `brew install ffmpeg` · `apt install ffmpeg` |
| `yt-dlp` | URLs | `winget install yt-dlp.yt-dlp` · `brew install yt-dlp` · `pip install -U yt-dlp` |
| `tesseract` | on-screen text | `winget install UB-Mannheim.TesseractOCR` · `brew install tesseract` · `apt install tesseract-ocr` |
| `whisper` | transcription | `pip install -U openai-whisper` |

Point at an unusual location with `FFMPEG_BIN` / `YTDLP_BIN` / `WHISPER_BIN` / `TESSERACT_BIN` (env vars, e.g. in your client config's `env` block).
</details>

### 3 · Ask

> *“Summarize `demo.mp4`.”*

## ✨ Features

| | |
|---|---|
| 🎬 **Video** | Montage overview, full-res stills, scene-change shots, or a dense filmstrip that catches sub-second glitches |
| 🗣️ **Audio** | Speech → text — clips, voice notes, meetings, podcasts |
| 🖼️ **Image** | The picture plus optional on-screen text (OCR) |
| 🌐 **Files & URLs** | Local paths or links — YouTube, Vimeo, direct files, 1000+ sites |
| 🪙 **Token-cheap** | Frames are tiled and downscaled — a long clip costs a couple of images, not hundreds |
| 🔒 **100% local** | Runs on your machine. No API keys, no uploads |

## 💬 Examples

Just ask in plain language — the assistant picks the right options.

| You ask | What happens |
|---------|--------------|
| *“Summarize `demo.mp4`.”* | A quick overview from sampled frames |
| *“What error does `bug.mp4` show at the end?”* | Reads the exact on-screen text |
| *“Transcribe `standup.m4a` and list action items.”* | Local speech-to-text |
| *“Summarize `https://youtu.be/VIDEO_ID` with the transcript.”* | Fetches and transcribes |
| *“In `slider.mp4`, find where the slider flickers ~0:06.”* | Catches a sub-second glitch |

Finer control — modes, cropping, language, sampling rate — is in the **[usage guide](./docs/usage.md)**.

## 🧰 Tools

| Tool | What it does |
|------|--------------|
| **`analyze_media`** | Turn a video, audio, or image (file or URL) into model-readable context. Auto-detects the type: video → frames / stills / scenes / filmstrip; audio → transcript; image → picture + optional text recognition. Supports cropping, time windows, language, and sampling rate. |
| **`check_media_deps`** | Report which optional capabilities (URL fetching, transcription, text recognition) are ready, with setup hints. |

Everything runs locally, and each call cleans up its temporary files when it returns.

## ❓ FAQ

**Can Claude (or any LLM) watch a video?** Not directly — models take images and text, not video. This server extracts frames and transcripts so your assistant can analyze it.

**How do I give Claude Code, Cursor, or VS Code video context?** Add the server (see [Install](#-install)), then ask in plain language — it works in any MCP client.

**Can it convert video or audio to text?** Yes — it samples frames for the model to read and transcribes speech locally.

**Does it work offline, without an API key?** Yes. Everything runs on your machine; nothing is uploaded and no keys are required.

**Does it support YouTube and other links?** Yes — any `yt-dlp`-supported URL.

**Is it free?** Yes, open source under Apache-2.0.

## 🛠️ Development

```bash
npm install
npm run build
npm test
```

Tests cover the pipeline end-to-end; the integration ones skip themselves when the optional tools aren't installed. Issues and PRs welcome.

## 📄 License

[Apache-2.0](./LICENSE) © Vishal Gupta — free and open, use it however you like.
