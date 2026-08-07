import { describe, expect, it } from "vitest";
import { candidateToProduct, filterProducts } from "../src/products.js";

describe("product detection", () => {
  it("extracts a 65-inch TV candidate", () => {
    const product = candidateToProduct({
      text: '65" OLED Samsung Vision AI Smart TV QE65S95F (2025) € 2.499,00',
      url: "https://www.samsung.com/nl/tvs/oled-tv/qe65s95f/"
    });

    expect(product).toMatchObject({
      name: '65" OLED Samsung Vision AI Smart TV QE65S95F (2025) € 2.499,00',
      model: "QE65S95F",
      price: "€ 2.499,00"
    });
  });

  it("ignores non-65-inch content", () => {
    expect(
      candidateToProduct({
        text: '55" OLED Smart TV QE55S95F',
        url: "https://www.samsung.com/nl/tvs/oled-tv/qe55s95f/"
      })
    ).toBeUndefined();
  });

  it("supports a configurable screen size", () => {
    expect(
      candidateToProduct(
        {
          text: '55" Mini LED Smart TV UE55M74HAUXXN',
          url: "https://www.samsung.com/nl/tvs/mini-led/ue55m74hau/"
        },
        55
      )
    ).toMatchObject({ model: "UE55M74HAUXXN" });
  });

  it("excludes only the configured Frame Pro model", () => {
    const excluded = candidateToProduct({
      text: '65" The Frame Pro Samsung Vision AI Smart TV LS03FW (2025)',
      url: "https://www.samsung.com/nl/lifestyle-tvs/the-frame-pro-ls03fw/"
    });
    const wanted = candidateToProduct({
      text: '65" Neo QLED Samsung Vision AI Smart TV QE65QN90F (2025)',
      url: "https://www.samsung.com/nl/tvs/qled-tv/qe65qn90f/"
    });

    expect(
      filterProducts(
        [excluded, wanted].filter((product) => product !== undefined),
        ["the frame pro", "ls03fw", "2025"]
      )
    ).toEqual([wanted]);
  });

  it("does not exclude products when no exclusion terms are configured", () => {
    const wanted = candidateToProduct({
      text: '65" OLED Smart TV QE65S95F',
      url: "https://www.samsung.com/nl/tvs/oled-tv/qe65s95f/"
    });

    expect(filterProducts(wanted ? [wanted] : [], [])).toEqual([wanted]);
  });
});
