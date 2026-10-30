# BusinessBrain Compliance Architecture & Regulatory Framework

> **Mission**: Maintain proactive, multi-jurisdictional compliance across data protection, commercial transparency, fiscal retention, and international trade sanctions for BusinessBrain.  
> **Status**: Verified Production Quality Gate & Active Regulatory Engine  
> **Last Updated**: October 2026

---

## 1. Directory Structure & Documentation Index

| Document | Purpose & Scope | Governance Status |
| :--- | :--- | :--- |
| [`GLOBAL_LEGAL_COMPLIANCE_AGENT.md`](./GLOBAL_LEGAL_COMPLIANCE_AGENT.md) | Architectural specification, subagent contract, and Antigravity tooling baseline. | **Active / Production** |
| [`LEGAL_COMPLIANCE_AUDIT.md`](./LEGAL_COMPLIANCE_AUDIT.md) | Forensic audit report across 10 regulatory domains (GDPR, CCPA, ePrivacy, Sanctions, Fiscal, etc.). | **Verified Audit** |
| [`LEGAL_REQUIREMENTS_REGISTER.json`](./LEGAL_REQUIREMENTS_REGISTER.json) | Machine-readable register of all statutory requirements, citation links, and verification status. | **Machine Validated** |
| [`DATA_PROCESSING_MAP.md`](./DATA_PROCESSING_MAP.md) | Comprehensive inventory of personal data flows, categories, retention schedules, and subprocessors. | **Operational Record** |
| [`MARKET_ENTRY_MATRIX.md`](./MARKET_ENTRY_MATRIX.md) | Tier-ranked international market entry criteria, blocking sanctions, and required legal localizations. | **Strategic Framework** |
| [`REMEDIATION_PLAN.md`](./REMEDIATION_PLAN.md) | Prioritized backlog of technical and legal remediation items with verifiable acceptance criteria. | **Tracked** |
| [`HUMAN_REVIEW_REQUIRED.md`](./HUMAN_REVIEW_REQUIRED.md) | Consolidated ledger of legal counsel, corporate entity, and external access items requiring human intervention. | **Pending Owner Action** |
| [`LEGAL_DOCUMENTS_STATUS.md`](./LEGAL_DOCUMENTS_STATUS.md) | Inventory of production and drafted legal documents with readiness ratings and revision dates. | **Audit Ready** |
| [`TEST_EVIDENCE.md`](./TEST_EVIDENCE.md) | Cryptographic/deterministic execution logs and assertion pass records for all compliance test suites. | **Verified Pass** |
| [`legal/`](./legal/) | Production drafts for Terms of Service, Privacy Policy, Cookie Policy, and DPA. | **Drafts with Placeholders** |

---

## 2. Governance Invariants

1. **Evidence-Based Compliance**: Never declare legal compliance without concrete, verifiable evidence in code, tests, or signed legal documentation.
2. **Explicit Human Review Flags**: Unverified business facts, counsel approvals, and live external dashboard accesses are strictly marked:
   - `[OWNER_INPUT_REQUIRED]`: Requires executive/founder decision (e.g., registered entity address, corporate tax ID).
   - `[LEGAL_COUNSEL_REQUIRED]`: Requires formal sign-off by qualified legal counsel in the relevant jurisdiction.
   - `[EXTERNAL_ACCESS_REQUIRED]`: Requires administrative access to external SaaS dashboards (e.g., Stripe, Supabase Cloud).
3. **Defense-in-Depth Enforcement**:
   - `scripts/verify-compliance-gate.ts`: Pre-build quality gate executed automatically before `next build`.
   - `scripts/monitor-regulatory-updates.ts`: Automated regulatory change detection engine.
   - `.github/workflows/ci.yml`: Mandatory CI release blocker.
   - `.github/workflows/compliance-monitor.yml`: Weekly scheduled cron for regulatory proximity detection.
