"use client";

import * as React from "react";
import { ShieldAlert, Check, X, Clock, MessageSquare, Plus, Lock } from "lucide-react";
import { AuthorizationChallenge, AIScopeType } from "@/lib/ai/auth/types";

interface AuthorizationCardProps {
  challenge: AuthorizationChallenge;
  onGrant: (scope: AIScopeType, addToSources?: boolean) => void;
  onDeny: () => void;
  isLoading?: boolean;
}

export function AuthorizationCard({
  challenge,
  onGrant,
  onDeny,
  isLoading = false,
}: AuthorizationCardProps) {
  return (
    <div className="rounded-xl border border-amber-500/30 bg-amber-500/[0.04] p-4 my-3 text-left space-y-3 backdrop-blur-xs animate-in fade-in slide-in-from-bottom-2 duration-200">
      <div className="flex items-start gap-3">
        <div className="h-8 w-8 rounded-lg bg-amber-500/10 text-amber-500 flex items-center justify-center shrink-0 border border-amber-500/20">
          <ShieldAlert className="h-4 w-4" />
        </div>
        <div className="space-y-1 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-foreground">Autorização de Acesso Necessária</span>
            <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 font-semibold">
              {challenge.title}
            </span>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            {challenge.reason}
          </p>
        </div>
      </div>

      <div className="pt-1 border-t border-border/50">
        <span className="text-[11px] font-semibold text-muted-foreground block mb-2">
          Como deseja autorizar este acesso?
        </span>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={isLoading}
            onClick={() => onGrant("once")}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-border bg-card hover:bg-hover text-foreground transition-colors cursor-pointer disabled:opacity-50"
          >
            <Clock className="h-3.5 w-3.5 text-blue-400" />
            <span>Permitir uma vez</span>
          </button>

          <button
            type="button"
            disabled={isLoading}
            onClick={() => onGrant("conversation")}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-border bg-card hover:bg-hover text-foreground transition-colors cursor-pointer disabled:opacity-50"
          >
            <MessageSquare className="h-3.5 w-3.5 text-emerald-400" />
            <span>Nesta conversa</span>
          </button>

          <button
            type="button"
            disabled={isLoading}
            onClick={() => onGrant("persistent")}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-border bg-card hover:bg-hover text-foreground transition-colors cursor-pointer disabled:opacity-50"
          >
            <Lock className="h-3.5 w-3.5 text-purple-400" />
            <span>Sempre nesta área</span>
          </button>

          <button
            type="button"
            disabled={isLoading}
            onClick={() => onGrant("conversation", true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-blue-500/30 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 transition-colors cursor-pointer disabled:opacity-50"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Adicionar às fontes</span>
          </button>

          <button
            type="button"
            disabled={isLoading}
            onClick={onDeny}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-rose-500/30 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 transition-colors cursor-pointer ml-auto disabled:opacity-50"
          >
            <X className="h-3.5 w-3.5" />
            <span>Não permitir</span>
          </button>
        </div>
      </div>
    </div>
  );
}
