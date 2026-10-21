"use client";

import * as React from "react";
import { Check, Circle } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  PASSWORD_REQUIREMENTS,
  PasswordValidationResult,
} from "@/lib/auth/password-rules";

interface PasswordChecklistProps {
  validation: PasswordValidationResult;
  showAlways?: boolean;
  touched?: boolean;
}

export function PasswordChecklist({
  validation,
  showAlways = false,
  touched = false,
}: PasswordChecklistProps) {
  const { results, allMet, metCount, totalCount, strength } = validation;
  const isVisible = showAlways || touched;

  if (!isVisible) {
    return null;
  }

  const strengthLabels: Record<PasswordValidationResult["strength"], string> = {
    none: "Too short",
    weak: "Weak",
    fair: "Fair",
    good: "Good",
    strong: "Strong",
  };

  const strengthColors: Record<PasswordValidationResult["strength"], string> = {
    none: "text-[#71717A]",
    weak: "text-rose-400",
    fair: "text-amber-400",
    good: "text-blue-400",
    strong: "text-emerald-400",
  };

  const barColor =
    strength === "strong"
      ? "bg-emerald-500"
      : strength === "good"
      ? "bg-blue-500"
      : strength === "fair"
      ? "bg-amber-500"
      : strength === "weak"
      ? "bg-rose-500"
      : "bg-[#27272A]";

  return (
    <div
      className={cn(
        "rounded-lg border border-[#242427] bg-[#0E0E10] p-3 text-xs space-y-2.5 transition-all duration-200",
        allMet && "border-emerald-500/30 bg-emerald-950/10"
      )}
      role="region"
      aria-label="Password requirements"
    >
      {/* Strength indicator header */}
      <div className="flex items-center justify-between text-[11px]">
        <span className="text-[#A1A1AA] font-medium">Password strength</span>
        <span className={cn("font-medium transition-colors", strengthColors[strength])}>
          {strengthLabels[strength]} ({metCount}/{totalCount})
        </span>
      </div>

      {/* Progress bar */}
      <div className="flex gap-1.5" aria-hidden="true">
        {Array.from({ length: totalCount }).map((_, idx) => (
          <div
            key={idx}
            className={cn(
              "h-1 flex-1 rounded-full transition-all duration-300",
              idx < metCount ? barColor : "bg-[#242427]"
            )}
          />
        ))}
      </div>

      {/* Requirements checklist */}
      <ul className="space-y-1.5 pt-0.5" aria-label="Requirements list">
        {PASSWORD_REQUIREMENTS.map((req) => {
          const isSatisfied = results[req.id];
          return (
            <li
              key={req.id}
              className={cn(
                "flex items-center gap-2 text-xs transition-colors duration-150",
                isSatisfied ? "text-[#E4E4E7]" : "text-[#71717A]"
              )}
            >
              {isSatisfied ? (
                <Check className="h-3.5 w-3.5 shrink-0 text-emerald-400" aria-hidden="true" />
              ) : (
                <Circle className="h-2 w-2 shrink-0 ml-0.5 mr-1 text-[#52525B] fill-[#52525B]" aria-hidden="true" />
              )}
              <span className={cn(isSatisfied && "font-medium")}>{req.label}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
