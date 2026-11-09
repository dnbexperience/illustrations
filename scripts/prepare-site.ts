import { cp, mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { projectRoot } from "./lib/project.js";
import { fileURLToPath } from "node:url";
export async function prepareSite() {
  const target = path.join(projectRoot, ".catalogue");
  await rm(target, { recursive: true, force: true });
  await mkdir(target, { recursive: true });
  for (const name of ["manifest.json", "README.md", "LICENSE"]) {
    await cp(path.join(projectRoot, name), path.join(target, name));
  }
}
if (
  process.argv[1] &&
  fileURLToPath(import.meta.url) === path.resolve(process.argv[1])
) {
  await prepareSite();
}
