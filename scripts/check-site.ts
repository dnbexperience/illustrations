import { readFile } from "node:fs/promises";
import path from "node:path";
import { projectRoot, readJson, listFiles } from "./lib/project.js";
import type { IllustrationManifest } from "../src/types.js";
await readJson<IllustrationManifest>("manifest.json");
const html = await readFile(
  path.join(projectRoot, ".pages/index.html"),
  "utf8",
);
for (const marker of ['id="root"', 'rel="icon"']) {
  if (!html.includes(marker)) {
    throw new Error("Missing Pages marker: " + marker);
  }
}
const files = await listFiles(path.join(projectRoot, ".pages"));
for (const file of files.filter((file) => file.endsWith(".html"))) {
  const content = await readFile(file, "utf8");
  const robots = content.match(
    /<meta\s+name="robots"\s+content="([^"]+)"/i,
  )?.[1];
  const rules = new Set(robots?.toLowerCase().split(/\s*,\s*/));
  for (const rule of ["noindex", "nofollow", "noimageindex", "nosnippet"]) {
    if (!rules.has(rule)) {
      throw new Error(
        "Missing search exclusion " +
          rule +
          " in " +
          path.relative(projectRoot, file),
      );
    }
  }
}
if (files.some((file) => path.basename(file) === "robots.txt")) {
  throw new Error(
    "Keep HTML crawlable so search engines can read its noindex directive.",
  );
}
if (!files.some((file) => path.basename(file).startsWith("favicon-"))) {
  throw new Error("Missing Eufemia favicon.");
}
const styles = await Promise.all(
  files
    .filter((file) => file.endsWith(".css"))
    .map((file) => readFile(file, "utf8")),
);
if (!styles.some((css) => css.includes("eufemia-theme__color-scheme--dark"))) {
  throw new Error("Missing Eufemia dark mode tokens.");
}
for (const name of ["manifest.json", "README.md", "LICENSE"]) {
  const expected = await readFile(path.join(projectRoot, name));
  const actual = await readFile(path.join(projectRoot, ".pages", name));
  if (!actual.equals(expected)) {
    throw new Error("Catalog metadata differs: " + name);
  }
}
console.log("Verified token-based component catalogue.");
