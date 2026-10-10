"use client";

import * as React from "react";
import {
  Bell,
  Mail,
  ShieldAlert,
  Building2,
  CheckSquare,
  MessageSquare,
  Calendar,
  Target,
  Brain,
  Layers,
  FileText,
  CreditCard,
  Sparkles,
  Search,
  Lock,
  ChevronDown,
  ChevronRight,
  Loader2,
  Check,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  NotificationChannel,
  NotificationCategory,
  NOTIFICATION_CATEGORIES,
  NOTIFICATION_DEFINITIONS,
  getDefaultPreferences,
  UserNotificationPreferences,
} from "@/lib/notifications/types";
import {
  getNotificationPreferencesAction,
  updateNotificationPreferenceAction,
  bulkUpdateCategoryPreferencesAction,
} from "@/lib/notifications/actions";

function getCategoryIcon(name: string) {
  switch (name) {
    case "ShieldAlert":
      return <ShieldAlert className="h-4 w-4 text-rose-500" />;
    case "Building2":
      return <Building2 className="h-4 w-4 text-blue-500" />;
    case "CheckSquare":
      return <CheckSquare className="h-4 w-4 text-emerald-500" />;
    case "MessageSquare":
      return <MessageSquare className="h-4 w-4 text-indigo-500" />;
    case "Calendar":
      return <Calendar className="h-4 w-4 text-amber-500" />;
    case "Target":
      return <Target className="h-4 w-4 text-purple-500" />;
    case "Brain":
      return <Brain className="h-4 w-4 text-pink-500" />;
    case "Mail":
      return <Mail className="h-4 w-4 text-cyan-500" />;
    case "Layers":
      return <Layers className="h-4 w-4 text-orange-500" />;
    case "FileText":
      return <FileText className="h-4 w-4 text-teal-500" />;
    case "CreditCard":
      return <CreditCard className="h-4 w-4 text-yellow-500" />;
    case "Sparkles":
      return <Sparkles className="h-4 w-4 text-sky-500" />;
    default:
      return <Bell className="h-4 w-4 text-zinc-500" />;
  }
}

