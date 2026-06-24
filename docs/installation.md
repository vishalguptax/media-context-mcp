# Installation

media-context-mcp is a standard **stdio MCP server**. Every client launches it the same way:

```
npx -y media-context-mcp
```

After adding it, run the one-time setup so the server has everything it needs:

```bash
npx media-context-mcp setup          # core: frames, URL download, on-screen text
npx media-context-mcp setup --audio  # also enable transcription
```

`check_media_deps` reports what's ready at any time; `npx media-context-mcp setup --uninstall` removes the helpers again.

## Clients

Most clients use the same block — paste it into the client's MCP config file:

```json
{
  "mcpServers": {
    "media-context": { "command": "npx", "args": ["-y", "media-context-mcp"] }
  }
}
```

| Client | Config file |
|--------|-------------|
| Claude Code | `claude mcp add media-context -- npx -y media-context-mcp` |
| Claude Desktop | `claude_desktop_config.json` (Settings → Developer → Edit Config) |
| Cursor | `~/.cursor/mcp.json` (global) or `.cursor/mcp.json` (project) |
| Windsurf | `~/.codeium/windsurf/mcp_config.json` |
| Cline / Roo Code | `cline_mcp_settings.json` |
| Kiro | `.kiro/settings/mcp.json` (project) or `~/.kiro/settings/mcp.json` (user) |
| Gemini CLI | `~/.gemini/settings.json` |
| JetBrains AI Assistant | Settings → Tools → AI Assistant → Model Context Protocol |

### Clients with a different shape

**VS Code** (GitHub Copilot, agent mode) — `.vscode/mcp.json`, uses the `servers` key:

```json
{ "servers": { "media-context": { "command": "npx", "args": ["-y", "media-context-mcp"] } } }
```

**Zed** — `settings.json`, uses `context_servers`:

```json
{ "context_servers": { "media-context": { "command": { "path": "npx", "args": ["-y", "media-context-mcp"] } } } }
```

**Codex CLI** — `~/.codex/config.toml`:

```toml
[mcp_servers.media-context]
command = "npx"
args = ["-y", "media-context-mcp"]
```

### Claude Code plugin

Install everything in one command:

```
/plugin marketplace add vishalguptax/media-context-mcp
/plugin install media-context
```

### Per-project (team-shared)

Commit the config so everyone on the project gets it: `claude mcp add … --scope project` (writes `.mcp.json`), or a `.cursor/mcp.json` / `.vscode/mcp.json` in the repo.

## Local helpers

`npx media-context-mcp setup` installs these for you via your OS package manager. You only need the first one; the rest each unlock a single capability. The server auto-detects them afterward — even in the off-`PATH` spots installers use — so no extra configuration is needed.

| Helper | Enables | Install by hand |
|--------|---------|-----------------|
| `ffmpeg` + `ffprobe` | **everything (required)** | `winget install Gyan.FFmpeg` · `brew install ffmpeg` · `apt install ffmpeg` |
| `yt-dlp` | analyzing URLs | `winget install yt-dlp.yt-dlp` · `brew install yt-dlp` · `pip install -U yt-dlp` |
| `tesseract` | on-screen text | `winget install UB-Mannheim.TesseractOCR` · `brew install tesseract` · `apt install tesseract-ocr` |
| `whisper` | transcription | `pip install -U openai-whisper` |

If a helper lives somewhere unusual, point at it with the `FFMPEG_BIN` / `YTDLP_BIN` / `WHISPER_BIN` / `TESSERACT_BIN` environment variables (e.g. in your client config's `env` block).
