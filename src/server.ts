import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { checkDeps, installHint } from "./system/deps.js";
import { analyzeMedia } from "./core.js";
import { ANALYZE_SHAPE } from "./schema.js";

type Content =
  | { type: "text"; text: string }
  | { type: "image"; data: string; mimeType: string };

const VERSION = "0.1.3";

/** Build the MCP server with both media tools registered. */
export function createServer(): McpServer {
  const server = new McpServer({ name: "media-context-mcp", version: VERSION });

  server.registerTool(
    "check_media_deps",
    {
      title: "Check media tool dependencies",
      description:
        "Report which external binaries (ffmpeg, ffprobe, yt-dlp, whisper, tesseract) are available. Call this first if analyze_media fails with a missing-binary error.",
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
    "analyze_media",
    {
      title: "Analyze a video, audio, or image file or URL",
      description:
        "Turn a local media file or URL (video, audio, or image) into compact context a model can read — fully local, no paid APIs. Video: montage frames (mode 'sheet', cheapest default), individual stills ('frames'), or scene changes ('scenes'); add transcript and/or ocr. Audio: speech transcript. Image: the picture plus optional OCR. For app/screen recordings use detail:'high' + ocr:true. To catch a transient UI glitch (a flicker/jump lasting <1s), use mode:'filmstrip' with a narrow startSec/endSec window, a high fps (10–15), and a crop around the affected control — it stacks dense frames so you can spot a frame whose value disagrees with the visual. Use the cheap default for everything else. Pass context to frame the analysis.",
      inputSchema: ANALYZE_SHAPE,
    },
    async (args) => {
      try {
        const result = await analyzeMedia(args);
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
        if (result.anomalies?.length) {
          const lines = result.anomalies.map(
            (a) => `  • ${a.value} at ${a.timeSec.toFixed(2)}s — jumped against the trend (${a.from} → ${a.to})`
          );
          content.push({ type: "text", text: `Value jumps detected:\n${lines.join("\n")}` });
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
