import { chromium } from "playwright";
import { decodeBootstrapSession } from "./bootstrap.js";
import { createEmailPayload, sendEmailNotification } from "./email.js";
import {
  createSamsungProductCollector,
  extractDomProducts,
  selectEligibleProducts
} from "./extractProducts.js";
import type { MonitorConfig } from "./config.js";
import { MonitorStorage } from "./storage.js";
import { trackEvent } from "./telemetry.js";

export const runMonitor = async (config: MonitorConfig): Promise<void> => {
  const storage = new MonitorStorage(
    config.storageAccountName,
    config.storageContainerName,
    config.managedIdentityClientId
  );
  let session: Awaited<ReturnType<MonitorStorage["loadSession"]>>;
  if (await storage.hasSession()) {
    session = await storage.loadSession();
  } else {
    const bootstrapSession = process.env.BOOTSTRAP_SESSION_GZIP_BASE64;
    if (!bootstrapSession) {
      throw new Error(
        "Samsung browser session is missing and no bootstrap session was supplied."
      );
    }
    session = decodeBootstrapSession(bootstrapSession);
    await storage.saveSession(session);
    console.log(JSON.stringify({ event: "session_bootstrapped" }));
  }
  const browser = await chromium.launch({ headless: true });

  try {
    const context = await browser.newContext({
      storageState: session,
      locale: "nl-NL"
    });
    const page = await context.newPage();
    const productCollector = createSamsungProductCollector(page);
    page.setDefaultTimeout(config.navigationTimeoutMs);

    try {
      await page.goto(config.targetUrl, {
        waitUntil: "domcontentloaded",
        timeout: config.navigationTimeoutMs
      });
      await page.waitForTimeout(10000);

      const currentUrl = page.url();
      const passwordFieldVisible = await page
        .locator('input[type="password"]')
        .first()
        .isVisible()
        .catch(() => false);
      if (/\/(login|signin)\b/i.test(currentUrl) || passwordFieldVisible) {
        throw new Error(
          "Samsung session appears to be expired; repeat the interactive login setup."
        );
      }

      const selection = selectEligibleProducts(
        [
          ...productCollector.products(),
          ...(await extractDomProducts(page, config.targetSizeInches))
        ],
        config.excludedTerms,
        config.targetSizeInches
      );
      const state = await storage.loadState();
      const notified = new Set(state.notifiedProductIds);
      const newProducts = selection.eligibleProducts.filter(
        (product) => !notified.has(product.id)
      );

      console.log(
        JSON.stringify({
          event: "scan_complete",
          allAvailableTvs: selection.allProducts.length,
          targetSizeInches: config.targetSizeInches,
          availableTargetSizeTvs: selection.targetSizeProducts.length,
          eligibleTargetSizeTvs: selection.eligibleProducts.length,
          newProducts: newProducts.length,
          products: selection.allProducts.map((product) => ({
            name: product.name,
            model: product.model,
            price: product.price,
            url: product.url,
            isTargetSize: selection.targetSizeProducts.some(
              (candidate) => candidate.id === product.id
            ),
            eligible: selection.eligibleProducts.some(
              (candidate) => candidate.id === product.id
            )
          }))
        })
      );

      for (const product of newProducts) {
        const payload = createEmailPayload(
          product,
          config.emailRecipient,
          config.emailSubject,
          config.emailBodyPrefix
        );
        await sendEmailNotification(config.logicAppCallbackUrl, payload);
        notified.add(product.id);
        await storage.saveState({
          notifiedProductIds: [...notified].sort(),
          updatedAt: new Date().toISOString()
        });
        trackEvent("tv_notification_sent", {
          productId: product.id,
          productName: product.name
        });
      }

      await storage.saveSession(await context.storageState());
      trackEvent("tv_scan_completed", {
        allAvailableTvs: String(selection.allProducts.length),
        targetSizeInches: String(config.targetSizeInches),
        availableTargetSizeTvs: String(selection.targetSizeProducts.length),
        eligibleTargetSizeTvs: String(selection.eligibleProducts.length),
        newProducts: String(newProducts.length)
      });
    } finally {
      productCollector.dispose();
    }
  } finally {
    await browser.close();
  }
};
