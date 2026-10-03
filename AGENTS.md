# AGENTS.md — Rules & Architecture Guidelines for AI Coding Agents

> **Project**: Company Brain  
> **Mission**: The memory and intelligence layer for modern companies.

---

## 1. Project Purpose & Scope

Company Brain is an enterprise operating system designed to aggregate knowledge, meetings, decisions, projects, tasks, documents, and business context, subsequently empowering teams with AI-assisted operations.

### Current Scope (Phase 0.5: Authentication, Pricing & Trial Gating)
- Multi-tenant architecture and tenant isolation via PostgreSQL RLS.
- Authentication with Supabase Auth (GitHub OAuth, Email/Password, Forgot/Reset Password; Google OAuth deferred to future phase).
- Signup consent separation: Required Terms of Service vs. Optional, unselected Marketing consent.
- Paid-only product access model: No permanent free tier. Free trial (7 days) on all plans.
- Decoupled Stripe billing architecture: Server-side Price ID resolution, trial creation, and verified webhook syncing to `public.subscriptions`.
- Central server-side access control: `hasAuthenticatedUser() -> hasOrganization() -> hasActiveEntitlement()`.
- Dashboard shell and billing settings with live trial countdown.
- **Strict Scope Restriction**: DO NOT implement AI chat, Gemini LLM calls, vector embeddings, vector databases, RAG, integrations (Slack, Google, GitHub), or Projects/Tasks boards until designated future phases.

---

## 2. Tech Stack

- **Framework**: Next.js (App Router, Server Components first)
- **Language**: TypeScript (strict mode enabled, zero `any` policy)
- **Styling**: Tailwind CSS
- **Database & Auth**: Supabase (PostgreSQL, Supabase Auth via `@supabase/ssr`, Storage, Row Level Security)
- **Payments**: Stripe (`stripe`, `@stripe/stripe-js`)
- **AI (Future)**: Google Gemini (via modular `lib/ai/` interface)
- **Icons**: `lucide-react`
- **Validation**: `zod`
- **Deployment Target**: Vercel

---

## 3. Strict Multi-Tenancy & Authorization Rules

1. **Every business record belongs to an organization**:
   All tenant tables (`subscriptions`, `projects`, `tasks`, `documents`, etc.) must have an `organization_id uuid not null references organizations(id) on delete cascade` column.
2. **Never query without organization scoping**:
   Always verify the user belongs to the requested organization before returning data.
3. **Database-level isolation is mandatory**:
   Do not rely solely on application-level filtering (`where org_id = ...`). Supabase RLS is the primary enforcement mechanism.
4. **Active Workspace Scoping**:
   The active organization is tracked via a verified secure cookie (`cb_active_org_id`) or an explicit `X-Organization-Id` HTTP header. Membership must always be re-verified server-side.
5. **Decouple Authentication from Entitlement**:
   An authenticated Supabase session does NOT grant dashboard access. Always verify subscription status (`trialing` or `active`) via `lib/organizations/entitlements.ts`.

---

## 4. Security & Billing Rules

1. **Zero Secret Leakage**:
   - Never expose `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, or `GEMINI_API_KEY` to the browser.
   - The only authorized Supabase environment variables are `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
   - Never prefix server-only keys with `NEXT_PUBLIC_`.
   - Never commit `.env` or any production secrets to git.
2. **Stripe Price ID Isolation**:
   - NEVER accept or trust a Stripe Price ID supplied directly from the client browser.
   - The client supplies only internal plan identifiers (`starter`, `pro`, `enterprise`); the server resolves the Stripe Price ID from server environment variables.
3. **Webhook Verification**:
   - All Stripe webhook events must be cryptographically verified using `stripe.webhooks.constructEvent` with `STRIPE_WEBHOOK_SECRET`.
   - Never grant product entitlement based on client-side redirect parameters (`success=true`). Entitlement is granted only when the database record is updated by verified webhooks.
4. **Supabase Client Architecture**:
   - Standard user actions must always use the authenticated scoped client (`lib/supabase/server.ts`).
   - Server-side background jobs / webhooks use `createServiceClient()` and PostgreSQL `SECURITY DEFINER` RPCs without requiring a service role key.
5. **Marketing Consent Compliance**:
   - Marketing consent checkboxes must NEVER be pre-selected.
   - Account creation must never be blocked if marketing consent is omitted.
   - Terms & Privacy consent is strictly required and separate from marketing consent.

---

## 5. Coding Conventions

- **Server Components by Default**:
  Keep components as Server Components unless interactivity (`useState`, `useEffect`, event listeners) is strictly required. Place client components in discrete leaf nodes with `'use client'`.
- **Server Actions for Mutations**:
  Place server actions in `lib/[domain]/actions.ts` or co-located action files. Use standard Next.js `revalidatePath` and redirect patterns.
- **Strict TypeScript**:
  Define explicit types for database entities, props, and API payloads. Avoid `any`.
- **Modular Services**:
  UI components must not invoke external SDKs directly. All external operations must pass through domain modules in `lib/` (`lib/organizations`, `lib/auth`, `lib/stripe`, `lib/ai`).

---

## 6. Prohibited Actions for AI Agents (DO NOT DO)

- ❌ **DO NOT** implement real Gemini/LLM API calls or vector searches in this phase.
- ❌ **DO NOT** implement Google OAuth before explicitly requested (this phase strictly supports Email/Password and GitHub OAuth).
- ❌ **DO NOT** install heavy third-party UI component libraries (e.g. MUI, Chakra, AntD); use lightweight Tailwind primitives.
- ❌ **DO NOT** create insecure RLS policies (e.g., `using (true)` or `using (auth.role() = 'authenticated')` for tenant tables).
- ❌ **DO NOT** hardcode stripe price IDs, secret tokens, or tenant IDs.
- ❌ **DO NOT** trust client-supplied Stripe Price IDs, client-side billing parameters, or redirect flags (`success=true`).
- ❌ **DO NOT** bypass server-side entitlement checks (`verifyAccessOrRedirect`).
- ❌ **DO NOT** expose Stripe secret keys (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`) to the browser or client bundles.
- ❌ **DO NOT** create duplicate Stripe customers (always verify local DB and search Stripe customer metadata before creating).
- ❌ **DO NOT** create duplicate organizations during signup, OAuth, login, callback, or checkout.
- ❌ **DO NOT** pre-select marketing consent checkboxes.
- ❌ **DO NOT** grant dashboard access without verifying subscription/trial status.
- ❌ **DO NOT** re-introduce `SUPABASE_SERVICE_ROLE_KEY` or bypass RLS; only `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` are authorized.
- ❌ **DO NOT** use deprecated Supabase auth packages (`@supabase/auth-helpers-nextjs`). Always use `@supabase/ssr`.
