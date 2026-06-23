import { run } from "../system/exec.js";
import { bin } from "../system/bins.js";

/**
 * Run OCR over already-extracted frames and return their on-screen text. Frames
 * whose text is identical to the previous frame are dropped, so a mostly-static
 * screen recording collapses to just the moments where the text changes — far
 * cheaper than asking a model to read every tile.
 */
export async function ocrImages(paths: string[], lang = "eng"): Promise<string> {
  const blocks: string[] = [];
  let previous = "";

  for (let i = 0; i < paths.length; i++) {
    const res = await run(bin("tesseract"), [paths[i], "stdout", "-l", lang], {
      timeoutMs: 2 * 60 * 1000,
    });
    if (res.code !== 0) {
      throw new Error(`tesseract failed: ${res.stderr.slice(-300).trim()}`);
    }
    const text = res.stdout.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
    if (!text || text === previous) continue;
    blocks.push(`[frame ${i + 1}]\n${text}`);
    previous = text;
  }

  return blocks.join("\n\n");
}
