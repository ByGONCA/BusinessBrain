"use client";

import * as React from "react";
import { Key, Plus, Trash2, Copy, Check, ShieldAlert, ExternalLink, Loader2, Clock } from "lucide-react";
import { OrganizationApiKey, ApiKeyScope } from "@/lib/api-keys/types";
import { API_KEY_SCOPES } from "@/lib/api-keys/scopes";

interface ApiKeysTabProps {
  organizationId: string;
}

export function ApiKeysTab({ organizationId }: ApiKeysTabProps) {
  const [keys, setKeys] = React.useState<OrganizationApiKey[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [creating, setCreating] = React.useState(false);
  const [showCreateDialog, setShowCreateDialog] = React.useState(false);
  const [newKeyName, setNewKeyName] = React.useState("");
  const [selectedScopes, setSelectedScopes] = React.useState<ApiKeyScope[]>([
    "read:projects",
    "read:documents",
  ]);
  const [createdSecret, setCreatedSecret] = React.useState<string | null>(null);
  const [copied, setCopied] = React.useState(false);
  const [deletingId, setDeletingId] = React.useState<string | null>(null);

  const fetchKeys = React.useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/v1/keys");
      if (res.ok) {
        const data = await res.json();
        setKeys(data.keys || []);
      }
    } catch (err) {
      console.error("Failed to load API keys", err);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchKeys();
  }, [fetchKeys]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKeyName.trim()) return;

    try {
      setCreating(true);
      const res = await fetch("/api/v1/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newKeyName.trim(),
          scopes: selectedScopes,
          rateLimitPerMinute: 60,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setCreatedSecret(data.secretKey);
        setShowCreateDialog(false);
        setNewKeyName("");
        await fetchKeys();
      } else {
        const errData = await res.json();
        alert(errData.error || "Failed to create API key");
      }
    } catch (err) {
      console.error("Error creating API key", err);
    } finally {
      setCreating(false);
    }
  };

  const handleRevoke = async (keyId: string) => {
    if (!confirm("Are you sure you want to revoke this API key? This action is immediate and cannot be undone.")) {
      return;
    }

    try {
      setDeletingId(keyId);
      const res = await fetch(`/api/v1/keys/${keyId}`, { method: "DELETE" });
      if (res.ok) {
        await fetchKeys();
      } else {
        alert("Failed to revoke API key");
      }
    } catch (err) {
      console.error("Error revoking API key", err);
    } finally {
      setDeletingId(null);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6 w-full max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-zinc-900 dark:text-white tracking-tight flex items-center gap-2">
            <Key className="h-5 w-5 text-zinc-600 dark:text-zinc-400" />
            Enterprise Public API Keys
          </h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
            Manage granular API tokens for programmatic workspace integration and data synchronization.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <a
            href="/api/v1/openapi.json"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white border border-zinc-200 dark:border-zinc-800 rounded-lg bg-zinc-50 dark:bg-zinc-900/60 transition-colors"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            OpenAPI Spec
          </a>
          <button
            type="button"
            onClick={() => setShowCreateDialog(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-zinc-900 hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-100 rounded-lg transition-colors cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5" />
            Create API Key
          </button>
        </div>
      </div>

      {/* Secret Key Single-Reveal Alert Modal */}
      {createdSecret && (
        <div className="p-4 rounded-xl border border-amber-200 dark:border-amber-900/50 bg-amber-50 dark:bg-amber-950/20 space-y-3">
          <div className="flex items-start gap-2.5">
            <ShieldAlert className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-xs font-bold text-amber-900 dark:text-amber-300">
                Save your secret API key now
              </h4>
              <p className="text-xs text-amber-700 dark:text-amber-400/90 mt-0.5">
                This secret key will never be displayed again. If you lose it, you will need to revoke it and generate a new key.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 bg-white dark:bg-zinc-900 p-2 rounded-lg border border-amber-200 dark:border-amber-900/60">
            <code className="text-xs font-mono text-zinc-900 dark:text-zinc-100 flex-1 break-all select-all">
              {createdSecret}
            </code>
            <button
              type="button"
              onClick={() => copyToClipboard(createdSecret)}
              className="px-2.5 py-1 text-xs font-medium bg-amber-600 hover:bg-amber-700 text-white rounded-md flex items-center gap-1.5 shrink-0 transition-colors cursor-pointer"
            >
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => setCreatedSecret(null)}
              className="text-xs font-medium text-amber-800 dark:text-amber-400 hover:underline cursor-pointer"
            >
              I have stored this key safely
            </button>
          </div>
        </div>
      )}

      {/* Create Key Modal Dialog */}
      {showCreateDialog && (
        <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm space-y-4">
          <h3 className="text-sm font-bold text-zinc-900 dark:text-white">Create New API Key</h3>
          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                Key Name
              </label>
              <input
                type="text"
                value={newKeyName}
                onChange={(e) => setNewKeyName(e.target.value)}
                placeholder="e.g. CI/CD Deployment Bot, Datadog Collector"
                className="w-full px-3 py-1.5 text-xs rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-white focus:outline-none focus:border-zinc-400"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
                Granular Permissions (Scopes)
              </label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-48 overflow-y-auto p-1">
                {API_KEY_SCOPES.map((s) => {
                  const isChecked = selectedScopes.includes(s.scope);
                  return (
                    <label
                      key={s.scope}
                      className="flex items-start gap-2 p-2 rounded-lg border border-zinc-100 dark:border-zinc-800/60 hover:bg-zinc-50 dark:hover:bg-zinc-800/40 cursor-pointer text-xs"
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedScopes([...selectedScopes, s.scope]);
                          } else {
                            setSelectedScopes(selectedScopes.filter((sc) => sc !== s.scope));
                          }
                        }}
                        className="mt-0.5 rounded border-zinc-300 dark:border-zinc-700"
                      />
                      <div>
                        <span className="font-semibold text-zinc-900 dark:text-white block">
                          {s.name}
                        </span>
                        <span className="text-[11px] text-zinc-500 dark:text-zinc-400">
                          {s.description}
                        </span>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
              <button
                type="button"
                onClick={() => setShowCreateDialog(false)}
                className="px-3 py-1.5 text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={creating || !newKeyName.trim() || selectedScopes.length === 0}
                className="px-3 py-1.5 text-xs font-medium text-white bg-zinc-900 dark:bg-white dark:text-zinc-900 hover:opacity-90 rounded-lg transition-opacity disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
              >
                {creating && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Generate Key
              </button>
            </div>
          </form>
        </div>
      )}

      {/* API Keys Table */}
      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden bg-white dark:bg-zinc-900">
        {loading ? (
          <div className="p-8 text-center text-xs text-zinc-500 dark:text-zinc-400 flex items-center justify-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading API keys...
          </div>
        ) : keys.length === 0 ? (
          <div className="p-8 text-center text-xs text-zinc-500 dark:text-zinc-400">
            No API keys generated yet. Click "Create API Key" to issue a key.
          </div>
        ) : (
          <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {keys.map((k) => (
              <div
                key={k.id}
                className="p-3.5 flex items-center justify-between hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition-colors"
              >
                <div className="space-y-1 min-w-0 pr-4">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-zinc-900 dark:text-white truncate">
                      {k.name}
                    </span>
                    <span className="font-mono text-[11px] px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700">
                      {k.keyPrefix}...
                    </span>
                    {k.revokedAt ? (
                      <span className="text-[10px] uppercase font-semibold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 px-1.5 py-0.5 rounded">
                        Revoked
                      </span>
                    ) : (
                      <span className="text-[10px] uppercase font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-1.5 py-0.5 rounded">
                        Active
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-[11px] text-zinc-500 dark:text-zinc-400">
                    <span>Rate limit: {k.rateLimitPerMinute} req/min</span>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {k.lastUsedAt
                        ? `Last used: ${new Date(k.lastUsedAt).toLocaleDateString()}`
                        : "Never used"}
                    </span>
                    <span>•</span>
                    <span>Created: {new Date(k.createdAt).toLocaleDateString()}</span>
                  </div>
                  <div className="flex flex-wrap gap-1 pt-1">
                    {k.scopes.map((scope) => (
                      <span
                        key={scope}
                        className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-zinc-100 dark:bg-zinc-800/80 text-zinc-500 dark:text-zinc-400"
                      >
                        {scope}
                      </span>
                    ))}
                  </div>
                </div>

                {!k.revokedAt && (
                  <button
                    type="button"
                    disabled={deletingId === k.id}
                    onClick={() => handleRevoke(k.id)}
                    className="p-1.5 text-zinc-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition-colors disabled:opacity-50 cursor-pointer"
                    title="Revoke key"
                  >
                    {deletingId === k.id ? (
                      <Loader2 className="h-4 w-4 animate-spin text-zinc-400" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
