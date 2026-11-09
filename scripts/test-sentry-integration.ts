import assert from "node:assert/strict";
import {
  filterSentryEvent,
  filterSentryBreadcrumb,
  scrubData,
  scrubUrl,
  scrubString,
} from "../lib/security/sentry-filter";
import type { ErrorEvent, Breadcrumb } from "@sentry/nextjs";

console.log("==================================================================");
console.log("KOGSYNC: SENTRY OBSERVABILITY & SECURITY FILTER VERIFICATION SUITE");
console.log("==================================================================");

// 1. Test scrubData with sensitive fields
console.log("[1/7] Testing data scrubbing (passwords, tokens, keys, JWTs)...");
const rawData = {
  id: "user_123",
  username: "executive_user",
  password: "super_secret_password_123",
  api_key: "ks_live_abcdef123456",
  authToken: "bearer_xyz_789",
  nested: {
    stripe_signature: "t=123,v1=sig_abc",
    credit_card: "4242424242424242",
    normalField: "business_metric_value",
  },
  tokenString: "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.dummy_jwt_payload_here.dummy_sig",
};

const scrubbed = scrubData(rawData) as Record<string, any>;
assert.equal(scrubbed.id, "user_123");
assert.equal(scrubbed.password, "[FILTERED]");
assert.equal(scrubbed.api_key, "[FILTERED]");
assert.equal(scrubbed.authToken, "[FILTERED]");
assert.equal(scrubbed.nested.stripe_signature, "[FILTERED]");
assert.equal(scrubbed.nested.credit_card, "[FILTERED]");
assert.equal(scrubbed.nested.normalField, "business_metric_value");
assert.ok(String(scrubbed.tokenString).includes("[FILTERED]") || String(scrubbed.tokenString).includes("[JWT_FILTERED]"));
console.log("   ✅ scrubData successfully filtered all secret keys and token formats.");

// 2. Test scrubString directly
console.log("[2/7] Testing scrubString (database URLs, API keys, credentials)...");
const rawConnectionString = "Failed to connect to postgresql://postgres:SuperSecretPassword123@db.project.supabase.co:5432/postgres";
const scrubbedConn = scrubString(rawConnectionString);
assert.ok(!scrubbedConn.includes("SuperSecretPassword123"));
assert.ok(scrubbedConn.includes("[FILTERED]"));

const rawApiKeyMsg = "Stripe charge failed with sk_live_abcdef1234567890abcdef";
const scrubbedApiKey = scrubString(rawApiKeyMsg);
assert.ok(!scrubbedApiKey.includes("sk_live_abcdef1234567890abcdef"));
assert.ok(scrubbedApiKey.includes("[API_KEY_FILTERED]"));
console.log("   ✅ scrubString successfully masked connection credentials and Stripe secret keys.");

// 3. Test scrubUrl with sensitive query parameters
console.log("[3/7] Testing URL parameter scrubbing (auth codes, tokens, secrets)...");
const testUrl = "https://kogsync.com/api/auth/callback?code=4/0AUn6Hd-secret_code&state=secure_state&user_id=123";
const sanitizedUrl = scrubUrl(testUrl);
assert.ok(sanitizedUrl?.includes("code=%5BFILTERED%5D") || sanitizedUrl?.includes("code=[FILTERED]"));
assert.ok(sanitizedUrl?.includes("state=%5BFILTERED%5D") || sanitizedUrl?.includes("state=[FILTERED]"));
assert.ok(sanitizedUrl?.includes("user_id=123"));
console.log("   ✅ scrubUrl accurately masked sensitive query parameters while preserving identifiers.");

