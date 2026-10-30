"use server";

import { createClient } from "@/lib/supabase/server";
import { getActiveOrganization } from "@/lib/organizations/queries";
import { hasPermission } from "@/lib/permissions/resolver";
import { rateLimit, RATE_LIMIT_PRESETS } from "@/lib/security/rate-limit";
import { logger } from "@/lib/security/logger";
import { createPageAction } from "@/lib/pages/actions";
import { AIPageGenerator } from "./generator";
import { PageDraft } from "./types";
import { verifyAIAccessEntitlement } from "@/lib/ai/auth/entitlement-guard";

export async function savePageDraftAction(draft: PageDraft): Promise<{
  pageId?: string;
  url?: string;
  error?: string;
  success: boolean;
}> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: "Unauthorized" };
    }

    const activeOrg = await getActiveOrganization();
    if (!activeOrg) {
      return { success: false, error: "No active workspace" };
    }

    // 0. Verify AI Access Entitlement (Paid or Active Trial Only)
    const entitlement = await verifyAIAccessEntitlement(activeOrg.id);
    if (!entitlement.allowed) {
      return {
        success: false,
        error: entitlement.message || "A criação de páginas com IA requer uma subscrição paga ativa.",
      };
    }

    const rl = await rateLimit("ai-page-save", user.id, RATE_LIMIT_PRESETS.MUTATIONS);
    if (!rl.success) {
      return { success: false, error: "Rate limit exceeded. Please wait a moment." };
    }

    // 1. Verify permissions
    const isOwnerOrAdmin = activeOrg.role === "owner" || activeOrg.role === "admin";
    const [canCreate, canAiCreate] = await Promise.all([
      isOwnerOrAdmin || hasPermission(user.id, activeOrg.id, "pages.create"),
      isOwnerOrAdmin || hasPermission(user.id, activeOrg.id, "ai.create_pages"),
    ]);

    if (!canCreate || !canAiCreate) {
      return {
        success: false,
        error: "Forbidden: Não possui permissão para criar páginas com IA (pages.create, ai.create_pages).",
      };
    }

    // 2. Validate blocks and structure
    const validated = AIPageGenerator.validateDraft(draft);

    // 3. Persist via canonical createPageAction
    const res = await createPageAction({
      title: validated.title,
      icon: validated.icon || "📄",
      parentPageId: validated.parentPageId,
      initialBlocks: validated.blocks,
    });

    if (!res.success || !res.page) {
      return { success: false, error: res.error || "Falha ao gravar página no workspace." };
    }

    return {
      success: true,
      pageId: res.page.id,
      url: `/dashboard/pages/${res.page.id}`,
    };
  } catch (err: any) {
    logger.error("Failed in savePageDraftAction", err);
    return { success: false, error: err.message || "Erro inesperado ao gravar página." };
  }
}
