import { promises as fs } from "node:fs";
import { ZodError } from "zod";
import { checkDeps, installHint } from "./system/deps.js";
import { createWorkspace, type Workspace } from "./system/workspace.js";
import { resolveSource, isUrl, type ResolvedSource } from "./pipeline/source.js";
import { probe, extract, scaleImage } from "./pipeline/ffmpeg.js";
import { transcribe } from "./pipeline/transcript.js";
import { ocrImages } from "./pipeline/ocr.js";
import { classifyMedia, imageMime } from "./pipeline/media.js";
import { AnalyzeSchema } from "./schema.js";
import type {
  AnalyzeOptions,
  AnalyzeResult,
  AnalyzeImage,
  DepStatus,
  ImageFormat,
  ProbeInfo,
  TranscriptResult,
} from "./types.js";

export const MAX_IMAGES = 12;
export const MAX_TRANSCRIPT_CHARS = 24000;
export const MAX_OCR_CHARS = 24000;

const FRAME_MIME: Record<ImageFormat, string> = {
  webp: "image/webp",
  jpeg: "image/jpeg",
  png: "image/png",
};

type Options = ReturnType<typeof AnalyzeSchema.parse>;

/**
 * Thrown for failures the caller should surface as an error rather than a
 * partial result (bad input, missing binaries, unresolvable source, no frames).
 */
export class AnalyzeError extends Error {
  override name = "AnalyzeError";
}

/**
 * Turn a local media file or URL — video, audio, or image — into compact context
 * a model can read: token-cheap montage frames (video), a speech transcript
 * (audio/video), or OCR'd on-screen text (image/video). Transport-agnostic and
 * fully local; all temporary artifacts are removed before returning.
 */
export async function analyzeMedia(options: AnalyzeOptions): Promise<AnalyzeResult> {
  const o = parseOptions(options);

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
    const type = classifyMedia(resolved.filePath, info);

    if (type === "image") return await analyzeImage(o, resolved, info, deps, workspace);
    if (type === "audio") return await analyzeAudio(o, resolved, info, deps, workspace);
    return await analyzeVideoMedia(o, resolved, info, deps, workspace);
  } finally {
    await workspace.dispose();
  }
}

/** Backwards-compatible alias from when this only handled video. */
export const analyzeVideo = analyzeMedia;

// ---------------------------------------------------------------------------
// Per-media-type handlers
// ---------------------------------------------------------------------------

