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
    .describe("Local media file path (video, audio, or image) OR an http(s) URL."),
  context: z
    .string()
    .max(4000)
    .optional()
    .describe("Optional note about the video to frame the analysis, e.g. 'signup flow, focus on the validation error'."),
  detail: z
    .enum(["low", "high"])
    .optional()
    .describe("high = readable stills for screen recordings (frames + large scale + png); low = cheap montage. Overrides only the fields you leave unset."),
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
  ocr: z
    .boolean()
    .default(false)
    .describe("Extract on-screen text via OCR — ideal for app/screen recordings. Implies detail:high unless set."),
  ocrLang: z
    .string()
    .default("eng")
    .describe("Tesseract language code(s) for OCR, e.g. 'eng' or 'eng+deu'."),
  ocrPsm: z
    .number()
    .int()
    .min(0)
    .max(13)
    .default(3)
    .describe("Tesseract page-segmentation mode. 3 = auto (default), 6 = uniform block, 11 = sparse/scattered UI labels."),
  ocrMaxFrames: z
    .number()
    .int()
    .min(1)
    .max(60)
    .default(12)
    .describe("Frames to OCR (sampled at full resolution, independent of the display images)."),
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
