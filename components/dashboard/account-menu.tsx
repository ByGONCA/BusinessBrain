"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import {
  ChevronDown,
  Check,
  Plus,
  Settings,
  CircleArrowUp,
  MoreHorizontal,
  Loader2,
} from "lucide-react";
import { OrganizationWithRole } from "@/lib/organizations/types";
import { OrganizationEntitlement } from "@/lib/organizations/entitlements";
import { switchOrganizationAction } from "@/lib/organizations/actions";
import { signOutAction } from "@/lib/auth/actions";
import { cn } from "@/lib/utils";
import { useSettings } from "./settings/settings-context";
import { useLanguage } from "@/lib/i18n";
import { HelpMenu } from "./help-menu";

import { useSidebar } from "./sidebar-context";

interface AccountMenuProps {
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
  demoMode?: boolean;
}

// Deterministic pastel color palette for company avatars
const ORG_AVATAR_COLORS = [
  "bg-blue-600/20 text-blue-400 border-blue-500/30",
  "bg-emerald-600/20 text-emerald-400 border-emerald-500/30",
  "bg-purple-600/20 text-purple-400 border-purple-500/30",
  "bg-amber-600/20 text-amber-400 border-amber-500/30",
  "bg-cyan-600/20 text-cyan-400 border-cyan-500/30",
  "bg-rose-600/20 text-rose-400 border-rose-500/30",
];

function getOrgColor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % ORG_AVATAR_COLORS.length;
  return ORG_AVATAR_COLORS[index];
}

