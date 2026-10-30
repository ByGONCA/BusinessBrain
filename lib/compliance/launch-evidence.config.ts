import fs from "fs";
import path from "path";
import { z } from "zod";
import { assessLegalEntityReadiness } from "./legal-entity.config";
import { validateStripeEnvironment } from "../stripe/config";

export const BlockerLifecycleStatusSchema = z.enum([
  "NOT_STARTED",
  "IN_PROGRESS",
  "EVIDENCE_SUBMITTED",
  "EVIDENCE_VALIDATED",
  "REJECTED_OR_INCOMPLETE",
]);

export type BlockerLifecycleStatus = z.infer<typeof BlockerLifecycleStatusSchema>;

export const GenericEvidenceSchema = z.object({
  evidence_type: z.string().min(5),
  evidence_reference: z.string().min(8),
  verified_by: z.string().min(3),
  verified_at: z.string().regex(/^\d{4}-\d{2}-\d{2}/),
  notes: z.string().optional(),
});

export const Blocker01EvidenceSchema = z.object({
  evidence_type: z.enum([
    "COMMERCIAL_REGISTRY_CERTIFICATE",
    "TAX_AUTHORITY_DOCUMENT",
    "INCORPORATION_DEED",
    "OFFICIAL_GOVERNMENT_EXTRACT",
  ]),
  evidence_reference: z.string().min(8),
  verified_by: z.string().min(3),
  verified_at: z.string().regex(/^\d{4}-\d{2}-\d{2}/),
  notes: z.string().optional(),
});

export const Blocker02EvidenceSchema = z.object({
  evidence_type: z.enum([
    "STRIPE_DASHBOARD_LIVE_AUDIT",
    "TAX_REGISTRATION_CERTIFICATE",
    "PAYMENT_INTEGRATION_AUDIT",
  ]),
  evidence_reference: z.string().min(8),
  webhook_endpoint_id: z.string().optional(),
  tax_registration_confirmed: z.boolean(),
  verified_by: z.string().min(3),
  verified_at: z.string().regex(/^\d{4}-\d{2}-\d{2}/),
  notes: z.string().optional(),
});

export const Blocker03EvidenceSchema = z.object({
  evidence_type: z.enum([
    "SUPABASE_DASHBOARD_REGION_AUDIT",
    "INFRASTRUCTURE_REGIONAL_ATTESTATION",
  ]),
  evidence_reference: z.string().min(8),
  confirmed_region: z.string().regex(/^eu-(central|west)-[1-3]$/),
  verified_by: z.string().min(3),
  verified_at: z.string().regex(/^\d{4}-\d{2}-\d{2}/),
  notes: z.string().optional(),
});

export const Blocker04EvidenceSchema = z.object({
  evidence_type: z.enum([
    "LEGAL_COUNSEL_OPINION_AND_DPAS",
    "BAR_CERTIFIED_REGULATORY_REVIEW",
  ]),
  evidence_reference: z.string().min(8),
  dpa_confirmations: z.array(z.string()).min(4),
  counsel_name: z.string().min(3),
  counsel_bar_number: z.string().optional(),
  verified_by: z.string().min(3),
  verified_at: z.string().regex(/^\d{4}-\d{2}-\d{2}/),
  notes: z.string().optional(),
});

export const LaunchEvidenceRecordSchema = z.object({
  id: z.enum(["BLK-01", "BLK-02", "BLK-03", "BLK-04"]),
  name: z.string(),
  status: BlockerLifecycleStatusSchema,
  config_source: z.string().optional(),
  env_dependencies: z.array(z.string()).optional(),
  target_region: z.string().optional(),
  required_subprocessors: z.array(z.string()).optional(),
  evidence: z
    .union([
      Blocker01EvidenceSchema,
      Blocker02EvidenceSchema,
      Blocker03EvidenceSchema,
      Blocker04EvidenceSchema,
      GenericEvidenceSchema,
    ])
    .nullable(),
  validation_notes: z.string().optional(),
});

export const LaunchEvidenceLedgerSchema = z.object({
  $schema: z.string().optional(),
  version: z.string(),
  last_updated: z.string(),
  blockers: z.object({
    "BLK-01": LaunchEvidenceRecordSchema,
    "BLK-02": LaunchEvidenceRecordSchema,
    "BLK-03": LaunchEvidenceRecordSchema,
    "BLK-04": LaunchEvidenceRecordSchema,
  }),
});

export type LaunchEvidenceLedger = z.infer<typeof LaunchEvidenceLedgerSchema>;

export interface BlockerEvidenceAssessment {
  blockerId: "BLK-01" | "BLK-02" | "BLK-03" | "BLK-04";
  isVerified: boolean;
  status: BlockerLifecycleStatus;
  hasPlaceholders: boolean;
  hasValidEvidence: boolean;
  pendingIssues: string[];
}

