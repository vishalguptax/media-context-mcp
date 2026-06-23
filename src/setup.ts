import { spawn } from "node:child_process";
import { checkDeps } from "./system/deps.js";

type Platform = "win32" | "darwin" | "linux";

interface Tool {
  key: "ffmpeg" | "ytdlp" | "tesseract" | "whisper";
  name: string;
  desc: string;
  /** Install command per platform: [binary, ...args]. */
  cmd: Partial<Record<Platform, string[]>>;
  /** Uninstall command per platform. */
  remove: Partial<Record<Platform, string[]>>;
  /** Shown when no automated command fits the platform / install fails. */
  manual: string;
  /** Only installed when --audio is passed (large / needs Python). */
  optIn?: boolean;
}

// ---- tiny color helper (no deps, degrades on non-TTY / NO_COLOR) ----
const COLOR = process.stdout.isTTY && !process.env.NO_COLOR;
const sgr = (s: string, ...codes: number[]) =>
  COLOR ? `\x1b[${codes.join(";")}m${s}\x1b[0m` : s;
const teal = (s: string) => sgr(s, 38, 5, 37);
const green = (s: string) => sgr(s, 38, 5, 42);
const red = (s: string) => sgr(s, 38, 5, 203);
const yellow = (s: string) => sgr(s, 38, 5, 221);
const dim = (s: string) => sgr(s, 2);
const bold = (s: string) => sgr(s, 1);
const out = (s = "") => process.stdout.write(s + "\n");

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
    name: "ffmpeg",
    desc: "core media engine",
    cmd: {
      win32: WINGET("Gyan.FFmpeg"),
      darwin: ["brew", "install", "ffmpeg"],
      linux: ["sudo", "apt-get", "install", "-y", "ffmpeg"],
    },
    remove: {
      win32: ["winget", "uninstall", "-e", "--id", "Gyan.FFmpeg"],
      darwin: ["brew", "uninstall", "ffmpeg"],
      linux: ["sudo", "apt-get", "remove", "-y", "ffmpeg"],
    },
    manual: "https://ffmpeg.org/download.html",
  },
  {
    key: "ytdlp",
    name: "yt-dlp",
    desc: "download from URLs",
    cmd: {
      win32: WINGET("yt-dlp.yt-dlp"),
      darwin: ["brew", "install", "yt-dlp"],
      linux: ["sudo", "apt-get", "install", "-y", "yt-dlp"],
    },
    remove: {
      win32: ["winget", "uninstall", "-e", "--id", "yt-dlp.yt-dlp"],
      darwin: ["brew", "uninstall", "yt-dlp"],
      linux: ["sudo", "apt-get", "remove", "-y", "yt-dlp"],
    },
    manual: "pip install -U yt-dlp",
  },
  {
    key: "tesseract",
    name: "tesseract",
    desc: "on-screen text (OCR)",
    cmd: {
      win32: WINGET("UB-Mannheim.TesseractOCR"),
      darwin: ["brew", "install", "tesseract"],
      linux: ["sudo", "apt-get", "install", "-y", "tesseract-ocr"],
    },
    remove: {
      win32: ["winget", "uninstall", "-e", "--id", "UB-Mannheim.TesseractOCR"],
      darwin: ["brew", "uninstall", "tesseract"],
      linux: ["sudo", "apt-get", "remove", "-y", "tesseract-ocr"],
    },
    manual: "https://github.com/tesseract-ocr/tesseract",
  },
  {
    key: "whisper",
    name: "whisper",
    desc: "audio transcription (large)",
    cmd: {
      win32: ["pip", "install", "-U", "openai-whisper"],
      darwin: ["pip3", "install", "-U", "openai-whisper"],
      linux: ["pip3", "install", "-U", "openai-whisper"],
    },
    remove: {
      win32: ["pip", "uninstall", "-y", "openai-whisper"],
      darwin: ["pip3", "uninstall", "-y", "openai-whisper"],
      linux: ["pip3", "uninstall", "-y", "openai-whisper"],
    },
    manual: "pip install -U openai-whisper",
    optIn: true,
  },
];

function row(glyph: string, tool: Tool, note = ""): void {
  out(`  ${glyph} ${bold(tool.name.padEnd(11))}${dim(tool.desc)}${note ? "  " + dim(note) : ""}`);
}

