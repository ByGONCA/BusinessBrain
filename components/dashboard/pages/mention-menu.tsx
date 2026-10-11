"use client";

import * as React from "react";
import {
  FileText,
  CheckSquare,
  FolderGit2,
  Calendar,
  Target,
  Scale,
  User,
  Search,
  Sparkles,
  Loader2,
} from "lucide-react";
import { CompanyEntityRecord, PageRecord, EntityType } from "@/lib/pages/types";
import { searchPagesAction, getOrganizationEntitiesAction } from "@/lib/pages/actions";
import { cn } from "@/lib/utils";

export interface MentionItem {
  id: string;
  type: EntityType;
  title: string;
  icon?: string;
  subtitle?: string;
}

interface MentionMenuProps {
  query: string;
  onSelect: (item: MentionItem) => void;
  onClose: () => void;
  position: { top: number; left: number };
}

const TYPE_CONFIG: Record<
  EntityType,
  { label: string; icon: React.ComponentType<{ className?: string }>; color: string }
> = {
  page: { label: "Page", icon: FileText, color: "text-zinc-600 bg-zinc-100 dark:bg-zinc-800" },
  task: { label: "Task", icon: CheckSquare, color: "text-blue-600 bg-blue-50 dark:bg-blue-950/40" },
  project: { label: "Project", icon: FolderGit2, color: "text-indigo-600 bg-indigo-50 dark:bg-indigo-950/40" },
  meeting: { label: "Meeting", icon: Calendar, color: "text-purple-600 bg-purple-50 dark:bg-purple-950/40" },
  goal: { label: "Goal", icon: Target, color: "text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40" },
  decision: { label: "Decision", icon: Scale, color: "text-amber-600 bg-amber-50 dark:bg-amber-950/40" },
  person: { label: "Person", icon: User, color: "text-orange-600 bg-orange-50 dark:bg-orange-950/40" },
  document: { label: "Document", icon: FileText, color: "text-cyan-600 bg-cyan-50 dark:bg-cyan-950/40" },
  file: { label: "File", icon: FileText, color: "text-blue-600 bg-blue-50 dark:bg-blue-950/40" },
};

