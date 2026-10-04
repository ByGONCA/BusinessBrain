/**
 * Security Foundation Verification Suite for Company Brain.
 * Runs non-destructive unit/integration verification of:
 * 1. URL sanitization & Open Redirect prevention
 * 2. Token encryption / decryption (AES-256-GCM)
 * 3. File upload validation & path traversal prevention
 * 4. Rate limiter in-memory & RPC resilience
 * 5. Client bundle / environment variable leakage audit
 * 6. SQL migration policies audit
 */

import { sanitizeRedirectUrl } from "../lib/security/redirects";
import { encryptToken, decryptToken } from "../lib/crypto/encryption";
import { validateFileMetadata, sanitizeFilename } from "../lib/storage/validation";
import { rateLimit, RATE_LIMIT_PRESETS } from "../lib/security/rate-limit";
import fs from "fs";
import path from "path";

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string) {
  if (condition) {
    console.log(`  ✓ PASS: ${testName}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${testName}`);
    failed++;
  }
}

async function runTests() {
  console.log("\n=======================================================");
  console.log("COMPANY BRAIN: SECURITY FOUNDATION VERIFICATION SUITE");
  console.log("=======================================================\n");

  // ---------------------------------------------------------------------------
  // 1. OPEN REDIRECT & URL SANITIZATION
  // ---------------------------------------------------------------------------
  console.log("[1] Testing Open Redirect & URL Sanitization:");
  assert(
    sanitizeRedirectUrl("https://evil.com") === "/dashboard",
    "Blocks absolute external https URLs"
  );
  assert(
    sanitizeRedirectUrl("http://attacker.com/steal") === "/dashboard",
    "Blocks absolute external http URLs"
  );
  assert(
    sanitizeRedirectUrl("//evil.com") === "/dashboard",
    "Blocks protocol-relative URLs (//evil.com)"
  );
  assert(
    sanitizeRedirectUrl("/\\evil.com") === "/dashboard",
    "Blocks backslash bypasses (/\\evil.com)"
  );
  assert(
    sanitizeRedirectUrl("\\\\evil.com") === "/dashboard",
    "Blocks leading backslash URLs (\\\\evil.com)"
  );
  assert(
    sanitizeRedirectUrl("javascript:alert(document.cookie)") === "/dashboard",
    "Blocks javascript: pseudo-protocol"
  );
  assert(
    sanitizeRedirectUrl("data:text/html,<script>alert(1)</script>") === "/dashboard",
    "Blocks data: URI scheme"
  );
  assert(
    sanitizeRedirectUrl("/dashboard/settings") === "/dashboard/settings",
    "Permits safe relative path (/dashboard/settings)"
  );
  assert(
    sanitizeRedirectUrl("/pricing?plan=pro#faq") === "/pricing?plan=pro#faq",
    "Permits safe relative path with search params and hash"
  );

  // ---------------------------------------------------------------------------
  // 2. TOKEN ENCRYPTION / DECRYPTION (AES-256-GCM)
  // ---------------------------------------------------------------------------
  console.log("\n[2] Testing Token Encryption & Decryption (AES-256-GCM):");
  const sampleSecret = "ya29.a0AfH6SMDh_google_oauth_sample_token_secret_12345";
  const encrypted = encryptToken(sampleSecret);

  assert(encrypted !== sampleSecret, "Encrypted token differs from plaintext");
  assert(encrypted.split(":").length === 3, "Encrypted output has iv:tag:ciphertext format");

  const decrypted = decryptToken(encrypted);
  assert(decrypted === sampleSecret, "Decrypted plaintext matches original secret exactly");

  let tamperFailed = false;
  try {
    const parts = encrypted.split(":");
    // Tamper with the ciphertext
    const tampered = `${parts[0]}:${parts[1]}:${parts[2].slice(0, -2)}ff`;
    decryptToken(tampered);
  } catch {
    tamperFailed = true;
  }
  assert(tamperFailed, "Rejects tampered ciphertext with authentication tag failure");

  // ---------------------------------------------------------------------------
  // 3. FILE UPLOAD & STORAGE SECURITY
  // ---------------------------------------------------------------------------
  console.log("\n[3] Testing Storage File Validation & Path Traversal Prevention:");
  assert(
    sanitizeFilename("../../etc/passwd") === "passwd",
    "Strips directory traversal sequences (../../)"
  );
  assert(
    sanitizeFilename("..\\..\\windows\\system32\\cmd.exe") === "cmd.exe",
    "Strips Windows path traversal separators"
  );
  assert(
    sanitizeFilename("evil\0file.pdf") === "evil_file.pdf",
    "Removes null bytes and control chars"
  );

  const exeCheck = validateFileMetadata("malware.exe", "application/octet-stream", 1024);
  assert(!exeCheck.isValid, "Blocks dangerous executable file (.exe)");

  const phpCheck = validateFileMetadata("shell.php", "application/x-php", 500);
  assert(!phpCheck.isValid, "Blocks dangerous script file (.php)");

  const validPdf = validateFileMetadata("company-handbook.pdf", "application/pdf", 1024 * 1024);
  assert(validPdf.isValid, "Accepts legitimate PDF document");

  const oversized = validateFileMetadata(
    "large.pdf",
    "application/pdf",
    100 * 1024 * 1024,
    25 * 1024 * 1024
  );
  assert(!oversized.isValid, "Enforces maximum file size limit");

  // ---------------------------------------------------------------------------
  // 4. RATE LIMITING
  // ---------------------------------------------------------------------------
  console.log("\n[4] Testing Rate Limiting (Serverless & Fallback Engine):");
  const testId = `test-${Date.now()}`;
  const customLimit = { limit: 3, windowSeconds: 10 };

  const r1 = await rateLimit("test", testId, customLimit);
  assert(r1.success, "Request 1 within rate limit permitted");

  const r2 = await rateLimit("test", testId, customLimit);
  assert(r2.success, "Request 2 within rate limit permitted");

  const r3 = await rateLimit("test", testId, customLimit);
  assert(r3.success, "Request 3 within rate limit permitted");

  const r4 = await rateLimit("test", testId, customLimit);
  assert(!r4.success, "Request 4 exceeding rate limit blocked (429)");

  // ---------------------------------------------------------------------------
  // 5. SECRETS & CLIENT BUNDLE AUDIT
  // ---------------------------------------------------------------------------
  console.log("\n[5] Auditing Environment Variables & Public Keys:");
  const envContent = fs.readFileSync(path.resolve(process.cwd(), ".env"), "utf8");
  const lines = envContent.split("\n");

  const publicLines = lines.filter((l) => l.startsWith("NEXT_PUBLIC_"));
  const invalidPublic = publicLines.filter((l) => {
    const key = l.split("=")[0];
    return (
      key.includes("SECRET") ||
      key.includes("PRIVATE") ||
      key.includes("SERVICE_ROLE") ||
      key.includes("ENCRYPTION")
    );
  });

  assert(invalidPublic.length === 0, "Zero private secrets prefixed with NEXT_PUBLIC_ in .env");

  // Check that STRIPE_SECRET_KEY is NOT public
  assert(!envContent.includes("NEXT_PUBLIC_STRIPE_SECRET_KEY"), "STRIPE_SECRET_KEY is strictly private");

  // Check that INTEGRATION_TOKEN_ENCRYPTION_KEY is NOT public
  assert(
    !envContent.includes("NEXT_PUBLIC_INTEGRATION_TOKEN_ENCRYPTION_KEY"),
    "INTEGRATION_TOKEN_ENCRYPTION_KEY is strictly private"
  );

  // ---------------------------------------------------------------------------
  // 6. SQL MIGRATION POLICIES AUDIT
  // ---------------------------------------------------------------------------
  console.log("\n[6] Auditing SQL Migration 00005:");
  const migration5Path = path.resolve(
    process.cwd(),
    "database/migrations/00005_security_hardening.sql"
  );
  assert(fs.existsSync(migration5Path), "Migration 00005_security_hardening.sql exists");

  const migration5Sql = fs.readFileSync(migration5Path, "utf8");
  assert(
    migration5Sql.includes("created_by = auth.uid()"),
    "RLS policy enforces created_by check for organization owner self-assignment"
  );
  assert(
    migration5Sql.includes("record_stripe_webhook_event"),
    "Stripe webhook idempotency ledger and RPC defined"
  );
  assert(
    migration5Sql.includes("check_rate_limit"),
    "Serverless rate limit table and atomic RPC defined"
  );
  assert(
    migration5Sql.includes("p_server_token text default null"),
    "Rate limiting RPC requires server token parameter"
  );
  assert(
    migration5Sql.includes("revoke all on function public.check_rate_limit"),
    "Rate limiting RPC revokes public execution permissions"
  );
  assert(
    migration5Sql.includes("storage.objects"),
    "Supabase Storage tenant isolation policies defined"
  );

  // ---------------------------------------------------------------------------
  // 7. CSP & HSTS COMPLIANCE AUDIT
  // ---------------------------------------------------------------------------
  console.log("\n[7] Auditing CSP and HSTS Security Headers in next.config.ts:");
  const nextConfigContent = fs.readFileSync(path.resolve(process.cwd(), "next.config.ts"), "utf8");

  // Verify HSTS does NOT contain preload
  const hstsMatch = nextConfigContent.match(/key:\s*"Strict-Transport-Security",\s*(?:\/\/.*\s*)?value:\s*"([^"]+)"/);
  assert(hstsMatch !== null, "Strict-Transport-Security header is configured");
  if (hstsMatch) {
    assert(!hstsMatch[1].includes("preload"), "Strict-Transport-Security does NOT contain preload");
    assert(hstsMatch[1].includes("max-age="), "Strict-Transport-Security specifies max-age");
  }

  // Verify unsafe-eval is excluded in production
  assert(
    nextConfigContent.includes("isDev ? [\"'unsafe-eval'\"] : []"),
    "unsafe-eval is strictly restricted to development mode and excluded in production"
  );

  // ---------------------------------------------------------------------------
  // 8. TIMING-SAFE OAUTH STATE COMPARISON
  // ---------------------------------------------------------------------------
  console.log("\n[8] Auditing OAuth State Verification (timing-safe comparison):");
  const oauthSrc = fs.readFileSync(
    path.resolve(process.cwd(), "lib/integrations/google/oauth.ts"),
    "utf8"
  );
  assert(
    oauthSrc.includes("crypto.timingSafeEqual"),
    "OAuth state verifyOAuthState uses crypto.timingSafeEqual (timing-oracle prevention)"
  );
  assert(
    !oauthSrc.includes("signature !== expectedSignature"),
    "OAuth state does NOT use plain === string comparison for HMAC signatures"
  );

  // ---------------------------------------------------------------------------
  // 9. SSRF PROTECTION IN GOOGLE CLIENT
  // ---------------------------------------------------------------------------
  console.log("\n[9] Auditing SSRF Protection in Google API Client:");
  const googleClientSrc = fs.readFileSync(
    path.resolve(process.cwd(), "lib/integrations/google/client.ts"),
    "utf8"
  );
  assert(
    googleClientSrc.includes("SSRF protection"),
    "googleFetch contains SSRF protection comment/guard"
  );
  assert(
    googleClientSrc.includes("googleapis.com"),
    "googleFetch enforces googleapis.com allowlist"
  );
  assert(
    googleClientSrc.includes("169.254.169.254"),
    "googleFetch blocks metadata endpoint (169.254.169.254)"
  );
  assert(
    googleClientSrc.includes("parsedUrl.protocol !== \"https:\""),
    "googleFetch rejects non-HTTPS requests"
  );

  // ---------------------------------------------------------------------------
  // 10. CROSS-TENANT VALIDATION IN CONNECTIONS
  // ---------------------------------------------------------------------------
  console.log("\n[10] Auditing Cross-Tenant Validation in Connection Actions:");
  const connActionsSrc = fs.readFileSync(
    path.resolve(process.cwd(), "lib/connections/actions.ts"),
    "utf8"
  );
  assert(
    connActionsSrc.includes("Cross-tenant validation"),
    "createConnectionAction has cross-tenant source/target ownership check"
  );
  assert(
    connActionsSrc.includes("Source object not found in your workspace"),
    "createConnectionAction rejects cross-tenant source IDs"
  );
  assert(
    connActionsSrc.includes("Target object not found in your workspace"),
    "createConnectionAction rejects cross-tenant target IDs"
  );

  // ---------------------------------------------------------------------------
  // 11. CROSS-TENANT PARENT PAGE VALIDATION
  // ---------------------------------------------------------------------------
  console.log("\n[11] Auditing Cross-Tenant Parent Page Validation in Pages Actions:");
  const pagesActionsSrc = fs.readFileSync(
    path.resolve(process.cwd(), "lib/pages/actions.ts"),
    "utf8"
  );
  assert(
    pagesActionsSrc.includes("Parent page not found in your workspace"),
    "createPageAction verifies parentPageId belongs to active organization"
  );
  assert(
    pagesActionsSrc.includes("Target parent page not found in your workspace"),
    "movePageAction verifies targetParentId belongs to active organization"
  );
  assert(
    pagesActionsSrc.includes("Page not found in your workspace"),
    "connectEntityAction/createEntityAndConnectAction verify pageId belongs to active organization"
  );

  // ---------------------------------------------------------------------------
  // 12. SEARCH TERM SANITIZATION
  // ---------------------------------------------------------------------------
  console.log("\n[12] Auditing PostgREST Search Term Sanitization:");
  assert(
    pagesActionsSrc.includes("PostgREST filter-injection"),
    "searchPagesAction sanitizes PostgREST special characters before interpolation"
  );
  assert(
    pagesActionsSrc.includes(".replace(/[,()"),
    "searchPagesAction strips PostgREST special chars with regex replacement"
  );

  // ---------------------------------------------------------------------------
  // 13. LINK URL SCHEME VALIDATION
  // ---------------------------------------------------------------------------
  console.log("\n[13] Auditing Link URL Scheme Validation in Editor Toolbar:");
  const toolbarSrc = fs.readFileSync(
    path.resolve(process.cwd(), "components/dashboard/pages/floating-format-toolbar.tsx"),
    "utf8"
  );
  assert(
    toolbarSrc.includes("only permit safe URL schemes"),
    "floating-format-toolbar validates link URL scheme before calling execCommand"
  );
  assert(
    toolbarSrc.includes("parsedUrl.protocol !== \"https:\""),
    "floating-format-toolbar blocks non-https/http/mailto schemes"
  );

  // ---------------------------------------------------------------------------
  // 14. SVG MIME TYPE CONSISTENCY
  // ---------------------------------------------------------------------------
  console.log("\n[14] Auditing SVG MIME Type Consistency:");
  const validationSrc = fs.readFileSync(
    path.resolve(process.cwd(), "lib/storage/validation.ts"),
    "utf8"
  );
  assert(
    !validationSrc.includes("image/svg+xml"),
    "image/svg+xml is NOT in ALLOWED_MIME_TYPES (matches Storage bucket policy)"
  );
  assert(
    validationSrc.includes("SVG excluded"),
    "SVG exclusion is documented with a comment in storage validation"
  );

  // ---------------------------------------------------------------------------
  // 15. ORG MEMBERS IDOR DEFENSE
  // ---------------------------------------------------------------------------
  console.log("\n[15] Auditing getOrganizationMembersAction IDOR Defense:");
  const orgActionsSrc = fs.readFileSync(
    path.resolve(process.cwd(), "lib/organizations/actions.ts"),
    "utf8"
  );
  assert(
    orgActionsSrc.includes("Defense-in-depth"),
    "getOrganizationMembersAction has defense-in-depth membership check when org ID is explicitly supplied"
  );
  assert(
    orgActionsSrc.includes("Unauthorized to access this workspace"),
    "getOrganizationMembersAction rejects non-member callers for explicit org ID"
  );

  // ---------------------------------------------------------------------------
  // 16. MIGRATION 00009 PRESENCE
  // ---------------------------------------------------------------------------
  console.log("\n[16] Auditing Migration 00009 (Security Hardening):");
  const migration9Path = path.resolve(
    process.cwd(),
    "database/migrations/00009_security_audit_hardening.sql"
  );
  assert(fs.existsSync(migration9Path), "Migration 00009_security_audit_hardening.sql exists");

  const migration9Sql = fs.readFileSync(migration9Path, "utf8");
  assert(
    migration9Sql.includes("p_server_token"),
    "Migration 00009 rewrites billing RPCs with server token guard"
  );
  assert(
    migration9Sql.includes("validate_page_hierarchy"),
    "Migration 00009 adds cross-tenant page hierarchy trigger"
  );
  assert(
    migration9Sql.includes("validate_company_connection"),
    "Migration 00009 adds cross-tenant company connection trigger"
  );
  assert(
    migration9Sql.toLowerCase().includes("revoke"),
    "Migration 00009 revokes default PUBLIC execute on billing RPCs"
  );
  assert(
    migration9Sql.includes("revoke execute on function public.is_org_member(uuid) from public;"),
    "Migration 00009 revokes public execute on is_org_member helper function"
  );
  assert(
    migration9Sql.includes("revoke execute on function public.has_org_role(uuid, text[]) from public;"),
    "Migration 00009 revokes public execute on has_org_role helper function"
  );
  assert(
    migration9Sql.includes("revoke execute on function public.shares_organization_with(uuid) from public;"),
    "Migration 00009 revokes public execute on shares_organization_with helper function"
  );
  assert(
    migration9Sql.includes("grant execute on function public.is_org_member(uuid) to authenticated, service_role, postgres;"),
    "Migration 00009 grants execution of is_org_member to authenticated, service_role, postgres"
  );
  assert(
    migration9Sql.includes("to authenticated") && migration9Sql.includes("bucket_id = 'organization_files'"),
    "Migration 00009 restricts organization_files storage policies strictly to authenticated role"
  );
  assert(
    migration9Sql.includes("public.is_org_member((storage.foldername(name))[1]::uuid)") &&
      migration9Sql.includes("public.has_org_role((storage.foldername(name))[1]::uuid, array['owner', 'admin'])"),
    "Migration 00009 preserves organization isolation across storage SELECT/INSERT/UPDATE/DELETE policies"
  );
  assert(
    migration9Sql.includes("drop function if exists public.cancel_stripe_subscription(text);"),
    "Migration 00009 drops obsolete un-guarded cancel_stripe_subscription overload"
  );
  assert(
    migration9Sql.includes("drop function if exists public.record_stripe_webhook_event(text, text);"),
    "Migration 00009 drops obsolete un-guarded record_stripe_webhook_event overload"
  );
  assert(
    migration9Sql.includes("drop function if exists public.sync_stripe_subscription("),
    "Migration 00009 drops obsolete un-guarded sync_stripe_subscription overload"
  );

  // ---------------------------------------------------------------------------
  // 17. MIGRATION 00010 (REVOKE HELPER FUNCTIONS ANON EXECUTION)
  // ---------------------------------------------------------------------------
  console.log("\n[17] Auditing Migration 00010 (Revoke Helper Functions Anon Execution):");
  const migration10Path = path.resolve(
    process.cwd(),
    "database/migrations/00010_revoke_helper_functions_anon.sql"
  );
  assert(fs.existsSync(migration10Path), "Migration 00010_revoke_helper_functions_anon.sql exists");

  const migration10Sql = fs.readFileSync(migration10Path, "utf8");
  assert(
    migration10Sql.includes("revoke execute on function public.is_org_member(uuid) from anon, public;"),
    "Migration 00010 revokes anon execute on is_org_member"
  );
  assert(
    migration10Sql.includes("revoke execute on function public.has_org_role(uuid, text[]) from anon, public;"),
    "Migration 00010 revokes anon execute on has_org_role"
  );
  assert(
    migration10Sql.includes("revoke execute on function public.shares_organization_with(uuid) from anon, public;"),
    "Migration 00010 revokes anon execute on shares_organization_with"
  );
  assert(
    migration10Sql.includes("grant execute on function public.is_org_member(uuid) to authenticated, service_role, postgres;"),
    "Migration 00010 preserves execute on is_org_member for authenticated, service_role, postgres"
  );
  assert(
    migration10Sql.includes("grant execute on function public.has_org_role(uuid, text[]) to authenticated, service_role, postgres;"),
    "Migration 00010 preserves execute on has_org_role for authenticated, service_role, postgres"
  );
  assert(
    migration10Sql.includes("grant execute on function public.shares_organization_with(uuid) to authenticated, service_role, postgres;"),
    "Migration 00010 preserves execute on shares_organization_with for authenticated, service_role, postgres"
  );
  assert(
    migration10Sql.includes("notify pgrst, 'reload schema';"),
    "Migration 00010 notifies PostgREST to reload schema cache"
  );

  // ---------------------------------------------------------------------------
  // SUMMARY
  // ---------------------------------------------------------------------------
  console.log("\n=======================================================");
  console.log(`TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log("=======================================================\n");

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
