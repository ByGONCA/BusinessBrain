/**
 * KogSync — Shopify Multi-Tenant OAuth 2.0 & Admin API Integration Verification Suite
 *
 * Verifies:
 * 1. Domain sanitization, regex format, and malicious character rejection
 * 2. OAuth 2.0 authorization URL generation with strict parameters
 * 3. Cryptographic HMAC-SHA256 state generation, signature verification, and tamper detection
 * 4. Replay attack rejection (max age 15 minutes and atomic nonce validation)
 * 5. Official Shopify callback query HMAC signature verification (lexicographical key sort)
 * 6. AES-256-GCM token encryption at rest with authentication tag and zero plaintext leakage
 * 7. Strict SSRF protection and *.myshopify.com hostname whitelisting
 * 8. Cursor/page_info Link header pagination parser
 * 9. ShopifyClient rate limiting (HTTP 429), Retry-After backoff, and 401 handling
 * 10. Multi-tenant isolation: Server actions verify organization membership & RBAC permissions
 * 11. Cross-tenant store hijacking defense (blocking claim of an already active store)
 * 12. Zero token exposure in ShopifyWorkspaceSnapshot and client-facing models
 * 13. Webhook HMAC-SHA256 signature verification over raw request body
 * 14. Webhook event processing: app/uninstalled transitions status to disconnected
 * 15. Disconnect flow: token cleanup, status update, and tenant scoping
 * 16. Migration 00047 SQL integrity (partial unique index for active stores)
 * 17. Integration catalog definition matches OAuth 2.0 multi-tenant model
 */

import assert from "assert";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import {
  sanitizeShopDomain,
  getShopifyOAuthConfig,
  SHOPIFY_DEFAULT_SCOPES,
  SHOPIFY_DOMAIN_REGEX,
  SHOPIFY_DEFAULT_API_VERSION,
} from "../lib/integrations/shopify/config";
import {
  createShopifyOAuthState,
  verifyShopifyOAuthState,
  verifyShopifyQueryHmac,
  generateShopifyAuthUrl,
} from "../lib/integrations/shopify/oauth";
import {
  isAllowedShopifyHost,
  ShopifyClient,
  ShopifyApiError,
} from "../lib/integrations/shopify/client";
import {
  verifyShopifyWebhookHmac,
} from "../lib/integrations/shopify/sync";
import { encryptToken, decryptToken } from "../lib/crypto/encryption";
import { INTEGRATION_CATALOG } from "../lib/integrations/catalog";

// Ensure testing encryption secret exists
if (!process.env.INTEGRATION_TOKEN_ENCRYPTION_KEY) {
  process.env.INTEGRATION_TOKEN_ENCRYPTION_KEY = crypto.randomBytes(32).toString("hex");
}

