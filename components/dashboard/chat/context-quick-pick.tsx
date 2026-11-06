"use client";

import * as React from "react";
import {
  Search,
  X,
  Check,
  Plus,
  FileText,
  CreditCard,
  TrendingUp,
  Users,
  DollarSign,
  Receipt,
  Brain,
  Target,
  FolderGit2,
  CheckSquare,
  Github,
  GitPullRequest,
  GitCommit,
  Lock,
  Mail,
  Calendar,
} from "lucide-react";
import { useLanguage } from "@/lib/i18n";
import { ContextSourceItem } from "@/lib/ai/auth/types";

interface ContextQuickPickProps {
  isOpen: boolean;
  onClose: () => void;
  sources: ContextSourceItem[];
  selectedSourceIds: string[];
  onToggleSource: (sourceId: string) => void;
}

const LOCALIZED_SYSTEM_SOURCES: Record<string, { label: string; desc?: string }> = {
  "area:pages": { label: "Pages & Documents", desc: "Operational manuals, internal documentation, and team notes." },
  "area:emails": { label: "Emails & Communications", desc: "Query synced emails on demand via Gmail/Outlook." },
  "area:calendar": { label: "Calendar & Meetings", desc: "Scheduled events, appointments, and organizational calendar." },
  "area:brain": { label: "Decisions & Organizational Memory", desc: "Record of technical decisions, meeting minutes, and strategic agreements." },
  "area:goals": { label: "Objectives & Strategic Goals", desc: "OKRs, targets, and strategic alignment." },
  "area:projects": { label: "Projects & Initiatives", desc: "Corporate initiatives, teams, and milestone tracking." },
  "area:tasks": { label: "Tasks & Deliverables", desc: "Operational tasks, deliverables, and action plans." },
  "area:finance": { label: "Financial Metrics & Stripe", desc: "MRR, net revenue, customer retention, and Stripe subscriptions." },
  "area:github": { label: "GitHub & Repository Code", desc: "Pull requests, engineering discussions, and commits." },
  "finance:mrr": { label: "MRR & Run-Rate (ARR)", desc: "Monthly recurring revenue, annualized run-rate, and growth." },
  "finance:subscriptions": { label: "Subscriptions & Churn", desc: "Active subscriber count, plans, and retention rates." },
  "finance:revenue": { label: "Net Revenue & Gross Volume", desc: "Cleared period billing and Stripe financial history." },
  "finance:customers": { label: "Customers & LTV Retention", desc: "Active customer contracts and retention metrics." },
  "github:prs": { label: "Pull Requests & Code Reviews", desc: "Code reviews and merge approvals." },
  "github:commits": { label: "Commits & Code History", desc: "Chronological record of commits across repository branches." },
  "email:recent_inbox": { label: "Recent Received Emails", desc: "Latest communications and synced threads via Gmail/Outlook." },
  "email:billing_threads": { label: "Financial Emails & Invoices", desc: "Billing communications, Stripe receipts, and vendor notices." },
  "email:clients": { label: "Client Communications", desc: "Messages exchanged with enterprise clients and partners." },
  "brain:decisions": { label: "Technical & Architectural Decisions", desc: "Formal records of technology choices, architecture, and engineering." },
  "brain:meetings": { label: "Meeting Minutes & Alignments", desc: "History of strategic leadership alignments and notes." },
};

