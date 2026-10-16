import test from "node:test";
import assert from "node:assert/strict";
import { parseFeed, feedSources, validateFetchTarget } from "../lib/feeds.ts";

test("Atom论文提取真实日期和版本，不自动生成精读", () => {
  const items = parseFeed(
    feedSources[0],
    "<feed><entry><id>http://arxiv.org/abs/2404.13208v2</id><title>Instruction &amp; safety</title><published>2024-04-19T00:00:00Z</published><summary>Abstract only.</summary></entry></feed>",
  );
  assert.equal(items[0].title, "Instruction & safety");
  assert.equal(items[0].publishedAt, "2024-04-19T00:00:00.000Z");
  assert.equal(items[0].status, "awaiting-fulltext");
});
test("RSS实体与CDATA成为文本，不成为代码", () => {
  const items = parseFeed(
    feedSources[6],
    "<rss><item><title><![CDATA[Safe <b>research</b>]]></title><link>https://openai.com/index/research/</link><pubDate>Tue, 06 Oct 2026 10:00:00 GMT</pubDate><description>&lt;script&gt;bad&lt;/script&gt;</description></item></rss>",
  );
  assert.equal(items[0].title, "Safe research");
  assert.equal(items[0].sourceCoverage, "metadata-only");
});
test("XML实体扩展与不允许的目标拒绝处理", () => {
  assert.throws(
    () =>
      parseFeed(feedSources[0], '<!DOCTYPE feed [<!ENTITY x "bad">]><feed/>'),
    /DOCTYPE/,
  );
  for (const url of [
    "http://rss.arxiv.org/rss/cs.AI",
    "https://127.0.0.1/a",
    "https://rss.arxiv.org.evil.com/x",
    "https://openai.com:444/x",
  ])
    assert.throws(() => validateFetchTarget(url));
});

test("候选槽位跨来源分配并跳过已知版本，不饿死安全来源", async () => {
  const { selectCandidates } = await import("../lib/feeds.ts");
  const groups = feedSources.map((source, index) =>
    Array.from({ length: 15 }, (_, i) => ({
      sourceUrl: `https://arxiv.org/abs/2610.${String(index * 15 + i).padStart(5, "0")}`,
      source: source.id,
    })),
  );
  const selected = selectCandidates(
    groups,
    new Set([groups[0][0].sourceUrl]),
    20,
  );
  assert.equal(selected.length, 20);
  assert.ok(selected.some((item) => item.source === "alignment-forum"));
  assert.ok(selected.some((item) => item.source === "arxiv-cr"));
  assert.ok(
    !selected.some((item) => item.sourceUrl === groups[0][0].sourceUrl),
  );
  assert.equal(
    selectCandidates([[groups[0][1]], [groups[0][1]]], new Set(), 20).length,
    1,
  );
});

test("实际抓取器在重定向后重新校验目标，不请求私有地址", async () => {
  const { fetchFeed } = await import("../lib/feeds.ts");
  const original = globalThis.fetch;
  const requested: string[] = [];
  globalThis.fetch = async (input) => {
    requested.push(String(input));
    return new Response(null, {
      status: 302,
      headers: { Location: "https://127.0.0.1/private" },
    });
  };
  try {
    await assert.rejects(fetchFeed(feedSources[0]), /允许列表/);
    assert.deepEqual(requested, [feedSources[0].url]);
  } finally {
    globalThis.fetch = original;
  }
});
