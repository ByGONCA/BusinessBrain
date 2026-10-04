"use client";

import * as React from "react";
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Code,
  Link as LinkIcon,
  Palette,
  Highlighter,
  MoreHorizontal,
  Heading1,
  Heading2,
  Heading3,
  Quote,
  AlignLeft,
  AlignCenter,
  AlignRight,
  CheckSquare,
  Scale,
  FolderGit2,
  Calendar,
  Target,
  Sparkles,
  Brain,
  Link2,
  Unlink,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { BlockType } from "@/lib/pages/types";

export type FormatType =
  | "bold"
  | "italic"
  | "underline"
  | "strike"
  | "code"
  | "link"
  | "unlink"
  | "color"
  | "highlight"
  | "align-left"
  | "align-center"
  | "align-right";

export type CompanyBrainToolbarAction =
  | "create-task"
  | "create-decision"
  | "add-project"
  | "add-meeting"
  | "create-goal"
  | "connect"
  | "save-memory";

interface FloatingFormatToolbarProps {
  onFormat: (format: FormatType, value?: string) => void;
  onTransformBlock?: (type: BlockType) => void;
  onCompanyBrainAction?: (action: CompanyBrainToolbarAction, selectedText: string) => void;
}

const TEXT_COLORS = [
  { label: "Default", value: "" },
  { label: "Indigo", value: "#6366f1" },
  { label: "Blue", value: "#3b82f6" },
  { label: "Emerald", value: "#10b981" },
  { label: "Amber", value: "#f59e0b" },
  { label: "Rose", value: "#f43f5e" },
  { label: "Purple", value: "#a855f7" },
];

const HIGHLIGHT_COLORS = [
  { label: "None", value: "transparent" },
  { label: "Yellow", value: "rgba(254, 240, 138, 0.4)" },
  { label: "Green", value: "rgba(187, 247, 208, 0.4)" },
  { label: "Blue", value: "rgba(191, 219, 254, 0.4)" },
  { label: "Purple", value: "rgba(233, 213, 255, 0.4)" },
  { label: "Pink", value: "rgba(251, 207, 232, 0.4)" },
];

