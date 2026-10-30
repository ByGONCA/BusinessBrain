/**
 * Domain Types for BusinessBrain Global Legal & Regulatory Compliance System
 *
 * Enforces strict typing for risk evaluation, legal sourcing, marketing matrices,
 * quality gates, and Antigravity subagent runtime interfaces.
 */

export type RiskLevel =
  | 'CRITICAL'
  | 'HIGH'
  | 'MEDIUM'
  | 'LOW'
  | 'INDETERMINATE';

export type ComplianceVerdict =
  | 'APPROVED'
  | 'APPROVED_WITH_CONDITIONS'
  | 'BLOCKED'
  | 'LOCAL_LEGAL_VALIDATION_NEEDED'
  | 'INDETERMINATE';

export type DevelopmentStage =
  | 'EXPERIMENTAL'
  | 'TECHNICAL_APPROVAL'
  | 'PRODUCTION_APPROVAL';

export type InvestigationDomain =
  | 'AI_SYSTEMS'
  | 'REGULATED_PROFESSIONS'
  | 'DATA_PRIVACY'
  | 'INTERNATIONAL_MARKETING'
  | 'CONSUMER_ECOMMERCE'
  | 'PAYMENTS_SUBSCRIPTIONS'
  | 'CONTRACTS_PARTNERSHIPS'
  | 'INTELLECTUAL_PROPERTY'
  | 'SECURITY_CYBERSECURITY'
  | 'OTHER_REGULATORY';

export type LegalSourceType =
  | 'PRIMARY_STATUTE'
  | 'REGULATORY_DECREE'
  | 'DPA_GUIDANCE'
  | 'CASE_LAW'
  | 'OFFICIAL_REGISTER'
  | 'LEGISLATIVE_PROPOSAL';

export type LegalSourceStatus =
  | 'IN_FORCE'
  | 'ENACTED_FUTURE_DATE'
  | 'PROPOSAL_BILL'
  | 'REPEALED_SUPERSEDED';

export interface LegalSourceCitation {
  jurisdiction: string;
  subnational_region?: string | null;
  statute_or_code: string;
  section_or_article: string;
  official_source_url: string;
  status: LegalSourceStatus;
  effective_date?: string;
  consultation_date: string;
  summary: string;
  verified: boolean;
}

export interface AcceptanceCondition {
  id: string;
  risk_id: string;
  requirement: string;
  verification_method: 'AUTOMATED_TEST' | 'CODE_INSPECTION' | 'POLICY_DOCUMENT' | 'LEGAL_SIGN_OFF';
  status: 'PENDING' | 'SATISFIED' | 'FAILED';
  evidence?: string;
}

export interface ComplianceRisk {
  id: string;
  domain: InvestigationDomain;
  jurisdiction: string;
  severity: RiskLevel;
  title: string;
  description: string;
  citations: LegalSourceCitation[];
  acceptance_conditions: AcceptanceCondition[];
}

export type MarketingChannel =
  | 'EMAIL'
  | 'SMS'
  | 'PAID_SEARCH'
  | 'SOCIAL_ADS'
  | 'BEHAVIORAL_DISPLAY'
  | 'INFLUENCER'
  | 'AFFILIATE';

export type MarketingAudience = 'B2B' | 'B2C' | 'MIXED';

export interface MarketingComplianceRow {
  market: string;
  subnational_region?: string | null;
  channel: MarketingChannel;
  audience: MarketingAudience;
  consent_requirement: string;
  mandatory_disclosures: string[];
  advertising_restrictions: string[];
  personal_data_handling: string;
  language_requirements: string;
  official_sources: string[];
  risk_level: RiskLevel;
  verdict: ComplianceVerdict;
}

/**
 * Canonical 17-Section Compliance Report
 */
export interface ComplianceReport {
  // 1. Executive Summary
  id: string;
  executive_summary: string;
  
  // 2. Feature or Campaign Analyzed
  feature_or_campaign: string;
  code_commit_ref?: string;

  // 3. Markets & Jurisdictions Covered
  jurisdictions_covered: string[];

  // 4. Jurisdictions Remaining Unverified
  jurisdictions_unverified: string[];

  // 5. Applicable Legislation
  applicable_legislation: string[];

  // 6. Official Sources & Citations
  official_sources: LegalSourceCitation[];

  // 7. Confirmed Legal Obligations
  confirmed_obligations: string[];

  // 8. Identified Risks
  risks: ComplianceRisk[];

  // 9. Inter-Market Divergences & Conflicts
  market_divergences: string[];

  // 10. Recommended Technical Changes
  technical_recommendations: string[];

  // 11. Recommended Operational Changes
  operational_recommendations: string[];

  // 12. Contractual & Partner Requirements
  contractual_requirements: string[];

  // 13. Need for Local Legal Validation
  local_legal_validation_needed: boolean;
  local_legal_validation_scope?: string;

  // 14. Acceptance Criteria & Verifiable Conditions
  acceptance_conditions: AcceptanceCondition[];

  // 15. Final Verdict
  final_verdict: ComplianceVerdict;
  verdict_justification: string;

  // 16. Investigation Date
  investigation_date: string;

  // 17. Recommended Review Date
  recommended_review_date: string;
}

export interface EvaluationLedgerEntry {
  id: string;
  date: string;
  feature_or_campaign: string;
  jurisdictions: string[];
  risk_level: RiskLevel;
  verdict: ComplianceVerdict;
  conditions_pending: number;
  implementation_status: 'PENDING_IMPLEMENTATION' | 'IMPLEMENTED' | 'AWAITING_LEGAL_COUNSEL';
  re_evaluation_trigger: string;
  report_path: string;
}

export interface SubagentRegistrationPayload {
  tool: 'define_subagent';
  parameters: {
    Name: 'global-legal-compliance-agent';
    Description: string;
    EnableWriteTools: false;
    EnableSubagentTools: false;
    EnableMCPTools: false;
    SystemPrompt: string;
  };
}
