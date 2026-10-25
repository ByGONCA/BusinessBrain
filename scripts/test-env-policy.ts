/**
 * Test Suite: Multi-PC Environment & Tooling Policy Engine
 * Validates diagnostic behavior, non-destructive backups, idempotence,
 * prohibited removal/disabling (including google_maps_platform),
 * approved active plugin preservation, and secret safety in an isolated sandbox.
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
    google_maps_platform: { enabled: true, version: "1.0.0" }, // Prohibited - must disable!
    "chrome-devtools-plugin": { enabled: true, version: "0.21.0" }, // Approved - must keep active
    "gemini-api": { enabled: true, version: "2.3.0" }, // Approved - must keep active
    "google-antigravity-sdk": { enabled: true, version: "0.0.9" }, // Approved - must keep active
    "custom-host-plugin": { enabled: true }, // Custom host plugin - must preserve
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
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { runEnvironmentPolicy } = require("./env-policy");

  // Step 1: Run Diagnostic Mode (Read-Only)
  console.log("\n--> Testing Step 1: Diagnostic Mode (Read-Only)");
  const diagResult = runEnvironmentPolicy(false);

  assert.strictEqual(diagResult.success, true, "Diagnostic run should succeed");
  // 2 prohibited MCPs (21st, you-com) + 3 enabled prohibited plugins (firebase, android-cli-plugin, google_maps_platform) = 5 violations
  assert.strictEqual(diagResult.violationsCount, 5, "Should find exactly 5 violations including google_maps_platform");
  assert.strictEqual(diagResult.changesAppliedCount, 0, "Diagnostic mode must NEVER apply changes");

  // Confirm files were completely untouched
  const mcpAfterDiag = JSON.parse(fs.readFileSync(mcpConfigPath, "utf-8"));
  assert.ok(mcpAfterDiag.mcpServers["21st"], "Prohibited 21st must still exist after diagnostic run");
  assert.ok(mcpAfterDiag.mcpServers["you-com"], "Prohibited you-com must still exist after diagnostic run");

  const configAfterDiag = JSON.parse(fs.readFileSync(configJsonPath, "utf-8"));
  assert.strictEqual(configAfterDiag.plugins.google_maps_platform.enabled, true, "google_maps_platform must remain untouched in diagnostic");

  // Step 2: Run Apply Mode
  console.log("\n--> Testing Step 2: Apply Mode (Explicit Mutation with Backups)");
  const applyResult = runEnvironmentPolicy(true);

  assert.strictEqual(applyResult.success, true, "Apply run should succeed");
  assert.ok(applyResult.changesAppliedCount > 0, "Apply run should apply necessary changes");

  // Verify backups exist
  const configBackups = fs.readdirSync(mockConfigDir).filter((f) => f.includes(".bak-"));
  assert.ok(configBackups.length >= 2, "Backups for both config.json and mcp_config.json must be created");

  // Verify MCP mutations
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

  // Verify Plugin mutations
  const configAfterApply = JSON.parse(fs.readFileSync(configJsonPath, "utf-8"));
  assert.strictEqual(configAfterApply.plugins.firebase.enabled, false, "firebase plugin must be disabled");
  assert.strictEqual(configAfterApply.plugins["android-cli-plugin"].enabled, false, "android-cli-plugin must be disabled");
  assert.strictEqual(
    configAfterApply.plugins.google_maps_platform.enabled,
    false,
    "google_maps_platform plugin MUST be explicitly disabled (Priority Point)"
  );

  // Verify approved active plugins preservation
  assert.strictEqual(configAfterApply.plugins["chrome-devtools-plugin"].enabled, true, "chrome-devtools-plugin must remain enabled");
  assert.strictEqual(configAfterApply.plugins["gemini-api"].enabled, true, "gemini-api plugin must remain enabled");
  assert.strictEqual(configAfterApply.plugins["google-antigravity-sdk"].enabled, true, "google-antigravity-sdk must remain enabled");
  assert.strictEqual(configAfterApply.plugins["custom-host-plugin"].enabled, true, "custom host plugin must remain enabled");

  // Verify settings preservation
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

  // Step 4: Test Non-Existent Directory Handling
  console.log("\n--> Testing Step 4: Non-Existent Directory Handling");
  const emptyDir = path.join(os.tmpdir(), `bb-empty-dir-${Date.now()}`);
  fs.mkdirSync(emptyDir, { recursive: true });
  process.env.USERPROFILE = emptyDir;
  process.env.HOME = emptyDir;

  const emptyDirResult = runEnvironmentPolicy(false);
  assert.strictEqual(emptyDirResult.success, true, "Should handle missing .gemini dir safely");
  assert.strictEqual(emptyDirResult.violationsCount, 0, "Should report 0 violations for missing dir");
  try {
    fs.rmSync(emptyDir, { recursive: true, force: true });
  } catch {}

  console.log("\n🎉 ALL SANDBOX VERIFICATIONS PASSED 100% (INCLUDING GOOGLE_MAPS_PLATFORM)!");
} finally {
  // Restore environment variables and cleanup sandbox
  process.env.USERPROFILE = origUserProfile;
  process.env.HOME = origHome;
  try {
    fs.rmSync(sandboxDir, { recursive: true, force: true });
  } catch {}
}
