import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { checkDeps, installHint } from "./system/deps.js";
import { analyzeVideo } from "./core.js";
import { ANALYZE_SHAPE } from "./schema.js";

type Content =
  | { type: "text"; text: string }
  | { type: "image"; data: string; mimeType: string };

const VERSION = "0.1.0";

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
        `ffmpeg:    ${deps.ffmpeg ? "ok" : "MISSING — " + installHint("ffmpeg")}`,
        `ffprobe:   ${deps.ffprobe ? "ok" : "MISSING — " + installHint("ffprobe")}`,
        `yt-dlp:    ${deps.ytdlp ? "ok" : "MISSING (needed for URLs) — " + installHint("ytdlp")}`,
        `whisper:   ${deps.whisper ? "ok" : "MISSING (needed for transcripts) — " + installHint("whisper")}`,
        `tesseract: ${deps.tesseract ? "ok" : "MISSING (needed for OCR) — " + installHint("tesseract")}`,
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
      inputSchema: ANALYZE_SHAPE,
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
        if (result.ocrText) {
          content.push({ type: "text", text: `On-screen text (OCR):\n${result.ocrText}` });
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
