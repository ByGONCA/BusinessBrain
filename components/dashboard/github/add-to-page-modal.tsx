"use client";

// ==============================================================================
// BusinessBrain: Interactive Add-Snippet-to-Page Modal Window
// Displays the actual page in a compact interactive viewport, allowing the user
// to choose the exact spot in the page content (between blocks) to insert the snippet.
// ==============================================================================

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  X,
  FileCode,
  FileText,
  Plus,
  Check,
  ExternalLink,
  Loader2,
  ChevronDown,
  Sparkles,
  ArrowRight,
  Code2,
  Github,
  Calendar,
  Table as TableIcon,
  Kanban,
  LayoutGrid,
  ListFilter,
  Quote,
  ChevronRight,
  Image as ImageIcon,
  Sigma,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/lib/i18n";
import { PageIcon } from "@/components/dashboard/pages/page-icon";
import { CodeSelectionData } from "./code-viewer";
import {
  searchPagesAction,
  getPageAction,
  createPageAction,
  addCodeSnippetToPageAction,
} from "@/lib/pages/actions";
import { PageRecord, EditorBlock } from "@/lib/pages/types";
import { detectLanguageFromPath, getTokenClasses, tokenizeCodeToLines } from "@/lib/code-viewer/syntax";

interface AddToPageModalProps {
  isOpen: boolean;
  onClose: () => void;
  snippet: CodeSelectionData | null;
  htmlUrl?: string;
  initialPageId?: string | null;
}

