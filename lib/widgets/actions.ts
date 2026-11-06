"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isValidUuid } from "@/lib/security/authorization";
import {
  DashboardLayoutConfig,
  DashboardType,
  DashboardDescriptor,
  LoadLayoutResult,
  SaveLayoutErrorCode,
  SaveLayoutResult,
} from "./types";
import { getDefaultLayout } from "./layout-defaults";
import { getMetricCapability, isWidgetConfigValid } from "./registry";
import { dashboardLayoutSchema } from "./schemas";

/**
 * Persists a dashboard layout atomically using PostgreSQL Compare-And-Swap (CAS)
 * with row-level locking (FOR UPDATE) inside migration 00037.
 * 
 * Strict Invariant: Zero non-atomic read-then-write fallback.
 */
export async function saveDashboardLayoutAction(params: {
  organizationId: string;
  dashboardType: DashboardType;
  layout: DashboardLayoutConfig;
  expectedUpdatedAt?: string;
  forceOverwrite?: boolean;
}): Promise<SaveLayoutResult> {
  // 1. Parameter format validations
  if (!isValidUuid(params.organizationId)) {
    return {
      success: false,
      code: "INVALID_LAYOUT",
      message: "Invalid organization ID format.",
    };
  }

  const isSafeDashboardType = /^[a-z0-9_-]{1,64}$/i.test(params.dashboardType);
  if (!isSafeDashboardType) {
    return {
      success: false,
      code: "INVALID_DASHBOARD",
      message: "Invalid dashboard type format. Only alphanumeric characters, dashes, and underscores are allowed.",
    };
  }

  // 2. Schema validation
  const layoutParse = dashboardLayoutSchema.safeParse(params.layout);
  if (!layoutParse.success) {
    return {
      success: false,
      code: "INVALID_LAYOUT",
      message: layoutParse.error.errors[0]?.message || "Invalid layout schema.",
    };
  }

  // 3. Domain registry validation for each widget
  for (const widget of params.layout.widgets) {
    const validity = isWidgetConfigValid(widget);
    if (!validity.valid) {
      return {
        success: false,
        code: "INVALID_LAYOUT",
        message: validity.reason || "Invalid widget configuration.",
      };
    }
  }

  // 4. Scoped Supabase client & fresh timestamp
  const supabase = await createClient();
  const nowIso = new Date().toISOString();
  const layoutToSave: DashboardLayoutConfig = {
    ...params.layout,
    updatedAt: nowIso,
  };

  // 5. Atomic RPC CAS execution (Single atomic round-trip)
  // The PostgreSQL RPC function (save_dashboard_layout_cas) runs as SECURITY DEFINER
  // with search_path = public, pg_temp and independently validates:
  //   a) auth.uid() is not null (rejects with UNAUTHENTICATED)
  //   b) User is verified member of organization_members for p_org_id (rejects with FORBIDDEN)
  //   c) Acquires row-level lock (SELECT ... FOR UPDATE) to serialize concurrent writes
  //   d) Enforces CAS timestamp match unless forceOverwrite is requested
  //   e) Commits atomic JSONB path update and returns
  const { data, error } = await supabase.rpc("save_dashboard_layout_cas", {
    p_org_id: params.organizationId,
    p_dashboard_type: params.dashboardType,
    p_layout: layoutToSave,
    p_expected_updated_at: params.forceOverwrite
      ? null
      : (params.expectedUpdatedAt || null),
    p_force_overwrite: Boolean(params.forceOverwrite),
  });

  // 8. Strict Error Handling: Fail safely without silent read-then-write fallback
  if (error) {
    return {
      success: false,
      code: "PERSISTENCE_ERROR",
      message: "Database persistence error: " + error.message,
    };
  }

  if (!data || !data.success) {
    return {
      success: false,
      code: (data?.code as SaveLayoutErrorCode) || "STALE_WRITE",
      message: data?.message || "Layout was modified in another session.",
      currentUpdatedAt: data?.current_updated_at,
    };
  }

  try {
    revalidatePath("/dashboard");
    if (params.dashboardType === "finance") {
      revalidatePath("/dashboard/finance");
    }
  } catch {
    // Ignore revalidation outside request context
  }

  return {
    success: true,
    updatedAt: data.updated_at || nowIso,
  };
}

