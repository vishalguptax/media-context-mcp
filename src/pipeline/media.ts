import path from "node:path";
import type { MediaType, ProbeInfo } from "../types.js";

const IMAGE_EXT = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".webp",
  ".bmp",
  ".tif",
  ".tiff",
  ".heic",
]);

const AUDIO_EXT = new Set([
  ".mp3",
  ".wav",
  ".m4a",
  ".aac",
  ".flac",
  ".ogg",
  ".oga",
  ".opus",
  ".wma",
  ".aiff",
  ".aif",
]);

export function isImageFile(filePath: string): boolean {
  return IMAGE_EXT.has(path.extname(filePath).toLowerCase());
}

export function isAudioFile(filePath: string): boolean {
  return AUDIO_EXT.has(path.extname(filePath).toLowerCase());
}

/**
 * Decide how to treat a resolved local file. Images are recognized by extension
 * (ffprobe would otherwise report them as a single-frame video); everything else
 * is classified by whether probing found a real video stream, so audio files and
 * audio-only downloads fall through to the transcript path.
 */
export function classifyMedia(filePath: string, info: ProbeInfo | null): MediaType {
  if (isImageFile(filePath)) return "image";
  if (isAudioFile(filePath)) return "audio";
  if (info && info.width > 0 && info.height > 0) return "video";
  return "audio";
}

const IMAGE_MIME: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".bmp": "image/bmp",
  ".tif": "image/tiff",
  ".tiff": "image/tiff",
  ".heic": "image/heic",
};

export function imageMime(filePath: string): string {
  return IMAGE_MIME[path.extname(filePath).toLowerCase()] ?? "image/png";
}
