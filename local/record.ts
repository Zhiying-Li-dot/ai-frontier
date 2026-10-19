import { z } from "zod";
const text = z.string().trim().min(1).max(6000),
  maybe = text.nullable(),
  list = z.array(text).max(40);
const obj = <T extends z.ZodRawShape>(shape: T) => z.object(shape).strict();
export const stepIds = [
  "purpose",
  "source",
  "problem",
  "mechanism",
  "evidence",
  "context",
  "validation",
  "transfer",
] as const;
const material = obj({
  id: text,
  kind: z.enum(["body", "figure", "table", "appendix", "code", "data"]),
  availability: z.enum(["present", "missing", "not-applicable"]),
  inspection: z.enum(["read", "unread", "not-applicable"]),
  locator: maybe,
  reason: maybe,
});
export const recordSchema = obj({
  schemaVersion: z.literal("1.0"),
  skill: obj({
    id: z.literal("technical-content-reading"),
    version: z.literal("1.0.0"),
  }),
  source: obj({
    id: text,
    kind: z.enum([
      "paper",
      "blog",
      "report",
      "documentation",
      "code",
      "technical-note",
      "other",
    ]),
    title: text,
    version: maybe,
    scope: z.enum(["metadata", "abstract", "partial", "full"]),
    locatorMode: z.enum(["page", "structure", "source-limited"]),
    synthetic: z.boolean(),
    materials: z.array(material).min(1).max(100),
  }),
  readingQuestion: maybe,
  problem: obj({
    task: maybe,
    comparison: maybe,
    successMeasure: maybe,
    assumptions: list,
  }),
  mechanism: obj({
    inputs: list,
    steps: list,
    outputs: list,
    unresolved: list,
  }),
  claims: z
    .array(
      obj({
        id: text,
        text,
        provenance: z.enum([
          "source-report",
          "external-fact",
          "analysis",
          "hypothesis",
        ]),
        evidenceIds: list,
        conditions: list,
        supportStatus: z.enum([
          "reported-only",
          "supported-in-source",
          "independently-tested",
          "unresolved",
        ]),
        unsupportedInterpretation: maybe,
      }),
    )
    .max(40),
  evidence: z
    .array(
      obj({
        id: text,
        locator: text,
        observation: text,
        kind: z.enum([
          "statement",
          "experiment",
          "proof",
          "implementation",
          "independent-test",
        ]),
        conditions: list,
        missingControls: list,
      }),
    )
    .max(80),
  context: obj({
    mode: z.enum(["source-only", "targeted-external", "externally-checked"]),
    relatedWork: list,
    noveltyStatus: text,
  }),
  limitations: obj({ authorStated: list, analystIdentified: list }),
  nextResearch: obj({
    hypothesis: maybe,
    minimalTest: maybe,
    falsifier: maybe,
    executionStatus: z.enum(["not-run", "run", "not-applicable"]),
  }),
  transfer: obj({
    conditions: list,
    workBenefitStatus: z.enum([
      "not-tested",
      "offline-tested",
      "observed-in-work",
    ]),
    unknowns: list,
  }),
  execution: obj({
    steps: z
      .array(
        obj({
          id: z.enum(stepIds),
          status: z.enum(["done", "blocked", "not-applicable"]),
          output: maybe,
          reason: maybe,
        }),
      )
      .length(8),
    externalChecksPerformed: list,
    experimentsPerformed: list,
  }),
  publication: obj({
    decision: z.enum(["hold", "review-ready"]),
    tier: z.enum([
      "candidate",
      "source-note",
      "research-analysis",
      "independent-validation",
    ]),
    blockingGaps: list,
    qualifications: list,
  }),
});
export type ReadingRecord = z.infer<typeof recordSchema>;
export type SourceBoundary = {
  id: string;
  version: string;
  scope: string;
  lines: number;
};
export function validateRecord(
  raw: unknown,
  boundary?: SourceBoundary,
): ReadingRecord {
  const r = recordSchema.parse(raw);
  for (const key of ["claims", "evidence"] as const)
    if (new Set(r[key].map((x) => x.id)).size !== r[key].length)
      throw Error("证据或主张 ID 重复");
  for (const m of r.source.materials) {
    if (
      (m.availability === "missing" && m.inspection !== "unread") ||
      (m.availability === "not-applicable" &&
        (m.inspection !== "not-applicable" || !m.reason)) ||
      (m.availability === "present" && m.inspection === "not-applicable")
    )
      throw Error("材料可用性与实际阅读状态矛盾");
  }
  if (
    r.execution.steps.some(
      (s, i) => s.id !== stepIds[i] || (s.status !== "done" && !s.reason),
    )
  )
    throw Error("八步记录顺序或阻塞原因缺失");
  const ids = new Set(r.evidence.map((e) => e.id));
  for (const c of r.claims) {
    if (c.evidenceIds.some((id) => !ids.has(id)))
      throw Error("主张引用不存在的证据");
    if (
      c.provenance === "external-fact" &&
      r.execution.externalChecksPerformed.length === 0
    )
      throw Error("没有执行外部核验");
    if (
      c.supportStatus === "independently-tested" &&
      r.execution.experimentsPerformed.length === 0
    )
      throw Error("没有执行独立实验");
  }
  if (
    (r.nextResearch.executionStatus === "run" ||
      r.transfer.workBenefitStatus !== "not-tested" ||
      r.publication.tier === "independent-validation") &&
    r.execution.experimentsPerformed.length === 0
  )
    throw Error("实验或实际收益没有执行依据");
  if (r.publication.decision === "review-ready") {
    const core = new Set([
      "purpose",
      "source",
      "problem",
      "mechanism",
      "evidence",
    ]);
    if (
      !r.problem.task ||
      !r.mechanism.steps.length ||
      r.execution.steps.some(
        (s) => core.has(s.id) && (s.status !== "done" || !s.output),
      )
    )
      throw Error("核心研究内容或步骤尚未完成，不能进入待事实复核");
    if (
      r.publication.tier === "research-analysis" &&
      !r.mechanism.outputs.length
    )
      throw Error("核心机制的输出尚未确定");
    if (
      r.source.synthetic ||
      r.source.scope !== "full" ||
      r.publication.blockingGaps.length ||
      !r.source.title ||
      !r.source.version
    )
      throw Error("来源不完整或存在阻塞，不能进入待复核");
    if (
      !r.source.materials.some(
        (m) => m.kind === "body" && m.inspection === "read",
      ) ||
      r.claims.length === 0 ||
      r.evidence.length === 0
    )
      throw Error("完整记录缺正文或证据");
    if (
      r.claims.some(
        (c) => c.provenance !== "hypothesis" && c.evidenceIds.length === 0,
      )
    )
      throw Error("完整主张缺少证据");
    if (r.publication.tier === "candidate") throw Error("候选不属于完整阅读");
    if (
      r.publication.tier !== "source-note" &&
      r.source.materials.some(
        (m) => m.availability === "present" && m.inspection !== "read",
      )
    )
      throw Error("完整分析仍有材料未读");
  }
  if (boundary) {
    if (r.evidence.some((e) => e.kind === "independent-test"))
      throw Error("本机阅读器没有执行独立实验，不能标注独立实验证据");
    if (
      r.source.materials.some(
        (m) => m.kind === "figure" && m.inspection === "read",
      )
    )
      throw Error("本机文字阅读器没有查看图片，不能标注图片已读");
    if (
      r.source.id !== boundary.id ||
      r.source.version !== boundary.version ||
      r.source.scope !== boundary.scope
    )
      throw Error("模型记录与实际来源范围不符");
    for (const e of r.evidence) {
      const match = /^L(\d+)(?:-L?(\d+))?$/.exec(e.locator);
      if (
        !match ||
        Number(match[1]) < 1 ||
        Number(match[2] || match[1]) > boundary.lines ||
        Number(match[2] || match[1]) < Number(match[1])
      )
        throw Error("证据定位超出提供的正文范围");
    }
    if (
      r.source.synthetic ||
      r.execution.externalChecksPerformed.length ||
      r.execution.experimentsPerformed.length ||
      r.context.mode !== "source-only" ||
      r.context.noveltyStatus !== "unverified" ||
      r.nextResearch.executionStatus === "run" ||
      r.transfer.workBenefitStatus !== "not-tested" ||
      r.claims.some(
        (c) =>
          c.provenance === "external-fact" ||
          c.supportStatus === "independently-tested",
      )
    )
      throw Error("本执行器没有进行外部比较、实验或实际工作验证");
  }
  return r;
}
