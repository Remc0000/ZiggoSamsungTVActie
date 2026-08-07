import { gzipSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { decodeBootstrapSession } from "../src/bootstrap.js";

describe("session bootstrap", () => {
  it("decodes a compressed Playwright storage state", () => {
    const expected = {
      cookies: [],
      origins: [
        {
          origin: "https://www.samsung.com",
          localStorage: [{ name: "signedIn", value: "true" }]
        }
      ]
    };
    const encoded = gzipSync(JSON.stringify(expected)).toString("base64");

    expect(decodeBootstrapSession(encoded)).toEqual(expected);
  });
});
