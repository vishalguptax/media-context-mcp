import { exists } from "./exec.js";
import { bin } from "./bins.js";
import type { DepStatus } from "../types.js";

export type { DepStatus } from "../types.js";

let cached: DepStatus | null = null;

export async function checkDeps(): Promise<DepStatus> {
  if (cached) return cached;
  const [ffmpeg, ffprobe, ytdlp, whisper, tesseract] = await Promise.all([
    exists(bin("ffmpeg"), "-version"),
    exists(bin("ffprobe"), "-version"),
    exists(bin("ytdlp"), "--version"),
    exists(bin("whisper"), "--help"),
    exists(bin("tesseract"), "--version"),
  ]);
  cached = { ffmpeg, ffprobe, ytdlp, whisper, tesseract };
  return cached;
}

export function installHint(dep: "ffmpeg" | "ffprobe" | "ytdlp" | "whisper" | "tesseract"): string {
  switch (dep) {
    case "ffmpeg":
    case "ffprobe":
      return "Install ffmpeg (bundles ffprobe): https://ffmpeg.org/download.html — winget install Gyan.FFmpeg | brew install ffmpeg | apt install ffmpeg";
    case "ytdlp":
      return "Install yt-dlp to analyze URLs: https://github.com/yt-dlp/yt-dlp — pip install -U yt-dlp | winget install yt-dlp.yt-dlp | brew install yt-dlp";
    case "whisper":
      return "Install OpenAI Whisper for transcripts: pip install -U openai-whisper (requires ffmpeg)";
    case "tesseract":
      return "Install Tesseract for OCR: https://github.com/tesseract-ocr/tesseract — winget install UB-Mannheim.TesseractOCR | brew install tesseract | apt install tesseract-ocr";
  }
}
