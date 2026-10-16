import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { projectPublic } from "../scripts/public-data.ts";
import { readLocal, writeLocal } from "../src/storage.js";
import { filterItems } from "../lib/research.ts";
const seed = JSON.parse(readFileSync("lib/seed-data.json", "utf8"));
test("公开投影排除账号、密钥、个人状态和任务内部设置", () => {
  const result = projectPublic({
    items: seed.items,
    inbox: [],
    sources: [],
    runs: [],
    updatedAt: new Date().toISOString(),
    readerStatus: "not-configured",
    users: [{ email: "private@example.com" }],
    states: [{ saved: true }],
    OPENAI_API_KEY: "private-value",
  });
  const text = JSON.stringify(result);
  assert.ok(!text.includes("private@example.com"));
  assert.ok(!text.includes("private-value"));
  assert.ok(!text.includes('"states"'));
  assert.equal(result.items.length, 3);
  assert.equal(result.readerConfigured, false);
});
test("声称ready但缺全文证据时阻止构建发布", () => {
  assert.throws(
    () =>
      projectPublic({
        items: [{ ...seed.items[0], reading: undefined }],
        inbox: [],
      }),
    /全文|图表|精读/,
  );
});
test("候选始终只展示题录，不夹带摘要、分析或所谓证据", () => {
  const r = projectPublic({
    items: [],
    inbox: [
      {
        ...seed.items[0],
        status: "awaiting-review",
        summary: "not reviewed",
        analysis: "unverified",
        evidence: seed.items[0].evidence,
      },
    ],
  });
  assert.equal(r.pending.length, 1);
  assert.equal(r.pending[0].summary, undefined);
  assert.equal(r.pending[0].analysis, undefined);
  assert.equal(r.pending[0].evidence, undefined);
});
test("损坏和禁用的本机存储不影响阅读，并明确报告无法保存", () => {
  const broken = {
    getItem() {
      return "{bad";
    },
    setItem() {
      throw Error("disabled");
    },
  };
  assert.deepEqual(readLocal(broken), {});
  assert.equal(writeLocal(broken, { a: { saved: true } }), false);
  assert.deepEqual(
    readLocal({
      getItem() {
        return JSON.stringify({
          bad: { saved: "true" },
          good: { saved: true, read: true },
          extra: { password: "x" },
        });
      },
    }),
    { good: { saved: true, read: true } },
  );
});

test("已完成和已撤回候选不会被标成待精读", () => {
  const r = projectPublic({
    items: [],
    inbox: [seed.items[0], { ...seed.items[0], status: "withdrawn" }],
  });
  assert.equal(r.pending.length, 0);
});
test("日期筛选比较实际时间，来源搜索覆盖正式研究", () => {
  const item = { ...seed.items[0], publishedAt: "2026-10-02T20:00:00Z" };
  assert.equal(
    filterItems([item], { publishedSince: "2026-10-02T08:00:00Z" }).length,
    1,
  );
  assert.equal(filterItems([item], { query: item.sourceName }).length, 1);
});
