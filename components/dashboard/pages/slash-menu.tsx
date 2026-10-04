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
  ChevronRight,
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
  Sparkles,
  Brain,
  Link2,
  AtSign,
  Scale,
  FolderGit2,
  CalendarClock,
  Target,
} from "lucide-react";
import { BlockType } from "@/lib/pages/types";
import { cn } from "@/lib/utils";

export type SlashCategory =
  | "suggested"
  | "basic"
  | "media"
  | "database"
  | "company_brain"
  | "advanced";

export type SlashActionId =
  | "create_task"
  | "create_project"
  | "create_meeting"
  | "create_goal"
  | "create_decision"
  | "connect"
  | "mention"
  | "save_memory"
  | "create_page";

export interface SlashMenuItem {
  id: string;
  category: SlashCategory;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  keywords: string[];
  blockType?: BlockType;
  actionId?: SlashActionId;
}

export const CATEGORY_LABELS: Record<SlashCategory, string> = {
  suggested: "Suggested",
  basic: "Basic Blocks",
  media: "Media",
  database: "Database & Views",
  company_brain: "Company Brain",
  advanced: "Advanced",
};

export const ALL_SLASH_COMMANDS: SlashMenuItem[] = [
  // SUGGESTED
  {
    id: "sug_text",
    category: "suggested",
    label: "Text",
    description: "Start writing with plain paragraph text.",
    icon: Type,
    keywords: ["text", "paragraph", "p", "plain"],
    blockType: "paragraph",
  },
  {
    id: "sug_heading",
    category: "suggested",
    label: "Heading 1",
    description: "Big section heading.",
    icon: Heading1,
    keywords: ["h1", "heading 1", "title", "large"],
    blockType: "heading_1",
  },
  {
    id: "sug_page",
    category: "suggested",
    label: "Subpage",
    description: "Nest a new subpage inside this page.",
    icon: FileText,
    keywords: ["page", "subpage", "nested", "doc"],
    actionId: "create_page",
  },
  {
    id: "sug_task",
    category: "suggested",
    label: "Company Task",
    description: "Track an actionable item in Company Brain.",
    icon: CheckSquare,
    keywords: ["task", "todo", "action", "cb"],
    actionId: "create_task",
  },
  {
    id: "sug_meeting",
    category: "suggested",
    label: "Meeting",
    description: "Log meeting agenda, notes and sync.",
    icon: CalendarClock,
    keywords: ["meeting", "agenda", "sync", "call"],
    actionId: "create_meeting",
  },

  // BASIC
  {
    id: "basic_text",
    category: "basic",
    label: "Text",
    description: "Just start typing with plain text.",
    icon: Type,
    keywords: ["text", "paragraph", "p"],
    blockType: "paragraph",
  },
  {
    id: "basic_h1",
    category: "basic",
    label: "Heading 1",
    description: "Large section heading.",
    icon: Heading1,
    keywords: ["h1", "heading 1", "title", "large"],
    blockType: "heading_1",
  },
  {
    id: "basic_h2",
    category: "basic",
    label: "Heading 2",
    description: "Medium section heading.",
    icon: Heading2,
    keywords: ["h2", "heading 2", "subtitle", "medium"],
    blockType: "heading_2",
  },
  {
    id: "basic_h3",
    category: "basic",
    label: "Heading 3",
    description: "Small section heading.",
    icon: Heading3,
    keywords: ["h3", "heading 3", "sub", "small"],
    blockType: "heading_3",
  },
  {
    id: "basic_bullet",
    category: "basic",
    label: "Bulleted list",
    description: "Create a simple bulleted list.",
    icon: List,
    keywords: ["bullet", "list", "ul", "point"],
    blockType: "bullet_list",
  },
  {
    id: "basic_numbered",
    category: "basic",
    label: "Numbered list",
    description: "Create a list with numbering.",
    icon: ListOrdered,
    keywords: ["number", "ordered", "ol", "1."],
    blockType: "numbered_list",
  },
  {
    id: "basic_todo",
    category: "basic",
    label: "To-do list",
    description: "Track tasks with a checklist.",
    icon: CheckSquare,
    keywords: ["todo", "task", "check", "checklist"],
    blockType: "checklist",
  },
  {
    id: "basic_toggle",
    category: "basic",
    label: "Toggle list",
    description: "Toggles can show and hide content.",
    icon: ChevronRight,
    keywords: ["toggle", "collapse", "dropdown", "fold"],
    blockType: "toggle",
  },
  {
    id: "basic_quote",
    category: "basic",
    label: "Quote",
    description: "Capture a quote or highlight phrase.",
    icon: Quote,
    keywords: ["quote", "blockquote", "citation"],
    blockType: "quote",
  },
  {
    id: "basic_callout",
    category: "basic",
    label: "Callout",
    description: "Highlight important context with an icon.",
    icon: Lightbulb,
    keywords: ["callout", "info", "warning", "note", "tip"],
    blockType: "callout",
  },
  {
    id: "basic_divider",
    category: "basic",
    label: "Divider",
    description: "Visually divide blocks with a line.",
    icon: Minus,
    keywords: ["divider", "line", "separator", "hr"],
    blockType: "divider",
  },

  // MEDIA
  {
    id: "media_image",
    category: "media",
    label: "Image",
    description: "Upload or embed with a link.",
    icon: ImageIcon,
    keywords: ["image", "picture", "photo", "img"],
    blockType: "image",
  },
  {
    id: "media_video",
    category: "media",
    label: "Video",
    description: "Embed from YouTube, Vimeo or video URL.",
    icon: VideoIcon,
    keywords: ["video", "embed", "player", "mp4"],
    blockType: "video",
  },
  {
    id: "media_audio",
    category: "media",
    label: "Audio",
    description: "Embed an audio recording or podcast.",
    icon: Music,
    keywords: ["audio", "sound", "podcast", "mp3"],
    blockType: "audio",
  },
  {
    id: "media_file",
    category: "media",
    label: "File",
    description: "Attach a PDF, document, or spreadsheet.",
    icon: FileText,
    keywords: ["file", "attachment", "upload", "pdf"],
    blockType: "file",
  },
  {
    id: "media_code",
    category: "media",
    label: "Code Block",
    description: "Capture code snippets with syntax highlighting.",
    icon: Code2,
    keywords: ["code", "snippet", "javascript", "typescript", "python"],
    blockType: "code",
  },
  {
    id: "media_bookmark",
    category: "media",
    label: "Web bookmark",
    description: "Save a link as a visual preview bookmark.",
    icon: Bookmark,
    keywords: ["bookmark", "link", "url", "web"],
    blockType: "bookmark",
  },

  // DATABASE & STRUCTURED VIEWS
  {
    id: "db_table",
    category: "database",
    label: "Table",
    description: "Simple structured grid table.",
    icon: TableIcon,
    keywords: ["table", "grid", "database", "rows"],
    blockType: "table",
  },
  {
    id: "db_board",
    category: "database",
    label: "Board (Kanban)",
    description: "Organize items across workflow columns.",
    icon: Kanban,
    keywords: ["board", "kanban", "columns", "pipeline"],
    blockType: "board",
  },
  {
    id: "db_gallery",
    category: "database",
    label: "Gallery",
    description: "Display cards in a visual gallery grid.",
    icon: LayoutGrid,
    keywords: ["gallery", "cards", "visual", "grid"],
    blockType: "gallery",
  },
  {
    id: "db_list",
    category: "database",
    label: "List View",
    description: "Compact database list with status tags.",
    icon: ListFilter,
    keywords: ["list", "database list", "status"],
    blockType: "list",
  },
  {
    id: "db_calendar",
    category: "database",
    label: "Calendar",
    description: "Track events and deadlines by date.",
    icon: Calendar,
    keywords: ["calendar", "events", "dates", "schedule"],
    blockType: "calendar",
  },

  // COMPANY BRAIN
  {
    id: "cb_task",
    category: "company_brain",
    label: "Task",
    description: "Create or link a real Company Brain task.",
    icon: CheckSquare,
    keywords: ["task", "todo", "assignee", "due"],
    actionId: "create_task",
  },
  {
    id: "cb_project",
    category: "company_brain",
    label: "Project",
    description: "Link to an active organization project.",
    icon: FolderGit2,
    keywords: ["project", "initiative", "roadmap"],
    actionId: "create_project",
  },
  {
    id: "cb_meeting",
    category: "company_brain",
    label: "Meeting",
    description: "Schedule or log a team sync meeting.",
    icon: CalendarClock,
    keywords: ["meeting", "sync", "notes", "standup"],
    actionId: "create_meeting",
  },
  {
    id: "cb_goal",
    category: "company_brain",
    label: "Goal",
    description: "Track key quarterly or company objectives.",
    icon: Target,
    keywords: ["goal", "okr", "target", "metric"],
    actionId: "create_goal",
  },
  {
    id: "cb_decision",
    category: "company_brain",
    label: "Decision",
    description: "Record an architectural or product decision.",
    icon: Scale,
    keywords: ["decision", "adr", "consensus", "agreed"],
    actionId: "create_decision",
  },
  {
    id: "cb_connect",
    category: "company_brain",
    label: "Connect",
    description: "Connect this block to any Company Brain entity.",
    icon: Link2,
    keywords: ["connect", "link", "relation", "relate"],
    actionId: "connect",
  },
  {
    id: "cb_mention",
    category: "company_brain",
    label: "Mention (@)",
    description: "Mention a page, person, or entity inline.",
    icon: AtSign,
    keywords: ["mention", "@", "person", "tag"],
    actionId: "mention",
  },
  {
    id: "cb_memory",
    category: "company_brain",
    label: "Save as Memory",
    description: "Mark content for durable company knowledge memory.",
    icon: Brain,
    keywords: ["memory", "brain", "knowledge", "save"],
    actionId: "save_memory",
  },

  // ADVANCED
  {
    id: "adv_equation",
    category: "advanced",
    label: "Equation",
    description: "Mathematical formula with LaTeX preview.",
    icon: Sigma,
    keywords: ["equation", "math", "formula", "latex"],
    blockType: "equation",
  },
  {
    id: "adv_toc",
    category: "advanced",
    label: "Table of contents",
    description: "Automatic table of contents from headings.",
    icon: ListTree,
    keywords: ["toc", "table of contents", "outline"],
    blockType: "table_of_contents",
  },
  {
    id: "adv_breadcrumb",
    category: "advanced",
    label: "Breadcrumb",
    description: "Show location in page workspace hierarchy.",
    icon: FolderTree,
    keywords: ["breadcrumb", "hierarchy", "path"],
    blockType: "breadcrumb",
  },
  {
    id: "adv_button",
    category: "advanced",
    label: "Button",
    description: "Interactive link or trigger action button.",
    icon: MousePointerClick,
    keywords: ["button", "link", "cta", "action"],
    blockType: "button",
  },
];

