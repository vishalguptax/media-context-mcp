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
  <a href="#-install">Install</a> ·
  <a href="#-examples">Examples</a> ·
  <a href="#-tools">Tools</a> ·
  <a href="./docs/usage.md">Usage guide</a> ·
  <a href="https://www.npmjs.com/package/media-context-mcp">npm</a> ·
  <a href="https://lobehub.com/mcp/vishalguptax-media-context-mcp">LobeHub</a>
</p>

---

Your assistant can read text and look at a picture, but it can't watch a video or listen to audio. **media-context-mcp** fills that gap: point it at a file or a URL and it hands back clean, model-ready context — sampled frames, a transcript, or the text on screen — without sending anything to the cloud.

```bash
# 1. add it to your client (Claude Code shown — see Install for others)
claude mcp add media-context -- npx -y media-context-mcp
# 2. install the media tools it uses
npx media-context-mcp setup
```

Then just ask: *“Summarize `demo.mp4`.”*

## ✨ Features

- **Any source** — video, audio, or images; a local file or a URL (YouTube, Vimeo, and 1000+ more).
- **See video** — a quick montage overview, full-resolution stills, scene-change shots, or a dense filmstrip that catches glitches lasting a fraction of a second.
- **Hear audio** — turn speech in a clip, voice note, or podcast into text.
- **Read screens** — pull the exact text off a UI, an error dialog, or a screenshot.
- **Cheap by design** — frames are tiled and downscaled, so a long clip costs a couple of images, not hundreds.
- **Private & local** — runs on your machine. No API keys, no uploads.
- **Works everywhere** — any MCP client: Claude, Cursor, VS Code, and more.

## 🚀 Install

### 1. Add the server to your client

The launch command is always `npx -y media-context-mcp`.

<details open>
<summary><b>Claude Code</b></summary>

```bash
claude mcp add media-context -- npx -y media-context-mcp
```

Or install it as a plugin (one command, bundles the server):

```
/plugin marketplace add vishalguptax/media-context-mcp
/plugin install media-context
```
</details>

<details>
<summary><b>Claude Desktop</b></summary>

Settings → Developer → Edit Config (`claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "media-context": { "command": "npx", "args": ["-y", "media-context-mcp"] }
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

> **Global vs per-project** — install once for all projects, or commit a project-scoped config so your team shares it: `claude mcp add … --scope project` (writes `.mcp.json`), or a `.cursor/mcp.json` / `.vscode/mcp.json` in the repo.

### 2. Install the media tools

One command installs what the server uses, via your OS package manager:

```bash
npx media-context-mcp setup          # ffmpeg, URL download, on-screen text
npx media-context-mcp setup --audio  # also enable transcription
```

The server then **finds the tools automatically** — including common off-`PATH` spots (Tesseract in Program Files, Whisper in a Python Scripts folder), so transcripts and OCR work without extra config. `check_media_deps` shows what's ready; `setup --uninstall` removes the tools again.

<details>
<summary>Install by hand / point at a custom path</summary>

The package ships no binaries. Only `ffmpeg` is required; the rest are optional, one feature each.

| Tool | For | Install |
|------|-----|---------|
| `ffmpeg` + `ffprobe` | **required** | `winget install Gyan.FFmpeg` · `brew install ffmpeg` · `apt install ffmpeg` |
| `yt-dlp` | URLs | `winget install yt-dlp.yt-dlp` · `brew install yt-dlp` · `pip install -U yt-dlp` |
| `tesseract` | on-screen text | `winget install UB-Mannheim.TesseractOCR` · `brew install tesseract` · `apt install tesseract-ocr` |
| `whisper` | transcription | `pip install -U openai-whisper` |

If a tool lives somewhere unusual, point at it with `FFMPEG_BIN` / `YTDLP_BIN` / `WHISPER_BIN` / `TESSERACT_BIN` (env vars, e.g. in your client's config `env` block).
</details>

## 💬 Examples

Just ask your assistant in plain language — it picks the right options for you.

- *“Summarize `demo.mp4`.”* — a quick overview from sampled frames.
- *“What error does the app show at the end of `bug.mp4`?”* — reads the on-screen text.
- *“Transcribe `standup.m4a` and list the action items.”* — speech to text.
- *“Summarize `https://youtu.be/VIDEO_ID` and include the transcript.”* — fetches and transcribes.
- *“In `slider.mp4`, find the frame where the slider flickers around 0:06.”* — catches a sub-second glitch.

Finer control — modes, cropping, language, sampling rate — is in the **[usage guide](./docs/usage.md)**.

## 🧰 Tools

The server exposes two tools, which your assistant calls automatically.

| Tool | What it does |
|------|--------------|
| **`analyze_media`** | Turn a video, audio, or image — file or URL — into model-readable context. Auto-detects the type: video → frames, stills, scene montages, or a dense filmstrip; audio → a transcript; image → the picture plus optional text recognition. Supports cropping, time windows, language, and sampling rate. |
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
