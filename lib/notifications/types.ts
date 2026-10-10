export type NotificationChannel = "in_app" | "email";

export type NotificationCategory =
  | "account_security"
  | "company_workspace"
  | "tasks"
  | "comments_mentions"
  | "calendar_meetings"
  | "goals"
  | "company_brain"
  | "email_inbox"
  | "integrations"
  | "files_pages"
  | "billing"
  | "product_marketing";

export interface NotificationItemDef {
  id: string;
  category: NotificationCategory;
  label: string;
  description: string;
  defaultInApp: boolean;
  defaultEmail: boolean;
  /** If true, the user is not allowed to disable this channel for security/account recovery reasons */
  lockedInApp?: boolean;
  lockedEmail?: boolean;
}

export interface NotificationPreferenceRecord {
  id?: string;
  user_id: string;
  notification_type: string;
  in_app_enabled: boolean;
  email_enabled: boolean;
}

export interface UserNotificationPreferences {
  [typeId: string]: {
    in_app: boolean;
    email: boolean;
  };
}

export interface NotificationCategoryMeta {
  id: NotificationCategory;
  title: string;
  description: string;
  iconName: string;
}

export const NOTIFICATION_CATEGORIES: NotificationCategoryMeta[] = [
  {
    id: "account_security",
    title: "Account & Security",
    description: "Crucial security notifications, authentication alerts, and credential updates.",
    iconName: "ShieldAlert",
  },
  {
    id: "company_workspace",
    title: "Company & Workspace",
    description: "Invitations, workspace role changes, and member membership activity.",
    iconName: "Building2",
  },
  {
    id: "tasks",
    title: "Tasks & Projects",
    description: "Task assignments, due dates, milestones, and project status modifications.",
    iconName: "CheckSquare",
  },
  {
    id: "comments_mentions",
    title: "Comments & Mentions",
    description: "Direct user mentions, replies, and reactions to your shared content.",
    iconName: "MessageSquare",
  },
  {
    id: "calendar_meetings",
    title: "Calendar & Meetings",
    description: "Meeting invites, starting soon reminders, and action item takeaways.",
    iconName: "Calendar",
  },
  {
    id: "goals",
    title: "Goals & Objectives",
    description: "Goal assignments, key metric changes, and goals marked at-risk or completed.",
    iconName: "Target",
  },
  {
    id: "company_brain",
    title: "Company Brain & Memory",
    description: "Institutional memory reviews, detected knowledge conflicts, and article updates.",
    iconName: "Brain",
  },
  {
    id: "email_inbox",
    title: "Email & Unified Inbox",
    description: "Important incoming messages, assigned email threads, and draft notifications.",
    iconName: "Mail",
  },
  {
    id: "integrations",
    title: "Integrations & Tools",
    description: "Third-party service synchronization errors, disconnections, and auth expirations.",
    iconName: "Layers",
  },
  {
    id: "files_pages",
    title: "Files & Documents",
    description: "Page sharing, shared document revisions, and file deletion alerts.",
    iconName: "FileText",
  },
  {
    id: "billing",
    title: "Usage & Billing",
    description: "Trial status, quota consumption warnings, invoice receipts, and payment alerts.",
    iconName: "CreditCard",
  },
  {
    id: "product_marketing",
    title: "Product Updates & Marketing",
    description: "New features, release notes, and community surveys (optional).",
    iconName: "Sparkles",
  },
];

