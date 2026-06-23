/**
 * Resolves the executable to invoke for each external dependency.
 *
 * Resolution order: an explicit `*_BIN` env override, then well-known install
 * locations (so a GUI-launched client with a minimal PATH still finds tools
 * that `setup` installed off-PATH — e.g. Tesseract in Program Files or Whisper
 * in a Python Scripts dir), then the bare command name from PATH.
 */
import { existsSync, readdirSync } from "node:fs";
import path from "node:path";
import type { BinName } from "../types.js";

export type { BinName } from "../types.js";

const ENV_KEYS = {
  ffmpeg: "FFMPEG_BIN",
  ffprobe: "FFPROBE_BIN",
  ytdlp: "YTDLP_BIN",
  whisper: "WHISPER_BIN",
  tesseract: "TESSERACT_BIN",
} as const;

const DEFAULTS = {
  ffmpeg: "ffmpeg",
  ffprobe: "ffprobe",
  ytdlp: "yt-dlp",
  whisper: "whisper",
  tesseract: "tesseract",
} as const;

export function bin(name: BinName): string {
  const override = process.env[ENV_KEYS[name]];
  if (override && override.trim()) return override.trim();

  for (const candidate of candidates(name)) {
    if (existsSync(candidate)) return candidate;
  }
  return DEFAULTS[name];
}

/** Known absolute install locations to probe (Windows only; PATH covers *nix). */
function candidates(name: BinName): string[] {
  if (process.platform !== "win32") return [];

  const programFiles = process.env.ProgramFiles ?? "C:\\Program Files";
  const programFiles86 = process.env["ProgramFiles(x86)"] ?? "C:\\Program Files (x86)";
  const local = process.env.LOCALAPPDATA ?? "";
  const wingetLinks = local && path.join(local, "Microsoft", "WinGet", "Links");

  switch (name) {
    case "ffmpeg":
      return wingetLinks ? [path.join(wingetLinks, "ffmpeg.exe")] : [];
    case "ffprobe":
      return wingetLinks ? [path.join(wingetLinks, "ffprobe.exe")] : [];
    case "ytdlp":
      return wingetLinks ? [path.join(wingetLinks, "yt-dlp.exe")] : [];
    case "tesseract":
      return [
        path.join(programFiles, "Tesseract-OCR", "tesseract.exe"),
        path.join(programFiles86, "Tesseract-OCR", "tesseract.exe"),
      ];
    case "whisper":
      return pythonScriptDirs().map((d) => path.join(d, "whisper.exe"));
  }
}

/** Discover `Scripts` dirs of installed Python versions (where pip console scripts land). */
function pythonScriptDirs(): string[] {
  const local = process.env.LOCALAPPDATA;
  if (!local) return [];
  const root = path.join(local, "Programs", "Python");
  try {
    return readdirSync(root)
      .filter((e) => e.startsWith("Python"))
      .map((e) => path.join(root, e, "Scripts"));
  } catch {
    return [];
  }
}
