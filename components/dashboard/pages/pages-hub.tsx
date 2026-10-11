"use client";

// ==============================================================================
// BusinessBrain: Flexible Pages Hub & Knowledge Directory
// Overview of all workspace pages with hierarchy, quick duplicate, search,
// templates, favorites, and organization actions without trapping the user.
// ==============================================================================

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Search,
  Plus,
  Star,
  MoreHorizontal,
  Copy,
  Trash2,
  FileText,
  Clock,
  ExternalLink,
  ChevronRight,
  FolderTree,
  Sparkles,
  BookOpen,
  Check,
  X,
  Loader2,
  Filter,
} from "lucide-react";
import { PhosphorFiles } from "@/components/icons";
import { PageRecord, PageTreeNode } from "@/lib/pages/types";
import { PageIcon } from "./page-icon";
import {
  createPageAction,
  duplicatePageAction,
  archivePageAction,
  togglePageFavoriteAction,
} from "@/lib/pages/actions";
import { cn } from "@/lib/utils";
import { formatRelativeTime } from "@/lib/utils/time";

interface PagesHubProps {
  initialPages: PageRecord[];
  organizationId: string;
}

const TEMPLATES = [
  { id: "blank", title: "Página em Branco", icon: "📄", description: "Começa com um documento limpo" },
  { id: "meeting", title: "Notas de Reunião", icon: "🗓️", description: "Participantes, agenda e ações a tomar" },
  { id: "decision", title: "Registo de Decisão (ADR)", icon: "🎯", description: "Contexto, opções e decisão aprovada" },
  { id: "spec", title: "Especificação Técnica", icon: "📐", description: "Arquitetura, requisitos e milestones" },
  { id: "knowledge", title: "Artigo de Conhecimento", icon: "💡", description: "Guias passo a passo e documentação" },
];

