import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium } from "playwright";
import { createWorkbench } from "../../local/server.ts";
import { exampleRecord } from "../reading-fixture.ts";

let browser;
before(async () => {
  browser = await chromium.launch({ channel: process.env.FRONTIER_BROWSER_CHANNEL });
});
after(async () => { await browser?.close(); });

async function setup(t) {
  const folder = await mkdtemp(join(tmpdir(), "frontier-ui-test-"));
  const app = await createWorkbench({ folder, port: 0 });
  const page = await browser.newPage();
  page.setDefaultTimeout(2500);
  t.after(async () => {
    await page.close();
    await app.close();
    await rm(folder, { recursive: true, force: true });
  });
  // Synthetic records stay in this isolated process, never in real archives.
  app.agent.records = ["A", "B"].map((id) => {
    const record = exampleRecord();
    record.source.id = id;
    record.source.title = `测试资料 ${id}`;
    record.mechanism.steps = [`测试机制 ${id}`];
    return {
      fingerprint: id,
      completedAt: "2026-10-22T00:00:00Z",
      record,
      source: {
        id, url: "https://arxiv.org/abs/2601.12345", title: record.source.title,
        version: "v1", kind: "technical-note", scope: "full", lines: 3,
        fetchedAt: "2026-10-22T00:00:00Z", gaps: [], text: `L1 测试原文 ${id}`,
      },
    };
  });
  return { app, page };
}

async function uiSettled(page) {
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}

test("清除请求失败时保留个人表单，并且不宣称清除成功", async (t) => {
  const { app, page } = await setup(t);
  app.agent.setProfile({ role: "developer", topic: "", goal: "测试中的目标", depth: "technical" });
  await page.route("**/api/action", (route) => route.fulfill({
    status: 400, json: { error: "测试：清除失败" },
  }));
  await page.goto(app.url);
  await page.locator(".wb-prose").waitFor();
  await page.getByRole("button", { name: "清除个人会话", exact: true }).click();
  await page.getByRole("alert").waitFor();
  await uiSettled(page);
  assert.equal(await page.getByRole("status").count(), 0);
  assert.equal(await page.getByLabel("当前工作目标").inputValue(), "测试中的目标");
  assert.equal(app.agent.profile.goal, "测试中的目标");
});

test("服务端清除成功但状态刷新失败时立即移除旧个人内容，重连后不恢复", async (t) => {
  const { app, page } = await setup(t);
  app.agent.setProfile({ role: "safety", topic: "测试主题", goal: "清除后不能残留的目标", depth: "technical" });
  let failState = false;
  await page.route("**/api/state", (route) => failState
    ? route.fulfill({ status: 503, json: { error: "测试：状态暂不可用" } })
    : route.continue());
  await page.route("**/api/action", async (route) => {
    const response = await route.fetch();
    if (route.request().postDataJSON().action === "clear-personal") failState = true;
    await route.fulfill({ response });
  });
  await page.goto(app.url);
  await page.locator(".wb-prose").waitFor();
  await page.getByRole("button", { name: "清除个人会话", exact: true }).click();
  await page.getByRole("alert").waitFor();
  await uiSettled(page);
  assert.equal(app.agent.profile.goal, "");
  assert.equal(await page.getByLabel("当前工作目标").count(), 0);
  assert.doesNotMatch(await page.locator("body").innerText(), /清除后不能残留的目标|AI 安全算法工程师视图/);
  assert.match(await page.getByRole("status").innerText(), /已清除/);
  failState = false;
  await page.getByLabel("当前工作目标").waitFor({ timeout: 6000 });
  assert.equal(await page.getByLabel("当前工作目标").inputValue(), "");
  assert.equal(await page.getByLabel("关注主题").inputValue(), "");
  await page.locator(".wb-viewlabel").filter({ hasText: "开发工程师视图" }).waitFor();
});

