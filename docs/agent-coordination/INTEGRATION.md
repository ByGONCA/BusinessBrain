# Integration & Merge Policy

`main` is the central integration branch and the sole source of truth for KogSync / BusinessBrain.

This document outlines the strict protocol governing how work produced in the six agent branches (`agent/design`, `agent/security`, `agent/backend`, `agent/billing`, `agent/qa`, `agent/product`) is integrated into `main`.

---

## 1. Golden Rules of Integration

1. **Sole Integrator Authority**:
   - Only the **Lead Architect** operating in the central workspace (`main`) is authorized to integrate work into `main`.
   - Domain agents (`design`, `security`, `backend`, `billing`, `qa`, `product`) **never** merge their own branches into `main` or into peer branches.
2. **Zero Automatic Merges**:
   - No automatic git hooks, scripts, or AI bots may trigger unattended merges.
   - Every integration requires human/lead architectural inspection of the diff.
3. **No Force Pushes**:
   - `git push --force` or `--force-with-lease` is strictly prohibited on `main` and on all agent branches.
4. **No Destructive Commands**:
   - Never use `git reset --hard`, `git clean -fd`, or discard uncommitted changes in any workspace.

---

## 2. Seven-Step Pre-Integration Verification Gate

Before any branch is merged into `main`, the Lead Architect executes this verification gate:

### Step 1: Complete Diff Inspection
Inspect the full diff between `main` and the agent branch:
```bash
git diff main...agent/<role>
```
Confirm:
- Only files within the agent's authorized scope were modified.
- No secrets, tokens, or local credentials leaked.
- No accidental formatting churn or deletion of existing comments.

### Step 2: Conflict & Shared-File Check
Check if any modified files overlap with recent changes in `main` or with other active agent branches:
```bash
git merge-base main agent/<role>
```
If a shared file was modified (e.g. `package.json`, `app/layout.tsx`), verify that it strictly conforms to [`CONFLICTS.md`](./CONFLICTS.md).

### Step 3: Foundation Quick Check
Run TypeScript type-checking and ESLint on the branch:
```bash
npm run typecheck && npm run lint
```
Zero errors are permitted.

### Step 4: Domain & Unified Test Verification
Run the domain-specific suite, followed by the regression suite:
```bash
# Targeted domain test:
npx tsx scripts/test-<domain>.ts

# Full 25-suite regression:
npm test
```
All test suites must pass deterministically.

### Step 5: Security & Multi-Tenancy Invariant Check
Verify:
- Every database query includes `organization_id` scoping or is protected by verified Supabase RLS.
- No raw Stripe Price IDs accepted from client bundles.
- No `NEXT_PUBLIC_` prefixes on server-only environment variables.
- No `SUPABASE_SERVICE_ROLE_KEY` used in user-facing client contexts.

### Step 6: Internationalization (i18n) Parity Check
If any UI text or labels were introduced, verify that all four language dictionaries (`en`, `pt`, `es`, `fr`) in `lib/i18n/dictionaries/` have matching keys.

### Step 7: Acceptance Criteria Sign-Off
Review the original task specification in `docs/agent-coordination/tasks/TASK-<ID>.md`. Ensure every acceptance criterion has concrete evidence of completion.

---

## 3. Merge Procedure (Lead Architect Only)

Once the verification gate passes:
1. Fetch latest changes from the agent's worktree.
2. Perform a standard merge or cherry-pick into `main` preserving clear history:
   ```bash
   git merge --no-ff agent/<role> -m "feat(<domain>): integrate <task-id> - <title>"
   ```
3. Run post-merge verification in `main`:
   ```bash
   npm run typecheck && npm test
   ```
4. Update `docs/agent-coordination/TASK_BOARD.md` to set status to `INTEGRATED`.
5. Keep the graph updated with `graphify update .`.