// 4. Test filterSentryEvent for PII, request headers, and webhook payloads
console.log("[4/7] Testing filterSentryEvent against PII, cookies, and webhook bodies...");
const mockEvent: ErrorEvent = {
  type: undefined,
  event_id: "evt_test_123",
  timestamp: Date.now() / 1000,
  user: {
    id: "usr_org_admin",
    email: "ceo@acme-corp.com",
    username: "ceo",
    ip_address: "192.168.1.100",
  },
  request: {
    url: "https://kogsync.com/api/webhooks/stripe?token=wh_secret_token",
    headers: {
      "content-type": "application/json",
      authorization: "Bearer secret_api_token",
      cookie: "cb_active_org_id=uuid; sb-access-token=jwt",
      "stripe-signature": "t=1700000000,v1=99999",
      "x-custom-metric": "revenue_chart",
    },
    cookies: {
      "sb-access-token": "secret_jwt",
    },
    data: {
      type: "customer.subscription.updated",
      customer: "cus_123",
      stripe_secret: "sk_live_999",
    },
  },
  exception: {
    values: [
      {
        type: "DatabaseError",
        value: "Connection error at postgres://admin:TopSecretPass@db.supabase.co:5432/db",
      },
    ],
  },
  tags: {
    environment: "production",
    api_key: "ks_live_secret123",
  },
  breadcrumbs: [
    {
      category: "fetch",
      type: "http",
      data: {
        url: "https://kogsync.com/api/auth/v1/token?code=secret_oauth_code",
        requestBody: { password: "plain_password" },
      },
      message: "Authorization with Bearer eyJhbGciOiJIUzI1Ni.secret.token",
    },
  ],
};

const filteredEvent = filterSentryEvent(mockEvent);
assert.ok(filteredEvent !== null);

// Verify User PII stripped
assert.equal(filteredEvent?.user?.email, undefined);
assert.equal(filteredEvent?.user?.username, undefined);
assert.equal(filteredEvent?.user?.ip_address, undefined);
assert.equal(filteredEvent?.user?.id, "usr_org_admin");

// Verify Request headers and cookies stripped
const req = filteredEvent?.request;
assert.ok(req);
assert.equal(req.headers?.["authorization"], undefined);
assert.equal(req.headers?.["cookie"], undefined);
assert.equal(req.headers?.["stripe-signature"], undefined);
assert.equal(req.headers?.["x-custom-metric"], "revenue_chart");
assert.deepEqual(req.cookies, {});

// Verify sensitive webhook payload scrubbed
assert.equal(req.data, "[SENSITIVE_ENDPOINT_PAYLOAD_FILTERED]");

// Verify exception value scrubbed
assert.ok(filteredEvent?.exception?.values?.[0]?.value?.includes("[FILTERED]"));
assert.ok(!filteredEvent?.exception?.values?.[0]?.value?.includes("TopSecretPass"));

// Verify tags scrubbed
assert.equal(filteredEvent?.tags?.["api_key"], "[FILTERED]");
assert.equal(filteredEvent?.tags?.["environment"], "production");

console.log("   ✅ filterSentryEvent completely sanitized user PII, request headers, cookies, webhook bodies, and exceptions.");

// 5. Test filterSentryBreadcrumb
console.log("[5/7] Testing filterSentryBreadcrumb sanitization...");
const breadcrumb: Breadcrumb = {
  category: "xhr",
  data: {
    url: "https://kogsync.com/api/v1/integrations?api_key=secret_123",
    status_code: 200,
  },
  message: "Request succeeded using Bearer abcdef123456",
};

const sanitizedBreadcrumb = filterSentryBreadcrumb(breadcrumb);
assert.ok(sanitizedBreadcrumb !== null);
assert.ok(sanitizedBreadcrumb?.message?.includes("Bearer [FILTERED]"));
assert.ok(
  String(sanitizedBreadcrumb?.data?.url).includes("api_key=%5BFILTERED%5D") ||
    String(sanitizedBreadcrumb?.data?.url).includes("api_key=[FILTERED]")
);
console.log("   ✅ filterSentryBreadcrumb scrubbed sensitive tokens and URLs from breadcrumbs.");

// 6. Test instrumentation export
console.log("[6/7] Testing instrumentation.ts interface...");
import { register, onRequestError } from "../instrumentation";
assert.equal(typeof register, "function");
assert.equal(typeof onRequestError, "function");
console.log("   ✅ instrumentation.ts exports register() and onRequestError() correctly.");

// 7. Test configuration files exist and are valid modules
console.log("[7/7] Testing Sentry client/server/edge config modules...");
assert.doesNotThrow(() => require("../sentry.server.config"));
assert.doesNotThrow(() => require("../sentry.edge.config"));
console.log("   ✅ Server and edge runtime configurations initialized safely without DSN errors.");

console.log("==================================================================");
console.log("🎉 ALL SENTRY INTEGRATION TESTS PASSED WITH 100% COMPLIANCE!");
console.log("==================================================================");
