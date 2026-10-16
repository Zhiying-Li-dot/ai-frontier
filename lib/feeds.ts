import { isSafeSourceUrl, canonicalWorkId } from "./research.ts";

export const feedSources = [
  {
    id: "arxiv-ai",
    name: "arXiv · 人工智能",
    url: "https://rss.arxiv.org/rss/cs.AI",
    type: "paper",
    category: "capabilities",
  },
  {
    id: "arxiv-cl",
    name: "arXiv · 语言模型",
    url: "https://rss.arxiv.org/rss/cs.CL",
    type: "paper",
    category: "capabilities",
  },
  {
    id: "arxiv-lg",
    name: "arXiv · 机器学习",
    url: "https://rss.arxiv.org/rss/cs.LG",
    type: "paper",
    category: "capabilities",
  },
  {
    id: "arxiv-cr",
    name: "arXiv · 安全与隐私",
    url: "https://rss.arxiv.org/rss/cs.CR",
    type: "paper",
    category: "application-security",
  },
  {
    id: "arxiv-ma",
    name: "arXiv · 多智能体",
    url: "https://rss.arxiv.org/rss/cs.MA",
    type: "paper",
    category: "capabilities",
  },
  {
    id: "arxiv-cv",
    name: "arXiv · 多模态与视觉",
    url: "https://rss.arxiv.org/rss/cs.CV",
    type: "paper",
    category: "capabilities",
  },
  {
    id: "openai",
    name: "OpenAI · 研究与技术",
    url: "https://openai.com/news/rss.xml",
    type: "update",
    category: "capabilities",
  },
  {
    id: "deepmind",
    name: "Google DeepMind",
    url: "https://deepmind.google/blog/rss.xml",
    type: "update",
    category: "capabilities",
  },
  {
    id: "google-research",
    name: "Google Research",
    url: "https://research.google/blog/rss/",
    type: "update",
    category: "capabilities",
  },
  {
    id: "alignment-forum",
    name: "Alignment Forum",
    url: "https://www.alignmentforum.org/feed.xml",
    type: "update",
    category: "frontier-safety",
  },
  {
    id: "lesswrong",
    name: "LessWrong · 技术讨论",
    url: "https://www.lesswrong.com/feed.xml",
    type: "update",
    category: "frontier-safety",
  },
] as const;
export type FeedSource = (typeof feedSources)[number];

export function selectCandidates<T extends { sourceUrl: string }>(
  groups: T[][],
  knownUrls: Set<string>,
  limit = 20,
): T[] {
  const selected: T[] = [];
  const seenWorks = new Set<string>();
  const queues = groups.map((group) =>
    group.filter((item) => !knownUrls.has(item.sourceUrl)),
  );
  for (
    let row = 0;
    row < Math.max(0, ...queues.map((queue) => queue.length)) &&
    selected.length < limit;
    row++
  ) {
    for (const queue of queues) {
      const item = queue[row];
      if (!item || selected.length >= limit) continue;
      const work = canonicalWorkId(item.sourceUrl);
      if (seenWorks.has(work)) continue;
      seenWorks.add(work);
      selected.push(item);
    }
  }
  return selected;
}

export function validateFetchTarget(url: string): void {
  if (!isSafeSourceUrl(url)) throw new Error("来源目标不在允许列表");
}

function text(value: string): string {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<[^>]*>/g, " ")
    .replace(/&(?:amp|lt|gt|quot|apos|#39|#x[0-9a-f]+|#\d+);/gi, (entity) => {
      const named: Record<string, string> = {
        "&amp;": "&",
        "&lt;": "<",
        "&gt;": ">",
        "&quot;": '"',
        "&apos;": "'",
        "&#39;": "'",
      };
      if (named[entity]) return named[entity];
      const n = entity.startsWith("&#x")
        ? parseInt(entity.slice(3), 16)
        : parseInt(entity.slice(2), 10);
      return Number.isFinite(n) && n > 0 && n <= 0x10ffff
        ? String.fromCodePoint(n)
        : "";
    })
    .replace(/\s+/g, " ")
    .trim();
}
function field(block: string, tag: string): string {
  return text(
    block.match(
      new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, "i"),
    )?.[1] || "",
  );
}

export function parseFeed(source: FeedSource, body: string) {
  if (body.length > 2_000_000) throw new Error("来源内容超限");
  if (/<!DOCTYPE|<!ENTITY/i.test(body))
    throw new Error("DOCTYPE 或外部实体不允许");
  const blocks = [
    ...body.matchAll(
      /<(?:item|entry)(?:\s[^>]*)?>([\s\S]*?)<\/(?:item|entry)>/gi,
    ),
  ].slice(0, 15);
  if (!blocks.length && !/<(?:rss|feed|rdf:RDF)[\s>]/i.test(body))
    throw new Error("来源未返回受支持的 RSS/Atom");
  return blocks.flatMap(([, block]) => {
    const title = field(block, "title");
    let url =
      field(block, "link") ||
      block.match(/<link[^>]*href=["']([^"']+)["'][^>]*\/?\s*>/i)?.[1] ||
      field(block, "id");
    if (/^http:\/\/(?:www\.)?arxiv\.org\//.test(url))
      url = url.replace("http:", "https:");
    if (!title || !isSafeSourceUrl(url)) return [];
    const date = new Date(
      field(block, "published") ||
        field(block, "pubDate") ||
        field(block, "dc:date") ||
        field(block, "updated"),
    );
    if (
      !Number.isFinite(date.valueOf()) ||
      date.valueOf() > Date.now() + 86_400_000
    )
      return [];
    return [
      {
        id: canonicalWorkId(url)
          .replace(/[^a-zA-Z0-9._:-]/g, "-")
          .slice(0, 160),
        type: source.type,
        title: title.slice(0, 200),
        sourceName: source.name,
        sourceUrl: url,
        publishedAt: date.toISOString(),
        category: source.category,
        status: "awaiting-fulltext" as const,
        sourceCoverage: "metadata-only" as const,
      },
    ];
  });
}

export async function fetchFeed(source: FeedSource) {
  let url: string = source.url;
  for (let redirects = 0; redirects < 4; redirects++) {
    validateFetchTarget(url);
    const response = await fetch(url, {
      redirect: "manual",
      signal: AbortSignal.timeout(15000),
      headers: {
        Accept:
          "application/atom+xml, application/rss+xml, application/xml, text/xml",
        "User-Agent": "FrontierResearchDesk/1.0 (personal research)",
      },
    });
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get("location");
      if (!location) throw new Error("来源重定向缺少目标");
      url = new URL(location, url).href;
      continue;
    }
    if (!response.ok) throw new Error(`来源返回 HTTP ${response.status}`);
    const reader = response.body?.getReader();
    if (!reader) throw new Error("来源响应为空");
    let length = 0;
    let body = "";
    const decoder = new TextDecoder();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > 2_000_000) {
        await reader.cancel();
        throw new Error("来源内容超限");
      }
      body += decoder.decode(value, { stream: true });
    }
    body += decoder.decode();
    return parseFeed(source, body);
  }
  throw new Error("来源重定向次数超限");
}
