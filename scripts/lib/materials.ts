// Only these roles are proposed for new artwork. Existing mappings stay explicit.
export const materials = [
  {
    name: "hair",
    layers: /\b(hair|beard|eyebrows?)\b/i,
    roles: ["hair-light", "hair", "hair-dark"],
  },
  {
    name: "clothing",
    layers:
      /\b(clothing|shirt|pants|trousers|dress|shoes|hat|jacket|sweater)\b/i,
    roles: ["clothing-light", "clothing", "clothing-dark", "clothing-accent"],
  },
  {
    name: "outline",
    layers: /\b(outline|eyes?|mouth|details?)\b/i,
    roles: ["outline"],
  },
  {
    name: "highlight",
    layers: /\b(highlights?|reflection)\b/i,
    roles: ["highlight"],
  },
  {
    name: "skin",
    layers: /\b(skin|face|hands?|arms?|legs?|head)\b/i,
    roles: ["skin-light", "skin-medium", "skin-dark"],
  },
  {
    name: "foliage",
    layers: /\b(leaf|leaves|foliage)\b/i,
    roles: [
      "foliage-light",
      "foliage",
      "foliage-medium",
      "foliage-shadow",
      "foliage-dark",
    ],
  },
  {
    name: "surface",
    layers: /\b(surface|wall|roof|floor|ground)\b/i,
    roles: ["surface-light", "surface", "surface-shade", "surface-dark"],
  },
  {
    name: "accent",
    layers: /\b(accents?)\b/i,
    roles: ["accent-light", "accent", "accent-dark"],
  },
] as const;
