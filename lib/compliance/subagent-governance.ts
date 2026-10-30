/**
 * Subagent Governance & Output Processor for Global Legal Compliance
 *
 * Implements strict runtime governance for `global-legal-compliance-agent`:
 * 1. Least privilege validation (Write=false, Subagent=false, MCP=false)
 * 2. Safe processing of raw LLM subagent responses
 * 3. Handles empty responses, timeouts, tool failures, and web search unavailability
 * 4. Strictly separates preliminary advisory outputs from definitive production approval gates
 */

import {
  ComplianceReport,
  ComplianceVerdict,
  SubagentRegistrationPayload,
} from "./types";

export interface SubagentOutputProcessingOptions {
  webSearchAvailable?: boolean;
  timeoutOccurred?: boolean;
  toolError?: string | null;
}

export interface ProcessedSubagentResult {
  status: "SUCCESS" | "EMPTY_RESPONSE" | "TIMEOUT" | "TOOL_FAILURE" | "MALFORMED_OUTPUT";
  isPreliminaryAdvisory: true; // Always true: subagent opinions never bypass production gates directly
  preliminaryVerdict: ComplianceVerdict;
  report: ComplianceReport | null;
  webSearchAvailable: boolean;
  requiresHumanLegalReview: boolean;
  notes: string[];
}

export const CANONICAL_LEAST_PRIVILEGE_REGISTRATION: SubagentRegistrationPayload = {
  tool: "define_subagent",
  parameters: {
    Name: "global-legal-compliance-agent",
    Description:
      "Autonomous global legal and regulatory compliance agent for BusinessBrain. Performs read-only statutory investigations.",
    EnableWriteTools: false,
    EnableSubagentTools: false,
    EnableMCPTools: false,
    SystemPrompt:
      "You are the BusinessBrain Global Legal Compliance Agent. You operate under the strict principle of least privilege with read-only tools.",
  },
};

/**
 * Validates that subagent registration strictly adheres to the least privilege invariant.
 */
export function validateSubagentRegistrationPrivileges(
  payload: SubagentRegistrationPayload
): { valid: boolean; violations: string[] } {
  const violations: string[] = [];

  if (payload.parameters.EnableWriteTools !== false) {
    violations.push("Violation: EnableWriteTools must be strictly false.");
  }
  if (payload.parameters.EnableSubagentTools !== false) {
    violations.push("Violation: EnableSubagentTools must be strictly false.");
  }
  if (payload.parameters.EnableMCPTools !== false) {
    violations.push("Violation: EnableMCPTools must be strictly false.");
  }

  return {
    valid: violations.length === 0,
    violations,
  };
}

/**
 * Parses and audits the response returned by `global-legal-compliance-agent`.
 * Prevents preliminary text responses from granting automatic production clearance.
 */
export function processSubagentResponse(
  rawText: string | null | undefined,
  options: SubagentOutputProcessingOptions = {}
): ProcessedSubagentResult {
  const webSearchAvailable = options.webSearchAvailable ?? true;
  const notes: string[] = [];

  // 1. Timeout Check
  if (options.timeoutOccurred) {
    return {
      status: "TIMEOUT",
      isPreliminaryAdvisory: true,
      preliminaryVerdict: "INDETERMINATE",
      report: null,
      webSearchAvailable,
      requiresHumanLegalReview: true,
      notes: ["Subagent invocation timed out before delivering analysis."],
    };
  }

  // 2. Tool Failure Check
  if (options.toolError) {
    return {
      status: "TOOL_FAILURE",
      isPreliminaryAdvisory: true,
      preliminaryVerdict: "INDETERMINATE",
      report: null,
      webSearchAvailable,
      requiresHumanLegalReview: true,
      notes: [`Tool error occurred during legal research: ${options.toolError}`],
    };
  }

  // 3. Empty Response Check
  if (!rawText || rawText.trim().length === 0) {
    return {
      status: "EMPTY_RESPONSE",
      isPreliminaryAdvisory: true,
      preliminaryVerdict: "INDETERMINATE",
      report: null,
      webSearchAvailable,
      requiresHumanLegalReview: true,
      notes: ["Subagent returned an empty response."],
    };
  }

  // 4. Missing Web Search Handling
  if (!webSearchAvailable) {
    notes.push(
      "Web search was unavailable during investigation; statutory conclusions are unverified against live registers."
    );
  }

  // 5. Extract JSON report if embedded, or synthesize preliminary structured findings
  let report: ComplianceReport | null = null;
  let preliminaryVerdict: ComplianceVerdict = "INDETERMINATE";

  // Look for JSON block in markdown
  const jsonMatch = rawText.match(/```json\s*([\s\S]*?)\s*```/);
  if (jsonMatch) {
    try {
      report = JSON.parse(jsonMatch[1]);
      if (report && report.final_verdict) {
        preliminaryVerdict = report.final_verdict;
      }
    } catch {
      notes.push("Embedded JSON in subagent output was malformed.");
    }
  }

  // Detect verdict keywords if structured JSON was omitted
  if (!report) {
    if (/BLOCKED/i.test(rawText)) {
      preliminaryVerdict = "BLOCKED";
    } else if (/LOCAL_LEGAL_VALIDATION_NEEDED/i.test(rawText) || /procuradoria il[ií]cita/i.test(rawText)) {
      preliminaryVerdict = "LOCAL_LEGAL_VALIDATION_NEEDED";
    } else if (/APPROVED_WITH_CONDITIONS/i.test(rawText)) {
      preliminaryVerdict = "APPROVED_WITH_CONDITIONS";
    } else if (/APPROVED/i.test(rawText)) {
      preliminaryVerdict = "APPROVED";
    }
  }

  // Invariant: If web search was unavailable, preliminary verdict cannot be unconditioned "APPROVED"
  if (!webSearchAvailable && preliminaryVerdict === "APPROVED") {
    preliminaryVerdict = "INDETERMINATE";
    notes.push("Verdict downgraded to INDETERMINATE because live official registers could not be verified.");
  }

  const requiresHumanLegalReview =
    preliminaryVerdict === "LOCAL_LEGAL_VALIDATION_NEEDED" ||
    preliminaryVerdict === "INDETERMINATE" ||
    preliminaryVerdict === "BLOCKED" ||
    !webSearchAvailable;

  return {
    status: "SUCCESS",
    isPreliminaryAdvisory: true,
    preliminaryVerdict,
    report,
    webSearchAvailable,
    requiresHumanLegalReview,
    notes,
  };
}
