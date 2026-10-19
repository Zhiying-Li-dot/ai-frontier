import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, writeFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { isSafeSourceUrl } from "../lib/research.ts";
export const sha = (value: string | Uint8Array) =>
  createHash("sha256").update(value).digest("hex");
export function extractHtml(html: string) {
  const main =
    /<(?:article|main)\b[^>]*>([\s\S]*?)<\/(?:article|main)>/i.exec(
      html,
    )?.[1] || html;
  const unreadImages = /<(?:img|svg|canvas|video)\b/i.test(main);
  const text = main
    .replace(/<(script|style|nav|header|footer)\b[^>]*>[\s\S]*?<\/\1>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(
      /<\/(?:p|div|h[1-6]|li|section|tr|pre|blockquote)>|<br\s*\/?\s*>/gi,
      "\n",
    )
    .replace(/<[^>]*>/g, " ")
    .replace(/&#(x[0-9a-f]+|\d+);/gi, (_, v) => {
      const n =
        v[0].toLowerCase() === "x" ? parseInt(v.slice(1), 16) : Number(v);
      return n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : " ";
    })
    .replace(
      /&(amp|lt|gt|quot|apos|nbsp);/g,
      (_, s) =>
        ({ amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " })[s] ||
        " ",
    )
    .split("\n")
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join("\n");
  return { text, unreadImages };
}
export type Source = {
  id: string;
  url: string;
  fetchedAt: string;
  version: string;
  title: string;
  kind: "paper" | "blog" | "documentation" | "technical-note";
  scope: "partial" | "full";
  text: string;
  lines: number;
  gaps: string[];
};
export async function fetchSource(
  url: string,
  transport: typeof fetch = fetch,
): Promise<Source> {
  let target = url,
    response: Response | undefined;
  for (let i = 0; i < 5; i++) {
    if (!isSafeSourceUrl(target))
      throw Error("仅允许来源白名单中的 HTTPS 地址");
    response = await transport(target, {
      redirect: "manual",
      signal: AbortSignal.timeout(30000),
      headers: { "User-Agent": "AI-Frontier-Reader/1.0" },
    });
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const next = response.headers.get("location");
      await response.body?.cancel();
      if (!next || i === 4) throw Error("来源重定向过多");
      target = new URL(next, target).href;
      continue;
    }
    break;
  }
  if (!response?.ok || !response.body)
    throw Error(`来源暂时无法读取（${response?.status || "network"}）`);
  const type = response.headers.get("content-type") || "";
  const pdf =
    /application\/pdf/i.test(type) || new URL(target).pathname.endsWith(".pdf");
  if (!pdf && !/text\/|application\/(?:xml|json|xhtml)/i.test(type))
    throw Error("不支持的来源格式");
  const chunks: Uint8Array[] = [];
  let size = 0;
  const reader = response.body.getReader();
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      size += part.value.length;
      if (size > (pdf ? 8_000_000 : 2_000_000)) throw Error("来源超过大小限制");
      chunks.push(part.value);
    }
  } finally {
    await reader.cancel().catch(() => {});
  }
  const bytes = Buffer.concat(chunks);
  let text = "",
    title = "",
    unreadImages = false;
  const gaps: string[] = [];
  if (pdf) {
    const folder = await mkdtemp(join(tmpdir(), "frontier-pdf-"));
    try {
      if (bytes.subarray(0, 5).toString() !== "%PDF-")
        throw Error("文件不是 PDF");
      const file = join(folder, "source.pdf");
      await writeFile(file, bytes, { mode: 0o600 });
      const run = promisify(execFile);
      const info = await run("pdfinfo", [file], {
        timeout: 15000,
        maxBuffer: 100000,
      });
      const pages = Number(/^Pages:\s*(\d+)/m.exec(info.stdout)?.[1]);
      if (!pages || pages > 40) throw Error("PDF 页数未知或超过 40 页");
      await run(
        "pdftotext",
        ["-layout", "-enc", "UTF-8", file, join(folder, "source.txt")],
        { timeout: 20000, maxBuffer: 100000 },
      );
      text = await readFile(join(folder, "source.txt"), "utf8");
      title =
        /^Title:\s*(.+)/m.exec(info.stdout)?.[1] || new URL(target).pathname;
      gaps.push(
        "仅提取 PDF 文字；图、表视觉内容与必要附录尚未逐项检查，保持待补材料。",
      );
    } finally {
      await rm(folder, { recursive: true, force: true });
    }
  } else {
    const raw = bytes.toString("utf8");
    if (/html/i.test(type)) {
      ({ text, unreadImages } = extractHtml(raw));
      title = extractHtml(
        /<title\b[^>]*>([\s\S]*?)<\/title>/i.exec(raw)?.[1] || "",
      ).text;
    } else {
      text = raw;
      title =
        /^title:\s*(.+)$/m.exec(raw)?.[1] ||
        /^name:\s*(.+)$/m.exec(raw)?.[1] ||
        raw
          .split("\n")
          .find((l) => l.trim() && l.trim() !== "---")
          ?.replace(/^#+\s*/, "") ||
        target;
      unreadImages = /!\[[^\]]*\]\(/.test(raw);
    }
    if (unreadImages)
      gaps.push("本次只读正文文字，页面图像尚未检查；不标为完整精读。");
  }
  if (text.length > 85000) {
    text = text.slice(0, 85000);
    gaps.push("正文超过单次阅读上限，已截断。");
  }
  const lines = text
    .split(/\r?\n/)
    .map((x) => x.trim())
    .filter(Boolean);
  if (text.trim().length < 150)
    throw Error("正文过短，可能是访问限制页；未调用模型");
  if (
    /just a moment|enable javascript and cookies|access denied|verify you are human/i.test(
      text.slice(0, 1000),
    )
  )
    throw Error("来源返回访问限制页；未调用模型");
  return {
    id: sha(url).slice(0, 24),
    url: target,
    fetchedAt: new Date().toISOString(),
    version: sha(bytes),
    title: title.slice(0, 300) || target,
    kind: pdf
      ? "paper"
      : new URL(target).hostname === "raw.githubusercontent.com"
        ? "technical-note"
        : /docs\.|\/docs\//.test(target)
          ? "documentation"
          : "blog",
    scope: gaps.length ? "partial" : "full",
    text: lines.map((l, i) => `L${i + 1} ${l}`).join("\n"),
    lines: lines.length,
    gaps,
  };
}
