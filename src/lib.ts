/**
 * Public library surface. Import from "media-context-mcp" to use the analyzer
 * directly, without the MCP transport:
 *
 *   import { analyzeMedia } from "media-context-mcp";
 *   const { summary, images } = await analyzeMedia({ source: "clip.mp4" });
 *
 * Handles video, audio, and image sources (file path or URL). `analyzeVideo` is
 * kept as a backwards-compatible alias of `analyzeMedia`.
 */
export {
  analyzeMedia,
  analyzeVideo,
  AnalyzeError,
  MAX_IMAGES,
  MAX_TRANSCRIPT_CHARS,
  MAX_OCR_CHARS,
} from "./core.js";
export { createServer } from "./server.js";
export { checkDeps, installHint } from "./system/deps.js";
export { bin } from "./system/bins.js";
export { isUrl } from "./pipeline/source.js";
export { classifyMedia, isImageFile, isAudioFile } from "./pipeline/media.js";
export type * from "./types.js";
