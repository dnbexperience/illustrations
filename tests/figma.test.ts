import assert from "node:assert/strict";
import { it } from "node:test";
import { figmaJson, downloadSvg } from "../scripts/lib/figma.js";

it("retries temporary Figma API and asset failures", async (t) => {
  let calls = 0;
  t.mock.method(globalThis, "fetch", () => {
    calls++;
    return Promise.resolve(
      calls < 3
        ? new Response("busy", { status: 503 })
        : new Response('{"version":"ready"}', { status: 200 }),
    );
  });
  assert.deepEqual(await figmaJson("files/known", "test-token"), {
    version: "ready",
  });
  assert.equal(calls, 3);
});

it("sends Figma credentials only to the API and downloads assets without them", async (t) => {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  t.mock.method(
    globalThis,
    "fetch",
    (input: string | URL, init?: RequestInit) => {
      calls.push({ url: String(input), init });
      return Promise.resolve(
        new Response(
          String(input).includes("api.figma.com")
            ? '{"version":"123"}'
            : "<svg/>",
          { status: 200 },
        ),
      );
    },
  );
  assert.deepEqual(
    await figmaJson("files/known/nodes?ids=1%3A2", "test-token"),
    { version: "123" },
  );
  assert.equal(
    await downloadSvg("https://s3-alpha.figma.com/known.svg"),
    "<svg/>",
  );
  assert.equal(
    (calls[0]!.init?.headers as Record<string, string>)["X-Figma-Token"],
    "test-token",
  );
  assert.equal(calls[0]!.init?.redirect, "error");
  assert.equal(calls[1]!.init?.headers, undefined);
  for (const url of [
    "http://s3-alpha.figma.com/a.svg",
    "https://example.com/a.svg",
    "https://s3-alpha.figma.com.example.com/a.svg",
  ]) {
    await assert.rejects(downloadSvg(url), /host/);
  }
  assert.equal(calls.length, 2);
});
it("rejects unsuccessful and oversized Figma downloads", async (t) => {
  t.mock.method(globalThis, "fetch", () =>
    Promise.resolve(new Response("unavailable", { status: 503 })),
  );
  await assert.rejects(figmaJson("files/known", "test-token"), /HTTP 503/);
  await assert.rejects(
    downloadSvg("https://s3-alpha.figma.com/a.svg"),
    /HTTP 503/,
  );
  t.mock.method(globalThis, "fetch", () =>
    Promise.resolve(
      new Response("large", {
        status: 200,
        headers: { "content-length": String(3 * 1024 * 1024) },
      }),
    ),
  );
  await assert.rejects(
    downloadSvg("https://s3-alpha.figma.com/a.svg"),
    /size limit/,
  );
});
