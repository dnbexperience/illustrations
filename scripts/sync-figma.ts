import {
  readJson,
  sha256,
  stableJson,
  type Config,
  palettes,
  projectRoot,
  type SourceLock,
} from "./lib/project.js";
import { validateConfig } from "./lib/validate.js";
import { mapPaints, normalizeSource } from "./lib/svg.js";
import { figmaJson, downloadSvg } from "./lib/figma.js";
import { generate } from "./generate.js";
import { discoverFigma } from "./discover-figma.js";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
const token = process.env.FIGMA_TOKEN;
if (!token) {
  throw new Error("FIGMA_TOKEN is required.");
}
const config = await readJson<Config>("figma.config.json");
const colors = await palettes();
validateConfig(config, colors);
const previous = await readJson<SourceLock>(".figma/lock.json");
type Nodes = {
  version: string;
  nodes: Record<string, { document: { id: string; name: string } } | null>;
};
const first = await figmaJson<Nodes>(
  "files/" +
    config.fileKey +
    "/nodes?ids=" +
    encodeURIComponent(config.illustrations[0]!.nodeId),
  token,
);
if (!first.version) {
  throw new Error("Figma did not provide a source version.");
}
await discoverFigma(config, colors, token, first.version);
const nodeDocuments: Nodes["nodes"] = {};
const images: Record<string, string | null> = {};
for (let start = 0; start < config.illustrations.length; start += 40) {
  const ids = config.illustrations
    .slice(start, start + 40)
    .map((e) => e.nodeId)
    .join(",");
  const query = new URLSearchParams({ ids, version: first.version });
  const nodes = await figmaJson<Nodes>(
    "files/" + config.fileKey + "/nodes?" + query.toString(),
    token,
  );
  if (nodes.version !== first.version) {
    throw new Error("Figma returned an inconsistent source version.");
  }
  Object.assign(nodeDocuments, nodes.nodes);
  const result = await figmaJson<{
    err?: string;
    images: Record<string, string | null>;
  }>(
    "images/" +
      config.fileKey +
      "?" +
      new URLSearchParams({
        ids,
        format: "svg",
        svg_include_id: "true",
        svg_simplify_stroke: "false",
        use_absolute_bounds: "false",
        version: first.version,
      }).toString(),
    token,
  );
  if (result.err) {
    throw new Error("Figma export failed.");
  }
  Object.assign(images, result.images);
}
const staged: Array<{
  path: string;
  nodeId: string;
  content: string;
  sha256: string;
  exportContent: string;
  exportSha256: string;
}> = [];
const errors: Array<{ nodeId: string; source: string; message: string }> = [];
for (const entry of config.illustrations) {
  if (!nodeDocuments[entry.nodeId]?.document) {
    throw new Error("Missing configured Figma source: " + entry.nodeId);
  }
  const url = images[entry.nodeId];
  if (!url) {
    throw new Error("Missing SVG export: " + entry.nodeId);
  }
  const raw = await downloadSvg(url);
  let content = raw;
  let exportContent = raw;
  try {
    content = normalizeSource(raw);
    exportContent = content;
    const locked = previous.assets.find(
      (asset) => asset.path === entry.original && asset.nodeId === entry.nodeId,
    );
    if (locked?.exportSha256 === sha256(content)) {
      content = await readFile(path.join(projectRoot, entry.original), "utf8");
      if (sha256(content) !== locked.sha256) {
        throw new Error("Source differs from lock: " + entry.original);
      }
    }
    mapPaints(content, entry.paints);
  } catch (error) {
    errors.push({
      nodeId: entry.nodeId,
      source: entry.original,
      message: error instanceof Error ? error.message : "Invalid SVG export.",
    });
  }
  staged.push({
    path: entry.original,
    nodeId: entry.nodeId,
    content,
    sha256: sha256(content),
    exportContent,
    exportSha256: sha256(exportContent),
  });
}
const reviewDirectory = ".figma-review/sync";
await mkdir(reviewDirectory, { recursive: true });
for (const file of staged) {
  await writeFile(
    reviewDirectory + "/" + file.nodeId.replace(":", "-") + ".svg",
    file.exportContent,
  );
}
await writeFile(
  reviewDirectory + "/report.json",
  stableJson({
    figmaVersion: first.version,
    errors,
    sources: staged.map((file) => ({
      nodeId: file.nodeId,
      original: file.path,
      path: file.nodeId.replace(":", "-") + ".svg",
      sha256: file.exportSha256,
    })),
  }),
);
if (errors.length) {
  throw new Error(
    "Review Figma exports in .figma-review/sync/report.json: " +
      errors.length +
      " source mappings need review.",
  );
}
if (
  previous.figmaVersion !== null &&
  staged.length === previous.assets.length &&
  staged.every((file) =>
    previous.assets.some(
      (old) =>
        old.path === file.path &&
        old.nodeId === file.nodeId &&
        old.sha256 === file.sha256 &&
        old.exportSha256 === file.exportSha256,
    ),
  )
) {
  console.log("Configured Figma artwork is unchanged.");
  process.exit(0);
}
const lock = {
  schemaVersion: 1,
  figmaVersion: first.version,
  assets: staged.map(({ path, nodeId, sha256, exportSha256 }) => ({
    path,
    nodeId,
    sha256,
    exportSha256,
  })),
};
await generate(false, {
  config,
  lock,
  sources: new Map(staged.map(({ path, content }) => [path, content])),
  files: new Map([[".figma/lock.json", stableJson(lock)]]),
});
console.log(
  "Synchronized " +
    staged.length +
    " illustrations from Figma " +
    first.version +
    ".",
);
