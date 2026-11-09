import type { XastElement, XastRoot } from "svgo";
import type { Config, Paint, Palette, Source } from "./project.js";
import type { IllustrationBrand } from "../../src/types.js";
import { mapPaints, parseSvg, serialize, visit } from "./svg.js";
import { isMaskRole } from "./validate.js";
import { materials } from "./materials.js";

export type FigmaNode = {
  id: string;
  name: string;
  type?: string;
  visible?: boolean;
  exportSettings?: Array<{ format: string }>;
  children?: FigmaNode[];
};
export type Coverage = {
  nodes: Array<{ id: string; pageId: string; result: string }>;
};
export type Candidate = {
  node: FigmaNode;
  page: NonNullable<Config["pages"]>[number];
};
export type Suggestion = Omit<Paint, "role"> & {
  role: string | null;
  confidence: "exact-color" | "nearest-color" | "unresolved";
  reason: string;
};
export type ContrastWarning = {
  brand: string;
  surface: string;
  roles: string[];
  sourceContrast: number;
  mappedContrast: number;
};

export function findCandidates(
  root: FigmaNode,
  page: Candidate["page"],
  config: Config,
  coverage: Coverage,
): { candidates: Candidate[]; pending: string[] } {
  if (!["approved", "component"].includes(page.status)) {
    return { candidates: [], pending: [] };
  }
  const known = new Set([
    ...config.illustrations.map((entry) => entry.nodeId),
    ...coverage.nodes
      .filter((entry) => entry.pageId === page.id)
      .filter((entry) => entry.result !== "container")
      .map((entry) => entry.id),
  ]);
  const containers = new Set(
    coverage.nodes
      .filter(
        (entry) => entry.pageId === page.id && entry.result === "container",
      )
      .map((entry) => entry.id),
  );
  const result: Candidate[] = [];
  const pending: string[] = [];
  const walk = (node: FigmaNode) => {
    if (
      known.has(node.id) ||
      node.visible === false ||
      node.type === "INSTANCE"
    ) {
      return;
    }
    if (
      node.type === "COMPONENT" ||
      (node.type === "FRAME" &&
        !containers.has(node.id) &&
        node.exportSettings?.some(({ format }) => format === "SVG"))
    ) {
      if (!/^\d+:\d+$/.test(node.id)) {
        throw new Error("Invalid Figma candidate node ID.");
      }
      result.push({ node, page });
      return;
    }
    if (
      !node.children &&
      ["SECTION", "FRAME", "GROUP", "COMPONENT_SET"].includes(node.type ?? "")
    ) {
      pending.push(node.id);
    }
    node.children?.forEach(walk);
  };
  root.children?.forEach(walk);
  return { candidates: result, pending };
}

export function rgb(hex: string): number[] | null {
  let value = hex.toLowerCase();
  value = { white: "#ffffff", black: "#000000" }[value] ?? value;
  if (!/^#(?:[\da-f]{3}|[\da-f]{6})$/.test(value)) {
    return null;
  }
  if (value.length === 4) {
    value = "#" + [...value.slice(1)].map((c) => c + c).join("");
  }
  return [1, 3, 5].map((start) => {
    const channel = parseInt(value.slice(start, start + 2), 16) / 255;
    return channel <= 0.04045
      ? channel / 12.92
      : ((channel + 0.055) / 1.055) ** 2.4;
  });
}
const sameColor = (a: string, b: string) => {
  const left = rgb(a),
    right = rgb(b);
  return (
    left !== null &&
    right !== null &&
    left.every((value, i) => value === right[i])
  );
};
const luminance = (value: string) => {
  const [r, g, b] = rgb(value)!;
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
};
export const contrast = (a: string, b: string) => {
  const first = luminance(a),
    second = luminance(b);
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
};
// OKLab keeps nearest-color proposals perceptual, including lightness.
const oklab = (value: string) => {
  const [r, g, b] = rgb(value)!;
  const l = Math.cbrt(
    0.4122214708 * r! + 0.5363325363 * g! + 0.0514459929 * b!,
  );
  const m = Math.cbrt(
    0.2119034982 * r! + 0.6806995451 * g! + 0.1073969566 * b!,
  );
  const s = Math.cbrt(
    0.0883024619 * r! + 0.2817188376 * g! + 0.6299787005 * b!,
  );
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
};
const distance = (a: string, b: string) => {
  const first = oklab(a),
    second = oklab(b);
  return Math.hypot(
    ...first.map((value, i) => (value - second[i]!) * (i === 0 ? 1.5 : 1)),
  );
};

