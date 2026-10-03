# Product Specification: Company Brain

> **"Your company's memory and intelligence layer."**

---

## 1. Executive Summary

Every growing organization suffers from information fragmentation. Knowledge resides in scattered Slack channels, Google Docs, Notion pages, meeting recordings, Jira tickets, and employee memory. When new team members join, or strategic decisions need to be made, valuable time is lost reconstructing context.

**Company Brain** solves this by unifying company knowledge, decisions, projects, tasks, meetings, and business context into a single operating system. Once unified, an AI intelligence layer empowers founders, leaders, and employees to ask questions, surface insights, detect blockers, and automate routine workflows.

---

## 2. Product Principles

1. **Information with Provenance**: Knowledge without context leads to hallucinations. Every piece of insight in Company Brain is linked to source meetings, decisions, or documents.
2. **Context-Aware Workspace**: Projects, tasks, and meetings are not isolated silos; they cross-reference decisions and historical knowledge.
3. **Multi-Tenant & Enterprise-Grade**: From day one, companies operate in completely isolated environments. No company context ever bleeds across workspace boundaries.
4. **Platform Agnostic**: Built for web first, but architected from the foundation to deliver a seamless experience across iOS, Android, macOS, and Windows clients.
5. **Human-in-the-Loop AI**: AI serves as an executive co-pilot and memory layer, augmenting human decision-making with full attribution and transparency.

---

## 3. Product Access, Pricing & Trial Gating (Phase 0.5)

### 3.1 Paid-Only Model (No Permanent Free Tier)
Company Brain operates on a premium, value-focused model. **There is no permanent free tier**.
- Users can create a free account and register their workspace.
- Access to the application dashboard and its operational modules requires an active subscription or an active free trial.
- Authentication and entitlement remain strictly decoupled: an authenticated Supabase user without an active trial or paid plan is redirected to `/pricing`.

### 3.2 7-Day Unrestricted Free Trial
Every new subscription begins with an unrestricted free trial (configurable via `TRIAL_DAYS`, default 7 days):
- Full access to all workspace features during the trial window.
- The trial is managed natively via Stripe Checkout; no upfront charges occur until the trial concludes.
- Cancellation before trial expiration immediately halts renewals with zero cost to the customer.

### 3.3 Plan Tiers
- **Starter ($29/month)**: Up to 10 team members, unlimited projects and tasks, decision log (ADRs), meeting notes.
- **Pro ($79/month)**: Up to 50 team members, unlimited knowledge base wikis and SOPs, priority support, future AI Brain co-pilot.
- **Enterprise ($299/month)**: Unlimited members, dedicated infrastructure, SSO/SAML, 99.9% uptime SLA, dedicated support.

### 3.4 Entitlement Lifecycle
```text
Authenticated User
  ├── No active trial & no active subscription  ──> /pricing (Access Gated)
  ├── Active 7-day free trial ('trialing')       ──> /dashboard (Access Granted)
  ├── Active paid subscription ('active')       ──> /dashboard (Access Granted)
  └── Expired / Canceled / Past due             ──> /pricing (Access Revoked)
```

### 3.5 Authentication Providers (Phase 0.5)
- **Email + Password**: Secure authentication with required Terms of Service and unselected optional marketing consent.
- **GitHub OAuth**: Single-click authentication using Supabase Auth SSR / PKCE flow.
- *(Note: Google OAuth and Apple OAuth are deferred to subsequent phases).*

---

## 4. Core Modules (Planned)

### Overview / Command Center
Real-time summary of the organization: active projects, upcoming deadlines, recent decisions, and workspace activity feeds.

### Brain (AI Intelligence Layer - Future Phase)
The conversational and analytical portal into the company's knowledge graph. Allows users to query company history, synthesize meeting transcripts, draft documentation, and detect inconsistencies.

### Knowledge Base
Structured and unstructured institutional knowledge: company wikis, SOPs, onboarding guides, technical architecture documents, and product specs.

### Decisions (ADRs & Business Decisions)
A first-class registry of architectural and business decisions. Answers the critical question: *"Why did we build/choose this?"* Includes status, context, options considered, and participants.

### Meetings
Centralized meeting records with attendees, agendas, action items, and transcripts. Connects meeting outcomes directly to tasks and decisions.

### Projects & Tasks
Outcome-driven project planning linked with day-to-day task tracking. Every task references relevant decisions and documentation.

### Settings & Members
Workspace management: member roles (`owner`, `admin`, `member`), invite links, billing/subscription management, and integration settings.

---

## 5. Target Personas

1. **Founders & Executives**: Need a high-level pulse on company velocity, strategic alignment, and frictionless access to institutional memory.
2. **Engineering & Product Leaders**: Need clear decision records, project specifications, and architectural documentation without repetitive status meetings.
3. **New Team Members**: Onboard in days instead of months by querying Company Brain for historical context, team standards, and project rationale.
