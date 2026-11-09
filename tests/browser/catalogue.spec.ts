import { test, expect } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

test("top-aligns dialogs with an inline import copy button and foundation color table", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/");
  await page.getByLabel("Search illustrations").fill("house-family-home");
  await page.locator(".catalogue-item").getByRole("button").click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toHaveClass(/dnb-modal__vertical-alignment--top/);
  await expect
    .poll(() =>
      page
        .locator(".dnb-dialog")
        .evaluate((node) => node.getBoundingClientRect().top),
    )
    .toBe(50);
  await dialog
    .getByRole("button", { name: "Details and import", exact: true })
    .click();
  const code = dialog.locator("pre code");
  await expect(code).toHaveText(
    'import HouseFamilyHome from "@eufemia/illustrations/react/buildings/house-family-home";',
  );
  const block = await dialog.locator("pre").boundingBox();
  const copy = await dialog
    .getByRole("button", { name: "Copy import", exact: true })
    .boundingBox();
  expect(copy!.x).toBeGreaterThanOrEqual(block!.x + block!.width);
  expect(
    Math.abs(copy!.y + copy!.height / 2 - block!.y - block!.height / 2),
  ).toBeLessThan(2);
  const table = dialog.getByRole("table", { name: "Foundation assignments" });
  await expect(table).toHaveClass(/dnb-table--outline/);
  await expect(table.getByRole("columnheader")).toHaveText([
    "Material role",
    "Light",
    "Dark",
  ]);
  await expect(table).toContainText("--dnb-coldgreen-600");
  await page.setViewportSize({ width: 360, height: 900 });
  await expect(table).toBeVisible();
  await expect
    .poll(async () => {
      const box = await dialog
        .getByRole("button", { name: "Copy import", exact: true })
        .boundingBox();
      return box!.x + box!.width;
    })
    .toBeLessThanOrEqual(360);
  const mobileBlock = await dialog.locator("pre").boundingBox();
  const mobileCopy = await dialog
    .getByRole("button", { name: "Copy import", exact: true })
    .boundingBox();
  expect(mobileCopy!.x).toBeGreaterThanOrEqual(
    mobileBlock!.x + mobileBlock!.width,
  );
  expect(mobileCopy!.x + mobileCopy!.width).toBeLessThanOrEqual(360);
  expect(mobileBlock!.x).toBeGreaterThanOrEqual(0);
  expect(
    await dialog.evaluate((node) => node.scrollWidth <= node.clientWidth),
  ).toBe(true);
  const scroll = dialog.locator(".illustration-foundations");
  await expect(scroll).toHaveClass(/dnb-table__scroll-view/);
  await expect(scroll).toHaveAttribute("tabindex", "0");
  const row = table.locator("tbody tr").nth(3);
  await row.scrollIntoViewIfNeeded();
  const rowBox = await row.boundingBox();
  const scrollBox = await scroll.boundingBox();
  await page.mouse.move(scrollBox!.x + 100, rowBox!.y + rowBox!.height / 2);
  await page.mouse.wheel(250, 0);
  await expect
    .poll(() => scroll.evaluate((node) => node.scrollLeft))
    .toBeGreaterThan(100);
  const scrollLeft = await scroll.evaluate((node) => node.scrollLeft);
  await scroll.focus();
  await page.keyboard.press("ArrowLeft");
  await expect
    .poll(() => scroll.evaluate((node) => node.scrollLeft))
    .toBeLessThan(scrollLeft);
});

