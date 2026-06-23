import { promises as fs } from "node:fs";
import path from "node:path";
import { run } from "../system/exec.js";
import { checkDeps, installHint } from "../system/deps.js";
import { bin } from "../system/bins.js";
import type { TranscriptResult } from "../types.js";

export type { TranscriptResult } from "../types.js";

/**
 * Transcribe audio with OpenAI Whisper (local CLI). Off by default in the tool;
 * only invoked when the caller opts in.
 */
export async function transcribe(
  filePath: string,
  outDir: string,
  model = "small"
): Promise<TranscriptResult> {
  const deps = await checkDeps();
  if (!deps.whisper) {
    throw new Error(`transcript requested but whisper is not installed. ${installHint("whisper")}`);
  }

  const res = await run(
    bin("whisper"),
    [
      filePath,
      "--model",
      model,
      "--output_format",
      "txt",
      "--output_dir",
      outDir,
      "--verbose",
      "False",
    ],
    { timeoutMs: 30 * 60 * 1000 }
  );
  if (res.code !== 0) {
    throw new Error(`whisper failed: ${res.stderr.slice(-400).trim()}`);
  }

  const base = path.basename(filePath, path.extname(filePath));
  const txtPath = path.join(outDir, `${base}.txt`);
  try {
    const text = await fs.readFile(txtPath, "utf8");
    return { text: text.trim(), model };
  } catch {
    const files = await fs.readdir(outDir);
    const fallback = files.find((f) => f.endsWith(".txt"));
    if (fallback) {
      const text = await fs.readFile(path.join(outDir, fallback), "utf8");
      return { text: text.trim(), model };
    }
    throw new Error("whisper produced no transcript file");
  }
}
