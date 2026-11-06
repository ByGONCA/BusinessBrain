"use client";

import * as React from "react";
import { WidgetInstanceConfig } from "@/lib/widgets/types";
import { Calendar, Video, Clock, Users, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";

export interface AgendaEventItem {
  id: string;
  title: string;
  startTime: string; // ISO or formatted
  endTime?: string;
  location?: string;
  meetUrl?: string;
  attendeesCount?: number;
  category?: string;
}

interface AgendaVisualizerProps {
  widget: WidgetInstanceConfig;
  events?: AgendaEventItem[];
  height?: number;
}

export function AgendaVisualizer({
  widget: _widget,
  events = [],
  height = 240,
}: AgendaVisualizerProps) {
  if (events.length === 0) {
    return (
      <div
        className="flex flex-col items-center justify-center p-6 text-center select-none"
        style={{ minHeight: `${height}px` }}
      >
        <div className="p-3 rounded-xl bg-surface-secondary text-muted-foreground mb-2">
          <Calendar className="h-6 w-6" />
        </div>
        <p className="text-xs font-semibold text-foreground">Sem reuniões agendadas</p>
        <p className="text-[11px] text-muted-foreground mt-0.5">
          Todas as sessões de alinhamento e chamadas estão em dia.
        </p>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-2.5 select-none" style={{ minHeight: `${height}px` }}>
      {events.slice(0, 5).map((ev) => {
        const hasMeetLink = Boolean(ev.meetUrl);

        return (
          <div
            key={ev.id}
            className="flex items-center justify-between p-3 rounded-xl bg-surface-secondary hover:bg-hover transition-colors border border-border/40 group"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="h-8 w-8 rounded-lg bg-blue-500/10 text-blue-500 flex items-center justify-center shrink-0">
                {hasMeetLink ? <Video className="h-4 w-4" /> : <Clock className="h-4 w-4" />}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-foreground truncate group-hover:text-blue-400 transition-colors">
                  {ev.title}
                </p>
                <div className="flex items-center gap-2 text-[10px] text-muted-foreground font-mono mt-0.5">
                  <span>{ev.startTime}</span>
                  {ev.attendeesCount ? (
                    <span className="flex items-center gap-0.5 text-zinc-400">
                      <Users className="h-3 w-3" />
                      {ev.attendeesCount}
                    </span>
                  ) : null}
                </div>
              </div>
            </div>

            {hasMeetLink ? (
              <a
                href={ev.meetUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-semibold transition-colors shrink-0 shadow-2xs"
              >
                <span>Entrar</span>
                <ArrowUpRight className="h-3 w-3" />
              </a>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
