"use client";

import * as React from "react";
import { Trash2, RotateCcw, X, AlertTriangle } from "lucide-react";
import { PageRecord } from "@/lib/pages/types";
import { restorePageAction, deletePagePermanentlyAction, getArchivedPagesAction } from "@/lib/pages/actions";
import { PageIcon } from "./page-icon";
import { cn } from "@/lib/utils";

interface TrashModalProps {
  isOpen: boolean;
  onClose: () => void;
  archivedPages?: PageRecord[];
  onPageRestored: (pageId: string) => void;
  onPageDeleted: (pageId: string) => void;
}

export function TrashModal({
  isOpen,
  onClose,
  archivedPages,
  onPageRestored,
  onPageDeleted,
}: TrashModalProps) {
  const [loadingId, setLoadingId] = React.useState<string | null>(null);
  const [items, setItems] = React.useState<PageRecord[]>(archivedPages || []);
  const [isFetching, setIsFetching] = React.useState(false);

  React.useEffect(() => {
    if (archivedPages) {
      setItems(archivedPages);
    }
  }, [archivedPages]);

  React.useEffect(() => {
    if (isOpen && (!archivedPages || archivedPages.length === 0)) {
      setIsFetching(true);
      getArchivedPagesAction().then((res) => {
        setIsFetching(false);
        if (res.success && res.pages) {
          setItems(res.pages);
        }
      });
    }
  }, [isOpen, archivedPages]);

  if (!isOpen) return null;

  const handleRestore = async (id: string) => {
    setLoadingId(id);
    const res = await restorePageAction({ pageId: id });
    setLoadingId(null);
    if (res.success) {
      setItems((prev) => prev.filter((p) => p.id !== id));
      onPageRestored(id);
    }
  };

  const handleDeletePermanently = async (id: string) => {
    if (!window.confirm("Are you sure you want to permanently delete this page? This cannot be undone.")) {
      return;
    }
    setLoadingId(id);
    const res = await deletePagePermanentlyAction({ pageId: id });
    setLoadingId(null);
    if (res.success) {
      setItems((prev) => prev.filter((p) => p.id !== id));
      onPageDeleted(id);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="w-full max-w-lg rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-100 dark:border-zinc-800">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-100 dark:bg-red-950/40 text-red-600 dark:text-red-400">
              <Trash2 className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Trash / Archived Pages</h2>
              <p className="text-xs text-zinc-400">Pages deleted from the workspace can be restored or removed permanently.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Page List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2 no-scrollbar">
          {isFetching ? (
            <div className="py-12 text-center text-xs text-zinc-400">
              Loading trash items...
            </div>
          ) : items.length === 0 ? (
            <div className="py-12 text-center text-xs text-zinc-400">
              Trash is empty. No archived pages found.
            </div>
          ) : (
            items.map((page) => (
              <div
                key={page.id}
                className="flex items-center justify-between p-2.5 rounded-xl border border-zinc-100 dark:border-zinc-800/80 bg-zinc-50/50 dark:bg-zinc-800/30 hover:bg-zinc-100/50 dark:hover:bg-zinc-800/50 transition-colors"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <PageIcon
                    icon={page.icon}
                    pageId={page.id}
                    iconFileId={page.icon_file_id}
                    className="text-base"
                    imgClassName="h-5 w-5 rounded object-cover"
                  />
                  <div className="min-w-0">
                    <div className="text-xs font-medium text-zinc-800 dark:text-zinc-200 truncate">
                      {page.title || "Untitled"}
                    </div>
                    {page.archived_at && (
                      <div className="text-[10px] text-zinc-400">
                        Deleted {new Date(page.archived_at).toLocaleDateString()}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0 ml-3">
                  <button
                    type="button"
                    onClick={() => handleRestore(page.id)}
                    disabled={loadingId === page.id}
                    className="flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 transition-colors disabled:opacity-50"
                  >
                    <RotateCcw className="h-3 w-3" />
                    Restore
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeletePermanently(page.id)}
                    disabled={loadingId === page.id}
                    className="flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors disabled:opacity-50"
                  >
                    <Trash2 className="h-3 w-3" />
                    Delete
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
