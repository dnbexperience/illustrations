import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { downloadSvg, figmaJson } from "./lib/figma.js";
import {
  findCandidates,
  previewSvg,
  proposeSource,
  suggestPaints,
  type Candidate,
  type Coverage,
  type FigmaNode,
  type Suggestion,
  type ContrastWarning,
} from "./lib/discovery.js";
import {
  palettes,
  projectRoot,
  readJson,
  sha256,
  stableJson,
  type Config,
  type Palette,
  type Source,
} from "./lib/project.js";
import { normalizeSource } from "./lib/svg.js";
import { validateConfig } from "./lib/validate.js";
import type { IllustrationBrand } from "../src/types.js";

export type DiscoveryReport = {
  schemaVersion: 1;
  fileKey: string;
  figmaVersion: string;
  candidates: Array<{
    source: Source;
    sha256?: string;
    suggestions?: Suggestion[];
    warnings?: string[];
    contrastWarnings?: ContrastWarning[];
    error?: string;
  }>;
};
const escapeHtml = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        character
      ]!,
  );

export async function discoverFigma(
  config: Config,
  colors: Record<IllustrationBrand, Palette>,
  token: string,
  version: string,
): Promise<DiscoveryReport> {
  const coverage = await readJson<Coverage>(".figma/coverage.json");
  const candidates: Candidate[] = [];
  for (const page of config.pages ?? []) {
    if (!["approved", "component"].includes(page.status)) {
      continue;
    }
    const queue = [page.id],
      visited = new Set<string>();
    while (queue.length) {
      const id = queue.shift()!;
      if (visited.has(id)) {
        continue;
      }
      visited.add(id);
      const response = await figmaJson<{
        version: string;
        nodes: Record<string, { document: FigmaNode } | null>;
      }>(
        "files/" +
          config.fileKey +
          "/nodes?" +
          new URLSearchParams({ ids: id, version, depth: "2" }).toString(),
        token,
      );
      if (response.version !== version) {
        throw new Error(
          "Figma returned an inconsistent discovery source version.",
        );
      }
      const document = response.nodes[id]?.document;
      if (!document) {
        throw new Error("Missing Figma discovery container: " + id);
      }
      const found = findCandidates(document, page, config, coverage);
      candidates.push(...found.candidates);
      queue.push(...found.pending);
    }
  }
  const target = path.join(projectRoot, ".figma-review");
  await rm(target, { recursive: true, force: true });
  await mkdir(target, { recursive: true });
  const report: DiscoveryReport = {
    schemaVersion: 1,
    fileKey: config.fileKey,
    figmaVersion: version,
    candidates: [],
  };
  const cards: string[] = [];
  for (const candidate of candidates) {
    const entry = proposeSource(candidate, config);
    const proposal: DiscoveryReport["candidates"][number] = { source: entry };
    report.candidates.push(proposal);
    const directory = candidate.node.id.replace(":", "-");
    const folder = path.join(target, directory);
    await mkdir(folder, { recursive: true });
    const previews: string[] = [];
    try {
      const response = await figmaJson<{
        err?: string;
        images: Record<string, string | null>;
      }>(
        "images/" +
          config.fileKey +
          "?" +
          new URLSearchParams({
            ids: candidate.node.id,
            version,
            format: "svg",
            svg_include_id: "true",
            svg_simplify_stroke: "false",
            use_absolute_bounds: "false",
          }).toString(),
        token,
      );
      const url = response.images[candidate.node.id];
      if (response.err || !url) {
        throw new Error("No SVG export available.");
      }
      const content = normalizeSource(await downloadSvg(url));
      const result = suggestPaints(content, colors, config);
      Object.assign(proposal, result, { sha256: sha256(content) });
      entry.paints = result.suggestions
        .filter((paint) => paint.role !== null)
        .map(({ node, field, original, role }) => ({
          node,
          field,
          original,
          role: role!,
        }));
      await writeFile(path.join(folder, "source.svg"), content);
      previews.push(
        '<figure><img alt="' +
          escapeHtml(entry.name + " Figma source") +
          '" src="' +
          directory +
          '/source.svg"><figcaption>Figma source</figcaption></figure>',
      );
      if (result.suggestions.every((paint) => paint.role)) {
        for (const [brand, palette] of Object.entries(colors)) {
          for (const surface of palette.supportedSurfaces) {
            const name = brand + "-" + surface + ".svg";
            await writeFile(
              path.join(folder, name),
              previewSvg(content, entry.paints, palette, surface),
            );
            previews.push(
              '<figure style="background:' +
                palette.foundations[palette.surfaces[surface]!] +
                '"><img alt="' +
                escapeHtml(entry.name + " " + brand + " " + surface) +
                '" src="' +
                directory +
                "/" +
                name +
                '"><figcaption>' +
                brand +
                " / " +
                surface +
                "</figcaption></figure>",
            );
          }
        }
      }
    } catch (error) {
      proposal.error =
        error instanceof Error ? error.message : "Could not prepare candidate.";
    }
    cards.push(
      "<article><h2>" +
        escapeHtml(entry.name) +
        '</h2><p><a href="https://www.figma.com/design/' +
        config.fileKey +
        "?node-id=" +
        directory +
        '">Figma source</a> · ' +
        escapeHtml(entry.category + "/" + entry.slug) +
        "</p>" +
        (proposal.error ? "<p>" + escapeHtml(proposal.error) + "</p>" : "") +
        '<div class="previews">' +
        previews.join("") +
        "</div><details><summary>Color suggestions and warnings</summary><pre>" +
        escapeHtml(stableJson(proposal)) +
        "</pre></details></article>",
    );
  }
  await writeFile(path.join(target, "report.json"), stableJson(report));
  await writeFile(
    path.join(target, "index.html"),
    '<!doctype html><html lang="en"><meta charset="utf-8">' +
      '<meta name="viewport" content="width=device-width"><meta name="robots" content="noindex,nofollow,noimageindex,nosnippet">' +
      "<title>New Figma illustrations</title><style>body{font:1rem system-ui;max-width:90rem;margin:auto;padding:2rem}" +
      ".previews{display:flex;flex-wrap:wrap;gap:1rem}figure{margin:0;padding:1rem;width:16rem;border:1px solid #888}" +
      "img{width:100%;height:14rem;object-fit:contain}figcaption{background:white;color:black;padding:.25rem}" +
      "pre{white-space:pre-wrap;overflow-wrap:anywhere}article{border-top:1px solid #888;margin-top:2rem}</style>" +
      "<h1>New Figma illustrations</h1><p>" +
      candidates.length +
      " candidates from version " +
      escapeHtml(version) +
      ". Suggestions require review of names, categories, materials and every brand/surface. Exact color matches do not establish material meaning.</p>" +
      "<p>Contrast warnings compare color pairs without geometry, opacity or actual adjacency. They are review hints, not WCAG or brand approval.</p>" +
      cards.join("") +
      "</html>",
  );
  console.log(
    "Discovered " +
      candidates.length +
      " new Figma candidates. Review .figma-review/index.html and report.json.",
  );
  return report;
}

if (
  process.argv[1] &&
  fileURLToPath(import.meta.url) === path.resolve(process.argv[1])
) {
  const token = process.env.FIGMA_TOKEN;
  if (!token) {
    throw new Error("FIGMA_TOKEN is required.");
  }
  const config = await readJson<Config>("figma.config.json"),
    colors = await palettes();
  validateConfig(config, colors);
  const first = await figmaJson<{ version: string }>(
    "files/" +
      config.fileKey +
      "/nodes?" +
      new URLSearchParams({ ids: config.rootNodeId, depth: "1" }).toString(),
    token,
  );
  if (!first.version) {
    throw new Error("Figma did not provide a source version.");
  }
  await discoverFigma(config, colors, token, first.version);
}
