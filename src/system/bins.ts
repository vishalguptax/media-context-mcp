/**
 * Resolves the executable to invoke for each external dependency. Defaults to
 * the bare command name (found on PATH), but every binary can be overridden
 * with an absolute path via an environment variable. This matters because MCP
 * clients are frequently launched from a GUI with a minimal PATH that omits,
 * for example, a Python Scripts directory where whisper lives.
 */
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
  return override && override.trim() ? override.trim() : DEFAULTS[name];
}
