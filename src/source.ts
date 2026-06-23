import { promises as fs } from "node:fs";
import path from "node:path";
import { run } from "./exec.js";
import { checkDeps, installHint } from "./deps.js";
import { bin } from "./bins.js";

export interface ResolvedSource {
  /** Absolute path to a local video file ready for ffmpeg. */
  filePath: string;
  /** Original source string, for logging. */
  origin: string;
  /** True when the file was downloaded from a URL. */
  downloaded: boolean;
}

const URL_RE = /^https?:\/\//i;

export function isUrl(source: string): boolean {
  return URL_RE.test(source.trim());
}

/**
 * Resolve a user-supplied source into a local file path. Local paths are
 * validated in place; URLs are downloaded with yt-dlp into the provided
 * workspace directory, whose lifetime the caller owns.
 */
export async function resolveSource(
  source: string,
  downloadDir: string,
  opts: { maxDurationSec?: number } = {}
): Promise<ResolvedSource> {
  const trimmed = source.trim();
  if (!trimmed) throw new Error("source is empty");

  if (!isUrl(trimmed)) {
    const abs = path.resolve(trimmed);
    let stat;
    try {
      stat = await fs.stat(abs);
    } catch {
      throw new Error(`file not found: ${abs}`);
    }
    if (!stat.isFile()) throw new Error(`not a file: ${abs}`);
    return { filePath: abs, origin: trimmed, downloaded: false };
  }

  const deps = await checkDeps();
  if (!deps.ytdlp) {
    throw new Error(`URL sources need yt-dlp. ${installHint("ytdlp")}`);
  }

  const outTemplate = path.join(downloadDir, "source.%(ext)s");
  const args = [
    "--no-playlist",
    "--no-warnings",
    "-f",
    "bv*[height<=720]+ba/b[height<=720]/b",
    "--merge-output-format",
    "mp4",
  ];
  if (opts.maxDurationSec && opts.maxDurationSec > 0) {
    args.push("--match-filter", `duration<=${opts.maxDurationSec}`);
  }
  args.push("-o", outTemplate, trimmed);

  const res = await run(bin("ytdlp"), args, { timeoutMs: 10 * 60 * 1000 });
  if (res.code !== 0) {
    throw new Error(`yt-dlp failed (${res.code}): ${res.stderr.slice(-600).trim()}`);
  }

  const files = await fs.readdir(downloadDir);
  const downloaded = files.find((f) => f.startsWith("source."));
  if (!downloaded) {
    throw new Error(
      "yt-dlp produced no file (the URL may exceed the duration limit or be unsupported)"
    );
  }

  return {
    filePath: path.join(downloadDir, downloaded),
    origin: trimmed,
    downloaded: true,
  };
}
