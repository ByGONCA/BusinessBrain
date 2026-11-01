"use client";

import * as React from "react";
import { ChevronDown, Check } from "lucide-react";
import { cn } from "@/lib/utils";

export interface FilterOption {
  value: string;
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  badge?: React.ReactNode;
}

export interface FilterDropdownButtonProps {
  label: string;
  value: string;
  options: FilterOption[];
  onChange: (value: string) => void;
  icon?: React.ComponentType<{ className?: string }>;
  defaultValue?: string;
  className?: string;
}

export function FilterDropdownButton({
  label,
  value,
  options,
  onChange,
  icon: Icon,
  defaultValue = "all",
  className,
}: FilterDropdownButtonProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);

  // Find active option
  const activeOption = options.find((opt) => opt.value === value) || options[0];
  const isFiltered = value !== defaultValue;

  // Click outside listener
  React.useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  return (
    <div ref={containerRef} className={cn("relative inline-block text-left", className)}>
      {/* Interactive Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={`${label}: ${activeOption?.label || value}`}
        className={cn(
          "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all select-none cursor-pointer focus:outline-none focus:ring-1 focus:ring-zinc-400 focus:border-zinc-400",
          isFiltered
            ? "border-blue-500/50 bg-blue-50/50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 shadow-2xs font-semibold"
            : "border-border bg-background hover:bg-muted/50 text-foreground hover:border-zinc-300 dark:hover:border-zinc-700"
        )}
      >
        {Icon && (
          <Icon
            className={cn(
              "h-3.5 w-3.5 shrink-0",
              isFiltered ? "text-blue-500" : "text-muted-foreground"
            )}
          />
        )}
        <span className="text-muted-foreground font-normal">{label}:</span>
        <span className={cn("truncate max-w-[120px] sm:max-w-[160px]", isFiltered ? "font-semibold" : "font-medium")}>
          {activeOption?.label || value}
        </span>
        <ChevronDown
          className={cn(
            "h-3 w-3 text-muted-foreground shrink-0 transition-transform duration-200",
            isOpen && "rotate-180 text-foreground"
          )}
        />
      </button>

      {/* Popover Options List */}
      {isOpen && (
        <div
          role="listbox"
          tabIndex={-1}
          className="absolute left-0 sm:right-0 sm:left-auto top-full mt-1 z-50 min-w-[190px] max-h-64 overflow-y-auto rounded-xl border border-border bg-popover/95 backdrop-blur-md p-1 shadow-xl animate-in fade-in-0 zoom-in-95 duration-150"
        >
          <div className="px-2 py-1 text-[10px] uppercase font-mono tracking-wider text-muted-foreground border-b border-border/50 mb-1">
            Filtrar por {label}
          </div>
          {options.map((opt) => {
            const isSelected = opt.value === value;
            const OptIcon = opt.icon;

            return (
              <button
                key={opt.value}
                type="button"
                role="option"
                aria-selected={isSelected}
                onClick={() => {
                  onChange(opt.value);
                  setIsOpen(false);
                }}
                className={cn(
                  "w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg text-xs text-left transition-colors cursor-pointer",
                  isSelected
                    ? "bg-blue-500/10 text-blue-600 dark:text-blue-300 font-semibold"
                    : "text-foreground hover:bg-muted/70 hover:text-foreground"
                )}
              >
                <div className="flex items-center gap-2 truncate">
                  {OptIcon && (
                    <OptIcon
                      className={cn(
                        "h-3.5 w-3.5 shrink-0",
                        isSelected ? "text-blue-500" : "text-muted-foreground"
                      )}
                    />
                  )}
                  <span className="truncate">{opt.label}</span>
                  {opt.badge}
                </div>
                {isSelected && (
                  <Check className="h-3.5 w-3.5 text-blue-500 shrink-0 stroke-[2.5]" />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
