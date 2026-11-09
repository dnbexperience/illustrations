import { setTimeout as delay } from "node:timers/promises";

async function request(
  url: string | URL,
  init: RequestInit,
): Promise<Response> {
  for (let attempt = 1; attempt <= 4; attempt++) {
    const response = await fetch(url, {
      ...init,
      signal: AbortSignal.timeout(30000),
    });
    if (
      response.ok ||
      (response.status !== 429 && response.status < 500) ||
      attempt === 4
    ) {
      return response;
    }
    await response.body?.cancel();
    await delay(attempt * 250);
  }
  throw new Error("Figma retry limit reached.");
}

export async function figmaJson<T>(
  endpoint: string,
  token: string,
): Promise<T> {
  const response = await request("https://api.figma.com/v1/" + endpoint, {
    headers: { "X-Figma-Token": token },
    redirect: "error",
    signal: AbortSignal.timeout(30000),
  });
  if (!response.ok) {
    throw new Error("Figma request failed with HTTP " + response.status);
  }
  const text = await response.text();
  if (Buffer.byteLength(text) > 25 * 1024 * 1024) {
    throw new Error("Figma response is too large.");
  }
  return JSON.parse(text) as T;
}

export async function downloadSvg(url: string): Promise<string> {
  const parsed = new URL(url);
  if (
    parsed.protocol !== "https:" ||
    !(
      /^(s3-alpha(?:-sig)?\.figma\.com)$/.test(parsed.hostname) ||
      /^figma-alpha-api\.s3[.-][a-z0-9.-]+\.amazonaws\.com$/.test(
        parsed.hostname,
      )
    )
  ) {
    throw new Error("Unsupported Figma asset host.");
  }
  const response = await request(parsed, {
    redirect: "error",
    signal: AbortSignal.timeout(30000),
  });
  if (!response.ok) {
    throw new Error("SVG download failed with HTTP " + response.status);
  }
  if (Number(response.headers.get("content-length") ?? 0) > 2 * 1024 * 1024) {
    throw new Error("SVG exceeds size limit.");
  }
  const text = await response.text();
  if (Buffer.byteLength(text) > 2 * 1024 * 1024) {
    throw new Error("SVG exceeds size limit.");
  }
  return text;
}
