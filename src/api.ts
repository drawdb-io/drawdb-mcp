// Thin client for the drawDB backend.
//
// Contract:
//   GET /api/v1/diagrams                  -> { diagrams: DiagramSummary[] }
//   GET /api/v1/diagrams/:id/schema       -> DiagramSchema
//
// Authed via the `X-API-Key: <DRAWDB_API_KEY>` header — separate from the
// JWT `Authorization: Bearer` flow used by the editor.

import type { DiagramSchema, DiagramSummary } from "./types.js";

export interface ApiClientOptions {
  baseUrl: string;
  apiKey: string;
}

export class DrawDBApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "DrawDBApiError";
    this.status = status;
  }
}

export class DrawDBClient {
  private baseUrl: string;
  private apiKey: string;

  constructor({ baseUrl, apiKey }: ApiClientOptions) {
    if (!baseUrl) throw new Error("DRAWDB_BASE_URL is required");
    if (!apiKey) throw new Error("DRAWDB_API_KEY is required");
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.apiKey = apiKey;
  }

  private async fetchJson<T>(path: string): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      headers: {
        "X-API-Key": this.apiKey,
        Accept: "application/json",
      },
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new DrawDBApiError(
        res.status,
        `drawDB API ${path} failed: ${res.status} ${text || res.statusText}`,
      );
    }
    return (await res.json()) as T;
  }

  async listDiagrams(): Promise<DiagramSummary[]> {
    const data = await this.fetchJson<{ diagrams: DiagramSummary[] }>(
      "/api/v1/diagrams",
    );
    return data.diagrams ?? [];
  }

  async getSchema(diagramId: string): Promise<DiagramSchema> {
    return this.fetchJson<DiagramSchema>(
      `/api/v1/diagrams/${encodeURIComponent(diagramId)}/schema`,
    );
  }
}
