import { z } from "zod";
import {
  canonicalWorkId,
  defaultSettings,
  itemSchema,
  settingsSchema,
  validateResearchItem,
} from "../lib/research.ts";
import type { ResearchItem } from "../lib/research.ts";
import { feedSources, fetchFeed, selectCandidates } from "../lib/feeds.ts";
import type { FeedSource } from "../lib/feeds.ts";

const runSchema = z.object({
  id: z.string(),
  mode: z.enum(["discovery", "daily", "weekly"]),
  status: z.enum(["succeeded", "partial", "failed", "blocked", "paused"]),
  at: z.string().datetime(),
  message: z.string().max(3000),
});
export const cloudStateSchema = z.object({
  version: z.literal(1),
  updatedAt: z.string().datetime(),
  settings: settingsSchema,
  items: z.array(itemSchema).max(5000),
  inbox: z.array(itemSchema).max(2000),
  sources: z
    .array(
      z.object({
        id: z.string(),
        status: z.enum(["ok", "failed"]),
        checkedAt: z.string().datetime(),
        count: z.number(),
        message: z.string(),
      }),
    )
    .max(40),
  runs: z.array(runSchema).max(50),
  budget: z.object({
    day: z.string(),
    calls: z.number().int().min(0).max(8),
    papers: z.number().int().min(0).max(4),
  }),
  attempts: z
    .record(
      z.string(),
      z.object({
        count: z.number().int().min(0).max(3),
        retryAfter: z.string().datetime(),
      }),
    )
    .default({}),
  readerStatus: z
    .enum(["not-configured", "configured", "failed"])
    .default("not-configured"),
});
export type CloudState = z.infer<typeof cloudStateSchema>;
export type SourceDocument = { pages: string[]; url: string };
function day() {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}
export function freshState(items: unknown[] = []): CloudState {
  return {
    version: 1,
    updatedAt: new Date().toISOString(),
    settings: { ...defaultSettings },
    items: items.map(validateResearchItem),
    inbox: [],
    sources: [],
    runs: [],
    budget: { day: day(), calls: 0, papers: 0 },
    attempts: {},
    readerStatus: "not-configured",
  };
}
function record(
  state: CloudState,
  mode: "discovery" | "daily" | "weekly",
  status: z.infer<typeof runSchema>["status"],
  message: string,
) {
  state.updatedAt = new Date().toISOString();
  state.runs.unshift({
    id: crypto.randomUUID(),
    mode,
    status,
    at: state.updatedAt,
    message,
  });
  state.runs = state.runs.slice(0, 50);
}

export async function discover(
  state: CloudState,
  fetcher: (source: FeedSource) => Promise<unknown[]> = fetchFeed,
) {
  if (state.settings.paused) {
    record(state, "discovery", "paused", "研究已暂停，没有抓取来源。");
    return;
  }
  const now = new Date().toISOString();
  const groups = await Promise.all(
    feedSources.map(async (source) => {
      try {
        return {
          items: (await fetcher(source)).slice(0, 15).map((item) =>
            itemSchema.parse({
              ...(item as object),
              reviewedAt: now,
              status: "awaiting-fulltext",
              sourceCoverage: "metadata-only",
              summary: "",
              analysis: "",
              reading: undefined,
            }),
          ),
          state: {
            id: source.id,
            status: "ok" as const,
            checkedAt: now,
            count: 0,
            message: "题录发现，不代表完成精读",
          },
        };
      } catch {
        return {
          items: [] as ResearchItem[],
          state: {
            id: source.id,
            status: "failed" as const,
            checkedAt: now,
            count: 0,
            message: "本次公开来源读取未完成",
          },
        };
      }
    }),
  );
  groups.forEach((group) => (group.state.count = group.items.length));
  const known = new Set(
    [...state.items, ...state.inbox].map((item) => item.sourceUrl),
  );
  const selected = selectCandidates(
    groups.map((group) => group.items),
    known,
    20,
  );
  const inbox = new Map(
    state.inbox.map((item) => [canonicalWorkId(item.sourceUrl), item]),
  );
  for (const item of selected) inbox.set(canonicalWorkId(item.sourceUrl), item);
  state.inbox = [...inbox.values()]
    .sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt))
    .slice(0, 2000);
  state.sources = groups.map((group) => group.state);
  const failed = state.sources.filter(
    (source) => source.status === "failed",
  ).length;
  record(
    state,
    "discovery",
    failed === groups.length ? "failed" : failed ? "partial" : "succeeded",
    `检查${groups.length}个公开入口，${failed}个未完成，${selected.length}条新候选。全文不足的内容不出刊。`,
  );
}

