# Agent Handoff Ticket: [TASK_ID] — [TITLE]

## 1. Handoff Header
- **Task ID**: `[e.g., BE-002]`
- **From Agent**: `[e.g., BACKEND]` (Branch: `agent/backend`)
- **To Agent**: `[e.g., DESIGN | LEAD | QA]`
- **Date**: `[YYYY-MM-DD]`
- **Status**: `[PENDING REVIEW | APPROVED | BLOCKED]`

## 2. Summary of Implementation
[Concise bulleted summary of what was implemented or resolved, following the Ponytail principle of minimal sufficient change.]

## 3. Modified Files Summary
```
[List exact file paths changed in your worktree, e.g.]
modified:   lib/workspace/queries.ts
created:    lib/workspace/types.ts
```

## 4. Contract / Interface Changes
[Describe any new exported functions, Server Actions, TypeScript types, or API endpoints. Provide snippet examples so recipient does not need to guess.]

```typescript
// Example export:
export interface WorkspaceNode {
  id: string;
  title: string;
  organizationId: string;
}
```

## 5. Verification & Test Evidence
- **Typecheck**: `[Passed / Output summary]`
- **Linter**: `[Passed / Output summary]`
- **Targeted Test Execution**:
  ```bash
  [Command executed and exit code / result]
  ```

## 6. Action Required from Recipient
- [ ] [Recipient action item 1]
- [ ] [Recipient action item 2]
