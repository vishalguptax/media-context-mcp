import { promises as fs } from "node:fs";
import path from "node:path";
import { run } from "../system/exec.js";
import { bin } from "../system/bins.js";
import type { ProbeInfo, ExtractParams, ExtractResult, ImageFormat } from "../types.js";

export type { ProbeInfo, Mode, ExtractParams, ExtractResult } from "../types.js";

const FORMAT_EXT: Record<ImageFormat, string> = { webp: "webp", jpeg: "jpg", png: "png" };

const FORMAT_QUALITY: Record<ImageFormat, string[]> = {
  webp: ["-quality", "80"],
  jpeg: ["-q:v", "4"],
  png: [],
};

/**
 * Produce a single display copy of a still image, downscaled to at most `scale`
 * wide (never upscaled) and re-encoded to `format`. Used for the image-input
 * path so returned images stay token-cheap while OCR reads the original.
 */
export async function scaleImage(
  filePath: string,
  outDir: string,
  scale: number,
  format: ImageFormat
): Promise<string> {
  await fs.mkdir(outDir, { recursive: true });
  const dst = path.join(outDir, `image.${FORMAT_EXT[format]}`);
  const vf = `scale='min(iw,${scale})':-2:flags=lanczos`;
  const res = await run(
    bin("ffmpeg"),
    ["-i", filePath, "-vf", vf, "-frames:v", "1", ...FORMAT_QUALITY[format], "-y", dst],
    { timeoutMs: 60 * 1000 }
  );
  if (res.code !== 0) {
    throw new Error(`ffmpeg (image) failed: ${res.stderr.slice(-300).trim()}`);
  }
  return dst;
}

export async function probe(filePath: string): Promise<ProbeInfo> {
  const res = await run(
    bin("ffprobe"),
    [
      "-v",
      "error",
      "-select_streams",
      "v:0",
      "-show_entries",
      "format=duration:stream=width,height",
      "-of",
      "json",
      filePath,
    ],
    { timeoutMs: 60000 }
  );
  if (res.code !== 0) {
    throw new Error(`ffprobe failed: ${res.stderr.slice(-400).trim()}`);
  }
  let parsed: any;
  try {
    parsed = JSON.parse(res.stdout);
  } catch {
    throw new Error("ffprobe returned unparseable output");
  }
  const stream = parsed.streams?.[0] ?? {};
  const durationSec = Number(parsed.format?.duration ?? 0);
  return {
    durationSec: Number.isFinite(durationSec) ? durationSec : 0,
    width: Number(stream.width ?? 0),
    height: Number(stream.height ?? 0),
  };
}

function windowSeconds(p: ExtractParams): number {
  const start = p.startSec ?? 0;
  const end = p.endSec && p.endSec > start ? p.endSec : p.durationSec;
  const span = end - start;
  return span > 0 ? span : p.durationSec || 1;
}

function timeArgs(p: ExtractParams): string[] {
  const args: string[] = [];
  if (p.startSec && p.startSec > 0) args.push("-ss", String(p.startSec));
  if (p.endSec && p.endSec > (p.startSec ?? 0)) {
    args.push("-to", String(p.endSec));
  }
  return args;
}

/**
 * Extract visual context from the video. `sheet`/`scenes` tile frames into
 * montage images to minimize the number of images an agent reads; `frames`
 * emits individual stills; `filmstrip` stacks dense near-native-fps frames into
 * a tall vertical strip for spotting transient UI glitches. An optional `crop`
 * zooms into a region first, and `fps` overrides the auto sampling rate.
 */
