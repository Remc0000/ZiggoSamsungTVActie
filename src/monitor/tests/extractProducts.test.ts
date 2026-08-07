import { describe, expect, it } from "vitest";
import {
  apiModelToProduct,
  selectEligibleProducts
} from "../src/extractProducts.js";

describe("Samsung product API", () => {
  it("maps an in-stock API model", () => {
    expect(
      apiModelToProduct({
        modelCode: "QE65S95FATXXN",
        displayName: '65" OLED Samsung Vision AI Smart TV S95F',
        pdpUrl: "/nl/multistore/nld/pd.QE65S95FATXXN/",
        ctaType: "inStock",
        priceDisplay: "1.999,-",
        priceCurrency: "EUR"
      })
    ).toMatchObject({
      id: "qe65s95fatxxn",
      model: "QE65S95FATXXN",
      price: "€ 1.999,-"
    });
  });

  it("separates all, 65-inch, and eligible products", () => {
    const products = [
      apiModelToProduct({
        modelCode: "UE55M74HAUXXN",
        displayName: '55" Mini LED TV',
        pdpUrl: "/55",
        ctaType: "inStock"
      }),
      apiModelToProduct({
        modelCode: "QE65LS03FWUXXN",
        displayName:
          '65" The Frame Pro Samsung Vision AI Smart TV LS03FW (2025)',
        pdpUrl: "/frame",
        ctaType: "inStock"
      }),
      apiModelToProduct({
        modelCode: "QE65S95FATXXN",
        displayName: '65" OLED Smart TV S95F',
        pdpUrl: "/oled",
        ctaType: "inStock"
      })
    ].filter((product) => product !== undefined);

    const result = selectEligibleProducts(
      products,
      ["the frame pro", "ls03fw", "2025"],
      65
    );

    expect(result.allProducts).toHaveLength(3);
    expect(result.targetSizeProducts).toHaveLength(2);
    expect(result.eligibleProducts.map((product) => product.model)).toEqual([
      "QE65S95FATXXN"
    ]);
  });
});
