import { readFile } from "node:fs/promises";
import {
  DefaultAzureCredential,
  ManagedIdentityCredential,
  type TokenCredential
} from "@azure/identity";
import {
  BlobServiceClient,
  type BlockBlobClient,
  type ContainerClient
} from "@azure/storage-blob";
import type { BrowserContextOptions } from "playwright";
import type { MonitorState } from "./types.js";

const sessionBlobName = "session/storage-state.json";
const stateBlobName = "state/notified-products.json";

const credentialFor = (clientId?: string): TokenCredential =>
  clientId
    ? new ManagedIdentityCredential({ clientId })
    : new DefaultAzureCredential();

export class MonitorStorage {
  private readonly container: ContainerClient;

  public constructor(
    accountName: string,
    containerName: string,
    managedIdentityClientId?: string
  ) {
    const service = new BlobServiceClient(
      `https://${accountName}.blob.core.windows.net`,
      credentialFor(managedIdentityClientId)
    );
    this.container = service.getContainerClient(containerName);
  }

  private blob(name: string): BlockBlobClient {
    return this.container.getBlockBlobClient(name);
  }

  public async hasSession(): Promise<boolean> {
    return this.blob(sessionBlobName).exists();
  }

  public async loadSession(): Promise<
    NonNullable<BrowserContextOptions["storageState"]>
  > {
    const blob = this.blob(sessionBlobName);
    if (!(await blob.exists())) {
      throw new Error(
        "Samsung browser session is missing. Run the local login and upload-session commands."
      );
    }

    const response = await blob.downloadToBuffer();
    return JSON.parse(response.toString("utf8")) as NonNullable<
      BrowserContextOptions["storageState"]
    >;
  }

  public async saveSession(
    state: BrowserContextOptions["storageState"]
  ): Promise<void> {
    await this.blob(sessionBlobName).upload(
      JSON.stringify(state),
      Buffer.byteLength(JSON.stringify(state)),
      { blobHTTPHeaders: { blobContentType: "application/json" } }
    );
  }

  public async uploadSessionFile(path: string): Promise<void> {
    const content = await readFile(path);
    JSON.parse(content.toString("utf8"));
    await this.blob(sessionBlobName).uploadData(content, {
      blobHTTPHeaders: { blobContentType: "application/json" }
    });
  }

  public async loadState(): Promise<MonitorState> {
    const blob = this.blob(stateBlobName);
    if (!(await blob.exists())) {
      return { notifiedProductIds: [], updatedAt: new Date(0).toISOString() };
    }

    const response = await blob.downloadToBuffer();
    return JSON.parse(response.toString("utf8")) as MonitorState;
  }

  public async saveState(state: MonitorState): Promise<void> {
    const content = JSON.stringify(state);
    await this.blob(stateBlobName).upload(content, Buffer.byteLength(content), {
      blobHTTPHeaders: { blobContentType: "application/json" }
    });
  }
}
