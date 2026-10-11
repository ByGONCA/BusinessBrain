"use client";

// ==============================================================================
// BusinessBrain: VS Code-Style Code Viewer Component
// Features: Automatic syntax highlighting, line numbers, right-click context menu
// to comment on lines/selection, dark/light theme integration, and non-blocking interactions.
// ==============================================================================

import * as React from "react";
import {
  FileCode,
  Check,
  Copy,
  ExternalLink,
  ArrowLeft,
  Loader2,
  AlertCircle,
  MessageSquare,
  FilePlus,
  ChevronRight,
  Plus,
  Eye,
  Code2,
} from "lucide-react";
import { PhosphorFile } from "@/components/icons";
import { cn } from "@/lib/utils";
import { PageIcon } from "@/components/dashboard/pages/page-icon";
import { AddToPageModal } from "./add-to-page-modal";
import { MarkdownViewer } from "./markdown-viewer";
import { searchPagesAction } from "@/lib/pages/actions";
import { PageRecord } from "@/lib/pages/types";
import {
  detectLanguageFromPath,
  tokenizeCodeToLines,
  getTokenClasses,
  HighlightedLine,
} from "@/lib/code-viewer/syntax";

export interface CodeSelectionData {
  filePath: string;
  selectedCode: string;
  startLine?: number;
  endLine?: number;
}

interface ContextMenuState {
  x: number;
  y: number;
  selectionData: CodeSelectionData;
  isSpecificLineOnly: boolean;
}

interface CodeViewerProps {
  filePath: string;
  content: string;
  size?: number;
  isBinary?: boolean;
  htmlUrl?: string;
  loading?: boolean;
  error?: string | null;
  highlightRange?: { startLine: number; endLine?: number } | null;
  onRetry?: () => void;
  onBack?: () => void;
  onDiscussSelection?: (selection: CodeSelectionData) => void;
}

