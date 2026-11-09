import assert from "node:assert/strict";
import { it } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { pathToFileURL } from "node:url";
import path from "node:path";
import { projectRoot, readJson } from "../scripts/lib/project.js";
import type { IllustrationManifest } from "../src/types.js";
import type { IllustrationProps } from "../src/react/runtime.js";
it("renders the complete collection with valid local SVG references", async () => {
  const manifest = await readJson<IllustrationManifest>("manifest.json");
  for (const entry of manifest.illustrations) {
    const module = (await import(
      pathToFileURL(
        path.join(
          projectRoot,
          "src/react",
          entry.category,
          entry.slug + ".tsx",
        ),
      ).href
    )) as { default: React.ComponentType<IllustrationProps> };
    const html = renderToStaticMarkup(
      createElement(module.default, { title: entry.name }),
      { identifierPrefix: entry.slug },
    );
    const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
    assert.equal(new Set(ids).size, ids.length, entry.slug);
    for (const reference of html.matchAll(/url\(#([^)]+)\)/g)) {
      assert.ok(
        ids.includes(reference[1]),
        entry.slug + " has an unresolved SVG reference",
      );
    }
    for (const reference of html.matchAll(/(?:href|xlink:href)="#([^"]+)"/g)) {
      assert.ok(
        ids.includes(reference[1]),
        entry.slug + " has an unresolved image reference",
      );
    }
  }
});
