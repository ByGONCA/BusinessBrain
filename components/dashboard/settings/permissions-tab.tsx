"use client";

import * as React from "react";
import { ShieldCheck, Check, Minus, Info } from "lucide-react";
import { cn } from "@/lib/utils";

interface PermissionRule {
  capability: string;
  description: string;
  owner: boolean;
  admin: boolean;
  member: boolean;
  guest: boolean;
}

const PERMISSION_RULES: PermissionRule[] = [
  {
    capability: "Manage Billing & Subscription",
    description: "Update payment methods, switch tiers, add AI credits",
    owner: true,
    admin: false,
    member: false,
    guest: false,
  },
  {
    capability: "Delete Workspace",
    description: "Permanently delete tenant data, organizations, and files",
    owner: true,
    admin: false,
    member: false,
    guest: false,
  },
  {
    capability: "Invite & Remove Members",
    description: "Manage member roster, send invites, and change roles",
    owner: true,
    admin: true,
    member: false,
    guest: false,
  },
  {
    capability: "Configure Workspace Settings",
    description: "Company identity, defaults, and integration connections",
    owner: true,
    admin: true,
    member: false,
    guest: false,
  },
  {
    capability: "View Audit Log & Storage Quotas",
    description: "Access security audit logs and file storage breakdown",
    owner: true,
    admin: true,
    member: false,
    guest: false,
  },
  {
    capability: "Export Company Workspace Data",
    description: "Download complete workspace JSON archive",
    owner: true,
    admin: true,
    member: false,
    guest: false,
  },
  {
    capability: "Create & Edit Documents & Pages",
    description: "Full read and write authoring in knowledge canvas",
    owner: true,
    admin: true,
    member: true,
    guest: false,
  },
  {
    capability: "Manage Tasks & Projects",
    description: "Create, assign, update, and prioritize tasks",
    owner: true,
    admin: true,
    member: true,
    guest: false,
  },
  {
    capability: "Sync Calendar Events",
    description: "Connect personal Google Calendar and sync meetings",
    owner: true,
    admin: true,
    member: true,
    guest: false,
  },
  {
    capability: "View Shared Pages (Read-Only)",
    description: "View documents and pages explicitly shared",
    owner: true,
    admin: true,
    member: true,
    guest: true,
  },
];

export function PermissionsTab() {
  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h2 className="text-lg font-bold text-zinc-900 dark:text-white tracking-tight">Roles & Permissions Matrix</h2>
      </div>

      {/* Role Summary Badges */}
      <div className="grid grid-cols-4 gap-2.5">
        <div className="p-3 rounded-xl border border-blue-200 dark:border-blue-900/60 bg-blue-50/30 dark:bg-blue-950/20 space-y-1">
          <span className="text-[10px] font-mono uppercase font-bold text-blue-600 dark:text-blue-400">
            Owner
          </span>
          <p className="text-[11px] text-zinc-600 dark:text-zinc-300">
            Full root authority including billing and workspace lifecycle.
          </p>
        </div>
        <div className="p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/40 space-y-1">
          <span className="text-[10px] font-mono uppercase font-bold text-indigo-600 dark:text-indigo-400">
            Admin
          </span>
          <p className="text-[11px] text-zinc-600 dark:text-zinc-300">
            Operational governance, member invitations, and integrations.
          </p>
        </div>
        <div className="p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/40 space-y-1">
          <span className="text-[10px] font-mono uppercase font-bold text-emerald-600 dark:text-emerald-400">
            Member
          </span>
          <p className="text-[11px] text-zinc-600 dark:text-zinc-300">
            Core collaborator. Authors documents, tasks, and notes.
          </p>
        </div>
        <div className="p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/40 space-y-1">
          <span className="text-[10px] font-mono uppercase font-bold text-zinc-500 dark:text-zinc-400">
            Guest
          </span>
          <p className="text-[11px] text-zinc-600 dark:text-zinc-300">
            Limited external collaborator with read-only page access.
          </p>
        </div>
      </div>

      {/* Permissions Matrix Table */}
      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#161618] overflow-hidden">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-900/50">
              <th className="py-2.5 px-3 font-semibold text-zinc-700 dark:text-zinc-300">Capability</th>
              <th className="py-2.5 px-2 text-center font-semibold text-zinc-700 dark:text-zinc-300 w-16">Owner</th>
              <th className="py-2.5 px-2 text-center font-semibold text-zinc-700 dark:text-zinc-300 w-16">Admin</th>
              <th className="py-2.5 px-2 text-center font-semibold text-zinc-700 dark:text-zinc-300 w-16">Member</th>
              <th className="py-2.5 px-2 text-center font-semibold text-zinc-700 dark:text-zinc-300 w-16">Guest</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {PERMISSION_RULES.map((rule, idx) => (
              <tr
                key={idx}
                className="hover:bg-zinc-50/50 dark:hover:bg-zinc-900/30 transition-colors"
              >
                <td className="py-2.5 px-3">
                  <p className="font-medium text-zinc-900 dark:text-zinc-100">{rule.capability}</p>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">{rule.description}</p>
                </td>
                <td className="py-2.5 px-2 text-center">
                  {rule.owner ? (
                    <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400 mx-auto" />
                  ) : (
                    <Minus className="h-4 w-4 text-zinc-300 dark:text-zinc-600 mx-auto" />
                  )}
                </td>
                <td className="py-2.5 px-2 text-center">
                  {rule.admin ? (
                    <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400 mx-auto" />
                  ) : (
                    <Minus className="h-4 w-4 text-zinc-300 dark:text-zinc-600 mx-auto" />
                  )}
                </td>
                <td className="py-2.5 px-2 text-center">
                  {rule.member ? (
                    <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400 mx-auto" />
                  ) : (
                    <Minus className="h-4 w-4 text-zinc-300 dark:text-zinc-600 mx-auto" />
                  )}
                </td>
                <td className="py-2.5 px-2 text-center">
                  {rule.guest ? (
                    <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400 mx-auto" />
                  ) : (
                    <Minus className="h-4 w-4 text-zinc-300 dark:text-zinc-600 mx-auto" />
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between p-3.5 rounded-xl border border-blue-500/30 bg-blue-500/10 text-xs">
        <div>
          <span className="font-semibold text-white block">Custom Teams & Individual Overrides</span>
          <span className="text-[11px] text-zinc-400 block mt-0.5">
            Create arbitrary teams, customize capabilities, and set individual member allowances or restrictions.
          </span>
        </div>
        <a
          href="/dashboard/people"
          className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs transition-colors shrink-0"
        >
          Manage People & Teams
        </a>
      </div>

      <div className="flex items-center gap-2 text-[11px] text-zinc-500">
        <Info className="h-3.5 w-3.5 text-zinc-400 shrink-0" />
        <span>
          Job titles are purely informational. Permission evaluation strictly follows: <strong>Owner</strong> &gt; <strong>Individual Deny</strong> &gt; <strong>Individual Allow</strong> &gt; <strong>Team Allow</strong>.
        </span>
      </div>
    </div>
  );
}
