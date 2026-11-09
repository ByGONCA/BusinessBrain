/**
 * Test Suite: Trusted URL Resolution & Redirect Security (Phase 7.1 Independent Audit)
 * Exhaustively verifies:
 * - Runtime environment resolution and precedence
 * - Strict project-scoped Vercel hostname validation (anti-poisoning)
 * - Controlled fail-fast for unconfigured OAuth in Preview
 * - Open redirect & SSRF protection
 * - Prevention of accidental fallback to Production
 */

import assert from "assert";
import {
  CANONICAL_PRODUCTION_URL,
  CANONICAL_DEVELOPMENT_URL,
  isTrustedHost,
  isAllowedProtocol,
  sanitizeRedirectUrl,
  getTrustedAppUrl,
  getOAuthCallbackUrl,
  getStripeCallbackUrl,
  getAuthCallbackUrl,
  resolveEnvironment,
  OAuthPreviewConfigurationError,
} from "../lib/security/redirects";

function runTests() {
  console.log("=== Testing Phase 7.1: URL Resolution & Security Audit ===");

  const envObj = process.env as Record<string, string | undefined>;
  const originalEnv = { ...process.env };

  const restoreEnv = () => {
    for (const key of Object.keys(process.env)) {
      if (!(key in originalEnv)) {
        delete envObj[key];
      }
    }
    for (const [k, v] of Object.entries(originalEnv)) {
      envObj[k] = v;
    }
  };

  try {
    // --------------------------------------------------------------------------
    // Test 1: VERCEL_ENV Precedence & Runtime Environment Detection
    // --------------------------------------------------------------------------
    console.log("Test 1: Environment precedence & resolution (resolveEnvironment)...");

    // 1a: VERCEL_ENV=preview with NODE_ENV=production (Real Vercel Preview reality!)
    restoreEnv();
    envObj.VERCEL_ENV = "preview";
    envObj.NODE_ENV = "production";
    assert.strictEqual(
      resolveEnvironment(),
      "preview",
      "VERCEL_ENV=preview MUST take precedence over NODE_ENV=production"
    );

    // 1b: VERCEL_ENV=production with NODE_ENV=production
    restoreEnv();
    envObj.VERCEL_ENV = "production";
    envObj.NODE_ENV = "production";
    assert.strictEqual(
      resolveEnvironment(),
      "production",
      "VERCEL_ENV=production must resolve to production"
    );

    // 1c: VERCEL_ENV=development with NODE_ENV=production (e.g. local prod build)
    restoreEnv();
    envObj.VERCEL_ENV = "development";
    envObj.NODE_ENV = "production";
    assert.strictEqual(
      resolveEnvironment(),
      "development",
      "VERCEL_ENV=development must resolve to development even when NODE_ENV=production"
    );

    // 1d: Local execution without any Vercel variables
    restoreEnv();
    delete envObj.VERCEL_ENV;
    delete envObj.VERCEL_URL;
    envObj.NODE_ENV = "development";
    assert.strictEqual(
      resolveEnvironment(),
      "development",
      "Local dev execution without Vercel variables must resolve to development"
    );

    // 1e: Implicit Vercel preview via VERCEL_URL without VERCEL_ENV
    restoreEnv();
    delete envObj.VERCEL_ENV;
    envObj.VERCEL_URL = "kogsync-preview-implicit.vercel.app";
    assert.strictEqual(
      resolveEnvironment(),
      "preview",
      "Presence of VERCEL_URL without VERCEL_ENV must identify as preview"
    );

    // --------------------------------------------------------------------------
    // Test 2: Production URL Resolution
    // --------------------------------------------------------------------------
    console.log("Test 2: Production URL resolution...");
    restoreEnv();
    envObj.VERCEL_ENV = "production";
    envObj.NODE_ENV = "production";

    assert.strictEqual(
      getTrustedAppUrl(),
      CANONICAL_PRODUCTION_URL,
      "Production must return canonical https://kogsync.com"
    );

    // --------------------------------------------------------------------------
    // Test 3: Local Development URL Resolution
    // --------------------------------------------------------------------------
    console.log("Test 3: Local Development URL resolution...");
    restoreEnv();
    delete envObj.VERCEL_ENV;
    delete envObj.VERCEL_URL;
    envObj.NODE_ENV = "development";
    envObj.NEXT_PUBLIC_APP_URL = "http://localhost:3000";

    assert.strictEqual(
      getTrustedAppUrl(),
      CANONICAL_DEVELOPMENT_URL,
      "Development must return http://localhost:3000"
    );

    // --------------------------------------------------------------------------
    // Test 4: Preview URL with VERCEL_URL & Project Prefix Validation
    // --------------------------------------------------------------------------
    console.log("Test 4: Preview URL with project-scoped VERCEL_URL...");
    restoreEnv();
    envObj.VERCEL_ENV = "preview";
    envObj.NODE_ENV = "production";
    envObj.VERCEL_URL = "kogsync-git-feat-test.vercel.app";

    assert.strictEqual(
      getTrustedAppUrl(),
      "https://kogsync-git-feat-test.vercel.app",
      "Preview must resolve verified KogSync VERCEL_URL"
    );

    // --------------------------------------------------------------------------
    // Test 5: Rejection of Third-Party / Foreign Vercel Deployments (Anti-Poisoning)
    // --------------------------------------------------------------------------
    console.log("Test 5: Rejection of foreign *.vercel.app hostnames (Host Poisoning defense)...");

    // An attacker's deployment on Vercel:
    assert.strictEqual(
      isTrustedHost("attacker-project.vercel.app"),
      false,
      "Foreign Vercel deployment must be rejected by isTrustedHost"
    );
    assert.strictEqual(
      isTrustedHost("evil-app.vercel.app"),
      false,
      "Random Vercel deployment must be rejected"
    );

    // Legitimate KogSync project deployments:
    assert.strictEqual(
      isTrustedHost("kogsync.vercel.app"),
      true,
      "kogsync.vercel.app is trusted"
    );
    assert.strictEqual(
      isTrustedHost("kogsync-1nty67chl-kog-sync.vercel.app"),
      true,
      "kogsync-*.vercel.app is trusted"
    );
    assert.strictEqual(
      isTrustedHost("kogsync-git-main-kog-sync.vercel.app"),
      true,
      "kogsync-git-*.vercel.app is trusted"
    );

    // Exact VERCEL_URL match is trusted even if unusual:
    envObj.VERCEL_URL = "kogsync-special-build.vercel.app";
    assert.strictEqual(
      isTrustedHost("kogsync-special-build.vercel.app"),
      true,
      "Exact match with current deployment's VERCEL_URL is trusted"
    );

    // Request with foreign host must NOT poison getTrustedAppUrl:
    const hostileRequest = new Request("https://attacker-project.vercel.app/api/auth/callback");
    assert.strictEqual(
      getTrustedAppUrl(hostileRequest),
      "https://kogsync-special-build.vercel.app",
      "Hostile foreign request must not poison trusted app URL"
    );

    // --------------------------------------------------------------------------
    // Test 6: Preview without VERCEL_URL & Accidental Production Fallback Prevention
    // --------------------------------------------------------------------------
    console.log("Test 6: Preview fallback safety (never accidentally falling back to Production)...");
    restoreEnv();
    envObj.VERCEL_ENV = "preview";
    delete envObj.VERCEL_URL;
    envObj.NEXT_PUBLIC_APP_URL = "https://kogsync.com"; // simulate legacy shared variable

    assert.notStrictEqual(
      getTrustedAppUrl(),
      CANONICAL_PRODUCTION_URL,
      "Preview must NEVER return https://kogsync.com even if NEXT_PUBLIC_APP_URL is set to production"
    );
    assert.strictEqual(
      getTrustedAppUrl(),
      CANONICAL_DEVELOPMENT_URL,
      "Preview without valid VERCEL_URL falls back safely to localhost"
    );

    // --------------------------------------------------------------------------
    // Test 7: OAuth Callbacks — Production
    // --------------------------------------------------------------------------
    console.log("Test 7: OAuth callbacks in Production...");
    restoreEnv();
    envObj.VERCEL_ENV = "production";
    envObj.NODE_ENV = "production";

    assert.strictEqual(
      getOAuthCallbackUrl("google"),
      "https://kogsync.com/api/integrations/google/callback",
      "Production Google OAuth callback must be canonical"
    );
    assert.strictEqual(
      getOAuthCallbackUrl("github"),
      "https://kogsync.com/api/integrations/github/callback",
      "Production GitHub OAuth callback must be canonical"
    );
    assert.strictEqual(
      getStripeCallbackUrl(),
      "https://kogsync.com/api/integrations/stripe/callback",
      "Production Stripe Connect callback must be canonical"
    );

    // --------------------------------------------------------------------------
    // Test 8: OAuth Callbacks — Local Development
    // --------------------------------------------------------------------------
    console.log("Test 8: OAuth callbacks in Local Development...");
    restoreEnv();
    delete envObj.VERCEL_ENV;
    delete envObj.VERCEL_URL;
    envObj.NODE_ENV = "development";

    assert.strictEqual(
      getOAuthCallbackUrl("google"),
      "http://localhost:3000/api/integrations/google/callback",
      "Development Google OAuth callback must be localhost:3000"
    );
    assert.strictEqual(
      getOAuthCallbackUrl("slack"),
      "http://localhost:3000/api/integrations/slack/callback",
      "Development Slack OAuth callback must be localhost:3000"
    );
    assert.strictEqual(
      getStripeCallbackUrl(),
      "http://localhost:3000/api/integrations/stripe/callback",
      "Development Stripe Connect callback must be localhost:3000"
    );

    // --------------------------------------------------------------------------
    // Test 9: OAuth Callbacks in Preview — Controlled Failure when Unconfigured
    // --------------------------------------------------------------------------
    console.log("Test 9: OAuth in Preview without static callback (Controlled Fail-Fast)...");
    restoreEnv();
    envObj.VERCEL_ENV = "preview";
    envObj.NODE_ENV = "production";
    envObj.VERCEL_URL = "kogsync-preview-1.vercel.app";

    // Attempting static provider OAuth in Preview without registered callback MUST throw OAuthPreviewConfigurationError
    let threwGoogle = false;
    try {
      getOAuthCallbackUrl("google");
    } catch (err: unknown) {
      if (err instanceof OAuthPreviewConfigurationError) {
        threwGoogle = true;
        assert.strictEqual(err.provider, "google");
        assert(err.message.includes("requires a static pre-registered redirect URI"));
      }
    }
    assert.strictEqual(threwGoogle, true, "Must throw OAuthPreviewConfigurationError for Google in Preview");

    let threwStripe = false;
    try {
      getStripeCallbackUrl();
    } catch (err: unknown) {
      if (err instanceof OAuthPreviewConfigurationError) {
        threwStripe = true;
        assert.strictEqual(err.provider, "stripe");
      }
    }
    assert.strictEqual(threwStripe, true, "Must throw OAuthPreviewConfigurationError for Stripe in Preview");

    // --------------------------------------------------------------------------
    // Test 10: OAuth Callbacks in Preview — Functioning when Explicitly Configured
    // --------------------------------------------------------------------------
    console.log("Test 10: OAuth in Preview with explicit staging callback configured...");
    restoreEnv();
    envObj.VERCEL_ENV = "preview";
    envObj.NODE_ENV = "production";
    envObj.VERCEL_URL = "kogsync-preview-1.vercel.app";

    // Configure specific provider staging callback
    envObj.PREVIEW_GOOGLE_REDIRECT_URI = "https://preview.kogsync.com/api/integrations/google/callback";
    assert.strictEqual(
      getOAuthCallbackUrl("google"),
      "https://preview.kogsync.com/api/integrations/google/callback",
      "Explicit PREVIEW_GOOGLE_REDIRECT_URI must be respected"
    );

    // Configure static preview app URL
    envObj.PREVIEW_APP_URL = "https://staging.kogsync.com";
    assert.strictEqual(
      getOAuthCallbackUrl("github"),
      "https://staging.kogsync.com/api/integrations/github/callback",
      "PREVIEW_APP_URL must resolve static callback for GitHub"
    );

    // --------------------------------------------------------------------------
    // Test 11: Open Redirect, SSRF & Malicious Payloads
    // --------------------------------------------------------------------------
    console.log("Test 11: Open Redirect & SSRF protection...");
    assert.strictEqual(sanitizeRedirectUrl("https://evil.com"), "/dashboard");
    assert.strictEqual(sanitizeRedirectUrl("http://evil.com"), "/dashboard");
    assert.strictEqual(sanitizeRedirectUrl("//evil.com"), "/dashboard");
    assert.strictEqual(sanitizeRedirectUrl("/\\evil.com"), "/dashboard");
    assert.strictEqual(sanitizeRedirectUrl("\\evil.com"), "/dashboard");
    assert.strictEqual(sanitizeRedirectUrl("javascript:alert(1)"), "/dashboard");
    assert.strictEqual(sanitizeRedirectUrl("data:text/html,evil"), "/dashboard");
    assert.strictEqual(sanitizeRedirectUrl("/dashboard%0d%0aInjected:header"), "/dashboard");
    assert.strictEqual(sanitizeRedirectUrl("/dashboard\r\nInjected:header"), "/dashboard");
    assert.strictEqual(sanitizeRedirectUrl("/dashboard?clean=true"), "/dashboard?clean=true");

    // --------------------------------------------------------------------------
    // Test 12: Protocol & Port Artifact Validation
    // --------------------------------------------------------------------------
    console.log("Test 12: Protocol & Port artifact validation...");
    assert.strictEqual(isAllowedProtocol("https", "kogsync.com"), true);
    assert.strictEqual(isAllowedProtocol("http", "kogsync.com"), false);
    assert.strictEqual(isAllowedProtocol("http", "localhost"), true);
    assert.strictEqual(isAllowedProtocol("http", "127.0.0.1"), true);
    assert.strictEqual(isAllowedProtocol("ftp", "kogsync.com"), false);

    assert.strictEqual(isTrustedHost("kogsync.com:3000"), false, "Port in host rejected");
    assert.strictEqual(isTrustedHost("kogsync.com/evil"), false, "Path in host rejected");
    assert.strictEqual(isTrustedHost("admin@kogsync.com"), false, "Userinfo in host rejected");

    // --------------------------------------------------------------------------
    // Test 13: Supabase Auth Callback URLs
    // --------------------------------------------------------------------------
    console.log("Test 13: Supabase Auth Callback URL generation...");
    restoreEnv();
    envObj.VERCEL_ENV = "preview";
    envObj.VERCEL_URL = "kogsync-preview-42.vercel.app";

    assert.strictEqual(
      getAuthCallbackUrl("/api/auth/callback"),
      "https://kogsync-preview-42.vercel.app/api/auth/callback",
      "Auth callback in preview points to preview deployment"
    );

    console.log("\nALL 13 INDEPENDENT AUDIT TESTS PASSED WITH ZERO FAILURES! ✓\n");
  } finally {
    restoreEnv();
  }
}

runTests();
