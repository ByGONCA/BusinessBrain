"use server";

import { createClient } from "@/lib/supabase/server";
import { getActiveOrganization } from "@/lib/organizations/queries";
import { hasPermission } from "@/lib/permissions/resolver";
import { AIChatService, AIConversationRecord, AIMessageRecord } from "./service";
import { revalidatePath } from "next/cache";

export async function getConversationsAction(): Promise<{
  success: boolean;
  conversations?: AIConversationRecord[];
  error?: string;
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Unauthorized" };
  }

  const activeOrg = await getActiveOrganization();
  if (!activeOrg) {
    return { success: false, error: "No active organization" };
  }

  const list = await AIChatService.listConversations(activeOrg.id, user.id);
  return { success: true, conversations: list };
}

export async function getConversationDetailsAction(conversationId: string): Promise<{
  success: boolean;
  conversation?: AIConversationRecord;
  messages?: AIMessageRecord[];
  error?: string;
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Unauthorized" };
  }

  const activeOrg = await getActiveOrganization();
  if (!activeOrg) {
    return { success: false, error: "No active organization" };
  }

  const data = await AIChatService.getConversationWithMessages(conversationId, activeOrg.id, user.id);
  if (!data) {
    return { success: false, error: "Conversation not found or access denied" };
  }

  return { success: true, conversation: data.conversation, messages: data.messages };
}

export async function deleteConversationAction(conversationId: string): Promise<{
  success: boolean;
  error?: string;
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Unauthorized" };
  }

  const activeOrg = await getActiveOrganization();
  if (!activeOrg) {
    return { success: false, error: "No active organization" };
  }

  const deleted = await AIChatService.deleteConversation(conversationId, activeOrg.id, user.id);
  if (!deleted) {
    return { success: false, error: "Failed to delete conversation" };
  }

  revalidatePath("/dashboard/brain/chat");
  return { success: true };
}
