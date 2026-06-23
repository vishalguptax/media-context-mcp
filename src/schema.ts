import { z } from "zod";

/**
 * Single source of truth for analyze_video inputs. The raw shape feeds the MCP
 * tool registration (which generates the JSON schema clients see); the compiled
 * object validates direct library calls so both entry points enforce the same
 * rules and defaults.
 */
export const ANALYZE_SHAPE = {
  source: z
    .string()
    .min(1, "source is empty — pass a file path or an http(s) URL")
    .describe("Local video file path OR an http(s) URL to a video."),
  mode: z
    .enum(["sheet", "frames", "scenes"])
    .default("sheet")
    .describe(
      "sheet = montage grids (cheapest, default); frames = individual stills; scenes = only scene-change montages."
    ),
  format: z
    .enum(["webp", "jpeg", "png"])
    .default("webp")
    .describe("Image encoding. webp = smallest/fewest tokens (default); png = lossless for crisp text."),
  maxFrames: z
    .number()
    .int()
    .min(1)
    .max(200)
    .default(30)
    .describe("Upper bound on sampled frames across the whole window."),
  grid: z
    .number()
    .int()
    .min(2)
    .max(8)
    .default(5)
    .describe("Tiles per row/column for sheet/scenes modes (grid x grid)."),
  scale: z
    .number()
    .int()
    .min(120)
    .max(1280)
    .default(320)
    .describe("Width in px of each frame before tiling. Lower = fewer tokens."),
  sceneThreshold: z
    .number()
    .min(0.05)
    .max(0.9)
    .default(0.4)
    .describe("Scene-change sensitivity for 'scenes' mode (higher = fewer cuts)."),
  startSec: z.number().min(0).optional().describe("Window start in seconds."),
  endSec: z.number().min(0).optional().describe("Window end in seconds."),
  transcript: z
    .boolean()
    .default(false)
    .describe("Also run local Whisper to produce a speech transcript."),
  whisperModel: z
    .string()
    .default("small")
    .describe("Whisper model name (tiny, base, small, medium, large)."),
  maxDurationSec: z
    .number()
    .min(1)
    .max(36000)
    .default(3600)
    .describe("Reject URL downloads longer than this many seconds."),
  maxFileSizeMb: z
    .number()
    .min(1)
    .max(8192)
    .default(500)
    .describe("Abort a URL download once it exceeds this size in MB."),
} as const;

export const AnalyzeSchema = z
  .object(ANALYZE_SHAPE)
  .refine((v) => v.endSec === undefined || v.startSec === undefined || v.endSec > v.startSec, {
    message: "endSec must be greater than startSec",
    path: ["endSec"],
  });