function maskNodes(root: XastRoot): Set<XastElement> {
  const indexed = new Map<string, XastElement>();
  visit(root, (node) => {
    if (node.attributes.id) {
      indexed.set(node.attributes.id, node);
    }
  });
  const maskNodes = new Set<XastElement>();
  const markMask = (node: XastElement) => {
    if (maskNodes.has(node)) {
      return;
    }
    maskNodes.add(node);
    for (const [field, value] of Object.entries(node.attributes)) {
      const target =
        /^url\(#([^)]+)\)$/.exec(value)?.[1] ??
        (["href", "xlink:href"].includes(field) && value.startsWith("#")
          ? value.slice(1)
          : undefined);
      if (target && indexed.has(target)) {
        markMask(indexed.get(target)!);
      }
    }
    for (const child of node.children) {
      if (child.type === "element") {
        markMask(child);
      }
    }
  };
  visit(root, (node) => {
    if (node.name === "mask") {
      markMask(node);
    }
  });
  return maskNodes;
}

export function validateMaskPaints(
  source: string,
  paints: Paint[],
  colors: Record<IllustrationBrand, Palette>,
) {
  const ids = new Set(
    [...maskNodes(parseSvg(source))].map((node) => node.attributes.id),
  );
  for (const paint of paints) {
    if (!ids.has(paint.node)) {
      continue;
    }
    if (
      !isMaskRole(paint.role) ||
      !Object.values(colors).every((palette) =>
        palette.supportedSurfaces.every((surface) =>
          sameColor(
            paint.original,
            palette.foundations[
              (surface === "dark"
                ? palette.darkRoles[paint.role]
                : undefined) ?? palette.roles[paint.role]!
            ] ?? "",
          ),
        ),
      )
    ) {
      throw new Error(
        "Mask paint must preserve its exact tone: " +
          paint.node +
          "/" +
          paint.field,
      );
    }
  }
}

export function suggestPaints(
  source: string,
  colors: Record<IllustrationBrand, Palette>,
  config: Config,
): {
  suggestions: Suggestion[];
  warnings: string[];
  contrastWarnings: ContrastWarning[];
} {
  const root = parseSvg(source);
  const masks = maskNodes(root);
  const suggestions: Suggestion[] = [],
    warnings = new Set<string>();
  const reviewed = new Map<string, Set<string>>();
  for (const entry of config.illustrations) {
    for (const paint of entry.paints) {
      if (rgb(paint.original)) {
        const values = reviewed.get(paint.role) ?? new Set<string>();
        values.add(paint.original);
        reviewed.set(paint.role, values);
      }
    }
  }
  const walk = (
    node: XastElement,
    inherited: (typeof materials)[number] | undefined,
    mask: boolean,
  ) => {
    const label = node.attributes["data-name"] ?? node.attributes.id ?? "";
    const material =
      materials.find(({ layers }) =>
        layers.test(label.replace(/[_-]/g, " ")),
      ) ?? inherited;
    const inMask = mask || masks.has(node);
    if (node.name === "image") {
      warnings.add(
        "Embedded raster pixels cannot be recolored. Review their brand suitability.",
      );
    }
    if (
      ["use", "filter", "linearGradient", "radialGradient"].includes(
        node.name,
      ) ||
      ["opacity", "fill-opacity", "stroke-opacity", "stop-opacity"].some(
        (key) => node.attributes[key],
      )
    ) {
      warnings.add(
        "References, gradients, filters or opacity need visual review; pairwise contrast ignores compositing and geometry.",
      );
    }
    for (const field of [
      "fill",
      "stroke",
      "stop-color",
      "flood-color",
    ] as const) {
      const original = node.attributes[field];
      if (!original || original === "none" || original.startsWith("url(")) {
        continue;
      }
      let role: string | null = null;
      let confidence: Suggestion["confidence"] = "unresolved";
      let reason = "Unsupported color; assign a role manually.";
      if (rgb(original)) {
        const available = Object.keys(colors.dnb.roles).filter((key) =>
          inMask
            ? isMaskRole(key)
            : material
              ? material.roles.some((role) => role === key)
              : key.startsWith("palette-"),
        );
        const ranked = available
          .flatMap((key) => {
            if (!Object.values(colors).every((palette) => palette.roles[key])) {
              return [];
            }
            if (
              inMask &&
              !Object.values(colors).every((palette) =>
                palette.supportedSurfaces.every((surface) =>
                  sameColor(
                    original,
                    palette.foundations[
                      (surface === "dark"
                        ? palette.darkRoles[key]
                        : undefined) ?? palette.roles[key]!
                    ]!,
                  ),
                ),
              )
            ) {
              return [];
            }
            const values = [
              ...(reviewed.get(key) ?? []),
              colors.dnb.foundations[colors.dnb.roles[key]!]!,
            ];
            return [
              {
                role: key,
                exact: values.some((value) => sameColor(original, value)),
                distance: Math.min(
                  ...values.map((value) => distance(original, value)),
                ),
              },
            ];
          })
          .sort(
            (a, b) =>
              Number(b.exact) - Number(a.exact) ||
              a.distance - b.distance ||
              a.role.localeCompare(b.role),
          );
        const best = ranked[0];
        if (best) {
          role = best.role;
          confidence = best.exact ? "exact-color" : "nearest-color";
          reason = inMask
            ? "Exact mask luminance in every brand and surface."
            : (material
                ? "Layer name suggests " + material.name + ". "
                : "Material unknown. ") +
              (best.exact
                ? "Matches a reviewed source color."
                : "Nearest reviewed color in OKLab; approve or replace this suggestion.");
          if (!material && !inMask) {
            warnings.add(
              "Unnamed materials use generic palette roles. Review skin, hair, clothing and foliage separately, even when they share a hex color.",
            );
          }
        } else if (inMask) {
          reason =
            "No exact mask tone across all brands. Add a mask role without changing luminance.";
        }
      }
      suggestions.push({
        node: node.attributes.id ?? "",
        field,
        original,
        role,
        confidence,
        reason,
      });
    }
    for (const child of node.children) {
      if (child.type === "element") {
        walk(child, material, inMask);
      }
    }
  };
  for (const child of root.children) {
    if (child.type === "element") {
      walk(child, undefined, false);
    }
  }
  if (suggestions.every((paint) => paint.role)) {
    mapPaints(source, suggestions as Paint[]);
  }
  const visible = suggestions.filter(
    (paint) => paint.role && !isMaskRole(paint.role),
  );
  const pairs = [
    ...new Map(
      visible.map((paint) => [paint.original + "/" + paint.role, paint]),
    ).values(),
  ];
  const contrastWarnings: ContrastWarning[] = [];
  for (const [brand, palette] of Object.entries(colors)) {
    for (const surface of palette.supportedSurfaces) {
      const mapped = (role: string) =>
        palette.foundations[
          (surface === "dark" ? palette.darkRoles[role] : undefined) ??
            palette.roles[role]!
        ]!;
      for (let i = 0; i < pairs.length; i++) {
        for (const second of pairs.slice(i + 1)) {
          const first = pairs[i]!;
          const before = contrast(first.original, second.original);
          const after = contrast(mapped(first.role!), mapped(second.role!));
          // A review heuristic for lost distinctions, not an accessibility pass.
          if (before >= 1.5 && after < 1.25) {
            contrastWarnings.push({
              brand,
              surface,
              roles: [first.role!, second.role!],
              sourceContrast: Number(before.toFixed(2)),
              mappedContrast: Number(after.toFixed(2)),
            });
          }
        }
      }
    }
  }
  return { suggestions, warnings: [...warnings], contrastWarnings };
}

export function proposeSource(candidate: Candidate, config: Config): Source {
  const name = candidate.node.name;
  const base = name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  const slug = !base
    ? "illustration"
    : /^[a-z]/.test(base)
      ? base
      : "illustration-" + base;
  const neighbors = config.illustrations.filter(
    (entry) =>
      entry.pageId === candidate.page.id &&
      entry.name.split("/")[0] === name.split("/")[0],
  );
  const categories = [...new Set(neighbors.map((entry) => entry.category))];
  const category = categories.length === 1 ? categories[0]! : "objects";
  return {
    slug: slug + "-" + candidate.node.id.replace(":", "-"),
    name,
    category,
    nodeId: candidate.node.id,
    original:
      "sources/" +
      category +
      "/" +
      slug +
      "-" +
      candidate.node.id.replace(":", "-") +
      ".svg",
    paints: [],
    pageId: candidate.page.id,
    page: candidate.page.name,
    status: candidate.page.status === "approved" ? "approved" : "component",
  };
}

export function previewSvg(
  source: string,
  paints: Paint[],
  palette: Palette,
  surface: string,
): string {
  const { root } = mapPaints(source, paints);
  visit(root, (node) => {
    for (const [field, value] of Object.entries(node.attributes)) {
      const role = /^var\(--illustration-([a-z0-9-]+)\)$/.exec(value)?.[1];
      if (role) {
        node.attributes[field] =
          palette.foundations[
            (surface === "dark" ? palette.darkRoles[role] : undefined) ??
              palette.roles[role]!
          ]!;
      }
    }
  });
  return serialize(root);
}
