import { z } from "zod";
import { itemSchema, validateResearchItem } from "../lib/research.ts";
import { feedSources } from "../lib/feeds.ts";

export function projectPublic(input: unknown) {
  const raw = z
    .object({
      items: z.array(z.unknown()).default([]),
      inbox: z.array(z.unknown()).default([]),
      sources: z.array(z.unknown()).default([]),
      runs: z.array(z.unknown()).default([]),
      updatedAt: z.string().datetime().optional(),
      readerStatus: z.string().optional(),
    })
    .parse(input);
  const items = raw.items
    .map(validateResearchItem)
    .filter((x) => x.status === "ready")
    .slice(0, 200);
  const pending = raw.inbox
    .map((value) => itemSchema.parse(value))
    .filter((x) => x.status.startsWith("awaiting-"))
    .slice(0, 200)
    .map((x) => {
      return {
        id: x.id,
        title: x.title,
        originalTitle: x.originalTitle,
        type: x.type,
        category: x.category,
        sourceName: x.sourceName,
        sourceUrl: x.sourceUrl,
        publishedAt: x.publishedAt,
        status: "awaiting-fulltext",
      };
    });
  const sourceSchema = z.object({
    id: z.string(),
    status: z.enum(["ok", "failed"]),
    checkedAt: z.string().datetime(),
    count: z.number().int().min(0).max(1000000),
  });
  const sources = raw.sources
    .map((x) => sourceSchema.parse(x))
    .filter((x) => feedSources.some((s) => s.id === x.id));
  const runSchema = z.object({
    mode: z.enum(["discovery", "daily", "weekly"]),
    status: z.enum(["succeeded", "partial", "failed", "blocked", "paused"]),
    at: z.string().datetime(),
  });
  return {
    version: 1,
    aiGenerated: true,
    updatedAt: raw.updatedAt || new Date().toISOString(),
    items,
    pending,
    sources,
    runs: raw.runs.slice(0, 50).map((x) => runSchema.parse(x)),
    readerConfigured: raw.readerStatus === "configured",
  };
}
