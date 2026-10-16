"use client";

import { useState } from "react";
import { ArrowLeft, ArrowUpRight, Check, Search } from "lucide-react";
import { categories, validateResearchItem } from "../lib/research";
import type { ResearchItem } from "../lib/research";
import type { UserItemState } from "./types";

type Version = { fingerprint: string; created_at: string };
const tabs = [
  ["summary", "精炼介绍"],
  ["analysis", "深入理解"],
  ["evidence", "原文证据"],
  ["history", "修订记录"],
];
const feedback = [
  ["too-shallow", "想读得更深"],
  ["too-deep", "希望更精炼"],
  ["known", "我已经了解"],
  ["irrelevant", "与关注点无关"],
  ["error", "标记可能的错误"],
];
function date(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    dateStyle: "medium",
  }).format(new Date(value));
}
function Paragraphs({ text }: { text: string }) {
  return (
    <>
      {text
        .split(/\n\s*\n/)
        .filter(Boolean)
        .map((paragraph, i) => (
          <p key={i}>{paragraph}</p>
        ))}
    </>
  );
}

export function PaperReader({
  item,
  initialTab,
  versions,
  state,
  onState,
  onBack,
  saveButton,
  busy,
}: {
  item: ResearchItem;
  initialTab: string;
  versions: Version[];
  state?: UserItemState;
  onState: (patch: Partial<UserItemState>) => void;
  onBack: () => void;
  saveButton: React.ReactNode;
  busy: boolean;
}) {
  const [tab, setTab] = useState(initialTab);
  const [query, setQuery] = useState("");
  const [historical, setHistorical] = useState<ResearchItem | null>(null);
  const [error, setError] = useState("");
  const [loadingVersion, setLoadingVersion] = useState("");
  const evidence = item.evidence.filter((e) =>
    `${e.label} ${e.supports} ${e.locator}`
      .toLowerCase()
      .includes(query.trim().toLowerCase()),
  );
  async function inspectVersion(hash: string) {
    setLoadingVersion(hash);
    setError("");
    try {
      const response = await fetch(
        `./data/versions/${encodeURIComponent(hash)}.json`,
        { cache: "no-store" },
      );
      const result = (await response.json()) as {
        item?: unknown;
        error?: string;
      };
      if (!response.ok) throw new Error(result.error || "版本读取失败");
      setHistorical(validateResearchItem(result.item));
    } catch (e) {
      setError(e instanceof Error ? e.message : "版本读取失败");
    } finally {
      setLoadingVersion("");
    }
  }
  return (
    <>
      <div className="reader-topline">
        <button className="text-button" onClick={onBack}>
          <ArrowLeft size={15} />
          返回今日简报
        </button>
        <div className="actions" style={{ marginTop: 0 }}>
          {saveButton}
          <a
            className="text-button"
            href={item.fulltextUrl || item.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            打开原文 <ArrowUpRight size={15} />
          </a>
        </div>
      </div>
      <div className="reader-layout">
        <article className="reader-main">
          <div className="kicker">
            {item.type === "paper"
              ? "PAPER READER / 论文精读"
              : "RESEARCH NOTE / 技术进展"}
          </div>
          <h1 className="reader-title">{item.title}</h1>
          {item.originalTitle && (
            <p className="original-title">{item.originalTitle}</p>
          )}
          <div className="metadata">
            <span>{categories[item.category]}</span>
            <span>/</span>
            <span>{item.sourceName}</span>
            <span>/</span>
            <span>原文 {date(item.publishedAt)}</span>
            <span>/</span>
            <span>约 {item.readingMinutes} 分钟</span>
          </div>
          <div className="tag-list">
            {item.tags.map((tag) => (
              <span className="tag" key={tag}>
                # {tag}
              </span>
            ))}
          </div>
          <div className="reader-tabs" role="tablist" aria-label="阅读层次">
            {tabs.map(([id, label]) => (
              <button
                key={id}
                role="tab"
                aria-selected={tab === id}
                aria-controls="reading-content"
                className={`reader-tab ${tab === id ? "active" : ""}`}
                onClick={() => setTab(id)}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="reader-body" id="reading-content" role="tabpanel">
            {tab === "summary" && (
              <>
                <p className="lead">{item.summary}</p>
                <h2>为什么值得关注</h2>
                <Paragraphs text={item.whyItMatters} />
                <h2>核心方法</h2>
                <Paragraphs text={item.method} />
                <h2>结果说明了什么</h2>
                <Paragraphs text={item.results} />
                <h2>结论的边界</h2>
                <ul>
                  {item.limitations.map((text, i) => (
                    <li key={i}>{text}</li>
                  ))}
                </ul>
                <button
                  className="text-button blue"
                  onClick={() => setTab("evidence")}
                >
                  逐项核对原文证据 <ArrowUpRight size={15} />
                </button>
              </>
            )}
            {tab === "analysis" && (
              <>
                <h2>方法、实验与推理</h2>
                <Paragraphs text={item.analysis} />
                <h2>怎样放回技术脉络</h2>
                {item.priorWork.length ? (
                  item.priorWork.map((work, i) => (
                    <div className="evidence-card" key={i}>
                      <div className="kicker">{work.relation}</div>
                      <h3>
                        <a
                          href={work.url}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {work.title} ↗
                        </a>
                      </h3>
                      <p>{work.explanation}</p>
                    </div>
                  ))
                ) : (
                  <p>尚无经过核对的方法继承关系，保留后续研究问题。</p>
                )}
                <h2>阅读与核查说明</h2>
                <Paragraphs text={item.qualityNotes} />
              </>
            )}
            {tab === "evidence" && (
              <>
                {item.reading && (
                  <>
                    <div className="coverage-grid">
                      <div>
                        <strong>
                          {item.reading.bodyRead ? "已读" : "待核查"}
                        </strong>
                        论文正文
                      </div>
                      <div>
                        <strong>
                          {item.reading.figuresReviewed} /{" "}
                          {item.reading.totalMainFigures}
                        </strong>
                        正文图已核查
                      </div>
                      <div>
                        <strong>
                          {item.reading.tablesReviewed} /{" "}
                          {item.reading.totalMainTables}
                        </strong>
                        正文表已核查
                      </div>
                      <div>
                        <strong>
                          {item.reading.coreAppendixRead ? "已读" : "待核查"}
                        </strong>
                        核心附录
                      </div>
                    </div>
                    <p className="coverage-note">
                      版本：{item.reading.sourceVersion}。覆盖：
                      {item.reading.sections.join("、")}。
                    </p>
                    <p className="coverage-note">{item.reading.reviewNotes}</p>
                  </>
                )}
                <div className="reading-tool">
                  <label className="text-button" htmlFor="evidence-query">
                    <Search size={15} />
                    在已有证据中检索
                  </label>
                  <input
                    id="evidence-query"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="例如：攻击成功率、实验设置、局限"
                  />
                  <p>按关键词定位已核查材料。这里不生成缺少来源的回答。</p>
                </div>
                {evidence.length ? (
                  evidence.map((entry, i) => (
                    <section className="evidence-card" key={entry.id}>
                      <div className="kicker">
                        EVIDENCE {String(i + 1).padStart(2, "0")} /{" "}
                        {entry.kind === "paper" ? "论文原文" : "外部原始来源"}
                      </div>
                      <h3>{entry.label}</h3>
                      <p>{entry.supports}</p>
                      {entry.excerpt && (
                        <blockquote>{entry.excerpt}</blockquote>
                      )}
                      <p className="locator">{entry.locator}</p>
                      <a
                        className="text-button blue"
                        href={entry.url}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        打开原文位置 <ArrowUpRight size={14} />
                      </a>
                    </section>
                  ))
                ) : (
                  <p>没有匹配的证据。试试更短的关键词。</p>
                )}
              </>
            )}
            {tab === "history" && (
              <>
                <h2>保留每次认识的变化</h2>
                <p>
                  以下为本站已归档的研究快照，指纹用于核对内容。原始发布日期与研究日期分别保留。
                </p>
                {versions.map((version, i) => (
                  <div className="evidence-card" key={version.fingerprint}>
                    <div className="metadata">
                      {date(version.created_at)} / 版本 {versions.length - i}
                    </div>
                    <p className="locator">
                      {version.fingerprint.slice(0, 16)}
                    </p>
                    <button
                      className="text-button blue"
                      disabled={!!loadingVersion}
                      onClick={() => void inspectVersion(version.fingerprint)}
                    >
                      {loadingVersion === version.fingerprint
                        ? "读取中…"
                        : "查看当时的介绍"}{" "}
                      <ArrowUpRight size={14} />
                    </button>
                  </div>
                ))}
                {error && <p role="alert">{error}</p>}
                {historical && (
                  <section className="evidence-card">
                    <div className="kicker">
                      历史快照 /{" "}
                      {historical.status === "ready"
                        ? "已完成核查"
                        : "候选版本，尚未正式介绍"}
                    </div>
                    <h3>{historical.title}</h3>
                    <Paragraphs
                      text={
                        historical.summary || "此版本只有题录，未提供正式介绍。"
                      }
                    />
                    <Paragraphs text={historical.qualityNotes} />
                  </section>
                )}
              </>
            )}
          </div>
        </article>
        <aside className="reader-aside">
          <section>
            <h3>研究记录</h3>
            <dl>
              <dt>原始发布日期</dt>
              <dd>{date(item.publishedAt)}</dd>
              <dt>本次精读 / 核查</dt>
              <dd>{date(item.reviewedAt)}</dd>
              <dt>来源覆盖</dt>
              <dd>
                {item.sourceCoverage === "full-paper"
                  ? "正文、主图表与核心附录"
                  : "官方原始技术材料"}
              </dd>
              <dt>阅读状态</dt>
              <dd>
                <button
                  className="text-button blue"
                  disabled={busy}
                  onClick={() => onState({ read: !state?.read })}
                >
                  {state?.read ? (
                    <>
                      <Check size={13} />
                      已读 · 标为未读
                    </>
                  ) : (
                    "标为已读"
                  )}
                </button>
              </dd>
            </dl>
          </section>
          <section>
            <h3>本机阅读备注</h3>
            <div className="feedback">
              {feedback.map(([id, label]) => (
                <button
                  key={id}
                  disabled={busy}
                  aria-pressed={state?.feedback === id}
                  className={state?.feedback === id ? "active" : ""}
                  onClick={() => onState({ feedback: id })}
                >
                  {label}
                  {state?.feedback === id ? " ✓" : ""}
                </button>
              ))}
            </div>
            <p>
              备注仅保存在此浏览器，不上传或改变后台研究。标记错误不等于已经完成更正。
            </p>
          </section>
          <section>
            <h3>核查边界</h3>
            <p>
              AI
              阅读与原始来源核查，不代表独立复现实验或专家审稿。适用条件和负面结果均保留在正文。
            </p>
          </section>
        </aside>
      </div>
    </>
  );
}
