import assert from "node:assert/strict";
import { it } from "node:test";
import { palettes, readJson, type Config } from "../scripts/lib/project.js";
import { validateConfig } from "../scripts/lib/validate.js";
import { materials } from "../scripts/lib/materials.js";

it("provides every proposed material role on all supported brands and surfaces", async () => {
  for (const [brand, palette] of Object.entries(await palettes())) {
    for (const material of materials) {
      for (const role of material.roles) {
        assert.ok(palette.roles[role], brand + "/" + role);
        for (const surface of palette.supportedSurfaces) {
          const ref =
            (surface === "dark" ? palette.darkRoles[role] : undefined) ??
            palette.roles[role];
          assert.ok(
            palette.foundations[ref],
            brand + "/" + surface + "/" + role,
          );
        }
      }
    }
  }
});

it("rejects draft artwork before it reaches generation or synchronization", async () => {
  const colors = await palettes(),
    config = await readJson<Config>("figma.config.json");
  const draft = structuredClone(config);
  draft.illustrations[0]!.status = "draft";
  assert.throws(() => validateConfig(draft, colors), /Draft artwork/);
});

it("rejects unknown foundations and unsafe source paths", async () => {
  const colors = await palettes(),
    config = await readJson<Config>("figma.config.json");
  validateConfig(config, colors);
  const bad = structuredClone(colors);
  bad.dnb.roles.roof = "#007272";
  assert.throws(() => validateConfig(config, bad), /foundation/);
  const unsafe = structuredClone(config);
  unsafe.illustrations[0]!.original = "../outside.svg";
  assert.throws(() => validateConfig(unsafe, colors), /source/);
  const missingLightRole = structuredClone(colors);
  delete missingLightRole.dnb.roles.roof;
  missingLightRole.dnb.darkRoles.roof = "--dnb-coldgreen-600";
  assert.throws(
    () => validateConfig(config, missingLightRole),
    /Missing light role/,
  );
});
it("uses only named foundations for light and dark roles", async () => {
  for (const palette of Object.values(await palettes())) {
    for (const [role, ref] of Object.entries({
      ...palette.roles,
      ...palette.darkRoles,
    })) {
      assert.ok(palette.foundations[ref], role);
      assert.ok(ref.startsWith("--"));
    }
  }
});

it("rejects another brand's visible colors, including faces and dark overrides", async () => {
  const colors = await palettes();
  const config = await readJson<Config>("figma.config.json");
  for (const brand of ["sbanken", "eiendom"] as const) {
    for (const role of Object.keys(colors[brand].roles).filter((r) =>
      r.startsWith("skin-"),
    )) {
      assert.ok(
        !colors[brand].roles[role]!.startsWith("--dnb-coldgreen-"),
        brand + "/" + role,
      );
    }
    const invalid = structuredClone(colors);
    invalid[brand].foundations["--dnb-coldgreen-300"] = "#a5e1d2";
    invalid[brand].darkRoles.roof = "--dnb-coldgreen-300";
    assert.throws(() => validateConfig(config, invalid), /brand palette/);
  }
});

