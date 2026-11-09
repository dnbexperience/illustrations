import assert from "node:assert/strict";
import { it } from "node:test";
import { readJson, palettes, type Config } from "../scripts/lib/project.js";
import type { IllustrationManifest } from "../src/types.js";
it("covers non-draft artwork pages with token-only imports", async () => {
  const manifest = await readJson<IllustrationManifest>("manifest.json");
  assert.ok(manifest.illustrations.length > 500);
  assert.deepEqual(
    [...new Set(manifest.illustrations.map((e) => e.page))].sort(),
    ["Approved illustrations", "Components", "Human library"],
  );
  for (const entry of manifest.illustrations) {
    assert.ok(entry.roles.length);
    assert.equal("assets" in entry, false);
    assert.equal("original" in entry, false);
    assert.ok(entry.supportedSurfaces.dnb.includes("dark"));
    assert.notEqual(entry.status, "draft");
  }
});
it("excludes numbered backgrounds and white-only cloud variants while retaining Cloud illustrations", async () => {
  const config = await readJson<Config>("figma.config.json");
  const manifest = await readJson<IllustrationManifest>("manifest.json");
  for (const entries of [config.illustrations, manifest.illustrations]) {
    assert.ok(
      !entries.some(({ slug }) =>
        /^(background-\d+|nature-clouds-cloud-0[1-5])$/.test(slug),
      ),
    );
    for (const slug of [
      "cloud",
      "cloud-2",
      "cloud-3",
      "cloud-4",
      "cloud-5605-947",
    ]) {
      assert.ok(
        entries.some((entry) => entry.slug === slug),
        slug,
      );
    }
    assert.equal(
      entries.filter(({ slug }) => slug.startsWith("background-splash-"))
        .length,
      6,
    );
  }
});
it("keeps human skin roles separate from clothing and maps them per brand", async () => {
  const cfg = await readJson<Config>("figma.config.json");
  const colors = await palettes();
  const entry = cfg.illustrations.find((e) => e.nodeId === "8496:10565")!;
  const roles = entry.paints
    .map((p) => p.role)
    .filter((r) => r.startsWith("skin-"));
  assert.ok(roles.length);
  assert.deepEqual([...new Set(roles)], ["skin-medium"]);
  const refs = Object.values(colors).map((p) => p.roles["skin-medium"]);
  assert.equal(new Set(refs).size, 4);
  assert.ok(entry.paints.some((p) => p.role.startsWith("palette-")));
});
