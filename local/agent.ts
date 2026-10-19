import { z } from "zod";
import { randomUUID } from "node:crypto";
import {
  mkdir,
  readFile,
  readdir,
  writeFile,
  rename,
  lstat,
  chmod,
} from "node:fs/promises";
import {
  openSync,
  closeSync,
  readFileSync,
  writeFileSync,
  renameSync,
  unlinkSync,
  fsyncSync,
} from "node:fs";
import { join } from "node:path";
import { readWithCodex } from "./model.ts";
import { fetchSource, sha } from "./source.ts";
import type { Source } from "./source.ts";
import { validateRecord } from "./record.ts";
import type { ReadingRecord } from "./record.ts";
import { isSafeSourceUrl } from "../lib/research.ts";

export const profileSchema = z
  .object({
    role: z.enum(["developer", "agent", "algorithm", "safety"]),
    goal: z.string().trim().max(500),
    topic: z.string().trim().max(80),
    depth: z.enum(["concise", "technical", "deep"]),
  })
  .strict();
type Profile = z.infer<typeof profileSchema>;
type Depth = Profile["depth"];
type Policy = {
  id: string;
  version: number;
  previousVersion: number;
  depth: Depth;
  scope: string;
  status: "proposed" | "checked" | "adopted" | "rejected" | "rolled-back";
  sourceFingerprint: string;
  kind: string;
  evaluation?: ReturnType<typeof evaluatePolicy>;
};
type Archive = {
  fingerprint: string;
  source: Source;
  record: ReadingRecord;
  completedAt: string;
  engine: "codex-cli";
};
type Job = {
  id: string;
  url: string;
  status: "fetching" | "reading" | "completed" | "failed";
  startedAt: string;
  message: string;
  fingerprint?: string;
};
type Basis = Pick<
  ReadingRecord,
  | "source"
  | "mechanism"
  | "claims"
  | "limitations"
  | "nextResearch"
  | "transfer"