test("preserves the sticky filter behind an open dialog and keeps page scrolling locked", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/");
  const tiles = page.locator(".catalogue-item");
  await expect(tiles).toHaveCount(48);
  await page.locator(".dnb-pagination__marker").last().scrollIntoViewIfNeeded();
  await expect(tiles).toHaveCount(96);
  const trigger = tiles.nth(65).getByRole("button");
  await trigger.scrollIntoViewIfNeeded();
  const filter = page.locator(".catalogue-filter__header");
  const before = await filter.boundingBox();
  expect(before!.y).toBe(8);
  const scrollY = await page.evaluate(() => window.scrollY);
  await trigger.click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect.poll(() => filter.boundingBox()).toEqual(before);
  await expect(page.locator("html")).toHaveCSS("overflow", "hidden");
  await page.mouse.move(10, 500);
  await page.mouse.wheel(0, 600);
  expect(await page.evaluate(() => window.scrollY)).toBe(scrollY);
  await dialog.getByRole("button", { name: "Close", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(trigger).toBeFocused();
  expect(await page.evaluate(() => window.scrollY)).toBe(scrollY);
  await expect.poll(() => filter.boundingBox()).toEqual(before);
});

test("groups numbered variants and lists every version with its own import", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByLabel("Search illustrations").fill("splash");
  const cards = page.locator(".catalogue-item");
  await expect(cards).toHaveCount(1);
  await expect(cards).toContainText("6 variants");
  await cards.getByRole("button").click();
  const dialog = page.getByRole("dialog");
  for (let index = 1; index <= 6; index++) {
    const version = dialog.getByRole("region", {
      name: "Background/Splash-0" + index,
      exact: true,
    });
    await expect(version).toBeAttached();
    await expect(version.locator("svg[data-illustration]")).toHaveCount(2);
  }
  const widths = await dialog
    .locator(
      "section[aria-label^='Background/Splash-']:not([aria-label$='DNB'])",
    )
    .evaluateAll((nodes) =>
      nodes.map((node) => node.getBoundingClientRect().width),
    );
  expect(new Set(widths).size).toBe(1);
  await dialog
    .getByRole("region", { name: "Background/Splash-06", exact: true })
    .getByRole("button", { name: "Details and import", exact: true })
    .click();
  await expect(
    dialog.getByText(
      'import BackgroundSplash06 from "@eufemia/illustrations/react/background/background-splash-06";',
      { exact: true },
    ),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await page.getByLabel("Search illustrations").fill("background-splash-06");
  await expect(cards).toHaveCount(1);
  await expect(cards).toContainText("6 variants");
  await page.getByLabel("Search illustrations").fill("cloud");
  await expect(cards).toHaveCount(3);
  await expect(cards.first()).toContainText("5 variants");
  await page
    .getByLabel("Search illustrations")
    .fill("no-matching-illustration");
  await expect(cards).toHaveCount(0);
  await expect(page.locator(".dnb-pagination__marker")).toHaveCount(0);
});

test("keeps filters sticky and swaps loaded previews without restarting the grid", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/");
  const tiles = page.locator(".catalogue-item");
  await expect(tiles).toHaveCount(48);
  for (const count of [96, 144]) {
    await page
      .locator(".dnb-pagination__marker")
      .last()
      .scrollIntoViewIfNeeded();
    await expect(tiles).toHaveCount(count);
  }
  await expect(tiles.locator("svg")).toHaveCount(144);
  await tiles.nth(70).scrollIntoViewIfNeeded();
  const header = page.locator(".catalogue-filter__header");
  await expect
    .poll(() => header.evaluate((node) => node.getBoundingClientRect().top))
    .toBe(8);
  const tile = await tiles.nth(70).elementHandle();
  const svg = await tiles.nth(70).locator("svg").elementHandle();
  const slugs = await tiles
    .locator("svg")
    .evaluateAll((nodes) =>
      nodes.map((node) => node.getAttribute("data-illustration")),
    );
  const scrollY = await page.evaluate(() => window.scrollY);
  const brand = header.getByRole("group", { name: "Brand", exact: true });
  for (const [label, value, surface] of [
    ["Sbanken", "sbanken", "light"],
    ["DNB Eiendom", "eiendom", "dark"],
    ["DNB Carnegie", "carnegie", "light"],
  ]) {
    await brand.getByRole("button", { name: label!, exact: true }).click();
    if (surface === "dark") {
      await header.getByRole("button", { name: "Dark", exact: true }).click();
    }
    await expect(tiles).toHaveCount(144);
    await expect(tiles.nth(70).locator("svg")).toHaveAttribute(
      "data-illustration-brand",
      value!,
    );
    await expect(tiles.nth(70).locator("svg")).toHaveAttribute(
      "data-illustration-surface",
      surface!,
    );
    expect(await tile!.evaluate((node) => node.isConnected)).toBe(true);
    expect(await svg!.evaluate((node) => node.isConnected)).toBe(true);
    expect(await page.evaluate(() => window.scrollY)).toBeCloseTo(scrollY, 0);
    expect(
      await tiles
        .locator("svg")
        .evaluateAll((nodes) =>
          nodes.map((node) => node.getAttribute("data-illustration")),
        ),
    ).toEqual(slugs);
  }
  await page.locator(".dnb-pagination__marker").last().scrollIntoViewIfNeeded();
  await expect(tiles).toHaveCount(192);
  await expect(tiles.locator("svg")).toHaveCount(192);
  expect(
    new Set(
      await tiles
        .locator("svg")
        .evaluateAll((nodes) =>
          nodes.map((node) => node.getAttribute("data-illustration")),
        ),
    ).size,
  ).toBe(192);
  await expect(tiles.nth(191).locator("svg")).toHaveAttribute(
    "data-illustration-brand",
    "carnegie",
  );
  await page.setViewportSize({ width: 360, height: 900 });
  await expect(header).toHaveCSS("position", "sticky");
  expect(
    await header.evaluate(
      (node) => node.getBoundingClientRect().height <= window.innerHeight * 0.6,
    ),
  ).toBe(true);
  await header.getByRole("button", { name: "Filter", exact: true }).click();
  await header
    .getByRole("button", { name: "Category", exact: true })
    .scrollIntoViewIfNeeded();
  await expect(
    header.getByRole("button", { name: "Category", exact: true }),
  ).toBeVisible();
});

