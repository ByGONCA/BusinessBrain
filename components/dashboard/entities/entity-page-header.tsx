"use client";

import * as React from "react";
import Link from "next/link";
import { Plus, ArrowUpRight } from "lucide-react";
import { CreateEntityModal } from "./create-entity-modal";
import { CompanyEntityType } from "@/lib/entities/types";

interface EntityPageHeaderProps {
  title: string;
  description: string;
  entityType: CompanyEntityType;
  createButtonText: string;
  graphHref?: string;
}

export function EntityPageHeader({
  title,
  description,
  entityType,
  createButtonText,
  graphHref = "/dashboard/connections",
}: EntityPageHeaderProps) {
  const [isModalOpen, setIsModalOpen] = React.useState(false);

  return (
    <>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground">{title}</h1>
          <p className="mt-1 text-xs text-muted-foreground">{description}</p>
        </div>

        <div className="flex items-center gap-2">
          {graphHref && (
            <Link
              href={graphHref}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-secondary-foreground hover:bg-hover hover:text-foreground transition-colors shadow-2xs"
            >
              <span>View in Graph</span>
              <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground" />
            </Link>
          )}

          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white px-3 py-1.5 text-xs font-medium transition-colors shadow-2xs"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>{createButtonText}</span>
          </button>
        </div>
      </div>

      <CreateEntityModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        defaultType={entityType}
      />
    </>
  );
}
