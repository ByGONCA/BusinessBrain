"use client";

import * as React from "react";
import {
  GripVertical,
  Trash2,
  ChevronUp,
  ChevronDown,
  Copy,
  Check,
  Sparkles,
  Link2,
  CopyPlus,
  MessageSquare,
  ChevronRight,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  CheckSquare,
  Quote,
  Code as CodeIcon,
  Image as ImageIcon,
  Video as VideoIcon,
  Music,
  FileText,
  Bookmark,
  Table as TableIcon,
  Kanban,
  LayoutGrid,
  ListFilter,
  Calendar,
  Sigma,
  ListTree,
  FolderTree,
  MousePointerClick,
  Brain,
  Scale,
  FolderGit2,
  CalendarClock,
  Target,
  Cloud,
  HardDrive,
  AlertTriangle,
  ExternalLink,
  Download,
  ZoomIn,
  Upload,
  FileSpreadsheet,
  FileCode,
} from "lucide-react";
import {
  EditorBlock,
  BlockType,
  PageConnectionRecord,
  RelationType,
  RELATION_LABELS,
} from "@/lib/pages/types";
import { EmojiPicker } from "./emoji-picker";
import { focusBlockCaretEnd, restoreCaretOffset } from "./caret-utils";
import { CompanyBrainToolbarAction } from "./floating-format-toolbar";
import { PdfViewerModal } from "./pdf-viewer-modal";
import { cn } from "@/lib/utils";

interface BlockItemProps {
  block: EditorBlock;
  index: number;
  allBlocks?: EditorBlock[];
  pageTitle?: string;
  onOpenFilePicker?: (blockId: string, allowedTypes: "all" | "image" | "video" | "audio" | "pdf" | "document") => void;
  listNumber?: number;
  totalBlocks: number;
  isFocused: boolean;
  isDragging?: boolean;
  dropIndicatorPosition?: "before" | "after" | null;
  isSelected?: boolean;
  connections?: PageConnectionRecord[];
  onUpdateContent: (id: string, content: string) => void;
  onUpdateProperties: (id: string, properties: Partial<EditorBlock["properties"]>) => void;
  onConvertType: (id: string, newType: BlockType) => void;
  onInsertBelow: (index: number) => void;
  onDeleteBlock: (id: string) => void;
  onMoveUp: (index: number) => void;
  onMoveDown: (index: number) => void;
  onDuplicateBlock?: (index: number) => void;
  onConnectBlock?: (blockId: string, initialText: string) => void;
  onCompanyBrainAction?: (actionId: CompanyBrainToolbarAction, text: string) => void;
  onClickConnection?: (connection: PageConnectionRecord) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLElement>, block: EditorBlock, index: number) => void;
  onSlashTrigger: (blockId: string, rect: DOMRect) => void;
  onMentionTrigger?: (blockId: string, rect: DOMRect) => void;
  registerRef: (id: string, el: HTMLElement | null) => void;
  onFocusBlock?: (id: string) => void;
  onDragBlockStart?: (index: number, e: React.DragEvent) => void;
  onDragBlockOver?: (index: number, position: "before" | "after") => void;
  onDragBlockLeave?: (index: number) => void;
  onDragBlockEnd?: () => void;
  onDropBlock?: (index: number, position: "before" | "after") => void;
}

