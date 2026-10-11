"use client";

// ==============================================================================
// BusinessBrain: GitHub Discussions & Code Snippet Comments Drawer
// WhatsApp-style compact speech bubbles, pinned code snippets, local cache,
// instant optimistic updates, and persistent PostgreSQL storage.
// ==============================================================================

import * as React from "react";
import {
  X,
  MessageSquare,
  Send,
  Loader2,
  Lock,
  CornerDownRight,
  FileCode,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Code2,
  Clock,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/client";
import {
  getEntityCommentsAction,
  addEntityCommentAction,
} from "@/lib/integrations/github/actions";
import { EntityCommentRecord } from "@/lib/integrations/github/types";
import { detectLanguageFromPath, tokenizeCodeToLines, getTokenClasses } from "@/lib/code-viewer/syntax";

export interface CodeSnippetReference {
  filePath: string;
  selectedCode: string;
  startLine?: number;
  endLine?: number;
  commitSha?: string;
}

interface GitHubCommentsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  entityType: string;
  entityId: string;
  entityTitle: string;
  initialCodeSnippet?: CodeSnippetReference | null;
  onClearCodeSnippet?: () => void;
  onOpenFile?: (filePath: string, startLine?: number, endLine?: number) => void;
}

const CODE_REF_TAG_START = "<!--bb:code-ref";
const CODE_REF_TAG_END = "<!--bb:code-ref:end-->";

const MAX_STORED_CODE_LINES = 20;

export function serializeCommentWithSnippet(
  text: string,
  snippet?: CodeSnippetReference | null
): string {
  if (!snippet) return text.trim();
  const meta = {
    filePath: snippet.filePath,
    startLine: snippet.startLine,
    endLine: snippet.endLine,
    commitSha: snippet.commitSha,
  };

  // Salvaguarda: limita estritamente a 20 linhas guardadas na base de dados se a seleção for longa,
  // preservando sempre as linhas de início e fim nos metadados para abrir no ficheiro completo.
  let codeToSave = snippet.selectedCode;
  const lines = codeToSave.split("\n");
  if (lines.length > MAX_STORED_CODE_LINES) {
    const kept = lines.slice(0, MAX_STORED_CODE_LINES).join("\n");
    const omitted = lines.length - MAX_STORED_CODE_LINES;
    codeToSave = `${kept}\n// ... [+${omitted} linhas truncadas para otimizar espaço]`;
  } else if (codeToSave.length > 2000) {
    codeToSave = `${codeToSave.slice(0, 2000)}\n// ... [excerto truncado para otimizar espaço]`;
  }

  return `${CODE_REF_TAG_START} ${JSON.stringify(meta)}\n${codeToSave}\n${CODE_REF_TAG_END}\n\n${text.trim()}`;
}

export function parseCommentBody(rawContent: string): {
  text: string;
  snippet?: CodeSnippetReference;
} {
  if (!rawContent.startsWith(CODE_REF_TAG_START)) {
    return { text: rawContent };
  }

  const endIdx = rawContent.indexOf(CODE_REF_TAG_END);
  if (endIdx === -1) {
    return { text: rawContent };
  }

  try {
    const headerEnd = rawContent.indexOf("\n");
    if (headerEnd === -1) return { text: rawContent };

    const metaJson = rawContent.substring(CODE_REF_TAG_START.length, headerEnd).trim();
    const meta = JSON.parse(metaJson);
    const code = rawContent.substring(headerEnd + 1, endIdx).trimEnd();
    const remainingText = rawContent.substring(endIdx + CODE_REF_TAG_END.length).trim();

    return {
      text: remainingText,
      snippet: {
        filePath: meta.filePath || "",
        startLine: meta.startLine,
        endLine: meta.endLine,
        commitSha: meta.commitSha,
        selectedCode: code,
      },
    };
  } catch {
    return { text: rawContent };
  }
}

/**
 * Compact, clean code snippet card with clickable path link and readable line numbers.
 * Theme-aware: high-contrast colors in both light and dark modes.
 */