>;
const freshProfile = (): Profile => ({
  role: "developer",
  goal: "",
  topic: "",
  depth: "technical",
});
const roleChecks = {
  developer: "集成接口、兼容性、回归测试与维护成本",
  agent: "工具调用、上下文、权限隔离与故障恢复",
  algorithm: "数据划分、公平基线、消融实验与重复测量",
  safety: "攻击者能力与预算、自适应攻击、正常任务效用和误报",
};
export function deriveView(record: Basis, profile: Profile, policy?: Policy) {
  const depth = policy?.depth || profile.depth;
  const steps =
    depth === "concise"
      ? record.mechanism.steps.slice(0, 2)
      : depth === "technical"
        ? record.mechanism.steps.slice(0, 3)
        : record.mechanism.steps;
  return {
    schemaVersion: "1.0",
    researchRef: { sourceId: record.source.id, version: record.source.version },
    policyVersion: policy?.version || 0,
    method: "本机模板适配；个人资料未发送给模型",
    scope: policy?.scope || profile.topic || "当前阅读",
    depth,
    explanation: steps.length ? steps.join("\n") : "机制描述不足，先补原文。",
    mechanismDetails: depth === "deep" ? record.mechanism : null,
    prerequisites: [
      "岗位只决定观察重点，不代表你已掌握或不掌握某项知识。",
      "如上述机制中有陌生概念，可用“难理解”反馈选择更简洁的下一版。",
    ],
    focus: roleChecks[profile.role],
    goal: profile.goal || "尚未填写工作目标，建议保持通用。",
    claims: (depth === "concise"
      ? record.claims.slice(0, 2)
      : depth === "technical"
        ? record.claims.slice(0, 3)
        : record.claims
    ).map((c) => ({
      text: c.text,
      evidenceIds: c.evidenceIds,
      provenance: c.provenance,
      conditions: c.conditions,
    })),
    workSuggestion: `先检查${roleChecks[profile.role]}。${record.nextResearch.minimalTest || "原文未提供可直接执行的方案，先明确可检验的问题。"}`,
    stoppingCondition:
      record.nextResearch.falsifier ||
      "停止条件尚未确定，先设定基线和可接受范围。",
    applicabilityConditions: record.transfer.conditions,
    unknowns: [
      ...record.transfer.unknowns,
      ...record.limitations.analystIdentified,
    ],
    workBenefitStatus: "not-tested",
    goalConnection: profile.goal
      ? `围绕你填写的“${profile.goal}”，先判断上述条件是否成立；这里尚未验证技术与目标的匹配程度。`
      : "填写目标后，会在此显示需要核对的工作条件。",
  };
}
// Frozen synthetic checks are separate from the material that received feedback.
// They test preservation and formatting, not comprehension or actual work benefit.
export function evaluatePolicy(policy: Policy) {
  const cases = [
    "fixed-synthetic-tool-boundary",
    "fixed-synthetic-data-split",
  ].map((id, i) => {
    const r: Basis = {
      source: {
        id,
        kind: "technical-note",
        title: "内部合成边界检查",
        version: "1",
        scope: "full",
        locatorMode: "structure",
        synthetic: true,
        materials: [],
      },
      mechanism: {
        inputs: ["输入"],
        steps: ["界定条件", "比较基线", "记录结果"],
        outputs: ["结果"],
        unresolved: [],
      },
      claims: [
        {
          id: "c",
          text: "合成条件下的作者报告",
          provenance: "source-report",
          evidenceIds: ["e"],
          conditions: ["限定条件"],
          supportStatus: "reported-only",
          unsupportedInterpretation: "不可推断真实收益",
        },
      ],
      limitations: { authorStated: [], analystIdentified: ["缺少实际验证"] },
      nextResearch: {
        hypothesis: null,
        minimalTest: "先检查条件",
        falsifier: null,
        executionStatus: "not-run",
      },
      transfer: {
        conditions: ["需独立基线"],
        workBenefitStatus: "not-tested",
        unknowns: ["实际效果未知"],
      },
    };
    const before = JSON.stringify(r);
    const view = deriveView(
      r,
      {
        role: i ? "safety" : "developer",
        goal: "",
        topic: "",
        depth: "technical",
      },
      policy,
    );
    const checks = {
      factsUnchanged: JSON.stringify(r) === before,
      evidenceRetained: view.claims.every((c) => c.evidenceIds.join() === "e"),
      uncertaintyRetained: view.unknowns.includes("实际效果未知"),
      benefitNotInvented: view.workBenefitStatus === "not-tested",
      separateCase: sha(id) !== policy.sourceFingerprint,
      requestedDepth: view.depth === policy.depth,
    };
    return {
      sourceFingerprint: sha(id),
      checks,
      passed: Object.values(checks).every(Boolean),
    };
  });
  return {
    evaluatorVersion: "preservation-v1",
    cases,
    passed: cases.every((c) => c.passed),
    efficacyProven: false,
    note: "仅检查独立合成样例中的事实、证据和未知状态保留；没有证明理解或工作收益改善。",
  };
}
function day() {
  return new Date(Date.now() + 8 * 3600000).toISOString().slice(0, 10);
}
function readBudget(folder: string) {
  try {
    const raw = JSON.parse(readFileSync(join(folder, "budget.json"), "utf8"));
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(raw.day) ||
      !Number.isInteger(raw.calls) ||
      raw.calls < 0 ||
      raw.calls > 8
    )
      throw Error();
    return raw as { day: string; calls: number };
  } catch (e: any) {
    if (e.code === "ENOENT") return { day: day(), calls: 0 };
    throw Error("本机预算记录损坏，已停止模型调用，请检查数据目录");
  }
}
export function reserveCall(folder: string, today = day()) {
  let lock: number;
  try {
    lock = openSync(join(folder, "budget.lock"), "wx", 0o600);
  } catch {
    throw Error(
      "另一个进程正在登记额度；未调用模型。若上次异常退出，请检查 budget.lock。",
    );
  }
  try {
    const old = readBudget(folder);
    const calls = old.day === today ? old.calls : 0;
    if (calls >= 8)
      throw Error("今日模型调用额度已用完（8 次）；失败调用同样计入");
    const temp = join(folder, "budget.next");
    const file = openSync(temp, "w", 0o600);
    try {
      writeFileSync(file, JSON.stringify({ day: today, calls: calls + 1 }));
      fsyncSync(file);
    } finally {
      closeSync(file);
    }
    renameSync(temp, join(folder, "budget.json"));
    return calls + 1;
  } finally {
    closeSync(lock);
    unlinkSync(join(folder, "budget.lock"));
  }
}
export class FrontierAgent {
  folder: string;
  profile: Profile = freshProfile();
  policies: Policy[] = [];
  activeVersion = 0;
  feedbackLog: { id: string; fingerprint: string; kind: string; at: string }[] =
    [];
  corrections: { id: string; fingerprint: string; status: string }[] = [];
  records: Archive[] = [];
  jobs: Job[] = [];
  busy: Promise<void> | null = null;
  controller: AbortController | null = null;
  reader: typeof readWithCodex;
  fetcher: typeof fetchSource;
  constructor(
    folder: string,
    options: {
      reader?: typeof readWithCodex;
      fetcher?: typeof fetchSource;
    } = {},
  ) {
    this.folder = folder;
    this.reader = options.reader || readWithCodex;
    this.fetcher = options.fetcher || fetchSource;
  }
  async initialize() {
    for (const dir of [this.folder, join(this.folder, "records")]) {
      await mkdir(dir, { recursive: true, mode: 0o700 });
      const info = await lstat(dir);
      if (info.isSymbolicLink() || !info.isDirectory())
        throw Error("本机数据目录必须是独立目录");
      await chmod(dir, 0o700);
    }
    for (const name of (await readdir(join(this.folder, "records")))
      .filter((n) => /^[a-f0-9]{64}\.json$/.test(n))
      .slice(-100)) {
      const file = join(this.folder, "records", name);
      const info = await lstat(file);
      if (!info.isFile() || info.isSymbolicLink() || info.size > 700000)
        continue;
      try {
        const a: Archive = JSON.parse(await readFile(file, "utf8"));
        validateRecord(a.record, {
          id: a.source.id,
          version: a.source.version,
          scope: a.source.scope,
          lines: a.source.lines,
        });
        if (
          sha(JSON.stringify(a.record)) !== a.fingerprint ||
          a.fingerprint + ".json" !== name ||
          !isSafeSourceUrl(a.source.url)
        )
          continue;
        this.records.push(a);
      } catch {
        /* Corrupt archives are excluded, never promoted. */
      }
    }
    this.records.sort((a, b) => b.completedAt.localeCompare(a.completedAt));
  }
  snapshot() {
    const b = readBudget(this.folder);
    return {
      profile: this.profile,
      policies: this.policies,
      activeVersion: this.activeVersion,
      feedback: this.feedbackLog,
      corrections: this.corrections,
      jobs: this.jobs,
      busy: !!this.busy,
      budget: { day: day(), calls: b.day === day() ? b.calls : 0, limit: 8 },
      records: this.records.map(({ source, record, ...a }) => ({
        ...a,
        source: { ...source, text: undefined },
        record,
      })),
      privacy: {
        personal: "memory-only",
        modelInput: "public-source-only",
        generatedBy: "Codex CLI",
        adaptation: "local-template",
      },
    };
  }
  setProfile(input: unknown) {
    this.profile = profileSchema.parse(input);
    this.policies = [];
    this.activeVersion = 0;
    this.feedbackLog = [];
    return this.profile;
  }
  archive(fingerprint: string) {
    const a = this.records.find((r) => r.fingerprint === fingerprint);
    if (!a) throw Error("没有找到这条真实阅读记录");
    return a;
  }
  view(fingerprint: string) {
    return deriveView(
      this.archive(fingerprint).record,
      this.profile,
      this.policies.find(
        (p) => p.version === this.activeVersion && p.status === "adopted",
      ),
    );
  }
  feedback(fingerprint: string, kind: string) {
    this.archive(fingerprint);
    if (
      ![
        "too-shallow",
        "too-deep",
        "irrelevant",
        "infeasible",
        "error",
        "useful",
      ].includes(kind)
    )
      throw Error("反馈类型不支持");
    if (this.feedbackLog.length >= 100)
      throw Error("本次个人会话记录已达 100 条，请清除后继续");
    const feedback = {
      id: randomUUID(),
      fingerprint,
      kind,
      at: new Date().toISOString(),
    };
    this.feedbackLog.unshift(feedback);
    if (kind === "error") {
      const c = {
        id: feedback.id,
        fingerprint,
        status: "待证据复核；不会改写中立事实",
      };
      this.corrections.unshift(c);
      return c;
    }
    if (kind === "useful")
      return {
        id: feedback.id,
        status: "recorded",
        message: "已记录满意反馈；尚未证明实际工作收益",
      };
    if (kind === "irrelevant" || kind === "infeasible")
      return {
        id: feedback.id,
        status: "needs-context",
        message:
          "请先修改工作目标或约束，再重新生成本机视图；没有自动推断个人偏好",
      };
    const depth: Depth = kind === "too-deep" ? "concise" : "deep";
    const p: Policy = {
      id: feedback.id,
      version: Math.max(0, ...this.policies.map((p) => p.version)) + 1,
      previousVersion: this.activeVersion,
      depth,
      scope: this.profile.topic || "当前目标",
      status: "proposed",
      sourceFingerprint: fingerprint,
      kind,
    };
    this.policies.unshift(p);
    return p;
  }
  policy(id: string) {
    const p = this.policies.find((p) => p.id === id);
    if (!p) throw Error("候选策略不存在或已随个人资料清除");
    return p;
  }
  evaluate(id: string) {
    const p = this.policy(id);
    if (p.status !== "proposed") throw Error("只能检查待检查的候选");
    p.evaluation = evaluatePolicy(p);
    p.status = p.evaluation.passed ? "checked" : "rejected";
    return p;
  }
  adopt(id: string) {
    const p = this.policy(id);
    if (p.status !== "checked" || !p.evaluation?.passed)
      throw Error("策略必须先通过独立样例检查，再由本人确认");
    if (p.previousVersion !== this.activeVersion)
      throw Error("当前策略已改变，请基于最新反馈重新提出候选");
    p.status = "adopted";
    this.activeVersion = p.version;
    return p;
  }
  reject(id: string) {
    const p = this.policy(id);
    if (p.status === "adopted") throw Error("已采用策略请使用回滚");
    p.status = "rejected";
    return p;
  }
  rollback() {
    const p = this.policies.find((p) => p.version === this.activeVersion);
    if (!p) throw Error("当前使用初始策略");
    p.status = "rolled-back";
    this.activeVersion = p.previousVersion;
    return { activeVersion: this.activeVersion };
  }
  clearPersonal() {
    this.profile = freshProfile();
    this.policies = [];
    this.activeVersion = 0;
    this.feedbackLog = [];
    this.corrections = [];
  }
  async startReading(url: string) {
    if (this.busy) throw Error("已有阅读任务在运行，请等它完成");
    if (!isSafeSourceUrl(url) || /[?&](?:token|key|auth|signature)=/i.test(url))
      throw Error("仅允许公开来源白名单中的 HTTPS 地址");
    const job: Job = {
      id: randomUUID(),
      url,
      status: "fetching",
      startedAt: new Date().toISOString(),
      message: "正在获取公开原文",
    };
    this.jobs.unshift(job);
    this.jobs = this.jobs.slice(0, 30);
    this.controller = new AbortController();
    this.busy = this.perform(job, this.controller.signal).finally(() => {
      this.busy = null;
      this.controller = null;
    });
    return job;
  }
  private async perform(job: Job, signal: AbortSignal) {
    try {
      const source = await this.fetcher(job.url);
      if (signal.aborted) throw Error("任务已取消");
      reserveCall(this.folder);
      job.status = "reading";
      job.message = "模型正在按八步 skill 阅读；个人资料不会发送";
      const raw = await this.reader(source, signal);
      const record = validateRecord(raw, {
        id: source.id,
        version: source.version,
        scope: source.scope,
        lines: source.lines,
      });
      const fingerprint = sha(JSON.stringify(record));
      const archive: Archive = {
        fingerprint,
        source,
        record,
        completedAt: new Date().toISOString(),
        engine: "codex-cli",
      };
      const target = join(this.folder, "records", fingerprint + ".json");
      await writeFile(target + ".next", JSON.stringify(archive, null, 2), {
        mode: 0o600,
      });
      await rename(target + ".next", target);
      this.records = [
        archive,
        ...this.records.filter((a) => a.fingerprint !== fingerprint),
      ].slice(0, 100);
      job.fingerprint = fingerprint;
      job.status = "completed";
      job.message =
        record.publication.decision === "hold"
          ? "阅读记录已保存，材料有缺口；未发布为完整精读"
          : "阅读记录已保存，等待事实复核；未自动公开发布";
    } catch (error: any) {
      job.status = "failed";
      job.message =
        error?.name === "ZodError"
          ? "模型记录未通过契约校验，已阻止入库；未自动重试"
          : String(error?.message || "阅读失败").slice(0, 400);
    }
  }
  async waitForIdle() {
    await this.busy;
  }
  close() {
    this.controller?.abort();
  }
}
