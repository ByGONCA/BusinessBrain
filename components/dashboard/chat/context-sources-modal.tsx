"use client";

import * as React from "react";
import {
  X,
  Search,
  Database,
  FileText,
  CreditCard,
  Github,
  Brain,
  Check,
  Lock,
  ShieldCheck,
  AlertCircle,
} from "lucide-react";
import { ContextSourceItem } from "@/lib/ai/auth/types";
import { getAvailableContextSourcesAction } from "@/lib/ai/auth/actions";

interface ContextSourcesModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedSourceIds: string[];
  onApplySources: (newIds: string[]) => void;
}

export function ContextSourcesModal({
  isOpen,
  onClose,
  selectedSourceIds,
  onApplySources,
}: ContextSourcesModalProps) {
  const [sources, setSources] = React.useState<ContextSourceItem[]>([]);
  const [selected, setSelected] = React.useState<Set<string>>(new Set(selectedSourceIds));
  const [search, setSearch] = React.useState("");
  const [isLoading, setIsLoading] = React.useState(false);

  React.useEffect(() => {
    if (isOpen) {
      setSelected(new Set(selectedSourceIds));
      setIsLoading(true);
      getAvailableContextSourcesAction().then((res) => {
        setIsLoading(false);
        if (res.success && res.sources) {
          setSources(res.sources);
        }
      });
    }
  }, [isOpen, selectedSourceIds]);

  if (!isOpen) return null;

  const toggleSource = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const selectAll = () => {
    const accessible = sources.filter((s) => s.hasAccess).map((s) => s.id);
    setSelected(new Set(accessible));
  };

  const selectPagesOnly = () => {
    const pagesOnly = sources
      .filter((s) => s.hasAccess && (s.id === "area:pages" || s.type === "page"))
      .map((s) => s.id);
    setSelected(new Set(pagesOnly));
  };

  const clearAll = () => {
    setSelected(new Set());
  };

  const handleSave = () => {
    onApplySources(Array.from(selected));
    onClose();
  };

  const filteredSources = sources.filter((s) =>
    s.label.toLowerCase().includes(search.toLowerCase()) ||
    (s.description && s.description.toLowerCase().includes(search.toLowerCase()))
  );

  const getSourceIcon = (type: string, id: string) => {
    if (id.includes("finance")) return <CreditCard className="h-4 w-4 text-emerald-400" />;
    if (id.includes("github")) return <Github className="h-4 w-4 text-purple-400" />;
    if (id.includes("brain")) return <Brain className="h-4 w-4 text-blue-400" />;
    return <FileText className="h-4 w-4 text-zinc-400" />;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-card border border-border w-full max-w-lg rounded-2xl shadow-2xl flex flex-col max-h-[85vh] overflow-hidden text-left">
        {/* Header */}
        <div className="p-4 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center border border-blue-500/20">
              <Database className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-foreground">Fontes de Contexto da IA</h2>
              <p className="text-[11px] text-muted-foreground">
                Selecione as fontes que a IA tem autorização para consultar nesta sessão.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-hover transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Filter Bar & Quick Selectors */}
        <div className="p-3 border-b border-border/60 bg-muted/20 space-y-2">
          <div className="relative">
            <Search className="h-3.5 w-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filtrar áreas ou documentos..."
              className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-border bg-background focus:outline-none focus:ring-1 focus:ring-primary text-foreground placeholder:text-muted-foreground"
            />
          </div>

          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
            <span>{selected.size} fontes selecionadas</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={selectAll}
                className="hover:text-foreground transition-colors cursor-pointer"
              >
                Todas
              </button>
              <span>•</span>
              <button
                type="button"
                onClick={selectPagesOnly}
                className="hover:text-foreground transition-colors cursor-pointer"
              >
                Apenas Páginas
              </button>
              <span>•</span>
              <button
                type="button"
                onClick={clearAll}
                className="hover:text-rose-400 transition-colors cursor-pointer"
              >
                Limpar
              </button>
            </div>
          </div>
        </div>

        {/* Source List Tree */}
        <div className="flex-1 overflow-y-auto p-3 space-y-1">
          {isLoading ? (
            <div className="py-12 text-center text-xs text-muted-foreground">
              A carregar fontes disponíveis...
            </div>
          ) : filteredSources.length === 0 ? (
            <div className="py-8 text-center text-xs text-muted-foreground">
              Nenhuma fonte encontrada para o filtro.
            </div>
          ) : (
            filteredSources.map((item) => {
              const isChecked = selected.has(item.id);
              const isDisabled = !item.hasAccess;

              return (
                <div
                  key={item.id}
                  onClick={() => !isDisabled && toggleSource(item.id)}
                  className={`flex items-start gap-3 p-2.5 rounded-xl border transition-colors cursor-pointer ${
                    isChecked
                      ? "border-primary/40 bg-primary/[0.04]"
                      : "border-border/40 hover:bg-hover bg-background/50"
                  } ${isDisabled ? "opacity-40 cursor-not-allowed hover:bg-transparent" : ""}`}
                >
                  <div
                    className={`h-4 w-4 rounded mt-0.5 flex items-center justify-center shrink-0 border transition-colors ${
                      isChecked
                        ? "bg-primary border-primary text-primary-foreground"
                        : "border-border bg-card"
                    }`}
                  >
                    {isChecked && <Check className="h-3 w-3 stroke-[3]" />}
                  </div>

                  <div className="flex items-center gap-2 shrink-0 mt-0.5">
                    {getSourceIcon(item.type, item.id)}
                  </div>

                  <div className="flex-1 min-w-0 space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-foreground truncate">
                        {item.label}
                      </span>
                      {item.requiresExplicitGrant && (
                        <span className="text-[9px] uppercase font-mono px-1 py-0.2 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 font-bold shrink-0">
                          Restrito
                        </span>
                      )}
                    </div>
                    {item.description && (
                      <p className="text-[11px] text-muted-foreground line-clamp-1">
                        {item.description}
                      </p>
                    )}
                  </div>

                  {isDisabled && (
                    <div className="flex items-center gap-1 text-[10px] text-muted-foreground shrink-0 mt-0.5" title="Sem permissão">
                      <Lock className="h-3 w-3 text-zinc-500" />
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-border flex items-center justify-between bg-card">
          <p className="text-[10px] text-muted-foreground max-w-[60%]">
            O servidor restringe a recuperação estritamente às fontes marcadas.
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 text-xs rounded-lg border border-border hover:bg-hover transition-colors text-foreground"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-4 py-1.5 text-xs font-medium rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors shadow-xs"
            >
              Aplicar Fontes
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
