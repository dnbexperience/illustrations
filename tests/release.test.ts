import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { it } from "node:test";
import { projectRoot, readJson } from "../scripts/lib/project.js";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

it("classifies Conventional Commit breaking titles and generates their release notes", async () => {
  const { stdout } = await promisify(execFile)(
    process.execPath,
    [
      "--input-type=module",
      "-e",
      `
    import { readFile } from 'node:fs/promises';
    import { analyzeCommits } from '@semantic-release/commit-analyzer';
    import { generateNotes } from '@semantic-release/release-notes-generator';
    const pkg = JSON.parse(await readFile('package.json', 'utf8'));
    const options = (name) => {
      const entry = pkg.release.plugins.find((plugin) => (Array.isArray(plugin) ? plugin[0] : plugin) === name);
      return Array.isArray(entry) ? entry[1] : {};
    };
    const messages = ['feat(Illustrations): add a house', 'fix(Illustrations): correct a color', 'feat(Illustrations)!: remove an import', 'chore: update documentation'];
    const results = [];
    for (const message of messages) {
      results.push(await analyzeCommits(options('@semantic-release/commit-analyzer'), { cwd: process.cwd(), commits: [{ hash: 'abc1234', message }], logger: { log() {} } }));
    }
    const notes = await generateNotes(options('@semantic-release/release-notes-generator'), {
      cwd: process.cwd(), commits: [{ hash: 'abc1234', message: messages[2] }], lastRelease: {},
      nextRelease: { version: '2.0.0', gitTag: 'v2.0.0' }, options: { repositoryUrl: pkg.repository.url },
    });
    process.stdout.write(JSON.stringify({ results, notes }));
  `,
    ],
    { cwd: projectRoot },
  );
  const result = JSON.parse(stdout) as {
    results: Array<string | null>;
    notes: string;
  };
  assert.deepEqual(result.results, ["minor", "patch", "major", null]);
  assert.match(result.notes, /BREAKING CHANGES/);
  assert.match(result.notes, /remove an import/);
});
it("publishes the validated build through npm Trusted Publishing without stored npm credentials", async () => {
  const pkg = await readJson<{
    publishConfig: { registry: string; access: string; provenance: boolean };
    release: { branches: string[]; tagFormat: string; plugins: unknown[] };
    scripts: Record<string, string>;
  }>("package.json");
  assert.equal(pkg.publishConfig.registry, "https://registry.npmjs.org/");
  assert.equal(pkg.publishConfig.access, "public");
  assert.equal(pkg.publishConfig.provenance, true);
  assert.deepEqual(pkg.release.branches, ["main"]);
  assert.equal(pkg.scripts.prepack, "npm run check:generated && npm run build");
  assert.match(pkg.scripts["release:check"]!, /--dry-run/);
  assert.match(pkg.scripts["release:check"]!, /--tag=release-validation/);
  const release = await readFile(
    path.join(projectRoot, ".github/workflows/release.yml"),
    "utf8",
  );
  for (const marker of [
    "needs: validate",
    "environment: npm-release",
    "id-token: write",
    "NPM_CONFIG_IGNORE_SCRIPTS:",
    "actions/upload-artifact@",
    "actions/download-artifact@",
    "npm run ci",
    "npm run test:browser",
    "npm run release:check",
    "semantic-release",
  ]) {
    assert.ok(release.includes(marker), marker);
  }
  assert.ok(!release.includes("FIGMA_TOKEN"));
  assert.ok(!release.includes("NPM_TOKEN"));
  assert.ok(!release.includes("NODE_AUTH_TOKEN"));
  assert.ok(!release.includes("registry-url:"));
  const publish = release.slice(release.indexOf("  publish:"));
  assert.ok(!publish.includes("npm run build"));
});