export function AddToPageModal({
  isOpen,
  onClose,
  snippet,
  htmlUrl,
  initialPageId,
}: AddToPageModalProps) {
  const router = useRouter();
  const { locale } = useLanguage();
  const isPt = locale === "pt";

  const [pages, setPages] = React.useState<PageRecord[]>([]);
  const [loadingPages, setLoadingPages] = React.useState(false);
  const [selectedPageId, setSelectedPageId] = React.useState<string | null>(initialPageId || null);
  const [pageDropdownOpen, setPageDropdownOpen] = React.useState(false);

  // Active loaded page data
  const [activePage, setActivePage] = React.useState<PageRecord | null>(null);
  const [loadingPageContent, setLoadingPageContent] = React.useState(false);
  const [pageBlocks, setPageBlocks] = React.useState<EditorBlock[]>([]);

  // Insertion state
  const [insertingIndex, setInsertingIndex] = React.useState<number | null>(null);
  const [lastInsertedIndex, setLastInsertedIndex] = React.useState<number | null>(null);
  const [isDone, setIsDone] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // New page creation inside modal
  const [isCreatingNewPage, setIsCreatingNewPage] = React.useState(false);
  const [newPageTitle, setNewPageTitle] = React.useState("");

  // Update selectedPageId when initialPageId changes
  React.useEffect(() => {
    if (initialPageId) {
      setSelectedPageId(initialPageId);
    }
  }, [initialPageId]);

  // Load available pages on modal open
  React.useEffect(() => {
    if (!isOpen) return;

    setError(null);
    setIsDone(false);
    setLastInsertedIndex(null);
    setInsertingIndex(null);
    setIsCreatingNewPage(false);

    if (snippet) {
      const fileName = snippet.filePath.split("/").pop() || (isPt ? "ficheiro" : "file");
      setNewPageTitle(isPt ? `Notas: ${fileName}` : `Notes: ${fileName}`);
    }

    let isMounted = true;
    async function fetchPages() {
      setLoadingPages(true);
      try {
        const results = await searchPagesAction("");
        if (isMounted) {
          setPages(results);
          if (!selectedPageId && results.length > 0) {
            setSelectedPageId(results[0].id);
          }
        }
      } finally {
        if (isMounted) setLoadingPages(false);
      }
    }

    fetchPages();
    return () => {
      isMounted = false;
    };
  }, [isOpen, snippet, selectedPageId]);

  // Load page content whenever selectedPageId changes
  React.useEffect(() => {
    if (!isOpen || !selectedPageId) return;

    let isMounted = true;
    async function loadPage() {
      setLoadingPageContent(true);
      setError(null);
      try {
        const res = await getPageAction(selectedPageId!);
        if (isMounted && res.success && res.page) {
          setActivePage(res.page);
          const blocks = Array.isArray(res.page.content) ? (res.page.content as EditorBlock[]) : [];
          setPageBlocks(blocks);
        } else if (isMounted && res.error) {
          setError(res.error);
        }
      } finally {
        if (isMounted) setLoadingPageContent(false);
      }
    }

    loadPage();
    return () => {
      isMounted = false;
    };
  }, [isOpen, selectedPageId]);

  // Handle Escape key
  React.useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !snippet) return null;

  const { lang, label: languageLabel } = detectLanguageFromPath(snippet.filePath);
  const fileName = snippet.filePath.split("/").pop() || snippet.filePath;

  // Insert code snippet at specific block index in the page
  const handleInsertAt = async (index: number) => {
    if (!selectedPageId || insertingIndex !== null) return;
    setError(null);
    setInsertingIndex(index);

    try {
      const res = await addCodeSnippetToPageAction({
        pageId: selectedPageId,
        filePath: snippet.filePath,
        selectedCode: snippet.selectedCode,
        language: lang,
        startLine: snippet.startLine,
        endLine: snippet.endLine,
        htmlUrl,
        insertIndex: index,
      });

      if (!res.success) {
        setError(res.error || (isPt ? "Não foi possível inserir o excerto." : "Failed to insert snippet."));
        setInsertingIndex(null);
        return;
      }

      if (res.blocks) {
        setPageBlocks(res.blocks);
      }
      setLastInsertedIndex(index);
      setIsDone(true);
    } catch {
      setError(isPt ? "Ocorreu um erro ao inserir o excerto na página." : "An error occurred while inserting snippet to page.");
    } finally {
      setInsertingIndex(null);
    }
  };

  // Create new page and select it
  const handleCreateNewPage = async (e: React.FormEvent) => {
    e.preventDefault();
    const title = newPageTitle.trim() || (isPt ? `Notas: ${fileName}` : `Notes: ${fileName}`);
    setLoadingPageContent(true);
    try {
      const res = await createPageAction({ title, icon: "📄" });
      if (res.success && res.page) {
        setPages((prev) => [res.page!, ...prev]);
        setSelectedPageId(res.page.id);
        setIsCreatingNewPage(false);
      } else {
        setError(res.error || (isPt ? "Não foi possível criar a página." : "Failed to create page."));
      }
    } finally {
      setLoadingPageContent(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl max-h-[88vh] rounded-2xl bg-card border border-border shadow-2xl text-card-foreground flex flex-col overflow-hidden animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ================= Top Bar: Page Switcher & Snippet Badge ================= */}
        <div className="p-3.5 border-b border-border bg-muted/40 flex items-center justify-between gap-3">
          {/* Page Selector Pill / Dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setPageDropdownOpen((prev) => !prev)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-border bg-card hover:bg-muted/70 text-xs font-semibold text-foreground transition-all cursor-pointer shadow-2xs"
            >
              <PageIcon icon={activePage?.icon} pageId={activePage?.id} className="h-4 w-4 shrink-0 text-sm" imgClassName="h-4 w-4 rounded shrink-0 object-cover" />
              <span className="truncate max-w-[200px]">
                {activePage?.title || (isPt ? "Selecionar Página" : "Select Page")}
              </span>
              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            </button>

            {/* Dropdown Menu */}
            {pageDropdownOpen && (
              <div className="absolute left-0 top-full mt-1.5 w-64 rounded-xl border border-border bg-card p-1 shadow-xl z-50 text-xs animate-in fade-in zoom-in-95 duration-100">
                <div className="max-h-48 overflow-y-auto space-y-0.5 pr-0.5">
                  {pages.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => {
                        setSelectedPageId(p.id);
                        setPageDropdownOpen(false);
                        setIsDone(false);
                        setLastInsertedIndex(null);
                      }}
                      className={cn(
                        "w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left transition-colors cursor-pointer",
                        selectedPageId === p.id
                          ? "bg-blue-500/10 text-blue-600 dark:text-blue-400 font-semibold"
                          : "hover:bg-muted text-foreground"
                      )}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <PageIcon icon={p.icon} pageId={p.id} className="h-4 w-4 shrink-0 text-sm" imgClassName="h-4 w-4 rounded shrink-0 object-cover" />
                        <span className="truncate">{p.title || (isPt ? "Sem título" : "Untitled")}</span>
                      </div>
                      {selectedPageId === p.id && <Check className="h-3.5 w-3.5 shrink-0" />}
                    </button>
                  ))}
                </div>

                <div className="pt-1 mt-1 border-t border-border">
                  <button
                    type="button"
                    onClick={() => {
                      setIsCreatingNewPage(true);
                      setPageDropdownOpen(false);
                    }}
                    className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/30 font-medium transition-colors cursor-pointer"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>{isPt ? "Criar nova página..." : "Create new page..."}</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Snippet Header Badge */}
          <div className="flex items-center gap-2 min-w-0">
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 font-mono text-[11px] truncate">
              <FileCode className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate font-semibold">{fileName}</span>
              {snippet.startLine !== undefined && (
                <span className="text-[10px] opacity-80 shrink-0">
                  {snippet.endLine !== undefined && snippet.endLine !== snippet.startLine
                    ? `(L${snippet.startLine}–${snippet.endLine})`
                    : `(L${snippet.startLine})`}
                </span>
              )}
            </div>

            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* ================= Prompt Subheader ================= */}
        <div className="px-4 py-2 bg-blue-600/5 dark:bg-blue-500/10 border-b border-border flex items-center justify-between text-xs text-blue-700 dark:text-blue-300">
          <div className="flex items-center gap-1.5 font-medium">
            <Sparkles className="h-3.5 w-3.5 text-blue-500 shrink-0" />
            <span>
              {isDone
                ? (isPt ? "Excerto inserido na página! Podes concluir ou abrir a página inteira." : "Snippet inserted into page! You can finish or open the full page.")
                : (isPt ? "Clica na linha onde queres colocar o excerto de código nesta página:" : "Click on the line where you want to insert the code snippet on this page:")}
            </span>
          </div>
          {isDone && (
            <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
              <Check className="h-3.5 w-3.5" />
              <span>{isPt ? "Inserido" : "Inserted"}</span>
            </span>
          )}
        </div>

        {/* ================= Create New Page Overlay Inline ================= */}
        {isCreatingNewPage && (
          <form
            onSubmit={handleCreateNewPage}
            className="p-3 bg-muted/60 border-b border-border flex items-center gap-2 text-xs"
          >
            <input
              type="text"
              value={newPageTitle}
              onChange={(e) => setNewPageTitle(e.target.value)}
              placeholder={isPt ? "Título da nova página..." : "New page title..."}
              autoFocus
              className="flex-1 rounded-lg border border-input bg-background px-3 py-1.5 text-xs text-foreground focus:border-blue-500 focus:outline-none"
            />
            <button
              type="submit"
              className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium cursor-pointer"
            >
              {isPt ? "Criar e Ver" : "Create & View"}
            </button>
            <button
              type="button"
              onClick={() => setIsCreatingNewPage(false)}
              className="px-2.5 py-1.5 rounded-lg text-muted-foreground hover:text-foreground cursor-pointer"
            >
              {isPt ? "Cancelar" : "Cancel"}
            </button>
          </form>
        )}

        {/* ================= Interactive Page Viewport ================= */}
        <div className="flex-1 overflow-y-auto p-6 space-y-2 bg-zinc-50/40 dark:bg-zinc-950/40 select-text">
          {loadingPageContent ? (
            <div className="py-20 flex flex-col items-center justify-center text-muted-foreground text-xs gap-3">
              <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
              <span>{isPt ? "A carregar conteúdo da página..." : "Loading page content..."}</span>
            </div>
          ) : !activePage ? (
            <div className="py-16 text-center text-muted-foreground text-xs">
              {isPt ? "Nenhuma página selecionada." : "No page selected."}
            </div>
          ) : (
            <div className="max-w-xl mx-auto space-y-1">
              {/* Page Title & Icon inside mini-viewport */}
              <div className="pb-3 mb-2 border-b border-border/80">
                <div className="mb-2">
                  <PageIcon
                    icon={activePage.icon}
                    pageId={activePage.id}
                    className="h-8 w-8 text-3xl"
                    imgClassName="h-8 w-8 rounded-lg object-cover"
                  />
                </div>
                <h1 className="text-xl font-bold text-foreground">
                  {activePage.title || (isPt ? "Sem título" : "Untitled")}
                </h1>
              </div>

              {/* Slot 0: Top of Page */}
              <InsertionSlot
                onClick={() => handleInsertAt(0)}
                isInserting={insertingIndex === 0}
                isInserted={lastInsertedIndex === 0}
                label={isPt ? "Inserir no início da página" : "Insert at top of page"}
              />

              {/* Empty Page State */}
              {pageBlocks.length === 0 && (
                <div className="py-6 text-center text-muted-foreground text-xs italic">
                  {isPt
                    ? "Esta página ainda está vazia. Clica acima ou abaixo para adicionar o primeiro bloco de código."
                    : "This page is still empty. Click above or below to add the first code block."}
                </div>
              )}

              {/* Page Blocks Stream */}
              {pageBlocks.map((block, idx) => (
                <React.Fragment key={block.id || idx}>
                  {/* Block Content Render */}
                  <div className="group/block relative rounded-lg p-1.5 transition-colors hover:bg-zinc-100/60 dark:hover:bg-zinc-900/60">
                    <RenderMiniBlock block={block} />
                  </div>

                  {/* Insertion Slot after this block */}
                  <InsertionSlot
                    onClick={() => handleInsertAt(idx + 1)}
                    isInserting={insertingIndex === idx + 1}
                    isInserted={lastInsertedIndex === idx + 1}
                    label={isPt ? `Inserir após ${getBlockLabel(block, isPt)}` : `Insert after ${getBlockLabel(block, isPt)}`}
                  />
                </React.Fragment>
              ))}
            </div>
          )}

          {error && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs">
              {error}
            </div>
          )}
        </div>

        {/* ================= Footer Actions ================= */}
        <div className="p-3 border-t border-border bg-card flex items-center justify-between gap-3 text-xs">
          <span className="text-muted-foreground text-[11px] truncate">
            {isDone
              ? (isPt ? "Excerto guardado com sucesso na página." : "Snippet successfully saved to page.")
              : (isPt ? "Passa o rato entre o texto para ver os pontos de inserção." : "Hover between text to reveal insertion points.")}
          </span>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded-lg border border-border bg-card hover:bg-muted text-foreground font-medium transition-colors cursor-pointer shadow-2xs"
            >
              {isDone ? (isPt ? "Concluir" : "Done") : (isPt ? "Cancelar" : "Cancel")}
            </button>

            {selectedPageId && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  router.push(`/dashboard/pages/${selectedPageId}`);
                }}
                className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm"
              >
                <span>{isPt ? "Abrir Página Completa" : "Open Full Page"}</span>
                <ExternalLink className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Insertion Line Slot component that lights up on hover
 */