export async function runDaily(
  state: CloudState,
  reader: (candidate: ResearchItem) => Promise<ResearchItem>,
  options: { configured: boolean; checkpoint?: (state: CloudState) => void },
) {
  if (state.settings.paused) {
    record(state, "daily", "paused", "研究已暂停。");
    return;
  }
  if (state.budget.day !== day())
    state.budget = { day: day(), calls: 0, papers: 0 };
  state.readerStatus = options.configured ? "configured" : "not-configured";
  if (!options.configured) {
    record(
      state,
      "daily",
      "blocked",
      "模型密钥或PDF视觉模型未配置，仅保留来源发现，未执行自动精读。",
    );
    return;
  }
  let completed = 0,
    failed = 0;
  const queue = state.inbox
    .filter((item) => {
      const attempt = state.attempts[canonicalWorkId(item.sourceUrl)];
      return (
        !attempt ||
        (attempt.count < 3 && Date.parse(attempt.retryAfter) <= Date.now())
      );
    })
    .sort(
      (a, b) =>
        (state.attempts[canonicalWorkId(a.sourceUrl)]?.count || 0) -
          (state.attempts[canonicalWorkId(b.sourceUrl)]?.count || 0) ||
        Number(
          /安全|safety|alignment|injection|agent|jailbreak/i.test(b.title),
        ) -
          Number(
            /安全|safety|alignment|injection|agent|jailbreak/i.test(a.title),
          ),
    );
  for (const candidate of queue) {
    if (
      state.budget.calls + 2 > 8 ||
      state.budget.papers >= state.settings.maxDailyPapers
    )
      break;
    // Reserve both original-source calls before the reader starts; no automatic retries.
    state.budget.calls += 2;
    const key = canonicalWorkId(candidate.sourceUrl);
    const count = (state.attempts[key]?.count || 0) + 1;
    state.attempts[key] = {
      count,
      retryAfter: new Date(Date.now() + count * 86400000).toISOString(),
    };
    options.checkpoint?.(state);
    try {
      const item = validateResearchItem(await reader(candidate));
      if (
        item.status !== "ready" ||
        canonicalWorkId(item.sourceUrl) !== canonicalWorkId(candidate.sourceUrl)
      )
        throw Error("阅读契约失败");
      const work = canonicalWorkId(item.sourceUrl);
      state.items = [
        item,
        ...state.items.filter((old) => canonicalWorkId(old.sourceUrl) !== work),
      ];
      state.inbox = state.inbox.filter(
        (old) => canonicalWorkId(old.sourceUrl) !== work,
      );
      delete state.attempts[work];
      state.budget.papers++;
      completed++;
    } catch {
      failed++;
      state.readerStatus = "failed";
      const item = state.inbox.find(
        (item) => item.sourceUrl === candidate.sourceUrl,
      );
      if (item) {
        item.status = "awaiting-review";
        item.qualityNotes =
          "全文获取、模型调用或原文复核未完成，尚未发布正式介绍。";
      }
    }
    options.checkpoint?.(state);
  }
  record(
    state,
    "daily",
    failed ? "partial" : completed ? "succeeded" : "blocked",
    `本次完成${completed}项原文双轮研究，${failed}项待复核；今日模型调用预算${state.budget.calls}/8，研究上限${state.settings.maxDailyPapers}项。`,
  );
}

