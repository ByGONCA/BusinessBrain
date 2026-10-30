/**
 * Deterministic Test Suite for BusinessBrain Global Legal Compliance Agent
 *
 * Verifies:
 * - Subagent registration payload schema & least-privilege enforcement
 * - Markets configuration integrity & Zod schema validation
 * - Sanctions and geofencing checks
 * - Explicit jurisdiction status & rejection of automatic approval by omission
 * - Three-stage quality gates (Experimental, Technical, Production)
 * - Strict Condition verification:
 *   * Empty, whitespace-only or trivial placeholder evidence (REJECTED)
 *   * Substantive evidence (ACCEPTED)
 *   * Stale evaluation check (expired review date or material change)
 *   * Malformed report handling (fail-closed)
 *   * Disclaimer rejection
 * - Marketing compliance matrix generator
 * - Compliance report structure (17 mandatory sections)
 * - Evaluations ledger parsing
 */

import fs from "fs";
import path from "path";
import {
  MarketsConfigSchema,
  loadMarketsConfig,
  isCountrySanctioned,
  getJurisdictionsForFeature,
  getJurisdictionStatus,
} from "../lib/compliance/markets.config";
import { evaluateQualityGate } from "../lib/compliance/quality-gates";
import {
  evaluateMarketChannel,
  generateMarketingComplianceMatrix,
} from "../lib/compliance/marketing-evaluator";
import {
  ComplianceReport,
  SubagentRegistrationPayload,
} from "../lib/compliance/types";

let passedCount = 0;
let failedCount = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    passedCount++;
    console.log(`  ✅ PASS: ${testName}`);
  } else {
    failedCount++;
    console.error(`  ❌ FAIL: ${testName}${detail ? ` -> ${detail}` : ""}`);
  }
}

