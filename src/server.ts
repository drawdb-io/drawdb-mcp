import { createRequire } from "node:module";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { DrawDBClient } from "./api.js";
import { registerTools } from "./tools.js";

const { version } = createRequire(import.meta.url)("../package.json") as {
  version: string;
};

export interface CreateServerOptions {
  baseUrl?: string;
  apiKey: string;
}

export function createServer({ baseUrl, apiKey }: CreateServerOptions): McpServer {
  const client = new DrawDBClient({ baseUrl, apiKey });

  const server = new McpServer(
    {
      name: "drawdb-mcp",
      version,
    },
    {
      instructions:
        "Read-only access to drawDB diagrams: list tables, describe columns, " +
        "and inspect relationships, enums, and custom types. Use list_diagrams " +
        "first to discover diagram IDs, then pass diagram_id to schema queries.",
    },
  );

  registerTools(server, client);
  return server;
}
