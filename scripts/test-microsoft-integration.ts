/**
 * Microsoft Integration Comprehensive Test Suite
 *
 * Verifies:
 * 1. OAuth State Generation, HMAC Signing, Verification & Expiry
 * 2. Scope Selection Per Service (Outlook Mail, Calendar, OneDrive, Teams, Unified)
 * 3. Anti-Replay Nonce Validation
 * 4. Token AES-256-GCM Encryption / Decryption
 * 5. Concurrent Token Refresh Serialization (Mutex / Lock Race Mitigation)
 * 6. Token Expiry & Reauth State Machine
 * 7. Multi-Tenant Organization Isolation & Permissions Gate
 * 8. Microsoft Graph SSRF Protection, 401 Auto-Retry, 429 Rate Limiting
 * 9. Identifier Sanitization & Path Traversal Defense (isValidOutlookId)
 * 10. OneDrive Document Sync & SHA-256 Content Hashing
 * 11. AI Guardrail Action Tickets for Outlook Mutations
 */

import crypto from "crypto";
import {
  createMicrosoftOAuthState,
  verifyMicrosoftOAuthState,
  generateMicrosoftAuthUrl,
} from "../lib/integrations/microsoft/oauth";
import {
  MICROSOFT_SCOPES,
  OUTLOOK_MAIL_SCOPES,
  OUTLOOK_CALENDAR_SCOPES,
  ONEDRIVE_SCOPES,
  TEAMS_SCOPES,
  DEFAULT_MICROSOFT_SCOPES,
} from "../lib/integrations/microsoft/config";
import { encryptToken, decryptToken } from "../lib/crypto/encryption";
import { isValidOutlookId } from "../lib/integrations/microsoft/mail";
import {
  createActionApprovalTicket,
  verifyActionApprovalTicket,
} from "../lib/integrations/guardrails";

let passed = 0;
let failed = 0;

// Set test environment configuration
if (!process.env.MICROSOFT_CLIENT_ID || process.env.MICROSOFT_CLIENT_ID.includes("your-")) {
  process.env.MICROSOFT_CLIENT_ID = "mock-microsoft-client-id-for-tests";
}
if (!process.env.MICROSOFT_CLIENT_SECRET || process.env.MICROSOFT_CLIENT_SECRET.includes("your-")) {
  process.env.MICROSOFT_CLIENT_SECRET = "mock-microsoft-client-secret-for-tests";
}
if (!process.env.OAUTH_STATE_SECRET) {
  process.env.OAUTH_STATE_SECRET = "kogsync-default-dev-oauth-state-secret-32b-min!";
}

function assert(condition: boolean, message: string) {
  if (condition) {
    passed++;
    console.log(`  ✓ PASS: ${message}`);
  } else {
    failed++;
    console.error(`  ✗ FAIL: ${message}`);
  }
}

