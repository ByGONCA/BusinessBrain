import {
  StorageProvider,
  OrganizationFileRecord,
  FilePreviewInfo,
  ExternalFileMetadata,
  ExternalFileListResult,
} from "../types";

export interface ListFilesOptions {
  pageSize?: number;
  pageToken?: string;
  query?: string;
  folderId?: string;
}

export interface ProviderAccessCheck {
  isConnected: boolean;
  accountEmail?: string;
  error?: string;
}

/**
 * Common abstraction for file providers.
 * Enforces loose coupling: UI and core domain do not contain provider-specific SDK logic.
 */
export interface FileProvider {
  readonly providerId: StorageProvider;

  /**
   * Checks whether the active organization has an authenticated, valid connection to this provider.
   */
  checkAccess(organizationId: string): Promise<ProviderAccessCheck>;

  /**
   * Lists available files from the external provider without duplicating them.
   */
  listFiles?(organizationId: string, options?: ListFilesOptions): Promise<ExternalFileListResult>;

  /**
   * Fetches fresh metadata for an external file.
   */
  getFileMetadata(
    organizationId: string,
    externalFileId: string
  ): Promise<ExternalFileMetadata>;

  /**
   * Generates a safe preview reference (e.g. short-lived signed URL or secure embed link).
   */
  getPreview(
    organizationId: string,
    file: OrganizationFileRecord
  ): Promise<FilePreviewInfo>;

  /**
   * Resolves a download URL if authorized.
   */
  getDownloadUrl(
    organizationId: string,
    file: OrganizationFileRecord
  ): Promise<string | null>;

  /**
   * Gracefully handles disconnection of the provider.
   */
  disconnect?(organizationId: string): Promise<void>;
}
