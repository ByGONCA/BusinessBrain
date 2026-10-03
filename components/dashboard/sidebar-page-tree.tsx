"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ChevronRight,
  ChevronDown,
  Plus,
  MoreHorizontal,
  Trash2,
  Copy,
  Star,
  GripVertical,
} from "lucide-react";
import { PageTreeNode, PageRecord } from "@/lib/pages/types";
import {
  createPageAction,
  duplicatePageAction,
  archivePageAction,
  togglePageFavoriteAction,
  reorderPagesAction,
} from "@/lib/pages/actions";
import { TrashModal } from "./pages/trash-modal";
import { PageIcon } from "./pages/page-icon";
import { cn } from "@/lib/utils";

interface SidebarPageTreeProps {
  initialPages: PageTreeNode[];
  favoritePages?: PageRecord[];
  archivedPages?: PageRecord[];
  organizationId: string;
}

export function SidebarPageTree({
  initialPages,
  favoritePages = [],
  archivedPages = [],
  organizationId,
}: SidebarPageTreeProps) {
  const pathname = usePathname();
  const router = useRouter();

  const [expandedIds, setExpandedIds] = React.useState<Set<string>>(() => new Set());
  const [trashOpen, setTrashOpen] = React.useState(false);
  const [archivedList, setArchivedList] = React.useState<PageRecord[]>(archivedPages);
  const [contextMenuId, setContextMenuId] = React.useState<string | null>(null);

  // Local state for optimistic updates
  const [pagesList, setPagesList] = React.useState<PageTreeNode[]>(initialPages);

  // Drag and Drop state
  const [draggingId, setDraggingId] = React.useState<string | null>(null);
  const [dropTarget, setDropTarget] = React.useState<{
    id: string;
    position: "before" | "after" | "inside";
  } | null>(null);

  // Collapsible section state with localStorage persistence
  const [isPagesOpen, setIsPagesOpen] = React.useState(true);

  React.useEffect(() => {
    try {
      const storedPagesOpen = localStorage.getItem("cb_sidebar_pages_open");
      if (storedPagesOpen !== null) {
        setIsPagesOpen(storedPagesOpen === "true");
      }
    } catch {
      // LocalStorage access may be restricted in private mode
    }
  }, []);

  const togglePagesSection = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsPagesOpen((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("cb_sidebar_pages_open", String(next));
      } catch {}
      return next;
    });
  };

  React.useEffect(() => {
    setPagesList(initialPages);
  }, [initialPages]);

  // Listen for real-time page updates (title, icon) from the editor
  React.useEffect(() => {
    function handlePageUpdate(event: Event) {
      const customEvent = event as CustomEvent<{
        pageId: string;
        title?: string;
        icon?: string;
      }>;
      const { pageId, title: updatedTitle, icon: updatedIcon } = customEvent.detail || {};
      if (!pageId) return;

      function updateNode(nodes: PageTreeNode[]): PageTreeNode[] {
        return nodes.map((node) => {
          let updatedNode = node;
          if (node.id === pageId) {
            updatedNode = {
              ...node,
              ...(updatedTitle !== undefined && { title: updatedTitle }),
              ...(updatedIcon !== undefined && { icon: updatedIcon }),
            };
          }
          if (node.children && node.children.length > 0) {
            return {
              ...updatedNode,
              children: updateNode(node.children),
            };
          }
          return updatedNode;
        });
      }
      setPagesList((prev) => updateNode(prev));
    }

    window.addEventListener("cb-page-updated", handlePageUpdate);
    return () => {
      window.removeEventListener("cb-page-updated", handlePageUpdate);
    };
  }, []);

  // Listen for real-time favorite toggle events from the editor header
  React.useEffect(() => {
    function handleExternalFavoriteToggle(event: Event) {
      const customEvent = event as CustomEvent<{
        pageId: string;
        isFavorite: boolean;
      }>;
      const { pageId, isFavorite: nextFav } = customEvent.detail || {};
      if (!pageId) return;

      function findNode(nodes: PageTreeNode[]): PageTreeNode | null {
        for (const n of nodes) {
          if (n.id === pageId) return n;
          if (n.children?.length) {
            const found = findNode(n.children);
            if (found) return found;
          }
        }
        return null;
      }

      function removeNode(nodes: PageTreeNode[]): PageTreeNode[] {
        return nodes
          .filter((n) => n.id !== pageId)
          .map((n) => ({
            ...n,
            children: n.children ? removeNode(n.children) : [],
          }));
      }

      setPagesList((prev) => {
        const target = findNode(prev);
        if (!target) return prev;
        const updatedNode: PageTreeNode = {
          ...target,
          is_favorite: nextFav,
        };
        const cleaned = removeNode(prev);
        if (nextFav) {
          return [{ ...updatedNode, parent_page_id: null }, ...cleaned];
        } else {
          return [...cleaned, updatedNode];
        }
      });
    }

    window.addEventListener("cb-page-favorite-toggled", handleExternalFavoriteToggle);
    return () => {
      window.removeEventListener("cb-page-favorite-toggled", handleExternalFavoriteToggle);
    };
  }, []);

  // Auto-expand path leading to the active page
  React.useEffect(() => {
    const match = pathname.match(/\/dashboard\/pages\/([a-zA-Z0-9_-]+)/);
    if (match && match[1]) {
      const activeId = match[1];
      function findAncestors(nodes: PageTreeNode[], targetId: string, path: string[] = []): string[] | null {
        for (const node of nodes) {
          if (node.id === targetId) return path;
          if (node.children && node.children.length > 0) {
            const found = findAncestors(node.children, targetId, [...path, node.id]);
            if (found) return found;
          }
        }
        return null;
      }

      const ancestors = findAncestors(pagesList, activeId);
      if (ancestors && ancestors.length > 0) {
        setExpandedIds((prev) => {
          const next = new Set(prev);
          ancestors.forEach((id) => next.add(id));
          return next;
        });
      }
    }
  }, [pathname, pagesList]);

  // Close context menu on outside click
  React.useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as HTMLElement | null;
      const menuContainer = target?.closest<HTMLElement>("[data-page-menu-container]");
      if (menuContainer && menuContainer.getAttribute("data-page-menu-container") === contextMenuId) {
        return;
      }
      setContextMenuId(null);
    }
    if (contextMenuId) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [contextMenuId]);

  const toggleExpand = (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleCreateRootPage = async () => {
    setIsPagesOpen(true);
    try {
      localStorage.setItem("cb_sidebar_pages_open", "true");
    } catch {}
    const res = await createPageAction({
      title: "Untitled",
      icon: "📄",
    });
    if (res.success && res.page) {
      router.push(`/dashboard/pages/${res.page.id}`);
    }
  };

  const handleCreateChildPage = async (parentId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenuId(null);
    setExpandedIds((prev) => new Set(prev).add(parentId));
    const res = await createPageAction({
      parentPageId: parentId,
      title: "Untitled",
      icon: "📄",
    });
    if (res.success && res.page) {
      router.push(`/dashboard/pages/${res.page.id}`);
    }
  };

  const handleToggleFavorite = async (pageId: string, e?: React.MouseEvent) => {
    e?.preventDefault();
    e?.stopPropagation();
    setContextMenuId(null);

    function findNode(nodes: PageTreeNode[]): PageTreeNode | null {
      for (const n of nodes) {
        if (n.id === pageId) return n;
        if (n.children?.length) {
          const found = findNode(n.children);
          if (found) return found;
        }
      }
      return null;
    }

    const targetNode = findNode(pagesList);
    if (!targetNode) return;

    const nextIsFav = !targetNode.is_favorite;

    function removeNode(nodes: PageTreeNode[]): PageTreeNode[] {
      return nodes
        .filter((n) => n.id !== pageId)
        .map((n) => ({
          ...n,
          children: n.children ? removeNode(n.children) : [],
        }));
    }

    const updatedNode: PageTreeNode = {
      ...targetNode,
      is_favorite: nextIsFav,
    };
    const cleaned = removeNode(pagesList);

    if (nextIsFav) {
      // Put at index 0 of pagesList (the top of Pages!)
      setPagesList([{ ...updatedNode, parent_page_id: null }, ...cleaned]);
    } else {
      setPagesList([...cleaned, updatedNode]);
    }

    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("cb-page-favorite-toggled", {
          detail: {
            pageId,
            isFavorite: nextIsFav,
          },
        })
      );
    }

    const res = await togglePageFavoriteAction({ pageId });
    if (!res.success) {
      setPagesList(initialPages);
    }
  };

  const handleDuplicatePage = async (pageId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenuId(null);
    const res = await duplicatePageAction({ pageId });
    if (res.success && res.page) {
      router.push(`/dashboard/pages/${res.page.id}`);
    }
  };

  const handleArchivePage = async (page: PageRecord, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenuId(null);
    const res = await archivePageAction({ pageId: page.id });
    if (res.success) {
      setArchivedList((prev) => [page, ...prev]);
      if (pathname.includes(page.id)) {
        router.push("/dashboard/pages");
      }
    }
  };

  // ----------------------------------------------------------------------------
  // DRAG AND DROP HANDLERS
  // ----------------------------------------------------------------------------

  const handleDragStart = (id: string, e: React.DragEvent) => {
    e.dataTransfer.setData("text/plain", id);
    e.dataTransfer.effectAllowed = "move";
    setDraggingId(id);
  };

  const handleDragOver = (id: string, e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!draggingId || draggingId === id) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const relY = e.clientY - rect.top;

    let position: "before" | "after" | "inside";
    if (relY < rect.height * 0.28) {
      position = "before";
    } else if (relY > rect.height * 0.72) {
      position = "after";
    } else {
      position = "inside";
    }

    setDropTarget({ id, position });
  };

  const handleDragLeave = (id: string, e: React.DragEvent) => {
    if (dropTarget?.id === id) {
      setDropTarget(null);
    }
  };

  const handleDrop = async (targetId: string, e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!draggingId || draggingId === targetId || !dropTarget) {
      setDraggingId(null);
      setDropTarget(null);
      return;
    }

    const { position } = dropTarget;
    const activeId = draggingId;

    setDraggingId(null);
    setDropTarget(null);

    // Reorder within Pages tree
    await reorderPagesAction({
      activePageId: activeId,
      targetPageId: targetId,
      dropPosition: position,
      isFavoriteList: false,
    });
    router.refresh();
  };

  const handleDragEnd = () => {
    setDraggingId(null);
    setDropTarget(null);
  };

  // ----------------------------------------------------------------------------
  // RENDER PAGE TREE NODE (Draggable within hierarchy)
  // ----------------------------------------------------------------------------
  const renderNode = (node: PageTreeNode, depth: number = 0) => {
    const isExpanded = expandedIds.has(node.id);
    const hasChildren = node.children && node.children.length > 0;
    const isActive = pathname === `/dashboard/pages/${node.id}`;
    const isMenuOpen = contextMenuId === node.id;
    const isDragging = draggingId === node.id;
    const isTarget = dropTarget?.id === node.id;
    const isFav = Boolean(node.is_favorite);

    return (
      <div key={node.id} className="space-y-0.5 select-none">
        <div
          draggable
          onDragStart={(e) => handleDragStart(node.id, e)}
          onDragOver={(e) => handleDragOver(node.id, e)}
          onDragLeave={(e) => handleDragLeave(node.id, e)}
          onDrop={(e) => handleDrop(node.id, e)}
          onDragEnd={handleDragEnd}
          className={cn(
            "group relative flex items-center gap-1.5 rounded-lg pr-2 py-1 text-xs font-medium transition-colors cursor-pointer",
            isActive
              ? "bg-blue-600/10 text-blue-600 dark:text-blue-400 font-semibold"
              : "text-muted-foreground hover:bg-muted/80 hover:text-foreground",
            isDragging && "opacity-40",
            isTarget && dropTarget.position === "before" && "border-t-2 border-blue-500 rounded-t-none",
            isTarget && dropTarget.position === "after" && "border-b-2 border-blue-500 rounded-b-none",
            isTarget && dropTarget.position === "inside" && "bg-blue-500/15 ring-1 ring-blue-500/40"
          )}
          style={{ paddingLeft: `${Math.max(8, depth * 14 + 8)}px` }}
        >
          {/* Chevron for expand/collapse */}
          <button
            type="button"
            onClick={(e) => toggleExpand(node.id, e)}
            className={cn(
              "flex h-4 w-4 shrink-0 items-center justify-center rounded text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-transform",
              !hasChildren && "invisible"
            )}
          >
            {isExpanded ? (
              <ChevronDown className="h-3.5 w-3.5" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5" />
            )}
          </button>

          {/* Page Link */}
          <Link
            href={`/dashboard/pages/${node.id}`}
            prefetch={true}
            className="flex-1 flex items-center gap-2 min-w-0 py-0.5"
          >
            <PageIcon icon={node.icon} className="h-4 w-4 text-sm" imgClassName="h-4 w-4 rounded object-cover" />
            <span className="truncate">{node.title || "Untitled"}</span>
          </Link>

          {/* Hover Actions: quick favorite (⭐), quick add subpage (+), and context menu (...) */}
          <div
            className={cn(
              "flex items-center gap-0.5 transition-opacity",
              isFav ? "opacity-100" : "opacity-0 group-hover:opacity-100"
            )}
          >
            {/* Quick Star Favorite Toggle */}
            <button
              type="button"
              onClick={(e) => handleToggleFavorite(node.id, e)}
              className={cn(
                "flex h-5 w-5 items-center justify-center rounded transition-colors",
                isFav
                  ? "text-amber-500 hover:bg-amber-500/10"
                  : "text-zinc-400 hover:text-amber-500 hover:bg-zinc-200 dark:hover:bg-zinc-700"
              )}
              title={isFav ? "Remover do topo" : "Fixar no topo"}
            >
              <Star
                className={cn(
                  "h-3 w-3 transition-transform active:scale-125",
                  isFav ? "fill-amber-500 text-amber-500" : "text-zinc-400"
                )}
              />
            </button>

            <button
              type="button"
              onClick={(e) => handleCreateChildPage(node.id, e)}
              className="flex h-5 w-5 items-center justify-center rounded hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
              title="Add subpage"
            >
              <Plus className="h-3 w-3" />
            </button>

            <div className="relative" data-page-menu-container={node.id}>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setContextMenuId((prev) => (prev === node.id ? null : node.id));
                }}
                className={cn(
                  "flex h-5 w-5 items-center justify-center rounded hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200",
                  isMenuOpen && "bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-200"
                )}
                title="Page options"
              >
                <MoreHorizontal className="h-3 w-3" />
              </button>

              {isMenuOpen && (
                <div
                  onClick={(e) => e.stopPropagation()}
                  className="absolute right-0 top-6 z-50 w-44 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-1 shadow-xl animate-in fade-in zoom-in-95 duration-100"
                >
                  <button
                    type="button"
                    onClick={(e) => handleCreateChildPage(node.id, e)}
                    className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                  >
                    <Plus className="h-3.5 w-3.5" /> Add subpage
                  </button>
                  <button
                    type="button"
                    onClick={(e) => handleDuplicatePage(node.id, e)}
                    className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                  >
                    <Copy className="h-3.5 w-3.5" /> Duplicate
                  </button>
                  <div className="my-1 h-px bg-zinc-200 dark:bg-zinc-800" />
                  <button
                    type="button"
                    onClick={(e) => handleArchivePage(node, e)}
                    className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Move to Trash
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Nested Children */}
        {hasChildren && isExpanded && (
          <div className="space-y-0.5">
            {node.children.map((child) => renderNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-3">
      {/* PAGES SECTION */}
      <div className="space-y-0.5">
        <div
          onClick={togglePagesSection}
          className="group flex items-center justify-between px-3 py-1 rounded-lg hover:bg-muted/60 cursor-pointer transition-colors select-none"
        >
          {/* Title on the left with chevron immediately after it */}
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Pages
            </span>
            <ChevronDown
              className={cn(
                "h-3 w-3 text-muted-foreground transition-all duration-150 opacity-0 group-hover:opacity-100",
                !isPagesOpen && "-rotate-90"
              )}
            />
          </div>

          {/* Action button on the right on hover */}
          <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleCreateRootPage();
              }}
              className="flex h-5 w-5 items-center justify-center rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
              title="Add page"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Page Tree Nodes - ONLY rendered when isPagesOpen is true! */}
        {isPagesOpen && (
          <div className="space-y-0.5">
            {pagesList.length === 0 ? (
              <button
                type="button"
                onClick={handleCreateRootPage}
                className="group flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium text-muted-foreground hover:bg-muted/80 hover:text-foreground transition-colors"
              >
                <Plus className="h-4 w-4 shrink-0 text-muted-foreground group-hover:text-foreground transition-colors" />
                <span className="truncate">Create your first page</span>
              </button>
            ) : (
              pagesList.map((page) => renderNode(page, 0))
            )}
          </div>
        )}
      </div>

      {/* Trash Modal */}
      <TrashModal
        isOpen={trashOpen}
        onClose={() => setTrashOpen(false)}
        archivedPages={archivedList}
        onPageRestored={(id) => {
          setArchivedList((prev) => prev.filter((p) => p.id !== id));
          router.refresh();
        }}
        onPageDeleted={(id) => {
          setArchivedList((prev) => prev.filter((p) => p.id !== id));
        }}
      />
    </div>
  );
}