test("keeps brand and surface visible outside the initially closed filter panel", async ({
  page,
}) => {
  await page.goto("/");
  const filter = page.getByRole("button", { name: "Filter", exact: true });
  await expect(filter).toHaveAttribute("aria-expanded", "false");
  const panel = page.locator(".dnb-filter__panel");
  const header = page.locator(".catalogue-filter__header");
  const brand = header.getByRole("group", { name: "Brand", exact: true });
  const surface = header.getByRole("group", { name: "Surface", exact: true });
  await expect(panel).not.toBeVisible();
  await expect(
    panel.getByRole("group", { name: "Brand", exact: true }),
  ).toHaveCount(0);
  await expect(
    panel.getByRole("group", { name: "Surface", exact: true }),
  ).toHaveCount(0);
  await expect(brand.getByRole("button")).toHaveCount(4);
  await expect(
    brand.getByRole("button", { name: "DNB", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await brand.getByRole("button", { name: "Sbanken", exact: true }).click();
  await surface.getByRole("button", { name: "Dark", exact: true }).click();
  await expect(page.locator(".catalogue-item svg").first()).toHaveAttribute(
    "data-illustration-brand",
    "sbanken",
  );
  await expect(page.locator(".catalogue-item svg").first()).toHaveAttribute(
    "data-illustration-surface",
    "dark",
  );
  await filter.click();
  await expect(panel).toBeVisible();
  await expect(brand).toBeVisible();
  await expect(surface).toBeVisible();
  await filter.click();
  await expect(panel).not.toBeVisible();
  await expect(brand).toBeVisible();
  await expect(surface).toBeVisible();
  await expect(
    brand.getByRole("button", { name: "Sbanken", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.setViewportSize({ width: 360, height: 900 });
  await expect
    .poll(() =>
      page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    )
    .toBe(true);
});

test("browses compact thumbnails and opens details without losing the scroll position", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/");
  const tiles = page.locator(".catalogue-item");
  await expect(tiles).toHaveCount(48);
  await expect(tiles.locator("svg[data-illustration]")).toHaveCount(48);
  await expect(page.getByRole("button", { name: "Copy import" })).toHaveCount(
    0,
  );
  await expect(page.getByRole("table")).toHaveCount(0);
  const boxes = await tiles.evaluateAll((nodes) =>
    nodes.slice(0, 7).map((node) => {
      const { x, y, height } = node.getBoundingClientRect();
      return { x, y, height };
    }),
  );
  expect(new Set(boxes.slice(0, 6).map(({ y }) => y)).size).toBe(1);
  expect(boxes[6]!.y).toBeGreaterThan(boxes[0]!.y);
  expect(boxes[0]!.height).toBeLessThan(220);
  const radii = await tiles.first().evaluate((tile) => {
    const surface = tile.querySelector(".illustration-preview")!;
    const style = getComputedStyle(surface);
    return {
      surface: parseFloat(style.borderTopLeftRadius),
      card: parseFloat(
        getComputedStyle(tile.querySelector(".dnb-card")!).borderTopLeftRadius,
      ),
      nested:
        parseFloat(style.getPropertyValue("--token-radius-lg")) *
        parseFloat(getComputedStyle(document.documentElement).fontSize),
    };
  });
  expect(radii.surface).toBe(radii.nested);
  expect(radii.surface).toBeLessThan(radii.card);
  const trigger = tiles.nth(18).getByRole("button");
  await trigger.scrollIntoViewIfNeeded();
  await trigger.focus();
  const scrollY = await page.evaluate(() => window.scrollY);
  await trigger.press("Enter");
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await dialog
    .getByRole("button", { name: "Details and import", exact: true })
    .first()
    .click();
  await expect(
    dialog.getByRole("button", { name: "Copy import" }).first(),
  ).toBeVisible();
  await expect(dialog.getByRole("table").first()).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await expect(trigger).toBeFocused();
  expect(await page.evaluate(() => window.scrollY)).toBeCloseTo(scrollY, 0);
  await page.setViewportSize({ width: 360, height: 900 });
  const mobileBoxes = await tiles.evaluateAll((nodes) =>
    nodes.slice(0, 3).map((node) => node.getBoundingClientRect().y),
  );
  expect(mobileBoxes[0]).toBe(mobileBoxes[1]);
  expect(mobileBoxes[2]).toBeGreaterThan(mobileBoxes[0]!);
});

test("shows the artwork license and copies imports with Eufemia inside a tertiary accordion", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/");
  await expect(
    page.getByText(/adapted through foundation colors/i),
  ).toHaveCount(0);
  const notice = page.locator("header");
  await expect(notice).toContainText("Copyright © DNB Bank ASA");
  await expect(notice).toContainText(
    "Only DNB employees may use these illustrations in DNB applications.",
  );
  await expect(
    notice.getByRole("link", { name: "License", exact: true }),
  ).toHaveAttribute("href", "./LICENSE");
  const license = await page.request.get("/LICENSE");
  expect(license.ok()).toBe(true);
  expect(await license.text()).toContain(
    "Only DNB employees may use these illustrations in DNB applications.",
  );
  await expect(
    notice.getByRole("link", { name: "How to use", exact: true }),
  ).toHaveAttribute(
    "href",
    "https://github.com/dnbexperience/illustrations#readme",
  );
  await expect(notice).toContainText("Figma version");
  const manifest = (await (
    await page.request.get("/manifest.json")
  ).json()) as { figmaVersion: string | null };
  await expect(notice).toContainText(
    manifest.figmaVersion ?? "Not synchronized",
  );
  await expect(notice.getByText("Published", { exact: true })).toBeVisible();
  await expect(notice.locator("time")).toHaveAttribute(
    "datetime",
    /\d{4}-\d{2}-\d{2}T/,
  );
  await expect(
    notice.getByRole("button", { name: "Use the catalogue", exact: true }),
  ).toHaveCount(0);
  await page.getByLabel("Search illustrations").fill("background-splash-01");
  await page.locator(".catalogue-item").getByRole("button").click();
  const dialog = page.getByRole("dialog");
  const version = dialog.getByRole("region", {
    name: "Background/Splash-01",
    exact: true,
  });
  const usage = version.getByRole("button", {
    name: "Details and import",
    exact: true,
  });
  await expect(
    usage.locator(
      "xpath=ancestor::*[contains(@class, 'dnb-accordion__variant--tertiary')]",
    ),
  ).toHaveCount(1);
  await expect(usage).toHaveAttribute("aria-expanded", "false");
  await expect(
    version.getByRole("button", { name: "Copy import", exact: true }),
  ).not.toBeVisible();
  await usage.click();
  await expect(version.locator("pre code")).toHaveText(
    'import BackgroundSplash01 from "@eufemia/illustrations/react/background/background-splash-01";',
  );
  const copy = version.getByRole("button", {
    name: "Copy import",
    exact: true,
  });
  await expect(copy).toHaveClass(/dnb-copy-on-click__button/);
  await expect(copy).toHaveAttribute("aria-label", "Copy import");
  await expect(copy.locator(".dnb-button__text")).toHaveCount(0);
  await copy.click();
  await expect
    .poll(() => page.evaluate(() => navigator.clipboard.readText()))
    .toBe(
      'import BackgroundSplash01 from "@eufemia/illustrations/react/background/background-splash-01";',
    );
});
test("uses Eufemia infinite scrolling without custom page navigation or drafts", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "Next", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Previous", exact: true }),
  ).toHaveCount(0);
  await expect(page.locator(".dnb-pagination__marker").first()).toBeAttached();
  const manifest = (await (
    await page.request.get("/manifest.json")
  ).json()) as { illustrations: Array<{ status: string }> };
  expect(
    manifest.illustrations.every(
      (entry: { status: string }) => entry.status !== "draft",
    ),
  ).toBe(true);
});

test("filters Figma pages, appends results on scroll and resets when filtering", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator(".catalogue-item")).toHaveCount(48);
  const first = await page.locator(".illustration-name").first().innerText();
  await page
    .locator(".dnb-pagination__marker")
    .first()
    .scrollIntoViewIfNeeded();
  await expect(page.locator(".catalogue-item")).toHaveCount(96);
  await expect(page.locator(".illustration-name").first()).toHaveText(first);
  await page.getByLabel("Search illustrations").fill("house-family-home");
  await expect(page.locator(".catalogue-item")).toHaveCount(1);
  await page.getByRole("button", { name: "Filter", exact: true }).click();
  await page.getByRole("button", { name: "Figma page", exact: true }).click();
  await expect(
    page.getByRole("checkbox", { name: "In progress", exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("checkbox", { name: "Human library", exact: true })
    .check();
  await page.getByLabel("Search illustrations").fill("");
  await expect(page.locator(".catalogue-item")).toHaveCount(48);
  const manifest = (await (
    await page.request.get("/manifest.json")
  ).json()) as {
    illustrations: Array<{ page: string; slug: string }>;
  };
  const humanSlugs = new Set(
    manifest.illustrations
      .filter((entry) => entry.page === "Human library")
      .map((entry) => entry.slug),
  );
  const slugs = await page
    .locator(".catalogue-item svg")
    .evaluateAll((nodes) =>
      nodes.map((node) => node.getAttribute("data-illustration")),
    );
  expect(slugs.every((slug) => slug !== null && humanSlugs.has(slug))).toBe(
    true,
  );
});

test("offers tokenized library components without comparison or file downloads", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByText("Original Figma colors", { exact: true }),
  ).toHaveCount(0);
  await expect(page.locator("[download]")).toHaveCount(0);
  await expect(page.getByText(/Compare the originals/i)).toHaveCount(0);
});

test("uses the Eufemia catalog shell and follows system dark mode", async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/");
  const shell = page.locator(".app-theme");
  await expect(shell).toBeVisible();
  expect(await shell.evaluate((n) => getComputedStyle(n).backgroundColor)).toBe(
    "rgb(0, 0, 0)",
  );
  await expect(page.locator(".dnb-filter")).toBeVisible();
  await expect(page.locator("header .dnb-card")).toBeVisible();
  await expect(
    page.locator('[data-illustration-surface="light"]'),
  ).not.toHaveCount(0);
  await page.getByRole("button", { name: "Dark", exact: true }).click();
  await expect(page.locator(".catalogue-item svg").first()).toHaveAttribute(
    "data-illustration-surface",
    "dark",
  );
  await page.emulateMedia({ colorScheme: "light" });
  await expect(shell).toHaveCSS("background-color", "rgb(255, 255, 255)");
});