it("gives Carnegie scenes their own palette while keeping skin and foliage separate", async () => {
  const colors = await palettes();
  const config = await readJson<Config>("figma.config.json");
  for (const slug of [
    "kickboxing",
    "tennis",
    "shopping",
    "construction-workers",
    "weightlifter-woman",
  ]) {
    const entry = config.illustrations.find((entry) => entry.slug === slug)!;
    const roles = [...new Set(entry.paints.map(({ role }) => role))].filter(
      (role) => !/^(skin-|mask-)/.test(role),
    );
    const signatures = Object.values(colors).map((palette) =>
      roles.map((role) => palette.foundations[palette.roles[role]!]).join(","),
    );
    assert.equal(new Set(signatures).size, 4, slug + " brand palettes");
  }
  for (const slug of ["kickboxing", "kickboxing-3505-3797"]) {
    const entry = config.illustrations.find((entry) => entry.slug === slug)!;
    for (const node of [
      "Vector_2",
      "Vector_3",
      "Vector_5",
      "Vector_8",
      "Vector_10",
      "Vector_15",
    ]) {
      assert.equal(
        entry.paints.find((paint) => paint.node === node)!.role,
        "skin-light",
        slug + " " + node,
      );
    }
  }
  const plant = config.illustrations.find(
    ({ slug }) => slug === "interior-plants-plant-02",
  )!;
  const leaf = plant.paints.find(({ node }) => node === "Vector_4")!;
  const ref = colors.carnegie.roles[leaf.role]!;
  assert.match(ref, /^--ca-color-(?:ocean|sea|noir|pale)-green$/);
  assert.notEqual(
    plant.paints.find(({ node }) => node === "Vector")!.role,
    leaf.role,
  );
});

it("limits Carnegie color roles to its documented brand palette and white", async () => {
  const { carnegie } = await palettes();
  const brandColors: Record<string, string> = {
    "--ca-color-ocean-green": "#00343e",
    "--ca-color-burgundy-red": "#5c0022",
    "--ca-color-noir-green": "#001114",
    "--ca-color-sea-green": "#007272",
    "--ca-color-noir-red": "#24000d",
    "--ca-color-sober-red": "#8e4049",
    "--ca-color-classic-beige": "#f6eae4",
    "--ca-color-pale-green": "#ccf0e7",
    "--ca-color-pale-red": "#ffdedb",
    "--carnegie-greyscale-0": "#fff",
  };
  for (const [role, ref] of Object.entries(carnegie.roles)) {
    if (role === "mask" || role.startsWith("mask-")) {
      continue;
    }
    assert.ok(Object.hasOwn(brandColors, ref), role + ": " + ref);
    assert.equal(carnegie.foundations[ref], brandColors[ref], role);
  }
  assert.equal(carnegie.roles["skin-light"], "--ca-color-pale-green");
  assert.equal(carnegie.roles["skin-dark"], "--ca-color-noir-green");
});

it("gives all six splash backgrounds their own color role", async () => {
  const config = await readJson<Config>("figma.config.json");
  const splashes = config.illustrations.filter(({ slug }) =>
    /^background-splash-0[1-6]$/.test(slug),
  );
  assert.equal(splashes.length, 6);
  for (const splash of splashes) {
    assert.deepEqual(
      splash.paints.map(({ role }) => role),
      ["splash"],
      splash.slug,
    );
  }
});

it("keeps splashes visible on light surfaces and preserves their dark colors", async () => {
  const luminance = (hex: string) => {
    const color = hex.slice(1);
    const expanded =
      color.length === 3
        ? [...color].map((digit) => digit + digit).join("")
        : color;
    return [0.2126, 0.7152, 0.0722].reduce((sum, weight, index) => {
      const channel =
        parseInt(expanded.slice(index * 2, index * 2 + 2), 16) / 255;
      const linear =
        channel <= 0.04045
          ? channel / 12.92
          : ((channel + 0.055) / 1.055) ** 2.4;
      return sum + weight * linear;
    }, 0);
  };
  for (const palette of Object.values(await palettes())) {
    const splash = palette.foundations[palette.roles.splash!];
    assert.ok(splash, palette.name + " splash foundation");
    const surface = palette.foundations[palette.surfaces.light!]!;
    const values = [luminance(splash), luminance(surface)];
    const contrast =
      (Math.max(...values) + 0.05) / (Math.min(...values) + 0.05);
    // Decorative visibility baseline, not a WCAG contrast requirement.
    assert.ok(contrast >= 1.35, palette.name + " light splash contrast");
    if (palette.supportedSurfaces.includes("dark")) {
      assert.equal(
        palette.darkRoles.splash,
        palette.roles["palette-warmgreen-50"],
        palette.name + " dark splash foundation",
      );
    }
  }
});
