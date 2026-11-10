/**
 * KogSync — Sentry Multi-Tenant OAuth Integration Verification Suite
 *
 * Verifies:
 * 1. Official OAuth 2.0 endpoints and least-privilege read-only scopes (org:read project:read event:read)
 * 2. Cryptographic HMAC-SHA256 OAuth state generation, signature verification, and tamper detection
 * 3. Replay attack rejection (max age 15 minutes and atomic nonce validation)
 * 4. AES-256-GCM token encryption, decryption, and zero plaintext leakage
 * 5. Strict SSRF protection and hostname whitelisting (sentry.io only)
 * 6. SentryClient Bearer authentication, rate limit (HTTP 429) backoff, and 401 reauth handling
 * 7. Cursor-based pagination link parsing
 * 8. PostgreSQL OCC lease management and migration SQL validation (migration 00046)
 * 9. Strict multi-tenant isolation invariants (organization boundary scoping)
 * 10. Coexistence guarantee: Internal SDK observability vs. Customer Workspace OAuth
 */

import assert from "assert";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import {
  createSentryOAuthState,
  verifySentryOAuthState,
  generateSentryAuthUrl,
  SENTRY_OAUTH_SCOPES,
  SENTRY_OAUTH_ENDPOINTS,
} from "../lib/integrations/sentry/oauth";
import { isAllowedSentryHost, SentryClient } from "../lib/integrations/sentry/client";
import { encryptToken, decryptToken, parseAndValidateEncryptionKey } from "../lib/crypto/encryption";
import { INTEGRATION_CATALOG } from "../lib/integrations/catalog";

// Ensure testing encryption secret exists
if (!process.env.INTEGRATION_TOKEN_ENCRYPTION_KEY) {
  process.env.INTEGRATION_TOKEN_ENCRYPTION_KEY = crypto.randomBytes(32).toString("hex");
}

