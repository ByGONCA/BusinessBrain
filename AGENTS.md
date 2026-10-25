# AGENTS.md — Rules & Architecture Guidelines for AI Coding Agents

> **Project**: Company Brain (BusinessBrain)  
> **Mission**: The memory and intelligence layer for modern companies.  
> **Reference Docs**: Roadmap: [`docs/ROADMAP.md`](./docs/ROADMAP.md) | Architecture: [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) | Codebase Map: [`docs/CODEBASE_MAP.md`](./docs/CODEBASE_MAP.md) | Investigation & Token Protocol: [`.agents/rules/investigation-protocol.md`](./.agents/rules/investigation-protocol.md) | Environment & Tooling Policy: [`docs/ENVIRONMENT_POLICY.md`](./docs/ENVIRONMENT_POLICY.md) & [`.agents/rules/tooling-and-environment.md`](./.agents/rules/tooling-and-environment.md)

---

## 1. Canonical Commands & Proportional Validation

Always use real project commands; do not invent scripts:

- **Develop (Turbopack)**: `npm run dev:turbo` (or `npm run dev`)
- **Build**: `npm run build`
- **Lint**: `npm run lint`
- **Typecheck**: `npm run typecheck`
- **Test Runner (Unified 25-Suite)**: `npm test` (executes `npx tsx scripts/test-runner.ts`)
- **Foundation Quick Check**: `npm run typecheck && npm run lint`
- **Environment Policy Check (Diagnostic)**: `npm run env:check` (or `npx tsx scripts/env-policy.ts`)
- **Environment Policy Apply (Explicit Only)**: `npm run env:apply` (or `npx tsx scripts/env-policy.ts --apply`)

### Proportional Testing Strategy (Risk-Based)
Match testing depth to task risk to avoid wasted compute and console bloat:
1. **Cosmetic / UI / Copy changes**: Run `npm run typecheck && npm run lint` and the targeted test script for the affected surface (e.g. `npx tsx scripts/test-animation-system.ts`). Do NOT run the 25-suite regression for minor visual edits.
2. **Domain Logic / Module modifications**: Run `npm run typecheck` and the specific domain test suite (e.g. `scripts/test-permissions-system.ts`, `scripts/test-pages-workspace.ts`).
3. **Core Security / Multi-Tenancy / Auth / Billing changes**: Full verification is mandatory (`npm test && npm run build`).
4. **Never fabricate evidence**: If a test was not run, state it clearly. Distinguish verified facts, logical inferences, and estimates.

---

## 2. Core Operating Principles

1. **Investigation & Token Efficiency Protocol**:
   Follow the canonical 10-principle token efficiency and 6-step investigation protocol in [`.agents/rules/investigation-protocol.md`](./.agents/rules/investigation-protocol.md).
   - If the exact file/symbol is provided, navigate directly without re-reading the map or unrelated modules.
   - Never re-read recently inspected or successfully edited files in full without a concrete reason.
   - Use line ranges (`StartLine`/`EndLine`) for files > 100 lines.
   - Load skills and MCPs only when strictly relevant and value-additive.
2. **Smallest Complete Solution & No Infinite Cycles**:
   Complete requests with the smallest sufficient change; reuse existing `lib/` utilities, components, and patterns. Avoid speculative refactors, unrequested dependencies, or endless optimization audits when completion criteria are met.
3. **Preservation of Pre-existing Local Changes & Other Workspaces**:
   Never overwrite or discard unrelated working tree changes. Never modify configurations, paths, or settings of other projects on the host system. Maintain documentation integrity and preserve pre-existing comments and code.
4. **Separation of Code Validation from Operational Validation**:
   Strict TypeScript (`typecheck`), linting (`lint`), and deterministic tests (`npm test`) validate code correctness. Operational validation (live Stripe charges, Supabase production migrations, Resend email delivery, OAuth provider callbacks) requires separate live verification and must never be reported as completed without concrete operational evidence.
5. **Zero Unauthorized Remote Operations**:
   Never execute remote mutations on Supabase Cloud, Stripe live/test dashboards, Vercel deployments, or production/staging databases without explicit user authorization.
6. **Tooling & MCP Discipline**:
   Never install, remove, enable, disable, or reconfigure MCPs, plugins, or global settings without explicit authorization (see [`.agents/rules/tooling-and-environment.md`](./.agents/rules/tooling-and-environment.md)). Never assume a tool is available without checking local environment capabilities.
