import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { writePublicData } from "./archive.ts";
const input = existsSync("cloud-data/state.json")
  ? JSON.parse(readFileSync("cloud-data/state.json", "utf8"))
  : {
      ...JSON.parse(readFileSync("lib/seed-data.json", "utf8")),
      readerStatus: "not-configured",
    };
const data = writePublicData(input, "public/data");
writeFileSync("public/.nojekyll", "");
console.log(
  JSON.stringify({
    publicItems: data.items.length,
    pending: data.pending.length,
    sourceFailures: data.sources.filter((x) => x.status === "failed").length,
  }),
);
