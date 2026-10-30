import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getActiveOrganization } from "@/lib/organizations/queries";
import { AIChatService } from "@/lib/ai/chat/service";
import { ChatView } from "@/components/dashboard/chat/chat-view";

export const metadata = {
  title: "Chat Empresarial & Memória — BusinessBrain",
  description: "Conversação conectada com a memória institucional e grafo de conhecimento da empresa.",
};

export default async function BrainChatPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?redirectedFrom=/dashboard/brain/chat");
  }

  const activeOrg = await getActiveOrganization();
  if (!activeOrg) {
    redirect("/onboarding");
  }

  const initialConversations = await AIChatService.listConversations(activeOrg.id, user.id);

  const userName =
    user.user_metadata?.full_name ||
    user.user_metadata?.name ||
    user.email?.split("@")[0] ||
    "Você";

  const userAvatar = user.user_metadata?.avatar_url || null;

  return (
    <div className="space-y-4 max-w-7xl mx-auto h-full">
      <ChatView
        initialConversations={initialConversations}
        activeOrgName={activeOrg.name}
        userName={userName}
        userAvatar={userAvatar}
      />
    </div>
  );
}
