# BusinessBrain — Codebase Map & Investigation Index

> **Purpose**: Definitive navigation index for AI coding agents and engineers.  
> **Rule**: Consult this map **before** initiating exploratory repository searches. Navigate directly to verified paths.  
> **Last Verified**: October 2026

---

## 1. Quick Navigation: Where to Look First

| Feature / Domain | Primary Entry Point | Domain Services (`lib/`) | UI Components | Database Migrations |
| :--- | :--- | :--- | :--- | :--- |
| **Auth & Sessions** | `lib/supabase/middleware.ts` | `lib/auth/actions.ts` | `app/(auth)/` | `00001`, `00024`, `00026` |
| **Multi-Tenancy & Orgs** | `lib/organizations/entitlements.ts` | `lib/organizations/queries.ts` | `components/dashboard/` | `00001`, `00002`, `00018` |
| **Onboarding & Tour** | `app/onboarding/page.tsx` | `lib/onboarding/actions.ts` | `components/dashboard/tour/` | `00031`, `00032`, `00034` |
| **Invitations & Teams** | `app/invite/[token]/page.tsx` | `lib/invitations/actions.ts` | `components/dashboard/people/` | `00020`, `00022`, `00033` |
| **Permissions (RBAC)** | `lib/permissions/resolver.ts` | `lib/permissions/actions.ts` | `components/dashboard/settings/` | `00018`, `00021`, `00023` |
| **Stripe Billing & Subscriptions** | `app/api/webhooks/stripe/route.ts` | `lib/stripe/actions.ts` | `app/pricing/`, `app/checkout/` | `00003`, `00012`, `00035` |
| **Financial Analytics (Connect)** | `app/dashboard/finance/page.tsx` | `lib/integrations/stripe/analytics.ts` | `components/dashboard/finance/` | `00027`, `00036` |
| **Pages & Block Editor (OCC)** | `app/dashboard/pages/[id]/page.tsx` | `lib/pages/actions.ts` | `components/dashboard/pages/` | `00006`, `00011`, `00029` |
| **Company Graph (Connections)** | `app/dashboard/connections/page.tsx` | `lib/connections/graph-algorithms.ts` | `components/dashboard/connections/` | `00007`, `00008`, `00017` |
| **Integrations (GitHub/Slack/Google)** | `app/api/integrations/` | `lib/integrations/` | `components/dashboard/settings/` | `00004`, `00017`, `00036` |
| **Public API v1 & API Keys** | `app/api/v1/` | `lib/api-keys/service.ts` | `components/dashboard/settings/api-keys-tab.tsx` | `00034`, `00036` |
| **File Storage & Quotas** | `app/api/pages/[id]/icon/route.ts` | `lib/storage/image-service.ts` | `lib/files/` | `00008`, `00009`, `00030` |
| **Internationalization (i18n)** | `lib/i18n/context.tsx` | `lib/i18n/dictionaries/` | `components/ui/` | N/A (Frontend Quad-Locale) |
| **Product Marketing & Architecture** | `app/(marketing)/` | `lib/marketing/config.ts` | `components/landing/` | N/A (Frontend Quad-Locale) |

---

## 2. Canonical Commands & Quality Gates

Run only verified project commands from repository root:

- **Typecheck**: `npm run typecheck` (`tsc --noEmit`)
- **Lint**: `npm run lint` (`eslint .`)
- **Deterministic Test Runner**: `npm test` (`npx tsx scripts/test-runner.ts` — runs 21 verified suites)
- **Dev Server (Turbopack)**: `npm run dev:turbo`
- **Foundation Gate**: `npm run typecheck && npm run lint`

---

## 3. Core Architectural Layers

### 3.1 Gateway & Routing Layer
- **`proxy.ts`**: Root Next.js proxy delegating to Supabase session updater.
- **`lib/supabase/middleware.ts`**: Edge middleware verifying cookies (`sb-*`), performing fast-path unauthenticated redirects to `/login`, bypassing RSC prefetch latency, enforcing AAL2 (MFA), and scrubbing expired refresh tokens (`refresh_token_not_found`).
- **`lib/security/redirects.ts`**: Open-redirect sanitizer preventing unsafe external redirect manipulation.
- **`lib/security/rate-limit.ts`**: Cryptographic HMAC-signed sliding window rate limiter enforcing strict limits on auth, password resets, webhooks, and public API calls.

