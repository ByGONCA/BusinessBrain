"use client";

import * as React from "react";
import { Shield, Clock, Search, RefreshCw, User, Filter, AlertCircle } from "lucide-react";
import { OrganizationWithRole } from "@/lib/organizations/types";
import { getOrganizationAuditLogsAction } from "@/lib/settings/actions";

interface AuditLogTabProps {
  activeOrg: OrganizationWithRole | null;
}

interface AuditLogEntry {
  id: string;
  actor_name: string | null;
  actor_email: string | null;
  action: string;
  resource_type: string;
  resource_name: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export function AuditLogTab({ activeOrg }: AuditLogTabProps) {
  const isOwnerOrAdmin = activeOrg?.role === "owner" || activeOrg?.role === "admin";

  const [logs, setLogs] = React.useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [filterQuery, setFilterQuery] = React.useState("");

  const loadLogs = React.useCallback(async () => {
    if (!activeOrg?.id) return;
    setLoading(true);
    try {
      const res = await getOrganizationAuditLogsAction(activeOrg.id);
      if (res.success && res.logs) {
        setLogs(res.logs);
      }
    } finally {
      setLoading(false);
    }
  }, [activeOrg?.id]);

  React.useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  const filteredLogs = logs.filter((log) => {
    if (!filterQuery) return true;
    const query = filterQuery.toLowerCase();
    return (
      log.action.toLowerCase().includes(query) ||
      log.resource_type.toLowerCase().includes(query) ||
      (log.actor_name && log.actor_name.toLowerCase().includes(query)) ||
      (log.actor_email && log.actor_email.toLowerCase().includes(query))
    );
  });

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-zinc-900 dark:text-white tracking-tight">Audit Trail & Security Logs</h2>
        </div>
        <button
          type="button"
          onClick={loadLogs}
          disabled={loading}
          className="p-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition-colors"
          title="Refresh audit logs"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {!isOwnerOrAdmin ? (
        <div className="p-4 rounded-xl border border-amber-200 dark:border-amber-900 bg-amber-50/30 dark:bg-amber-950/20 text-xs text-amber-700 dark:text-amber-300">
          Audit logs are restricted to workspace owners and administrators.
        </div>
      ) : (
        <>
          {/* Search / Filter Bar */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-400" />
            <input
              type="text"
              value={filterQuery}
              onChange={(e) => setFilterQuery(e.target.value)}
              placeholder="Filter by action, actor, or resource type..."
              className="w-full rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#1a1a1d] py-1.5 pl-8 pr-2.5 text-xs text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:border-blue-500 transition-colors"
            />
          </div>

          {/* Audit Logs List */}
          <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#161618] overflow-hidden">
            {loading ? (
              <div className="p-8 text-center text-xs text-zinc-500">Loading audit trail...</div>
            ) : filteredLogs.length === 0 ? (
              <div className="p-8 text-center space-y-2">
                <Shield className="h-7 w-7 text-zinc-400 mx-auto" />
                <p className="text-xs font-medium text-zinc-700 dark:text-zinc-300">No security events found</p>
                <p className="text-[11px] text-zinc-500 max-w-sm mx-auto">
                  Sensitive administrative events (member invites, role elevations, and token revocations) will be logged here automatically.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {filteredLogs.map((log) => {
                  const dateStr = new Date(log.created_at).toLocaleString("en-GB", {
                    day: "numeric",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  });

                  return (
                    <div key={log.id} className="p-3.5 flex items-start justify-between gap-3 text-xs hover:bg-zinc-50/50 dark:hover:bg-zinc-900/30 transition-colors">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                            {log.action}
                          </span>
                          <span className="rounded bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.2 text-[10px] font-mono text-zinc-600 dark:text-zinc-400">
                            {log.resource_type}
                          </span>
                          {log.resource_name && (
                            <span className="text-[11px] text-zinc-500 font-medium">
                              ({log.resource_name})
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-zinc-500 dark:text-zinc-400 flex items-center gap-1.5">
                          <User className="h-3 w-3" />
                          <span>{log.actor_name || log.actor_email || "System"}</span>
                        </p>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="text-[10px] text-zinc-400 font-mono flex items-center gap-1 justify-end">
                          <Clock className="h-3 w-3" />
                          {dateStr}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
