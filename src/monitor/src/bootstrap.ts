import { gunzipSync } from "node:zlib";
import type { BrowserContextOptions } from "playwright";

export const decodeBootstrapSession = (
  encoded: string
): NonNullable<BrowserContextOptions["storageState"]> => {
  const json = gunzipSync(Buffer.from(encoded, "base64")).toString("utf8");
  const state = JSON.parse(json) as {
    cookies?: unknown;
    origins?: unknown;
  };
  if (!Array.isArray(state.cookies) || !Array.isArray(state.origins)) {
    throw new Error("The bootstrap Samsung session has an invalid shape.");
  }

  return state as NonNullable<BrowserContextOptions["storageState"]>;
};
