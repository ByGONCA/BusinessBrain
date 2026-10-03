"use client";

import * as React from "react";
import {
  Upload,
  Cloud,
  FolderOpen,
  FileText,
  Image as ImageIcon,
  Film,
  Music,
  FileSpreadsheet,
  FileCode,
  X,
  Loader2,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Search,
  HardDrive,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  requestUploadAuthorizationAction,
  confirmFileUploadAction,
  linkExternalFileAction,
  listExternalFilesAction,
} from "@/lib/files/actions";
import { getOrganizationStorageQuota } from "@/lib/files/quotas";
import {
  OrganizationFileRecord,
  StorageProvider,
  ExternalFileMetadata,
  StorageUsageInfo,
} from "@/lib/files/types";

interface FilePickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  pageId: string;
  blockId?: string;
  allowedTypes?: "all" | "image" | "video" | "audio" | "pdf" | "document";
  onFileSelected: (file: OrganizationFileRecord) => void;
}

type TabType = "upload" | "google_drive" | "library";

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function getFileIcon(mime: string) {
  if (mime.startsWith("image/")) return <ImageIcon className="h-4 w-4 text-emerald-500" />;
  if (mime.startsWith("video/")) return <Film className="h-4 w-4 text-purple-500" />;
  if (mime.startsWith("audio/")) return <Music className="h-4 w-4 text-amber-500" />;
  if (mime === "application/pdf") return <FileText className="h-4 w-4 text-rose-500" />;
  if (mime.includes("sheet") || mime.includes("excel")) return <FileSpreadsheet className="h-4 w-4 text-teal-500" />;
  return <FileCode className="h-4 w-4 text-blue-500" />;
}

