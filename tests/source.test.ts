import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { promises as fs } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { isUrl, resolveSource } from "../dist/source.js";

describe("isUrl", () => {
  it("recognizes http and https URLs", () => {
    expect(isUrl("http://example.com/v.mp4")).toBe(true);
    expect(isUrl("https://youtu.be/abc")).toBe(true);
    expect(isUrl("  https://x.com/v ")).toBe(true);
  });

  it("treats local paths and other schemes as non-URLs", () => {
    expect(isUrl("C:/videos/clip.mp4")).toBe(false);
    expect(isUrl("/home/user/clip.mp4")).toBe(false);
    expect(isUrl("ftp://host/clip.mp4")).toBe(false);
    expect(isUrl("clip.mp4")).toBe(false);
  });
});

describe("resolveSource (local files)", () => {
  let dir: string;
  let file: string;

  beforeAll(async () => {
    dir = await fs.mkdtemp(path.join(tmpdir(), "vc-src-test-"));
    file = path.join(dir, "clip.mp4");
    await fs.writeFile(file, "not really video but a real file");
  });

  afterAll(async () => {
    await fs.rm(dir, { recursive: true, force: true });
  });

  it("resolves an existing file to an absolute path", async () => {
    const r = await resolveSource(file, dir);
    expect(r.downloaded).toBe(false);
    expect(r.filePath).toBe(path.resolve(file));
  });

  it("rejects a missing file", async () => {
    await expect(resolveSource(path.join(dir, "nope.mp4"), dir)).rejects.toThrow(
      /file not found/
    );
  });

  it("rejects a directory", async () => {
    await expect(resolveSource(dir, dir)).rejects.toThrow(/not a file/);
  });

  it("rejects an empty source", async () => {
    await expect(resolveSource("   ", dir)).rejects.toThrow(/empty/);
  });
});
