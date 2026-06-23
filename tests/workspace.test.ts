import { describe, it, expect } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";
import { createWorkspace } from "../dist/workspace.js";

describe("createWorkspace", () => {
  it("creates an isolated directory and removes it on dispose", async () => {
    const ws = await createWorkspace();
    const stat = await fs.stat(ws.dir);
    expect(stat.isDirectory()).toBe(true);

    await ws.dispose();
    await expect(fs.stat(ws.dir)).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("creates named subdirectories on demand", async () => {
    const ws = await createWorkspace();
    try {
      const sub = await ws.sub("frames");
      expect(sub).toBe(path.join(ws.dir, "frames"));
      const stat = await fs.stat(sub);
      expect(stat.isDirectory()).toBe(true);

      await fs.writeFile(path.join(sub, "a.txt"), "x");
      await ws.sub("frames");
      expect(await fs.readFile(path.join(sub, "a.txt"), "utf8")).toBe("x");
    } finally {
      await ws.dispose();
    }
  });

  it("dispose never throws even when called twice", async () => {
    const ws = await createWorkspace();
    await ws.dispose();
    await expect(ws.dispose()).resolves.toBeUndefined();
  });
});