function InsertionSlot({
  onClick,
  isInserting,
  isInserted,
  label,
}: {
  onClick: () => void;
  isInserting: boolean;
  isInserted?: boolean;
  label?: string;
}) {
  const { locale } = useLanguage();
  const isPt = locale === "pt";
  const resolvedLabel = label || (isPt ? "Inserir aqui" : "Insert here");

  if (isInserted) {
    return (
      <div className="py-1 flex items-center justify-center">
        <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full flex items-center gap-1">
          <Check className="h-3 w-3" />
          <span>{isPt ? "Inserido aqui" : "Inserted here"}</span>
        </span>
      </div>
    );
  }

  return (
    <div
      onClick={onClick}
      className="group/slot relative py-1 my-0.5 cursor-pointer select-none transition-all"
    >
      <div className="h-1 w-full rounded-full bg-transparent group-hover/slot:bg-blue-500/40 flex items-center justify-center transition-all">
        <div className="opacity-0 group-hover/slot:opacity-100 transition-all transform scale-95 group-hover/slot:scale-100 bg-blue-600 text-white text-[10px] font-semibold px-2.5 py-0.5 rounded-full shadow-md flex items-center gap-1">
          {isInserting ? (
            <>
              <Loader2 className="h-3 w-3 animate-spin" />
              <span>{isPt ? "A inserir..." : "Inserting..."}</span>
            </>
          ) : (
            <>
              <Plus className="h-3 w-3" />
              <span>{resolvedLabel}</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Helper to identify block summary for slot labels
 */
function getBlockLabel(block: EditorBlock, isPt: boolean): string {
  if (block.type === "heading_1" || block.type === "heading_2" || block.type === "heading_3") {
    const heading = (block.content || "").replace(/<[^>]*>?/gm, "").slice(0, 16);
    return isPt ? `título "${heading}..."` : `heading "${heading}..."`;
  }
  if (block.type === "code") return isPt ? "bloco de código" : "code block";
  if (block.type === "callout") return isPt ? "destaque" : "callout";
  if (block.type === "calendar") return isPt ? "calendário" : "calendar";
  if (block.type === "table") return isPt ? "tabela" : "table";
  if (block.type === "board") return isPt ? "quadro Kanban" : "Kanban board";
  if (block.type === "gallery") return isPt ? "galeria" : "gallery";
  if (block.type === "list") return isPt ? "lista" : "list";
  if (block.type === "image") return isPt ? "imagem" : "image";
  if (block.type === "quote") return isPt ? "citação" : "quote";
  if (block.type === "checklist") return isPt ? "tarefa" : "checklist item";
  return isPt ? "parágrafo" : "paragraph";
}

/**
 * Full-fidelity Block Renderer for interactive preview in the modal
 */
function RenderMiniBlock({ block }: { block: EditorBlock }) {
  const cleanContent = (block.content || "").replace(/<[^>]*>?/gm, "").trim();

  switch (block.type) {
    case "heading_1":
      return <h2 className="text-base font-bold text-foreground mt-2 mb-0.5">{cleanContent || "Título 1"}</h2>;
    case "heading_2":
      return <h3 className="text-sm font-bold text-foreground mt-1.5 mb-0.5">{cleanContent || "Título 2"}</h3>;
    case "heading_3":
      return <h4 className="text-xs font-semibold text-foreground mt-1 mb-0.5">{cleanContent || "Título 3"}</h4>;
    case "code": {
      const isGitHub = Boolean(block.properties?.isGitHubSnippet || block.properties?.filePath);
      const filePath = block.properties?.filePath as string | undefined;
      const fileName = filePath ? filePath.split("/").pop() || filePath : "";
      const fullFilePath = filePath || fileName || "ficheiro";
      const startLine = typeof block.properties?.startLine === "number" ? block.properties.startLine : 1;
      const endLine = typeof block.properties?.endLine === "number" ? block.properties.endLine : undefined;
      const lang = (block.properties?.language as string) || (filePath ? detectLanguageFromPath(filePath).lang : "plaintext");
      const lines = tokenizeCodeToLines(block.content, lang);
      const htmlUrl = block.properties?.htmlUrl as string | undefined;
      const repoFullName =
        (block.properties?.repoFullName as string | undefined) ||
        (htmlUrl ? htmlUrl.match(/github\.com\/([^/]+)\/([^/]+)/)?.[0]?.replace("github.com/", "").replace(/\.git$/, "") : undefined);
      const lineQuery = startLine
        ? `&line=${startLine}${endLine && endLine !== startLine ? `-${endLine}` : ""}`
        : "";
      const internalGitHubUrl = filePath
        ? `/dashboard/github?${repoFullName ? `repo=${encodeURIComponent(repoFullName)}&` : ""}file=${encodeURIComponent(filePath)}${lineQuery}`
        : undefined;

      return (
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#18181b] overflow-hidden my-1 shadow-2xs font-mono text-xs">
          <div className="flex items-center justify-between px-3 py-1.5 bg-zinc-100/80 dark:bg-[#121214] border-b border-zinc-200 dark:border-zinc-800 text-[11px] text-zinc-600 dark:text-zinc-300 select-none">
            <div className="flex items-center gap-1.5 min-w-0">
              {isGitHub ? (
                <>
                  {internalGitHubUrl ? (
                    <Link
                      href={internalGitHubUrl}
                      onClick={(e) => e.stopPropagation()}
                      className="group/link flex items-center gap-1.5 font-semibold text-zinc-900 dark:text-zinc-100 hover:text-blue-600 dark:hover:text-blue-400 transition-colors truncate cursor-pointer"
                      title={`Abrir ${fullFilePath} no GitHub`}
                    >
                      <FileCode className="h-3.5 w-3.5 text-blue-500 shrink-0 group-hover/link:text-blue-600" />
                      <span className="truncate group-hover/link:underline">
                        {fullFilePath}
                      </span>
                    </Link>
                  ) : (
                    <div className="flex items-center gap-1.5 font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                      <FileCode className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                      <span className="truncate">
                        {fullFilePath}
                      </span>
                    </div>
                  )}
                  {startLine !== undefined && (
                    <span className="text-[10px] text-zinc-500 dark:text-zinc-400">
                      (L{startLine}{endLine !== undefined && endLine !== startLine ? `–${endLine}` : ""})
                    </span>
                  )}
                </>
              ) : (
                <>
                  <Code2 className="h-3.5 w-3.5 text-zinc-500 shrink-0" />
                  <span className="font-semibold text-zinc-900 dark:text-zinc-100 uppercase">
                    {lang}
                  </span>
                </>
              )}
              <span className="px-1.5 py-0.2 rounded text-[9px] font-medium bg-zinc-200/80 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 uppercase shrink-0">
                {lang}
              </span>
            </div>
          </div>
          <div className="overflow-x-auto max-h-48 bg-zinc-50/50 dark:bg-[#1a1a1d] text-[11px] leading-relaxed">
            <table className="w-full border-collapse">
              <tbody>
                {lines.map((line, idx) => {
                  const lineNum = isGitHub ? startLine + idx : idx + 1;
                  return (
                    <tr key={idx} className="hover:bg-zinc-200/40 dark:hover:bg-zinc-800/40">
                      <td className="w-9 min-w-9 select-none pr-2.5 pl-2 text-right text-zinc-400 dark:text-zinc-600 text-[10px] align-top border-r border-zinc-200/80 dark:border-zinc-800/80">
                        {lineNum}
                      </td>
                      <td className="pl-3 pr-4 py-0.25 whitespace-pre font-mono text-[11px]">
                        {line.tokens.map((token, tIdx) => (
                          <span key={tIdx} className={getTokenClasses(token.type)}>
                            {token.content}
                          </span>
                        ))}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      );
    }
    case "calendar": {
      const events = block.properties?.calendarData?.events || [];
      return (
        <div className="my-1.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-900/60 p-2.5 shadow-2xs">
          <div className="flex items-center justify-between text-xs font-semibold text-foreground mb-1.5 pb-1.5 border-b border-border/80">
            <div className="flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5 text-blue-500" />
              <span>Calendário</span>
            </div>
            <span className="text-[10px] text-muted-foreground font-mono">
              {events.length} {events.length === 1 ? "evento" : "eventos"}
            </span>
          </div>
          {events.length === 0 ? (
            <div className="text-[11px] text-muted-foreground italic py-1 text-center">
              Sem eventos agendados
            </div>
          ) : (
            <div className="space-y-1 max-h-36 overflow-y-auto">
              {events.slice(0, 5).map((evt) => (
                <div
                  key={evt.id}
                  className="flex items-center justify-between text-[11px] px-2 py-1 rounded-md bg-white dark:bg-zinc-800/80 border border-border"
                >
                  <span className="font-medium truncate text-foreground">{evt.title}</span>
                  <span className="text-[10px] text-muted-foreground font-mono shrink-0 ml-2">
                    {evt.date}
                  </span>
                </div>
              ))}
              {events.length > 5 && (
                <div className="text-[10px] text-muted-foreground text-center pt-0.5 font-medium">
                  +{events.length - 5} eventos adicionais
                </div>
              )}
            </div>
          )}
        </div>
      );
    }
    case "table": {
      const tableData = block.properties?.tableData || {
        headers: ["Coluna 1", "Coluna 2", "Coluna 3"],
        rows: [["", "", ""]],
      };
      return (
        <div className="my-1.5 rounded-xl border border-border overflow-hidden bg-card text-[11px] shadow-2xs">
          <table className="w-full border-collapse">
            <thead className="bg-muted/70 text-muted-foreground font-medium text-[10px] uppercase">
              <tr>
                {tableData.headers.map((h, i) => (
                  <th key={i} className="px-2 py-1 text-left border-r last:border-r-0 border-border truncate max-w-[120px]">
                    {h || `Col ${i + 1}`}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tableData.rows.slice(0, 3).map((row, rIdx) => (
                <tr key={rIdx} className="border-t border-border/60">
                  {row.map((cell, cIdx) => (
                    <td key={cIdx} className="px-2 py-1 border-r last:border-r-0 border-border/60 truncate max-w-[120px]">
                      {cell || "—"}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          {tableData.rows.length > 3 && (
            <div className="text-[10px] text-muted-foreground text-center py-0.5 bg-muted/30">
              +{tableData.rows.length - 3} linhas adicionais
            </div>
          )}
        </div>
      );
    }
    case "board": {
      const columns = block.properties?.boardData?.columns || [];
      return (
        <div className="my-1.5 rounded-xl border border-border p-2 bg-muted/30 shadow-2xs">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground mb-1.5">
            <Kanban className="h-3.5 w-3.5 text-purple-500" />
            <span>Quadro Kanban</span>
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            {columns.slice(0, 3).map((col) => (
              <div key={col.id} className="rounded-lg bg-card border border-border p-1.5 text-[10px]">
                <div className="font-semibold truncate mb-1 text-foreground">{col.title}</div>
                <div className="text-muted-foreground text-[9px]">{col.cards?.length || 0} cartões</div>
              </div>
            ))}
          </div>
        </div>
      );
    }
    case "gallery": {
      const items = block.properties?.galleryData?.items || [];
      return (
        <div className="my-1.5 rounded-xl border border-border p-2 bg-muted/30 shadow-2xs">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground mb-1.5">
            <LayoutGrid className="h-3.5 w-3.5 text-emerald-500" />
            <span>Galeria ({items.length} itens)</span>
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            {items.slice(0, 3).map((item) => (
              <div key={item.id} className="rounded-lg bg-card border border-border p-1.5 text-[10px] text-center truncate">
                {item.title || "Item"}
              </div>
            ))}
          </div>
        </div>
      );
    }
    case "list": {
      const items = block.properties?.listData?.items || [];
      return (
        <div className="my-1.5 rounded-xl border border-border p-2 bg-card shadow-2xs">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground mb-1">
            <ListFilter className="h-3.5 w-3.5 text-blue-500" />
            <span>Lista ({items.length} itens)</span>
          </div>
          <div className="space-y-0.5">
            {items.slice(0, 3).map((item) => (
              <div key={item.id} className="text-[11px] truncate text-foreground/80">
                • {item.title}
              </div>
            ))}
          </div>
        </div>
      );
    }
    case "quote":
      return (
        <blockquote className="border-l-2 border-foreground/30 pl-3 italic text-xs text-foreground/80 my-1">
          {cleanContent || "Citação"}
        </blockquote>
      );
    case "toggle":
      return (
        <div className="flex items-center gap-1.5 text-xs font-medium text-foreground my-1">
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
          <span>{cleanContent || "Lista pendente / expansível"}</span>
        </div>
      );
    case "callout":
      return (
        <div className="rounded-lg bg-blue-500/5 border border-blue-500/20 p-2 flex items-start gap-2 text-xs text-foreground my-1">
          <span className="text-sm shrink-0">{block.properties?.calloutIcon || "💡"}</span>
          <div className="flex-1 leading-relaxed">{cleanContent}</div>
        </div>
      );
    case "bullet_list":
      return (
        <div className="flex items-start gap-2 text-xs text-foreground/90 my-0.5 pl-2">
          <span className="text-zinc-400">•</span>
          <span>{cleanContent}</span>
        </div>
      );
    case "numbered_list":
      return (
        <div className="flex items-start gap-2 text-xs text-foreground/90 my-0.5 pl-2">
          <span className="text-zinc-400 font-mono text-[11px]">1.</span>
          <span>{cleanContent}</span>
        </div>
      );
    case "checklist":
      return (
        <div className="flex items-center gap-2 text-xs text-foreground/90 my-0.5 pl-2">
          <input type="checkbox" checked={block.properties?.checked} readOnly className="rounded" />
          <span>{cleanContent}</span>
        </div>
      );
    case "image":
      return (
        <div className="my-1.5 rounded-xl border border-border bg-muted/40 p-2 text-center">
          {block.properties?.mediaUrl ? (
            <img
              src={block.properties.mediaUrl}
              alt={block.properties?.caption || "Imagem"}
              className="max-h-36 mx-auto rounded-lg object-contain"
            />
          ) : (
            <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground py-3">
              <ImageIcon className="h-4 w-4" />
              <span>{block.properties?.caption || "Imagem da página"}</span>
            </div>
          )}
        </div>
      );
    case "video":
    case "audio":
    case "file":
    case "bookmark":
      return (
        <div className="my-1 rounded-lg border border-border bg-muted/30 px-2.5 py-1.5 flex items-center gap-2 text-xs text-foreground">
          <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <span className="truncate font-medium">{block.properties?.caption || block.properties?.bookmarkTitle || cleanContent || block.type}</span>
        </div>
      );
    case "equation":
      return (
        <div className="my-1 rounded-lg border border-border bg-muted/30 px-2.5 py-1.5 text-center font-mono text-xs text-indigo-500">
          {block.properties?.equationFormula || "f(x) = ..."}
        </div>
      );
    case "github":
      return (
        <div className="my-1 rounded-lg border border-border bg-muted/30 px-2.5 py-1.5 flex items-center gap-2 text-xs text-foreground">
          <Github className="h-3.5 w-3.5 shrink-0" />
          <span className="font-medium truncate">{block.properties?.githubData?.title || cleanContent || "GitHub Item"}</span>
        </div>
      );
    case "divider":
      return <div className="border-t border-border my-2" />;
    case "paragraph":
    default:
      return cleanContent ? (
        <p className="text-xs text-foreground/80 leading-relaxed my-0.5">{cleanContent}</p>
      ) : (
        <div className="h-2" />
      );
  }
}
