import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { spawn } from "node:child_process";
import { resolve } from "node:path";
import { chromium } from "playwright";

const targetUrl =
  process.env.SAMSUNG_TARGET_URL ??
  "https://www.samsung.com/nl/multistore/nld/";
const sessionPath =
  process.env.SAMSUNG_SESSION_PATH ?? ".local/storage-state.json";
const profilePath = ".local/samsung-profile";

const findEdge = (): string => {
  const candidates = [
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe"
  ];
  const edgePath = candidates.find(existsSync);
  if (!edgePath) {
    throw new Error("Microsoft Edge is not installed.");
  }
  return edgePath;
};

const runInteractiveEdge = async (): Promise<void> =>
  new Promise((resolveProcess, reject) => {
    const process = spawn(
      findEdge(),
      [
        `--user-data-dir=${resolve(profilePath)}`,
        "--no-first-run",
        "--no-default-browser-check",
        "--disable-background-mode",
        "--disable-features=msEdgeStartupBoost",
        targetUrl
      ],
      { stdio: "ignore" }
    );

    process.once("error", reject);
    process.once("exit", (code) => {
      if (code !== 0) {
        reject(new Error(`Microsoft Edge exited with code ${code ?? "unknown"}`));
        return;
      }
      resolveProcess();
    });
  });

const main = async (): Promise<void> => {
  await mkdir(profilePath, { recursive: true });
  console.log(
    "Log in to Samsung, confirm the TV catalogue is visible, then close the browser window."
  );
  await runInteractiveEdge();
  await new Promise((resolveWait) => setTimeout(resolveWait, 2000));

  const exportContext = await chromium.launchPersistentContext(profilePath, {
    channel: "msedge",
    headless: true,
    locale: "nl-NL"
  });
  await exportContext.storageState({ path: sessionPath });
  await exportContext.close();
  console.log(`Samsung browser session saved to ${sessionPath}`);
};

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
