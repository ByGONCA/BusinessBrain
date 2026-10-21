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
  Link2,
  Edit3,
  CornerDownRight,
  ExternalLink,
  PanelRight,
  Check,
} from "lucide-react";
import { PageTreeNode, PageRecord } from "@/lib/pages/types";
import {
  createPageAction,
  duplicatePageAction,
  archivePageAction,
  togglePageFavoriteAction,
  reorderPagesAction,
  updatePageTitleAction,
} from "@/lib/pages/actions";
import { TrashModal } from "./pages/trash-modal";
import { MovePageModal } from "./pages/move-page-modal";
import { useSidePeek } from "./pages/side-peek-context";
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
  const { openSidePeek } = useSidePeek();

  const [expandedIds, setExpandedIds] = React.useState<Set<string>>(() => new Set());
  const [trashOpen, setTrashOpen] = React.useState(false);
  const [archivedList, setArchivedList] = React.useState<PageRecord[]>(archivedPages);
  const [contextMenuId, setContextMenuId] = React.useState<string | null>(null);

  // Quick feedback states for context menu and renaming
  const [renamingId, setRenamingId] = React.useState<string | null>(null);
  const [renameTitle, setRenameTitle] = React.useState<string>("");
  const [copiedPageId, setCopiedPageId] = React.useState<string | null>(null);
  const [moveModalPage, setMoveModalPage] = React.useState<PageTreeNode | null>(null);

  // Local state for optimistic updates
  const [pagesList, setPagesList] = React.useState<PageTreeNode[]>(initialPages);

  // Drag and Drop state
  const [draggingId, setDraggingId] = React.useState<string | null>(null);
  const [dropTarget, setDropTarget] = React.useState<{
    id: string;
    position: "before" | "after" | "inside";
  } | null>(null);


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

  const handleCommitRename = async (pageId: string) => {
    const trimmed = renameTitle.trim();
    const newTitle = trimmed || "Untitled";
    setRenamingId(null);

    // Optimistic update
    setPagesList((prev) => {
      function updateNodes(nodes: PageTreeNode[]): PageTreeNode[] {
        return nodes.map((n) => {
          let updatedNode = n;
          if (n.id === pageId) {
            updatedNode = { ...n, title: newTitle };
          }
          if (n.children && n.children.length > 0) {
            return {
              ...updatedNode,
              children: updateNodes(n.children),
            };
          }
          return updatedNode;
        });
      }
      return updateNodes(prev);
    });

    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("cb-page-updated", {
          detail: { pageId, title: newTitle },
        })
      );
    }

    await updatePageTitleAction({ pageId, title: newTitle });
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
    const isRenaming = renamingId === node.id;

    return (
      <div key={node.id} className="space-y-0.5 select-none">
        <div
          draggable={!isRenaming}
          onDragStart={(e) => !isRenaming && handleDragStart(node.id, e)}
          onDragOver={(e) => handleDragOver(node.id, e)}
          onDragLeave={(e) => handleDragLeave(node.id, e)}
          onDrop={(e) => handleDrop(node.id, e)}
          onDragEnd={handleDragEnd}
          className={cn(
            "group relative flex items-center gap-2 rounded-md pr-2 h-[32px] text-[13px] font-medium transition-colors cursor-pointer select-none",
            isActive
              ? "bg-[#242427] text-[#FAFAFA] font-semibold shadow-2xs"
              : "text-[#A1A1AA] hover:bg-[#18181B] hover:text-[#FAFAFA]",
            isDragging && "opacity-40",
            isTarget && dropTarget.position === "before" && "border-t-2 border-blue-500 rounded-t-none",
            isTarget && dropTarget.position === "after" && "border-b-2 border-blue-500 rounded-b-none",
            isTarget && dropTarget.position === "inside" && "bg-blue-500/15 ring-1 ring-blue-500/40"
          )}
          style={{ paddingLeft: `${Math.max(6, depth * 12 + 6)}px` }}
        >
          {/* Chevron for expand/collapse */}
          <button
            type="button"
            onClick={(e) => toggleExpand(node.id, e)}
            className={cn(
              "flex h-4 w-4 shrink-0 items-center justify-center rounded text-zinc-400 hover:text-zinc-200 transition-transform",
              !hasChildren && "invisible"
            )}
          >
            {isExpanded ? (
              <ChevronDown className="h-3 w-3" />
            ) : (
              <ChevronRight className="h-3 w-3" />
            )}
          </button>

          {/* Page Link OR Inline Rename Input */}
          {isRenaming ? (
            <div
              className="flex-1 flex items-center gap-2 min-w-0 py-0.5"
              onClick={(e) => e.stopPropagation()}
            >
              <PageIcon
                icon={node.icon}
                pageId={node.id}
                iconFileId={node.icon_file_id}
                className="h-4 w-4 text-xs shrink-0"
                imgClassName="h-4 w-4 rounded object-cover"
              />
              <input
                type="text"
                autoFocus
                value={renameTitle}
                onChange={(e) => setRenameTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleCommitRename(node.id);
                  } else if (e.key === "Escape") {
                    e.preventDefault();
                    setRenamingId(null);
                  }
                }}
                onBlur={() => handleCommitRename(node.id)}
                className="flex-1 min-w-0 bg-white dark:bg-zinc-800 border border-blue-500 rounded px-1.5 py-0.5 text-xs text-foreground focus:outline-none shadow-2xs"
              />
            </div>
          ) : (
            <Link
              href={`/dashboard/pages/${node.id}`}
              prefetch={true}
              className="flex-1 flex items-center gap-2 min-w-0 py-0.5"
            >
              <PageIcon
                icon={node.icon}
                pageId={node.id}
                iconFileId={node.icon_file_id}
                className="h-4 w-4 text-xs shrink-0"
                imgClassName="h-4 w-4 rounded object-cover"
              />
              <span className="truncate">{node.title || "Untitled"}</span>
            </Link>
          )}

          {/* Hover Actions: quick add subpage (+) and context menu (...) */}
          {!isRenaming && (
            <div
              className={cn(
                "flex items-center gap-0.5 transition-opacity",
                isMenuOpen ? "opacity-100" : "opacity-0 group-hover:opacity-100"
              )}
            >
              <button
                type="button"
                onClick={(e) => handleCreateChildPage(node.id, e)}
                className="flex h-5 w-5 items-center justify-center rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200"
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
                    "flex h-5 w-5 items-center justify-center rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200",
                    isMenuOpen && "bg-zinc-800 text-zinc-200"
                  )}
                  title="Page options"
                >
                  <MoreHorizontal className="h-3 w-3" />
                </button>

                {isMenuOpen && (
                  <div
                    onClick={(e) => e.stopPropagation()}
                    className="absolute right-0 top-6 z-50 w-52 rounded-xl border border-[#242427] bg-[#141415] p-1.5 shadow-2xl animate-in fade-in zoom-in-95 duration-100 select-none text-xs"
                  >
                    {/* Header: Page label */}
                    <div className="px-2 py-1 text-[10px] font-semibold text-[#71717A] uppercase tracking-wider">
                      Page
                    </div>

                    {/* Add to / Remove from Favorites */}
                    <button
                      type="button"
                      onClick={(e) => handleToggleFavorite(node.id, e)}
                      className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-[#A1A1AA] hover:bg-[#1C1C1F] hover:text-[#F5F5F5] transition-colors"
                    >
                      <span className="flex items-center gap-2">
                        <Star
                          className={cn(
                            "h-3.5 w-3.5 transition-transform active:scale-125",
                            isFav ? "fill-amber-400 text-amber-400" : "text-[#71717A]"
                          )}
                        />
                        <span>{isFav ? "Remove from Favorites" : "Add to Favorites"}</span>
                      </span>
                    </button>

                    {/* Copy link */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (typeof window !== "undefined") {
                          const url = `${window.location.origin}/dashboard/pages/${node.id}`;
                          navigator.clipboard.writeText(url);
                          setCopiedPageId(node.id);
                          setTimeout(() => {
                            setCopiedPageId(null);
                            setContextMenuId(null);
                          }, 1200);
                        }
                      }}
                      className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-[#A1A1AA] hover:bg-[#1C1C1F] hover:text-[#F5F5F5] transition-colors"
                    >
                      <span className="flex items-center gap-2">
                        {copiedPageId === node.id ? (
                          <Check className="h-3.5 w-3.5 text-emerald-400" />
                        ) : (
                          <Link2 className="h-3.5 w-3.5 text-[#71717A]" />
                        )}
                        <span>{copiedPageId === node.id ? "Link copied!" : "Copy link"}</span>
                      </span>
                    </button>

                    {/* Duplicate */}
                    <button
                      type="button"
                      onClick={(e) => handleDuplicatePage(node.id, e)}
                      className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-[#A1A1AA] hover:bg-[#1C1C1F] hover:text-[#F5F5F5] transition-colors"
                    >
                      <span className="flex items-center gap-2">
                        <Copy className="h-3.5 w-3.5 text-[#71717A]" />
                        <span>Duplicate</span>
                      </span>
                      <span className="text-[10px] text-[#71717A] font-mono">Ctrl+D</span>
                    </button>

                    {/* Rename */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setContextMenuId(null);
                        setRenamingId(node.id);
                        setRenameTitle(node.title || "");
                      }}
                      className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-[#A1A1AA] hover:bg-[#1C1C1F] hover:text-[#F5F5F5] transition-colors"
                    >
                      <span className="flex items-center gap-2">
                        <Edit3 className="h-3.5 w-3.5 text-[#71717A]" />
                        <span>Rename</span>
                      </span>
                      <span className="text-[10px] text-[#71717A] font-mono">Ctrl+Shift+R</span>
                    </button>

                    {/* Move to */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setContextMenuId(null);
                        setMoveModalPage(node);
                      }}
                      className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-[#A1A1AA] hover:bg-[#1C1C1F] hover:text-[#F5F5F5] transition-colors"
                    >
                      <span className="flex items-center gap-2">
                        <CornerDownRight className="h-3.5 w-3.5 text-[#71717A]" />
                        <span>Move to</span>
                      </span>
                      <span className="text-[10px] text-[#71717A] font-mono">Ctrl+Shift+P</span>
                    </button>

                    {/* Move to Trash */}
                    <button
                      type="button"
                      onClick={(e) => handleArchivePage(node, e)}
                      className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-rose-400 hover:bg-rose-500/10 transition-colors"
                    >
                      <Trash2 className="h-3.5 w-3.5 text-rose-400" />
                      <span>Move to Trash</span>
                    </button>

                    {/* Separator */}
                    <div className="my-1 h-px bg-[#1C1C1F]" />

                    {/* Open in new tab */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setContextMenuId(null);
                        window.open(`/dashboard/pages/${node.id}`, "_blank");
                      }}
                      className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-[#A1A1AA] hover:bg-[#1C1C1F] hover:text-[#F5F5F5] transition-colors"
                    >
                      <span className="flex items-center gap-2">
                        <ExternalLink className="h-3.5 w-3.5 text-[#71717A]" />
                        <span>Open in new tab</span>
                      </span>
                      <span className="text-[10px] text-[#71717A] font-mono">Ctrl+Shift+↵</span>
                    </button>

                    {/* Open in side peek */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setContextMenuId(null);
                        openSidePeek(node.id);
                      }}
                      className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-[#A1A1AA] hover:bg-[#1C1C1F] hover:text-[#F5F5F5] transition-colors"
                    >
                      <span className="flex items-center gap-2">
                        <PanelRight className="h-3.5 w-3.5 text-[#71717A]" />
                        <span>Open in side peek</span>
                      </span>
                      <span className="text-[10px] text-[#71717A] font-mono">Alt+Click</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
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
    <div className="space-y-0.5">
      {/* Page Tree Nodes rendered directly under Pages category */}
      {pagesList.length === 0 ? (
        <button
          type="button"
          data-tour="new-page-btn"
          onClick={handleCreateRootPage}
          className="group flex w-full items-center gap-2 rounded-md px-2.5 h-[32px] text-[13px] font-medium text-[#71717A] hover:bg-[#18181B] hover:text-[#FAFAFA] transition-colors"
        >
          <Plus className="h-4 w-4 shrink-0 text-[#71717A] group-hover:text-[#FAFAFA] transition-colors" />
          <span className="truncate">Create your first page</span>
        </button>
      ) : (
        <>
          {pagesList.map((page) => renderNode(page, 0))}
          <button
            type="button"
            data-tour="new-page-btn"
            onClick={handleCreateRootPage}
            className="group flex w-full items-center gap-2 rounded-md px-2 h-[30px] text-[12.5px] font-medium text-[#71717A] hover:bg-[#18181B] hover:text-[#FAFAFA] transition-colors"
          >
            <Plus className="h-3.5 w-3.5 shrink-0 text-[#71717A] group-hover:text-[#FAFAFA] transition-colors" />
            <span className="truncate">Add a page</span>
          </button>
        </>
      )}

      {/* Move Page Modal */}
      <MovePageModal
        isOpen={Boolean(moveModalPage)}
        onClose={() => setMoveModalPage(null)}
        page={moveModalPage}
        pagesTree={pagesList}
        onPageMoved={() => router.refresh()}
      />

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
