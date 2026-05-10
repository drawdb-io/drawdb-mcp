import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { DrawDBClient } from "./api.js";
import { registerTools } from "./tools.js";

export interface CreateServerOptions {
  baseUrl: string;
  apiKey: string;
}

export function createServer({ baseUrl, apiKey }: CreateServerOptions): McpServer {
  const client = new DrawDBClient({ baseUrl, apiKey });

  const server = new McpServer(
    {
      name: "drawdb-mcp",
      version: "0.1.0",
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
