"use client";

import * as React from "react";
import {
  Type,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  CheckSquare,
  Quote,
  Minus,
  Code2,
  Lightbulb,
} from "lucide-react";
import { BlockType } from "@/lib/pages/types";
import { cn } from "@/lib/utils";

export interface SlashMenuItem {
  type: BlockType;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  keywords: string[];
}

export const SLASH_COMMANDS: SlashMenuItem[] = [
  {
    type: "paragraph",
    label: "Text",
    description: "Start writing with plain text.",
    icon: Type,
    keywords: ["text", "paragraph", "p", "plain"],
  },
  {
    type: "heading_1",
    label: "Heading 1",
    description: "Big section heading.",
    icon: Heading1,
    keywords: ["h1", "heading 1", "title", "large"],
  },
  {
    type: "heading_2",
    label: "Heading 2",
    description: "Medium section heading.",
    icon: Heading2,
    keywords: ["h2", "heading 2", "subtitle", "medium"],
  },
  {
    type: "heading_3",
    label: "Heading 3",
    description: "Small section heading.",
    icon: Heading3,
    keywords: ["h3", "heading 3", "sub", "small"],
  },
  {
    type: "bullet_list",
    label: "Bulleted list",
    description: "Create a simple bulleted list.",
    icon: List,
    keywords: ["bullet", "list", "ul", "point"],
  },
  {
    type: "numbered_list",
    label: "Numbered list",
    description: "Create a list with numbering.",
    icon: ListOrdered,
    keywords: ["number", "ordered", "ol", "1."],
  },
  {
    type: "checklist",
    label: "To-do list",
    description: "Track tasks with a checklist.",
    icon: CheckSquare,
    keywords: ["todo", "task", "check", "checklist"],
  },
  {
    type: "quote",
    label: "Quote",
    description: "Capture a quotation or highlight text.",
    icon: Quote,
    keywords: ["quote", "blockquote", "citation"],
  },
  {
    type: "divider",
    label: "Divider",
    description: "Visually divide blocks with a line.",
    icon: Minus,
    keywords: ["divider", "line", "separator", "hr"],
  },
  {
    type: "code",
    label: "Code Block",
    description: "Capture code snippets with syntax highlighting.",
    icon: Code2,
    keywords: ["code", "snippet", "javascript", "typescript", "python"],
  },
  {
    type: "callout",
    label: "Callout",
    description: "Highlight important context with an icon.",
    icon: Lightbulb,
    keywords: ["callout", "info", "warning", "note", "tip"],
  },
];

interface SlashMenuProps {
  query: string;
  onSelect: (type: BlockType) => void;
  onClose: () => void;
  position: { top: number; left: number };
}

export function SlashMenu({ query, onSelect, onClose, position }: SlashMenuProps) {
  const [selectedIndex, setSelectedIndex] = React.useState(0);
  const menuRef = React.useRef<HTMLDivElement>(null);

  const filteredItems = React.useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return SLASH_COMMANDS;
    return SLASH_COMMANDS.filter(
      (item) =>
        item.label.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q) ||
        item.keywords.some((k) => k.toLowerCase().includes(q))
    );
  }, [query]);

  React.useEffect(() => {
    setSelectedIndex(0);
  }, [filteredItems]);

  React.useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % (filteredItems.length || 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + filteredItems.length) % (filteredItems.length || 1));
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (filteredItems[selectedIndex]) {
          onSelect(filteredItems[selectedIndex].type);
        }
      } else if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [filteredItems, selectedIndex, onSelect, onClose]);

  // Click outside to dismiss
  React.useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onClose]);

  if (filteredItems.length === 0) {
    return null;
  }

  return (
    <div
      ref={menuRef}
      style={{
        top: `${position.top}px`,
        left: `${position.left}px`,
      }}
      className="fixed z-50 w-72 max-h-72 overflow-y-auto rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md p-1.5 shadow-2xl animate-in fade-in zoom-in-95 duration-100 no-scrollbar select-none"
    >
      <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
        Basic Blocks
      </div>
      <div className="space-y-0.5">
        {filteredItems.map((item, index) => {
          const Icon = item.icon;
          const isSelected = index === selectedIndex;

          return (
            <button
              key={item.type}
              type="button"
              onMouseEnter={() => setSelectedIndex(index)}
              onClick={() => onSelect(item.type)}
              className={cn(
                "flex w-full items-center gap-3 rounded-lg px-2.5 py-1.5 text-left transition-colors",
                isSelected
                  ? "bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400"
                  : "text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800/60"
              )}
            >
              <div
                className={cn(
                  "flex h-7 w-7 shrink-0 items-center justify-center rounded-md border",
                  isSelected
                    ? "border-blue-300 bg-white dark:border-blue-700 dark:bg-zinc-800 text-blue-600 dark:text-blue-400 shadow-2xs"
                    : "border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/40 text-zinc-500"
                )}
              >
                <Icon className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium leading-none truncate">{item.label}</div>
                <div className="text-[10px] text-zinc-400 dark:text-zinc-500 truncate mt-0.5">
                  {item.description}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
