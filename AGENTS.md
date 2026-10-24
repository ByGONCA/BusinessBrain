# AGENTS.md — Rules & Architecture Guidelines for AI Coding Agents

> **Project**: Company Brain (BusinessBrain)  
> **Mission**: The memory and intelligence layer for modern companies.  
> **Toolkit**: Vibe Coding Toolkit integrated (Harness Engineering, Modular Context, Strict Quality Gates).

---

## 1. Project Purpose & Scope

Company Brain is an enterprise operating system designed to aggregate knowledge, meetings, decisions, projects, tasks, documents, and business context, subsequently empowering teams with AI-assisted operations.

### Current State & Phasing Overview

> [!IMPORTANT]
> **Roadmap Discrepancy Notice**: There is a documented divergence between `docs/ROADMAP.md` (which currently marks Phase 0.5 as the last completed phase and lists Phase 1 as unstarted) and the actual codebase and work audit reports (`docs/audits/`), which record substantial implementations across workspace operations, knowledge memory, and financial analytics. This discrepancy is tracked and must be reconciled in a dedicated documentation task. Do not treat either document as exclusively complete without cross-referencing code reality.

- **Phase 0 & 0.5 (Foundation, Auth, Pricing & Trial Gating)**:
  - *Reported Status*: Previously reported as completed and stable.
  - Multi-tenant architecture with PostgreSQL RLS isolation.
  - Supabase Auth (GitHub OAuth, Email/Password, Password Reset).
  - Explicit consent model: Mandatory Terms & Privacy separated from optional, unselected marketing consent.
  - Paid-only product access model: No permanent free tier; 7-day unrestricted free trial on all plans (`starter`, `pro`, `enterprise`).
  - Central server-side access control: `hasAuthenticatedUser() -> hasOrganization() -> hasActiveEntitlement()`.
- **Onboarding & Workspace Join**:
  - *Reported Status*: Implemented according to documented reports (`app/onboarding`, `lib/onboarding`, `lib/invitations`); database migrations (00031–00034) applied in staging according to previous work logs.
  - Guided workspace setup, invitation token resolution, and automatic pending invite detection.
- **Phase 1 & Phase 2 Features Present in Codebase**:
  - *Reported Status*: Implemented in code, according to documented evidence.
  - Permissions & team RBAC engine with Discord-style precedence (Owner root authority -> Explicit DENY -> Explicit ALLOW -> Team roles).
  - Knowledge & Company Memory: Block editor with monotonic optimistic concurrency control (OCC via `revision_id`), version snapshots, and multilingual PostgREST search.
  - Company Connections Graph: Interactive visualization with deterministic BFS $O(V + E)$ cycle-safe traversal.
  - Granular Supabase Storage security hardening (Migration 00030) with organization path verification and MIME whitelist enforcement.
- **Phase 3 (Financial Analytics & Stripe Connect)**:
  - *Reported Status*: Code implemented in `lib/integrations/stripe/analytics.ts` and `lib/stripe/reconciliation.ts`.
  - **Operational Validation Pending**: Live webhook handling, reconciliation routines, and analytics data streams require separate runtime verification in deployed/staging environments before being declared operationally validated.
- **Transactional Emails & Secure Invitations**:
  - *Reported Status*: Implemented in `lib/email/resend.ts` and `lib/invitations/actions.ts`.
  - Covered by automated deterministic test suites (`scripts/test-invitations-security.ts`).
- **Stripe Checkout Configuration**:
  - *Operational Status*: Parameter resolution and line-item creation logic exist in `lib/stripe/actions.ts`. The end-to-end checkout flow cannot be declared definitively resolved until confirmed with live or mock runtime evidence.
- **Strict Scope Restrictions**:
  - ❌ **DO NOT** implement real Gemini LLM API calls, autonomous agent chat executions, vector embeddings, vector databases, or live external RAG pipelines until explicitly commissioned in designated future phases.

---

## 2. Canonical Commands

Always use real project commands; do not invent scripts:

- **Develop (Turbopack)**: `npm run dev:turbo` (or `npm run dev`)
- **Build**: `npm run build`
- **Lint**: `npm run lint`
- **Typecheck**: `npm run typecheck`
- **Test Runner (Unified)**: `npm test` (executes `npx tsx scripts/test-runner.ts`)
- **Foundation Verification**: `npm run typecheck && npm run lint`

---

## 3. Working Agreements & Permanent Operating Rules

1. **Context Consultation Before Action**:
   - Always read relevant context, canonical documents, and the actual code state before starting any phase or task.
   - Cross-reference `docs/` against current codebase files; never assume a feature is missing or complete based solely on a textual roadmap.
2. **Smallest Complete Solution**:
   - Complete requests with the smallest sufficient change; reuse existing `lib/` utilities, components, and patterns.
   - Work in small, focused increments. Avoid speculative refactors, broad formatting changes, or unrequested dependencies.
3. **Preservation of Pre-existing Local Changes**:
   - Never overwrite or discard unrelated working tree changes. Maintain documentation integrity and preserve pre-existing comments and code.
4. **Separation of Code Validation from Operational Validation**:
   - Strict TypeScript (`typecheck`), linting (`lint`), and deterministic test scripts (`npm test`) validate code correctness.
   - Operational validation (e.g. live Stripe charges, Supabase production migrations, Resend email delivery, OAuth provider callbacks) requires separate live verification and must never be reported as completed without concrete operational evidence.
5. **No Fabricated Evidence**:
   - Never invent or fabricate test outputs, benchmark metrics, or operational results. If a test or flow was not executed, clearly state that validation is pending.
6. **Zero Unauthorized Remote Operations**:
   - Never execute remote mutations on Supabase Cloud, Stripe live/test dashboards, Vercel deployments, or production/staging databases without explicit user authorization.
7. **Scoped Phase Execution**:
   - Do not jump into or initiate another project phase without clearly identifying and agreeing on the requested scope.
8. **Documentation Synchronization**:
   - Keep canonical documentation updated when the state of the project changes, without duplicating entire architectures in memory contexts.
9. **Concise Communication**:
   - Concise conversational responses in the user's language. Technical explanations on request; standard professional phrasing in code, docs, and commits.
10. **Proportional Workflow**:
    - Match workflow depth to task risk: understand → design → plan when needed → implement → verify → review.
    - Propose architectural specs in `docs/specs/` for non-trivial modifications before coding.
11. **Subagents & Model Selection**:
    - Delegate only for context isolation or parallel waves.
    - Lightweight models (`flash_lite` / `flash`) for search, logs, file inventory, and mechanical verification.
    - High-capability models (`pro`) for architecture, multi-tenant security, RLS policies, and differential review.
    - Subagents inherit session model (`inherit`); no external providers or unrequested paid proxies.
12. **On-Demand Context Loading**:
    - Consult canonical documents on demand; never dump full files into context:
      - Scope & Product Principles: [`docs/PRODUCT.md`](./docs/PRODUCT.md)
      - Roadmap & Planned Slices: [`docs/ROADMAP.md`](./docs/ROADMAP.md)
      - System Architecture: [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md)
      - Database & SQL: [`docs/DATABASE.md`](./docs/DATABASE.md)
      - Verification & Quality Gates: [`docs/quality.md`](./docs/quality.md)
      - Setup & Evidence: [`docs/setup.md`](./docs/setup.md)
      - Design & Accessibility: [`docs/design.md`](./docs/design.md) & [`DESIGN.md`](./DESIGN.md) (consult only for UI/frontend tasks; ignore in backend)
      - Onboarding: [`docs/onboarding.md`](./docs/onboarding.md)

---

## 4. Skills & Progressive Disclosure

Skills in `.agents/skills/` are discovered automatically via the native `<skills>` catalog. Load individual skill instructions on demand according to task domain (Architecture, Security, React/Next.js, Supabase/Stripe, UI/Design, E2E Testing).

---

## 5. Strict Multi-Tenancy & Authorization Rules

1. **Every business record belongs to an organization**:
   All tenant tables (`subscriptions`, `projects`, `tasks`, `documents`, `pages`, `connections`, etc.) must have an `organization_id uuid not null references organizations(id) on delete cascade` column.