7. **Concise Communication**:
   Concise conversational responses in the user's language. Technical explanations on request; standard professional phrasing in code, docs, and commits.
8. **On-Demand Context Loading**:
   Consult canonical documents on demand; never dump full files into context:
   - Codebase Map & Investigation Index: [`docs/CODEBASE_MAP.md`](./docs/CODEBASE_MAP.md)
   - Scope & Product Principles: [`docs/PRODUCT.md`](./docs/PRODUCT.md)
   - Roadmap & Planned Slices: [`docs/ROADMAP.md`](./docs/ROADMAP.md)
   - System Architecture: [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md)
   - Database & SQL: [`docs/DATABASE.md`](./docs/DATABASE.md)
   - Environment & Tooling Policy: [`docs/ENVIRONMENT_POLICY.md`](./docs/ENVIRONMENT_POLICY.md)
   - Verification & Quality Gates: [`docs/quality.md`](./docs/quality.md)
   - Design & Accessibility: [`docs/design.md`](./docs/design.md) & [`DESIGN.md`](./DESIGN.md) (consult only for UI/frontend tasks; ignore in backend)

---

## 3. Session Management & Context Conservation

To prevent context bloat and astronomical token compounding:
1. **Cohesive Functional Slices**: Dedicate each session to a focused, cohesive functional unit.
2. **Completion Summary**: When a task is complete and verified, provide a short structured summary (changes made, files affected, tests executed).
3. **Session Rotation**: Recommend a fresh session or `/compact` when switching to an independent functional area, or when conversation history exceeds ~30-40 turns.
4. **Preserve Unsaved State**: Clearly communicate any uncommitted state before ending a session.

---

## 4. Strict Multi-Tenancy & Authorization Invariants

1. **Every business record belongs to an organization**:
   All tenant tables (`subscriptions`, `projects`, `tasks`, `documents`, `pages`, `connections`, etc.) must have an `organization_id uuid not null references organizations(id) on delete cascade` column.
2. **Never query without organization scoping**:
   Always verify the user belongs to the requested organization before returning data.
3. **Database-level isolation is mandatory**:
   Do not rely solely on application-level filtering (`where org_id = ...`). Supabase RLS is the primary enforcement mechanism.
   - ❌ Never create insecure RLS policies (e.g., `using (true)` or `using (auth.role() = 'authenticated')` for tenant tables).
4. **Active Workspace Scoping**:
   The active organization is tracked via a verified secure cookie (`cb_active_org_id`) or an explicit `X-Organization-Id` HTTP header. Membership must always be re-verified server-side.
5. **Decouple Authentication from Entitlement**:
   An authenticated Supabase session does NOT grant dashboard access. Always verify subscription status (`trialing` or `active`) via `lib/organizations/entitlements.ts` (`verifyAccessOrRedirect`).
6. **Supabase Client Architecture**:
   - Standard user actions must always use the authenticated scoped client (`lib/supabase/server.ts`).
   - Server-side background jobs / webhooks use `createServiceClient()` and PostgreSQL `SECURITY DEFINER` RPCs without requiring a service role key in user sessions.
   - ❌ Never re-introduce `SUPABASE_SERVICE_ROLE_KEY` into standard client requests or bypass RLS.
   - ❌ Never use deprecated Supabase auth packages (`@supabase/auth-helpers-nextjs`). Always use `@supabase/ssr`.

---

## 5. Security & Billing Invariants

1. **Zero Secret Leakage**:
   - Never expose `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `RESEND_API_KEY`, or `GEMINI_API_KEY` to the browser or client bundles.
   - The only authorized Supabase environment variables for client bundles are `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
   - Never prefix server-only keys with `NEXT_PUBLIC_`.
   - Never commit `.env`, `.env.local`, or any production secrets to git.
2. **Stripe Price ID Isolation**:
   - NEVER accept or trust a Stripe Price ID supplied directly from the client browser.
   - The client supplies only internal plan identifiers (`starter`, `pro`, `enterprise`); the server resolves the Stripe Price ID from server configuration.
3. **Webhook Verification**:
   - All Stripe webhook events must be cryptographically verified using `stripe.webhooks.constructEvent` with `STRIPE_WEBHOOK_SECRET`.
   - Never grant product entitlement based on client-side redirect parameters (`success=true`). Entitlement is granted only when the database record is updated by verified webhooks.
4. **Deduplication Safeguards**:
   - Never create duplicate Stripe customers (always verify local DB and search Stripe customer metadata before creating).
   - Never create duplicate organizations during signup, OAuth, login, callback, or checkout.
