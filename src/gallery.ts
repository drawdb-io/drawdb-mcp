import { config } from "./config.js";

export interface GalleryEntry {
  slug: string;
  title: string;
  description: string;
  category: string;
  primaryDialect: string;
  tags: string[];
  tableCount: number;
  columnCount: number;
  relationshipCount: number;
  page: string;
  editor: string;
  document: string;
  markdown: string;
  dbml: string;
  sql: string;
}

export interface GalleryIndex {
  site: string;
  license: string;
  generatedAt: string;
  count: number;
  examples: GalleryEntry[];
}

export class GalleryClient {
  private baseUrl: string;
  private index: Promise<GalleryIndex> | null = null;

  constructor(baseUrl?: string) {
    this.baseUrl = (baseUrl || config.defaultGalleryUrl).replace(/\/$/, "");
  }

  private async fetchText(path: string): Promise<string> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      headers: { Accept: "text/plain, application/json" },
    });

    if (!res.ok) {
      throw new Error(
        `drawDB gallery ${path} failed: ${res.status} ${res.statusText}`,
      );
    }

    return res.text();
  }

  async getIndex(): Promise<GalleryIndex> {
    this.index ??= this.fetchText("/examples/index.json").then((text) => {
      try {
        return JSON.parse(text) as GalleryIndex;
      } catch {
        throw new Error(
          `${this.baseUrl}/examples/index.json did not return JSON. ` +
            `Check DRAWDB_GALLERY_URL points at a site serving the schema gallery.`,
        );
      }
    });
    return this.index;
  }

  async findEntry(slug: string): Promise<GalleryEntry | null> {
    const index = await this.getIndex();
    const target = slug.trim().toLowerCase();
    return index.examples.find((e) => e.slug === target) ?? null;
  }

  async getMarkdown(slug: string): Promise<string> {
    return this.fetchText(`/examples/${encodeURIComponent(slug)}.md`);
  }

  async getDbml(slug: string): Promise<string> {
    return this.fetchText(`/examples/${encodeURIComponent(slug)}.dbml`);
  }

  async getSql(slug: string): Promise<Record<string, string>> {
    const text = await this.fetchText(
      `/examples/${encodeURIComponent(slug)}.sql.json`,
    );
    return JSON.parse(text) as Record<string, string>;
  }
}
