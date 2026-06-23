#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createServer } from "./server.js";
import { runSetup } from "./setup.js";

async function main(): Promise<void> {
  const argv = process.argv.slice(2);

  if (argv[0] === "setup") {
    process.exit(await runSetup(argv.slice(1)));
  }

  const server = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  process.stderr.write("media-context-mcp running on stdio\n");
}

main().catch((err) => {
  process.stderr.write(`fatal: ${err?.stack ?? err}\n`);
  process.exit(1);
});
