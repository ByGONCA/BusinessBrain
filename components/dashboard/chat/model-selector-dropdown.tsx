"use client";

// ==============================================================================
// Company Brain: Model Selector Dropdown
// Clean, accessible, executive model picker with Automatic, Available and Unconfigured groups.
// Strictly adheres to AGENTS.md: zero fake button pill badges, subtle semantic dots.
// ==============================================================================

import React, { useState, useRef, useEffect } from "react";
import { Sparkles, ChevronDown, Check, Settings, ExternalLink } from "lucide-react";
import { MODEL_CATALOG } from "@/lib/ai/catalog/models";
import { ModelMetadata } from "@/lib/ai/catalog/types";

interface ModelSelectorDropdownProps {
  selectedModelId?: string | null;
  isAutomatic?: boolean;
  configuredProviders?: string[];
  onSelectModel: (modelId: string | null) => void;
  onOpenSettings?: () => void;
}

export function ModelSelectorDropdown({
  selectedModelId,
  isAutomatic = true,
  configuredProviders = ["gemini"],
  onSelectModel,
  onOpenSettings,
}: ModelSelectorDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Close on Escape
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const activeModel = selectedModelId
    ? MODEL_CATALOG.find((m) => m.id === selectedModelId || m.realModelId === selectedModelId)
    : null;

  const currentLabel = isAutomatic
    ? "Automático"
    : activeModel
    ? activeModel.displayName
    : "Gemini 2.5 Flash";

  const availableModels = MODEL_CATALOG.filter(
    (m) => m.isSystemProvided || configuredProviders.includes(m.provider)
  );

  const unconfiguredModels = MODEL_CATALOG.filter(
    (m) => !m.isSystemProvided && !configuredProviders.includes(m.provider)
  );

  return (
    <div className="relative inline-block text-left" ref={containerRef}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        className="flex items-center gap-2 rounded-xl border border-white/[0.08] bg-[#121316] px-3 py-1.5 text-xs text-zinc-300 transition-colors hover:border-white/[0.15] hover:bg-[#16181D] hover:text-white focus:outline-none focus:ring-1 focus:ring-blue-500/50"
      >
        {isAutomatic ? (
          <Sparkles className="h-3.5 w-3.5 text-blue-400" />
        ) : (
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
        )}
        <span className="font-medium text-zinc-200">{currentLabel}</span>
        <ChevronDown className="h-3 w-3 text-zinc-400 opacity-70" />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div
          role="listbox"
          className="absolute left-0 z-50 mt-1.5 w-72 rounded-xl border border-white/[0.08] bg-[#121316] p-1.5 shadow-2xl backdrop-blur-xl animate-in fade-in-0 zoom-in-95 duration-100"
        >
          {/* Automatic Mode */}
          <button
            type="button"
            role="option"
            aria-selected={isAutomatic}
            onClick={() => {
              onSelectModel(null);
              setIsOpen(false);
            }}
            className={`flex w-full items-start gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors ${
              isAutomatic
                ? "bg-white/[0.06] text-white"
                : "text-zinc-300 hover:bg-white/[0.04] hover:text-white"
            }`}
          >
            <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-blue-400" />
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium">Modo Automático</span>
                {isAutomatic && <Check className="h-3.5 w-3.5 text-blue-400" />}
              </div>
              <p className="text-[11px] text-zinc-400">
                Encaminhamento inteligente com proteção de custos e menor latência
              </p>
            </div>
          </button>

          <div className="my-1.5 border-t border-white/[0.06]" />

          {/* Available Models Group */}
          <div className="px-2 py-1 text-[10px] font-semibold tracking-wider text-zinc-400 uppercase">
            Modelos Ativos & Prontos
          </div>

          <div className="space-y-0.5">
            {availableModels.map((model) => {
              const isSelected = !isAutomatic && activeModel?.id === model.id;
              return (
                <button
                  key={model.id}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => {
                    onSelectModel(model.realModelId);
                    setIsOpen(false);
                  }}
                  className={`flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left transition-colors ${
                    isSelected
                      ? "bg-white/[0.06] text-white"
                      : "text-zinc-300 hover:bg-white/[0.04] hover:text-white"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                    <div>
                      <div className="text-xs font-medium">{model.displayName}</div>
                      <div className="text-[10px] text-zinc-400">
                        {model.limits.contextWindowTokens >= 1_000_000
                          ? "1M+ contexto"
                          : `${Math.round(model.limits.contextWindowTokens / 1000)}k contexto`}{" "}
                        • {model.latencyProfile === "ultra_low" ? "Rápido" : "Avançado"}
                      </div>
                    </div>
                  </div>
                  {isSelected && <Check className="h-3.5 w-3.5 text-emerald-400" />}
                </button>
              );
            })}
          </div>

          {/* Unconfigured Models Group */}
          {unconfiguredModels.length > 0 && (
            <>
              <div className="my-1.5 border-t border-white/[0.06]" />
              <div className="px-2 py-1 text-[10px] font-semibold tracking-wider text-zinc-400 uppercase">
                Disponíveis via Chave Própria (BYOK)
              </div>
              <div className="space-y-0.5">
                {unconfiguredModels.slice(0, 3).map((model) => (
                  <div
                    key={model.id}
                    className="flex items-center justify-between rounded-lg px-2.5 py-1.5 text-xs text-zinc-400 opacity-60"
                  >
                    <div className="flex items-center gap-2">
                      <span className="h-1.5 w-1.5 rounded-full bg-zinc-600" />
                      <span>{model.displayName}</span>
                    </div>
                    {onOpenSettings && (
                      <button
                        type="button"
                        onClick={() => {
                          setIsOpen(false);
                          onOpenSettings();
                        }}
                        className="text-[10px] text-blue-400 hover:text-blue-300"
                      >
                        Configurar
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Settings Shortcut */}
          {onOpenSettings && (
            <>
              <div className="my-1.5 border-t border-white/[0.06]" />
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  onOpenSettings();
                }}
                className="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-xs text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-200"
              >
                <div className="flex items-center gap-1.5">
                  <Settings className="h-3.5 w-3.5" />
                  <span>Gerir Fornecedores & Chaves</span>
                </div>
                <ExternalLink className="h-3 w-3 opacity-60" />
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
