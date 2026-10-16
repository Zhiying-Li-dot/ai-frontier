import test from "node:test";
import assert from "node:assert/strict";
import {
  readFileSync,
  mkdtempSync,
  rmSync,
  existsSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { writePublicData } from "../scripts/archive.ts";
const seed = JSON.parse(readFileSync("lib/seed-data.json", "utf8"));
test("重新发布保留实际旧快照，伪造历史路径不能读取任意文件", () => {
  const dir = mkdtempSync(join(tmpdir(), "frontier-pages-history-"));
  try {
    const first = writePublicData(seed, dir);
    const item = seed.items[0];
    const second = writePublicData(
      {
        items: [
          {
            ...item,
            summary: item.summary + " 更正后的说明。",
            reviewedAt: new Date().toISOString(),
          },
        ],
      },
      dir,
    );
    assert.equal(second.versions[item.id].length, 2);
    const old = first.versions[item.id][0].fingerprint;
    assert.ok(existsSync(join(dir, "versions", old + ".json")));
    assert.equal(
      JSON.parse(readFileSync(join(dir, "versions", old + ".json"), "utf8"))
        .item.summary,
      item.summary,
    );
    second.versions[item.id][0].fingerprint = "../../private";
    writeFileSync(join(dir, "research.json"), JSON.stringify(second));
    assert.throws(() => writePublicData(seed, dir), /历史|指纹/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