function spawnInherit(bin: string, args: string[]): Promise<number> {
  return new Promise((resolve) => {
    const child = spawn(bin, args, { stdio: "inherit", windowsHide: true });
    child.on("error", () => resolve(-1));
    child.on("close", (code) => resolve(code ?? -1));
  });
}

/** Install the external tools media-context-mcp drives, via the OS package manager. */
export async function runSetup(argv: string[]): Promise<number> {
  if (argv.includes("--uninstall") || argv.includes("--remove")) {
    return runUninstall();
  }

  const platform = process.platform as Platform;
  const wantAudio =
    argv.includes("--audio") || argv.includes("--whisper") || argv.includes("--all");

  out();
  out(`  ${teal("◆")} ${bold("media-context")} ${dim("setup")}`);
  out(`  ${dim("Installing the tools the server uses — only what's missing.")}`);
  out();

  const deps = await checkDeps();
  const present: Record<string, boolean> = {
    ffmpeg: deps.ffmpeg && deps.ffprobe,
    ytdlp: deps.ytdlp,
    tesseract: deps.tesseract,
    whisper: deps.whisper,
  };

  const failures: Tool[] = [];

  for (const tool of TOOLS) {
    if (tool.optIn && !wantAudio) {
      row(dim("○"), tool, "skipped — pass --audio");
      continue;
    }
    if (present[tool.key]) {
      row(green("✓"), tool, "ready");
      continue;
    }
    const cmd = tool.cmd[platform];
    if (!cmd) {
      row(yellow("!"), tool, `install manually: ${tool.manual}`);
      failures.push(tool);
      continue;
    }
    out();
    out(`  ${teal("→")} ${bold("installing " + tool.name)} ${dim(cmd.join(" "))}`);
    const code = await spawnInherit(cmd[0], cmd.slice(1));
    out();
    if (code === 0) {
      row(green("✓"), tool, "installed");
    } else {
      row(red("✗"), tool, `failed — try: ${tool.manual}`);
      failures.push(tool);
    }
  }

  out();
  if (failures.length === 0) {
    out(`  ${green("✓")} ${bold("All set.")} ${dim("Restart your MCP client to pick up new tools.")}`);
  } else {
    out(`  ${yellow("⚠")} ${bold(`${failures.length} need${failures.length === 1 ? "s" : ""} manual install`)} ${dim("(see above).")}`);
  }
  if (!wantAudio) {
    out(`  ${dim("Tip: enable transcription with")} ${bold("npx media-context-mcp setup --audio")}`);
  }
  out();
  return failures.length > 0 ? 1 : 0;
}

/** Remove the tools setup installed (system-wide — warns before touching shared tools). */
async function runUninstall(): Promise<number> {
  const platform = process.platform as Platform;

  out();
  out(`  ${teal("◆")} ${bold("media-context")} ${dim("uninstall")}`);
  out(`  ${yellow("⚠")} ${dim("These are system-wide tools — remove only if nothing else uses them.")}`);
  out();

  const deps = await checkDeps();
  const present: Record<string, boolean> = {
    ffmpeg: deps.ffmpeg && deps.ffprobe,
    ytdlp: deps.ytdlp,
    tesseract: deps.tesseract,
    whisper: deps.whisper,
  };

  const failures: Tool[] = [];

  for (const tool of TOOLS) {
    if (!present[tool.key]) {
      row(dim("○"), tool, "not installed");
      continue;
    }
    const cmd = tool.remove[platform];
    if (!cmd) {
      row(yellow("!"), tool, "remove manually");
      failures.push(tool);
      continue;
    }
    out();
    out(`  ${teal("→")} ${bold("removing " + tool.name)} ${dim(cmd.join(" "))}`);
    const code = await spawnInherit(cmd[0], cmd.slice(1));
    out();
    if (code === 0) {
      row(green("✓"), tool, "removed");
    } else {
      row(red("✗"), tool, "failed");
      failures.push(tool);
    }
  }

  out();
  out(`  ${dim("Also remove the server from your MCP client config, and")} ${bold("npm uninstall -g media-context-mcp")} ${dim("if installed globally.")}`);
  out();
  return failures.length > 0 ? 1 : 0;
}
