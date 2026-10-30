import fs from "fs";
import path from "path";
import { z } from "zod";

export const EvaluatedJurisdictionSchema = z.object({
  country_code: z.string().min(2).max(2).toUpperCase(),
  region_code: z.string().nullable().optional(),
  evaluation_id: z.string(),
  evaluation_date: z.string(),
  status: z.enum([
    "APPROVED",
    "APPROVED_WITH_CONDITIONS",
    "BLOCKED",
    "LOCAL_LEGAL_VALIDATION_NEEDED",
    "INDETERMINATE",
  ]),
});

export const PendingJurisdictionSchema = z.object({
  country_code: z.string().min(2).max(2).toUpperCase(),
  region_code: z.string().nullable().optional(),
  priority: z.enum(["P1", "P2", "P3"]),
});

export const GeoRestrictionSchema = z.object({
  country_code: z.string().min(2).max(2).toUpperCase(),
  region_code: z.string().optional(),
  reason: z.string(),
  scope: z.enum(["TOTAL_BLOCK", "REGION_BLOCK", "CONDITIONAL_BLOCK"]),
});

export const SubnationalJurisdictionSchema = z.object({
  country_code: z.string().min(2).max(2).toUpperCase(),
  region_code: z.string(),
  name: z.string(),
  primary_statutes: z.array(z.string()),
});

export const MarketsConfigSchema = z.object({
  $schema: z.string().optional(),
  version: z.string(),
  last_updated: z.string(),
  service_available_countries: z.array(z.string().min(2).max(2).toUpperCase()),
  customer_onboarding_countries: z.array(z.string().min(2).max(2).toUpperCase()),
  marketing_target_markets: z.array(z.string().min(2).max(2).toUpperCase()),
  partner_countries: z.array(z.string().min(2).max(2).toUpperCase()),
  evaluated_jurisdictions: z.array(EvaluatedJurisdictionSchema),
  pending_jurisdictions: z.array(PendingJurisdictionSchema),
  geo_restrictions: z.array(GeoRestrictionSchema),
  investigation_priorities: z.record(z.array(z.string())),
  subnational_jurisdictions: z.array(SubnationalJurisdictionSchema),
});

export type MarketsConfig = z.infer<typeof MarketsConfigSchema>;

export type JurisdictionStatus =
  | "SANCTIONED_BLOCKED"
  | "EVALUATED_APPROVED"
  | "EVALUATED_CONDITIONED"
  | "PENDING_EXPANSION"
  | "UNCONFIGURED_NOT_PERMITTED";

let cachedConfig: MarketsConfig | null = null;

export function loadMarketsConfig(customPath?: string): MarketsConfig {
  const filePath = customPath || path.join(process.cwd(), "config", "markets.json");
  if (!fs.existsSync(/*turbopackIgnore: true*/ filePath)) {
    throw new Error(`Markets configuration file not found at: ${filePath}`);
  }

  const raw = fs.readFileSync(/*turbopackIgnore: true*/ filePath, "utf-8");
  const parsed = JSON.parse(raw);
  const validated = MarketsConfigSchema.parse(parsed);
  cachedConfig = validated;
  return validated;
}

export function getActiveMarketsConfig(): MarketsConfig {
  if (cachedConfig) {
    return cachedConfig;
  }
  return loadMarketsConfig();
}

/**
 * Returns jurisdictions that must be evaluated for a specific feature,
 * factoring in target markets, active customer countries, and investigation priorities.
 */
export function getJurisdictionsForFeature(targetMarkets?: string[]): string[] {
  const config = getActiveMarketsConfig();
  if (targetMarkets && targetMarkets.length > 0) {
    return Array.from(new Set(targetMarkets.map((m) => m.toUpperCase())));
  }

  // If no target markets are specified, default to all customer onboarding countries + P1 jurisdictions
  const base = new Set<string>(config.customer_onboarding_countries);
  const p1 = config.investigation_priorities["P1"] || [];
  for (const code of p1) {
    base.add(code.toUpperCase());
  }
  return Array.from(base);
}

/**
 * Checks whether a country or subnational region has an active completed evaluation.
 */
export function isJurisdictionEvaluated(countryCode: string, regionCode?: string | null): boolean {
  const config = getActiveMarketsConfig();
  const c = countryCode.toUpperCase();
  const r = regionCode ? regionCode.toUpperCase() : null;

  return config.evaluated_jurisdictions.some((item) => {
    if (item.country_code !== c) return false;
    if (r === null || r === undefined) {
      return item.region_code === null || item.region_code === undefined;
    }
    return item.region_code === r;
  });
}

/**
 * Checks if a country/region is subject to total or regional geoblocking sanctions.
 */
export function isCountrySanctioned(countryCode: string, regionCode?: string | null): { sanctioned: boolean; reason?: string; scope?: string } {
  const config = getActiveMarketsConfig();
  let c = countryCode.toUpperCase();
  let r = regionCode ? regionCode.toUpperCase() : null;

  if (!r && c.includes("-")) {
    const parts = c.split("-");
    c = parts[0];
    r = parts[1];
  }

  const restriction = config.geo_restrictions.find((item) => {
    if (item.country_code !== c) return false;
    if (item.scope === "TOTAL_BLOCK") return true;
    if (item.region_code && r && item.region_code.includes(r)) return true;
    return false;
  });

  if (restriction) {
    return {
      sanctioned: true,
      reason: restriction.reason,
      scope: restriction.scope,
    };
  }

  return { sanctioned: false };
}

/**
 * Returns explicit status of a jurisdiction to prevent automatic approval by omission.
 */
export function getJurisdictionStatus(countryCode: string, regionCode?: string | null): JurisdictionStatus {
  let c = countryCode.toUpperCase();
  let r = regionCode ? regionCode.toUpperCase() : null;

  if (!r && c.includes("-")) {
    const parts = c.split("-");
    c = parts[0];
    r = parts[1];
  }

  const sanction = isCountrySanctioned(c, r);
  if (sanction.sanctioned) {
    return "SANCTIONED_BLOCKED";
  }

  const config = getActiveMarketsConfig();

  // Supra-national European Union jurisdiction check
  if (c === "EU") {
    const euEvaluated = config.evaluated_jurisdictions.find((item) => item.country_code === "EU");
    if (euEvaluated) {
      return euEvaluated.status === "APPROVED" ? "EVALUATED_APPROVED" : "EVALUATED_CONDITIONED";
    }
    // EU is configured through EU member state presence (e.g. PT, ES, FR, DE in service_available_countries)
    const hasEuMember = ["PT", "ES", "FR", "DE", "IE", "IT"].some((m) =>
      config.service_available_countries.includes(m)
    );
    if (hasEuMember) {
      return "EVALUATED_CONDITIONED";
    }
  }

  const evaluated = config.evaluated_jurisdictions.find((item) => {
    if (item.country_code !== c) return false;
    if (r === null || r === undefined) {
      return item.region_code === null || item.region_code === undefined;
    }
    return item.region_code === r;
  });

  if (evaluated) {
    return evaluated.status === "APPROVED" ? "EVALUATED_APPROVED" : "EVALUATED_CONDITIONED";
  }

  const isPending = config.pending_jurisdictions.some((p) => {
    if (p.country_code !== c) return false;
    if (r === null || r === undefined) {
      return p.region_code === null || p.region_code === undefined;
    }
    return p.region_code === r;
  });

  if (isPending) {
    return "PENDING_EXPANSION";
  }

  return "UNCONFIGURED_NOT_PERMITTED";
}
