const required = (name: string): string => {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
};

const integer = (name: string, fallback: number): number => {
  const raw = process.env[name];
  if (!raw) {
    return fallback;
  }

  const parsed = Number.parseInt(raw, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }
  return parsed;
};

export interface MonitorConfig {
  targetUrl: string;
  storageAccountName: string;
  storageContainerName: string;
  managedIdentityClientId?: string;
  logicAppCallbackUrl: string;
  emailRecipient: string;
  emailSubject: string;
  emailBodyPrefix: string;
  excludedTerms: string[];
  targetSizeInches: number;
  navigationTimeoutMs: number;
}

export const loadConfig = (): MonitorConfig => {
  const managedIdentityClientId = process.env.AZURE_CLIENT_ID?.trim();

  return {
    targetUrl:
      process.env.SAMSUNG_TARGET_URL?.trim() ??
      "https://www.samsung.com/nl/multistore/nld/",
    storageAccountName: required("AZURE_STORAGE_ACCOUNT"),
    storageContainerName: process.env.AZURE_STORAGE_CONTAINER?.trim() ?? "monitor",
    ...(managedIdentityClientId ? { managedIdentityClientId } : {}),
    logicAppCallbackUrl: required("LOGIC_APP_CALLBACK_URL"),
    emailRecipient: required("EMAIL_RECIPIENT"),
    emailSubject:
      process.env.EMAIL_SUBJECT?.trim() ?? "Samsung TV beschikbaar",
    emailBodyPrefix:
      process.env.EMAIL_BODY_PREFIX?.trim() ??
      "Ga naar de Samsung Multistore om je TV uit te zoeken. Ik heb deze gevonden:",
    excludedTerms: (process.env.EXCLUDED_PRODUCT_TERMS ?? "")
      .split(",")
      .map((term) => term.trim())
      .filter(Boolean),
    targetSizeInches: integer("TV_SIZE_INCHES", 55),
    navigationTimeoutMs: integer("NAVIGATION_TIMEOUT_MS", 90000)
  };
};
