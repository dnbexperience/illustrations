export const brands = ["dnb", "sbanken", "eiendom", "carnegie"] as const;
export type IllustrationBrand = (typeof brands)[number];
export type IllustrationSurface = "light" | "dark";
export type IllustrationEntry = {
  slug: string;
  name: string;
  category: string;
  nodeId: string;
  width: number;
  height: number;
  page: string;
  pageId: string;
  status: "approved" | "component" | "draft";
  roles: string[];
  supportedSurfaces: Record<IllustrationBrand, IllustrationSurface[]>;
};
export type IllustrationManifest = {
  schemaVersion: 1;
  figmaFileKey: string;
  figmaVersion: string | null;
  illustrations: IllustrationEntry[];
};
