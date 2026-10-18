"use client";

import * as React from "react";
import { UserMenu } from "./user-menu";
import { OrganizationWithRole } from "@/lib/organizations/types";

interface TopNavProps {
  userEmail: string;
  activeOrg: OrganizationWithRole | null;
}

export function TopNav({ userEmail, activeOrg }: TopNavProps) {
  return (
    <header className="flex h-14 w-full shrink-0 items-center justify-between border-b border-[#242427] bg-[#0B0B0C] px-6 backdrop-blur-md">
      <div className="flex items-center gap-3">
        <span className="text-xs font-medium text-[#71717A]">Workspace</span>
        <span className="text-[#3F3F46]">/</span>
        <span className="text-xs font-semibold text-[#F5F5F5]">
          {activeOrg ? activeOrg.name : "No Workspace Selected"}
        </span>
      </div>

      <div className="flex items-center gap-3">
        <UserMenu userEmail={userEmail} />
      </div>
    </header>
  );
}