5. **Marketing Consent Compliance**:
   - Marketing consent checkboxes must NEVER be pre-selected.
   - Account creation must never be blocked if marketing consent is omitted.
   - Terms & Privacy consent is strictly required and separate from marketing consent.

---

## 6. UI, Design & Coding Conventions

- **Server Components by Default**:
  Keep components as Server Components unless interactivity (`useState`, `useEffect`, event listeners) is strictly required. Place client components in discrete leaf nodes with `'use client'`.
- **Server Actions for Mutations**:
  Place server actions in `lib/[domain]/actions.ts` or co-located action files. Use standard Next.js `revalidatePath` and redirect patterns.
- **Strict TypeScript & Modular Services**:
  Explicit types for all database entities, props, and API payloads (avoid `any`). UI components must not invoke external SDKs directly; pass through domain modules in `lib/`.
- **No Bubble/Pill Badges**:
  Never wrap status, tags, company names, or metric badges in `rounded-full` pill capsules that resemble fake buttons (`rounded-full border bg-... px-... py-...`). Use clean typography, subtle text colors (`text-emerald-400`, `text-zinc-400`), or simple inline status dots (`<span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> Label`). Real interactive buttons should use standard button radii (`rounded-xl` or `rounded-lg`), not pill bubbles.
- **Strict Internationalization (i18n Quad-Locale)**:
  BusinessBrain natively supports 4 locales: English (`en` - Default), Portuguese (`pt`), Spanish (`es`), and French (`fr`). Never hardcode text strings in components or pages. All strings must use the `lib/i18n` dictionary system.
- **Dynamic Metrics & Directional Iconography**:
  Metrics, trends, and percentage deltas must never look static or unstyled. Always accompany percentage changes with directional iconography (`TrendingUp`, `TrendingDown`, `ArrowUpRight`, `ArrowDownRight`) and semantic color tokens (`emerald-400` for growth, `rose-400` for drop, `zinc-400` for neutral).
- **Anti-Clutter & Business Focus (No Vanity / Engineering Jargon in UI)**:
  - Do NOT place decorative `<Info />` tooltip icons next to headers or titles unless they open an active, purposeful interactive element.
  - Do NOT surface internal provenance / verification banners (e.g. "Fonte Verificada", "Stripe Live (EUR)", account ID banners) in standard user dashboards.
  - Do NOT display internal database / security engineering jargon (e.g., "RLS", "PostgreSQL RLS de Linha de Defesa", "Criptografia AES-256", "RLS Guard", "Perímetro Ativo", "Built with strict security perimeters", "Enterprise Workspace Isolation & Encryption", "Cryptographic Webhooks", "Least-Privilege Scopes", "Proprietary Tenant Scope") anywhere in user dashboard cards, marketing pages, or the footer. Security is enforced strictly in the database/backend; executive UI must display actual business value, organizational memory, and team activity.

---

## 7. Strict Scope Restrictions

- ❌ **DO NOT** implement real Gemini/LLM API calls or vector searches in this phase.
- ❌ **DO NOT** implement Google OAuth before explicitly requested (strictly Email/Password and GitHub OAuth).
- ❌ **DO NOT** install heavy third-party UI component libraries (MUI, Chakra, AntD); use lightweight Tailwind primitives.
- ❌ **DO NOT** hardcode stripe price IDs, secret tokens, or tenant IDs.

---

## 8. Permanent Tooling, MCP & Multi-PC Governance

1. **Approved Tooling Baseline**:
   - Approved reference MCPs: `supabase`, `stripe`, `shadcn`, `chrome-devtools`.
   - Never reintroduce unauthorized MCPs (`21st`, `you-com`) without explicit permission.
   - Never reactivate unauthorized plugins (`firebase`, `android-cli-plugin`, `google_maps_platform`) without explicit permission.
2. **Local Multi-PC Portability**:
   - Never hardcode machine-specific paths or assume all workstations share identical global installations.
   - Inspect local environment status using `npm run env:check`.
   - Any proposed global modifications must be previewed in diagnostic mode and require explicit manual authorization (`npm run env:apply`).
3. **Configuration Safety & Non-Destructive Operations**:
   - Backups must be non-destructive and timestamped; never overwrite earlier backups.
   - All unrelated configurations, foreign project settings, and active secrets must be rigorously preserved.
   - Pre- and post-modification JSON integrity must always be parsed and validated.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
