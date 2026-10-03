"use client";

import * as React from "react";
import {
  EditorBlock,
  BlockType,
  PageRecord,
  PageTemplate,
  PageViewMode,
  PageConnectionRecord,
  EntityType,
} from "@/lib/pages/types";
import { BlockItem } from "./block-item";
import { SlashMenu } from "./slash-menu";
import { FloatingFormatToolbar, FormatType, CompanyBrainToolbarAction } from "./floating-format-toolbar";
import { TemplatePicker } from "./template-picker";
import { EmojiPicker } from "./emoji-picker";
import { ConnectModal } from "./connect-modal";
import { PageOutlineView } from "./page-outline-view";
import { PageConnectionsView } from "./page-connections-view";
import { PageHeaderActions } from "./page-header-actions";
import { focusBlockCaretEnd } from "./caret-utils";
import {
  savePageContentAction,
  createPageAction,
  getPageConnectionsAction,
  removeConnectionAction,
  togglePageFavoriteAction,
} from "@/lib/pages/actions";
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

interface BlockEditorProps {
  page: PageRecord;
  onPageTitleChange?: (newTitle: string) => void;
  onPageIconChange?: (newIcon: string) => void;
}

export function BlockEditor({
  page,
  onPageTitleChange,
  onPageIconChange,
}: BlockEditorProps) {
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
    getPageConnectionsAction(page.id).then((res) => {
      if (isMounted && res.success) {
        setConnections(res.connections);
      }
    });
    return () => {
      isMounted = false;
    };
  }, [page.id]);

  // Drag and drop state
  const [draggingBlockIndex, setDraggingBlockIndex] = React.useState<number | null>(null);
  const [dropTarget, setDropTarget] = React.useState<{ index: number; position: "before" | "after" } | null>(null);

  // Slash menu state
  const [slashState, setSlashState] = React.useState<{
    blockId: string;
    position: { top: number; left: number };
    query: string;
  } | null>(null);

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
      setSaveStatus("saving");
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }

      saveTimeoutRef.current = setTimeout(async () => {
        const payloadTitle = newTitle !== undefined ? newTitle : pendingSaveRef.current.title;
        const payloadIcon = newIcon !== undefined ? newIcon : pendingSaveRef.current.icon;
        const res = await savePageContentAction({
          pageId: page.id,
          title: payloadTitle,
          icon: payloadIcon,
          blocks: newBlocks,
        });

        if (res.success) {
          setSaveStatus("saved");
        } else {
          setSaveStatus("error");
        }
      }, 800);
    },
    [page.id]
  );

  // Flush on unmount if saving
  React.useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
        const { title: t, icon: ic, blocks: b } = pendingSaveRef.current;
        savePageContentAction({
          pageId: page.id,
          title: t,
          icon: ic,
          blocks: b,
        });
      }
    };
  }, [page.id]);

  // Title change handler
  const handleTitleChange = (newTitle: string) => {
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
    setBlocks((prev) => {
      const next = prev.map((b) => (b.id === id ? { ...b, content } : b));
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
  };

  // Properties update for specific block
  const handleUpdateProperties = (id: string, properties: Partial<EditorBlock["properties"]>) => {
    setBlocks((prev) => {
      const next = prev.map((b) =>
        b.id === id ? { ...b, properties: { ...b.properties, ...properties } } : b
      );
      triggerAutosave(next);
      return next;
    });
  };

  // Convert block type
  const handleConvertType = (id: string, newType: BlockType) => {
    setBlocks((prev) => {
      const next = prev.map((b) => {
        if (b.id === id) {
          return {
            ...b,
            type: newType,
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
    const newBlock: EditorBlock = {
      id: crypto.randomUUID(),
      type,
      content: "",
      properties: type === "callout" ? { calloutIcon: "💡" } : undefined,
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
    if (draggingBlockIndex === null || draggingBlockIndex === targetIndex) {
      setDraggingBlockIndex(null);
      setDropTarget(null);
      return;
    }

    const fromIndex = draggingBlockIndex;
    setDraggingBlockIndex(null);
    setDropTarget(null);

    setBlocks((prev) => {
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

  // Slash select command
  const handleSlashSelect = (type: BlockType) => {
    if (!slashState) return;
    const targetBlock = blocks.find((b) => b.id === slashState.blockId);
    if (!targetBlock) return;

    // Clean out trailing slash from content
    const cleanedContent = targetBlock.content.replace(/\/([a-zA-Z0-9_-]*)$/, "").trim();

    setBlocks((prev) => {
      const next = prev.map((b) => {
        if (b.id === slashState.blockId) {
          return {
            ...b,
            type,
            content: cleanedContent,
            properties: type === "callout" ? { calloutIcon: "💡" } : undefined,
          };
        }
        return b;
      });
      triggerAutosave(next);
      return next;
    });

    setSlashState(null);
    setFocusedBlockId(targetBlock.id);

    setTimeout(() => {
      const el = blockRefs.current.get(targetBlock.id);
      if (el) {
        focusBlockCaretEnd(el);
      }
    }, 20);
  };

  // Keyboard navigation & Enter/Backspace splitting
  const handleKeyDown = (e: React.KeyboardEvent<HTMLElement>, block: EditorBlock, index: number) => {
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

    // BACKSPACE
    if (e.key === "Backspace") {
      const sel = typeof window !== "undefined" ? window.getSelection() : null;
      const isEmpty = !block.content || block.content.trim() === "";
      const isStartOfBlock = isEmpty || (sel ? sel.anchorOffset === 0 : false);

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
      const sel = window.getSelection();
      if (sel && sel.anchorOffset === 0) {
        const prevBlock = blocks[index - 1];
        const prevEl = blockRefs.current.get(prevBlock.id);
        if (prevEl) {
          e.preventDefault();
          prevEl.focus();
        }
      }
    }

    if (e.key === "ArrowDown" && index < blocks.length - 1) {
      const el = blockRefs.current.get(block.id);
      const sel = window.getSelection();
      const contentLen = el?.innerText?.length || 0;
      if (sel && (sel.anchorOffset >= contentLen || !contentLen)) {
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
          const codeEl = document.createElement("code");
          codeEl.className =
            "px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 font-mono text-xs text-indigo-600 dark:text-indigo-400";
          codeEl.textContent = range.toString();
          range.deleteContents();
          range.insertNode(codeEl);
        }
        break;
      }
      case "link":
        if (value) {
          document.execCommand("createLink", false, value);
        }
        break;
      case "color":
        if (value) {
          document.execCommand("foreColor", false, value);
        } else {
          document.execCommand("removeFormat");
        }
        break;
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
  }, [selectedBlockIds, triggerAutosave]);

  // Batch duplicate selected blocks
  const handleBatchDuplicate = React.useCallback(() => {
    if (selectedBlockIds.size === 0) return;
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
  }, [selectedBlockIds, triggerAutosave]);

  // Batch transform block types
  const handleBatchTransform = (newType: BlockType) => {
    if (selectedBlockIds.size === 0) return;
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

  // Canvas MouseDown: initiates Marquee (drag-to-select)
  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0) return; // Left click only

    const target = e.target as HTMLElement;

    // Ignore interactive elements
    if (
      target.closest(
        'button, input, textarea, a, select, [draggable="true"], [role="button"], [data-no-marquee]'
      )
    ) {
      return;
    }

    // Check if clicking inside contentEditable text
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

    // Clicking in gutter, margin, padding or between blocks
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
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedBlockIds, handleBatchDelete, handleBatchDuplicate, handleBatchCopy]);

  const isPageEmpty = blocks.length <= 1 && (!blocks[0].content || blocks[0].content.trim() === "");

  return (
    <div onMouseDown={handleCanvasMouseDown} className="relative w-full max-w-6xl mx-auto pb-32">
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

      {/* Floating Toolbar for Inline Marks & Company Brain Transform */}
      <FloatingFormatToolbar
        onFormat={handleFormat}
        onTransformBlock={handleTransformBlock}
        onCompanyBrainAction={handleCompanyBrainToolbarAction}
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

      {/* Clean Company Brain Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-4 pb-6 border-b border-zinc-100 dark:border-zinc-800/80 mb-6">
        <div className="flex items-center gap-4 min-w-0 flex-1">
          <EmojiPicker
            currentEmoji={icon}
            onSelectEmoji={handleIconChange}
            triggerClassName="h-14 w-14 sm:h-16 sm:w-16 text-4xl sm:text-5xl shrink-0 rounded-2xl hover:bg-zinc-100 dark:hover:bg-zinc-800/60 transition-all"
          />

          {/* Page Title Input */}
          <input
            type="text"
            value={title}
            onChange={(e) => handleTitleChange(e.target.value)}
            placeholder="Untitled"
            className="w-full bg-transparent text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-zinc-950 dark:text-zinc-50 placeholder:text-zinc-300 dark:placeholder:text-zinc-700 outline-none border-none p-0 focus:ring-0 truncate py-1"
          />
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Header Action Controls [⭐] [+ Add] [Connect] [View] [...] */}
          <PageHeaderActions
            currentView={viewMode}
            connectionsCount={connections.length}
            isFavorite={isFavorite}
            onToggleFavorite={handleToggleFavorite}
            onViewChange={(view) => setViewMode(view)}
            onAddBlock={() => handleInsertBelow(blocks.length - 1)}
            onAddSubpage={() => {
              createPageAction({ parentPageId: page.id, title: "Untitled Subpage" }).then((res) => {
                if (res.success && res.page) {
                  window.location.href = `/dashboard/pages/${res.page.id}`;
                }
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
          />

          {/* Unobtrusive Save Error Indicator only if save fails */}
          {saveStatus === "error" && (
            <div className="flex items-center gap-1 text-xs text-red-500" title="Autosave failed">
              <AlertCircle className="h-3.5 w-3.5" />
            </div>
          )}
        </div>
      </div>

      {/* VIEW 1: EDITOR */}
      {viewMode === "editor" && (
        <>
          {/* Template Suggestions if Document is Empty */}
          {isPageEmpty && (
            <TemplatePicker onApplyTemplate={handleApplyTemplate} />
          )}

          {/* Block Stream */}
          <div className="space-y-0.5">
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
                    listNumber={listNumber}
                    totalBlocks={blocks.length}
                    isFocused={focusedBlockId === block.id}
                    isDragging={draggingBlockIndex === idx}
                    dropIndicatorPosition={dropTarget?.index === idx ? dropTarget.position : null}
                    isSelected={selectedBlockIds.has(block.id)}
                    connections={connections}
                    onUpdateContent={handleUpdateContent}
                    onUpdateProperties={handleUpdateProperties}
                    onConvertType={handleConvertType}
                    onInsertBelow={handleInsertBelow}
                    onDeleteBlock={handleDeleteBlock}
                    onMoveUp={handleMoveUp}
                    onMoveDown={handleMoveDown}
                    onDuplicateBlock={handleDuplicateBlock}
                    onConnectBlock={handleConnectBlock}
                    onClickConnection={(conn) => {
                      setViewMode("connections");
                    }}
                    onKeyDown={handleKeyDown}
                    onSlashTrigger={handleSlashTrigger}
                    registerRef={registerRef}
                    onFocusBlock={(id) => setFocusedBlockId(id)}
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
        </>
      )}

      {/* VIEW 2: OUTLINE */}
      {viewMode === "outline" && (
        <PageOutlineView
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
    </div>
  );
}
