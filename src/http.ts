import express, { type Request, type Response } from "express";
import cors from "cors";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createServer } from "./server.js";

const port = Number(process.env.PORT) || 5003;
const baseUrl = process.env.DRAWDB_BASE_URL;
const galleryUrl = process.env.DRAWDB_GALLERY_URL;

function apiKeyFrom(req: Request): string | undefined {
  const header = req.get("authorization");
  const bearer = header?.match(/^Bearer\s+(.+)$/i)?.[1]?.trim();
  return bearer || req.get("x-api-key")?.trim() || undefined;
}

function methodNotAllowed(_req: Request, res: Response) {
  res.status(405).set("Allow", "POST").json({
    jsonrpc: "2.0",
    error: { code: -32000, message: "Method not allowed." },
    id: null,
  });
}

const app = express();

app.disable("x-powered-by");
app.use(
  cors({
    origin: "*",
    allowedHeaders: [
      "Authorization",
      "Content-Type",
      "X-API-Key",
      "Mcp-Protocol-Version",
      "Mcp-Session-Id",
      "Last-Event-ID",
    ],
    exposedHeaders: ["Mcp-Session-Id"],
  }),
);
app.use(express.json({ limit: "1mb" }));

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.post("/mcp", async (req, res) => {
  const server = createServer({ baseUrl, galleryUrl, apiKey: apiKeyFrom(req) });
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });

  res.on("close", () => {
    void transport.close();
    void server.close();
  });

  try {
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (err) {
    console.error("drawdb-mcp http request failed:", err);
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: "2.0",
        error: { code: -32603, message: "Internal server error" },
        id: null,
      });
    }
  }
});

app.get("/mcp", methodNotAllowed);
app.delete("/mcp", methodNotAllowed);

const httpServer = app.listen(port, () => {
  console.error(`drawdb-mcp http listening on :${port}`);
});

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    httpServer.close(() => process.exit(0));
  });
}
