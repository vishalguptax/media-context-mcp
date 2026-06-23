import { describe, it, expect, afterEach } from "vitest";
import { bin } from "../dist/system/bins.js";

describe("bin", () => {
  afterEach(() => {
    delete process.env.WHISPER_BIN;
    delete process.env.FFMPEG_BIN;
  });

  it("returns the bare name or a detected install path by default", () => {
    // Without an override it's either the bare command (PATH) or an absolute
    // path to a known install location — both end in the tool's name.
    expect(bin("ffmpeg")).toMatch(/ffmpeg(\.exe)?$/);
    expect(bin("ffprobe")).toMatch(/ffprobe(\.exe)?$/);
    expect(bin("ytdlp")).toMatch(/yt-dlp(\.exe)?$/);
    expect(bin("whisper")).toMatch(/whisper(\.exe)?$/);
  });

  it("honors an environment override", () => {
    process.env.WHISPER_BIN = "C:/py/Scripts/whisper.exe";
    expect(bin("whisper")).toBe("C:/py/Scripts/whisper.exe");
  });

  it("ignores a blank override", () => {
    process.env.FFMPEG_BIN = "   ";
    // Blank override is ignored → falls back to a detected path or the bare name.
    expect(bin("ffmpeg")).toMatch(/ffmpeg(\.exe)?$/);
  });
});
