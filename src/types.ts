/**
 * Central contract definitions shared across the package. Behaviour lives in the
 * individual modules; the data shapes that cross module boundaries — and the
 * public library surface — are declared here so consumers have one import site.
 */

/** External binaries the server can drive. */
export type BinName = "ffmpeg" | "ffprobe" | "ytdlp" | "whisper";

/** Availability of each external binary. */
export interface DepStatus {
  ffmpeg: boolean;
  ffprobe: boolean;
  ytdlp: boolean;
  whisper: boolean;
}

/** A user-supplied source resolved to a local file. */
export interface ResolvedSource {
  filePath: string;
  origin: string;
  downloaded: boolean;
}

/** Probed media metadata. */
export interface ProbeInfo {
  durationSec: number;
  width: number;
  height: number;
}

/** Frame-extraction strategy. */
export type Mode = "sheet" | "frames" | "scenes";

/** Encoded image format. webp is smallest (fewest tokens), png is lossless. */
export type ImageFormat = "webp" | "jpeg" | "png";

/** Low-level extraction request handed to ffmpeg. */
export interface ExtractParams {
  filePath: string;
  outDir: string;
  mode: Mode;
  format: ImageFormat;
  scale: number;
  maxFrames: number;
  grid: number;
  sceneThreshold: number;
  startSec?: number;
  endSec?: number;
  durationSec: number;
}

/** Result of a frame extraction. */
export interface ExtractResult {
  images: string[];
  frameCount: number;
  effectiveFps: number | null;
}

/** A produced speech transcript. */
export interface TranscriptResult {
  text: string;
  model: string;
}

/** Public options for {@link analyzeVideo}. All but `source` are optional. */
export interface AnalyzeOptions {
  source: string;
  mode?: Mode;
  format?: ImageFormat;
  maxFrames?: number;
  grid?: number;
  scale?: number;
  sceneThreshold?: number;
  startSec?: number;
  endSec?: number;
  transcript?: boolean;
  whisperModel?: string;
  maxDurationSec?: number;
  maxFileSizeMb?: number;
}

/** A single returned image, encoded for transport-agnostic consumption. */
export interface AnalyzeImage {
  mimeType: string;
  base64: string;
}

/** Structured result of {@link analyzeVideo}, independent of any transport. */
export interface AnalyzeResult {
  summary: string;
  mode: Mode;
  durationSec: number;
  width: number;
  height: number;
  effectiveFps: number | null;
  images: AnalyzeImage[];
  totalImages: number;
  transcript?: TranscriptResult;
  warnings: string[];
}
