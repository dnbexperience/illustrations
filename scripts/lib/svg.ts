import { optimize, type XastElement, type XastRoot } from "svgo";
import type { Paint } from "./project.js";

const tags = new Set([
  "svg",
  "g",
  "path",
  "rect",
  "circle",
  "ellipse",
  "line",
  "polygon",
  "polyline",
  "defs",
  "mask",
  "clipPath",
  "linearGradient",
  "radialGradient",
  "stop",
  "pattern",
  "use",
  "image",
  "filter",
  "feFlood",
  "feColorMatrix",
  "feOffset",
  "feGaussianBlur",
  "feBlend",
]);
const attributes = new Set([
  "id",
  "xmlns",
  "width",
  "height",
  "viewBox",
  "fill",
  "stroke",
  "fill-rule",
  "clip-rule",
  "fill-opacity",
  "stroke-opacity",
  "opacity",
  "d",
  "x",
  "y",
  "x1",
  "y1",
  "x2",
  "y2",
  "cx",
  "cy",
  "r",
  "rx",
  "ry",
  "points",
  "transform",
  "stroke-width",
  "stroke-linecap",
  "stroke-linejoin",
  "stroke-miterlimit",
  "stroke-dasharray",
  "stroke-dashoffset",
  "mask",
  "mask-type",
  "maskUnits",
  "maskContentUnits",
  "clip-path",
  "clipPathUnits",
  "style",
  "xmlns:xlink",
  "xlink:href",
  "href",
  "data-name",
  "preserveAspectRatio",
  "gradientUnits",
  "gradientTransform",
  "offset",
  "stop-color",
  "stop-opacity",
  "patternContentUnits",
  "patternUnits",
  "patternTransform",
  "filter",
  "filterUnits",
  "color-interpolation-filters",
  "flood-opacity",
  "flood-color",
  "result",
  "in",
  "in2",
  "type",
  "values",
  "dx",
  "dy",
  "stdDeviation",
  "mode",
]);

export function visit(
  root: XastRoot | XastElement,
  fn: (node: XastElement) => void,
) {
  for (const child of root.children) {
    if (child.type === "element") {
      fn(child);
      visit(child, fn);
    }
  }
}

