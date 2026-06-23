import { describe, it, expect } from "vitest";
import { checkDeps, installHint } from "../dist/system/deps.js";

describe("checkDeps", () => {
  it("reports a boolean for every known dependency", async () => {
    const deps = await checkDeps();
    expect(typeof deps.ffmpeg).toBe("boolean");
    expect(typeof deps.ffprobe).toBe("boolean");
    expect(typeof deps.ytdlp).toBe("boolean");
    expect(typeof deps.whisper).toBe("boolean");
  });

  it("caches the result across calls", async () => {
    const a = await checkDeps();
    const b = await checkDeps();
    expect(a).toBe(b);
  });
});

describe("installHint", () => {
  it("returns an actionable hint for each dependency", () => {
    for (const dep of ["ffmpeg", "ffprobe", "ytdlp", "whisper"] as const) {
      expect(installHint(dep).length).toBeGreaterThan(0);
    }
  });
});