test("honors height-only sizing while preserving the intrinsic aspect ratio", async ({
  page,
}) => {
  await page.goto("/");
  const fixtureUrl =
    "/@fs/" + fileURLToPath(new URL("./hydrate.tsx", import.meta.url));
  await page.addScriptTag({
    type: "module",
    content:
      "import { renderSizingFixture } from " +
      JSON.stringify(fixtureUrl) +
      "; renderSizingFixture();",
  });
  const svg = page.locator("#sizing-root svg");
  await expect(svg).toBeVisible();
  const size = await svg.evaluate((node) => {
    const box = node.getBoundingClientRect();
    return { width: box.width, height: box.height };
  });
  expect(size.height).toBeCloseTo(100, 0);
  expect(size.width).toBeCloseTo(209.2, 0);
});

test("filters illustrations, switches themes and resolves foundation aliases", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator(".catalogue-item")).toHaveCount(48);
  for (const resource of ["/manifest.json", "/README.md"]) {
    const response = await page.request.get(resource);
    expect(response.ok()).toBeTruthy();
    expect(await response.text()).not.toContain('id="root"');
  }
  await page.getByLabel("Search illustrations").fill("house-family-home");
  await expect(page.locator(".catalogue-item")).toHaveCount(1);
  await page
    .getByRole("group", { name: "Brand", exact: true })
    .getByRole("button", { name: "Sbanken", exact: true })
    .click();
  await page.getByRole("button", { name: "Dark", exact: true }).click();
  const svg = page.locator(
    '.catalogue-item svg[data-illustration="house-family-home"]',
  );
  await expect(svg).toHaveCount(1);
  await expect(svg).toHaveAttribute("data-illustration-surface", "dark");
  await expect(svg).toHaveAttribute("data-illustration-brand", "sbanken");
  const live = await svg.evaluate((node) => {
    const roof = node.querySelector('[fill="var(--illustration-roof)"]')!;
    const before = getComputedStyle(roof).fill;
    (node as SVGElement).style.setProperty(
      "--sbanken-greyscale-700",
      "#112233",
    );
    return { before, after: getComputedStyle(roof).fill };
  });
  expect(live.before).not.toBe(live.after);
  expect(live.after).toBe("rgb(17, 34, 51)");
  await page
    .getByRole("button", { name: "House Family Home", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await dialog
    .getByRole("button", { name: "Details and import", exact: true })
    .click();
  await expect(dialog.getByRole("table")).toContainText(
    "--sbanken-greyscale-700",
  );
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await page
    .getByRole("group", { name: "Brand", exact: true })
    .getByRole("button", { name: "DNB Carnegie", exact: true })
    .click();
  await expect(page.locator(".catalogue-item")).toHaveCount(1);
  await expect(
    page.getByRole("button", { name: "Dark", exact: true }),
  ).toBeDisabled();
  await expect(svg).toHaveAttribute("data-illustration-surface", "light");
  await expect(svg).toHaveAttribute("data-illustration-brand", "carnegie");
  await page.setViewportSize({ width: 360, height: 900 });
  await expect(
    page.getByRole("button", { name: "House Family Home", exact: true }),
  ).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          document.documentElement.scrollWidth <=
          document.documentElement.clientWidth,
      ),
    )
    .toBe(true);
});

