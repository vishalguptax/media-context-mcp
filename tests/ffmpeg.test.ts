import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { promises as fs } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { run } from "../dist/system/exec.js";
import { checkDeps } from "../dist/system/deps.js";
import { probe, extract } from "../dist/pipeline/ffmpeg.js";

const deps = await checkDeps();

// Integration tests need the real ffmpeg/ffprobe binaries; skip cleanly without.
describe.skipIf(!deps.ffmpeg || !deps.ffprobe)("ffmpeg integration", () => {
  let dir: string;
  let clip: string;

  beforeAll(async () => {
    dir = await fs.mkdtemp(path.join(tmpdir(), "vc-ffmpeg-test-"));
    clip = path.join(dir, "clip.mp4");
    const res = await run("ffmpeg", [
      "-y",
      "-f",
      "lavfi",
      "-i",
      "testsrc=duration=8:size=320x240:rate=15",
      "-pix_fmt",
      "yuv420p",
      clip,
    ]);
    expect(res.code).toBe(0);
  });

  afterAll(async () => {
    await fs.rm(dir, { recursive: true, force: true });
  });

  it("probes duration and resolution", async () => {
    const info = await probe(clip);
    expect(info.durationSec).toBeGreaterThan(7);
    expect(info.durationSec).toBeLessThan(9);
    expect(info.width).toBe(320);
    expect(info.height).toBe(240);
  });

  it("produces at least one montage in sheet mode", async () => {
    const out = path.join(dir, "sheet");
    const r = await extract({
      filePath: clip,
      outDir: out,
      mode: "sheet",
      format: "png",
      scale: 160,
      maxFrames: 16,
      grid: 4,
      sceneThreshold: 0.4,
      durationSec: 8,
    });
    expect(r.images.length).toBeGreaterThanOrEqual(1);
    for (const img of r.images) {
      const stat = await fs.stat(img);
      expect(stat.size).toBeGreaterThan(0);
    }
  });

  it("honors maxFrames in frames mode", async () => {
    const out = path.join(dir, "frames");
    const r = await extract({
      filePath: clip,
      outDir: out,
      mode: "frames",
      format: "png",
      scale: 160,
      maxFrames: 6,
      grid: 4,
      sceneThreshold: 0.4,
      durationSec: 8,
    });
    expect(r.images.length).toBeGreaterThan(0);
    expect(r.images.length).toBeLessThanOrEqual(6);
    expect(r.effectiveFps).toBeCloseTo(6 / 8, 5);
  });

  it("does not error when scene detection finds no cuts", async () => {
    const out = path.join(dir, "scenes");
    const r = await extract({
      filePath: clip,
      outDir: out,
      mode: "scenes",
      format: "png",
      scale: 160,
      maxFrames: 16,
      grid: 4,
      sceneThreshold: 0.6,
      durationSec: 8,
    });
    expect(Array.isArray(r.images)).toBe(true);
  });
});
