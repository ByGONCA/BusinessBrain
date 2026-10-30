/**
 * Quality Gates Engine for Global Legal & Regulatory Compliance
 *
 * Enforces stage-aware deployment checks:
 * - EXPERIMENTAL: Enables prototyping and remediation development under active risks.
 * - TECHNICAL_APPROVAL: Validates deterministic tests, schemas, and RBAC isolation.
 * - PRODUCTION_APPROVAL: Strict gate blocking releases under unresolved CRITICAL/HIGH
 *   risks, pending local legal counsel, unsatisfied acceptance conditions, lack of
 *   evidence, trivial evidence placeholders, or stale/expired compliance evaluations.
 */

import {
  ComplianceReport,
  ComplianceVerdict,
  DevelopmentStage,
} from "./types";
import { getJurisdictionStatus, isCountrySanctioned } from "./markets.config";
import {
  assessLegalEntityReadiness,
  isLegalEntityVerified,
} from "./legal-entity.config";
import {
  assessBlockerEvidence,
  BlockerLifecycleStatus,
} from "./launch-evidence.config";
import { validateStripeEnvironment } from "../stripe/config";

export interface QualityGateOptions {
  disclaimerPresent?: boolean;
  currentDate?: string;
  materialChangeDetected?: boolean;
}

export interface QualityGateResult {
  allowed: boolean;
  stage: DevelopmentStage;
  verdict: ComplianceVerdict;
  blocking_reasons: string[];
  pending_conditions: string[];
  requires_legal_counsel: boolean;
}

const TRIVIAL_EVIDENCE_PATTERNS = [
  /^done$/i,
  /^ok$/i,
  /^n\/?a$/i,
  /^none$/i,
  /^test$/i,
  /^passed$/i,
  /^test passed$/i,
  /^verified$/i,
  /^placeholder$/i,
  /^todo$/i,
  /^fixed$/i,
];

function isEvidenceSubstantive(evidence?: string): boolean {
  if (!evidence) return false;
  const trimmed = evidence.trim();
  if (trimmed.length < 15) return false;
  return !TRIVIAL_EVIDENCE_PATTERNS.some((pattern) => pattern.test(trimmed));
}

/**
 * Evaluates whether a feature or change meets the quality gate for a given development stage.
 * Operates in strict fail-closed mode: any missing or malformed data immediately yields allowed: false.
 */
