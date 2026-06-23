import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { promises as fs } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { run } from "../dist/system/exec.js";
import { checkDeps } from "../dist/system/deps.js";
import { analyzeVideo, AnalyzeError } from "../dist/core.js";

const deps = await checkDeps();

describe.skipIf(!deps.ffmpeg || !deps.ffprobe)("analyzeVideo (library API)", () => {
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
    expect(r.mode).toBe("sheet");
    expect(r.width).toBe(320);
    expect(r.images.length).toBeGreaterThanOrEqual(1);
    expect(r.images[0].mimeType).toBe("image/png");
    expect(r.images[0].base64.length).toBeGreaterThan(0);
    expect(r.summary).toContain("Mode: sheet");
    expect(Array.isArray(r.warnings)).toBe(true);
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