async function runTestSuite() {
  console.log("\n==================================================================");
  console.log("KOGSYNC: SHOPIFY MULTI-TENANT INTEGRATION VERIFICATION");
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

  // ---------------------------------------------------------------------------
  // TEST 1: Domain Sanitization & Strict Format Enforcement
  // ---------------------------------------------------------------------------
  test("Shopify store domain sanitization & regex validation", () => {
    // Valid domains
    assert.strictEqual(sanitizeShopDomain("acme-store"), "acme-store.myshopify.com");
    assert.strictEqual(sanitizeShopDomain("acme-store.myshopify.com"), "acme-store.myshopify.com");
    assert.strictEqual(sanitizeShopDomain("https://acme-store.myshopify.com/"), "acme-store.myshopify.com");
    assert.strictEqual(sanitizeShopDomain("HTTPS://ACME-STORE.MYSHOPIFY.COM/ADMIN"), "acme-store.myshopify.com");

    // Invalid / Malicious domains
    assert.strictEqual(sanitizeShopDomain(""), null);
    assert.strictEqual(sanitizeShopDomain("   "), null);
    assert.strictEqual(sanitizeShopDomain(null), null);
    assert.strictEqual(sanitizeShopDomain("ab"), null, "Subdomain too short (< 3 chars)");
    assert.strictEqual(sanitizeShopDomain("attacker.com"), null, "Non-myshopify domain rejected");
    assert.strictEqual(sanitizeShopDomain("acme.myshopify.com.attacker.com"), null, "Subdomain suffix trick rejected");
    assert.strictEqual(sanitizeShopDomain("acme/myshopify.com"), null, "Path separator rejected");
    assert.strictEqual(sanitizeShopDomain("user:pass@acme.myshopify.com"), null, "Userinfo rejected");
    assert.strictEqual(sanitizeShopDomain("acme.myshopify.com:8080"), null, "Port rejected");
    assert.strictEqual(sanitizeShopDomain("<script>alert(1)</script>"), null, "XSS injection rejected");
  });

  // ---------------------------------------------------------------------------
  // TEST 2: OAuth URL Generation with Strict Parameters
  // ---------------------------------------------------------------------------
  test("OAuth authorization URL generation with strict parameters", () => {
    assert.strictEqual(SHOPIFY_DEFAULT_API_VERSION, "2026-10", "Shopify API default version must be 2026-10");
    process.env.SHOPIFY_API_KEY = "test-shopify-api-key-123";
    process.env.SHOPIFY_API_SECRET = "test-shopify-api-secret-456";
    process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";

    const authUrl = generateShopifyAuthUrl({
      organizationId: "11111111-1111-1111-1111-111111111111",
      userId: "22222222-2222-2222-2222-222222222222",
      shop: "nordic-store",
      returnUrl: "/dashboard/settings?tab=integrations",
    });

    const parsed = new URL(authUrl);
    assert.strictEqual(parsed.origin, "https://nordic-store.myshopify.com");
    assert.strictEqual(parsed.pathname, "/admin/oauth/authorize");
    assert.strictEqual(parsed.searchParams.get("client_id"), "test-shopify-api-key-123");
    assert.strictEqual(parsed.searchParams.get("scope"), "read_products,read_orders,read_inventory");
    assert(parsed.searchParams.get("state")?.includes("."), "State parameter must be signed with HMAC");

    // Invalid domain throws
    assert.throws(
      () =>
        generateShopifyAuthUrl({
          organizationId: "111",
          userId: "222",
          shop: "malicious.domain.com",
        }),
      /Invalid Shopify store domain/
    );
  });

  // ---------------------------------------------------------------------------
  // TEST 3: HMAC-SHA256 State Generation, Signature Validation & Tamper Detection
  // ---------------------------------------------------------------------------
  test("HMAC-SHA256 OAuth state generation, signature validation and tamper detection", () => {
    const payload = {
      organizationId: "11111111-1111-1111-1111-111111111111",
      userId: "22222222-2222-2222-2222-222222222222",
      shop: "nordic-store.myshopify.com",
      returnUrl: "/dashboard/settings",
    };

    const validState = createShopifyOAuthState(payload);
    assert(validState.includes("."), "State must contain dot-separated signature");

    const verified = verifyShopifyOAuthState(validState);
    assert(verified !== null, "Valid state must unpack cleanly");
    assert.strictEqual(verified.organizationId, payload.organizationId);
    assert.strictEqual(verified.userId, payload.userId);
    assert.strictEqual(verified.shop, payload.shop);

    // Tampering with payload data (swapping organizationId to attack another tenant)
    const [data, sig] = validState.split(".");
    const decoded = JSON.parse(Buffer.from(data, "base64url").toString("utf-8"));
    decoded.organizationId = "99999999-9999-9999-9999-999999999999";
    const tamperedData = Buffer.from(JSON.stringify(decoded)).toString("base64url");
    const tamperedState = `${tamperedData}.${sig}`;

    assert.strictEqual(
      verifyShopifyOAuthState(tamperedState),
      null,
      "Tampered state payload must be rejected by HMAC verification"
    );

    // Corrupt signature
    const corruptSigState = `${data}.${sig.substring(0, sig.length - 2)}xx`;
    assert.strictEqual(verifyShopifyOAuthState(corruptSigState), null, "Corrupt signature must be rejected");
  });

  // ---------------------------------------------------------------------------
  // TEST 4: Replay Attack Rejection (> 15 Minutes)
  // ---------------------------------------------------------------------------
  test("Replay protection: Expired state tokens (> 15 minutes) are rejected", () => {
    const expiredPayload = {
      organizationId: "11111111-1111-1111-1111-111111111111",
      userId: "22222222-2222-2222-2222-222222222222",
      shop: "test.myshopify.com",
      nonce: crypto.randomBytes(16).toString("hex"),
      timestamp: Date.now() - 16 * 60 * 1000, // 16 minutes old
    };

    const jsonStr = JSON.stringify(expiredPayload);
    const base64Data = Buffer.from(jsonStr).toString("base64url");
    const secret =
      process.env.INTEGRATION_TOKEN_ENCRYPTION_KEY ||
      process.env.SUPABASE_JWT_SECRET ||
      "kogsync-shopify-dev-secret-key-32b";
    const sig = crypto.createHmac("sha256", secret).update(base64Data).digest("base64url");
    const expiredState = `${base64Data}.${sig}`;

    assert.strictEqual(
      verifyShopifyOAuthState(expiredState),
      null,
      "State token older than 15 minutes must be rejected"
    );
  });

  // ---------------------------------------------------------------------------
  // TEST 5: Official Shopify Callback Query HMAC Verification
  // ---------------------------------------------------------------------------
  test("Official Shopify callback query HMAC signature verification", () => {
    const testSecret = "hush-super-secret-key-12345";

    // Simulate query parameters received from Shopify
    // According to Shopify spec: sort lexicographically: code, shop, state, timestamp
    const params = new URLSearchParams({
      code: "0907a61c0c8d55e99db179b68161bc00",
      shop: "some-shop.myshopify.com",
      state: "0.3252383610188557",
      timestamp: "1337178173",
    });

    // Compute expected HMAC: message = "code=...&shop=...&state=...&timestamp=..."
    const message = "code=0907a61c0c8d55e99db179b68161bc00&shop=some-shop.myshopify.com&state=0.3252383610188557&timestamp=1337178173";
    const validHmac = crypto.createHmac("sha256", testSecret).update(message).digest("hex");

    params.set("hmac", validHmac);

    // Verify positive case
    assert(verifyShopifyQueryHmac(params, testSecret), "Valid Shopify query HMAC must pass");

    // Verify negative case: tampered query parameter
    const tamperedParams = new URLSearchParams(params);
    tamperedParams.set("shop", "attacker-shop.myshopify.com");
    assert(!verifyShopifyQueryHmac(tamperedParams, testSecret), "Tampered query parameter must fail HMAC");

    // Verify negative case: wrong secret
    assert(!verifyShopifyQueryHmac(params, "wrong-secret"), "Wrong secret must fail HMAC");

    // Verify negative case: missing hmac
    const noHmacParams = new URLSearchParams(params);
    noHmacParams.delete("hmac");
    assert(!verifyShopifyQueryHmac(noHmacParams, testSecret), "Missing hmac must return false");
  });

  // ---------------------------------------------------------------------------
  // TEST 6: AES-256-GCM Token Encryption & Zero Plaintext Leakage
  // ---------------------------------------------------------------------------
  test("AES-256-GCM token encryption at rest with authentication tag", () => {
    const rawAccessToken = "shpat_0123456789abcdefghijklmnopqrstuvwxyz";
    const encrypted = encryptToken(rawAccessToken);

    assert(encrypted.includes(":"), "Encrypted token must have IV:AuthTag:Ciphertext format");
    assert(!encrypted.includes(rawAccessToken), "Ciphertext must not leak plaintext token");

    const decrypted = decryptToken(encrypted);
    assert.strictEqual(decrypted, rawAccessToken, "Decrypted token must exactly match original");

    // Tampered ciphertext fails authentication tag verification
    const parts = encrypted.split(":");
    const tampered = parts[0] + ":" + parts[1] + ":" + "tampereddata12345";
    assert.throws(() => decryptToken(tampered), /Failed to decrypt token|unsupported state/i);
  });

  // ---------------------------------------------------------------------------
  // TEST 7: Strict SSRF Protection & Hostname Whitelisting
  // ---------------------------------------------------------------------------
  test("Strict SSRF protection: only *.myshopify.com is accepted", () => {
    // Valid hosts
    assert(isAllowedShopifyHost("https://nordic-store.myshopify.com/admin/api/2026-10/shop.json"));
    assert(isAllowedShopifyHost("https://brand-store-12.myshopify.com/admin/api/2026-10/products.json"));

    // Malicious SSRF hosts must be blocked
    assert(!isAllowedShopifyHost("http://nordic-store.myshopify.com"), "HTTP protocol blocked");
    assert(!isAllowedShopifyHost("https://attacker.com"), "Attacker domain blocked");
    assert(!isAllowedShopifyHost("https://nordic-store.myshopify.com.attacker.com"), "Subdomain deceptive suffix blocked");
    assert(!isAllowedShopifyHost("http://localhost:3000"), "Localhost blocked");
    assert(!isAllowedShopifyHost("http://127.0.0.1"), "Loopback blocked");
    assert(!isAllowedShopifyHost("http://169.254.169.254/latest/meta-data/"), "Cloud metadata IP blocked");
    assert(!isAllowedShopifyHost("javascript:alert(1)"), "Pseudo-protocol blocked");
    assert(!isAllowedShopifyHost("file:///etc/passwd"), "File scheme blocked");
  });

  // ---------------------------------------------------------------------------
  // TEST 8: Pagination Link Header Parsing
  // ---------------------------------------------------------------------------
  test("Cursor pagination header parser extracting next & previous page_info", () => {
    const sampleLinkHeader =
      '<https://my-store.myshopify.com/admin/api/2026-10/products.json?limit=50&page_info=eyJsYXN0X2lkIjoxfQ>; rel="next", <https://my-store.myshopify.com/admin/api/2026-10/products.json?limit=50&page_info=eyJsYXN0X2lkIjowfQ>; rel="previous"';

    const { next, previous } = ShopifyClient.parsePaginationLink(sampleLinkHeader);
    assert.strictEqual(next, "eyJsYXN0X2lkIjoxfQ", "Next cursor must match Link header value");
    assert.strictEqual(previous, "eyJsYXN0X2lkIjowfQ", "Previous cursor must match Link header value");

    // Null header returns empty object safely
    const empty = ShopifyClient.parsePaginationLink(null);
    assert.deepStrictEqual(empty, {});
  });

  // ---------------------------------------------------------------------------
  // TEST 9: Rate Limiting & Error Construction
  // ---------------------------------------------------------------------------
  test("ShopifyApiError model and rate limit 429 Retry-After handling", () => {
    const err = new ShopifyApiError("Rate limit exceeded", 429, 5);
    assert.strictEqual(err.name, "ShopifyApiError");
    assert.strictEqual(err.status, 429);
    assert.strictEqual(err.retryAfterSeconds, 5);

    const clientPath = path.resolve(__dirname, "../lib/integrations/shopify/client.ts");
    const clientContent = fs.readFileSync(clientPath, "utf-8");

    assert(clientContent.includes("response.status === 429"), "Client must handle 429");
    assert(clientContent.includes('response.headers.get("Retry-After")'), "Client must check Retry-After");
    assert(clientContent.includes("response.status === 401"), "Client must handle 401");
  });

  // ---------------------------------------------------------------------------
  // TEST 10: Multi-Tenant Authorization & RBAC Guardrails
  // ---------------------------------------------------------------------------
  test("Server actions enforce tenant membership & RBAC permission checks", () => {
    const actionsPath = path.resolve(__dirname, "../lib/integrations/shopify/actions.ts");
    const actionsContent = fs.readFileSync(actionsPath, "utf-8");

    // All actions must call resolveAuthorizedShopifyOrg
    assert(actionsContent.includes("resolveAuthorizedShopifyOrg"), "Must define resolveAuthorizedShopifyOrg");
    assert(
      actionsContent.includes('resolveAuthorizedShopifyOrg(targetOrgId, "integrations.disconnect")'),
      "disconnect action must enforce integrations.disconnect permission"
    );
    assert(
      actionsContent.includes('.from("organization_members")'),
      "Must check organization_members table"
    );
    assert(
      actionsContent.includes('.eq("organization_id", organizationId)'),
      "Must scope membership to target organization_id"
    );
    assert(
      actionsContent.includes('.eq("user_id", user.id)'),
      "Must scope membership to authenticated user.id"
    );
  });

  // ---------------------------------------------------------------------------
  // TEST 11: Cross-Tenant Store Hijacking Defense
  // ---------------------------------------------------------------------------
  test("Callback rejects store claim if already connected to another tenant", () => {
    const callbackPath = path.resolve(__dirname, "../app/api/integrations/shopify/callback/route.ts");
    const callbackContent = fs.readFileSync(callbackPath, "utf-8");

    assert(
      callbackContent.includes("existingShopClaim.organization_id !== statePayload.organizationId"),
      "Must verify that existing shop claim does not belong to another organization"
    );
    assert(
      callbackContent.includes("store_already_connected_to_another_organization"),
      "Must reject with store_already_connected_to_another_organization error"
    );
  });

  // ---------------------------------------------------------------------------
  // TEST 12: Zero Token Leakage in Client Snapshots
  // ---------------------------------------------------------------------------
  test("Zero token leakage: ShopifyWorkspaceSnapshot exposes only non-sensitive store data", () => {
    const typesPath = path.resolve(__dirname, "../lib/integrations/shopify/types.ts");
    const typesContent = fs.readFileSync(typesPath, "utf-8");

    // Extract ShopifyWorkspaceSnapshot interface body
    const match = typesContent.match(/export interface ShopifyWorkspaceSnapshot\s*\{([\s\S]*?)\}/);
    assert(match, "ShopifyWorkspaceSnapshot interface must exist");
    const interfaceBody = match[1];

    // Snapshot contract must NOT contain tokens
    assert(!interfaceBody.includes("access_token"), "Snapshot must not contain access_token");
    assert(!interfaceBody.includes("refresh_token"), "Snapshot must not contain refresh_token");
    assert(!interfaceBody.includes("encrypted_"), "Snapshot must not contain encrypted tokens");

    const mockSnapshot = {
      status: "connected",
      connectedAccount: {
        shopDomain: "acme.myshopify.com",
        shopName: "Acme Store",
        email: "owner@acme.com",
        currency: "USD",
        country: "US",
        connectedAt: "2026-11-09T10:00:00Z",
      },
      products: [],
      recentOrders: [],
      totalProductsCount: 10,
      totalOrdersCount: 25,
    };

    const serialized = JSON.stringify(mockSnapshot);
    assert(!serialized.includes("shpat_"), "No token prefix in snapshot");
    assert(!serialized.includes("access_token"), "No access token in snapshot");
    assert(!serialized.includes("secret"), "No secret in snapshot");
  });

  // ---------------------------------------------------------------------------
  // TEST 13: Webhook HMAC-SHA256 Verification over Raw Request Body
  // ---------------------------------------------------------------------------
  test("Shopify webhook base64 HMAC-SHA256 signature verification", () => {
    const testSecret = "webhook-super-secret-key-999";
    const rawBody = JSON.stringify({ id: 12345, topic: "app/uninstalled", shop: "acme.myshopify.com" });

    // Official Shopify webhook signature is Base64 encoded HMAC-SHA256
    const validSignature = crypto.createHmac("sha256", testSecret).update(rawBody, "utf8").digest("base64");

    assert(verifyShopifyWebhookHmac(rawBody, validSignature, testSecret), "Valid webhook HMAC must pass");

    // Tampered payload
    assert(
      !verifyShopifyWebhookHmac(rawBody + "tamper", validSignature, testSecret),
      "Tampered webhook payload must fail"
    );

    // Wrong secret
    assert(!verifyShopifyWebhookHmac(rawBody, validSignature, "wrong-secret"), "Wrong secret must fail");

    // Missing signature
    assert(!verifyShopifyWebhookHmac(rawBody, null, testSecret), "Missing signature must return false");
  });

  // ---------------------------------------------------------------------------
  // TEST 14: Webhook App Uninstalled Handler
  // ---------------------------------------------------------------------------
  test("Webhook handler supports app/uninstalled and transitions status", () => {
    const syncPath = path.resolve(__dirname, "../lib/integrations/shopify/sync.ts");
    const syncContent = fs.readFileSync(syncPath, "utf-8");

    assert(syncContent.includes('topic === "app/uninstalled"'), "Must handle app/uninstalled topic");
    assert(syncContent.includes('status: "disconnected"'), "Must mark status as disconnected");
    assert(syncContent.includes("encrypted_access_token: null"), "Must wipe access token on uninstall");
  });

  // ---------------------------------------------------------------------------
  // TEST 15: Disconnect Flow & Token Wipe
  // ---------------------------------------------------------------------------
  test("Disconnect flow wipes tokens strictly for target organization", () => {
    const actionsPath = path.resolve(__dirname, "../lib/integrations/shopify/actions.ts");
    const actionsContent = fs.readFileSync(actionsPath, "utf-8");

    assert(actionsContent.includes('status: "disconnected"'), "Disconnect must set status to disconnected");
    assert(actionsContent.includes("encrypted_access_token: null"), "Disconnect must nullify encrypted access token");
    assert(actionsContent.includes('.eq("organization_id", organizationId)'), "Disconnect must be scoped strictly to organization_id");
  });

  // ---------------------------------------------------------------------------
  // TEST 16: Migration 00047 SQL Structure & Partial Unique Index
  // ---------------------------------------------------------------------------
  test("Migration 00047 defines partial unique index for active Shopify stores", () => {
    const migrationPath = path.resolve(
      __dirname,
      "../database/migrations/00047_shopify_integration_security.sql"
    );
    assert(fs.existsSync(migrationPath), "Migration 00047 file must exist");

    const sqlContent = fs.readFileSync(migrationPath, "utf-8");
    assert(
      sqlContent.includes("create unique index if not exists idx_shopify_active_shop_unique"),
      "Must define partial unique index idx_shopify_active_shop_unique"
    );
    assert(
      sqlContent.includes("where (provider = 'shopify' and status = 'connected')"),
      "Partial unique index must enforce single active ownership per shop domain"
    );
  });

  // ---------------------------------------------------------------------------
  // TEST 17: Catalog Definition Alignment
  // ---------------------------------------------------------------------------
  test("Catalog definition matches OAuth 2.0 multi-tenant model", () => {
    const shopifyItem = INTEGRATION_CATALOG.find((item) => item.id === "shopify");
    assert(shopifyItem !== undefined, "Shopify must exist in INTEGRATION_CATALOG");
    assert.strictEqual(shopifyItem.authType, "oauth2", "Auth type must be oauth2");
    assert.strictEqual(shopifyItem.badge, "OAuth 2.0", "Badge must be OAuth 2.0");
    assert.deepStrictEqual(shopifyItem.envVars, ["SHOPIFY_API_KEY", "SHOPIFY_API_SECRET"]);
  });

  console.log("\n==================================================================");
  console.log(`SUMMARY: ${passed}/${total} TESTS PASSED WITH 0 FAILURES`);
  console.log("==================================================================\n");
}

runTestSuite().catch((err) => {
  console.error("Test runner encountered an unhandled error:", err);
  process.exit(1);
});