### 3.2 Authentication & Session Management
- **`app/(auth)/login/page.tsx`**: Sign in via Email + Password and OAuth (GitHub, Google).
- **`app/(auth)/signup/page.tsx`**: Account registration with mandatory Terms & Privacy and optional marketing consent.
- **`app/(auth)/verify-email/page.tsx`**: 6-digit OTP code verification and "Verify email later" option.
- **`app/(auth)/forgot-password/page.tsx`**: Reset password via either reset link or 6-digit recovery OTP.
- **`app/(auth)/auth/mfa/page.tsx`**: Multi-factor authentication (TOTP/AAL2) step-up challenge.
- **`lib/auth/actions.ts`**: Authoritative server actions for auth mutations (`signInAction`, `signUpAction`, `verifySignUpOtpAction`, `requestPasswordResetAction`, `verifyRecoveryOtpAction`, MFA actions).
- **`lib/supabase/server.ts`**: Scoped authenticated Supabase client using `@supabase/ssr` cookies and `getCurrentUser` cache helper.
- **`lib/supabase/admin.ts`**: Dedicated `createServiceClient` utilizing PostgreSQL `SECURITY DEFINER` boundaries.

### 3.3 Multi-Tenant Workspace & Entitlements
- **`lib/organizations/queries.ts`**: Workspace retrieval and active organization scoping (`getUserOrganizations`, `getActiveOrganization`).
- **`lib/organizations/entitlements.ts`**: Core access guard (`verifyAccessOrRedirect`, `getOrganizationEntitlement`). Enforces paid-only trial/subscription access (`trialing`, `active`).
- **`app/onboarding/page.tsx`**: Guided workspace creation, organization naming, website URL, and invitation detection.
- **`lib/onboarding/actions.ts`**: Server actions for workspace setup, initial member invites, and guided tour progress.
- **`components/dashboard/tour/guided-tour.tsx`**: Dynamic guided tour orchestrator for first-time users.

### 3.4 Stripe Billing & Financial Analytics
- **`lib/stripe/actions.ts`**: Internal plan resolution (`starter`, `pro`, `enterprise`) to Stripe Price IDs and Checkout Session creation.
- **`app/api/webhooks/stripe/route.ts`**: Cryptographically verified webhook handler for `checkout.session.completed`, `customer.subscription.updated`, and `customer.subscription.deleted`.
- **`lib/stripe/reconciliation.ts`**: Automated subscription reconciliation between Supabase and Stripe.
- **`lib/integrations/stripe/analytics.ts`**: Real-time MRR, ARR, churn, and financial KPI calculation engine.
- **`components/dashboard/finance/finance-dashboard.tsx`**: Executive OLED financial cockpit with interactive KPI breakdowns.

### 3.5 Knowledge Base & Monotonic OCC Block Editor
- **`app/dashboard/pages/`**: Hierarchical page tree and document management.
- **`app/dashboard/pages/[id]/page.tsx`**: Block editor canvas.
- **`lib/pages/actions.ts`**: Document mutation engine with optimistic concurrency control (`revision_id`) and conflict resolution.
- **`lib/pages/queries.ts`**: High-performance cached page retrieval and multilingual full-text search.
- **`database/migrations/00029_company_memory_and_multilingual_search.sql`**: Full-text search dictionary setup across multiple languages.

### 3.6 Financial Analytics & Stripe Connect
- **`app/dashboard/finance/page.tsx`**: Single-page executive Corporate Finance route with server-side entitlement checks.
- **`components/dashboard/finance/finance-dashboard.tsx`**: Minimalist, asymmetric Corporate Finance cockpit featuring interactive revenue chart hero with drag brush, dynamic granularity, contextual KPIs, compact previews, and accessible paginated modals.
- **`lib/integrations/stripe/types.ts`**: Pure client-safe TypeScript interfaces, snapshot definitions, and mathematical period aggregations (`filterFinancialMetricsByPeriod`, `maskAccountId`).
- **`lib/integrations/stripe/cache.ts`**: Multi-tier tenant-isolated in-memory L1 cache (`stripeFinancialMemoryCache`) with anti-stampede request coalescing, bounded LRU capacity, and granular invalidation.
- **`lib/integrations/stripe/analytics.ts`**: Server-side Stripe API metric computation, currency summaries, dunning policies, and mutex-protected snapshot persistence.
- **`lib/integrations/stripe/actions.ts`**: Server actions for manual synchronization (`refreshStripeMetricsAction`).

