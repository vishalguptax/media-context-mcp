import path from "node:path";
import { run } from "../system/exec.js";
import { bin } from "../system/bins.js";

export interface OcrOptions {
  lang: string;
  /** Tesseract page segmentation mode (3 = auto, 6 = uniform block, 11 = sparse). */
  psm: number;
  /** Scratch directory for preprocessed copies. */
  workDir: string;
}

/**
 * Run OCR over already-extracted frames and return their on-screen text.
 *
 * Each frame is preprocessed (upscaled when small, then sharpened) so faint UI
 * text reaches the size Tesseract's LSTM engine reads best, then recognized with
 * tuned flags. Frames whose text matches the previous frame are dropped, so a
 * mostly-static screen recording collapses to just the moments text changes —
 * far cheaper than asking a model to read every tile.
 */
export async function ocrImages(paths: string[], opts: OcrOptions): Promise<string> {
  const blocks: string[] = [];
  let previous = "";

  for (let i = 0; i < paths.length; i++) {
    const prepped = await preprocess(paths[i], opts.workDir, i);
    const res = await run(
      bin("tesseract"),
      [
        prepped,
        "stdout",
        "-l",
        opts.lang,
        "--oem",
        "1",
        "--psm",
        String(opts.psm),
        "--dpi",
        "300",
        "-c",
        "preserve_interword_spaces=1",
      ],
      { timeoutMs: 2 * 60 * 1000 }
    );
    if (res.code !== 0) {
      throw new Error(`tesseract failed: ${res.stderr.slice(-300).trim()}`);
    }
    const text = res.stdout
      .replace(/\r/g, "")
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
    if (!text || text === previous) continue;
    blocks.push(`[frame ${i + 1}]\n${text}`);
    previous = text;
  }

  return blocks.join("\n\n");
}

/**
 * Normalize a frame for OCR: upscale to at least 1600px wide (only when smaller,
 * to avoid degrading already-large captures) with Lanczos, then a light unsharp
 * to crisp glyph edges. Returns the original path if preprocessing fails so OCR
 * still proceeds.
 */
async function preprocess(src: string, workDir: string, index: number): Promise<string> {
  const dst = path.join(workDir, `ocr_${String(index).padStart(4, "0")}.png`);
  const vf = "scale='if(lt(iw,1600),1600,iw)':-2:flags=lanczos,unsharp=3:3:1.0";
  const res = await run(
    bin("ffmpeg"),
    ["-i", src, "-vf", vf, "-frames:v", "1", "-y", dst],
    { timeoutMs: 60 * 1000 }
  );
  return res.code === 0 ? dst : src;
}
