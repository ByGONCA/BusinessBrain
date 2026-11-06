import { createClient } from "@/lib/supabase/server";
import { hasPermission } from "@/lib/permissions/resolver";
import { isValidUuid } from "@/lib/security/authorization";
import { logger } from "@/lib/security/logger";
import { AIError } from "../types";
import {
  AIAccessAuthorization,
  AIScopeType,
  AIResourceType,
  AIActionType,
  AuthorizationChallenge,
  ContextSourceItem,
  GrantAuthorizationParams,
} from "./types";

export class AIAuthorizationService {
  /**
   * Validates whether the acting user has underlying human permissions for a requested resource.
   * INVARIANT: The AI can never acquire permissions superior to the authenticated user.
   */
  /**
   * Normalizes resource identifiers (e.g. 'area:finance' -> 'finance', 'page:<uuid>' -> '<uuid>').
   */
  public static normalizeResourceId(resourceId: string): string {
    if (!resourceId) return "";
    return resourceId.replace(/^area:/i, "").replace(/^page:/i, "").trim().toLowerCase();
  }

  /**
   * Validates whether the acting user has underlying human permissions for a requested resource.
   * INVARIANT: The AI can never acquire permissions superior to the authenticated user.
   * FAIL-CLOSED: Any unrecognized resource or unhandled action type is strictly rejected.
   */
  static async validateUserBasePermission(
    userId: string,
    organizationId: string,
    resourceType: AIResourceType,
    resourceId: string,
    actionType: AIActionType,
    injectedClient?: any
  ): Promise<{ allowed: boolean; reason?: string }> {
    if (!isValidUuid(userId) || !isValidUuid(organizationId)) {
      return { allowed: false, reason: "Identificadores de utilizador ou organização inválidos." };
    }

    let supabase = injectedClient;
    if (!supabase) {
      try {
        supabase = await createClient();
      } catch (err) {
        if (process.env.NODE_ENV === "test") {
          return { allowed: false, reason: "Ambiente de teste sem contexto de requisição HTTP." };
        }
        throw err;
      }
    }

    const { data: member } = await supabase
      .from("organization_members")
      .select("role")
      .eq("organization_id", organizationId)
      .eq("user_id", userId)
      .maybeSingle();

    if (!member) {
      return { allowed: false, reason: "O utilizador não é membro da organização ativa." };
    }

    const isOwnerOrAdmin = member.role === "owner" || member.role === "admin";
    const normId = this.normalizeResourceId(resourceId);

    // 0. Explicit Tool Execution Check
    if (actionType === "execute") {
      return { allowed: false, reason: "Execução autónoma de ferramentas requer confirmação humana explícita." };
    }

    // 1. Finance / Stripe
    if (resourceType === "finance" || normId === "finance" || normId === "stripe") {
      const canView = isOwnerOrAdmin || (await hasPermission(userId, organizationId, "billing.view"));
      if (!canView) {
        return { allowed: false, reason: "Não possui permissão de leitura financeira (billing.view)." };
      }
      if (actionType !== "read") {
        return { allowed: false, reason: "Operações de alteração ou execução financeira estão estritamente bloqueadas." };
      }
      return { allowed: true };
    }

    // 2. Pages & Documents
    if (resourceType === "page" || normId === "pages" || isValidUuid(normId)) {
      const canView = isOwnerOrAdmin || (await hasPermission(userId, organizationId, "pages.view"));
      if (!canView) {
        return { allowed: false, reason: "Não possui permissão de leitura de páginas (pages.view)." };
      }
      if (actionType === "create") {
        const canCreate = isOwnerOrAdmin || (await hasPermission(userId, organizationId, "pages.create"));
        const canAiCreate = isOwnerOrAdmin || (await hasPermission(userId, organizationId, "ai.create_pages"));
        if (!canCreate || !canAiCreate) {
          return { allowed: false, reason: "Não possui permissão para criar páginas com IA (pages.create, ai.create_pages)." };
        }
      } else if (actionType === "modify") {
        const canEdit = isOwnerOrAdmin || (await hasPermission(userId, organizationId, "pages.edit"));
        if (!canEdit) {
          return { allowed: false, reason: "Não possui permissão de edição de páginas (pages.edit)." };
        }
      }
      return { allowed: true };
    }

    // 3. GitHub & External Discussions
    if (resourceType === "github" || normId === "github") {
      const canView = isOwnerOrAdmin || (await hasPermission(userId, organizationId, "github.view"));
      if (!canView) {
        return { allowed: false, reason: "Não possui permissão para aceder à integração GitHub (github.view)." };
      }
      if (actionType !== "read") {
        return { allowed: false, reason: "Operações de escrita na integração GitHub estão bloqueadas." };
      }
      return { allowed: true };
    }

    // 4. Organizational Brain & Decisions
    if (resourceType === "brain" || normId === "brain") {
      const canView = isOwnerOrAdmin || (await hasPermission(userId, organizationId, "brain.view"));
      if (!canView) {
        return { allowed: false, reason: "Não possui permissão para aceder à memória e decisões (brain.view)." };
      }
      if (actionType !== "read") {
        return { allowed: false, reason: "Operações de alteração da memória organizacional requerem confirmação de administrador." };
      }
      return { allowed: true };
    }

    // FAIL-CLOSED DEFAULT: Deny any unrecognized resource or action
    return { allowed: false, reason: "Recurso ou operação não autorizada pelas políticas de segurança do sistema." };
  }

