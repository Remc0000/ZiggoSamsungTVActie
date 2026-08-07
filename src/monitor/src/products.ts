import { createHash } from "node:crypto";
import type { TvProduct } from "./types.js";
import { isTargetInchText, normalize } from "./normalize.js";

interface ProductCandidate {
  text: string;
  url: string;
}

const modelPattern = /\b(?:QE|GQ|TQ|LS|UA|UE|UN)[A-Z0-9-]{4,}\b/i;
const pricePattern = /€\s?[\d.]+(?:,\d{2})?/;

const productId = (model: string | undefined, url: string): string => {
  if (model) {
    return normalize(model).replaceAll(" ", "-");
  }
  return createHash("sha256").update(url).digest("hex").slice(0, 24);
};

export const candidateToProduct = (
  candidate: ProductCandidate,
  targetSizeInches = 65
): TvProduct | undefined => {
  const lines = candidate.text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const combined = lines.join(" ");

  if (
    !isTargetInchText(combined, targetSizeInches) ||
    !/\btv\b/i.test(combined)
  ) {
    return undefined;
  }

  const model = combined.match(modelPattern)?.[0]?.toUpperCase();
  const price = combined.match(pricePattern)?.[0];
  const name =
    lines.find(
      (line) =>
        isTargetInchText(line, targetSizeInches) && /\btv\b/i.test(line)
    ) ??
    lines[0];

  if (!name) {
    return undefined;
  }

  return {
    id: productId(model, candidate.url),
    name,
    ...(model ? { model } : {}),
    ...(price ? { price } : {}),
    url: candidate.url,
    description: [
      name,
      model ? `Model: ${model}` : undefined,
      price ? `Prijs: ${price}` : undefined,
      candidate.url
    ]
      .filter(Boolean)
      .join("\n")
  };
};

export const filterProducts = (
  products: TvProduct[],
  excludedTerms: string[]
): TvProduct[] => {
  const normalizedTerms = excludedTerms.map(normalize);
  const unique = new Map<string, TvProduct>();

  for (const product of products) {
    const searchable = normalize(
      `${product.name} ${product.model ?? ""} ${product.description}`
    );
    const excluded =
      normalizedTerms.length > 0 &&
      normalizedTerms.every((term) => searchable.includes(term));

    if (!excluded) {
      unique.set(product.id, product);
    }
  }

  return [...unique.values()];
};
