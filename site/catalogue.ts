import type {
  IllustrationBrand,
  IllustrationEntry,
  IllustrationSurface,
} from "../src/types.js";

export type IllustrationGroup = {
  id: string;
  name: string;
  entries: IllustrationEntry[];
};

export function groupIllustrations(
  entries: IllustrationEntry[],
): IllustrationGroup[] {
  const families = new Map<string, IllustrationEntry[]>();
  for (const entry of entries) {
    const name = entry.name.replace(/(?:-\d{2}| \d+)$/, "");
    const key =
      entry.status === "component"
        ? JSON.stringify([entry.pageId, entry.category, name])
        : entry.slug;
    const family = families.get(key) ?? [];
    family.push(entry);
    families.set(key, family);
  }
  return [...families.entries()].flatMap(([id, family]) => {
    const numbered = family.some(({ name }) => /(?:-\d{2}| \d+)$/.test(name));
    if (family.length > 1 && numbered) {
      return [
        {
          id,
          name: family[0]!.name.replace(/(?:-\d{2}| \d+)$/, ""),
          entries: family,
        },
      ];
    }
    return family.map((entry) => ({
      id: entry.slug,
      name: entry.name,
      entries: [entry],
    }));
  });
}
export const selectedValues = (
  filters: Record<string, unknown>,
  category: string,
) =>
  Object.keys(filters)
    .filter((key) => key.startsWith("/" + category + "/"))
    .map((key) => key.slice(category.length + 2));
export const getCategories = (entries: IllustrationEntry[]) =>
  [...new Set(entries.map((entry) => entry.category))].sort((a, b) =>
    a.localeCompare(b),
  );
export function filterIllustrations(
  entries: IllustrationEntry[],
  {
    query,
    categories,
    brands,
    surfaces,
    pages = [],
    statuses = [],
  }: {
    query: string;
    categories: string[];
    brands: IllustrationBrand[];
    surfaces: IllustrationSurface[];
    pages?: string[];
    statuses?: string[];
  },
) {
  const normalized = query.trim().toLowerCase();
  return entries.filter(
    (entry) =>
      (!normalized ||
        [entry.name, entry.slug, entry.category]
          .join(" ")
          .toLowerCase()
          .includes(normalized)) &&
      (!categories.length || categories.includes(entry.category)) &&
      (!pages.length || pages.includes(entry.pageId)) &&
      (!statuses.length || statuses.includes(entry.status)) &&
      (!surfaces.length ||
        (brands.length
          ? brands
          : (Object.keys(entry.supportedSurfaces) as IllustrationBrand[])
        ).some((brand) =>
          surfaces.some((surface) =>
            entry.supportedSurfaces[brand].includes(surface),
          ),
        )),
  );
}
