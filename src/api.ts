// Thin client for the drawDB backend.
//
// Contract:
//   GET /api/v1/diagrams                  -> { diagrams: DiagramSummary[] }
//   GET /api/v1/diagrams/:id/schema       -> DiagramSchema
//
// Authed via the `X-API-Key: <DRAWDB_API_KEY>` header — separate from the
// JWT `Authorization: Bearer` flow used by the editor.

import { config } from "./config.js";
import type { DiagramSchema, DiagramSummary } from "./types.js";

export interface ApiClientOptions {
  baseUrl?: string;
  apiKey: string;
}

export class DrawDBClient {
  private baseUrl: string;
  private apiKey: string;

  constructor({ baseUrl, apiKey }: ApiClientOptions) {
    if (!apiKey) throw new Error("DRAWDB_API_KEY is required");

    this.baseUrl = (baseUrl || config.defaultBaseUrl).replace(/\/$/, "");
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
      throw new Error(
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
