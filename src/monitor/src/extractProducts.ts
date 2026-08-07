import type { Page, Response } from "playwright";
import { candidateToProduct, filterProducts } from "./products.js";
import type { TvProduct } from "./types.js";
import { isTargetInchText } from "./normalize.js";

interface SamsungApiModel {
  modelCode?: string;
  displayName?: string;
  pdpUrl?: string;
  ctaType?: string;
  stockStatusText?: string;
  priceDisplay?: string;
  priceCurrency?: string;
}

interface SamsungApiPayload {
  response?: {
    resultData?: {
      productList?: Array<{
        modelList?: SamsungApiModel[];
      }>;
    };
  };
}

export const apiModelToProduct = (
  model: SamsungApiModel,
  baseUrl = "https://www.samsung.com"
): TvProduct | undefined => {
  const modelCode = model.modelCode?.trim();
  const name = model.displayName?.trim();
  const pdpUrl = model.pdpUrl?.trim();
  const inStock =
    model.ctaType === "inStock" || model.stockStatusText === "inStock";

  if (!modelCode || !name || !pdpUrl || !inStock) {
    return undefined;
  }

  const url = new URL(pdpUrl, baseUrl).toString();
  const price = model.priceDisplay
    ? `${model.priceCurrency === "EUR" ? "€ " : ""}${model.priceDisplay}`
    : undefined;

  return {
    id: modelCode.toLowerCase(),
    name,
    model: modelCode,
    ...(price ? { price } : {}),
    url,
    description: [
      name,
      `Model: ${modelCode}`,
      price ? `Prijs: ${price}` : undefined,
      url
    ]
      .filter(Boolean)
      .join("\n")
  };
};

export const createSamsungProductCollector = (page: Page): {
  products: () => TvProduct[];
  dispose: () => void;
} => {
  const products = new Map<string, TvProduct>();

  const handleResponse = async (response: Response): Promise<void> => {
    if (!response.url().includes("/product/model/list/")) {
      return;
    }

    try {
      const payload = (await response.json()) as SamsungApiPayload;
      for (const family of payload.response?.resultData?.productList ?? []) {
        for (const model of family.modelList ?? []) {
          const product = apiModelToProduct(model);
          if (product) {
            products.set(product.id, product);
          }
        }
      }
    } catch (error) {
      console.warn(
        JSON.stringify({
          event: "product_api_parse_failed",
          message: error instanceof Error ? error.message : "Unknown error"
        })
      );
    }
  };

  page.on("response", handleResponse);
  return {
    products: () => [...products.values()],
    dispose: () => page.off("response", handleResponse)
  };
};

export const extractDomProducts = async (
  page: Page,
  targetSizeInches: number
): Promise<TvProduct[]> => {
  const candidates = await page.locator("a[href]").evaluateAll((anchors) => {
    const result: Array<{ text: string; url: string }> = [];

    for (const anchor of anchors) {
      if (!(anchor instanceof HTMLAnchorElement)) {
        continue;
      }

      const url = anchor.href;
      if (
        !url ||
        !/samsung\.com\/nl\//i.test(url) ||
        !/(tv|television|lifestyle)/i.test(url)
      ) {
        continue;
      }

      const card = anchor.closest(
        "article, li, [data-testid*='product'], [class*='product-card'], [class*='ProductCard']"
      );
      const text = (card?.textContent ?? anchor.textContent ?? "")
        .replace(/\s+/g, " ")
        .trim();

      if (text) {
        result.push({ text, url });
      }
    }

    return result;
  });

  return candidates
    .map((candidate) => candidateToProduct(candidate, targetSizeInches))
    .filter((product): product is TvProduct => product !== undefined);
};

export const selectEligibleProducts = (
  products: TvProduct[],
  excludedTerms: string[],
  targetSizeInches = 65
): {
  allProducts: TvProduct[];
  targetSizeProducts: TvProduct[];
  eligibleProducts: TvProduct[];
} => {
  const unique = new Map(products.map((product) => [product.id, product]));
  const allProducts = [...unique.values()];
  const targetSizeProducts = allProducts.filter((product) =>
    isTargetInchText(
      `${product.name} ${product.model ?? ""}`,
      targetSizeInches
    )
  );

  return {
    allProducts,
    targetSizeProducts,
    eligibleProducts: filterProducts(targetSizeProducts, excludedTerms)
  };
};