export function FilePickerModal({
  isOpen,
  onClose,
  pageId,
  allowedTypes = "all",
  onFileSelected,
}: FilePickerModalProps) {
  const [activeTab, setActiveTab] = React.useState<TabType>("upload");
  const [isUploading, setIsUploading] = React.useState(false);
  const [uploadProgress, setUploadProgress] = React.useState<number | null>(null);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);

  // Storage Quota state
  const [quota, setQuota] = React.useState<StorageUsageInfo | null>(null);

  // Google Drive state
  const [driveFiles, setDriveFiles] = React.useState<ExternalFileMetadata[]>([]);
  const [isLoadingDrive, setIsLoadingDrive] = React.useState(false);
  const [driveConnected, setDriveConnected] = React.useState<boolean>(true);
  const [driveSearch, setDriveSearch] = React.useState("");

  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  // Load Google Drive files when tab is activated
  React.useEffect(() => {
    if (isOpen && activeTab === "google_drive") {
      loadGoogleDriveFiles();
    }
  }, [isOpen, activeTab]);

  const loadGoogleDriveFiles = async (query = "") => {
    setIsLoadingDrive(true);
    setErrorMsg(null);
    try {
      const res = await listExternalFilesAction("google_drive", { query });
      setDriveFiles(res.files);
      setDriveConnected(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("not found") || msg.includes("not connected") || msg.includes("re-authenticate")) {
        setDriveConnected(false);
      } else {
        setErrorMsg(msg);
      }
    } finally {
      setIsLoadingDrive(false);
    }
  };

  const handleFileUpload = async (file: File) => {
    setErrorMsg(null);
    setIsUploading(true);
    setUploadProgress(10);

    try {
      // 1. Request signed upload authorization from server
      const auth = await requestUploadAuthorizationAction({
        filename: file.name,
        mimeType: file.type || "application/octet-stream",
        sizeBytes: file.size,
        pageId,
      });

      setUploadProgress(40);

      // 2. Direct upload to Supabase Storage via signed upload URL
      const uploadRes = await fetch(auth.signedUploadUrl, {
        method: "PUT",
        headers: {
          "Content-Type": file.type || "application/octet-stream",
        },
        body: file,
      });

      if (!uploadRes.ok) {
        throw new Error("Failed to upload file to storage. Please try again.");
      }

      setUploadProgress(85);

      // 3. Confirm upload on server
      const confirmed = await confirmFileUploadAction(auth.fileId, pageId);

      setUploadProgress(100);
      onFileSelected(confirmed);
      onClose();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setIsUploading(false);
      setUploadProgress(null);
    }
  };

  const handleSelectExternalFile = async (externalFile: ExternalFileMetadata) => {
    setErrorMsg(null);
    setIsUploading(true);

    try {
      const linked = await linkExternalFileAction({
        provider: "google_drive",
        externalFileId: externalFile.id,
        pageId,
      });

      onFileSelected(linked);
      onClose();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to link external file.");
    } finally {
      setIsUploading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="relative w-full max-w-xl rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 px-6 py-4">
          <div className="flex items-center gap-2">
            <FolderOpen className="h-5 w-5 text-indigo-500" />
            <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
              Attach File to Page
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-zinc-200 dark:border-zinc-800 px-6 bg-zinc-50/50 dark:bg-zinc-900/30">
          <button
            type="button"
            onClick={() => setActiveTab("upload")}
            className={cn(
              "flex items-center gap-2 px-4 py-3 text-xs font-medium border-b-2 transition-colors",
              activeTab === "upload"
                ? "border-indigo-600 text-indigo-600 dark:text-indigo-400"
                : "border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
            )}
          >
            <Upload className="h-3.5 w-3.5" /> Upload File
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("google_drive")}
            className={cn(
              "flex items-center gap-2 px-4 py-3 text-xs font-medium border-b-2 transition-colors",
              activeTab === "google_drive"
                ? "border-indigo-600 text-indigo-600 dark:text-indigo-400"
                : "border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
            )}
          >
            <Cloud className="h-3.5 w-3.5" /> Google Drive
          </button>
        </div>

        {/* Error message */}
        {errorMsg && (
          <div className="mx-6 mt-4 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-xs text-rose-700 dark:text-rose-400 flex items-start gap-2.5">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Tab Content */}
        <div className="p-6 flex-1 overflow-y-auto">
          {activeTab === "upload" && (
            <div className="space-y-4">
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFileUpload(file);
                }}
              />

              {/* Drag & drop dropzone */}
              <div
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const file = e.dataTransfer.files?.[0];
                  if (file) handleFileUpload(file);
                }}
                className={cn(
                  "border-2 border-dashed rounded-2xl p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-all",
                  "border-zinc-300 dark:border-zinc-700 hover:border-indigo-500 dark:hover:border-indigo-500 bg-zinc-50/50 dark:bg-zinc-900/30",
                  isUploading && "pointer-events-none opacity-50"
                )}
              >
                <div className="h-12 w-12 rounded-full bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mb-3">
                  <Upload className="h-6 w-6" />
                </div>
                <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                  Click to select or drag and drop
                </h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 max-w-xs">
                  PDF, Images, Word, Excel, PowerPoint or CSV documents up to 50 MB
                </p>
                <button
                  type="button"
                  className="mt-4 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium transition-colors"
                >
                  Browse Files
                </button>
              </div>

              {/* Upload Progress Bar */}
              {isUploading && uploadProgress !== null && (
                <div className="space-y-1.5 p-3 rounded-xl bg-zinc-100 dark:bg-zinc-900">
                  <div className="flex justify-between text-xs text-zinc-600 dark:text-zinc-400">
                    <span className="flex items-center gap-1.5 font-medium">
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-indigo-500" />
                      Uploading to Company Brain...
                    </span>
                    <span>{uploadProgress}%</span>
                  </div>
                  <div className="w-full h-1.5 bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-indigo-600 transition-all duration-200"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between text-[11px] text-zinc-400 px-1 pt-2">
                <span className="flex items-center gap-1">
                  <HardDrive className="h-3 w-3" /> Encrypted private object storage
                </span>
                <span>Direct secure upload</span>
              </div>
            </div>
          )}

          {activeTab === "google_drive" && (
            <div className="space-y-4">
              {!driveConnected ? (
                <div className="p-8 text-center border rounded-2xl border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/30">
                  <div className="h-12 w-12 rounded-full bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 flex items-center justify-center mx-auto mb-3">
                    <Cloud className="h-6 w-6" />
                  </div>
                  <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                    Connect Google Drive
                  </h3>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 max-w-sm mx-auto">
                    Connect your workspace Google Drive to reference files directly on Pages without duplicating storage.
                  </p>
                  <a
                    href="/api/integrations/google/connect?service=google_drive"
                    className="inline-flex items-center gap-2 mt-4 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium transition-colors"
                  >
                    Connect Google Drive
                  </a>
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Search box */}
                  <div className="relative">
                    <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-zinc-400" />
                    <input
                      type="text"
                      placeholder="Search Google Drive files..."
                      value={driveSearch}
                      onChange={(e) => {
                        setDriveSearch(e.target.value);
                        loadGoogleDriveFiles(e.target.value);
                      }}
                      className="w-full pl-9 pr-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-xs text-zinc-800 dark:text-zinc-200 outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>

                  {isLoadingDrive ? (
                    <div className="py-12 flex flex-col items-center justify-center gap-2 text-zinc-400">
                      <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
                      <span className="text-xs">Fetching Google Drive files...</span>
                    </div>
                  ) : driveFiles.length === 0 ? (
                    <div className="py-12 text-center text-xs text-zinc-500">
                      No files found in Google Drive.
                    </div>
                  ) : (
                    <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
                      {driveFiles.map((file) => (
                        <div
                          key={file.id}
                          onClick={() => handleSelectExternalFile(file)}
                          className="flex items-center justify-between p-2.5 rounded-xl border border-zinc-100 dark:border-zinc-800/80 hover:border-blue-500/40 hover:bg-blue-50/30 dark:hover:bg-blue-950/20 cursor-pointer transition-colors"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            {getFileIcon(file.mimeType)}
                            <div className="min-w-0">
                              <p className="text-xs font-medium text-zinc-800 dark:text-zinc-200 truncate">
                                {file.name}
                              </p>
                              <p className="text-[10px] text-zinc-400">
                                {file.sizeBytes ? formatBytes(file.sizeBytes) : "Google Drive Document"}
                              </p>
                            </div>
                          </div>
                          <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400 shrink-0">
                            Reference
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  <p className="text-[11px] text-zinc-400 pt-1">
                    * External files remain in Google Drive and consume 0 Company Brain storage quota.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
