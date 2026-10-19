import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  ArrowRight,
  ArrowUpRight,
  Bookmark,
  Check,
  Search,
  RefreshCw,
  Download,
  Trash2,
} from "lucide-react";
import {
  categories,
  filterItems,
  isSafeSourceUrl,
  validateResearchItem,
} from "../lib/research.ts";
import { feedSources } from "../lib/feeds.ts";
import { PaperReader } from "./paper-reader";
import { readLocal, writeLocal, clearLocal } from "./storage.js";
import "./styles.css";

const views = [
  ["daily", "今日简报"],
  ["papers", "论文精读"],
  ["evolution", "技术脉络"],
  ["weekly", "每周回顾"],
  ["saved", "我的收藏"],
  ["sources", "来源与状态"],
];
const date = (value, time = false) =>
  new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    ...(time ? { hour: "2-digit", minute: "2-digit" } : {}),
  }).format(new Date(value));
const locationState = () => {
  const q = new URLSearchParams(location.search);
  return {
    view: views.some(([id]) => id === q.get("view")) ? q.get("view") : "daily",
    paper: q.get("paper") || "",
  };
};
function App() {
  const [route, setRoute] = useState(locationState),
    [data, setData] = useState(null),
    [error, setError] = useState(""),
    [query, setQuery] = useState(""),
    [category, setCategory] = useState("all"),
    [recent, setRecent] = useState(false),
    [states, setStates] = useState(() => {
      try {
        return readLocal(window.localStorage);
      } catch {
        return {};
      }
    }),
    [toast, setToast] = useState(""),
    [tab, setTab] = useState("summary");
  async function load() {
    try {
      const r = await fetch("./data/research.json", { cache: "no-store" });
      if (!r.ok) throw Error("研究档案暂时无法读取");
      const text = await r.text();
      if (text.length > 10000000) throw Error("研究档案超出读取范围");
      const next = JSON.parse(text);
      next.items = next.items
        .map(validateResearchItem)
        .filter((x) => x.status === "ready");
      next.pending = next.pending.filter((x) => isSafeSourceUrl(x.sourceUrl));
      setData(next);
      setError("");
    } catch (e) {
      setError(e.message || "读取未完成");
    }
  }
  useEffect(() => {
    void load();
    const back = () => setRoute(locationState());
    window.addEventListener("popstate", back);
    return () => window.removeEventListener("popstate", back);
  }, []);
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(""), 5000);
    return () => clearTimeout(id);
  }, [toast]);
  function navigate(view, paper = "", initial = "summary") {
    setTab(initial);
    setRoute({ view, paper });
    const q = new URLSearchParams();
    if (view !== "daily") q.set("view", view);
    if (paper) q.set("paper", paper);
    history.pushState({}, "", `${location.pathname}${q.size ? "?" + q : ""}`);
    window.scrollTo({ top: 0 });
  }
  function update(id, patch) {
    const next = {
      ...states,
      [id]: { saved: false, read: false, ...states[id], ...patch },
    };
    setStates(next);
    let saved = false;
    try {
      saved = writeLocal(window.localStorage, next);
    } catch {}
    setToast(
      saved
        ? "已保存在此浏览器，仅你可见"
        : "此浏览器无法保存，当前操作仅本次有效",
    );
  }
  function open(item, initial) {
    navigate(route.view, item.id, initial);
    if (!states[item.id]?.read) update(item.id, { read: true });
  }
  function exportLocal() {
    const blob = new Blob(
        [
          JSON.stringify(
            {
              scope: "this-browser-only",
              exportedAt: new Date().toISOString(),
              states,
            },
            null,
            2,
          ),
        ],
        { type: "application/json" },
      ),
      url = URL.createObjectURL(blob),
      a = document.createElement("a");
    a.href = url;
    a.download = "我的研究记录.json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function removeLocal() {
    if (
      !window.confirm(
        "清除此浏览器的收藏、已读和备注？研究内容与其他人的记录不受影响。",
      )
    )
      return;
    let cleared = false;
    try {
      cleared = clearLocal(window.localStorage);
    } catch {}
    if (cleared) {
      setStates({});
      setToast("此浏览器的阅读记录已清除");
    } else setToast("清除未完成，请检查浏览器存储权限");
  }
  const filtered = useMemo(
    () =>
      filterItems(data?.items || [], {
        query,
        category,
        publishedSince: recent
          ? new Date(Date.now() - 14 * 86400000).toISOString()
          : undefined,
      }),
    [data, query, category, recent],
  );
  const pending = (data?.pending || []).filter(
    (x) =>
      (category === "all" || x.category === category) &&
      `${x.title} ${x.originalTitle} ${x.sourceName}`
        .toLowerCase()
        .includes(query.toLowerCase()) &&
      (!recent || Date.parse(x.publishedAt) >= Date.now() - 14 * 86400000),
  );
  const selected = data?.items.find((x) => x.id === route.paper),
    focus = filtered.find((x) => x.type === "paper") || filtered[0];
  const save = (item) => (
    <button
      className={states[item.id]?.saved ? "blue" : ""}
      aria-label={`${states[item.id]?.saved ? "取消收藏" : "收藏"}：${item.title}`}
      aria-pressed={!!states[item.id]?.saved}
      onClick={() => update(item.id, { saved: !states[item.id]?.saved })}
    >
      <Bookmark
        size={20}
        strokeWidth={1.4}
        fill={states[item.id]?.saved ? "currentColor" : "none"}
      />
    </button>
  );
  const meta = (item) => (
    <div className="metadata">
      <span>{categories[item.category]}</span>
      <span>/</span>
      <span>{item.sourceName}</span>
      <span>/</span>
      <span>原文 {date(item.publishedAt)}</span>
      <span>/</span>
      <span>{item.type === "paper" ? "AI 全文精读" : "原始来源核查"}</span>
    </div>
  );
  const cards = (list) => (
    <div className="collection-list">
      {list.map((item, i) => (
        <article className="collection-item" key={item.id}>
          <span className="mono blue">{String(i + 1).padStart(2, "0")}</span>
          <div>
            {meta(item)}
            <h2>
              <button onClick={() => open(item)}>{item.title}</button>
            </h2>
            <p>{item.summary}</p>
            <div className="tag-list">
              {item.tags.map((t) => (
                <span className="tag" key={t}>
                  # {t}
                </span>
              ))}
            </div>
          </div>
          <div className="collection-side">
            {save(item)}
            <button className="text-button" onClick={() => open(item)}>
              展开阅读 <ArrowRight size={15} />
            </button>
            <span className="metadata">
              {states[item.id]?.read
                ? "已读"
                : `约 ${item.readingMinutes} 分钟`}
            </span>
          </div>
        </article>
      ))}
    </div>
  );
  const queue = (
    <section className="candidate-section">
      <div className="sectionbar">
        <h2>新发现 · 等待精读</h2>
        <span className="section-meta">{pending.length} 条公开题录</span>
      </div>
      <p className="coverage-note">
        这些材料尚未完成全文与证据核查，不提供伪造的精读结论。当前免费版未启用自动模型阅读。
      </p>
      {pending.length ? (
        <div>
          {pending.slice(0, 40).map((item) => (
            <article className="pending-entry" key={item.id}>
              <a
                href={item.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                {item.title} <ArrowUpRight size={13} />
              </a>
              <small>
                {item.sourceName} · {date(item.publishedAt)} · 待精读
              </small>
            </article>
          ))}
        </div>
      ) : (
        <p className="muted">暂无符合当前筛选条件的新候选。</p>
      )}
    </section>
  );
  return (
    <div className="page-shell">
      <header className="topbar">
        <button className="brand" onClick={() => navigate("daily")}>
          <span className="brand-square" />
          AI 前沿雷达<span className="brand-slash">/</span>
          <span className="mono">RESEARCH DESK</span>
        </button>
        <nav className="navigation" aria-label="主导航">
          {views.map(([id, label]) => (
            <button
              key={id}
              className={`nav-button ${route.view === id && !route.paper ? "active" : ""}`}
              onClick={() => navigate(id)}
            >
              {label}
            </button>
          ))}
        </nav>
        <button
          className="icon-label"
          onClick={() => document.getElementById("search")?.focus()}
        >
          <Search size={17} />
          <span>搜索</span>
        </button>
      </header>
      {!data ? (
        <div className="empty-state">
          <h1>理解前沿，看清演变。</h1>
          <p role="status">{error || "正在读取研究与原文证据…"}</p>
          {error && (
            <button className="button ink" onClick={load}>
              重新加载
            </button>
          )}
        </div>
      ) : (
        <>
          {route.paper ? (
            selected ? (
              <PaperReader
                key={selected.id}
                item={selected}
                initialTab={tab}
                versions={data.versions?.[selected.id] || []}
                state={states[selected.id]}
                onState={(patch) => update(selected.id, patch)}
                onBack={() => navigate(route.view)}
                saveButton={save(selected)}
                busy={false}
              />
            ) : (
              <div className="empty-state">
                <h2>未找到这份研究档案</h2>
                <p>条目可能尚未完成精读，或链接已经变更。</p>
                <button className="button" onClick={() => navigate("daily")}>
                  返回简报
                </button>
              </div>
            )
          ) : (
            <>
              <div className="masthead">
                <div>
                  <div className="kicker">
                    FRONTIER / SAFETY / UNDERSTANDING
                  </div>
                  <h1>
                    {route.view === "daily" ? (
                      <>
                        理解前沿，
                        <br />
                        看清演变。
                      </>
                    ) : (
                      views.find(([id]) => id === route.view)?.[1]
                    )}
                  </h1>
                  <p className="masthead-sub">
                    从原始材料出发，理解 AI 与 AI 安全的下一步。
                  </p>
                </div>
                <div className="issue">
                  <div className="issue-date">
                    {new Intl.DateTimeFormat("en-US", {
                      timeZone: "Asia/Shanghai",
                      month: "2-digit",
                      day: "2-digit",
                    })
                      .format(new Date())
                      .replace("/", ".")}
                  </div>
                  <div className="mono">
                    FRONTIER OBSERVATORY / PUBLIC EDITION
                  </div>
                  <div className="issue-note">
                    来源检查 {date(data.updatedAt, true)} · 每 4 小时计划更新
                  </div>
                </div>
              </div>
              <div className="search-field">
                <Search size={18} />
                <input
                  id="search"
                  type="search"
                  aria-label="搜索研究"
                  placeholder="搜索论文、方法、技术问题或来源"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
                <button
                  className="icon-label"
                  onClick={load}
                  title="重新读取网站已发布的数据"
                >
                  <RefreshCw size={16} />
                  <span>检查更新</span>
                </button>
              </div>
              <div className="sectionbar">
                <div className="filters">
                  {[["all", "全部研究"], ...Object.entries(categories)].map(
                    ([id, label]) => (
                      <button
                        key={id}
                        className={`filter ${category === id ? "active" : ""}`}
                        onClick={() => setCategory(id)}
                      >
                        {label}
                      </button>
                    ),
                  )}
                </div>
                <button
                  className={`filter ${recent ? "active" : ""}`}
                  onClick={() => setRecent(!recent)}
                >
                  原文近 14 天 {recent ? "✓" : ""}
                </button>
              </div>
              {route.view === "daily" && (
                <>
                  {focus ? (
                    <div className="research-grid">
                      <article className="focus-paper">
                        <div className="focus-label">
                          <div className="kicker">
                            <span className="tiny-square" />
                            FEATURED RESEARCH / 已核查档案
                          </div>
                          {save(focus)}
                        </div>
                        <button
                          className="focus-title"
                          onClick={() => open(focus)}
                        >
                          {focus.title}
                        </button>
                        {meta(focus)}
                        <p className="summary">{focus.summary}</p>
                        <dl className="evidence-rows">
                          <div className="evidence-row">
                            <dt>核心方法</dt>
                            <dd>{focus.method}</dd>
                          </div>
                          <div className="evidence-row">
                            <dt>结论边界</dt>
                            <dd>{focus.limitations[0]}</dd>
                          </div>
                        </dl>
                        <div className="actions">
                          <button
                            className="button ink"
                            onClick={() => open(focus)}
                          >
                            阅读研究介绍 <ArrowRight size={16} />
                          </button>
                          <button
                            className="text-button blue"
                            onClick={() => open(focus, "evidence")}
                          >
                            核对原文证据 <ArrowUpRight size={15} />
                          </button>
                        </div>
                      </article>
                      <aside className="context-column">
                        <div className="kicker">
                          RESEARCH NOTES / 原始技术进展
                        </div>
                        {filtered
                          .filter((x) => x.id !== focus.id)
                          .map((item) => (
                            <article className="side-note" key={item.id}>
                              {meta(item)}
                              <h2>
                                <button onClick={() => open(item)}>
                                  {item.title}
                                </button>
                              </h2>
                              <p className="summary clamp">{item.summary}</p>
                              <div className="actions">
                                <button
                                  className="text-button"
                                  onClick={() => open(item)}
                                >
                                  继续阅读 <ArrowRight size={14} />
                                </button>
                                {save(item)}
                              </div>
                            </article>
                          ))}
                        <div className="notice">
                          已精读与待精读分开展示。原文日期和核查时间分别保留，基础论文不会标成今日突破。
                        </div>
                      </aside>
                    </div>
                  ) : (
                    <div className="empty-state">
                      <h2>没有匹配的已核查研究</h2>
                      <p>可修改关键词或筛选；下方仍保留待精读候选。</p>
                    </div>
                  )}
                  {queue}
                </>
              )}
              {route.view === "papers" && (
                <>
                  <div className="section-heading">
                    <h2>全文、图表与核心附录均已核查</h2>
                    <p>AI 整理不等于专家审稿或独立复现实验。</p>
                  </div>
                  {cards(filtered.filter((x) => x.type === "paper"))}
                  {queue}
                </>
              )}
              {route.view === "saved" && (
                <>
                  <div className="notice">
                    收藏、已读和备注仅保存在当前浏览器，不上传、不跨设备同步。清除浏览器数据会清除这些记录。
                  </div>
                  {cards(filtered.filter((x) => states[x.id]?.saved))}
                  {!filtered.some((x) => states[x.id]?.saved) && (
                    <div className="empty-state">
                      <h2>收藏你的研究线索</h2>
                      <p>点击研究旁的书签，留待下次继续阅读。</p>
                    </div>
                  )}
                  <div className="actions">
                    <button className="button" onClick={exportLocal}>
                      <Download size={15} />
                      导出本机记录
                    </button>
                    <button className="text-button" onClick={removeLocal}>
                      <Trash2 size={15} />
                      清除本机记录
                    </button>
                  </div>
                </>
              )}
              {route.view === "sources" && (
                <div className="source-grid">
                  <section>
                    <h2>原始来源 · {feedSources.length} 个公开入口</h2>
                    <p className="coverage-note">
                      来源检索在 GitHub 云端执行，网页只读取已发布的结果。
                    </p>
                    {feedSources.map((source) => {
                      const status = data.sources.find(
                        (x) => x.id === source.id,
                      );
                      return (
                        <div className="source-entry" key={source.id}>
                          <div>
                            <a
                              href={source.url}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              {source.name} ↗
                            </a>
                            <small className="source-time">
                              {status
                                ? date(status.checkedAt, true)
                                : "尚无检查记录"}
                            </small>
                          </div>
                          <span
                            className={
                              status?.status === "ok" ? "blue" : "muted"
                            }
                          >
                            {status?.status === "ok"
                              ? `${status.count} 条题录`
                              : status
                                ? "本次未完成"
                                : "待检查"}
                          </span>
                          <span>{status?.status === "ok" ? "✓" : "—"}</span>
                        </div>
                      );
                    })}
                  </section>
                  <aside className="settings-panel">
                    <div className="kicker">RESEARCH STATUS</div>
                    <h2>透明地记录进度</h2>
                    <p>
                      已核查档案 {data.items.length} 项，待精读{" "}
                      {data.pending.length} 项。
                    </p>
                    <p>
                      自动全文精读未启用，模型调用为
                      0。现有精读是已核查档案，自动检索不会把新候选直接变成论文介绍。
                    </p>
                    <p>
                      计划每 4 小时发现、每日 09:00 更新、周五 18:00
                      汇总。GitHub 计划任务可能延迟。
                    </p>
                    <p>
                      这是公开阅读站，不需要登录。没有向本站提交个人资料的入口。
                      GitHub会按其政策记录访问IP等必要日志；本应用不读取这些日志，不上传个人阅读记录。
                    </p>
                  </aside>
                </div>
              )}
              {route.view === "weekly" && (
                <>
                  <div className="section-heading">
                    <h2>最近一周完成核查的材料</h2>
                    <p>
                      这里只回顾实际档案；没有证据时不生成新的技术演变结论。
                    </p>
                  </div>
                  {cards(
                    filtered.filter(
                      (x) =>
                        Date.parse(x.reviewedAt) >= Date.now() - 7 * 86400000,
                    ),
                  )}
                  {!filtered.some(
                    (x) =>
                      Date.parse(x.reviewedAt) >= Date.now() - 7 * 86400000,
                  ) && (
                    <div className="empty-state">
                      <h2>本周暂无新完成的精读</h2>
                      <p>原有研究仍保留在其他栏目。</p>
                    </div>
                  )}
                </>
              )}
              {route.view === "evolution" && (
                <>
                  <div className="section-heading">
                    <h2>围绕问题积累理解</h2>
                    <p>
                      先核对方法、条件和证据，再讨论继承与变化。以下是研究入口，不代表已完成领域综述。
                    </p>
                  </div>
                  {Object.entries(categories).map(([id, label]) => (
                    <section className="topic-section" key={id}>
                      <div className="kicker">{label}</div>
                      <h2>
                        {id === "capabilities"
                          ? "能力提升来自什么机制与代价？"
                          : id === "frontier-safety"
                            ? "如何观察、监督并约束模型行为？"
                            : "智能体怎样安全使用外部信息与工具？"}
                      </h2>
                      {cards(filtered.filter((x) => x.category === id))}
                      {!filtered.some((x) => x.category === id) && (
                        <p className="muted">尚待完成此方向的原始材料精读。</p>
                      )}
                    </section>
                  ))}
                </>
              )}
            </>
          )}
          <footer className="page-footer">
            <div>AI 前沿雷达 / AI 整理 · 原文可查 · 结论有边界</div>
            <div className="footer-links">
              <button onClick={() => navigate("sources")}>
                来源与运行状态
              </button>
              <button onClick={() => navigate("saved")}>本机记录</button>
              <a href="./workbench.html">个人研究工作台 ↗</a>
              <a
                href="https://github.com/Zhiying-Li-dot/ai-frontier"
                target="_blank"
                rel="noopener noreferrer"
              >
                项目源码 ↗
              </a>
            </div>
          </footer>
        </>
      )}
      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
    </div>
  );
}
createRoot(document.getElementById("root")).render(<App />);
