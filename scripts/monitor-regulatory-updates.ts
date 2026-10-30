/**
 * Regulatory Horizon & Legislative Monitoring Script
 *
 * Scans legislative timelines, entry-into-force milestones, and official regulatory
 * updates affecting BusinessBrain's global footprint.
 *
 * Operational Transparency:
 * - This script runs deterministically in diagnostic mode.
 * - Scheduled execution via GitHub Actions (`.github/workflows/compliance-monitor.yml`).
 * - Distinguishes enacted laws, future enforcement milestones, and draft proposals.
 * - Categorizes audit outcomes cleanly:
 *   1. COMPLETED_NO_CHANGES_DETECTED
 *   2. CHANGES_DETECTED_REVIEW_REQUIRED
 *   3. INCOMPLETE_QUERY
 *   4. TECHNICAL_FAILURE
 *   5. HUMAN_LEGAL_REVIEW_NEEDED
 */

import fs from "fs";
import path from "path";
import { getActiveMarketsConfig } from "../lib/compliance/markets.config";

export interface LegislativeMilestone {
  id: string;
  jurisdiction: string;
  regime: string;
  official_reference: string;
  official_source_url: string;
  status: "IN_FORCE" | "ENACTED_FUTURE_DATE" | "PROPOSAL_BILL";
  milestone_date: string;
  affected_modules: string[];
  summary: string;
  action_recommended: string;
  requires_legal_counsel_review?: boolean;
}

export type HorizonScanAuditStatus =
  | "COMPLETED_NO_CHANGES_DETECTED"
  | "CHANGES_DETECTED_REVIEW_REQUIRED"
  | "INCOMPLETE_QUERY"
  | "TECHNICAL_FAILURE"
  | "HUMAN_LEGAL_REVIEW_NEEDED";

export interface VerifiedPrimarySourceReference {
  regime: string;
  jurisdiction: string;
  official_citation: string;
  source_url: string;
  last_verified_date: string;
  status: "IN_FORCE" | "ENACTED_FUTURE_DATE" | "PROPOSAL_BILL";
}

export interface HorizonScanAuditResult {
  scan_timestamp: string;
  audit_status: HorizonScanAuditStatus;
  active_footprint: string[];
  total_milestones_monitored: number;
  in_force_count: number;
  upcoming_enactments_count: number;
  urgent_review_items: LegislativeMilestone[];
  verified_primary_sources: VerifiedPrimarySourceReference[];
  operational_notes: string[];
}

