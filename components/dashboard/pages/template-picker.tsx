"use client";

import * as React from "react";
import { PAGE_TEMPLATES } from "@/lib/pages/templates";
import { PageTemplate, EditorBlock } from "@/lib/pages/types";
import { Sparkles, FileText, CheckCircle2 } from "lucide-react";

interface TemplatePickerProps {
  onApplyTemplate: (template: PageTemplate) => void;
}

export function TemplatePicker({ onApplyTemplate }: TemplatePickerProps) {
  return (
    <div className="py-6 space-y-4">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-zinc-400">
        <Sparkles className="h-3.5 w-3.5 text-blue-500" />
        Start with a template
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {PAGE_TEMPLATES.map((tmpl) => (
          <button
            key={tmpl.id}
            type="button"
            onClick={() => onApplyTemplate(tmpl)}
            className="flex flex-col text-left p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800/80 bg-zinc-50/50 dark:bg-zinc-900/40 hover:bg-zinc-100/80 dark:hover:bg-zinc-800/60 hover:border-zinc-300 dark:hover:border-zinc-700 transition-all duration-150 group"
          >
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-xl select-none">{tmpl.icon}</span>
              <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                {tmpl.name}
              </span>
            </div>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-relaxed line-clamp-2">
              {tmpl.description}
            </p>
          </button>
        ))}
      </div>
    </div>
  );
}
