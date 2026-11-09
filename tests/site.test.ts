import assert from "node:assert/strict";
import { it } from "node:test";
import { readJson } from "../scripts/lib/project.js";
import type { IllustrationManifest } from "../src/types.js";
import {
  filterIllustrations,
  getCategories,
  selectedValues,
  groupIllustrations,
} from "../site/catalogue.js";

it("groups numbered component families without grouping scenes, pages or generated IDs", async () => {
  const { illustrations } =
    await readJson<IllustrationManifest>("manifest.json");
  const groups = groupIllustrations(illustrations);
  const splash = groups.find(({ name }) => name === "Background/Splash")!;
  assert.equal(splash.entries.length, 6);
  assert.equal(groups.find(({ name }) => name === "Cloud")!.entries.length, 5);
  assert.ok(
    groups
      .filter(({ name }) => name === "Man")
      .every(({ entries }) => entries.length === 1),
  );
  assert.ok(
    groups
      .filter(({ entries }) => entries[0]!.status === "approved")
      .every(({ entries }) => entries.length === 1),
  );
  assert.deepEqual(
    new Set(groups.flatMap(({ entries }) => entries.map(({ slug }) => slug))),
    new Set(illustrations.map(({ slug }) => slug)),
  );
  assert.equal(
    groups.flatMap(({ entries }) => entries).length,
    illustrations.length,
  );
  const sample = splash.entries[0]!;
  const separate = groupIllustrations([
    sample,
    { ...splash.entries[1]!, pageId: "other-page" },
    { ...splash.entries[2]!, category: "other-category" },
  ]);
  assert.equal(separate.length, 3);
  assert.ok(separate.every(({ entries }) => entries.length === 1));
});
it("derives sorted categories and combines query, brand and supported surface filters", async () => {
  const { illustrations } =
    await readJson<IllustrationManifest>("manifest.json");
  assert.ok(getCategories(illustrations).includes("people"));
  assert.deepEqual(
    selectedValues(
      { "/brand/sbanken": true, "/category/buildings": true },
      "brand",
    ),
    ["sbanken"],
  );
  assert.equal(
    filterIllustrations(illustrations, {
      query: "house-family-home",
      categories: ["buildings"],
      brands: ["sbanken"],
      surfaces: ["dark"],
    }).length,
    1,
  );
  assert.equal(
    filterIllustrations(illustrations, {
      query: "",
      categories: [],
      brands: ["carnegie"],
      surfaces: ["dark"],
    }).length,
    0,
  );
  const humans = filterIllustrations(illustrations, {
    query: "",
    categories: [],
    brands: [],
    surfaces: [],
    pages: ["8496:10546"],
  });
  assert.equal(humans.length, 175);
  assert.ok(humans.every((entry) => entry.page === "Human library"));
  const drafts = filterIllustrations(illustrations, {
    query: "",
    categories: [],
    brands: [],
    surfaces: [],
    statuses: ["draft"],
  });
  assert.equal(drafts.length, 0);
});
