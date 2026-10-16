import {
  existsSync,
  readFileSync,
  mkdirSync,
  writeFileSync,
  statSync,
} from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { z } from "zod";
import { itemSchema, validateResearchItem } from "../lib/research.ts";
import { projectPublic } from "./public-data.ts";
const fingerprint = (item: unknown) =>
  createHash("sha256").update(JSON.stringify(item)).digest("hex");
const versionSchema = z.object({
  fingerprint: z.string().regex(/^[a-f0-9]{64}$/, "历史指纹无效"),
  created_at: z.string().datetime({ offset: true }),
});
export function writePublicData(input: unknown, folder: string) {
  const data = projectPublic(input),
    file = join(folder, "research.json");
  const versions: Record<string, z.infer<typeof versionSchema>[]> = {};
  if (existsSync(file)) {
    if (statSync(file).size > 10000000) throw Error("历史索引超限");
    const previous = z
      .object({
        versions: z.record(
          z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,159}$/),
          z.array(versionSchema).max(200),
        ),
      })
      .parse(JSON.parse(readFileSync(file, "utf8")));
    if (Object.keys(previous.versions).length > 5000)
      throw Error("历史档案超限");
    for (const [id, entries] of Object.entries(previous.versions)) {
      versions[id] = [];
      for (const entry of entries) {
        const path = join(folder, "versions", entry.fingerprint + ".json");
        if (!existsSync(path)) throw Error("历史快照缺失");
        if (statSync(path).size > 1000000) throw Error("历史快照超限");
        const item = validateResearchItem(
          itemSchema
            .strict()
            .parse(JSON.parse(readFileSync(path, "utf8")).item),
        );
        if (
          item.id !== id ||
          item.status !== "ready" ||
          fingerprint(item) !== entry.fingerprint
        )
          throw Error("历史快照指纹或归属不匹配");
        versions[id].push(entry);
      }
    }
  }
  mkdirSync(join(folder, "versions"), { recursive: true });
  for (const item of data.items) {
    const hash = fingerprint(item);
    versions[item.id] = [
      { fingerprint: hash, created_at: item.reviewedAt },
      ...(versions[item.id] || []).filter((x) => x.fingerprint !== hash),
    ].slice(0, 200);
    writeFileSync(
      join(folder, "versions", hash + ".json"),
      JSON.stringify({ item }),
    );
  }
  const result = { ...data, versions };
  writeFileSync(file, JSON.stringify(result));
  return result;
}