  /**
   * Checks if an active, valid authorization exists for the requested resource and scope.
   */
  static async hasActiveAuthorization(
    userId: string,
    organizationId: string,
    resourceType: AIResourceType,
    resourceId: string,
    actionType: AIActionType,
    conversationId?: string | null,
    injectedClient?: any
  ): Promise<boolean> {
    let supabase = injectedClient;
    if (!supabase) {
      try {
        supabase = await createClient();
      } catch (err) {
        if (process.env.NODE_ENV === "test") return false;
        throw err;
      }
    }

    // 1. First re-verify user's base permissions (authorizations cannot outlive base rights)
    const baseCheck = await this.validateUserBasePermission(
      userId,
      organizationId,
      resourceType,
      resourceId,
      actionType,
      supabase
    );
    if (!baseCheck.allowed) {
      return false;
    }

    const normId = this.normalizeResourceId(resourceId);

    // 2. Query ai_access_authorizations matching normalized resource identifiers
    const query = supabase
      .from("ai_access_authorizations")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("user_id", userId)
      .in("resource_id", [normId, `area:${normId}`, `page:${normId}`])
      .eq("action_type", actionType)
      .eq("status", "active");

    const { data: grants, error } = await query;
    if (error || !grants || grants.length === 0) {
      return false;
    }

    const now = new Date();

    for (const grant of grants) {
      // Check expiration
      if (grant.expires_at && new Date(grant.expires_at) < now) {
        // Expired grant - mark it in database
        await supabase
          .from("ai_access_authorizations")
          .update({ status: "expired" })
          .eq("id", grant.id);
        continue;
      }

      // Check scope validity
      if (grant.scope_type === "persistent") {
        return true;
      }

      if (grant.scope_type === "conversation") {
        if (conversationId && grant.conversation_id === conversationId) {
          return true;
        }
      }

      if (grant.scope_type === "once") {
        // One-time grants are valid if not expired
        return true;
      }
    }

    return false;
  }