export function parseSvg(source: string): XastRoot {
  let parsed: XastRoot | undefined;
  if (/<!DOCTYPE|<!ENTITY/i.test(source)) {
    throw new Error("Unsupported SVG declaration.");
  }
  optimize(source, {
    plugins: [
      {
        name: "inspect",
        fn(root) {
          parsed = structuredClone(root);
        },
      },
    ],
  });
  if (!parsed) {
    throw new Error("Could not parse SVG.");
  }
  const svg = parsed.children.filter((n) => n.type === "element");
  if (svg.length !== 1 || svg[0]?.name !== "svg") {
    throw new Error("Expected one SVG root.");
  }
  const ids = new Set<string>();
  visit(parsed, (node) => {
    if (!tags.has(node.name)) {
      throw new Error("Unsupported SVG element: " + node.name);
    }
    for (const [key, value] of Object.entries(node.attributes)) {
      if (!attributes.has(key)) {
        throw new Error("Unsupported SVG attribute: " + key);
      }
      if (
        (key === "href" || key === "xlink:href") &&
        !/^#[^\s]+$/.test(value) &&
        !(
          node.name === "image" &&
          /^data:image\/png;base64,[a-zA-Z0-9+/=]+$/.test(value)
        )
      ) {
        throw new Error("Unsupported SVG resource.");
      }
      if (
        key === "style" &&
        !/^(?:mask-type:\s*(?:alpha|luminance)|mix-blend-mode:\s*(?:multiply|screen));?$/.test(
          value,
        )
      ) {
        throw new Error("Unsupported SVG style.");
      }
      if (/url\s*\(/i.test(value) && !/^url\(#[^)]+\)$/.test(value)) {
        throw new Error("Expected a local SVG reference.");
      }
    }
    if (node.attributes.id) {
      if (ids.has(node.attributes.id)) {
        throw new Error("Duplicate SVG ID.");
      }
      ids.add(node.attributes.id);
    }
  });
  visit(parsed, (node) => {
    for (const [attribute, value] of Object.entries(node.attributes)) {
      const ref =
        /^url\(#([^)]+)\)$/.exec(value)?.[1] ??
        ((attribute === "href" || attribute === "xlink:href") &&
        value.startsWith("#")
          ? value.slice(1)
          : undefined);
      if (ref && !ids.has(ref)) {
        throw new Error("Missing local SVG target.");
      }
    }
    if (
      node.children.some(
        (child) =>
          child.type !== "element" &&
          child.type !== "comment" &&
          !(child.type === "text" && !child.value.trim()),
      )
    ) {
      throw new Error("Unsupported SVG content.");
    }
  });
  return parsed;
}

export function normalizeSource(source: string): string {
  const root = parseSvg(source);
  let index = 1;
  visit(root, (node) => {
    const current = index++;
    if (
      !node.attributes.id &&
      ["fill", "stroke", "stop-color", "flood-color"].some(
        (field) => node.attributes[field] && node.attributes[field] !== "none",
      )
    ) {
      node.attributes.id = "source-paint-" + current;
    }
  });
  return serialize(root);
}

export function serialize(root: XastRoot): string {
  return (
    optimize("<svg/>", {
      plugins: [
        {
          name: "replace",
          fn(target) {
            target.children = structuredClone(root.children);
          },
        },
      ],
    }).data + "\n"
  );
}

export function mapPaints(
  source: string,
  paints: Paint[],
): { root: XastRoot; width: number; height: number; roles: string[] } {
  const root = parseSvg(source);
  const svg = root.children.find((n) => n.type === "element") as XastElement;
  if (
    Object.keys(svg.attributes).some(
      (name) =>
        ![
          "width",
          "height",
          "viewBox",
          "xmlns",
          "xmlns:xlink",
          "fill",
        ].includes(name),
    ) ||
    svg.attributes.fill !== "none"
  ) {
    throw new Error("Unsupported SVG root properties. Review the export.");
  }
  const width = Number(svg.attributes.width),
    height = Number(svg.attributes.height);
  if (
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    width <= 0 ||
    height <= 0 ||
    svg.attributes.viewBox !== "0 0 " + width + " " + height
  ) {
    throw new Error("Expected intrinsic SVG dimensions and matching viewBox.");
  }
  const remaining = new Map(paints.map((p) => [p.node + "/" + p.field, p]));
  if (remaining.size !== paints.length) {
    throw new Error("Duplicate paint mapping.");
  }
  const roles = new Set<string>();
  visit(root, (node) => {
    for (const field of [
      "fill",
      "stroke",
      "stop-color",
      "flood-color",
    ] as const) {
      const value = node.attributes[field];
      if (!value || value === "none" || value.startsWith("url(")) {
        continue;
      }
      const key = (node.attributes.id ?? "") + "/" + field;
      const paint = remaining.get(key);
      if (
        !paint ||
        paint.original !== value ||
        !/^[a-z][a-z0-9-]*$/.test(paint.role)
      ) {
        throw new Error("Review paint mapping for " + key);
      }
      node.attributes[field] = "var(--illustration-" + paint.role + ")";
      roles.add(paint.role);
      remaining.delete(key);
    }
  });
  if (remaining.size) {
    throw new Error(
      "Paint mappings refer to missing layers: " +
        [...remaining.keys()].join(", "),
    );
  }
  return { root, width, height, roles: [...roles].sort() };
}

const reactName = (name: string) =>
  name.startsWith("data-")
    ? name
    : name === "xlink:href"
      ? "xlinkHref"
      : name === "xmlns:xlink"
        ? "xmlnsXlink"
        : ({ class: "className", viewBox: "viewBox" }[name] ??
          name.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase()));
export function jsx(root: XastRoot): string {
  const ids = new Map<string, number>();
  visit(root, (node) => {
    if (node.attributes.id) {
      ids.set(node.attributes.id, ids.size);
    }
  });
  const render = (node: XastElement): string => {
    const attrs = Object.entries(node.attributes)
      .map(([name, value]) => {
        if (name === "id") {
          return 'id={prefix + "-' + ids.get(value) + '"}';
        }
        const href =
          (name === "href" || name === "xlink:href") && value.startsWith("#")
            ? value.slice(1)
            : undefined;
        if (href) {
          return reactName(name) + '={"#" + prefix + "-' + ids.get(href) + '"}';
        }
        const ref = /^url\(#([^)]+)\)$/.exec(value)?.[1];
        if (ref) {
          return (
            reactName(name) + '={"url(#" + prefix + "-' + ids.get(ref) + ')"}'
          );
        }
        if (name === "style") {
          const [property, setting] = value.replace(/;$/, "").split(":");
          return (
            "style={{" +
            reactName(property!) +
            ":" +
            JSON.stringify(setting!.trim()) +
            "}}"
          );
        }
        return reactName(name) + "={" + JSON.stringify(value) + "}";
      })
      .join(" ");
    const children = node.children
      .filter((n) => n.type === "element")
      .map(render)
      .join("");
    return (
      "<" +
      node.name +
      (attrs ? " " + attrs : "") +
      (children ? ">" + children + "</" + node.name + ">" : "/>")
    );
  };
  const svg = root.children.find((n) => n.type === "element") as XastElement;
  return (
    "<>" +
    svg.children
      .filter((n) => n.type === "element")
      .map(render)
      .join("") +
    "</>"
  );
}

export function optimizeIllustration(root: XastRoot): XastRoot {
  const result = optimize(serialize(root), {
    multipass: true,
    floatPrecision: 4,
    plugins: [
      {
        name: "preset-default",
        params: { overrides: { convertColors: false, collapseGroups: false } },
      },
    ],
  });
  return parseSvg(result.data);
}
