import { createClient } from "@/lib/supabase/server";
import { AIChatMessage, VerifiedSource, AIError } from "../types";
import { getAICreditQuota } from "../config";
import { logger } from "@/lib/security/logger";

export interface AIConversationRecord {
  id: string;
  organizationId: string;
  userId: string;
  title: string;
  provider: string;
  model: string;
  isByok: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AIMessageRecord {
  id: string;
  conversationId: string;
  organizationId: string;
  userId: string | null;
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  sources: VerifiedSource[];
  tokensPrompt: number;
  tokensCompletion: number;
  executionDurationMs: number | null;
  errorCode: string | null;
  createdAt: string;
}

export class AIChatService {
  /**
   * Creates a new conversation for a user in an organization.
   */
  static async createConversation(
    organizationId: string,
    userId: string,
    title = "Nova Discussão",
    provider = "gemini",
    model = "gemini-2.5-flash"
  ): Promise<AIConversationRecord> {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("ai_conversations")
      .insert({
        organization_id: organizationId,
        user_id: userId,
        title: title.slice(0, 200),
        provider,
        model,
      })
      .select()
      .single();

    if (error || !data) {
      logger.error("Failed to create AI conversation", error);
      throw new AIError("Failed to initialize conversation", "PROVIDER_ERROR", 500);
    }

    return {
      id: data.id,
      organizationId: data.organization_id,
      userId: data.user_id,
      title: data.title,
      provider: data.provider,
      model: data.model,
      isByok: data.is_byok,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  }

  /**
   * Lists conversations for a user in an organization.
   */
  static async listConversations(
    organizationId: string,
    userId: string
  ): Promise<AIConversationRecord[]> {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("ai_conversations")
      .select("id, organization_id, user_id, title, provider, model, is_byok, created_at, updated_at")
      .eq("organization_id", organizationId)
      .eq("user_id", userId)
      .order("updated_at", { ascending: false });

    if (error || !data) {
      return [];
    }

    return data.map((c) => ({
      id: c.id,
      organizationId: c.organization_id,
      userId: c.user_id,
      title: c.title,
      provider: c.provider,
      model: c.model,
      isByok: c.is_byok,
      createdAt: c.created_at,
      updatedAt: c.updated_at,
    }));
  }

  /**
   * Retrieves a conversation along with its chronological messages.
   */
  static async getConversationWithMessages(
    conversationId: string,
    organizationId: string,
    userId: string
  ): Promise<{ conversation: AIConversationRecord; messages: AIMessageRecord[] } | null> {
    const supabase = await createClient();

    const { data: conv, error: convErr } = await supabase
      .from("ai_conversations")
      .select()
      .eq("id", conversationId)
      .eq("organization_id", organizationId)
      .eq("user_id", userId)
      .maybeSingle();

    if (convErr || !conv) {
      return null;
    }

    const { data: msgs, error: msgsErr } = await supabase
      .from("ai_messages")
      .select()
      .eq("conversation_id", conversationId)
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: true });

    const messages: AIMessageRecord[] = (msgs || []).map((m) => ({
      id: m.id,
      conversationId: m.conversation_id,
      organizationId: m.organization_id,
      userId: m.user_id,
      role: m.role,
      content: m.content,
      sources: Array.isArray(m.sources) ? m.sources : [],
      tokensPrompt: m.tokens_prompt || 0,
      tokensCompletion: m.tokens_completion || 0,
      executionDurationMs: m.execution_duration_ms,
      errorCode: m.error_code,
      createdAt: m.created_at,
    }));

    return {
      conversation: {
        id: conv.id,
        organizationId: conv.organization_id,
        userId: conv.user_id,
        title: conv.title,
        provider: conv.provider,
        model: conv.model,
        isByok: conv.is_byok,
        createdAt: conv.created_at,
        updatedAt: conv.updated_at,
      },
      messages,
    };
  }

