import assert from "node:assert/strict";
import { it } from "node:test";
import { renderToString, renderToStaticMarkup } from "react-dom/server";
import { IllustrationProvider } from "../src/react/runtime.js";
import House from "../src/react/buildings/house-family-home.js";

it("requires a title or an explicit decorative choice", () => {
  assert.throws(() => renderToStaticMarkup(<House title=" " />), /title/);
  const titled = renderToStaticMarkup(<House title="My home" />);
  assert.match(titled, /role="img"/);
  assert.match(titled, /<title id="[^"]+">My home<\/title>/);
  assert.match(titled, /aria-labelledby="[^"]+"/);
  const decorative = renderToStaticMarkup(<House decorative />);
  assert.match(decorative, /aria-hidden="true"/);
  assert.doesNotMatch(decorative, /<title|aria-labelledby|role="img"/);
});
it("inherits nested provider defaults and permits explicit overrides", () => {
  const html = renderToStaticMarkup(
    <IllustrationProvider brand="sbanken" surface="dark">
      <IllustrationProvider>
        <House decorative />
        <House decorative brand="eiendom" />
        <House decorative brand="carnegie" />
      </IllustrationProvider>
    </IllustrationProvider>,
  );
  assert.match(
    html,
    /data-illustration-brand="sbanken" data-illustration-surface="dark"/,
  );
  assert.match(
    html,
    /data-illustration-brand="eiendom" data-illustration-surface="dark"/,
  );
  assert.match(
    html,
    /data-illustration-brand="carnegie" data-illustration-surface="light"/,
  );
});
it("scopes every title and mask to a unique SSR instance", () => {
  const html = renderToString(
    <>
      <House title="First" />
      <House title="Second" />
    </>,
  );
  const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
  assert.equal(new Set(ids).size, ids.length);
  for (const match of html.matchAll(/url\(#([^)]+)\)/g)) {
    assert.ok(ids.includes(match[1]));
  }
  assert.equal((html.match(/<mask /g) || []).length, 14);
});
it("supports caller size, class, local foundation aliases and native SVG props", () => {
  const html = renderToStaticMarkup(
    <House
      title="Home"
      width={300}
      className="example"
      style={
        {
          "--illustration-roof": "var(--dnb-coldgreen-500)",
        } as React.CSSProperties
      }
      data-testid="home"
    />,
  );
  assert.match(html, /width="300"/);
  assert.match(html, /class="dnb-illustration example"/);
  assert.match(html, /--illustration-roof:var\(--dnb-coldgreen-500\)/);
});
it("keeps distinct React root identifier prefixes distinct in SVG IDs", () => {
  const first = renderToString(<House title="First" />, {
    identifierPrefix: "root:",
  });
  const second = renderToString(<House title="Second" />, {
    identifierPrefix: "root_",
  });
  const ids = [...(first + second).matchAll(/\sid="([^"]+)"/g)].map(
    (m) => m[1],
  );
  assert.equal(new Set(ids).size, ids.length);
});
