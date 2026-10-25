/**
 * Test Suite: Multi-PC Environment & Tooling Policy Engine
 * Validates diagnostic behavior, non-destructive backups, idempotence,
 * prohibited removal, and secret preservation in an isolated sandbox.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import assert from "node:assert";

// Create an isolated sandbox directory
const sandboxDir = path.join(os.tmpdir(), `bb-test-env-policy-${Date.now()}`);
fs.mkdirSync(sandboxDir, { recursive: true });

const mockGemini = path.join(sandboxDir, ".gemini");
const mockConfigDir = path.join(mockGemini, "config");
const mockCliDir = path.join(mockGemini, "antigravity-cli");

fs.mkdirSync(mockConfigDir, { recursive: true });
fs.mkdirSync(mockCliDir, { recursive: true });

// Setup mock files with violations, custom items, and secrets
const initialMcpConfig = {
  mcpServers: {
    "21st": { command: "npx", args: ["21st-mcp"] }, // Prohibited
    "you-com": { command: "npx", args: ["you-mcp"] }, // Prohibited
    stripe: {
      command: "npx",
      args: ["-y", "@stripe/mcp", "--api-key=sk_test_secret_12345"], // Secret to preserve
    },
    "custom-company-tool": { command: "node", args: ["./tool.js"] }, // Custom MCP to preserve
  },
};

const initialConfigJson = {
  plugins: {
    firebase: { enabled: true, version: "1.0.0" }, // Prohibited - must disable
    "android-cli-plugin": { enabled: true }, // Prohibited - must disable
    "gemini-api": { enabled: true, version: "2.3.0" }, // Custom - must preserve
  },
  userSettings: {
    remoteControlHostname: "test-pc-99", // Setting to preserve
    themeMode: "THEME_MODE_DARK",
  },
};

const initialSettingsJson = {
  agentMode: "plan",
  trustedWorkspaces: ["C:\\Workspaces\\ProjectA", "C:\\Workspaces\\BusinessBrain"],
};

const mcpConfigPath = path.join(mockConfigDir, "mcp_config.json");
const configJsonPath = path.join(mockConfigDir, "config.json");
const settingsJsonPath = path.join(mockCliDir, "settings.json");

fs.writeFileSync(mcpConfigPath, JSON.stringify(initialMcpConfig, null, 2), "utf-8");
fs.writeFileSync(configJsonPath, JSON.stringify(initialConfigJson, null, 2), "utf-8");
fs.writeFileSync(settingsJsonPath, JSON.stringify(initialSettingsJson, null, 2), "utf-8");

console.log("==================================================================");
console.log("TEST: Multi-PC Environment Policy Engine Sandbox Verification");
console.log(`Sandbox: ${sandboxDir}`);
console.log("==================================================================");

// We temporarily override USERPROFILE and HOME to point to sandbox
const origUserProfile = process.env.USERPROFILE;
const origHome = process.env.HOME;

process.env.USERPROFILE = sandboxDir;
process.env.HOME = sandboxDir;

try {
  // Import the module dynamically after setting env vars
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { runEnvironmentPolicy } = require("./env-policy");

  // Step 1: Run Diagnostic Mode (Read-Only)
  console.log("\n--> Testing Step 1: Diagnostic Mode (Read-Only)");
  const diagResult = runEnvironmentPolicy(false);

  assert.strictEqual(diagResult.success, true, "Diagnostic run should succeed");
  assert.strictEqual(diagResult.violationsCount, 4, "Should find 4 violations (2 prohibited MCPs + 2 enabled prohibited plugins)");
  assert.strictEqual(diagResult.changesAppliedCount, 0, "Diagnostic mode must NEVER apply changes");

  // Confirm files were completely untouched
  const mcpAfterDiag = JSON.parse(fs.readFileSync(mcpConfigPath, "utf-8"));
  assert.ok(mcpAfterDiag.mcpServers["21st"], "Prohibited 21st must still exist after diagnostic run");
  assert.ok(mcpAfterDiag.mcpServers["you-com"], "Prohibited you-com must still exist after diagnostic run");

  // Step 2: Run Apply Mode
  console.log("\n--> Testing Step 2: Apply Mode (Explicit Mutation with Backups)");
  const applyResult = runEnvironmentPolicy(true);

  assert.strictEqual(applyResult.success, true, "Apply run should succeed");
  assert.ok(applyResult.changesAppliedCount > 0, "Apply run should apply necessary changes");

  // Verify backups exist
  const configBackups = fs.readdirSync(mockConfigDir).filter((f) => f.includes(".bak-"));
  assert.ok(configBackups.length >= 2, "Backups for both config.json and mcp_config.json must be created");

  // Verify mutations
  const mcpAfterApply = JSON.parse(fs.readFileSync(mcpConfigPath, "utf-8"));
  assert.strictEqual(mcpAfterApply.mcpServers["21st"], undefined, "21st must be removed");
  assert.strictEqual(mcpAfterApply.mcpServers["you-com"], undefined, "you-com must be removed");
  assert.ok(mcpAfterApply.mcpServers["supabase"], "Approved supabase must be added");
  assert.ok(mcpAfterApply.mcpServers["shadcn"], "Approved shadcn must be added");
  assert.ok(mcpAfterApply.mcpServers["chrome-devtools"], "Approved chrome-devtools must be added");

  // Verify secret preservation
  assert.strictEqual(
    mcpAfterApply.mcpServers.stripe.args[2],
    "--api-key=sk_test_secret_12345",
    "Existing Stripe API key must remain strictly preserved"
  );
  assert.ok(mcpAfterApply.mcpServers["custom-company-tool"], "Custom company MCP must remain strictly preserved");

  const configAfterApply = JSON.parse(fs.readFileSync(configJsonPath, "utf-8"));
  assert.strictEqual(configAfterApply.plugins.firebase.enabled, false, "firebase plugin must be disabled");
  assert.strictEqual(configAfterApply.plugins["android-cli-plugin"].enabled, false, "android-cli-plugin must be disabled");
  assert.strictEqual(configAfterApply.plugins["gemini-api"].enabled, true, "gemini-api plugin must remain enabled");
  assert.strictEqual(
    configAfterApply.userSettings.remoteControlHostname,
    "test-pc-99",
    "Unrelated userSettings must be preserved"
  );

  // Step 3: Test Idempotence
  console.log("\n--> Testing Step 3: Idempotence (Second Apply Run)");
  const secondApplyResult = runEnvironmentPolicy(true);
  assert.strictEqual(secondApplyResult.success, true, "Second apply run should succeed");
  assert.strictEqual(secondApplyResult.changesProposedCount, 0, "Proposed changes on second run must be 0");
  assert.strictEqual(secondApplyResult.changesAppliedCount, 0, "Applied changes on second run must be 0");

  console.log("\n🎉 ALL SANDBOX VERIFICATIONS PASSED SUCCESSFULLY!");
} finally {
  // Restore environment variables and cleanup sandbox
  process.env.USERPROFILE = origUserProfile;
  process.env.HOME = origHome;
  try {
    fs.rmSync(sandboxDir, { recursive: true, force: true });
  } catch {
    // Ignore cleanup error in tmpdir
  }
}
