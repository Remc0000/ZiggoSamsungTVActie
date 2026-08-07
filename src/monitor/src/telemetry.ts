import appInsights from "applicationinsights";

const connectionString = process.env.APPLICATIONINSIGHTS_CONNECTION_STRING;

if (connectionString) {
  appInsights
    .setup(connectionString)
    .setAutoCollectConsole(true, true)
    .setAutoCollectExceptions(true)
    .start();
}

export const trackEvent = (
  name: string,
  properties: Record<string, string> = {}
): void => {
  appInsights.defaultClient?.trackEvent({ name, properties });
};

export const trackException = (error: Error): void => {
  appInsights.defaultClient?.trackException({ exception: error });
};

export const flushTelemetry = async (): Promise<void> => {
  await appInsights.defaultClient?.flush();
};