  /**
   * Grants an authorization explicitly requested by the user.
   */
  static async grantAuthorization(
    params: GrantAuthorizationParams,
    injectedClient?: any
  ): Promise<AIAccessAuthorization> {
    let supabase = injectedClient;
    if (!supabase) {
      try {
        supabase = await createClient();
      } catch (err) {
        if (process.env.NODE_ENV === "test") {
          throw new AIError("Ambiente de teste sem cliente Supabase fornecido.", "INVALID_REQUEST", 400);
        }
        throw err;
      }
    }

    // 1. Verify user base permission
    const baseCheck = await this.validateUserBasePermission(
      params.userId,
      params.organizationId,
      params.resourceType,
      params.resourceId,
      params.actionType,
      supabase
    );

    if (!baseCheck.allowed) {
      throw new AIError(
        baseCheck.reason || "Não pode conceder permissões à IA que não possui.",
        "FORBIDDEN",
        403
      );
    }

    // 2. Validate scope requirements
    if (params.scopeType === "conversation" && (!params.conversationId || params.conversationId.trim().length === 0)) {
      throw new AIError(
        "Autorização com âmbito de conversa requer um identificador de conversa válido.",
        "INVALID_REQUEST",
        400
      );
    }

    // 3. Compute expiration
    let expiresAt: string | null = null;
    if (params.scopeType === "once") {
      const validSeconds = Math.max(10, Math.min(params.expiresInSeconds || 600, 86400));
      expiresAt = new Date(Date.now() + validSeconds * 1000).toISOString();
    }

    const normId = this.normalizeResourceId(params.resourceId);

    // 4. Insert record
    const { data, error } = await supabase
      .from("ai_access_authorizations")
      .insert({
        organization_id: params.organizationId,
        user_id: params.userId,
        granted_by_user_id: params.userId,
        scope_type: params.scopeType,
        conversation_id: params.conversationId || null,
        resource_type: params.resourceType,
        resource_id: normId,
        action_type: params.actionType,
        purpose: params.purpose || "chat_context",
        status: "active",
        expires_at: expiresAt,
      })
      .select()
      .single();

    if (error || !data) {
      logger.error("Failed to persist AI access authorization", error);
      throw new AIError("Falha ao gravar autorização de acesso da IA.", "PROVIDER_ERROR", 500);
    }

    return {
      id: data.id,
      organizationId: data.organization_id,
      userId: data.user_id,
      grantedByUserId: data.granted_by_user_id,
      scopeType: data.scope_type as AIScopeType,
      conversationId: data.conversation_id,
      resourceType: data.resource_type as AIResourceType,
      resourceId: data.resource_id,
      actionType: data.action_type as AIActionType,
      purpose: data.purpose,
      status: data.status,
      expiresAt: data.expires_at,
      createdAt: data.created_at,
      revokedAt: data.revoked_at,
      revokedByUserId: data.revoked_by_user_id,
    };
  }

  /**
   * Revokes an existing authorization immediately.
   */
  static async revokeAuthorization(
    authId: string,
    actingUserId: string,
    organizationId: string,
    injectedClient?: any
  ): Promise<boolean> {
    if (!isValidUuid(authId)) {
      throw new AIError("Identificador de autorização inválido.", "INVALID_REQUEST", 400);
    }

    let supabase = injectedClient;
    if (!supabase) {
      try {
        supabase = await createClient();
      } catch (err) {
        if (process.env.NODE_ENV === "test") return false;
        throw err;
      }
    }

    const { error } = await supabase
      .from("ai_access_authorizations")
      .update({
        status: "revoked",
        revoked_at: new Date().toISOString(),
        revoked_by_user_id: actingUserId,
      })
      .eq("id", authId)
      .eq("organization_id", organizationId);

    if (error) {
      logger.error("Failed to revoke AI authorization", error);
      return false;
    }

    return true;
  }

  /**
   * Lists all active authorizations for a user/organization.
   */
  static async listActiveAuthorizations(
    userId: string,
    organizationId: string
  ): Promise<AIAccessAuthorization[]> {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("ai_access_authorizations")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("user_id", userId)
      .eq("status", "active")
      .order("created_at", { ascending: false });

    if (error || !data) {
      return [];
    }

    return data.map((d) => ({
      id: d.id,
      organizationId: d.organization_id,
      userId: d.user_id,
      grantedByUserId: d.granted_by_user_id,
      scopeType: d.scope_type as AIScopeType,
      conversationId: d.conversation_id,
      resourceType: d.resource_type as AIResourceType,
      resourceId: d.resource_id,
      actionType: d.action_type as AIActionType,
      purpose: d.purpose,
      status: d.status,
      expiresAt: d.expires_at,
      createdAt: d.created_at,
      revokedAt: d.revoked_at,
      revokedByUserId: d.revoked_by_user_id,
    }));
  }

