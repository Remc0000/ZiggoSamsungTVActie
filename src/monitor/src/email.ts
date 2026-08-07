import type { EmailPayload, TvProduct } from "./types.js";

const wait = async (milliseconds: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

export const createEmailPayload = (
  product: TvProduct,
  recipient: string,
  subject: string,
  bodyPrefix: string
): EmailPayload => ({
  to: recipient,
  subject,
  message: `${bodyPrefix}\n\n${product.description}`,
  product
});

export const sendEmailNotification = async (
  callbackUrl: string,
  payload: EmailPayload
): Promise<void> => {
  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(callbackUrl, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(30000)
      });

      if (response.ok) {
        return;
      }

      const responseText = await response.text();
      lastError = new Error(
        `Logic App returned ${response.status}: ${responseText.slice(0, 500)}`
      );
    } catch (error) {
      lastError =
        error instanceof Error ? error : new Error("Unknown email request error");
    }

    if (attempt < 3) {
      await wait(1000 * 2 ** (attempt - 1));
    }
  }

  throw lastError ?? new Error("Email notification failed");
};