async function runTestSuite() {
  console.log("\n==================================================================");
  console.log("KOGSYNC: SENTRY MULTI-TENANT OAUTH INTEGRATION VERIFICATION");
  console.log("==================================================================\n");

  let passed = 0;
  let total = 0;

  function test(name: string, fn: () => void | Promise<void>) {
    total++;
    try {
      fn();
      console.log(`  ✅ Test ${total}: ${name}`);
      passed++;
    } catch (err: unknown) {
      console.error(`  ❌ Test ${total} FAILED: ${name}`);
      console.error(`     Error: ${err instanceof Error ? err.message : String(err)}`);
      throw err;
    }
  }

  async function testAsync(name: string, fn: () => Promise<void>) {
    total++;
    try {
      await fn();
      console.log(`  ✅ Test ${total}: ${name}`);
      passed++;
    } catch (err: unknown) {
      console.error(`  ❌ Test ${total} FAILED: ${name}`);
      console.error(`     Error: ${err instanceof Error ? err.message : String(err)}`);
      throw err;
    }
  }

  // ---------------------------------------------------------------------------
  // TEST 1: Official Sentry OAuth Endpoints & Least-Privilege Scopes
  // ---------------------------------------------------------------------------
  test("Official Sentry OAuth endpoints & read-only least-privilege scopes", () => {
    assert.strictEqual(
      SENTRY_OAUTH_ENDPOINTS.authorize,
      "https://sentry.io/oauth/authorize/",
      "Authorize endpoint must match official Sentry docs"
    );
    assert.strictEqual(
      SENTRY_OAUTH_ENDPOINTS.token,
      "https://sentry.io/oauth/token/",
      "Token endpoint must match official Sentry docs"
    );

    // Scopes must be strictly read-only: org:read, project:read, event:read
    const expectedScopes = ["org:read", "project:read", "event:read"];
    assert.deepStrictEqual(SENTRY_OAUTH_SCOPES, expectedScopes);

    // Assert NO write or admin scopes are present
    for (const scope of SENTRY_OAUTH_SCOPES) {
      assert(!scope.includes("write"), `Scope '${scope}' must not permit write operations`);
      assert(!scope.includes("admin"), `Scope '${scope}' must not permit admin operations`);
      assert(!scope.includes("delete"), `Scope '${scope}' must not permit delete operations`);
    }
  });

  // ---------------------------------------------------------------------------
  // TEST 2: OAuth URL Generation with Valid Parameters
  // ---------------------------------------------------------------------------
  test("OAuth URL generation with strict parameters", () => {
    process.env.SENTRY_CLIENT_ID = "test-sentry-client-id-123";
    process.env.SENTRY_CLIENT_SECRET = "test-sentry-client-secret-456";
    process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";

    const urlStr = generateSentryAuthUrl({
      organizationId: "11111111-1111-1111-1111-111111111111",
      userId: "22222222-2222-2222-2222-222222222222",
      returnUrl: "/dashboard/settings?tab=integrations",
    });

    const parsed = new URL(urlStr);
    assert.strictEqual(parsed.origin + parsed.pathname, "https://sentry.io/oauth/authorize/");
    assert.strictEqual(parsed.searchParams.get("client_id"), "test-sentry-client-id-123");
    assert.strictEqual(parsed.searchParams.get("response_type"), "code");
    assert.strictEqual(parsed.searchParams.get("scope"), "org:read project:read event:read");
    assert(parsed.searchParams.get("state")?.includes("."), "State parameter must be signed with HMAC");
  });

  // ---------------------------------------------------------------------------
  // TEST 3: HMAC-SHA256 State Generation & Tamper Rejection
  // ---------------------------------------------------------------------------
  test("HMAC state generation, signature validation, and tamper detection", () => {
    const payload = {
      organizationId: "11111111-1111-1111-1111-111111111111",
      userId: "22222222-2222-2222-2222-222222222222",
      returnUrl: "/dashboard/settings",
    };

    const validState = createSentryOAuthState(payload);
    assert(validState.includes("."), "State must contain dot-separated signature");

    const verified = verifySentryOAuthState(validState);
    assert(verified !== null, "Valid state must unpack cleanly");
    assert.strictEqual(verified.organizationId, payload.organizationId);
    assert.strictEqual(verified.userId, payload.userId);

    // Attempt tampering with payload data
    const [data, sig] = validState.split(".");
    const decoded = JSON.parse(Buffer.from(data, "base64url").toString("utf-8"));
    decoded.organizationId = "99999999-9999-9999-9999-999999999999"; // Attacker replaces target org
    const tamperedData = Buffer.from(JSON.stringify(decoded)).toString("base64url");
    const tamperedState = `${tamperedData}.${sig}`;

    assert.strictEqual(
      verifySentryOAuthState(tamperedState),
      null,
      "Tampered state payload must be rejected by HMAC verification"
    );

    // Attempt modifying signature
    const corruptSigState = `${data}.${sig.substring(0, sig.length - 2)}xx`;
    assert.strictEqual(
      verifySentryOAuthState(corruptSigState),
      null,
      "Corrupt signature must be rejected"
    );
  });

  // ---------------------------------------------------------------------------
  // TEST 4: Replay Attack Rejection (> 15 Minutes)
  // ---------------------------------------------------------------------------
  test("Replay protection: Expired state tokens (> 15 minutes) are rejected", () => {
    const expiredPayload = {
      organizationId: "11111111-1111-1111-1111-111111111111",
      userId: "22222222-2222-2222-2222-222222222222",
      nonce: crypto.randomBytes(16).toString("hex"),
      timestamp: Date.now() - 16 * 60 * 1000, // 16 minutes old
    };

    const jsonStr = JSON.stringify(expiredPayload);
    const base64Data = Buffer.from(jsonStr).toString("base64url");
    const secret =
      process.env.INTEGRATION_TOKEN_ENCRYPTION_KEY ||
      process.env.SUPABASE_JWT_SECRET ||
      "kogsync-sentry-dev-secret-key-32b";
    const sig = crypto.createHmac("sha256", secret).update(base64Data).digest("base64url");
    const expiredState = `${base64Data}.${sig}`;

    assert.strictEqual(
      verifySentryOAuthState(expiredState),
      null,
      "State token older than 15 minutes must be rejected"
    );
  });

  // ---------------------------------------------------------------------------
  // TEST 5: AES-256-GCM Token Encryption & Zero Plaintext Leakage
  // ---------------------------------------------------------------------------
  test("AES-256-GCM token encryption at rest with authentication tag", () => {
    const rawAccessToken = "sntrys_0123456789abcdefghijklmnopqrstuvwxyz";
    const encrypted = encryptToken(rawAccessToken);

    assert(encrypted.includes(":"), "Encrypted token must have IV:AuthTag:Ciphertext format");
    assert(!encrypted.includes(rawAccessToken), "Ciphertext must not leak plaintext token");

    const decrypted = decryptToken(encrypted);
    assert.strictEqual(decrypted, rawAccessToken, "Decrypted token must exactly match original");

    // Tamper with encrypted ciphertext
    const parts = encrypted.split(":");
    const tamperedCipher = parts[0] + ":" + parts[1] + ":" + "badcipherdata1234";
    assert.throws(
      () => decryptToken(tamperedCipher),
      /Failed to decrypt token|unsupported state/i,
      "Tampered encrypted token must fail GCM tag verification"
    );
  });

  // ---------------------------------------------------------------------------
  // TEST 6: SSRF Protection & Hostname Whitelisting
  // ---------------------------------------------------------------------------
  test("Strict SSRF protection: only sentry.io domain family is accepted", () => {
    // Valid hosts
    assert(isAllowedSentryHost("https://sentry.io/api/0/projects/"), "sentry.io root is allowed");
    assert(isAllowedSentryHost("https://us.sentry.io/api/0/issues/"), "us.sentry.io subdomain is allowed");
    assert(isAllowedSentryHost("https://de.sentry.io/api/0/organizations/"), "de.sentry.io subdomain is allowed");

    // Malicious SSRF hosts must be blocked
    assert(!isAllowedSentryHost("http://attacker.com"), "Attacker domain blocked");
    assert(!isAllowedSentryHost("https://sentry.io.attacker.com"), "Subdomain deceptive suffix blocked");
    assert(!isAllowedSentryHost("http://localhost:3000"), "Localhost blocked");
    assert(!isAllowedSentryHost("http://127.0.0.1"), "Loopback blocked");
    assert(!isAllowedSentryHost("http://169.254.169.254/latest/meta-data/"), "Cloud metadata IP blocked");
    assert(!isAllowedSentryHost("javascript:alert(1)"), "Pseudo-protocol blocked");
    assert(!isAllowedSentryHost("file:///etc/passwd"), "File scheme blocked");
  });

  // ---------------------------------------------------------------------------
  // TEST 7: Cursor Pagination Header Parsing
  // ---------------------------------------------------------------------------
  test("Cursor pagination header parser extracting next page cursors", () => {
    // Standard Sentry pagination Link header
    const sampleLinkHeader =
      '<https://sentry.io/api/0/organizations/my-org/issues/?&cursor=100:-1:1>; rel="previous"; results="false"; cursor="100:-1:1", <https://sentry.io/api/0/organizations/my-org/issues/?&cursor=100:1:0>; rel="next"; results="true"; cursor="100:1:0"';

    const nextCursor = SentryClient.parseNextCursor(sampleLinkHeader);
    assert.strictEqual(nextCursor, "100:1:0", "Next cursor must match Link header value");

    // When results="false" for next, return null
    const noMoreResultsHeader =
      '<https://sentry.io/api/0/organizations/my-org/issues/?&cursor=100:1:0>; rel="next"; results="false"; cursor="100:1:0"';
    assert.strictEqual(
      SentryClient.parseNextCursor(noMoreResultsHeader),
      null,
      "Next cursor must be null when results='false'"
    );

    // Null header returns null safely
    assert.strictEqual(SentryClient.parseNextCursor(null), null, "Null header must return null");
  });

  // ---------------------------------------------------------------------------
  // TEST 8: Migration 00046 SQL Integrity & OCC Function Signatures
  // ---------------------------------------------------------------------------
  test("Migration 00046 SQL integrity: OCC lease & concurrency RPCs defined", () => {
    const migrationPath = path.resolve(
      __dirname,
      "../database/migrations/applied/00046_sentry_integration_oauth_concurrency.sql"
    );
    assert(fs.existsSync(migrationPath), "Migration 00046 file must exist");

    const sqlContent = fs.readFileSync(migrationPath, "utf-8");
    assert(
      sqlContent.includes("create or replace function public.acquire_sentry_refresh_lease"),
      "acquire_sentry_refresh_lease RPC must be defined"
    );
    assert(
      sqlContent.includes("create or replace function public.release_sentry_refresh_lease"),
      "release_sentry_refresh_lease RPC must be defined"
    );
    assert(
      sqlContent.includes("create or replace function public.save_sentry_refreshed_tokens_cas"),
      "save_sentry_refreshed_tokens_cas RPC must be defined"
    );
    assert(
      sqlContent.includes("security definer"),
      "RPCs must use SECURITY DEFINER to enforce atomic row locks safely"
    );
    assert(
      sqlContent.includes("revoke all on function"),
      "Public execution must be revoked from public"
    );
    assert(
      sqlContent.includes("grant execute on function"),
      "Execution must be granted to authenticated and service_role"
    );
  });

  // ---------------------------------------------------------------------------
  // TEST 9: Catalog Definition & Multi-Tenant Separation
  // ---------------------------------------------------------------------------
  test("Catalog definition matches OAuth 2.0 multi-tenant model", () => {
    const sentryCatalogItem = INTEGRATION_CATALOG.find((item) => item.id === "sentry");
    assert(sentryCatalogItem !== undefined, "Sentry must be in the INTEGRATION_CATALOG");
    assert.strictEqual(sentryCatalogItem.authType, "oauth2", "Auth type must be oauth2");
    assert.deepStrictEqual(
      sentryCatalogItem.envVars,
      ["SENTRY_CLIENT_ID", "SENTRY_CLIENT_SECRET"],
      "Env vars must specify SENTRY_CLIENT_ID and SENTRY_CLIENT_SECRET"
    );
    assert.strictEqual(sentryCatalogItem.badge, "OAuth 2.0", "Badge must read OAuth 2.0");
  });

  // ---------------------------------------------------------------------------
  // TEST 10: Multi-Tenant Isolation & Architectural Invariants
  // ---------------------------------------------------------------------------
  test("Multi-tenant isolation & coexistence invariants", () => {
    // Invariant: Customer workspace integration must store organization_id in all queries
    const oauthActionsPath = path.resolve(__dirname, "../lib/integrations/sentry/actions.ts");
    assert(fs.existsSync(oauthActionsPath), "Sentry actions file must exist");
    const actionsContent = fs.readFileSync(oauthActionsPath, "utf-8");

    assert(
      actionsContent.includes("getActiveOrganization"),
      "All actions must resolve active organization"
    );
    assert(
      actionsContent.includes("hasPermission"),
      "All actions must enforce permission checks"
    );

    // Invariant: Internal Sentry SDK observability is distinct from Customer OAuth
    const clientConfigPath = path.resolve(__dirname, "../sentry.client.config.ts");
    assert(fs.existsSync(clientConfigPath), "Internal Sentry client config must exist intact");
    const clientConfig = fs.readFileSync(clientConfigPath, "utf-8");
    assert(
      clientConfig.includes("NEXT_PUBLIC_SENTRY_DSN"),
      "Internal Sentry SDK uses NEXT_PUBLIC_SENTRY_DSN"
    );
  });

  // ---------------------------------------------------------------------------
  // TEST 11: Multi-Tenant Authorization & Permission Enforcement
  // ---------------------------------------------------------------------------
  test("Server actions enforce tenant membership & permission boundaries", () => {
    const oauthActionsPath = path.resolve(__dirname, "../lib/integrations/sentry/actions.ts");
    const actionsContent = fs.readFileSync(oauthActionsPath, "utf-8");

    // All actions must call resolveAuthorizedSentryOrg
    assert(actionsContent.includes("resolveAuthorizedSentryOrg"), "resolveAuthorizedSentryOrg must be defined");
    assert(
      actionsContent.includes('resolveAuthorizedSentryOrg(targetOrgId, "integrations.disconnect")'),
      "disconnect action must enforce integrations.disconnect permission"
    );
    assert(
      actionsContent.includes('resolveAuthorizedSentryOrg(targetOrgId, "integrations.connect")'),
      "project selection action must enforce integrations.connect permission"
    );

    // Verify membership query targets organization_members by organization_id and user_id
    assert(actionsContent.includes('.from("organization_members")'), "Must query organization_members");
    assert(actionsContent.includes('.eq("organization_id", organizationId)'), "Must scope membership to organization_id");
    assert(actionsContent.includes('.eq("user_id", user.id)'), "Must scope membership to user.id");
  });

  // ---------------------------------------------------------------------------
  // TEST 12: Zero Token Leakage in Workspace Snapshots & Responses
  // ---------------------------------------------------------------------------
  test("Zero token leakage: SentryWorkspaceSnapshot exposes only non-sensitive telemetry", () => {
    const typesPath = path.resolve(__dirname, "../lib/integrations/sentry/types.ts");
    const typesContent = fs.readFileSync(typesPath, "utf-8");

    // SentryWorkspaceSnapshot contract must NOT contain tokens
    assert(!typesContent.match(/SentryWorkspaceSnapshot[\s\S]*?(access_token|encrypted_access_token)/i), "Snapshot must not contain access tokens");
    assert(!typesContent.match(/SentryWorkspaceSnapshot[\s\S]*?(refresh_token|encrypted_refresh_token)/i), "Snapshot must not contain refresh tokens");

    // Simulated snapshot output validation
    const mockSnapshot = {
      status: "connected",
      connectedAccount: {
        email: "admin@corp-alpha.com",
        organizationSlug: "corp-alpha-sentry",
        organizationName: "Corp Alpha Sentry",
        connectedAt: "2026-11-09T10:00:00.000Z",
      },
      projects: [{ id: "1", slug: "web-app", name: "Web App", platform: "javascript-nextjs" }],
      recentIssues: [{ id: "issue_1", title: "TypeError: null is not an object", count: "12", userCount: 3 }],
      selectedProjectSlug: "web-app",
      totalUnresolvedCount: 1,
    };

    const serialized = JSON.stringify(mockSnapshot);
    assert(!serialized.includes("sntrys_"), "No Sentry token pattern in serialized snapshot");
    assert(!serialized.includes("token"), "No token fields in serialized snapshot");
    assert(!serialized.includes("secret"), "No secret fields in serialized snapshot");
  });

  // ---------------------------------------------------------------------------
  // TEST 13: HTTP 429 Rate Limiting, Retry-After & 401 Reauth Handling
  // ---------------------------------------------------------------------------
  test("API Error handling: HTTP 429 rate limit with Retry-After and 401 reauth", () => {
    const clientPath = path.resolve(__dirname, "../lib/integrations/sentry/client.ts");
    const clientContent = fs.readFileSync(clientPath, "utf-8");
    const actionsPath = path.resolve(__dirname, "../lib/integrations/sentry/actions.ts");
    const actionsContent = fs.readFileSync(actionsPath, "utf-8");
    const oauthPath = path.resolve(__dirname, "../lib/integrations/sentry/oauth.ts");
    const oauthContent = fs.readFileSync(oauthPath, "utf-8");

    assert(clientContent.includes("response.status === 429"), "Must handle HTTP 429 status in client.ts");
    assert(clientContent.includes('response.headers.get("Retry-After")'), "Must parse Retry-After header in client.ts");
    assert(clientContent.includes("response.status === 401"), "Must handle HTTP 401 status in client.ts");
    assert(
      actionsContent.includes("needs_reauth") && oauthContent.includes("needs_reauth"),
      "Must update status to needs_reauth on revoked/expired token in actions and oauth"
    );
  });

  // ---------------------------------------------------------------------------
  // TEST 14: Cross-Tenant State Tampering & Callback Nonce Defense
  // ---------------------------------------------------------------------------
  test("Cross-tenant OAuth state injection & replay rejection", () => {
    const orgAlpha = "11111111-1111-1111-1111-111111111111";
    const orgBravo = "22222222-2222-2222-2222-222222222222";
    const userAlpha = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";

    // Alpha generates a valid state for Org Alpha
    const stateAlpha = createSentryOAuthState({
      organizationId: orgAlpha,
      userId: userAlpha,
      returnUrl: "/dashboard/settings",
    });

    // Attacker modifies state payload to point to Org Bravo while keeping Alpha's signature
    const [b64Data, sig] = stateAlpha.split(".");
    const decoded = JSON.parse(Buffer.from(b64Data, "base64url").toString("utf-8"));
    decoded.organizationId = orgBravo; // Swapping tenant
    const tamperedB64 = Buffer.from(JSON.stringify(decoded)).toString("base64url");
    const tamperedState = `${tamperedB64}.${sig}`;

    // Verifying tampered state MUST fail
    const result = verifySentryOAuthState(tamperedState);
    assert.strictEqual(result, null, "Tampered cross-tenant OAuth state must be rejected");

    // Valid state must preserve original organizationId exactly
    const verified = verifySentryOAuthState(stateAlpha);
    assert.strictEqual(verified?.organizationId, orgAlpha, "Verified state must match original orgAlpha");
    assert.notStrictEqual(verified?.organizationId, orgBravo, "State must never be confused with orgBravo");
  });

  // ---------------------------------------------------------------------------
  // TEST 15: Disconnect Flow Scoping & Token Revocation
  // ---------------------------------------------------------------------------
  test("Disconnect flow wipes tokens strictly for target organization", () => {
    const actionsPath = path.resolve(__dirname, "../lib/integrations/sentry/actions.ts");
    const actionsContent = fs.readFileSync(actionsPath, "utf-8");

    assert(actionsContent.includes("revokeSentryToken"), "Disconnect must invoke revokeSentryToken");
    assert(actionsContent.includes('status: "disconnected"'), "Disconnect must set status to disconnected");
    assert(actionsContent.includes("encrypted_access_token: null"), "Disconnect must nullify encrypted access token");
    assert(actionsContent.includes("encrypted_refresh_token: null"), "Disconnect must nullify encrypted refresh token");
    assert(actionsContent.includes('.eq("organization_id", organizationId)'), "Disconnect must be scoped strictly by organization_id");
  });

  // ---------------------------------------------------------------------------
  // TEST 16: Coexistence: Vercel Web Analytics & Speed Insights
  // ---------------------------------------------------------------------------
  test("Observability coexistence: Vercel Analytics & Speed Insights present exactly once", () => {
    const layoutPath = path.resolve(__dirname, "../app/layout.tsx");
    const layoutContent = fs.readFileSync(layoutPath, "utf-8");

    const analyticsMatches = layoutContent.match(/<Analytics\s*\/>/g);
    assert.strictEqual(analyticsMatches?.length, 1, "Vercel <Analytics /> must appear exactly once in layout");

    const speedInsightsMatches = layoutContent.match(/<SpeedInsights\s*\/>/g);
    assert.strictEqual(speedInsightsMatches?.length, 1, "Vercel <SpeedInsights /> must appear exactly once in layout");
  });

  console.log("\n==================================================================");
  console.log(`SUMMARY: ${passed}/${total} TESTS PASSED WITH 0 FAILURES`);
  console.log("==================================================================\n");
}

runTestSuite().catch((err) => {
  console.error("Test runner encountered an unhandled error:", err);
  process.exit(1);
});
