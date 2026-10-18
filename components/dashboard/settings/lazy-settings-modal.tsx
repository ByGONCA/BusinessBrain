"use client";

import dynamic from "next/dynamic";
import { useSettings } from "./settings-context";
import { OrganizationWithRole, OrganizationMember } from "@/lib/organizations/types";
import { OrganizationEntitlement } from "@/lib/organizations/entitlements";
import { OrganizationIntegration } from "@/lib/integrations/types";

// Dynamic import with ssr: false ensures that the 55KB SettingsModal (and its 11 sub-tabs)
// are only fetched over the wire when the modal is actually opened by the user.
const DynamicSettingsModal = dynamic(
  () => import("./settings-modal").then((mod) => mod.SettingsModal),
  { ssr: false }
);

export interface LazySettingsModalProps {
  user: {
    id: string;
    email?: string;
    user_metadata?: {
      full_name?: string;
      name?: string;
      avatar_url?: string;
      [key: string]: unknown;
    };
  };
  organizations: OrganizationWithRole[];
  activeOrg: OrganizationWithRole | null;
  entitlement: OrganizationEntitlement | null;
  members?: OrganizationMember[];
  initialIntegrations?: OrganizationIntegration[];
  isOwner?: boolean;
  userPermissions?: string[];
}

export function LazySettingsModal(props: LazySettingsModalProps) {
  const { isOpen } = useSettings();

  // If closed, avoid mounting and prevent loading the chunk entirely
  if (!isOpen) {
    return null;
  }

  return <DynamicSettingsModal {...props} />;
}
