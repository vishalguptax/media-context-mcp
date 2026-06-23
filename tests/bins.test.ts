import { describe, it, expect, afterEach } from "vitest";
import { bin } from "../dist/system/bins.js";

describe("bin", () => {
  afterEach(() => {
    delete process.env.WHISPER_BIN;
    delete process.env.FFMPEG_BIN;
  });

  it("returns the bare command name by default", () => {
    expect(bin("ffmpeg")).toBe("ffmpeg");
    expect(bin("ffprobe")).toBe("ffprobe");
    expect(bin("ytdlp")).toBe("yt-dlp");
    expect(bin("whisper")).toBe("whisper");
  });

  it("honors an environment override", () => {
    process.env.WHISPER_BIN = "C:/py/Scripts/whisper.exe";
    expect(bin("whisper")).toBe("C:/py/Scripts/whisper.exe");
  });

  it("ignores a blank override", () => {
    process.env.FFMPEG_BIN = "   ";
    expect(bin("ffmpeg")).toBe("ffmpeg");
  });
});
