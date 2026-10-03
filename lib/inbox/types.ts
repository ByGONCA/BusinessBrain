export type AdminMessageBadge = "release" | "update" | "security" | "tip";

export interface AdminMessage {
  id: string;
  title: string;
  sender: string;
  senderRole: string;
  badge: AdminMessageBadge;
  summary: string;
  content: string[];
  createdAt: string;
  actionUrl?: string;
  actionLabel?: string;
}
