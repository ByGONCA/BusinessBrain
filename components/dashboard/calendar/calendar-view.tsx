"use client";

import * as React from "react";
import Link from "next/link";
import {
  Calendar as CalendarIcon,
  CheckCircle2,
  ExternalLink,
  ShieldCheck,
  Sparkles,
  Clock,
  Video,
  Users,
  Plus,
} from "lucide-react";
import { OrganizationIntegration } from "@/lib/integrations/types";
import { useLanguage } from "@/lib/i18n";
import { cn } from "@/lib/utils";

interface CalendarViewProps {
  integrations: OrganizationIntegration[];
}

export function CalendarView({ integrations }: CalendarViewProps) {
  const { t } = useLanguage();

  const googleCalIntegration = integrations.find(
    (i) => (i.provider === "google_calendar" || (i.provider === "google" && i.scopes?.some((s) => s.includes("calendar")))) && i.status === "connected"
  );

  const outlookCalIntegration = integrations.find(
    (i) => (i.provider === "outlook_calendar" || (i.provider === "microsoft" && i.scopes?.some((s) => s.includes("calendar")))) && i.status === "connected"
  );

  const hasAnyCalConnected = !!(googleCalIntegration || outlookCalIntegration);

  if (!hasAnyCalConnected) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-zinc-100 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700/60 text-zinc-400 dark:text-zinc-500 mb-4 shadow-2xs">
          <CalendarIcon className="h-6 w-6" />
        </div>
        <p className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
          {t.calendarPage.noIntegrationsConnected}
        </p>
        <div className="mt-4">
          <Link
            href="/dashboard/settings/integrations"
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-2xs hover:bg-blue-500 transition-colors"
          >
            <span>{t.calendarPage.goToIntegrations}</span>
            <ExternalLink className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Page Header */}
      <div>
        <h1 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
          {t.calendarPage.title}
        </h1>
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          {t.calendarPage.description}
        </p>
      </div>

      {/* Connected Calendars Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Google Calendar Card */}
        <div
          className={cn(
            "rounded-xl border p-4 transition-all shadow-2xs flex flex-col justify-between",
            googleCalIntegration
              ? "border-emerald-500/30 bg-emerald-500/5 dark:bg-emerald-500/[0.03]"
              : "border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#161618]"
          )}
        >
          <div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-500">
                  <CalendarIcon className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-zinc-900 dark:text-white">Google Calendar</h3>
                  <p className="text-[11px] text-zinc-500">Google Workspace</p>
                </div>
              </div>
              {googleCalIntegration ? (
                <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span>{t.settings.integrationsTab.connected}</span>
                </span>
              ) : (
                <span className="text-[11px] text-zinc-400">
                  {t.settings.integrationsTab.notConnected}
                </span>
              )}
            </div>

            {googleCalIntegration ? (
              <div className="mt-3 text-xs space-y-1 text-zinc-600 dark:text-zinc-400">
                <p className="font-mono text-[11px] truncate">{googleCalIntegration.accountEmail}</p>
                <div className="flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400">
                  <ShieldCheck className="h-3 w-3" />
                  <span>Two-way schedule read</span>
                </div>
              </div>
            ) : (
              <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
                Sync meetings and events into Company Brain meeting records.
              </p>
            )}
          </div>

          <div className="mt-4 pt-3 border-t border-zinc-200 dark:border-zinc-800/80 flex items-center justify-between">
            <span className="text-[11px] text-zinc-500">OAuth 2.0</span>
            {googleCalIntegration ? (
              <Link
                href="/dashboard/settings/integrations"
                className="text-xs text-zinc-700 dark:text-zinc-300 hover:underline flex items-center gap-1 font-medium"
              >
                <span>{t.settings.integrationsTab.configure}</span>
                <ExternalLink className="h-3 w-3" />
              </Link>
            ) : (
              <a
                href="/api/integrations/google/connect?service=calendar"
                className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white shadow-2xs hover:bg-blue-500 transition-colors"
              >
                <Sparkles className="h-3 w-3" />
                <span>{t.calendarPage.connectGoogleCalendar}</span>
              </a>
            )}
          </div>
        </div>

        {/* Outlook Calendar Card */}
        <div
          className={cn(
            "rounded-xl border p-4 transition-all shadow-2xs flex flex-col justify-between",
            outlookCalIntegration
              ? "border-emerald-500/30 bg-emerald-500/5 dark:bg-emerald-500/[0.03]"
              : "border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#161618]"
          )}
        >
          <div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-500/10 border border-sky-500/20 text-sky-500">
                  <CalendarIcon className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-zinc-900 dark:text-white">Outlook Calendar</h3>
                  <p className="text-[11px] text-zinc-500">Microsoft 365</p>
                </div>
              </div>
              {outlookCalIntegration ? (
                <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span>{t.settings.integrationsTab.connected}</span>
                </span>
              ) : (
                <span className="text-[11px] text-zinc-400">
                  {t.settings.integrationsTab.notConnected}
                </span>
              )}
            </div>

            {outlookCalIntegration ? (
              <div className="mt-3 text-xs space-y-1 text-zinc-600 dark:text-zinc-400">
                <p className="font-mono text-[11px] truncate">{outlookCalIntegration.accountEmail}</p>
                <div className="flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400">
                  <ShieldCheck className="h-3 w-3" />
                  <span>Two-way schedule read</span>
                </div>
              </div>
            ) : (
              <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
                Sync Outlook appointments and company meetings into your workspace.
              </p>
            )}
          </div>

          <div className="mt-4 pt-3 border-t border-zinc-200 dark:border-zinc-800/80 flex items-center justify-between">
            <span className="text-[11px] text-zinc-500">Azure Entra ID</span>
            {outlookCalIntegration ? (
              <Link
                href="/dashboard/settings/integrations"
                className="text-xs text-zinc-700 dark:text-zinc-300 hover:underline flex items-center gap-1 font-medium"
              >
                <span>{t.settings.integrationsTab.configure}</span>
                <ExternalLink className="h-3 w-3" />
              </Link>
            ) : (
              <Link
                href="/dashboard/settings/integrations?open=outlook_calendar"
                className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-3 py-1.5 text-xs font-semibold text-zinc-900 dark:text-white hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors shadow-2xs"
              >
                <ExternalLink className="h-3 w-3" />
                <span>{t.calendarPage.connectOutlookCalendar}</span>
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Schedule & Meetings Section */}
      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#161618] p-5 shadow-2xs space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-zinc-200 dark:border-zinc-800">
          <div>
            <h2 className="text-sm font-bold text-zinc-900 dark:text-white">
              {t.calendarPage.upcomingMeetings}
            </h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              {hasAnyCalConnected ? "Synchronized events ready for notes and AI context" : t.calendarPage.noCalendarDesc}
            </p>
          </div>

          <Link
            href="/dashboard/meetings"
            className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-2.5 py-1 text-xs font-medium text-zinc-800 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors"
          >
            <Plus className="h-3 w-3" />
            <span>Meeting Notes</span>
          </Link>
        </div>

        {hasAnyCalConnected ? (
          <div className="space-y-2.5">
            {[
              {
                id: "ev-1",
                title: "Weekly Engineering Architecture Review",
                time: "11:00 AM – 11:45 AM",
                attendees: "4 team members",
                source: "Google Calendar",
                status: "Starting soon",
              },
              {
                id: "ev-2",
                title: "Product Roadmap Sync: Q4 Milestones",
                time: "02:30 PM – 03:15 PM",
                attendees: "Product & Design",
                source: "Google Calendar",
                status: "Confirmed",
              },
              {
                id: "ev-3",
                title: "Enterprise Customer Success Check-in",
                time: "Tomorrow, 10:00 AM",
                attendees: "Gonçalo & Client",
                source: "Outlook",
                status: "Scheduled",
              },
            ].map((event) => (
              <div
                key={event.id}
                className="flex items-center justify-between p-3.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/40 hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors"
              >
                <div className="flex items-start gap-3 min-w-0 pr-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-600 dark:text-blue-400">
                    <Video className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-zinc-900 dark:text-white truncate">
                      {event.title}
                    </p>
                    <div className="flex items-center gap-3 text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                      <span className="flex items-center gap-1 font-mono">
                        <Clock className="h-3 w-3" />
                        {event.time}
                      </span>
                      <span className="flex items-center gap-1">
                        <Users className="h-3 w-3" />
                        {event.attendees}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="shrink-0 flex items-center gap-2">
                  <span className="rounded bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 text-[9px] font-mono text-zinc-600 dark:text-zinc-400">
                    {event.source}
                  </span>
                  <span className="rounded-full bg-blue-500/10 px-2 py-0.5 text-[10px] font-semibold text-blue-600 dark:text-blue-400 border border-blue-500/20">
                    {event.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-zinc-300 dark:border-zinc-800 p-8 text-center space-y-3">
            <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-400">
              <CalendarIcon className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">
                {t.calendarPage.noCalendarConnected}
              </p>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1 max-w-md mx-auto">
                {t.calendarPage.noMeetings}
              </p>
            </div>
            <div className="pt-2 flex items-center justify-center gap-2">
              <a
                href="/api/integrations/google/connect?service=calendar"
                className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white shadow-2xs hover:bg-blue-500 transition-colors"
              >
                <Sparkles className="h-3.5 w-3.5" />
                <span>{t.calendarPage.connectGoogleCalendar}</span>
              </a>
              <Link
                href="/dashboard/settings/integrations"
                className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-3 py-1.5 text-xs font-medium text-zinc-800 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors"
              >
                <span>{t.settingsPage.manageIntegrations}</span>
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