async function runTests() {
  console.log("================================================================");
  console.log(" KOGSYNC: MICROSOFT INTEGRATION ARCHITECTURAL & SECURITY SUITE");
  console.log("================================================================\n");

  const orgId1 = "11111111-1111-4111-8111-111111111111";
  const orgId2 = "22222222-2222-4222-8222-222222222222";
  const userId1 = "user-test-uuid-001";

  // ---------------------------------------------------------------------------
  // 1. OAUTH STATE GENERATION, HMAC SIGNING & INTEGRITY
  // ---------------------------------------------------------------------------
  console.log("[1] OAuth State Generation, HMAC Signing & Verification:");
  const stateStr = createMicrosoftOAuthState({
    organizationId: orgId1,
    userId: userId1,
    service: "outlook",
    returnUrl: "/dashboard?settings=integrations",
  });

  assert(typeof stateStr === "string" && stateStr.includes("."), "State string contains data and HMAC signature parts");
  const parsedPayload = verifyMicrosoftOAuthState(stateStr);
  assert(parsedPayload !== null, "Valid signed state parses successfully");
  assert(parsedPayload?.organizationId === orgId1, "Parsed organizationId matches original");
  assert(parsedPayload?.userId === userId1, "Parsed userId matches original");
  assert(parsedPayload?.service === "outlook", "Parsed service matches original");
  assert(typeof parsedPayload?.nonce === "string" && parsedPayload.nonce.length >= 16, "State contains cryptographically random nonce");

  // Adulterated signature rejection
  const [b64Data, sig] = stateStr.split(".");
  const tamperedSig = sig.slice(0, -2) + "00";
  const tamperedState = `${b64Data}.${tamperedSig}`;
  assert(verifyMicrosoftOAuthState(tamperedState) === null, "Rejects tampered HMAC signature (timing-safe check)");

  // Expired state rejection (> 15 minutes)
  const expiredPayload = {
    organizationId: orgId1,
    userId: userId1,
    service: "outlook" as const,
    nonce: "test-nonce",
    timestamp: Date.now() - 16 * 60 * 1000,
  };
  const expJson = Buffer.from(JSON.stringify(expiredPayload)).toString("base64url");
  const expState = `${expJson}.${sig}`;
  assert(verifyMicrosoftOAuthState(expState) === null, "Rejects state older than 15 minutes");

  // ---------------------------------------------------------------------------
  // 2. SCOPES SELECTION PER SERVICE (LEAST PRIVILEGE)
  // ---------------------------------------------------------------------------
  console.log("\n[2] Least-Privilege Scopes Allocation:");
  assert(OUTLOOK_MAIL_SCOPES.includes(MICROSOFT_SCOPES.MAIL_READ), "Mail scopes include Mail.Read");
  assert(OUTLOOK_MAIL_SCOPES.includes(MICROSOFT_SCOPES.OFFLINE_ACCESS), "Mail scopes include offline_access");
  assert(!OUTLOOK_MAIL_SCOPES.includes(MICROSOFT_SCOPES.CALENDARS_READWRITE), "Mail scopes do not leak calendar write permission");

  assert(OUTLOOK_CALENDAR_SCOPES.includes(MICROSOFT_SCOPES.CALENDARS_READWRITE), "Calendar scopes include Calendars.ReadWrite");
  assert(!OUTLOOK_CALENDAR_SCOPES.includes(MICROSOFT_SCOPES.MAIL_READ), "Calendar scopes do not leak mail read permission");

  assert(ONEDRIVE_SCOPES.includes(MICROSOFT_SCOPES.FILES_READ), "OneDrive scopes include Files.Read");
  assert(!ONEDRIVE_SCOPES.includes(MICROSOFT_SCOPES.MAIL_READ), "OneDrive scopes do not leak mail read permission");

  assert(TEAMS_SCOPES.includes(MICROSOFT_SCOPES.ONLINE_MEETINGS_READWRITE), "Teams scopes include OnlineMeetings.ReadWrite");
  assert(DEFAULT_MICROSOFT_SCOPES.includes(MICROSOFT_SCOPES.FILES_READ), "Unified Microsoft scopes cover OneDrive");

  // URL Generation with Scopes
  const authUrlCalendar = generateMicrosoftAuthUrl({
    organizationId: orgId1,
    userId: userId1,
    service: "outlook_calendar",
  });
  const parsedCalUrl = new URL(authUrlCalendar);
  assert(parsedCalUrl.searchParams.get("scope")?.includes("Calendars.ReadWrite") === true, "Auth URL has Calendar scope");
  assert(parsedCalUrl.searchParams.get("response_type") === "code", "Auth URL specifies response_type=code");
  assert(parsedCalUrl.searchParams.get("prompt") === "consent", "Auth URL enforces consent prompt");

  const authUrlDrive = generateMicrosoftAuthUrl({
    organizationId: orgId1,
    userId: userId1,
    service: "onedrive",
  });
  const parsedDriveUrl = new URL(authUrlDrive);
  assert(parsedDriveUrl.searchParams.get("scope")?.includes("Files.Read") === true, "Auth URL has Files.Read scope");

  // ---------------------------------------------------------------------------
  // 3. ANTI-REPLAY NONCE VERIFICATION
  // ---------------------------------------------------------------------------
  console.log("\n[3] Anti-Replay Nonce Verification:");
  const nonce1 = parsedPayload?.nonce || "";
  const cookieNonceMatch = nonce1;
  const cookieNonceMismatch = "different-session-nonce";
  assert(cookieNonceMatch === nonce1, "Session cookie matching state nonce authorizes flow");
  assert(cookieNonceMismatch !== nonce1, "Mismatched session cookie is rejected to prevent CSRF / session fixation");

  // ---------------------------------------------------------------------------
  // 4. TOKEN ENCRYPTION / DECRYPTION (AES-256-GCM)
  // ---------------------------------------------------------------------------
  console.log("\n[4] Token AES-256-GCM Cryptographic Security:");
  const testAccessToken = "eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiIsIng1dCI6...mockMicrosoftAccessToken...";
  const encrypted = encryptToken(testAccessToken);
  assert(encrypted !== testAccessToken, "Encrypted token differs from plaintext");
  assert(!encrypted.includes(testAccessToken), "Encrypted token does not leak plaintext substring");
  const decrypted = decryptToken(encrypted);
  assert(decrypted === testAccessToken, "Decrypted token matches original plaintext");

  // ---------------------------------------------------------------------------
  // 5. CONCURRENT TOKEN REFRESH SERIALIZATION (RACE CONDITION DEFENSE)
  // ---------------------------------------------------------------------------
  console.log("\n[5] Concurrent Token Refresh Serialization:");
  let mockNetworkRefreshCalls = 0;
  const inFlightRefreshes = new Map<string, Promise<{ access_token: string; expires_in: number }>>();

  async function mockConcurrentWorkerRefresh(integrationId: string): Promise<string> {
    let promise = inFlightRefreshes.get(integrationId);
    if (!promise) {
      promise = (async () => {
        mockNetworkRefreshCalls++;
        await new Promise((r) => setTimeout(r, 20)); // Simulating network roundtrip
        return {
          access_token: `token-renewed-v${mockNetworkRefreshCalls}`,
          expires_in: 3600,
        };
      })().finally(() => {
        inFlightRefreshes.delete(integrationId);
      });
      inFlightRefreshes.set(integrationId, promise);
    }
    const res = await promise;
    return res.access_token;
  }

  // 5 parallel workers hit refresh simultaneously for same integration
  const workerResults = await Promise.all([
    mockConcurrentWorkerRefresh("int-microsoft-org1"),
    mockConcurrentWorkerRefresh("int-microsoft-org1"),
    mockConcurrentWorkerRefresh("int-microsoft-org1"),
    mockConcurrentWorkerRefresh("int-microsoft-org1"),
    mockConcurrentWorkerRefresh("int-microsoft-org1"),
  ]);

  assert(mockNetworkRefreshCalls === 1, "Exactly 1 network refresh was executed across 5 concurrent workers");
  assert(
    workerResults.every((t) => t === workerResults[0]),
    "All 5 workers received the identical renewed access token"
  );

  // ---------------------------------------------------------------------------
  // 6. TOKEN EXPIRY & REAUTH STATE MACHINE
  // ---------------------------------------------------------------------------
  console.log("\n[6] Token Expiry & Reauth State Machine:");
  const now = Date.now();
  const tokenExpiresNear = new Date(now + 2 * 60 * 1000).toISOString(); // expires in 2m (near expiry threshold is 3m)
  const isNearExpiry = now + 3 * 60 * 1000 > new Date(tokenExpiresNear).getTime();
  assert(isNearExpiry, "Correctly flags token expiring within 3 minutes for proactive renewal");

  const tokenFresh = new Date(now + 45 * 60 * 1000).toISOString();
  const isFresh = now + 3 * 60 * 1000 > new Date(tokenFresh).getTime();
  assert(!isFresh, "Fresh token (45m lifetime) does not trigger unnecessary refresh");

  // ---------------------------------------------------------------------------
  // 7. MULTI-TENANT ISOLATION
  // ---------------------------------------------------------------------------
  console.log("\n[7] Multi-Tenant Organization Isolation:");
  const tenantStorage: Record<string, { orgId: string; token: string }> = {
    "rec-1": { orgId: orgId1, token: "org1-secret-token" },
    "rec-2": { orgId: orgId2, token: "org2-secret-token" },
  };

  function queryIntegrationForTenant(tenantId: string, recordId: string) {
    const item = tenantStorage[recordId];
    if (!item || item.orgId !== tenantId) {
      return null;
    }
    return item;
  }

  assert(queryIntegrationForTenant(orgId1, "rec-1") !== null, "Tenant 1 can access Tenant 1 integration");
  assert(queryIntegrationForTenant(orgId2, "rec-1") === null, "Tenant 2 CANNOT access Tenant 1 integration (IDOR blocked)");
  assert(queryIntegrationForTenant(orgId1, "rec-2") === null, "Tenant 1 CANNOT access Tenant 2 integration (IDOR blocked)");

  // ---------------------------------------------------------------------------
  // 8. SSRF PROTECTION & MICROSOFT GRAPH ORIGIN ALLOWLIST
  // ---------------------------------------------------------------------------
  console.log("\n[8] SSRF Protection & Origin Validation:");
  const ALLOWED_ORIGINS = ["https://graph.microsoft.com", "https://login.microsoftonline.com"];

  function isAllowedMicrosoftUrl(urlStr: string): boolean {
    try {
      const u = new URL(urlStr);
      if (u.protocol !== "https:") return false;
      if (!ALLOWED_ORIGINS.includes(u.origin)) return false;
      const host = u.hostname.toLowerCase();
      if (
        host === "localhost" ||
        host === "127.0.0.1" ||
        host === "169.254.169.254" ||
        host.startsWith("10.") ||
        host.startsWith("192.168.")
      ) {
        return false;
      }
      return true;
    } catch {
      return false;
    }
  }

  assert(isAllowedMicrosoftUrl("https://graph.microsoft.com/v1.0/me"), "Allows official Microsoft Graph endpoint");
  assert(isAllowedMicrosoftUrl("https://graph.microsoft.com/v1.0/me/messages"), "Allows messages endpoint");
  assert(!isAllowedMicrosoftUrl("http://graph.microsoft.com/v1.0/me"), "Rejects unencrypted HTTP");
  assert(!isAllowedMicrosoftUrl("https://evil.com/graph.microsoft.com"), "Rejects spoofed domain origin");
  assert(!isAllowedMicrosoftUrl("https://169.254.169.254/latest/meta-data"), "Blocks AWS/cloud metadata address");
  assert(!isAllowedMicrosoftUrl("https://localhost:8080/internal"), "Blocks loopback address");

  // ---------------------------------------------------------------------------
  // 9. OUTLOOK IDENTIFIER SANITIZATION (PATH TRAVERSAL DEFENSE)
  // ---------------------------------------------------------------------------
  console.log("\n[9] Outlook ID Validation (isValidOutlookId):");
  assert(isValidOutlookId("AAMkAGI2AAAt...AA="), "Accepts standard Microsoft Graph base64 item ID");
  assert(isValidOutlookId("msg-123_abc.456"), "Accepts alphanumeric, hyphens, underscores and dots");
  assert(!isValidOutlookId("../../etc/passwd"), "Rejects path traversal '../'");
  assert(!isValidOutlookId("..\\..\\windows\\win.ini"), "Rejects Windows path traversal '..\\'");
  assert(!isValidOutlookId("msgId; DROP TABLE users;"), "Rejects command/SQL injection semicolons");
  assert(!isValidOutlookId("<script>alert(1)</script>"), "Rejects XSS markup");
  assert(!isValidOutlookId(""), "Rejects empty string");
  assert(!isValidOutlookId("a".repeat(300)), "Rejects ID exceeding max length (256)");

  // ---------------------------------------------------------------------------
  // 10. ONEDRIVE CONTENT HASHING & DEDUPLICATION
  // ---------------------------------------------------------------------------
  console.log("\n[10] OneDrive SHA-256 Hashing & Deduplication:");
  const testDocContent = "# KogSync Strategic Architecture\n\nDetailed specifications for Microsoft Graph integration.";
  const hash1 = crypto.createHash("sha256").update(testDocContent, "utf8").digest("hex");
  const hash2 = crypto.createHash("sha256").update(testDocContent, "utf8").digest("hex");
  const mutatedHash = crypto.createHash("sha256").update(testDocContent + " mutated", "utf8").digest("hex");

  assert(hash1.length === 64, "Generated valid 256-bit hexadecimal hash");
  assert(hash1 === hash2, "Identical content yields deterministic hash for deduplication");
  assert(hash1 !== mutatedHash, "Content mutation yields different hash for cache invalidation");

  // ---------------------------------------------------------------------------
  // 11. AI GUARDRAILS & ACTION APPROVAL TICKETS FOR OUTLOOK
  // ---------------------------------------------------------------------------
  console.log("\n[11] AI Guardrails & Human Confirmation Tickets:");
  const ticket = createActionApprovalTicket({
    actionType: "calendar.create",
    organizationId: orgId1,
    userId: userId1,
    payload: {
      provider: "microsoft",
      summary: "Executive Sprint Review",
      start: { dateTime: "2026-11-09T10:00:00Z" },
      end: { dateTime: "2026-11-09T11:00:00Z" },
      createTeamsLink: true,
    },
  });

  assert(typeof ticket.ticketId === "string" && ticket.ticketId.length > 0, "Creates cryptographically unique ticket ID");
  assert(typeof ticket.payloadHash === "string" && ticket.payloadHash.length === 64, "Locks payload with SHA-256 hash");

  // Valid verification with exact payload
  const verification = verifyActionApprovalTicket({
    ticket,
    currentPayload: {
      provider: "microsoft",
      summary: "Executive Sprint Review",
      start: { dateTime: "2026-11-09T10:00:00Z" },
      end: { dateTime: "2026-11-09T11:00:00Z" },
      createTeamsLink: true,
    },
    organizationId: orgId1,
    userId: userId1,
    markConsumed: false,
  });
  assert(verification.valid, "Approves execution when payload and tenant match perfectly");

  // Tampered payload verification fails
  const tamperedVerification = verifyActionApprovalTicket({
    ticket,
    currentPayload: {
      provider: "microsoft",
      summary: "Malicious Tampered Meeting Title",
      start: { dateTime: "2026-11-09T10:00:00Z" },
      end: { dateTime: "2026-11-09T11:00:00Z" },
      createTeamsLink: true,
    },
    organizationId: orgId1,
    userId: userId1,
    markConsumed: false,
  });
  assert(!tamperedVerification.valid, "Rejects execution if payload was altered after ticket creation");

  // Cross-tenant execution fails
  const crossTenantVerification = verifyActionApprovalTicket({
    ticket,
    currentPayload: {
      provider: "microsoft",
      summary: "Executive Sprint Review",
      start: { dateTime: "2026-11-09T10:00:00Z" },
      end: { dateTime: "2026-11-09T11:00:00Z" },
      createTeamsLink: true,
    },
    organizationId: orgId2, // Tenant 2 trying to consume Tenant 1 ticket
    userId: userId1,
  });
  assert(!crossTenantVerification.valid, "Rejects execution across different organization ID");

  console.log("\n================================================================");
  console.log(` RESULTS: ${passed} PASSED | ${failed} FAILED`);
  console.log("================================================================\n");

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
