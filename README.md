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
| `mode` | `sheet` | `sheet` \| `frames` \| `scenes`. |
| `maxFrames` | `30` | Upper bound on sampled frames over the window. |
| `grid` | `5` | Tiles per row/column for montage modes. |
| `scale` | `320` | Per-frame width in px before tiling. Lower = fewer tokens. |
| `sceneThreshold` | `0.4` | Scene-change sensitivity (`scenes` mode). |
| `startSec` / `endSec` | — | Restrict to a time window. |
| `transcript` | `false` | Also run Whisper. |
| `whisperModel` | `small` | `tiny` \| `base` \| `small` \| `medium` \| `large`. |
| `maxDurationSec` | `3600` | Reject URL downloads longer than this. |

Returns a text summary followed by up to 12 image blocks (and a transcript block when requested).

### `check_video_deps`

Reports availability of `ffmpeg`, `ffprobe`, `yt-dlp`, `whisper` with install hints.

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
