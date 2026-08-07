import { describe, expect, it } from "vitest";
import { createEmailPayload } from "../src/email.js";

describe("email payload", () => {
  it("uses the requested subject and message prefix", () => {
    const payload = createEmailPayload(
      {
        id: "qe65s95f",
        name: '65" OLED TV',
        model: "QE65S95F",
        url: "https://example.test/tv",
        description: '65" OLED TV\nModel: QE65S95F\nhttps://example.test/tv'
      },
      "gebruiker@gmail.com",
      "Samsung TV beschikbaar",
      "Ga naar https://www.samsung.com/nl/multistore/nld/ om je TV uit te zoeken, ik heb deze voor je gevonden:"
    );

    expect(payload.subject).toBe("Samsung TV beschikbaar");
    expect(payload.message).toContain(
      "Ga naar https://www.samsung.com/nl/multistore/nld/"
    );
    expect(payload.message).toContain("QE65S95F");
  });
});
