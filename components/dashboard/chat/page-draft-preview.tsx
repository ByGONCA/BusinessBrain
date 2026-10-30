"use client";

import * as React from "react";
import { FileText, CheckCircle2, ArrowRight, Loader2, X } from "lucide-react";
import { PageDraft } from "@/lib/ai/pages/types";
import { savePageDraftAction } from "@/lib/ai/pages/actions";
import Link from "next/link";

interface PageDraftPreviewProps {
  draft: PageDraft;
  onDismiss: () => void;
}

export function PageDraftPreview({ draft, onDismiss }: PageDraftPreviewProps) {
  const [isSaving, setIsSaving] = React.useState(false);
  const [savedUrl, setSavedUrl] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);
    try {
      const res = await savePageDraftAction(draft);
      if (res.success && res.url) {
        setSavedUrl(res.url);
      } else {
        setError(res.error || "Falha ao gravar página no workspace.");
      }
    } catch {
      setError("Erro de rede ao gravar página.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="rounded-xl border border-blue-500/30 bg-blue-500/[0.03] p-4 my-3 text-left space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-200">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center shrink-0 border border-blue-500/20 text-base">
            {draft.icon || "📄"}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-foreground">{draft.title}</span>
              <span className="text-[10px] uppercase font-mono px-1.5 py-0.2 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20 font-semibold">
                Antevisão de Rascunho
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground">
              {draft.blocks.length} blocos nativos estruturados prontos para incorporação.
            </p>
          </div>
        </div>

        {!savedUrl && (
          <button
            type="button"
            onClick={onDismiss}
            className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-hover transition-colors"
            title="Descartar rascunho"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {draft.summary && (
        <p className="text-xs text-muted-foreground bg-card/60 p-2.5 rounded-lg border border-border/50">
          💡 {draft.summary}
        </p>
      )}

      {/* Render native block previews */}
      <div className="max-h-56 overflow-y-auto space-y-1.5 p-3 rounded-lg border border-border/40 bg-background/50 text-xs">
        {draft.blocks.map((block) => {
          if (block.type === "heading_1") {
            return <div key={block.id} className="text-sm font-bold text-foreground pt-1">{block.content}</div>;
          }
          if (block.type === "heading_2") {
            return <div key={block.id} className="text-xs font-bold text-foreground pt-1">{block.content}</div>;
          }
          if (block.type === "bullet_list") {
            return (
              <div key={block.id} className="flex items-start gap-1.5 text-muted-foreground pl-2">
                <span className="text-foreground">•</span>
                <span>{block.content}</span>
              </div>
            );
          }
          if (block.type === "callout") {
            return (
              <div key={block.id} className="p-2 rounded bg-muted/40 border border-border/50 text-[11px] text-muted-foreground">
                {block.properties?.calloutIcon || "💡"} {block.content}
              </div>
            );
          }
          return <div key={block.id} className="text-muted-foreground leading-relaxed">{block.content}</div>;
        })}
      </div>

      {error && (
        <p className="text-xs text-rose-400 bg-rose-500/10 p-2 rounded border border-rose-500/20">
          {error}
        </p>
      )}

      {/* Action / Confirmation Footer */}
      <div className="pt-1 flex items-center justify-between">
        <span className="text-[10px] text-muted-foreground">
          Exige confirmação humana explícita antes de gravar.
        </span>

        {savedUrl ? (
          <Link
            href={savedUrl}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/20 transition-colors"
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            <span>Página Gravada • Abrir no Editor</span>
            <ArrowRight className="h-3 w-3" />
          </Link>
        ) : (
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={isSaving}
              onClick={onDismiss}
              className="px-3 py-1.5 text-xs rounded-lg border border-border hover:bg-hover transition-colors text-foreground"
            >
              Descartar
            </button>
            <button
              type="button"
              disabled={isSaving}
              onClick={handleSave}
              className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors shadow-xs disabled:opacity-50 cursor-pointer"
            >
              {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
              <span>Gravar no Workspace</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