/**
 * Loads the dashboard layout for a user and organization.
 * Falls back safely to curated 3-block defaults if absent or malformed.
 */
export async function loadDashboardLayoutAction(params: {
  organizationId: string;
  dashboardType: string;
}): Promise<LoadLayoutResult> {
  const fallback = getDefaultLayout(params.dashboardType as DashboardType);

  if (!isValidUuid(params.organizationId)) {
    return { layout: fallback, isCustom: false };
  }

  const isSafeDashboardType = /^[a-z0-9_-]{1,64}$/i.test(params.dashboardType);
  if (!isSafeDashboardType) {
    return { layout: fallback, isCustom: false };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { layout: fallback, isCustom: false };
  }

  // Verify membership and query profile preferences in parallel (cuts 1 network roundtrip)
  const [membershipRes, profileRes] = await Promise.all([
    supabase
      .from("organization_members")
      .select("role")
      .eq("organization_id", params.organizationId)
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase
      .from("profiles")
      .select("user_preferences")
      .eq("id", user.id)
      .maybeSingle(),
  ]);

  if (!membershipRes.data) {
    return { layout: fallback, isCustom: false };
  }

  const prefs = (profileRes.data?.user_preferences as Record<string, unknown>) || {};
  const layouts = (prefs.dashboard_layouts as Record<string, Record<string, unknown>>) || {};
  const rawLayout = layouts[params.organizationId]?.[params.dashboardType];

  if (!rawLayout) {
    return { layout: fallback, isCustom: false };
  }

  const parseResult = dashboardLayoutSchema.safeParse(rawLayout);
  if (!parseResult.success) {
    // Malformed layout safely recovers to default layout
    return { layout: fallback, isCustom: false };
  }

  // Filter out any obsolete/deprecated metrics for backward compatibility
  const validWidgets = parseResult.data.widgets.filter((w) =>
    Boolean(getMetricCapability(w.metricId))
  );

  // If the stored layout is the legacy 3-block placeholder layout (priorities + projects + decisions),
  // seamlessly upgrade to the rich, modular executive default layout requested by the user.
  const isLegacyHomePlaceholder =
    params.dashboardType === "home" &&
    validWidgets.length === 3 &&
    validWidgets.every((w) =>
      ["workspace.priorities", "workspace.projects", "workspace.decisions"].includes(w.metricId)
    );

  if (isLegacyHomePlaceholder) {
    return { layout: fallback, isCustom: false };
  }

  return {
    layout: {
      ...parseResult.data,
      widgets: validWidgets,
    },
    isCustom: true,
  };
}

/**
 * Returns the list of all dashboards available for the user in the organization.
 * Always includes canonical "home" and "finance", plus any customized boards.
 */