interface SlashMenuProps {
  query: string;
  onSelect: (item: SlashMenuItem) => void;
  onClose: () => void;
  position: { top: number; left: number };
}

const RECENT_KEY = "cb_recent_slash_commands";

export function SlashMenu({ query, onSelect, onClose, position }: SlashMenuProps) {
  const [selectedIndex, setSelectedIndex] = React.useState(0);
  const [recentIds, setRecentIds] = React.useState<string[]>([]);
  const menuRef = React.useRef<HTMLDivElement>(null);

  // Load recently used command IDs from localStorage
  React.useEffect(() => {
    try {
      const stored = localStorage.getItem(RECENT_KEY);
      if (stored) {
        setRecentIds(JSON.parse(stored));
      }
    } catch {}
  }, []);

  const saveRecent = React.useCallback((id: string) => {
    try {
      setRecentIds((prev) => {
        const next = [id, ...prev.filter((item) => item !== id)].slice(0, 5);
        localStorage.setItem(RECENT_KEY, JSON.stringify(next));
        return next;
      });
    } catch {}
  }, []);

  const filteredItems = React.useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) {
      // If no query, show Suggested, followed by Basic, Media, Database, Company Brain, Advanced
      return ALL_SLASH_COMMANDS;
    }
    // Filter by label, description, or keywords
    return ALL_SLASH_COMMANDS.filter((item) => {
      if (item.category === "suggested") return false; // Avoid duplicates in search results
      return (
        item.label.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q) ||
        item.keywords.some((k) => k.toLowerCase().includes(q))
      );
    });
  }, [query]);

  // Group filtered items by category
  const groupedItems = React.useMemo(() => {
    const map = new Map<SlashCategory, SlashMenuItem[]>();
    for (const item of filteredItems) {
      const list = map.get(item.category) || [];
      list.push(item);
      map.set(item.category, list);
    }
    return map;
  }, [filteredItems]);

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
          const item = filteredItems[selectedIndex];
          saveRecent(item.id);
          onSelect(item);
        }
      } else if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [filteredItems, selectedIndex, onSelect, onClose, recentIds, saveRecent]);

  // Scroll active item into view
  React.useEffect(() => {
    const activeEl = menuRef.current?.querySelector(`[data-index="${selectedIndex}"]`);
    if (activeEl) {
      activeEl.scrollIntoView({ block: "nearest" });
    }
  }, [selectedIndex]);

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
    return (
      <div
        ref={menuRef}
        style={{
          top: `${position.top}px`,
          left: `${position.left}px`,
        }}
        className="fixed z-50 w-72 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md p-3 shadow-2xl animate-in fade-in zoom-in-95 duration-100 select-none text-center text-xs text-zinc-400"
      >
        No commands found for &ldquo;/{query}&rdquo;
      </div>
    );
  }

  // Flattened mapping to keep track of item index for arrow navigation
  let runningIndex = 0;

  return (
    <div
      ref={menuRef}
      style={{
        top: `${position.top}px`,
        left: `${position.left}px`,
      }}
      className="fixed z-50 w-80 max-h-80 overflow-y-auto rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md p-1.5 pr-2 shadow-2xl animate-in fade-in zoom-in-95 duration-100 custom-scrollbar select-none"
    >
      {Array.from(groupedItems.entries()).map(([category, items]) => {
        return (
          <div key={category} className="mb-2 last:mb-0">
            <div className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-zinc-400 flex items-center justify-between">
              <span>{CATEGORY_LABELS[category]}</span>
              {category === "company_brain" && (
                <span className="flex items-center gap-1 text-[9px] text-indigo-500 font-medium">
                  <Sparkles className="h-2.5 w-2.5" /> Intelligence
                </span>
              )}
            </div>
            <div className="space-y-0.5">
              {items.map((item) => {
                const itemIndex = runningIndex++;
                const Icon = item.icon;
                const isSelected = itemIndex === selectedIndex;
                const isCompanyBrain = item.category === "company_brain";

                return (
                  <button
                    key={item.id}
                    type="button"
                    data-index={itemIndex}
                    onMouseEnter={() => setSelectedIndex(itemIndex)}
                    onClick={() => {
                      saveRecent(item.id);
                      onSelect(item);
                    }}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-lg px-2.5 py-1.5 text-left transition-colors",
                      isSelected
                        ? isCompanyBrain
                          ? "bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300"
                          : "bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400"
                        : "text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800/60"
                    )}
                  >
                    <div
                      className={cn(
                        "flex h-7 w-7 shrink-0 items-center justify-center rounded-md border",
                        isSelected
                          ? isCompanyBrain
                            ? "border-indigo-300 bg-white dark:border-indigo-700 dark:bg-zinc-800 text-indigo-600 dark:text-indigo-400 shadow-2xs"
                            : "border-blue-300 bg-white dark:border-blue-700 dark:bg-zinc-800 text-blue-600 dark:text-blue-400 shadow-2xs"
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
      })}
    </div>
  );
}