function CommentSnippetView({
  snippet,
  onOpenFile,
}: {
  snippet: CodeSnippetReference;
  onOpenFile?: (filePath: string, startLine?: number, endLine?: number) => void;
}) {
  const { locale } = useLanguage();
  const isPt = locale === "pt";
  const [isExpanded, setIsExpanded] = React.useState(false);
  const rawLines = React.useMemo(() => snippet.selectedCode.split("\n"), [snippet.selectedCode]);
  const isLong = rawLines.length > 3;
  const displayedLines = isLong && !isExpanded ? rawLines.slice(0, 3) : rawLines;

  const { lang } = detectLanguageFromPath(snippet.filePath);
  const highlighted = React.useMemo(() => {
    return tokenizeCodeToLines(displayedLines.join("\n"), lang);
  }, [displayedLines, lang]);

  const baseLineNumber = snippet.startLine || 1;

  return (
    <div className="rounded-xl overflow-hidden text-xs my-1 border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-[#141416] text-zinc-900 dark:text-zinc-100 shadow-2xs max-w-full">
      {/* Header: File path itself IS the link */}
      <div className="flex items-center justify-between px-2.5 py-1.5 bg-zinc-100/90 dark:bg-[#1c1c1f] border-b border-zinc-200 dark:border-zinc-800 text-[11px] select-none gap-2">
        {onOpenFile ? (
          <button
            type="button"
            onClick={() => onOpenFile(snippet.filePath, snippet.startLine, snippet.endLine)}
            className="group/link flex items-center gap-1.5 font-mono text-left truncate min-w-0 text-zinc-700 dark:text-zinc-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors cursor-pointer"
            title={isPt ? `Abrir ${snippet.filePath} na linha ${snippet.startLine || 1}` : `Open ${snippet.filePath} at line ${snippet.startLine || 1}`}
          >
            <FileCode className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400 shrink-0 group-hover/link:text-blue-500" />
            <span className="font-semibold truncate text-[11px] group-hover/link:underline">
              {snippet.filePath}
            </span>
            {snippet.startLine !== undefined && (
              <span className="text-zinc-500 dark:text-zinc-400 font-mono text-[10px] shrink-0 font-normal ml-0.5">
                (L{snippet.startLine}{snippet.endLine !== undefined && snippet.endLine !== snippet.startLine ? `–L${snippet.endLine}` : ""})
              </span>
            )}
          </button>
        ) : (
          <div className="flex items-center gap-1.5 font-mono truncate min-w-0 text-zinc-700 dark:text-zinc-300">
            <FileCode className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
            <span className="font-semibold truncate text-[11px]">{snippet.filePath}</span>
            {snippet.startLine !== undefined && (
              <span className="text-zinc-500 dark:text-zinc-400 font-mono text-[10px] shrink-0 font-normal ml-0.5">
                (L{snippet.startLine}{snippet.endLine !== undefined && snippet.endLine !== snippet.startLine ? `–L${snippet.endLine}` : ""})
              </span>
            )}
          </div>
        )}

        {isLong && (
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-[10px] text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 bg-zinc-200/80 dark:bg-zinc-800/80 hover:bg-zinc-300 dark:hover:bg-zinc-700/80 px-1.5 py-0.5 rounded flex items-center gap-1 shrink-0 cursor-pointer transition-colors"
          >
            <span>{isExpanded ? (isPt ? "Recolher" : "Collapse") : `+${rawLines.length - 3} ${isPt ? "lin." : "lines"}`}</span>
            {isExpanded ? <ChevronUp className="h-2.5 w-2.5" /> : <ChevronDown className="h-2.5 w-2.5" />}
          </button>
        )}
      </div>

      {/* Code snippet lines with high contrast line numbers and syntax coloring */}
      <div className="p-1.5 font-mono text-[11px] overflow-x-auto leading-relaxed select-text bg-white dark:bg-[#141416]">
        <table className="border-collapse w-full">
          <tbody>
            {highlighted.map((hLine, idx) => (
              <tr key={idx} className="hover:bg-zinc-100/70 dark:hover:bg-zinc-800/30 transition-colors">
                {snippet.startLine !== undefined && (
                  <td className="w-7 min-w-7 select-none pr-2 pl-1 text-right text-zinc-400 dark:text-zinc-500 font-mono text-[10px] align-top border-r border-zinc-200 dark:border-zinc-800 font-medium">
                    {baseLineNumber + idx}
                  </td>
                )}
                <td className="pl-2.5 pr-2 whitespace-pre text-zinc-900 dark:text-zinc-100">
                  {hLine.tokens.map((token, tIdx) => (
                    <span key={tIdx} className={getTokenClasses(token.type)}>
                      {token.content}
                    </span>
                  ))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function GitHubCommentsDrawer({
  isOpen,
  onClose,
  entityType,
  entityId,
  entityTitle,
  initialCodeSnippet,
  onClearCodeSnippet,
  onOpenFile,
}: GitHubCommentsDrawerProps) {
  const { locale } = useLanguage();
  const isPt = locale === "pt";

  const [currentUser, setCurrentUser] = React.useState<{
    id: string;
    name?: string;
    avatar?: string;
  } | null>(null);

  const [comments, setComments] = React.useState<EntityCommentRecord[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [commentText, setCommentText] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [replyToId, setReplyToId] = React.useState<string | null>(null);
  const [attachedSnippet, setAttachedSnippet] = React.useState<CodeSnippetReference | null>(
    initialCodeSnippet || null
  );

  const inputRef = React.useRef<HTMLInputElement>(null);
  const messagesEndRef = React.useRef<HTMLDivElement>(null);
  const cacheKey = `bb_chat_${entityType}_${entityId}`;

  // 1. Fetch authenticated user profile client-side for WhatsApp-style alignment (me vs team)
  React.useEffect(() => {
    try {
      const supabase = createClient();
      supabase.auth.getUser().then(({ data: { user } }) => {
        if (user) {
          setCurrentUser({
            id: user.id,
            name: user.user_metadata?.full_name || user.email?.split("@")[0] || (isPt ? "Tu" : "You"),
            avatar: user.user_metadata?.avatar_url,
          });
        }
      });
    } catch {
      // ignore
    }
  }, [isPt]);

  // 2. Sync attached code snippet when opened or when snippet prop updates
  React.useEffect(() => {
    if (initialCodeSnippet) {
      setAttachedSnippet(initialCodeSnippet);
    }
  }, [initialCodeSnippet, isOpen]);

  // 2.1 Auto-focus input when opened with snippet or normally
  React.useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 80);
      return () => clearTimeout(timer);
    }
  }, [isOpen, initialCodeSnippet]);

  const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

  // 3. Immediately hydrate from localStorage cache, enforcing 7-day retention
  React.useEffect(() => {
    if (!entityId) return;
    try {
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const sevenDaysCutoff = Date.now() - SEVEN_DAYS_MS;
          const fresh = parsed.filter(
            (c: EntityCommentRecord) => new Date(c.created_at).getTime() >= sevenDaysCutoff
          );
          setComments(fresh);
        }
      }
    } catch {
      // ignore
    }
  }, [cacheKey, entityId, SEVEN_DAYS_MS]);

  // 4. Server fetch comments from PostgreSQL (enforcing 7-day TTL) and sync with local cache
  const loadComments = React.useCallback(async () => {
    if (!entityId) return;
    setLoading(true);
    try {
      const res = await getEntityCommentsAction(entityType, entityId);
      if (res.success && Array.isArray(res.comments)) {
        const sevenDaysCutoff = Date.now() - SEVEN_DAYS_MS;
        const fresh = res.comments.filter(
          (c: EntityCommentRecord) => new Date(c.created_at).getTime() >= sevenDaysCutoff
        );
        setComments(fresh);
        try {
          localStorage.setItem(cacheKey, JSON.stringify(fresh));
        } catch {
          // ignore
        }
      }
    } finally {
      setLoading(false);
    }
  }, [entityType, entityId, cacheKey, SEVEN_DAYS_MS]);

  // 5. Trigger load when open
  React.useEffect(() => {
    if (isOpen) {
      loadComments();
      setReplyToId(null);
    }
  }, [isOpen, loadComments]);

  // 6. Auto-scroll to bottom of chat when new comments appear
  React.useEffect(() => {
    if (isOpen && comments.length > 0) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [isOpen, comments.length]);

  // 7. Close on Escape key (Strict Hook placement before any return)
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

  if (!isOpen) return null;

  // Optimistic submit: instantly appears in chat & local cache, then syncs to PostgreSQL
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim() && !attachedSnippet) return;
    if (submitting) return;

    const textToSend = commentText.trim();
    const snippetToSend = attachedSnippet;
    const payload = serializeCommentWithSnippet(textToSend, snippetToSend);

    const optimisticId = `temp-${Date.now()}`;
    const optimisticComment: EntityCommentRecord = {
      id: optimisticId,
      organization_id: "",
      entity_type: entityType,
      entity_id: entityId,
      author_id: currentUser?.id || "me",
      parent_id: replyToId || null,
      content: payload,
      is_resolved: false,
      is_edited: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      author: {
        id: currentUser?.id || "me",
        full_name: currentUser?.name || "Tu",
        email: "",
        avatar_url: currentUser?.avatar || null,
      },
    };

    // Instant optimistic render & cache update
    setComments((prev) => {
      const next = [...prev, optimisticComment];
      try {
        localStorage.setItem(cacheKey, JSON.stringify(next));
      } catch {}
      return next;
    });

    setCommentText("");
    setReplyToId(null);
    setAttachedSnippet(null);
    onClearCodeSnippet?.();
    setSubmitting(true);

    try {
      const res = await addEntityCommentAction(
        entityType,
        entityId,
        payload,
        replyToId || undefined
      );

      if (res.success && res.comment) {
        // Replace temp comment with server record
        setComments((prev) => {
          const filtered = prev.filter((c) => c.id !== optimisticId);
          const next = [...filtered, { ...res.comment!, author: optimisticComment.author }];
          try {
            localStorage.setItem(cacheKey, JSON.stringify(next));
          } catch {}
          return next;
        });
      } else {
        await loadComments();
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleRemoveSnippet = () => {
    setAttachedSnippet(null);
    onClearCodeSnippet?.();
  };

  const formatRelativeTime = (iso: string) => {
    const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
    if (diff < 60) return isPt ? "agora" : "just now";
    if (diff < 3600) return `${Math.floor(diff / 60)}m`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
    return `${Math.floor(diff / 86400)}d`;
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end pointer-events-none">
      <div className="w-full max-w-sm sm:max-w-md h-full bg-card border-l border-border flex flex-col shadow-2xl text-card-foreground pointer-events-auto animate-in slide-in-from-right duration-200">
        {/* Header */}
        <div className="flex items-center justify-between p-3.5 border-b border-border bg-card select-none">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-600/10 text-blue-500 border border-blue-500/20 shrink-0">
              <MessageSquare className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-semibold truncate text-foreground">
                {isPt ? "Discussão do Workspace" : "Workspace Discussion"}
              </h3>
              <p className="text-[11px] text-muted-foreground truncate font-mono">{entityTitle}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Retention & Privacy notice banner */}
        <div className="px-3 py-1.5 bg-muted/40 border-b border-border flex items-center justify-between text-[10px] text-muted-foreground select-none">
          <div className="flex items-center gap-1.5 min-w-0">
            <Lock className="h-3 w-3 text-emerald-500 shrink-0" />
            <span className="truncate">
              {isPt ? "Discussões internas privadas" : "Private internal discussions"}
            </span>
          </div>
          <div className="flex items-center gap-1 text-amber-600 dark:text-amber-400 shrink-0 font-medium">
            <Clock className="h-3 w-3" />
            <span>{isPt ? "Expira em 7 dias" : "Expires in 7 days"}</span>
          </div>
        </div>

        {/* ================= WhatsApp-Style Comments Feed ================= */}
        <div className="flex-1 overflow-y-auto p-3.5 space-y-2.5 bg-zinc-50/50 dark:bg-zinc-950/40">
          {loading && comments.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : comments.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-30" />
              <p className="text-xs font-medium">{isPt ? "Sem mensagens ainda" : "No messages yet"}</p>
              <p className="text-[11px] mt-0.5">
                {isPt
                  ? "Seleciona código no editor para fixar e comentar com a equipa."
                  : "Select code in the editor to pin and comment with the team."}
              </p>
            </div>
          ) : (
            comments.map((c) => {
              const { text, snippet } = parseCommentBody(c.content);
              const isMe = c.author_id === currentUser?.id || c.id.startsWith("temp-");

              return (
                <div
                  key={c.id}
                  className={cn(
                    "flex flex-col group transition-all",
                    isMe ? "items-end ml-4" : "items-start mr-4"
                  )}
                >
                  {/* Author Name & Mini Avatar for Incoming Messages */}
                  {!isMe && (
                    <div className="flex items-center gap-1.5 mb-1 px-1">
                      {c.author?.avatar_url ? (
                        <img
                          src={c.author.avatar_url}
                          alt={c.author.full_name || (isPt ? "Membro" : "Member")}
                          className="h-4 w-4 rounded-full object-cover"
                        />
                      ) : (
                        <div className="h-4 w-4 rounded-full bg-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center text-[9px] font-bold">
                          {c.author?.full_name?.charAt(0) || "U"}
                        </div>
                      )}
                      <span className="text-[11px] font-semibold text-blue-600 dark:text-blue-400">
                        {c.author?.full_name || (isPt ? "Membro da Equipa" : "Team Member")}
                      </span>
                    </div>
                  )}

                  {/* Clean, Modern Speech Bubble (Harmonious tones, no electric blue) */}
                  <div
                    className={cn(
                      "rounded-2xl px-3 py-2 shadow-2xs text-xs relative max-w-[88%] break-words transition-colors",
                      isMe
                        ? "bg-blue-50/70 dark:bg-blue-950/25 border border-blue-200/70 dark:border-blue-900/40 text-foreground rounded-tr-xs"
                        : "bg-card border border-border text-foreground rounded-tl-xs"
                    )}
                  >
                    {/* Referenced / Pinned Code Snippet Box */}
                    {snippet && (
                      <CommentSnippetView snippet={snippet} onOpenFile={onOpenFile} />
                    )}

                    {/* Message Text */}
                    {text && (
                      <p
                        className={cn(
                          "whitespace-pre-wrap leading-relaxed select-text text-xs text-foreground px-0.5",
                          snippet ? "mt-1.5" : "mt-0"
                        )}
                      >
                        {text}
                      </p>
                    )}

                    {/* Timestamp (Discreto, sem ícones de visto/não visto) */}
                    <div className="flex items-center justify-end text-[10px] text-muted-foreground/60 select-none mt-1">
                      <span>{formatRelativeTime(c.created_at)}</span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* ================= Composer Footer ================= */}
        <div className="p-3 border-t border-border bg-card space-y-2">
          {/* Active Reply Banner */}
          {replyToId && (
            <div className="flex items-center justify-between px-2.5 py-1 rounded-lg bg-muted text-[11px] text-muted-foreground">
              <span>{isPt ? "A responder à mensagem" : "Replying to message"}</span>
              <button
                type="button"
                onClick={() => setReplyToId(null)}
                className="text-xs hover:text-foreground cursor-pointer"
              >
                {isPt ? "Cancelar" : "Cancel"}
              </button>
            </div>
          )}

          {/* Attached / Pinned Code Snippet Chip */}
          {attachedSnippet && (
            <div className="flex items-center justify-between gap-2 px-3 py-1.5 rounded-xl border border-blue-500/30 bg-blue-500/10 text-xs animate-in fade-in duration-150">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-1 h-7 rounded-full bg-blue-500 shrink-0" />
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 text-[11px] font-semibold text-blue-600 dark:text-blue-400">
                    <FileCode className="h-3 w-3 shrink-0" />
                    <span className="truncate">{attachedSnippet.filePath}</span>
                    {attachedSnippet.startLine !== undefined && (
                      <span className="font-mono text-[10px] text-muted-foreground">
                        (L{attachedSnippet.startLine}{attachedSnippet.endLine && attachedSnippet.endLine !== attachedSnippet.startLine ? `–L${attachedSnippet.endLine}` : ""})
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-muted-foreground truncate font-mono">
                    {attachedSnippet.selectedCode.split("\n")[0] || (isPt ? "Código selecionado" : "Selected code")}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleRemoveSnippet}
                className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
                title={isPt ? "Desafixar excerto" : "Unpin snippet"}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          {/* Input Form */}
          <form onSubmit={handleSubmit} className="flex items-center gap-2">
            <input
              ref={inputRef}
              type="text"
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder={
                attachedSnippet
                  ? (isPt ? "Escreve uma nota sobre o excerto fixado..." : "Write a note about the pinned snippet...")
                  : (isPt ? "Escreve uma mensagem para a equipa..." : "Write a message to the team...")
              }
              className="flex-1 rounded-xl border border-input bg-background px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:border-blue-500 focus:outline-none shadow-2xs"
            />
            <button
              type="submit"
              disabled={submitting || (!commentText.trim() && !attachedSnippet)}
              className="flex items-center justify-center h-8 w-8 rounded-full bg-blue-600 text-white hover:bg-blue-500 transition-colors disabled:opacity-40 cursor-pointer shadow-xs shrink-0"
              title={isPt ? "Enviar mensagem" : "Send message"}
            >
              {submitting ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Send className="h-3.5 w-3.5" />
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