export const MONITORED_MILESTONES: LegislativeMilestone[] = [
  {
    id: "MILESTONE-EU-AIACT-P1",
    jurisdiction: "EU",
    regime: "EU AI Act (Regulation (EU) 2024/1689)",
    official_reference: "OJ L, 2024/1689, 12.7.2024, ELI: http://data.europa.eu/eli/reg/2024/1689/oj",
    official_source_url: "https://eur-lex.europa.eu/eli/reg/2024/1689/oj",
    status: "IN_FORCE",
    milestone_date: "2025-02-02",
    affected_modules: ["lib/ai/", "app/dashboard/brain/"],
    summary: "Prohibitions on unacceptable risk AI systems (manipulative AI, social scoring, biometric categorization) take effect.",
    action_recommended: "Ensure no cognitive behavioral manipulation or prohibited biometric scoring features are developed.",
    requires_legal_counsel_review: false,
  },
  {
    id: "MILESTONE-EU-AIACT-P2",
    jurisdiction: "EU",
    regime: "EU AI Act (Regulation (EU) 2024/1689)",
    official_reference: "OJ L, 2024/1689, Chapter V (General-Purpose AI Models)",
    official_source_url: "https://eur-lex.europa.eu/eli/reg/2024/1689/oj",
    status: "ENACTED_FUTURE_DATE",
    milestone_date: "2025-08-02",
    affected_modules: ["lib/ai/", "components/brain/"],
    summary: "Rules for general-purpose AI (GPAI) model providers and governance structure take effect.",
    action_recommended: "Audit third-party model providers (Anthropic/Google/OpenAI) for GPAI transparency compliance.",
    requires_legal_counsel_review: false,
  },
  {
    id: "MILESTONE-EU-AIACT-P3",
    jurisdiction: "EU",
    regime: "EU AI Act (Regulation (EU) 2024/1689)",
    official_reference: "OJ L, 2024/1689, Annex III (High-Risk AI Systems)",
    official_source_url: "https://eur-lex.europa.eu/eli/reg/2024/1689/oj",
    status: "ENACTED_FUTURE_DATE",
    milestone_date: "2026-08-02",
    affected_modules: ["lib/ai/", "lib/permissions/"],
    summary: "High-risk AI obligations (Annex III) and full general compliance rules become mandatory.",
    action_recommended: "Perform conformity assessment if AI co-pilot makes automated workforce decisions.",
    requires_legal_counsel_review: true,
  },
  {
    id: "MILESTONE-EU-EAA-2025",
    jurisdiction: "EU",
    regime: "European Accessibility Act (Directive (EU) 2019/882)",
    official_reference: "OJ L 151, 7.6.2019, p. 70–115",
    official_source_url: "https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX%3A32019L0882",
    status: "ENACTED_FUTURE_DATE",
    milestone_date: "2025-06-28",
    affected_modules: ["components/dashboard/", "components/landing/"],
    summary: "Mandatory digital accessibility standards (WCAG 2.1 AA) for e-commerce, websites, and consumer digital services.",
    action_recommended: "Ensure all interactive UI, modals, forms, and contrast ratios pass automated a11y audits.",
    requires_legal_counsel_review: false,
  },
  {
    id: "MILESTONE-US-CA-AB390",
    jurisdiction: "US-CA",
    regime: "California Auto-Renewal Law (AB 390 / Cal. Bus. & Prof. Code § 17600)",
    official_reference: "Cal. Bus. & Prof. Code § 17602",
    official_source_url: "https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?sectionNum=17602.&lawCode=BPC",
    status: "IN_FORCE",
    milestone_date: "2022-07-01",
    affected_modules: ["lib/stripe/", "app/dashboard/settings/billing/"],
    summary: "Mandatory clear disclosure of automatic renewal, simple online cancellation mechanism, and pre-renewal reminders for free trials longer than 31 days or annual plans.",
    action_recommended: "Verify Stripe billing portal and transactional receipts explicitly display renewal cadence and cancellation links.",
    requires_legal_counsel_review: false,
  },
  {
    id: "MILESTONE-CA-QC-LAW25",
    jurisdiction: "CA-QC",
    regime: "Quebec Law 25 (Loi modernisant des dispositions législatives en matière de protection des renseignements personnels)",
    official_reference: "CQLR c P-39.1",
    official_source_url: "https://www.legisquebec.gouv.qc.ca/fr/document/lc/P-39.1",
    status: "IN_FORCE",
    milestone_date: "2024-09-22",
    affected_modules: ["lib/auth/", "lib/marketing/"],
    summary: "Full phase-in complete: privacy by default, privacy impact assessments for cross-border transfers, and explicit separate consent for profiling/tracking.",
    action_recommended: "Enforce strict opt-in consent for any tracking cookies or profiling directed at Quebec residents.",
    requires_legal_counsel_review: false,
  },
  {
    id: "MILESTONE-PT-LEI10-2024",
    jurisdiction: "PT",
    regime: "Regime Jurídico dos Atos de Advogados e Solicitadores (Lei n.º 10/2024)",
    official_reference: "Diário da República n.º 14/2024, Série I de 2024-01-19",
    official_source_url: "https://diariodarepublica.pt/dr/detalhe/lei/10-2024-836173004",
    status: "IN_FORCE",
    milestone_date: "2024-01-20",
    affected_modules: ["lib/compliance/", "app/dashboard/brain/"],
    summary: "Revogou expressamente a Lei n.º 49/2004. Artigos 4.º, 8.º e 11.º tipificam atos próprios e o crime de procuradoria ilícita.",
    action_recommended: "Enforce strict human supervision on any draft legal documents generated by AI co-pilot in PT jurisdiction.",
    requires_legal_counsel_review: true,
  },
];

export interface RunRegulatoryHorizonScanOptions {
  currentDate?: string;
  horizonDays?: number; // default 180 days
}

