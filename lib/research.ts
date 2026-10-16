import { z } from "zod";

export const categories = {
  capabilities: "AI 能力",
  "frontier-safety": "前沿安全",
  "application-security": "应用安全",
} as const;

export const sourceHosts = new Set([
  "arxiv.org",
  "export.arxiv.org",
  "rss.arxiv.org",
  "openreview.net",
  "doi.org",
  "openai.com",
  "cdn.openai.com",
  "anthropic.com",
  "alignment.anthropic.com",
  "assets.anthropic.com",
  "www-cdn.anthropic.com",
  "deepmind.google",
  "research.google",
  "huggingface.co",
  "github.com",
  "raw.githubusercontent.com",
  "aclanthology.org",
  "proceedings.mlr.press",
  "neurips.cc",
  "papers.nips.cc",
  "metr.org",
  "epoch.ai",
  "alignmentforum.org",
  "lesswrong.com",
  "safe.ai",
  "aisafetyfeed.com",
  "newsletter.mlsafety.org",
  "jack-clark.net",
  "news.smol.ai",
  "alphaxiv.org",
  "aisafety.com",
]);

export function isSafeSourceUrl(value: string): boolean {
  try {
    const u = new URL(value);
    const host = u.hostname.toLowerCase().replace(/^www\./, "");
    return (
      u.protocol === "https:" &&
      !u.username &&
      !u.password &&
      (!u.port || u.port === "443") &&
      sourceHosts.has(host)
    );
  } catch {
    return false;
  }
}

const sourceUrl = z
  .string()
  .max(2500)
  .refine(isSafeSourceUrl, "来源必须是已支持的公开 HTTPS 站点");
const short = z.string().max(2000);
const evidenceSchema = z.object({
  id: z.string().min(1).max(100),
  label: z.string().min(1).max(200),
  locator: z.string().min(1).max(300),
  url: sourceUrl,
  supports: z.string().min(1).max(2000),
  excerpt: z.string().max(600).optional(),
  kind: z.enum(["paper", "external"]).default("paper"),
});

export const itemSchema = z.object({
  id: z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,159}$/),
  type: z.enum(["paper", "update"]),
  title: z.string().min(2).max(200),
  originalTitle: z.string().max(400).default(""),
  category: z.enum(["capabilities", "frontier-safety", "application-security"]),
  publishedAt: z.union([
    z.string().datetime({ offset: true }),
    z.string().date(),
  ]),
  reviewedAt: z.string().datetime({ offset: true }),
  sourceName: z.string().min(1).max(100),
  sourceUrl,
  fulltextUrl: sourceUrl.optional(),
  summary: z.string().max(4000).default(""),
  whyItMatters: short.default(""),
  method: short.default(""),
  results: short.default(""),
  limitations: z.array(short).max(20).default([]),
  readingMinutes: z.number().int().min(1).max(120).default(5),
  tags: z.array(z.string().max(80)).max(15).default([]),
  status: z.enum([
    "ready",
    "awaiting-fulltext",
    "awaiting-review",
    "withdrawn",
  ]),
  sourceCoverage: z.enum([
    "full-paper",
    "primary-source",
    "abstract-only",
    "metadata-only",
  ]),
  analysis: z.string().max(24000).default(""),
  qualityNotes: z.string().max(5000).default(""),
  evidence: z.array(evidenceSchema).max(80).default([]),
  priorWork: z
    .array(
      z.object({
        title: z.string().max(400),
        url: sourceUrl,
        relation: z.string().max(100),
        explanation: short,
      }),
    )
    .max(15)
    .default([]),
  reading: z
    .object({
      bodyRead: z.boolean(),
      figuresReviewed: z.number().int().min(0).max(300),
      totalMainFigures: z.number().int().min(0).max(300),
      tablesReviewed: z.number().int().min(0).max(300),
      totalMainTables: z.number().int().min(0).max(300),
      coreAppendixRead: z.boolean(),
      sections: z.array(z.string().min(1).max(200)).max(80),
      sourceVersion: z.string().min(1).max(100),
      reviewNotes: z.string().min(1).max(5000),
    })
    .optional(),
});
export type ResearchItem = z.infer<typeof itemSchema>;

