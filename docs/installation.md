# Installation

media-context-mcp is a standard **stdio MCP server**. Every client launches it the same way:

```
npx -y media-context-mcp
```

Then install the media tools it drives (see [Dependencies](#dependencies)):

```bash
npx media-context-mcp setup            # ffmpeg + yt-dlp + tesseract
npx media-context-mcp setup --whisper  # also audio transcription
```

## Clients

> If your client launches from a GUI, it may start with a minimal `PATH` and not find Whisper/Tesseract. Point at them with the `WHISPER_BIN` / `TESSERACT_BIN` / `FFMPEG_BIN` / `YTDLP_BIN` env vars (shown in the Claude Desktop block).

### Claude Code (CLI)

```bash
claude mcp add media-context -- npx -y media-context-mcp
```

With explicit binary paths:

```bash
claude mcp add media-context \
  --env WHISPER_BIN=/path/to/whisper \
  --env TESSERACT_BIN=/path/to/tesseract \
  -- npx -y media-context-mcp
```

### Claude Desktop

Settings → Developer → Edit Config (`claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "media-context": {
      "command": "npx",
      "args": ["-y", "media-context-mcp"],
      "env": {
        "WHISPER_BIN": "/path/to/whisper",
        "TESSERACT_BIN": "/path/to/tesseract"
      }
    }
  }
}
```

### Cursor

`~/.cursor/mcp.json` (global) or `.cursor/mcp.json` (per project):

```json
{
  "mcpServers": {
    "media-context": { "command": "npx", "args": ["-y", "media-context-mcp"] }
  }
}
```

### VS Code (GitHub Copilot, agent mode)

Create `.vscode/mcp.json` — VS Code uses the `servers` key:

```json
{
  "servers": {
    "media-context": { "command": "npx", "args": ["-y", "media-context-mcp"] }
  }
}
```

Open the Chat view, switch to **Agent** mode, and `analyze_media` appears in the tools picker.

### Cline / Roo (VS Code extension)

In the Cline MCP settings file:

```json
{
  "mcpServers": {
    "media-context": { "command": "npx", "args": ["-y", "media-context-mcp"] }
  }
}
```

### Codex CLI

`~/.codex/config.toml`:

```toml
[mcp_servers.media-context]
command = "npx"
args = ["-y", "media-context-mcp"]
```

### Windsurf

`~/.codeium/windsurf/mcp_config.json`:

```json
{
  "mcpServers": {
    "media-context": { "command": "npx", "args": ["-y", "media-context-mcp"] }
  }
}
```

### Any other MCP client

```json
{
  "mcpServers": {
    "media-context": { "command": "npx", "args": ["-y", "media-context-mcp"] }
  }
}
```

## Dependencies

The npm package ships no binaries — it drives tools already on your machine. `npx media-context-mcp setup` installs them for you; the table is the manual equivalent.

| Tool | Needed for | Windows | macOS | Linux |
|------|-----------|---------|-------|-------|
| `ffmpeg` + `ffprobe` | **required** | `winget install Gyan.FFmpeg` | `brew install ffmpeg` | `apt install ffmpeg` |
| `yt-dlp` | URL sources | `winget install yt-dlp.yt-dlp` | `brew install yt-dlp` | `apt install yt-dlp` |
| `tesseract` | OCR | `winget install UB-Mannheim.TesseractOCR` | `brew install tesseract` | `apt install tesseract-ocr` |
| `whisper` | transcripts | `pip install -U openai-whisper` | `pip3 install -U openai-whisper` | `pip3 install -U openai-whisper` |

Only `ffmpeg` is required. The rest unlock one feature each — install only what you need. The `check_media_deps` tool reports what's detected at any time.

> **Whisper note:** OpenAI Whisper pulls in PyTorch (~2.5 GB) and needs Python. If that's too heavy and you only need transcripts occasionally, you can skip it and rely on frames/OCR.