export function NotificationsTab() {
  const [preferences, setPreferences] = React.useState<UserNotificationPreferences>(getDefaultPreferences());
  const [loading, setLoading] = React.useState(true);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [expandedCategories, setExpandedCategories] = React.useState<Record<string, boolean>>({
    account_security: true,
    company_workspace: true,
    tasks: true,
    billing: true,
  });
  const [updatingKey, setUpdatingKey] = React.useState<string | null>(null);

  // Load preferences from server
  React.useEffect(() => {
    let active = true;
    getNotificationPreferencesAction().then((res) => {
      if (active && res.preferences) {
        setPreferences(res.preferences);
        setLoading(false);
      }
    });
    return () => {
      active = false;
    };
  }, []);

  const toggleCategoryExpand = (catId: string) => {
    setExpandedCategories((prev) => ({ ...prev, [catId]: !prev[catId] }));
  };

  const handleToggleChannel = async (
    typeId: string,
    channel: NotificationChannel,
    currentVal: boolean,
    locked?: boolean
  ) => {
    if (locked) return;
    const newVal = !currentVal;
    const mutationKey = `${typeId}_${channel}`;
    setUpdatingKey(mutationKey);

    // Optimistic update
    setPreferences((prev) => ({
      ...prev,
      [typeId]: {
        ...prev[typeId],
        [channel]: newVal,
      },
    }));

    try {
      const res = await updateNotificationPreferenceAction(typeId, channel, newVal);
      if (!res.success) {
        // Rollback
        setPreferences((prev) => ({
          ...prev,
          [typeId]: {
            ...prev[typeId],
            [channel]: currentVal,
          },
        }));
      }
    } finally {
      setUpdatingKey(null);
    }
  };

  const handleBulkCategoryChannel = async (
    category: NotificationCategory,
    channel: NotificationChannel,
    targetVal: boolean
  ) => {
    const mutationKey = `bulk_${category}_${channel}`;
    setUpdatingKey(mutationKey);

    const items = NOTIFICATION_DEFINITIONS.filter((d) => d.category === category);
    setPreferences((prev) => {
      const next = { ...prev };
      for (const item of items) {
        const isLocked = channel === "in_app" ? item.lockedInApp : item.lockedEmail;
        if (!isLocked) {
          next[item.id] = {
            ...next[item.id],
            [channel]: targetVal,
          };
        }
      }
      return next;
    });

    try {
      await bulkUpdateCategoryPreferencesAction(category, channel, targetVal);
    } finally {
      setUpdatingKey(null);
    }
  };

  // Filter items by search query
  const filteredCategories = NOTIFICATION_CATEGORIES.filter((cat) => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    const matchesCat = cat.title.toLowerCase().includes(query) || cat.description.toLowerCase().includes(query);
    const catItems = NOTIFICATION_DEFINITIONS.filter((d) => d.category === cat.id);
    const matchesItems = catItems.some(
      (item) => item.label.toLowerCase().includes(query) || item.description.toLowerCase().includes(query)
    );
    return matchesCat || matchesItems;
  });

  return (
    <div className="space-y-5 max-w-xl">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-zinc-900 dark:text-white tracking-tight">Notification Preferences</h2>
          <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-0.5">
            Configure how and when you receive in-app notices and email updates across all workspaces.
          </p>
        </div>
      </div>

      {/* Search Input & Legend Header */}
      <div className="flex items-center justify-between gap-3 pt-1">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search notification triggers..."
            className="w-full rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#1a1a1d] pl-8 pr-3 py-1.5 text-xs text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:border-blue-500 transition-colors"
          />
        </div>

        {/* Column Legend */}
        <div className="flex items-center gap-6 shrink-0 pr-2">
          <div className="flex items-center gap-1 text-[11px] font-semibold text-zinc-500">
            <Bell className="h-3.5 w-3.5" />
            <span>In-App</span>
          </div>
          <div className="flex items-center gap-1 text-[11px] font-semibold text-zinc-500">
            <Mail className="h-3.5 w-3.5" />
            <span>Email</span>
          </div>
        </div>
      </div>

      {/* Category Accordion Matrix */}
      <div className="space-y-3">
        {filteredCategories.map((category) => {
          const items = NOTIFICATION_DEFINITIONS.filter((d) => d.category === category.id).filter((item) => {
            if (!searchQuery.trim()) return true;
            const q = searchQuery.toLowerCase();
            return item.label.toLowerCase().includes(q) || item.description.toLowerCase().includes(q);
          });

          if (items.length === 0) return null;

          const isExpanded = expandedCategories[category.id] ?? false;

          // Compute category-level channel states
          const allInAppActive = items.every((i) => preferences[i.id]?.in_app);
          const allEmailActive = items.every((i) => preferences[i.id]?.email);

          return (
            <div
              key={category.id}
              className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#161618] overflow-hidden transition-all shadow-2xs"
            >
              {/* Category Header Row */}
              <div
                onClick={() => toggleCategoryExpand(category.id)}
                className="flex items-center justify-between p-3.5 cursor-pointer hover:bg-zinc-50/70 dark:hover:bg-zinc-800/40 transition-colors select-none"
              >
                <div className="flex items-center gap-2.5 min-w-0 pr-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-zinc-100 dark:bg-zinc-800 border border-zinc-200/60 dark:border-zinc-700/60 shrink-0">
                    {getCategoryIcon(category.iconName)}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-xs font-bold text-zinc-900 dark:text-white truncate">
                        {category.title}
                      </h3>
                      <span className="text-[10px] text-zinc-400 font-mono">({items.length})</span>
                    </div>
                    <p className="text-[11px] text-zinc-500 truncate max-w-sm">{category.description}</p>
                  </div>
                </div>

                {/* Category Master Switches & Expand Chevron */}
                <div className="flex items-center gap-6 shrink-0" onClick={(e) => e.stopPropagation()}>
                  {/* Master In-App switch */}
                  <button
                    type="button"
                    title={`Toggle all in-app notifications for ${category.title}`}
                    onClick={() => handleBulkCategoryChannel(category.id, "in_app", !allInAppActive)}
                    className={cn(
                      "relative inline-flex h-4 w-7 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none",
                      allInAppActive ? "bg-blue-600" : "bg-zinc-300 dark:bg-zinc-700"
                    )}
                  >
                    <span
                      className={cn(
                        "pointer-events-none inline-block h-3 w-3 transform rounded-full bg-white shadow-sm transition duration-200",
                        allInAppActive ? "translate-x-3" : "translate-x-0"
                      )}
                    />
                  </button>

                  {/* Master Email switch */}
                  <button
                    type="button"
                    title={`Toggle all email notifications for ${category.title}`}
                    onClick={() => handleBulkCategoryChannel(category.id, "email", !allEmailActive)}
                    className={cn(
                      "relative inline-flex h-4 w-7 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none",
                      allEmailActive ? "bg-blue-600" : "bg-zinc-300 dark:bg-zinc-700"
                    )}
                  >
                    <span
                      className={cn(
                        "pointer-events-none inline-block h-3 w-3 transform rounded-full bg-white shadow-sm transition duration-200",
                        allEmailActive ? "translate-x-3" : "translate-x-0"
                      )}
                    />
                  </button>

                  <button
                    type="button"
                    onClick={() => toggleCategoryExpand(category.id)}
                    className="p-0.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
                  >
                    {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {/* Collapsible Items List */}
              {isExpanded && (
                <div className="divide-y divide-zinc-100 dark:divide-zinc-800/60 border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50/30 dark:bg-zinc-900/20">
                  {items.map((item) => {
                    const currentPref = preferences[item.id] || {
                      in_app: item.defaultInApp,
                      email: item.defaultEmail,
                    };

                    return (
                      <div key={item.id} className="flex items-center justify-between p-3 pl-11 text-xs">
                        <div className="min-w-0 pr-4">
                          <p className="font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                            {item.label}
                          </p>
                          <p className="text-[11px] text-zinc-500">{item.description}</p>
                        </div>

                        {/* Channel Toggles for Item */}
                        <div className="flex items-center gap-7 shrink-0">
                          {/* In-App Toggle */}
                          {item.lockedInApp ? (
                            <div className="flex items-center justify-center w-8" title="Mandatory security alert">
                              <Lock className="h-3.5 w-3.5 text-zinc-400" />
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() =>
                                handleToggleChannel(item.id, "in_app", currentPref.in_app, item.lockedInApp)
                              }
                              className={cn(
                                "relative inline-flex h-4 w-7 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none",
                                currentPref.in_app ? "bg-blue-600" : "bg-zinc-300 dark:bg-zinc-700"
                              )}
                            >
                              <span
                                className={cn(
                                  "pointer-events-none inline-block h-3 w-3 transform rounded-full bg-white shadow-sm transition duration-200",
                                  currentPref.in_app ? "translate-x-3" : "translate-x-0"
                                )}
                              />
                            </button>
                          )}

                          {/* Email Toggle */}
                          {item.lockedEmail ? (
                            <div className="flex items-center justify-center w-8" title="Mandatory security alert">
                              <Lock className="h-3.5 w-3.5 text-zinc-400" />
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() =>
                                handleToggleChannel(item.id, "email", currentPref.email, item.lockedEmail)
                              }
                              className={cn(
                                "relative inline-flex h-4 w-7 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none",
                                currentPref.email ? "bg-blue-600" : "bg-zinc-300 dark:bg-zinc-700"
                              )}
                            >
                              <span
                                className={cn(
                                  "pointer-events-none inline-block h-3 w-3 transform rounded-full bg-white shadow-sm transition duration-200",
                                  currentPref.email ? "translate-x-3" : "translate-x-0"
                                )}
                              />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
