# drawdb-mcp

MCP server that exposes drawDB diagrams to AI agents (read-only). Stdio transport, for Claude Desktop, Cursor, Cline, Goose, Windsurf, and other clients that launch a local MCP child process.

A hosted HTTP transport (for ChatGPT and claude.ai web) will be added later — those clients require OAuth 2.1, which lives in the backend, not here.

## Tools

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
| `search_tables` | `diagram_id`, `query` | substring matches across names + comments |

DDL / DBML export are not yet implemented — they need the OSS exporters lifted into this package or a server-side endpoint that runs them.

## Backend contract

The MCP server expects two endpoints on the drawDB backend, authed by the `X-API-Key` header:

```
GET /api/v1/diagrams                    -> { diagrams: DiagramSummary[] }
GET /api/v1/diagrams/:id/schema         -> DiagramSchema
```

`DiagramSchema` is the same JSON drawDB stores in R2 (tables / references / enums / types / database).

## Local development

```bash
npm install
cp .env.example .env   # set DRAWDB_API_KEY
npm run dev            # runs the stdio server against your local backend
```

## Wiring into a client

`claude_desktop_config.json` (or any client that uses the same shape):

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

Mint an API key in the drawDB **Profile modal → API keys** tab. Keys must start with `ddb_` — JWTs are not accepted on `/api/v1`.

> For testing against a local backend, set `DRAWDB_BASE_URL` (e.g. `http://localhost:4000`). It otherwise defaults to `https://api.drawdb.app`.

## Auth model

- API keys are minted from the drawDB Profile modal → API keys tab.
- A key inherits the user's plan + access, and lists diagrams across *every* team the user belongs to (no workspace scoping — the agent sees them all).
- Read-only by design; the MCP server has no mutating tools.
- Revoking a key invalidates every agent that holds it.

## License

MIT — see [LICENSE](./LICENSE).
