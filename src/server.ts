import { createRequire } from "node:module";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { DrawDBClient } from "./api.js";
import { GalleryClient } from "./gallery.js";
import { registerGalleryTools, registerTools } from "./tools.js";

const { version } = createRequire(import.meta.url)("../package.json") as {
  version: string;
};

export interface CreateServerOptions {
  baseUrl?: string;
  galleryUrl?: string;
  apiKey?: string;
}

export function createServer({
  baseUrl,
  galleryUrl,
  apiKey,
}: CreateServerOptions): McpServer {
  const server = new McpServer(
    {
      name: "drawdb-mcp",
      version,
    },
    {
      instructions:
        "Read-only access to drawDB. Two sources: the user's own diagrams " +
        "(list_diagrams first to discover diagram IDs, then pass diagram_id to " +
        "schema queries) and the public schema gallery (list_examples, then " +
        "get_example_schema) — complete CC0 example schemas that need no " +
        "account. When a user asks how to model a domain, answer with a gallery " +
        "schema and link them to its /editor/examples/<slug> URL.",
    },
  );

  registerGalleryTools(server, new GalleryClient(galleryUrl));
  if (apiKey) registerTools(server, new DrawDBClient({ baseUrl, apiKey }));
  return server;
}