2. **Never query without organization scoping**:
   Always verify the user belongs to the requested organization before returning data.
3. **Database-level isolation is mandatory**:
   Do not rely solely on application-level filtering (`where org_id = ...`). Supabase RLS is the primary enforcement mechanism.
4. **Active Workspace Scoping**:
   The active organization is tracked via a verified secure cookie (`cb_active_org_id`) or an explicit `X-Organization-Id` HTTP header. Membership must always be re-verified server-side.
5. **Decouple Authentication from Entitlement**:
   An authenticated Supabase session does NOT grant dashboard access. Always verify subscription status (`trialing` or `active`) via `lib/organizations/entitlements.ts` (`verifyAccessOrRedirect`).

---

## 6. Security & Billing Rules

1. **Zero Secret Leakage**:
   - Never expose `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `RESEND_API_KEY`, or `GEMINI_API_KEY` to the browser.
   - The only authorized Supabase environment variables for client bundles are `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
   - Never prefix server-only keys with `NEXT_PUBLIC_`.
   - Never commit `.env`, `.env.local`, or any production secrets to git.
2. **Stripe Price ID Isolation**:
   - NEVER accept or trust a Stripe Price ID supplied directly from the client browser.
   - The client supplies only internal plan identifiers (`starter`, `pro`, `enterprise`); the server resolves the Stripe Price ID from server environment variables or server configuration.
3. **Webhook Verification**:
   - All Stripe webhook events must be cryptographically verified using `stripe.webhooks.constructEvent` with `STRIPE_WEBHOOK_SECRET`.
   - Never grant product entitlement based on client-side redirect parameters (`success=true`). Entitlement is granted only when the database record is updated by verified webhooks.
4. **Supabase Client Architecture**:
   - Standard user actions must always use the authenticated scoped client (`lib/supabase/server.ts`).
   - Server-side background jobs / webhooks use `createServiceClient()` and PostgreSQL `SECURITY DEFINER` RPCs without requiring a service role key in user sessions.
5. **Marketing Consent Compliance**:
   - Marketing consent checkboxes must NEVER be pre-selected.
   - Account creation must never be blocked if marketing consent is omitted.
   - Terms & Privacy consent is strictly required and separate from marketing consent.

---

## 7. Coding Conventions

- **Server Components by Default**:
  Keep components as Server Components unless interactivity (`useState`, `useEffect`, event listeners) is strictly required. Place client components in discrete leaf nodes with `'use client'`.
- **Server Actions for Mutations**:
  Place server actions in `lib/[domain]/actions.ts` or co-located action files. Use standard Next.js `revalidatePath` and redirect patterns.
- **Strict TypeScript**:
  Define explicit types for database entities, props, and API payloads. Avoid `any`.
- **Modular Services**:
  UI components must not invoke external SDKs directly. All external operations must pass through domain modules in `lib/` (`lib/organizations`, `lib/auth`, `lib/stripe`, `lib/email`, `lib/ai`).
- **No Bubble/Pill Badges**:
  Never wrap status, tags, company names, or metric badges in `rounded-full` pill capsules that resemble fake buttons (`rounded-full border bg-... px-... py-...`). Use clean typography, subtle text colors (`text-emerald-400`, `text-zinc-400`), or simple inline status dots (`<span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> Label`). Real interactive buttons should use standard button radii (`rounded-xl` or `rounded-lg`), not pill bubbles.
- **Strict Internationalization (i18n Quad-Locale)**:
  BusinessBrain natively supports 4 locales: English (`en` - Default), Portuguese (`pt`), Spanish (`es`), and French (`fr`).
  Never hardcode text in Portuguese (or any single language) directly in UI components or dashboard pages.
  All user-facing text, badges, chart labels, month names, and tooltips must use the central dictionary system (`useLanguage()`, `t.[namespace]`, `interpolate(...)`), with translations provided across all 4 dictionaries (`lib/i18n/dictionaries/`). Currency and dates must be formatted respecting the user's active `locale`.