export function qualityProblems(item: ResearchItem): string[] {
  const problems: string[] = [];
  if (
    !item.summary.trim() ||
    !item.method.trim() ||
    !item.results.trim() ||
    !item.limitations.length
  )
    problems.push("核心介绍、方法、结果与局限不完整");
  if (!item.evidence.length) problems.push("缺少原文证据");
  if (item.type === "paper") {
    if (item.sourceCoverage !== "full-paper" || !item.reading?.bodyRead)
      problems.push("尚未完成全文精读");
    if (
      !item.reading ||
      item.reading.figuresReviewed !== item.reading.totalMainFigures ||
      item.reading.tablesReviewed !== item.reading.totalMainTables
    )
      problems.push("主要图表覆盖不完整");
    if (!item.reading?.coreAppendixRead) problems.push("核心附录尚未核查");
    if (!item.reading || item.reading.sections.length < 3)
      problems.push("缺少章节覆盖记录");
    if (item.evidence.length < 3 || !item.analysis.trim())
      problems.push("精读分析与核心证据不足");
  } else if (item.sourceCoverage !== "primary-source")
    problems.push("技术进展尚未核对原始来源");
  return problems;
}

export function validateResearchItem(value: unknown): ResearchItem {
  const item = itemSchema.parse(value);
  if (item.status === "ready") {
    const problems = qualityProblems(item);
    if (problems.length) throw new Error(problems.join("；"));
  }
  return item;
}

export function canonicalWorkId(url: string): string {
  const parsed = new URL(url);
  const host = parsed.hostname.replace(/^www\./, "");
  if (host === "openreview.net" && parsed.searchParams.has("id"))
    return `openreview:${parsed.searchParams.get("id")}`;
  const arxiv = parsed.pathname.match(
    /\/(?:abs|pdf|html)\/(\d{4}\.\d{4,5})(?:v\d+)?(?:\.pdf)?/,
  );
  if (parsed.hostname.endsWith("arxiv.org") && arxiv)
    return `arxiv:${arxiv[1]}`;
  const identityParams = [...parsed.searchParams.entries()]
    .filter(([key]) => !/^(utm_.+|ref|source|fbclid|gclid)$/i.test(key))
    .sort(([a], [b]) => a.localeCompare(b));
  const query = new URLSearchParams(identityParams).toString();
  return `${host}${parsed.pathname.replace(/\/$/, "")}${query ? `?${query}` : ""}`;
}

export function filterItems(
  items: ResearchItem[],
  options: { query?: string; category?: string; publishedSince?: string } = {},
): ResearchItem[] {
  const query = options.query?.trim().toLocaleLowerCase() || "";
  return items.filter(
    (item) =>
      (!options.category ||
        options.category === "all" ||
        item.category === options.category) &&
      (!options.publishedSince ||
        Date.parse(item.publishedAt) >= Date.parse(options.publishedSince)) &&
      (!query ||
        [
          item.title,
          item.originalTitle,
          item.sourceName,
          item.summary,
          item.method,
          ...item.tags,
        ]
          .join(" ")
          .toLocaleLowerCase()
          .includes(query)),
  );
}

export const settingsSchema = z.object({
  depth: z.enum(["concise", "technical", "deep"]).default("technical"),
  maxDailyPapers: z.number().int().min(1).max(4).default(4),
  paused: z.boolean().default(false),
});
export type ResearchSettings = z.infer<typeof settingsSchema>;
export const defaultSettings: ResearchSettings = {
  depth: "technical",
  maxDailyPapers: 4,
  paused: false,
};

export const sourceStatusSchema = z.object({
  id: z.string().max(100),
  status: z.enum(["ok", "failed", "unchecked"]),
  checkedAt: z.string().datetime({ offset: true }),
  count: z.number().int().min(0).max(1000),
  message: z.string().max(500).default(""),
});
export const weeklySchema = z.object({
  id: z.string().max(100),
  title: z.string().max(200),
  summary: z.string().max(8000),
  publishedAt: z.string().datetime({ offset: true }),
  changes: z
    .array(
      z.object({
        statement: short,
        kind: z.enum(["supports", "weakens", "corrects", "open"]),
        evidenceIds: z.array(z.string()).max(30),
      }),
    )
    .max(20),
});
export const updateSchema = z.object({
  runId: z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,159}$/),
  mode: z.enum(["discovery", "daily", "weekly", "manual"]),
  startedAt: z.string().datetime({ offset: true }),
  completedAt: z.string().datetime({ offset: true }),
  status: z.enum(["succeeded", "partial", "failed"]),
  message: z.string().max(3000).default(""),
  items: z.array(itemSchema).max(20).default([]),
  sourceStatuses: z.array(sourceStatusSchema).max(40).default([]),
  weeklyReview: weeklySchema.optional(),
});
export type ResearchUpdate = z.infer<typeof updateSchema>;

export async function fingerprint(value: unknown): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hash), (n) =>
    n.toString(16).padStart(2, "0"),
  ).join("");
}
