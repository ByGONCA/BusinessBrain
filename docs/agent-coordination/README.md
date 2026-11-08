# BusinessBrain — Multi-Agent Coordination System

Welcome to the central coordination hub for the BusinessBrain multi-agent development architecture.

BusinessBrain employs a **7-Workspace Federated Model**:
- **1 Central Integration Workspace** (`main`) operated by the Lead Architect / Integrator.
- **6 Specialized Agent Worktrees** running in Orca, each dedicated to an isolated functional domain on its own Git branch.

---

## 1. Worktree & Branch Topology

All workspaces point to the same repository but operate on isolated checkouts and branches:

| Workspace / Agent | Git Branch | Filesystem Path | Primary Domain Focus |
|---|---|---|---|
| **INTEGRATION** (Lead) | `main` | `C:/Users/gonca/OneDrive/Documents/Projects/BusinessBrain/BusinessBrain` | Architecture, Code Review, Quality Gating, Safe Merges |
| **DESIGN** | `agent/design` | `C:/Users/gonca/orca/workspaces/BusinessBrain/design` | UI/UX, Design System, Components, Layouts, A11y, i18n styles |
| **SECURITY** | `agent/security` | `C:/Users/gonca/orca/workspaces/BusinessBrain/security` | Auth, RLS, Penetration Testing, Crypto, Perimeter Defense |
| **BACKEND** | `agent/backend` | `C:/Users/gonca/orca/workspaces/BusinessBrain/backend` | APIs, Domain Logic, DB Queries, Edge Functions, Services |
| **BILLING** | `agent/billing` | `C:/Users/gonca/orca/workspaces/BusinessBrain/billing` | Stripe SDK, Subscriptions, Webhooks, Invoices, Entitlements |
| **QA** | `agent/qa` | `C:/Users/gonca/orca/workspaces/BusinessBrain/qa` | Test Suites, Regression Testing, Typecheck, Bug Detection |
| **PRODUCT** | `agent/product` | `C:/Users/gonca/orca/workspaces/BusinessBrain/product` | Feature Specs, User Journeys, PRDs, Onboarding UX |

---

## 2. Core Architecture & Operating Invariants

1. **Strict Git Isolation**:
   - Every agent works **only** within its assigned worktree and branch.
   - No agent pushes or commits directly to `main` or to another agent's branch.
   - Merging into `main` is performed **exclusively** in the central workspace by the Lead Architect.
2. **Infrastructure & Production Safety**:
   - Zero production database mutations.
   - Zero remote Supabase migrations or Stripe operations without explicit authorization.
   - No production deployments, no credential rotations.
3. **Orca Communication Protocol**:
   - Orca executes each agent in an independent workspace process. Orca does **not** provide automatic inter-agent IPC or automated Git synchronization across worktrees.
   - Coordination is maintained through **file-based handoffs** in `docs/agent-coordination/` and the central `TASK_BOARD.md`.
4. **Shared Files & Conflict Prevention**:
   - Core shared files (`package.json`, `app/layout.tsx`, `middleware.ts`, `database/migrations/`, etc.) have designated primary owners.
   - Any modification to shared files must follow the pre-flight coordination protocol in [`CONFLICTS.md`](./CONFLICTS.md).

---

## 3. Coordination Directory Index

- [`AGENT_ROLES.md`](./AGENT_ROLES.md) — Comprehensive role breakdown, ownership boundaries, and canonical verification suites.
- [`WORKFLOW.md`](./WORKFLOW.md) — 6-stage task lifecycle (`BACKLOG` → `INTEGRATED`), handoff protocols, and communication rules.
- [`INTEGRATION.md`](./INTEGRATION.md) — Step-by-step merge and validation policy for integrating work into `main`.
- [`DEPENDENCIES.md`](./DEPENDENCIES.md) — Inter-agent dependency matrix, sequencing, and unblocking flows.
- [`TASK_BOARD.md`](./TASK_BOARD.md) — Single source of truth for active tasks, statuses, and assignees.
- [`CONFLICTS.md`](./CONFLICTS.md) — Shared-file ownership matrix and conflict resolution protocol.
- [`roles/`](./roles/) — Individual role specifications for each agent:
  - [`DESIGN.md`](./roles/DESIGN.md)
  - [`SECURITY.md`](./roles/SECURITY.md)
  - [`BACKEND.md`](./roles/BACKEND.md)
  - [`BILLING.md`](./roles/BILLING.md)
  - [`QA.md`](./roles/QA.md)
  - [`PRODUCT.md`](./roles/PRODUCT.md)
- [`tasks/`](./tasks/) — Active and archived task specification files (`TASK-<ID>.md`).
- [`handoffs/`](./handoffs/) — Asynchronous agent handoff reports (`HANDOFF-<ID>.md`).
