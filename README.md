# drawdb-mcp

A [Model Context Protocol](https://modelcontextprotocol.io) server that gives AI
agents **read-only** access to your [drawDB](https://drawdb.app) diagrams — so
they can inspect your database schema (tables, columns, relationships, enums,
custom types) while helping you write queries, migrations, or application code.

It runs locally over the **stdio** transport, which works with Claude Desktop,
Cursor, Cline, Goose, Windsurf, and any other client that launches a local MCP
child process.

## Requirements

- **Node.js ≥ 20**
- A **drawDB API key** (starts with `ddb_`). Mint one from the drawDB
  **Profile modal → API keys** tab. Plain JWTs are not accepted on `/api/v1`.

You don't need to install anything ahead of time — the config below launches the
server on demand with `npx`.

## Quickstart

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
| `DRAWDB_API_KEY` | yes | — | Your drawDB API key (`ddb_…`). |
| `DRAWDB_BASE_URL` | no | `https://api.drawdb.app` | Override to point at a self-hosted or local backend (e.g. `http://localhost:4000`). |

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

- `src/stdio.ts` — entry point (the `drawdb-mcp` bin); reads env, wires up stdio.
- `src/server.ts` — builds the `McpServer` and registers tools.
- `src/tools.ts` — the nine tool handlers and their response shaping.
- `src/api.ts` — `DrawDBClient`, an HTTP wrapper over `GET /api/v1/diagrams`
  and `GET /api/v1/diagrams/:id/schema`, authenticated with the `X-API-Key`
  header.
- `src/types.ts` — the diagram schema shape returned by the backend.

## License

MIT — see [LICENSE](./LICENSE).
