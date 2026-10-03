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
  // 8. FILE SYSTEM, QUOTAS & EXTERNAL PROVIDER ARCHITECTURE
  // ---------------------------------------------------------------------------
  console.log("\n[8] Auditing File System, Quotas & External Provider Architecture:");

  // Check migration 00008
  const migration8Path = path.resolve(
    process.cwd(),
    "database/migrations/00008_file_system_foundation.sql"
  );
  assert(fs.existsSync(migration8Path), "Migration 00008_file_system_foundation.sql exists");

  const migration8Sql = fs.readFileSync(migration8Path, "utf8");
  assert(
    migration8Sql.includes("create table if not exists public.organization_files"),
    "organization_files multi-tenant table defined"
  );
  assert(
    migration8Sql.includes("create table if not exists public.page_files"),
    "page_files relational table defined"
  );
  assert(
    migration8Sql.includes("alter table public.organization_files enable row level security"),
    "RLS enabled on organization_files"
  );
  assert(
    migration8Sql.includes("alter table public.page_files enable row level security"),
    "RLS enabled on page_files"
  );
  assert(
    migration8Sql.includes("get_organization_storage_bytes"),
    "Storage accounting RPC defined for internal bytes only"
  );
  assert(
    migration8Sql.includes("target_type in ('project', 'task', 'meeting', 'goal', 'person', 'page', 'decision', 'document', 'file')"),
    "page_connections target_type expanded to include file"
  );

  // Verify Provider Abstraction
  const { getFileProvider } = await import("../lib/files/providers/registry");
  const cbProvider = getFileProvider("company_brain");
  assert(cbProvider.providerId === "company_brain", "Company Brain storage provider registered");

  const gdProvider = getFileProvider("google_drive");
  assert(gdProvider.providerId === "google_drive", "Google Drive storage provider registered");

  const odProvider = getFileProvider("microsoft_onedrive");
  assert(odProvider.providerId === "microsoft_onedrive", "OneDrive extension stub provider registered");

  // Verify Google Drive least privilege scopes
  const { GOOGLE_SCOPES, DRIVE_INTEGRATION_SCOPES } = await import("../lib/integrations/google/config");
  assert(
    DRIVE_INTEGRATION_SCOPES.includes(GOOGLE_SCOPES.DRIVE_READONLY),
    "Google Drive scopes require read-only access (least privilege)"
  );
  assert(
    !DRIVE_INTEGRATION_SCOPES.some((s) => s.includes("drive.file") || s.includes("drive.appdata") || s.includes("drive.scripts")),
    "Google Drive scopes do not include destructive or excess permissions"
  );

  // ---------------------------------------------------------------------------
  // 9. STORAGE RLS & HELPER FUNCTION SECURITY HARDENING
  // ---------------------------------------------------------------------------
  console.log("\n[9] Auditing Storage RLS & Helper Function Security Hardening:");
  const migration9Path = path.resolve(
    process.cwd(),
    "database/migrations/00009_storage_rls_hardening.sql"
  );
  assert(fs.existsSync(migration9Path), "Migration 00009_storage_rls_hardening.sql exists");

  const migration9Sql = fs.readFileSync(migration9Path, "utf8");

  // Verify EXECUTE privileges revoked from PUBLIC
  assert(
    migration9Sql.includes("revoke execute on function public.is_org_member(uuid) from public"),
    "is_org_member execute revoked from public"
  );
  assert(
    migration9Sql.includes("grant execute on function public.is_org_member(uuid) to authenticated"),
    "is_org_member execute granted to authenticated"
  );
  assert(
    migration9Sql.includes("revoke execute on function public.has_org_role(uuid, text[]) from public"),
    "has_org_role execute revoked from public"
  );
  assert(
    migration9Sql.includes("grant execute on function public.has_org_role(uuid, text[]) to authenticated"),
    "has_org_role execute granted to authenticated"
  );
  assert(
    migration9Sql.includes("revoke execute on function public.shares_organization_with(uuid) from public"),
    "shares_organization_with execute revoked from public"
  );
  assert(
    migration9Sql.includes("grant execute on function public.shares_organization_with(uuid) to authenticated"),
    "shares_organization_with execute granted to authenticated"
  );

  // Verify storage.objects policies explicitly enforce 'to authenticated'
  const authenticatedMatches = migration9Sql.match(/to authenticated/g);
  assert(
    authenticatedMatches !== null && authenticatedMatches.length >= 4,
    "All organization_files storage policies explicitly enforce 'to authenticated'"
  );

  // Verify tenant isolation via folder UUID path
  assert(
    migration9Sql.includes("(storage.foldername(name))[1]::uuid"),
    "Storage policies enforce organization boundary via folder UUID path"
  );
  assert(
    migration9Sql.includes("bucket_id = 'organization_files'"),
    "Storage policies strictly bound to organization_files private bucket"
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