export function PagesHub({ initialPages, organizationId }: PagesHubProps) {
  const router = useRouter();
  const [pages, setPages] = React.useState<PageRecord[]>(initialPages);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [activeTab, setActiveTab] = React.useState<"all" | "favorites" | "hierarchy">("all");
  const [isCreating, setIsCreating] = React.useState(false);
  const [actionMenuPageId, setActionMenuPageId] = React.useState<string | null>(null);
  const [copiedId, setCopiedId] = React.useState<string | null>(null);

  React.useEffect(() => {
    setPages(initialPages);
  }, [initialPages]);

  // Close action menu on click outside
  React.useEffect(() => {
    function handleClickOutside() {
      setActionMenuPageId(null);
    }
    if (actionMenuPageId) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [actionMenuPageId]);

  // Filter pages
  const filteredPages = React.useMemo(() => {
    return pages.filter((p) => {
      if (activeTab === "favorites" && !p.is_favorite) return false;
      if (!searchQuery.trim()) return true;

      const q = searchQuery.toLowerCase();
      const matchTitle = (p.title || "Untitled").toLowerCase().includes(q);
      const matchContent = (p.content_text || "").toLowerCase().includes(q);
      return matchTitle || matchContent;
    });
  }, [pages, activeTab, searchQuery]);

  // Create page
  const handleCreatePage = async (templateId?: string) => {
    setIsCreating(true);
    try {
      const template = TEMPLATES.find((t) => t.id === templateId);
      const res = await createPageAction({
        title: template ? template.title : "Untitled",
        icon: template ? template.icon : "📄",
      });

      if (res.success && res.page) {
        router.push(`/dashboard/pages/${res.page.id}`);
      }
    } finally {
      setIsCreating(false);
    }
  };

  // Duplicate page
  const handleDuplicate = async (pageId: string) => {
    setActionMenuPageId(null);
    const res = await duplicatePageAction({ pageId });
    if (res.success && res.page) {
      setPages((prev) => [res.page as PageRecord, ...prev]);
      router.refresh();
    }
  };

  // Favorite toggle
  const handleToggleFavorite = async (pageId: string) => {
    setPages((prev) =>
      prev.map((p) => (p.id === pageId ? { ...p, is_favorite: !p.is_favorite } : p))
    );
    await togglePageFavoriteAction({ pageId });
  };

  // Archive page
  const handleArchive = async (pageId: string) => {
    setActionMenuPageId(null);
    if (!window.confirm("Tens a certeza que pretendes mover esta página para o lixo?")) return;

    setPages((prev) => prev.filter((p) => p.id !== pageId));
    await archivePageAction({ pageId });
    router.refresh();
  };

  // Copy page link
  const handleCopyLink = async (pageId: string) => {
    if (typeof window !== "undefined") {
      await navigator.clipboard.writeText(`${window.location.origin}/dashboard/pages/${pageId}`);
      setCopiedId(pageId);
      setTimeout(() => setCopiedId(null), 2000);
      setActionMenuPageId(null);
    }
  };

  const favoriteCount = pages.filter((p) => p.is_favorite).length;

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      {/* ================= Header ================= */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-200 dark:border-zinc-800 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
              <PhosphorFiles className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
                Pages & Documentos
              </h1>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Memória e inteligência partilhada da empresa. Documenta decisões, guias e projetos.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={isCreating}
            onClick={() => handleCreatePage()}
            className="flex items-center gap-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white px-3.5 py-2 text-xs font-semibold shadow-xs transition-colors cursor-pointer disabled:opacity-50"
          >
            {isCreating ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Plus className="h-3.5 w-3.5" />
            )}
            <span>Nova Página</span>
          </button>
        </div>
      </div>

      {/* ================= Template Quick Starters ================= */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {TEMPLATES.map((tmpl) => (
          <button
            key={tmpl.id}
            type="button"
            disabled={isCreating}
            onClick={() => handleCreatePage(tmpl.id)}
            className="flex flex-col items-start p-3 rounded-xl border border-zinc-200/90 dark:border-zinc-800/80 bg-white dark:bg-[#18181b] hover:border-blue-500/50 hover:shadow-xs transition-all text-left group cursor-pointer"
          >
            <div className="text-xl mb-1.5">{tmpl.icon}</div>
            <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
              {tmpl.title}
            </span>
            <span className="text-[10px] text-zinc-500 dark:text-zinc-400 line-clamp-1 mt-0.5">
              {tmpl.description}
            </span>
          </button>
        ))}
      </div>

      {/* ================= Search & View Controls ================= */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Tabs */}
        <div className="flex items-center gap-1 p-1 rounded-xl bg-zinc-100/80 dark:bg-zinc-800/60 border border-zinc-200/80 dark:border-zinc-700/60 text-xs">
          <button
            type="button"
            onClick={() => setActiveTab("all")}
            className={cn(
              "px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer",
              activeTab === "all"
                ? "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-2xs font-semibold"
                : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200"
            )}
          >
            Todas ({pages.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("favorites")}
            className={cn(
              "px-3 py-1.5 rounded-lg font-medium transition-colors flex items-center gap-1 cursor-pointer",
              activeTab === "favorites"
                ? "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-2xs font-semibold"
                : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200"
            )}
          >
            <Star className="h-3 w-3 fill-amber-500 text-amber-500" />
            <span>Favoritos ({favoriteCount})</span>
          </button>
        </div>

        {/* Search Input */}
        <div className="relative min-w-[240px] sm:w-72">
          <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-zinc-400 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Pesquisar páginas por título ou texto..."
            className="w-full rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#18181b] pl-8 pr-7 py-2 text-xs text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:border-blue-500 focus:outline-none shadow-2xs"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="absolute right-2.5 top-2.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* ================= Pages Grid / List ================= */}
      {filteredPages.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-zinc-300 dark:border-zinc-800 p-12 text-center space-y-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-zinc-100 dark:bg-zinc-800 mx-auto text-zinc-400">
            <BookOpen className="h-6 w-6" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              {searchQuery ? "Nenhuma página corresponde à pesquisa" : "Sem páginas neste separador"}
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 max-w-sm mx-auto">
              {searchQuery
                ? `Não foram encontrados documentos com o termo "${searchQuery}".`
                : "Cria uma nova página para começar a registar conhecimento na empresa."}
            </p>
          </div>
          <button
            type="button"
            disabled={isCreating}
            onClick={() => handleCreatePage()}
            className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 px-3 py-1.5 text-xs font-semibold hover:opacity-90 transition-opacity cursor-pointer"
          >
            <Plus className="h-3 w-3" />
            <span>Criar Página</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {filteredPages.map((page) => (
            <div
              key={page.id}
              className="group relative rounded-xl border border-zinc-200/90 dark:border-zinc-800/80 bg-white dark:bg-[#18181b] hover:border-zinc-300 dark:hover:border-zinc-700 shadow-2xs hover:shadow-xs transition-all flex flex-col justify-between p-4"
            >
              {/* Card Top: Icon, Title, Favorite & Actions */}
              <div>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <Link
                    href={`/dashboard/pages/${page.id}`}
                    className="flex items-center gap-2.5 min-w-0 flex-1 group/title"
                  >
                    <PageIcon
                      icon={page.icon}
                      pageId={page.id}
                      iconFileId={page.icon_file_id}
                      className="h-5 w-5 text-base select-none shrink-0"
                    />
                    <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 group-hover/title:text-blue-600 dark:group-hover/title:text-blue-400 transition-colors truncate">
                      {page.title || "Untitled"}
                    </h3>
                  </Link>

                  <div className="flex items-center gap-0.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleToggleFavorite(page.id)}
                      className={cn(
                        "p-1 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer",
                        page.is_favorite
                          ? "text-amber-500"
                          : "text-zinc-300 dark:text-zinc-600 hover:text-amber-500"
                      )}
                      title={page.is_favorite ? "Remover dos favoritos" : "Adicionar aos favoritos"}
                    >
                      <Star className={cn("h-3.5 w-3.5", page.is_favorite && "fill-amber-500")} />
                    </button>

                    {/* More Actions Dropdown */}
                    <div className="relative">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setActionMenuPageId(actionMenuPageId === page.id ? null : page.id);
                        }}
                        className="p-1 rounded text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                        title="Opções da página"
                      >
                        <MoreHorizontal className="h-3.5 w-3.5" />
                      </button>

                      {actionMenuPageId === page.id && (
                        <div
                          className="absolute right-0 top-full mt-1 w-44 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#18181b] shadow-xl py-1 z-30 text-xs animate-in fade-in duration-100"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Link
                            href={`/dashboard/pages/${page.id}`}
                            className="flex items-center gap-2 px-3 py-1.5 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                            <span>Abrir</span>
                          </Link>

                          <button
                            type="button"
                            onClick={() => handleDuplicate(page.id)}
                            className="w-full flex items-center gap-2 px-3 py-1.5 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer text-left"
                          >
                            <Copy className="h-3.5 w-3.5" />
                            <span>Duplicar página</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleCopyLink(page.id)}
                            className="w-full flex items-center gap-2 px-3 py-1.5 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer text-left"
                          >
                            {copiedId === page.id ? (
                              <Check className="h-3.5 w-3.5 text-emerald-500" />
                            ) : (
                              <FileText className="h-3.5 w-3.5" />
                            )}
                            <span>{copiedId === page.id ? "Link copiado!" : "Copiar link"}</span>
                          </button>

                          <div className="h-px bg-zinc-200 dark:bg-zinc-800 my-1" />

                          <button
                            type="button"
                            onClick={() => handleArchive(page.id)}
                            className="w-full flex items-center gap-2 px-3 py-1.5 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors cursor-pointer text-left"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            <span>Mover para o lixo</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Excerpt / Summary */}
                <p className="text-xs text-zinc-500 dark:text-zinc-400 line-clamp-2 leading-relaxed">
                  {page.content_text ? page.content_text : "Página sem conteúdo de texto ainda."}
                </p>
              </div>

              {/* Card Footer: Metadata & Open Button */}
              <div className="mt-4 pt-3 border-t border-zinc-100 dark:border-zinc-800/60 flex items-center justify-between text-[11px] text-zinc-400">
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  <span>{formatRelativeTime(page.updated_at || page.created_at)}</span>
                </span>

                <Link
                  href={`/dashboard/pages/${page.id}`}
                  className="font-medium text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-0.5"
                >
                  <span>Abrir</span>
                  <ChevronRight className="h-3 w-3" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