const PLACEHOLDER_PATTERNS = [
  /\[OWNER_INPUT_REQUIRED/i,
  /\[TODO/i,
  /\[PENDING/i,
  /^placeholder$/i,
  /^example$/i,
  /\[LEGAL_COUNSEL_REQUIRED/i,
];

function containsPlaceholder(val?: string | null): boolean {
  if (!val) return false;
  return PLACEHOLDER_PATTERNS.some((p) => p.test(val.trim()));
}

let cachedLedger: LaunchEvidenceLedger | null = null;

export function loadLaunchEvidenceLedger(customPath?: string): LaunchEvidenceLedger {
  const filePath = customPath || path.join(process.cwd(), "config", "launch-evidence.json");
  if (!fs.existsSync(/*turbopackIgnore: true*/ filePath)) {
    throw new Error(`Launch evidence ledger not found at: ${filePath}`);
  }

  const raw = fs.readFileSync(/*turbopackIgnore: true*/ filePath, "utf-8");
  const parsed = JSON.parse(raw);
  const validated = LaunchEvidenceLedgerSchema.parse(parsed);
  cachedLedger = validated;
  return validated;
}

export function getLaunchEvidenceLedger(): LaunchEvidenceLedger {
  if (cachedLedger) {
    return cachedLedger;
  }
  return loadLaunchEvidenceLedger();
}

/**
 * Assesses whether a specific external blocker meets the strict evidence criteria.
 * Fail-closed: An arbitrary status === "EVIDENCE_VALIDATED" is automatically rejected
 * if evidence is missing, trivial, or contains unresolved placeholder tokens.
 */
export function assessBlockerEvidence(
  blockerId: "BLK-01" | "BLK-02" | "BLK-03" | "BLK-04",
  customLedger?: LaunchEvidenceLedger
): BlockerEvidenceAssessment {
  let ledger: LaunchEvidenceLedger;
  try {
    ledger = customLedger || getLaunchEvidenceLedger();
  } catch (err: unknown) {
    return {
      blockerId,
      isVerified: false,
      status: "REJECTED_OR_INCOMPLETE",
      hasPlaceholders: false,
      hasValidEvidence: false,
      pendingIssues: [`Failed to load launch evidence ledger: ${err instanceof Error ? err.message : String(err)}`],
    };
  }

  const record = ledger.blockers[blockerId];
  if (!record) {
    return {
      blockerId,
      isVerified: false,
      status: "REJECTED_OR_INCOMPLETE",
      hasPlaceholders: false,
      hasValidEvidence: false,
      pendingIssues: [`Blocker record ${blockerId} missing in ledger`],
    };
  }

  const pendingIssues: string[] = [];

  // Check for uninitiated or in-progress states
  if (record.status === "NOT_STARTED") {
    return {
      blockerId,
      isVerified: false,
      status: "NOT_STARTED",
      hasPlaceholders: false,
      hasValidEvidence: false,
      pendingIssues: [`Blocker ${blockerId} has not been started by the workspace owner.`],
    };
  }

  if (record.status === "IN_PROGRESS") {
    return {
      blockerId,
      isVerified: false,
      status: "IN_PROGRESS",
      hasPlaceholders: false,
      hasValidEvidence: false,
      pendingIssues: [`Blocker ${blockerId} is currently in progress pending final evidence submission.`],
    };
  }

  // 1. Evidence presence check
  if (!record.evidence) {
    return {
      blockerId,
      isVerified: false,
      status: "REJECTED_OR_INCOMPLETE",
      hasPlaceholders: false,
      hasValidEvidence: false,
      pendingIssues: [`Blocker ${blockerId} evidence object is null or missing.`],
    };
  }

  const ev = record.evidence;

  // 2. Placeholder checks across evidence fields
  if (containsPlaceholder(ev.evidence_reference)) {
    pendingIssues.push("evidence_reference contains unresolved placeholder token");
  }
  if (containsPlaceholder(ev.verified_by)) {
    pendingIssues.push("verified_by contains unresolved placeholder token");
  }

  // 3. Date validity check
  if (!ev.verified_at || isNaN(Date.parse(ev.verified_at))) {
    pendingIssues.push("verified_at is invalid or missing valid ISO date format");
  }

  // 4. Blocker-specific integrity checks
  if (blockerId === "BLK-01") {
    // BLK-01 cross-checks config/legal-entity.json directly
    const legalEntityAssessment = assessLegalEntityReadiness();
    if (!legalEntityAssessment.isVerified) {
      pendingIssues.push(
        `Legal entity configuration failed verification: ${legalEntityAssessment.pendingIssues.join("; ")}`
      );
    }
  } else if (blockerId === "BLK-02") {
    const ev02 = ev as z.infer<typeof Blocker02EvidenceSchema>;
    if (!ev02.tax_registration_confirmed) {
      pendingIssues.push("tax_registration_confirmed must be explicitly confirmed as true in Stripe Dashboard");
    }
  } else if (blockerId === "BLK-03") {
    const ev03 = ev as z.infer<typeof Blocker03EvidenceSchema>;
    if (!ev03.confirmed_region || ev03.confirmed_region !== "eu-central-1") {
      pendingIssues.push(`confirmed_region must be confirmed as 'eu-central-1' (Frankfurt), got '${ev03.confirmed_region}'`);
    }
  } else if (blockerId === "BLK-04") {
    const ev04 = ev as z.infer<typeof Blocker04EvidenceSchema>;
    if (!Array.isArray(ev04.dpa_confirmations) || ev04.dpa_confirmations.length < 4) {
      pendingIssues.push("dpa_confirmations must include all 4 core subprocessors (Supabase, Vercel, Resend, Stripe)");
    }
    if (!ev04.counsel_name || containsPlaceholder(ev04.counsel_name) || ev04.counsel_name.trim().length < 3) {
      pendingIssues.push("counsel_name must contain qualified attorney legal representation credentials");
    }
  }

  const hasPlaceholders = pendingIssues.some((i) => i.includes("placeholder"));
  const hasValidEvidence = pendingIssues.length === 0;

  const isVerified =
    record.status === "EVIDENCE_VALIDATED" &&
    hasValidEvidence &&
    !hasPlaceholders;

  const effectiveStatus: BlockerLifecycleStatus = isVerified
    ? "EVIDENCE_VALIDATED"
    : hasPlaceholders || pendingIssues.length > 0
    ? "REJECTED_OR_INCOMPLETE"
    : record.status;

  return {
    blockerId,
    isVerified,
    status: effectiveStatus,
    hasPlaceholders,
    hasValidEvidence,
    pendingIssues,
  };
}