export function CodeViewer({
  filePath,
  content,
  size,
  isBinary,
  htmlUrl,
  loading,
  error,
  highlightRange,
  onRetry,
  onBack,
  onDiscussSelection,
}: CodeViewerProps) {
  const [copied, setCopied] = React.useState(false);
  const [contextMenu, setContextMenu] = React.useState<ContextMenuState | null>(null);
  const [isAddToPageOpen, setIsAddToPageOpen] = React.useState(false);
  const [addToPageSnippet, setAddToPageSnippet] = React.useState<CodeSelectionData | null>(null);
  const [selectedTargetPageId, setSelectedTargetPageId] = React.useState<string | null>(null);
  const [workspacePages, setWorkspacePages] = React.useState<PageRecord[]>([]);
  const [isSubmenuOpen, setIsSubmenuOpen] = React.useState(false);

  const [floatingAction, setFloatingAction] = React.useState<{
    x: number;
    y: number;
    selectionData: CodeSelectionData;
  } | null>(null);

  const containerRef = React.useRef<HTMLDivElement>(null);
  const contextMenuRef = React.useRef<HTMLDivElement>(null);
  const floatingRef = React.useRef<HTMLDivElement>(null);
  const submenuTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  // Load workspace pages for fast submenu display
  React.useEffect(() => {
    let isMounted = true;
    searchPagesAction("").then((res) => {
      if (isMounted) setWorkspacePages(res.slice(0, 8));
    });
    return () => {
      isMounted = false;
    };
  }, []);

  // Resolve language from file path
  const { lang, label: languageLabel } = React.useMemo(
    () => detectLanguageFromPath(filePath),
    [filePath]
  );

  // Check if file is Markdown format
  const isMarkdown = React.useMemo(() => {
    return (
      lang === "markdown" ||
      filePath.toLowerCase().endsWith(".md") ||
      filePath.toLowerCase().endsWith(".markdown") ||
      filePath.toLowerCase().endsWith(".mdx")
    );
  }, [lang, filePath]);

  const [viewMode, setViewMode] = React.useState<"code" | "preview">(
    isMarkdown ? "preview" : "code"
  );

  // Switch to preview mode automatically when opening a markdown file
  React.useEffect(() => {
    if (isMarkdown) {
      setViewMode("preview");
    } else {
      setViewMode("code");
    }
  }, [filePath, isMarkdown]);

  // Tokenize code lines
  const lines: HighlightedLine[] = React.useMemo(() => {
    if (loading || error || isBinary || !content) return [];
    return tokenizeCodeToLines(content, lang);
  }, [content, lang, loading, error, isBinary]);

  // Auto-scroll to target highlight line when loaded
  React.useEffect(() => {
    if (!highlightRange || !highlightRange.startLine || lines.length === 0) return;
    const targetLine = highlightRange.startLine;
    const timer = setTimeout(() => {
      const targetEl = containerRef.current?.querySelector(
        `[data-line-number="${targetLine}"]`
      );
      if (targetEl) {
        targetEl.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }, 120);
    return () => clearTimeout(timer);
  }, [highlightRange, lines]);

  // Handle Copy Raw Code
  const handleCopy = React.useCallback(() => {
    if (!content) return;
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [content]);

  // Helper to extract line number from DOM hierarchy
  const getLineNumFromNode = (node: Node | null): number | undefined => {
    let curr = node;
    while (curr && curr !== containerRef.current) {
      if (curr instanceof HTMLElement && curr.dataset.lineNumber) {
        const num = parseInt(curr.dataset.lineNumber, 10);
        if (!isNaN(num)) return num;
      }
      curr = curr.parentNode;
    }
    return undefined;
  };

  // Helper to extract selection data from current window Selection
  const extractSelectionData = React.useCallback(
    (sel: Selection): CodeSelectionData | null => {
      if (!sel || sel.isCollapsed) return null;
      const text = sel.toString();
      if (!text || !text.trim()) return null;

      const anchorLine = getLineNumFromNode(sel.anchorNode);
      const focusLine = getLineNumFromNode(sel.focusNode);

      let startLine: number | undefined;
      let endLine: number | undefined;

      if (anchorLine !== undefined && focusLine !== undefined) {
        startLine = Math.min(anchorLine, focusLine);
        endLine = Math.max(anchorLine, focusLine);
      } else if (anchorLine !== undefined) {
        startLine = anchorLine;
        endLine = anchorLine;
      } else if (focusLine !== undefined) {
        startLine = focusLine;
        endLine = focusLine;
      }

      return {
        filePath,
        selectedCode: text,
        startLine,
        endLine,
      };
    },
    [filePath]
  );

  // Handle Click Outside & Escape key for context menu & floating button
  React.useEffect(() => {
    const handleMouseDownOutside = (e: MouseEvent) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(e.target as Node)) {
        setContextMenu(null);
      }
      if (floatingRef.current && !floatingRef.current.contains(e.target as Node)) {
        setFloatingAction(null);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setContextMenu(null);
        setFloatingAction(null);
      }
    };

    document.addEventListener("mousedown", handleMouseDownOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleMouseDownOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  // Detect selection and position floating "Adicionar ao Chat" button
  const handleCodeMouseUp = React.useCallback(() => {
    if (!onDiscussSelection) return;
    setTimeout(() => {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed || !sel.toString().trim()) {
        setFloatingAction(null);
        return;
      }

      if (containerRef.current && containerRef.current.contains(sel.anchorNode)) {
        const data = extractSelectionData(sel);
        if (data && data.selectedCode.trim()) {
          try {
            const range = sel.getRangeAt(0);
            const rect = range.getBoundingClientRect();
            const containerRect = containerRef.current.getBoundingClientRect();
            const x = rect.left - containerRect.left + rect.width / 2;
            const y = rect.top - containerRect.top;
            setFloatingAction({
              x: Math.max(90, Math.min(x, containerRect.width - 90)),
              y: Math.max(45, y),
              selectionData: data,
            });
            return;
          } catch {
            // ignore
          }
        }
      }
      setFloatingAction(null);
    }, 15);
  }, [extractSelectionData, onDiscussSelection]);

  // Handle Right-Click Context Menu
  const handleContextMenu = (e: React.MouseEvent) => {
    if (!onDiscussSelection) return;
    e.preventDefault();

    const currentSelection = window.getSelection();
    let selectionData: CodeSelectionData | null = null;
    let isSpecificLineOnly = false;

    if (currentSelection && !currentSelection.isCollapsed && currentSelection.toString().trim()) {
      selectionData = extractSelectionData(currentSelection);
    }

    if (!selectionData) {
      const lineNum = getLineNumFromNode(e.target as Node);
      if (lineNum !== undefined) {
        const targetLine = lines.find((l) => l.lineNumber === lineNum);
        selectionData = {
          filePath,
          selectedCode: targetLine ? targetLine.rawText : "",
          startLine: lineNum,
          endLine: lineNum,
        };
        isSpecificLineOnly = true;
      }
    }

    if (selectionData) {
      const menuWidth = 240;
      const menuHeight = 120;
      const x = Math.min(Math.max(12, e.clientX), window.innerWidth - menuWidth - 16);
      const y = Math.min(Math.max(12, e.clientY), window.innerHeight - menuHeight - 16);

      setContextMenu({
        x,
        y,
        selectionData,
        isSpecificLineOnly,
      });
    }
  };

  const handleContextMenuDiscuss = () => {
    if (!contextMenu || !onDiscussSelection) return;
    onDiscussSelection(contextMenu.selectionData);
    setContextMenu(null);
  };

  const handleContextMenuCopy = () => {
    if (!contextMenu) return;
    navigator.clipboard.writeText(contextMenu.selectionData.selectedCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    setContextMenu(null);
  };

  const formatFileSize = (bytes?: number): string => {
    if (!bytes && bytes !== 0) return "";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div
      ref={containerRef}
      className="relative rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#18181b] shadow-xs overflow-hidden"
    >
      {/* Scoped CSS guarantees exact VS Code Dark+ & Light+ token palette */}
      <style>{`
        .bb-code-keyword { color: #0000ff !important; font-weight: 500; }
        .dark .bb-code-keyword { color: #569cd6 !important; font-weight: 500; }
        .bb-code-string { color: #a31515 !important; }
        .dark .bb-code-string { color: #ce9178 !important; }
        .bb-code-comment { color: #008000 !important; font-style: italic; }
        .dark .bb-code-comment { color: #6a9955 !important; font-style: italic; }
        .bb-code-function { color: #795e26 !important; }
        .dark .bb-code-function { color: #dcdcaa !important; }
        .bb-code-number { color: #098658 !important; }
        .dark .bb-code-number { color: #b5cea8 !important; }
        .bb-code-property { color: #001080 !important; }
        .dark .bb-code-property { color: #9cdcfe !important; }
        .bb-code-tag { color: #800000 !important; }
        .dark .bb-code-tag { color: #569cd6 !important; }
        .bb-code-attr-name { color: #ff0000 !important; }
        .dark .bb-code-attr-name { color: #9cdcfe !important; }
        .bb-code-builtin { color: #267f99 !important; }
        .dark .bb-code-builtin { color: #4ec9b0 !important; }
        .bb-code-punctuation { color: #24292f !important; }
        .dark .bb-code-punctuation { color: #d4d4d4 !important; }
        .bb-code-regex { color: #811f3f !important; }
        .dark .bb-code-regex { color: #d16969 !important; }
      `}</style>

      {/* ================= Top Action Bar ================= */}
      <div className="bg-zinc-100/70 dark:bg-[#121214] border-b border-zinc-200 dark:border-zinc-800/90 px-4 py-2.5 flex items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 min-w-0">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="p-1 rounded-md text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-200/60 dark:hover:bg-zinc-800 transition-colors cursor-pointer shrink-0"
              title="Voltar ao repositório"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
          )}

          <div className="flex items-center gap-1.5 font-mono text-xs font-semibold text-zinc-900 dark:text-zinc-100 truncate">
            <FileCode className="h-3.5 w-3.5 text-blue-500 shrink-0" />
            <span className="truncate">{filePath}</span>
          </div>

          <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-medium bg-zinc-200/80 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 shrink-0">
            {languageLabel}
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {isMarkdown && !isBinary && (
            <div className="flex items-center rounded-md bg-zinc-200/80 dark:bg-zinc-800 p-0.5 border border-zinc-200 dark:border-zinc-700">
              <button
                type="button"
                onClick={() => setViewMode("code")}
                className={cn(
                  "flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-medium transition-all cursor-pointer",
                  viewMode === "code"
                    ? "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-2xs"
                    : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200"
                )}
                title="Ver código fonte bruto"
              >
                <Code2 className="h-3 w-3" />
                <span>Code</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode("preview")}
                className={cn(
                  "flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-medium transition-all cursor-pointer",
                  viewMode === "preview"
                    ? "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-2xs"
                    : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200"
                )}
                title="Ver documento formatado"
              >
                <Eye className="h-3 w-3" />
                <span>Preview</span>
              </button>
            </div>
          )}

          {!isBinary && content && (
            <button
              type="button"
              onClick={() => {
                const sel = window.getSelection();
                let data: CodeSelectionData | null = null;
                if (sel && !sel.isCollapsed && sel.toString().trim()) {
                  data = extractSelectionData(sel);
                }
                if (!data) {
                  data = {
                    filePath,
                    selectedCode: content,
                    startLine: 1,
                    endLine: lines.length,
                  };
                }
                setAddToPageSnippet(data);
                setIsAddToPageOpen(true);
              }}
              className="flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] font-medium border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-700/80 transition-colors shadow-2xs cursor-pointer"
              title="Adicionar excerto ou ficheiro a uma página do workspace"
            >
              <FilePlus className="h-3 w-3 text-blue-500 shrink-0" />
              <span>Adicionar a Página</span>
            </button>
          )}

          {!isBinary && content && (
            <button
              type="button"
              onClick={handleCopy}
              className="flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] font-medium border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-700/80 transition-colors shadow-2xs cursor-pointer"
              title="Copiar código"
            >
              {copied ? (
                <>
                  <Check className="h-3 w-3 text-emerald-500" />
                  <span className="text-emerald-500 font-semibold">Copiado!</span>
                </>
              ) : (
                <>
                  <Copy className="h-3 w-3 opacity-70" />
                  <span>Copy</span>
                </>
              )}
            </button>
          )}

          {onDiscussSelection && (
            <button
              type="button"
              onClick={() => {
                const sel = window.getSelection();
                let data: CodeSelectionData | null = null;
                if (sel && !sel.isCollapsed && sel.toString().trim()) {
                  data = extractSelectionData(sel);
                }
                if (!data) {
                  data = {
                    filePath,
                    selectedCode: content || "",
                    startLine: 1,
                    endLine: lines.length > 0 ? lines.length : 1,
                  };
                }
                onDiscussSelection(data);
              }}
              className="flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] font-medium border border-blue-500/30 bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors shadow-2xs cursor-pointer"
              title="Abrir chat do workspace e adicionar à discussão"
            >
              <MessageSquare className="h-3 w-3 shrink-0" />
              <span>Chat</span>
            </button>
          )}

          {htmlUrl && (
            <a
              href={htmlUrl}
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-center p-1.5 rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 hover:bg-zinc-50 dark:hover:bg-zinc-700/80 transition-colors shadow-2xs"
              title="Abrir no GitHub"
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          )}
        </div>
      </div>

      {/* ================= Code Viewport / States ================= */}
      {loading ? (
        <div className="p-16 flex flex-col items-center justify-center text-zinc-500 text-xs gap-3">
          <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
          <span>A carregar ficheiro do GitHub...</span>
        </div>
      ) : error ? (
        <div className="p-12 text-center space-y-3">
          <AlertCircle className="h-6 w-6 text-amber-500 mx-auto" />
          <p className="text-xs text-zinc-800 dark:text-zinc-200 font-semibold">{error}</p>
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="rounded-lg bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 px-3 py-1.5 text-xs font-semibold cursor-pointer hover:opacity-90"
            >
              Tentar novamente
            </button>
          )}
        </div>
      ) : isBinary ? (
        <div className="p-16 text-center text-zinc-500 space-y-3">
          <PhosphorFile className="h-10 w-10 mx-auto opacity-40 text-zinc-400" />
          <p className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">Ficheiro Binário</p>
          <p className="text-[11px] text-zinc-500">
            Este formato não pode ser pré-visualizado como texto ({formatFileSize(size)}).
          </p>
          {htmlUrl && (
            <a
              href={htmlUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-xs text-blue-500 hover:underline"
            >
              <span>Abrir no GitHub</span>
              <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
      ) : content === "" ? (
        <div className="p-16 text-center text-zinc-400 space-y-2">
          <FileCode className="h-8 w-8 mx-auto opacity-40" />
          <p className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Ficheiro vazio (0 bytes)</p>
        </div>
      ) : isMarkdown && viewMode === "preview" ? (
        <MarkdownViewer
          content={content}
          filePath={filePath}
          onDiscussSelection={(sel) => {
            if (onDiscussSelection) {
              onDiscussSelection({
                filePath: sel.filePath,
                selectedCode: sel.selectedCode,
                startLine: sel.startLine,
                endLine: sel.endLine,
              });
            }
          }}
        />
      ) : (
        <div
          onContextMenu={handleContextMenu}
          onMouseUp={handleCodeMouseUp}
          className="overflow-x-auto max-h-[720px] overflow-y-auto bg-zinc-50/50 dark:bg-[#1a1a1d] text-zinc-900 dark:text-zinc-100 font-mono text-[12px] leading-relaxed select-text"
        >
          <table className="w-full border-collapse">
            <tbody>
              {lines.map((line) => {
                const isHighlighted = Boolean(
                  highlightRange &&
                  highlightRange.startLine &&
                  line.lineNumber >= highlightRange.startLine &&
                  line.lineNumber <= (highlightRange.endLine || highlightRange.startLine)
                );

                return (
                  <tr
                    key={line.lineNumber}
                    data-line-number={line.lineNumber}
                    className={cn(
                      "transition-colors group",
                      isHighlighted
                        ? "bg-amber-500/15 dark:bg-amber-500/20 border-l-2 border-amber-500 dark:border-amber-400"
                        : "hover:bg-zinc-200/50 dark:hover:bg-zinc-800/50"
                    )}
                  >
                    {/* Line Number Column */}
                    <td
                      data-line-number={line.lineNumber}
                      className={cn(
                        "w-12 min-w-12 select-none pr-4 pl-3 text-right text-[11px] align-top border-r border-zinc-200/80 dark:border-zinc-800/80 font-mono",
                        isHighlighted
                          ? "text-amber-700 dark:text-amber-300 font-bold bg-amber-500/10"
                          : "text-zinc-400 dark:text-zinc-600 group-hover:text-zinc-700 dark:group-hover:text-zinc-400"
                      )}
                    >
                      {line.lineNumber}
                    </td>

                    {/* Code Line Content */}
                    <td
                      data-line-number={line.lineNumber}
                      className={cn(
                        "pl-4 pr-6 py-0.25 whitespace-pre font-mono text-[12px] tracking-normal",
                        isHighlighted && "bg-amber-500/5 dark:bg-amber-500/10"
                      )}
                    >
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
      )}

      {/* ================= Floating "Adicionar ao Chat" Action Pill ================= */}
      {floatingAction && onDiscussSelection && (
        <div
          ref={floatingRef}
          style={{ top: floatingAction.y, left: floatingAction.x }}
          className="absolute z-40 -translate-x-1/2 -translate-y-full mb-1 flex items-center gap-1.5 rounded-full border border-blue-500/40 bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 px-3 py-1 shadow-xl text-xs font-medium cursor-pointer hover:scale-105 active:scale-95 transition-all select-none animate-in fade-in zoom-in-95 duration-100"
          onMouseDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onDiscussSelection(floatingAction.selectionData);
            setFloatingAction(null);
          }}
        >
          <MessageSquare className="h-3.5 w-3.5 text-blue-400 dark:text-blue-600" />
          <span>Adicionar ao Chat</span>
          {floatingAction.selectionData.startLine && (
            <span className="text-[10px] opacity-75 font-mono">
              (L{floatingAction.selectionData.startLine}{floatingAction.selectionData.endLine && floatingAction.selectionData.endLine !== floatingAction.selectionData.startLine ? `–L${floatingAction.selectionData.endLine}` : ""})
            </span>
          )}
        </div>
      )}

      {/* ================= Right-Click Context Menu ================= */}
      {contextMenu && onDiscussSelection && (
        <div
          ref={contextMenuRef}
          style={{ left: contextMenu.x, top: contextMenu.y }}
          className="fixed z-50 min-w-[220px] rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-1 shadow-xl text-xs text-zinc-900 dark:text-zinc-100 animate-in fade-in zoom-in-95 duration-100"
        >
          <button
            type="button"
            onClick={handleContextMenuDiscuss}
            className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md hover:bg-blue-50 dark:hover:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-medium transition-colors text-left cursor-pointer"
          >
            <MessageSquare className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">
              {contextMenu.selectionData.startLine !== undefined &&
              contextMenu.selectionData.endLine !== undefined
                ? contextMenu.selectionData.startLine === contextMenu.selectionData.endLine
                  ? `Comentar linha ${contextMenu.selectionData.startLine}`
                  : `Comentar linhas ${contextMenu.selectionData.startLine}–${contextMenu.selectionData.endLine}`
                : "Comentar seleção"}
            </span>
          </button>

          <div
            className="relative"
            onMouseEnter={() => {
              if (submenuTimeoutRef.current) clearTimeout(submenuTimeoutRef.current);
              setIsSubmenuOpen(true);
            }}
            onMouseLeave={() => {
              submenuTimeoutRef.current = setTimeout(() => {
                setIsSubmenuOpen(false);
              }, 200);
            }}
          >
            <button
              type="button"
              onClick={() => {
                setAddToPageSnippet(contextMenu.selectionData);
                setSelectedTargetPageId(null);
                setIsAddToPageOpen(true);
                setContextMenu(null);
                setIsSubmenuOpen(false);
              }}
              className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-medium transition-colors text-left cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <FilePlus className="h-3.5 w-3.5 shrink-0 text-blue-500" />
                <span>Adicionar a uma página</span>
              </div>
              <ChevronRight className="h-3.5 w-3.5 text-zinc-400 shrink-0" />
            </button>

            {/* Flyout Submenu to pick the page */}
            {isSubmenuOpen && (
              <div
                className={cn(
                  "absolute top-0 w-60 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-1 shadow-2xl text-xs z-50 animate-in fade-in zoom-in-95 duration-100",
                  contextMenu.x + 220 + 240 > (typeof window !== "undefined" ? window.innerWidth : 1000)
                    ? "right-full mr-1.5"
                    : "left-full ml-1.5"
                )}
              >
                <div className="px-2 py-1 text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">
                  Escolher Página
                </div>

                <div className="max-h-48 overflow-y-auto space-y-0.5">
                  {workspacePages.length === 0 ? (
                    <div className="px-2 py-2 text-zinc-400 text-[11px] italic">
                      A carregar páginas...
                    </div>
                  ) : (
                    workspacePages.map((page) => (
                      <button
                        key={page.id}
                        type="button"
                        onClick={() => {
                          setAddToPageSnippet(contextMenu.selectionData);
                          setSelectedTargetPageId(page.id);
                          setIsAddToPageOpen(true);
                          setContextMenu(null);
                          setIsSubmenuOpen(false);
                        }}
                        className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md hover:bg-blue-50 dark:hover:bg-blue-900/20 text-zinc-700 dark:text-zinc-300 hover:text-blue-600 dark:hover:text-blue-400 text-left transition-colors cursor-pointer truncate"
                      >
                        <PageIcon icon={page.icon} pageId={page.id} className="h-4 w-4 shrink-0 text-sm" imgClassName="h-4 w-4 rounded shrink-0 object-cover" />
                        <span className="truncate">{page.title || "Sem título"}</span>
                      </button>
                    ))
                  )}
                </div>

                <div className="pt-1 mt-1 border-t border-zinc-100 dark:border-zinc-800">
                  <button
                    type="button"
                    onClick={() => {
                      setAddToPageSnippet(contextMenu.selectionData);
                      setSelectedTargetPageId(null);
                      setIsAddToPageOpen(true);
                      setContextMenu(null);
                      setIsSubmenuOpen(false);
                    }}
                    className="w-full flex items-center gap-1.5 px-2 py-1 rounded-md text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 text-[11px] font-medium transition-colors cursor-pointer"
                  >
                    <Plus className="h-3 w-3" />
                    <span>Criar nova página...</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={handleContextMenuCopy}
            className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 transition-colors text-left cursor-pointer"
          >
            <Copy className="h-3.5 w-3.5 shrink-0 opacity-70" />
            <span>
              {contextMenu.isSpecificLineOnly ? "Copiar linha" : "Copiar seleção"}
            </span>
          </button>

          <div className="my-1 border-t border-zinc-100 dark:border-zinc-800" />

          <button
            type="button"
            onClick={() => setContextMenu(null)}
            className="w-full flex items-center justify-between px-2.5 py-1 text-[11px] rounded text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors cursor-pointer"
          >
            <span>Fechar menu</span>
            <span className="font-mono text-[10px] text-zinc-400">Esc</span>
          </button>
        </div>
      )}

      {/* ================= Add to Page Modal ================= */}
      <AddToPageModal
        isOpen={isAddToPageOpen}
        onClose={() => setIsAddToPageOpen(false)}
        snippet={addToPageSnippet}
        htmlUrl={htmlUrl}
        initialPageId={selectedTargetPageId}
      />
    </div>
  );
}