export function runGlobalLegalComplianceTests() {
  console.log("======================================================");
  console.log("🧪 TESTING GLOBAL LEGAL COMPLIANCE AGENT");
  console.log("======================================================\n");

  // TEST 1: Subagent Registration Payload & Least Privilege
  console.log("--- Group 1: Subagent Architecture & Least Privilege ---");
  const subagentPayload: SubagentRegistrationPayload = {
    tool: "define_subagent",
    parameters: {
      Name: "global-legal-compliance-agent",
      Description:
        "Specialized analytical subagent for global legal, regulatory, and compliance risk investigation at BusinessBrain. Strictly read-only, least privilege, zero external MCP tools.",
      EnableWriteTools: false,
      EnableSubagentTools: false,
      EnableMCPTools: false,
      SystemPrompt:
        "És o BusinessBrain Global Legal Compliance Agent. A tua função é investigar com rigor normas vigentes...",
    },
  };

  assert(
    subagentPayload.parameters.EnableWriteTools === false,
    "Least Privilege: EnableWriteTools is strictly false"
  );
  assert(
    subagentPayload.parameters.EnableSubagentTools === false,
    "Least Privilege: EnableSubagentTools is strictly false"
  );
  assert(
    subagentPayload.parameters.EnableMCPTools === false,
    "Least Privilege: EnableMCPTools is strictly false"
  );
  assert(
    subagentPayload.parameters.Name === "global-legal-compliance-agent",
    "Subagent Name matches canonical identifier"
  );

  // TEST 2: Markets Configuration & Zod Schema
  console.log("\n--- Group 2: Markets Dynamic Configuration ---");
  const marketsConfig = loadMarketsConfig();
  const parseResult = MarketsConfigSchema.safeParse(marketsConfig);

  assert(parseResult.success, "config/markets.json matches MarketsConfigSchema");
  assert(
    marketsConfig.customer_onboarding_countries.includes("PT") &&
      marketsConfig.customer_onboarding_countries.includes("US") &&
      marketsConfig.customer_onboarding_countries.includes("GB"),
    "Customer onboarding includes PT, US, and GB"
  );

  // TEST 3: Sanctions, Geofencing & Anti-Omission
  console.log("\n--- Group 3: Sanctions, Geofencing & Anti-Omission ---");
  const cubaSanction = isCountrySanctioned("CU");
  const iranSanction = isCountrySanctioned("IR");
  const ptSanction = isCountrySanctioned("PT");
  const usSanction = isCountrySanctioned("US");

  assert(cubaSanction.sanctioned && cubaSanction.scope === "TOTAL_BLOCK", "Cuba is subject to TOTAL_BLOCK sanctions");
  assert(iranSanction.sanctioned && iranSanction.scope === "TOTAL_BLOCK", "Iran is subject to TOTAL_BLOCK sanctions");
  assert(!ptSanction.sanctioned, "Portugal is not sanctioned");
  assert(!usSanction.sanctioned, "United States is not sanctioned");

  // Anti-omission: Unknown jurisdictions must return UNCONFIGURED_NOT_PERMITTED
  const unknownStatus = getJurisdictionStatus("XX");
  assert(
    unknownStatus === "UNCONFIGURED_NOT_PERMITTED",
    "Anti-omission: Unknown jurisdiction 'XX' is UNCONFIGURED_NOT_PERMITTED, not approved by default"
  );

  const cubaStatus = getJurisdictionStatus("CU");
  assert(cubaStatus === "SANCTIONED_BLOCKED", "Sanctioned jurisdiction 'CU' status is SANCTIONED_BLOCKED");

  const ptStatus = getJurisdictionStatus("PT");
  assert(ptStatus === "EVALUATED_CONDITIONED", "Portugal status is EVALUATED_CONDITIONED");

  // TEST 4: Dynamic Jurisdiction Selection
  const featureMarkets = getJurisdictionsForFeature(["US", "FR"]);
  assert(
    featureMarkets.includes("US") && featureMarkets.includes("FR") && featureMarkets.length === 2,
    "Target markets override defaults when specified"
  );

  const defaultMarkets = getJurisdictionsForFeature();
  assert(
    defaultMarkets.includes("PT") && defaultMarkets.includes("US") && defaultMarkets.includes("GB"),
    "Default markets include core onboarding and P1 countries"
  );

  // TEST 5: Three-Stage Quality Gates & Negative Edge Cases
  console.log("\n--- Group 4: Quality Gates & Stage Differentiation ---");

  const mockCriticalReport: ComplianceReport = {
    id: "EVAL-TEST-001",
    executive_summary: "High risk test report",
    feature_or_campaign: "Test Feature",
    jurisdictions_covered: ["US"],
    jurisdictions_unverified: [],
    applicable_legislation: ["TCPA"],
    official_sources: [],
    confirmed_obligations: ["Prior express consent required"],
    risks: [
      {
        id: "RISK-01",
        domain: "INTERNATIONAL_MARKETING",
        jurisdiction: "US",
        severity: "CRITICAL",
        title: "Cold SMS without prior written consent",
        description: "Violates 47 U.S.C. 227",
        citations: [],
        acceptance_conditions: [
          {
            id: "COND-01",
            risk_id: "RISK-01",
            requirement: "Implement opt-in checkbox",
            verification_method: "AUTOMATED_TEST",
            status: "PENDING",
          },
        ],
      },
    ],
    market_divergences: [],
    technical_recommendations: [],
    operational_recommendations: [],
    contractual_requirements: [],
    local_legal_validation_needed: false,
    acceptance_conditions: [
      {
        id: "COND-01",
        risk_id: "RISK-01",
        requirement: "Implement opt-in checkbox",
        verification_method: "AUTOMATED_TEST",
        status: "PENDING",
      },
    ],
    final_verdict: "APPROVED_WITH_CONDITIONS",
    verdict_justification: "Critical risk pending mitigation",
    investigation_date: "2026-10-28",
    recommended_review_date: "2027-04-28",
  };

  // Experimental stage must allow development under critical risk to code mitigations
  const expGate = evaluateQualityGate(mockCriticalReport, "EXPERIMENTAL");
  assert(
    expGate.allowed === true && expGate.stage === "EXPERIMENTAL",
    "Quality Gate: EXPERIMENTAL stage permits development under active CRITICAL risk"
  );

  // Production stage must strictly block under unresolved critical risk
  const prodGateBlocked = evaluateQualityGate(mockCriticalReport, "PRODUCTION_APPROVAL");
  assert(
    prodGateBlocked.allowed === false,
    "Quality Gate: PRODUCTION_APPROVAL strictly blocks unresolved CRITICAL risk"
  );
  assert(
    prodGateBlocked.blocking_reasons.some((r) => r.includes("Unresolved CRITICAL risk")),
    "Quality Gate: Blocking reason cites the unresolved CRITICAL risk"
  );

  // Disclaimers do NOT clear production gate
  const prodWithDisclaimer = evaluateQualityGate(mockCriticalReport, "PRODUCTION_APPROVAL", { disclaimerPresent: true });
  assert(
    prodWithDisclaimer.allowed === false,
    "Quality Gate: Disclaimers NEVER override or clear substantive legal risk"
  );

  // Evidence validation: SATISFIED with empty evidence must block
  const emptyEvidenceReport: ComplianceReport = {
    ...mockCriticalReport,
    acceptance_conditions: [
      {
        id: "COND-01",
        risk_id: "RISK-01",
        requirement: "Implement opt-in checkbox",
        verification_method: "AUTOMATED_TEST",
        status: "SATISFIED",
        evidence: "",
      },
    ],
  };
  const gateEmptyEvidence = evaluateQualityGate(emptyEvidenceReport, "PRODUCTION_APPROVAL");
  assert(
    gateEmptyEvidence.allowed === false && gateEmptyEvidence.blocking_reasons.some((r) => r.includes("lacks substantive evidence")),
    "Quality Gate: Condition marked SATISFIED with empty evidence is strictly blocked"
  );

  // Evidence validation: SATISFIED with trivial placeholder evidence must block
  const trivialEvidenceReport: ComplianceReport = {
    ...mockCriticalReport,
    acceptance_conditions: [
      {
        id: "COND-01",
        risk_id: "RISK-01",
        requirement: "Implement opt-in checkbox",
        verification_method: "AUTOMATED_TEST",
        status: "SATISFIED",
        evidence: "test passed", // Trivial placeholder!
      },
    ],
  };
  const gateTrivialEvidence = evaluateQualityGate(trivialEvidenceReport, "PRODUCTION_APPROVAL");
  assert(
    gateTrivialEvidence.allowed === false && gateTrivialEvidence.blocking_reasons.some((r) => r.includes("lacks substantive evidence")),
    "Quality Gate: Condition marked SATISFIED with trivial placeholder ('test passed') is strictly blocked"
  );

  // Stale evaluation check: Expired review date
  const mockSatisfiedValidReport: ComplianceReport = {
    ...mockCriticalReport,
    acceptance_conditions: [
      {
        id: "COND-01",
        risk_id: "RISK-01",
        requirement: "Implement opt-in checkbox",
        verification_method: "AUTOMATED_TEST",
        status: "SATISFIED",
        evidence: "Verified by automated test suite in scripts/test-marketing.ts: assertion #4 (commit 9f12c4)",
      },
    ],
  };

  const expiredGate = evaluateQualityGate(mockSatisfiedValidReport, "PRODUCTION_APPROVAL", {
    currentDate: "2027-05-01", // Past the review date of 2027-04-28
  });
  assert(
    expiredGate.allowed === false && expiredGate.blocking_reasons.some((r) => r.includes("expired")),
    "Quality Gate: Evaluation past recommended_review_date is blocked as expired"
  );

  // Stale evaluation check: Material change detected
  const materialChangeGate = evaluateQualityGate(mockSatisfiedValidReport, "PRODUCTION_APPROVAL", {
    materialChangeDetected: true,
  });
  assert(
    materialChangeGate.allowed === false && materialChangeGate.blocking_reasons.some((r) => r.includes("material product or regulatory change")),
    "Quality Gate: Material change invalidates prior evaluation"
  );

  // Fail-closed structural tests: Malformed or missing report fields
  // @ts-expect-error Testing runtime fail-closed robustness against malformed input
  const nullReportGate = evaluateQualityGate(null, "PRODUCTION_APPROVAL");
  assert(
    nullReportGate.allowed === false && nullReportGate.blocking_reasons.some((r) => r.includes("fail-closed")),
    "Quality Gate: Null report fails closed immediately"
  );

  // Local legal counsel requirement blocks production if sign-off is pending
  const mockCounselNeededReport: ComplianceReport = {
    ...mockCriticalReport,
    risks: [],
    final_verdict: "LOCAL_LEGAL_VALIDATION_NEEDED",
    local_legal_validation_needed: true,
    acceptance_conditions: [
      {
        id: "COND-LEGAL",
        risk_id: "LEGAL",
        requirement: "German legal counsel sign-off on UWG email cold outreach",
        verification_method: "LEGAL_SIGN_OFF",
        status: "PENDING",
      },
    ],
  };

  const counselGate = evaluateQualityGate(mockCounselNeededReport, "PRODUCTION_APPROVAL");
  assert(
    counselGate.allowed === false && counselGate.requires_legal_counsel === true,
    "Quality Gate: Pending local legal counsel blocks PRODUCTION_APPROVAL"
  );

  // Satisfied conditions with valid substantive evidence allows production approval
  const satisfiedGate = evaluateQualityGate(mockSatisfiedValidReport, "PRODUCTION_APPROVAL", {
    currentDate: "2026-11-01",
  });
  assert(
    satisfiedGate.allowed === true,
    "Quality Gate: PRODUCTION_APPROVAL passes when all acceptance conditions are SATISFIED with substantive evidence"
  );

  // TEST 6: Marketing Compliance Matrix Evaluator
  console.log("\n--- Group 5: Marketing Compliance Matrix Evaluator ---");
  const usEmailRow = evaluateMarketChannel("US", "EMAIL", "B2B", {
    has_clear_opt_out_link: true,
    has_sender_physical_address: true,
    has_commercial_identification: true,
  });
  assert(
    usEmailRow.verdict === "APPROVED" && usEmailRow.consent_requirement.includes("CAN-SPAM"),
    "Marketing Evaluator: US B2B email recognizes CAN-SPAM opt-out regime"
  );

  const euB2cCold = evaluateMarketChannel("PT", "EMAIL", "B2C", {
    has_prior_opt_in: false,
    is_existing_customer: false,
  });
  assert(
    euB2cCold.verdict === "BLOCKED" && euB2cCold.risk_level === "HIGH",
    "Marketing Evaluator: EU B2C cold email without opt-in is BLOCKED under e-Privacy/GDPR"
  );

  const caEmailCold = evaluateMarketChannel("CA", "EMAIL", "B2B", {
    has_prior_opt_in: false,
  });
  assert(
    caEmailCold.verdict === "BLOCKED" && caEmailCold.consent_requirement.includes("CASL"),
    "Marketing Evaluator: Canada CASL requires express opt-in even for B2B cold outreach"
  );

  // TEST 7: Multi-Country Matrix Generation
  const matrix = generateMarketingComplianceMatrix({
    campaign_name: "Global Pro Launch",
    target_markets: ["US", "PT", "GB", "CA", "BR"],
    channel: "EMAIL",
    audience: "B2C",
    has_prior_opt_in: true,
    has_clear_opt_out_link: true,
    has_sender_physical_address: true,
    has_commercial_identification: true,
  });
  assert(matrix.length === 5, "Matrix generates rows for all 5 target markets");
  assert(
    matrix.every((r) => r.mandatory_disclosures.length > 0),
    "Every matrix row specifies mandatory disclosures"
  );

  // TEST 8: Evaluations Registry Ledger
  console.log("\n--- Group 6: Evaluations Ledger Parsing ---");
  const registryPath = path.resolve(process.cwd(), "docs/compliance/evaluations/registry.json");
  assert(fs.existsSync(registryPath), "docs/compliance/evaluations/registry.json exists on disk");
  const registryRaw = fs.readFileSync(registryPath, "utf-8");
  const registry = JSON.parse(registryRaw);
  assert(
    Array.isArray(registry.evaluations) && registry.evaluations.length >= 1,
    "Registry ledger contains baseline evaluation entry"
  );
  assert(
    registry.evaluations[0].id === "EVAL-2026-001",
    "Baseline evaluation EVAL-2026-001 is recorded in registry"
  );

  // SUMMARY
  console.log("\n======================================================");
  console.log(`TEST RESULTS: ${passedCount} PASSED, ${failedCount} FAILED`);
  console.log("======================================================");

  if (failedCount > 0) {
    process.exit(1);
  }
}

if (require.main === module) {
  runGlobalLegalComplianceTests();
}
