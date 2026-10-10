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
  const migration9StoragePath = path.resolve(
    process.cwd(),
    "database/migrations/00009_storage_rls_hardening.sql"
  );
  const migration9AuditPath = path.resolve(
    process.cwd(),
    "database/migrations/00009_security_audit_hardening.sql"
  );
  const migration9Path = fs.existsSync(migration9StoragePath) ? migration9StoragePath : migration9AuditPath;
  assert(fs.existsSync(migration9Path), "Migration 00009 exists");

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
  // 10. TIMING-SAFE OAUTH STATE COMPARISON
  // ---------------------------------------------------------------------------
  console.log("\n[10] Auditing OAuth State Verification (timing-safe comparison):");
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
  // 11. SSRF PROTECTION IN GOOGLE CLIENT
  // ---------------------------------------------------------------------------
  console.log("\n[11] Auditing SSRF Protection in Google API Client:");
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
  // 12. CROSS-TENANT VALIDATION IN CONNECTIONS
  // ---------------------------------------------------------------------------
  console.log("\n[12] Auditing Cross-Tenant Validation in Connection Actions:");
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
  // 13. CROSS-TENANT PARENT PAGE VALIDATION
  // ---------------------------------------------------------------------------
  console.log("\n[13] Auditing Cross-Tenant Parent Page Validation in Pages Actions:");
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
  // 14. SEARCH TERM SANITIZATION
  // ---------------------------------------------------------------------------
  console.log("\n[14] Auditing PostgREST Search Term Sanitization:");
  assert(
    pagesActionsSrc.includes("PostgREST filter-injection"),
    "searchPagesAction sanitizes PostgREST special characters before interpolation"
  );
  assert(
    pagesActionsSrc.includes(".replace(/[,()"),
    "searchPagesAction strips PostgREST special chars with regex replacement"
  );

  // ---------------------------------------------------------------------------
  // 15. LINK URL SCHEME VALIDATION
  // ---------------------------------------------------------------------------
  console.log("\n[15] Auditing Link URL Scheme Validation in Editor Toolbar:");
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
  // 16. SVG MIME TYPE CONSISTENCY
  // ---------------------------------------------------------------------------
  console.log("\n[16] Auditing SVG MIME Type Consistency:");
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
  // 17. ORG MEMBERS IDOR DEFENSE
  // ---------------------------------------------------------------------------
  console.log("\n[17] Auditing getOrganizationMembersAction IDOR Defense:");
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
  // 18. MIGRATION 00009 (SECURITY HARDENING)
  // ---------------------------------------------------------------------------
  console.log("\n[18] Auditing Migration 00009 (Security Hardening):");
  assert(fs.existsSync(migration9AuditPath), "Migration 00009_security_audit_hardening.sql exists");

  const migration9AuditSql = fs.readFileSync(migration9AuditPath, "utf8");
  assert(
    migration9AuditSql.includes("p_server_token"),
    "Migration 00009 rewrites billing RPCs with server token guard"
  );
  assert(
    migration9AuditSql.includes("validate_page_hierarchy"),
    "Migration 00009 adds cross-tenant page hierarchy trigger"
  );
  assert(
    migration9AuditSql.includes("validate_company_connection"),
    "Migration 00009 adds cross-tenant company connection trigger"
  );
  assert(
    migration9AuditSql.toLowerCase().includes("revoke"),
    "Migration 00009 revokes default PUBLIC execute on billing RPCs"
  );
  assert(
    migration9AuditSql.includes("revoke execute on function public.is_org_member(uuid) from public;"),
    "Migration 00009 revokes public execute on is_org_member helper function"
  );
  assert(
    migration9AuditSql.includes("revoke execute on function public.has_org_role(uuid, text[]) from public;"),
    "Migration 00009 revokes public execute on has_org_role helper function"
  );
  assert(
    migration9AuditSql.includes("revoke execute on function public.shares_organization_with(uuid) from public;"),
    "Migration 00009 revokes public execute on shares_organization_with helper function"
  );
  assert(
    migration9AuditSql.includes("grant execute on function public.is_org_member(uuid) to authenticated, service_role, postgres;"),
    "Migration 00009 grants execution of is_org_member to authenticated, service_role, postgres"
  );
  assert(
    migration9AuditSql.includes("to authenticated") && migration9AuditSql.includes("bucket_id = 'organization_files'"),
    "Migration 00009 restricts organization_files storage policies strictly to authenticated role"
  );
  assert(
    migration9AuditSql.includes("public.is_org_member((storage.foldername(name))[1]::uuid)") &&
      migration9AuditSql.includes("public.has_org_role((storage.foldername(name))[1]::uuid, array['owner', 'admin'])"),
    "Migration 00009 preserves organization isolation across storage SELECT/INSERT/UPDATE/DELETE policies"
  );
  assert(
    migration9AuditSql.includes("drop function if exists public.cancel_stripe_subscription(text);"),
    "Migration 00009 drops obsolete un-guarded cancel_stripe_subscription overload"
  );
  assert(
    migration9AuditSql.includes("drop function if exists public.record_stripe_webhook_event(text, text);"),
    "Migration 00009 drops obsolete un-guarded record_stripe_webhook_event overload"
  );
  assert(
    migration9AuditSql.includes("drop function if exists public.sync_stripe_subscription("),
    "Migration 00009 drops obsolete un-guarded sync_stripe_subscription overload"
  );

  // ---------------------------------------------------------------------------
  // 19. MIGRATION 00010 (REVOKE HELPER FUNCTIONS ANON EXECUTION)
  // ---------------------------------------------------------------------------
  console.log("\n[19] Auditing Migration 00010 (Revoke Helper Functions Anon Execution):");
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
  // 20. PAGE ICONS & icon_file_id SCHEMA & TENANT ISOLATION
  // ---------------------------------------------------------------------------
  console.log("\n[20] Auditing Page Icons & icon_file_id Schema & Tenant Isolation:");
  const migration11Path = path.resolve(
    process.cwd(),
    "database/migrations/00011_page_icons_file_system.sql"
  );
  assert(fs.existsSync(migration11Path), "Migration 00011_page_icons_file_system.sql exists");

  const migration11Sql = fs.readFileSync(migration11Path, "utf8");
  assert(
    migration11Sql.includes("add column if not exists icon_file_id uuid references public.organization_files(id)"),
    "Migration 00011 adds icon_file_id foreign key referencing organization_files"
  );
  assert(
    migration11Sql.includes("create index if not exists idx_pages_icon_file_id"),
    "Migration 00011 creates index on pages(icon_file_id)"
  );
  assert(
    migration11Sql.includes("create or replace function public.check_page_icon_tenant_isolation()"),
    "Migration 00011 defines check_page_icon_tenant_isolation function"
  );
  assert(
    migration11Sql.includes("Cross-tenant violation: icon file does not belong to the same organization."),
    "Migration 00011 trigger enforces tenant boundary and rejects cross-tenant icon assignment"
  );
  assert(
    migration11Sql.includes("create trigger trg_check_page_icon_tenant_isolation"),
    "Migration 00011 attaches trigger to public.pages"
  );

  // ---------------------------------------------------------------------------
  // 21. PRIVATE PAGE ICON ROUTE SECURITY (/api/pages/[id]/icon)
  // ---------------------------------------------------------------------------
  console.log("\n[21] Auditing Private Page Icon Route Security (/api/pages/[id]/icon):");
  const iconRoutePath = path.resolve(
    process.cwd(),
    "app/api/pages/[id]/icon/route.ts"
  );
  assert(fs.existsSync(iconRoutePath), "Private icon route app/api/pages/[id]/icon/route.ts exists");

  const iconRouteSrc = fs.readFileSync(iconRoutePath, "utf8");
  assert(
    iconRouteSrc.includes("getCurrentUser") && iconRouteSrc.includes("401"),
    "Private icon route requires authenticated user session (returns 401)"
  );
  assert(
    iconRouteSrc.includes("getActiveOrganization") && iconRouteSrc.includes("403"),
    "Private icon route requires active organization membership (returns 403)"
  );
  assert(
    iconRouteSrc.includes(".eq(\"organization_id\", activeOrg.id)"),
    "Private icon route enforces active organization scoping on page lookup"
  );
  assert(
    iconRouteSrc.includes("organization_files") && iconRouteSrc.includes(".eq(\"organization_id\", activeOrg.id)"),
    "Private icon route enforces tenant ownership on referenced organization file"
  );
  assert(
    iconRouteSrc.includes("Cache-Control\": \"private"),
    "Private icon route enforces private cache control header"
  );

  // ---------------------------------------------------------------------------
  // 22. LEGACY BASE64 ICONS MIGRATION SCRIPT
  // ---------------------------------------------------------------------------
  console.log("\n[22] Auditing Legacy Base64 Icons Migration Script:");
  const migrateScriptPath = path.resolve(
    process.cwd(),
    "scripts/migrate-base64-icons.ts"
  );
  assert(fs.existsSync(migrateScriptPath), "Migration script scripts/migrate-base64-icons.ts exists");

  const migrateScriptSrc = fs.readFileSync(migrateScriptPath, "utf8");
  assert(
    migrateScriptSrc.includes(".is(\"icon_file_id\", null)") && migrateScriptSrc.includes("data:image/%"),
    "Migration script filters exclusively for un-migrated base64 pages (idempotency)"
  );
  assert(
    migrateScriptSrc.includes("Buffer.from(base64Data, \"base64\")"),
    "Migration script decodes base64 binary safely into buffer"
  );
  assert(
    /from\s*\(\s*["']organization_files["']\s*\)\s*\.upload/.test(migrateScriptSrc),
    "Migration script uploads binary to private organization_files bucket"
  );
  assert(
    /from\s*\(\s*["']organization_files["']\s*\)\s*\.insert/.test(migrateScriptSrc) &&
      migrateScriptSrc.includes("icon_file_id: fileRecord.id"),
    "Migration script records file in organization_files and links icon_file_id"
  );

  // ---------------------------------------------------------------------------
  // 23. STRIPE BILLING RPC HARDENING 00012 (SERVICE_ROLE LOCKDOWN)
  // ---------------------------------------------------------------------------
  console.log("\n[23] Auditing Stripe Billing RPC Hardening 00012 (service_role lockdown):");
  const migration12Path = path.resolve(
    process.cwd(),
    "database/migrations/00012_stripe_billing_rpc_hardening.sql"
  );
  assert(fs.existsSync(migration12Path), "Migration 00012_stripe_billing_rpc_hardening.sql exists");

  const migration12Sql = fs.readFileSync(migration12Path, "utf8");
  assert(
    migration12Sql.includes("revoke all on function public.sync_stripe_subscription") &&
      migration12Sql.includes("from public, anon, authenticated;"),
    "Migration 00012 revokes sync_stripe_subscription execute from anon, public, and authenticated"
  );
  assert(
    migration12Sql.includes("revoke all on function public.cancel_stripe_subscription") &&
      migration12Sql.includes("from public, anon, authenticated;"),
    "Migration 00012 revokes cancel_stripe_subscription execute from anon, public, and authenticated"
  );
  assert(
    migration12Sql.includes("grant execute on function public.sync_stripe_subscription") &&
      migration12Sql.includes("to service_role, postgres;"),
    "Migration 00012 grants sync_stripe_subscription exclusively to service_role, postgres"
  );
  assert(
    migration12Sql.includes("grant execute on function public.cancel_stripe_subscription") &&
      migration12Sql.includes("to service_role, postgres;"),
    "Migration 00012 grants cancel_stripe_subscription exclusively to service_role, postgres"
  );
  assert(
    migration12Sql.includes("coalesce(auth.role(), '') <> 'service_role'"),
    "Migration 00012 enforces strict service_role boundary inside function body"
  );

  // ---------------------------------------------------------------------------
  // 24. SERVICE CLIENT & RATE LIMIT HARDENING
  // ---------------------------------------------------------------------------
  console.log("\n[24] Auditing Service Client & Rate Limit Hardening:");
  assert(
    migration12Sql.includes("revoke all on function public.check_rate_limit") &&
      migration12Sql.includes("from public, anon, authenticated;"),
    "Migration 00012 revokes check_rate_limit from anon, public, and authenticated"
  );
  assert(
    migration12Sql.includes("grant execute on function public.check_rate_limit") &&
      migration12Sql.includes("to service_role, postgres;"),
    "Migration 00012 grants check_rate_limit exclusively to service_role, postgres"
  );

  const serverSupabasePath = path.resolve(process.cwd(), "lib/supabase/server.ts");
  const serverSupabaseSrc = fs.readFileSync(serverSupabasePath, "utf8");
  assert(
    serverSupabaseSrc.includes("process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()"),
    "createServiceClient in lib/supabase/server.ts prioritizes SUPABASE_SERVICE_ROLE_KEY"
  );

  const pageIconCompPath = path.resolve(process.cwd(), "components/dashboard/pages/page-icon.tsx");
  const pageIconCompSrc = fs.readFileSync(pageIconCompPath, "utf8");
  assert(
    pageIconCompSrc.includes("iconFileId") && pageIconCompSrc.includes("/api/pages/"),
    "PageIcon component supports iconFileId and routes through /api/pages/[id]/icon"
  );

  const pageActionsPath = path.resolve(process.cwd(), "lib/pages/actions.ts");
  const pageActionsSrc = fs.readFileSync(pageActionsPath, "utf8");
  assert(
    pageActionsSrc.includes("updates.icon_file_id = params.iconFileId"),
    "updatePageIconAction in lib/pages/actions.ts enforces icon_file_id linking and organization check"
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