### 3.7 Company Connections Graph
- **`app/dashboard/connections/page.tsx`**: Interactive network graph canvas.
- **`lib/connections/graph-algorithms.ts`**: Deterministic Breadth-First Search (BFS) $O(V + E)$ traversal with cycle-detection.
- **`lib/connections/actions.ts`**: Entity and connection creation, deletion, and linking.
- **`components/dashboard/connections/`**: Visual graph nodes, edge rendering, and relation inspectors.

### 3.7 Permissions & Access Control (RBAC)
- **`lib/permissions/resolver.ts`**: Discord-style precedence calculation:
  1. Organization Owner (root bypass)
  2. Explicit User DENY
  3. Explicit User ALLOW
  4. Team Roles / Permissions
- **`lib/permissions/actions.ts`**: Team creation, member assignment, and explicit permission override management.
- **`components/dashboard/people/people-hub.tsx`**: User directory, invitations status, and team assignments.

### 3.8 Ecosystem Integrations & Public API v1
- **`lib/integrations/`**: Catalog and handlers for GitHub (`github/`), Slack (`slack/`), Google Drive/Meet/Calendar (`google/`), Microsoft (`microsoft/`), and Importers (`importers/` for Notion & Confluence).
- **`app/api/v1/`**: Developer API endpoints (`discussions`, `documents`, `integrations`, `metrics`, `projects`, `keys`).
- **`lib/api-keys/`**: Scoped API key generation (`cb_live_...`), SHA-256 cryptographic verification, and RBAC permission enforcement.
- **`docs/api/openapi.json`**: OpenAPI 3.0 specification for public endpoints.

### 3.9 Quad-Locale Internationalization (i18n)
- **`lib/i18n/context.tsx`**: React context provider (`useLanguage`, active locale state).
- **`lib/i18n/dictionaries/`**: Translation dictionaries for English (`en.ts` - default), Portuguese (`pt.ts`), Spanish (`es.ts`), and French (`fr.ts`).
- **Rule**: Never hardcode language strings in UI components. Use `t.[namespace].[key]` or `interpolate(...)`.

### 3.10 Marketing Pages, Theme System & Interactive Showcase
- **`app/(marketing)/product/page.tsx`**: Dedicated product overview and expanded workstation demonstration.
- **`app/(marketing)/company-graph/page.tsx`**: Dedicated Company Graph explanation and interactive canvas.
- **`app/(marketing)/integrations/page.tsx`**: Dedicated ecosystem integrations directory and security perimeter.
- **`app/(marketing)/faq/page.tsx`**: Comprehensive searchable buyer and technical FAQ.
- **`components/theme/theme-selector.tsx`**: Three-mode theme selector (Automatic, Light, Dark).
- **`lib/ai/config.ts`**: AI model tiering (`gemini-1.5-flash` for trial/starter, `gemini-1.5-pro` for pro/enterprise), credit quotas, and usage boundaries.
- **`lib/ai/gemini.ts`**: Provider contract placeholder (live LLM calls deferred per AGENTS.md).
- **`components/landing/real-dashboard-showcase.tsx`**: Production workstation showcase embedding the real application UI (Sidebar, ExecutiveHomeDashboard, Force Graph, Finance, PagesHub, and BlockEditor) with safe read-only demo mode.
- **`app/demo/page.tsx`**: Dedicated full-screen interactive demonstration route rendering `RealDashboardShowcase` in standalone mode.
- **`components/landing/interactive-workspace-demo.tsx`**: Interactive workstation demonstration with 5 navigable product sections.

---

## 4. Database Migrations Ledger (`database/migrations/`)

Key milestone migrations:
- `database/migrations/00001_initial_schema.sql` — Core tables: `organizations`, `organization_members`, `profiles`.
- `database/migrations/00002_rls_policies.sql` — Base PostgreSQL Row Level Security multi-tenant policies.
- `database/migrations/00003_subscriptions_and_consent.sql` — Stripe subscription state and explicit consent ledger.
- `database/migrations/00006_pages_workspace.sql` & `database/migrations/00011_page_icons_file_system.sql` — Hierarchical documents and icons.
- `database/migrations/00007_company_entities_and_connections.sql`, `database/migrations/00008_company_connections.sql` & `database/migrations/00017_github_integration_and_connections.sql` — Company graph entities, bidirectional edges, and GitHub connections.
- `database/migrations/00018_teams_and_permissions.sql`, `database/migrations/00021_rate_limit_permissions_alignment.sql` & `database/migrations/00023_permissions_hardening_and_rls.sql` — Team-based RBAC, permission overrides, and RLS security hardening.
- `database/migrations/00024_secure_invitations_and_hashing.sql` — SHA-256 hashed invitation tokens.
- `database/migrations/00028_rate_limit_schema_alignment.sql` — HMAC rate limiting store.
- `database/migrations/00029_company_memory_and_multilingual_search.sql` — Revision-based OCC and multilingual search.
- `database/migrations/00030_storage_granular_permissions_hardening.sql` — Granular storage bucket RLS and MIME whitelisting.
- `database/migrations/00031_onboarding_and_tour_tracking.sql` — Onboarding state and guided tour completion columns.
- `database/migrations/00035_stripe_multi_tenant_uniqueness.sql` — Multi-tenant Stripe customer ID uniqueness.
- `database/migrations/00036_phase_4_integrations_and_api.sql` — API keys, scopes, integration webhooks, and metric snapshots.

