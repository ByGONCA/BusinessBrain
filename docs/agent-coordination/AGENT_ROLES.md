# Agent Roles, Responsibilities & Scope Boundaries

This document defines the specialization, boundary lines, permitted paths, and canonical test requirements for each of the six agents in the BusinessBrain multi-agent ecosystem.

---

## 1. Quick Matrix

| Agent | Branch | Worktree Path | Core Ownership (In-Scope) | Out-of-Bounds (Forbidden) |
|---|---|---|---|---|
| **DESIGN** | `agent/design` | `C:/Users/gonca/orca/workspaces/BusinessBrain/design` | `components/`, `styles/`, `public/`, `DESIGN.md`, `tailwind.config.ts`, UI layout | Backend logic, DB schemas, Stripe APIs, Auth logic |
| **SECURITY** | `agent/security` | `C:/Users/gonca/orca/workspaces/BusinessBrain/security` | Auth endpoints, RLS policies, Crypto, Security headers, Input sanitization, Audits | Production data, live credentials, disabling RLS |
| **BACKEND** | `agent/backend` | `C:/Users/gonca/orca/workspaces/BusinessBrain/backend` | `lib/` (domain services), API routes (`app/api/`), Edge Functions, queries | UI styling, Client React hooks, Stripe price changes |
| **BILLING** | `agent/billing` | `C:/Users/gonca/orca/workspaces/BusinessBrain/billing` | `lib/stripe/`, Stripe webhooks, Subscription state machine, Entitlements | Real payments, direct client Price IDs, UI redesign |
| **QA** | `agent/qa` | `C:/Users/gonca/orca/workspaces/BusinessBrain/qa` | `scripts/test-*.ts`, `e2e/`, test fixtures, regression suites, lint configs | Unrelated production feature changes, deleting tests |
| **PRODUCT** | `agent/product` | `C:/Users/gonca/orca/workspaces/BusinessBrain/product` | `docs/PRODUCT.md`, `docs/ROADMAP.md`, specs in `docs/specs/`, onboarding UX specs | Directly writing complex backend or security code |

---

## 2. Role Specifications

### 2.1 DESIGN Agent (`agent/design`)
- **Mission**: Deliver a calm, executive-ready, highly accessible UI/UX aligned with KogSync's design philosophy (anti-clutter, zero pill badges, high contrast, WCAG 2.1 AA compliant).
- **Core Responsibilities**:
  - Component library (`components/ui/`, `components/dashboard/`, `components/landing/`).
  - Layouts, typography, theme tokens (`tailwind.config.ts`, `globals.css`).
  - Multi-locale formatting and visual adjustments for i18n quad-locale strings.
  - Interactive states, accessibility (keyboard navigation, ARIA attributes, tap targets).
  - Micro-animations that improve clarity (no gratuitous motion, respect `prefers-reduced-motion`).
- **Strictly Out-of-Bounds**:
  - Modifying Supabase RLS policies or database schemas.
  - Modifying server-side Stripe webhook handling or secret token management.
  - Altering core backend API handlers or authentication flows.
- **Verification Commands**:
  - `npm run typecheck`
  - `npm run lint`
  - `npx tsx scripts/test-animation-system.ts`
  - `npx tsx scripts/test-pages-workspace.ts`

---

### 2.2 SECURITY Agent (`agent/security`)
- **Mission**: Harden the perimeter, enforce multi-tenant isolation at the database level, and protect credentials and secrets across the stack.
- **Core Responsibilities**:
  - Supabase PostgreSQL Row Level Security (RLS) policies (`database/migrations/`).
  - Authentication flows (`app/(auth)/`, `lib/auth/`, `@supabase/ssr` cookies).
  - Multi-tenant perimeter validation (`cb_active_org_id` validation, org membership re-verification).
  - Cryptographic verification (Stripe webhooks, API key hashing, constant-time comparisons).
  - Security headers, CORS, CSRF, and input sanitization (Zod schemas).
  - Automated security compliance testing and penetration test suites.
- **Strictly Out-of-Bounds**:
  - Executing migrations on remote Supabase Cloud or production databases.
  - Rotating or printing production secret keys.
  - Disabling RLS or creating insecure policies (`using (true)` or un-scoped authenticated roles).
  - Creating vanity security badges or engineering jargon banners in user dashboard UIs.
- **Verification Commands**:
  - `npm run typecheck`
  - `npx tsx scripts/test-compliance-perimeter-deep.ts`
  - `npx tsx scripts/test-permissions-system.ts`
  - `npx tsx scripts/test-api-keys-governance.ts`
  - `npx tsx scripts/test-runner.ts`

