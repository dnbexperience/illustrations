import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { it } from "node:test";
import sharp from "sharp";
import {
  readJson,
  projectRoot,
  type Config,
  type Palette,
} from "../scripts/lib/project.js";
import {
  mapPaints,
  serialize,
  optimizeIllustration,
} from "../scripts/lib/svg.js";
it("preserves composited opacity when optimizing repeated paths and groups", async () => {
  const config = await readJson<Config>("figma.config.json");
  const palette = await readJson<Palette>("tokens/dnb.json");
  for (const slug of ["desktop-account", "skyscraper"]) {
    const entry = config.illustrations.find((e) => e.slug === slug)!;
    const mapped = mapPaints(
      await readFile(path.join(projectRoot, entry.original), "utf8"),
      entry.paints,
    );
    const render = async (svg: string) =>
      sharp(
        Buffer.from(
          svg.replace(
            /var\(--illustration-([a-z0-9-]+)\)/g,
            (_, role: string) => palette.foundations[palette.roles[role]!]!,
          ),
        ),
      )
        .resize({
          width: 220,
          height: 180,
          fit: "contain",
          background: { r: 255, g: 255, b: 255, alpha: 1 },
        })
        .ensureAlpha()
        .raw()
        .toBuffer();
    const [before, after] = await Promise.all([
      render(serialize(mapped.root)),
      render(serialize(optimizeIllustration(mapped.root))),
    ]);
    let difference = 0;
    for (let i = 0; i < before.length; i++) {
      difference += Math.abs(before[i]! - after[i]!);
    }
    assert.ok(difference / before.length < 0.1, slug + " changed compositing");
  }
});