async function analyzeVideoMedia(
  o: Options,
  resolved: ResolvedSource,
  info: ProbeInfo,
  deps: DepStatus,
  workspace: Workspace
): Promise<AnalyzeResult> {
  const warnings: string[] = [];

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
  const images = await Promise.all(shownPaths.map((p) => toFrame(p, o.format)));

  const summary = [
    ...(o.context ? [`Context from caller: ${o.context}`] : []),
    `Media: video  Source: ${resolved.origin}${resolved.downloaded ? " (downloaded)" : ""}`,
    `Duration: ${info.durationSec.toFixed(1)}s  Resolution: ${info.width}x${info.height}`,
    `Mode: ${o.mode}  Format: ${o.format}  Images: ${shownPaths.length}${result.images.length > shownPaths.length ? ` (capped from ${result.images.length})` : ""}`,
    result.effectiveFps
      ? `Sampling: ~${result.effectiveFps.toFixed(4)} fps, grid ${o.grid}x${o.grid}, tile width ${o.scale}px`
      : `Scene detection threshold ${o.sceneThreshold}, grid ${o.grid}x${o.grid}`,
    o.mode === "sheet" || o.mode === "scenes"
      ? "Each image is a montage; read tiles left-to-right, top-to-bottom in chronological order."
      : "Images are individual stills in chronological order.",
  ].join("\n");

  const transcript = o.transcript
    ? await runTranscript(resolved.filePath, o, deps, workspace, warnings)
    : undefined;

  let ocrText: string | undefined;
  if (o.ocr) {
    if (!deps.tesseract) {
      warnings.push(`OCR skipped — tesseract isn't installed. ${installHint("tesseract")}`);
    } else {
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
      ocrText = await runOcr(ocrFrames.images, o, workspace, warnings);
    }
  }

  return {
    summary,
    mediaType: "video",
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
}

async function analyzeAudio(
  o: Options,
  resolved: ResolvedSource,
  info: ProbeInfo,
  deps: DepStatus,
  workspace: Workspace
): Promise<AnalyzeResult> {
  if (!deps.whisper) {
    throw new AnalyzeError(
      `This is audio with no video to show, and whisper isn't installed so there's nothing to transcribe. ${installHint("whisper")}`
    );
  }
  const warnings: string[] = [];
  const transcript = await runTranscript(resolved.filePath, o, deps, workspace, warnings);

  const summary = [
    ...(o.context ? [`Context from caller: ${o.context}`] : []),
    `Media: audio  Source: ${resolved.origin}${resolved.downloaded ? " (downloaded)" : ""}`,
    `Duration: ${info.durationSec.toFixed(1)}s`,
    "No video stream — returning the transcript only.",
  ].join("\n");

  return {
    summary,
    mediaType: "audio",
    mode: o.mode,
    durationSec: info.durationSec,
    width: 0,
    height: 0,
    effectiveFps: null,
    images: [],
    totalImages: 0,
    transcript,
    warnings,
  };
}

async function analyzeImage(
  o: Options,
  resolved: ResolvedSource,
  info: ProbeInfo,
  deps: DepStatus,
  workspace: Workspace
): Promise<AnalyzeResult> {
  const warnings: string[] = [];

  // Downscale the display copy for token economy; OCR still reads the original.
  let displayImage: AnalyzeImage;
  try {
    const dispDir = await workspace.sub("image");
    const scaled = await scaleImage(resolved.filePath, dispDir, o.scale, o.format);
    displayImage = await toFrame(scaled, o.format);
  } catch {
    const buf = await fs.readFile(resolved.filePath);
    displayImage = { mimeType: imageMime(resolved.filePath), base64: buf.toString("base64") };
  }

  let ocrText: string | undefined;
  if (o.ocr) {
    if (!deps.tesseract) {
      warnings.push(`OCR skipped — tesseract isn't installed. ${installHint("tesseract")}`);
    } else {
      ocrText = await runOcr([resolved.filePath], o, workspace, warnings);
    }
  }

  const summary = [
    ...(o.context ? [`Context from caller: ${o.context}`] : []),
    `Media: image  Source: ${resolved.origin}${resolved.downloaded ? " (downloaded)" : ""}`,
    `Resolution: ${info.width}x${info.height}  Display format: ${o.format}`,
    o.ocr ? "On-screen text recovered via OCR is included below." : "Pass ocr:true to also extract on-screen text.",
  ].join("\n");

  return {
    summary,
    mediaType: "image",
    mode: o.mode,
    durationSec: 0,
    width: info.width,
    height: info.height,
    effectiveFps: null,
    images: [displayImage],
    totalImages: 1,
    ocrText,
    warnings,
  };
}

// ---------------------------------------------------------------------------
// Shared steps
// ---------------------------------------------------------------------------

async function runTranscript(
  filePath: string,
  o: Options,
  deps: DepStatus,
  workspace: Workspace,
  warnings: string[]
): Promise<TranscriptResult | undefined> {
  if (!deps.whisper) {
    warnings.push(`Transcript skipped — whisper isn't installed. ${installHint("whisper")}`);
    return undefined;
  }
  try {
    const dir = await workspace.sub("transcript");
    const tr = await transcribe(filePath, dir, o.whisperModel);
    if (!tr.text) warnings.push("Transcript came back empty — whisper heard only silence.");
    const text =
      tr.text.length > MAX_TRANSCRIPT_CHARS
        ? tr.text.slice(0, MAX_TRANSCRIPT_CHARS) + "\n…[truncated]"
        : tr.text;
    return { text, model: tr.model };
  } catch (err) {
    warnings.push(`Transcript failed: ${(err as Error).message}`);
    return undefined;
  }
}

async function runOcr(
  paths: string[],
  o: Options,
  workspace: Workspace,
  warnings: string[]
): Promise<string | undefined> {
  try {
    const preDir = await workspace.sub("ocr-pre");
    const text = await ocrImages(paths, { lang: o.ocrLang, psm: o.ocrPsm, workDir: preDir });
    if (!text) {
      warnings.push("OCR found no readable text.");
      return undefined;
    }
    return text.length > MAX_OCR_CHARS ? text.slice(0, MAX_OCR_CHARS) + "\n…[truncated]" : text;
  } catch (err) {
    warnings.push(`OCR failed: ${(err as Error).message}`);
    return undefined;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function toFrame(filePath: string, format: ImageFormat): Promise<AnalyzeImage> {
  const buf = await fs.readFile(filePath);
  return { mimeType: FRAME_MIME[format], base64: buf.toString("base64") };
}

/** Run a step, normalizing any operational failure into an {@link AnalyzeError}. */
async function asAnalyzeError<T>(step: () => Promise<T>): Promise<T> {
  try {
    return await step();
  } catch (err) {
    throw err instanceof AnalyzeError ? err : new AnalyzeError((err as Error).message);
  }
}

/** Validate and fill defaults, turning schema violations into AnalyzeError. */
function parseOptions(options: AnalyzeOptions): Options {
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