function normalized(value: string) {
  return value
    .normalize("NFKC")
    .replace(/-\s*\n\s*/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}
const coverageSchema = z.object({
  pagesRead: z.array(z.number().int().positive()).max(40),
  figures: z
    .array(
      z.object({
        label: z.string(),
        page: z.number().int().positive(),
        explanation: z.string().min(10),
        section: z.enum(["main", "appendix"]).default("main"),
      }),
    )
    .max(100)
    .default([]),
  tables: z
    .array(
      z.object({
        label: z.string(),
        page: z.number().int().positive(),
        explanation: z.string().min(10),
        section: z.enum(["main", "appendix"]).default("main"),
      }),
    )
    .max(100)
    .default([]),
});
export function verifyReading(
  candidate: ResearchItem,
  value: unknown,
  source: SourceDocument,
): ResearchItem {
  const review = z
    .object({
      approved: z.boolean(),
      issues: z.array(z.string()).default([]),
      item: z.unknown(),
      coverage: coverageSchema,
    })
    .parse(value);
  if (!review.approved || review.issues.length)
    throw Error("独立原文审校未通过");
  const covered = new Set(review.coverage.pagesRead);
  if (
    covered.size !== source.pages.length ||
    source.pages.some((_, i) => !covered.has(i + 1))
  )
    throw Error("正文页覆盖不完整");
  const parsed = itemSchema.parse(review.item);
  if (!parsed.evidence.length) throw Error("原文证据缺失");
  let quotedWords = 0;
  for (const evidence of parsed.evidence) {
    const target = new URL(evidence.url);
    target.hash = "";
    if (target.href !== source.url)
      throw Error("证据必须指向本次实际读取的原件");
    const page =
      candidate.type === "paper"
        ? Number(evidence.locator.match(/PDF\s*p\.\s*(\d+)/i)?.[1])
        : 1;
    if (
      !page ||
      !source.pages[page - 1] ||
      !evidence.excerpt?.trim() ||
      !normalized(source.pages[page - 1]).includes(normalized(evidence.excerpt))
    )
      throw Error("证据引文或页码无法在原文定位");
    quotedWords += evidence.excerpt.split(/\s+/).length;
  }
  if (quotedWords > 25) throw Error("单一来源直接引文总量超限");
  if (candidate.type === "paper") {
    const reading = parsed.reading;
    if (
      !reading ||
      review.coverage.figures.filter((x) => x.section === "main").length !==
        reading.totalMainFigures ||
      review.coverage.tables.filter((x) => x.section === "main").length !==
        reading.totalMainTables
    )
      throw Error("图表覆盖记录不足");
    const inventories = [...review.coverage.figures, ...review.coverage.tables];
    const label = (value: string) =>
      normalized(value)
        .replace(/^fig\.?\s+/, "figure ")
        .replace(/[.:|]$/, "")
        .trim();
    if (
      new Set(inventories.map((entry) => label(entry.label))).size !==
      inventories.length
    )
      throw Error("图表标签重复，不能充当完整覆盖");
    for (const entry of inventories)
      if (
        !source.pages[entry.page - 1] ||
        !normalized(source.pages[entry.page - 1]).includes(
          normalized(entry.label),
        )
      )
        throw Error("图表标签或页码无法在原文定位");
    const captions = [
      ...source.pages
        .join("\n")
        .matchAll(/\b(?:Figure|Fig\.?|Table)\s+[A-Z]?\d+(?:\.\d+)?\b/gi),
    ].map((match) => label(match[0]));
    if (
      captions.some(
        (label) =>
          !inventories.some(
            (entry) =>
              normalized(entry.label).replace(/^fig\.?\s+/, "figure ") ===
              label,
          ),
      )
    )
      throw Error("已识别的原文图表未全部覆盖");
  }
  return validateResearchItem({
    ...parsed,
    id: candidate.id,
    type: candidate.type,
    category: candidate.category,
    sourceName: candidate.sourceName,
    sourceUrl: candidate.sourceUrl,
    fulltextUrl: candidate.type === "paper" ? source.url : undefined,
    publishedAt: candidate.publishedAt,
    reviewedAt: new Date().toISOString(),
    status: "ready",
    sourceCoverage:
      candidate.type === "paper" ? "full-paper" : "primary-source",
    priorWork: [],
    qualityNotes:
      parsed.qualityNotes +
      "\nAI两次读取同一原件并核对可定位证据；未独立复现实验，也未逐篇核查引用前作。",
  });
}

export function brief(state: CloudState, mode: "daily" | "weekly") {
  const items = state.items.filter(
    (item) =>
      item.status === "ready" &&
      Date.parse(item.reviewedAt) >=
        Date.now() - (mode === "weekly" ? 7 : 1) * 86400000,
  );
  const heading = mode === "weekly" ? "每周研究材料回顾" : "每日研究简报";
  return `# ${heading} · ${day()}\n\n${state.runs[0]?.message || "暂无执行记录"}\n\n${items.length ? items.map((item) => `## ${item.title}\n\n原文日期：${item.publishedAt}；AI核查：${item.reviewedAt}\n\n${item.summary}\n\n局限：${item.limitations.join("；")}\n\n[原始来源](${item.sourceUrl})\n`).join("\n") : "没有新完成的原文精读；不以摘要或题录填充。"}\n\n候选${state.inbox.length}项。技术演变判断仍须新增证据支持，不自动编造继承或反驳关系。\n`;
}
