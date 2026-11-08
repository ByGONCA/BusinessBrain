# Multi-Agent Workflow, Task Lifecycle & Handoff Protocols

This document establishes the operational workflow and communication protocol for all agents collaborating across Orca worktrees.

---

## 1. Asynchronous Coordination Model (Why File-Based?)

Orca runs each agent in an isolated workspace pane pointed at its respective Git worktree. Orca does **not** provide direct inter-process communication (IPC) or automatic event dispatching between running agent sessions.

Therefore, multi-agent coordination in BusinessBrain is **file-based, deterministic, and Git-verifiable**:
1. All tasks are registered in `docs/agent-coordination/TASK_BOARD.md` and detailed in `docs/agent-coordination/tasks/`.
2. Communication across agents is mediated through **Handoff Artifacts** in `docs/agent-coordination/handoffs/`.
3. The **Lead Architect** (operating on `main`) tracks board state, reviews ready handoffs, and executes merges.

---

## 2. Six-Stage Task Lifecycle

```
[ BACKLOG ] ──> [ READY ] ──> [ IN PROGRESS ] ──> [ REVIEW ] ──> [ APPROVED ] ──> [ INTEGRATED ]
```

### Stage 1: `BACKLOG`
- **Owner**: Product Agent or Lead Architect.
- **Criteria**: High-level feature or technical requirement identified. Added to `docs/agent-coordination/TASK_BOARD.md`.

### Stage 2: `READY`
- **Owner**: Lead Architect / Assigning Agent.
- **Criteria**: Task file created in `docs/agent-coordination/tasks/TASK-<ID>.md` with:
  - Clear objective and scope.
  - Assigned agent.
  - Target branch (`agent/<role>`).
  - Expected files to create or modify.
  - Dependencies clearly stated (must be resolved before moving to In Progress).
  - Explicit Acceptance Criteria.
  - Required verification commands.

### Stage 3: `IN PROGRESS`
- **Owner**: Assigned Domain Agent.
- **Rules**:
  - The agent transitions the task status on `TASK_BOARD.md`.
  - Works **only** inside its designated worktree and Git branch.
  - Follows the Ponytail ladder (simplest safe diff, reuse existing `lib/` modules).
  - Follows the Investigation Protocol (scoped file reading, line ranges).
  - Strictly preserves existing uncommitted work and documentation comments.
  - Never touches files outside its designated domain without pre-flight coordination.

### Stage 4: `REVIEW`
- **Owner**: Assigned Domain Agent & QA Agent / Reviewer.
- **Criteria**:
  - Implementation complete in the agent's worktree.
  - Agent creates a Handoff ticket in `docs/agent-coordination/handoffs/HANDOFF-<ID>.md`.
  - All local tests pass (`npm run typecheck`, `npm run lint`, domain tests).
  - Agent commits nothing to `main` and pushes nothing to remote branches.
  - QA Agent or specialized reviewer validates against acceptance criteria.

### Stage 5: `APPROVED`
- **Owner**: Lead Architect.
- **Criteria**:
  - Verification checklist passed.
  - Zero unresolved security or architectural issues.
  - No merge conflicts with `main`.
  - Handoff ticket marked `APPROVED`.

### Stage 6: `INTEGRATED`
- **Owner**: Lead Architect (Workspace: `main`).
- **Criteria**:
  - Merged into `main` following [`INTEGRATION.md`](./INTEGRATION.md).
  - Regression test suite passes in `main` (`npm test`).
  - Task marked `INTEGRATED` on `TASK_BOARD.md`.

---

## 3. Communication & Handoff Protocol

When an agent finishes its slice of work or needs another agent to take over (e.g., Backend needs Design to create the UI, or Design needs Backend to provide an API endpoint):

1. **Do NOT silently modify files in another agent's domain.**
2. **Create a Handoff Ticket**:
   Write a markdown file in `docs/agent-coordination/handoffs/HANDOFF-<TASK_ID>-to-<RECIPIENT>.md`.
   Use the template at [`docs/agent-coordination/handoffs/TEMPLATE.md`](./handoffs/TEMPLATE.md).
3. **Include the following required fields**:
   - `Task ID` & `Title`
   - `From Agent` & `To Agent`
   - `Source Branch` (`agent/<role>`)
   - `Modified Files Summary` (exact paths)
   - `Contract / Interface Definition` (TypeScript types, API payloads, or UI props)
   - `Verification Run` (exact commands executed and stdout status)
   - `Next Steps for Recipient`
4. **Update `TASK_BOARD.md`**:
   Reflect the pending handoff or dependency status.

---

## 4. Shared-File Pre-Flight Protocol

If an agent needs to touch a shared file (e.g., `package.json`, `app/layout.tsx`, `lib/i18n/dictionaries/en.ts`):
1. Check [`CONFLICTS.md`](./CONFLICTS.md) for the designated primary owner.
2. If you are not the primary owner, file a request in `docs/agent-coordination/handoffs/REQUEST-<TASK_ID>-<FILE>.md`.
3. Do not introduce broad format refactors or dependency churn.
4. Keep diffs strictly minimal.
