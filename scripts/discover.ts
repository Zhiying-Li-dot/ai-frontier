import {
  existsSync,
  readFileSync,
  mkdirSync,
  writeFileSync,
  renameSync,
} from "node:fs";
import { cloudStateSchema, freshState, discover } from "../cloud/state.ts";
const path = "cloud-data/state.json";
const state = existsSync(path)
  ? cloudStateSchema.parse(JSON.parse(readFileSync(path, "utf8")))
  : freshState(JSON.parse(readFileSync("lib/seed-data.json", "utf8")).items);
await discover(state);
// This free publication workflow never calls a model or accepts an API key.
state.readerStatus = "not-configured";
mkdirSync("cloud-data", { recursive: true });
writeFileSync(
  "cloud-data/state.next.json",
  JSON.stringify(state, null, 2) + "\n",
);
renameSync("cloud-data/state.next.json", path);
console.log(
  JSON.stringify({
    result: state.runs[0]?.status,
    pending: state.inbox.length,
    ready: state.items.length,
    modelCalls: 0,
  }),
);
