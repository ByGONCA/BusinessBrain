# AGENTS.md — Rules & Architecture Guidelines for AI Coding Agents

> **Project**: KogSync (canonical domain: kogsync.com)  
> **Mission**: The memory and intelligence layer for modern companies.  
> **Reference Docs**: Roadmap: [`docs/ROADMAP.md`](./docs/ROADMAP.md) | Architecture: [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) | Codebase Map: [`docs/CODEBASE_MAP.md`](./docs/CODEBASE_MAP.md) | AI Context: [`docs/AI_CONTEXT.md`](./docs/AI_CONTEXT.md) | Investigation & Token Protocol: [`.agents/rules/investigation-protocol.md`](./.agents/rules/investigation-protocol.md) | Graphify: [`.agents/rules/graphify.md`](./.agents/rules/graphify.md) | Ponytail: [`.agents/rules/ponytail.md`](./.agents/rules/ponytail.md) | Environment & Tooling Policy: [`docs/ENVIRONMENT_POLICY.md`](./docs/ENVIRONMENT_POLICY.md) & [`.agents/rules/tooling-and-environment.md`](./.agents/rules/tooling-and-environment.md) | Subagents Protocol: [`.agents/rules/subagents-protocol.md`](./.agents/rules/subagents-protocol.md) | Supabase Pentest Governance: [`.agents/rules/supabase-pentest.md`](./.agents/rules/supabase-pentest.md)

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
   - Subagents Protocol & Delegation: [`.agents/rules/subagents-protocol.md`](./.agents/rules/subagents-protocol.md)
9. **Mandatory Subagent Evaluation & Autonomous Delegation (Bridge to Specialists)**:
   Em todos os prompts e em todo o projeto, o Lead Agent avalia **sempre e obrigatoriamente** se a tarefa beneficia da utilização de subagentes.
   - **Autonomia Total Sem Pedido de Autorização**: Sempre que a tarefa envolver exploração abrangente (> 2-3 ficheiros), auditoria de segurança/RLS, conformidade regulatória, criação massiva de testes ou análise paralela de múltiplos domínios, o agente **deve invocar os subagentes imediatamente sem pedir autorização prévia ao utilizador**.
   - **Tripla Otimização Contínua**: O acionamento visa rigorosamente:
     1. A **melhor resposta e precisão técnica possível** (especialistas com foco aprofundado).
     2. O **melhor desempenho do trabalho** (paralelização eficiente entre agentes).
     3. O **menor consumo de tokens possível** (mantendo a janela de contexto principal limpa de leituras massivas de ficheiros ou relatórios brutos de exploração).
   - **Controlo e Integração Central**: O Lead Agent coordena, sintetiza criticamente e detém a responsabilidade exclusiva pela implementação de código de produção e validação final (`npm run typecheck && npm run lint && npm test`).
   - Detalhes normativos em [`.agents/rules/subagents-protocol.md`](./.agents/rules/subagents-protocol.md).
10. **Universal AI Optimization Stack (Graphify + Ponytail)**:
    - **Codebase Intelligence (Graphify)**: Before performing broad file exploration, consult the project knowledge graph at `graphify-out/` via CLI (`graphify query "<concept>"`, `graphify path "<A>" "<B>"`, `graphify explain "<node>"`) or MCP (`query_graph`). Avoid reading raw files when a scoped subgraph answers the architectural question. After editing code, run `graphify update .` (AST-only, zero LLM cost) to maintain graph accuracy.
    - **Implementation Minimalism (Ponytail)**: Apply the Ponytail ladder to all coding tasks:
      1. *YAGNI*: Does this need to exist? Skip speculative requirements.
      2. *Reuse*: Check `lib/` and `components/` before creating new abstractions.
      3. *Stdlib*: Rely on native TypeScript/JavaScript/Node stdlib.
      4. *Platform*: Prefer native HTML/CSS and database constraints over client JS.
      5. *Existing Deps*: Use packages already in `package.json`; avoid new dependencies.
      6. *Minimal Diff*: One line or smallest safe diff with a targeted check.
    - **Non-Negotiable Boundaries**: Ponytail and token optimization NEVER justify weakening security, multi-tenant isolation, RLS policies, input validation (Zod), error handling, or accessibility. Understand the problem and trace callers before writing code.
11. **Canonical Decision Hierarchy**:
    1. Correctness and security.
    2. User requirements.
    3. Existing project architecture.
    4. Simplicity and maintainability (Ponytail).
    5. Efficient codebase understanding (Graphify).
    6. Token and execution efficiency.
    7. Concise communication.


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

- **Visual Identity & Restraint**:
  - Professional, minimalist, modern, and visually coherent executive workspace.
  - Prioritize useful business information and organizational memory over decoration.
  - Use established semantic design tokens (`border-white/[0.08]`, `bg-[#121316]`, `bg-[#16181D]`, `text-white`, `text-zinc-400`).
  - Support dark and light themes consistently; respect `prefers-reduced-motion`.
  - Subtle, purposeful micro-animations only when they improve usability; never gratuitous motion.
