import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fetchSource, sha } from "../../local/source.ts";
import { FrontierAgent } from "../../local/agent.ts";

const mock = process.env.FRONTIER_SOURCE_MOCK || "http://127.0.0.1:4918/arxiv";
// Use real HTTP and response bodies; only the upstream destination is redirected.
const transport: typeof fetch = (url, options) => {
  const target = new URL(String(url));
  return fetch(mock + target.pathname + target.search, options);
};

for (const [input, pdf] of [
  ["https://arxiv.org/abs/2601.12345v2", "https://arxiv.org/pdf/2601.12345v2.pdf"],
  ["https://export.arxiv.org/abs/hep-th/9901001v3?fmt=txt", "https://export.arxiv.org/pdf/hep-th/9901001v3.pdf"],
]) {
  test(`摘要链接读取对应版本正文：${input}`, async () => {
    const source = await fetchSource(input, transport);
    assert.equal(source.url, pdf);
    assert.equal(source.id, sha(input).slice(0, 24));
    assert.equal(source.kind, "paper");
    assert.match(source.text, /SYNTHETIC BODY ONLY/);
    assert.equal(source.title, "Synthetic reader fixture");
    assert.equal(source.scope, "partial");
    assert.ok(source.gaps.some((gap) => /图|表/.test(gap)));
  });
}

test("合法PDF重定向继续提取正文，私有地址重定向被拒绝", async () => {
  const source = await fetchSource("https://arxiv.org/abs/2601.22222", transport);
  assert.equal(source.url, "https://arxiv.org/pdf/2601.12345v2");
  assert.match(source.text, /SYNTHETIC BODY ONLY/);
  await assert.rejects(() => fetchSource("https://arxiv.org/abs/2601.33333", transport), /允许/);
});

test("无扩展名PDF地址返回HTML时不能当成完整博客", async () => {
  await assert.rejects(() => fetchSource("https://arxiv.org/pdf/2601.44444", transport), /PDF|正文/);
});

test("PDF下载失败不退回摘要、不调用模型且不扣调用预算", async () => {
  const folder = await mkdtemp(join(tmpdir(), "frontier-paper-test-"));
  let modelCalls = 0;
  const agent = new FrontierAgent(folder, {
    fetcher: (url) => fetchSource(url, transport),
    reader: async () => { modelCalls++; throw Error("Reader must not run"); },
  });
  try {
    await agent.initialize();
    await agent.startReading("https://arxiv.org/abs/2601.55555");
    await agent.waitForIdle();
    const state = agent.snapshot();
    assert.equal(modelCalls, 0);
    assert.equal(state.budget.calls, 0);
    assert.equal(state.records.length, 0);
    assert.equal(state.jobs[0].status, "failed");
    assert.match(state.jobs[0].message, /404/);
  } finally {
    agent.close();
    await rm(folder, { recursive: true, force: true });
  }
});

test("缺少PDF工具时提供可操作提示，不暴露临时文件路径", async () => {
  const script = `
    import { fetchSource } from ${JSON.stringify(new URL("../../local/source.ts", import.meta.url).href)};
    try {
      await fetchSource('https://arxiv.org/pdf/2601.12345v2', (url, options) => fetch(${JSON.stringify(mock)} + new URL(url).pathname, options));
    } catch (error) { console.log(JSON.stringify({ message: error.message })); }
  `;
  const result = await promisify(execFile)(process.execPath, ["--input-type=module", "-e", script], {
    env: { ...process.env, PATH: "" }, timeout: 10000,
  });
  const message = JSON.parse(result.stdout).message;
  assert.match(message, /Poppler/);
  assert.match(message, /安装/);
  assert.doesNotMatch(message, /frontier-pdf-|source\.pdf|ENOENT/);
});

test("损坏PDF错误不会向用户暴露底层诊断和临时目录", async () => {
  await assert.rejects(() => fetchSource("https://arxiv.org/pdf/2601.77777", transport), (error: Error) => {
    assert.match(error.message, /PDF.*解析|PDF.*提取/);
    assert.doesNotMatch(error.message, /frontier-pdf-|source\.pdf|Syntax Error/);
    return true;
  });
});

test("超过40页的PDF继续被明确拒绝", async () => {
  await assert.rejects(() => fetchSource("https://arxiv.org/pdf/2601.66666", transport), /40/);
});