export function BlockItem({
  block,
  index,
  allBlocks = [],
  pageTitle = "Page",
  listNumber,
  totalBlocks,
  isFocused,
  isDragging,
  dropIndicatorPosition,
  isSelected = false,
  connections = [],
  onUpdateContent,
  onUpdateProperties,
  onConvertType,
  onInsertBelow,
  onDeleteBlock,
  onMoveUp,
  onMoveDown,
  onDuplicateBlock,
  onConnectBlock,
  onCompanyBrainAction,
  onClickConnection,
  onKeyDown,
  onSlashTrigger,
  onMentionTrigger,
  registerRef,
  onFocusBlock,
  onOpenFilePicker,
  onDragBlockStart,
  onDragBlockOver,
  onDragBlockLeave,
  onDragBlockEnd,
  onDropBlock,
}: BlockItemProps) {
  const [copied, setCopied] = React.useState(false);
  const [linkCopied, setLinkCopied] = React.useState(false);
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [transformOpen, setTransformOpen] = React.useState(false);
  const [isSelfFocused, setIsSelfFocused] = React.useState(false);
  const [isPdfOpen, setIsPdfOpen] = React.useState(false);
  const [isLightboxOpen, setIsLightboxOpen] = React.useState(false);
  const blockContainerRef = React.useRef<HTMLDivElement>(null);
  const menuRef = React.useRef<HTMLDivElement>(null);
  const editableRef = React.useRef<HTMLElement | null>(null);
  const prevTypeRef = React.useRef(block.type);
  const lastCaretOffsetRef = React.useRef<number | null>(null);
  const isTypingRef = React.useRef(false);

  // Filter connections belonging directly to this block
  const blockConnections = React.useMemo(() => {
    return connections.filter(
      (c) => c.source_type === "block" && c.source_id === block.id
    );
  }, [connections, block.id]);

  // Synchronously restore focus when block type changes
  React.useLayoutEffect(() => {
    if (prevTypeRef.current !== block.type) {
      prevTypeRef.current = block.type;
      if (editableRef.current) {
        focusBlockCaretEnd(editableRef.current);
        setIsSelfFocused(true);
      }
    }
  }, [block.type]);

  // Restore caret position during re-renders caused by typing
  React.useLayoutEffect(() => {
    if (isTypingRef.current && editableRef.current && document.activeElement === editableRef.current) {
      if (lastCaretOffsetRef.current !== null) {
        restoreCaretOffset(editableRef.current, lastCaretOffsetRef.current);
        requestAnimationFrame(() => {
          if (editableRef.current && document.activeElement === editableRef.current && lastCaretOffsetRef.current !== null) {
            restoreCaretOffset(editableRef.current, lastCaretOffsetRef.current);
          }
        });
      }
      isTypingRef.current = false;
    }
  }, [block.content]);

  // Focus block when external isFocused changes to true
  React.useEffect(() => {
    if (isFocused && editableRef.current && document.activeElement !== editableRef.current) {
      focusBlockCaretEnd(editableRef.current);
      setIsSelfFocused(true);
    }
  }, [isFocused]);

  const handleFocus = () => {
    setIsSelfFocused(true);
    onFocusBlock?.(block.id);
  };

  const handleBlur = () => {
    setIsSelfFocused(false);
  };

  const showPlaceholder = isSelfFocused || isFocused || (index === 0 && totalBlocks === 1 && !block.content);

  // Sync ref registration
  const setRef = React.useCallback(
    (el: HTMLElement | null) => {
      editableRef.current = el;
      registerRef(block.id, el);
    },
    [block.id, registerRef]
  );

  // Handle outside click to close action menu
  React.useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
        setTransformOpen(false);
      }
    }
    if (menuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [menuOpen]);

  const handleCopyCode = async () => {
    await navigator.clipboard.writeText(block.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Input change with Markdown auto-formatting shortcuts and slash/@ detection
  const handleInput = (e: React.FormEvent<HTMLElement>) => {
    const text = e.currentTarget.innerText;
    isTypingRef.current = true;

    // Check for inline markdown shortcuts when on a paragraph
    if (block.type === "paragraph") {
      if (text.startsWith("# ")) {
        e.preventDefault();
        onConvertType(block.id, "heading_1");
        onUpdateContent(block.id, text.slice(2));
        return;
      }
      if (text.startsWith("## ")) {
        e.preventDefault();
        onConvertType(block.id, "heading_2");
        onUpdateContent(block.id, text.slice(3));
        return;
      }
      if (text.startsWith("### ")) {
        e.preventDefault();
        onConvertType(block.id, "heading_3");
        onUpdateContent(block.id, text.slice(4));
        return;
      }
      if (text.startsWith("- ") || text.startsWith("* ")) {
        e.preventDefault();
        onConvertType(block.id, "bullet_list");
        onUpdateContent(block.id, text.slice(2));
        return;
      }
      if (/^\d+\.\s/.test(text)) {
        e.preventDefault();
        onConvertType(block.id, "numbered_list");
        onUpdateContent(block.id, text.replace(/^\d+\.\s/, ""));
        return;
      }
      if (text.startsWith("[] ") || text.startsWith("[ ] ")) {
        e.preventDefault();
        onConvertType(block.id, "checklist");
        onUpdateContent(block.id, text.replace(/^\[\s?\]\s?/, ""));
        return;
      }
      if (text.startsWith("> ")) {
        e.preventDefault();
        onConvertType(block.id, "quote");
        onUpdateContent(block.id, text.slice(2));
        return;
      }
      if (text.startsWith("---")) {
        e.preventDefault();
        onConvertType(block.id, "divider");
        onUpdateContent(block.id, "");
        return;
      }
      if (text.startsWith("```")) {
        e.preventDefault();
        onConvertType(block.id, "code");
        onUpdateContent(block.id, text.slice(3).trim());
        return;
      }
    }

    // Slash command trigger
    if (text === "/" || text.endsWith(" /")) {
      const rect = e.currentTarget.getBoundingClientRect();
      onSlashTrigger(block.id, rect);
    }

    // Mention command trigger
    if (text === "@" || text.endsWith(" @")) {
      const rect = e.currentTarget.getBoundingClientRect();
      onMentionTrigger?.(block.id, rect);
    }

    onUpdateContent(block.id, text);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "move";
    const rect = e.currentTarget.getBoundingClientRect();
    const relY = e.clientY - rect.top;
    const position = relY < rect.height / 2 ? "before" : "after";
    onDragBlockOver?.(index, position);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.stopPropagation();
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      onDragBlockLeave?.(index);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    const relY = e.clientY - rect.top;
    const position = relY < rect.height / 2 ? "before" : "after";
    onDropBlock?.(index, position);
  };

  const gripTopClass =
    block.type === "heading_1"
      ? "top-1.5"
      : block.type === "heading_2"
      ? "top-1"
      : "top-0.5";

  return (
    <div
      ref={blockContainerRef}
      id={`block-${block.id}`}
      data-block-id={block.id}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={cn(
        "group relative flex flex-col -ml-10 pl-10 pr-2 py-1 transition-all duration-150 rounded-lg",
        index > 0 && block.type === "heading_1" && "mt-5",
        index > 0 && block.type === "heading_2" && "mt-3.5",
        index > 0 && block.type === "heading_3" && "mt-2",
        isDragging && "opacity-35",
        isSelected && "bg-blue-50/80 dark:bg-blue-950/50 ring-1 ring-blue-500/40 dark:ring-blue-400/40 shadow-xs"
      )}
    >
      {/* Drop indicator: BEFORE */}
      {dropIndicatorPosition === "before" && (
        <div className="h-0.5 w-full bg-blue-500 rounded-full mb-1 shadow-xs pointer-events-none animate-in fade-in duration-100" />
      )}

      <div className="relative flex items-start w-full">
        {/* Block Action Controls (Grip handle in gutter) */}
        <div className={cn("absolute -left-7 flex items-center opacity-0 group-hover:opacity-100 transition-opacity", gripTopClass)}>
          <div className="relative" ref={menuRef}>
            <div
              role="button"
              tabIndex={0}
              draggable
              onDragStart={(e) => {
                e.stopPropagation();
                e.dataTransfer.setData("text/plain", block.id);
                e.dataTransfer.effectAllowed = "move";
                if (blockContainerRef.current) {
                  try {
                    e.dataTransfer.setDragImage(blockContainerRef.current, 20, 20);
                  } catch {}
                }
                onDragBlockStart?.(index, e);
              }}
              onDragEnd={() => {
                onDragBlockEnd?.();
              }}
              onClick={(e) => {
                e.stopPropagation();
                setMenuOpen(!menuOpen);
              }}
              className="flex h-5 w-5 items-center justify-center rounded text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-grab active:cursor-grabbing select-none"
              title="Drag to reorder or click for actions"
            >
              <GripVertical className="h-3.5 w-3.5" />
            </div>

            {menuOpen && (
              <div className="absolute left-6 top-0 z-50 w-56 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-1.5 shadow-xl animate-in fade-in zoom-in-95 duration-100 select-none max-h-96 overflow-y-auto no-scrollbar">
                <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                  Quick Actions
                </div>

                {/* Transform */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setTransformOpen(!transformOpen)}
                    className="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-xs text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                  >
                    <span className="flex items-center gap-2">
                      <Sparkles className="h-3.5 w-3.5 text-indigo-500" />
                      Transform
                    </span>
                    <ChevronRight className={cn("h-3 w-3 text-zinc-400 transition-transform", transformOpen && "rotate-90")} />
                  </button>

                  {transformOpen && (
                    <div className="my-1 pl-3 pr-1 py-1 space-y-0.5 border-l border-zinc-200 dark:border-zinc-800 ml-2">
                      <div className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider px-2 py-0.5">
                        Blocks
                      </div>
                      {(
                        [
                          { type: "paragraph", label: "Text", icon: "P" },
                          { type: "heading_1", label: "Heading 1", icon: Heading1 },
                          { type: "heading_2", label: "Heading 2", icon: Heading2 },
                          { type: "heading_3", label: "Heading 3", icon: Heading3 },
                          { type: "bullet_list", label: "Bullet list", icon: List },
                          { type: "numbered_list", label: "Numbered list", icon: ListOrdered },
                          { type: "checklist", label: "To-do list", icon: CheckSquare },
                          { type: "toggle", label: "Toggle list", icon: ChevronRight },
                          { type: "quote", label: "Quote", icon: Quote },
                          { type: "code", label: "Code", icon: CodeIcon },
                          { type: "table", label: "Table", icon: TableIcon },
                          { type: "board", label: "Board (Kanban)", icon: Kanban },
                          { type: "gallery", label: "Gallery", icon: LayoutGrid },
                          { type: "list", label: "List View", icon: ListFilter },
                          { type: "calendar", label: "Calendar", icon: Calendar },
                          { type: "equation", label: "Equation", icon: Sigma },
                          { type: "button", label: "Button", icon: MousePointerClick },
                        ] as const
                      ).map((item) => {
                        const ItemIcon = item.icon;
                        return (
                          <button
                            key={item.type}
                            type="button"
                            onClick={() => {
                              onConvertType(block.id, item.type as BlockType);
                              setTransformOpen(false);
                              setMenuOpen(false);
                            }}
                            className={cn(
                              "flex w-full items-center gap-2 rounded-md px-2 py-1 text-[11px] text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors",
                              block.type === item.type && "font-semibold text-indigo-600 dark:text-indigo-400"
                            )}
                          >
                            {typeof ItemIcon === "string" ? (
                              <span className="font-mono text-xs w-3 text-center">{ItemIcon}</span>
                            ) : (
                              <ItemIcon className="h-3 w-3" />
                            )}
                            <span>{item.label}</span>
                          </button>
                        );
                      })}

                      <div className="pt-1.5 text-[10px] font-semibold text-indigo-500 uppercase tracking-wider px-2 py-0.5 flex items-center gap-1">
                        <Sparkles className="h-2.5 w-2.5" /> Company Brain
                      </div>
                      {(
                        [
                          { action: "create-task" as CompanyBrainToolbarAction, label: "Create Task", icon: CheckSquare },
                          { action: "create-decision" as CompanyBrainToolbarAction, label: "Create Decision", icon: Scale },
                          { action: "add-project" as CompanyBrainToolbarAction, label: "Add to Project", icon: FolderGit2 },
                          { action: "add-meeting" as CompanyBrainToolbarAction, label: "Add to Meeting", icon: CalendarClock },
                          { action: "create-goal" as CompanyBrainToolbarAction, label: "Create Goal", icon: Target },
                          { action: "save-memory" as CompanyBrainToolbarAction, label: "Save as Memory", icon: Brain },
                        ] as const
                      ).map((item) => {
                        const ItemIcon = item.icon;
                        return (
                          <button
                            key={item.action}
                            type="button"
                            onClick={() => {
                              setTransformOpen(false);
                              setMenuOpen(false);
                              onCompanyBrainAction?.(item.action, block.content);
                            }}
                            className="flex w-full items-center gap-2 rounded-md px-2 py-1 text-[11px] text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 transition-colors font-medium"
                          >
                            <ItemIcon className="h-3 w-3" />
                            <span>{item.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Connect */}
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    onConnectBlock?.(block.id, block.content);
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 font-medium transition-colors"
                >
                  <Link2 className="h-3.5 w-3.5" /> Connect to Entity
                </button>

                {/* Comment */}
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    const cleanText = block.content.slice(0, 30);
                    window.alert(`Comment discussion thread for "${cleanText || "Block"}" will be available in future team releases.`);
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                >
                  <MessageSquare className="h-3.5 w-3.5 text-zinc-400" /> Comment
                </button>

                {/* Duplicate */}
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    onDuplicateBlock?.(index);
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                >
                  <CopyPlus className="h-3.5 w-3.5 text-zinc-400" /> Duplicate
                </button>

                <div className="my-1 h-px bg-zinc-200 dark:border-zinc-800" />

                {/* Move Up / Down */}
                <button
                  type="button"
                  onClick={() => {
                    onMoveUp(index);
                    setMenuOpen(false);
                  }}
                  disabled={index === 0}
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-40 disabled:pointer-events-none"
                >
                  <ChevronUp className="h-3.5 w-3.5 text-zinc-400" /> Move up
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onMoveDown(index);
                    setMenuOpen(false);
                  }}
                  disabled={index === totalBlocks - 1}
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-40 disabled:pointer-events-none"
                >
                  <ChevronDown className="h-3.5 w-3.5 text-zinc-400" /> Move down
                </button>

                {/* Copy link to block */}
                <button
                  type="button"
                  onClick={async () => {
                    setMenuOpen(false);
                    const url = `${window.location.origin}${window.location.pathname}#block-${block.id}`;
                    await navigator.clipboard.writeText(url);
                    setLinkCopied(true);
                    setTimeout(() => setLinkCopied(false), 2000);
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                >
                  {linkCopied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5 text-zinc-400" />}
                  <span>{linkCopied ? "Link copied" : "Copy link to block"}</span>
                </button>

                <div className="my-1 h-px bg-zinc-200 dark:bg-zinc-800" />

                {/* Delete */}
                <button
                  type="button"
                  onClick={() => {
                    onDeleteBlock(block.id);
                    setMenuOpen(false);
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                >
                  <Trash2 className="h-3.5 w-3.5" /> Delete
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Block Content by Type */}
        <div className="flex-1 min-w-0">
          {/* PARAGRAPH */}
          {block.type === "paragraph" && (
            <p
              ref={setRef}
              contentEditable
              suppressContentEditableWarning
              onInput={handleInput}
              onFocus={handleFocus}
              onBlur={handleBlur}
              onKeyDown={(e) => onKeyDown(e, block, index)}
              data-placeholder={showPlaceholder ? "Type '/' for commands or '@' to link..." : ""}
              className="outline-none min-h-[1.5rem] text-sm text-zinc-800 dark:text-zinc-200 leading-relaxed empty:before:content-[attr(data-placeholder)] empty:before:text-zinc-400 empty:before:pointer-events-none"
            >
              {block.content}
            </p>
          )}

          {/* HEADING 1 */}
          {block.type === "heading_1" && (
            <h1
              ref={setRef}
              contentEditable
              suppressContentEditableWarning
              onInput={handleInput}
              onFocus={handleFocus}
              onBlur={handleBlur}
              onKeyDown={(e) => onKeyDown(e, block, index)}
              data-placeholder={showPlaceholder ? "Heading 1" : ""}
              className="outline-none min-h-[2rem] text-2xl font-bold tracking-tight text-zinc-950 dark:text-zinc-50 empty:before:content-[attr(data-placeholder)] empty:before:text-zinc-400 empty:before:pointer-events-none"
            >
              {block.content}
            </h1>
          )}

          {/* HEADING 2 */}
          {block.type === "heading_2" && (
            <h2
              ref={setRef}
              contentEditable
              suppressContentEditableWarning
              onInput={handleInput}
              onFocus={handleFocus}
              onBlur={handleBlur}
              onKeyDown={(e) => onKeyDown(e, block, index)}
              data-placeholder={showPlaceholder ? "Heading 2" : ""}
              className="outline-none min-h-[1.75rem] text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100 empty:before:content-[attr(data-placeholder)] empty:before:text-zinc-400 empty:before:pointer-events-none"
            >
              {block.content}
            </h2>
          )}

          {/* HEADING 3 */}
          {block.type === "heading_3" && (
            <h3
              ref={setRef}
              contentEditable
              suppressContentEditableWarning
              onInput={handleInput}
              onFocus={handleFocus}
              onBlur={handleBlur}
              onKeyDown={(e) => onKeyDown(e, block, index)}
              data-placeholder={showPlaceholder ? "Heading 3" : ""}
              className="outline-none min-h-[1.5rem] text-base font-semibold tracking-tight text-zinc-900 dark:text-zinc-200 empty:before:content-[attr(data-placeholder)] empty:before:text-zinc-400 empty:before:pointer-events-none"
            >
              {block.content}
            </h3>
          )}

          {/* BULLETED LIST */}
          {block.type === "bullet_list" && (
            <div className="flex items-start gap-2">
              <div className="flex items-center justify-center w-5 h-6 shrink-0 select-none">
                <span className="h-1.5 w-1.5 rounded-full bg-zinc-700 dark:bg-zinc-300" />
              </div>
              <div
                ref={setRef}
                contentEditable
                suppressContentEditableWarning
                onInput={handleInput}
                onFocus={handleFocus}
                onBlur={handleBlur}
                onKeyDown={(e) => onKeyDown(e, block, index)}
                data-placeholder={showPlaceholder ? "List item..." : ""}
                className="flex-1 outline-none min-h-[1.5rem] text-sm text-zinc-800 dark:text-zinc-200 leading-relaxed empty:before:content-[attr(data-placeholder)] empty:before:text-zinc-400 empty:before:pointer-events-none"
              >
                {block.content}
              </div>
            </div>
          )}

          {/* NUMBERED LIST */}
          {block.type === "numbered_list" && (
            <div className="flex items-start gap-2">
              <span className="text-sm font-medium text-zinc-500 dark:text-zinc-400 shrink-0 select-none w-5 text-center leading-relaxed tabular-nums">
                {listNumber ?? 1}.
              </span>
              <div
                ref={setRef}
                contentEditable
                suppressContentEditableWarning
                onInput={handleInput}
                onFocus={handleFocus}
                onBlur={handleBlur}
                onKeyDown={(e) => onKeyDown(e, block, index)}
                data-placeholder={showPlaceholder ? "List item..." : ""}
                className="flex-1 outline-none min-h-[1.5rem] text-sm text-zinc-800 dark:text-zinc-200 leading-relaxed empty:before:content-[attr(data-placeholder)] empty:before:text-zinc-400 empty:before:pointer-events-none"
              >
                {block.content}
              </div>
            </div>
          )}

          {/* CHECKLIST */}
          {block.type === "checklist" && (
            <div className="flex items-start gap-2">
              <div className="flex items-center justify-center w-5 h-6 shrink-0">
                <input
                  type="checkbox"
                  checked={block.properties?.checked || false}
                  onChange={(e) => onUpdateProperties(block.id, { checked: e.target.checked })}
                  className="h-4 w-4 rounded border-zinc-300 dark:border-zinc-700 text-blue-600 focus:ring-blue-500/20 cursor-pointer m-0"
                />
              </div>
              <div
                ref={setRef}
                contentEditable
                suppressContentEditableWarning
                onInput={handleInput}
                onFocus={handleFocus}
                onBlur={handleBlur}
                onKeyDown={(e) => onKeyDown(e, block, index)}
                data-placeholder={showPlaceholder ? "To-do..." : ""}
                className="flex-1 outline-none min-h-[1.5rem] text-sm text-zinc-800 dark:text-zinc-200 leading-relaxed empty:before:content-[attr(data-placeholder)] empty:before:text-zinc-400 empty:before:pointer-events-none"
              >
                {block.content}
              </div>
            </div>
          )}

          {/* TOGGLE */}
          {block.type === "toggle" && (
            <div className="flex flex-col my-1">
              <div className="flex items-start gap-1.5">
                <button
                  type="button"
                  onClick={() => onUpdateProperties(block.id, { isOpen: !block.properties?.isOpen })}
                  className="mt-0.5 p-0.5 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500 transition-colors"
                >
                  <ChevronRight
                    className={cn(
                      "h-4 w-4 transition-transform duration-150",
                      block.properties?.isOpen && "rotate-90"
                    )}
                  />
                </button>
                <div
                  ref={setRef}
                  contentEditable
                  suppressContentEditableWarning
                  onInput={handleInput}
                  onFocus={handleFocus}
                  onBlur={handleBlur}
                  onKeyDown={(e) => onKeyDown(e, block, index)}
                  data-placeholder={showPlaceholder ? "Toggle header..." : ""}
                  className="flex-1 outline-none min-h-[1.5rem] text-sm font-medium text-zinc-900 dark:text-zinc-100 leading-relaxed empty:before:content-[attr(data-placeholder)] empty:before:text-zinc-400 empty:before:pointer-events-none"
                >
                  {block.content}
                </div>
              </div>
              {block.properties?.isOpen && (
                <div className="pl-6 pt-1 text-xs text-zinc-500 border-l border-zinc-200 dark:border-zinc-800 ml-2 mt-1">
                  <p className="text-zinc-400 italic">Toggle container content. Press enter or add sub-blocks below.</p>
                </div>
              )}
            </div>
          )}

          {/* QUOTE */}
          {block.type === "quote" && (
            <blockquote className="border-l-2 border-zinc-400 dark:border-zinc-600 pl-3.5 py-0.5 italic">
              <div
                ref={setRef}
                contentEditable
                suppressContentEditableWarning
                onInput={handleInput}
                onFocus={handleFocus}
                onBlur={handleBlur}
                onKeyDown={(e) => onKeyDown(e, block, index)}
                data-placeholder={showPlaceholder ? "Empty quote..." : ""}
                className="outline-none min-h-[1.5rem] text-sm text-zinc-600 dark:text-zinc-300 leading-relaxed empty:before:content-[attr(data-placeholder)] empty:before:text-zinc-400 empty:before:pointer-events-none"
              >
                {block.content}
              </div>
            </blockquote>
          )}

          {/* DIVIDER */}
          {block.type === "divider" && (
            <div className="py-2.5">
              <hr className="border-t border-zinc-200 dark:border-zinc-800" />
            </div>
          )}

          {/* CODE BLOCK */}
          {block.type === "code" && (
            <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-900 text-zinc-100 overflow-hidden my-1">
              <div className="flex items-center justify-between px-3 py-1.5 bg-zinc-950/60 border-b border-zinc-800/80 text-xs text-zinc-400">
                <span className="font-mono text-[11px] uppercase tracking-wider">
                  {block.properties?.language || "Code"}
                </span>
                <button
                  type="button"
                  onClick={handleCopyCode}
                  className="flex items-center gap-1 hover:text-zinc-200 transition-colors select-none"
                >
                  {copied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                  <span className="text-[10px]">{copied ? "Copied" : "Copy"}</span>
                </button>
              </div>
              <pre className="px-2 py-1.5 font-mono text-xs overflow-x-auto">
                <code
                  ref={setRef}
                  contentEditable
                  suppressContentEditableWarning
                  onInput={handleInput}
                  onFocus={handleFocus}
                  onBlur={handleBlur}
                  onKeyDown={(e) => onKeyDown(e, block, index)}
                  data-placeholder={showPlaceholder ? "// write code snippet here..." : ""}
                  className="outline-none block min-h-[1.75rem] empty:before:content-[attr(data-placeholder)] empty:before:text-zinc-600 empty:before:pointer-events-none whitespace-pre text-white p-0 m-0"
                >{block.content.replace(/^\n\s*/, "")}</code>
              </pre>
            </div>
          )}

          {/* CALLOUT */}
          {block.type === "callout" && (
            <div className="flex items-start gap-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/40 p-3 my-1">
              <EmojiPicker
                currentEmoji={block.properties?.calloutIcon || "💡"}
                onSelectEmoji={(emoji) => onUpdateProperties(block.id, { calloutIcon: emoji })}
                triggerClassName="h-7 w-7 text-lg"
              />
              <div
                ref={setRef}
                contentEditable
                suppressContentEditableWarning
                onInput={handleInput}
                onFocus={handleFocus}
                onBlur={handleBlur}
                onKeyDown={(e) => onKeyDown(e, block, index)}
                data-placeholder={showPlaceholder ? "Type callout context..." : ""}
                className="flex-1 outline-none min-h-[1.5rem] text-sm text-zinc-800 dark:text-zinc-200 leading-relaxed empty:before:content-[attr(data-placeholder)] empty:before:text-zinc-400 empty:before:pointer-events-none"
              >
                {block.content}
              </div>
            </div>
          )}

          {/* IMAGE */}
          {block.type === "image" && (
            <div className="my-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50 p-2">
              {block.properties?.fileStatus === "unavailable" ? (
                <div className="p-4 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 text-xs text-amber-800 dark:text-amber-300 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
                    <span>External image unavailable — reconnect Google Drive to access.</span>
                  </div>
                  <a
                    href="/dashboard/settings/integrations"
                    className="px-2.5 py-1 rounded-md bg-amber-600 hover:bg-amber-500 text-white font-medium text-[11px] transition-colors"
                  >
                    Reconnect
                  </a>
                </div>
              ) : block.properties?.mediaUrl ? (
                <div className="space-y-1.5">
                  <div className="relative group/img max-w-2xl mx-auto rounded-lg overflow-hidden bg-zinc-100 dark:bg-zinc-900 flex items-center justify-center">
                    <img
                      src={block.properties.mediaUrl}
                      alt={block.properties.caption || "Image"}
                      className="max-h-96 w-auto rounded-lg object-contain cursor-zoom-in"
                      onClick={() => setIsLightboxOpen(true)}
                    />
                    <div className="absolute top-2 right-2 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center gap-1.5 bg-black/60 backdrop-blur-sm px-2 py-1 rounded-lg text-white text-[11px]">
                      {block.properties.storageProvider === "google_drive" ? (
                        <span className="flex items-center gap-1 text-blue-300"><Cloud className="h-3 w-3" /> Drive</span>
                      ) : (
                        <span className="flex items-center gap-1 text-zinc-300"><HardDrive className="h-3 w-3" /> Brain</span>
                      )}
                      <button
                        type="button"
                        onClick={() => setIsLightboxOpen(true)}
                        className="p-0.5 hover:text-white"
                        title="View Full Size"
                      >
                        <ZoomIn className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                  <input
                    type="text"
                    value={block.properties.caption || ""}
                    onChange={(e) => onUpdateProperties(block.id, { caption: e.target.value })}
                    placeholder="Add a caption..."
                    className="w-full text-center text-xs text-zinc-400 bg-transparent border-none outline-none focus:text-zinc-700 dark:focus:text-zinc-200"
                  />
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center p-6 gap-3 text-zinc-400">
                  <ImageIcon className="h-8 w-8 text-zinc-300 dark:text-zinc-600" />
                  <div className="flex flex-col sm:flex-row items-center gap-2 max-w-md w-full">
                    {onOpenFilePicker && (
                      <button
                        type="button"
                        onClick={() => onOpenFilePicker(block.id, "image")}
                        className="w-full sm:w-auto px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium flex items-center justify-center gap-1.5 transition-colors shrink-0"
                      >
                        <Upload className="h-3.5 w-3.5" /> Attach / Upload Image
                      </button>
                    )}
                    <div className="flex items-center gap-1.5 w-full">
                      <input
                        type="url"
                        placeholder="Or paste image URL..."
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            const val = (e.target as HTMLInputElement).value.trim();
                            if (val) onUpdateProperties(block.id, { mediaUrl: val });
                          }
                        }}
                        className="flex-1 px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-xs text-zinc-800 dark:text-zinc-200 outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* VIDEO */}
          {block.type === "video" && (
            <div className="my-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50 p-2">
              {block.properties?.fileStatus === "unavailable" ? (
                <div className="p-4 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 text-xs text-amber-800 dark:text-amber-300 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
                    <span>External video unavailable — reconnect Google Drive to access.</span>
                  </div>
                  <a
                    href="/dashboard/settings/integrations"
                    className="px-2.5 py-1 rounded-md bg-amber-600 hover:bg-amber-500 text-white font-medium text-[11px] transition-colors"
                  >
                    Reconnect
                  </a>
                </div>
              ) : block.properties?.mediaUrl ? (
                <div className="space-y-1.5">
                  <div className="aspect-video w-full rounded-lg overflow-hidden bg-black flex items-center justify-center">
                    <iframe
                      src={block.properties.mediaUrl.replace("watch?v=", "embed/")}
                      className="w-full h-full border-0"
                      allowFullScreen
                    />
                  </div>
                  <input
                    type="text"
                    value={block.properties.caption || ""}
                    onChange={(e) => onUpdateProperties(block.id, { caption: e.target.value })}
                    placeholder="Add a caption..."
                    className="w-full text-center text-xs text-zinc-400 bg-transparent border-none outline-none focus:text-zinc-700 dark:focus:text-zinc-200"
                  />
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center p-6 gap-3 text-zinc-400">
                  <VideoIcon className="h-8 w-8 text-zinc-300 dark:text-zinc-600" />
                  <div className="flex flex-col sm:flex-row items-center gap-2 max-w-md w-full">
                    {onOpenFilePicker && (
                      <button
                        type="button"
                        onClick={() => onOpenFilePicker(block.id, "video")}
                        className="w-full sm:w-auto px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium flex items-center justify-center gap-1.5 transition-colors shrink-0"
                      >
                        <Upload className="h-3.5 w-3.5" /> Attach Video
                      </button>
                    )}
                    <input
                      type="url"
                      placeholder="Or paste video link (YouTube / Google Drive)..."
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          const val = (e.target as HTMLInputElement).value.trim();
                          if (val) onUpdateProperties(block.id, { mediaUrl: val });
                        }
                      }}
                      className="flex-1 px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-xs text-zinc-800 dark:text-zinc-200 outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* AUDIO */}
          {block.type === "audio" && (
            <div className="my-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50 p-3">
              {block.properties?.mediaUrl ? (
                <div className="flex items-center gap-3">
                  <Music className="h-5 w-5 text-indigo-500 shrink-0" />
                  <audio controls src={block.properties.mediaUrl} className="w-full h-8" />
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <Music className="h-5 w-5 text-zinc-400 shrink-0" />
                  {onOpenFilePicker && (
                    <button
                      type="button"
                      onClick={() => onOpenFilePicker(block.id, "audio")}
                      className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium flex items-center gap-1.5 transition-colors shrink-0"
                    >
                      <Upload className="h-3 w-3" /> Attach Audio
                    </button>
                  )}
                  <input
                    type="url"
                    placeholder="Or paste audio link (https://...mp3)..."
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        const val = (e.target as HTMLInputElement).value.trim();
                        if (val) onUpdateProperties(block.id, { mediaUrl: val });
                      }
                    }}
                    className="flex-1 px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-xs text-zinc-800 dark:text-zinc-200 outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              )}
            </div>
          )}

          {/* FILE / DOCUMENT */}
          {block.type === "file" && (
            <div className="my-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50 p-3">
              {block.properties?.fileStatus === "unavailable" ? (
                <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 text-xs text-amber-800 dark:text-amber-300 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
                    <span>External file unavailable — reconnect Google Drive to access.</span>
                  </div>
                  <a
                    href="/dashboard/settings/integrations"
                    className="px-2.5 py-1 rounded-md bg-amber-600 hover:bg-amber-500 text-white font-medium text-[11px] transition-colors"
                  >
                    Reconnect
                  </a>
                </div>
              ) : block.properties?.mediaUrl || block.properties?.fileName ? (
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-9 w-9 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                      {block.properties?.mimeType?.includes("sheet") || block.properties?.fileName?.endsWith(".xlsx") || block.properties?.fileName?.endsWith(".csv") ? (
                        <FileSpreadsheet className="h-5 w-5 text-teal-500" />
                      ) : block.properties?.mimeType === "application/pdf" || block.properties?.fileName?.endsWith(".pdf") ? (
                        <FileText className="h-5 w-5 text-rose-500" />
                      ) : (
                        <FileText className="h-5 w-5 text-indigo-500" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 truncate">
                          {block.properties?.fileName || "Attachment document"}
                        </p>
                        {block.properties?.storageProvider === "google_drive" && (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400 shrink-0">
                            <Cloud className="h-2.5 w-2.5" /> Drive
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-zinc-400">{block.properties?.fileSize || "File"}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {(block.properties?.mimeType === "application/pdf" || block.properties?.fileName?.endsWith(".pdf")) && block.properties?.mediaUrl && (
                      <button
                        type="button"
                        onClick={() => setIsPdfOpen(true)}
                        className="px-2.5 py-1 rounded-md text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 transition-colors"
                      >
                        Preview PDF
                      </button>
                    )}
                    {block.properties?.mediaUrl && (
                      <a
                        href={block.properties.mediaUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="px-2.5 py-1 rounded-md text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors flex items-center gap-1"
                      >
                        <ExternalLink className="h-3 w-3" /> Open
                      </a>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex flex-col sm:flex-row items-center justify-between p-4 gap-3 text-zinc-400">
                  <div className="flex items-center gap-2.5">
                    <FileText className="h-6 w-6 text-zinc-300 dark:text-zinc-600" />
                    <span className="text-xs text-zinc-500">No document attached yet</span>
                  </div>
                  {onOpenFilePicker && (
                    <button
                      type="button"
                      onClick={() => onOpenFilePicker(block.id, "all")}
                      className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium flex items-center gap-1.5 transition-colors"
                    >
                      <Upload className="h-3 w-3" /> Attach File or Drive Reference
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* BOOKMARK */}
          {block.type === "bookmark" && (
            <div className="my-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50 p-3 hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1 min-w-0 flex-1">
                  <input
                    type="text"
                    value={block.properties?.bookmarkTitle || block.content || "Web Bookmark"}
                    onChange={(e) => onUpdateProperties(block.id, { bookmarkTitle: e.target.value })}
                    placeholder="Bookmark title..."
                    className="w-full text-xs font-semibold text-zinc-800 dark:text-zinc-200 bg-transparent border-none outline-none p-0"
                  />
                  <input
                    type="text"
                    value={block.properties?.bookmarkDescription || ""}
                    onChange={(e) => onUpdateProperties(block.id, { bookmarkDescription: e.target.value })}
                    placeholder="Brief description..."
                    className="w-full text-[11px] text-zinc-400 bg-transparent border-none outline-none p-0"
                  />
                  <div className="flex items-center gap-1.5 pt-1">
                    <Bookmark className="h-3 w-3 text-zinc-400 shrink-0" />
                    <input
                      type="url"
                      value={block.properties?.bookmarkUrl || ""}
                      onChange={(e) => onUpdateProperties(block.id, { bookmarkUrl: e.target.value })}
                      placeholder="https://example.com"
                      className="text-[11px] text-indigo-600 dark:text-indigo-400 bg-transparent border-none outline-none p-0 flex-1 truncate"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TABLE */}
          {block.type === "table" && (() => {
            const tableData = block.properties?.tableData || {
              headers: ["Column 1", "Column 2", "Column 3"],
              rows: [["", "", ""], ["", "", ""]],
            };

            const updateCell = (rowIndex: number, colIndex: number, value: string) => {
              const nextRows = tableData.rows.map((row, rIdx) => {
                if (rIdx !== rowIndex) return row;
                const nextRow = [...row];
                nextRow[colIndex] = value;
                return nextRow;
              });
              onUpdateProperties(block.id, { tableData: { ...tableData, rows: nextRows } });
            };

            const updateHeader = (colIndex: number, value: string) => {
              const nextHeaders = [...tableData.headers];
              nextHeaders[colIndex] = value;
              onUpdateProperties(block.id, { tableData: { ...tableData, headers: nextHeaders } });
            };

            const addRow = () => {
              const emptyRow = new Array(tableData.headers.length).fill("");
              onUpdateProperties(block.id, { tableData: { ...tableData, rows: [...tableData.rows, emptyRow] } });
            };

            const addColumn = () => {
              const nextHeaders = [...tableData.headers, `Column ${tableData.headers.length + 1}`];
              const nextRows = tableData.rows.map((r) => [...r, ""]);
              onUpdateProperties(block.id, { tableData: { headers: nextHeaders, rows: nextRows } });
            };

            const deleteRow = (rIdx: number) => {
              if (tableData.rows.length <= 1) return;
              const nextRows = tableData.rows.filter((_, idx) => idx !== rIdx);
              onUpdateProperties(block.id, { tableData: { ...tableData, rows: nextRows } });
            };

            const deleteColumn = (cIdx: number) => {
              if (tableData.headers.length <= 1) return;
              const nextHeaders = tableData.headers.filter((_, idx) => idx !== cIdx);
              const nextRows = tableData.rows.map((r) => r.filter((_, idx) => idx !== cIdx));
              onUpdateProperties(block.id, { tableData: { headers: nextHeaders, rows: nextRows } });
            };

            return (
              <div className="my-2 overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 p-2 shadow-2xs">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/40">
                      {tableData.headers.map((h, cIdx) => (
                        <th key={cIdx} className="p-1.5 border-r border-zinc-200 dark:border-zinc-800 last:border-r-0 group/col relative">
                          <input
                            type="text"
                            value={h}
                            onChange={(e) => updateHeader(cIdx, e.target.value)}
                            className="font-semibold text-zinc-700 dark:text-zinc-300 bg-transparent border-none outline-none w-full"
                          />
                          {tableData.headers.length > 1 && (
                            <button
                              type="button"
                              onClick={() => deleteColumn(cIdx)}
                              className="absolute right-1 top-1.5 opacity-0 group-hover/col:opacity-100 text-zinc-400 hover:text-red-500"
                              title="Delete column"
                            >
                              ×
                            </button>
                          )}
                        </th>
                      ))}
                      <th className="w-8 p-1 text-center">
                        <button
                          type="button"
                          onClick={addColumn}
                          className="h-5 w-5 rounded hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-500 inline-flex items-center justify-center"
                          title="Add column"
                        >
                          +
                        </button>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {tableData.rows.map((row, rIdx) => (
                      <tr key={rIdx} className="border-b border-zinc-100 dark:border-zinc-800/60 last:border-b-0 group/row">
                        {row.map((cell, cIdx) => (
                          <td key={cIdx} className="p-1.5 border-r border-zinc-100 dark:border-zinc-800/60 last:border-r-0">
                            <input
                              type="text"
                              value={cell}
                              onChange={(e) => updateCell(rIdx, cIdx, e.target.value)}
                              className="w-full bg-transparent border-none outline-none text-zinc-800 dark:text-zinc-200"
                            />
                          </td>
                        ))}
                        <td className="w-8 p-1 text-center">
                          {tableData.rows.length > 1 && (
                            <button
                              type="button"
                              onClick={() => deleteRow(rIdx)}
                              className="h-5 w-5 rounded opacity-0 group-hover/row:opacity-100 hover:text-red-500 text-zinc-400"
                              title="Delete row"
                            >
                              ×
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="pt-2 flex items-center justify-between border-t border-zinc-100 dark:border-zinc-800 mt-2">
                  <button
                    type="button"
                    onClick={addRow}
                    className="text-[11px] font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
                  >
                    + Add row
                  </button>
                </div>
              </div>
            );
          })()}

          {/* BOARD (KANBAN) */}
          {block.type === "board" && (() => {
            const boardData = block.properties?.boardData || {
              columns: [
                { id: "col-1", title: "To Do", cards: [{ id: "c-1", text: "First card" }] },
                { id: "col-2", title: "In Progress", cards: [] },
                { id: "col-3", title: "Done", cards: [] },
              ],
            };

            const addCard = (colId: string) => {
              const nextCols = boardData.columns.map((c) => {
                if (c.id !== colId) return c;
                return {
                  ...c,
                  cards: [...c.cards, { id: crypto.randomUUID(), text: "New card" }],
                };
              });
              onUpdateProperties(block.id, { boardData: { columns: nextCols } });
            };

            const updateCardText = (colId: string, cardId: string, text: string) => {
              const nextCols = boardData.columns.map((c) => {
                if (c.id !== colId) return c;
                return {
                  ...c,
                  cards: c.cards.map((cd) => (cd.id === cardId ? { ...cd, text } : cd)),
                };
              });
              onUpdateProperties(block.id, { boardData: { columns: nextCols } });
            };

            const deleteCard = (colId: string, cardId: string) => {
              const nextCols = boardData.columns.map((c) => {
                if (c.id !== colId) return c;
                return {
                  ...c,
                  cards: c.cards.filter((cd) => cd.id !== cardId),
                };
              });
              onUpdateProperties(block.id, { boardData: { columns: nextCols } });
            };

            return (
              <div className="my-2 grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-900/40">
                {boardData.columns.map((col) => (
                  <div key={col.id} className="rounded-lg bg-white dark:bg-zinc-800/60 p-2.5 shadow-2xs border border-zinc-200/60 dark:border-zinc-700/60 flex flex-col gap-2">
                    <div className="flex items-center justify-between text-xs font-bold text-zinc-700 dark:text-zinc-300">
                      <span>{col.title}</span>
                      <span className="text-[10px] text-zinc-400 font-normal">{col.cards.length}</span>
                    </div>
                    <div className="space-y-1.5 min-h-[4rem]">
                      {col.cards.map((card) => (
                        <div key={card.id} className="flex items-center justify-between p-2 rounded-md bg-zinc-50 dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-700 text-xs group/card">
                          <input
                            type="text"
                            value={card.text}
                            onChange={(e) => updateCardText(col.id, card.id, e.target.value)}
                            className="bg-transparent border-none outline-none w-full text-zinc-800 dark:text-zinc-200"
                          />
                          <button
                            type="button"
                            onClick={() => deleteCard(col.id, card.id)}
                            className="text-zinc-400 hover:text-red-500 opacity-0 group-hover/card:opacity-100 ml-1 text-xs"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={() => addCard(col.id)}
                      className="text-[11px] text-zinc-500 hover:text-indigo-600 text-left pt-1"
                    >
                      + Add card
                    </button>
                  </div>
                ))}
              </div>
            );
          })()}

          {/* GALLERY */}
          {block.type === "gallery" && (() => {
            const galleryData = block.properties?.galleryData || {
              items: [
                { id: "g-1", title: "Project Brief", tag: "Design" },
                { id: "g-2", title: "Architecture Spec", tag: "Engineering" },
                { id: "g-3", title: "Customer Interviews", tag: "Research" },
              ],
            };

            const addItem = () => {
              onUpdateProperties(block.id, {
                galleryData: {
                  items: [...galleryData.items, { id: crypto.randomUUID(), title: "New Item", tag: "General" }],
                },
              });
            };

            const updateItem = (id: string, title: string) => {
              onUpdateProperties(block.id, {
                galleryData: {
                  items: galleryData.items.map((it) => (it.id === id ? { ...it, title } : it)),
                },
              });
            };

            return (
              <div className="my-2 p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {galleryData.items.map((item) => (
                    <div key={item.id} className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 p-3 shadow-2xs flex flex-col justify-between h-28">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] uppercase font-semibold text-indigo-500">{item.tag || "Item"}</span>
                      </div>
                      <input
                        type="text"
                        value={item.title}
                        onChange={(e) => updateItem(item.id, e.target.value)}
                        className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 bg-transparent border-none outline-none w-full"
                      />
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={addItem}
                  className="mt-3 text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
                >
                  + Add gallery item
                </button>
              </div>
            );
          })()}

          {/* LIST VIEW */}
          {block.type === "list" && (() => {
            const listData = block.properties?.listData || {
              items: [
                { id: "l-1", title: "Launch MVP", status: "Active" },
                { id: "l-2", title: "Verify Stripe Webhook", status: "Done" },
              ],
            };

            const addListItem = () => {
              onUpdateProperties(block.id, {
                listData: {
                  items: [...listData.items, { id: crypto.randomUUID(), title: "New Item", status: "Pending" }],
                },
              });
            };

            const updateListItem = (id: string, title: string) => {
              onUpdateProperties(block.id, {
                listData: {
                  items: listData.items.map((it) => (it.id === id ? { ...it, title } : it)),
                },
              });
            };

            return (
              <div className="my-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 p-2 shadow-2xs">
                <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {listData.items.map((it) => (
                    <div key={it.id} className="flex items-center justify-between py-2 px-2 text-xs">
                      <input
                        type="text"
                        value={it.title}
                        onChange={(e) => updateListItem(it.id, e.target.value)}
                        className="bg-transparent border-none outline-none flex-1 text-zinc-800 dark:text-zinc-200 font-medium"
                      />
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                        {it.status || "Status"}
                      </span>
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={addListItem}
                  className="pt-2 px-2 text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
                >
                  + Add item
                </button>
              </div>
            );
          })()}

          {/* CALENDAR */}
          {block.type === "calendar" && (() => {
            const calData = block.properties?.calendarData || {
              events: [{ id: "ev-1", title: "Product Sync", date: new Date().toISOString().split("T")[0] }],
            };

            const addEvent = () => {
              onUpdateProperties(block.id, {
                calendarData: {
                  events: [
                    ...calData.events,
                    { id: crypto.randomUUID(), title: "New Event", date: new Date().toISOString().split("T")[0] },
                  ],
                },
              });
            };

            return (
              <div className="my-2 p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50">
                <div className="flex items-center justify-between pb-2 border-b border-zinc-200 dark:border-zinc-800 mb-2">
                  <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5 text-indigo-500" /> Event Calendar
                  </span>
                  <button
                    type="button"
                    onClick={addEvent}
                    className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
                  >
                    + Add event
                  </button>
                </div>
                <div className="space-y-1.5">
                  {calData.events.map((ev) => (
                    <div key={ev.id} className="flex items-center justify-between p-2 rounded-lg bg-white dark:bg-zinc-800 border border-zinc-200/60 dark:border-zinc-700 text-xs">
                      <span className="font-medium text-zinc-800 dark:text-zinc-200">{ev.title}</span>
                      <span className="text-[11px] text-zinc-400 font-mono">{ev.date}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}

          {/* EQUATION */}
          {block.type === "equation" && (
            <div className="my-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/60 p-3 text-center">
              <div className="font-mono text-base font-semibold text-indigo-600 dark:text-indigo-400 py-2">
                {block.properties?.equationFormula || "f(x) = a x^2 + b x + c"}
              </div>
              <input
                type="text"
                value={block.properties?.equationFormula || ""}
                onChange={(e) => onUpdateProperties(block.id, { equationFormula: e.target.value })}
                placeholder="Type equation (e.g. E = mc^2)..."
                className="w-full text-center text-xs text-zinc-400 bg-transparent border-t border-zinc-200 dark:border-zinc-800 pt-2 outline-none focus:text-zinc-700 dark:focus:text-zinc-300 font-mono"
              />
            </div>
          )}

          {/* TABLE OF CONTENTS */}
          {block.type === "table_of_contents" && (() => {
            const headings = allBlocks.filter((b) =>
              b.type === "heading_1" || b.type === "heading_2" || b.type === "heading_3"
            );

            return (
              <div className="my-2 p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50">
                <div className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <ListTree className="h-3.5 w-3.5 text-indigo-500" /> Table of Contents
                </div>
                {headings.length === 0 ? (
                  <p className="text-xs text-zinc-400 italic">No headings yet. Add H1, H2, or H3 blocks to see outline.</p>
                ) : (
                  <div className="space-y-1">
                    {headings.map((h) => {
                      const indent =
                        h.type === "heading_1"
                          ? "pl-0 font-medium"
                          : h.type === "heading_2"
                          ? "pl-3 text-zinc-600 dark:text-zinc-400"
                          : "pl-6 text-zinc-500";
                      return (
                        <a
                          key={h.id}
                          href={`#block-${h.id}`}
                          className={cn("block text-xs hover:text-indigo-600 dark:hover:text-indigo-400 hover:underline", indent)}
                        >
                          {h.content || "Untitled Section"}
                        </a>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })()}

          {/* BREADCRUMB */}
          {block.type === "breadcrumb" && (
            <div className="my-1.5 flex items-center gap-1.5 text-xs text-zinc-400 select-none py-1">
              <FolderTree className="h-3.5 w-3.5 text-zinc-400" />
              <span className="hover:text-zinc-600 dark:hover:text-zinc-200 cursor-pointer">Workspace</span>
              <span>/</span>
              <span className="font-medium text-zinc-800 dark:text-zinc-200">{pageTitle || "Current Page"}</span>
            </div>
          )}

          {/* BUTTON */}
          {block.type === "button" && (
            <div className="my-2 flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  if (block.properties?.buttonData?.url) {
                    window.open(block.properties.buttonData.url, "_blank");
                  }
                }}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white text-xs font-semibold shadow-sm transition-all"
              >
                {block.properties?.buttonData?.label || block.content || "Button Action"}
              </button>
              <input
                type="text"
                value={block.properties?.buttonData?.label || block.content || ""}
                onChange={(e) => {
                  onUpdateProperties(block.id, {
                    buttonData: {
                      label: e.target.value,
                      url: block.properties?.buttonData?.url || "",
                    },
                  });
                  onUpdateContent(block.id, e.target.value);
                }}
                placeholder="Label..."
                className="text-xs text-zinc-500 border border-zinc-200 dark:border-zinc-800 rounded-lg px-2 py-1 bg-transparent"
              />
              <input
                type="url"
                value={block.properties?.buttonData?.url || ""}
                onChange={(e) => {
                  onUpdateProperties(block.id, {
                    buttonData: {
                      label: block.properties?.buttonData?.label || block.content || "Button Action",
                      url: e.target.value,
                    },
                  });
                }}
                placeholder="https://..."
                className="text-xs text-zinc-500 border border-zinc-200 dark:border-zinc-800 rounded-lg px-2 py-1 bg-transparent w-48"
              />
            </div>
          )}

          {/* Inline Entity Connection Badges */}
          {blockConnections.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 mt-1.5 pt-0.5 select-none">
              {blockConnections.map((conn) => {
                const relType = (conn.metadata?.relation_type as RelationType) || "related_to";
                const relLabel = RELATION_LABELS[relType] || "Related to";

                return (
                  <button
                    key={conn.id}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onClickConnection?.(conn);
                    }}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium border border-indigo-200/80 dark:border-indigo-800/80 bg-indigo-50/60 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 hover:border-indigo-300 dark:hover:border-indigo-700 transition-colors shadow-2xs group"
                    title={`Connected to ${conn.target_type}: ${conn.target_title} (${relLabel})`}
                  >
                    <Sparkles className="h-2.5 w-2.5 text-indigo-500 shrink-0" />
                    <span className="capitalize text-[10px] text-zinc-500 dark:text-zinc-400 font-normal">
                      {conn.target_type} ·
                    </span>
                    <span className="truncate max-w-[180px] font-medium">{conn.target_title}</span>
                    <span className="text-[9px] px-1 py-0.2 rounded bg-indigo-100/80 dark:bg-indigo-900/60 text-indigo-800 dark:text-indigo-200 font-normal">
                      {relLabel}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Drop indicator: AFTER */}
      {dropIndicatorPosition === "after" && (
        <div className="h-0.5 w-full bg-blue-500 rounded-full mt-1 shadow-xs pointer-events-none animate-in fade-in duration-100" />
      )}

      {/* PDF Modal */}
      {isPdfOpen && block.properties?.mediaUrl && (
        <PdfViewerModal
          isOpen={true}
          onClose={() => setIsPdfOpen(false)}
          pdfUrl={block.properties.mediaUrl}
          title={block.properties.fileName || "PDF Document"}
          downloadUrl={block.properties.mediaUrl}
        />
      )}

      {/* Image Lightbox */}
      {isLightboxOpen && block.properties?.mediaUrl && (
        <div
          onClick={() => setIsLightboxOpen(false)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md cursor-zoom-out animate-in fade-in duration-150"
        >
          <div className="relative max-w-5xl max-h-[90vh] flex flex-col items-center">
            <img
              src={block.properties.mediaUrl}
              alt={block.properties.caption || "Full size preview"}
              className="max-w-full max-h-[85vh] object-contain rounded-xl shadow-2xl"
            />
            {block.properties.caption && (
              <p className="mt-3 text-xs text-white/80 bg-black/50 px-3 py-1.5 rounded-lg">
                {block.properties.caption}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
