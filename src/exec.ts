import { spawn } from "node:child_process";

export interface RunResult {
  code: number;
  stdout: string;
  stderr: string;
}

export interface RunOptions {
  timeoutMs?: number;
  cwd?: string;
  maxBuffer?: number;
}

const DEFAULT_TIMEOUT = 10 * 60 * 1000;
const DEFAULT_MAX_BUFFER = 16 * 1024 * 1024;

/**
 * Spawn a binary and capture output. Never invokes a shell, so arguments are
 * passed verbatim and no shell injection is possible.
 */
export function run(
  bin: string,
  args: string[],
  opts: RunOptions = {}
): Promise<RunResult> {
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT;
  const maxBuffer = opts.maxBuffer ?? DEFAULT_MAX_BUFFER;

  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, { cwd: opts.cwd, windowsHide: true });

    let stdout = "";
    let stderr = "";
    let killed = false;
    let outLen = 0;
    let errLen = 0;

    const timer = setTimeout(() => {
      killed = true;
      child.kill("SIGKILL");
      reject(new Error(`${bin} timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    child.stdout.on("data", (d: Buffer) => {
      outLen += d.length;
      if (outLen <= maxBuffer) stdout += d.toString();
    });
    child.stderr.on("data", (d: Buffer) => {
      errLen += d.length;
      if (errLen <= maxBuffer) stderr += d.toString();
    });

    child.on("error", (err: NodeJS.ErrnoException) => {
      clearTimeout(timer);
      if (err.code === "ENOENT") {
        reject(new Error(`binary not found: ${bin}`));
      } else {
        reject(err);
      }
    });

    child.on("close", (code) => {
      clearTimeout(timer);
      if (killed) return;
      resolve({ code: code ?? -1, stdout, stderr });
    });
  });
}

/** True when a binary is resolvable and responds to a version probe. */
export async function exists(bin: string, versionArg = "-version"): Promise<boolean> {
  try {
    await run(bin, [versionArg], { timeoutMs: 15000 });
    return true;
  } catch {
    return false;
  }
}