export function FloatingFormatToolbar({
  onFormat,
  onTransformBlock,
  onCompanyBrainAction,
}: FloatingFormatToolbarProps) {
  const [position, setPosition] = React.useState<{ top: number; left: number } | null>(null);
  const [selectedText, setSelectedText] = React.useState("");
  const [activeMenu, setActiveMenu] = React.useState<"none" | "color" | "highlight" | "more" | "link">("none");
  const toolbarRef = React.useRef<HTMLDivElement>(null);

  // Link input state
  const [linkInputUrl, setLinkInputUrl] = React.useState("");
  const [hasExistingLink, setHasExistingLink] = React.useState(false);
  const [linkError, setLinkError] = React.useState<string | null>(null);
  const savedRangeRef = React.useRef<Range | null>(null);
  const linkInputRef = React.useRef<HTMLInputElement>(null);

  const handleOpenLinkMenu = () => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) return;

    try {
      const range = selection.getRangeAt(0);
      savedRangeRef.current = range.cloneRange();

      let container: Node | null = range.commonAncestorContainer;
      if (container.nodeType === Node.TEXT_NODE) container = container.parentNode;
      const existingAnchor = (container as HTMLElement | null)?.closest("a");

      if (existingAnchor) {
        setLinkInputUrl(existingAnchor.getAttribute("href") || "");
        setHasExistingLink(true);
      } else {
        setLinkInputUrl("");
        setHasExistingLink(false);
      }
      setLinkError(null);
      setActiveMenu((prev) => (prev === "link" ? "none" : "link"));
    } catch {
      // Ignore range clone error
    }
  };

  React.useEffect(() => {
    if (activeMenu === "link") {
      const timer = setTimeout(() => {
        linkInputRef.current?.focus();
        linkInputRef.current?.select();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [activeMenu]);

  const handleApplyLink = () => {
    let url = linkInputUrl.trim();
    if (!url) {
      if (hasExistingLink) {
        handleRemoveLink();
      } else {
        setActiveMenu("none");
      }
      return;
    }

    // Auto-prefix https:// if omitted
    if (
      !url.startsWith("http://") &&
      !url.startsWith("https://") &&
      !url.startsWith("mailto:") &&
      !url.startsWith("/")
    ) {
      url = "https://" + url;
    }

    // Security: only permit safe URL schemes to prevent javascript:/data: XSS via anchor injection
    let parsedUrl: URL | null = null;
    try {
      parsedUrl = new URL(url);
    } catch {
      if (!url.startsWith("/")) {
        setLinkError("Invalid URL format");
        return;
      }
    }
    if (
      parsedUrl &&
      parsedUrl.protocol !== "https:" &&
      parsedUrl.protocol !== "http:" &&
      parsedUrl.protocol !== "mailto:"
    ) {
      setLinkError("Only http://, https://, and mailto: links are permitted.");
      return;
    }

    // Restore saved selection
    const selection = window.getSelection();
    if (selection && savedRangeRef.current) {
      selection.removeAllRanges();
      selection.addRange(savedRangeRef.current);
    }

    onFormat("link", url);
    setActiveMenu("none");
    setLinkInputUrl("");
    setLinkError(null);
  };

  const handleRemoveLink = () => {
    const selection = window.getSelection();
    if (selection && savedRangeRef.current) {
      selection.removeAllRanges();
      selection.addRange(savedRangeRef.current);
    }
    onFormat("unlink");
    setActiveMenu("none");
    setLinkInputUrl("");
    setLinkError(null);
  };

  React.useEffect(() => {
    function handleSelectionChange() {
      const selection = window.getSelection();
      if (!selection || selection.isCollapsed || !selection.toString().trim()) {
        if (activeMenu === "none") {
          setPosition(null);
          setSelectedText("");
        }
        return;
      }

      // Check if selection is within editor content
      try {
        const range = selection.getRangeAt(0);
        const rect = range.getBoundingClientRect();

        if (rect.width === 0 || rect.height === 0) {
          if (activeMenu === "none") {
            setPosition(null);
          }
          return;
        }

        setSelectedText(selection.toString().trim());
        setPosition({
          top: Math.max(10, rect.top - 46),
          left: Math.max(10, rect.left + rect.width / 2 - 160),
        });
      } catch {
        // Selection out of bounds
      }
    }

    document.addEventListener("selectionchange", handleSelectionChange);
    return () => document.removeEventListener("selectionchange", handleSelectionChange);
  }, [activeMenu]);

  // Close menus on outside click
  React.useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (toolbarRef.current && !toolbarRef.current.contains(e.target as Node)) {
        setActiveMenu("none");
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (!position) return null;

  return (
    <div
      ref={toolbarRef}
      style={{ top: `${position.top}px`, left: `${position.left}px` }}
      className="fixed z-50 flex flex-col items-start rounded-lg border border-zinc-200/80 dark:border-zinc-800/80 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md shadow-xl select-none animate-in fade-in zoom-in-95 duration-100"
    >
      {/* Primary Toolbar Bar */}
      <div className="flex items-center gap-0.5 px-1 py-1">
        <button
          type="button"
          onMouseDown={(e) => {
            e.preventDefault();
            onFormat("bold");
          }}
          className="flex h-7 w-7 items-center justify-center rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 transition-colors"
          title="Bold (Ctrl+B)"
        >
          <Bold className="h-3.5 w-3.5" />
        </button>

        <button
          type="button"
          onMouseDown={(e) => {
            e.preventDefault();
            onFormat("italic");
          }}
          className="flex h-7 w-7 items-center justify-center rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 transition-colors"
          title="Italic (Ctrl+I)"
        >
          <Italic className="h-3.5 w-3.5" />
        </button>

        <button
          type="button"
          onMouseDown={(e) => {
            e.preventDefault();
            onFormat("underline");
          }}
          className="flex h-7 w-7 items-center justify-center rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 transition-colors"
          title="Underline (Ctrl+U)"
        >
          <Underline className="h-3.5 w-3.5" />
        </button>

        <button
          type="button"
          onMouseDown={(e) => {
            e.preventDefault();
            onFormat("strike");
          }}
          className="flex h-7 w-7 items-center justify-center rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 transition-colors"
          title="Strikethrough"
        >
          <Strikethrough className="h-3.5 w-3.5" />
        </button>

        <div className="h-4 w-px bg-zinc-200 dark:bg-zinc-800 mx-0.5" />

        <button
          type="button"
          onMouseDown={(e) => {
            e.preventDefault();
            onFormat("code");
          }}
          className="flex h-7 w-7 items-center justify-center rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-mono text-xs transition-colors"
          title="Inline Code"
        >
          <Code className="h-3.5 w-3.5" />
        </button>

        <button
          type="button"
          onMouseDown={(e) => {
            e.preventDefault();
            handleOpenLinkMenu();
          }}
          className={cn(
            "flex h-7 w-7 items-center justify-center rounded-md transition-colors",
            activeMenu === "link"
              ? "bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 font-semibold"
              : "hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300"
          )}
          title="Add Link (Ctrl+K)"
        >
          <LinkIcon className="h-3.5 w-3.5" />
        </button>

        <div className="h-4 w-px bg-zinc-200 dark:bg-zinc-800 mx-0.5" />

        {/* Text Color Toggle */}
        <button
          type="button"
          onMouseDown={(e) => {
            e.preventDefault();
            setActiveMenu(activeMenu === "color" ? "none" : "color");
          }}
          className={cn(
            "flex h-7 w-7 items-center justify-center rounded-md transition-colors",
            activeMenu === "color"
              ? "bg-zinc-200 dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100"
              : "hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300"
          )}
          title="Text Color"
        >
          <Palette className="h-3.5 w-3.5" />
        </button>

        {/* Highlight Toggle */}
        <button
          type="button"
          onMouseDown={(e) => {
            e.preventDefault();
            setActiveMenu(activeMenu === "highlight" ? "none" : "highlight");
          }}
          className={cn(
            "flex h-7 w-7 items-center justify-center rounded-md transition-colors",
            activeMenu === "highlight"
              ? "bg-zinc-200 dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100"
              : "hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300"
          )}
          title="Highlight"
        >
          <Highlighter className="h-3.5 w-3.5" />
        </button>

        <div className="h-4 w-px bg-zinc-200 dark:bg-zinc-800 mx-0.5" />

        {/* More / Transform Menu Toggle */}
        <button
          type="button"
          onMouseDown={(e) => {
            e.preventDefault();
            setActiveMenu(activeMenu === "more" ? "none" : "more");
          }}
          className={cn(
            "flex items-center gap-1 h-7 px-2 rounded-md text-xs font-medium transition-colors",
            activeMenu === "more"
              ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 font-semibold"
              : "hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300"
          )}
          title="Transform & Company Brain Actions"
        >
          <Sparkles className="h-3.5 w-3.5 text-indigo-500" />
          <span>More</span>
        </button>
      </div>

      {/* Link Input Dropdown */}
      {activeMenu === "link" && (
        <div className="p-2 border-t border-zinc-100 dark:border-zinc-800 flex flex-col gap-1.5 bg-zinc-50/95 dark:bg-zinc-900/95 w-80 animate-in fade-in-50 duration-75">
          <div className="flex items-center gap-1.5">
            <div className="relative flex-1">
              <LinkIcon className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-zinc-400 pointer-events-none" />
              <input
                ref={linkInputRef}
                type="text"
                value={linkInputUrl}
                onChange={(e) => {
                  setLinkInputUrl(e.target.value);
                  if (linkError) setLinkError(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleApplyLink();
                  } else if (e.key === "Escape") {
                    e.preventDefault();
                    setActiveMenu("none");
                  }
                }}
                placeholder="Paste URL (e.g. https://...)"
                className="w-full pl-8 pr-2.5 py-1.5 text-xs rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                handleApplyLink();
              }}
              className="px-2.5 py-1.5 text-xs font-semibold rounded-md bg-blue-600 hover:bg-blue-500 text-white transition-colors shrink-0 shadow-xs"
            >
              Apply
            </button>
            {hasExistingLink && (
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  handleRemoveLink();
                }}
                className="p-1.5 text-xs font-medium rounded-md text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors shrink-0"
                title="Remove Link"
              >
                <Unlink className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          {linkError && (
            <p className="text-[11px] text-red-500 font-medium px-1">
              {linkError}
            </p>
          )}
        </div>
      )}

      {/* Color Dropdown */}
      {activeMenu === "color" && (
        <div className="p-2 border-t border-zinc-100 dark:border-zinc-800 flex items-center gap-1.5 bg-zinc-50/50 dark:bg-zinc-900/50 w-full animate-in fade-in-50 duration-75">
          <span className="text-[11px] font-medium text-zinc-500 mr-1">Color:</span>
          {TEXT_COLORS.map((col) => (
            <button
              key={col.label}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                onFormat("color", col.value);
                setActiveMenu("none");
              }}
              className="h-5 w-5 rounded-full border border-zinc-300 dark:border-zinc-700 hover:scale-110 transition-transform"
              style={{ backgroundColor: col.value || "#27272a" }}
              title={col.label}
            />
          ))}
        </div>
      )}

      {/* Highlight Dropdown */}
      {activeMenu === "highlight" && (
        <div className="p-2 border-t border-zinc-100 dark:border-zinc-800 flex items-center gap-1.5 bg-zinc-50/50 dark:bg-zinc-900/50 w-full animate-in fade-in-50 duration-75">
          <span className="text-[11px] font-medium text-zinc-500 mr-1">Highlight:</span>
          {HIGHLIGHT_COLORS.map((col) => (
            <button
              key={col.label}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                onFormat("highlight", col.value);
                setActiveMenu("none");
              }}
              className="h-5 w-5 rounded border border-zinc-300 dark:border-zinc-700 hover:scale-110 transition-transform"
              style={{ backgroundColor: col.value === "transparent" ? "#ffffff" : col.value }}
              title={col.label}
            />
          ))}
        </div>
      )}

      {/* More / Transform Menu */}
      {activeMenu === "more" && (
        <div className="p-2 border-t border-zinc-200 dark:border-zinc-800 w-64 max-h-80 overflow-y-auto bg-white dark:bg-zinc-900 rounded-b-lg shadow-xl text-xs space-y-3 animate-in fade-in-50 duration-75">
          {/* Group 1: TEXT Transform */}
          <div>
            <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-zinc-400">
              Text
            </span>
            <div className="mt-1 space-y-0.5">
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  onTransformBlock?.("paragraph");
                  setActiveMenu("none");
                }}
                className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-left transition-colors"
              >
                <span className="font-medium text-xs">P</span>
                <span>Normal text</span>
              </button>
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  onTransformBlock?.("heading_1");
                  setActiveMenu("none");
                }}
                className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-left transition-colors"
              >
                <Heading1 className="h-3.5 w-3.5" />
                <span>Heading 1</span>
              </button>
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  onTransformBlock?.("heading_2");
                  setActiveMenu("none");
                }}
                className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-left transition-colors"
              >
                <Heading2 className="h-3.5 w-3.5" />
                <span>Heading 2</span>
              </button>
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  onTransformBlock?.("heading_3");
                  setActiveMenu("none");
                }}
                className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-left transition-colors"
              >
                <Heading3 className="h-3.5 w-3.5" />
                <span>Heading 3</span>
              </button>
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  onTransformBlock?.("quote");
                  setActiveMenu("none");
                }}
                className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-left transition-colors"
              >
                <Quote className="h-3.5 w-3.5" />
                <span>Quote</span>
              </button>
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  onTransformBlock?.("code");
                  setActiveMenu("none");
                }}
                className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-left transition-colors"
              >
                <Code className="h-3.5 w-3.5" />
                <span>Code block</span>
              </button>
            </div>
          </div>

          {/* Group 2: FORMAT Alignment */}
          <div className="border-t border-zinc-100 dark:border-zinc-800 pt-2">
            <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-zinc-400">
              Format
            </span>
            <div className="mt-1 flex items-center gap-1 px-1">
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  onFormat("align-left");
                }}
                className="flex-1 flex justify-center py-1 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300"
                title="Align Left"
              >
                <AlignLeft className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  onFormat("align-center");
                }}
                className="flex-1 flex justify-center py-1 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300"
                title="Align Center"
              >
                <AlignCenter className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  onFormat("align-right");
                }}
                className="flex-1 flex justify-center py-1 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300"
                title="Align Right"
              >
                <AlignRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* Group 3: COMPANY BRAIN */}
          <div className="border-t border-zinc-100 dark:border-zinc-800 pt-2">
            <div className="flex items-center gap-1.5 px-2 py-0.5">
              <Sparkles className="h-3 w-3 text-indigo-500" />
              <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                Company Brain
              </span>
            </div>
            <div className="mt-1 space-y-0.5">
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  onCompanyBrainAction?.("create-task", selectedText);
                  setActiveMenu("none");
                }}
                className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-indigo-50/70 dark:hover:bg-indigo-950/40 text-zinc-700 dark:text-zinc-300 text-left transition-colors group"
              >
                <CheckSquare className="h-3.5 w-3.5 text-blue-500 group-hover:scale-110 transition-transform" />
                <span className="font-medium">Create Task</span>
              </button>

              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  onCompanyBrainAction?.("create-decision", selectedText);
                  setActiveMenu("none");
                }}
                className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-indigo-50/70 dark:hover:bg-indigo-950/40 text-zinc-700 dark:text-zinc-300 text-left transition-colors group"
              >
                <Scale className="h-3.5 w-3.5 text-amber-500 group-hover:scale-110 transition-transform" />
                <span className="font-medium">Create Decision</span>
              </button>

              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  onCompanyBrainAction?.("add-project", selectedText);
                  setActiveMenu("none");
                }}
                className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-indigo-50/70 dark:hover:bg-indigo-950/40 text-zinc-700 dark:text-zinc-300 text-left transition-colors group"
              >
                <FolderGit2 className="h-3.5 w-3.5 text-indigo-500 group-hover:scale-110 transition-transform" />
                <span>Add to Project</span>
              </button>

              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  onCompanyBrainAction?.("add-meeting", selectedText);
                  setActiveMenu("none");
                }}
                className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-indigo-50/70 dark:hover:bg-indigo-950/40 text-zinc-700 dark:text-zinc-300 text-left transition-colors group"
              >
                <Calendar className="h-3.5 w-3.5 text-purple-500 group-hover:scale-110 transition-transform" />
                <span>Add to Meeting</span>
              </button>

              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  onCompanyBrainAction?.("create-goal", selectedText);
                  setActiveMenu("none");
                }}
                className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-indigo-50/70 dark:hover:bg-indigo-950/40 text-zinc-700 dark:text-zinc-300 text-left transition-colors group"
              >
                <Target className="h-3.5 w-3.5 text-emerald-500 group-hover:scale-110 transition-transform" />
                <span>Create Goal</span>
              </button>

              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  onCompanyBrainAction?.("connect", selectedText);
                  setActiveMenu("none");
                }}
                className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-indigo-50/70 dark:hover:bg-indigo-950/40 text-zinc-700 dark:text-zinc-300 text-left transition-colors group"
              >
                <Link2 className="h-3.5 w-3.5 text-zinc-400 group-hover:text-indigo-500 transition-colors" />
                <span className="font-medium">Connect to...</span>
              </button>

              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  onCompanyBrainAction?.("save-memory", selectedText);
                  setActiveMenu("none");
                }}
                className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-indigo-50/70 dark:hover:bg-indigo-950/40 text-zinc-700 dark:text-zinc-300 text-left transition-colors group"
              >
                <Brain className="h-3.5 w-3.5 text-pink-500 group-hover:scale-110 transition-transform" />
                <span className="text-zinc-600 dark:text-zinc-400">Save as Memory</span>
                <span className="ml-auto text-[9px] px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-500 font-mono">
                  UI
                </span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