export const NOTIFICATION_DEFINITIONS: NotificationItemDef[] = [
  // 1. ACCOUNT & SECURITY
  {
    id: "sec_password_changed",
    category: "account_security",
    label: "Password changed",
    description: "Alert when your account password has been successfully updated.",
    defaultInApp: true,
    defaultEmail: true,
    lockedInApp: true,
    lockedEmail: true,
  },
  {
    id: "sec_email_changed",
    category: "account_security",
    label: "Email address changed",
    description: "Immediate alert when an email change request is initiated or confirmed.",
    defaultInApp: true,
    defaultEmail: true,
    lockedInApp: true,
    lockedEmail: true,
  },
  {
    id: "sec_phone_changed",
    category: "account_security",
    label: "Phone number changed",
    description: "Notification when a two-factor or recovery phone number changes.",
    defaultInApp: true,
    defaultEmail: true,
    lockedInApp: true,
    lockedEmail: true,
  },
  {
    id: "sec_signin_method",
    category: "account_security",
    label: "Sign-in method linked or removed",
    description: "Alert when an OAuth provider (e.g. GitHub) is attached or unlinked.",
    defaultInApp: true,
    defaultEmail: true,
  },
  {
    id: "sec_mfa_changed",
    category: "account_security",
    label: "MFA method added or removed",
    description: "Critical alert when multi-factor authentication methods are altered.",
    defaultInApp: true,
    defaultEmail: true,
    lockedInApp: true,
    lockedEmail: true,
  },
  {
    id: "sec_new_signin",
    category: "account_security",
    label: "New sign-in detected",
    description: "Alert when your account is accessed from a new browser or device.",
    defaultInApp: true,
    defaultEmail: true,
  },
  {
    id: "sec_suspicious_signin",
    category: "account_security",
    label: "Suspicious sign-in attempt",
    description: "Urgent notification for suspicious or blocked access attempts.",
    defaultInApp: true,
    defaultEmail: true,
    lockedInApp: true,
    lockedEmail: true,
  },
  {
    id: "sec_sessions_revoked",
    category: "account_security",
    label: "All other sessions signed out",
    description: "Confirmation when all concurrent active sessions have been revoked.",
    defaultInApp: true,
    defaultEmail: true,
  },
  {
    id: "sec_account_deletion",
    category: "account_security",
    label: "Account deletion requested",
    description: "Notice when an account closure or deletion procedure has been scheduled.",
    defaultInApp: true,
    defaultEmail: true,
    lockedInApp: true,
    lockedEmail: true,
  },

  // 2. COMPANY / WORKSPACE
  {
    id: "ws_invited",
    category: "company_workspace",
    label: "Invited to a company",
    description: "When you receive an invitation to join an organization.",
    defaultInApp: true,
    defaultEmail: false,
  },
  {
    id: "ws_invitation_accepted",
    category: "company_workspace",
    label: "Invitation accepted",
    description: "When an invitee accepts your invitation to the organization.",
    defaultInApp: true,
    defaultEmail: false,
  },
  {
    id: "ws_removed",
    category: "company_workspace",
    label: "Removed from a company",
    description: "Notification when your access to a workspace has been terminated.",
    defaultInApp: true,
    defaultEmail: false,
  },
  {
    id: "ws_role_changed",
    category: "company_workspace",
    label: "Role changed",
    description: "When your organization permissions or role (Owner, Admin, Member) changes.",
    defaultInApp: true,
    defaultEmail: false,
  },
  {
    id: "ws_member_joined",
    category: "company_workspace",
    label: "Member joined workspace",
    description: "When a new teammate joins your active company workspace.",
    defaultInApp: true,
    defaultEmail: false,
  },
  {
    id: "ws_member_left",
    category: "company_workspace",
    label: "Member left workspace",
    description: "When a teammate departs or is removed from the company workspace.",
    defaultInApp: true,
    defaultEmail: false,
  },
  {
    id: "ws_project_added",
    category: "company_workspace",
    label: "Added to a project",
    description: "When you are added as a collaborator or owner of a project.",
    defaultInApp: true,
    defaultEmail: false,
  },
  {
    id: "ws_project_removed",
    category: "company_workspace",
    label: "Removed from a project",
    description: "When your assignment to a workspace project is removed.",
    defaultInApp: true,
    defaultEmail: false,
  },
  {
    id: "ws_project_completed",
    category: "company_workspace",
    label: "Project completed",
    description: "When a project you participate in is marked as finished.",
    defaultInApp: true,
    defaultEmail: false,
  },

  // 3. TASKS
  {
    id: "task_assigned",
    category: "tasks",
    label: "Task assigned to me",
    description: "When a teammate assigns an action item or task to you.",
    defaultInApp: true,
    defaultEmail: false,
  },
  {
    id: "task_unassigned",
    category: "tasks",
    label: "Task unassigned from me",
    description: "When a task is reassigned away from you.",
    defaultInApp: true,
    defaultEmail: false,
  },
  {
    id: "task_status_changed",
    category: "tasks",
    label: "Task status changed",
    description: "When the workflow status of a task you are tracking updates.",
    defaultInApp: true,
    defaultEmail: false,
  },
  {
    id: "task_due_soon",
    category: "tasks",
    label: "Task due date approaching",
    description: "Reminder when a task deadline is arriving within 24 hours.",
    defaultInApp: true,
    defaultEmail: false,
  },
  {
    id: "task_overdue",
    category: "tasks",
    label: "Task overdue",
    description: "Urgent reminder when an assigned task exceeds its due date.",
    defaultInApp: true,
    defaultEmail: false,
  },
  {
    id: "task_completed",
    category: "tasks",
    label: "Task completed",
    description: "When an assigned task or dependent subtask is marked done.",
    defaultInApp: true,
    defaultEmail: false,
  },
  {
    id: "task_priority_changed",
    category: "tasks",
    label: "Task priority changed",
    description: "When task urgency is escalated to Urgent or High.",
    defaultInApp: true,
    defaultEmail: false,
  },
  {
    id: "task_mentioned",
    category: "tasks",
    label: "Mentioned in a task",
    description: "When someone @mentions you inside a task description.",
    defaultInApp: true,
    defaultEmail: false,
  },
  {
    id: "task_blocked",
    category: "tasks",
    label: "Task blocked or unblocked",
    description: "When an obstacle is flagged or cleared on your assigned task.",
    defaultInApp: true,
    defaultEmail: false,
  },

  // 4. COMMENTS & MENTIONS
  {
    id: "comment_mentioned",
    category: "comments_mentions",
    label: "Mentioned in comment",
    description: "When a collaborator mentions your name in any conversation or thread.",
    defaultInApp: true,
    defaultEmail: false,
  },
  {
    id: "comment_reply",
    category: "comments_mentions",
    label: "Reply to my comment",
    description: "When someone replies directly to a note or discussion you started.",
    defaultInApp: true,
    defaultEmail: false,
  },
  {
    id: "comment_on_task",
    category: "comments_mentions",
    label: "Comment on my task",
    description: "When someone leaves a comment on a task you own.",
    defaultInApp: true,
    defaultEmail: false,
  },
  {
    id: "comment_on_page",
    category: "comments_mentions",
    label: "Comment on my page",
    description: "When someone comments on a workspace document or page you authored.",
    defaultInApp: true,
    defaultEmail: false,
  },
  {
    id: "comment_reaction",
    category: "comments_mentions",
    label: "Reaction to my comment",
    description: "When someone adds an emoji reaction to one of your remarks.",
    defaultInApp: true,
    defaultEmail: false,
  },

  // 5. CALENDAR & MEETINGS
  {
    id: "cal_invite_received",
    category: "calendar_meetings",
    label: "Meeting invite received",
    description: "When you receive a new invitation to an internal or external meeting.",
    defaultInApp: true,
    defaultEmail: false,
  },
  {
    id: "cal_invite_updated",
    category: "calendar_meetings",
    label: "Meeting updated or cancelled",
    description: "When a scheduled meeting time changes or is called off.",
    defaultInApp: true,
    defaultEmail: false,
  },
  {
    id: "cal_starting_soon",
    category: "calendar_meetings",
    label: "Meeting starting soon (10m)",
    description: "High-priority pop-up before your next scheduled meeting begins.",
    defaultInApp: true,
    defaultEmail: false,
  },
  {
    id: "cal_notes_ready",
    category: "calendar_meetings",
    label: "Meeting notes and transcript ready",
    description: "When post-meeting summaries or action items are published.",
    defaultInApp: true,
    defaultEmail: false,
  },
  {
    id: "cal_action_item_assigned",
    category: "calendar_meetings",
    label: "Action item assigned from meeting",
    description: "When an action item generated during a meeting is assigned to you.",
    defaultInApp: true,
    defaultEmail: false,
  },

  // 6. GOALS
  {
    id: "goal_assigned",
    category: "goals",
    label: "Goal assigned to me",
    description: "When an OKR or milestone objective is assigned to your ownership.",
    defaultInApp: true,
    defaultEmail: false,
  },
  {
    id: "goal_progress",
    category: "goals",
    label: "Goal progress updated",
    description: "When milestone progress is updated towards key targets.",
    defaultInApp: true,
    defaultEmail: false,
  },
  {
    id: "goal_at_risk",
    category: "goals",
    label: "Goal at risk or missed",
    description: "When an objective falls behind trajectory or misses a milestone.",
    defaultInApp: true,
    defaultEmail: false,
  },

  // 7. COMPANY BRAIN / MEMORY
  {
    id: "brain_article_created",
    category: "company_brain",
    label: "Knowledge article created",
    description: "When new institutional documentation or SOPs are published.",
    defaultInApp: true,
    defaultEmail: false,
  },
  {
    id: "brain_conflict_detected",
    category: "company_brain",
    label: "Knowledge conflict detected",
    description: "When conflicting facts or obsolete policies are discovered.",
    defaultInApp: true,
    defaultEmail: false,
  },
  {
    id: "brain_review_suggested",
    category: "company_brain",
    label: "Memory suggested for review",
    description: "When an AI context memory needs human verification or audit.",
    defaultInApp: true,
    defaultEmail: false,
  },

  // 8. EMAIL & INBOX
  {
    id: "mail_important_received",
    category: "email_inbox",
    label: "Important email received",
    description: "When a message flagged as urgent or priority reaches your connected inbox.",
    defaultInApp: true,
    defaultEmail: false,
  },
  {
    id: "mail_thread_assigned",
    category: "email_inbox",
    label: "Email thread assigned to me",
    description: "When an inbox conversation is delegated to you for resolution.",
    defaultInApp: true,
    defaultEmail: false,
  },
  {
    id: "mail_reply_received",
    category: "email_inbox",
    label: "Email reply received",
    description: "When a client responds to an outgoing communication thread.",
    defaultInApp: true,
    defaultEmail: false,
  },

  // 9. INTEGRATIONS
  {
    id: "integration_connected",
    category: "integrations",
    label: "Integration connected or disconnected",
    description: "When a tool like Google Calendar or Outlook is linked or detached.",
    defaultInApp: true,
    defaultEmail: false,
  },
  {
    id: "integration_sync_failed",
    category: "integrations",
    label: "Integration sync failed",
    description: "When background synchronization encounters an unexpected error.",
    defaultInApp: true,
    defaultEmail: false,
  },
  {
    id: "integration_reconnect_req",
    category: "integrations",
    label: "Integration reconnect required",
    description: "When an OAuth token expires or requires updated consent.",
    defaultInApp: true,
    defaultEmail: false,
  },

  // 10. FILES & PAGES
  {
    id: "page_shared",
    category: "files_pages",
    label: "Page shared with me",
    description: "When a document or wiki page is directly shared with your account.",
    defaultInApp: true,
    defaultEmail: false,
  },
  {
    id: "page_edited",
    category: "files_pages",
    label: "Page edited by collaborator",
    description: "When a collaborator revises a document you are following.",
    defaultInApp: true,
    defaultEmail: false,
  },
  {
    id: "file_deletion_alert",
    category: "files_pages",
    label: "File deletion alert",
    description: "Security warning when shared files or documents are deleted.",
    defaultInApp: true,
    defaultEmail: false,
  },

  // 11. BILLING
  {
    id: "bill_trial_ending",
    category: "billing",
    label: "Trial ending in 3 days",
    description: "Reminder before your 7-day free trial expires.",
    defaultInApp: true,
    defaultEmail: false,
  },
  {
    id: "bill_trial_ended",
    category: "billing",
    label: "Trial ended",
    description: "Notice when your trial concludes and requires an active subscription.",
    defaultInApp: true,
    defaultEmail: false,
  },
  {
    id: "bill_renewed",
    category: "billing",
    label: "Subscription renewed",
    description: "Receipt notification upon successful billing renewal.",
    defaultInApp: true,
    defaultEmail: false,
  },
  {
    id: "bill_payment_failed",
    category: "billing",
    label: "Payment failed",
    description: "Urgent alert if a subscription charge fails to process.",
    defaultInApp: true,
    defaultEmail: false,
    lockedInApp: true,
    lockedEmail: true,
  },
  {
    id: "bill_limits_approaching",
    category: "billing",
    label: "Plan limits approaching (80%, 100%)",
    description: "Alert when members, storage, or AI credits reach quota capacity.",
    defaultInApp: true,
    defaultEmail: false,
  },

  // 12. PRODUCT & MARKETING (Compliant with GDPR: All false by default)
  {
    id: "mkt_product_updates",
    category: "product_marketing",
    label: "Product updates & changelog",
    description: "Periodic digest of new platform capabilities and release notes.",
    defaultInApp: false,
    defaultEmail: false,
  },
  {
    id: "mkt_tips_best_practices",
    category: "product_marketing",
    label: "Tips & best practices",
    description: "Curated workflows and recommendations to get more out of Company Brain.",
    defaultInApp: false,
    defaultEmail: false,
  },
  {
    id: "mkt_surveys",
    category: "product_marketing",
    label: "Feedback requests & surveys",
    description: "Invitations to share product feedback and shape our roadmap.",
    defaultInApp: false,
    defaultEmail: false,
  },
  {
    id: "mkt_promotions",
    category: "product_marketing",
    label: "Promotional offers & credit bonuses",
    description: "Special promotions, seasonal discounts, and early-access perks.",
    defaultInApp: false,
    defaultEmail: false,
  },
];

/**
 * Returns default preference lookup map
 */
export function getDefaultPreferences(): UserNotificationPreferences {
  const result: UserNotificationPreferences = {};
  for (const item of NOTIFICATION_DEFINITIONS) {
    result[item.id] = {
      in_app: item.defaultInApp,
      email: item.defaultEmail,
    };
  }
  return result;
}
