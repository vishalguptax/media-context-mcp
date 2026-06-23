import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { promises as fs } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { run } from "../dist/system/exec.js";
import { checkDeps } from "../dist/system/deps.js";
import { analyzeMedia, AnalyzeError } from "../dist/core.js";

const deps = await checkDeps();
const analyzeVideo = analyzeMedia;

describe.skipIf(!deps.ffmpeg || !deps.ffprobe)("analyzeMedia — video (library API)", () => {
  let dir: string;
  let clip: string;

  beforeAll(async () => {
    dir = await fs.mkdtemp(path.join(tmpdir(), "vc-core-test-"));
    clip = path.join(dir, "clip.mp4");
    await run("ffmpeg", [
      "-y",
      "-f",
      "lavfi",
      "-i",
      "testsrc=duration=6:size=320x240:rate=12",
      "-pix_fmt",
      "yuv420p",
      clip,
    ]);
  });

  afterAll(async () => {
    await fs.rm(dir, { recursive: true, force: true });
  });

  it("returns base64 images and a structured summary for a local file", async () => {
    const r = await analyzeVideo({ source: clip, mode: "sheet", maxFrames: 12, grid: 3, scale: 200 });
    expect(r.mediaType).toBe("video");
    expect(r.mode).toBe("sheet");
    expect(r.width).toBe(320);
    expect(r.images.length).toBeGreaterThanOrEqual(1);
    expect(r.images[0].mimeType).toBe("image/webp"); // webp is the token-cheap default
    expect(r.images[0].base64.length).toBeGreaterThan(0);
    expect(r.summary).toContain("Mode: sheet");
    expect(Array.isArray(r.warnings)).toBe(true);
  });

  it("honors an explicit image format and is smaller than png", async () => {
    const webp = await analyzeVideo({ source: clip, mode: "sheet", maxFrames: 9, grid: 3, format: "webp" });
    const png = await analyzeVideo({ source: clip, mode: "sheet", maxFrames: 9, grid: 3, format: "png" });
    expect(webp.images[0].mimeType).toBe("image/webp");
    expect(png.images[0].mimeType).toBe("image/png");
    expect(webp.images[0].base64.length).toBeLessThan(png.images[0].base64.length);
  });

  it("rejects endSec <= startSec via schema validation", async () => {
    await expect(
      analyzeVideo({ source: clip, startSec: 5, endSec: 2 })
    ).rejects.toThrow(/endSec/);
  });

  it("detail:high switches to readable stills (frames + png)", async () => {
    const r = await analyzeVideo({ source: clip, detail: "high", maxFrames: 4 });
    expect(r.mode).toBe("frames");
    expect(r.images[0].mimeType).toBe("image/png");
  });

  it("echoes caller context into the summary", async () => {
    const r = await analyzeVideo({ source: clip, context: "the signup flow", maxFrames: 4 });
    expect(r.summary).toContain("Context from caller: the signup flow");
  });

  it("accepts a fractional crop and a filmstrip window", async () => {
    const r = await analyzeMedia({
      source: clip,
      mode: "filmstrip",
      fps: 4,
      stripRows: 6,
      crop: { x: 0, y: 0.5, width: 1, height: 0.5 }, // bottom half, as fractions
    });
    expect(r.mode).toBe("filmstrip");
    expect(r.images.length).toBeGreaterThanOrEqual(1);
    expect(r.summary).toContain("Cropped to");
  });

  it("runs the OCR path (returns text or a clear warning)", async () => {
    const r = await analyzeVideo({ source: clip, ocr: true, maxFrames: 4 });
    const ranOcr = r.ocrText !== undefined || r.warnings.some((w) => /OCR/i.test(w));
    expect(ranOcr).toBe(true);
  });

  it("applies defaults when optional fields are omitted", async () => {
    const r = await analyzeVideo({ source: clip });
    expect(r.mode).toBe("sheet");
    expect(r.images.length).toBeGreaterThanOrEqual(1);
  });

  it("throws AnalyzeError for a missing file", async () => {
    await expect(analyzeVideo({ source: path.join(dir, "nope.mp4") })).rejects.toBeInstanceOf(
      AnalyzeError
    );
  });

  it("cleans up: no temp video-context-* dirs leak for this run", async () => {
    await analyzeVideo({ source: clip, maxFrames: 4 });
    const entries = await fs.readdir(tmpdir());
    const leaked = entries.filter((e) => e.startsWith("video-context-"));
    expect(leaked).toEqual([]);
  });
});
