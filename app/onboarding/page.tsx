"use client";

import * as React from "react";
import { Sparkles, Building2, ArrowRight, Loader2 } from "lucide-react";
import { createOrganizationAction, ActionState } from "@/lib/organizations/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function OnboardingPage() {
  const [state, formAction, isPending] = React.useActionState<ActionState, FormData>(
    createOrganizationAction,
    {}
  );

  const [companyName, setCompanyName] = React.useState("");
  const [slug, setSlug] = React.useState("");

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setCompanyName(val);
    // Auto-generate clean slug
    const generated = val
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");
    setSlug(generated);
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-950 px-4 py-12 text-slate-100">
      <div className="w-full max-w-md">
        {/* Brand */}
        <div className="flex flex-col items-center text-center">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white shadow-lg shadow-blue-500/20">
            <Building2 className="h-5 w-5" />
          </div>
          <h2 className="mt-4 text-xl font-bold tracking-tight text-white">
            Create your company workspace
          </h2>
          <p className="mt-1 text-xs text-slate-400">
            Every piece of knowledge, decision, and project is secured within your workspace
          </p>
        </div>

        {/* Card */}
        <div className="mt-8 rounded-xl border border-slate-800 bg-slate-900/60 p-6 shadow-xl backdrop-blur-sm">
          <form action={formAction} className="space-y-4">
            {state?.error && (
              <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-400">
                {state.error}
              </div>
            )}

            <Input
              label="Company or Workspace Name"
              name="name"
              value={companyName}
              onChange={handleNameChange}
              placeholder="Acme Corp"
              required
            />

            <div>
              <Input
                label="Workspace URL Slug"
                name="slug"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder="acme-corp"
                required
              />
              <p className="mt-1 text-[11px] text-slate-500">
                Lowercase letters, numbers, and hyphens only.
              </p>
            </div>

            <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3.5 text-xs text-slate-400">
              <div className="flex items-center gap-2 font-medium text-slate-300">
                <Sparkles className="h-3.5 w-3.5 text-blue-400" />
                <span>Multi-tenant Isolation</span>
              </div>
              <p className="mt-1 text-[11px] text-slate-500">
                You will be assigned as workspace Owner. No members from other companies can access this workspace.
              </p>
            </div>

            <Button
              type="submit"
              disabled={isPending || !companyName || !slug}
              className="w-full gap-2 mt-2"
            >
              {isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Creating workspace...</span>
                </>
              ) : (
                <>
                  <span>Create Workspace & Enter</span>
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
