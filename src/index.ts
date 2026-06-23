#!/usr/bin/env node
import { promises as fs } from "node:fs";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { checkDeps, installHint } from "./deps.js";
import { resolveSource, safeRm, isUrl } from "./source.js";
import { probe, extract, type Mode } from "./ffmpeg.js";
import { transcribe } from "./transcript.js";

const MAX_IMAGES = 12;
const MAX_TRANSCRIPT_CHARS = 24000;

type Content =
  | { type: "text"; text: string }
  | { type: "image"; data: string; mimeType: string };

function textBlock(text: string): Content {
  return { type: "text", text };
}

async function imageBlock(filePath: string): Promise<Content> {
  const buf = await fs.readFile(filePath);
  return { type: "image", data: buf.toString("base64"), mimeType: "image/png" };
}

const server = new McpServer({
  name: "video-context-mcp",
  version: "0.1.0",
});

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
    return { content: [textBlock(lines.join("\n"))] };
  }
);

server.registerTool(
  "analyze_video",
  {
    title: "Analyze a video file or URL",
    description:
      "Turn a local video file path or a URL (YouTube, Vimeo, direct mp4, etc.) into compact visual context an agent can read. Default mode 'sheet' tiles sampled frames into a few montage images to keep token cost low. Use 'frames' for individual stills, 'scenes' to capture only scene changes. Optionally include a speech transcript.",
    inputSchema: {
      source: z
        .string()
        .describe("Local video file path OR an http(s) URL to a video."),
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
    },
  },
  async (args) => {
    const deps = await checkDeps();
    if (!deps.ffmpeg || !deps.ffprobe) {
      const missing = !deps.ffmpeg ? "ffmpeg" : "ffprobe";
      return {
        isError: true,
        content: [textBlock(`${missing} not found. ${installHint(missing as "ffmpeg")}`)],
      };
    }
    if (isUrl(args.source) && !deps.ytdlp) {
      return {
        isError: true,
        content: [textBlock(`URL given but yt-dlp not found. ${installHint("ytdlp")}`)],
      };
    }

    let resolved: Awaited<ReturnType<typeof resolveSource>> | null = null;
    let workDir: string | null = null;
    try {
      resolved = await resolveSource(args.source, {
        maxDurationSec: args.maxDurationSec,
      });
      const info = await probe(resolved.filePath);

      workDir = `${resolved.tempDir ?? resolved.filePath}.frames-${process.pid}`;
      const result = await extract({
        filePath: resolved.filePath,
        outDir: workDir,
        mode: args.mode as Mode,
        scale: args.scale,
        maxFrames: args.maxFrames,
        grid: args.grid,
        sceneThreshold: args.sceneThreshold,
        startSec: args.startSec,
        endSec: args.endSec,
        durationSec: info.durationSec,
      });

      if (result.images.length === 0) {
        return {
          isError: true,
          content: [
            textBlock(
              "No frames were extracted. For 'scenes' mode try a lower sceneThreshold, or switch to mode 'sheet'."
            ),
          ],
        };
      }

      const shown = result.images.slice(0, MAX_IMAGES);
      const content: Content[] = [];

      const summary = [
        `Source: ${resolved.origin}${resolved.downloaded ? " (downloaded)" : ""}`,
        `Duration: ${info.durationSec.toFixed(1)}s  Resolution: ${info.width}x${info.height}`,
        `Mode: ${args.mode}  Images: ${shown.length}${result.images.length > shown.length ? ` (capped from ${result.images.length})` : ""}`,
        result.effectiveFps
          ? `Sampling: ~${result.effectiveFps.toFixed(4)} fps, grid ${args.grid}x${args.grid}, tile width ${args.scale}px`
          : `Scene detection threshold ${args.sceneThreshold}, grid ${args.grid}x${args.grid}`,
        args.mode === "sheet" || args.mode === "scenes"
          ? "Each image is a montage; read tiles left-to-right, top-to-bottom in chronological order."
          : "Images are individual stills in chronological order.",
      ].join("\n");
      content.push(textBlock(summary));

      for (const img of shown) {
        content.push(await imageBlock(img));
      }

      if (args.transcript) {
        if (!deps.whisper) {
          content.push(
            textBlock(`Transcript skipped: whisper not installed. ${installHint("whisper")}`)
          );
        } else {
          try {
            const tr = await transcribe(resolved.filePath, workDir, args.whisperModel);
            const clipped =
              tr.text.length > MAX_TRANSCRIPT_CHARS
                ? tr.text.slice(0, MAX_TRANSCRIPT_CHARS) + "\n…[truncated]"
                : tr.text;
            content.push(textBlock(`Transcript (whisper ${tr.model}):\n${clipped}`));
          } catch (err) {
            content.push(textBlock(`Transcript failed: ${(err as Error).message}`));
          }
        }
      }

      return { content };
    } catch (err) {
      return { isError: true, content: [textBlock((err as Error).message)] };
    } finally {
      await safeRm(workDir);
      if (resolved?.tempDir) await safeRm(resolved.tempDir);
    }
  }
);

async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  process.stderr.write("video-context-mcp running on stdio\n");
}

main().catch((err) => {
  process.stderr.write(`fatal: ${err?.stack ?? err}\n`);
  process.exit(1);
});
