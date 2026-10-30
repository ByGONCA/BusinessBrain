# Regulatory Alerts & Legislative Horizon Scanning

This directory stores structured alerts produced by `scripts/monitor-regulatory-updates.ts` and the `global-legal-compliance-agent`.

## Alert Format

Each alert is recorded as a markdown file named:
`YYYY-MM-DD_<jurisdiction>_<topic-slug>.md`

Fields tracked:
- **Alert ID**: e.g., `ALERT-2026-001`
- **Jurisdiction**: Country / State / Supranational body
- **Regulatory Domain**: AI, Privacy, Consumer Protection, Marketing, Payments, etc.
- **Official Source**: Legislation or gazette publication URL
- **Status**: `PROPOSAL_BILL` | `ENACTED_FUTURE_DATE` | `IN_FORCE` | `SUPERSEDED`
- **Effective / Enforcement Date**: Staggered application timeline
- **Affected BusinessBrain Modules**: Impacted code paths and features
- **Action Required**: Verifiable mitigation or product update recommended
