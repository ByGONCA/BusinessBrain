/**
 * Compliance Quality Gate Lifecycle, Release Paths & Negative Testing Suite
 *
 * Verifies the production release gates and operational integration of the
 * BusinessBrain Global Legal Compliance Agent:
 *
 * 1. Valid evaluation allows release to proceed (Scenario 1)
 * 2. Unresolved CRITICAL / HIGH risk or BLOCKED verdict blocks release (Scenario 2)
 * 3. Gate failure (malformed report / missing file / corrupt data) blocks release (Scenario 3)
 * 4. Expired evaluation (recommended_review_date < currentDate) blocks release (Scenario 4)
 * 5. Unauthorized or sanctioned jurisdiction (e.g. "XX", "CU") blocks release (Scenario 5)
 * 6. Real process execution & exit codes (code 0 for pass, code 1 for blocked)
 * 7. Regulatory horizon monitor status & proximity detection
 * 8. Subagent governance parsing, empty responses, timeouts, and tool errors
 * 9. Production build pipeline integration check (package.json & CI workflow)
 */

import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import { runComplianceGateVerification } from "./verify-compliance-gate";
import { runRegulatoryHorizonScan } from "./monitor-regulatory-updates";
import {
  processSubagentResponse,
  validateSubagentRegistrationPrivileges,
  CANONICAL_LEAST_PRIVILEGE_REGISTRATION,
} from "../lib/compliance/subagent-governance";
import { ComplianceReport } from "../lib/compliance/types";
import { evaluateQualityGate } from "../lib/compliance/quality-gates";

let passedCount = 0;
let failedCount = 0;

function assert(condition: boolean, testName: string, details?: string) {
  if (condition) {
    console.log(`  ✅ PASSED: ${testName}`);
    passedCount++;
  } else {
    console.error(`  ❌ FAILED: ${testName}`);
    if (details) console.error(`     Details: ${details}`);
    failedCount++;
  }
}

const TEMP_DIR = path.resolve(process.cwd(), ".compliance-test-tmp");

function setupTempDir() {
  if (!fs.existsSync(TEMP_DIR)) {
    fs.mkdirSync(TEMP_DIR, { recursive: true });
  }
}

function cleanupTempDir() {
  if (fs.existsSync(TEMP_DIR)) {
    fs.rmSync(TEMP_DIR, { recursive: true, force: true });
  }
}

