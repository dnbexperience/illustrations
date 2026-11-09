import { readFile } from "node:fs/promises";
import path from "node:path";
import { generate } from "./generate.js";
import type { DiscoveryReport } from "./discover-figma.js";
import {
  palettes,
  projectRoot,
  readJson,
  sha256,
  stableJson,
  type Config,
  type SourceLock,
} from "./lib/project.js";
import { mapPaints } from "./lib/svg.js";
import { validateConfig } from "./lib/validate.js";
import { validateMaskPaints, type Coverage } from "./lib/discovery.js";

const ids = process.argv.slice(2);
if (
  !ids.length ||
  ids.some((id) => !/^\d+:\d+$/.test(id)) ||
  new Set(ids).size !== ids.length
) {
  throw new Error(
    "Pass the reviewed Figma node IDs: npm run import:figma -- 123:456",
  );
}
const report = await readJson<DiscoveryReport>(".figma-review/report.json");
const config = await readJson<Config>("figma.config.json");
const colors = await palettes();
const lock = await readJson<SourceLock>(".figma/lock.json");
const coverage = await readJson<Coverage>(".figma/coverage.json");
if (
  report.schemaVersion !== 1 ||
  report.fileKey !== config.fileKey ||
  !report.figmaVersion
) {
  throw new Error("Invalid discovery report.");
}
const staged: Array<{ path: string; content: string }> = [];
for (const id of ids) {
  const proposal = report.candidates.find(({ source }) => source.nodeId === id);
  if (!proposal || proposal.error || !proposal.sha256) {
    throw new Error("Missing or invalid reviewed proposal: " + id);
  }
  const page = config.pages?.find(({ id }) => id === proposal.source.pageId);
  if (!page || !["approved", "component"].includes(page.status)) {
    throw new Error("Proposal is outside the configured source pages.");
  }
  const content = await readFile(
    path.join(projectRoot, ".figma-review", id.replace(":", "-"), "source.svg"),
    "utf8",
  );
  if (sha256(content) !== proposal.sha256) {
    throw new Error("Proposal source differs from its reviewed hash.");
  }
  mapPaints(content, proposal.source.paints);
  validateMaskPaints(content, proposal.source.paints, colors);
  config.illustrations.push(proposal.source);
  lock.assets.push({
    path: proposal.source.original,
    nodeId: id,
    sha256: proposal.sha256,
    exportSha256: proposal.sha256,
    figmaVersion: report.figmaVersion,
  });
  coverage.nodes.push({ id, pageId: page.id, result: "included" });
  staged.push({ path: proposal.source.original, content });
}
validateConfig(config, colors);
// Mixed source versions are recorded per asset until the next complete sync.
if (lock.figmaVersion !== report.figmaVersion) {
  if (lock.figmaVersion) {
    for (const asset of lock.assets) {
      asset.figmaVersion ??= lock.figmaVersion;
    }
  }
  lock.figmaVersion = null;
}
await generate(false, {
  config,
  lock,
  sources: new Map(staged.map(({ path, content }) => [path, content])),
  files: new Map([
    ["figma.config.json", stableJson(config)],
    [".figma/lock.json", stableJson(lock)],
    [".figma/coverage.json", stableJson(coverage)],
  ]),
});
console.log(
  "Imported " +
    ids.length +
    " reviewed illustrations. Run npm run ci and review the catalog before committing.",
);
