import { MonitorStorage } from "./storage.js";

const sessionPath =
  process.env.SAMSUNG_SESSION_PATH ?? ".local/storage-state.json";

const main = async (): Promise<void> => {
  const accountName = process.env.AZURE_STORAGE_ACCOUNT?.trim();
  if (!accountName) {
    throw new Error("Missing required environment variable: AZURE_STORAGE_ACCOUNT");
  }

  const storage = new MonitorStorage(
    accountName,
    process.env.AZURE_STORAGE_CONTAINER?.trim() ?? "monitor"
  );
  await storage.uploadSessionFile(sessionPath);
  console.log("Samsung browser session uploaded securely to Blob Storage.");
};

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
