"use client";

import * as React from "react";
import {
  Send,
  Square,
  Plus,
  Trash2,
  AlertCircle,
  MessageSquare,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  FileText,
  Brain,
  Database,
} from "lucide-react";
import { PhosphorBrain } from "@/components/icons";
import { AIConversationRecord, AIMessageRecord } from "@/lib/ai/chat/service";
import { ChatMessageItem } from "./chat-message-item";
import {
  getConversationsAction,
  getConversationDetailsAction,
  deleteConversationAction,
} from "@/lib/ai/chat/actions";
import { VerifiedSource } from "@/lib/ai/types";
import { AuthorizationCard } from "./authorization-card";
import { ContextSourcesModal } from "./context-sources-modal";
import { PageDraftPreview } from "./page-draft-preview";
import { AuthorizationChallenge, AIScopeType } from "@/lib/ai/auth/types";
import { PageDraft } from "@/lib/ai/pages/types";
import { grantAIAuthorizationAction, saveConversationSourcesAction } from "@/lib/ai/auth/actions";
import { ModelSelectorDropdown } from "./model-selector-dropdown";

interface ChatViewProps {
  initialConversations?: AIConversationRecord[];
  activeOrgName?: string;
  userName?: string;
  userAvatar?: string | null;
}

export function ChatView({
  initialConversations = [],
  activeOrgName = "Workspace",
  userName = "Você",
  userAvatar,
}: ChatViewProps) {
  const [conversations, setConversations] = React.useState<AIConversationRecord[]>(initialConversations);
  const [currentConversationId, setCurrentConversationId] = React.useState<string | null>(
    initialConversations[0]?.id || null
  );
  const [messages, setMessages] = React.useState<AIMessageRecord[]>([]);
  const [prompt, setPrompt] = React.useState("");
  const [isStreaming, setIsStreaming] = React.useState(false);
  const [activeSources, setActiveSources] = React.useState<VerifiedSource[]>([]);
  const [streamingContent, setStreamingContent] = React.useState("");
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = React.useState(true);

  // Data Governance & Source Scoping States
  const [selectedSourceIds, setSelectedSourceIds] = React.useState<string[]>([
    "area:pages",
    "area:brain",
  ]);
  const [isSourcesModalOpen, setIsSourcesModalOpen] = React.useState(false);
  const [activeChallenge, setActiveChallenge] = React.useState<AuthorizationChallenge | null>(null);
  const [activeDraft, setActiveDraft] = React.useState<PageDraft | null>(null);
  const [lastPrompt, setLastPrompt] = React.useState<string>("");
  const [selectedModelId, setSelectedModelId] = React.useState<string | null>(null);
  const [isAutomatic, setIsAutomatic] = React.useState<boolean>(true);

  const abortControllerRef = React.useRef<AbortController | null>(null);
  const messagesEndRef = React.useRef<HTMLDivElement | null>(null);
  const textareaRef = React.useRef<HTMLTextAreaElement | null>(null);

  // Scroll to bottom when messages update
  const scrollToBottom = React.useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  React.useEffect(() => {
    scrollToBottom();
  }, [messages, streamingContent, activeChallenge, activeDraft, scrollToBottom]);

  // Load conversation details when switching
  const loadConversation = React.useCallback(async (id: string) => {
    try {
      setErrorMessage(null);
      setActiveChallenge(null);
      setActiveDraft(null);
      const res = await getConversationDetailsAction(id);
      if (res.success && res.messages) {
        setMessages(res.messages);
        setCurrentConversationId(id);
      } else {
        setErrorMessage(res.error || "Erro ao carregar histórico.");
      }
    } catch {
      setErrorMessage("Falha de rede ao carregar conversa.");
    }
  }, []);

  React.useEffect(() => {
    if (currentConversationId) {
      loadConversation(currentConversationId);
    } else {
      setMessages([]);
    }
  }, [currentConversationId, loadConversation]);

  // Handle new conversation
  const handleNewConversation = () => {
    if (isStreaming) handleCancel();
    setCurrentConversationId(null);
    setMessages([]);
    setStreamingContent("");
    setErrorMessage(null);
    setActiveChallenge(null);
    setActiveDraft(null);
    textareaRef.current?.focus();
  };

  // Handle delete conversation
  const handleDeleteConversation = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!confirm("Tem a certeza que deseja eliminar esta discussão?")) return;

    try {
      const res = await deleteConversationAction(id);
      if (res.success) {
        const nextList = conversations.filter((c) => c.id !== id);
        setConversations(nextList);
        if (currentConversationId === id) {
          setCurrentConversationId(nextList[0]?.id || null);
        }
      }
    } catch (err) {
      console.error("Failed to delete conversation", err);
    }
  };

  // Handle cancellation
  const handleCancel = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setIsStreaming(false);
    }
  };

  // Apply context sources change
  const handleApplySources = (newIds: string[]) => {
    setSelectedSourceIds(newIds);
    if (currentConversationId) {
      saveConversationSourcesAction(currentConversationId, newIds);
    }
  };

  // Handle send message
  const handleSend = async (customPrompt?: string, authorizationGrantPayload?: any) => {
    const textToSend = (customPrompt || prompt).trim();
    if (!textToSend || isStreaming) return;

    setLastPrompt(textToSend);
    setPrompt("");
    setErrorMessage(null);
    setActiveChallenge(null);
    setIsStreaming(true);
    setStreamingContent("");
    setActiveSources([]);

    // Optimistically add user message if not already added
    if (!authorizationGrantPayload) {
      const tempUserMsg: AIMessageRecord = {
        id: "temp-user-" + Date.now(),
        conversationId: currentConversationId || "pending",
        organizationId: "",
        userId: "",
        role: "user",
        content: textToSend,
        sources: [],
        tokensPrompt: 0,
        tokensCompletion: 0,
        executionDurationMs: null,
        errorCode: null,
        createdAt: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, tempUserMsg]);
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId: currentConversationId || undefined,
          prompt: textToSend,
          selectedSourceIds,
          authorizationGrant: authorizationGrantPayload,
          model: selectedModelId || undefined,
          selectionMode: isAutomatic ? "auto" : "preferred",
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Erro HTTP ${res.status}`);
      }

      if (!res.body) throw new Error("Resposta sem corpo de streaming.");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let activeConvId = currentConversationId;
      let finalSources: VerifiedSource[] = [];
      let fullAssistantText = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data: ")) continue;
          const jsonStr = trimmed.slice(6).trim();
          if (!jsonStr) continue;

          try {
            const event = JSON.parse(jsonStr);

            if (event.type === "authorization_required") {
              // Pause and present inline challenge card
              setActiveChallenge(event.challenge);
              setIsStreaming(false);
              return;
            } else if (event.type === "draft_preview") {
              // Emitted when page creation intent is completed
              setActiveDraft(event.draft);
            } else if (event.type === "init") {
              if (event.conversationId && event.conversationId !== currentConversationId) {
                activeConvId = event.conversationId;
                setCurrentConversationId(event.conversationId);
                // Refresh conversations list
                getConversationsAction().then((r) => {
                  if (r.success && r.conversations) setConversations(r.conversations);
                });
              }
              if (event.sources) {
                finalSources = event.sources;
                setActiveSources(event.sources);
              }
            } else if (event.type === "chunk" && event.text) {
              fullAssistantText += event.text;
              setStreamingContent(fullAssistantText);
            } else if (event.type === "done") {
              // Finalize message in local state
              const completedAssistantMsg: AIMessageRecord = {
                id: "assistant-" + Date.now(),
                conversationId: activeConvId || "completed",
                organizationId: "",
                userId: null,
                role: "assistant",
                content: fullAssistantText,
                sources: finalSources,
                tokensPrompt: 0,
                tokensCompletion: 0,
                executionDurationMs: null,
                errorCode: event.finishReason === "abort" ? "ABORTED" : null,
                createdAt: new Date().toISOString(),
              };
              setMessages((prev) => [...prev, completedAssistantMsg]);
              setStreamingContent("");
            } else if (event.type === "error") {
              setErrorMessage(event.error || "Erro durante o streaming da resposta.");
            }
          } catch {
            // Partial chunk parsing error, wait for next buffer
          }
        }
      }
    } catch (err: any) {
      if (err.name !== "AbortError") {
        setErrorMessage(err.message || "Erro na comunicação com o servidor de IA.");
      }
    } finally {
      setIsStreaming(false);
      abortControllerRef.current = null;
    }
  };

  // Handle challenge grant response
  const handleGrantChallenge = async (scope: AIScopeType, addToSources?: boolean) => {
    if (!activeChallenge) return;
    const challenge = activeChallenge;
    setActiveChallenge(null);

    // If adding to sources, update state
    if (addToSources || scope === "persistent") {
      const sourceId = `area:${challenge.resourceType}`;
      if (!selectedSourceIds.includes(sourceId)) {
        handleApplySources([...selectedSourceIds, sourceId]);
      }
    }

    // Dispatch authorization grant to server and resume prompt
    const grantPayload = {
      scopeType: scope,
      conversationId: currentConversationId,
      resourceType: challenge.resourceType,
      resourceId: challenge.resourceId,
      actionType: challenge.actionType,
      purpose: "interactive_chat_grant",
    };

    await grantAIAuthorizationAction(grantPayload);
    handleSend(lastPrompt, grantPayload);
  };

  // Handle challenge deny response
  const handleDenyChallenge = () => {
    setActiveChallenge(null);
    const deniedAssistantMsg: AIMessageRecord = {
      id: "assistant-denied-" + Date.now(),
      conversationId: currentConversationId || "denied",
      organizationId: "",
      userId: null,
      role: "assistant",
      content: "O acesso à fonte solicitada não foi autorizado. A resposta foi cancelada para proteger os dados restritos da empresa.",
      sources: [],
      tokensPrompt: 0,
      tokensCompletion: 0,
      executionDurationMs: null,
      errorCode: null,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, deniedAssistantMsg]);
  };

  return (
    <div className="flex h-[calc(100vh-4rem)] w-full overflow-hidden bg-background text-foreground text-left">
      {/* ================= CONTEXT SOURCES MODAL ================= */}
      <ContextSourcesModal
        isOpen={isSourcesModalOpen}
        onClose={() => setIsSourcesModalOpen(false)}
        selectedSourceIds={selectedSourceIds}
        onApplySources={handleApplySources}
      />

      {/* ================= LEFT SIDEBAR (CONVERSATIONS) ================= */}
      <aside
        className={`${
          isSidebarOpen ? "w-64" : "w-0"
        } transition-all duration-200 border-r border-border bg-card/40 flex flex-col shrink-0 overflow-hidden relative`}
      >
        <div className="p-3 border-b border-border flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={handleNewConversation}
            className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-xs font-semibold rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 transition-colors shadow-xs cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Nova Discussão</span>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {conversations.length === 0 ? (
            <div className="p-4 text-center text-xs text-muted-foreground">
              Sem discussões anteriores.
            </div>
          ) : (
            conversations.map((conv) => {
              const isActive = conv.id === currentConversationId;
              return (
                <div
                  key={conv.id}
                  onClick={() => loadConversation(conv.id)}
                  className={`group flex items-center justify-between gap-2 px-3 py-2 rounded-xl text-xs font-medium cursor-pointer transition-colors ${
                    isActive
                      ? "bg-hover text-foreground font-semibold"
                      : "text-muted-foreground hover:bg-hover/60 hover:text-foreground"
                  }`}
                >
                  <div className="flex items-center gap-2 truncate">
                    <MessageSquare className="h-3.5 w-3.5 shrink-0 opacity-70" />
                    <span className="truncate">{conv.title}</span>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => handleDeleteConversation(e, conv.id)}
                    className="opacity-0 group-hover:opacity-100 hover:text-rose-400 p-1 rounded transition-opacity"
                    title="Eliminar discussão"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              );
            })
          )}
        </div>
      </aside>

      {/* ================= MAIN CHAT AREA ================= */}
      <main className="flex-1 flex flex-col h-full bg-card min-w-0">
        {/* Chat Header */}
        <header className="h-12 border-b border-border px-4 flex items-center justify-between gap-3 bg-card/60 backdrop-blur-xs shrink-0">
          <div className="flex items-center gap-2.5 truncate">
            <button
              type="button"
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-hover transition-colors"
              title={isSidebarOpen ? "Fechar barra lateral" : "Abrir discussões"}
            >
              {isSidebarOpen ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </button>
            <div className="flex items-center gap-2 truncate">
              <span className="text-xs font-bold text-foreground truncate">
                {currentConversationId
                  ? conversations.find((c) => c.id === currentConversationId)?.title || "Discussão Ativa"
                  : "Nova Conversa Empresarial"}
              </span>
              <ModelSelectorDropdown
                selectedModelId={selectedModelId}
                isAutomatic={isAutomatic}
                onSelectModel={(modelId: string | null) => {
                  setSelectedModelId(modelId);
                  setIsAutomatic(!modelId);
                }}
              />
            </div>
          </div>

          <div className="flex items-center gap-2.5 text-xs text-muted-foreground">
            {/* Context Sources Button */}
            <button
              type="button"
              onClick={() => setIsSourcesModalOpen(true)}
              className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-lg border border-border bg-background hover:bg-hover text-foreground transition-colors cursor-pointer"
            >
              <Database className="h-3.5 w-3.5 text-blue-400" />
              <span>Fontes ({selectedSourceIds.length})</span>
            </button>

            <div className="hidden sm:flex items-center gap-1.5 font-medium">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              <span>{activeOrgName}</span>
            </div>
          </div>
        </header>

        {/* Messages Stream Container */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {messages.length === 0 && !streamingContent && (
            <div className="h-full flex flex-col items-center justify-center max-w-md mx-auto text-center space-y-4 py-12">
              <div className="h-12 w-12 rounded-2xl bg-blue-500/10 text-blue-500 flex items-center justify-center border border-blue-500/20">
                <PhosphorBrain className="h-6 w-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-foreground">Como posso ajudar a sua empresa?</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Consulte a memória organizacional, páginas, métricas de negócio e crie relatórios com blocos nativos.
                </p>
              </div>

              {/* Starter Prompt Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full pt-2">
                <button
                  type="button"
                  onClick={() => handleSend("Qual é a evolução das nossas métricas de faturação e MRR?")}
                  className="p-3 text-left rounded-xl border border-border bg-background/50 hover:bg-hover transition-colors text-xs space-y-1 cursor-pointer"
                >
                  <div className="flex items-center gap-1.5 font-semibold text-foreground">
                    <TrendingUp className="h-3.5 w-3.5 text-emerald-400" />
                    <span>Métricas de Negócio</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground line-clamp-2">
                    Analisar indicadores de subscrição e receitas Stripe.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => handleSend("Cria uma página sobre o plano de expansão comercial no Q4.")}
                  className="p-3 text-left rounded-xl border border-border bg-background/50 hover:bg-hover transition-colors text-xs space-y-1 cursor-pointer"
                >
                  <div className="flex items-center gap-1.5 font-semibold text-foreground">
                    <FileText className="h-3.5 w-3.5 text-blue-400" />
                    <span>Criar Documento</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground line-clamp-2">
                    Gerar rascunho com blocos nativos e antevisão.
                  </p>
                </button>
              </div>
            </div>
          )}

          {/* Historical Messages */}
          {messages.map((msg) => (
            <ChatMessageItem
              key={msg.id}
              message={msg}
              userName={userName}
              userAvatar={userAvatar}
            />
          ))}

          {/* Active Streaming Message */}
          {streamingContent && (
            <ChatMessageItem
              message={{
                id: "streaming-active",
                role: "assistant",
                content: streamingContent,
                sources: activeSources,
              }}
              userName={userName}
              userAvatar={userAvatar}
            />
          )}

          {/* Inline Interactive Authorization Card */}
          {activeChallenge && (
            <AuthorizationCard
              challenge={activeChallenge}
              onGrant={handleGrantChallenge}
              onDeny={handleDenyChallenge}
              isLoading={isStreaming}
            />
          )}

          {/* Inline Page Draft Preview Card (Phase 3A) */}
          {activeDraft && (
            <PageDraftPreview
              draft={activeDraft}
              onDismiss={() => setActiveDraft(null)}
            />
          )}

          {/* Error Banner */}
          {errorMessage && (
            <div className="p-3 rounded-xl border border-rose-500/20 bg-rose-500/10 text-rose-400 flex items-center gap-2 text-xs">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Textarea Bar */}
        <div className="p-4 border-t border-border bg-card/60 backdrop-blur-xs">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="relative flex items-end gap-2 bg-background rounded-2xl border border-border p-2 focus-within:border-primary/50 focus-within:ring-1 focus-within:ring-primary/20 transition-all"
          >
            <textarea
              ref={textareaRef}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="Faça uma pergunta sobre a empresa ou peça para criar uma página..."
              rows={1}
              className="w-full resize-none bg-transparent px-2 py-1 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none max-h-32 min-h-[36px]"
            />

            <div className="flex items-center gap-1.5 shrink-0">
              {isStreaming ? (
                <button
                  type="button"
                  onClick={handleCancel}
                  className="p-2 rounded-xl bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors"
                  title="Parar resposta"
                >
                  <Square className="h-4 w-4" />
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={!prompt.trim()}
                  className="p-2 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40 transition-colors shadow-xs cursor-pointer"
                  title="Enviar mensagem"
                >
                  <Send className="h-4 w-4" />
                </button>
              )}
            </div>
          </form>
          <div className="flex items-center justify-between text-[10px] text-muted-foreground px-2 pt-2">
            <span>A IA consulta apenas as fontes autorizadas.</span>
            <span>Premir Enter para enviar • Shift + Enter para nova linha</span>
          </div>
        </div>
      </main>
    </div>
  );
}
