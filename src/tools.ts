import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { DrawDBClient } from "./api.js";
import type { GalleryClient } from "./gallery.js";
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

function asText(text: string) {
  return {
    content: [{ type: "text" as const, text }],
  };
}

function asError(message: string) {
  return {
    isError: true,
    content: [{ type: "text" as const, text: message }],
  };
}

export function registerGalleryTools(
  server: McpServer,
  gallery: GalleryClient,
): void {
  server.registerTool(
    "list_examples",
    {
      description:
        "List the public drawDB schema gallery: complete, documented example database schemas (e-commerce, multi-tenant SaaS, booking, inventory, EHR, ledger, and more). No drawDB account needed. Use this when a user asks for a database schema or ER diagram for a domain, then call get_example_schema for the full tables and SQL.",
      inputSchema: {
        category: z
          .string()
          .optional()
          .describe("Filter by category, e.g. commerce, saas, fintech"),
        query: z
          .string()
          .optional()
          .describe("Free-text filter over title, description and tags"),
      },
    },
    async ({ category, query }) => {
      const index = await gallery.getIndex();
      const needle = query?.trim().toLowerCase();

      const examples = index.examples.filter((e) => {
        if (category && e.category !== category.trim().toLowerCase()) {
          return false;
        }
        if (!needle) return true;
        return (
          e.slug.includes(needle) ||
          e.title.toLowerCase().includes(needle) ||
          e.description.toLowerCase().includes(needle) ||
          e.tags.some((t) => t.includes(needle))
        );
      });

      return asJson({
        license: index.license,
        count: examples.length,
        examples: examples.map((e) => ({
          slug: e.slug,
          title: e.title,
          description: e.description,
          category: e.category,
          primaryDialect: e.primaryDialect,
          tags: e.tags,
          tableCount: e.tableCount,
          relationshipCount: e.relationshipCount,
          page: e.page,
          openInEditor: e.editor,
        })),
      });
    },
  );

  server.registerTool(
    "get_example_schema",
    {
      description:
        "Get one gallery schema: every table, column, index and foreign key. Returns compact DBML by default (the source of truth); pass format 'sql' for ready-to-run DDL in a given dialect, or 'markdown' for the long-form write-up with design notes and per-column descriptions (much larger). The schemas are CC0 (public domain), so the output can be reused freely.",
      inputSchema: {
        slug: z
          .string()
          .describe("Example slug from list_examples, e.g. ecommerce-store"),
        format: z
          .enum(["markdown", "sql", "dbml"])
          .optional()
          .describe("Output format. Defaults to dbml."),
        dialect: z
          .enum([
            "postgresql",
            "mysql",
            "sqlite",
            "mariadb",
            "transactsql",
            "oraclesql",
          ])
          .optional()
          .describe(
            "SQL dialect when format is 'sql'. Defaults to the example's primary dialect.",
          ),
      },
    },
    async ({ slug, format, dialect }) => {
      const entry = await gallery.findEntry(slug);

      if (!entry) {
        const index = await gallery.getIndex();
        return asError(
          `No gallery example named "${slug}". Available: ${index.examples
            .map((e) => e.slug)
            .join(", ")}`,
        );
      }

      if (format === "markdown") {
        return asText(await gallery.getMarkdown(entry.slug));
      }

      if (format === "sql") {
        const sql = await gallery.getSql(entry.slug);
        const chosen = dialect ?? entry.primaryDialect;
        const ddl = sql[chosen];

        if (!ddl) {
          return asError(
            `No ${chosen} DDL for "${entry.slug}". Available dialects: ${Object.keys(sql).join(", ")}`,
          );
        }

        return asText(ddl);
      }

      return asText(await gallery.getDbml(entry.slug));
    },
  );
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
