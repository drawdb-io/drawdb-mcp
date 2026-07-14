#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createServer } from "./server.js";

async function main() {
  const baseUrl = process.env.DRAWDB_BASE_URL || "https://api.drawdb.app";
  const apiKey = process.env.DRAWDB_API_KEY;
  if (!apiKey) {
    console.error(
      "drawdb-mcp: set DRAWDB_API_KEY env var before launching (DRAWDB_BASE_URL is optional, defaults to https://api.drawdb.app).",
    );
    process.exit(1);
  }

  const server = createServer({ baseUrl, apiKey });
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error("drawdb-mcp stdio crashed:", err);
  process.exit(1);
});