for (const [resource, tab, content, expected] of [
  ["view", "为我解读", ".wb-prose", "测试机制 B"],
  ["source", "已读原文", ".wb-sourcetext", "L1 测试原文 B"],
]) {
  test(`切换资料后忽略过期的 ${resource} 响应`, async (t) => {
    const { app, page } = await setup(t);
    let release;
    const gate = new Promise((resolve) => { release = resolve; });
    let intercepted;
    const pending = new Promise((resolve) => { intercepted = resolve; });
    t.after(() => release());
    await page.route(`**/api/${resource}/A`, async (route) => {
      const response = await route.fetch();
      intercepted();
      await gate;
      await route.fulfill({ response }).catch(() => {});
    });
    await page.goto(app.url);
    if (resource === "source") await page.getByRole("button", { name: tab, exact: true }).click();
    await pending;
    await page.locator(".wb-record").filter({ hasText: "测试资料 B" }).click();
    if (resource === "source") await page.getByRole("button", { name: tab, exact: true }).click();
    await page.locator(content).filter({ hasText: expected }).waitFor();
    release();
    // The delayed response must have a chance to commit before the assertion.
    await page.unrouteAll({ behavior: "wait" });
    await uiSettled(page);
    assert.equal(await page.locator(content).innerText(), expected);
  });

  test(`${resource} 加载失败有明确提示，且可重试恢复`, async (t) => {
    const { app, page } = await setup(t);
    await page.route(`**/api/${resource}/A`, (route) => route.fulfill({
      status: 503, json: { error: "测试：读取暂时失败" },
    }));
    await page.goto(app.url);
    if (resource === "source") await page.getByRole("button", { name: tab, exact: true }).click();
    await page.locator(".wb-readerbody").getByRole("alert").waitFor();
    assert.equal(await page.locator(content).count(), 0);
    await page.unroute(`**/api/${resource}/A`);
    await page.getByRole("button", { name: "重试", exact: true }).click();
    await page.locator(content).filter({ hasText: resource === "source" ? "L1 测试原文 A" : "测试机制 A" }).waitFor();
  });
}

test("普通轮询保留未提交草稿；服务重启后清除上一进程的个人草稿", async (t) => {
  const { app, page } = await setup(t);
  let restarted = false;
  await page.route("**/api/state", async (route) => {
    const response = await route.fetch();
    const state = await response.json();
    if (restarted) state.sessionToken = "synthetic-restarted-session";
    await route.fulfill({ json: state });
  });
  await page.goto(app.url);
  await page.getByLabel("当前工作目标").fill("未提交的测试草稿");
  await page.waitForResponse((r) => r.url().endsWith("/api/state"), { timeout: 6000 });
  await uiSettled(page);
  assert.equal(await page.getByLabel("当前工作目标").inputValue(), "未提交的测试草稿");
  restarted = true;
  await page.waitForResponse((r) => r.url().endsWith("/api/state"), { timeout: 6000 });
  await uiSettled(page);
  assert.equal(await page.getByLabel("当前工作目标").inputValue(), "");
});

test("清除成功后，较早发出的轮询不能恢复旧目标和旧岗位视图", async (t) => {
  const { app, page } = await setup(t);
  app.agent.setProfile({ role: "safety", topic: "", goal: "应被清除的测试目标", depth: "technical" });
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  let intercepted;
  const pending = new Promise((resolve) => { intercepted = resolve; });
  t.after(() => release());
  let requests = 0;
  await page.route("**/api/state", async (route) => {
    const response = await route.fetch();
    if (++requests === 2) {
      intercepted();
      await gate;
    }
    await route.fulfill({ response }).catch(() => {});
  });
  await page.goto(app.url);
  await pending;
  await page.getByRole("button", { name: "清除个人会话", exact: true }).click();
  await page.locator(".wb-viewlabel").filter({ hasText: "开发工程师视图" }).waitFor();
  assert.equal(app.agent.profile.goal, "");
  release();
  await page.unrouteAll({ behavior: "wait" });
  await uiSettled(page);
  assert.match(await page.locator(".wb-viewlabel").innerText(), /开发工程师视图/);
  assert.equal(await page.getByLabel("当前工作目标").inputValue(), "");
});

test("状态请求慢于轮询间隔时，首个成功响应仍能打开工作台", async (t) => {
  const { app, page } = await setup(t);
  let releaseFirst, releaseRest;
  const first = new Promise((resolve) => { releaseFirst = resolve; });
  const rest = new Promise((resolve) => { releaseRest = resolve; });
  let requests = 0;
  await page.route("**/api/state", async (route) => {
    const response = await route.fetch();
    await (++requests === 1 ? first : rest);
    await route.fulfill({ response }).catch(() => {});
  });
  try {
    await page.goto(app.url);
    // Deliberately hold the first response across the four-second poll interval.
    await page.waitForTimeout(4500);
    releaseFirst();
    await page.getByRole("heading", { name: "理解前沿，找到工作中的下一步。" }).waitFor();
  } finally {
    releaseFirst();
    releaseRest();
    await page.unrouteAll({ behavior: "wait" });
  }
});