- **Explicit Anti-Patterns (Zero Fluff & Zero Dashboard Bloat)**:
  - ❌ No excessive cards or nested "box-in-a-box" containers.
  - ❌ No redundant borders, pills, badges, or decorative glow/gradient backgrounds.
  - ❌ No redundant headings, descriptions, or repetitive helper text.
  - ❌ No multiple toolbars competing for visual attention.
  - ❌ No multi-step modal wizards when a single compact contextual drawer/panel suffices.
  - ❌ No displaying identical metrics across multiple prominent dashboard cards without clear purpose.
  - ❌ No generic AI-generated aesthetics, empty layout filler, or speculative BI complexity.
- **Interaction Principles & Progressive Disclosure**:
  - Keep primary views calm, focused, and executive-ready; edit controls must remain hidden outside customization mode.
  - Progressive disclosure: reveal advanced configuration options (granularities, dimensions, date offsets) only when requested.
  - Multi-modal accessibility: reordering must support pointer drag, touch handles, and accessible keyboard/button controls.
  - Avoid unnecessary confirmation modals for easily reversible actions; provide clear inline feedback for save, error, and reset states.
- **Engineering Principles & Data Truth**:
  - Inspect existing architecture before creating new systems; reuse domain services in `lib/`.
  - Zero fabricated metrics: point-in-time metrics (MRR, Active Subs), period totals (Net Revenue), and annualized run-rates (ARR = MRR * 12) must never be conflated or invented.
  - Atomic persistence and multi-tenant isolation: layouts are strictly scoped per user and organization with verified RLS.
  - Preserve all unrelated working-tree modifications and never introduce speculative dependencies.

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
   - Approved plugins (active when installed): `chrome-devtools-plugin`, `gemini-api`, `google-antigravity-sdk`.
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

---

## 9. Multi-Agent Worktree Architecture & Git Isolation

The BusinessBrain repository is orchestrated across 7 dedicated workspaces:
- `main` (`C:/Users/gonca/OneDrive/Documents/Projects/BusinessBrain/BusinessBrain`): Central Integration & Architecture Workspace.
- `agent/design` (`C:/Users/gonca/orca/workspaces/BusinessBrain/design`): UI/UX, Design System, Layouts, A11y.
- `agent/security` (`C:/Users/gonca/orca/workspaces/BusinessBrain/security`): Auth, RLS, Crypto, Security Audit, Perimeter.
- `agent/backend` (`C:/Users/gonca/orca/workspaces/BusinessBrain/backend`): APIs, Domain Services, Edge Functions, Queries.
- `agent/billing` (`C:/Users/gonca/orca/workspaces/BusinessBrain/billing`): Stripe, Subscriptions, Webhooks, Invoices, Entitlements.
- `agent/qa` (`C:/Users/gonca/orca/workspaces/BusinessBrain/qa`): Test Suites, Regression, Bug Reproduction, Quality Gates.
- `agent/product` (`C:/Users/gonca/orca/workspaces/BusinessBrain/product`): Feature Specs, User Journeys, PRDs, Onboarding.

### The 10 Mandatory Git Isolation Rules:
1. **Exclusive Worktree Scope**: Every agent works exclusively inside its assigned worktree and branch.
2. **Main Branch Protection**: No agent directly commits to, edits, or pushes to `main`. `main` is modified only during formal integration.
3. **Branch Non-Interference**: No agent commits to or edits another agent's branch.
4. **No Peer Merging**: No agent merges another agent's branch or attempts cross-branch rebases.
5. **No Force Pushes**: `git push --force` and `--force-with-lease` are strictly forbidden across all branches.
6. **No Destructive Commands**: Never execute `git reset --hard`, `git clean -fd`, or discard uncommitted changes in any workspace.
7. **Preserve User Changes**: Existing user modifications and untracked files must remain intact.
8. **Zero Automatic Merges**: All integrations into `main` require explicit review through the 7-Step Pre-Integration Gate.
9. **Mandatory File Summaries**: Every completed task or handoff must include a detailed summary of modified and created files.
10. **Pre-Flight Shared File Notice**: Modifications to shared files must follow the coordination protocol before execution.

---

## 10. Database, Migration & Remote Infrastructure Protection

Strict safety barriers are enforced for all agents:
1. **Zero Remote Database Mutations**: Never connect to or execute SQL against production or remote Supabase instances.
2. **Zero Remote Migrations**: Never execute Supabase migrations against remote environments without explicit manual authorization.
3. **Zero Production Stripe Calls**: Never execute real charges, update live Stripe settings, or manipulate live customer accounts.
4. **Isolated Local Dev Only**: All database testing must run against local mocked environments, local schemas, or in-memory fixtures.
5. **Never Disable RLS**: Row Level Security must remain enabled on all tables. Never create wildcard policies (`using (true)`).
6. **No Secret Mutation**: Never rotate credentials, re-generate API tokens, or modify production environment variables.

