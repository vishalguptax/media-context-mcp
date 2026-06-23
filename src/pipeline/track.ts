import path from "node:path";
import { run } from "../system/exec.js";
import { bin } from "../system/bins.js";

export interface ValuePoint {
  index: number;
  timeSec: number;
  value: number;
}

export interface Anomaly {
  timeSec: number;
  value: number;
  /** Neighbouring values that make this point a reversal. */
  from: number;
  to: number;
}

export interface TrackOptions {
  startSec: number;
  fps: number;
  lang: string;
  workDir: string;
}

/**
 * Read the numeric value shown on each frame (e.g. a slider's "68%") and return
 * it as a time series. Frames are preprocessed and OCR'd with a digit whitelist
 * so a percentage or counter is recovered reliably.
 */
export async function trackValues(paths: string[], opts: TrackOptions): Promise<ValuePoint[]> {
  const points: ValuePoint[] = [];
  for (let i = 0; i < paths.length; i++) {
    const prepped = await preprocess(paths[i], opts.workDir, i);
    const res = await run(
      bin("tesseract"),
      [
        prepped,
        "stdout",
        "-l",
        opts.lang,
        "--psm",
        "6",
        "-c",
        "tessedit_char_whitelist=0123456789.%",
      ],
      { timeoutMs: 60 * 1000 }
    );
    if (res.code !== 0) continue;
    const match = res.stdout.match(/(\d+(?:\.\d+)?)/);
    if (!match) continue;
    points.push({
      index: i,
      timeSec: opts.startSec + i / opts.fps,
      value: Number(match[1]),
    });
  }
  return points;
}

/**
 * Flag points where the tracked value reverses direction then reverses back —
 * the signature of a "jumps back before settling" glitch. `minDelta` ignores
 * small OCR jitter.
 */
export function findAnomalies(points: ValuePoint[], minDelta = 5): Anomaly[] {
  const out: Anomaly[] = [];
  for (let i = 1; i < points.length - 1; i++) {
    const a = points[i - 1].value;
    const b = points[i].value;
    const c = points[i + 1].value;
    const up = b - a;
    const down = c - b;
    if (Math.sign(up) !== Math.sign(down) && up !== 0 && down !== 0) {
      if (Math.min(Math.abs(up), Math.abs(down)) >= minDelta) {
        out.push({ timeSec: points[i].timeSec, value: b, from: a, to: c });
      }
    }
  }
  return out;
}

async function preprocess(src: string, workDir: string, index: number): Promise<string> {
  const dst = path.join(workDir, `track_${String(index).padStart(4, "0")}.png`);
  const vf = "scale='if(lt(iw,1600),1600,iw)':-2:flags=lanczos,unsharp=3:3:1.0";
  const res = await run(
    bin("ffmpeg"),
    ["-i", src, "-vf", vf, "-frames:v", "1", "-y", dst],
    { timeoutMs: 60 * 1000 }
  );
  return res.code === 0 ? dst : src;
}
