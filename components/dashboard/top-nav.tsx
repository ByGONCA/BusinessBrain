"use client";

import { OrganizationWithRole } from "@/lib/organizations/types";

export interface TopNavProps {
  userEmail?: string;
  userName?: string;
  userAvatar?: string;
  activeOrg?: OrganizationWithRole | null;
  className?: string;
}

export function TopNav(_props?: TopNavProps) {
  return null;
}
