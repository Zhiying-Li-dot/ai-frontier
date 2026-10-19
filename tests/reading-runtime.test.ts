import test from "node:test";
import assert from "node:assert/strict";
import { validateRecord } from "../local/record.ts";
import { extractHtml, fetchSource } from "../local/source.ts";
import { codexArguments } from "../local/model.ts";

import { exampleRecord } from "./reading-fixture.ts";
test("阅读契约拒绝悬空证据、材料矛盾和伪实验", () => {
  const r = exampleRecord();
  assert.equal(validateRecord(r).skill.version, "1.0.0");
  const dangling = structuredClone(r);
  dangling.claims[0].evidenceIds = ["missing"];
  assert.throws(() => validateRecord(dangling), /证据/);
  const missing = structuredClone(r);
  missing.source.materials[0].availability = "missing";
  assert.throws(() => validateRecord(missing), /材料/);
  const fake = structuredClone(r);
  fake.claims[0].supportStatus = "independently-tested";
  assert.throws(() => validateRecord(fake), /实验/);
  const partial = structuredClone(r);
  partial.source.synthetic = false;
  partial.source.scope = "partial";
  partial.publication.decision = "review-ready";
  assert.throws(() => validateRecord(partial), /完整/);
});
test("抓取范围和证据定位必须与模型记录相符", () => {
  const r = exampleRecord();
  assert.throws(
    () =>
      validateRecord(r, {
        id: "different",
        version: "v1",
        scope: "full",
        lines: 3,
      }),
    /来源/,
  );
  assert.throws(
    () =>
      validateRecord(r, {
        id: "source-1",
        version: "v1",
        scope: "full",
        lines: 0,
      }),
    /定位/,
  );
});
test("网页保留可定位文本、移除执行内容，图片造成覆盖缺口", () => {
  const s = extractHtml(
    '<script>bad()</script><nav>menu</nav><main><h1>Mechanism</h1><p>Two steps.</p><img src="chart.png"><p>Conditions apply.</p></main>',
  );
  assert.ok(s.text.includes("Mechanism"));
  assert.ok(!s.text.includes("bad()"));
  assert.ok(!s.text.includes("menu"));
  assert.equal(s.unreadImages, true);
});
test("重定向不能请求未允许的本机地址", async () => {
  let calls = 0;
  await assert.rejects(
    () =>
      fetchSource("https://arxiv.org/abs/2601.12345", async () => {
        calls++;
        return new Response(null, {
          status: 302,
          headers: { location: "http://127.0.0.1/secret" },
        });
      }),
    /允许/,
  );
  assert.equal(calls, 1);
});
test("本机模型禁用执行和外部工具，不接受调用者注入配置", () => {
  const args = codexArguments("/tmp/work");
  assert.ok(args.includes("--ignore-user-config"));
  assert.ok(args.includes("read-only"));
  assert.ok(args.includes("--ephemeral"));
  for (const f of [
    "shell_tool",
    "unified_exec",
    "apps",
    "plugins",
    "browser_use",
    "computer_use",
    "multi_agent",
  ])
    assert.ok(args.includes(f));
  assert.ok(args.includes('web_search="disabled"'));
  assert.ok(!args.some((a) => a.includes("dangerously")));
});

test("本机文字阅读器拒绝伪造独立实验证据和图片已读状态", () => {
  const r = exampleRecord();
  r.source.synthetic = false;
  const boundary = { id: "source-1", version: "v1", scope: "full", lines: 3 };
  r.evidence[0].kind = "independent-test";
  assert.throws(() => validateRecord(r, boundary), /独立实验/);
  r.evidence[0].kind = "statement";
  r.source.materials.push({
    id: "fig1",
    kind: "figure",
    availability: "present",
    inspection: "read",
    locator: "L1",
    reason: null,
  });
  assert.throws(() => validateRecord(r, boundary), /图片/);
});

test("空主张或核心步骤阻塞时不能进入待事实复核", () => {
  const r = exampleRecord();
  r.source.synthetic = false;
  r.publication.decision = "review-ready";
  r.publication.tier = "research-analysis";
  r.publication.blockingGaps = [];
  const empty = structuredClone(r);
  empty.claims[0].text = "   ";
  empty.evidence[0].observation = "";
  assert.throws(() => validateRecord(empty), /String|字符|empty|least/i);
  r.execution.steps[3] = {
    id: "mechanism",
    status: "blocked",
    output: null,
    reason: "核心机制尚未获取",
  };
  r.mechanism.steps = [];
  assert.throws(() => validateRecord(r), /核心/);
});
