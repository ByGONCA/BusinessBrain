# Product Roadmap: Company Brain

---

## Phase 0: Foundation
*Status: Completed*

- [x] Multi-tenant Next.js App Router architecture.
- [x] Supabase PostgreSQL database schema (`profiles`, `organizations`, `organization_members`).
- [x] Security Definer RLS policies for strict tenant isolation.
- [x] Cookie-based session management via `@supabase/ssr`.
- [x] Workspace scoping with cookies/headers and server-side verification.
- [x] Dashboard shell (sidebar, top navigation, org switcher, user menu, placeholder views).
- [x] Pluggable Stripe module abstraction and Gemini AI interface preparation.

---

## Phase 0.5: Authentication, Pricing & Trial Gating
*Status: Completed*

- [x] Authentication with Supabase Auth (GitHub OAuth, Email/Password, Forgot/Reset Password; Google OAuth deferred).
- [x] Signup consent model (Required Terms of Service & Privacy Policy; Optional, unselected Marketing consent stored with timestamps).
- [x] Decoupled plan architecture: **Starter ($29/mo)**, **Pro ($79/mo)**, **Enterprise ($299/mo)**.
- [x] Configurable 7-day unrestricted free trial (`TRIAL_DAYS`, default 7).
- [x] Server-side Stripe Checkout session creation with trial attachment.
- [x] Stripe customer deduplication: DB + Stripe API search guarantees zero duplicate customers.
- [x] Verified Stripe webhook synchronization handling all 7 lifecycle events (`checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `customer.subscription.trial_will_end`, `invoice.paid`, `invoice.payment_failed`) using PostgreSQL `SECURITY DEFINER` RPCs.
- [x] Central server-side access guard (`verifyAccessOrRedirect`): strictly decouples authenticated status from entitlement.
- [x] Route gating: non-entitled users redirected to `/pricing`; entitled users admitted to `/dashboard/*`.
- [x] Post-checkout polling and automated activation flow (`/checkout/success`).
- [x] Dedicated Billing Settings view (`/dashboard/settings/billing`) and redirect (`/settings/billing`) displaying active plan, trial expiration countdown, and next billing date.

---

## Phase 1: Company Workspace (Next Phase)
*Objective: Empower teams to manage their day-to-day operations and organizational records.*

- [ ] Project management (Kanban, list views, milestones, ownership).
- [ ] Task tracking with assignees, due dates, and priorities.
- [ ] First-class Decision Log (ADRs, rationale, alternatives considered, status).
- [ ] Meeting notes management (agendas, action items, attendee tracking).
- [ ] Member invitations via email and role management (`owner`, `admin`, `member`).
- [ ] Stripe Customer Portal integration for self-serve payment method updates and plan changes.
- [ ] Audit logging for administrative events.

---

## Phase 2: Knowledge & Company Memory
*Objective: Turn scattered company information into structured, searchable institutional knowledge.*

- [ ] Rich text editor (Markdown, slash commands, callouts, tables) for company wikis & SOPs.
- [ ] Document management with version history and attachment uploads (Supabase Storage).
- [ ] Cross-linking between documents, decisions, meetings, and projects.
- [ ] Institutional memory facts extractor and verification ledger.
- [ ] Workspace-wide fast full-text search with PostgreSQL `tsvector`.

---

## Phase 3: AI Company Brain
*Objective: Introduce the Google Gemini AI intelligence layer over workspace data.*

- [ ] Vector embeddings generation using Gemini text embedding models.
- [ ] Hybrid search (semantic vector search with pgvector + keyword search).
- [ ] Conversational AI Brain assistant with verifiable citations and source links.
- [ ] Meeting audio transcription and automated action item extraction.
- [ ] Automated decision extraction and inconsistency alerts.
- [ ] Token usage tracking, quotas, and AI credit metering.

---

## Phase 4: Integrations & Ecosystem
*Objective: Connect Company Brain to third-party tools where work happens.*

- [ ] Slack integration (summarize channels, capture decisions, trigger Brain queries).
- [ ] Google Workspace integration (Google Meet transcripts, Drive docs, Calendar sync).
- [ ] GitHub integration (link PRs to projects/decisions, index architecture docs).
- [ ] Notion / Confluence one-click migration importers.
- [ ] Public API and Webhooks for custom enterprise workflows.

---

## Phase 5: AI Chief of Staff & Automation
*Objective: Proactive intelligence and autonomous company workflow orchestration.*

- [ ] Weekly executive briefs and project velocity synthesis.
- [ ] Proactive blocker detection and timeline risk alerts.
- [ ] Autonomous task assignment and follow-up reminders.
- [ ] New hire automated onboarding curriculum tailored to role and team.

---

## Phase 6: Mobile & Desktop Clients
*Objective: Bring Company Brain natively to every device.*

- [ ] iOS and Android native mobile clients (React Native).
- [ ] Offline-first reading of company knowledge and decisions.
- [ ] macOS and Windows desktop companion with global quick-search hotkey (Raycast/Spotlight style).
- [ ] Quick voice note and meeting recorder widget.
