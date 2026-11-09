import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import {
  cp,
  mkdtemp,
  readFile,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { it } from "node:test";
import type { DiscoveryReport } from "../scripts/discover-figma.js";
import { normalizeSource } from "../scripts/lib/svg.js";
import {
  projectRoot,
  sha256,
  type Config,
  type SourceLock,
} from "../scripts/lib/project.js";

const exec = promisify(execFile);
it("pins synchronization to one Figma version and validates all sources before writing", async () => {
  const fixture = await mkdtemp(path.join(tmpdir(), "illustrations-sync-"));
  try {
    await cp(projectRoot, fixture, {
      recursive: true,
      filter: (file) =>
        file === projectRoot ||
        ![
          "node_modules",
          ".git",
          ".pages",
          ".catalogue",
          ".review",
          ".figma-review",
          "dist",
          "test-results",
        ].includes(path.basename(file)),
    });
    await symlink(
      path.join(projectRoot, "node_modules"),
      path.join(fixture, "node_modules"),
      "dir",
    );
    const mock = String.raw`import {readFile} from 'node:fs/promises';
const config=JSON.parse(await readFile('figma.config.json','utf8'));
globalThis.fetch=async (input,init)=>{
 const url=new URL(input);
 if(url.pathname.endsWith('/nodes')){
  if(init.headers['X-Figma-Token']!=='fixture'){throw Error('Missing API credential');}
  const version=process.env.MISMATCHED_VERSION==='true'&&url.searchParams.has('version')?'different-version':'fixture-version';
  if(url.searchParams.get('depth')==='2'){
   if(url.searchParams.get('version')!=='fixture-version'){throw Error('Discovery version not pinned');}
   const id=url.searchParams.get('ids');
   const children=process.env.NEW_NODE==='true'&&id===config.rootNodeId?[{id:'999:42',name:'New illustration',type:'COMPONENT'}]:[];
   return new Response(JSON.stringify({version,nodes:{[id]:{document:{id,name:'Page',children}}}}));
  }
  return new Response(JSON.stringify({version,nodes:Object.fromEntries(config.illustrations.map(e=>[e.nodeId,{document:{id:e.nodeId,name:e.name}}]))}));
 }
 if(url.pathname.includes('/images/')){
  if(url.searchParams.get('version')!=='fixture-version'){throw Error('Export version not pinned');}
  if(url.searchParams.get('svg_simplify_stroke')!=='false'||url.searchParams.get('use_absolute_bounds')!=='false'){throw Error('Export settings must preserve stroke geometry and visible artwork bounds');}
  if(url.searchParams.get('ids').split(',').length>40){throw Error('Export batch exceeds the source limit');}
  if(url.searchParams.get('ids')==='999:42'){
   return new Response(JSON.stringify({images:{'999:42':'https://s3-alpha.figma.com/new.svg'}}));
  }
  return new Response(JSON.stringify({images:Object.fromEntries(config.illustrations.map((e,i)=>[e.nodeId,'https://s3-alpha.figma.com/'+i+'.svg']))}));
 }
 if(init.headers){throw Error('Credentials sent to download');}
 const index=Number(url.pathname.slice(1).replace('.svg',''));
 let svg=await readFile(index===0?'mock-source.svg':config.illustrations[Number.isNaN(index)?0:index].original,'utf8');
 if(process.env.EXPORT_VARIANT==='true'&&index===0){const id=config.illustrations[0].paints[0].node;svg=svg.replaceAll(id,'rest-'+id);}
 if(process.env.CHANGED_PAINT==='true'&&index===0){svg=svg.replace('fill="#','fill="#123456');}
 if(process.env.INVALID_EXPORT==='true'&&index===config.illustrations.length-1){svg=svg.replace('<path ','<script/><path ');}
 return new Response(svg);
};`;
    await writeFile(path.join(fixture, "mock.mjs"), mock);
    const lockPath = path.join(fixture, ".figma/lock.json");
    const baseline = JSON.parse(await readFile(lockPath, "utf8")) as SourceLock;
    const approvedPath = path.join(fixture, baseline.assets[0]!.path);
    await writeFile(
      path.join(fixture, "mock-source.svg"),
      await readFile(approvedPath, "utf8"),
    );
    baseline.figmaVersion = null;
    for (const asset of baseline.assets) {
      delete asset.exportSha256;
    }
    await writeFile(lockPath, JSON.stringify(baseline));
    const run = () =>
      exec(
        process.execPath,
        ["--import", "tsx", "--import", "./mock.mjs", "scripts/sync-figma.ts"],
        { cwd: fixture, env: { ...process.env, FIGMA_TOKEN: "fixture" } },
      );
    await run();
    const first = await readFile(
      path.join(fixture, ".figma/lock.json"),
      "utf8",
    );
    assert.equal(
      (JSON.parse(first) as { figmaVersion: string }).figmaVersion,
      "fixture-version",
    );
    await run();
    assert.equal(
      await readFile(path.join(fixture, ".figma/lock.json"), "utf8"),
      first,
    );
    const approved = await readFile(approvedPath, "utf8");
    const configForExport = JSON.parse(
      await readFile(path.join(fixture, "figma.config.json"), "utf8"),
    ) as Config;
    const exported = normalizeSource(
      approved.replaceAll(
        configForExport.illustrations[0]!.paints[0]!.node,
        "rest-" + configForExport.illustrations[0]!.paints[0]!.node,
      ),
    );
    const retained = JSON.parse(first) as SourceLock;
    retained.assets[0]!.exportSha256 = sha256(exported);
    await writeFile(lockPath, JSON.stringify(retained));
    const retainedLock = await readFile(lockPath, "utf8");
    await exec(
      process.execPath,
      ["--import", "tsx", "--import", "./mock.mjs", "scripts/sync-figma.ts"],
      {
        cwd: fixture,
        env: { ...process.env, FIGMA_TOKEN: "fixture", EXPORT_VARIANT: "true" },
      },
    );
    assert.equal(await readFile(approvedPath, "utf8"), approved);
    assert.equal(await readFile(lockPath, "utf8"), retainedLock);
    await writeFile(approvedPath, approved + "\n");
    await assert.rejects(
      exec(
        process.execPath,
        ["--import", "tsx", "--import", "./mock.mjs", "scripts/sync-figma.ts"],
        {
          cwd: fixture,
          env: {
            ...process.env,
            FIGMA_TOKEN: "fixture",
            EXPORT_VARIANT: "true",
          },
        },
      ),
      /Review Figma exports/,
    );
    assert.match(
      await readFile(
        path.join(fixture, ".figma-review/sync/report.json"),
        "utf8",
      ),
      /Source differs from lock/,
    );
    assert.equal(await readFile(lockPath, "utf8"), retainedLock);
    await writeFile(approvedPath, approved);
    await writeFile(lockPath, first);
    await assert.rejects(
      exec(
        process.execPath,
        ["--import", "tsx", "--import", "./mock.mjs", "scripts/sync-figma.ts"],
        {
          cwd: fixture,
          env: {
            ...process.env,
            FIGMA_TOKEN: "fixture",
            CHANGED_PAINT: "true",
          },
        },
      ),
      /Review Figma exports/,
    );
    const syncReview = JSON.parse(
      await readFile(
        path.join(fixture, ".figma-review/sync/report.json"),
        "utf8",
      ),
    ) as {
      figmaVersion: string;
      errors: Array<{ nodeId: string }>;
      sources: Array<{ path: string }>;
    };
    assert.equal(syncReview.figmaVersion, "fixture-version");
    assert.equal(syncReview.errors.length, 1);
    assert.equal(
      syncReview.errors[0]!.nodeId,
      (
        JSON.parse(
          await readFile(path.join(fixture, "figma.config.json"), "utf8"),
        ) as { illustrations: Array<{ nodeId: string }> }
      ).illustrations[0]!.nodeId,
    );
    assert.match(
      await readFile(
        path.join(fixture, ".figma-review/sync", syncReview.sources[0]!.path),
        "utf8",
      ),
      /#123456/,
    );
    assert.equal(
      await readFile(path.join(fixture, ".figma/lock.json"), "utf8"),
      first,
    );
    const originalConfig = await readFile(
      path.join(fixture, "figma.config.json"),
      "utf8",
    );
    await exec(
      process.execPath,
      ["--import", "tsx", "--import", "./mock.mjs", "scripts/sync-figma.ts"],
      {
        cwd: fixture,
        env: { ...process.env, FIGMA_TOKEN: "fixture", NEW_NODE: "true" },
      },
    );
    const report = JSON.parse(
      await readFile(path.join(fixture, ".figma-review/report.json"), "utf8"),
    ) as {
      figmaVersion: string;
      candidates: Array<{
        source: { nodeId: string; original: string };
        error?: string;
      }>;
    };
    assert.equal(report.figmaVersion, "fixture-version");
    assert.equal(report.candidates.length, 1);
    assert.equal(report.candidates[0]!.source.nodeId, "999:42");
    assert.equal(report.candidates[0]!.error, undefined);
    assert.equal(
      await readFile(path.join(fixture, "figma.config.json"), "utf8"),
      originalConfig,
    );
    assert.equal(
      await readFile(path.join(fixture, ".figma/lock.json"), "utf8"),
      first,
    );
    assert.match(
      await readFile(path.join(fixture, ".figma-review/index.html"), "utf8"),
      /sbanken-light/,
    );
    await assert.rejects(
      exec(
        process.execPath,
        ["--import", "tsx", "--import", "./mock.mjs", "scripts/sync-figma.ts"],
        {
          cwd: fixture,
          env: {
            ...process.env,
            FIGMA_TOKEN: "fixture",
            MISMATCHED_VERSION: "true",
          },
        },
      ),
      /source version/,
    );
    assert.equal(
      await readFile(path.join(fixture, ".figma/lock.json"), "utf8"),
      first,
    );
    await assert.rejects(
      exec(
        process.execPath,
        ["--import", "tsx", "--import", "./mock.mjs", "scripts/sync-figma.ts"],
        {
          cwd: fixture,
          env: {
            ...process.env,
            FIGMA_TOKEN: "fixture",
            INVALID_EXPORT: "true",
          },
        },
      ),
    );
    assert.equal(
      await readFile(path.join(fixture, ".figma/lock.json"), "utf8"),
      first,
    );
    await exec(
      process.execPath,
      ["--import", "tsx", "--import", "./mock.mjs", "scripts/sync-figma.ts"],
      {
        cwd: fixture,
        env: { ...process.env, FIGMA_TOKEN: "fixture", NEW_NODE: "true" },
      },
    );
    const reportPath = path.join(fixture, ".figma-review/report.json");
    const reviewedReport = await readFile(reportPath, "utf8");
    const sourcePath = path.join(fixture, ".figma-review/999-42/source.svg");
    const reviewedSource = await readFile(sourcePath, "utf8");
    const changedMask = JSON.parse(reviewedReport) as DiscoveryReport;
    const maskSource =
      '<svg width="100" height="100" viewBox="0 0 100 100" fill="none"><mask id="m"><path id="mask-fill" fill="#fff"/></mask><path id="visible" fill="#A5E1D2" mask="url(#m)"/></svg>';
    changedMask.candidates[0]!.sha256 = sha256(maskSource);
    changedMask.candidates[0]!.source.paints = [
      {
        node: "mask-fill",
        field: "fill",
        original: "#fff",
        role: "skin-light",
      },
      {
        node: "visible",
        field: "fill",
        original: "#A5E1D2",
        role: "skin-light",
      },
    ];
    await writeFile(reportPath, JSON.stringify(changedMask));
    await writeFile(sourcePath, maskSource);
    await assert.rejects(
      exec(
        process.execPath,
        ["--import", "tsx", "scripts/import-figma.ts", "999:42"],
        { cwd: fixture },
      ),
      /Mask paint must preserve its exact tone/,
    );
    assert.equal(
      await readFile(path.join(fixture, "figma.config.json"), "utf8"),
      originalConfig,
    );
    await writeFile(reportPath, reviewedReport);
    await writeFile(sourcePath, reviewedSource);
    const invalidRaster = JSON.parse(reviewedReport) as DiscoveryReport;
    const invalidSource = reviewedSource.replace(
      "</svg>",
      '<image href="data:image/png;base64,AAAA"/></svg>',
    );
    invalidRaster.candidates[0]!.sha256 = sha256(invalidSource);
    await writeFile(reportPath, JSON.stringify(invalidRaster));
    await writeFile(sourcePath, invalidSource);
    await assert.rejects(
      exec(
        process.execPath,
        ["--import", "tsx", "scripts/import-figma.ts", "999:42"],
        { cwd: fixture },
      ),
      /unsupported image format/i,
    );
    assert.equal(
      await readFile(path.join(fixture, "figma.config.json"), "utf8"),
      originalConfig,
      "a generation failure must not write the import",
    );
    assert.equal(
      await readFile(path.join(fixture, ".figma/lock.json"), "utf8"),
      first,
    );
    await writeFile(reportPath, reviewedReport);
    await writeFile(sourcePath, reviewedSource);
    await exec(
      process.execPath,
      ["--import", "tsx", "scripts/import-figma.ts", "999:42"],
      { cwd: fixture },
    );
    const imported = JSON.parse(
      await readFile(path.join(fixture, "figma.config.json"), "utf8"),
    ) as { illustrations: Array<{ nodeId: string }> };
    assert.ok(imported.illustrations.some(({ nodeId }) => nodeId === "999:42"));
    assert.match(
      await readFile(
        path.join(fixture, report.candidates[0]!.source.original),
        "utf8",
      ),
      /<svg/,
    );
    await assert.rejects(
      exec(
        process.execPath,
        ["--import", "tsx", "scripts/import-figma.ts", "999:42"],
        { cwd: fixture },
      ),
      /Duplicate illustration source/,
    );
  } finally {
    await rm(fixture, { recursive: true, force: true });
  }
});
