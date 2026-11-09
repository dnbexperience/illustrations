import assert from "node:assert/strict";
import { it } from "node:test";
import {
  mapPaints,
  parseSvg,
  serialize,
  jsx,
  optimizeIllustration,
} from "../scripts/lib/svg.js";

it("optimizes tokenized SVGs while retaining dimensions, masks and material variables", () => {
  const mapped = mapPaints(
    '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 10 10" fill="none"><defs><mask id="m"><rect id="mask-paint" width="10" height="10" fill="white"/></mask></defs><path id="shape" mask="url(#m)" d="M 0 0 L 10 0 L 10 10 L 0 10 Z" fill="#007272"/></svg>',
    [
      { node: "mask-paint", field: "fill", role: "mask", original: "white" },
      { node: "shape", field: "fill", role: "wall-front", original: "#007272" },
    ],
  );
  const before = serialize(mapped.root);
  const after = serialize(optimizeIllustration(mapped.root));
  assert.ok(after.length < before.length);
  assert.match(after, /viewBox="0 0 10 10"/);
  assert.match(after, /var\(--illustration-wall-front\)/);
  assert.match(after, /<mask/);
  assert.match(after, /url\(#/);
});

const source =
  '<svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path id="wall" d="M0 0h10v10z" fill="#007272"/></svg>';
it("requires reviewed paint mappings for new, removed and recolored layers", () => {
  const paint = {
    node: "wall",
    field: "fill" as const,
    role: "wall-front",
    original: "#007272",
  };
  assert.match(
    serialize(mapPaints(source, [paint]).root),
    /var\(--illustration-wall-front\)/,
  );
  assert.throws(() => mapPaints(source, []), /Review paint/);
  assert.throws(
    () => mapPaints(source, [{ ...paint, original: "#ffffff" }]),
    /Review paint/,
  );
  assert.throws(
    () => mapPaints(source, [paint, { ...paint, node: "missing" }]),
    /missing layers/,
  );
});
it("rejects active, external, text and unsupported SVG content", () => {
  for (const source of [
    "<svg><script/></svg>",
    '<svg><image href="https://example.com"/></svg>',
    '<svg><path onload="x"/></svg>',
    "<svg><text>Hello</text></svg>",
    '<svg><path fill="url(https://example.com)"/></svg>',
    "<!DOCTYPE svg><svg/>",
    '<svg><path style="fill:red"/></svg>',
    '<svg><path mask="url(#missing)"/></svg>',
    '<svg><path clip-path="URL(https://example.com/shape)"/></svg>',
    '<svg><image href="#missing"/></svg>',
  ]) {
    assert.throws(() => parseSvg(source));
  }
});
it("validates local resources without treating use-element colors as references", () => {
  assert.doesNotThrow(() =>
    parseSvg(
      '<svg><defs><path id="shape" d="M0 0h1v1z"/></defs><use href="#shape" fill="#007272"/></svg>',
    ),
  );
});
it("rewrites mask and clip references to instance-scoped React IDs", () => {
  const root = parseSvg(
    '<svg><defs><mask id="m"><path d="M0 0"/></mask></defs><g mask="url(#m)"><path/></g></svg>',
  );
  const output = jsx(root);
  assert.match(output, /id=\{prefix/);
  assert.match(output, /mask=\{"url\(#" \+ prefix/);
  assert.doesNotMatch(output, /url\(#m\)/);
});
it("rejects root properties the React wrapper cannot preserve", () => {
  const changed = source.replace('fill="none"', 'fill="none" opacity="0.5"');
  assert.throws(
    () =>
      mapPaints(changed, [
        {
          node: "wall",
          field: "fill",
          role: "wall-front",
          original: "#007272",
        },
      ]),
    /root/,
  );
});
