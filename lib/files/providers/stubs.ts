import { FileProvider, ProviderAccessCheck } from "./base";
import {
  StorageProvider,
  OrganizationFileRecord,
  FilePreviewInfo,
  ExternalFileMetadata,
} from "../types";

export class ProviderNotImplementedError extends Error {
  constructor(providerName: string) {
    super(`${providerName} integration is planned and will be available in a future release.`);
    this.name = "ProviderNotImplementedError";
  }
}

abstract class AbstractStubStorageProvider implements FileProvider {
  abstract readonly providerId: StorageProvider;
  abstract readonly providerName: string;

  async checkAccess(_organizationId: string): Promise<ProviderAccessCheck> {
    return {
      isConnected: false,
      error: `${this.providerName} is not currently configured for this organization.`,
    };
  }

  async getFileMetadata(
    _organizationId: string,
    _externalFileId: string
  ): Promise<ExternalFileMetadata> {
    throw new ProviderNotImplementedError(this.providerName);
  }

  async getPreview(
    _organizationId: string,
    file: OrganizationFileRecord
  ): Promise<FilePreviewInfo> {
    return {
      previewType: "generic",
      previewUrl: file.external_url || null,
      isExternal: true,
      canEmbed: false,
      provider: this.providerId,
      status: "unavailable",
    };
  }

  async getDownloadUrl(
    _organizationId: string,
    file: OrganizationFileRecord
  ): Promise<string | null> {
    return file.external_url || null;
  }
}

export class OneDriveStorageProvider extends AbstractStubStorageProvider {
  readonly providerId: StorageProvider = "microsoft_onedrive";
  readonly providerName = "Microsoft OneDrive";
}

export class SharePointStorageProvider extends AbstractStubStorageProvider {
  readonly providerId: StorageProvider = "microsoft_sharepoint";
  readonly providerName = "Microsoft SharePoint";
}

export class DropboxStorageProvider extends AbstractStubStorageProvider {
  readonly providerId: StorageProvider = "dropbox";
  readonly providerName = "Dropbox";
}
