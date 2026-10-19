import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { get } from "node:http";
import { createWorkbench } from "../local/server.ts";

test("工作台拒绝跨源、错误 Host、缺 token 写入和错误内容类型", async () => {
  const folder = await mkdtemp(join(tmpdir(), "frontier-server-test-"));
  const server = await createWorkbench({ folder, port: 0 });
  try {
    const base = server.url;
    const state = await fetch(base + "api/state");
    assert.equal(state.status, 200);
    const token = (await state.json()).sessionToken;
    const data = {
      action: "profile",
      value: {
        role: "agent",
        goal: "test",
        topic: "tools",
        depth: "technical",
      },
    };
    for (const headers of [
      {
        origin: "https://evil.example",
        "x-frontier-session": token,
        "content-type": "application/json",
      },
      { origin: base.slice(0, -1), "content-type": "application/json" },
      {
        origin: base.slice(0, -1),
        "x-frontier-session": token,
        "content-type": "text/plain",
      },
    ]) {
      const r = await fetch(base + "api/action", {
        method: "POST",
        headers,
        body: JSON.stringify(data),
      });
      assert.ok([403, 415].includes(r.status));
    }
    const wrongHost = await new Promise((resolve) =>
      get(base + "api/state", { headers: { host: "evil.example" } }, (res) => {
        res.resume();
        resolve(res.statusCode);
      }),
    );
    assert.equal(wrongHost, 403);
    const ok = await fetch(base + "api/action", {
      method: "POST",
      headers: {
        origin: base.slice(0, -1),
        "content-type": "application/json",
        "x-frontier-session": token,
      },
      body: JSON.stringify(data),
    });
    assert.equal(ok.status, 200);
    assert.equal(
      (await (await fetch(base + "api/state")).json()).profile.role,
      "agent",
    );
    assert.equal(
      (
        await fetch(base + "api/state", {
          headers: { "sec-fetch-site": "cross-site" },
        })
      ).status,
      403,
    );
    assert.equal(
      (
        await fetch(base + "api/action", {
          method: "POST",
          headers: {
            origin: base.slice(0, -1),
            "content-type": "application/json",
            "x-frontier-session": token,
          },
          body: JSON.stringify({
            action: "read",
            url: "http://127.0.0.1/private",
          }),
        })
      ).status,
      400,
    );
    assert.equal((await fetch(base + "%2e%2e%2fpackage.json")).status, 404);
  } finally {
    await server.close();
    await rm(folder, { recursive: true, force: true });
  }
});