---

## 11. Deployment Restrictions

1. **Zero Unauthorized Deployments**: No agent may trigger or execute deployments to Vercel, production hosting, or staging environments without explicit authorization.
2. **Pre-Deployment Gate Mandatory**: A deployment can only be scheduled after all component tasks are marked `INTEGRATED` in `main` and all 25 test suites pass (`npm test`).
3. **No Preview Build Overrides**: Never modify Vercel project configurations or routing headers without Lead Architect review.

---

## 12. Rules for Shared Files & Conflict Areas

High-conflict files require strict ownership:
- `package.json` / `package-lock.json`: Owned by Lead / QA. Dependencies must follow Ponytail (no unneeded libraries).
- `app/layout.tsx`: Owned by Design. Other agents coordinate via handoff.
- `middleware.ts` / `proxy.ts`: Owned by Security. Guard logic is centralized.
- `database/migrations/`: Owned by Backend, reviewed by Security. Never modify historic migrations.
- `lib/supabase/*`: Owned by Security. Maintains strict SSR cookie scoping; no service role key leakage.
- `lib/i18n/dictionaries/*`: Owned by Product. All 4 locales (`en`, `pt`, `es`, `fr`) must remain in lockstep.
- Full details in [`docs/agent-coordination/CONFLICTS.md`](./docs/agent-coordination/CONFLICTS.md).

---

## 13. Agent Communication & Live Coordination Hub

Because Orca runs isolated agent processes in separate Git worktrees without direct IPC or automatic filesystem sharing:
1. **Live External Coordination Hub**:
   - The canonical real-time coordination directory is located at `C:/Users/gonca/orca/workspaces/BusinessBrain/coordination` (accessible as `../coordination` from any agent worktree).
   - Contains: `REGISTRY.json`, `TASK_INDEX.md`, `COMMUNICATION_RULES.md`, `tasks/`, `status/`, and `handoffs/`.
2. **Single-Writer Collision Prevention**:
   - Domain agents **never** edit a monolithic shared task board directly.
   - When claiming or transitioning a task, write to your dedicated heartbeat file: `status/STATUS-<agent>-<task_id>.json`.
   - When completing work, write an immutable handoff ticket to: `handoffs/HANDOFF-<TASK_ID>-<AGENT>-to-LEAD.md`.
   - The Lead Architect consolidates all statuses into `REGISTRY.json` and `TASK_INDEX.md`.
3. **Immediate Cross-Worktree Visibility**:
   - Files written to the external coordination hub are **instantly visible** across `main` and all six agent worktrees without git commits, pushes, or merges.
4. **Handoff Ticket Contents**:
   - Task ID, Source Branch, and Target Agent.
   - Summary of changes and exact modified file paths.
   - Interface / Contract changes (TypeScript types, API payloads).
   - Verification command results and test evidence.
   - Concrete next actions for the recipient and unresolved risks.
5. **Unblocking & Escalation**:
   - If blocked by another agent, update your status file (`"status": "BLOCKED"`, `"blockedBy": "<task_id>"`) and notify the Lead via `handoffs/`.

---

## 14. Definition of Done (DoD)

### For Domain Agents (in their respective worktree):
- [ ] Task scope fully implemented according to acceptance criteria in `coordination/tasks/TASK-<ID>.md`.
- [ ] Strictly within the agent's authorized boundary; no forbidden files touched.
- [ ] `npm run typecheck` passes with zero errors.
- [ ] `npm run lint` passes with zero warnings/errors.
- [ ] Targeted domain test script passes deterministically.
- [ ] Handoff ticket filed in `coordination/handoffs/HANDOFF-<TASK_ID>-<AGENT>-to-LEAD.md` with modified files summary, test results, and unresolved risks.
- [ ] Dedicated status file `coordination/status/STATUS-<agent>-<task_id>.json` updated to `"status": "REVIEW"`.

### For Integration into `main` (Lead Architect):
- [ ] Full diff reviewed against `main` (`git diff main...agent/<role>`).
- [ ] All 7 steps of the Pre-Integration Gate in [`docs/agent-coordination/INTEGRATION.md`](./docs/agent-coordination/INTEGRATION.md) completed.
- [ ] Multi-tenant isolation and RLS verified.
- [ ] Unified 25-suite regression test passes (`npm test`).
- [ ] Clean non-fast-forward merge or rebase-merge applied to `main`.
- [ ] Knowledge graph updated via `graphify update .`.
- [ ] Canonical `REGISTRY.json` and `TASK_INDEX.md` updated to mark task `INTEGRATED`.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
