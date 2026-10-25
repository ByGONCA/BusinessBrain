# BusinessBrain Environment, MCP & Tooling Policy

> **Authority**: Canonical reference for workstation setup and agent tooling governance across all developer PCs.  
> **Related Rules**: [`.agents/rules/tooling-and-environment.md`](../.agents/rules/tooling-and-environment.md) | [`.agents/rules/investigation-protocol.md`](../.agents/rules/investigation-protocol.md)

---

## 1. Reference Architecture vs. Real Workstation State

To maintain operational integrity across different development machines (Windows, macOS, Linux):
- **Reference Policy**: Defines the canonical baseline of approved tools, plugins, and forbidden extensions for BusinessBrain.
- **Real Workstation State**: Reflects the actual installed tools, configurations, and credentials on a specific host machine.
- **Invariance Rule**: An agent or script must **never** assume a tool exists merely because it is documented in this policy, and must **never** modify global configuration files automatically without explicit user authorization (`--apply`).
- **Git vs. Global Distinction**: Version control (`git pull`) strictly updates repository-level files and policy rules. It **does NOT** modify host-wide global configuration files (`~/.gemini/`). Global workstation configurations are only inspected and updated locally when executing the dedicated scripts (`npm run env:check` / `npm run env:apply`).

---

## 2. Approved Reference MCPs

The following Model Context Protocol (MCP) servers are approved for BusinessBrain development:

| MCP Server | Reference Implementation | Purpose | Secrets / Notes |
| :--- | :--- | :--- | :--- |
| **`supabase`** | `https://mcp.supabase.com/mcp` | Supabase DB schema, RLS, and Postgres inspection | OAuth or server URL |
| **`stripe`** | `npx -y @stripe/mcp --tools=all` | Stripe subscription, checkout, and webhook verification | Local restricted key (see Security Note below) |
| **`shadcn`** | `npx -y shadcn@latest mcp` | UI component discovery and accessibility standards | Zero-credential CLI |
| **`chrome-devtools`** | `npx -y chrome-devtools-mcp@latest --headless` | Browser automation, visual inspection, and accessibility | Zero-credential headless runtime |

### 2.1 Stripe MCP Key Security Advisory
- `@stripe/mcp` supports authentication via the **`STRIPE_SECRET_KEY`** environment variable (configured in the MCP server `env` block or workstation system environment).
- If a Stripe restricted key was previously supplied via command arguments (`--api-key=...`) and exposed in logs or history, **it should be rotated in the Stripe Dashboard**.
- The new restricted key must be configured locally on the developer machine via the supported `STRIPE_SECRET_KEY` environment variable. Never commit Stripe API keys to Git.

---

## 3. Tooling & Plugin Baseline

### 3.1 Prohibited MCP Servers (Without Authorization)
The following MCPs must **never** be configured in `mcp_config.json`:
- ❌ **`21st`** — Unused third-party MCP.
- ❌ **`you-com`** — Unused third-party search MCP.

### 3.2 Prohibited Plugins (Must Remain Disabled)
The following plugins must remain disabled (`"enabled": false` in `config.json` or uninstalled):
- ❌ **`firebase`** — Unused mobile/backend plugin.
- ❌ **`android-cli-plugin`** — Unused mobile plugin.
- ❌ **`google_maps_platform`** — Unused mapping plugin.

### 3.3 Approved Active Plugins (When Installed & Supported)
The following plugins are approved to remain active (`"enabled": true` or default enabled) when installed on the workstation:
- ✅ **`chrome-devtools-plugin`** — Browser automation, console debugging, and accessibility auditing.
- ✅ **`gemini-api`** — Official Gemini API development tools and documentation search.
- ✅ **`google-antigravity-sdk`** — Antigravity agent architecture and workflow definitions.

---

## 4. Multi-PC Management & Scripts

BusinessBrain provides a deterministic TypeScript script (`scripts/env-policy.ts`) and PowerShell wrapper (`scripts/env-policy.ps1`) to diagnose and configure workstations.

### 4.1 Diagnosing a Workstation (Safe, Read-Only)
Run diagnostic mode to inspect current configuration files against this policy:
```bash
npm run env:check
```
*Equivalent via PowerShell:*
```powershell
powershell -ExecutionPolicy Bypass -File scripts/env-policy.ps1
```
> [!NOTE]
> Diagnostic mode is **strictly read-only** and **never** modifies any files. It categorizes each tool into:
> - **Installed & Active**
> - **Installed & Disabled**
> - **Not Installed**
> - **Undetermined / Unrecognized Structure**

### 4.2 Applying the Policy (Explicit Authorization)
When explicitly authorized, apply the baseline configuration:
```bash
npm run env:apply
```
*Equivalent via PowerShell:*
```powershell
powershell -ExecutionPolicy Bypass -File scripts/env-policy.ps1 -Apply
```

### 4.3 Safety Guarantees Built into the Script
1. **Timestamped Non-Destructive Backups**: Every modified file is backed up with a unique timestamp (`config.json.bak-YYYYMMDD-HHMMSS.json`). Previous backups are never overwritten.
2. **Secret & Custom Setting Preservation**: Existing API keys, custom host plugins, user settings (e.g. `remoteControlHostname`, `themeMode`), and other workspace paths in `settings.json` are completely preserved.
3. **Pre- and Post-JSON Validation**: All JSON files are parsed and validated for structural integrity both before and after applying changes.
4. **Idempotence**: Running `--apply` multiple times produces the exact same clean state without duplicate entries or configuration drift.
5. **No Credential Fabrication**: If an approved tool requires a personal API key, the script does not invent fake tokens or copy secrets across machines; it notifies the developer to supply their local key.

---

## 5. Standard Operating Procedures Across PCs

### 5.1 On an Already Configured PC
To sync updates without altering host-wide global settings:
```powershell
git pull
npm run env:check
```

### 5.2 On a Brand New PC
Follow this step-by-step checklist when setting up BusinessBrain on a new workstation:

1. **Install Prerequisites**: Ensure Node.js (>= 20) and Git are installed.
2. **Clone & Install**:
   ```bash
   git clone https://github.com/ByGONCA/BusinessBrain.git
   cd BusinessBrain
   npm install
   ```
3. **Initialize CLI (if needed)**: Start the Antigravity/Gemini CLI at least once to create the initial `~/.gemini` directory structure.
4. **Run Environment Diagnostic**:
   ```bash
   npm run env:check
   ```
5. **Review Diagnostic**: Inspect the proposed adjustments and informational notices.
6. **Apply Baseline Configuration**: Once confirmed, apply the configuration:
   ```bash
   npm run env:apply
   ```
7. **Restart CLI**: Restart the Antigravity/Gemini CLI to load the updated plugins and MCP servers.
8. **Configure Local Secrets**: Provide local `.env.local` containing authorized tenant and Stripe test credentials (consult team vault; never store in git).
9. **Verify Foundation**:
   ```bash
   npm run typecheck && npm run lint
   ```
