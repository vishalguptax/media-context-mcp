import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { checkDeps, installHint } from "./system/deps.js";
import { analyzeVideo } from "./core.js";

type Content =
  | { type: "text"; text: string }
  | { type: "image"; data: string; mimeType: string };

const VERSION = "0.1.0";

const ANALYZE_SCHEMA = {
  source: z.string().describe("Local video file path OR an http(s) URL to a video."),
  mode: z
    .enum(["sheet", "frames", "scenes"])
    .default("sheet")
    .describe(
      "sheet = montage grids (cheapest, default); frames = individual stills; scenes = only scene-change montages."
    ),
  maxFrames: z
    .number()
    .int()
    .min(1)
    .max(200)
    .default(30)
    .describe("Upper bound on sampled frames across the whole window."),
  grid: z
    .number()
    .int()
    .min(2)
    .max(8)
    .default(5)
    .describe("Tiles per row/column for sheet/scenes modes (grid x grid)."),
  scale: z
    .number()
    .int()
    .min(120)
    .max(1280)
    .default(320)
    .describe("Width in px of each frame before tiling. Lower = fewer tokens."),
  sceneThreshold: z
    .number()
    .min(0.05)
    .max(0.9)
    .default(0.4)
    .describe("Scene-change sensitivity for 'scenes' mode (higher = fewer cuts)."),
  startSec: z.number().min(0).optional().describe("Window start in seconds."),
  endSec: z.number().min(0).optional().describe("Window end in seconds."),
  transcript: z
    .boolean()
    .default(false)
    .describe("Also run local Whisper to produce a speech transcript."),
  whisperModel: z
    .string()
    .default("small")
    .describe("Whisper model name (tiny, base, small, medium, large)."),
  maxDurationSec: z
    .number()
    .min(1)
    .max(36000)
    .default(3600)
    .describe("Reject URL downloads longer than this many seconds."),
  maxFileSizeMb: z
    .number()
    .min(1)
    .max(8192)
    .default(500)
    .describe("Abort a URL download once it exceeds this size in MB."),
};

/** Build the MCP server with both video tools registered. */
export function createServer(): McpServer {
  const server = new McpServer({ name: "video-context-mcp", version: VERSION });

  server.registerTool(
    "check_video_deps",
    {
      title: "Check video tool dependencies",
      description:
        "Report which external binaries (ffmpeg, ffprobe, yt-dlp, whisper) are available. Call this first if analyze_video fails with a missing-binary error.",
      inputSchema: {},
    },
    async () => {
      const deps = await checkDeps();
      const lines = [
        `ffmpeg:  ${deps.ffmpeg ? "ok" : "MISSING — " + installHint("ffmpeg")}`,
        `ffprobe: ${deps.ffprobe ? "ok" : "MISSING — " + installHint("ffprobe")}`,
        `yt-dlp:  ${deps.ytdlp ? "ok" : "MISSING (needed for URLs) — " + installHint("ytdlp")}`,
        `whisper: ${deps.whisper ? "ok" : "MISSING (needed for transcripts) — " + installHint("whisper")}`,
      ];
      return { content: [{ type: "text", text: lines.join("\n") }] };
    }
  );

  server.registerTool(
    "analyze_video",
    {
      title: "Analyze a video file or URL",
      description:
        "Turn a local video file path or a URL (YouTube, Vimeo, direct mp4, etc.) into compact visual context an agent can read. Default mode 'sheet' tiles sampled frames into a few montage images to keep token cost low. Use 'frames' for individual stills, 'scenes' to capture only scene changes. Optionally include a speech transcript.",
      inputSchema: ANALYZE_SCHEMA,
    },
    async (args) => {
      try {
        const result = await analyzeVideo(args);
        const content: Content[] = [{ type: "text", text: result.summary }];
        for (const img of result.images) {
          content.push({ type: "image", data: img.base64, mimeType: img.mimeType });
        }
        if (result.transcript) {
          content.push({
            type: "text",
            text: `Transcript (whisper ${result.transcript.model}):\n${result.transcript.text}`,
          });
        }
        for (const w of result.warnings) {
          content.push({ type: "text", text: w });
        }
        return { content };
      } catch (err) {
        return { isError: true, content: [{ type: "text", text: (err as Error).message }] };
      }
    }
  );

  return server;
}
