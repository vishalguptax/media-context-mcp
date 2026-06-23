import { promises as fs } from "node:fs";
import { ZodError } from "zod";
import { checkDeps, installHint } from "./system/deps.js";
import { createWorkspace } from "./system/workspace.js";
import { resolveSource, isUrl } from "./pipeline/source.js";
import { probe, extract } from "./pipeline/ffmpeg.js";
import { transcribe } from "./pipeline/transcript.js";
import { ocrImages } from "./pipeline/ocr.js";
import { AnalyzeSchema } from "./schema.js";
import type { AnalyzeOptions, AnalyzeResult, AnalyzeImage, ImageFormat, Mode } from "./types.js";

export const MAX_IMAGES = 12;
export const MAX_TRANSCRIPT_CHARS = 24000;
export const MAX_OCR_CHARS = 24000;

const MIME: Record<ImageFormat, string> = {
  webp: "image/webp",
  jpeg: "image/jpeg",
  png: "image/png",
};

/**
 * Thrown for failures the caller should surface as an error rather than a
 * partial result (bad input, missing binaries, unresolvable source, no frames).
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

async function toImage(filePath: string, format: ImageFormat): Promise<AnalyzeImage> {
  const buf = await fs.readFile(filePath);
  return { mimeType: MIME[format], base64: buf.toString("base64") };
}

/**
 * Turn a local video file or URL into compact visual context plus an optional
 * transcript. Transport-agnostic: returns base64 images and a text summary that
 * any caller (MCP server, CLI, library consumer) can render. All temporary
 * artifacts are removed before returning.
 */
export async function analyzeVideo(options: AnalyzeOptions): Promise<AnalyzeResult> {
  const o = parseOptions(options);
  const warnings: string[] = [];

  const deps = await checkDeps();
  if (!deps.ffmpeg || !deps.ffprobe) {
    const missing = !deps.ffmpeg ? "ffmpeg" : "ffprobe";
    throw new AnalyzeError(`${missing} not found — I need it to see anything. ${installHint(missing)}`);
  }
  if (isUrl(o.source) && !deps.ytdlp) {
    throw new AnalyzeError(`That's a URL, but yt-dlp isn't installed so I can't fetch it. ${installHint("ytdlp")}`);
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

    if (info.width === 0 && info.height === 0) {
      throw new AnalyzeError(
        "No video stream in this file — I read pixels, not vibes. If it's audio-only, re-run with transcript: true and I'll listen instead."
      );
    }

    const framesDir = await workspace.sub("frames");
    const result = await extract({
      filePath: resolved.filePath,
      outDir: framesDir,
      mode: o.mode,
      format: o.format,
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
        o.mode === "scenes"
          ? "Zero frames — this video may have no hard cuts. Lower sceneThreshold or switch to mode 'sheet'."
          : "Zero frames extracted. Check that startSec/endSec fall inside the video, or try mode 'sheet'."
      );
    }

    const shownPaths = result.images.slice(0, MAX_IMAGES);
    if (result.images.length > shownPaths.length) {
      warnings.push(
        `Showing the first ${shownPaths.length} of ${result.images.length} images to keep token cost sane — narrow the window or lower maxFrames for full coverage.`
      );
    }
    const images = await Promise.all(shownPaths.map((p) => toImage(p, o.format)));

    const summary = buildSummary(o, resolved, info, result, shownPaths.length);

    let transcript: AnalyzeResult["transcript"];
    if (o.transcript) {
      if (!deps.whisper) {
        warnings.push(`Transcript skipped — whisper isn't installed. ${installHint("whisper")}`);
      } else {
        try {
          const transcriptDir = await workspace.sub("transcript");
          const tr = await transcribe(resolved.filePath, transcriptDir, o.whisperModel);
          if (!tr.text) {
            warnings.push("Transcript came back empty — whisper heard only silence.");
          }
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

    let ocrText: string | undefined;
    if (o.ocr) {
      if (!deps.tesseract) {
        warnings.push(`OCR skipped — tesseract isn't installed. ${installHint("tesseract")}`);
      } else {
        try {
          // OCR reads its own full-resolution stills, not the token-cheap display
          // images, and always as individual frames (never montage tiles).
          const ocrFramesDir = await workspace.sub("ocr-frames");
          const ocrScale = Math.min(info.width || 1280, 1920);
          const ocrFrames = await extract({
            filePath: resolved.filePath,
            outDir: ocrFramesDir,
            mode: "frames",
            format: "png",
            scale: ocrScale,
            maxFrames: o.ocrMaxFrames,
            grid: o.grid,
            sceneThreshold: o.sceneThreshold,
            startSec: o.startSec,
            endSec: o.endSec,
            durationSec: info.durationSec,
          });
          const preDir = await workspace.sub("ocr-pre");
          const text = await ocrImages(ocrFrames.images, {
            lang: o.ocrLang,
            psm: o.ocrPsm,
            workDir: preDir,
          });
          if (!text) {
            warnings.push("OCR found no readable text on these frames.");
          } else {
            ocrText =
              text.length > MAX_OCR_CHARS ? text.slice(0, MAX_OCR_CHARS) + "\n…[truncated]" : text;
          }
        } catch (err) {
          warnings.push(`OCR failed: ${(err as Error).message}`);
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
      ocrText,
      warnings,
    };
  } finally {
    await workspace.dispose();
  }
}

/** Validate and fill defaults, turning schema violations into AnalyzeError. */
function parseOptions(options: AnalyzeOptions): ReturnType<typeof AnalyzeSchema.parse> {
  try {
    return AnalyzeSchema.parse(withDetailPreset(options));
  } catch (err) {
    if (err instanceof ZodError) {
      throw new AnalyzeError(err.issues.map((i) => i.message).join("; "));
    }
    throw err;
  }
}

/**
 * Apply the `detail: high` profile — readable stills for screen recordings —
 * filling only the fields the caller left unset, so explicit overrides win.
 * `ocr` implies high detail so text is read off crisp frames, not tiny tiles.
 */
function withDetailPreset(options: AnalyzeOptions): AnalyzeOptions {
  const detail = options.detail ?? (options.ocr ? "high" : undefined);
  if (detail !== "high") return options;
  return {
    ...options,
    mode: options.mode ?? "frames",
    scale: options.scale ?? 900,
    format: options.format ?? "png",
  };
}

function buildSummary(
  o: { mode: Mode; format: ImageFormat; grid: number; scale: number; sceneThreshold: number; context?: string },
  resolved: { origin: string; downloaded: boolean },
  info: { durationSec: number; width: number; height: number },
  result: { images: string[]; effectiveFps: number | null },
  shown: number
): string {
  return [
    ...(o.context ? [`Context from caller: ${o.context}`] : []),
    `Source: ${resolved.origin}${resolved.downloaded ? " (downloaded)" : ""}`,
    `Duration: ${info.durationSec.toFixed(1)}s  Resolution: ${info.width}x${info.height}`,
    `Mode: ${o.mode}  Format: ${o.format}  Images: ${shown}${result.images.length > shown ? ` (capped from ${result.images.length})` : ""}`,
    result.effectiveFps
      ? `Sampling: ~${result.effectiveFps.toFixed(4)} fps, grid ${o.grid}x${o.grid}, tile width ${o.scale}px`
      : `Scene detection threshold ${o.sceneThreshold}, grid ${o.grid}x${o.grid}`,
    o.mode === "sheet" || o.mode === "scenes"
      ? "Each image is a montage; read tiles left-to-right, top-to-bottom in chronological order."
      : "Images are individual stills in chronological order.",
  ].join("\n");
}