export function ContextQuickPick({
  isOpen,
  onClose,
  sources,
  selectedSourceIds,
  onToggleSource,
}: ContextQuickPickProps) {
  const { locale } = useLanguage();
  const isPt = locale === "pt";

  const [search, setSearch] = React.useState("");
  const containerRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  // Close when clicking outside
  React.useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen, onClose]);

  // Close on Escape
  React.useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Focus input automatically
  React.useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const getItemLabel = (item: ContextSourceItem): string => {
    if (isPt) return item.label;
    return LOCALIZED_SYSTEM_SOURCES[item.id]?.label || item.label;
  };

  const getItemDescription = (item: ContextSourceItem): string | undefined => {
    if (isPt) return item.description;
    return LOCALIZED_SYSTEM_SOURCES[item.id]?.desc || item.description;
  };

  // Flatten all sources into selectable items (strictly exclude 'area:pages' from selectable list)
  const flattenSources = (
    list: ContextSourceItem[],
    parentPath = ""
  ): Array<ContextSourceItem & { path: string }> => {
    const flat: Array<ContextSourceItem & { path: string }> = [];

    for (const item of list) {
      const itemLabel = getItemLabel(item);
      const currentPath = parentPath ? `${parentPath} › ${itemLabel}` : itemLabel;

      // DO NOT add 'area:pages' itself as a selectable option
      if (item.id !== "area:pages") {
        flat.push({ ...item, path: parentPath });
      }

      if (item.children && item.children.length > 0) {
        flat.push(...flattenSources(item.children, currentPath));
      }
    }

    return flat;
  };

  const allFlat = flattenSources(sources);
  const selectedSet = new Set(selectedSourceIds.filter((id) => id !== "area:pages"));

  const normalizedSearch = search.trim().toLowerCase();
  const filtered = allFlat.filter((item) => {
    if (!normalizedSearch) return true;
    const label = getItemLabel(item).toLowerCase();
    const desc = getItemDescription(item)?.toLowerCase() || "";
    const path = item.path.toLowerCase();
    return label.includes(normalizedSearch) || desc.includes(normalizedSearch) || path.includes(normalizedSearch);
  });

  const getSourceIcon = (type: string, id: string, iconString?: string) => {
    if (iconString && iconString.trim() !== "" && iconString.length <= 4) {
      return <span className="text-xs shrink-0 leading-none">{iconString}</span>;
    }
    if (id === "finance:mrr") return <TrendingUp className="h-3.5 w-3.5 text-emerald-400" />;
    if (id === "finance:subscriptions") return <Users className="h-3.5 w-3.5 text-blue-400" />;
    if (id === "finance:revenue") return <DollarSign className="h-3.5 w-3.5 text-emerald-400" />;
    if (id === "finance:customers") return <Receipt className="h-3.5 w-3.5 text-amber-400" />;
    if (id.includes("finance")) return <CreditCard className="h-3.5 w-3.5 text-emerald-400" />;
    if (id === "github:prs") return <GitPullRequest className="h-3.5 w-3.5 text-purple-400" />;
    if (id === "github:commits") return <GitCommit className="h-3.5 w-3.5 text-purple-400" />;
    if (id.includes("github")) return <Github className="h-3.5 w-3.5 text-purple-400" />;
    if (id.includes("email") || type === "email") return <Mail className="h-3.5 w-3.5 text-sky-400" />;
    if (id.includes("calendar") || type === "calendar") return <Calendar className="h-3.5 w-3.5 text-amber-400" />;
    if (id.includes("brain") || type === "brain") return <Brain className="h-3.5 w-3.5 text-blue-400" />;
    if (id.includes("goal") || type === "goal") return <Target className="h-3.5 w-3.5 text-emerald-400" />;
    if (id.includes("project") || type === "project") return <FolderGit2 className="h-3.5 w-3.5 text-indigo-400" />;
    if (id.includes("task") || type === "task") return <CheckSquare className="h-3.5 w-3.5 text-blue-400" />;
    return <FileText className="h-3.5 w-3.5 text-zinc-400" />;
  };

  return (
    <div
      ref={containerRef}
      className="absolute bottom-full mb-2 left-0 z-50 w-80 sm:w-96 max-h-96 rounded-xl border border-border bg-card text-foreground shadow-2xl flex flex-col overflow-hidden text-left animate-in fade-in-0 zoom-in-95 duration-100"
    >
      {/* Search Header */}
      <div className="p-2.5 border-b border-border flex items-center gap-2 bg-surface-secondary">
        <Search className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        <input
          ref={inputRef}
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={isPt ? "Pesquisar páginas, métricas, tarefas..." : "Search pages, metrics, tasks..."}
          className="w-full bg-transparent text-xs text-foreground placeholder:text-muted-foreground focus:outline-none"
        />
        {search ? (
          <button
            type="button"
            onClick={() => setSearch("")}
            className="p-1 rounded text-muted-foreground hover:text-foreground"
          >
            <X className="h-3 w-3" />
          </button>
        ) : (
          <kbd className="hidden sm:inline-block text-[10px] text-muted-foreground/60 font-mono bg-surface-secondary px-1.5 py-0.5 rounded border border-border">
            esc
          </kbd>
        )}
      </div>

      {/* Quick Pick Items List */}
      <div className="flex-1 overflow-y-auto p-1.5 space-y-0.5">
        {filtered.length === 0 ? (
          <div className="py-8 text-center text-xs text-muted-foreground">
            {isPt ? "Nenhuma fonte encontrada." : "No sources found."}
          </div>
        ) : (
          filtered.map((item) => {
            const isSelected = selectedSet.has(item.id);
            const isDisabled = !item.hasAccess;
            const label = getItemLabel(item);
            const desc = getItemDescription(item);

            return (
              <div
                key={item.id}
                onClick={() => {
                  if (!isDisabled) {
                    onToggleSource(item.id);
                  }
                }}
                className={`flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg text-xs cursor-pointer transition-colors ${
                  isSelected
                    ? "bg-white/[0.08] text-foreground font-medium"
                    : "text-muted-foreground hover:text-foreground hover:bg-surface-secondary"
                } ${isDisabled ? "opacity-40 cursor-not-allowed hover:bg-transparent" : ""}`}
              >
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <div className="shrink-0 flex items-center justify-center">
                    {getSourceIcon(item.type, item.id, item.icon)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate">{label}</span>
                      {item.requiresExplicitGrant && (
                        <span className="text-[9px] uppercase font-mono px-1 py-0.2 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 font-bold shrink-0">
                          {isPt ? "Restrito" : "Restricted"}
                        </span>
                      )}
                    </div>
                    {item.path ? (
                      <p className="text-[10px] text-muted-foreground/70 truncate">
                        {item.path}
                      </p>
                    ) : desc ? (
                      <p className="text-[10px] text-muted-foreground/70 truncate">
                        {desc}
                      </p>
                    ) : null}
                  </div>
                </div>

                <div className="shrink-0 flex items-center">
                  {isDisabled ? (
                    <Lock className="h-3 w-3 text-muted-foreground" />
                  ) : isSelected ? (
                    <div className="h-4 w-4 rounded-md bg-surface-secondary text-zinc-200 border border-border-strong flex items-center justify-center shadow-xs">
                      <Check className="h-2.5 w-2.5 stroke-[3]" />
                    </div>
                  ) : (
                    <div className="h-4 w-4 rounded-md border border-white/[0.15] hover:border-white/[0.3] flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors">
                      <Plus className="h-2.5 w-2.5" />
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Footer Info */}
      <div className="px-3 py-1.5 border-t border-border bg-surface-secondary/60 flex items-center justify-between text-[10px] text-muted-foreground">
        <span>
          {selectedSet.size} {isPt ? "fontes ativas" : "active sources"}
        </span>
        <span>{isPt ? "Clique para adicionar ou remover" : "Click to add or remove"}</span>
      </div>
    </div>
  );
}
