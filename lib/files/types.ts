// ==============================================================================
// Company Brain: File System & External File Integration Types
// ==============================================================================

export type StorageProvider =
  | "company_brain"
  | "google_drive"
  | "microsoft_onedrive"
  | "microsoft_sharepoint"
  | "dropbox"
  | "other_future_provider";

export type FileStatus =
  | "pending_upload"
  | "ready"
  | "unavailable"
  | "error"
  | "archived";

export interface OrganizationFileRecord {
  id: string;
  organization_id: string;
  uploaded_by: string | null;
  name: string;
  original_name: string;
  mime_type: string;
  size_bytes: number;
  storage_provider: StorageProvider;
  storage_path: string | null;
  external_file_id: string | null;
  external_parent_id: string | null;
  external_url: string | null;
  status: FileStatus;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface PageFileRecord {
  id: string;
  organization_id: string;
  page_id: string;
  file_id: string;
  position: number;
  created_by: string | null;
  created_at: string;
  file?: OrganizationFileRecord;
}

export interface FilePreviewInfo {
  previewType: "image" | "pdf" | "video" | "audio" | "office" | "generic";
  previewUrl: string | null;
  thumbnailUrl?: string | null;
  isExternal: boolean;
  canEmbed: boolean;
  provider: StorageProvider;
  status: FileStatus;
}

export interface StorageUsageInfo {
  usedBytes: number;
  limitBytes: number;
  remainingBytes: number;
  usagePercentage: number;
  isQuotaExceeded: boolean;
  plan: string;
}

export interface UploadAuthorizationRequest {
  filename: string;
  mimeType: string;
  sizeBytes: number;
  pageId?: string;
}

export interface UploadAuthorizationResponse {
  fileId: string;
  signedUploadUrl: string;
  storagePath: string;
  token?: string;
}

export interface ExternalFileMetadata {
  id: string;
  name: string;
  mimeType: string;
  sizeBytes?: number;
  iconLink?: string;
  thumbnailLink?: string;
  webViewLink?: string;
  webContentLink?: string;
  modifiedTime?: string;
}

export interface ExternalFileListResult {
  files: ExternalFileMetadata[];
  nextPageToken?: string;
}