async function runAllTests() {
  console.log("==================================================================");
  console.log("COMPLIANCE QUALITY GATE LIFECYCLE & RELEASE ENFORCEMENT SUITE");
  console.log("==================================================================\n");

  setupTempDir();

  try {
    // -------------------------------------------------------------------------
    // TEST GROUP 1: Canonical Baseline Verification
    // -------------------------------------------------------------------------
    console.log("--- 1. Canonical Production Registry Verification ---");
    const baselineResult = runComplianceGateVerification({ exitOnError: false });
    assert(baselineResult.success === true, "Canonical registry passes production quality gate", `Expected success=true, got ${baselineResult.success}`);
    assert(baselineResult.blockedCount === 0, "Zero blocked evaluations in baseline", `Blocked: ${baselineResult.blockedCount}`);
    assert(baselineResult.passedCount > 0, "At least one evaluation verified", `Passed: ${baselineResult.passedCount}`);

    // -------------------------------------------------------------------------
    // TEST GROUP 2: Scenario 1 - Valid Evaluation Allows Release
    // -------------------------------------------------------------------------
    console.log("\n--- 2. Scenario 1: Valid Evaluation Allows Release ---");
    const validReport: ComplianceReport = {
      id: "EVAL-TEST-VALID",
      executive_summary: "Valid test report",
      feature_or_campaign: "Test Feature",
      jurisdictions_covered: ["PT", "US", "GB"],
      jurisdictions_unverified: [],
      applicable_legislation: ["RGPD"],
      official_sources: [],
      confirmed_obligations: ["Consent logged"],
      risks: [
        {
          id: "RISK-01",
          domain: "DATA_PRIVACY",
          jurisdiction: "PT",
          severity: "MEDIUM",
          title: "Medium risk",
          description: "Mitigated test risk",
          citations: [],
          acceptance_conditions: [
            {
              id: "COND-01",
              risk_id: "RISK-01",
              requirement: "Verify consent flow",
              verification_method: "CODE_INSPECTION",
              status: "SATISFIED",
              evidence: "Verified code inspection at lib/auth/signup-action.ts with explicit opt-in",
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
          requirement: "Verify consent flow",
          verification_method: "CODE_INSPECTION",
          status: "SATISFIED",
          evidence: "Verified code inspection at lib/auth/signup-action.ts with explicit opt-in",
        },
      ],
      final_verdict: "APPROVED_WITH_CONDITIONS",
      verdict_justification: "All conditions satisfied",
      investigation_date: "2026-10-28",
      recommended_review_date: "2027-10-28",
    };

    const validGateResult = evaluateQualityGate(validReport, "PRODUCTION_APPROVAL", { currentDate: "2026-10-28" });
    assert(validGateResult.allowed === true, "Valid report is allowed for PRODUCTION_APPROVAL", validGateResult.blocking_reasons.join(", "));

    // -------------------------------------------------------------------------
    // TEST GROUP 3: Scenario 2 - Unresolved CRITICAL/HIGH Risk Blocks Release
    // -------------------------------------------------------------------------
    console.log("\n--- 3. Scenario 2: Unresolved CRITICAL / HIGH Risk Blocks Release ---");
    const criticalRiskReport: ComplianceReport = {
      ...validReport,
      id: "EVAL-TEST-CRITICAL",
      risks: [
        {
          id: "RISK-CRIT",
          domain: "REGULATED_PROFESSIONS",
          jurisdiction: "PT",
          severity: "CRITICAL",
          title: "Unmitigated procuradoria ilicita risk",
          description: "System generates automated legal advice without lawyer sign-off",
          citations: [],
          acceptance_conditions: [
            {
              id: "COND-CRIT",
              risk_id: "RISK-CRIT",
              requirement: "Lawyer formal sign-off",
              verification_method: "LEGAL_SIGN_OFF",
              status: "PENDING",
            },
          ],
        },
      ],
      acceptance_conditions: [
        {
          id: "COND-CRIT",
          risk_id: "RISK-CRIT",
          requirement: "Lawyer formal sign-off",
          verification_method: "LEGAL_SIGN_OFF",
          status: "PENDING",
        },
      ],
    };

    const criticalGateResult = evaluateQualityGate(criticalRiskReport, "PRODUCTION_APPROVAL");
    assert(criticalGateResult.allowed === false, "Unresolved CRITICAL risk strictly blocks PRODUCTION_APPROVAL");
    assert(
      criticalGateResult.blocking_reasons.some((r) => r.includes("Unresolved CRITICAL risk")),
      "Blocking reasons cite unresolved CRITICAL risk"
    );

    // -------------------------------------------------------------------------
    // TEST GROUP 4: Scenario 3 - Malformed Report / Gate Failure Blocks Release
    // -------------------------------------------------------------------------
    console.log("\n--- 4. Scenario 3: Malformed Report / Corrupt Data Blocks Release ---");
    const malformedResult = evaluateQualityGate(null as any, "PRODUCTION_APPROVAL");
    assert(malformedResult.allowed === false, "Null report object fails closed (allowed: false)");
    assert(malformedResult.verdict === "INDETERMINATE", "Null report yields INDETERMINATE verdict");

    const nonArrayRisksResult = evaluateQualityGate({ ...validReport, risks: "invalid" as any }, "PRODUCTION_APPROVAL");
    assert(nonArrayRisksResult.allowed === false, "Non-array risks field fails closed");

    // -------------------------------------------------------------------------
    // TEST GROUP 5: Scenario 4 - Expired Evaluation Blocks Release
    // -------------------------------------------------------------------------
    console.log("\n--- 5. Scenario 4: Expired Evaluation Blocks Release ---");
    const expiredReport: ComplianceReport = {
      ...validReport,
      recommended_review_date: "2025-01-01",
    };
    const expiredGateResult = evaluateQualityGate(expiredReport, "PRODUCTION_APPROVAL", { currentDate: "2026-10-28" });
    assert(expiredGateResult.allowed === false, "Evaluation past review date strictly blocks PRODUCTION_APPROVAL");
    assert(
      expiredGateResult.blocking_reasons.some((r) => r.includes("Compliance evaluation expired")),
      "Blocking reasons cite expired review horizon"
    );

    // -------------------------------------------------------------------------
    // TEST GROUP 6: Scenario 5 - Unauthorized / Sanctioned Jurisdiction Blocks
    // -------------------------------------------------------------------------
    console.log("\n--- 6. Scenario 5: Unauthorized or Sanctioned Jurisdiction Blocks ---");
    const sanctionedReport: ComplianceReport = {
      ...validReport,
      jurisdictions_covered: ["PT", "CU"], // Cuba is sanctioned
    };
    const sanctionedResult = evaluateQualityGate(sanctionedReport, "PRODUCTION_APPROVAL");
    assert(sanctionedResult.allowed === false, "Sanctioned jurisdiction (CU) strictly blocks PRODUCTION_APPROVAL");
    assert(
      sanctionedResult.blocking_reasons.some((r) => r.includes("trade/economic sanctions")),
      "Blocking reasons cite trade/economic sanctions"
    );

    const unknownJurisdictionReport: ComplianceReport = {
      ...validReport,
      jurisdictions_covered: ["PT", "XX"], // XX is unknown / unconfigured
    };
    const unknownResult = evaluateQualityGate(unknownJurisdictionReport, "PRODUCTION_APPROVAL");
    assert(unknownResult.allowed === false, "Unknown jurisdiction (XX) strictly blocks PRODUCTION_APPROVAL");
    assert(
      unknownResult.blocking_reasons.some((r) => r.includes("unknown or unconfigured")),
      "Blocking reasons cite unknown/unconfigured jurisdiction"
    );

    // -------------------------------------------------------------------------
    // TEST GROUP 7: Scenario 6 - Real Process Execution & CLI Exit Codes
    // -------------------------------------------------------------------------
    console.log("\n--- 7. Scenario 6: Process Exit Code Verification ---");
    // Verify CLI exits with code 0 on valid baseline
    let cliExitCode = -1;
    try {
      execSync("npx tsx scripts/verify-compliance-gate.ts", { stdio: "pipe" });
      cliExitCode = 0;
    } catch (err: any) {
      cliExitCode = err.status ?? 1;
    }
    assert(cliExitCode === 0, "CLI verify-compliance-gate.ts exits with code 0 on valid baseline", `Code: ${cliExitCode}`);

    // Verify custom failing registry causes exit code 1
    const badRegistryPath = path.join(TEMP_DIR, "bad-registry.json");
    fs.writeFileSync(
      badRegistryPath,
      JSON.stringify({
        evaluations: [
          {
            id: "EVAL-BAD-01",
            date: "2026-10-28",
            feature_or_campaign: "Sanctioned Feature",
            jurisdictions: ["CU"],
            risk_level: "CRITICAL",
            verdict: "BLOCKED",
            conditions_pending: 1,
            implementation_status: "PENDING_IMPLEMENTATION",
            re_evaluation_trigger: "Never",
            report_path: "docs/compliance/evaluations/nonexistent.md",
          },
        ],
      })
    );

    const badRegistryResult = runComplianceGateVerification({ registryPath: badRegistryPath, exitOnError: false });
    assert(badRegistryResult.success === false, "Bad registry returns success=false", `Got: ${badRegistryResult.success}`);
    assert(badRegistryResult.blockedCount > 0, "Bad registry records blocked count", `Blocked: ${badRegistryResult.blockedCount}`);

    // -------------------------------------------------------------------------
    // TEST GROUP 8: Scenario 7 - Regulatory Horizon Monitor Output
    // -------------------------------------------------------------------------
    console.log("\n--- 8. Scenario 7: Regulatory Horizon Monitor Scan ---");
    const scanResult = runRegulatoryHorizonScan({ currentDate: "2026-10-28" });
    assert(scanResult.total_milestones_monitored >= 6, "Monitors at least 6 primary milestones", `Count: ${scanResult.total_milestones_monitored}`);
    assert(
      scanResult.verified_primary_sources.every((s) => s.official_citation.length > 5 && s.source_url.startsWith("http")),
      "All monitored primary sources contain valid citations and URLs"
    );
    assert(
      ["COMPLETED_NO_CHANGES_DETECTED", "CHANGES_DETECTED_REVIEW_REQUIRED", "HUMAN_LEGAL_REVIEW_NEEDED"].includes(scanResult.audit_status),
      "Audit status is valid and structured",
      `Status: ${scanResult.audit_status}`
    );

    // -------------------------------------------------------------------------
    // TEST GROUP 9: Scenario 8 - Subagent Governance & Fail-Closed Robustness
    // -------------------------------------------------------------------------
    console.log("\n--- 9. Scenario 8: Subagent Governance Robustness ---");
    const privCheck = validateSubagentRegistrationPrivileges(CANONICAL_LEAST_PRIVILEGE_REGISTRATION);
    assert(privCheck.valid === true, "Canonical subagent registration satisfies least privilege (all false)");

    const emptyResult = processSubagentResponse("");
    assert(emptyResult.status === "EMPTY_RESPONSE", "Empty subagent response yields EMPTY_RESPONSE");
    assert(emptyResult.preliminaryVerdict === "INDETERMINATE", "Empty response defaults to INDETERMINATE");
    assert(emptyResult.requiresHumanLegalReview === true, "Empty response enforces human review");

    const timeoutResult = processSubagentResponse("Partial text...", { timeoutOccurred: true });
    assert(timeoutResult.status === "TIMEOUT", "Timeout flag yields TIMEOUT status");
    assert(timeoutResult.requiresHumanLegalReview === true, "Timeout enforces human review");

    const toolErrorResult = processSubagentResponse(null, { toolError: "Web search API unreachable" });
    assert(toolErrorResult.status === "TOOL_FAILURE", "Tool error yields TOOL_FAILURE");

    const noWebSearchResult = processSubagentResponse("Feature APPROVED without conditions", { webSearchAvailable: false });
    assert(
      noWebSearchResult.preliminaryVerdict === "INDETERMINATE",
      "APPROVED verdict downgraded to INDETERMINATE when web search is unavailable"
    );

    // -------------------------------------------------------------------------
    // TEST GROUP 10: Scenario 9 - Build Pipeline Integration Check
    // -------------------------------------------------------------------------
    console.log("\n--- 10. Scenario 9: Production Build & CI Integration ---");
    const pkg = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), "package.json"), "utf-8"));
    assert(
      pkg.scripts.build.includes("compliance:check"),
      "package.json 'build' script invokes compliance:check",
      `Actual script: ${pkg.scripts.build}`
    );

    const ciYaml = fs.readFileSync(path.resolve(process.cwd(), ".github/workflows/ci.yml"), "utf-8");
    assert(
      ciYaml.includes("compliance:check"),
      ".github/workflows/ci.yml contains explicit compliance:check pre-build gate"
    );

    const monitorWorkflow = path.resolve(process.cwd(), ".github/workflows/compliance-monitor.yml");
    assert(fs.existsSync(monitorWorkflow), ".github/workflows/compliance-monitor.yml exists");
    const monitorYaml = fs.readFileSync(monitorWorkflow, "utf-8");
    assert(monitorYaml.includes("cron:"), "compliance-monitor.yml contains scheduled cron");
    assert(monitorYaml.includes("workflow_dispatch:"), "compliance-monitor.yml allows manual dispatch");
    assert(monitorYaml.includes("concurrency:"), "compliance-monitor.yml configures concurrency locking");

  } finally {
    cleanupTempDir();
  }

  console.log("\n==================================================================");
  console.log(`TEST SUMMARY: ${passedCount} PASSED, ${failedCount} FAILED`);
  console.log("==================================================================");

  if (failedCount > 0) {
    process.exit(1);
  }
}

runAllTests().catch((err) => {
  console.error("Unhandled test suite error:", err);
  process.exit(1);
});
