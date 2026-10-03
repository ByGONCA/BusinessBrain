"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Building2, Check, ChevronsUpDown, Plus } from "lucide-react";
import { OrganizationWithRole } from "@/lib/organizations/types";
import { switchOrganizationAction } from "@/lib/organizations/actions";

interface OrgSwitcherProps {
  organizations: OrganizationWithRole[];
  activeOrg: OrganizationWithRole | null;
}

export function OrgSwitcher({ organizations, activeOrg }: OrgSwitcherProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = React.useState(false);
  const [isPending, startTransition] = React.useTransition();
  const dropdownRef = React.useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelectOrg = (orgId: string) => {
    if (orgId === activeOrg?.id) {
      setIsOpen(false);
      return;
    }

    startTransition(async () => {
      try {
        await switchOrganizationAction(orgId);
        setIsOpen(false);
        router.refresh();
      } catch (err) {
        console.error("Failed to switch organization:", err);
      }
    });
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={isPending}
        className="flex w-full items-center justify-between gap-2 rounded-lg border border-slate-800 bg-slate-900/80 px-3 py-2 text-left text-sm text-slate-100 hover:border-slate-700 focus:outline-none transition-colors disabled:opacity-50"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-blue-600/20 text-blue-400 border border-blue-500/30">
            <Building2 className="h-3.5 w-3.5" />
          </div>
          <div className="truncate">
            <p className="truncate text-xs font-semibold leading-tight text-slate-200">
              {activeOrg ? activeOrg.name : "Select Workspace"}
            </p>
            {activeOrg && (
              <p className="text-[10px] text-slate-400 capitalize">
                {activeOrg.role}
              </p>
            )}
          </div>
        </div>
        <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-slate-400" />
      </button>

      {isOpen && (
        <div className="absolute left-0 top-full z-50 mt-1.5 w-60 rounded-xl border border-slate-800 bg-slate-900 p-1.5 shadow-xl backdrop-blur-md">
          <div className="px-2 py-1.5 text-[11px] font-medium text-slate-400">
            Workspaces
          </div>
          <div className="space-y-0.5">
            {organizations.map((org) => {
              const isSelected = org.id === activeOrg?.id;
              return (
                <button
                  key={org.id}
                  onClick={() => handleSelectOrg(org.id)}
                  className={`flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-xs transition-colors ${
                    isSelected
                      ? "bg-blue-600/15 text-blue-300 font-medium"
                      : "text-slate-300 hover:bg-slate-800/80 hover:text-slate-100"
                  }`}
                >
                  <div className="flex items-center gap-2 truncate">
                    <span className="truncate">{org.name}</span>
                    <span className="text-[10px] text-slate-500 capitalize">
                      ({org.role})
                    </span>
                  </div>
                  {isSelected && <Check className="h-3.5 w-3.5 text-blue-400" />}
                </button>
              );
            })}
          </div>

          <div className="my-1.5 border-t border-slate-800" />

          <button
            onClick={() => {
              setIsOpen(false);
              router.push("/onboarding");
            }}
            className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-slate-400 hover:bg-slate-800/80 hover:text-slate-200 transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Create new workspace</span>
          </button>
        </div>
      )}
    </div>
  );
}
