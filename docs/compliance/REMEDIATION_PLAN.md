# BusinessBrain Regulatory Remediation Plan

> **Scope**: Prioritized technical and organizational remediation actions for international regulatory compliance.  
> **Status**: Active Remediation Tracker  
> **Last Updated**: October 2026 | Milestone 1.2

---

## 1. Remediation Backlog & Progress

| Priority | ID | Issue / Requirement | Action Taken / Planned | Status | Verifiable Acceptance Criteria |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **P0** | **REM-01** | Lack of deterministic account erasure (GDPR Art. 17) | Implemented `requestAccountDeletionAction` with orphan tenant protection and fiscal retention preservation. Added confirmation UI in `privacy-data-tab.tsx`. | **COMPLETED** | `npm test` passing with Suite 29; erasure removes personal profile while keeping statutory accounting rows. |
| **P0** | **REM-02** | Missing public legal routes (`/terms`, `/privacy`, `/cookies`) | Created Next.js routes in `app/(marketing)/` and linked them in signup form and footer. | **COMPLETED** | Public routes respond with 200 OK and link to each other. |
| **P0** | **REM-03** | Sanction verification gate | Implemented `lib/compliance/markets.config.ts` and `scripts/verify-compliance-gate.ts` to block builds if sanctioned jurisdictions are activated. | **COMPLETED** | `npm run compliance:check` passes and aborts on sanctioned market activation. |
| **P0** | **REM-08** | Runtime sanctions guard in request paths | Added server-side checks in `updateWorkspaceGeneralAction` (`lib/settings/actions.ts`) and `createCheckoutSessionAction` (`lib/stripe/actions.ts`). | **COMPLETED** | Tests 19 & 20 of Suite 29 prove direct API and UI requests from sanctioned jurisdictions are blocked. |
| **P0** | **REM-09** | Safe Stripe subscription cancellation on account erasure | Updated `requestAccountDeletionAction` to halt deletion on unexpected Stripe cancel failures, preventing zombie billing loops. | **COMPLETED** | Test 25 of Suite 29 confirms account deletion halts if Stripe cancel fails unexpectedly. |
| **P1** | **REM-04** | Commercial transparency on subscription trials | Explicitly disclosed 3-day trial terms in FAQ, landing page, and signup form. Ensured 1-click self-service cancellation. | **COMPLETED** | Verified in `app/(marketing)/faq/page.tsx` and billing tabs. |
| **P1** | **REM-05** | Marketing consent decoupling | Separated mandatory Terms acceptance from optional marketing emails. Non-preselected by default. | **COMPLETED** | Verified in `app/(auth)/signup/page.tsx` (`defaultChecked={false}`). |
| **P1** | **REM-10** | Centralized legal entity configuration & pre-launch banners | Created `config/legal-entity.json` and `lib/compliance/legal-entity.config.ts`. Added pre-launch transparency notices across `/terms`, `/privacy`, and `/cookies`. | **COMPLETED** | Tests 22 & 24 of Suite 29 verify placeholder detection and route notice rendering. |
| **P1** | **REM-11** | Stripe environment validation & automatic tax toggle | Implemented `validateStripeEnvironment` to prevent live/test key confusion. Supported `STRIPE_AUTOMATIC_TAX=true`. | **COMPLETED** | Test 23 of Suite 29 verifies environment key format and mode detection. |
| **P1** | **REM-12** | Actionable commercial launch gate reporting | Added `evaluateLaunchReadiness` to `lib/compliance/quality-gates.ts` and integrated into `scripts/verify-compliance-gate.ts`. | **COMPLETED** | Pre-build check outputs launch readiness `[CONDITIONAL]` with open founder blockers. |
| **P2** | **REM-06** | Corporate entity configuration on invoices | Input registered corporate name, fiscal number (NIF/EIN), and address on Stripe Dashboard. | **PENDING OWNER (BLK-01)** | `[OWNER_INPUT_REQUIRED: Enter corporate legal entity details in Stripe]` |
| **P2** | **REM-07** | Periodic regulatory horizon monitoring | Created automated weekly monitoring workflow `.github/workflows/compliance-monitor.yml`. | **COMPLETED** | CI cron file registered and verified. |