  /**
   * Returns the available context sources tree for the user's workspace.
   */
  static async getAvailableContextSources(
    userId: string,
    organizationId: string
  ): Promise<ContextSourceItem[]> {
    const supabase = await createClient();

    // 1. Resolve base permissions
    const { data: member } = await supabase
      .from("organization_members")
      .select("role")
      .eq("organization_id", organizationId)
      .eq("user_id", userId)
      .maybeSingle();

    const isOwnerOrAdmin = member?.role === "owner" || member?.role === "admin";
    const [canViewPages, canViewBilling, canViewGithub, canViewBrain, canViewGoals, canViewProjects, canViewTasks] = await Promise.all([
      isOwnerOrAdmin || hasPermission(userId, organizationId, "pages.view"),
      isOwnerOrAdmin || hasPermission(userId, organizationId, "billing.view"),
      isOwnerOrAdmin || hasPermission(userId, organizationId, "github.view"),
      isOwnerOrAdmin || hasPermission(userId, organizationId, "brain.view"),
      isOwnerOrAdmin || hasPermission(userId, organizationId, "goals.view"),
      isOwnerOrAdmin || hasPermission(userId, organizationId, "projects.view"),
      isOwnerOrAdmin || hasPermission(userId, organizationId, "tasks.view"),
    ]);

    // 2. Fetch dynamic real entities from workspace (Projects, Tasks, Goals, Decisions)
    let projectsChildren: ContextSourceItem[] = [];
    let tasksChildren: ContextSourceItem[] = [];
    let goalsChildren: ContextSourceItem[] = [];
    let decisionsChildren: ContextSourceItem[] = [];

    try {
      const { data: entities } = await supabase
        .from("company_entities")
        .select("id, type, title, metadata")
        .eq("organization_id", organizationId)
        .order("updated_at", { ascending: false })
        .limit(40);

      if (entities && entities.length > 0) {
        for (const ent of entities) {
          const item: ContextSourceItem = {
            id: `entity:${ent.id}`,
            label: ent.title || "Entidade sem título",
            type: ent.type as any,
            category: "workspace_areas",
            hasAccess: true,
            requiresExplicitGrant: false,
            description: (ent.metadata as any)?.status ? `Estado: ${(ent.metadata as any).status}` : undefined,
          };

          if (ent.type === "project") {
            item.parentId = "area:projects";
            projectsChildren.push(item);
          } else if (ent.type === "task") {
            item.parentId = "area:tasks";
            tasksChildren.push(item);
          } else if (ent.type === "goal") {
            item.parentId = "area:goals";
            goalsChildren.push(item);
          } else if (ent.type === "decision") {
            item.parentId = "area:brain";
            decisionsChildren.push(item);
          }
        }
      }
    } catch (entErr) {
      logger.warn("Failed to load dynamic entities for context sources", { error: String(entErr) });
    }

    // Dynamic calendar events (In-memory, zero DB duplication)
    let calendarChildren: ContextSourceItem[] = [];
    try {
      const { data: calEvents } = await supabase
        .from("calendar_events")
        .select("id, title, start_time, end_time")
        .eq("organization_id", organizationId)
        .order("start_time", { ascending: true })
        .limit(10);

      if (calEvents && calEvents.length > 0) {
        calendarChildren = calEvents.map((evt) => ({
          id: `calendar:${evt.id}`,
          label: evt.title || "Evento de calendário",
          type: "calendar",
          category: "workspace_areas",
          description: evt.start_time ? new Date(evt.start_time).toLocaleString("pt-PT", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : undefined,
          hasAccess: true,
          requiresExplicitGrant: false,
          parentId: "area:calendar",
        }));
      }
    } catch (calErr) {
      logger.warn("Failed to load calendar events for context sources", { error: String(calErr) });
    }

    // Dynamic Ephemeral Emails (Zero DB persistence - on demand fetch)
    const emailChildren: ContextSourceItem[] = [
      {
        id: "email:recent_inbox",
        label: "Emails Recebidos Recentes",
        type: "email",
        category: "workspace_areas",
        description: "Últimas comunicações e threads sincronizadas via Gmail/Outlook.",
        hasAccess: true,
        requiresExplicitGrant: false,
        parentId: "area:emails",
      },
      {
        id: "email:billing_threads",
        label: "Emails Financeiros & Faturas",
        type: "email",
        category: "workspace_areas",
        description: "Comunicações de cobrança, recibos Stripe e notificações de fornecedores.",
        hasAccess: true,
        requiresExplicitGrant: false,
        parentId: "area:emails",
      },
      {
        id: "email:clients",
        label: "Comunicações com Clientes",
        type: "email",
        category: "workspace_areas",
        description: "Mensagens trocadas com contas empresariais e parceiros.",
        hasAccess: true,
        requiresExplicitGrant: false,
        parentId: "area:emails",
      },
    ];

    // Build hierarchical context sources
    const financeChildren: ContextSourceItem[] = [
      {
        id: "finance:mrr",
        label: "MRR & Run-Rate (ARR)",
        type: "finance",
        category: "finance",
        description: "Métricas de faturação recorrente mensal, projeção anualizada e crescimento.",
        hasAccess: canViewBilling,
        requiresExplicitGrant: true,
        parentId: "area:finance",
      },
      {
        id: "finance:subscriptions",
        label: "Subscrições & Churn",
        type: "finance",
        category: "finance",
        description: "Contagem de subscritores ativos, planos contratados e taxas de retenção.",
        hasAccess: canViewBilling,
        requiresExplicitGrant: true,
        parentId: "area:finance",
      },
      {
        id: "finance:revenue",
        label: "Receita Líquida & Volume Bruto",
        type: "finance",
        category: "finance",
        description: "Faturação liquidada do período e histórico financeiro Stripe.",
        hasAccess: canViewBilling,
        requiresExplicitGrant: true,
        parentId: "area:finance",
      },
      {
        id: "finance:customers",
        label: "Clientes & Retenção LTV",
        type: "finance",
        category: "finance",
        description: "Contratos ativos e métricas de fidelização de clientes.",
        hasAccess: canViewBilling,
        requiresExplicitGrant: true,
        parentId: "area:finance",
      },
    ];

    const brainChildren: ContextSourceItem[] = decisionsChildren.length > 0 ? decisionsChildren : [
      {
        id: "brain:decisions",
        label: "Decisões Técnicas & Arquiteturais",
        type: "brain",
        category: "workspace_areas",
        description: "Registos formais de escolhas de tecnologia, arquitetura e engenharia.",
        hasAccess: canViewBrain,
        requiresExplicitGrant: false,
        parentId: "area:brain",
      },
      {
        id: "brain:meetings",
        label: "Atas de Reunião & Alinhamentos",
        type: "brain",
        category: "workspace_areas",
        description: "Histórico de alinhamentos e notas estratégicas de liderança.",
        hasAccess: canViewBrain,
        requiresExplicitGrant: false,
        parentId: "area:brain",
      },
    ];

    const githubChildren: ContextSourceItem[] = [
      {
        id: "github:prs",
        label: "Pull Requests & Code Reviews",
        type: "github",
        category: "external",
        description: "Revisões de código e aprovações.",
        hasAccess: canViewGithub,
        requiresExplicitGrant: true,
        parentId: "area:github",
      },
      {
        id: "github:commits",
        label: "Commits & Histórico de Código",
        type: "github",
        category: "external",
        description: "Registo cronológico de commits nas branches do repositório.",
        hasAccess: canViewGithub,
        requiresExplicitGrant: true,
        parentId: "area:github",
      },
    ];

    // Fetch hierarchical pages if authorized
    let rootPageItems: ContextSourceItem[] = [];
    let totalPagesCount = 0;

    if (canViewPages) {
      try {
        const { data: pages } = await supabase
          .from("pages")
          .select("id, parent_page_id, title, icon, updated_at, position")
          .eq("organization_id", organizationId)
          .eq("is_archived", false)
          .order("position", { ascending: true })
          .order("created_at", { ascending: true });

        if (pages && pages.length > 0) {
          totalPagesCount = pages.length;
          const pageItemMap = new Map<string, ContextSourceItem>();

          pages.forEach((p) => {
            pageItemMap.set(p.id, {
              id: `page:${p.id}`,
              label: p.title && p.title.trim() !== "" ? p.title : "Página sem título",
              type: "page",
              category: "pages",
              icon: p.icon || "📄",
              hasAccess: true,
              requiresExplicitGrant: false,
              updatedAt: p.updated_at,
              parentId: p.parent_page_id ? `page:${p.parent_page_id}` : "area:pages",
              children: [],
            });
          });

          pages.forEach((p) => {
            const item = pageItemMap.get(p.id);
            if (!item) return;

            if (p.parent_page_id && pageItemMap.has(p.parent_page_id)) {
              const parentItem = pageItemMap.get(p.parent_page_id)!;
              if (!parentItem.children) parentItem.children = [];
              parentItem.children.push(item);
            } else {
              rootPageItems.push(item);
            }
          });
        }
      } catch (err) {
        logger.error("Failed to fetch pages for context source tree", err);
      }
    }

    const sources: ContextSourceItem[] = [
      {
        id: "area:pages",
        label: "Páginas & Documentos Gerais",
        type: "area",
        category: "workspace_areas",
        description: "Manuais de operação, documentação interna e notas de equipa.",
        hasAccess: canViewPages,
        requiresExplicitGrant: false,
        children: rootPageItems,
        itemCount: totalPagesCount,
      },
      {
        id: "area:emails",
        label: "Emails & Comunicações",
        type: "email",
        category: "workspace_areas",
        description: "Consultar emails sincronizados sob demanda via Gmail/Outlook.",
        hasAccess: true,
        requiresExplicitGrant: false,
        children: emailChildren,
        itemCount: emailChildren.length,
      },
      {
        id: "area:calendar",
        label: "Calendário & Reuniões",
        type: "calendar",
        category: "workspace_areas",
        description: "Marcações de agenda, reuniões e alinhamentos da organização.",
        hasAccess: true,
        requiresExplicitGrant: false,
        children: calendarChildren,
        itemCount: calendarChildren.length,
      },
      {
        id: "area:brain",
        label: "Decisões & Memória Organizacional",
        type: "brain",
        category: "workspace_areas",
        description: "Registo de decisões técnicas, atas e acordos estratégicos.",
        hasAccess: canViewBrain,
        requiresExplicitGrant: false,
        children: brainChildren,
        itemCount: brainChildren.length,
      },
      {
        id: "area:goals",
        label: "Objetivos & Metas Estratégicas",
        type: "area",
        category: "workspace_areas",
        description: "OKRs, metas e alinhamento de resultados estratégicos.",
        hasAccess: canViewGoals,
        requiresExplicitGrant: false,
        children: goalsChildren,
        itemCount: goalsChildren.length,
      },
      {
        id: "area:projects",
        label: "Projetos & Iniciativas",
        type: "area",
        category: "workspace_areas",
        description: "Iniciativas corporativas, equipas e acompanhamento de marcos.",
        hasAccess: canViewProjects,
        requiresExplicitGrant: false,
        children: projectsChildren,
        itemCount: projectsChildren.length,
      },
      {
        id: "area:tasks",
        label: "Tarefas & Entregáveis",
        type: "area",
        category: "workspace_areas",
        description: "Tarefas operacionais, entregáveis e planos de ação.",
        hasAccess: canViewTasks,
        requiresExplicitGrant: false,
        children: tasksChildren,
        itemCount: tasksChildren.length,
      },
      {
        id: "area:finance",
        label: "Métricas Financeiras & Stripe",
        type: "finance",
        category: "finance",
        description: "MRR, faturação liquidada, retenção de clientes e subscrições Stripe.",
        hasAccess: canViewBilling,
        requiresExplicitGrant: true, // Sensitive! Requires explicit grant
        children: financeChildren,
        itemCount: financeChildren.length,
      },
      {
        id: "area:github",
        label: "GitHub & Código do Repositório",
        type: "github",
        category: "external",
        description: "Pull requests e commits do repositório.",
        hasAccess: canViewGithub,
        requiresExplicitGrant: true,
        children: githubChildren,
        itemCount: githubChildren.length,
      },
    ];

    return sources;
  }
}
