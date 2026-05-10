#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createServer } from "./server.js";

async function main() {
  const baseUrl = process.env.DRAWDB_BASE_URL;
  const apiKey = process.env.DRAWDB_API_KEY;
  if (!baseUrl || !apiKey) {
    console.error(
      "drawdb-mcp: set DRAWDB_BASE_URL and DRAWDB_API_KEY env vars before launching.",
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
