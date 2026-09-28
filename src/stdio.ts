#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { config } from "./config.js";
import { createServer } from "./server.js";

async function main() {
  const apiKey = process.env.DRAWDB_API_KEY;
  if (!apiKey) {
    console.error(
      `drawdb-mcp: no DRAWDB_API_KEY set — serving the public schema gallery only. ` +
        `Set DRAWDB_API_KEY to also expose your own diagrams (DRAWDB_BASE_URL is optional, defaults to ${config.defaultBaseUrl}).`,
    );
  }

  const server = createServer({
    baseUrl: process.env.DRAWDB_BASE_URL,
    galleryUrl: process.env.DRAWDB_GALLERY_URL,
    apiKey,
  });
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error("drawdb-mcp stdio crashed:", err);
  process.exit(1);
});
