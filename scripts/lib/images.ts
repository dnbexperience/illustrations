import sharp from "sharp";
import type { XastRoot } from "svgo";
import { visit } from "./svg.js";
export async function optimizeEmbeddedImages(
  root: XastRoot,
  width: number,
  height: number,
) {
  const images: Array<{ attributes: Record<string, string> }> = [];
  visit(root, (node) => {
    if (node.name === "image") {
      images.push(node);
    }
  });
  for (const image of images) {
    const field = image.attributes["xlink:href"] ? "xlink:href" : "href";
    const source = image.attributes[field]!;
    if (!source.startsWith("data:image/png;base64,")) {
      continue;
    }
    const input = Buffer.from(
      source.slice("data:image/png;base64,".length),
      "base64",
    );
    const output = await sharp(input)
      .resize({
        width: Math.ceil(width * 4),
        height: Math.ceil(height * 4),
        fit: "inside",
        withoutEnlargement: true,
      })
      .png({ compressionLevel: 9, adaptiveFiltering: true })
      .toBuffer();
    if (output.length < input.length) {
      image.attributes[field] =
        "data:image/png;base64," + output.toString("base64");
    }
  }
}