  /**
   * Appends an authorized message to the conversation.
   */
  static async appendMessage(params: {
    conversationId: string;
    organizationId: string;
    userId: string | null;
    role: "user" | "assistant" | "system" | "tool";
    content: string;
    sources?: VerifiedSource[];
    tokensPrompt?: number;
    tokensCompletion?: number;
    executionDurationMs?: number;
    errorCode?: string;
  }): Promise<string> {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("ai_messages")
      .insert({
        conversation_id: params.conversationId,
        organization_id: params.organizationId,
        user_id: params.userId,
        role: params.role,
        content: params.content,
        sources: params.sources || [],
        tokens_prompt: params.tokensPrompt || 0,
        tokens_completion: params.tokensCompletion || 0,
        execution_duration_ms: params.executionDurationMs,
        error_code: params.errorCode,
      })
      .select("id")
      .single();

    if (error || !data) {
      logger.error("Failed to append AI message", error);
      throw new AIError("Failed to persist message", "PROVIDER_ERROR", 500);
    }

    // Touch conversation updated_at
    await supabase
      .from("ai_conversations")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", params.conversationId);

    return data.id;
  }

  /**
   * Updates an existing message (e.g. on stream finish, error or cancellation).
   */
  static async updateMessage(
    messageId: string,
    params: {
      content?: string;
      tokensCompletion?: number;
      executionDurationMs?: number;
      errorCode?: string;
    }
  ): Promise<void> {
    const supabase = await createClient();

    const updates: Record<string, unknown> = {};
    if (params.content !== undefined) updates.content = params.content;
    if (params.tokensCompletion !== undefined) updates.tokens_completion = params.tokensCompletion;
    if (params.executionDurationMs !== undefined) updates.execution_duration_ms = params.executionDurationMs;
    if (params.errorCode !== undefined) updates.error_code = params.errorCode;

    await supabase.from("ai_messages").update(updates).eq("id", messageId);
  }

  /**
   * Records usage transaction into the audit ledger.
   */
  static async recordUsageLedger(params: {
    organizationId: string;
    userId: string | null;
    conversationId?: string;
    provider: string;
    model: string;
    isByok: boolean;
    promptTokens: number;
    completionTokens: number;
    estimatedCostUsd: number;
    status: "success" | "failed" | "canceled" | "rate_limited";
  }): Promise<void> {
    const supabase = await createClient();

    await supabase.from("ai_usage_ledger").insert({
      organization_id: params.organizationId,
      user_id: params.userId,
      conversation_id: params.conversationId,
      provider: params.provider,
      model: params.model,
      is_byok: params.isByok,
      prompt_tokens: params.promptTokens,
      completion_tokens: params.completionTokens,
      estimated_cost_usd: params.estimatedCostUsd,
      status: params.status,
    });
  }

  /**
   * Checks whether the organization has consumed its monthly credit quota.
   */
  static async checkOrganizationQuota(
    organizationId: string,
    tier: string
  ): Promise<{ exhausted: boolean; used: number; quota: number }> {
    const supabase = await createClient();
    const quota = getAICreditQuota(tier);

    // Sum prompt + completion tokens from the first day of current calendar month
    const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();

    const { data } = await supabase
      .from("ai_usage_ledger")
      .select("prompt_tokens, completion_tokens")
      .eq("organization_id", organizationId)
      .eq("status", "success")
      .gte("created_at", startOfMonth);

    let totalTokens = 0;
    if (data) {
      for (const row of data) {
        totalTokens += (row.prompt_tokens || 0) + (row.completion_tokens || 0);
      }
    }

    // Convert tokens to units of credits (1 credit = 1,000 tokens)
    const creditsUsed = Math.floor(totalTokens / 1000);

    return {
      exhausted: creditsUsed >= quota,
      used: creditsUsed,
      quota,
    };
  }

  /**
   * Deletes a conversation owned by the user.
   */
  static async deleteConversation(
    conversationId: string,
    organizationId: string,
    userId: string
  ): Promise<boolean> {
    const supabase = await createClient();

    const { error } = await supabase
      .from("ai_conversations")
      .delete()
      .eq("id", conversationId)
      .eq("organization_id", organizationId)
      .eq("user_id", userId);

    return !error;
  }
}
