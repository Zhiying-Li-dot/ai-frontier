import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  FrontierAgent,
  deriveView,
  evaluatePolicy,
  reserveCall,
} from "../local/agent.ts";
import { exampleRecord } from "./reading-fixture.ts";

test("不同岗位视图和个人反馈不改中立事实，也不传给阅读器", async () => {
  const folder = await mkdtemp(join(tmpdir(), "frontier-agent-test-"));
  try {
    let provided: any;
    const agent = new FrontierAgent(folder, {
      reader: async (source) => {
        provided = source;
        const r = exampleRecord();
        r.source.synthetic = false;
        r.source.id = source.id;
        r.source.version = source.version;
        return r;
      },
      fetcher: async (url) => ({
        id: "source-1",
        url,
        title: "公开来源",
        kind: "blog",
        fetchedAt: new Date().toISOString(),
        version: "v1",
        scope: "full",
        text: "L1 public\nL2 mechanism\nL3 report",
        lines: 3,
        gaps: [],
      }),
    });
    await agent.initialize();
    agent.setProfile({
      role: "developer",
      goal: "我的私有目标",
      topic: "Agent",
      depth: "technical",
    });
    await agent.startReading("https://arxiv.org/abs/2601.12345");
    await agent.waitForIdle();
    const first = agent.snapshot();
    assert.equal(first.jobs[0].status, "completed");
    assert.ok(!JSON.stringify(provided).includes("私有目标"));
    const hash = first.records[0].fingerprint;
    const d = agent.view(hash);
    assert.ok(d.workSuggestion.includes("集成"));
    agent.setProfile({
      role: "safety",
      goal: "评估攻击边界",
      topic: "Agent",
      depth: "deep",
    });
    const s = agent.view(hash);
    assert.ok(s.workSuggestion.includes("攻击"));
    assert.equal(agent.snapshot().records[0].fingerprint, hash);
    const p = agent.feedback(hash, "too-shallow");
    assert.equal(p.status, "proposed");
    assert.throws(() => agent.adopt(p.id), /检查/);
    agent.evaluate(p.id);
    agent.adopt(p.id);
    assert.equal(agent.view(hash).policyVersion, 1);
    agent.rollback();
    assert.equal(agent.view(hash).policyVersion, 0);
    agent.feedback(hash, "error");
    assert.equal(agent.snapshot().corrections.length, 1);
    assert.equal(agent.snapshot().records[0].fingerprint, hash);
    agent.clearPersonal();
    assert.equal(agent.snapshot().profile.goal, "");
    assert.equal(agent.snapshot().policies.length, 0);
    const restarted = new FrontierAgent(folder);
    await restarted.initialize();
    assert.equal(restarted.snapshot().profile.goal, "");
    assert.equal(restarted.snapshot().records.length, 1);
    assert.equal(
      (await stat(join(folder, "records", hash + ".json"))).mode & 0o777,
      0o600,
    );
  } finally {
    await rm(folder, { recursive: true, force: true });
  }
});
test("日预算跨重启生效，最多八次，错误不退回调用额度", async () => {
  const folder = await mkdtemp(join(tmpdir(), "frontier-budget-test-"));
  try {
    for (let i = 0; i < 8; i++)
      assert.equal(reserveCall(folder, "2026-10-19"), i + 1);
    assert.throws(() => reserveCall(folder, "2026-10-19"), /额度/);
    assert.equal(reserveCall(folder, "2026-10-20"), 1);
  } finally {
    await rm(folder, { recursive: true, force: true });
  }
});
test("固定检查样例来自其他材料，失败不会许可采用", () => {
  const p = {
    id: "p",
    version: 1,
    previousVersion: 0,
    depth: "deep",
    scope: "Agent",
    status: "proposed",
    sourceFingerprint: "x",
    kind: "too-shallow",
  };
  const result = evaluatePolicy(p as any);
  assert.ok(result.cases.length >= 2);
  assert.ok(result.cases.every((c) => c.sourceFingerprint !== "x"));
  assert.equal(result.efficacyProven, false);
});