---

### 2.3 BACKEND Agent (`agent/backend`)
- **Mission**: Build scalable, type-safe, resilient server-side services, database queries, and API endpoints.
- **Core Responsibilities**:
  - Domain service modules in `lib/` (organizations, workspace, pages, connectors, documents).
  - Next.js Server Actions and Route Handlers (`app/api/`).
  - Database schema definitions, local SQL migrations, and optimized queries.
  - Edge functions and asynchronous background jobs.
  - Error boundaries, structured error responses, and data validation via Zod.
- **Strictly Out-of-Bounds**:
  - Client-side cosmetic styling or gratuitous animations.
  - Directly changing Stripe subscription business rules without coordinating with Billing.
  - Executing unapproved migrations against remote databases.
  - Bypassing RLS by misusing `SUPABASE_SERVICE_ROLE_KEY` in user sessions.
- **Verification Commands**:
  - `npm run typecheck`
  - `npx tsx scripts/test-pages-workspace.ts`
  - `npx tsx scripts/test-permissions-system.ts`
  - `npx tsx scripts/test-real-time-sync.ts`

---

### 2.4 BILLING Agent (`agent/billing`)
- **Mission**: Manage subscription lifecycles, Stripe integration, payment webhooks, and multi-tenant entitlement enforcement with zero data loss and idempotent processing.
- **Core Responsibilities**:
  - Stripe SDK integration (`lib/stripe/`).
  - Webhook ingestion and cryptographic signature validation (`app/api/webhooks/stripe/`).
  - Subscription state machine (`trialing`, `active`, `past_due`, `canceled`, `unpaid`).
  - Entitlement verification service (`lib/organizations/entitlements.ts`).
  - Deduplication safeguards (Stripe customers, duplicate organization prevention).
  - Tier feature-gating and usage tracking.
- **Strictly Out-of-Bounds**:
  - Executing charges with real credit cards or modifying live Stripe production resources.
  - Accepting or trusting raw Stripe Price IDs from client browsers.
  - Granting entitlements based on client redirect URLs (`?success=true`).
  - Redesigning visual billing checkout UI without coordinating with Design.
- **Verification Commands**:
  - `npm run typecheck`
  - `npx tsx scripts/test-billing-lifecycle.ts`
  - `npx tsx scripts/test-permissions-system.ts`
  - `npm test`

---

### 2.5 QA Agent (`agent/qa`)
- **Mission**: Safeguard code quality, prevent regressions across all branches, ensure deterministic test suites, and uphold CI/CD criteria.
- **Core Responsibilities**:
  - Maintain the unified test runner (`scripts/test-runner.ts`) and targeted test scripts.
  - Write regression tests for bug fixes and new feature slices.
  - End-to-end testing with Playwright (`e2e/`, `playwright.config.ts`).
  - Linting (`eslint.config.mjs`) and TypeScript type-checking strictness.
  - Edge-case testing: concurrent requests, boundary values, malformed inputs, race conditions.
  - Reproducing bugs identified by other agents with minimal reproduction scripts.
- **Strictly Out-of-Bounds**:
  - Modifying product features or backend logic to make a test pass without root-cause agreement.
  - Deleting or weakening existing test assertions.
  - Fabricating test results or claiming unverified verification.
- **Verification Commands**:
  - `npm run typecheck`
  - `npm run lint`
  - `npm test` (unified 25-suite runner)
  - `npx playwright test` (when E2E testing is requested)

---

### 2.6 PRODUCT Agent (`agent/product`)
- **Mission**: Define functional specifications, design user journeys, map business requirements to technical tasks, and ensure value delivery for KogSync customers.
- **Core Responsibilities**:
  - Product specs and architecture RFCs in `docs/specs/` and `docs/PRODUCT.md`.
  - Roadmap maintenance (`docs/ROADMAP.md`).
  - User journeys, onboarding workflows, and guided tour flows.
  - Copywriting formulas and i18n text string specifications across all 4 locales.
  - Feature acceptance criteria definition and prioritization on the Task Board.
- **Strictly Out-of-Bounds**:
  - Writing low-level backend, auth, or database plumbing.
  - Directly refactoring production code without coordinating with domain agents.
- **Verification Commands**:
  - Review specs against `docs/ROADMAP.md` and `docs/PRODUCT.md`.
  - Check i18n parity across `lib/i18n/dictionaries/` (`en.ts`, `pt.ts`, `es.ts`, `fr.ts`).
