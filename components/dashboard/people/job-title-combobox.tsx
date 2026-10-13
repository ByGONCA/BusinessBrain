"use client";

import React, { useState, useRef, useEffect, useMemo } from "react";
import { Check, ChevronDown, Sparkles, X } from "lucide-react";
import { getCategorizedSuggestedRoles } from "@/lib/organizations/catalog";

interface JobTitleComboboxProps {
  value: string;
  onChange: (value: string) => void;
  teamNames?: string[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export function JobTitleCombobox({
  value,
  onChange,
  teamNames = [],
  placeholder = "Select or type a job title...",
  disabled = false,
  className = "",
}: JobTitleComboboxProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Close when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const { teamRoles, otherRoles } = useMemo(() => {
    return getCategorizedSuggestedRoles(teamNames);
  }, [teamNames]);

  const query = searchQuery.trim().toLowerCase();

  const filteredTeamRoles = useMemo(() => {
    if (!query) return teamRoles;
    return teamRoles.filter((r) => r.toLowerCase().includes(query));
  }, [teamRoles, query]);

  const filteredOtherRoles = useMemo(() => {
    if (!query) return otherRoles;
    return otherRoles.filter((r) => r.toLowerCase().includes(query));
  }, [otherRoles, query]);

  const exactMatchExists = useMemo(() => {
    if (!query) return true;
    return [...teamRoles, ...otherRoles].some((r) => r.toLowerCase() === query);
  }, [teamRoles, otherRoles, query]);

  function handleSelect(role: string) {
    onChange(role);
    setSearchQuery("");
    setIsOpen(false);
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    onChange(val);
    setSearchQuery(val);
    if (!isOpen) setIsOpen(true);
  }

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <div className="relative flex items-center">
        <input
          ref={inputRef}
          type="text"
          disabled={disabled}
          value={value}
          onChange={handleInputChange}
          onFocus={() => {
            setSearchQuery(value);
            setIsOpen(true);
          }}
          placeholder={placeholder}
          className="w-full px-3 py-2 pr-14 text-xs rounded-xl border border-zinc-700 bg-zinc-800/80 text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500 transition-colors disabled:opacity-50"
        />

        <div className="absolute right-2 flex items-center gap-1">
          {value && !disabled && (
            <button
              type="button"
              onClick={() => {
                onChange("");
                setSearchQuery("");
                inputRef.current?.focus();
              }}
              className="p-1 text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer"
              title="Clear title"
            >
              <X className="h-3 w-3" />
            </button>
          )}
          <button
            type="button"
            disabled={disabled}
            onClick={() => {
              if (!isOpen) {
                setSearchQuery(value);
              }
              setIsOpen(!isOpen);
            }}
            className="p-1 text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer"
          >
            <ChevronDown
              className={`h-3.5 w-3.5 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
            />
          </button>
        </div>
      </div>

      {isOpen && (
        <div className="absolute z-50 mt-1 max-h-60 w-full overflow-y-auto rounded-xl border border-zinc-700/80 bg-zinc-900 py-1.5 shadow-2xl backdrop-blur-md text-xs">
          {/* Custom entry option if typed text doesn't match predefined roles */}
          {query && !exactMatchExists && (
            <button
              type="button"
              onClick={() => handleSelect(searchQuery.trim())}
              className="w-full flex items-center gap-2 px-3 py-2 text-left text-blue-400 hover:bg-blue-600/15 font-medium transition-colors border-b border-zinc-800/80"
            >
              <Sparkles className="h-3.5 w-3.5 shrink-0 text-blue-400" />
              <span className="truncate">
                Use custom: <span className="font-semibold text-white">&ldquo;{searchQuery.trim()}&rdquo;</span>
              </span>
            </button>
          )}

          {/* Team-specific suggested roles */}
          {filteredTeamRoles.length > 0 && (
            <div>
              <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-blue-400/90 bg-blue-950/30">
                Suggested for {teamNames.length === 1 ? teamNames[0] : "your teams"}
              </div>
              {filteredTeamRoles.map((role) => {
                const isSelected = value.trim().toLowerCase() === role.toLowerCase();
                return (
                  <button
                    key={role}
                    type="button"
                    onClick={() => handleSelect(role)}
                    className={`w-full flex items-center justify-between px-3 py-1.5 text-left transition-colors cursor-pointer ${
                      isSelected
                        ? "bg-blue-600/20 text-blue-300 font-semibold"
                        : "text-zinc-200 hover:bg-zinc-800/80"
                    }`}
                  >
                    <span className="truncate">{role}</span>
                    {isSelected && <Check className="h-3.5 w-3.5 text-blue-400 shrink-0 ml-2" />}
                  </button>
                );
              })}
            </div>
          )}

          {/* Other suggested roles */}
          {filteredOtherRoles.length > 0 && (
            <div>
              {filteredTeamRoles.length > 0 && (
                <div className="px-3 py-1 mt-1 text-[10px] font-bold uppercase tracking-wider text-zinc-500 bg-zinc-800/40">
                  Other suggested roles
                </div>
              )}
              {filteredOtherRoles.map((role) => {
                const isSelected = value.trim().toLowerCase() === role.toLowerCase();
                return (
                  <button
                    key={role}
                    type="button"
                    onClick={() => handleSelect(role)}
                    className={`w-full flex items-center justify-between px-3 py-1.5 text-left transition-colors cursor-pointer ${
                      isSelected
                        ? "bg-blue-600/20 text-blue-300 font-semibold"
                        : "text-zinc-200 hover:bg-zinc-800/80"
                    }`}
                  >
                    <span className="truncate">{role}</span>
                    {isSelected && <Check className="h-3.5 w-3.5 text-blue-400 shrink-0 ml-2" />}
                  </button>
                );
              })}
            </div>
          )}

          {filteredTeamRoles.length === 0 && filteredOtherRoles.length === 0 && !query && (
            <div className="px-3 py-2 text-zinc-500 text-center italic">No suggested roles found</div>
          )}
        </div>
      )}
    </div>
  );
}
