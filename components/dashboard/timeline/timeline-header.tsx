"use client";

import * as React from "react";
import { PhosphorClock } from "@/components/icons";
import { useLanguage, en } from "@/lib/i18n";

export function TimelineHeader() {
  const { t } = useLanguage();
  const c = t?.companyTimeline || en.companyTimeline;

  return (
    <div className="flex items-center gap-2.5">
      <PhosphorClock className="h-5 w-5 text-blue-500" />
      <h1 className="text-xl font-bold tracking-tight text-white">{c.title}</h1>
    </div>
  );
}
