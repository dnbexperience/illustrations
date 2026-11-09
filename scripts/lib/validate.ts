import type { Config, Palette } from "./project.js";
import type { IllustrationBrand } from "../../src/types.js";

export const isMaskRole = (role: string) =>
  role === "mask" || role.startsWith("mask-");

export function isBrandFoundation(brand: string, ref: string): boolean {
  switch (brand) {
    case "dnb":
      return /^--dnb-(?!eiendom-)/.test(ref);
    case "sbanken":
      return ref.startsWith("--sbanken-");
    case "eiendom":
      return ref.startsWith("--dnb-eiendom-");
    case "carnegie":
      return (
        /^--ca-color-(ocean-green|burgundy-red|noir-green|sea-green|noir-red|sober-red|classic-beige|pale-green|pale-red)$/.test(
          ref,
        ) || ref === "--carnegie-greyscale-0"
      );
    default:
      return false;
  }
}

export function validateConfig(
  config: Config,
  palettes: Record<IllustrationBrand, Palette>,
) {
  if (
    config.schemaVersion !== 1 ||
    !/^[a-zA-Z0-9]+$/.test(config.fileKey) ||
    !/^\d+:\d+$/.test(config.rootNodeId) ||
    !config.illustrations.length
  ) {
    throw new Error("Invalid Figma source configuration.");
  }
  const keys = new Set<string>(),
    nodes = new Set<string>();
  for (const entry of config.illustrations) {
    if (entry.status === "draft" || entry.pageId === "3505:1") {
      throw new Error("Draft artwork is excluded from distribution.");
    }
    const key = entry.category + "/" + entry.slug;
    if (
      ![entry.category, entry.slug].every((value) =>
        /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(value),
      ) ||
      !entry.name.trim() ||
      !/^\d+:\d+$/.test(entry.nodeId) ||
      entry.original !== "sources/" + key + ".svg"
    ) {
      throw new Error("Invalid illustration source: " + key);
    }
    if (keys.has(key) || nodes.has(entry.nodeId)) {
      throw new Error("Duplicate illustration source.");
    }
    keys.add(key);
    nodes.add(entry.nodeId);
  }
  for (const [brand, palette] of Object.entries(palettes)) {
    for (const entry of config.illustrations) {
      for (const paint of entry.paints) {
        if (!Object.hasOwn(palette.roles, paint.role)) {
          throw new Error("Missing light role: " + brand + "/" + paint.role);
        }
      }
    }
    if (
      !palette.name.trim() ||
      JSON.stringify(palette.supportedSurfaces) !==
        JSON.stringify(brand === "carnegie" ? ["light"] : ["light", "dark"])
    ) {
      throw new Error("Invalid palette surfaces: " + brand);
    }
    for (const [name, value] of Object.entries(palette.foundations)) {
      if (
        !/^--[a-z][a-z0-9-]*$/.test(name) ||
        !/^#[0-9a-f]{3}(?:[0-9a-f]{3})?$/i.test(value)
      ) {
        throw new Error("Invalid foundation definition.");
      }
    }
    for (const [role, ref] of [
      ...Object.entries(palette.roles),
      ...Object.entries(palette.darkRoles),
    ]) {
      if (
        !/^[a-z][a-z0-9-]*$/.test(role) ||
        !Object.hasOwn(palette.foundations, ref)
      ) {
        throw new Error("Unknown foundation for " + brand + "/" + role);
      }
      if (!isMaskRole(role) && !isBrandFoundation(brand, ref)) {
        throw new Error(
          "Color outside brand palette: " + brand + "/" + role + " -> " + ref,
        );
      }
    }
    for (const surface of palette.supportedSurfaces) {
      if (
        !Object.hasOwn(palette.foundations, palette.surfaces[surface] ?? "")
      ) {
        throw new Error("Missing palette surface.");
      }
    }
  }
}
