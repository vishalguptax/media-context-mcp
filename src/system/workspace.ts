import { promises as fs } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

/**
 * A single throwaway directory that owns every temp artifact produced for one
 * tool call: downloaded media, extracted frames, transcript output. Disposing
 * it removes everything at once, so no caller has to track individual paths or
 * write into the user's own directories.
 */
export interface Workspace {
  readonly dir: string;
  /** Absolute path to a named subdirectory, created on demand. */
  sub(name: string): Promise<string>;
  /** Remove the whole workspace. Best effort; never throws. */
  dispose(): Promise<void>;
}

export async function createWorkspace(): Promise<Workspace> {
  const dir = await fs.mkdtemp(path.join(tmpdir(), "video-context-"));
  return {
    dir,
    async sub(name: string): Promise<string> {
      const p = path.join(dir, name);
      await fs.mkdir(p, { recursive: true });
      return p;
    },
    async dispose(): Promise<void> {
      try {
        await fs.rm(dir, { recursive: true, force: true });
      } catch {
        /* best effort */
      }
    },
  };
}
