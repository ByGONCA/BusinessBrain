"use client";

import * as React from "react";
import {
  CheckSquare,
  Scale,
  FolderGit2,
  Calendar,
  Target,
  FileText,
  User,
  Plus,
  Search,
  X,
  Loader2,
  Link as LinkIcon,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { EntityType, CompanyEntityRecord, PageConnectionRecord, RelationType, RELATION_LABELS } from "@/lib/pages/types";
import {
  getOrganizationEntitiesAction,
  createEntityAndConnectAction,
  connectEntityAction,
} from "@/lib/pages/actions";

interface ConnectModalProps {
  isOpen: boolean;
  onClose: () => void;
  pageId: string;
  sourceType: "page" | "block";
  sourceId: string;
  initialType?: EntityType;
  initialText?: string;
  onConnectionCreated?: (connection: PageConnectionRecord, entity?: CompanyEntityRecord) => void;
}

const ENTITY_CONFIG: Record<
  EntityType,
  { label: string; icon: React.ComponentType<{ className?: string }>; color: string }
> = {
  decision: { label: "Decision", icon: Scale, color: "text-amber-500 bg-amber-500/10 border-amber-500/20" },
  task: { label: "Task", icon: CheckSquare, color: "text-blue-500 bg-blue-500/10 border-blue-500/20" },
  project: { label: "Project", icon: FolderGit2, color: "text-indigo-500 bg-indigo-500/10 border-indigo-500/20" },
  meeting: { label: "Meeting", icon: Calendar, color: "text-purple-500 bg-purple-500/10 border-purple-500/20" },
  goal: { label: "Goal", icon: Target, color: "text-emerald-500 bg-emerald-500/10 border-emerald-500/20" },
  document: { label: "Document", icon: FileText, color: "text-cyan-500 bg-cyan-500/10 border-cyan-500/20" },
  person: { label: "Person", icon: User, color: "text-orange-500 bg-orange-500/10 border-orange-500/20" },
  page: { label: "Page", icon: FileText, color: "text-zinc-500 bg-zinc-500/10 border-zinc-500/20" },
  file: { label: "File", icon: FileText, color: "text-blue-500 bg-blue-500/10 border-blue-500/20" },
};

export function ConnectModal({
  isOpen,
  onClose,
  pageId,
  sourceType,
  sourceId,
  initialType = "task",
  initialText = "",
  onConnectionCreated,
}: ConnectModalProps) {
  const [tab, setTab] = React.useState<"create" | "link">("create");
  const [entityType, setEntityType] = React.useState<EntityType>(initialType);
  const [relationType, setRelationType] = React.useState<RelationType>("related_to");
  const [searchQuery, setSearchQuery] = React.useState("");
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [isLoadingEntities, setIsLoadingEntities] = React.useState(false);
  const [existingEntities, setExistingEntities] = React.useState<CompanyEntityRecord[]>([]);

  // Form fields
  const [title, setTitle] = React.useState("");
  const [content, setContent] = React.useState("");
  const [priority, setPriority] = React.useState<"low" | "medium" | "high">("medium");
  const [status, setStatus] = React.useState("todo");
  const [assigneeName, setAssigneeName] = React.useState("");
  const [dueDate, setDueDate] = React.useState("");

  // Sync initial state when modal opens
  React.useEffect(() => {
    if (isOpen) {
      setEntityType(initialType);
      setRelationType("related_to");
      const text = initialText.trim();
      if (initialType === "decision") {
        setTitle(text ? `Decision: ${text.slice(0, 40)}${text.length > 40 ? "..." : ""}` : "");
        setContent(text);
      } else {
        setTitle(text || "");
        setContent("");
      }
      setTab("create");
    }
  }, [isOpen, initialType, initialText]);

  // Load existing entities when switching to "link" tab
  React.useEffect(() => {
    if (isOpen && tab === "link") {
      let isMounted = true;
      setIsLoadingEntities(true);
      getOrganizationEntitiesAction()
        .then((res) => {
          if (isMounted && res.success) {
            setExistingEntities(res.entities);
          }
        })
        .finally(() => {
          if (isMounted) setIsLoadingEntities(false);
        });
      return () => {
        isMounted = false;
      };
    }
  }, [isOpen, tab]);

  // Handle escape key
  React.useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  async function handleCreateEntity(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const metadata: Record<string, unknown> = {};
      if (entityType === "task") {
        metadata.priority = priority;
        metadata.status = status;
        if (assigneeName) metadata.assigneeName = assigneeName;
        if (dueDate) metadata.dueDate = dueDate;
      } else if (entityType === "decision") {
        metadata.status = "agreed";
      }

      const res = await createEntityAndConnectAction({
        pageId,
        sourceType,
        sourceId,
        type: entityType,
        title: title.trim(),
        content: content.trim(),
        metadata,
        relationType,
      });

      if (res.success && res.connection) {
        onConnectionCreated?.(res.connection, res.entity);
        onClose();
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleLinkEntity(entity: CompanyEntityRecord) {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      const res = await connectEntityAction({
        pageId,
        sourceType,
        sourceId,
        targetType: entity.type,
        targetId: entity.id,
        targetTitle: entity.title,
        metadata: entity.metadata,
        relationType,
      });

      if (res.success && res.connection) {
        onConnectionCreated?.(res.connection, entity);
        onClose();
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  const filteredEntities = existingEntities.filter((item) => {
    const matchesSearch = item.title.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-150">
      <div
        className="w-full max-w-lg rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-150"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
              <Sparkles className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                Connect to Company Brain
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Link {sourceType === "block" ? "block" : "page"} to structured company context
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-md text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-zinc-200 dark:border-zinc-800 px-5 pt-2 gap-4 text-xs font-medium">
          <button
            type="button"
            onClick={() => setTab("create")}
            className={cn(
              "pb-2.5 flex items-center gap-1.5 border-b-2 transition-colors",
              tab === "create"
                ? "border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400 font-semibold"
                : "border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
            )}
          >
            <Plus className="h-3.5 w-3.5" />
            Create New Entity
          </button>
          <button
            type="button"
            onClick={() => setTab("link")}
            className={cn(
              "pb-2.5 flex items-center gap-1.5 border-b-2 transition-colors",
              tab === "link"
                ? "border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400 font-semibold"
                : "border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
            )}
          >
            <LinkIcon className="h-3.5 w-3.5" />
            Link Existing Entity
          </button>
        </div>

        {/* Content */}
        <div className="p-5 flex-1 overflow-y-auto">
          {tab === "create" ? (
            <form onSubmit={handleCreateEntity} className="space-y-4">
              {/* Entity Type Picker */}
              <div>
                <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
                  Entity Type
                </label>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5">
                  {(["task", "decision", "project", "meeting", "goal", "document"] as EntityType[]).map(
                    (type) => {
                      const cfg = ENTITY_CONFIG[type];
                      const Icon = cfg.icon;
                      const isSelected = entityType === type;
                      return (
                        <button
                          key={type}
                          type="button"
                          onClick={() => setEntityType(type)}
                          className={cn(
                            "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-all text-left",
                            isSelected
                              ? "border-indigo-600 bg-indigo-50 text-indigo-700 dark:border-indigo-400 dark:bg-indigo-950/40 dark:text-indigo-300 ring-1 ring-indigo-500"
                              : "border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/60 text-zinc-700 dark:text-zinc-300"
                          )}
                        >
                          <Icon className="h-3.5 w-3.5 shrink-0" />
                          <span className="truncate">{cfg.label}</span>
                        </button>
                      );
                    }
                  )}
                </div>
              </div>

              {/* Relationship Type Picker */}
              <div>
                <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  Relationship Type
                </label>
                <select
                  value={relationType}
                  onChange={(e) => setRelationType(e.target.value as RelationType)}
                  className="w-full rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-2.5 py-1.5 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {Object.entries(RELATION_LABELS).map(([val, label]) => (
                    <option key={val} value={val}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Title Field */}
              <div>
                <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  Title <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={`e.g. ${
                    entityType === "task"
                      ? "Finish calendar sync"
                      : entityType === "decision"
                      ? "Use PostgreSQL for tenant store"
                      : "New project initiative"
                  }`}
                  className="w-full rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-3 py-1.5 text-xs text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  autoFocus
                />
              </div>

              {/* Entity-specific Fields */}
              {entityType === "decision" && (
                <div>
                  <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                    Decision Context / Rationale
                  </label>
                  <textarea
                    rows={3}
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder="Describe why this decision was reached or what context applies..."
                    className="w-full rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-3 py-1.5 text-xs text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                  />
                </div>
              )}

              {entityType === "task" && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                      Priority
                    </label>
                    <select
                      value={priority}
                      onChange={(e) => setPriority(e.target.value as "low" | "medium" | "high")}
                      className="w-full rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-2.5 py-1.5 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="low">Low Priority</option>
                      <option value="medium">Medium Priority</option>
                      <option value="high">High Priority</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                      Status
                    </label>
                    <select
                      value={status}
                      onChange={(e) => setStatus(e.target.value)}
                      className="w-full rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-2.5 py-1.5 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="todo">To Do</option>
                      <option value="in_progress">In Progress</option>
                      <option value="done">Completed</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                      Assignee Name
                    </label>
                    <input
                      type="text"
                      value={assigneeName}
                      onChange={(e) => setAssigneeName(e.target.value)}
                      placeholder="e.g. Sarah Connor"
                      className="w-full rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-3 py-1.5 text-xs text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                      Due Date
                    </label>
                    <input
                      type="date"
                      value={dueDate}
                      onChange={(e) => setDueDate(e.target.value)}
                      className="w-full rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-2.5 py-1.5 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !title.trim()}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white text-xs font-medium transition-colors shadow-sm disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Connecting...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-3.5 w-3.5" />
                      Create & Connect
                    </>
                  )}
                </button>
              </div>
            </form>
          ) : (
            <div className="space-y-3">
              {/* Relationship Type for Link */}
              <div>
                <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  Relationship Type
                </label>
                <select
                  value={relationType}
                  onChange={(e) => setRelationType(e.target.value as RelationType)}
                  className="w-full rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-2.5 py-1.5 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {Object.entries(RELATION_LABELS).map(([val, label]) => (
                    <option key={val} value={val}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Search */}
              <div className="relative">
                <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-zinc-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search existing company entities..."
                  className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  autoFocus
                />
              </div>

              {/* Entity List */}
              <div className="space-y-1.5 max-h-60 overflow-y-auto">
                {isLoadingEntities ? (
                  <div className="flex items-center justify-center py-8 text-xs text-zinc-500 gap-2">
                    <Loader2 className="h-4 w-4 animate-spin text-indigo-500" />
                    Loading entities...
                  </div>
                ) : filteredEntities.length === 0 ? (
                  <div className="text-center py-8 text-xs text-zinc-500 dark:text-zinc-400">
                    No existing entities found. Use &quot;Create New Entity&quot; tab to add one.
                  </div>
                ) : (
                  filteredEntities.map((ent) => {
                    const cfg = ENTITY_CONFIG[ent.type] || ENTITY_CONFIG.document;
                    const Icon = cfg.icon;
                    return (
                      <button
                        key={ent.id}
                        type="button"
                        disabled={isSubmitting}
                        onClick={() => handleLinkEntity(ent)}
                        className="w-full flex items-center justify-between p-2.5 rounded-lg border border-zinc-100 dark:border-zinc-800/60 hover:border-indigo-200 dark:hover:border-indigo-900/40 hover:bg-indigo-50/40 dark:hover:bg-indigo-950/20 text-left transition-colors group"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className={cn("p-1.5 rounded-md border text-xs", cfg.color)}>
                            <Icon className="h-3.5 w-3.5" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-medium text-zinc-800 dark:text-zinc-200 truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400">
                              {ent.title}
                            </p>
                            <p className="text-[11px] text-zinc-400 capitalize">{ent.type}</p>
                          </div>
                        </div>
                        <span className="text-[11px] font-medium text-indigo-600 dark:text-indigo-400 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                          Link <LinkIcon className="h-3 w-3" />
                        </span>
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
