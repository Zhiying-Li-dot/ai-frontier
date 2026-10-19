import React, { useEffect, useState, useCallback } from "react";
import { createRoot } from "react-dom/client";
import {
  ArrowUpRight,
  ArrowRight,
  BookOpen,
  Activity,
  Layers,
  RefreshCw,
  Check,
  RotateCcw,
  Plus,
  Shield,
  SlidersHorizontal,
} from "lucide-react";
import "./workbench.css";
const roles = {
  developer: "开发工程师",
  agent: "Agent 工程师",
  algorithm: "AI 算法工程师",
  safety: "AI 安全算法工程师",
};
const depths = {
  concise: "简洁 · 先理解重点",
  technical: "技术 · 机制与证据",
  deep: "深入 · 条件与局限",
};
const steps = {
  purpose: "研究问题",
  source: "来源与覆盖",
  problem: "问题与假设",
  mechanism: "机制拆解",
  evidence: "主张与证据",
  context: "相关研究",
  validation: "可证伪验证",
  transfer: "工作迁移",
};
const feedbacks = [
  ["too-deep", "难理解"],
  ["too-shallow", "太浅 / 已了解"],
  ["irrelevant", "与工作无关"],
  ["infeasible", "建议不可执行"],
  ["error", "事实有误"],
  ["useful", "对我有用"],
];
const labels = {
  "source-report": "作者报告",
  analysis: "分析判断",
  hypothesis: "研究假设",
  "external-fact": "外部核验",
};
const friendlyDecision = (r) =>
  r.publication.decision === "hold" ? "待补材料" : "待事实复核";
