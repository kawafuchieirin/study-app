import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(new Request("http://localhost/", { headers: { accept: "text/html" } }), { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } }, { waitUntil() {}, passThroughOnException() {} });
}

test("renders the Manabi application shell", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);
  const html = await response.text();
  assert.match(html, /<title>Manabi｜学びを、次の一歩につなげる<\/title>/i);
  assert.match(html, /Manabi/);
  assert.doesNotMatch(html, /Your site is taking shape|codex-preview/i);
});

test("includes every requested product capability", async () => {
  const [page, features, backend] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/feature-workspaces.tsx", import.meta.url), "utf8"),
    readFile(new URL("../backend/app/main.py", import.meta.url), "utf8"),
  ]);
  for (const label of ["学習スケジュール", "今日の振り返り", "要点ノート", "苦手グループ", "Manabi AI"]) assert.match(page + features, new RegExp(label));
  for (const route of ["/tasks", "/reflections", "/notes", "/mistakes", "/ai/explain", "/ai/history"]) assert.match(backend, new RegExp(route.replace("/", "\\/")));
});
