import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { DrawDBClient } from "./api.js";
import type {
  DiagramSchema,
  Field,
  Reference,
  Table,
} from "./types.js";

function findTable(schema: DiagramSchema, name: string): Table | null {
  const target = name.toLowerCase();
  return (
    schema.tables.find((t) => t.name.toLowerCase() === target) ?? null
  );
}

function fieldDescriptor(f: Field) {
  return {
    name: f.name,
    type: f.type + (f.size != null ? `(${f.size})` : ""),
    nullable: !f.notNull,
    primary: !!f.primary,
    unique: !!f.unique,
    autoIncrement: !!f.increment,
    default: f.default ?? null,
    check: f.check ?? null,
    comment: f.comment ?? null,
    enumValues: f.values ?? null,
  };
}

function tableDescriptor(t: Table) {
  return {
    name: t.name,
    comment: t.comment ?? null,
    fields: t.fields.map(fieldDescriptor),
    indices:
      t.indices?.map((i) => ({
        name: i.name,
        unique: i.unique,
        fields: i.fields,
      })) ?? [],
  };
}

function relationshipDescriptor(schema: DiagramSchema, ref: Reference) {
  const start = schema.tables.find((t) => t.id === ref.startTableId) ?? null;
  const end = schema.tables.find((t) => t.id === ref.endTableId) ?? null;

  const pairs =
    ref.fields && ref.fields.length > 0
      ? ref.fields
      : [{ startFieldId: ref.startFieldId, endFieldId: ref.endFieldId }];

  const fromFields = pairs.map(
    (p) => start?.fields.find((f) => f.id === p.startFieldId)?.name ?? null,
  );
  const toFields = pairs.map(
    (p) => end?.fields.find((f) => f.id === p.endFieldId)?.name ?? null,
  );

  return {
    name: ref.name,
    cardinality: ref.cardinality,
    onUpdate: ref.updateConstraint,
    onDelete: ref.deleteConstraint,
    composite: pairs.length > 1,
    from: start
      ? { table: start.name, field: fromFields[0], fields: fromFields }
      : null,
    to: end ? { table: end.name, field: toFields[0], fields: toFields } : null,
  };
}

function asJson(value: unknown) {
  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(value, null, 2),
      },
    ],
  };
}

function asError(message: string) {
  return {
    isError: true,
    content: [{ type: "text" as const, text: message }],
  };
}

export function registerTools(server: McpServer, client: DrawDBClient): void {
  server.registerTool(
    "list_diagrams",
    {
      description:
        "List diagrams the authenticated user can access. Returns id, name, database, updatedAt.",
      inputSchema: {},
    },
    async () => {
      const diagrams = await client.listDiagrams();
      return asJson(diagrams);
    },
  );

  server.registerTool(
    "get_schema_summary",
    {
      description:
        "High-level overview of a diagram: dialect, table count, relationship count, enums, and custom types.",
      inputSchema: {
        diagram_id: z.string().describe("UUID of the diagram"),
      },
    },
    async ({ diagram_id }) => {
      const schema = await client.getSchema(diagram_id);

      return asJson({
        database: schema.database,
        tableCount: schema.tables.length,
        relationshipCount: schema.references.length,
        enumCount: schema.enums?.length ?? 0,
        customTypeCount: schema.types?.length ?? 0,
        tables: schema.tables.map((t) => t.name),
      });
    },
  );

  server.registerTool(
    "list_tables",
    {
      description: "List all tables in a diagram with optional comments.",
      inputSchema: { diagram_id: z.string() },
    },
    async ({ diagram_id }) => {
      const schema = await client.getSchema(diagram_id);

      return asJson(
        schema.tables.map((t) => ({
          name: t.name,
          comment: t.comment ?? null,
          fieldCount: t.fields.length,
        })),
      );
    },
  );

  server.registerTool(
    "describe_table",
    {
      description: "Full column definitions for a single table.",
      inputSchema: {
        diagram_id: z.string(),
        table_name: z.string().describe("Case-insensitive table name"),
      },
    },
    async ({ diagram_id, table_name }) => {
      const schema = await client.getSchema(diagram_id);
      const table = findTable(schema, table_name);

      if (!table) return asError(`Table not found: ${table_name}`);

      return asJson(tableDescriptor(table));
    },
  );

  server.registerTool(
    "list_relationships",
    {
      description:
        "All foreign-key relationships with cardinality and referential actions.",
      inputSchema: { diagram_id: z.string() },
    },
    async ({ diagram_id }) => {
      const schema = await client.getSchema(diagram_id);

      return asJson(
        schema.references.map((r) => relationshipDescriptor(schema, r)),
      );
    },
  );

  server.registerTool(
    "describe_relationship",
    {
      description:
        "Detailed relationship info between two specific tables (case-insensitive).",
      inputSchema: {
        diagram_id: z.string(),
        from_table: z.string(),
        to_table: z.string(),
      },
    },
    async ({ diagram_id, from_table, to_table }) => {
      const schema = await client.getSchema(diagram_id);
      const from = findTable(schema, from_table);
      const to = findTable(schema, to_table);

      if (!from) return asError(`Table not found: ${from_table}`);
      if (!to) return asError(`Table not found: ${to_table}`);

      const matches = schema.references
        .filter((r) => r.startTableId === from.id && r.endTableId === to.id)
        .map((r) => relationshipDescriptor(schema, r));

      if (matches.length === 0) {
        return asError(
          `No relationships from ${from.name} to ${to.name}.`,
        );
      }

      return asJson(matches);
    },
  );

  server.registerTool(
    "list_enums",
    {
      description: "List user-defined enums (Postgres / MySQL).",
      inputSchema: { diagram_id: z.string() },
    },
    async ({ diagram_id }) => {
      const schema = await client.getSchema(diagram_id);

      return asJson(
        (schema.enums ?? []).map((e) => ({
          name: e.name,
          values: e.values,
        })),
      );
    },
  );

  server.registerTool(
    "list_custom_types",
    {
      description: "List user-defined composite types (Postgres-only).",
      inputSchema: { diagram_id: z.string() },
    },
    async ({ diagram_id }) => {
      const schema = await client.getSchema(diagram_id);

      return asJson(
        (schema.types ?? []).map((t) => ({
          name: t.name,
          fields: t.fields.map(fieldDescriptor),
          comment: t.comment ?? null,
        })),
      );
    },
  );

  server.registerTool(
    "search_tables",
    {
      description:
        "Substring search across table names, column names, and comments. Returns ranked matches.",
      inputSchema: {
        diagram_id: z.string(),
        query: z.string().min(1),
      },
    },
    async ({ diagram_id, query }) => {
      const schema = await client.getSchema(diagram_id);
      const q = query.toLowerCase();

      type Hit = { table: string; reason: string };
      const hits: Hit[] = [];

      for (const t of schema.tables) {
        if (t.name.toLowerCase().includes(q)) {
          hits.push({ table: t.name, reason: "table-name" });
        }
        if (t.comment?.toLowerCase().includes(q)) {
          hits.push({ table: t.name, reason: "table-comment" });
        }

        for (const f of t.fields) {
          if (f.name.toLowerCase().includes(q)) {
            hits.push({
              table: t.name,
              reason: `column:${f.name}`,
            });
          } else if (f.comment?.toLowerCase().includes(q)) {
            hits.push({
              table: t.name,
              reason: `column-comment:${f.name}`,
            });
          }
        }
      }

      return asJson({ matches: hits });
    },
  );
}
