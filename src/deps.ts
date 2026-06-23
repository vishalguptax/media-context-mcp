import { exists } from "./exec.js";

export interface DepStatus {
  ffmpeg: boolean;
  ffprobe: boolean;
  ytdlp: boolean;
  whisper: boolean;
}

let cached: DepStatus | null = null;

export async function checkDeps(): Promise<DepStatus> {
  if (cached) return cached;
  const [ffmpeg, ffprobe, ytdlp, whisper] = await Promise.all([
    exists("ffmpeg", "-version"),
    exists("ffprobe", "-version"),
    exists("yt-dlp", "--version"),
    exists("whisper", "--help"),
  ]);
  cached = { ffmpeg, ffprobe, ytdlp, whisper };
  return cached;
}

export function installHint(dep: keyof DepStatus): string {
  switch (dep) {
    case "ffmpeg":
    case "ffprobe":
      return "Install ffmpeg (bundles ffprobe): https://ffmpeg.org/download.html — winget install Gyan.FFmpeg | brew install ffmpeg | apt install ffmpeg";
    case "ytdlp":
      return "Install yt-dlp to analyze URLs: https://github.com/yt-dlp/yt-dlp — pip install -U yt-dlp | winget install yt-dlp.yt-dlp | brew install yt-dlp";
    case "whisper":
      return "Install OpenAI Whisper for transcripts: pip install -U openai-whisper (requires ffmpeg)";
  }
}