export function AccountMenu({
  user,
  organizations,
  activeOrg,
  entitlement,
  demoMode,
}: AccountMenuProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { openSettings } = useSettings();
  const { t } = useLanguage();
  const { isCompact } = useSidebar();
  const [isOpen, setIsOpen] = React.useState(false);
  const [switchingOrgId, setSwitchingOrgId] = React.useState<string | null>(null);
  const [isSigningOut, startSignOutTransition] = React.useTransition();
  const menuRef = React.useRef<HTMLDivElement>(null);

  // Close on outside click
  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Close on Escape key
  React.useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown);
      return () => document.removeEventListener("keydown", handleKeyDown);
    }
  }, [isOpen]);

  const handleSelectOrg = async (orgId: string) => {
    if (demoMode) {
      setIsOpen(false);
      return;
    }
    if (orgId === activeOrg?.id) {
      setIsOpen(false);
      return;
    }

    try {
      setSwitchingOrgId(orgId);
      await switchOrganizationAction(orgId);
      setIsOpen(false);
      router.refresh();
    } catch (err) {
      console.error("Failed to switch organization:", err);
    } finally {
      setSwitchingOrgId(null);
    }
  };

  const handleSignOut = () => {
    if (demoMode) {
      setIsOpen(false);
      return;
    }
    startSignOutTransition(async () => {
      await signOutAction();
    });
  };

  const userName =
    user.user_metadata?.full_name ||
    user.user_metadata?.name ||
    user.email?.split("@")[0] ||
    "User";

  const userInitial = userName.charAt(0).toUpperCase();

  // Determine plan label
  let planLabel = t.account.freeWorkspace;
  if (entitlement?.isTrial) {
    planLabel = t.account.trialPlan;
  } else if (entitlement?.plan) {
    planLabel = `${entitlement.plan.charAt(0).toUpperCase() + entitlement.plan.slice(1)} Plan`;
  }

  return (
    <div className="relative" ref={menuRef}>
      {/* Popover Menu (opens upward or to side in compact mode) */}
      {isOpen && (
        <div
          role="menu"
          aria-label="Account and workspace options"
          className={cn(
            "absolute z-50 w-60 rounded-xl border border-[#242427] bg-[#141415] p-1.5 shadow-2xl backdrop-blur-xl focus:outline-none animate-in fade-in duration-100",
            isCompact
              ? "left-full bottom-0 ml-2"
              : "bottom-full left-0 mb-2 w-full min-w-[240px]"
          )}
        >
          {/* Active Workspace / Account Header */}
          <div className="flex items-center gap-2.5 p-2">
            <div
              className={cn(
                "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border text-xs font-bold shadow-xs",
                activeOrg ? getOrgColor(activeOrg.name) : "bg-emerald-600/20 text-emerald-400 border-emerald-500/30"
              )}
            >
              {activeOrg ? activeOrg.name.charAt(0).toUpperCase() : userInitial}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-bold text-[#F5F5F5] leading-tight">
                {activeOrg ? activeOrg.name : userName}
              </p>
              <p className="truncate text-[11px] text-[#71717A]">
                {planLabel} &bull; 1 {t.account.memberCount}
              </p>
            </div>
          </div>

          <div className="my-1 border-t border-[#1C1C1F]" />

          {/* Quick Actions: Upgrade, Settings, Help */}
          <div className="space-y-0.5">
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                openSettings("billing");
              }}
              className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-blue-400 hover:bg-[#1C1C1F] transition-colors text-left"
            >
              <CircleArrowUp className="h-4 w-4 text-blue-400" />
              <span>{t.account.upgrade}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                openSettings("preferences");
              }}
              className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-xs text-[#A1A1AA] hover:bg-[#1C1C1F] hover:text-[#F5F5F5] transition-colors text-left"
            >
              <Settings className="h-4 w-4 text-[#71717A]" />
              <span>{t.account.settings}</span>
            </button>

            <HelpMenu
              placement="bottom"
              triggerVariant="account-item"
              label={t.help.help}
            />
          </div>

          <div className="my-1 border-t border-[#1C1C1F]" />

          {/* Workspaces Group */}
          <div>
            <div className="flex items-center justify-between px-2.5 py-1 text-[11px] text-[#71717A] font-medium">
              <span className="truncate">{user.email}</span>
              <MoreHorizontal className="h-3.5 w-3.5 text-[#71717A] shrink-0" />
            </div>

            <div className="mt-0.5 max-h-48 space-y-0.5 overflow-y-auto">
              {organizations.map((org) => {
                const isActive = org.id === activeOrg?.id;
                const isSwitching = switchingOrgId === org.id;
                const colorStyle = getOrgColor(org.name);

                return (
                  <button
                    key={org.id}
                    onClick={() => handleSelectOrg(org.id)}
                    disabled={isSwitching}
                    className={cn(
                      "flex w-full items-center justify-between gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-xs transition-colors",
                      isActive
                        ? "bg-[#242427] text-[#F5F5F5] font-medium"
                        : "text-[#A1A1AA] hover:bg-[#1C1C1F] hover:text-[#F5F5F5]"
                    )}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className={cn(
                          "flex h-5 w-5 shrink-0 items-center justify-center rounded border text-[10px] font-bold shadow-xs",
                          colorStyle
                        )}
                      >
                        {org.name.charAt(0).toUpperCase()}
                      </div>
                      <span className="truncate text-xs font-medium text-[#F5F5F5]">
                        {org.name}
                      </span>
                    </div>

                    {isSwitching ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-400 shrink-0" />
                    ) : isActive ? (
                      <Check className="h-3.5 w-3.5 text-[#F5F5F5] shrink-0" />
                    ) : null}
                  </button>
                );
              })}
            </div>

            <Link
              href="/onboarding"
              onClick={() => setIsOpen(false)}
              className="mt-0.5 flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-blue-400 hover:bg-blue-500/10 transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>{t.account.newWorkspace}</span>
            </Link>
          </div>

          <div className="my-1 border-t border-[#1C1C1F]" />

          {/* Log out */}
          <button
            onClick={handleSignOut}
            disabled={isSigningOut}
            className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs text-[#71717A] hover:bg-[#1C1C1F] hover:text-[#F5F5F5] transition-colors disabled:opacity-50"
          >
            {isSigningOut ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : null}
            <span>{isSigningOut ? t.account.loggingOut : t.account.logOut}</span>
          </button>
        </div>
      )}

      {/* Account Control Button (Fixed at Bottom-Left) */}
      <button
        type="button"
        data-tour="settings-billing"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-haspopup="menu"
        className={cn(
          "flex w-full items-center rounded-md border border-transparent h-[38px] px-2 text-left hover:bg-[#18181B] transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-600",
          isCompact ? "justify-center p-1.5" : "justify-between gap-2.5",
          isOpen ? "bg-[#18181B]" : ""
        )}
        title={activeOrg ? activeOrg.name : userName}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className={cn(
              "flex h-6 w-6 shrink-0 items-center justify-center rounded-md border text-[11px] font-bold shadow-xs",
              activeOrg ? getOrgColor(activeOrg.name) : "bg-emerald-600/20 text-emerald-400 border-emerald-500/30"
            )}
          >
            {activeOrg ? activeOrg.name.charAt(0).toUpperCase() : userInitial}
          </div>
          {!isCompact && (
            <span className="truncate text-[13px] font-medium text-[#F5F5F5]">
              {activeOrg ? activeOrg.name : userName}
            </span>
          )}
        </div>

        {!isCompact && (
          <ChevronDown
            className={cn(
              "h-3.5 w-3.5 shrink-0 text-[#71717A] transition-transform duration-150",
              isOpen && "rotate-180"
            )}
          />
        )}
      </button>
    </div>
  );
}