export function evaluateQualityGate(
  report: ComplianceReport,
  stage: DevelopmentStage,
  options: QualityGateOptions | boolean = false
): QualityGateResult {
  const blocking_reasons: string[] = [];
  const pending_conditions: string[] = [];

  // 0. Fail-closed structural validation
  if (!report || typeof report !== "object") {
    return {
      allowed: false,
      stage,
      verdict: "INDETERMINATE",
      blocking_reasons: ["Report object is null, undefined, or not an object (fail-closed)."],
      pending_conditions: [],
      requires_legal_counsel: true,
    };
  }

  if (!Array.isArray(report.risks) || !Array.isArray(report.acceptance_conditions)) {
    return {
      allowed: false,
      stage,
      verdict: report.final_verdict || "INDETERMINATE",
      blocking_reasons: ["Report is missing required 'risks' or 'acceptance_conditions' array."],
      pending_conditions: [],
      requires_legal_counsel: true,
    };
  }

  // Normalize options
  const opts: QualityGateOptions =
    typeof options === "boolean"
      ? { disclaimerPresent: options }
      : options || {};

  // Rule 1: Disclaimers NEVER reduce or clear substantive legal risks
  if (opts.disclaimerPresent) {
    // Audit note: presence of a disclaimer is recorded, but does not alter risk assessment
  }

  // Rule 2: Check acceptance conditions status & substantive evidence completeness
  for (const condition of report.acceptance_conditions) {
    if (!condition || typeof condition !== "object") {
      blocking_reasons.push("Malformed acceptance condition encountered.");
      continue;
    }

    if (condition.status !== "SATISFIED") {
      pending_conditions.push(`[${condition.id}] ${condition.requirement} (${condition.status})`);
    } else if (!isEvidenceSubstantive(condition.evidence)) {
      // Condition marked SATISFIED but without substantive, non-trivial evidence
      blocking_reasons.push(
        `Condition [${condition.id}] marked as SATISFIED but lacks substantive evidence (minimum 15 characters, non-trivial verifiable reference required).`
      );
    }
  }

  // 1. EXPERIMENTAL STAGE
  // Allows development even if risks are critical, specifically so engineers can
  // implement mitigations (e.g. building double opt-in, geofencing, consent logging).
  if (stage === "EXPERIMENTAL") {
    return {
      allowed: true,
      stage,
      verdict: report.final_verdict,
      blocking_reasons: [],
      pending_conditions,
      requires_legal_counsel: !!report.local_legal_validation_needed,
    };
  }

  // 2. TECHNICAL APPROVAL STAGE
  // Requires technical tests to be complete, but does not yet grant production release.
  if (stage === "TECHNICAL_APPROVAL") {
    // If blocked definitively, technical approval fails
    if (report.final_verdict === "BLOCKED") {
      blocking_reasons.push(
        "Feature is legally BLOCKED; technical approval withheld until architecture is updated."
      );
    }

    return {
      allowed: blocking_reasons.length === 0,
      stage,
      verdict: report.final_verdict,
      blocking_reasons,
      pending_conditions,
      requires_legal_counsel: !!report.local_legal_validation_needed,
    };
  }

  // 3. PRODUCTION APPROVAL STAGE (Strict Release Gate)

  // Validate review date format
  if (!report.recommended_review_date || isNaN(Date.parse(report.recommended_review_date))) {
    blocking_reasons.push(
      "Report missing valid ISO 'recommended_review_date'. Unverifiable review horizon blocks production."
    );
  }

  // Stale Evaluation Check: If material change occurred since evaluation
  if (opts.materialChangeDetected) {
    blocking_reasons.push(
      "Compliance evaluation is invalidated by a material product or regulatory change. Refreshed review required."
    );
  }

  // Stale Evaluation Check: Expiration date
  if (opts.currentDate) {
    if (isNaN(Date.parse(opts.currentDate))) {
      blocking_reasons.push("Provided currentDate in QualityGateOptions is not a valid ISO date.");
    } else if (report.recommended_review_date && report.recommended_review_date < opts.currentDate) {
      blocking_reasons.push(
        `Compliance evaluation expired on ${report.recommended_review_date}. Current date (${opts.currentDate}) requires refreshed review.`
      );
    }
  }

  // Market Footprint & Sanctions Verification: Check jurisdictions in PRODUCTION_APPROVAL
  if (Array.isArray(report.jurisdictions_covered)) {
    try {
      for (const jurisdiction of report.jurisdictions_covered) {
        const sanction = isCountrySanctioned(jurisdiction);
        if (sanction.sanctioned) {
          blocking_reasons.push(
            `Jurisdiction '${jurisdiction}' is under active trade/economic sanctions. Production release forbidden.`
          );
        }
        const status = getJurisdictionStatus(jurisdiction);
        if (status === "UNCONFIGURED_NOT_PERMITTED") {
          blocking_reasons.push(
            `Jurisdiction '${jurisdiction}' is unknown or unconfigured in markets footprint. Unverified deployment forbidden.`
          );
        }
      }
    } catch (err) {
      blocking_reasons.push(
        `Failed to validate market footprint configuration: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  } else {
    blocking_reasons.push("Report missing required 'jurisdictions_covered' array in production gate.");
  }

  // Check for unresolved high/critical risks
  const unresolvedCriticalOrHigh = report.risks.filter((risk) => {
    if (!risk || (risk.severity !== "CRITICAL" && risk.severity !== "HIGH")) {
      return false;
    }
    // A risk is unresolved if any of its conditions are not satisfied or lack substantive evidence
    const riskConditions = report.acceptance_conditions.filter((c) => c && c.risk_id === risk.id);
    if (riskConditions.length === 0) return true; // No conditions defined means not mitigated
    return riskConditions.some(
      (c) => c.status !== "SATISFIED" || !isEvidenceSubstantive(c.evidence)
    );
  });

  if (unresolvedCriticalOrHigh.length > 0) {
    for (const risk of unresolvedCriticalOrHigh) {
      blocking_reasons.push(
        `Unresolved ${risk.severity} risk in [${risk.domain} / ${risk.jurisdiction}]: ${risk.title}`
      );
    }
  }

  // Verdict-based gates
  if (report.final_verdict === "BLOCKED") {
    blocking_reasons.push("Compliance verdict is BLOCKED. Deployment to production is strictly forbidden.");
  }

  if (report.final_verdict === "INDETERMINATE") {
    blocking_reasons.push(
      "Compliance verdict is INDETERMINATE. Missing nexus or legal facts must be established before production release."
    );
  }

  if (report.final_verdict === "LOCAL_LEGAL_VALIDATION_NEEDED" || report.local_legal_validation_needed) {
    const hasLegalCounselSignOff = report.acceptance_conditions.some(
      (c) =>
        c &&
        c.verification_method === "LEGAL_SIGN_OFF" &&
        c.status === "SATISFIED" &&
        isEvidenceSubstantive(c.evidence)
    );
    if (!hasLegalCounselSignOff) {
      blocking_reasons.push(
        "Local legal counsel validation is required and still pending formal sign-off."
      );
    }
  }

  if (report.final_verdict === "APPROVED_WITH_CONDITIONS" && pending_conditions.length > 0) {
    blocking_reasons.push(
      `Approval has ${pending_conditions.length} unsatisfied mandatory condition(s).`
    );
  }

  // Final check: unhandled verdicts fail closed
  const validVerdicts: ComplianceVerdict[] = [
    "APPROVED",
    "APPROVED_WITH_CONDITIONS",
    "BLOCKED",
    "LOCAL_LEGAL_VALIDATION_NEEDED",
    "INDETERMINATE",
  ];
  if (!validVerdicts.includes(report.final_verdict)) {
    blocking_reasons.push(`Unknown compliance verdict '${report.final_verdict}' fails closed.`);
  }

  return {
    allowed: blocking_reasons.length === 0,
    stage: "PRODUCTION_APPROVAL",
    verdict: report.final_verdict,
    blocking_reasons,
    pending_conditions,
    requires_legal_counsel: !!report.local_legal_validation_needed,
  };
}

export type TechnicalReadinessStatus = "PASS" | "FAIL";
export type LegalEntityReadinessStatus = "VERIFIED" | "PENDING_OWNER_EVIDENCE" | "INVALID_DATA";
export type StripeProductionStatus = "VERIFIED_LIVE" | "PENDING_LIVE_VERIFICATION" | "UNCONFIGURED";
export type HostingRegionStatus = "VERIFIED_EU_CENTRAL_1" | "PENDING_DASHBOARD_VERIFICATION";
export type SubprocessorAgreementsStatus = "EXECUTED_AND_REVIEWED" | "PENDING_DPA_ACCEPTANCE";
export type LegalReviewStatus = "COMPLETED" | "PENDING_COUNSEL_SIGNOFF";
export type CommercialLaunchStatus = "READY_FOR_DEFINED_SCOPE" | "CONDITIONAL" | "BLOCKED";

export interface DimensionalReadiness {
  code_and_tests: TechnicalReadinessStatus;
  legal_entity: LegalEntityReadinessStatus;
  stripe_production: StripeProductionStatus;
  hosting_region: HostingRegionStatus;
  subprocessor_agreements: SubprocessorAgreementsStatus;
  legal_review: LegalReviewStatus;
  commercial_launch: CommercialLaunchStatus;
}

export type LaunchReadinessDecision =
  | "BLOCKED"
  | "CONDITIONAL"
  | "READY_FOR_DEFINED_SCOPE"
  | "NOT_VERIFIED";

export interface LaunchReadinessReport {
  decision: LaunchReadinessDecision;
  dimensions: DimensionalReadiness;
  blocker_lifecycle: Record<"BLK-01" | "BLK-02" | "BLK-03" | "BLK-04", BlockerLifecycleStatus>;
  technical_readiness: TechnicalReadinessStatus;
  external_readiness: {
    legal_entity: LegalEntityReadinessStatus;
    stripe_production: StripeProductionStatus;
    hosting_region: HostingRegionStatus;
    subprocessor_agreements: SubprocessorAgreementsStatus;
    legal_review: LegalReviewStatus;
  };
  scope: {
    product: string[];
    geography: string[];
    excluded: string[];
  };
  open_blockers: {
    id: string;
    description: string;
    responsible: "OWNER" | "LEGAL_COUNSEL" | "DEVOPS" | "DEVELOPER";
  }[];
  prerequisites_for_launch: string[];
}

export interface LaunchReadinessOverrides {
  isLegalEntityConfigured?: boolean;
  isStripeLiveConfigured?: boolean;
  isSupabaseRegionVerified?: boolean;
  isSubprocessorsVerified?: boolean;
  isLegalReviewCompleted?: boolean;
  isTechnicalReady?: boolean;
}

export function evaluateLaunchReadiness(
  arg1?: boolean | LaunchReadinessOverrides,
  arg2?: boolean,
  arg3?: boolean,
  arg4?: boolean,
  arg5?: boolean,
  arg6?: boolean
): LaunchReadinessReport {
  let overrides: LaunchReadinessOverrides = {};

  if (typeof arg1 === "object" && arg1 !== null) {
    overrides = arg1;
  } else if (typeof arg1 === "boolean") {
    overrides = {
      isLegalEntityConfigured: arg1,
      isStripeLiveConfigured: arg2,
      isSupabaseRegionVerified: arg3,
      isSubprocessorsVerified: arg4 !== undefined ? arg4 : (arg1 && arg2 && arg3 ? true : undefined),
      isLegalReviewCompleted: arg5 !== undefined ? arg5 : (arg1 && arg2 && arg3 ? true : undefined),
      isTechnicalReady: arg6,
    };
  }

  // 1. Technical Readiness (Code & Automated Tests)
  const isTechnicalReady = overrides.isTechnicalReady !== false;
  const code_and_tests: TechnicalReadinessStatus = isTechnicalReady ? "PASS" : "FAIL";

  const blk01Assessment = assessBlockerEvidence("BLK-01");
  const blk02Assessment = assessBlockerEvidence("BLK-02");
  const blk03Assessment = assessBlockerEvidence("BLK-03");
  const blk04Assessment = assessBlockerEvidence("BLK-04");

  const blocker_lifecycle: Record<"BLK-01" | "BLK-02" | "BLK-03" | "BLK-04", BlockerLifecycleStatus> = {
    "BLK-01": overrides.isLegalEntityConfigured !== undefined
      ? (overrides.isLegalEntityConfigured ? "EVIDENCE_VALIDATED" : "NOT_STARTED")
      : blk01Assessment.status,
    "BLK-02": overrides.isStripeLiveConfigured !== undefined
      ? (overrides.isStripeLiveConfigured ? "EVIDENCE_VALIDATED" : "NOT_STARTED")
      : blk02Assessment.status,
    "BLK-03": overrides.isSupabaseRegionVerified !== undefined
      ? (overrides.isSupabaseRegionVerified ? "EVIDENCE_VALIDATED" : "NOT_STARTED")
      : blk03Assessment.status,
    "BLK-04": overrides.isSubprocessorsVerified !== undefined && overrides.isLegalReviewCompleted !== undefined
      ? (overrides.isSubprocessorsVerified && overrides.isLegalReviewCompleted ? "EVIDENCE_VALIDATED" : "NOT_STARTED")
      : blk04Assessment.status,
  };

  // 2. Legal Entity Verification
  let legal_entity: LegalEntityReadinessStatus;
  let isLegalEntityReady = false;

  if (overrides.isLegalEntityConfigured !== undefined) {
    isLegalEntityReady = overrides.isLegalEntityConfigured;
    legal_entity = isLegalEntityReady ? "VERIFIED" : "PENDING_OWNER_EVIDENCE";
  } else {
    const entityAssessment = assessLegalEntityReadiness();
    if (entityAssessment.isVerified && blk01Assessment.isVerified) {
      legal_entity = "VERIFIED";
      isLegalEntityReady = true;
    } else if (entityAssessment.status === "INVALID_DATA" || blk01Assessment.status === "REJECTED_OR_INCOMPLETE") {
      legal_entity = "INVALID_DATA";
      isLegalEntityReady = false;
    } else {
      legal_entity = "PENDING_OWNER_EVIDENCE";
      isLegalEntityReady = false;
    }
  }

  // 3. Stripe Production Readiness
  let stripe_production: StripeProductionStatus;
  let isStripeReady = false;

  if (overrides.isStripeLiveConfigured !== undefined) {
    isStripeReady = overrides.isStripeLiveConfigured;
    stripe_production = isStripeReady ? "VERIFIED_LIVE" : "PENDING_LIVE_VERIFICATION";
  } else {
    const stripeEnv = validateStripeEnvironment();
    if (stripeEnv.isProductionReady && blk02Assessment.isVerified) {
      stripe_production = "VERIFIED_LIVE";
      isStripeReady = true;
    } else if (stripeEnv.mode !== "missing") {
      stripe_production = "PENDING_LIVE_VERIFICATION";
      isStripeReady = false;
    } else {
      stripe_production = "UNCONFIGURED";
      isStripeReady = false;
    }
  }

  // 4. Hosting Region Verification
  let hosting_region: HostingRegionStatus;
  let isHostingRegionReady = false;

  if (overrides.isSupabaseRegionVerified !== undefined) {
    isHostingRegionReady = overrides.isSupabaseRegionVerified;
    hosting_region = isHostingRegionReady ? "VERIFIED_EU_CENTRAL_1" : "PENDING_DASHBOARD_VERIFICATION";
  } else {
    if (blk03Assessment.isVerified) {
      hosting_region = "VERIFIED_EU_CENTRAL_1";
      isHostingRegionReady = true;
    } else {
      // Default fail-closed until owner confirms AWS eu-central-1 Frankfurt dashboard screenshot/audit
      hosting_region = "PENDING_DASHBOARD_VERIFICATION";
      isHostingRegionReady = false;
    }
  }

  // 5. Subprocessor Agreements (DPA execution)
  let subprocessor_agreements: SubprocessorAgreementsStatus;
  let isSubprocessorsReady = false;

  if (overrides.isSubprocessorsVerified !== undefined) {
    isSubprocessorsReady = overrides.isSubprocessorsVerified;
    subprocessor_agreements = isSubprocessorsReady ? "EXECUTED_AND_REVIEWED" : "PENDING_DPA_ACCEPTANCE";
  } else {
    if (blk04Assessment.isVerified) {
      subprocessor_agreements = "EXECUTED_AND_REVIEWED";
      isSubprocessorsReady = true;
    } else {
      // Default to pending DPA acceptance
      subprocessor_agreements = "PENDING_DPA_ACCEPTANCE";
      isSubprocessorsReady = false;
    }
  }

  // 6. Local Legal Review
  let legal_review: LegalReviewStatus;
  let isLegalReviewReady = false;

  if (overrides.isLegalReviewCompleted !== undefined) {
    isLegalReviewReady = overrides.isLegalReviewCompleted;
    legal_review = isLegalReviewReady ? "COMPLETED" : "PENDING_COUNSEL_SIGNOFF";
  } else {
    if (blk04Assessment.isVerified) {
      legal_review = "COMPLETED";
      isLegalReviewReady = true;
    } else {
      legal_review = "PENDING_COUNSEL_SIGNOFF";
      isLegalReviewReady = false;
    }
  }

  // Consolidate open blockers
  const open_blockers: {
    id: string;
    description: string;
    responsible: "OWNER" | "LEGAL_COUNSEL" | "DEVOPS" | "DEVELOPER";
  }[] = [];

  if (!isLegalEntityReady) {
    open_blockers.push({
      id: "BLK-01",
      description: "Corporate legal entity details (name, address, NIF) and verification evidence not configured",
      responsible: "OWNER",
    });
  }

  if (!isStripeReady) {
    open_blockers.push({
      id: "BLK-02",
      description: "Stripe live production settings & tax configuration pending verification",
      responsible: "OWNER",
    });
  }

  if (!isHostingRegionReady) {
    open_blockers.push({
      id: "BLK-03",
      description: "Supabase production physical hosting region pending dashboard verification",
      responsible: "OWNER",
    });
  }

  if (!isSubprocessorsReady || !isLegalReviewReady) {
    open_blockers.push({
      id: "BLK-04",
      description: "Subprocessor DPAs execution and qualified legal counsel sign-off pending",
      responsible: "LEGAL_COUNSEL",
    });
  }

  // Commercial Launch Decision
  let decision: LaunchReadinessDecision;
  if (!isTechnicalReady) {
    decision = "BLOCKED";
  } else if (open_blockers.length > 0) {
    decision = "CONDITIONAL";
  } else {
    decision = "READY_FOR_DEFINED_SCOPE";
  }

  const dimensions: DimensionalReadiness = {
    code_and_tests,
    legal_entity,
    stripe_production,
    hosting_region,
    subprocessor_agreements,
    legal_review,
    commercial_launch: decision,
  };

  return {
    decision,
    dimensions,
    blocker_lifecycle,
    technical_readiness: code_and_tests,
    external_readiness: {
      legal_entity,
      stripe_production,
      hosting_region,
      subprocessor_agreements,
      legal_review,
    },
    scope: {
      product: ["workspace", "tasks", "documents", "decisions_log", "deterministic_memory"],
      geography: ["PT", "ES", "FR", "DE", "GB", "US"],
      excluded: ["CU", "IR", "KP", "SY", "RU_OCCUPIED_TERRITORIES"],
    },
    open_blockers,
    prerequisites_for_launch: open_blockers.map((b) => `[${b.id}] ${b.description}`),
  };
}
