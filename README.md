# @drawdb/mcp

A [Model Context Protocol](https://modelcontextprotocol.io) server that gives AI
agents **read-only** access to your [drawDB](https://drawdb.app) diagrams — so
they can inspect your database schema (tables, columns, relationships, enums,
custom types) while helping you write queries, migrations, or application code.

It also exposes the public drawDB **schema gallery** — complete, documented CC0
example schemas — which needs no account at all.

Two ways to connect:

- **Remote** (Streamable HTTP): `https://mcp.drawdb.app/mcp` — nothing to install.
- **Local** (stdio): `npx -y @drawdb/mcp`, for clients that launch a local MCP
  child process (Claude Desktop, Cursor, Cline, Goose, Windsurf, …).

## Access

- **Without a key** you get the gallery tools only (`list_examples`,
  `get_example_schema`).
- **With a drawDB API key** (starts with `ddb_`) you also get read access to
  your own diagrams. Mint one from the drawDB **Profile modal → API keys** tab.
  Plain JWTs are not accepted on `/api/v1`.

The server never holds credentials of its own: your key is forwarded to the
drawDB API on every call, and the API decides which diagrams it can see.

## Remote quickstart

Point any client that supports remote MCP servers at
`https://mcp.drawdb.app/mcp` and send your key as a bearer token
(`Authorization: Bearer ddb_xxx`, or `X-API-Key: ddb_xxx`). Leave the header
out to use the gallery only. For **Cursor** (`~/.cursor/mcp.json`):

```json
{
  "mcpServers": {
    "drawdb": {
      "url": "https://mcp.drawdb.app/mcp",
      "headers": { "Authorization": "Bearer ddb_xxx" }
    }
  }
}
```

The endpoint is stateless (no MCP sessions), so only `POST /mcp` is served.

## Local quickstart

Requires **Node.js ≥ 20**. You don't need to install anything ahead of time —
the config below launches the server on demand with `npx`.

Add the server to your MCP client's config. For **Claude Desktop**
(`claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "drawdb": {
      "command": "npx",
      "args": ["-y", "@drawdb/mcp"],
      "env": {
        "DRAWDB_API_KEY": "ddb_xxx"
      }
    }
  }
}
```

**Cursor** (`~/.cursor/mcp.json`, or `.cursor/mcp.json` in a project) uses the
same shape. Restart the client after editing, then ask the agent something like
*"list my drawDB diagrams"* to confirm the connection.

Once connected, a typical flow is: the agent calls `list_diagrams` to find a
diagram's ID, then passes that `diagram_id` to any of the schema tools below.

## Tools

All tools are read-only — the server has no way to mutate a diagram.

| Tool | Args | Returns |
| --- | --- | --- |
| `list_examples` | `category?`, `query?` | gallery schemas (no key needed) |
| `get_example_schema` | `slug`, `format?` (`dbml` default / `sql` / `markdown`), `dialect?` | one gallery schema (no key needed) |
| `list_diagrams` | — | id / name / database / updatedAt for every diagram the key can see |
| `get_schema_summary` | `diagram_id` | dialect + counts + table list |
| `list_tables` | `diagram_id` | name + comment + field count for each table |
| `describe_table` | `diagram_id`, `table_name` | full column definitions, indices, comments |
| `list_relationships` | `diagram_id` | every FK with cardinality + ON UPDATE/DELETE |
| `describe_relationship` | `diagram_id`, `from_table`, `to_table` | filtered relationship info |
| `list_enums` | `diagram_id` | user-defined enums |
| `list_custom_types` | `diagram_id` | Postgres composite types |
| `search_tables` | `diagram_id`, `query` | substring matches across table/column names + comments |

Table and relationship lookups are case-insensitive.

## Configuration

The server is configured entirely through environment variables (set in the
`env` block of your client config, or exported in your shell for local runs):

| Variable | Required | Default | Description |
| --- | --- | --- | --- |
| `DRAWDB_API_KEY` | no | — | Your drawDB API key (`ddb_…`). stdio only — without it only the gallery tools register. The HTTP server ignores it and uses each request's key. |
| `DRAWDB_BASE_URL` | no | `https://api.drawdb.app` | Override to point at a self-hosted or local backend (e.g. `http://localhost:4000`). |
| `DRAWDB_GALLERY_URL` | no | `https://www.drawdb.app` | Site serving the schema gallery. |
| `PORT` | no | `5003` | HTTP server port. |

## Auth model

- API keys are minted from the drawDB **Profile modal → API keys** tab.
- A key inherits the user's plan and access, and lists diagrams across *every*
  team the user belongs to — there is no per-workspace scoping, so the agent
  sees them all.
- Read-only by design; the server exposes no mutating tools.
- Revoking a key immediately invalidates every agent that holds it.

## Development

```bash
npm install
npm run dev        # run from source with tsx (reads .env if present)
npm run typecheck  # tsc --noEmit
npm run build      # compile to dist/
npm start          # run the compiled dist/stdio.js
npm run dev:http   # run the Streamable HTTP server from source on :5003
npm run start:http # run the compiled dist/http.js
```

Copy `.env.example` to `.env` and drop in your key to run against the live
backend, or point `DRAWDB_BASE_URL` at a local drawDB server.

To test a local build inside an MCP client, swap the `command`/`args` in your
config for an absolute node invocation:

```json
{
  "command": "node",
  "args": ["/absolute/path/to/drawdb-mcp/dist/stdio.js"],
  "env": { "DRAWDB_API_KEY": "ddb_xxx" }
}
```

## Architecture

The server is a thin layer over the drawDB backend's read API:

- `src/stdio.ts` — local entry point (the `drawdb-mcp` bin); reads env, wires up stdio.
- `src/http.ts` — remote entry point: stateless Streamable HTTP on `POST /mcp`,
  one `McpServer` per request built with that request's key.
- `src/server.ts` — builds the `McpServer`; gallery tools always, account tools
  only when a key is present.
- `src/tools.ts` — the tool handlers and their response shaping.
- `src/gallery.ts` — `GalleryClient`, reads the public `/examples/*` files.
- `src/api.ts` — `DrawDBClient`, an HTTP wrapper over `GET /api/v1/diagrams`
  and `GET /api/v1/diagrams/:id/schema`, authenticated with the `X-API-Key`
  header.
- `src/types.ts` — the diagram schema shape returned by the backend.

## License

MIT — see [LICENSE](./LICENSE).
