"use client";

// ==============================================================================
// KogSync: Model Selector Dropdown
// Clean, accessible model picker with Provider Logos & Zero White Borders.
// ==============================================================================

import React, { useState, useRef, useEffect } from "react";
import { ChevronDown, Check, Settings, ExternalLink, Zap } from "lucide-react";
import { useLanguage } from "@/lib/i18n";
import { MODEL_CATALOG } from "@/lib/ai/catalog/models";

interface ModelSelectorDropdownProps {
  selectedModelId?: string | null;
  configuredProviders?: string[];
  dropDirection?: "up" | "down";
  align?: "left" | "right";
  onSelectModel: (modelId: string) => void;
  onOpenSettings?: () => void;
  onOpenLimits?: () => void;
}

export function ProviderLogo({
  provider,
  className = "h-3.5 w-3.5 object-contain shrink-0",
}: {
  provider?: string;
  className?: string;
}) {
  if (!provider) return null;
  const p = provider.toLowerCase();
  let src = "";

  if (p === "google" || p === "gemini") {
    src = "/Logos/google-gemini-icon.svg";
  } else if (p === "openai") {
    src = "/Logos/openai-icon.svg";
  } else if (p === "anthropic") {
    src = "/Logos/anthropic-icon.svg";
  } else if (p === "mistral") {
    src = "/Logos/mistral-ai-icon.svg";
  } else if (p === "perplexity") {
    src = "/Logos/perplexity-icon.svg";
  } else if (p === "deepseek") {
    src = "/Logos/deepseek-icon.svg";
  } else if (p === "xai") {
    src = "/Logos/x-ai.svg";
  } else {
    src = "/Logos/google-gemini-icon.svg";
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={provider}
      className={className}
      onError={(e) => {
        (e.target as HTMLElement).style.display = "none";
      }}
    />
  );
}

export function ModelSelectorDropdown({
  selectedModelId,
  configuredProviders = ["gemini"],
  dropDirection = "down",
  align = "left",
  onSelectModel,
  onOpenSettings,
  onOpenLimits,
}: ModelSelectorDropdownProps) {
  const { locale } = useLanguage();
  const isPt = locale === "pt";

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

  // Find active model or fallback to gemini-2.5-flash
  const activeModel =
    MODEL_CATALOG.find((m) => m.id === selectedModelId || m.realModelId === selectedModelId) ||
    MODEL_CATALOG.find((m) => m.id === "gemini-2.5-flash") ||
    MODEL_CATALOG[0];

  const currentLabel = activeModel ? activeModel.displayName : "Gemini 2.5 Flash";

  const availableModels = MODEL_CATALOG.filter(
    (m) => m.isSystemProvided || configuredProviders.includes(m.provider)
  );

  const unconfiguredModels = MODEL_CATALOG.filter(
    (m) => !m.isSystemProvided && !configuredProviders.includes(m.provider)
  );

  return (
    <div className="relative inline-block text-left" ref={containerRef}>
      {/* Trigger Button - subtle dark borders, zero stark white */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        className="flex items-center gap-1.5 rounded-lg border border-border bg-card/90 px-2.5 py-1 text-xs text-zinc-300 transition-colors hover:bg-surface-secondary hover:border-border-strong hover:text-zinc-100 focus:outline-none cursor-pointer shadow-2xs"
      >
        {activeModel && (
          <ProviderLogo provider={activeModel.provider} className="h-3.5 w-3.5 object-contain shrink-0" />
        )}
        <span className="font-medium text-xs">{currentLabel}</span>
        <ChevronDown className="h-3 w-3 text-zinc-400 opacity-75" />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div
          role="listbox"
          className={`absolute ${align === "right" ? "right-0" : "left-0"} ${
            dropDirection === "up" ? "bottom-full mb-1.5" : "mt-1.5"
          } z-50 w-64 rounded-xl border border-border bg-card p-1.5 shadow-2xl backdrop-blur-xl animate-in fade-in-0 zoom-in-95 duration-100 text-left`}
        >
          {/* Available Models Group - Included in Platform Plans */}
          <div className="flex items-center justify-between px-2 py-1 text-[10px] font-semibold tracking-wider text-zinc-400 uppercase">
            <span>{isPt ? "Modelos Incluídos (KogSync)" : "Included Models (KogSync)"}</span>
            <span className="text-[9px] text-emerald-400/90 font-normal">
              {isPt ? "No Plano" : "Included"}
            </span>
          </div>

          <div className="space-y-0.5 max-h-64 overflow-y-auto pr-1">
            {availableModels.map((model) => {
              const isSelected = activeModel?.id === model.id;
              const multiplier = model.creditMultiplier ?? 1;
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
                  className={`flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-xs text-left transition-colors cursor-pointer ${
                    isSelected
                      ? "bg-white/[0.07] text-white font-medium"
                      : "text-zinc-400 hover:text-zinc-100 hover:bg-surface-secondary"
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <ProviderLogo provider={model.provider} className="h-3.5 w-3.5 object-contain shrink-0" />
                    <span className="truncate">{model.displayName}</span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-[10px] text-zinc-500 font-mono">
                      {multiplier}x
                    </span>
                    {isSelected && <Check className="h-3.5 w-3.5 text-zinc-200 shrink-0" />}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Unconfigured Models Group */}
          {unconfiguredModels.length > 0 && (
            <>
              <div className="my-1 border-t border-border" />
              <div className="px-2 py-1 text-[10px] font-semibold tracking-wider text-zinc-400 uppercase">
                {isPt ? "Chave Própria (BYOK)" : "Bring Your Own Key (BYOK)"}
              </div>
              <div className="space-y-0.5">
                {unconfiguredModels.slice(0, 4).map((model) => (
                  <div
                    key={model.id}
                    className="flex items-center justify-between rounded-lg px-2.5 py-1.5 text-xs text-zinc-500"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <ProviderLogo provider={model.provider} className="h-3.5 w-3.5 object-contain shrink-0 opacity-50" />
                      <span className="truncate">{model.displayName}</span>
                    </div>
                    {onOpenSettings && (
                      <button
                        type="button"
                        onClick={() => {
                          setIsOpen(false);
                          onOpenSettings();
                        }}
                        className="text-[10px] text-zinc-400 hover:text-zinc-200 hover:underline ml-2"
                      >
                        {isPt ? "Ativar" : "Enable"}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Account Limits Shortcut */}
          {onOpenLimits && (
            <>
              <div className="my-1 border-t border-border" />
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  onOpenLimits();
                }}
                className="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-xs text-zinc-300 hover:bg-surface-secondary hover:text-white cursor-pointer"
              >
                <div className="flex items-center gap-1.5">
                  <Zap className="h-3.5 w-3.5 text-amber-400" />
                  <span>{isPt ? "Ver Limites da Conta" : "View Account Limits"}</span>
                </div>
                <ExternalLink className="h-3 w-3 opacity-60" />
              </button>
            </>
          )}

          {/* Settings Shortcut */}
          {onOpenSettings && (
            <>
              <div className="my-1 border-t border-border" />
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  onOpenSettings();
                }}
                className="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-xs text-zinc-400 hover:bg-surface-secondary hover:text-zinc-200 cursor-pointer"
              >
                <div className="flex items-center gap-1.5">
                  <Settings className="h-3.5 w-3.5" />
                  <span>{isPt ? "Gerir Fornecedores" : "Manage Providers"}</span>
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