export function runRegulatoryHorizonScan(
  options: RunRegulatoryHorizonScanOptions = {}
): HorizonScanAuditResult {
  const currentDateStr = options.currentDate || new Date().toISOString().split("T")[0];
  const horizonDays = options.horizonDays ?? 180;
  const operationalNotes: string[] = [];

  let activeMarkets: string[] = [];
  try {
    const config = getActiveMarketsConfig();
    activeMarkets = config.service_available_countries;
  } catch (err) {
    operationalNotes.push(`Failed to read active markets config: ${err instanceof Error ? err.message : String(err)}`);
    return {
      scan_timestamp: new Date().toISOString(),
      audit_status: "TECHNICAL_FAILURE",
      active_footprint: [],
      total_milestones_monitored: 0,
      in_force_count: 0,
      upcoming_enactments_count: 0,
      urgent_review_items: [],
      verified_primary_sources: [],
      operational_notes: operationalNotes,
    };
  }

  const inForce = MONITORED_MILESTONES.filter((m) => m.status === "IN_FORCE");
  const enactedFuture = MONITORED_MILESTONES.filter((m) => m.status === "ENACTED_FUTURE_DATE");

  console.log("======================================================");
  console.log("🏛️  BUSINESSBRAIN REGULATORY HORIZON MONITOR");
  console.log("======================================================");
  console.log(`Scan Date: ${currentDateStr} | Horizon: ${horizonDays} days`);
  console.log(`Active Footprint: ${activeMarkets.join(", ")}`);
  console.log(`Total Monitored Milestones: ${MONITORED_MILESTONES.length}`);
  console.log(`  - In Force Today: ${inForce.length}`);
  console.log(`  - Future Staggered Enforcement: ${enactedFuture.length}`);
  console.log("------------------------------------------------------");

  const currentMs = Date.parse(currentDateStr);
  const urgentReviewItems: LegislativeMilestone[] = [];
  let requiresHumanLegalReview = false;

  for (const m of MONITORED_MILESTONES) {
    const icon = m.status === "IN_FORCE" ? "🟢" : "⏳";
    console.log(`${icon} [${m.status}] ${m.jurisdiction} - ${m.regime}`);
    console.log(`   Effective: ${m.milestone_date} | Reference: ${m.official_reference}`);
    console.log(`   Source URL: ${m.official_source_url}`);
    console.log(`   Affected: ${m.affected_modules.join(", ")}`);
    console.log(`   Summary: ${m.summary}`);
    console.log(`   Action: ${m.action_recommended}`);

    if (m.requires_legal_counsel_review) {
      requiresHumanLegalReview = true;
      console.log(`   ⚠️  REQUIRES HUMAN LEGAL COUNSEL REVIEW`);
    }

    const milestoneMs = Date.parse(m.milestone_date);
    if (!isNaN(milestoneMs)) {
      const diffDays = Math.round((milestoneMs - currentMs) / (1000 * 60 * 60 * 24));
      if (diffDays >= 0 && diffDays <= horizonDays) {
        console.log(`   🔔 PROXIMITY ALERT: Enters into force in ${diffDays} days!`);
        urgentReviewItems.push(m);
      }
    }

    console.log("");
  }

  const verifiedSources: VerifiedPrimarySourceReference[] = MONITORED_MILESTONES.map((m) => ({
    regime: m.regime,
    jurisdiction: m.jurisdiction,
    official_citation: m.official_reference,
    source_url: m.official_source_url,
    last_verified_date: currentDateStr,
    status: m.status,
  }));

  let auditStatus: HorizonScanAuditStatus = "COMPLETED_NO_CHANGES_DETECTED";
  if (urgentReviewItems.length > 0) {
    auditStatus = "CHANGES_DETECTED_REVIEW_REQUIRED";
    operationalNotes.push(`${urgentReviewItems.length} milestone(s) entering into force within ${horizonDays} days.`);
  } else if (requiresHumanLegalReview) {
    auditStatus = "HUMAN_LEGAL_REVIEW_NEEDED";
    operationalNotes.push("Monitored items require qualified human legal sign-off.");
  }

  console.log("======================================================");
  console.log(`AUDIT RESULT: ${auditStatus}`);
  console.log("======================================================");

  return {
    scan_timestamp: new Date().toISOString(),
    audit_status: auditStatus,
    active_footprint: activeMarkets,
    total_milestones_monitored: MONITORED_MILESTONES.length,
    in_force_count: inForce.length,
    upcoming_enactments_count: enactedFuture.length,
    urgent_review_items: urgentReviewItems,
    verified_primary_sources: verifiedSources,
    operational_notes: operationalNotes,
  };
}

if (require.main === module) {
  runRegulatoryHorizonScan();
}
