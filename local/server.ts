import { createServer } from "node:http";
import { randomBytes } from "node:crypto";
import { readFile, realpath } from "node:fs/promises";
import { join, resolve, relative, isAbsolute } from "node:path";
import { homedir } from "node:os";
import { fileURLToPath } from "node:url";
import { FrontierAgent } from "./agent.ts";
import { isSafeSourceUrl } from "../lib/research.ts";
const root = fileURLToPath(new URL("../", import.meta.url));
const publicFeed =
  "https://zhiying-li-dot.github.io/ai-frontier/data/research.json";
function candidatesFrom(raw: any) {
  const list = raw.pending || raw.inbox || [];
  if (!Array.isArray(list)) return [];
  return list
    .slice(0, 200)
    .filter(
      (x) =>
        x &&
        typeof x.title === "string" &&
        typeof x.sourceUrl === "string" &&
        isSafeSourceUrl(x.sourceUrl),
    )
    .map((x) => ({
      id: String(x.id).slice(0, 160),
      title: x.title.slice(0, 500),
      sourceUrl: x.sourceUrl,
      publishedAt: String(x.publishedAt || "").slice(0, 40),
      sourceName: String(x.sourceName || "").slice(0, 100),
      category: String(x.category || ""),
    }));
}
export async function createWorkbench(
  options: { folder?: string; port?: number; agent?: FrontierAgent } = {},
) {
  const folder = resolve(
    options.folder || join(homedir(), ".local", "share", "ai-frontier"),
  );
  const repo = await realpath(resolve(root, ".."));
  const rel = relative(repo, folder);
  if (!rel || (!rel.startsWith("..") && !isAbsolute(rel)))
    throw Error("本机数据目录必须位于 Git 工作区之外");
  const agent = options.agent || new FrontierAgent(folder);
  await agent.initialize();
  const sessionToken = randomBytes(32).toString("hex");
  let url = "";
  let candidates: any[] = [];
  let discoveryAt: string | null = null;
  let discoveryMessage = "显示随代码保存的候选；可刷新云端雷达";
  let lastRefresh = 0;
  try {
    candidates = candidatesFrom(
      JSON.parse(await readFile(join(root, "cloud-data/state.json"), "utf8")),
    );
  } catch {}
  async function refresh() {
    if (Date.now() - lastRefresh < 60000)
      throw Error("一分钟内只需刷新一次候选");
    lastRefresh = Date.now();
    try {
      const response = await fetch(publicFeed, {
        signal: AbortSignal.timeout(20000),
        redirect: "error",
      });
      if (!response.ok || !response.body) throw Error();
      let size = 0;
      const chunks: Uint8Array[] = [];
      const reader = response.body.getReader();
      try {
        while (true) {
          const part = await reader.read();
          if (part.done) break;
          size += part.value.length;
          if (size > 10000000) throw Error();
          chunks.push(part.value);
        }
      } finally {
        await reader.cancel().catch(() => {});
      }
      const raw = JSON.parse(Buffer.concat(chunks).toString("utf8"));
      candidates = candidatesFrom(raw);
      discoveryAt = raw.updatedAt || null;
      discoveryMessage = "已读取 GitHub Pages 的真实发现结果；候选尚未精读";
    } catch {
      discoveryMessage = "云端候选刷新失败，保留现有候选；可稍后重试";
      throw Error(discoveryMessage);
    }
  }
  const server = createServer(async (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "no-referrer");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader(
      "Content-Security-Policy",
      "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; font-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'",
    );
    const json = (status: number, value: unknown) => {
      res.writeHead(status, {
        "Content-Type": "application/json; charset=utf-8",
      });
      res.end(JSON.stringify(value));
    };
    const origin = url.slice(0, -1);
    if (req.headers.host !== new URL(url).host) {
      json(403, { error: "Host 不允许" });
      return;
    }
    let pathname: string;
    try {
      pathname = new URL(req.url || "/", url).pathname;
    } catch {
      json(400, { error: "请求地址错误" });
      return;
    }
    if (pathname.startsWith("/api/")) {
      if (
        req.headers["sec-fetch-site"] === "cross-site" ||
        (req.headers.origin && req.headers.origin !== origin)
      ) {
        json(403, { error: "仅允许本机同源工作台" });
        return;
      }
      try {
        if (req.method === "GET" && pathname === "/api/state") {
          json(200, {
            ...agent.snapshot(),
            sessionToken,
            candidates,
            discoveryAt,
            discoveryMessage,
          });
          return;
        }
        if (req.method === "GET" && pathname.startsWith("/api/view/")) {
          json(200, agent.view(pathname.slice("/api/view/".length)));
          return;
        }
        if (req.method === "GET" && pathname.startsWith("/api/source/")) {
          json(200, {
            source: agent.archive(pathname.slice("/api/source/".length)).source,
          });
          return;
        }
        if (req.method !== "POST" || pathname !== "/api/action") {
          json(404, { error: "接口不存在" });
          return;
        }
        if (
          req.headers.origin !== origin ||
          req.headers["x-frontier-session"] !== sessionToken
        ) {
          json(403, { error: "请从本机工作台发起操作" });
          return;
        }
        if (
          !/^application\/json(?:;|$)/i.test(req.headers["content-type"] || "")
        ) {
          json(415, { error: "需要 JSON 请求" });
          return;
        }
        let body = "";
        for await (const chunk of req) {
          body += chunk;
          if (Buffer.byteLength(body) > 12000) {
            json(413, { error: "输入过长" });
            return;
          }
        }
        const action = JSON.parse(body);
        let result: unknown;
        switch (action.action) {
          case "profile":
            result = agent.setProfile(action.value);
            break;
          case "read":
            if (typeof action.url !== "string" || action.url.length > 2000)
              throw Error("来源地址过长或缺失");
            result = await agent.startReading(action.url);
            break;
          case "feedback":
            result = agent.feedback(action.fingerprint, action.kind);
            break;
          case "evaluate":
            result = agent.evaluate(action.id);
            break;
          case "adopt":
            result = agent.adopt(action.id);
            break;
          case "reject":
            result = agent.reject(action.id);
            break;
          case "rollback":
            result = agent.rollback();
            break;
          case "clear-personal":
            agent.clearPersonal();
            result = { cleared: true };
            break;
          case "refresh":
            await refresh();
            result = { updated: true };
            break;
          default:
            throw Error("操作不支持");
        }
        json(200, { result });
      } catch (error: any) {
        json(400, {
          error:
            error?.name === "ZodError"
              ? "输入字段或长度不符合要求"
              : String(error?.message || "操作失败").slice(0, 400),
        });
      }
      return;
    }
    if (req.method !== "GET") {
      res.writeHead(405);
      res.end();
      return;
    }
    let file: string | undefined;
    if (pathname === "/" || pathname === "/workbench.html")
      file = "workbench.html";
    else if (/^\/assets\/[\w.-]+\.(?:js|css)$/.test(pathname))
      file = pathname.slice(1);
    else if (pathname === "/favicon.svg") file = "favicon.svg";
    if (!file) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }
    try {
      const bytes = await readFile(join(root, "dist", file));
      const type = file.endsWith(".js")
        ? "text/javascript"
        : file.endsWith(".css")
          ? "text/css"
          : file.endsWith(".svg")
            ? "image/svg+xml"
            : "text/html";
      res.writeHead(200, { "Content-Type": type + "; charset=utf-8" });
      res.end(bytes);
    } catch {
      res.writeHead(503, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("工作台页面尚未构建，请先运行 npm run build，再刷新。");
    }
  });
  server.requestTimeout = 15000;
  server.headersTimeout = 10000;
  await new Promise<void>((ok, fail) => {
    server.once("error", fail);
    server.listen(options.port ?? 4318, "127.0.0.1", () => ok());
  });
  const address = server.address();
  if (!address || typeof address === "string") throw Error("本机服务启动失败");
  url = `http://127.0.0.1:${address.port}/`;
  return {
    url,
    agent,
    refresh,
    close: async () => {
      agent.close();
      await new Promise<void>((ok, fail) =>
        server.close((e) => (e ? fail(e) : ok())),
      );
    },
  };
}
if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const app = await createWorkbench();
  console.log(
    `AI Frontier 本机工作台：${app.url}\n个人资料仅本次进程内存；模型只接收公开来源。按 Ctrl+C 停止。`,
  );
  app.refresh().catch(() => {});
  let stopping = false;
  for (const signal of ["SIGINT", "SIGTERM"] as const)
    process.on(signal, () => {
      if (stopping) return;
      stopping = true;
      app.close().finally(() => process.exit(0));
    });
}
