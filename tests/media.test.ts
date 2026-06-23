import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { promises as fs } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { run } from "../dist/system/exec.js";
import { checkDeps } from "../dist/system/deps.js";
import { analyzeMedia } from "../dist/core.js";
import { classifyMedia, isImageFile, isAudioFile } from "../dist/pipeline/media.js";

const deps = await checkDeps();

describe("media classification", () => {
  it("recognizes image and audio extensions", () => {
    expect(isImageFile("a/b/shot.PNG")).toBe(true);
    expect(isImageFile("clip.mp4")).toBe(false);
    expect(isAudioFile("podcast.mp3")).toBe(true);
    expect(isAudioFile("clip.mp4")).toBe(false);
  });

  it("classifies by extension then by probed video stream", () => {
    expect(classifyMedia("x.png", { durationSec: 0, width: 100, height: 100 })).toBe("image");
    expect(classifyMedia("x.mp3", { durationSec: 10, width: 0, height: 0 })).toBe("audio");
    expect(classifyMedia("x.mp4", { durationSec: 10, width: 640, height: 480 })).toBe("video");
    expect(classifyMedia("x.mp4", { durationSec: 10, width: 0, height: 0 })).toBe("audio");
  });
});

describe.skipIf(!deps.ffmpeg || !deps.ffprobe)("analyzeMedia — image", () => {
  let dir: string;
  let img: string;

  beforeAll(async () => {
    dir = await fs.mkdtemp(path.join(tmpdir(), "vc-img-test-"));
    img = path.join(dir, "shot.png");
    await run("ffmpeg", ["-y", "-f", "lavfi", "-i", "testsrc=size=400x300:duration=1", "-frames:v", "1", img]);
  });

  afterAll(async () => {
    await fs.rm(dir, { recursive: true, force: true });
  });

  it("returns a single display image and no frames", async () => {
    const r = await analyzeMedia({ source: img, scale: 200 });
    expect(r.mediaType).toBe("image");
    expect(r.images.length).toBe(1);
    expect(r.totalImages).toBe(1);
    expect(r.effectiveFps).toBeNull();
    expect(r.summary).toContain("Media: image");
  });
});

describe.skipIf(!deps.ffmpeg || !deps.ffprobe)("analyzeMedia — audio", () => {
  let dir: string;
  let audio: string;

  beforeAll(async () => {
    dir = await fs.mkdtemp(path.join(tmpdir(), "vc-audio-test-"));
    audio = path.join(dir, "tone.mp3");
    await run("ffmpeg", ["-y", "-f", "lavfi", "-i", "sine=frequency=440:duration=2", audio]);
  });

  afterAll(async () => {
    await fs.rm(dir, { recursive: true, force: true });
  });

  it("classifies as audio and returns no images", async () => {
    if (!deps.whisper) {
      // Without whisper there's nothing to extract from audio: must error clearly.
      await expect(analyzeMedia({ source: audio })).rejects.toThrow(/whisper/i);
      return;
    }
    const r = await analyzeMedia({ source: audio });
    expect(r.mediaType).toBe("audio");
    expect(r.images.length).toBe(0);
    expect(r.summary).toContain("Media: audio");
  });
});
