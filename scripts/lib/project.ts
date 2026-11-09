import { createHash } from "node:crypto";
import { readFile, readdir, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type {
  IllustrationBrand,
  IllustrationSurface,
} from "../../src/types.js";

export const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
export type Paint = {
  node: string;
  field: "fill" | "stroke" | "stop-color" | "flood-color";
  role: string;
  original: string;
};
export type Source = {
  slug: string;
  name: string;
  category: string;
  nodeId: string;
  original: string;
  paints: Paint[];
  pageId?: string;
  page?: string;
  status?: "approved" | "component" | "draft";
};
export type Config = {
  schemaVersion: 1;
  fileKey: string;
  rootNodeId: string;
  pages?: Array<{ id: string; name: string; status: string }>;
  illustrations: Source[];
};
export type SourceLock = {
  schemaVersion: number;
  figmaVersion: string | null;
  assets: Array<{
    path: string;
    nodeId: string;
    sha256: string;
    exportSha256?: string;
    figmaVersion?: string;
  }>;
};
export type Palette = {
  name: string;
  supportedSurfaces: IllustrationSurface[];
  foundationSource: {
    repository: string;
    path: string;
    commit: string;
    sha256: string;
    exportedOnly?: boolean;
  };
  foundations: Record<string, string>;
  roles: Record<string, string>;
  darkRoles: Record<string, string>;
  surfaces: Partial<Record<IllustrationSurface, string>>;
};
export const readJson = async <T>(file: string): Promise<T> =>
  JSON.parse(await readFile(path.join(projectRoot, file), "utf8")) as T;
export const stableJson = (value: unknown) =>
  JSON.stringify(value, null, 2) + "\n";
export const sha256 = (value: string | Buffer) =>
  createHash("sha256").update(value).digest("hex");
export const palettes = async (): Promise<
  Record<IllustrationBrand, Palette>
> => ({
  dnb: await readJson("tokens/dnb.json"),
  sbanken: await readJson("tokens/sbanken.json"),
  eiendom: await readJson("tokens/eiendom.json"),
  carnegie: await readJson("tokens/carnegie.json"),
});
export const writeOutput = async (
  file: string,
  value: string | Buffer,
  check: boolean,
) => {
  const target = path.join(projectRoot, file);
  if (check) {
    const actual = await readFile(target);
    if (!actual.equals(Buffer.isBuffer(value) ? value : Buffer.from(value))) {
      throw new Error(file + " is stale. Run npm run generate.");
    }
  } else {
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, value);
  }
};
export const listFiles = async (directory: string): Promise<string[]> => {
  const items = await readdir(directory, { withFileTypes: true });
  const result: string[] = [];
  for (const item of items) {
    const file = path.join(directory, item.name);
    if (item.isSymbolicLink()) {
      throw new Error("Generated files must not be symbolic links.");
    }
    if (item.isDirectory()) {
      result.push(...(await listFiles(file)));
    } else {
      result.push(file);
    }
  }
  return result.sort();
};
