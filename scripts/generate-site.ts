import { cp, mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { projectRoot } from "./lib/project.js";
import { prepareSite } from "./prepare-site.js";
import { build } from "vite";
await prepareSite();
await build({ configFile: path.join(projectRoot, "vite.site.config.ts") });
if (process.argv.includes("--review")) {
  const target = path.join(projectRoot, ".review");
  await rm(target, { recursive: true, force: true });
  await mkdir(target, { recursive: true });
  await cp(path.join(projectRoot, ".pages"), target, { recursive: true });
  await writeFile(
    path.join(target, "README.txt"),
    "Run python3 -m http.server in this folder, then open the printed local URL. This review uses the same token-based components as the documentation.",
  );
}
