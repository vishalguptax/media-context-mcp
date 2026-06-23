import { describe, it, expect } from "vitest";
import { run, exists } from "../dist/system/exec.js";

describe("run", () => {
  it("captures stdout and exit code from a successful command", async () => {
    const res = await run(process.execPath, ["-e", "process.stdout.write('hello')"]);
    expect(res.code).toBe(0);
    expect(res.stdout).toBe("hello");
  });

  it("captures a non-zero exit code without rejecting", async () => {
    const res = await run(process.execPath, ["-e", "process.exit(3)"]);
    expect(res.code).toBe(3);
  });

  it("rejects with a clear message when the binary is missing", async () => {
    await expect(run("definitely-not-a-real-binary-xyz", [])).rejects.toThrow(
      /binary not found/
    );
  });

  it("kills and rejects when a command exceeds the timeout", async () => {
    await expect(
      run(process.execPath, ["-e", "setTimeout(() => {}, 10000)"], { timeoutMs: 250 })
    ).rejects.toThrow(/timed out/);
  });
});

describe("exists", () => {
  it("returns true for a resolvable binary", async () => {
    expect(await exists(process.execPath, "--version")).toBe(true);
  });

  it("returns false for a missing binary", async () => {
    expect(await exists("definitely-not-a-real-binary-xyz")).toBe(false);
  });
});
