import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import {
  access,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { build } from "vite";
import { projectRoot, listFiles, readJson } from "./lib/project.js";
import type { IllustrationManifest } from "../src/types.js";

const exec = promisify(execFile);
const temporary = await mkdtemp(
  path.join(tmpdir(), "eufemia-illustrations-consumer-"),
);
try {
  const { stdout } = await exec(
    "npm",
    ["pack", "--ignore-scripts", "--json", "--pack-destination", temporary],
    { cwd: projectRoot },
  );
  const [{ filename, files }] = JSON.parse(stdout) as [
    { filename: string; files: Array<{ path: string }> },
  ];
  const paths = files.map((f) => f.path);
  assert.ok(
    !paths.some((file) =>
      /^(src|sources|assets|scripts|tests|site|tokens|\.figma|\.github)\//.test(
        file,
      ),
    ),
    "Package exposes development sources",
  );
  const manifest = await readJson<IllustrationManifest>("manifest.json");
  for (const entry of manifest.illustrations) {
    for (const file of [
      "dist/react/" + entry.category + "/" + entry.slug + ".js",
      "dist/react/" + entry.category + "/" + entry.slug + ".d.ts",
    ]) {
      assert.ok(paths.includes(file), "Missing " + file);
    }
  }
  for (const required of [
    "styles/illustrations.css",
    "dist/react/runtime.js",
    "dist/index.js",
    "manifest.json",
    "LICENSE",
    "README.md",
  ]) {
    assert.ok(paths.includes(required), required);
  }
  const consumer = path.join(temporary, "consumer");
  await mkdir(consumer);
  await writeFile(
    path.join(consumer, "package.json"),
    JSON.stringify({ private: true, type: "module" }),
  );
  await exec(
    "npm",
    [
      "install",
      "--ignore-scripts",
      "--legacy-peer-deps",
      "--offline",
      "--package-lock=false",
      "--audit=false",
      "--fund=false",
      path.join(temporary, filename),
    ],
    { cwd: consumer },
  );
  for (const dependency of ["react", "react-dom", "scheduler"]) {
    await symlink(
      path.join(projectRoot, "node_modules", dependency),
      path.join(consumer, "node_modules", dependency),
      "dir",
    );
  }
  await writeFile(
    path.join(consumer, "check.mjs"),
    [
      'import assert from "node:assert/strict";',
      'import {createElement} from "react";',
      'import {renderToString} from "react-dom/server";',
      'import House from "@eufemia/illustrations/react/buildings/house-family-home";',
      'import {IllustrationProvider} from "@eufemia/illustrations/react";',
      'const html=renderToString(createElement(IllustrationProvider,{brand:"sbanken",surface:"dark"},createElement(House,{title:"Home"})));',
      "assert.match(html, /data-illustration-brand=.sbanken./);",
      'assert.ok(html.includes("<mask"));assert.ok(!html.includes("file://"));',
      'assert.ok(import.meta.resolve("@eufemia/illustrations/styles.css").endsWith(".css"));',
      'await assert.rejects(import("@eufemia/illustrations/assets/original/buildings/house-family-home.svg"));',
    ].join("\n"),
  );
  await exec(process.execPath, ["check.mjs"], { cwd: consumer });
  await writeFile(
    path.join(consumer, "index.html"),
    '<div id="root"></div><script type="module" src="./main.jsx"></script>',
  );
  await writeFile(
    path.join(consumer, "main.jsx"),
    'import {createElement} from "react"; import {createRoot} from "react-dom/client"; import House from "@eufemia/illustrations/react/buildings/house-family-home"; import "@eufemia/illustrations/styles.css"; createRoot(document.querySelector("#root")).render(createElement(House,{title:"Home"}));',
  );
  await build({ root: consumer, configFile: false, logLevel: "error" });
  const outputs = await listFiles(path.join(consumer, "dist"));
  const bundle = (
    await Promise.all(
      outputs.filter((f) => f.endsWith(".js")).map((f) => readFile(f, "utf8")),
    )
  ).join("\n");
  assert.ok(bundle.includes("house-family-home"));
  for (const slug of ["house-frontal", "house-modern", "piggy-bank"]) {
    assert.ok(!bundle.includes(slug), "Bundled unused " + slug);
  }
  await access(
    path.join(
      consumer,
      "node_modules/@eufemia/illustrations/styles/illustrations.css",
    ),
  );
  console.log(
    "Verified packed imports, SSR, assets, CSS and isolated consumer bundle (" +
      paths.length +
      " package files).",
  );
} finally {
  await rm(temporary, { recursive: true, force: true });
}