export function MentionMenu({ query, onSelect, onClose, position }: MentionMenuProps) {
  const [selectedIndex, setSelectedIndex] = React.useState(0);
  const [loading, setLoading] = React.useState(true);
  const [items, setItems] = React.useState<MentionItem[]>([]);
  const menuRef = React.useRef<HTMLDivElement>(null);

  // Load pages and entities matching query
  React.useEffect(() => {
    let isCurrent = true;
    setLoading(true);

    Promise.all([
      searchPagesAction(query),
      getOrganizationEntitiesAction(),
    ]).then(([pages, entitiesRes]) => {
      if (!isCurrent) return;

      const pageItems: MentionItem[] = (pages || []).map((p: PageRecord) => ({
        id: p.id,
        type: "page",
        title: p.title || "Untitled",
        icon: p.icon || "📄",
        subtitle: "Workspace Page",
      }));

      const entityItems: MentionItem[] = (entitiesRes.entities || []).map(
        (e: CompanyEntityRecord) => ({
          id: e.id,
          type: e.type,
          title: e.title,
          subtitle: `Company Brain ${e.type.charAt(0).toUpperCase() + e.type.slice(1)}`,
        })
      );

      const all = [...pageItems, ...entityItems];
      const q = query.toLowerCase().trim();
      const filtered = q
        ? all.filter((i) => i.title.toLowerCase().includes(q))
        : all;

      setItems(filtered.slice(0, 25));
      setLoading(false);
    });

    return () => {
      isCurrent = false;
    };
  }, [query]);

  const lastMousePosRef = React.useRef<{ x: number; y: number } | null>(null);
  const isKeyboardNavRef = React.useRef(false);

  const selectedIndexRef = React.useRef(selectedIndex);
  selectedIndexRef.current = selectedIndex;

  const itemsRef = React.useRef(items);
  itemsRef.current = items;

  const onSelectRef = React.useRef(onSelect);
  onSelectRef.current = onSelect;

  const onCloseRef = React.useRef(onClose);
  onCloseRef.current = onClose;

  React.useEffect(() => {
    setSelectedIndex(0);
    lastMousePosRef.current = null;
    isKeyboardNavRef.current = false;
  }, [items]);

  // Scroll active item into view inside container only without moving parent window
  React.useEffect(() => {
    const container = menuRef.current;
    if (!container) return;
    const activeEl = container.querySelector(`[data-index="${selectedIndex}"]`) as HTMLElement | null;
    if (!activeEl) return;

    if (selectedIndex === 0) {
      container.scrollTop = 0;
      return;
    }

    const total = items.length;
    if (selectedIndex === total - 1) {
      container.scrollTop = container.scrollHeight;
      return;
    }

    const elRect = activeEl.getBoundingClientRect();
    const contRect = container.getBoundingClientRect();

    if (elRect.top < contRect.top) {
      container.scrollTop -= contRect.top - elRect.top + 24;
    } else if (elRect.bottom > contRect.bottom) {
      container.scrollTop += elRect.bottom - contRect.bottom + 8;
    }
  }, [selectedIndex, items.length]);

  React.useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const currentItems = itemsRef.current;
      const total = currentItems.length;
      if (!total) return;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        e.stopPropagation();
        isKeyboardNavRef.current = true;
        setSelectedIndex((prev) => (prev + 1) % total);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        e.stopPropagation();
        isKeyboardNavRef.current = true;
        setSelectedIndex((prev) => (prev - 1 + total) % total);
      } else if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        e.stopPropagation();
        const currentItem = currentItems[selectedIndexRef.current];
        if (currentItem) {
          onSelectRef.current(currentItem);
        }
      } else if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        onCloseRef.current();
      }
    }

    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, []);

  // Click outside to dismiss
  React.useEffect(() => {
    function handleClickOutside(e: MouseEvent | TouchEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onCloseRef.current();
      }
    }
    document.addEventListener("mousedown", handleClickOutside, true);
    document.addEventListener("touchstart", handleClickOutside, true);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside, true);
      document.removeEventListener("touchstart", handleClickOutside, true);
    };
  }, []);

  return (
    <div
      ref={menuRef}
      style={{
        top: `${position.top}px`,
        left: `${position.left}px`,
      }}
      onMouseDown={(e) => {
        // Prevent click inside popup from stealing focus or triggering blur on editor
        e.preventDefault();
      }}
      className="fixed z-50 w-72 max-h-72 overflow-y-auto rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md p-1.5 shadow-2xl animate-in fade-in zoom-in-95 duration-100 custom-scrollbar select-none"
    >
      <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-zinc-400 flex items-center justify-between">
        <span>Link & Mention</span>
        <span className="flex items-center gap-1 text-[9px] text-indigo-500 font-medium">
          <Sparkles className="h-2.5 w-2.5" /> Company Brain
        </span>
      </div>

      {loading ? (
        <div className="flex items-center justify-center p-4 text-zinc-400">
          <Loader2 className="h-4 w-4 animate-spin" />
        </div>
      ) : items.length === 0 ? (
        <div className="p-3 text-center text-xs text-zinc-400">
          No matching pages or entities
        </div>
      ) : (
        <div className="space-y-0.5">
          {items.map((item, index) => {
            const cfg = TYPE_CONFIG[item.type] || TYPE_CONFIG.document;
            const Icon = cfg.icon;
            const isSelected = index === selectedIndex;

            return (
              <button
                key={`${item.type}-${item.id}`}
                data-index={index}
                type="button"
                onMouseMove={(e) => {
                  if (
                    lastMousePosRef.current &&
                    lastMousePosRef.current.x === e.clientX &&
                    lastMousePosRef.current.y === e.clientY
                  ) {
                    return;
                  }
                  lastMousePosRef.current = { x: e.clientX, y: e.clientY };
                  isKeyboardNavRef.current = false;
                  if (selectedIndex !== index) {
                    setSelectedIndex(index);
                  }
                }}
                onMouseDown={(e) => {
                  // Prevent focus loss from editor
                  e.preventDefault();
                }}
                onClick={() => onSelect(item)}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left transition-colors",
                  isSelected
                    ? "bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300"
                    : "text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800/60"
                )}
              >
                <div
                  className={cn(
                    "flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-xs",
                    cfg.color
                  )}
                >
                  {item.icon ? item.icon : <Icon className="h-3.5 w-3.5" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium leading-none truncate">{item.title}</div>
                  <div className="text-[10px] text-zinc-400 truncate mt-0.5">
                    {item.subtitle}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
