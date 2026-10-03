"use client";

import * as React from "react";
import { X, Download, ExternalLink, FileText, ZoomIn, ZoomOut, Maximize2 } from "lucide-react";

interface PdfViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  pdfUrl: string;
  title: string;
  downloadUrl?: string | null;
}

export function PdfViewerModal({
  isOpen,
  onClose,
  pdfUrl,
  title,
  downloadUrl,
}: PdfViewerModalProps) {
  const [zoomLevel, setZoomLevel] = React.useState(100);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="relative w-full max-w-5xl h-[90vh] rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 px-6 py-3.5 bg-zinc-50 dark:bg-zinc-900/50">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="h-7 w-7 rounded-lg bg-rose-500/10 text-rose-500 flex items-center justify-center shrink-0">
              <FileText className="h-4 w-4" />
            </div>
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 truncate">
              {title}
            </h2>
          </div>

          <div className="flex items-center gap-2">
            {downloadUrl && (
              <a
                href={downloadUrl}
                download={title}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              >
                <Download className="h-3.5 w-3.5" /> Download
              </a>
            )}
            <a
              href={pdfUrl}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            >
              <ExternalLink className="h-3.5 w-3.5" /> Open
            </a>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors ml-1"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* PDF Frame */}
        <div className="flex-1 bg-zinc-100 dark:bg-zinc-900 overflow-hidden relative">
          <iframe
            src={`${pdfUrl}#toolbar=1&navpanes=1`}
            title={title}
            className="w-full h-full border-0"
          />
        </div>
      </div>
    </div>
  );
}