function App() {
  const [data, setData] = useState(null),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [offline, setOffline] = useState(false),
    [acting, setActing] = useState(false);
  const [profile, setProfile] = useState(null),
    [selected, setSelected] = useState(""),
    [view, setView] = useState(null),
    [tab, setTab] = useState("overview"),
    [url, setUrl] = useState(""),
    [query, setQuery] = useState(""),
    [source, setSource] = useState(null);
  const refresh = useCallback(async () => {
    const r = await fetch("./api/state", { cache: "no-store" });
    if (!r.ok) throw Error("本机研究服务未连接");
    const d = await r.json();
    setData(d);
    setOffline(false);
    setProfile((p) => p || d.profile);
    setSelected((s) => s || d.records[0]?.fingerprint || "");
    return d;
  }, []);
  useEffect(() => {
    refresh().catch(() => setOffline(true));
    if (window.location.hostname !== "127.0.0.1") return;
    const t = setInterval(() => refresh().catch(() => setOffline(true)), 4000);
    return () => clearInterval(t);
  }, [refresh]);
  const record = data?.records.find((r) => r.fingerprint === selected);
  useEffect(() => {
    if (!selected || !data) return;
    fetch("./api/view/" + selected)
      .then((r) => r.json())
      .then(setView)
      .catch(() => {});
  }, [selected, data?.activeVersion, JSON.stringify(data?.profile)]);
  useEffect(() => {
    setSource(null);
    if (tab === "source" && selected)
      fetch("./api/source/" + selected)
        .then((r) => r.json())
        .then((x) => setSource(x.source))
        .catch(() => {});
  }, [selected, tab]);
  async function act(action, fields = {}) {
    setActing(true);
    setError("");
    setNotice("");
    try {
      const r = await fetch("./api/action", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-frontier-session": data.sessionToken,
        },
        body: JSON.stringify({ action, ...fields }),
      });
      const result = await r.json();
      if (!r.ok) throw Error(result.error || "操作失败");
      await refresh();
      if (result.result?.message) setNotice(result.result.message);
      return result.result;
    } catch (e) {
      setError(e.message);
      return null;
    } finally {
      setActing(false);
    }
  }
  async function read(address) {
    const result = await act("read", { url: address });
    if (result) setNotice("阅读已开始，可以在运行记录中查看进度。");
  }
  if (offline && !data)
    return (
      <div className="wb-offline">
        <div className="wb-logo">
          F<span>AI FRONTIER</span>
        </div>
        <h1>个人研究工作台在本机运行</h1>
        <p>公共雷达继续免费在线。精读模型和个人反馈需要启动本机服务。</p>
        <pre>
          cd ai-frontier{`\n`}npm ci{`\n`}npm run build{`\n`}npm run workbench
        </pre>
        <p>启动后打开终端显示的本机网址。需要 Node 24 和已登录的 Codex CLI。</p>
        <a
          href="https://github.com/Zhiying-Li-dot/ai-frontier#个人研究工作台"
          target="_blank"
          rel="noreferrer"
        >
          查看安装与数据说明 <ArrowUpRight size={16} />
        </a>
      </div>
    );
  if (!data || !profile)
    return <p className="wb-loading">正在连接本机研究服务…</p>;
  const candidates = data.candidates.filter((c) =>
    [c.title, c.sourceName]
      .join(" ")
      .toLowerCase()
      .includes(query.toLowerCase()),
  );
  return (
    <div className="wb-shell">
      <aside className="wb-sidebar">
        <a
          className="wb-logo"
          href="https://zhiying-li-dot.github.io/ai-frontier/"
          target="_blank"
          rel="noreferrer"
        >
          F
          <span>
            AI FRONTIER<small>PERSONAL RESEARCH LAB</small>
          </span>
        </a>
        <div className="wb-navitem">
          <Activity size={17} /> 个人研究工作台 <span>01</span>
        </div>
        <div className="wb-sectionlabel">
          <SlidersHorizontal size={14} /> 我的阅读上下文
        </div>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (await act("profile", { value: profile }))
              setNotice("上下文已更新。旧偏好策略已清除，研究事实保持原样。");
          }}
        >
          <label>
            岗位起点
            <select
              value={profile.role}
              onChange={(e) => setProfile({ ...profile, role: e.target.value })}
            >
              {Object.entries(roles).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </label>
          <label>
            关注主题
            <input
              maxLength={80}
              placeholder="如：Agent 可靠性"
              value={profile.topic}
              onChange={(e) =>
                setProfile({ ...profile, topic: e.target.value })
              }
            />
          </label>
          <label>
            当前工作目标
            <textarea
              rows={4}
              maxLength={500}
              placeholder="填写不含机密的目标，如：减少工具调用失败"
              value={profile.goal}
              onChange={(e) => setProfile({ ...profile, goal: e.target.value })}
            />
          </label>
          <label>
            阅读深度
            <select
              value={profile.depth}
              onChange={(e) =>
                setProfile({ ...profile, depth: e.target.value })
              }
            >
              {Object.entries(depths).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </label>
          <button className="wb-primary wb-wide" disabled={acting}>
            应用到阅读视图 <ArrowRight size={15} />
          </button>
        </form>
        <div className="wb-private">
          <Shield size={17} />
          <div>
            <strong>个人上下文仅本次会话</strong>
            <p>岗位、目标和反馈不发送给模型。关闭本机服务后清除。</p>
            <button
              onClick={async () => {
                await act("clear-personal");
                setProfile({
                  role: "developer",
                  goal: "",
                  topic: "",
                  depth: "technical",
                });
                setNotice("个人资料、反馈和派生策略已清除。中立阅读档案保留。");
              }}
            >
              清除个人会话
            </button>
          </div>
        </div>
        <a
          className="wb-back"
          href="https://zhiying-li-dot.github.io/ai-frontier/"
          target="_blank"
          rel="noreferrer"
        >
          打开公共前沿雷达 <ArrowUpRight size={14} />
        </a>
      </aside>
      <main className="wb-main">
        <header className="wb-topline">
          <span>RESEARCH → UNDERSTANDING → WORK</span>
          <span className={offline ? "wb-status failed" : "wb-status"}>
            {offline ? "本机连接已断开" : "本机服务运行中"}
          </span>
        </header>
        <div className="wb-intro">
          <div>
            <div className="wb-eyebrow">AI FRONTIER / 个人研究</div>
            <h1>理解前沿，找到工作中的下一步。</h1>
            <p>原文证据 → 阅读分析 → 岗位视图 → 反馈与下一版策略</p>
          </div>
          <div className="wb-budget">
            <strong>
              {data.budget.limit - data.budget.calls}
              <small> / {data.budget.limit}</small>
            </strong>
            <span>今日剩余模型调用 · 北京时间</span>
          </div>
        </div>
        <div className="wb-facts">
          <span>
            <BookOpen size={15} /> Codex 真实阅读公开来源
          </span>
          <span>
            <Layers size={15} /> 个人视图在本机按模板适配
          </span>
          <span>手动启动精读 · 无自动重试</span>
        </div>
        {error && (
          <div role="alert" className="wb-alert error">
            {error}
          </div>
        )}
        {notice && (
          <div role="status" className="wb-alert">
            {notice}
          </div>
        )}
        <section className="wb-intake">
          <div>
            <strong>交给研究 Agent</strong>
            <span>选择下方候选，或输入原始技术资料的公开链接。</span>
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              read(url);
            }}
          >
            <input
              aria-label="公开技术来源链接"
              type="url"
              required
              placeholder="https://… 论文 / 技术博客 / 文档"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
            <button className="wb-primary" disabled={acting || data.busy}>
              <Plus size={16} /> 开始阅读
            </button>
          </form>
        </section>
        <div className="wb-grid">
          <section className="wb-library">
            <div className="wb-sectionhead">
              <h2>研究资料</h2>
              <span>{data.records.length} 条阅读记录</span>
            </div>
            {data.records.length === 0 && (
              <p className="wb-empty">
                尚无真实阅读记录。选择一条候选开始，模型完成后在此查看。
              </p>
            )}
            <div className="wb-records">
              {data.records.map((a) => (
                <button
                  key={a.fingerprint}
                  className={
                    "wb-record " +
                    (selected === a.fingerprint ? "selected" : "")
                  }
                  onClick={() => {
                    setSelected(a.fingerprint);
                    setTab("overview");
                  }}
                >
                  <span className="wb-kicker">
                    {friendlyDecision(a.record)} · AI 辅助
                  </span>
                  <strong>{a.record.source.title}</strong>
                  <small>
                    {a.record.claims.length} 条主张 / {a.record.evidence.length}{" "}
                    处证据 <ArrowUpRight size={13} />
                  </small>
                </button>
              ))}
            </div>
            <div className="wb-sectionhead wb-candidatehead">
              <h2>前沿候选</h2>
              <button
                aria-label="刷新云端候选"
                disabled={acting}
                onClick={() => act("refresh")}
              >
                <RefreshCw size={15} />
              </button>
            </div>
            <p className="wb-caption">{data.discoveryMessage}</p>
            <input
              className="wb-search"
              aria-label="搜索候选"
              placeholder="搜索技术、来源…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <div className="wb-candidates">
              {candidates.slice(0, 40).map((c) => (
                <article key={c.id + c.sourceUrl}>
                  <small>
                    {c.sourceName} · {c.publishedAt?.slice(0, 10) || "日期未知"}
                  </small>
                  <h3>{c.title}</h3>
                  <div>
                    <a href={c.sourceUrl} target="_blank" rel="noreferrer">
                      原文 <ArrowUpRight size={12} />
                    </a>
                    <button
                      disabled={acting || data.busy}
                      onClick={() => read(c.sourceUrl)}
                    >
                      交给 Agent <ArrowRight size={12} />
                    </button>
                  </div>
                </article>
              ))}
            </div>
            <p className="wb-caption">
              显示前 {Math.min(40, candidates.length)}{" "}
              条；候选仅为题录，尚未精读。
            </p>
          </section>
          <div className="wb-readingcolumn">
            {record ? (
              <section className="wb-reader">
                <div className="wb-readingtitle">
                  <span className="wb-eyebrow">
                    READING RECORD / {friendlyDecision(record.record)}
                  </span>
                  <h2>{record.record.source.title}</h2>
                  <div>
                    <a
                      href={record.source.url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      阅读原文 <ArrowUpRight size={13} />
                    </a>
                    <span>
                      {new Date(record.completedAt).toLocaleString("zh-CN")} ·{" "}
                      {record.record.skill.version}
                    </span>
                  </div>
                </div>
                <div className="wb-tabs">
                  {[
                    ["overview", "为我解读"],
                    ["evidence", "主张与证据"],
                    ["trace", "阅读过程"],
                    ["source", "已读原文"],
                  ].map(([k, v]) => (
                    <button
                      className={tab === k ? "active" : ""}
                      key={k}
                      onClick={() => setTab(k)}
                    >
                      {v}
                    </button>
                  ))}
                </div>
                <div className="wb-readerbody">
                  {record.record.publication.decision === "hold" && (
                    <div className="wb-hold">
                      <strong>材料缺口，保留为候选</strong>
                      {record.record.publication.blockingGaps.map((x, i) => (
                        <p key={i}>{x}</p>
                      ))}
                    </div>
                  )}
                  {tab === "overview" && view && (
                    <>
                      <div className="wb-viewlabel">
                        {roles[data.profile.role]}视图 · 策略 v
                        {view.policyVersion}
                        <span>{view.method}</span>
                      </div>
                      <h3>先理解它怎么工作</h3>
                      <p className="wb-prose">{view.explanation}</p>
                      {view.mechanismDetails && (
                        <div className="wb-detail">
                          <p>
                            <b>输入：</b>
                            {view.mechanismDetails.inputs.join("；") || "未知"}
                          </p>
                          <p>
                            <b>输出：</b>
                            {view.mechanismDetails.outputs.join("；") || "未知"}
                          </p>
                          <p>
                            <b>未解决：</b>
                            {view.mechanismDetails.unresolved.join("；") ||
                              "本次未列出，仍需事实复核"}
                          </p>
                        </div>
                      )}
                      <h3>优先关注的主张</h3>
                      {view.claims.map((c, i) => (
                        <div className="wb-claim" key={i}>
                          <small>
                            {labels[c.provenance]} · {c.evidenceIds.join(", ")}
                          </small>
                          <p>{c.text}</p>
                          {c.conditions.length > 0 && (
                            <span>条件：{c.conditions.join("；")}</span>
                          )}
                        </div>
                      ))}
                      <h3>连接到我的工作</h3>
                      <p>{view.goalConnection}</p>
                      <div className="wb-worktest">
                        <span>建议的小验证 / 尚未执行</span>
                        <p>{view.workSuggestion}</p>
                        <small>停止或否证条件：{view.stoppingCondition}</small>
                      </div>
                      <h3>使用前还要确认</h3>
                      <ul>
                        {[
                          ...view.applicabilityConditions,
                          ...view.unknowns,
                        ].map((s, i) => (
                          <li key={i}>{s}</li>
                        ))}
                      </ul>
                      <p className="wb-caption">
                        技术与工作目标的匹配程度、理解效果和实际收益均未验证。
                      </p>
                      <div className="wb-feedback">
                        <strong>这次解读是否适合你？</strong>
                        <div>
                          {feedbacks.map(([kind, label]) => (
                            <button
                              key={kind}
                              disabled={acting}
                              onClick={() =>
                                act("feedback", { fingerprint: selected, kind })
                              }
                            >
                              {label}
                            </button>
                          ))}
                        </div>
                        <p>
                          反馈只影响本次个人会话。事实纠错另行复核，不按个人偏好改研究结论。
                        </p>
                      </div>
                    </>
                  )}
                  {tab === "evidence" && (
                    <>
                      {record.record.claims.map((c) => (
                        <div className="wb-claim" key={c.id}>
                          <small>
                            {c.id} / {labels[c.provenance]} / {c.supportStatus}
                          </small>
                          <p>{c.text}</p>
                          <span>
                            证据：{c.evidenceIds.join("、") || "无"} · 条件：
                            {c.conditions.join("；") || "原文未明确"}
                          </span>
                          {c.unsupportedInterpretation && (
                            <p className="wb-caption">
                              不能推断：{c.unsupportedInterpretation}
                            </p>
                          )}
                        </div>
                      ))}
                      <h3>来源证据</h3>
                      {record.record.evidence.map((e) => (
                        <div className="wb-evidence" key={e.id}>
                          <strong>
                            {e.id} · {e.locator}
                          </strong>
                          <p>{e.observation}</p>
                          <small>{e.missingControls.join("；")}</small>
                        </div>
                      ))}
                      <p className="wb-caption">
                        行号对应“已读原文”中的实际抓取快照；证据定位不等同于科学真实性认证。
                      </p>
                    </>
                  )}
                  {tab === "trace" && (
                    <>
                      <h3>八步阅读记录</h3>
                      {record.record.execution.steps.map((s, i) => (
                        <div className="wb-step" key={s.id}>
                          <span>{String(i + 1).padStart(2, "0")}</span>
                          <div>
                            <strong>
                              {steps[s.id]}{" "}
                              <small>
                                {s.status === "done"
                                  ? "已完成评估"
                                  : s.status === "blocked"
                                    ? "阻塞"
                                    : "不适用"}
                              </small>
                            </strong>
                            <p>{s.output || s.reason}</p>
                            {s.reason && s.output && <small>{s.reason}</small>}
                          </div>
                        </div>
                      ))}
                      <h3>实际覆盖</h3>
                      {record.record.source.materials.map((m) => (
                        <p key={m.id} className="wb-caption">
                          {m.id} · {m.availability} / {m.inspection} —{" "}
                          {m.reason || m.locator}
                        </p>
                      ))}
                      <p>
                        外部核验{" "}
                        {record.record.execution.externalChecksPerformed.length}{" "}
                        次 · 独立实验{" "}
                        {record.record.execution.experimentsPerformed.length} 次
                      </p>
                      <p className="wb-caption">
                        以上是可观察的执行结果与材料覆盖；不记录模型内部思维链。
                      </p>
                    </>
                  )}
                  {tab === "source" &&
                    (source ? (
                      <>
                        <p className="wb-caption">
                          抓取时间：
                          {new Date(source.fetchedAt).toLocaleString(
                            "zh-CN",
                          )} · {source.lines} 行 ·{" "}
                          {source.scope === "full"
                            ? "文字来源完整"
                            : "部分材料"}
                          <br />
                          内容指纹：{source.version.slice(0, 16)}
                        </p>
                        <pre className="wb-sourcetext">{source.text}</pre>
                      </>
                    ) : (
                      <p>正在读取原文快照…</p>
                    ))}
                </div>
              </section>
            ) : (
              <section className="wb-no-record">
                <BookOpen size={36} />
                <h2>从一条真实资料开始。</h2>
                <p>
                  选择候选或粘贴原文地址，研究 Agent
                  会记录机制、主张、证据和材料缺口。
                </p>
                <span>正文不全时停在候选；不生成假精读。</span>
              </section>
            )}
            <section className="wb-policy">
              <div className="wb-sectionhead">
                <h2>反馈 → 下一版策略</h2>
                <span>当前 v{data.activeVersion}</span>
              </div>
              <p className="wb-caption">
                先检查独立合成样例中的证据与未知状态保留，再由你确认。此检查尚不能证明理解或工作收益改善。
              </p>
              {data.policies.length === 0 && (
                <p className="wb-empty">
                  在阅读后反馈“难理解”或“太浅”，这里会出现属于你的策略候选。
                </p>
              )}
              {data.policies.map((p) => (
                <div className="wb-policyrow" key={p.id}>
                  <div>
                    <strong>
                      v{p.previousVersion} → v{p.version} · {depths[p.depth]}
                    </strong>
                    <p>
                      {p.scope} ·{" "}
                      {
                        {
                          proposed: "待检查",
                          checked: "检查通过，待本人确认",
                          adopted: "已采用",
                          rejected: "已拒绝",
                          "rolled-back": "已回滚",
                        }[p.status]
                      }
                    </p>
                    {p.evaluation && (
                      <small>
                        {p.evaluation.cases.length} 个独立合成样例 ·{" "}
                        {p.evaluation.note}
                      </small>
                    )}
                  </div>
                  <div className="wb-policybuttons">
                    {p.status === "proposed" && (
                      <button
                        disabled={acting}
                        onClick={() => act("evaluate", { id: p.id })}
                      >
                        运行检查
                      </button>
                    )}
                    {p.status === "checked" && (
                      <button
                        className="wb-primary"
                        disabled={acting}
                        onClick={() => act("adopt", { id: p.id })}
                      >
                        <Check size={14} /> 确认下一篇采用
                      </button>
                    )}
                    {["proposed", "checked"].includes(p.status) && (
                      <button
                        disabled={acting}
                        onClick={() => act("reject", { id: p.id })}
                      >
                        拒绝
                      </button>
                    )}
                    {p.version === data.activeVersion && (
                      <button disabled={acting} onClick={() => act("rollback")}>
                        <RotateCcw size={14} /> 回滚
                      </button>
                    )}
                  </div>
                </div>
              ))}
              {data.corrections.map((c) => (
                <p className="wb-alert" key={c.id}>
                  事实纠错：{c.status}。本机纠错队列尚需人工核对。
                </p>
              ))}
            </section>
            <section className="wb-runs">
              <div className="wb-sectionhead">
                <h2>运行记录</h2>
                <span>仅本次进程</span>
              </div>
              {data.jobs.length === 0 ? (
                <p className="wb-empty">
                  还没有本次运行任务。已保存的真实阅读档案不会因重启而消失。
                </p>
              ) : (
                data.jobs.map((j) => (
                  <div className="wb-run" key={j.id}>
                    <span className={"wb-dot " + j.status} />
                    <div>
                      <strong>
                        {
                          {
                            fetching: "抓取原文",
                            reading: "模型阅读中",
                            completed: "已完成本次阅读",
                            failed: "执行失败",
                          }[j.status]
                        }
                      </strong>
                      <p>{j.message}</p>
                    </div>
                    {j.fingerprint && (
                      <button
                        onClick={() => {
                          setSelected(j.fingerprint);
                          setTab("overview");
                        }}
                      >
                        查看 <ArrowUpRight size={13} />
                      </button>
                    )}
                  </div>
                ))
              )}
            </section>
          </div>
        </div>
        <footer className="wb-footer">
          AI 辅助研究 · 作者主张 ≠ 独立复现 ≠ 实际工作收益
          <span>PUBLIC KNOWLEDGE / PRIVATE CONTEXT</span>
        </footer>
      </main>
    </div>
  );
}
createRoot(document.getElementById("root")).render(<App />);
