"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  EditorBlock,
  BlockType,
  PageRecord,
  PageTemplate,
  PageViewMode,
  PageConnectionRecord,
  EntityType,
  PageActivityRecord,
  PageVersionRecord,
  PageCommentRecord,
} from "@/lib/pages/types";
import { BlockItem } from "./block-item";
import { SlashMenu, SlashMenuItem } from "./slash-menu";
import { MentionMenu, MentionItem } from "./mention-menu";
import { FloatingFormatToolbar, FormatType, CompanyBrainToolbarAction } from "./floating-format-toolbar";
import { LinkPreviewPopover } from "./link-preview-popover";
import { TemplatePicker } from "./template-picker";
import { EmojiPicker } from "./emoji-picker";
import { ConnectModal } from "./connect-modal";
import { PageOutlineView } from "./page-outline-view";
import { PageConnectionsView } from "./page-connections-view";
import { PageHeaderActions } from "./page-header-actions";
import { PageInfoModal } from "./page-info-modal";
import { PageActivityDrawer } from "./page-activity-drawer";
import { PageCommentsPanel } from "./page-comments-panel";
import { formatRelativeTime, formatExactDateTime } from "@/lib/utils/time";
import { focusBlockCaretEnd, getCaretOffset } from "./caret-utils";
import {
  savePageContentAction,
  createPageAction,
  getPageConnectionsAction,
  removeConnectionAction,
  togglePageFavoriteAction,
  getPageActivityAction,
  getPageVersionsAction,
  getPageCommentsAction,
} from "@/lib/pages/actions";
import { FilePickerModal } from "./file-picker-modal";
import { PageAttachmentsPanel } from "./page-attachments-panel";
import { getPageFilesAction } from "@/lib/files/actions";
import { PageFileRecord, OrganizationFileRecord } from "@/lib/files/types";
import {
  Check,
  Loader2,
  AlertCircle,
  CopyPlus,
  Trash2,
  Copy,
  X,
  Sparkles,
  ChevronDown,
  ArrowUp,
  ArrowDown,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  CheckSquare,
  Quote,
  Code as CodeIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface HistoryEntry {
  blocks: EditorBlock[];
  title: string;
  icon: string;
  focusedBlockId?: string | null;
}

interface BlockEditorProps {
  page: PageRecord;
  currentUser?: {
    id: string;
    email?: string;
    name?: string;
    avatar_url?: string | null;
  };
  onPageTitleChange?: (newTitle: string) => void;
  onPageIconChange?: (newIcon: string) => void;
}

export function BlockEditor({
  page,
  currentUser,
  onPageTitleChange,
  onPageIconChange,
}: BlockEditorProps) {
  const router = useRouter();
  const [title, setTitle] = React.useState(page.title || "Untitled");
  const [icon, setIcon] = React.useState(page.icon || "📄");
  const [blocks, setBlocks] = React.useState<EditorBlock[]>(() => {
    if (page.content && Array.isArray(page.content) && page.content.length > 0) {
      return page.content;
    }
    return [{ id: crypto.randomUUID(), type: "paragraph", content: "" }];
  });

  const [viewMode, setViewMode] = React.useState<PageViewMode>("editor");
  const [connections, setConnections] = React.useState<PageConnectionRecord[]>([]);
  const [isFavorite, setIsFavorite] = React.useState(Boolean(page.is_favorite));

  // Author Spotlight & GitLens Blame State
  const [highlightedAuthorKey, setHighlightedAuthorKey] = React.useState<string | null>(null);

  const toggleAuthorHighlight = React.useCallback((authorKey: string) => {
    setHighlightedAuthorKey((prev) => (prev === authorKey ? null : authorKey));
  }, []);

  const currentAuthorMeta = React.useMemo(
    () => ({
      userId: currentUser?.id,
      name: currentUser?.name || currentUser?.email?.split("@")[0] || "You",
      email: currentUser?.email || "",
      avatarUrl: currentUser?.avatar_url || null,
      editedAt: new Date().toISOString(),
    }),
    [currentUser]
  );

  const isBlockAuthorHighlighted = React.useCallback(
    (b: EditorBlock) => {
      if (!highlightedAuthorKey) return false;
      const bKey =
        b.author?.userId ||
        b.author?.name ||
        b.author?.email ||
        page.last_edited_by ||
        page.created_by ||
        page.last_edited_by_profile?.id ||
        page.created_by_profile?.id ||
        page.last_edited_by_profile?.full_name ||
        page.created_by_profile?.full_name ||
        page.last_edited_by_profile?.email?.split("@")[0] ||
        page.created_by_profile?.email?.split("@")[0];
      return bKey === highlightedAuthorKey;
    },
    [highlightedAuthorKey, page]
  );

  const highlightedInfo = React.useMemo(() => {
    if (!highlightedAuthorKey) return null;
    let name = "Author";
    let count = 0;
    for (const b of blocks) {
      const bKey =
        b.author?.userId ||
        b.author?.name ||
        b.author?.email ||
        page.last_edited_by ||
        page.created_by ||
        page.last_edited_by_profile?.id ||
        page.created_by_profile?.id ||
        page.last_edited_by_profile?.full_name ||
        page.created_by_profile?.full_name ||
        page.last_edited_by_profile?.email?.split("@")[0] ||
        page.created_by_profile?.email?.split("@")[0];
      if (bKey === highlightedAuthorKey && b.content && b.content.trim().length > 0) {
        count++;
        if (b.author?.name) name = b.author.name;
        else if (page.last_edited_by_profile?.full_name) name = page.last_edited_by_profile.full_name;
        else if (page.created_by_profile?.full_name) name = page.created_by_profile.full_name;
      }
    }
    return { name, count };
  }, [highlightedAuthorKey, blocks, page]);

  // Collaborative & Authorship states
  const [infoModalOpen, setInfoModalOpen] = React.useState(false);
  const [activityDrawerOpen, setActivityDrawerOpen] = React.useState(false);
  const [commentsDrawerOpen, setCommentsDrawerOpen] = React.useState(false);
  const [activities, setActivities] = React.useState<PageActivityRecord[]>([]);
  const [versions, setVersions] = React.useState<PageVersionRecord[]>([]);
  const [comments, setComments] = React.useState<PageCommentRecord[]>([]);

  const loadActivitiesAndVersions = React.useCallback(async () => {
    try {
      const [actRes, verRes] = await Promise.all([
        getPageActivityAction(page.id),
        getPageVersionsAction(page.id),
      ]);
      if (actRes.success) setActivities(actRes.activities);
      if (verRes.success) setVersions(verRes.versions);
    } catch (err) {
      console.error("Failed to load activity & versions:", err);
    }
  }, [page.id]);

  const loadComments = React.useCallback(async () => {
    try {
      const comRes = await getPageCommentsAction(page.id);
      if (comRes.success) setComments(comRes.comments);
    } catch (err) {
      console.error("Failed to load comments:", err);
    }
  }, [page.id]);

  React.useEffect(() => {
    loadComments();
  }, [loadComments]);

  React.useEffect(() => {
    if (activityDrawerOpen) {
      loadActivitiesAndVersions();
    }
  }, [activityDrawerOpen, loadActivitiesAndVersions]);

  React.useEffect(() => {
    setIsFavorite(Boolean(page.is_favorite));
  }, [page.is_favorite]);

  // Sync real-time favorite toggle across components (e.g. sidebar tree)
  React.useEffect(() => {
    function handleFavoriteUpdate(event: Event) {
      const customEvent = event as CustomEvent<{ pageId: string; isFavorite: boolean }>;
      if (customEvent.detail?.pageId === page.id) {
        setIsFavorite(customEvent.detail.isFavorite);
      }
    }
    window.addEventListener("cb-page-favorite-toggled", handleFavoriteUpdate);
    return () => window.removeEventListener("cb-page-favorite-toggled", handleFavoriteUpdate);
  }, [page.id]);

  const handleToggleFavorite = async () => {
    const nextVal = !isFavorite;
    setIsFavorite(nextVal);
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("cb-page-favorite-toggled", {
          detail: {
            pageId: page.id,
            isFavorite: nextVal,
            page: { ...page, title, icon, is_favorite: nextVal },
          },
        })
      );
    }
    try {
      const res = await togglePageFavoriteAction({ pageId: page.id });
      if (!res.success) {
        setIsFavorite(!nextVal);
        if (typeof window !== "undefined") {
          window.dispatchEvent(
            new CustomEvent("cb-page-favorite-toggled", {
              detail: { pageId: page.id, isFavorite: !nextVal },
            })
          );
        }
      }
    } catch {
      setIsFavorite(!nextVal);
    }
  };

  // Multi-block marquee selection state
  const [selectedBlockIds, setSelectedBlockIds] = React.useState<Set<string>>(new Set());
  const [marqueeRect, setMarqueeRect] = React.useState<{
    startX: number;
    startY: number;
    currentX: number;
    currentY: number;
  } | null>(null);
  const [isMarqueeSelecting, setIsMarqueeSelecting] = React.useState(false);
  const [batchTransformOpen, setBatchTransformOpen] = React.useState(false);
  const isMarqueeRef = React.useRef(false);

  const [connectModalState, setConnectModalState] = React.useState<{
    isOpen: boolean;
    sourceType: "page" | "block";
    sourceId: string;
    initialType?: EntityType;
    initialText?: string;
  }>({
    isOpen: false,
    sourceType: "page",
    sourceId: page.id,
    initialType: "task",
    initialText: "",
  });

  const [saveStatus, setSaveStatus] = React.useState<"saved" | "saving" | "error">("saved");
  const [focusedBlockId, setFocusedBlockId] = React.useState<string | null>(null);

  // Load existing connections on mount
  React.useEffect(() => {
    let isMounted = true;
    getPageConnectionsAction(page.id)
      .then((res) => {
        if (isMounted && res.success) {
          setConnections(res.connections);
        }
      })
      .catch(() => {});
    return () => {
      isMounted = false;
    };
  }, [page.id]);

  // Page Files state
  const [filePickerState, setFilePickerState] = React.useState<{
    isOpen: boolean;
    blockId?: string;
    allowedTypes: "all" | "image" | "video" | "audio" | "pdf" | "document";
  }>({
    isOpen: false,
    allowedTypes: "all",
  });
  const [pageFiles, setPageFiles] = React.useState<PageFileRecord[]>([]);

  const loadPageFiles = React.useCallback(() => {
    getPageFilesAction(page.id)
      .then(setPageFiles)
      .catch(() => {});
  }, [page.id]);

  React.useEffect(() => {
    loadPageFiles();
  }, [loadPageFiles]);

  const handleFileSelected = (file: OrganizationFileRecord) => {
    if (filePickerState.blockId) {
      handleUpdateProperties(filePickerState.blockId, {
        fileId: file.id,
        fileName: file.name,
        fileSize: file.size_bytes ? `${(file.size_bytes / (1024 * 1024)).toFixed(1)} MB` : "Document",
        mimeType: file.mime_type,
        storageProvider: file.storage_provider,
        fileStatus: file.status,
        mediaUrl: file.external_url || file.storage_path || "",
      });
    }
    loadPageFiles();
  };

  // Drag and drop state
  const [draggingBlockIndex, setDraggingBlockIndex] = React.useState<number | null>(null);
  const [dropTarget, setDropTarget] = React.useState<{ index: number; position: "before" | "after" } | null>(null);

  // Slash menu state
  const [slashState, setSlashState] = React.useState<{
    blockId: string;
    position: { top: number; left: number };
    query: string;
  } | null>(null);

  // Mention menu state
  const [mentionState, setMentionState] = React.useState<{
    blockId: string;
    position: { top: number; left: number };
    query: string;
  } | null>(null);

  // Link preview popover state
  const [activeLinkAnchor, setActiveLinkAnchor] = React.useState<HTMLAnchorElement | null>(null);

  const blockRefs = React.useRef<Map<string, HTMLElement>>(new Map());
  const saveTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);
  const pendingSaveRef = React.useRef<{ title: string; icon: string; blocks: EditorBlock[] }>({
    title,
    icon,
    blocks,
  });

  // Keep pending save ref up to date
  React.useEffect(() => {
    pendingSaveRef.current = { title, icon, blocks };
  }, [title, icon, blocks]);

  // Undo / Redo History Management
  const undoStackRef = React.useRef<HistoryEntry[]>([]);
  const redoStackRef = React.useRef<HistoryEntry[]>([]);
  const isHistoryApplyingRef = React.useRef(false);
  const lastTypingSnapshotTimeRef = React.useRef(0);

  const pushHistorySnapshot = React.useCallback(
    (customBlocks?: EditorBlock[], customTitle?: string, customIcon?: string) => {
      if (isHistoryApplyingRef.current) return;
      const currentEntry: HistoryEntry = {
        blocks: customBlocks
          ? JSON.parse(JSON.stringify(customBlocks))
          : JSON.parse(JSON.stringify(pendingSaveRef.current.blocks)),
        title: customTitle ?? pendingSaveRef.current.title,
        icon: customIcon ?? pendingSaveRef.current.icon,
        focusedBlockId,
      };

      undoStackRef.current = [...undoStackRef.current.slice(-59), currentEntry];
      redoStackRef.current = [];
    },
    [focusedBlockId]
  );

  const registerRef = React.useCallback((id: string, el: HTMLElement | null) => {
    if (el) {
      blockRefs.current.set(id, el);
    } else {
      blockRefs.current.delete(id);
    }
  }, []);

  // Trigger debounced autosave
  const triggerAutosave = React.useCallback(
    (newBlocks: EditorBlock[], newTitle?: string, newIcon?: string) => {
      // Synchronously update pendingSaveRef so fast navigation/unmount always saves the newest data
      pendingSaveRef.current = {
        title: newTitle !== undefined ? newTitle : pendingSaveRef.current.title,
        icon: newIcon !== undefined ? newIcon : pendingSaveRef.current.icon,
        blocks: newBlocks,
      };

      setSaveStatus("saving");
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }

      saveTimeoutRef.current = setTimeout(async () => {
        try {
          const payloadTitle = newTitle !== undefined ? newTitle : pendingSaveRef.current.title;
          const payloadIcon = newIcon !== undefined ? newIcon : pendingSaveRef.current.icon;
          const res = await savePageContentAction({
            pageId: page.id,
            title: payloadTitle,
            icon: payloadIcon,
            blocks: newBlocks,
          });

          if (res?.success) {
            setSaveStatus("saved");
          } else {
            setSaveStatus("error");
          }
        } catch {
          setSaveStatus("error");
        }
      }, 800);
    },
    [page.id]
  );

  const handleUndo = React.useCallback(() => {
    if (undoStackRef.current.length === 0) return;

    const previous = undoStackRef.current.pop()!;

    const currentSnapshot: HistoryEntry = {
      blocks: JSON.parse(JSON.stringify(pendingSaveRef.current.blocks)),
      title: pendingSaveRef.current.title,
      icon: pendingSaveRef.current.icon,
      focusedBlockId,
    };
    redoStackRef.current.push(currentSnapshot);

    isHistoryApplyingRef.current = true;
    setBlocks(previous.blocks);
    setTitle(previous.title);
    setIcon(previous.icon);
    pendingSaveRef.current = {
      blocks: previous.blocks,
      title: previous.title,
      icon: previous.icon,
    };
    triggerAutosave(previous.blocks, previous.title, previous.icon);

    if (previous.focusedBlockId) {
      setFocusedBlockId(previous.focusedBlockId);
      setTimeout(() => {
        const el = blockRefs.current.get(previous.focusedBlockId!);
        if (el) focusBlockCaretEnd(el);
      }, 20);
    }

    setTimeout(() => {
      isHistoryApplyingRef.current = false;
    }, 50);
  }, [focusedBlockId, triggerAutosave]);

  const handleRedo = React.useCallback(() => {
    if (redoStackRef.current.length === 0) return;

    const next = redoStackRef.current.pop()!;

    const currentSnapshot: HistoryEntry = {
      blocks: JSON.parse(JSON.stringify(pendingSaveRef.current.blocks)),
      title: pendingSaveRef.current.title,
      icon: pendingSaveRef.current.icon,
      focusedBlockId,
    };
    undoStackRef.current.push(currentSnapshot);

    isHistoryApplyingRef.current = true;
    setBlocks(next.blocks);
    setTitle(next.title);
    setIcon(next.icon);
    pendingSaveRef.current = {
      blocks: next.blocks,
      title: next.title,
      icon: next.icon,
    };
    triggerAutosave(next.blocks, next.title, next.icon);

    if (next.focusedBlockId) {
      setFocusedBlockId(next.focusedBlockId);
      setTimeout(() => {
        const el = blockRefs.current.get(next.focusedBlockId!);
        if (el) focusBlockCaretEnd(el);
      }, 20);
    }

    setTimeout(() => {
      isHistoryApplyingRef.current = false;
    }, 50);
  }, [focusedBlockId, triggerAutosave]);

  // Global Undo / Redo keyboard shortcuts (Ctrl+Z, Ctrl+Y, Ctrl+Shift+Z, Cmd+Z, Cmd+Shift+Z)
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept if inside an open modal or input dialog
      const target = e.target as HTMLElement | null;
      if (
        target?.closest("[role='dialog']") ||
        target?.closest(".modal") ||
        target?.classList?.contains("no-undo")
      ) {
        return;
      }

      const isMac =
        typeof navigator !== "undefined" &&
        /Mac|iPod|iPhone|iPad/.test(navigator.platform);
      const modKey = isMac ? e.metaKey : e.ctrlKey;
      if (!modKey) return;

      if (e.key === "z" || e.key === "Z") {
        e.preventDefault();
        e.stopPropagation();
        if (e.shiftKey) {
          handleRedo();
        } else {
          handleUndo();
        }
      } else if (e.key === "y" || e.key === "Y") {
        e.preventDefault();
        e.stopPropagation();
        handleRedo();
      }
    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [handleUndo, handleRedo]);

  // Flush on unmount and beforeunload if saving
  React.useEffect(() => {
    const handleBeforeUnload = () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
        const { title: t, icon: ic, blocks: b } = pendingSaveRef.current;
        savePageContentAction({
          pageId: page.id,
          title: t,
          icon: ic,
          blocks: b,
        }).catch(() => {});
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
        const { title: t, icon: ic, blocks: b } = pendingSaveRef.current;
        savePageContentAction({
          pageId: page.id,
          title: t,
          icon: ic,
          blocks: b,
        }).catch(() => {});
      }
    };
  }, [page.id]);

  // Title change handler
  const handleTitleChange = (newTitle: string) => {
    if (Date.now() - lastTypingSnapshotTimeRef.current > 700) {
      pushHistorySnapshot();
      lastTypingSnapshotTimeRef.current = Date.now();
    }
    setTitle(newTitle);
    pendingSaveRef.current.title = newTitle;
    onPageTitleChange?.(newTitle);
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("cb-page-updated", {
          detail: { pageId: page.id, title: newTitle },
        })
      );
    }
    triggerAutosave(blocks, newTitle, icon);
  };

  // Icon change handler
  const handleIconChange = (newIcon: string) => {
    pushHistorySnapshot();
    setIcon(newIcon);
    pendingSaveRef.current.icon = newIcon;
    onPageIconChange?.(newIcon);
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("cb-page-updated", {
          detail: { pageId: page.id, icon: newIcon },
        })
      );
    }
    triggerAutosave(blocks, title, newIcon);
  };

  // Content update for specific block
  const handleUpdateContent = (id: string, content: string) => {
    if (Date.now() - lastTypingSnapshotTimeRef.current > 700) {
      pushHistorySnapshot();
      lastTypingSnapshotTimeRef.current = Date.now();
    }

    setBlocks((prev) => {
      const next = prev.map((b) =>
        b.id === id
          ? {
              ...b,
              content,
              author: { ...currentAuthorMeta, editedAt: new Date().toISOString() },
            }
          : b
      );
      triggerAutosave(next);
      return next;
    });

    if (slashState && slashState.blockId === id) {
      const slashIndex = content.lastIndexOf("/");
      if (slashIndex >= 0) {
        const query = content.slice(slashIndex + 1).trim();
        setSlashState((prev) => (prev ? { ...prev, query } : null));
      } else {
        setSlashState(null);
      }
    }

    if (mentionState && mentionState.blockId === id) {
      const atIndex = content.lastIndexOf("@");
      if (atIndex >= 0) {
        const query = content.slice(atIndex + 1);
        if (query.includes(" ") || query.length > 30) {
          setMentionState(null);
        } else {
          setMentionState((prev) => (prev ? { ...prev, query } : null));
        }
      } else {
        setMentionState(null);
      }
    }
  };

  // Properties update for specific block
  const handleUpdateProperties = (id: string, properties: Partial<EditorBlock["properties"]>) => {
    pushHistorySnapshot();
    setBlocks((prev) => {
      const next = prev.map((b) =>
        b.id === id ? { ...b, properties: { ...b.properties, ...properties } } : b
      );
      triggerAutosave(next);
      return next;
    });
  };

  // Convert block type
  const handleConvertType = (id: string, newType: BlockType, newContent?: string) => {
    pushHistorySnapshot();
    setBlocks((prev) => {
      const next = prev.map((b) => {
        if (b.id === id) {
          return {
            ...b,
            type: newType,
            content: newContent !== undefined ? newContent : b.content,
            properties: newType === "callout" ? { calloutIcon: "💡" } : (newType === "paragraph" ? undefined : b.properties),
          };
        }
        return b;
      });
      triggerAutosave(next);
      return next;
    });
    setSlashState(null);
    setFocusedBlockId(id);

    setTimeout(() => {
      const el = blockRefs.current.get(id);
      if (el) {
        focusBlockCaretEnd(el);
      }
    }, 20);
  };

  // Insert a new block below index
  const handleInsertBelow = (index: number, type: BlockType = "paragraph") => {
    pushHistorySnapshot();
    const newBlock: EditorBlock = {
      id: crypto.randomUUID(),
      type,
      content: "",
      properties: type === "callout" ? { calloutIcon: "💡" } : undefined,
      author: { ...currentAuthorMeta, editedAt: new Date().toISOString() },
    };

    setBlocks((prev) => {
      const next = [...prev];
      next.splice(index + 1, 0, newBlock);
      triggerAutosave(next);
      return next;
    });

    setTimeout(() => {
      const el = blockRefs.current.get(newBlock.id);
      if (el) {
        focusBlockCaretEnd(el);
        setFocusedBlockId(newBlock.id);
      }
    }, 20);
  };

  // Delete a block
  const handleDeleteBlock = (id: string) => {
    pushHistorySnapshot();
    if (blocks.length <= 1) {
      // Don't leave document with 0 blocks; reset to empty paragraph
      setBlocks([{ id: crypto.randomUUID(), type: "paragraph", content: "" }]);
      triggerAutosave([{ id: crypto.randomUUID(), type: "paragraph", content: "" }]);
      return;
    }

    const index = blocks.findIndex((b) => b.id === id);
    const prevBlock = index > 0 ? blocks[index - 1] : blocks[index + 1];

    setBlocks((prev) => {
      const next = prev.filter((b) => b.id !== id);
      triggerAutosave(next);
      return next;
    });

    if (prevBlock) {
      setFocusedBlockId(prevBlock.id);
      setTimeout(() => {
        const el = blockRefs.current.get(prevBlock.id);
        if (el) {
          focusBlockCaretEnd(el);
        }
      }, 20);
    }
  };

  // Move block up
  const handleMoveUp = (index: number) => {
    if (index === 0) return;
    pushHistorySnapshot();
    setBlocks((prev) => {
      const next = [...prev];
      const temp = next[index];
      next[index] = next[index - 1];
      next[index - 1] = temp;
      triggerAutosave(next);
      return next;
    });
  };

  // Move block down
  const handleMoveDown = (index: number) => {
    if (index === blocks.length - 1) return;
    pushHistorySnapshot();
    setBlocks((prev) => {
      const next = [...prev];
      const temp = next[index];
      next[index] = next[index + 1];
      next[index + 1] = temp;
      triggerAutosave(next);
      return next;
    });
  };

  // Drag & drop handlers
  const handleDragBlockStart = (index: number, e: React.DragEvent) => {
    setDraggingBlockIndex(index);
    e.dataTransfer.setData("text/plain", String(index));
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragBlockOver = (targetIndex: number, position: "before" | "after") => {
    if (draggingBlockIndex === null) return;
    if (draggingBlockIndex === targetIndex) {
      setDropTarget(null);
      return;
    }
    const draggedBlock = blocks[draggingBlockIndex];
    if (draggedBlock && selectedBlockIds.has(draggedBlock.id) && selectedBlockIds.size > 1) {
      const targetBlock = blocks[targetIndex];
      if (targetBlock && selectedBlockIds.has(targetBlock.id)) {
        setDropTarget(null);
        return;
      }
    }
    setDropTarget({ index: targetIndex, position });
  };

  const handleDragBlockLeave = (targetIndex: number) => {
    if (dropTarget?.index === targetIndex) {
      setDropTarget(null);
    }
  };

  const handleDragBlockEnd = () => {
    setDraggingBlockIndex(null);
    setDropTarget(null);
  };

  const handleDropBlock = (targetIndex: number, position: "before" | "after") => {
    if (draggingBlockIndex === null) {
      setDropTarget(null);
      return;
    }

    const fromIndex = draggingBlockIndex;
    setDraggingBlockIndex(null);
    setDropTarget(null);

    const draggedBlock = blocks[fromIndex];
    if (!draggedBlock) return;

    const isMultiDrag = selectedBlockIds.has(draggedBlock.id) && selectedBlockIds.size > 1;

    pushHistorySnapshot();
    setBlocks((prev) => {
      const targetBlock = prev[targetIndex];
      if (!targetBlock) return prev;

      if (isMultiDrag) {
        if (selectedBlockIds.has(targetBlock.id)) return prev;

        const selectedBlocks = prev.filter((b) => selectedBlockIds.has(b.id));
        const remainingBlocks = prev.filter((b) => !selectedBlockIds.has(b.id));

        const newTargetIdx = remainingBlocks.findIndex((b) => b.id === targetBlock.id);
        if (newTargetIdx === -1) return prev;

        const insertIndex = position === "before" ? newTargetIdx : newTargetIdx + 1;
        const next = [...remainingBlocks];
        next.splice(insertIndex, 0, ...selectedBlocks);
        triggerAutosave(next);
        return next;
      } else {
        if (fromIndex === targetIndex) return prev;
        const next = [...prev];
        const [moved] = next.splice(fromIndex, 1);
        if (!moved) return prev;

        let insertIndex = targetIndex;
        if (fromIndex < targetIndex) {
          insertIndex = position === "before" ? targetIndex - 1 : targetIndex;
        } else {
          insertIndex = position === "before" ? targetIndex : targetIndex + 1;
        }

        next.splice(insertIndex, 0, moved);
        triggerAutosave(next);
        return next;
      }
    });
  };

  // Slash trigger from child
  const handleSlashTrigger = (blockId: string, rect: DOMRect) => {
    setSlashState({
      blockId,
      position: {
        top: Math.min(window.innerHeight - 300, rect.bottom + 6),
        left: Math.max(16, rect.left),
      },
      query: "",
    });
  };

  // Mention trigger from child
  const handleMentionTrigger = (blockId: string, rect: DOMRect) => {
    setMentionState({
      blockId,
      position: {
        top: Math.min(window.innerHeight - 300, rect.bottom + 6),
        left: Math.max(16, rect.left),
      },
      query: "",
    });
  };

  // Mention select handler
  const handleMentionSelect = (item: MentionItem) => {
    if (!mentionState) return;
    const targetBlock = blocks.find((b) => b.id === mentionState.blockId);
    if (!targetBlock) return;

    pushHistorySnapshot();
    const cleaned = targetBlock.content.replace(/@([a-zA-Z0-9_-]*)$/, "").trim();
    const mentionText = `@${item.title}`;
    const newContent = cleaned ? `${cleaned} ${mentionText} ` : `${mentionText} `;

    setBlocks((prev) => {
      const next = prev.map((b) => (b.id === mentionState.blockId ? { ...b, content: newContent } : b));
      triggerAutosave(next);
      return next;
    });

    setMentionState(null);
    setFocusedBlockId(targetBlock.id);

    setTimeout(() => {
      const el = blockRefs.current.get(targetBlock.id);
      if (el) focusBlockCaretEnd(el);
    }, 20);
  };

  // Slash select command
  const handleSlashSelect = (item: SlashMenuItem) => {
    if (!slashState) return;
    const targetBlock = blocks.find((b) => b.id === slashState.blockId);
    if (!targetBlock) return;

    pushHistorySnapshot();
    // Clean out trailing slash from content
    const cleanedContent = targetBlock.content.replace(/\/([a-zA-Z0-9_-]*)$/, "").trim();

    // If item has a blockType, convert the block
    if (item.blockType) {
      const type = item.blockType;
      let properties: EditorBlock["properties"] = undefined;

      if (type === "callout") {
        properties = { calloutIcon: "💡" };
      } else if (type === "toggle") {
        properties = { isOpen: true };
      } else if (type === "table") {
        properties = {
          tableData: {
            headers: ["Column 1", "Column 2", "Column 3"],
            rows: [["", "", ""], ["", "", ""]],
          },
        };
      } else if (type === "board") {
        properties = {
          boardData: {
            columns: [
              { id: "col-1", title: "To Do", cards: [{ id: "c-1", text: "First card" }] },
              { id: "col-2", title: "In Progress", cards: [] },
              { id: "col-3", title: "Done", cards: [] },
            ],
          },
        };
      } else if (type === "gallery") {
        properties = {
          galleryData: {
            items: [
              { id: "g-1", title: "Project Overview", tag: "Design" },
              { id: "g-2", title: "System Architecture", tag: "Engineering" },
            ],
          },
        };
      } else if (type === "list") {
        properties = {
          listData: {
            items: [
              { id: "l-1", title: "Review product requirements", status: "Active" },
              { id: "l-2", title: "Implement block persistence", status: "Done" },
            ],
          },
        };
      } else if (type === "calendar") {
        properties = {
          calendarData: {
            events: [
              { id: "ev-1", title: "Team sync & planning", date: new Date().toISOString().split("T")[0] },
            ],
          },
        };
      } else if (type === "equation") {
        properties = { equationFormula: "f(x) = x^2 + 2x + 1" };
      } else if (type === "button") {
        properties = { buttonData: { label: "Action Button", url: "" } };
      } else if (type === "file") {
        properties = { fileName: "document.pdf", fileSize: "1.2 MB", mediaUrl: "" };
      } else if (type === "bookmark") {
        properties = {
          bookmarkTitle: "Company Brain",
          bookmarkUrl: typeof window !== "undefined" ? window.location.href : "",
        };
      }

      setBlocks((prev) => {
        const next = prev.map((b) => {
          if (b.id === slashState.blockId) {
            return {
              ...b,
              type,
              content: cleanedContent,
              properties,
            };
          }
          return b;
        });
        triggerAutosave(next);
        return next;
      });

      setSlashState(null);
      setFocusedBlockId(targetBlock.id);

      if (type === "image" || type === "file" || type === "video" || type === "audio") {
        setFilePickerState({
          isOpen: true,
          blockId: targetBlock.id,
          allowedTypes: type === "image" ? "image" : type === "video" ? "video" : type === "audio" ? "audio" : "all",
        });
      }

      setTimeout(() => {
        const el = blockRefs.current.get(targetBlock.id);
        if (el) {
          focusBlockCaretEnd(el);
        }
      }, 20);
      return;
    }

    // If item has actionId, handle Company Brain actions
    if (item.actionId) {
      setSlashState(null);

      // Clean the slash from the block
      setBlocks((prev) => {
        const next = prev.map((b) =>
          b.id === targetBlock.id ? { ...b, content: cleanedContent } : b
        );
        triggerAutosave(next);
        return next;
      });

      if (item.actionId === "create_page") {
        createPageAction({ parentPageId: page.id, title: "Untitled Subpage" })
          .then((res) => {
            if (res.success && res.page) {
              router.push(`/dashboard/pages/${res.page.id}`);
            }
          })
          .catch((err) => {
            console.error("Failed to create subpage:", err);
          });
        return;
      }

      if (item.actionId === "save_memory") {
        window.alert(
          `Content saved as Memory in Company Brain knowledge base.`
        );
        return;
      }

      if (item.actionId === "mention") {
        setMentionState({
          blockId: targetBlock.id,
          position: slashState.position,
          query: "",
        });
        return;
      }

      const typeMap: Record<string, EntityType> = {
        create_task: "task",
        create_project: "project",
        create_meeting: "meeting",
        create_goal: "goal",
        create_decision: "decision",
        connect: "task",
      };

      const initialType = typeMap[item.actionId] || "task";
      setConnectModalState({
        isOpen: true,
        sourceType: "block",
        sourceId: targetBlock.id,
        initialType,
        initialText: cleanedContent,
      });
    }
  };

  // Keyboard navigation & Enter/Backspace splitting
  const handleKeyDown = (e: React.KeyboardEvent<HTMLElement>, block: EditorBlock, index: number) => {
    // SPACE: Instant markdown trigger for # (H1), ## (H2), ### (H3), lists, etc.
    if (e.key === " " && !e.shiftKey && !e.ctrlKey && !e.altKey && !e.metaKey) {
      const targetEl = (e.currentTarget || (e.target as HTMLElement)?.closest?.('[contenteditable="true"]') || blockRefs.current.get(block.id)) as HTMLElement | null;
      if (targetEl) {
        const rawText = (targetEl.textContent || targetEl.innerText || "").replace(/\u00a0/g, " ").trim();

        // Headings: # -> H1, ## -> H2, ### -> H3
        if (["paragraph", "heading_1", "heading_2", "heading_3"].includes(block.type)) {
          if (rawText === "#") {
            e.preventDefault();
            handleConvertType(block.id, "heading_1", "");
            return;
          }
          if (rawText === "##") {
            e.preventDefault();
            handleConvertType(block.id, "heading_2", "");
            return;
          }
          if (rawText === "###") {
            e.preventDefault();
            handleConvertType(block.id, "heading_3", "");
            return;
          }
        }

        // Other standard Notion markdown block shortcuts
        if (block.type === "paragraph") {
          if (rawText === "-" || rawText === "*") {
            e.preventDefault();
            handleConvertType(block.id, "bullet_list", "");
            return;
          }
          if (/^\d+\.$/.test(rawText)) {
            e.preventDefault();
            handleConvertType(block.id, "numbered_list", "");
            return;
          }
          if (rawText === "[]" || rawText === "[ ]") {
            e.preventDefault();
            handleConvertType(block.id, "checklist", "");
            return;
          }
          if (rawText === ">") {
            e.preventDefault();
            handleConvertType(block.id, "quote", "");
            return;
          }
        }
      }
    }

    // ENTER
    if (e.key === "Enter" && !e.shiftKey) {
      if (block.type === "code") {
        // Allow normal newline inside code block
        return;
      }

      e.preventDefault();

      // If in an empty list item or checklist, pressing Enter turns it back into a paragraph
      if (
        (block.type === "bullet_list" || block.type === "numbered_list" || block.type === "checklist") &&
        (!block.content || block.content.trim() === "")
      ) {
        handleConvertType(block.id, "paragraph");
        return;
      }

      // Next block type: lists and checklists continue to the next item
      const nextType: BlockType =
        block.type === "bullet_list" || block.type === "numbered_list" || block.type === "checklist"
          ? block.type
          : "paragraph";

      handleInsertBelow(index, nextType);
      return;
    }

    // ESCAPE
    if (e.key === "Escape") {
      if (mentionState) {
        e.preventDefault();
        setMentionState(null);
        return;
      }
      if (slashState) {
        e.preventDefault();
        setSlashState(null);
        return;
      }
    }

    // BACKSPACE
    if (e.key === "Backspace") {
      const sel = typeof window !== "undefined" ? window.getSelection() : null;
      const targetEl = (e.currentTarget || (e.target as HTMLElement)?.closest?.('[contenteditable="true"]') || blockRefs.current.get(block.id)) as HTMLElement | null;
      const isEmpty = !block.content || block.content.trim() === "";
      const caretOffset = targetEl ? getCaretOffset(targetEl) : (sel ? sel.anchorOffset : 0);
      const isStartOfBlock = isEmpty || (caretOffset === 0 && Boolean(sel?.isCollapsed));

      if (isStartOfBlock) {
        // If not a paragraph, convert back to paragraph
        if (block.type !== "paragraph") {
          e.preventDefault();
          handleConvertType(block.id, "paragraph");
          return;
        }

        // If already an empty paragraph and there are other blocks, delete this block
        if (blocks.length > 1) {
          e.preventDefault();
          handleDeleteBlock(block.id);
          return;
        }
      }
    }

    // ARROW NAVIGATION
    if (e.key === "ArrowUp" && index > 0) {
      const targetEl = (e.currentTarget || (e.target as HTMLElement)?.closest?.('[contenteditable="true"]') || blockRefs.current.get(block.id)) as HTMLElement | null;
      const caretOffset = targetEl ? getCaretOffset(targetEl) : 0;
      if (caretOffset === 0) {
        const prevBlock = blocks[index - 1];
        const prevEl = blockRefs.current.get(prevBlock.id);
        if (prevEl) {
          e.preventDefault();
          prevEl.focus();
        }
      }
    }

    if (e.key === "ArrowDown" && index < blocks.length - 1) {
      const targetEl = (e.currentTarget || (e.target as HTMLElement)?.closest?.('[contenteditable="true"]') || blockRefs.current.get(block.id)) as HTMLElement | null;
      const caretOffset = targetEl ? getCaretOffset(targetEl) : 0;
      const contentLen = targetEl?.textContent?.length ?? targetEl?.innerText?.length ?? 0;
      if (caretOffset >= contentLen || !contentLen) {
        const nextBlock = blocks[index + 1];
        const nextEl = blockRefs.current.get(nextBlock.id);
        if (nextEl) {
          e.preventDefault();
          nextEl.focus();
        }
      }
    }
  };

  // Inline formatting handler
  const handleFormat = (format: FormatType, value?: string) => {
    pushHistorySnapshot();
    switch (format) {
      case "bold":
        document.execCommand("bold");
        break;
      case "italic":
        document.execCommand("italic");
        break;
      case "underline":
        document.execCommand("underline");
        break;
      case "strike":
        document.execCommand("strikeThrough");
        break;
      case "code": {
        const selection = window.getSelection();
        if (selection && !selection.isCollapsed) {
          const range = selection.getRangeAt(0);

          let container: Node | null = range.commonAncestorContainer;
          if (container.nodeType === Node.TEXT_NODE) {
            container = container.parentNode;
          }
          const existingCode = (container as HTMLElement | null)?.closest("code");

          if (existingCode && existingCode.parentNode) {
            // TOGGLE OFF: The selection is inside an existing <code> element.
            // Split code so only the selected portion is unwrapped, preserving prefix and suffix in code.
            const parent = existingCode.parentNode;

            // 1. Clone prefix before selection inside existingCode
            const preRange = document.createRange();
            preRange.setStart(existingCode, 0);
            preRange.setEnd(range.startContainer, range.startOffset);
            const preFrag = preRange.cloneContents();

            // 2. Clone suffix after selection inside existingCode
            const postRange = document.createRange();
            postRange.setStart(range.endContainer, range.endOffset);
            postRange.setEnd(existingCode, existingCode.childNodes.length);
            const postFrag = postRange.cloneContents();

            // 3. Extract the selected content (to become plain text outside code)
            const selFrag = range.extractContents();
            // Unwrap any code elements if nested inside selFrag
            if (selFrag.querySelectorAll) {
              selFrag.querySelectorAll("code").forEach((c) => {
                c.replaceWith(...Array.from(c.childNodes));
              });
            }

            const hasPre = Boolean(preFrag.textContent && preFrag.textContent.length > 0);
            const hasPost = Boolean(postFrag.textContent && postFrag.textContent.length > 0);

            // Insert prefix code if present
            if (hasPre) {
              const preCode = existingCode.cloneNode(false) as HTMLElement;
              preCode.appendChild(preFrag);
              parent.insertBefore(preCode, existingCode);
            }

            // Insert unwrapped selected content as plain text
            const selNodes = Array.from(selFrag.childNodes);
            parent.insertBefore(selFrag, existingCode);

            // Insert suffix code if present
            if (hasPost) {
              const postCode = existingCode.cloneNode(false) as HTMLElement;
              postCode.appendChild(postFrag);
              parent.insertBefore(postCode, existingCode);
            }

            // Remove the original existingCode
            parent.removeChild(existingCode);

            // Select the newly unwrapped plain text
            selection.removeAllRanges();
            if (selNodes.length > 0) {
              const newRange = document.createRange();
              newRange.setStartBefore(selNodes[0]);
              newRange.setEndAfter(selNodes[selNodes.length - 1]);
              selection.addRange(newRange);
            }
          } else {
            // TOGGLE ON: Wrap selection in <code> and merge with adjacent code siblings
            const clone = range.cloneContents();
            const childCodes = clone.querySelectorAll ? clone.querySelectorAll("code") : [];
            let extracted: DocumentFragment;

            if (childCodes.length > 0) {
              // Strip code tags inside selection so we don't nest them
              extracted = range.extractContents();
              const tempDiv = document.createElement("div");
              tempDiv.appendChild(extracted);
              tempDiv.querySelectorAll("code").forEach((c) => {
                c.replaceWith(...Array.from(c.childNodes));
              });
              const frag = document.createDocumentFragment();
              while (tempDiv.firstChild) {
                frag.appendChild(tempDiv.firstChild);
              }
              extracted = frag;
            } else {
              extracted = range.extractContents();
            }

            const codeEl = document.createElement("code");
            codeEl.className =
              "px-0.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800/80 font-mono text-xs text-zinc-900 dark:text-white border border-zinc-200 dark:border-zinc-700/60";
            codeEl.appendChild(extracted);
            range.insertNode(codeEl);

            // MERGE WITH ADJACENT CODE SIBLINGS:
            // If the code touches an existing code element before or after, merge them into 1 unified code
            let targetCode: HTMLElement = codeEl;

            // 1. Check previous sibling
            const prev = targetCode.previousSibling;
            if (prev && prev.nodeType === Node.ELEMENT_NODE && (prev as HTMLElement).nodeName === "CODE") {
              const prevCode = prev as HTMLElement;
              while (targetCode.firstChild) {
                prevCode.appendChild(targetCode.firstChild);
              }
              targetCode.remove();
              targetCode = prevCode;
            }

            // 2. Check next sibling
            const next = targetCode.nextSibling;
            if (next && next.nodeType === Node.ELEMENT_NODE && (next as HTMLElement).nodeName === "CODE") {
              const nextCode = next as HTMLElement;
              while (nextCode.firstChild) {
                targetCode.appendChild(nextCode.firstChild);
              }
              nextCode.remove();
            }

            // Select the resulting code element
            selection.removeAllRanges();
            const newRange = document.createRange();
            newRange.selectNodeContents(targetCode);
            selection.addRange(newRange);
          }

          // Trigger input on the contentEditable container to notify React state & autosave
          const editable = (
            range.commonAncestorContainer.nodeType === Node.TEXT_NODE
              ? range.commonAncestorContainer.parentElement
              : (range.commonAncestorContainer as HTMLElement)
          )?.closest("[contenteditable='true']");
          if (editable) {
            editable.dispatchEvent(new Event("input", { bubbles: true }));
          }
        }
        break;
      }
      case "link":
        if (value) {
          document.execCommand("createLink", false, value);
          const selection = window.getSelection();
          if (selection && !selection.isCollapsed) {
            const range = selection.getRangeAt(0);
            let container: Node | null = range.commonAncestorContainer;
            if (container.nodeType === Node.TEXT_NODE) container = container.parentNode;
            const anchors = (container as HTMLElement | null)?.querySelectorAll("a");
            anchors?.forEach((a) => {
              a.setAttribute("target", "_blank");
              a.setAttribute("rel", "noopener noreferrer");
              a.setAttribute("title", `Ctrl + clique para abrir: ${value}`);
            });
            const closestAnchor = (container as HTMLElement | null)?.closest("a");
            if (closestAnchor) {
              closestAnchor.setAttribute("target", "_blank");
              closestAnchor.setAttribute("rel", "noopener noreferrer");
              closestAnchor.setAttribute("title", `Ctrl + clique para abrir: ${value}`);
            }

            const editable = (
              range.commonAncestorContainer.nodeType === Node.TEXT_NODE
                ? range.commonAncestorContainer.parentElement
                : (range.commonAncestorContainer as HTMLElement)
            )?.closest("[contenteditable='true']");
            if (editable) {
              editable.dispatchEvent(new Event("input", { bubbles: true }));
            }
          }
        } else {
          document.execCommand("unlink");
        }
        break;
      case "unlink":
        document.execCommand("unlink");
        break;
      case "color": {
        const selection = window.getSelection();
        if (selection && !selection.isCollapsed) {
          try {
            document.execCommand("styleWithCSS", false, "true");
          } catch {}

          if (value && value !== "inherit" && value !== "default") {
            document.execCommand("foreColor", false, value);
          } else {
            document.execCommand("foreColor", false, "inherit");
          }

          const range = selection.rangeCount > 0 ? selection.getRangeAt(0) : null;
          if (range) {
            const editable = (
              range.commonAncestorContainer.nodeType === Node.TEXT_NODE
                ? range.commonAncestorContainer.parentElement
                : (range.commonAncestorContainer as HTMLElement)
            )?.closest("[contenteditable='true']");
            if (editable) {
              editable.dispatchEvent(new Event("input", { bubbles: true }));
            }
          }
        }
        break;
      }
      case "highlight":
        if (value && value !== "transparent") {
          document.execCommand("hiliteColor", false, value);
        } else {
          document.execCommand("hiliteColor", false, "transparent");
        }
        break;
      case "align-left":
        document.execCommand("justifyLeft");
        break;
      case "align-center":
        document.execCommand("justifyCenter");
        break;
      case "align-right":
        document.execCommand("justifyRight");
        break;
    }
  };

  // Transform block type from toolbar
  const handleTransformBlock = (newType: BlockType) => {
    if (focusedBlockId) {
      handleConvertType(focusedBlockId, newType);
    } else if (blocks.length > 0) {
      handleConvertType(blocks[0].id, newType);
    }
  };

  // Duplicate a block below
  const handleDuplicateBlock = (index: number) => {
    const target = blocks[index];
    if (!target) return;
    pushHistorySnapshot();
    const duplicated: EditorBlock = {
      ...target,
      id: crypto.randomUUID(),
      properties: target.properties ? { ...target.properties } : undefined,
    };
    setBlocks((prev) => {
      const next = [...prev];
      next.splice(index + 1, 0, duplicated);
      triggerAutosave(next);
      return next;
    });
  };

  // Connect block to entity
  const handleConnectBlock = (blockId: string, initialText: string) => {
    setConnectModalState({
      isOpen: true,
      sourceType: "block",
      sourceId: blockId,
      initialType: "task",
      initialText,
    });
  };

  // Handle Company Brain toolbar actions from selected text
  const handleCompanyBrainToolbarAction = (
    action: CompanyBrainToolbarAction,
    selectedText: string
  ) => {
    if (action === "save-memory") {
      window.alert(
        `Draft memory for "${selectedText.slice(0, 40)}${selectedText.length > 40 ? "..." : ""}" saved to Company Brain Memory draft.`
      );
      return;
    }

    const typeMap: Record<string, EntityType> = {
      "create-task": "task",
      "create-decision": "decision",
      "add-project": "project",
      "add-meeting": "meeting",
      "create-goal": "goal",
      connect: "task",
    };

    const initialType = typeMap[action] || "task";
    setConnectModalState({
      isOpen: true,
      sourceType: focusedBlockId ? "block" : "page",
      sourceId: focusedBlockId || page.id,
      initialType,
      initialText: selectedText,
    });
  };

  // Remove connection reference
  const handleRemoveConnection = async (connectionId: string) => {
    setConnections((prev) => prev.filter((c) => c.id !== connectionId));
    await removeConnectionAction(connectionId);
  };

  // Apply template
  const handleApplyTemplate = (tmpl: PageTemplate) => {
    pushHistorySnapshot();
    const newBlocks = tmpl.blocks.map((b) => ({
      ...b,
      id: crypto.randomUUID(),
    }));
    setBlocks(newBlocks);
    if (tmpl.name && title === "Untitled") {
      setTitle(tmpl.name);
      onPageTitleChange?.(tmpl.name);
    }
    if (tmpl.icon) {
      setIcon(tmpl.icon);
      onPageIconChange?.(tmpl.icon);
    }
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("cb-page-updated", {
          detail: {
            pageId: page.id,
            title: tmpl.name && title === "Untitled" ? tmpl.name : title,
            icon: tmpl.icon || icon,
          },
        })
      );
    }
    triggerAutosave(newBlocks, tmpl.name || title, tmpl.icon || icon);
  };

  // Handle Shift+Click range selection
  const handleBlockClickWithShift = React.useCallback(
    (clickedBlockId: string) => {
      if (!focusedBlockId) {
        setSelectedBlockIds(new Set([clickedBlockId]));
        return;
      }
      const idx1 = blocks.findIndex((b) => b.id === focusedBlockId);
      const idx2 = blocks.findIndex((b) => b.id === clickedBlockId);
      if (idx1 === -1 || idx2 === -1) {
        setSelectedBlockIds(new Set([clickedBlockId]));
        return;
      }
      const start = Math.min(idx1, idx2);
      const end = Math.max(idx1, idx2);
      const rangeIds = new Set<string>();
      for (let i = start; i <= end; i++) {
        rangeIds.add(blocks[i].id);
      }
      setSelectedBlockIds(rangeIds);
    },
    [blocks, focusedBlockId]
  );

  // Batch delete selected blocks
  const handleBatchDelete = React.useCallback(() => {
    if (selectedBlockIds.size === 0) return;
    pushHistorySnapshot();
    setBlocks((prev) => {
      const remaining = prev.filter((b) => !selectedBlockIds.has(b.id));
      const next: EditorBlock[] =
        remaining.length > 0
          ? remaining
          : [{ id: crypto.randomUUID(), type: "paragraph" as const, content: "" }];
      triggerAutosave(next);
      return next;
    });
    setSelectedBlockIds(new Set());
    setBatchTransformOpen(false);
  }, [pushHistorySnapshot, selectedBlockIds, triggerAutosave]);

  // Batch duplicate selected blocks
  const handleBatchDuplicate = React.useCallback(() => {
    if (selectedBlockIds.size === 0) return;
    pushHistorySnapshot();
    setBlocks((prev) => {
      const selectedList = prev.filter((b) => selectedBlockIds.has(b.id));
      if (selectedList.length === 0) return prev;

      let lastIndex = -1;
      prev.forEach((b, idx) => {
        if (selectedBlockIds.has(b.id)) lastIndex = idx;
      });

      const clones: EditorBlock[] = selectedList.map((b) => ({
        ...b,
        id: crypto.randomUUID(),
        properties: b.properties ? { ...b.properties } : undefined,
      }));

      const next = [...prev];
      next.splice(lastIndex + 1, 0, ...clones);
      triggerAutosave(next);

      const newIds = new Set(clones.map((c) => c.id));
      setSelectedBlockIds(newIds);
      return next;
    });
    setBatchTransformOpen(false);
  }, [pushHistorySnapshot, selectedBlockIds, triggerAutosave]);

  // Batch transform block types
  const handleBatchTransform = (newType: BlockType) => {
    if (selectedBlockIds.size === 0) return;
    pushHistorySnapshot();
    setBlocks((prev) => {
      const next = prev.map((b) => {
        if (selectedBlockIds.has(b.id)) {
          return {
            ...b,
            type: newType,
            properties:
              newType === "checklist"
                ? { ...b.properties, checked: false }
                : b.properties,
          };
        }
        return b;
      });
      triggerAutosave(next);
      return next;
    });
    setBatchTransformOpen(false);
  };

  // Batch copy plain text of selected blocks
  const handleBatchCopy = React.useCallback(async () => {
    const selectedList = blocks.filter((b) => selectedBlockIds.has(b.id));
    if (selectedList.length === 0) return;
    const plainText = selectedList
      .map((b) => (b.content || "").replace(/<[^>]*>?/gm, "").trim())
      .join("\n");
    await navigator.clipboard.writeText(plainText);
  }, [blocks, selectedBlockIds]);

  // Batch move selected blocks up
  const handleBatchMoveUp = React.useCallback(() => {
    if (selectedBlockIds.size === 0) return;
    pushHistorySnapshot();
    setBlocks((prev) => {
      const selectedIndices = prev
        .map((b, idx) => (selectedBlockIds.has(b.id) ? idx : -1))
        .filter((idx) => idx !== -1)
        .sort((a, b) => a - b);

      if (selectedIndices.length === 0 || selectedIndices[0] === 0) {
        return prev;
      }

      const next = [...prev];
      for (const idx of selectedIndices) {
        const temp = next[idx];
        next[idx] = next[idx - 1];
        next[idx - 1] = temp;
      }

      triggerAutosave(next);
      return next;
    });
  }, [pushHistorySnapshot, selectedBlockIds, triggerAutosave]);

  // Batch move selected blocks down
  const handleBatchMoveDown = React.useCallback(() => {
    if (selectedBlockIds.size === 0) return;
    pushHistorySnapshot();
    setBlocks((prev) => {
      const selectedIndices = prev
        .map((b, idx) => (selectedBlockIds.has(b.id) ? idx : -1))
        .filter((idx) => idx !== -1)
        .sort((a, b) => b - a);

      if (selectedIndices.length === 0 || selectedIndices[0] === prev.length - 1) {
        return prev;
      }

      const next = [...prev];
      for (const idx of selectedIndices) {
        const temp = next[idx];
        next[idx] = next[idx + 1];
        next[idx + 1] = temp;
      }

      triggerAutosave(next);
      return next;
    });
  }, [pushHistorySnapshot, selectedBlockIds, triggerAutosave]);

  // Page-Wide MouseDown: initiates Marquee (drag-to-select) anywhere on the page, except sidebar
  React.useEffect(() => {
    const handleGlobalMouseDown = (e: MouseEvent) => {
      if (e.button !== 0) return; // Left click only

      const target = e.target as HTMLElement | null;
      if (!target) return;

      // 1. STRICTLY EXCLUDE SIDEBAR & SIDEBAR TRIGGER
      if (
        target.closest(
          'aside[data-sidebar="true"], [data-sidebar="true"], [data-sidebar-trigger="true"], #main-sidebar'
        )
      ) {
        return;
      }

      // 2. EXCLUDE MODALS & FLOATING DIALOGS
      if (
        target.closest(
          '[role="dialog"], [role="alertdialog"], .modal, [data-modal]'
        )
      ) {
        return;
      }

      // 3. EXCLUDE INTERACTIVE CONTROLS, CODE CONTAINERS & TOOLBARS
      if (
        target.closest(
          'button, input, textarea, a, select, [draggable="true"], [role="button"], [data-no-marquee], [data-toolbar], pre, code, [data-code-block], .select-text'
        )
      ) {
        return;
      }

      // 4. CHECK IF CLICKING INSIDE CONTENTEDITABLE TEXT
      const contentEditable = target.closest('[contenteditable="true"]');
      if (contentEditable) {
        if (e.shiftKey) {
          const blockEl = target.closest<HTMLElement>("[data-block-id]");
          const clickedId = blockEl?.getAttribute("data-block-id");
          if (clickedId) {
            e.preventDefault();
            handleBlockClickWithShift(clickedId);
            return;
          }
        }
        if (selectedBlockIds.size > 0) {
          setSelectedBlockIds(new Set());
        }
        return;
      }

      // 5. ANYWHERE ELSE ON THE PAGE:
      // Clicking in empty areas (left/right whitespace, bottom empty area, gutters, margins, paddings)
      if (!e.shiftKey && !e.ctrlKey && !e.metaKey) {
        setSelectedBlockIds(new Set());
      }

      const startX = e.clientX;
      const startY = e.clientY;
      isMarqueeRef.current = false;

      const onMouseMove = (moveEvent: MouseEvent) => {
        const dist = Math.hypot(moveEvent.clientX - startX, moveEvent.clientY - startY);
        if (dist > 6) {
          if (!isMarqueeRef.current) {
            isMarqueeRef.current = true;
            setIsMarqueeSelecting(true);
          }
          window.getSelection()?.removeAllRanges();

          setMarqueeRect({
            startX,
            startY,
            currentX: moveEvent.clientX,
            currentY: moveEvent.clientY,
          });

          const boxLeft = Math.min(startX, moveEvent.clientX);
          const boxTop = Math.min(startY, moveEvent.clientY);
          const boxRight = Math.max(startX, moveEvent.clientX);
          const boxBottom = Math.max(startY, moveEvent.clientY);

          const blockEls = document.querySelectorAll<HTMLElement>("[data-block-id]");
          const intersected = new Set<string>();

          blockEls.forEach((el) => {
            const rect = el.getBoundingClientRect();
            const intersects = !(
              rect.bottom < boxTop ||
              rect.top > boxBottom ||
              rect.right < boxLeft ||
              rect.left > boxRight
            );
            if (intersects) {
              const id = el.getAttribute("data-block-id");
              if (id) intersected.add(id);
            }
          });

          setSelectedBlockIds(intersected);
        }
      };

      const onMouseUp = () => {
        window.removeEventListener("mousemove", onMouseMove);
        window.removeEventListener("mouseup", onMouseUp);
        setMarqueeRect(null);
        setIsMarqueeSelecting(false);

        if (isMarqueeRef.current) {
          isMarqueeRef.current = false;
          if (document.activeElement instanceof HTMLElement) {
            document.activeElement.blur();
          }
        }
      };

      window.addEventListener("mousemove", onMouseMove);
      window.addEventListener("mouseup", onMouseUp);
    };

    window.addEventListener("mousedown", handleGlobalMouseDown);
    return () => window.removeEventListener("mousedown", handleGlobalMouseDown);
  }, [handleBlockClickWithShift, selectedBlockIds]);

  // Keyboard shortcuts when blocks are multi-selected
  React.useEffect(() => {
    if (selectedBlockIds.size === 0) return;

    const handleKeyDown = async (e: KeyboardEvent) => {
      if (
        document.activeElement instanceof HTMLInputElement ||
        document.activeElement instanceof HTMLTextAreaElement
      ) {
        return;
      }

      // Escape -> Clear selection
      if (e.key === "Escape") {
        e.preventDefault();
        setSelectedBlockIds(new Set());
        setBatchTransformOpen(false);
        return;
      }

      // Backspace / Delete -> Delete all selected blocks
      if (e.key === "Backspace" || e.key === "Delete") {
        e.preventDefault();
        handleBatchDelete();
        return;
      }

      // Ctrl+C / Cmd+C -> Copy all selected blocks
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "c") {
        e.preventDefault();
        await handleBatchCopy();
        return;
      }

      // Ctrl+X / Cmd+X -> Cut all selected blocks
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "x") {
        e.preventDefault();
        await handleBatchCopy();
        handleBatchDelete();
        return;
      }

      // Ctrl+D / Cmd+D -> Duplicate all selected blocks
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "d") {
        e.preventDefault();
        handleBatchDuplicate();
        return;
      }

      // Alt+ArrowUp -> Move selected blocks up
      if (e.altKey && e.key === "ArrowUp") {
        e.preventDefault();
        handleBatchMoveUp();
        return;
      }

      // Alt+ArrowDown -> Move selected blocks down
      if (e.altKey && e.key === "ArrowDown") {
        e.preventDefault();
        handleBatchMoveDown();
        return;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    selectedBlockIds,
    handleBatchDelete,
    handleBatchDuplicate,
    handleBatchCopy,
    handleBatchMoveUp,
    handleBatchMoveDown,
  ]);

  const handleEditorClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    const anchor = target.closest("a");

    if (anchor) {
      const href = anchor.getAttribute("href");
      if (href) {
        // Holding Ctrl or Cmd immediately opens the link in a new tab
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          e.stopPropagation();
          window.open(href, "_blank", "noopener,noreferrer");
          return;
        }

        // Open the interactive preview popover attached to this link
        e.preventDefault();
        e.stopPropagation();
        setActiveLinkAnchor(anchor);
        return;
      }
    }

    if (activeLinkAnchor) {
      setActiveLinkAnchor(null);
    }
  };

  const isPageEmpty = blocks.length <= 1 && (!blocks[0].content || blocks[0].content.trim() === "");

  return (
    <div
      onClick={handleEditorClick}
      className="relative w-full min-h-[calc(100vh-140px)] flex flex-col flex-1 pb-48"
    >
      <div className="w-full max-w-6xl mx-auto flex-1 flex flex-col">
      {/* Connect & Entity Creation Modal */}
      <ConnectModal
        isOpen={connectModalState.isOpen}
        onClose={() => setConnectModalState((prev) => ({ ...prev, isOpen: false }))}
        pageId={page.id}
        sourceType={connectModalState.sourceType}
        sourceId={connectModalState.sourceId}
        initialType={connectModalState.initialType}
        initialText={connectModalState.initialText}
        onConnectionCreated={(conn) => {
          setConnections((prev) => [conn, ...prev]);
        }}
      />

      {/* File & Cloud Storage Attachment Modal */}
      <FilePickerModal
        isOpen={filePickerState.isOpen}
        onClose={() => setFilePickerState((prev) => ({ ...prev, isOpen: false }))}
        pageId={page.id}
        blockId={filePickerState.blockId}
        allowedTypes={filePickerState.allowedTypes}
        onFileSelected={handleFileSelected}
      />

      {/* Floating Toolbar for Inline Marks & Company Brain Transform */}
      <FloatingFormatToolbar
        onFormat={handleFormat}
        onTransformBlock={handleTransformBlock}
        onCompanyBrainAction={handleCompanyBrainToolbarAction}
      />

      {/* Link Preview & Action Popover */}
      <LinkPreviewPopover
        anchorEl={activeLinkAnchor}
        onClose={() => setActiveLinkAnchor(null)}
        onEdit={(anchor) => {
          const selection = window.getSelection();
          if (selection) {
            selection.removeAllRanges();
            const range = document.createRange();
            range.selectNodeContents(anchor);
            selection.addRange(range);
            document.dispatchEvent(new Event("selectionchange"));
          }
        }}
        onUnlink={(anchor) => {
          const parent = anchor.parentNode;
          if (parent) {
            const textNode = document.createTextNode(anchor.textContent || "");
            parent.replaceChild(textNode, anchor);
            parent.normalize();

            const editable = textNode.parentElement?.closest("[contenteditable='true']");
            if (editable) {
              editable.dispatchEvent(new Event("input", { bubbles: true }));
            }
          }
        }}
      />

      {/* Slash Command Palette */}
      {slashState && (
        <SlashMenu
          query={slashState.query}
          onSelect={handleSlashSelect}
          onClose={() => setSlashState(null)}
          position={slashState.position}
        />
      )}

      {/* Inline Mention Menu */}
      {mentionState && (
        <MentionMenu
          query={mentionState.query}
          onSelect={handleMentionSelect}
          onClose={() => setMentionState(null)}
          position={mentionState.position}
        />
      )}

      {/* Clean Company Brain Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-4 pb-6 border-b border-zinc-100 dark:border-zinc-800/80 mb-6">
        <div className="flex items-start sm:items-center gap-4 min-w-0 flex-1">
          <EmojiPicker
            currentEmoji={icon}
            onSelectEmoji={handleIconChange}
            pageId={page.id}
            iconFileId={page.icon_file_id}
            triggerClassName="h-14 w-14 sm:h-16 sm:w-16 text-4xl sm:text-5xl shrink-0 rounded-2xl hover:bg-zinc-100 dark:hover:bg-zinc-800/60 transition-all"
          />

          <div className="flex flex-col min-w-0 flex-1 justify-center">
            {/* Page Title Input */}
            <input
              type="text"
              value={title}
              onChange={(e) => handleTitleChange(e.target.value)}
              placeholder="Untitled"
              className="w-full bg-transparent text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-zinc-950 dark:text-zinc-50 placeholder:text-zinc-300 dark:placeholder:text-zinc-700 outline-none border-none p-0 focus:ring-0 truncate py-1"
            />

            {/* Subtle Authorship & Relative Timestamp */}
            <div className="flex items-center gap-1.5 mt-0.5 text-xs text-zinc-400 dark:text-zinc-500 font-normal">
              <button
                type="button"
                onClick={() => setInfoModalOpen(true)}
                className="inline-flex items-center gap-1 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors cursor-pointer group text-left"
                title={formatExactDateTime(page.updated_at || page.created_at)}
              >
                <span className="font-medium text-zinc-500 dark:text-zinc-400 group-hover:text-zinc-800 dark:group-hover:text-zinc-200 transition-colors">
                  {page.last_edited_by_profile?.full_name ||
                    page.last_edited_by_profile?.email ||
                    page.created_by_profile?.full_name ||
                    page.created_by_profile?.email ||
                    (page.created_by ? "Team member" : "System")}
                </span>
                <span>·</span>
                <span>{formatRelativeTime(page.updated_at || page.created_at)}</span>
              </button>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Header Action Controls [⭐] [+ Add] [Connect] [View] [💬] [🕐] [...] */}
          <PageHeaderActions
            currentView={viewMode}
            connectionsCount={connections.length}
            commentsCount={comments.filter((c) => !c.is_resolved).length}
            isFavorite={isFavorite}
            onToggleFavorite={handleToggleFavorite}
            onViewChange={(view) => setViewMode(view)}
            onAddBlock={() => handleInsertBelow(blocks.length - 1)}
            onAddSubpage={() => {
              createPageAction({ parentPageId: page.id, title: "Untitled Subpage" })
                .then((res) => {
                  if (res.success && res.page) {
                    router.push(`/dashboard/pages/${res.page.id}`);
                  }
                })
                .catch((err) => {
                  console.error("Failed to create subpage:", err);
                });
            }}
            onOpenConnectModal={() => {
              setConnectModalState({
                isOpen: true,
                sourceType: "page",
                sourceId: page.id,
                initialType: "task",
                initialText: "",
              });
            }}
            onCopyPageLink={async () => {
              await navigator.clipboard.writeText(window.location.href);
            }}
            onOpenComments={() => setCommentsDrawerOpen(true)}
            onOpenActivity={() => setActivityDrawerOpen(true)}
            onOpenPageInfo={() => setInfoModalOpen(true)}
          />

          {/* Real-time Autosave & Persistence Status Indicator */}
          <div className="flex items-center gap-1.5 text-[11px] font-medium px-2 py-1 rounded-md bg-zinc-100/70 dark:bg-zinc-800/60 border border-zinc-200/80 dark:border-zinc-700/60 select-none">
            {saveStatus === "saving" && (
              <span className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400">
                <Loader2 className="h-3 w-3 animate-spin" />
                <span className="hidden sm:inline">A guardar...</span>
              </span>
            )}
            {saveStatus === "saved" && (
              <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                <Check className="h-3 w-3" />
                <span className="hidden sm:inline">Guardado</span>
              </span>
            )}
            {saveStatus === "error" && (
              <span className="flex items-center gap-1 text-red-500">
                <AlertCircle className="h-3.5 w-3.5" />
                <span>Erro ao guardar</span>
                <button
                  type="button"
                  onClick={() => {
                    const { title: t, icon: ic, blocks: b } = pendingSaveRef.current;
                    setSaveStatus("saving");
                    savePageContentAction({
                      pageId: page.id,
                      title: t,
                      icon: ic,
                      blocks: b,
                    })
                      .then((res) => setSaveStatus(res?.success ? "saved" : "error"))
                      .catch(() => setSaveStatus("error"));
                  }}
                  className="underline ml-1 cursor-pointer font-semibold hover:opacity-80"
                >
                  Tentar
                </button>
              </span>
            )}
          </div>
        </div>
      </div>

      {/* VIEW 1: EDITOR */}
      {viewMode === "editor" && (
        <>
          {/* Page Attachments (Internal & External files) */}
          <PageAttachmentsPanel
            pageId={page.id}
            files={pageFiles}
            onAddClick={() => setFilePickerState({ isOpen: true, allowedTypes: "all" })}
            onRefresh={loadPageFiles}
          />

          {/* Block Stream */}
          <div className="space-y-2">
            {(() => {
              let currentListNumber = 0;
              return blocks.map((block, idx) => {
                if (block.type === "numbered_list") {
                  currentListNumber += 1;
                } else {
                  currentListNumber = 0;
                }
                const listNumber = block.type === "numbered_list" ? currentListNumber : undefined;

                return (
                  <BlockItem
                    key={block.id}
                    block={block}
                    index={idx}
                    allBlocks={blocks}
                    pageTitle={title}
                    listNumber={listNumber}
                    totalBlocks={blocks.length}
                    isFocused={focusedBlockId === block.id}
                    isDragging={
                      draggingBlockIndex === idx ||
                      (draggingBlockIndex !== null &&
                        blocks[draggingBlockIndex] &&
                        selectedBlockIds.has(blocks[draggingBlockIndex].id) &&
                        selectedBlockIds.has(block.id))
                    }
                    dropIndicatorPosition={dropTarget?.index === idx ? dropTarget.position : null}
                    isSelected={selectedBlockIds.has(block.id)}
                    connections={connections}
                    fallbackAuthorProfile={page.last_edited_by_profile || page.created_by_profile}
                    fallbackAuthorDate={page.updated_at || page.created_at}
                    isAuthorHighlighted={isBlockAuthorHighlighted(block)}
                    onToggleAuthorHighlight={toggleAuthorHighlight}
                    highlightedAuthorKey={highlightedAuthorKey}
                    onUpdateContent={handleUpdateContent}
                    onUpdateProperties={handleUpdateProperties}
                    onConvertType={handleConvertType}
                    onInsertBelow={handleInsertBelow}
                    onDeleteBlock={handleDeleteBlock}
                    onMoveUp={handleMoveUp}
                    onMoveDown={handleMoveDown}
                    onDuplicateBlock={handleDuplicateBlock}
                    onConnectBlock={handleConnectBlock}
                    onCompanyBrainAction={handleCompanyBrainToolbarAction}
                    onClickConnection={(conn) => {
                      setViewMode("connections");
                    }}
                    onKeyDown={handleKeyDown}
                    onSlashTrigger={handleSlashTrigger}
                    onMentionTrigger={handleMentionTrigger}
                    registerRef={registerRef}
                    onFocusBlock={(id) => {
                      setFocusedBlockId(id);
                      if (slashState && slashState.blockId !== id) setSlashState(null);
                      if (mentionState && mentionState.blockId !== id) setMentionState(null);
                    }}
                    onOpenFilePicker={(blockId, allowedTypes) =>
                      setFilePickerState({ isOpen: true, blockId, allowedTypes })
                    }
                    onDragBlockStart={handleDragBlockStart}
                    onDragBlockOver={handleDragBlockOver}
                    onDragBlockLeave={handleDragBlockLeave}
                    onDragBlockEnd={handleDragBlockEnd}
                    onDropBlock={handleDropBlock}
                  />
                );
              });
            })()}
          </div>

          {/* Template Suggestions if Document is Empty - rendered below the first block like Notion */}
          {isPageEmpty && (
            <TemplatePicker onApplyTemplate={handleApplyTemplate} />
          )}
        </>
      )}

      {/* VIEW 2: OUTLINE */}
      {viewMode === "outline" && (
        <PageOutlineView
          pageId={page.id}
          iconFileId={page.icon_file_id}
          pageTitle={title}
          pageIcon={icon}
          blocks={blocks}
          onSelectHeading={(blockId) => {
            setViewMode("editor");
            setTimeout(() => {
              const el = blockRefs.current.get(blockId);
              if (el) {
                el.scrollIntoView({ behavior: "smooth", block: "center" });
                focusBlockCaretEnd(el);
              }
            }, 60);
          }}
        />
      )}

      {/* VIEW 3: CONNECTIONS */}
      {viewMode === "connections" && (
        <PageConnectionsView
          pageId={page.id}
          iconFileId={page.icon_file_id}
          pageTitle={title}
          pageIcon={icon}
          connections={connections}
          onOpenConnectModal={() => {
            setConnectModalState({
              isOpen: true,
              sourceType: "page",
              sourceId: page.id,
              initialType: "task",
              initialText: "",
            });
          }}
          onRemoveConnection={handleRemoveConnection}
          onNavigateToBlock={(blockId) => {
            setViewMode("editor");
            setTimeout(() => {
              const el = blockRefs.current.get(blockId);
              if (el) {
                el.scrollIntoView({ behavior: "smooth", block: "center" });
                focusBlockCaretEnd(el);
              }
            }, 60);
          }}
        />
      )}
      </div>

      {/* Windows-style Selection Marquee Box */}
      {marqueeRect && (
        <div
          style={{
            position: "fixed",
            left: Math.min(marqueeRect.startX, marqueeRect.currentX),
            top: Math.min(marqueeRect.startY, marqueeRect.currentY),
            width: Math.abs(marqueeRect.currentX - marqueeRect.startX),
            height: Math.abs(marqueeRect.currentY - marqueeRect.startY),
          }}
          className="pointer-events-none z-50 rounded border border-blue-500/80 bg-blue-500/15 backdrop-blur-[0.5px] transition-none"
        />
      )}

      {/* Floating Multi-Block Actions Bar */}
      {selectedBlockIds.size > 0 && !isMarqueeSelecting && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-1.5 rounded-xl border border-zinc-200/90 dark:border-zinc-800/90 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md px-3 py-2 shadow-2xl animate-in fade-in slide-in-from-bottom-3 duration-150 select-none">
          <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800">
            {selectedBlockIds.size} {selectedBlockIds.size === 1 ? "line" : "lines"}
          </span>

          <div className="h-4 w-px bg-zinc-200 dark:bg-zinc-800 mx-1" />

          {/* Transform dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setBatchTransformOpen(!batchTransformOpen)}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            >
              <Sparkles className="h-3.5 w-3.5 text-indigo-500" />
              <span>Transform</span>
              <ChevronDown className="h-3 w-3 text-zinc-400" />
            </button>

            {batchTransformOpen && (
              <div className="absolute bottom-9 left-0 z-50 w-44 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-1.5 shadow-xl animate-in fade-in zoom-in-95 duration-100">
                {(
                  [
                    { type: "paragraph", label: "Text", icon: "P" },
                    { type: "checklist", label: "To-do list", icon: CheckSquare },
                    { type: "bullet_list", label: "Bullet list", icon: List },
                    { type: "numbered_list", label: "Numbered list", icon: ListOrdered },
                    { type: "heading_1", label: "Heading 1", icon: Heading1 },
                    { type: "heading_2", label: "Heading 2", icon: Heading2 },
                    { type: "heading_3", label: "Heading 3", icon: Heading3 },
                    { type: "quote", label: "Quote", icon: Quote },
                    { type: "code", label: "Code", icon: CodeIcon },
                  ] as const
                ).map((item) => {
                  const ItemIcon = item.icon;
                  return (
                    <button
                      key={item.type}
                      type="button"
                      onClick={() => handleBatchTransform(item.type as BlockType)}
                      className="flex w-full items-center gap-2 rounded-md px-2 py-1 text-xs text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                    >
                      {typeof ItemIcon === "string" ? (
                        <span className="font-mono text-xs w-3 text-center">{ItemIcon}</span>
                      ) : (
                        <ItemIcon className="h-3 w-3 text-zinc-500" />
                      )}
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Move Up */}
          <button
            type="button"
            onClick={handleBatchMoveUp}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            title="Move selected lines up (Alt+↑)"
          >
            <ArrowUp className="h-3.5 w-3.5 text-zinc-400" />
            <span>Move Up</span>
          </button>

          {/* Move Down */}
          <button
            type="button"
            onClick={handleBatchMoveDown}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            title="Move selected lines down (Alt+↓)"
          >
            <ArrowDown className="h-3.5 w-3.5 text-zinc-400" />
            <span>Move Down</span>
          </button>

          {/* Duplicate */}
          <button
            type="button"
            onClick={handleBatchDuplicate}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            title="Duplicate selected lines (Ctrl+D)"
          >
            <CopyPlus className="h-3.5 w-3.5 text-zinc-400" />
            <span>Duplicate</span>
          </button>

          {/* Copy */}
          <button
            type="button"
            onClick={handleBatchCopy}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            title="Copy lines (Ctrl+C)"
          >
            <Copy className="h-3.5 w-3.5 text-zinc-400" />
            <span>Copy</span>
          </button>

          {/* Delete */}
          <button
            type="button"
            onClick={handleBatchDelete}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors"
            title="Delete selected lines (Backspace / Delete)"
          >
            <Trash2 className="h-3.5 w-3.5" />
            <span>Delete</span>
          </button>

          <div className="h-4 w-px bg-zinc-200 dark:bg-zinc-800 mx-1" />

          {/* Close */}
          <button
            type="button"
            onClick={() => {
              setSelectedBlockIds(new Set());
              setBatchTransformOpen(false);
            }}
            className="h-6 w-6 flex items-center justify-center rounded-md text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            title="Clear selection (Esc)"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Collaborative Page Modals & Drawers */}
      <PageInfoModal
        page={page}
        isOpen={infoModalOpen}
        onClose={() => setInfoModalOpen(false)}
        connectionsCount={connections.length}
      />

      <PageActivityDrawer
        pageId={page.id}
        isOpen={activityDrawerOpen}
        onClose={() => setActivityDrawerOpen(false)}
        activities={activities}
        versions={versions}
        onRefresh={loadActivitiesAndVersions}
      />

      <PageCommentsPanel
        pageId={page.id}
        isOpen={commentsDrawerOpen}
        onClose={() => setCommentsDrawerOpen(false)}
        comments={comments}
        onRefresh={loadComments}
      />
    </div>
  );
}
