"use client";

import * as React from "react";
import {
  FileText,
  Image as ImageIcon,
  Film,
  Music,
  FileSpreadsheet,
  FileCode,
  Download,
  Trash2,
  ExternalLink,
  Cloud,
  HardDrive,
  AlertTriangle,
  Plus,
  Loader2,
} from "lucide-react";
import { PageFileRecord } from "@/lib/files/types";
import { detachFileFromPageAction, getFilePreviewAction } from "@/lib/files/actions";
import { PdfViewerModal } from "./pdf-viewer-modal";

interface PageAttachmentsPanelProps {
  pageId: string;
  files: PageFileRecord[];
  onAddClick: () => void;
  onRefresh?: () => void;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function getProviderBadge(provider: string) {
  if (provider === "google_drive") {
    return (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400">
        <Cloud className="h-2.5 w-2.5" /> Google Drive
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
      <HardDrive className="h-2.5 w-2.5" /> Company Brain
    </span>
  );
}

function getFileIcon(mime: string) {
  if (mime.startsWith("image/")) return <ImageIcon className="h-4 w-4 text-emerald-500" />;
  if (mime.startsWith("video/")) return <Film className="h-4 w-4 text-purple-500" />;
  if (mime.startsWith("audio/")) return <Music className="h-4 w-4 text-amber-500" />;
  if (mime === "application/pdf") return <FileText className="h-4 w-4 text-rose-500" />;
  if (mime.includes("sheet") || mime.includes("excel")) return <FileSpreadsheet className="h-4 w-4 text-teal-500" />;
  return <FileCode className="h-4 w-4 text-blue-500" />;
}

export function PageAttachmentsPanel({
  pageId,
  files,
  onAddClick,
  onRefresh,
}: PageAttachmentsPanelProps) {
  const [detachingId, setDetachingId] = React.useState<string | null>(null);
  const [activePdfUrl, setActivePdfUrl] = React.useState<{ url: string; title: string } | null>(null);

  const handleDetach = async (fileId: string) => {
    setDetachingId(fileId);
    try {
      await detachFileFromPageAction(pageId, fileId);
      onRefresh?.();
    } catch (err) {
      console.error("Error detaching file:", err);
    } finally {
      setDetachingId(null);
    }
  };

  const handlePreview = async (fileRecord: PageFileRecord) => {
    if (!fileRecord.file) return;

    if (fileRecord.file.mime_type === "application/pdf") {
      try {
        const preview = await getFilePreviewAction(fileRecord.file.id);
        if (preview.previewUrl) {
          setActivePdfUrl({ url: preview.previewUrl, title: fileRecord.file.name });
          return;
        }
      } catch (err) {
        console.error("Failed to load PDF preview:", err);
      }
    }

    if (fileRecord.file.external_url) {
      window.open(fileRecord.file.external_url, "_blank");
    }
  };

  if (files.length === 0) return null;

  return (
    <div className="my-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/20 p-4">
      <div className="flex items-center justify-between pb-3 border-b border-zinc-200/60 dark:border-zinc-800/60">
        <h3 className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 uppercase tracking-wider flex items-center gap-1.5">
          <FileText className="h-3.5 w-3.5 text-indigo-500" /> Page Attachments ({files.length})
        </h3>
        <button
          type="button"
          onClick={onAddClick}
          className="flex items-center gap-1 text-[11px] font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
        >
          <Plus className="h-3 w-3" /> Attach File
        </button>
      </div>

      <div className="divide-y divide-zinc-200/50 dark:divide-zinc-800/50 pt-1">
        {files.map((pf) => {
          const file = pf.file;
          if (!file) return null;
          const isUnavailable = file.status === "unavailable";

          return (
            <div
              key={pf.id}
              className="py-2.5 flex items-center justify-between gap-3 text-xs"
            >
              <div
                onClick={() => !isUnavailable && handlePreview(pf)}
                className="flex items-center gap-2.5 min-w-0 flex-1 cursor-pointer group"
              >
                {getFileIcon(file.mime_type)}
                <div className="min-w-0">
                  <p className="font-medium text-zinc-800 dark:text-zinc-200 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 truncate transition-colors">
                    {file.name}
                  </p>
                  <div className="flex items-center gap-2 text-[10px] text-zinc-400 mt-0.5">
                    <span>{formatBytes(file.size_bytes)}</span>
                    <span>•</span>
                    {getProviderBadge(file.storage_provider)}
                    {isUnavailable && (
                      <span className="inline-flex items-center gap-0.5 text-amber-600 dark:text-amber-400 font-medium">
                        <AlertTriangle className="h-2.5 w-2.5" /> Reconnect Drive to access
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1">
                {file.external_url && !isUnavailable && (
                  <a
                    href={file.external_url}
                    target="_blank"
                    rel="noreferrer"
                    title="Open external source"
                    className="p-1 rounded text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                )}
                <button
                  type="button"
                  onClick={() => handleDetach(file.id)}
                  disabled={detachingId === file.id}
                  title="Remove from page"
                  className="p-1 rounded text-zinc-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                >
                  {detachingId === file.id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="h-3.5 w-3.5" />
                  )}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {activePdfUrl && (
        <PdfViewerModal
          isOpen={true}
          onClose={() => setActivePdfUrl(null)}
          pdfUrl={activePdfUrl.url}
          title={activePdfUrl.title}
          downloadUrl={activePdfUrl.url}
        />
      )}
    </div>
  );
}
