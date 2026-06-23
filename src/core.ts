import { promises as fs } from "node:fs";
import { checkDeps, installHint } from "./system/deps.js";
import { createWorkspace } from "./system/workspace.js";
import { resolveSource, isUrl } from "./pipeline/source.js";
import { probe, extract } from "./pipeline/ffmpeg.js";
import { transcribe } from "./pipeline/transcript.js";
import type { AnalyzeOptions, AnalyzeResult, AnalyzeImage, Mode } from "./types.js";

export const MAX_IMAGES = 12;
export const MAX_TRANSCRIPT_CHARS = 24000;

const DEFAULTS = {
  mode: "sheet" as Mode,
  maxFrames: 30,
  grid: 5,
  scale: 320,
  sceneThreshold: 0.4,
  transcript: false,
  whisperModel: "small",
  maxDurationSec: 3600,
  maxFileSizeMb: 500,
};

/**
 * Thrown for failures the caller should surface as an error rather than a
 * partial result (missing binaries, unresolvable source, no frames produced).
 */
export class AnalyzeError extends Error {
  override name = "AnalyzeError";
}

/** Run a step, normalizing any operational failure into an {@link AnalyzeError}. */
async function asAnalyzeError<T>(step: () => Promise<T>): Promise<T> {
  try {
    return await step();
  } catch (err) {
    throw err instanceof AnalyzeError ? err : new AnalyzeError((err as Error).message);
  }
}

async function toImage(filePath: string): Promise<AnalyzeImage> {
  const buf = await fs.readFile(filePath);
  return { mimeType: "image/png", base64: buf.toString("base64") };
}

/**
 * Turn a local video file or URL into compact visual context plus an optional
 * transcript. Transport-agnostic: returns base64 images and a text summary that
 * any caller (MCP server, CLI, library consumer) can render. All temporary
 * artifacts are removed before returning.
 */
export async function analyzeVideo(options: AnalyzeOptions): Promise<AnalyzeResult> {
  const o = { ...DEFAULTS, ...stripUndefined(options), source: options.source };
  const warnings: string[] = [];

  const deps = await checkDeps();
  if (!deps.ffmpeg || !deps.ffprobe) {
    const missing = !deps.ffmpeg ? "ffmpeg" : "ffprobe";
    throw new AnalyzeError(`${missing} not found. ${installHint(missing)}`);
  }
  if (isUrl(o.source) && !deps.ytdlp) {
    throw new AnalyzeError(`URL given but yt-dlp not found. ${installHint("ytdlp")}`);
  }

  const workspace = await createWorkspace();
  try {
    const downloadDir = await workspace.sub("download");
    const resolved = await asAnalyzeError(() =>
      resolveSource(o.source, downloadDir, {
        maxDurationSec: o.maxDurationSec,
        maxFileSizeMb: o.maxFileSizeMb,
      })
    );
    const info = await asAnalyzeError(() => probe(resolved.filePath));

    const framesDir = await workspace.sub("frames");
    const result = await extract({
      filePath: resolved.filePath,
      outDir: framesDir,
      mode: o.mode,
      scale: o.scale,
      maxFrames: o.maxFrames,
      grid: o.grid,
      sceneThreshold: o.sceneThreshold,
      startSec: o.startSec,
      endSec: o.endSec,
      durationSec: info.durationSec,
    });

    if (result.images.length === 0) {
      throw new AnalyzeError(
        "No frames were extracted. For 'scenes' mode try a lower sceneThreshold, or switch to mode 'sheet'."
      );
    }

    const shownPaths = result.images.slice(0, MAX_IMAGES);
    if (result.images.length > shownPaths.length) {
      warnings.push(`Showing ${shownPaths.length} of ${result.images.length} images.`);
    }
    const images = await Promise.all(shownPaths.map(toImage));

    const summary = buildSummary(o, resolved, info, result, shownPaths.length);

    let transcript: AnalyzeResult["transcript"];
    if (o.transcript) {
      if (!deps.whisper) {
        warnings.push(`Transcript skipped: whisper not installed. ${installHint("whisper")}`);
      } else {
        try {
          const transcriptDir = await workspace.sub("transcript");
          const tr = await transcribe(resolved.filePath, transcriptDir, o.whisperModel);
          const text =
            tr.text.length > MAX_TRANSCRIPT_CHARS
              ? tr.text.slice(0, MAX_TRANSCRIPT_CHARS) + "\n…[truncated]"
              : tr.text;
          transcript = { text, model: tr.model };
        } catch (err) {
          warnings.push(`Transcript failed: ${(err as Error).message}`);
        }
      }
    }

    return {
      summary,
      mode: o.mode,
      durationSec: info.durationSec,
      width: info.width,
      height: info.height,
      effectiveFps: result.effectiveFps,
      images,
      totalImages: result.images.length,
      transcript,
      warnings,
    };
  } finally {
    await workspace.dispose();
  }
}

function stripUndefined<T extends object>(obj: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== undefined)
  ) as Partial<T>;
}

function buildSummary(
  o: { mode: Mode; grid: number; scale: number; sceneThreshold: number },
  resolved: { origin: string; downloaded: boolean },
  info: { durationSec: number; width: number; height: number },
  result: { images: string[]; effectiveFps: number | null },
  shown: number
): string {
  return [
    `Source: ${resolved.origin}${resolved.downloaded ? " (downloaded)" : ""}`,
    `Duration: ${info.durationSec.toFixed(1)}s  Resolution: ${info.width}x${info.height}`,
    `Mode: ${o.mode}  Images: ${shown}${result.images.length > shown ? ` (capped from ${result.images.length})` : ""}`,
    result.effectiveFps
      ? `Sampling: ~${result.effectiveFps.toFixed(4)} fps, grid ${o.grid}x${o.grid}, tile width ${o.scale}px`
      : `Scene detection threshold ${o.sceneThreshold}, grid ${o.grid}x${o.grid}`,
    o.mode === "sheet" || o.mode === "scenes"
      ? "Each image is a montage; read tiles left-to-right, top-to-bottom in chronological order."
      : "Images are individual stills in chronological order.",
  ].join("\n");
}
