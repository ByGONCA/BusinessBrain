import fs from "fs";
import path from "path";
import { z } from "zod";

export const LegalEntityAddressSchema = z.object({
  street: z.string(),
  postal_code: z.string(),
  city: z.string(),
  country: z.string(),
});

export const LegalEntityVerificationEvidenceSchema = z.object({
  evidence_type: z.enum([
    "COMMERCIAL_REGISTRY_CERTIFICATE",
    "TAX_AUTHORITY_DOCUMENT",
    "INCORPORATION_DEED",
    "OFFICIAL_GOVERNMENT_EXTRACT",
  ]),
  evidence_reference: z.string().min(8),
  verified_by: z.string().min(3),
  verified_at: z.string().regex(/^\d{4}-\d{2}-\d{2}/),
});

export const LegalEntityConfigSchema = z.object({
  $schema: z.string().optional(),
  version: z.string(),
  legal_name: z.string(),
  trade_name: z.string(),
  registration_number: z.string(),
  tax_id: z.string(),
  registered_office_address: LegalEntityAddressSchema,
  official_contact_email: z.string().email(),
  dpo_contact_email: z.string().email(),
  support_email: z.string().email(),
  statutory_representative: z.string(),
  verification_status: z
    .enum([
      "UNVERIFIED_PENDING_OWNER",
      "OWNER_RECORDED_PENDING_EVIDENCE",
      "EVIDENCE_ATTACHED_PENDING_LEGAL_REVIEW",
      "LEGALLY_VERIFIED",
    ])
    .default("UNVERIFIED_PENDING_OWNER"),
  verification_evidence: LegalEntityVerificationEvidenceSchema.nullable().optional(),
  verification_notes: z.string().optional(),
});

export type LegalEntityConfig = z.infer<typeof LegalEntityConfigSchema>;

export interface LegalEntityReadinessAssessment {
  isVerified: boolean;
  status:
    | "UNVERIFIED"
    | "FIELDS_PRESENT_PENDING_EVIDENCE"
    | "LEGALLY_VERIFIED"
    | "INVALID_DATA";
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

let cachedEntityConfig: LegalEntityConfig | null = null;

export function loadLegalEntityConfig(customPath?: string): LegalEntityConfig {
  const filePath = customPath || path.join(process.cwd(), "config", "legal-entity.json");
  if (!fs.existsSync(/*turbopackIgnore: true*/ filePath)) {
    throw new Error(`Legal entity configuration file not found at: ${filePath}`);
  }

  const raw = fs.readFileSync(/*turbopackIgnore: true*/ filePath, "utf-8");
  const parsed = JSON.parse(raw);
  const validated = LegalEntityConfigSchema.parse(parsed);
  cachedEntityConfig = validated;
  return validated;
}

export function getLegalEntityConfig(): LegalEntityConfig {
  if (cachedEntityConfig) {
    return cachedEntityConfig;
  }
  return loadLegalEntityConfig();
}

/**
 * Assesses whether legal corporate entity credentials meet strict verification standards.
 * Fail-closed:
 * - Flags any placeholder strings in legal name, tax ID, registration, address, or representative.
 * - Requires formal verification_status === "LEGALLY_VERIFIED".
 * - Requires non-trivial verification_evidence with reference code and verified_by signature.
 */
export function assessLegalEntityReadiness(config?: unknown): LegalEntityReadinessAssessment {
  let cfg: unknown;
  try {
    cfg = config || getLegalEntityConfig();
  } catch (err: unknown) {
    return {
      isVerified: false,
      status: "INVALID_DATA",
      hasPlaceholders: false,
      hasValidEvidence: false,
      pendingIssues: [err instanceof Error ? err.message : String(err)],
    };
  }

  const parsed = LegalEntityConfigSchema.safeParse(cfg);
  if (!parsed.success) {
    return {
      isVerified: false,
      status: "INVALID_DATA",
      hasPlaceholders: false,
      hasValidEvidence: false,
      pendingIssues: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`),
    };
  }

  const validCfg = parsed.data;
  const pendingIssues: string[] = [];

  // 1. Placeholder inspection across all fields
  if (containsPlaceholder(validCfg.legal_name)) {
    pendingIssues.push("legal_name contains unresolved placeholder");
  }
  if (containsPlaceholder(validCfg.registration_number)) {
    pendingIssues.push("registration_number contains unresolved placeholder");
  }
  if (containsPlaceholder(validCfg.tax_id)) {
    pendingIssues.push("tax_id contains unresolved placeholder");
  }
  if (containsPlaceholder(validCfg.registered_office_address.street)) {
    pendingIssues.push("registered_office_address.street contains unresolved placeholder");
  }
  if (containsPlaceholder(validCfg.registered_office_address.postal_code)) {
    pendingIssues.push("registered_office_address.postal_code contains unresolved placeholder");
  }
  if (containsPlaceholder(validCfg.registered_office_address.city)) {
    pendingIssues.push("registered_office_address.city contains unresolved placeholder");
  }
  if (containsPlaceholder(validCfg.statutory_representative)) {
    pendingIssues.push("statutory_representative contains unresolved placeholder");
  }

  const hasPlaceholders = pendingIssues.length > 0;

  // 2. Evidence validation
  let hasValidEvidence = false;
  if (validCfg.verification_evidence) {
    const ev = validCfg.verification_evidence;
    if (
      ev.evidence_reference &&
      ev.evidence_reference.trim().length >= 8 &&
      ev.verified_by &&
      ev.verified_by.trim().length >= 3 &&
      !isNaN(Date.parse(ev.verified_at))
    ) {
      hasValidEvidence = true;
    } else {
      pendingIssues.push("verification_evidence is incomplete or has trivial reference length");
    }
  } else {
    pendingIssues.push("No verification_evidence attached");
  }

  // 3. Status determination
  if (validCfg.verification_status !== "LEGALLY_VERIFIED") {
    pendingIssues.push(`verification_status is '${validCfg.verification_status}' (must be 'LEGALLY_VERIFIED')`);
  }

  const isVerified =
    !hasPlaceholders &&
    hasValidEvidence &&
    validCfg.verification_status === "LEGALLY_VERIFIED";

  const status: LegalEntityReadinessAssessment["status"] = isVerified
    ? "LEGALLY_VERIFIED"
    : hasPlaceholders
    ? "UNVERIFIED"
    : "FIELDS_PRESENT_PENDING_EVIDENCE";

  return {
    isVerified,
    status,
    hasPlaceholders,
    hasValidEvidence,
    pendingIssues,
  };
}

/**
 * Returns whether corporate identity details have been formally verified.
 * Fails closed: an arbitrary boolean cannot bypass evidence & status requirements.
 */
export function isLegalEntityVerified(): boolean {
  try {
    return assessLegalEntityReadiness().isVerified;
  } catch {
    return false;
  }
}