export async function listDashboardsAction(params: {
  organizationId: string;
}): Promise<DashboardDescriptor[]> {
  const defaultDashboards: DashboardDescriptor[] = [
    {
      id: "home",
      name: "Executive Overview",
      description: "Visão estratégica global, entregáveis e velocidade operacional.",
      isDefault: true,
      isSystem: true,
    },
    {
      id: "finance",
      name: "Financial Velocity",
      description: "Métricas Stripe, MRR, ARR e liquidação líquida.",
      isDefault: false,
      isSystem: true,
    },
  ];

  if (!isValidUuid(params.organizationId)) {
    return defaultDashboards;
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return defaultDashboards;
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("user_preferences")
    .eq("id", user.id)
    .maybeSingle();

  const prefs = (profile?.user_preferences as Record<string, unknown>) || {};
  const customRegistry = (prefs.dashboards_registry as Record<string, DashboardDescriptor[]>) || {};
  const orgCustomDashboards = customRegistry[params.organizationId] || [];

  return [...defaultDashboards, ...orgCustomDashboards];
}

/**
 * Creates a new custom dashboard for this user and organization.
 */
export async function createDashboardAction(params: {
  organizationId: string;
  name: string;
  description?: string;
  template?: "home" | "finance" | "blank";
}): Promise<{ success: boolean; dashboard?: DashboardDescriptor; message?: string }> {
  if (!isValidUuid(params.organizationId)) {
    return { success: false, message: "Invalid organization ID." };
  }

  const trimmedName = params.name?.trim();
  if (!trimmedName || trimmedName.length > 50) {
    return { success: false, message: "Dashboard name must be between 1 and 50 characters." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, message: "Unauthenticated." };
  }

  const dashboardId = `custom-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  const nowIso = new Date().toISOString();

  const newDashboard: DashboardDescriptor = {
    id: dashboardId,
    name: trimmedName,
    description: params.description?.trim() || "",
    isDefault: false,
    isSystem: false,
    createdAt: nowIso,
    updatedAt: nowIso,
  };

  const { data: profile } = await supabase
    .from("profiles")
    .select("user_preferences")
    .eq("id", user.id)
    .maybeSingle();

  const prefs = (profile?.user_preferences as Record<string, unknown>) || {};
  const customRegistry = (prefs.dashboards_registry as Record<string, DashboardDescriptor[]>) || {};
  const currentList = customRegistry[params.organizationId] || [];

  // Limit max custom dashboards per user to 12
  if (currentList.length >= 12) {
    return { success: false, message: "Maximum limit of 12 custom dashboards reached." };
  }

  const updatedList = [...currentList, newDashboard];
  const updatedRegistry = {
    ...customRegistry,
    [params.organizationId]: updatedList,
  };

  // Seed with template layout
  const templateLayout =
    params.template === "finance"
      ? getDefaultLayout("finance")
      : params.template === "blank"
      ? { version: 1, updatedAt: nowIso, widgets: [] }
      : getDefaultLayout("home");

  const saveRes = await saveDashboardLayoutAction({
    organizationId: params.organizationId,
    dashboardType: dashboardId,
    layout: templateLayout,
    forceOverwrite: true,
  });

  if (!saveRes.success) {
    return { success: false, message: saveRes.message || "Failed to persist initial layout." };
  }

  await supabase
    .from("profiles")
    .update({
      user_preferences: {
        ...prefs,
        dashboards_registry: updatedRegistry,
      },
    })
    .eq("id", user.id);

  return { success: true, dashboard: newDashboard };
}

/**
 * Deletes a custom dashboard. System dashboards ("home", "finance") cannot be deleted.
 */
export async function deleteDashboardAction(params: {
  organizationId: string;
  dashboardId: string;
}): Promise<{ success: boolean; message?: string }> {
  if (params.dashboardId === "home" || params.dashboardId === "finance") {
    return { success: false, message: "System dashboards cannot be deleted." };
  }

  if (!isValidUuid(params.organizationId)) {
    return { success: false, message: "Invalid organization ID." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, message: "Unauthenticated." };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("user_preferences")
    .eq("id", user.id)
    .maybeSingle();

  const prefs = (profile?.user_preferences as Record<string, unknown>) || {};
  const customRegistry = (prefs.dashboards_registry as Record<string, DashboardDescriptor[]>) || {};
  const currentList = customRegistry[params.organizationId] || [];

  const updatedList = currentList.filter((d) => d.id !== params.dashboardId);
  const updatedRegistry = {
    ...customRegistry,
    [params.organizationId]: updatedList,
  };

  // Remove layout from preferences
  const layouts = (prefs.dashboard_layouts as Record<string, Record<string, unknown>>) || {};
  const orgLayouts = { ...(layouts[params.organizationId] || {}) };
  delete orgLayouts[params.dashboardId];

  const updatedLayouts = {
    ...layouts,
    [params.organizationId]: orgLayouts,
  };

  await supabase
    .from("profiles")
    .update({
      user_preferences: {
        ...prefs,
        dashboards_registry: updatedRegistry,
        dashboard_layouts: updatedLayouts,
      },
    })
    .eq("id", user.id);

  return { success: true };
}
