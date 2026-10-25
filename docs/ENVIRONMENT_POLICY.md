# BusinessBrain Environment, MCP & Tooling Policy

> **Authority**: Canonical reference for workstation setup and agent tooling governance across all developer PCs.  
> **Related Rules**: [`.agents/rules/tooling-and-environment.md`](../.agents/rules/tooling-and-environment.md) | [`.agents/rules/investigation-protocol.md`](../.agents/rules/investigation-protocol.md)

---

## 1. Reference Architecture vs. Real Workstation State

To maintain operational integrity across different development machines (Windows, macOS, Linux):
- **Reference Policy**: Defines the canonical baseline of approved tools and forbidden extensions for BusinessBrain.
- **Real Workstation State**: Reflects the actual installed tools and credentials on a specific machine.
- **Invariance Rule**: An agent or script must **never** assume a tool exists merely because it is documented in this policy, and must **never** modify global configuration files automatically without explicit user authorization (`--apply`).

---

## 2. Approved Reference MCPs

The following Model Context Protocol (MCP) servers are approved for BusinessBrain development:

| MCP Server | Reference Implementation | Purpose | Secrets / Notes |
| :--- | :--- | :--- | :--- |
| **`supabase`** | `https://mcp.supabase.com/mcp` | Supabase DB schema, RLS, and Postgres inspection | OAuth or server URL |
| **`stripe`** | `npx -y @stripe/mcp --tools=all --api-key=<STRIPE_RESTRICTED_KEY>` | Stripe subscription, checkout, and webhook verification | Local developer key (never committed to git) |
| **`shadcn`** | `npx -y shadcn@latest mcp` | UI component discovery and accessibility standards | Zero-credential CLI |
| **`chrome-devtools`** | `npx -y chrome-devtools-mcp@latest --headless` | Browser automation, visual inspection, and accessibility | Zero-credential headless runtime |

---

## 3. Prohibited Tools & Extensions (Unauthorized Baseline)

The following MCPs and plugins are **explicitly prohibited** from being re-introduced or re-activated without prior explicit authorization from the lead developer:

### 3.1 Prohibited MCP Servers
- ❌ **`21st`** — Unused third-party MCP; must not be configured in `mcp_config.json`.
- ❌ **`you-com`** — Unused search MCP; must not be configured in `mcp_config.json`.

### 3.2 Prohibited Plugins
- ❌ **`firebase`** — Unused mobile/backend plugin; must have `"enabled": false` in `config.json` (or uninstalled).
- ❌ **`android-cli-plugin`** — Unused mobile plugin; must have `"enabled": false` in `config.json` (or uninstalled).
- ❌ **`google_maps_platform`** — Unused mapping plugin; must have `"enabled": false` in `config.json` (or uninstalled).

---

## 4. Multi-PC Management & Scripts

BusinessBrain provides a deterministic TypeScript script (`scripts/env-policy.ts`) and PowerShell wrapper (`scripts/env-policy.ps1`) to diagnose and configure new and existing workstations.

### 4.1 Diagnosing a Workstation (Safe, Read-Only)
Run diagnostic mode to inspect current configuration files against this policy:
```bash
npm run env:check
```
*Equivalent:*
```powershell
npx tsx scripts/env-policy.ts
# or
powershell -ExecutionPolicy Bypass -File scripts/env-policy.ps1
```
> [!NOTE]
> Diagnostic mode **never** modifies any files. It compares the host environment with the policy and reports exact differences, separating informational notices from required corrections.

### 4.2 Applying the Policy on a New or Outdated PC
When explicitly authorized, apply the baseline configuration:
```bash
npm run env:apply
```
*Equivalent:*
```powershell
npx tsx scripts/env-policy.ts --apply
# or
powershell -ExecutionPolicy Bypass -File scripts/env-policy.ps1 -Apply
```

### 4.3 Safety Guarantees Built into the Script
1. **Timestamped Non-Destructive Backups**: Every modified file is backed up with a unique timestamp (`config.json.bak-YYYYMMDD-HHMMSS.json`). Previous backups are never overwritten.
2. **Secret & Custom Setting Preservation**: Existing API keys (such as local Stripe keys), unrelated plugins, user settings (e.g. `remoteControlHostname`, `themeMode`), and other workspace paths in `settings.json` are completely preserved.
3. **Pre- and Post-JSON Validation**: All JSON files are parsed and validated for structural integrity both before and after applying changes.
4. **Idempotence**: Running `--apply` multiple times produces the exact same clean state without duplicate entries or configuration drift.
5. **No Credential Fabrication**: If an approved tool requires a personal API key (e.g. Stripe), the script does not invent fake tokens or copy secrets across machines; it notifies the developer to supply their local key.

---

## 5. Setting Up a Brand New PC

Follow this step-by-step checklist when setting up BusinessBrain on a new workstation:

1. **Clone repository & install dependencies**:
   ```bash
   git clone <repo-url> BusinessBrain
   cd BusinessBrain
   npm install
   ```
2. **Run environment diagnostic**:
   ```bash
   npm run env:check
   ```
3. **Apply baseline configuration (if approved)**:
   ```bash
   npm run env:apply
   ```
4. **Configure workstation secrets**:
   - Provide local `.env.local` containing authorized tenant and Stripe test credentials (consult team vault; never store in git).
5. **Verify foundation**:
   ```bash
   npm run typecheck && npm run lint
   ```