test("hydrates repeated SSR illustrations without changing IDs or mask references", async ({
  page,
}) => {
  const html = execFileSync(
    process.execPath,
    ["--import", "tsx", "tests/browser/render.tsx"],
    { encoding: "utf8" },
  );
  await page.goto("/");
  const before = await page.evaluate((html) => {
    document.body.innerHTML = '<div id="hydration-root">' + html + "</div>";
    return [...document.querySelectorAll("#hydration-root [id]")].map(
      (n) => n.id,
    );
  }, html);
  const warnings: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") {
      warnings.push(message.text());
    }
  });
  const fixtureUrl =
    "/@fs/" + fileURLToPath(new URL("./hydrate.tsx", import.meta.url));
  await page.addScriptTag({
    type: "module",
    content:
      "import { hydrateFixture } from " +
      JSON.stringify(fixtureUrl) +
      "; hydrateFixture();",
  });
  await expect(page.locator("#hydration-root")).toHaveAttribute(
    "data-hydrated",
    "true",
  );
  const after = await page.locator("#hydration-root").evaluate((root) => ({
    ids: [...root.querySelectorAll("[id]")].map((n) => n.id),
    refs: [...root.querySelectorAll("[mask]")].map((n) =>
      n.getAttribute("mask")!.slice(5, -1),
    ),
  }));
  expect(after.ids).toEqual(before);
  expect(new Set(after.ids).size).toBe(after.ids.length);
  for (const ref of after.refs) {
    expect(after.ids).toContain(ref);
  }
  expect(warnings).toEqual([]);
});