- **Dynamic Metrics & Directional Iconography**:
  Metrics, trends, and percentage deltas must never look static, basic, or unstyled. Always accompany percentage changes with directional iconography (`TrendingUp`, `TrendingDown`, `ArrowUpRight`, `ArrowDownRight`) and semantic color tokens (`emerald-400` for growth/positive, `rose-400` for drop/negative, `zinc-400` for neutral).
- **Anti-Clutter & Business Focus (No Vanity / Engineering Jargon in UI)**:
  Never clutter interfaces with purposeless elements:
  - Do NOT place `<Info />` tooltip icons as decorative placeholders next to headers or titles unless they open an active, purposeful interactive element.
  - Do NOT surface internal provenance / verification banners (e.g., "Fonte Verificada", "Stripe Live (EUR)", internal account IDs) into normal user dashboards.
  - Do NOT display internal database / security engineering jargon (e.g., "RLS", "PostgreSQL RLS de Linha de Defesa", "Criptografia AES-256", "RLS Guard", "Perímetro Ativo") across user dashboard cards. Security is enforced strictly in the database/backend; executive UI must display actual business value, organizational memory, and team activity.

---

## 8. Prohibited Actions for AI Agents (DO NOT DO)

- ❌ **DO NOT** implement real Gemini/LLM API calls or vector searches in this phase.
- ❌ **DO NOT** implement Google OAuth before explicitly requested (this phase strictly supports Email/Password and GitHub OAuth).
- ❌ **DO NOT** install heavy third-party UI component libraries (e.g. MUI, Chakra, AntD); use lightweight Tailwind primitives.
- ❌ **DO NOT** create insecure RLS policies (e.g., `using (true)` or `using (auth.role() = 'authenticated')` for tenant tables).
- ❌ **DO NOT** hardcode stripe price IDs, secret tokens, or tenant IDs.
- ❌ **DO NOT** trust client-supplied Stripe Price IDs, client-side billing parameters, or redirect flags (`success=true`).
- ❌ **DO NOT** bypass server-side entitlement checks (`verifyAccessOrRedirect`).
- ❌ **DO NOT** expose secret keys (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `RESEND_API_KEY`, `GEMINI_API_KEY`) to the browser or client bundles.
- ❌ **DO NOT** create duplicate Stripe customers (always verify local DB and search Stripe customer metadata before creating).
- ❌ **DO NOT** create duplicate organizations during signup, OAuth, login, callback, or checkout.
- ❌ **DO NOT** pre-select marketing consent checkboxes.
- ❌ **DO NOT** grant dashboard access without verifying subscription/trial status.
- ❌ **DO NOT** re-introduce `SUPABASE_SERVICE_ROLE_KEY` into standard client requests or bypass RLS.
- ❌ **DO NOT** use deprecated Supabase auth packages (`@supabase/auth-helpers-nextjs`). Always use `@supabase/ssr`.
- ❌ **DO NOT** use rounded bubbles, pill badges, chip capsules, or fake rounded pill buttons (`rounded-full` / oval chip shapes with borders/backgrounds containing static text, status, or tags). Status, metadata, and tags must always be displayed cleanly with typography, subtle colors, or inline text dots/indicators, never encased in rounded bubble pills that resemble clickable buttons.
- ❌ **DO NOT** hardcode Portuguese (or any other language) strings directly into user-facing UI components or pages. The app supports English, Portuguese, Spanish, and French; all strings must use the `lib/i18n` dictionary system and adapt dynamically to the user's selected language. Default locale is English (`en`).
- ❌ **DO NOT** display internal engineering jargon or database security terms (e.g. "RLS", "PostgreSQL Linha de Defesa", "AES-256-GCM", "RLS Guard", "Perímetro Ativo") in user dashboard cards or executive views. Security belongs in the database and backend, never as decorative badges on the UI.
- ❌ **DO NOT** add decorative, purposeless `<Info />` icons next to chart titles, revenue headers, or KPI labels.
- ❌ **DO NOT** surface internal debug / verification banners (e.g. "Fonte Verificada", "Stripe Live (EUR)", account ID banners) in standard user dashboards.
- ❌ **DO NOT** render raw, static percentages without directional arrows (`TrendingUp`, `TrendingDown`, `ArrowUpRight`, `ArrowDownRight`) and semantic styling.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
