// Quick local smoke test for media-context-mcp.
//
//   node examples/try.mjs <file-or-url> [--ocr] [--transcript] [--detail] [--mode sheet|frames|scenes|filmstrip]
//
// Frames are written to ./out so you can open them. Set WHISPER_BIN / TESSERACT_BIN
// if those binaries aren't on PATH. Run `npm run build` first.
import { promises as fs } from "node:fs";
import path from "node:path";
import { analyzeMedia } from "../dist/lib.js";

const args = process.argv.slice(2);
const source = args.find((a) => !a.startsWith("--"));
if (!source) {
  console.error("usage: node examples/try.mjs <file-or-url> [--ocr] [--transcript] [--detail] [--mode <mode>]");
  process.exit(1);
}
const flag = (name) => args.includes(`--${name}`);
const opt = (name) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};

const result = await analyzeMedia({
  source,
  ocr: flag("ocr"),
  transcript: flag("transcript"),
  detail: flag("detail") ? "high" : undefined,
  mode: opt("mode"),
});

console.log("\n===== SUMMARY =====\n" + result.summary);
if (result.transcript) console.log("\n===== TRANSCRIPT (" + result.transcript.model + ") =====\n" + result.transcript.text);
if (result.ocrText) console.log("\n===== OCR =====\n" + result.ocrText);
if (result.warnings.length) console.log("\n===== WARNINGS =====\n- " + result.warnings.join("\n- "));

const outDir = path.resolve("out");
await fs.mkdir(outDir, { recursive: true });
let i = 0;
for (const img of result.images) {
  const ext = img.mimeType.split("/")[1];
  await fs.writeFile(path.join(outDir, `frame_${String(++i).padStart(2, "0")}.${ext}`), Buffer.from(img.base64, "base64"));
}
console.log(`\nWrote ${result.images.length} image(s) to ${outDir}`);