export async function extract(p: ExtractParams): Promise<ExtractResult> {
  await fs.mkdir(p.outDir, { recursive: true });
  const span = windowSeconds(p);
  const ext = FORMAT_EXT[p.format];
  const q = FORMAT_QUALITY[p.format];
  const crop = cropPrefix(p);

  if (p.mode === "scenes") {
    const vf = `${crop}select='gt(scene,${p.sceneThreshold})',scale=${p.scale}:-2,tile=${p.grid}x${p.grid}`;
    const pattern = path.join(p.outDir, `scene_%03d.${ext}`);
    const args = [
      ...timeArgs(p),
      "-i",
      p.filePath,
      "-vf",
      vf,
      "-frames:v",
      String(Math.ceil(p.maxFrames / (p.grid * p.grid)) || 1),
      "-fps_mode",
      "vfr",
      ...q,
      "-y",
      pattern,
    ];
    const res = await run(bin("ffmpeg"), args, { timeoutMs: 8 * 60 * 1000 });
    if (res.code !== 0) {
      throw new Error(`ffmpeg (scenes) failed: ${res.stderr.slice(-400).trim()}`);
    }
    const images = await listImages(p.outDir, ext);
    return { images, frameCount: images.length, effectiveFps: null };
  }

  const targetFrames = Math.max(1, p.maxFrames);
  // When the duration is unknown (live streams, some VFR files) and no explicit
  // window/fps is given, fall back to 1 fps so frames spread across the stream
  // instead of all landing in the first second.
  const knownSpan =
    p.durationSec > 0 || (p.endSec !== undefined && p.endSec > (p.startSec ?? 0));
  const fps = p.fps && p.fps > 0 ? p.fps : knownSpan ? targetFrames / span : 1;

  if (p.mode === "filmstrip") {
    const rows = p.stripRows ?? 18;
    const strips = Math.max(1, Math.ceil(targetFrames / rows));
    const vf = `${crop}fps=${fps.toFixed(6)},scale=${p.scale}:-2,tile=1x${rows}`;
    const pattern = path.join(p.outDir, `strip_%03d.${ext}`);
    const args = [
      ...timeArgs(p),
      "-i",
      p.filePath,
      "-vf",
      vf,
      "-frames:v",
      String(strips),
      "-fps_mode",
      "vfr",
      ...q,
      "-y",
      pattern,
    ];
    const res = await run(bin("ffmpeg"), args, { timeoutMs: 8 * 60 * 1000 });
    if (res.code !== 0) {
      throw new Error(`ffmpeg (filmstrip) failed: ${res.stderr.slice(-400).trim()}`);
    }
    const images = await listImages(p.outDir, ext);
    return { images, frameCount: images.length, effectiveFps: fps };
  }

  if (p.mode === "frames") {
    const vf = `${crop}fps=${fps.toFixed(6)},scale=${p.scale}:-2`;
    const pattern = path.join(p.outDir, `frame_%04d.${ext}`);
    const args = [
      ...timeArgs(p),
      "-i",
      p.filePath,
      "-vf",
      vf,
      "-frames:v",
      String(targetFrames),
      ...q,
      "-y",
      pattern,
    ];
    const res = await run(bin("ffmpeg"), args, { timeoutMs: 8 * 60 * 1000 });
    if (res.code !== 0) {
      throw new Error(`ffmpeg (frames) failed: ${res.stderr.slice(-400).trim()}`);
    }
    const images = await listImages(p.outDir, ext);
    return { images, frameCount: images.length, effectiveFps: fps };
  }

  const perSheet = p.grid * p.grid;
  const sheets = Math.max(1, Math.ceil(targetFrames / perSheet));
  const vf = `${crop}fps=${fps.toFixed(6)},scale=${p.scale}:-2,tile=${p.grid}x${p.grid}`;
  const pattern = path.join(p.outDir, `sheet_%03d.${ext}`);
  const args = [
    ...timeArgs(p),
    "-i",
    p.filePath,
    "-vf",
    vf,
    "-frames:v",
    String(sheets),
    "-fps_mode",
    "vfr",
    ...q,
    "-y",
    pattern,
  ];
  const res = await run(bin("ffmpeg"), args, { timeoutMs: 8 * 60 * 1000 });
  if (res.code !== 0) {
    throw new Error(`ffmpeg (sheet) failed: ${res.stderr.slice(-400).trim()}`);
  }
  const images = await listImages(p.outDir, ext);
  return { images, frameCount: images.length, effectiveFps: fps };
}

/** ffmpeg `crop=w:h:x:y,` prefix, or empty when no crop requested. */
function cropPrefix(p: ExtractParams): string {
  return p.crop ? `crop=${p.crop.width}:${p.crop.height}:${p.crop.x}:${p.crop.y},` : "";
}

async function listImages(dir: string, ext: string): Promise<string[]> {
  const files = await fs.readdir(dir);
  return files
    .filter((f) => f.toLowerCase().endsWith(`.${ext}`))
    .sort()
    .map((f) => path.join(dir, f));
}
