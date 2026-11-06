"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Building2, Check, ChevronsUpDown, Plus, User, Briefcase } from "lucide-react";
import { OrganizationWithRole } from "@/lib/organizations/types";
import { switchOrganizationAction } from "@/lib/organizations/actions";
import { useLanguage } from "@/lib/i18n";

interface OrgSwitcherProps {
  organizations: OrganizationWithRole[];
  activeOrg: OrganizationWithRole | null;
}

export function OrgSwitcher({ organizations, activeOrg }: OrgSwitcherProps) {
  const router = useRouter();
  const { locale } = useLanguage();
  const isPt = locale === "pt";

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
        console.error("Failed to switch workspace:", err);
      }
    });
  };

  const isPersonalActive = activeOrg?.workspace_type === "personal";

  const personalWorkspaces = organizations.filter(
    (o) => o.workspace_type === "personal"
  );
  const companyWorkspaces = organizations.filter(
    (o) => o.workspace_type !== "personal"
  );

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={isPending}
        className="flex w-full items-center justify-between gap-2 rounded-xl border border-border bg-card px-3 py-2 text-left text-sm text-foreground hover:border-border-strong hover:bg-hover focus:outline-none transition-colors disabled:opacity-50 cursor-pointer shadow-2xs"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border ${
              isPersonalActive
                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                : "bg-blue-600/15 text-blue-400 border-blue-500/25"
            }`}
          >
            {isPersonalActive ? (
              <User className="h-3.5 w-3.5" />
            ) : (
              <Building2 className="h-3.5 w-3.5" />
            )}
          </div>
          <div className="truncate">
            <p className="truncate text-xs font-semibold leading-tight text-foreground">
              {activeOrg
                ? isPersonalActive
                  ? isPt ? "Espaço Pessoal" : "Personal Workspace"
                  : activeOrg.name
                : isPt ? "Selecionar Workspace" : "Select Workspace"}
            </p>
            <p className="text-[10px] text-muted-foreground capitalize flex items-center gap-1">
              <span>
                {isPersonalActive
                  ? isPt ? "Privado • Individual" : "Private • Individual"
                  : activeOrg?.role || (isPt ? "Empresa" : "Company")}
              </span>
            </p>
          </div>
        </div>
        <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      </button>

      {isOpen && (
        <div className="absolute left-0 top-full z-50 mt-1.5 w-64 rounded-2xl border border-border bg-surface-elevated text-foreground p-1.5 shadow-2xl backdrop-blur-xl animate-in fade-in-0 zoom-in-95 duration-100 text-left">
          {/* Personal Workspace Section */}
          <div className="px-2 py-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
            {isPt ? "Espaço Pessoal" : "Personal Workspace"}
          </div>
          <div className="space-y-0.5">
            {personalWorkspaces.map((org) => {
              const isSelected = org.id === activeOrg?.id;
              return (
                <button
                  key={org.id}
                  onClick={() => handleSelectOrg(org.id)}
                  className={`flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-xs transition-colors cursor-pointer ${
                    isSelected
                      ? "bg-selected text-foreground font-medium"
                      : "text-muted-foreground hover:bg-hover hover:text-foreground"
                  }`}
                >
                  <div className="flex items-center gap-2 truncate">
                    <User className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                    <span className="truncate">
                      {isPt ? "Espaço Pessoal" : "Personal Workspace"}
                    </span>
                    <span className="text-[9px] uppercase font-mono px-1 py-0.2 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold shrink-0">
                      {isPt ? "Privado" : "Private"}
                    </span>
                  </div>
                  {isSelected && <Check className="h-3.5 w-3.5 text-emerald-400 shrink-0" />}
                </button>
              );
            })}
          </div>

          <div className="my-1.5 border-t border-border-subtle" />

          {/* Company Workspaces Section */}
          <div className="px-2 py-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center justify-between">
            <span>{isPt ? "Workspaces Empresariais" : "Company Workspaces"}</span>
            <Briefcase className="h-3 w-3 text-muted-foreground" />
          </div>

          <div className="space-y-0.5">
            {companyWorkspaces.length === 0 ? (
              <div className="px-2.5 py-2 text-[11px] text-muted-foreground italic">
                {isPt ? "Sem empresas associadas" : "No associated companies"}
              </div>
            ) : (
              companyWorkspaces.map((org) => {
                const isSelected = org.id === activeOrg?.id;
                return (
                  <button
                    key={org.id}
                    onClick={() => handleSelectOrg(org.id)}
                    className={`flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-xs transition-colors cursor-pointer ${
                      isSelected
                        ? "bg-selected text-foreground font-medium"
                        : "text-muted-foreground hover:bg-hover hover:text-foreground"
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate min-w-0">
                      <Building2 className="h-3.5 w-3.5 text-blue-400 shrink-0" />
                      <span className="truncate">{org.name}</span>
                      <span className="text-[10px] text-muted-foreground capitalize shrink-0">
                        ({org.role})
                      </span>
                    </div>
                    {isSelected && <Check className="h-3.5 w-3.5 text-blue-400 shrink-0" />}
                  </button>
                );
              })
            )}
          </div>

          <div className="my-1.5 border-t border-border-subtle" />

          <button
            onClick={() => {
              setIsOpen(false);
              router.push("/onboarding");
            }}
            className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-muted-foreground hover:bg-white/[0.04] hover:text-zinc-200 transition-colors cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>{isPt ? "Criar nova empresa" : "Create new company workspace"}</span>
          </button>
        </div>
      )}
    </div>
  );
}
