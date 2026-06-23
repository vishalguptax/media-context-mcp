import { promises as fs } from "node:fs";
import path from "node:path";
import { run } from "../system/exec.js";
import { bin } from "../system/bins.js";
import type { ProbeInfo, ExtractParams, ExtractResult } from "../types.js";

export type { ProbeInfo, Mode, ExtractParams, ExtractResult } from "../types.js";

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
 * Extract visual context from the video. `sheet` and `scenes` tile frames into
 * montage images to minimize the number of images an agent must read; `frames`
 * emits individual stills.
 */
export async function extract(p: ExtractParams): Promise<ExtractResult> {
  await fs.mkdir(p.outDir, { recursive: true });
  const span = windowSeconds(p);
  const ext = formatExt(p.format);
  const q = qualityArgs(p.format);

  if (p.mode === "scenes") {
    const vf = `select='gt(scene,${p.sceneThreshold})',scale=${p.scale}:-2,tile=${p.grid}x${p.grid}`;
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
  const fps = targetFrames / span;

  if (p.mode === "frames") {
    const vf = `fps=${fps.toFixed(6)},scale=${p.scale}:-2`;
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
  const vf = `fps=${fps.toFixed(6)},scale=${p.scale}:-2,tile=${p.grid}x${p.grid}`;
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

function formatExt(format: ExtractParams["format"]): string {
  return format === "jpeg" ? "jpg" : format;
}

/** Encoder quality flags tuned for small files without visible degradation. */
function qualityArgs(format: ExtractParams["format"]): string[] {
  switch (format) {
    case "webp":
      return ["-quality", "80"];
    case "jpeg":
      return ["-q:v", "4"];
    case "png":
      return [];
  }
}

async function listImages(dir: string, ext: string): Promise<string[]> {
  const files = await fs.readdir(dir);
  return files
    .filter((f) => f.toLowerCase().endsWith(`.${ext}`))
    .sort()
    .map((f) => path.join(dir, f));
}
