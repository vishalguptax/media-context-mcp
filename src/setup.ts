import { spawn } from "node:child_process";
import { checkDeps } from "./system/deps.js";

type Platform = "win32" | "darwin" | "linux";

interface Tool {
  key: "ffmpeg" | "ytdlp" | "tesseract" | "whisper";
  label: string;
  /** Install command per platform: [binary, ...args]. */
  cmd: Partial<Record<Platform, string[]>>;
  /** Shown when no automated command fits the platform. */
  manual: string;
  /** Only installed when --whisper is passed (large / needs Python). */
  optIn?: boolean;
}

const WINGET = (id: string): string[] => [
  "winget",
  "install",
  "-e",
  "--id",
  id,
  "--accept-source-agreements",
  "--accept-package-agreements",
];

const TOOLS: Tool[] = [
  {
    key: "ffmpeg",
    label: "ffmpeg (+ ffprobe) — required for all media",
    cmd: {
      win32: WINGET("Gyan.FFmpeg"),
      darwin: ["brew", "install", "ffmpeg"],
      linux: ["sudo", "apt-get", "install", "-y", "ffmpeg"],
    },
    manual: "https://ffmpeg.org/download.html",
  },
  {
    key: "ytdlp",
    label: "yt-dlp — analyze URLs (YouTube, Vimeo, …)",
    cmd: {
      win32: WINGET("yt-dlp.yt-dlp"),
      darwin: ["brew", "install", "yt-dlp"],
      linux: ["sudo", "apt-get", "install", "-y", "yt-dlp"],
    },
    manual: "pip install -U yt-dlp",
  },
  {
    key: "tesseract",
    label: "tesseract — OCR of on-screen text",
    cmd: {
      win32: WINGET("UB-Mannheim.TesseractOCR"),
      darwin: ["brew", "install", "tesseract"],
      linux: ["sudo", "apt-get", "install", "-y", "tesseract-ocr"],
    },
    manual: "https://github.com/tesseract-ocr/tesseract",
  },
  {
    key: "whisper",
    label: "whisper — audio transcripts (large: pulls PyTorch, needs Python)",
    cmd: {
      win32: ["pip", "install", "-U", "openai-whisper"],
      darwin: ["pip3", "install", "-U", "openai-whisper"],
      linux: ["pip3", "install", "-U", "openai-whisper"],
    },
    manual: "pip install -U openai-whisper",
    optIn: true,
  },
];

function spawnInherit(bin: string, args: string[]): Promise<number> {
  return new Promise((resolve) => {
    const child = spawn(bin, args, { stdio: "inherit", windowsHide: true });
    child.on("error", () => resolve(-1));
    child.on("close", (code) => resolve(code ?? -1));
  });
}

/** Install the external binaries media-context-mcp can use, via the OS package manager. */
export async function runSetup(argv: string[]): Promise<number> {
  const platform = process.platform as Platform;
  const wantWhisper = argv.includes("--whisper") || argv.includes("--all");

  process.stdout.write("media-context-mcp setup\n");
  process.stdout.write(`Platform: ${platform}\n\n`);

  const deps = await checkDeps();
  const present: Record<string, boolean> = {
    ffmpeg: deps.ffmpeg && deps.ffprobe,
    ytdlp: deps.ytdlp,
    tesseract: deps.tesseract,
    whisper: deps.whisper,
  };

  const failures: string[] = [];

  for (const tool of TOOLS) {
    if (tool.optIn && !wantWhisper) {
      process.stdout.write(`skip  ${tool.label}\n      (pass --whisper to include it)\n`);
      continue;
    }
    if (present[tool.key]) {
      process.stdout.write(`ok    ${tool.label} — already installed\n`);
      continue;
    }
    const cmd = tool.cmd[platform];
    if (!cmd) {
      process.stdout.write(`skip  ${tool.label} — no automated install for ${platform}\n      install manually: ${tool.manual}\n`);
      failures.push(tool.key);
      continue;
    }
    process.stdout.write(`\n>>> installing ${tool.label}\n    ${cmd.join(" ")}\n`);
    const code = await spawnInherit(cmd[0], cmd.slice(1));
    if (code === 0) {
      process.stdout.write(`ok    ${tool.label}\n`);
    } else {
      process.stdout.write(`FAIL  ${tool.label} (exit ${code})\n      install manually: ${tool.manual}\n`);
      failures.push(tool.key);
    }
  }

  process.stdout.write("\nDone. Re-run `npx media-context-mcp setup` any time, or restart your MCP client to pick up new tools.\n");
  if (!wantWhisper) {
    process.stdout.write("For audio transcripts, run with --whisper.\n");
  }
  return failures.length > 0 ? 1 : 0;
}
