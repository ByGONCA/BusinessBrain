"use client";

import * as React from "react";
import {
  X,
  Calendar,
  Clock,
  User,
  Hash,
  Copy,
  Check,
  FileText,
  Layers,
  Sparkles,
} from "lucide-react";
import { PageRecord } from "@/lib/pages/types";
import { formatRelativeTime, formatExactDateTime } from "@/lib/utils/time";

interface PageInfoModalProps {
  page: PageRecord;
  isOpen: boolean;
  onClose: () => void;
  connectionsCount?: number;
}

export function PageInfoModal({
  page,
  isOpen,
  onClose,
  connectionsCount = 0,
}: PageInfoModalProps) {
  const [copiedId, setCopiedId] = React.useState(false);

  if (!isOpen) return null;

  // Calculate statistics from page content
  const blockCount = Array.isArray(page.content) ? page.content.length : 0;
  const wordCount = page.content_text
    ? page.content_text.trim().split(/\s+/).filter(Boolean).length
    : 0;
  const charCount = page.content_text ? page.content_text.length : 0;

  const creatorName =
    page.created_by_profile?.full_name ||
    page.created_by_profile?.email ||
    (page.created_by ? "Team member" : "System");

  const editorName =
    page.last_edited_by_profile?.full_name ||
    page.last_edited_by_profile?.email ||
    (page.last_edited_by ? "Team member" : creatorName);

  const handleCopyId = async () => {
    try {
      await navigator.clipboard.writeText(page.id);
      setCopiedId(true);
      setTimeout(() => setCopiedId(false), 2000);
    } catch {
      // Fallback
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        className="w-full max-w-md rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150"
        role="dialog"
        aria-modal="true"
        aria-labelledby="page-info-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100 dark:border-zinc-800/80">
          <div className="flex items-center gap-2.5">
            <span className="text-xl">{page.icon || "📄"}</span>
            <div>
              <h2
                id="page-info-title"
                className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 truncate max-w-[240px]"
              >
                {page.title || "Untitled"}
              </h2>
              <p className="text-[11px] text-zinc-400 dark:text-zinc-500">Page Information</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">
          {/* Authorship Section */}
          <div className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
              Authorship & History
            </h3>
            <div className="rounded-xl border border-zinc-100 dark:border-zinc-800/60 bg-zinc-50/50 dark:bg-zinc-950/30 p-3.5 space-y-3">
              {/* Created By */}
              <div className="flex items-start justify-between text-xs">
                <div className="flex items-center gap-2 text-zinc-500 dark:text-zinc-400">
                  <User className="h-3.5 w-3.5 text-zinc-400" />
                  <span>Created by</span>
                </div>
                <div className="text-right">
                  <span className="font-medium text-zinc-900 dark:text-zinc-200">
                    {creatorName}
                  </span>
                  <div
                    className="text-[11px] text-zinc-400 dark:text-zinc-500 cursor-help"
                    title={formatExactDateTime(page.created_at)}
                  >
                    {formatRelativeTime(page.created_at)}
                  </div>
                </div>
              </div>

              {/* Last Edited By */}
              <div className="flex items-start justify-between text-xs pt-2 border-t border-zinc-100 dark:border-zinc-800/40">
                <div className="flex items-center gap-2 text-zinc-500 dark:text-zinc-400">
                  <Clock className="h-3.5 w-3.5 text-zinc-400" />
                  <span>Last edited by</span>
                </div>
                <div className="text-right">
                  <span className="font-medium text-zinc-900 dark:text-zinc-200">
                    {editorName}
                  </span>
                  <div
                    className="text-[11px] text-zinc-400 dark:text-zinc-500 cursor-help"
                    title={formatExactDateTime(page.updated_at)}
                  >
                    {formatRelativeTime(page.updated_at)}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Statistics Grid */}
          <div className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
              Content Statistics
            </h3>
            <div className="grid grid-cols-3 gap-2.5">
              <div className="p-3 rounded-xl border border-zinc-100 dark:border-zinc-800/60 bg-zinc-50/50 dark:bg-zinc-950/30 text-center">
                <div className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                  {wordCount.toLocaleString()}
                </div>
                <div className="text-[10px] text-zinc-400 dark:text-zinc-500 mt-0.5">Words</div>
              </div>

              <div className="p-3 rounded-xl border border-zinc-100 dark:border-zinc-800/60 bg-zinc-50/50 dark:bg-zinc-950/30 text-center">
                <div className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                  {blockCount}
                </div>
                <div className="text-[10px] text-zinc-400 dark:text-zinc-500 mt-0.5">Blocks</div>
              </div>

              <div className="p-3 rounded-xl border border-zinc-100 dark:border-zinc-800/60 bg-zinc-50/50 dark:bg-zinc-950/30 text-center">
                <div className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                  {connectionsCount}
                </div>
                <div className="text-[10px] text-zinc-400 dark:text-zinc-500 mt-0.5">Connections</div>
              </div>
            </div>
          </div>

          {/* Admin / Technical ID (Unobtrusive) */}
          <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800/80">
            <div className="flex items-center justify-between text-[11px] text-zinc-400 dark:text-zinc-500">
              <span className="flex items-center gap-1.5 font-mono">
                <Hash className="h-3 w-3" /> Page ID
              </span>
              <button
                type="button"
                onClick={handleCopyId}
                className="flex items-center gap-1 font-mono text-[11px] px-2 py-0.5 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                title="Copy technical ID"
              >
                {copiedId ? (
                  <>
                    <Check className="h-3 w-3 text-emerald-500" />
                    <span className="text-emerald-500 font-sans">Copied</span>
                  </>
                ) : (
                  <>
                    <span className="truncate max-w-[120px]">{page.id}</span>
                    <Copy className="h-3 w-3" />
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-zinc-50 dark:bg-zinc-900/60 border-t border-zinc-100 dark:border-zinc-800/80 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 rounded-lg text-xs font-medium bg-zinc-200 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 hover:bg-zinc-300 dark:hover:bg-zinc-700 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
