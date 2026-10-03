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
} from "lucide-react";
import { EditorBlock, BlockType, PageConnectionRecord } from "@/lib/pages/types";
import { EmojiPicker } from "./emoji-picker";
import { setCaretToEnd, focusBlockCaretEnd } from "./caret-utils";
import { cn } from "@/lib/utils";

interface BlockItemProps {
  block: EditorBlock;
  index: number;
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
  onClickConnection?: (connection: PageConnectionRecord) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLElement>, block: EditorBlock, index: number) => void;
  onSlashTrigger: (blockId: string, rect: DOMRect) => void;
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
  onClickConnection,
  onKeyDown,
  onSlashTrigger,
  registerRef,
  onFocusBlock,
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
  const blockContainerRef = React.useRef<HTMLDivElement>(null);
  const menuRef = React.useRef<HTMLDivElement>(null);
  const editableRef = React.useRef<HTMLElement | null>(null);
  const prevTypeRef = React.useRef(block.type);

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

  // Close context menu on outside click
  React.useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    if (menuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [menuOpen]);

  const handleCopyCode = async () => {
    if (!block.content) return;
    await navigator.clipboard.writeText(block.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleInput = (e: React.FormEvent<HTMLElement>) => {
    const text = e.currentTarget.innerText || "";

    // Markdown shortcut detection at start of block
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
      data-block-id={block.id}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={cn(
        "group relative flex flex-col -ml-10 pl-10 py-0.5 transition-all duration-150 rounded-lg",
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
              title="Arrastar para mover ou clicar para opções"
            >
              <GripVertical className="h-3.5 w-3.5" />
            </div>

            {menuOpen && (
              <div className="absolute left-6 top-0 z-50 w-52 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-1.5 shadow-xl animate-in fade-in zoom-in-95 duration-100 select-none">
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
                    <div className="my-1 pl-4 pr-1 py-1 space-y-0.5 border-l border-zinc-200 dark:border-zinc-800 ml-2">
                      {(
                        [
                          { type: "paragraph", label: "Text", icon: "P" },
                          { type: "heading_1", label: "Heading 1", icon: Heading1 },
                          { type: "heading_2", label: "Heading 2", icon: Heading2 },
                          { type: "heading_3", label: "Heading 3", icon: Heading3 },
                          { type: "bullet_list", label: "Bullet list", icon: List },
                          { type: "numbered_list", label: "Numbered list", icon: ListOrdered },
                          { type: "checklist", label: "To-do list", icon: CheckSquare },
                          { type: "quote", label: "Quote", icon: Quote },
                          { type: "code", label: "Code", icon: CodeIcon },
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

                <div className="my-1 h-px bg-zinc-200 dark:bg-zinc-800" />

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
            data-placeholder={showPlaceholder ? "Type '/' for commands..." : ""}
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
            <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-zinc-700 dark:bg-zinc-300 shrink-0" />
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
            <span className="text-sm font-medium text-zinc-500 shrink-0 select-none w-5 text-right">
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
          <div className="flex items-start gap-2.5">
            <input
              type="checkbox"
              checked={block.properties?.checked || false}
              onChange={(e) => onUpdateProperties(block.id, { checked: e.target.checked })}
              className="mt-1 h-4 w-4 rounded border-zinc-300 dark:border-zinc-700 text-blue-600 focus:ring-blue-500/20 cursor-pointer"
            />
            <div
              ref={setRef}
              contentEditable
              suppressContentEditableWarning
              onInput={handleInput}
              onFocus={handleFocus}
              onBlur={handleBlur}
              onKeyDown={(e) => onKeyDown(e, block, index)}
              data-placeholder={showPlaceholder ? "To-do..." : ""}
              className={cn(
                "flex-1 outline-none min-h-[1.5rem] text-sm text-zinc-800 dark:text-zinc-200 leading-relaxed empty:before:content-[attr(data-placeholder)] empty:before:text-zinc-400 empty:before:pointer-events-none",
                block.properties?.checked && "line-through text-zinc-400 dark:text-zinc-500"
              )}
            >
              {block.content}
            </div>
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
            <pre className="p-3 font-mono text-xs overflow-x-auto">
              <code
                ref={setRef}
                contentEditable
                suppressContentEditableWarning
                onInput={handleInput}
                onFocus={handleFocus}
                onBlur={handleBlur}
                onKeyDown={(e) => onKeyDown(e, block, index)}
                data-placeholder={showPlaceholder ? "// write code snippet here..." : ""}
                className="outline-none block min-h-[2.5rem] empty:before:content-[attr(data-placeholder)] empty:before:text-zinc-600 empty:before:pointer-events-none whitespace-pre"
              >
                {block.content}
              </code>
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

        {/* Inline Entity Connection Badges */}
        {blockConnections.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 mt-1.5 pt-0.5 select-none">
            {blockConnections.map((conn) => (
              <button
                key={conn.id}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onClickConnection?.(conn);
                }}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium border border-indigo-200/80 dark:border-indigo-800/80 bg-indigo-50/60 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 hover:border-indigo-300 dark:hover:border-indigo-700 transition-colors shadow-2xs group"
                title={`Connected to ${conn.target_type}: ${conn.target_title}`}
              >
                <Sparkles className="h-2.5 w-2.5 text-indigo-500 shrink-0" />
                <span className="capitalize text-[10px] text-zinc-500 dark:text-zinc-400 font-normal">
                  {conn.target_type} ·
                </span>
                <span className="truncate max-w-[220px] font-medium">{conn.target_title}</span>
              </button>
            ))}
          </div>
        )}
        </div>
      </div>

      {/* Drop indicator: AFTER */}
      {dropIndicatorPosition === "after" && (
        <div className="h-0.5 w-full bg-blue-500 rounded-full mt-1 shadow-xs pointer-events-none animate-in fade-in duration-100" />
      )}
    </div>
  );
}
