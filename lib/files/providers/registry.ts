import { StorageProvider } from "../types";
import { FileProvider } from "./base";
import { CompanyBrainStorageProvider } from "./company-brain";
import { GoogleDriveStorageProvider } from "./google-drive";
import {
  OneDriveStorageProvider,
  SharePointStorageProvider,
  DropboxStorageProvider,
} from "./stubs";

const companyBrainProvider = new CompanyBrainStorageProvider();
const googleDriveProvider = new GoogleDriveStorageProvider();
const oneDriveProvider = new OneDriveStorageProvider();
const sharePointProvider = new SharePointStorageProvider();
const dropboxProvider = new DropboxStorageProvider();

const PROVIDER_REGISTRY: Record<StorageProvider, FileProvider> = {
  company_brain: companyBrainProvider,
  google_drive: googleDriveProvider,
  microsoft_onedrive: oneDriveProvider,
  microsoft_sharepoint: sharePointProvider,
  dropbox: dropboxProvider,
  other_future_provider: dropboxProvider,
};

/**
 * Resolves the concrete FileProvider for a given storage provider.
 */
export function getFileProvider(provider: StorageProvider): FileProvider {
  const resolved = PROVIDER_REGISTRY[provider];
  if (!resolved) {
    throw new Error(`Unsupported storage provider: ${provider}`);
  }
  return resolved;
}
