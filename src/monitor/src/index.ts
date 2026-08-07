import { loadConfig } from "./config.js";
import { runMonitor } from "./monitor.js";
import {
  flushTelemetry,
  trackException,
  trackEvent
} from "./telemetry.js";

const main = async (): Promise<void> => {
  trackEvent("tv_scan_started");
  await runMonitor(loadConfig());
};

main()
  .catch((error: unknown) => {
    const failure =
      error instanceof Error ? error : new Error("Unknown monitor failure");
    console.error(failure);
    trackException(failure);
    process.exitCode = 1;
  })
  .finally(flushTelemetry);