test("updates light, medium and dark skin independently for every brand and supported surface", async ({
  page,
}) => {
  await page.goto("/");
  const expected: Record<
    string,
    {
      label: string;
      colors: Record<string, string>;
      darkColors?: Record<string, string>;
    }
  > = {
    dnb: {
      label: "DNB",
      colors: {
        light: "rgb(165, 225, 210)",
        medium: "rgb(20, 85, 90)",
        dark: "rgb(0, 52, 62)",
      },
    },
    sbanken: {
      label: "Sbanken",
      colors: {
        light: "rgb(210, 186, 255)",
        medium: "rgb(78, 8, 188)",
        dark: "rgb(28, 27, 78)",
      },
    },
    eiendom: {
      label: "DNB Eiendom",
      darkColors: { dark: "rgb(0, 56, 66)" },
      colors: {
        light: "rgb(177, 203, 210)",
        medium: "rgb(10, 78, 90)",
        dark: "rgb(15, 30, 38)",
      },
    },
    carnegie: {
      label: "DNB Carnegie",
      colors: {
        light: "rgb(204, 240, 231)",
        medium: "rgb(0, 52, 62)",
        dark: "rgb(0, 17, 20)",
      },
    },
  };
  for (const [brand, values] of Object.entries(expected)) {
    await test.step(values.label, async () => {
      await page
        .getByRole("group", { name: "Brand", exact: true })
        .getByRole("button", { name: values.label, exact: true })
        .click();
      for (const tone of ["light", "medium", "dark"]) {
        const slug =
          "walking-customer-woman1-skin-color-" + tone + "-skin-color";
        await page.getByLabel("Search illustrations").fill(slug);
        const svg = page.locator(
          '.catalogue-item svg[data-illustration="' + slug + '"]',
        );
        await expect(svg).toHaveAttribute("data-illustration-brand", brand);
        for (const surface of brand === "carnegie"
          ? ["Light"]
          : ["Light", "Dark"]) {
          await page
            .getByRole("group", { name: "Surface", exact: true })
            .getByRole("button", { name: surface, exact: true })
            .click();
          await expect(svg).toHaveAttribute(
            "data-illustration-surface",
            surface.toLowerCase(),
          );
          await expect
            .poll(() =>
              svg
                .locator('[fill="var(--illustration-skin-' + tone + ')"]')
                .first()
                .evaluate((node) => getComputedStyle(node).fill),
            )
            .toBe(
              (surface === "Dark" ? values.darkColors?.[tone] : undefined) ??
                values.colors[tone],
            );
        }
      }
    });
  }
});
