import assert from "node:assert/strict";
import { it } from "node:test";
import {
  findCandidates,
  previewSvg,
  proposeSource,
  suggestPaints,
  validateMaskPaints,
  type FigmaNode,
} from "../scripts/lib/discovery.js";
import { palettes, readJson, type Config } from "../scripts/lib/project.js";

const svg = (drawing: string) =>
  '<svg width="100" height="100" viewBox="0 0 100 100" fill="none">' +
  drawing +
  "</svg>";
it("discovers new components and SVG frames, skipping reviewed, excluded and draft artwork", async () => {
  const config = await readJson<Config>("figma.config.json");
  const page = config.pages![1]!;
  const root: FigmaNode = {
    id: page.id,
    name: page.name,
    children: [
      { id: config.illustrations[0]!.nodeId, name: "Known", type: "COMPONENT" },
      { id: "9:1", name: "Decoration", type: "COMPONENT" },
      {
        id: "9:2",
        name: "New person",
        type: "COMPONENT",
        children: [{ id: "9:3", name: "Nested", type: "COMPONENT" }],
      },
      {
        id: "9:4",
        name: "New scene",
        type: "FRAME",
        exportSettings: [{ format: "SVG" }],
      },
      { id: "9:5", name: "Hidden", type: "COMPONENT", visible: false },
      { id: "9:6", name: "More sections", type: "SECTION" },
      {
        id: "9:7",
        name: "Reviewed board",
        type: "FRAME",
        exportSettings: [{ format: "SVG" }],
        children: [
          { id: "9:8", name: "New person on board", type: "COMPONENT" },
        ],
      },
      {
        id: "9:9",
        name: "Another reviewed board",
        type: "FRAME",
        exportSettings: [{ format: "SVG" }],
      },
    ],
  };
  const coverage = {
    nodes: [
      { id: "9:1", pageId: page.id, result: "excluded-decoration" },
      { id: "9:7", pageId: page.id, result: "container" },
      { id: "9:9", pageId: page.id, result: "container" },
    ],
  };
  const found = findCandidates(root, page, config, coverage);
  assert.deepEqual(
    found.candidates.map(({ node }) => node.id),
    ["9:2", "9:4", "9:8"],
  );
  assert.deepEqual(found.pending, ["9:6", "9:9"]);
  assert.deepEqual(
    findCandidates(root, { ...page, status: "draft" }, config, coverage)
      .candidates,
    [],
  );
  const source = proposeSource(found.candidates[0]!, config);
  assert.equal(source.slug, "new-person-9-2");
  assert.equal(source.pageId, page.id);
  assert.equal(source.original, "sources/objects/new-person-9-2.svg");
});

it("uses material context rather than treating identical skin and clothing hex values as one role", async () => {
  const config = await readJson<Config>("figma.config.json"),
    colors = await palettes();
  const result = suggestPaints(
    svg(
      '<g id="Skin"><path id="Vector" fill="#A5E1D2"/></g><path id="Shirt" fill="#A5E1D2"/><g id="Foliage"><path id="Leaf" fill="#A5E1D2"/></g>',
    ),
    colors,
    config,
  );
  assert.equal(result.suggestions[0]!.role, "skin-light");
  assert.equal(result.suggestions[1]!.role, "clothing-light");
  assert.equal(result.suggestions[2]!.role, "foliage-light");
  assert.ok(
    result.suggestions.every(({ confidence }) => confidence === "exact-color"),
  );
  assert.ok(
    result.suggestions.every(({ reason }) => /Layer name/.test(reason)),
  );
});

it("uses reusable material roles for named layers and keeps anonymous colors as proposals", async () => {
  const result = suggestPaints(
    svg(
      '<g id="Face"><path id="Hair" fill="#14555a"/><path id="Shirt" fill="#007272"/><path id="Eyes" fill="#00343e"/></g><path id="Wall" fill="#a5e1d2"/><path id="Highlight" fill="#fff"/><path id="Accent" fill="#28b482"/><path id="Vector" fill="#a5e1d2"/>',
    ),
    await palettes(),
    await readJson<Config>("figma.config.json"),
  );
  assert.deepEqual(
    result.suggestions.map(({ role }) => role),
    [
      "hair",
      "clothing",
      "outline",
      "surface",
      "highlight",
      "accent",
      "palette-coldgreen-300",
    ],
  );
  assert.match(result.warnings.join(" "), /Unnamed materials/);
});

it("suggests unfamiliar hex colors perceptually without calling them reviewed matches", async () => {
  const result = suggestPaints(
    svg('<path id="Face" fill="#a4e0d1"/>'),
    await palettes(),
    await readJson<Config>("figma.config.json"),
  );
  assert.equal(result.suggestions[0]!.role, "skin-light");
  assert.equal(result.suggestions[0]!.confidence, "nearest-color");
  assert.match(result.suggestions[0]!.reason, /approve or replace/);
});

it("preserves masks across brands, including referenced layers, and leaves unknown mask tones unresolved", async () => {
  const colors = await palettes(),
    config = await readJson<Config>("figma.config.json");
  const result = suggestPaints(
    svg(
      '<defs><path id="shared" fill="#fff"/><mask id="m"><use href="#shared"/><path id="unknown" fill="#123456"/></mask></defs><path id="visible" fill="#fff" mask="url(#m)"/>',
    ),
    colors,
    config,
  );
  assert.match(
    result.suggestions.find(({ node }) => node === "shared")!.role!,
    /^mask/,
  );
  const unknown = result.suggestions.find(({ node }) => node === "unknown")!;
  assert.equal(unknown.role, null);
  assert.match(unknown.reason, /exact mask tone/);
  assert.match(
    result.suggestions.find(({ node }) => node === "visible")!.role!,
    /^palette/,
  );
  const source = svg(
    '<defs><path id="shared" fill="#fff"/><mask id="m"><use href="#shared"/></mask></defs><path id="visible" fill="#fff" mask="url(#m)"/>',
  );
  const paints = suggestPaints(source, colors, config).suggestions.map(
    (paint) => ({ ...paint, role: paint.role! }),
  );
  validateMaskPaints(source, paints, colors);
  colors.sbanken.roles[paints[0]!.role] = colors.sbanken.roles["mask-1000"]!;
  assert.throws(
    () => validateMaskPaints(source, paints, colors),
    /Mask paint must preserve its exact tone/,
  );
});

it("flags lost color distinctions and raster details without declaring accessibility or brand approval", async () => {
  const colors = await palettes(),
    config = await readJson<Config>("figma.config.json");
  colors.sbanken.roles["palette-coldgreen-300"] =
    colors.sbanken.roles["palette-coldgreen-950"]!;
  const source = svg(
    '<path id="a" fill="#A5E1D2"/><path id="b" fill="#00343e"/><image id="pixels" href="data:image/png;base64,AAAA"/>',
  );
  const result = suggestPaints(source, colors, config);
  assert.ok(
    result.contrastWarnings.some(
      ({ brand, surface, mappedContrast }) =>
        brand === "sbanken" && surface === "light" && mappedContrast === 1,
    ),
  );
  assert.match(result.warnings.join(" "), /raster/);
  const paints = result.suggestions.map((paint) => ({
    ...paint,
    role: paint.role!,
  }));
  const preview = previewSvg(source, paints, colors.sbanken, "light");
  assert.ok(
    preview.includes(
      colors.sbanken.foundations[
        colors.sbanken.roles["palette-coldgreen-950"]!
      ]!,
    ),
  );
  assert.ok(!preview.includes("var(--illustration-"));
});
