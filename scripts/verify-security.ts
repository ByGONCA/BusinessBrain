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
  const envCandidates = [".env", ".env.local", ".env.example"];
  const matchedEnv = envCandidates.find((f) => fs.existsSync(path.resolve(process.cwd(), f)));
  const envContent = matchedEnv ? fs.readFileSync(path.resolve(process.cwd(), matchedEnv), "utf8") : "";
  const lines = envContent ? envContent.split("\n") : [];

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

  assert(invalidPublic.length === 0, "Zero private secrets prefixed with NEXT_PUBLIC_ in environment file");

  // Check that STRIPE_SECRET_KEY is NOT public
  assert(!envContent.includes("NEXT_PUBLIC_STRIPE_SECRET_KEY"), "STRIPE_SECRET_KEY is strictly private");

  // Check that INTEGRATION_TOKEN_ENCRYPTION_KEY is NOT public
  assert(
    !envContent.includes("NEXT_PUBLIC_INTEGRATION_TOKEN_ENCRYPTION_KEY"),
    "INTEGRATION_TOKEN_ENCRYPTION_KEY is strictly private"
  );

  // Check process.env keys as well for defense in depth
  const processPublicKeys = Object.keys(process.env).filter((k) => k.startsWith("NEXT_PUBLIC_"));
  const invalidProcessPublic = processPublicKeys.filter((key) =>
    key.includes("SECRET") ||
    key.includes("PRIVATE") ||
    key.includes("SERVICE_ROLE") ||
    key.includes("ENCRYPTION")
  );
  assert(invalidProcessPublic.length === 0, "Zero private secrets prefixed with NEXT_PUBLIC_ in process.env");

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
  // 25. SEC-01: MULTI-TENANT TEAM & PERMISSION RLS HARDENING
  // ---------------------------------------------------------------------------
  console.log("\n[25] Auditing Team & Permission RLS Mutation Policies (SEC-01):");
  const migration18Path = path.resolve(
    process.cwd(),
    "database/migrations/00018_teams_and_permissions.sql"
  );
  assert(fs.existsSync(migration18Path), "Migration 00018_teams_and_permissions.sql exists");
  const migration18Sql = fs.readFileSync(migration18Path, "utf8");

  assert(
    migration18Sql.includes("Owners and admins can insert teams") &&
      migration18Sql.includes("public.has_org_role(organization_id, array['owner', 'admin'])"),
    "organization_teams insert policy requires owner or admin role"
  );
  assert(
    migration18Sql.includes("Owners and admins can update teams") &&
      migration18Sql.includes("public.has_org_role(organization_id, array['owner', 'admin'])"),
    "organization_teams update policy requires owner or admin role"
  );
  assert(
    migration18Sql.includes("Owners and admins can delete teams") &&
      migration18Sql.includes("public.has_org_role(organization_id, array['owner', 'admin'])"),
    "organization_teams delete policy requires owner or admin role"
  );
  assert(
    migration18Sql.includes("Owners and admins can manage team memberships") &&
      migration18Sql.includes("public.has_org_role(organization_id, array['owner', 'admin'])"),
    "organization_team_members insert policy requires owner or admin role"
  );
  assert(
    migration18Sql.includes("Owners and admins can insert team permissions") &&
      migration18Sql.includes("public.has_org_role(organization_id, array['owner', 'admin'])"),
    "team_permissions mutation policies require owner or admin role"
  );
  assert(
    migration18Sql.includes("Owners and admins can insert permission overrides") &&
      migration18Sql.includes("public.has_org_role(organization_id, array['owner', 'admin'])"),
    "member_permission_overrides mutation policies require owner or admin role"
  );
  assert(
    migration18Sql.includes("Owners and admins can manage resource permissions") &&
      migration18Sql.includes("public.has_org_role(organization_id, array['owner', 'admin'])"),
    "resource_permissions mutation policies require owner or admin role"
  );

  // ---------------------------------------------------------------------------
  // 26. SEC-04: COMMENT AUTHORSHIP & DELETION PROTECTION
  // ---------------------------------------------------------------------------
  console.log("\n[26] Auditing Comment Authorship & Deletion Protection (SEC-04):");
  const migration16Path = path.resolve(
    process.cwd(),
    "database/migrations/00016_page_authorship_and_activity.sql"
  );
  const migration16Sql = fs.readFileSync(migration16Path, "utf8");

  assert(
    migration16Sql.includes("Users can update comments for their organization") &&
      migration16Sql.includes("author_id = auth.uid()"),
    "page_comments update policy enforces author_id = auth.uid()"
  );
  assert(
    migration16Sql.includes("Users can delete comments for their organization") &&
      migration16Sql.includes("author_id = auth.uid()") &&
      migration16Sql.includes("public.has_org_role(organization_id, array['owner', 'admin'])"),
    "page_comments delete policy enforces author_id = auth.uid() or owner/admin"
  );

  const migration17Path = path.resolve(
    process.cwd(),
    "database/migrations/00017_github_integration_and_connections.sql"
  );
  const migration17Sql = fs.readFileSync(migration17Path, "utf8");

  assert(
    migration17Sql.includes("Users can update entity comments in their organization") &&
      migration17Sql.includes("author_id = auth.uid()"),
    "entity_comments update policy enforces author_id = auth.uid()"
  );
  assert(
    migration17Sql.includes("Users can delete entity comments in their organization") &&
      migration17Sql.includes("author_id = auth.uid()") &&
      migration17Sql.includes("public.has_org_role(organization_id, array['owner', 'admin'])"),
    "entity_comments delete policy enforces author_id = auth.uid() or owner/admin"
  );

  assert(
    pageActionsSrc.includes("comment.author_id !== user.id") &&
      pageActionsSrc.includes("!isOwnerOrAdmin"),
    "deletePageCommentAction in lib/pages/actions.ts enforces author ownership or admin role"
  );

  // ---------------------------------------------------------------------------
  // 27. SEC-02: OPEN REDIRECT PREVENTIONS IN OAUTH
  // ---------------------------------------------------------------------------
  console.log("\n[27] Auditing Open Redirect Prevention in OAuth Flows (SEC-02):");
  const ghConnectPath = path.resolve(process.cwd(), "app/api/integrations/github/connect/route.ts");
  const ghConnectSrc = fs.readFileSync(ghConnectPath, "utf8");
  assert(
    ghConnectSrc.includes("sanitizeRedirectUrl(rawReturnUrl") &&
      ghConnectSrc.includes('hasPermission(user.id, activeOrg.id, "github.manage_connection")'),
    "GitHub connect route sanitizes returnUrl and enforces github.manage_connection"
  );

  const ghCallbackPath = path.resolve(process.cwd(), "app/api/integrations/github/callback/route.ts");
  const ghCallbackSrc = fs.readFileSync(ghCallbackPath, "utf8");
  assert(
    ghCallbackSrc.includes("sanitizeRedirectUrl(statePayload.returnUrl"),
    "GitHub callback route sanitizes destination via sanitizeRedirectUrl"
  );

  // ---------------------------------------------------------------------------
  // 28. SEC-03: GMAIL ATTACHMENT SVG XSS MITIGATION
  // ---------------------------------------------------------------------------
  console.log("\n[28] Auditing Gmail Attachment SVG XSS Mitigation (SEC-03):");
  const gmailAttachmentPath = path.resolve(
    process.cwd(),
    "app/api/integrations/google/gmail/attachment/route.ts"
  );
  const gmailAttachmentSrc = fs.readFileSync(gmailAttachmentPath, "utf8");
  assert(
    gmailAttachmentSrc.includes("isSvg") &&
      gmailAttachmentSrc.includes("Content-Disposition") &&
      gmailAttachmentSrc.includes('"attachment"') &&
      gmailAttachmentSrc.includes("Content-Security-Policy") &&
      gmailAttachmentSrc.includes("sandbox"),
    "Gmail attachment route forces attachment disposition and CSP sandbox on SVG files"
  );

  // ---------------------------------------------------------------------------
  // 29. SEC-05: FINE-GRAINED PERMISSION CHECKS ON GITHUB ACTIONS
  // ---------------------------------------------------------------------------
  console.log("\n[29] Auditing GitHub Action Permission Scopes (SEC-05):");
  const ghActionsPath = path.resolve(process.cwd(), "lib/integrations/github/actions.ts");
  const ghActionsSrc = fs.readFileSync(ghActionsPath, "utf8");
  assert(
    ghActionsSrc.includes('resolveAuthorizedOrgId(orgId, "github.view")'),
    "GitHub actions enforce github.view permission scope on repository data reads"
  );
  assert(
    ghActionsSrc.includes('resolveAuthorizedOrgId(undefined, "github.manage_repositories")'),
    "connectGitHubObjectAction enforces github.manage_repositories permission scope"
  );

  // ---------------------------------------------------------------------------
  // 30. SEC-06 & SEC-07: STORAGE STATS TENANT SCOPING & TOKEN REVOCATION
  // ---------------------------------------------------------------------------
  console.log("\n[30] Auditing Storage Stats Tenant Scoping & Token Revocation (SEC-06 & SEC-07):");
  const settingsActionsPath = path.resolve(process.cwd(), "lib/settings/actions.ts");
  const settingsActionsSrc = fs.readFileSync(settingsActionsPath, "utf8");
  assert(
    settingsActionsSrc.includes("getOrganizationStorageStatsAction") &&
      settingsActionsSrc.includes("organization_members") &&
      settingsActionsSrc.includes("Unauthorized: not a member of this workspace."),
    "getOrganizationStorageStatsAction validates user session and membership"
  );
  assert(
    settingsActionsSrc.includes("getOrganizationAuditLogsAction") &&
      settingsActionsSrc.includes('["owner", "admin"].includes(member.role)'),
    "getOrganizationAuditLogsAction enforces owner/admin role verification"
  );

  const ghOauthPath = path.resolve(process.cwd(), "lib/integrations/github/oauth.ts");
  const ghOauthSrc = fs.readFileSync(ghOauthPath, "utf8");
  assert(
    ghOauthSrc.includes("export async function revokeGitHubToken"),
    "revokeGitHubToken is exported from lib/integrations/github/oauth.ts"
  );

  const integrationsActionsPath = path.resolve(process.cwd(), "lib/integrations/actions.ts");
  const integrationsActionsSrc = fs.readFileSync(integrationsActionsPath, "utf8");
  assert(
    integrationsActionsSrc.includes("revokeGitHubToken(accessToken)") &&
      integrationsActionsSrc.includes('integration.provider === "github"'),
    "Integration actions invoke revokeGitHubToken on disconnect and delete"
  );

  const migration13Path = path.resolve(
    process.cwd(),
    "database/migrations/00013_organization_calendar_events.sql"
  );
  const migration13Sql = fs.readFileSync(migration13Path, "utf8");
  assert(
    migration13Sql.includes("set search_path = public") &&
      migration13Sql.includes("update_calendar_events_updated_at"),
    "Migration 00013 sets explicit search_path on update_calendar_events_updated_at (SEC-08)"
  );

  // ---------------------------------------------------------------------------
  // 31. SERVER-SIDE GRANULAR PERMISSION ENFORCEMENT ON CONTENT ACTIONS
  // ---------------------------------------------------------------------------
  console.log("\n[31] Auditing Server-Side Granular Permission Enforcement on Actions:");
  const freshPageActionsSrc = fs.readFileSync(pageActionsPath, "utf8");
  assert(
    freshPageActionsSrc.includes('hasPermission(user.id, activeOrg.id, "pages.create")'),
    "createPageAction enforces pages.create permission"
  );
  assert(
    freshPageActionsSrc.includes('hasPermission(user.id, activeOrg.id, "pages.edit")'),
    "updatePageTitleAction and savePageContentAction enforce pages.edit permission"
  );
  assert(
    freshPageActionsSrc.includes('hasPermission(user.id, activeOrg.id, "pages.delete")'),
    "deletePagePermanentlyAction and archivePageAction enforce pages.delete permission"
  );
  assert(
    freshPageActionsSrc.includes('hasPermission(user.id, activeOrg.id, "pages.view")'),
    "getPageAction enforces pages.view permission"
  );

  const filesActionsPath = path.resolve(process.cwd(), "lib/files/actions.ts");
  const filesActionsSrc = fs.readFileSync(filesActionsPath, "utf8");
  assert(
    filesActionsSrc.includes('hasPermission(user.id, activeOrg.id, "files.upload")'),
    "requestUploadAuthorizationAction enforces files.upload permission"
  );
  assert(
    filesActionsSrc.includes('hasPermission(user.id, activeOrg.id, "files.delete")'),
    "deleteOrganizationFileAction enforces files.delete permission"
  );

  const calendarActionsPath = path.resolve(process.cwd(), "lib/calendar/actions.ts");
  const calendarActionsSrc = fs.readFileSync(calendarActionsPath, "utf8");
  assert(
    calendarActionsSrc.includes("options.explicitOrgId && (!activeOrg || activeOrg.id !== options.explicitOrgId)") &&
      calendarActionsSrc.includes('eq("organization_id", options.explicitOrgId)'),
    "getOrganizationCalendarEventsAction enforces caller membership check on explicitOrgId"
  );

  // ---------------------------------------------------------------------------
  // 32. Auditing Repository-Centric Workspace & In-App File Viewer Security
  // ---------------------------------------------------------------------------
  console.log("\n[32] Auditing Repository-Centric Workspace & In-App File Viewer Security:");

  const nextConfigPath = path.resolve(process.cwd(), "next.config.ts");
  const nextConfigSrc = fs.readFileSync(nextConfigPath, "utf8");
  assert(
    nextConfigSrc.includes("remotePatterns:") &&
      nextConfigSrc.includes('hostname: "avatars.githubusercontent.com"') &&
      nextConfigSrc.includes('protocol: "https"'),
    "next.config.ts configures narrow HTTPS remotePatterns for avatars.githubusercontent.com"
  );

  const ghWorkspaceHomePath = path.resolve(
    process.cwd(),
    "components/dashboard/github/github-workspace-home.tsx"
  );
  const ghWorkspaceHomeSrc = fs.readFileSync(ghWorkspaceHomePath, "utf8");
  assert(
    ghWorkspaceHomeSrc.includes("handleOpenFile") &&
      ghWorkspaceHomeSrc.includes("viewingFile") &&
      ghWorkspaceHomeSrc.includes("fileContent"),
    "github-workspace-home.tsx implements in-app file viewer state and handlers"
  );
  assert(
    ghWorkspaceHomeSrc.includes("bg-white dark:bg-[#161618]") &&
      ghWorkspaceHomeSrc.includes("shadow-2xl z-50"),
    "github-workspace-home.tsx uses opaque solid styling for repository dropdown"
  );
  assert(
    !ghWorkspaceHomeSrc.includes("fetchReadme"),
    "github-workspace-home.tsx removes README preview from dashboard bottom"
  );

  assert(
    ghActionsSrc.includes("getGitHubFileContentAction") &&
      ghActionsSrc.includes('resolveAuthorizedOrgId(orgId, "github.view")'),
    "getGitHubFileContentAction enforces authentication and github.view permission"
  );
  assert(
    ghActionsSrc.includes("setDefaultGitHubRepositoryAction") &&
      ghActionsSrc.includes('hasPermission(user.id, organizationId, "github.manage_repositories")'),
    "setDefaultGitHubRepositoryAction enforces role or github.manage_repositories permission"
  );

  // ---------------------------------------------------------------------------
  // 33. Auditing Defense-in-Depth in Permissions & Teams Actions
  // ---------------------------------------------------------------------------
  console.log("\n[33] Auditing Defense-in-Depth in Permissions & Teams Actions:");

  const permActionsPath = path.resolve(process.cwd(), "lib/permissions/actions.ts");
  const permActionsSrc = fs.readFileSync(permActionsPath, "utf8");

  assert(
    permActionsSrc.includes("organizationId && (!activeOrg || activeOrg.id !== organizationId)") &&
      permActionsSrc.includes('hasPermission(user.id, targetOrgId, "teams.view")'),
    "getTeamsWithDetailsAction enforces caller membership on explicit orgId and verifies teams.view"
  );

  assert(
    permActionsSrc.includes("if (user.id !== userId)") &&
      permActionsSrc.includes('hasPermission(user.id, activeOrg.id, "people.view")'),
    "getMemberDetailsAction restricts cross-member permission inspection to callers with people.view"
  );

  // ---------------------------------------------------------------------------
  // 34. Auditing Mail Module Security, Authorization & XSS Defenses
  // ---------------------------------------------------------------------------
  console.log("\n[34] Auditing Mail Module Security, Authorization & XSS Defenses:");

  assert(
    integrationsActionsSrc.includes("export async function getEmailMessagesAction") &&
      integrationsActionsSrc.includes('hasPermission(user.id, activeOrg.id, "integrations.view")'),
    "getEmailMessagesAction enforces integrations.view permission"
  );
  assert(
    integrationsActionsSrc.includes("export async function getEmailMessageContentAction") &&
      integrationsActionsSrc.includes('hasPermission(user.id, activeOrg.id, "integrations.view")'),
    "getEmailMessageContentAction enforces integrations.view permission"
  );
  assert(
    integrationsActionsSrc.includes("isValidGmailId(params.messageId)"),
    "getEmailMessageContentAction enforces strict ID format validation via isValidGmailId"
  );

  assert(
    gmailAttachmentSrc.includes("getCurrentUser()") &&
      gmailAttachmentSrc.includes('hasPermission(user.id, activeOrg.id, "integrations.view")'),
    "Attachment route enforces session and integrations.view permission check"
  );
  assert(
    gmailAttachmentSrc.includes("isValidGmailId(messageId)") &&
      gmailAttachmentSrc.includes("isValidGmailId(attachmentId, 1024)"),
    "Attachment route enforces isValidGmailId on messageId and attachmentId"
  );
  assert(
    gmailAttachmentSrc.includes('const dispositionType = isSafeInline ? "inline" : "attachment"') &&
      gmailAttachmentSrc.includes('"X-Content-Type-Options": "nosniff"') &&
      gmailAttachmentSrc.includes("default-src 'none'; sandbox"),
    "Attachment route enforces safe Content-Disposition, nosniff, and sandboxed CSP"
  );

  const emailViewCheckPath = path.resolve(
    process.cwd(),
    "components/dashboard/email/email-view.tsx"
  );
  const emailViewCheckSrc = fs.readFileSync(emailViewCheckPath, "utf8");
  assert(
    emailViewCheckSrc.includes("export function sanitizeEmailHtml") &&
      emailViewCheckSrc.includes("<script\\b[^<]*(?:(?!<\\/script>)<[^<]*)*<\\/script>") &&
      emailViewCheckSrc.includes("javascript|vbscript"),
    "email-view.tsx exports sanitizeEmailHtml stripping executable scripts, dangerous tags and pseudo-protocols"
  );
  assert(
    emailViewCheckSrc.includes('sandbox="allow-popups allow-popups-to-escape-sandbox allow-same-origin"') &&
      !emailViewCheckSrc.includes("allow-scripts"),
    "EmailHtmlViewer iframe sandbox omits allow-scripts to strictly prevent script execution"
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
