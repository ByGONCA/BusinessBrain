import { createClient } from "@/lib/supabase/server";
import { getOrganizationEntitlement } from "@/lib/organizations/entitlements";
import { SUBSCRIPTION_PLANS } from "@/lib/stripe/config";
import { SubscriptionTier } from "@/lib/stripe/types";
import { StorageUsageInfo } from "./types";

/**
 * Calculates current storage quota and usage for an organization.
 * Only internal 'company_brain' files count toward quota. External files consume 0 bytes.
 */
export async function getOrganizationStorageQuota(
  organizationId: string
): Promise<StorageUsageInfo> {
  const supabase = await createClient();
  const entitlement = await getOrganizationEntitlement(organizationId);

  const planKey: SubscriptionTier = entitlement.plan || "starter";
  const planConfig = SUBSCRIPTION_PLANS[planKey] || SUBSCRIPTION_PLANS.starter;
  const maxStorageMb = planConfig.limits.maxStorageMb || 5000;
  const limitBytes = maxStorageMb * 1024 * 1024;

  let usedBytes = 0;

  // Try RPC first
  const { data: rpcBytes, error: rpcError } = await supabase.rpc(
    "get_organization_storage_bytes",
    { p_org_id: organizationId }
  );

  if (!rpcError && typeof rpcBytes === "number") {
    usedBytes = rpcBytes;
  } else {
    // Fallback query if RPC is not yet applied
    const { data: files } = await supabase
      .from("organization_files")
      .select("size_bytes")
      .eq("organization_id", organizationId)
      .eq("storage_provider", "company_brain")
      .is("deleted_at", null);

    if (files) {
      usedBytes = files.reduce((acc, f) => acc + (Number(f.size_bytes) || 0), 0);
    }
  }

  const remainingBytes = Math.max(0, limitBytes - usedBytes);
  const usagePercentage = limitBytes > 0 ? Math.min(100, Math.round((usedBytes / limitBytes) * 100)) : 0;
  const isQuotaExceeded = usedBytes >= limitBytes;

  return {
    usedBytes,
    limitBytes,
    remainingBytes,
    usagePercentage,
    isQuotaExceeded,
    plan: planConfig.name,
  };
}

/**
 * Asserts that an upload of size additionalBytes will not exceed the organization's quota limit.
 */
export async function assertStorageQuotaAvailable(
  organizationId: string,
  additionalBytes: number
): Promise<StorageUsageInfo> {
  const quota = await getOrganizationStorageQuota(organizationId);

  if (quota.usedBytes + additionalBytes > quota.limitBytes) {
    const limitMb = Math.round(quota.limitBytes / (1024 * 1024));
    const usedMb = (quota.usedBytes / (1024 * 1024)).toFixed(1);
    const requiredMb = (additionalBytes / (1024 * 1024)).toFixed(1);

    throw new Error(
      `Storage quota exceeded. Your ${quota.plan} plan limit is ${limitMb}MB (${usedMb}MB currently used). Uploading this ${requiredMb}MB file would exceed your quota. Please upgrade your subscription in Billing Settings.`
    );
  }

  return quota;
}
