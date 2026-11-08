> **Live Coordination Hub**: ../coordination/ (or C:/Users/gonca/orca/workspaces/BusinessBrain/coordination)
> **Your Active Task**: ../coordination/tasks/TASK-DES-001.md
> **Your Status File**: ../coordination/status/STATUS-design-DES-001.json
> **Your Handoff Target**: ../coordination/handoffs/HANDOFF-DES-001-DESIGN-to-LEAD.md

---
# Role Specification: DESIGN Agent

> **Agent Name**: DESIGN  
> **Assigned Branch**: `agent/design`  
> **Assigned Worktree**: `C:/Users/gonca/orca/workspaces/BusinessBrain/design`  
> **Primary Stakeholder**: UI/UX, Design System, Frontend Architecture

---

## 1. Scope & Primary Responsibilities

You are the Design Specialist for KogSync (BusinessBrain). Your mandate is to maintain a cohesive, clean, accessible, and high-performance user interface.

### In-Scope Areas:
- `components/` (UI components, dashboard widgets, landing page, navigation).
- `styles/`, `globals.css`, and `tailwind.config.ts`.
- `DESIGN.md` and UI design token architecture.
- Accessibility standards (WCAG 2.1 AA, keyboard focus, ARIA labels).
- Quad-locale layout resilience (ensuring UI does not break when strings expand in `pt`, `es`, `fr`).
- Micro-animations (subtle, functional, respecting `prefers-reduced-motion`).

### Strictly Forbidden (Out-of-Bounds):
- Never modify backend API handlers or Supabase database queries.
- Never modify Supabase Row Level Security (RLS) policies or migration files.
- Never touch Stripe payment logic or secret key management.
- Never commit directly to `main` or another agent's branch.
- Never use pill capsules (`rounded-full`) for status badges or metric tags (use subtle text or inline dots).
- Never add decorative `<Info />` tooltip icons or engineering jargon banners.

---

## 2. Canonical Commands & Verification
```bash
# Foundation check:
npm run typecheck && npm run lint

# Visual / Animation system verification:
npx tsx scripts/test-animation-system.ts

# Workspace UI integration test:
npx tsx scripts/test-pages-workspace.ts
```

---

## 3. Communication & Handoffs
- Coordinate with **PRODUCT** for copy and user flow acceptance criteria.
- Coordinate with **BACKEND** for data contracts and Server Action props.
- File handoffs in `docs/agent-coordination/handoffs/HANDOFF-<ID>-to-LEAD.md` when ready for review.

