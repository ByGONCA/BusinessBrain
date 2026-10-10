"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Search, FolderRoot, CornerDownRight, Check, Loader2, X } from "lucide-react";
import { PageTreeNode } from "@/lib/pages/types";
import { movePageAction } from "@/lib/pages/actions";
import { PageIcon } from "./page-icon";
import { cn } from "@/lib/utils";

interface FlatPageItem {
  id: string;
  title: string;
  icon?: string;
  parent_page_id?: string | null;
  depth: number;
}

interface MovePageModalProps {
  isOpen: boolean;
  onClose: () => void;
  page: {
    id: string;
    title: string;
    icon?: string;
    parent_page_id?: string | null;
  } | null;
  pagesTree: PageTreeNode[];
  onPageMoved?: () => void;
}

export function MovePageModal({
  isOpen,
  onClose,
  page,
  pagesTree,
  onPageMoved,
}: MovePageModalProps) {
  const router = useRouter();
  const [search, setSearch] = React.useState("");
  const [selectedParentId, setSelectedParentId] = React.useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  // Initialize selected parent when modal opens
  React.useEffect(() => {
    if (page) {
      setSelectedParentId(page.parent_page_id || null);
      setSearch("");
      setErrorMessage(null);
    }
  }, [page, isOpen]);

  if (!isOpen || !page) return null;

  // Collect all descendant IDs of the current page to prevent cyclic loops
  const getDescendantIds = (nodes: PageTreeNode[], targetId: string): Set<string> => {
    const descendants = new Set<string>();

    function findNodeAndCollect(items: PageTreeNode[], foundTarget: boolean) {
      for (const item of items) {
        if (foundTarget || item.id === targetId) {
          if (item.id !== targetId) {
            descendants.add(item.id);
          }
          if (item.children && item.children.length > 0) {
            findNodeAndCollect(item.children, true);
          }
        } else if (item.children && item.children.length > 0) {
          findNodeAndCollect(item.children, false);
        }
      }
    }

    findNodeAndCollect(nodes, false);
    return descendants;
  };

  const forbiddenIds = getDescendantIds(pagesTree, page.id);
  forbiddenIds.add(page.id);

  // Flatten the tree for searchable list while tracking depth
  const flattenNodes = (nodes: PageTreeNode[], depth = 0): FlatPageItem[] => {
    const list: FlatPageItem[] = [];
    for (const node of nodes) {
      list.push({
        id: node.id,
        title: node.title || "Untitled",
        icon: node.icon,
        parent_page_id: node.parent_page_id,
        depth,
      });
      if (node.children && node.children.length > 0) {
        list.push(...flattenNodes(node.children, depth + 1));
      }
    }
    return list;
  };

  const allFlatPages = flattenNodes(pagesTree);

  // Filter eligible destination pages (excluding page itself & descendants)
  const eligiblePages = allFlatPages.filter((item) => !forbiddenIds.has(item.id));
  const filteredPages = eligiblePages.filter((item) =>
    item.title.toLowerCase().includes(search.trim().toLowerCase())
  );

  const handleConfirmMove = async () => {
    if (!page) return;
    setIsSubmitting(true);
    setErrorMessage(null);

    const res = await movePageAction({
      pageId: page.id,
      targetParentId: selectedParentId,
    });

    setIsSubmitting(false);

    if (res.success) {
      onClose();
      onPageMoved?.();
      router.refresh();
    } else {
      setErrorMessage(res.error || "Failed to move page");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        className="w-full max-w-md rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-200 dark:border-zinc-800">
          <div className="flex items-center gap-2 min-w-0">
            <CornerDownRight className="h-4 w-4 text-blue-500 shrink-0" />
            <div className="text-xs font-semibold text-foreground truncate">
              Move &ldquo;{page.title || "Untitled"}&rdquo; to...
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-6 w-6 items-center justify-center rounded-md text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Search Input */}
        <div className="p-3 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/20">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-zinc-400" />
            <input
              type="text"
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search destination page..."
              className="w-full rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 pl-8 pr-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Destinations List */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {/* Workspace Root Option */}
          <button
            type="button"
            onClick={() => setSelectedParentId(null)}
            className={cn(
              "flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-xs font-medium transition-colors text-left",
              selectedParentId === null
                ? "bg-blue-600/10 text-blue-600 dark:text-blue-400 font-semibold"
                : "text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            )}
          >
            <span className="flex items-center gap-2">
              <FolderRoot className="h-4 w-4 text-zinc-500" />
              <span>Workspace root (No parent)</span>
            </span>
            {selectedParentId === null && <Check className="h-3.5 w-3.5 text-blue-500" />}
          </button>

          <div className="my-1.5 h-px bg-zinc-200 dark:border-zinc-800" />

          {/* Subpages Destinations */}
          {filteredPages.length === 0 ? (
            <div className="py-6 text-center text-xs text-muted-foreground">
              {search.trim() ? "No matching pages found" : "No other pages available"}
            </div>
          ) : (
            filteredPages.map((dest) => {
              const isSelected = selectedParentId === dest.id;
              return (
                <button
                  key={dest.id}
                  type="button"
                  onClick={() => setSelectedParentId(dest.id)}
                  style={{ paddingLeft: `${Math.max(10, dest.depth * 14 + 10)}px` }}
                  className={cn(
                    "flex w-full items-center justify-between rounded-lg pr-2.5 py-1.5 text-xs transition-colors text-left",
                    isSelected
                      ? "bg-blue-600/10 text-blue-600 dark:text-blue-400 font-semibold"
                      : "text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                  )}
                >
                  <span className="flex items-center gap-2 truncate">
                    <PageIcon
                      icon={dest.icon}
                      pageId={dest.id}
                      iconFileId={(dest as unknown as { icon_file_id?: string | null }).icon_file_id}
                      className="h-3.5 w-3.5 text-xs shrink-0"
                      imgClassName="h-3.5 w-3.5 rounded object-cover"
                    />
                    <span className="truncate">{dest.title}</span>
                  </span>
                  {isSelected && <Check className="h-3.5 w-3.5 text-blue-500 shrink-0 ml-2" />}
                </button>
              );
            })
          )}
        </div>

        {/* Error message if any */}
        {errorMessage && (
          <div className="px-4 py-2 text-xs text-red-600 bg-red-50 dark:bg-red-950/30 border-t border-red-200 dark:border-red-900">
            {errorMessage}
          </div>
        )}

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/20">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 text-xs font-medium text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirmMove}
            disabled={isSubmitting || selectedParentId === (page.parent_page_id || null)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium shadow-sm transition-colors disabled:opacity-50"
          >
            {isSubmitting && <Loader2 className="h-3 w-3 animate-spin" />}
            <span>Move</span>
          </button>
        </div>
      </div>
    </div>
  );
}