---

## 5. Verification & Test Suite Map (`scripts/test-runner.ts`)

The test suite runs 22 deterministic test files sequentially without external dependencies:
1. `scripts/test-permissions-system.ts` — RBAC & Discord-style Deny precedence
2. `scripts/test-migration-00028.ts` — Rate limiting schema & DDL idempotence
3. `scripts/test-stripe-connect-analytics.ts` — MRR normalization & analytics
4. `scripts/test-rate-limiting.ts` — HMAC tokens & sliding window
5. `scripts/test-company-graph-engine.ts` — Graph deduplication & layouts
6. `scripts/test-connections-system.ts` — Graph traversal & edge mutations
7. `scripts/test-pages-workspace.ts` — Workspace autosave state machine
8. `scripts/test-graph-perf.ts` — BFS $O(V + E)$ benchmark
9. `scripts/test-dedup-surgical.ts` — Deduplication algorithms
10. `scripts/test-dedup-semantic.ts` — Semantic deduplication
11. `scripts/test-concurrency-occ.ts` — Optimistic concurrency control & snapshot rollback
12. `scripts/test-search-comprehensive.ts` — Multilingual search sanitization
13. `scripts/test-dedup-nondestructive.ts` — Non-destructive migration pre-checks
14. `scripts/test-revision-occ.ts` — Monotonic revision ID increments
15. `scripts/test-snippet-occ.ts` — Snippet editor OCC integration
16. `scripts/test-trigger-revision.ts` — Database revision integrity triggers
17. `scripts/test-reorder-deterministic.ts` — Deterministic lock ordering
18. `scripts/test-editor-conflict.ts` — Draft preservation during conflicts
19. `scripts/test-storage-security.ts` — Storage bucket RLS & MIME inspection
20. `scripts/test-phase4-integrations-and-api.ts` — API key scopes & webhook security
21. `scripts/test-public-api-disabled.ts` — Kill-switch and feature flag enforcement
22. `scripts/test-codebase-map-validator.ts` — Codebase map path integrity validator (10 conditions)
23. `scripts/test-data-architecture-cache.ts` — Multi-tier cache & anti-stampede
24. `scripts/test-corporate-finance-ui-i18n.ts` — Corporate finance cockpit & quad-locale parity
25. `scripts/test-theme-and-demo-isolation.ts` — Theme resolution & public demo strict data isolation
26. `scripts/test-animation-system.ts` — Complete marketing landing page animation & accessibility system audit

---

## 6. Maintenance & Map Update Rule

1. **Mandatory Synchronization**: Whenever a task creates, renames, moves, or deletes an architectural component (e.g. a new domain in `lib/`, a new dashboard page in `app/dashboard/`, or a new database migration), `docs/CODEBASE_MAP.md` **must be updated in the same task**.
2. **Exclusion of Trivial Edits**: Do not update the map for internal implementation tweaks, bug fixes, or minor styling edits that do not alter the navigation structure.
3. **Automated Verification**: Run `npx tsx scripts/validate-codebase-map.ts` to ensure 100% path validity before completing tasks that modify documented files.

---

## 7. Relationship with Graphify (`graphify-out/`)

- **Complementary Roles**:
  - `docs/CODEBASE_MAP.md` is the **canonical, zero-dependency index** for declarative file/domain lookups, giving instant navigation with zero API cost.
  - `graphify` (when its CLI or MCP tool is available in the environment) queries `graphify-out/graph.json` for deep semantic code relationships, graph traversal, and caller/callee trees.
- **Precedence**: Always consult `docs/CODEBASE_MAP.md` first for locating files. Use Graphify when deep relationship tracing between abstract components is required.
