/**
 * Public library surface. Import from "video-context-mcp" to use the analyzer
 * directly, without the MCP transport:
 *
 *   import { analyzeVideo } from "video-context-mcp";
 *   const { summary, images } = await analyzeVideo({ source: "clip.mp4" });
 */
export { analyzeVideo, AnalyzeError, MAX_IMAGES, MAX_TRANSCRIPT_CHARS } from "./core.js";
export { createServer } from "./server.js";
export { checkDeps, installHint } from "./system/deps.js";
export { bin } from "./system/bins.js";
export { isUrl } from "./pipeline/source.js";
export type * from "./types.js";
