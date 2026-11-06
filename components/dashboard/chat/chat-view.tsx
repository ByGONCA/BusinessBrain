"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Send,
  Square,
  Plus,
  Trash2,
  AlertCircle,
  MessageSquare,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  FileText,
  Brain,
  X,
  CreditCard,
  Users,
  DollarSign,
  Receipt,
  Github,
  GitPullRequest,
  GitCommit,
  Target,
  FolderGit2,
  CheckSquare,
  Mail,
  Calendar,
  ArrowRight,
  Zap,
} from "lucide-react";
import { useLanguage } from "@/lib/i18n";
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
import { ContextQuickPick } from "./context-quick-pick";
import { AccountLimitsModal } from "./account-limits-modal";
import { PageDraftPreview } from "./page-draft-preview";
import { AuthorizationChallenge, AIScopeType, ContextSourceItem } from "@/lib/ai/auth/types";
import { PageDraft } from "@/lib/ai/pages/types";
import {
  grantAIAuthorizationAction,
  saveConversationSourcesAction,
  getAvailableContextSourcesAction,
  getAccountAILimitsAction,
  AccountAILimitsData,
} from "@/lib/ai/auth/actions";
import { ModelSelectorDropdown } from "./model-selector-dropdown";

function CircularProgress({
  percentage,
  size = 14,
  strokeWidth = 2,
}: {
  percentage: number;
  size?: number;
  strokeWidth?: number;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  const colorClass =
    percentage >= 90
      ? "text-rose-400 stroke-rose-400"
      : percentage >= 75
      ? "text-amber-400 stroke-amber-400"
      : "text-emerald-400 stroke-emerald-400";

  return (
    <svg width={size} height={size} className="shrink-0 -rotate-90">
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        className="stroke-white/[0.12] fill-none"
        strokeWidth={strokeWidth}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        className={`${colorClass} fill-none transition-all duration-500`}
        strokeWidth={strokeWidth}
        strokeDasharray={circumference}
        strokeDashoffset={strokeDashoffset}
        strokeLinecap="round"
      />
    </svg>
  );
}

interface ChatViewProps {
  initialConversations?: AIConversationRecord[];
  activeOrgName?: string;
  userName?: string;
  userAvatar?: string | null;
  isPersonalWorkspace?: boolean;
}

const LOCALIZED_CHIP_NAMES: Record<string, string> = {
  "area:finance": "Financial Metrics",
  "finance:mrr": "MRR & ARR",
  "finance:subscriptions": "Subscriptions",
  "finance:revenue": "Net Revenue",
  "finance:customers": "Customers & LTV",
  "area:brain": "Decisions & Memory",
  "area:decisions": "Decisions & Memory",
  "brain:decisions": "Technical Decisions",
  "brain:meetings": "Meeting Minutes",
  "area:goals": "Strategic Goals",
  "area:projects": "Projects",
  "area:tasks": "Tasks",
  "area:github": "GitHub",
  "area:emails": "Emails",
  "area:calendar": "Calendar",
};

export function ChatView({
  initialConversations = [],
  userName,
  userAvatar,
  isPersonalWorkspace = false,
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
  const { locale } = useLanguage();
  const isPt = locale === "pt";
  const router = useRouter();

  // Resizable Sidebar States
  const [sidebarWidth, setSidebarWidth] = React.useState(260);
  const [isResizing, setIsResizing] = React.useState(false);
  const startXRef = React.useRef(0);
  const startWidthRef = React.useRef(260);

  const startResizing = React.useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    startXRef.current = e.clientX;
    startWidthRef.current = sidebarWidth;
    setIsResizing(true);
  }, [sidebarWidth]);

  React.useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - startXRef.current;
      const newWidth = Math.max(180, Math.min(480, startWidthRef.current + deltaX));
      setSidebarWidth(newWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isResizing]);

  // Strip 'area:pages' always: only concrete pages or specific areas are selectable
  const [selectedSourceIds, setSelectedSourceIds] = React.useState<string[]>([
    "area:brain",
  ]);
  const [availableSources, setAvailableSources] = React.useState<ContextSourceItem[]>([]);
  const [isQuickPickOpen, setIsQuickPickOpen] = React.useState(false);
  const [isSourcesModalOpen, setIsSourcesModalOpen] = React.useState(false);
  const [isLimitsModalOpen, setIsLimitsModalOpen] = React.useState(false);
  const [accountLimits, setAccountLimits] = React.useState<AccountAILimitsData | null>(null);
  const [activeChallenge, setActiveChallenge] = React.useState<AuthorizationChallenge | null>(null);
  const [activeDraft, setActiveDraft] = React.useState<PageDraft | null>(null);
  const [lastPrompt, setLastPrompt] = React.useState<string>("");
  const [selectedModelId, setSelectedModelId] = React.useState<string>("gemini-2.5-flash");
  const [credentialMode, setCredentialMode] = React.useState<"platform" | "byok">("platform");

  React.useEffect(() => {
    getAvailableContextSourcesAction().then((res) => {
      if (res.success && res.sources) {
        setAvailableSources(res.sources);
      }
    });

    getAccountAILimitsAction().then((res) => {
      if (res.success && res.limits) {
        setAccountLimits(res.limits);
      }
    });
  }, []);

  const monthlyUsagePercentage = React.useMemo(() => {
    if (!accountLimits || !accountLimits.monthlyQuota) return 0;
    return Math.min(100, Math.round((accountLimits.usedCredits / accountLimits.monthlyQuota) * 100));
  }, [accountLimits]);

  // Flatten all sources map for rapid lookup
  const sourcesMap = React.useMemo(() => {
    const map = new Map<string, ContextSourceItem>();
    const traverse = (list: ContextSourceItem[]) => {
      for (const item of list) {
        map.set(item.id, item);
        if (item.children && item.children.length > 0) {
          traverse(item.children);
        }
      }
    };
    traverse(availableSources);
    return map;
  }, [availableSources]);

  // Resolved active sources for inline chips (excluding area:pages)
  const resolvedSelectedSources = React.useMemo(() => {
    return selectedSourceIds
      .filter((id) => id !== "area:pages")
      .map((id) => {
        const found = sourcesMap.get(id);
        if (found) {
          const localized = !isPt && LOCALIZED_CHIP_NAMES[found.id] ? LOCALIZED_CHIP_NAMES[found.id] : found.label;
          return { ...found, label: localized };
        }

        if (id === "area:finance") return { id, label: isPt ? "Métricas Financeiras" : "Financial Metrics", type: "finance" as const, hasAccess: true, requiresExplicitGrant: true, category: "finance" as const };
        if (id === "finance:mrr") return { id, label: "MRR & ARR", type: "finance" as const, hasAccess: true, requiresExplicitGrant: true, category: "finance" as const };
        if (id === "finance:subscriptions") return { id, label: isPt ? "Subscrições" : "Subscriptions", type: "finance" as const, hasAccess: true, requiresExplicitGrant: true, category: "finance" as const };
        if (id === "finance:revenue") return { id, label: isPt ? "Receita Líquida" : "Net Revenue", type: "finance" as const, hasAccess: true, requiresExplicitGrant: true, category: "finance" as const };
        if (id === "finance:customers") return { id, label: isPt ? "Clientes & LTV" : "Customers & LTV", type: "finance" as const, hasAccess: true, requiresExplicitGrant: true, category: "finance" as const };
        if (id === "area:brain" || id === "area:decisions") return { id, label: isPt ? "Decisões & Memória" : "Decisions & Memory", type: "brain" as const, hasAccess: true, requiresExplicitGrant: false, category: "workspace_areas" as const };
        if (id === "brain:decisions") return { id, label: isPt ? "Decisões Técnicas" : "Technical Decisions", type: "brain" as const, hasAccess: true, requiresExplicitGrant: false, category: "workspace_areas" as const };
        if (id === "brain:meetings") return { id, label: isPt ? "Atas de Reunião" : "Meeting Minutes", type: "brain" as const, hasAccess: true, requiresExplicitGrant: false, category: "workspace_areas" as const };
        if (id === "area:goals") return { id, label: isPt ? "Metas Estratégicas" : "Strategic Goals", type: "area" as const, hasAccess: true, requiresExplicitGrant: false, category: "workspace_areas" as const };
        if (id === "area:projects") return { id, label: isPt ? "Projetos" : "Projects", type: "area" as const, hasAccess: true, requiresExplicitGrant: false, category: "workspace_areas" as const };
        if (id === "area:tasks") return { id, label: isPt ? "Tarefas" : "Tasks", type: "area" as const, hasAccess: true, requiresExplicitGrant: false, category: "workspace_areas" as const };
        if (id === "area:github") return { id, label: "GitHub", type: "github" as const, hasAccess: true, requiresExplicitGrant: true, category: "external" as const };
        if (id.startsWith("page:")) return { id, label: isPt ? "Página" : "Page", type: "page" as const, hasAccess: true, requiresExplicitGrant: false, category: "pages" as const };

        return { id, label: id, type: "document" as const, hasAccess: true, requiresExplicitGrant: false, category: "pages" as const };
      });
  }, [selectedSourceIds, sourcesMap, isPt]);

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
        setErrorMessage(res.error || (isPt ? "Erro ao carregar histórico." : "Failed to load conversation history."));
      }
    } catch {
      setErrorMessage(isPt ? "Falha de rede ao carregar conversa." : "Network error loading conversation.");
    }
  }, [isPt]);

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
    const confirmed = confirm(
      isPt
        ? "Tem a certeza que deseja eliminar esta discussão?"
        : "Are you sure you want to delete this discussion?"
    );
    if (!confirmed) return;

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

  // Apply context sources change (strictly exclude area:pages)
  const handleApplySources = (newIds: string[]) => {
    const cleanIds = newIds.filter((id) => id !== "area:pages");
    setSelectedSourceIds(cleanIds);
    if (currentConversationId) {
      saveConversationSourcesAction(currentConversationId, cleanIds);
    }
  };

  const handleNavigateToSource = (item: { id: string }) => {
    if (item.id.startsWith("page:")) {
      router.push(`/dashboard/pages/${item.id.slice(5)}`);
    } else if (item.id === "area:pages") {
      router.push("/dashboard/pages");
    } else if (item.id.startsWith("finance:") || item.id === "area:finance") {
      router.push("/dashboard/billing");
    } else if (item.id.startsWith("brain:") || item.id === "area:brain" || item.id.includes("decision")) {
      router.push("/dashboard/decisions");
    } else if (item.id.startsWith("goal:") || item.id === "area:goals") {
      router.push("/dashboard/goals");
    } else if (item.id.startsWith("project:") || item.id === "area:projects") {
      router.push("/dashboard/projects");
    } else if (item.id.startsWith("task:") || item.id === "area:tasks") {
      router.push("/dashboard/tasks");
    } else if (item.id.startsWith("github:") || item.id === "area:github") {
      router.push("/dashboard/settings");
    } else if (item.id.startsWith("email:") || item.id === "area:emails") {
      router.push("/dashboard/email");
    } else if (item.id.startsWith("calendar:") || item.id === "area:calendar") {
      router.push("/dashboard/calendar");
    }
  };

  const handleRemoveSource = (id: string) => {
    const next = selectedSourceIds.filter((item) => item !== id);
    handleApplySources(next);
  };

  const handleToggleSource = (id: string) => {
    if (id === "area:pages") return; // Never add area:pages directly
    let next: string[];
    if (selectedSourceIds.includes(id)) {
      next = selectedSourceIds.filter((item) => item !== id);
    } else {
      next = [...selectedSourceIds, id];
    }
    handleApplySources(next);
  };

  const handleClearSources = () => {
    handleApplySources([]);
  };

  const getSourceChipIcon = (type: string, id: string, iconString?: string) => {
    if (iconString && iconString.trim() !== "" && iconString.length <= 4) {
      return <span className="text-xs shrink-0 leading-none">{iconString}</span>;
    }
    if (id === "finance:mrr") return <TrendingUp className="h-3 w-3 text-emerald-400 shrink-0" />;
    if (id === "finance:subscriptions") return <Users className="h-3 w-3 text-blue-400 shrink-0" />;
    if (id === "finance:revenue") return <DollarSign className="h-3 w-3 text-emerald-400 shrink-0" />;
    if (id === "finance:customers") return <Receipt className="h-3 w-3 text-amber-400 shrink-0" />;
    if (id.includes("finance")) return <CreditCard className="h-3 w-3 text-emerald-400 shrink-0" />;
    if (id === "github:prs") return <GitPullRequest className="h-3 w-3 text-purple-400 shrink-0" />;
    if (id === "github:commits") return <GitCommit className="h-3 w-3 text-purple-400 shrink-0" />;
    if (id.includes("github")) return <Github className="h-3 w-3 text-purple-400 shrink-0" />;
    if (id.includes("email") || type === "email") return <Mail className="h-3 w-3 text-sky-400 shrink-0" />;
    if (id.includes("calendar") || type === "calendar") return <Calendar className="h-3 w-3 text-amber-400 shrink-0" />;
    if (id.includes("brain") || type === "brain") return <Brain className="h-3 w-3 text-blue-400 shrink-0" />;
    if (id.includes("goal") || type === "goal") return <Target className="h-3 w-3 text-emerald-400 shrink-0" />;
    if (id.includes("project") || type === "project") return <FolderGit2 className="h-3 w-3 text-indigo-400 shrink-0" />;
    if (id.includes("task") || type === "task") return <CheckSquare className="h-3 w-3 text-blue-400 shrink-0" />;
    return <FileText className="h-3 w-3 text-zinc-400 shrink-0" />;
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
          selectedSourceIds: selectedSourceIds.filter((id) => id !== "area:pages"),
          authorizationGrant: authorizationGrantPayload,
          model: selectedModelId,
          selectionMode: "preferred",
          credentialMode,
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || (isPt ? `Erro HTTP ${res.status}` : `HTTP Error ${res.status}`));
      }

      if (!res.body) throw new Error(isPt ? "Resposta sem corpo de streaming." : "Response without streaming body.");

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
              getAccountAILimitsAction().then((r) => {
                if (r.success && r.limits) setAccountLimits(r.limits);
              });
            } else if (event.type === "error") {
              setErrorMessage(event.error || (isPt ? "Erro durante o streaming da resposta." : "Error while streaming response."));
            }
          } catch {
            // Partial chunk parsing error, wait for next buffer
          }
        }
      }
    } catch (err: any) {
      if (err.name !== "AbortError") {
        setErrorMessage(err.message || (isPt ? "Erro na comunicação com o servidor de IA." : "Failed to communicate with AI server."));
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
      content: isPt
        ? "O acesso à fonte solicitada não foi autorizado. A resposta foi cancelada para proteger os dados restritos da empresa."
        : "Access to the requested source was not authorized. The response was cancelled to protect restricted company data.",
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
    <div className="flex h-full w-full overflow-hidden bg-background text-foreground text-left">
      {/* ================= CONTEXT SOURCES MODAL ================= */}
      <ContextSourcesModal
        isOpen={isSourcesModalOpen}
        onClose={() => setIsSourcesModalOpen(false)}
        selectedSourceIds={selectedSourceIds}
        onApplySources={handleApplySources}
      />

      {/* ================= ACCOUNT LIMITS MODAL ================= */}
      <AccountLimitsModal
        isOpen={isLimitsModalOpen}
        onClose={() => setIsLimitsModalOpen(false)}
        initialLimits={accountLimits}
      />

      {/* ================= LEFT SIDEBAR (CONVERSATIONS) ================= */}
      <aside
        style={{ width: isSidebarOpen ? `${sidebarWidth}px` : 0 }}
        className="transition-none border-r border-border-subtle bg-background flex flex-col shrink-0 overflow-hidden relative"
      >
        <div className="p-3 border-b border-border-subtle flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={handleNewConversation}
            className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium rounded-xl bg-surface-secondary hover:bg-hover text-zinc-200 hover:text-white border border-border hover:border-border-strong transition-colors shadow-xs cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>{isPt ? "Nova Conversa" : "New Conversation"}</span>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
          {conversations.length === 0 ? (
            <div className="p-4 text-center text-xs text-muted-foreground">
              {isPt ? "Sem conversas anteriores." : "No previous conversations."}
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
                      ? "bg-white/[0.08] text-foreground font-semibold"
                      : "text-muted-foreground hover:bg-surface-secondary hover:text-foreground"
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
                    title={isPt ? "Eliminar conversa" : "Delete conversation"}
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              );
            })
          )}
        </div>
      </aside>

      {/* Resizable drag divider */}
      {isSidebarOpen && (
        <div
          onMouseDown={startResizing}
          className="w-1 hover:w-1.5 hover:bg-white/20 active:bg-white/40 cursor-col-resize shrink-0 transition-all z-20 relative group bg-surface-secondary"
          title={isPt ? "Arrastar para redimensionar" : "Drag to resize sidebar"}
        >
          <div className="absolute inset-y-0 -left-1 -right-1" />
        </div>
      )}

      {/* ================= MAIN CHAT AREA ================= */}
      <main className="flex-1 flex flex-col h-full bg-background min-w-0">
        {/* Chat Header */}
        <header className="h-11 border-b border-border-subtle px-4 flex items-center justify-between gap-3 bg-background shrink-0">
          <div className="flex items-center gap-2.5 truncate">
            <button
              type="button"
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-white/[0.05] transition-colors"
              title={isSidebarOpen ? (isPt ? "Fechar barra lateral" : "Close sidebar") : (isPt ? "Abrir conversas" : "Open conversations")}
            >
              {isSidebarOpen ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </button>
            <span className="text-xs font-bold text-foreground truncate">
              {currentConversationId
                ? conversations.find((c) => c.id === currentConversationId)?.title || (isPt ? "Conversa Ativa" : "Active Conversation")
                : isPersonalWorkspace
                ? (isPt ? "Nova Conversa Pessoal" : "New Personal Conversation")
                : (isPt ? "Nova Conversa Empresarial" : "New Enterprise Conversation")}
            </span>
          </div>
        </header>

        {/* Messages Stream Container */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
          {messages.length === 0 && !streamingContent && (
            <div className="h-full flex flex-col items-center justify-center max-w-md mx-auto text-center space-y-4 py-8">
              <div className="space-y-1">
                <h3 className="text-base font-bold text-foreground">
                  {isPersonalWorkspace
                    ? (isPt ? "Como posso ajudar no seu dia a dia?" : "How can I help you today?")
                    : (isPt ? "Como posso ajudar a sua empresa?" : "How can I help your business?")}
                </h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {isPersonalWorkspace
                    ? (isPt
                        ? "Converse em privado com a IA, organize notas individuais, execute chaves BYOK pessoais e analise dados com segurança."
                        : "Chat privately with AI, organize personal notes, run personal BYOK keys, and analyze data securely.")
                    : (isPt
                        ? "Consulte a memória organizacional, páginas, métricas de negócio e crie relatórios com blocos nativos."
                        : "Ask questions across company memory, pages, metrics, or draft new documents.")}
                </p>
              </div>

              {/* Starter Prompts in clean vertical list (prompts diretos prontos) */}
              <div className="flex flex-col gap-1.5 w-full max-w-md pt-2">
                {[
                  isPt ? "Qual é a evolução da receita e do MRR atual?" : "What is our current revenue run-rate and MRR growth?",
                  isPt ? "Quais são as tarefas e entregáveis prioritários desta semana?" : "What are the priority tasks and deliverables for this week?",
                  isPt ? "Resume as principais decisões estratégicas recentes." : "Summarize the latest strategic and architectural decisions.",
                  isPt ? "Cria um rascunho de página para o plano trimestral." : "Draft a new documentation page for the quarterly plan.",
                ].map((promptText, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSend(promptText)}
                    className="flex items-center gap-2.5 px-3.5 py-2 rounded-xl text-xs text-muted-foreground hover:text-foreground hover:bg-surface-secondary border border-border-subtle hover:border-border-strong transition-all text-left cursor-pointer group"
                  >
                    <ArrowRight className="h-3 w-3 opacity-40 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all text-primary shrink-0" />
                    <span className="truncate">{promptText}</span>
                  </button>
                ))}
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

          {/* Inline Page Draft Preview Card */}
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
        <div className="p-3 sm:p-4 border-t border-border bg-surface-secondary/30 backdrop-blur-xs space-y-2">
          {/* VS Code Style Context Bar (Horizontal Line) */}
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            {/* Horizontal Chips of Selected Context Sources */}
            <div className="flex flex-wrap items-center gap-1.5 min-w-0">
              {resolvedSelectedSources.map((item) => (
                <div
                  key={item.id}
                  className="group inline-flex items-center gap-1.5 pl-2 pr-1 py-1 text-xs rounded-lg border border border-border bg-surface-secondary text-foreground hover:border-white/[0.15] hover:bg-white/[0.05] transition-all text-foreground shrink-0 shadow-2xs"
                >
                  <button
                    type="button"
                    onClick={() => handleNavigateToSource(item)}
                    className="flex items-center gap-1.5 hover:underline cursor-pointer truncate max-w-[170px]"
                    title={isPt ? `Abrir ${item.label}` : `Open ${item.label}`}
                  >
                    {getSourceChipIcon(item.type, item.id, item.icon)}
                    <span className="truncate text-xs font-medium">{item.label}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRemoveSource(item.id)}
                    className="p-0.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-white/[0.08] transition-colors cursor-pointer"
                    title={isPt ? "Remover fonte do contexto" : "Remove source from context"}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}

              {/* Add Context Button: Single '+' button as requested */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsQuickPickOpen((prev) => !prev)}
                  className={`inline-flex items-center justify-center h-6 w-6 rounded-lg border transition-all cursor-pointer ${
                    isQuickPickOpen
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-dashed border-white/[0.15] bg-surface-secondary/50 hover:bg-hover hover:border-white/[0.3] text-muted-foreground hover:text-foreground"
                  }`}
                  title={isPt ? "Adicionar contexto" : "Add context"}
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>

                {/* Floating Quick Pick Dropdown */}
                {isQuickPickOpen && (
                  <ContextQuickPick
                    isOpen={isQuickPickOpen}
                    onClose={() => setIsQuickPickOpen(false)}
                    sources={availableSources}
                    selectedSourceIds={selectedSourceIds}
                    onToggleSource={handleToggleSource}
                  />
                )}
              </div>

              {/* Clear all if more than 2 */}
              {selectedSourceIds.length > 2 && (
                <button
                  type="button"
                  onClick={handleClearSources}
                  className="text-[11px] text-muted-foreground hover:text-rose-400 transition-colors px-1.5 py-0.5 ml-auto cursor-pointer"
                >
                  {isPt ? "Limpar todas" : "Clear all"}
                </button>
              )}
            </div>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="relative flex items-end gap-2 bg-card rounded-2xl border border-border focus-within:border-border-strong focus-within:ring-1 focus-within:ring-primary/20 p-2 transition-all"
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
              placeholder={
                isPt
                  ? "Faça uma pergunta sobre a empresa ou peça para criar uma página..."
                  : "Ask a question about your business or request to draft a page..."
              }
              rows={1}
              className="w-full resize-none bg-transparent px-2 py-1 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none max-h-32 min-h-[36px]"
            />

            <div className="flex items-center gap-1.5 shrink-0">
              {isStreaming ? (
                <button
                  type="button"
                  onClick={handleCancel}
                  className="p-2 rounded-xl bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors"
                  title={isPt ? "Parar resposta" : "Stop response"}
                >
                  <Square className="h-4 w-4" />
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={!prompt.trim()}
                  className="p-2 rounded-xl bg-surface-secondary hover:bg-hover text-zinc-200 hover:text-white border border-border hover:border-border-strong disabled:opacity-30 disabled:hover:bg-surface-secondary disabled:hover:text-zinc-200 transition-colors shadow-xs cursor-pointer"
                  title={isPt ? "Enviar mensagem" : "Send message"}
                >
                  <Send className="h-4 w-4" />
                </button>
              )}
            </div>
          </form>
          <div className="flex items-center justify-between text-[10px] text-muted-foreground px-1 pt-1.5">
            <span>
              {isPt
                ? "A IA consulta apenas as fontes autorizadas."
                : "AI references authorized context sources only."}
            </span>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => setIsLimitsModalOpen(true)}
                className="flex items-center gap-1.5 rounded-lg border border border-border bg-surface-secondary hover:bg-hover text-foreground px-2 py-1 text-xs text-zinc-300 transition-colors hover:bg-surface-secondary hover:border-border-strong hover:text-zinc-100 cursor-pointer shadow-2xs group"
                title={
                  isPt
                    ? `Quota mensal de IA: ${monthlyUsagePercentage}% utilizada. Clique para ver mais detalhes.`
                    : `Monthly AI quota: ${monthlyUsagePercentage}% used. Click to view more details.`
                }
              >
                <CircularProgress percentage={monthlyUsagePercentage} size={14} strokeWidth={2.2} />
                <span className="font-mono text-[11px] font-medium text-zinc-300 group-hover:text-zinc-100">
                  {monthlyUsagePercentage}%
                </span>
              </button>
              <ModelSelectorDropdown
                selectedModelId={selectedModelId}
                dropDirection="up"
                align="right"
                onSelectModel={(modelId: string) => {
                  setSelectedModelId(modelId);
                }}
                onOpenLimits={() => setIsLimitsModalOpen(true)}
              />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
