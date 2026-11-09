import { execFile } from "node:child_process";
import { rm } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { projectRoot } from "./lib/project.js";

await rm(path.join(projectRoot, "dist"), { recursive: true, force: true });
await promisify(execFile)(process.execPath, [
  path.join(projectRoot, "node_modules/typescript/bin/tsc"),
  "-p",
  "tsconfig.build.json",
]);
