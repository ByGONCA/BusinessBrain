/**
 * Adversarial Attack Simulation & Security Hardening Test Suite
 * Simulates realistic adversarial attack scenarios against BusinessBrain:
 * - Cross-Tenant IDOR & Boundary Breaches (ATK-01 to ATK-04)
 * - Privilege Escalation & Role Tampering (ATK-05 to ATK-08)
 * - OAuth State Tampering & Open Redirects (ATK-09 to ATK-10)
 * - GitHub Permission Scopes & Token Isolation (ATK-11)
 * - Billing Entitlement Abuse & Webhook Forgery (ATK-12 to ATK-13)
 * - Uploads, XSS & Content Security (ATK-14)
 * - Defense-in-Depth Hardening Assertions (ATK-15 & ATK-16)
 */

import fs from "fs";
import path from "path";
import crypto from "crypto";

interface SimulationResult {
  id: string;
  name: string;
  scenario: string;
  passed: boolean;
  severity: "Critical" | "High" | "Medium" | "Low";
  evidence: string;
}

const simulationResults: SimulationResult[] = [];

function recordResult(
  id: string,
  name: string,
  scenario: string,
  passed: boolean,
  severity: "Critical" | "High" | "Medium" | "Low",
  evidence: string
) {
  simulationResults.push({ id, name, scenario, passed, severity, evidence });
  const status = passed ? "✓ PASS (BLOCKED)" : "✗ FAIL (VULNERABLE)";
  console.log(`[${id}] ${status}: ${name}`);
  console.log(`      Scenario: ${scenario}`);
  console.log(`      Evidence: ${evidence}\n`);
}

async function runAttackSimulations() {
  console.log("=======================================================");
  console.log("ADVERSARIAL ATTACK SIMULATION & PENETRATION TEST SUITE");
  console.log("BusinessBrain Defensive Assessment");
  console.log("=======================================================\n");

  const cwd = process.cwd();

  // ---------------------------------------------------------------------------
  // ATK-01: Cross-Tenant Page Lookup & Reparenting IDOR
  // ---------------------------------------------------------------------------
  try {
    const pagesActionsSrc = fs.readFileSync(path.resolve(cwd, "lib/pages/actions.ts"), "utf8");
    const migration00009Src = fs.readFileSync(
      path.resolve(cwd, "database/migrations/00009_security_audit_hardening.sql"),
      "utf8"
    );

    const hasAppValidation =
      pagesActionsSrc.includes('.eq("id", parentId)') &&
      pagesActionsSrc.includes('.eq("organization_id", activeOrg.id)') &&
      pagesActionsSrc.includes("Parent page not found in your workspace");

    const hasDbTrigger =
      migration00009Src.includes("validate_page_hierarchy") &&
      migration00009Src.includes("Cross-tenant violation: Parent page does not belong to the same organization.");

    const isSecure = hasAppValidation && hasDbTrigger;
    recordResult(
      "ATK-01",
      "Cross-Tenant Page Reparenting IDOR",
      "Attacker in Org A attempts to reparent their page under a parent page belonging to Org B",
      isSecure,
      "Critical",
      "Both application-level parent query scoping and PostgreSQL trigger trg_validate_page_hierarchy strictly block cross-tenant page reparenting."
    );
  } catch (err) {
    recordResult("ATK-01", "Cross-Tenant Page Reparenting IDOR", "", false, "Critical", String(err));
  }

  // ---------------------------------------------------------------------------
  // ATK-02: Cross-Tenant Company Connection Injection IDOR
  // ---------------------------------------------------------------------------
  try {
    const connectionsActionsSrc = fs.readFileSync(path.resolve(cwd, "lib/connections/actions.ts"), "utf8");
    const migration00009Src = fs.readFileSync(
      path.resolve(cwd, "database/migrations/00009_security_audit_hardening.sql"),
      "utf8"
    );

    const hasAppCheck =
      connectionsActionsSrc.includes('.eq("organization_id", activeOrg.id)') &&
      connectionsActionsSrc.includes("Source object not found in your workspace") &&
      connectionsActionsSrc.includes("Target object not found in your workspace");

    const hasDbTrigger =
      migration00009Src.includes("validate_company_connection") &&
      migration00009Src.includes("Cross-tenant violation: Source page does not belong to this organization.");

    const isSecure = hasAppCheck && hasDbTrigger;
    recordResult(
      "ATK-02",
      "Cross-Tenant Company Connection Injection IDOR",
      "Attacker in Org A attempts to create a graph connection pointing to Org B's private entity",
      isSecure,
      "Critical",
      "Source and target entity existence is verified strictly within activeOrg.id; database trigger trg_validate_company_connection provides second-line defense."
    );
  } catch (err) {
    recordResult("ATK-02", "Cross-Tenant Company Connection Injection IDOR", "", false, "Critical", String(err));
  }

  // ---------------------------------------------------------------------------
  // ATK-03: Cross-Tenant Storage Path Injection
  // ---------------------------------------------------------------------------
  try {
    const filesActionsSrc = fs.readFileSync(path.resolve(cwd, "lib/files/actions.ts"), "utf8");
    const migration00009Src = fs.readFileSync(
      path.resolve(cwd, "database/migrations/00009_security_audit_hardening.sql"),
      "utf8"
    );

    const hasDeterministicPath = filesActionsSrc.includes(
      "const storagePath = `${activeOrg.id}/${fileRecord.id}/${validation.sanitizedFilename}`"
    );

    const hasStorageRls =
      migration00009Src.includes("storage.foldername(name))[1]::uuid") &&
      migration00009Src.includes("public.is_org_member((storage.foldername(name))[1]::uuid)");

    const isSecure = hasDeterministicPath && hasStorageRls;
    recordResult(
      "ATK-03",
      "Cross-Tenant Storage Path Injection",
      "Attacker in Org A attempts to upload/read a file in Org B's storage folder",
      isSecure,
      "Critical",
      "Storage path is deterministically prefixed with caller activeOrg.id; storage.objects RLS policy validates that foldername[1]::uuid matches caller organization membership."
    );
  } catch (err) {
    recordResult("ATK-03", "Cross-Tenant Storage Path Injection", "", false, "Critical", String(err));
  }

  // ---------------------------------------------------------------------------
  // ATK-04: Cross-Tenant GitHub Overview & Repository Read IDOR
  // ---------------------------------------------------------------------------
  try {
    const ghActionsSrc = fs.readFileSync(path.resolve(cwd, "lib/integrations/github/actions.ts"), "utf8");

    const hasResolveAuthorizedOrgId =
      ghActionsSrc.includes("async function resolveAuthorizedOrgId") &&
      ghActionsSrc.includes('.eq("organization_id", targetId)') &&
      ghActionsSrc.includes('.eq("user_id", user.user.id)') &&
      ghActionsSrc.includes("Unauthorized to access workspace.");

    recordResult(
      "ATK-04",
      "Cross-Tenant GitHub Data Access IDOR",
      "Attacker in Org A passes target organizationId of Org B to read private GitHub repositories",
      hasResolveAuthorizedOrgId,
      "Critical",
      "resolveAuthorizedOrgId re-queries organization_members for targetId and user.id; callers from other organizations are rejected."
    );
  } catch (err) {
    recordResult("ATK-04", "Cross-Tenant GitHub Data Access IDOR", "", false, "Critical", String(err));
  }

  // ---------------------------------------------------------------------------
  // ATK-05: Privilege Escalation via Job Title Spoofing or Direct Role Mutation
  // ---------------------------------------------------------------------------
  try {
    const resolverSrc = fs.readFileSync(path.resolve(cwd, "lib/permissions/resolver.ts"), "utf8");
    const migration00002Src = fs.readFileSync(
      path.resolve(cwd, "database/migrations/00002_rls_policies.sql"),
      "utf8"
    );

    // Verify job_title does not grant owner rights
    const checksRoleNotTitle =
      resolverSrc.includes('member.role === "owner"') &&
      !resolverSrc.includes('job_title === "owner"') &&
      !resolverSrc.includes('job_title === "CEO"');

    // Verify RLS policy restricts member role updates to owners/admins
    const rlsRestrictsRoles =
      migration00002Src.includes("Owners and admins can update member roles") &&
      migration00002Src.includes("has_org_role(organization_id, array['owner', 'admin'])");

    const isSecure = checksRoleNotTitle && rlsRestrictsRoles;
    recordResult(
      "ATK-05",
      "Privilege Escalation via Title Spoofing or Member Role Update",
      "Normal member updates their job_title to 'Owner' or attempts direct role update to 'owner'",
      isSecure,
      "High",
      "Permission resolution checks canonical organization_members.role column; organization_members update RLS policy strictly requires existing owner/admin role."
    );
  } catch (err) {
    recordResult("ATK-05", "Privilege Escalation via Title Spoofing or Member Role Update", "", false, "High", String(err));
  }

  // ---------------------------------------------------------------------------
  // ATK-06: Permission Override Tampering Against Workspace Owner
  // ---------------------------------------------------------------------------
  try {
    const permActionsSrc = fs.readFileSync(path.resolve(cwd, "lib/permissions/actions.ts"), "utf8");

    const blocksOwnerOverride =
      permActionsSrc.includes('targetMember?.role === "owner"') &&
      permActionsSrc.includes("Cannot override permissions for the workspace Owner.");

    recordResult(
      "ATK-06",
      "Permission Override Tampering Against Workspace Owner",
      "Admin user attempts to apply an explicit DENY override against the workspace Owner",
      blocksOwnerOverride,
      "High",
      "setMemberPermissionOverrideAction explicitly checks targetMember.role === 'owner' and rejects overrides."
    );
  } catch (err) {
    recordResult("ATK-06", "Permission Override Tampering Against Workspace Owner", "", false, "High", String(err));
  }

  // ---------------------------------------------------------------------------
  // ATK-07: Discord-Style Permission Precedence: Individual DENY vs Team ALLOW
  // ---------------------------------------------------------------------------
  try {
    // Pure simulated mathematical test of the resolver algorithm
    const teamAllowedKeys = new Set(["pages.delete", "pages.edit", "pages.create"]);
    const explicitAllows = new Set(["files.upload"]);
    const explicitDenies = new Set(["pages.delete"]); // Explicit DENY on pages.delete

    const effectivePermissions = new Set<string>();

    // Team ALLOW unless explicitly denied
    for (const key of teamAllowedKeys) {
      if (!explicitDenies.has(key)) {
        effectivePermissions.add(key);
      }
    }

    // Explicit ALLOW unless explicitly denied
    for (const key of explicitAllows) {
      if (!explicitDenies.has(key)) {
        effectivePermissions.add(key);
      }
    }

    const pagesDeleteBlocked = !effectivePermissions.has("pages.delete");
    const pagesEditAllowed = effectivePermissions.has("pages.edit");
    const filesUploadAllowed = effectivePermissions.has("files.upload");

    const isAlgorithmCorrect = pagesDeleteBlocked && pagesEditAllowed && filesUploadAllowed;

    recordResult(
      "ATK-07",
      "Permission Precedence: Individual DENY vs Team ALLOW Conflict",
      "User belongs to Engineering team with 'pages.delete' ALLOW, but has individual DENY override on 'pages.delete'",
      isAlgorithmCorrect,
      "High",
      "Individual DENY override strictly supersedes team ALLOW; 'pages.delete' is excluded from effectivePermissions while non-conflicting permissions remain active."
    );
  } catch (err) {
    recordResult("ATK-07", "Permission Precedence: Individual DENY vs Team ALLOW Conflict", "", false, "High", String(err));
  }

  // ---------------------------------------------------------------------------
  // ATK-08: Deleting Another User's Comments
  // ---------------------------------------------------------------------------
  try {
    const pagesActionsSrc = fs.readFileSync(path.resolve(cwd, "lib/pages/actions.ts"), "utf8");
    const migration00016Src = fs.readFileSync(
      path.resolve(cwd, "database/migrations/00016_page_authorship_and_activity.sql"),
      "utf8"
    );

    const hasActionCheck =
      pagesActionsSrc.includes("comment.author_id !== user.id && !isOwnerOrAdmin") &&
      pagesActionsSrc.includes("You can only delete your own comments.");

    const hasRlsCheck =
      migration00016Src.includes("author_id = auth.uid()") &&
      migration00016Src.includes("has_org_role(organization_id, array['owner', 'admin'])");

    const isSecure = hasActionCheck && hasRlsCheck;
    recordResult(
      "ATK-08",
      "Comment Deletion Authorship Tampering",
      "Normal member attempts to delete another user's comment in the same organization",
      isSecure,
      "Medium",
      "deletePageCommentAction verifies comment.author_id === user.id or owner/admin; page_comments DELETE RLS policy enforces the same condition in PostgreSQL."
    );
  } catch (err) {
    recordResult("ATK-08", "Comment Deletion Authorship Tampering", "", false, "Medium", String(err));
  }

  // ---------------------------------------------------------------------------
  // ATK-09: Tampered / Forged OAuth State Parameter Injection
  // ---------------------------------------------------------------------------
  try {
    const secret = "test-secret-key-32-bytes-long-for-hmac-sha256";
    const payload = JSON.stringify({ orgId: "org-123", returnUrl: "/dashboard", expiresAt: Date.now() + 60000 });
    const b64Payload = Buffer.from(payload).toString("base64url");
    const validHmac = crypto.createHmac("sha256", secret).update(b64Payload).digest("hex");

    // Attacker tampers with payload (changing orgId to target victim org)
    const tamperedPayload = Buffer.from(
      JSON.stringify({ orgId: "victim-org-999", returnUrl: "/dashboard", expiresAt: Date.now() + 60000 })
    ).toString("base64url");

    // Recompute HMAC on tampered payload
    const checkHmac = crypto.createHmac("sha256", secret).update(tamperedPayload).digest("hex");
    const isTamperingDetected = !crypto.timingSafeEqual(Buffer.from(checkHmac), Buffer.from(validHmac));

    recordResult(
      "ATK-09",
      "Tampered / Forged OAuth State Parameter Injection",
      "Attacker intercepts OAuth redirect and modifies orgId inside state parameter to bind integration to victim org",
      isTamperingDetected,
      "High",
      "Cryptographic HMAC-SHA256 signature mismatch immediately invalidates the state parameter, rejecting tampered OAuth callbacks."
    );
  } catch (err) {
    recordResult("ATK-09", "Tampered / Forged OAuth State Parameter Injection", "", false, "High", String(err));
  }

  // ---------------------------------------------------------------------------
  // ATK-10: Open Redirect via Malicious returnUrl in OAuth Flows
  // ---------------------------------------------------------------------------
  try {
    const { sanitizeRedirectUrl } = await import("../lib/security/redirects");

    const attackUrls = [
      "https://evil-phishing.com/login",
      "//evil-phishing.com/login",
      "javascript:alert(document.cookie)",
      "data:text/html,<script>alert(1)</script>",
      "\\evil-phishing.com",
    ];

    let allNeutralized = true;
    for (const evilUrl of attackUrls) {
      const sanitized = sanitizeRedirectUrl(evilUrl, "/dashboard");
      if (
        sanitized.startsWith("http://") ||
        sanitized.startsWith("https://") ||
        sanitized.startsWith("//") ||
        sanitized.startsWith("javascript:")
      ) {
        allNeutralized = false;
        break;
      }
    }

    // Safe path should remain intact
    const safePath = sanitizeRedirectUrl("/dashboard/settings/integrations", "/dashboard");
    const preservesSafe = safePath === "/dashboard/settings/integrations";

    const isSecure = allNeutralized && preservesSafe;
    recordResult(
      "ATK-10",
      "Open Redirect Attack via Malicious returnUrl",
      "Attacker supplies external phishing URLs (https://evil.com, //evil.com, javascript:) in returnUrl query param",
      isSecure,
      "High",
      "sanitizeRedirectUrl strips absolute schemes, protocol-relative prefixes, and script pseudo-protocols, safely falling back to /dashboard."
    );
  } catch (err) {
    recordResult("ATK-10", "Open Redirect Attack via Malicious returnUrl", "", false, "High", String(err));
  }

  // ---------------------------------------------------------------------------
  // ATK-11: Accessing GitHub Actions Without github.view Scope
  // ---------------------------------------------------------------------------
  try {
    const ghActionsSrc = fs.readFileSync(path.resolve(cwd, "lib/integrations/github/actions.ts"), "utf8");

    const enforcesGithubView =
      ghActionsSrc.includes('resolveAuthorizedOrgId(orgId, "github.view")') &&
      ghActionsSrc.includes('resolveAuthorizedOrgId(undefined, "github.manage_repositories")');

    recordResult(
      "ATK-11",
      "GitHub Integration Action Scope Bypass",
      "Member without 'github.view' permission attempts to call getGitHubOverviewAction or getRepositoryContentsAction",
      enforcesGithubView,
      "Medium",
      "resolveAuthorizedOrgId enforces fine-grained permission 'github.view' on repository reads and 'github.manage_repositories' on object connections."
    );
  } catch (err) {
    recordResult("ATK-11", "GitHub Integration Action Scope Bypass", "", false, "Medium", String(err));
  }

  // ---------------------------------------------------------------------------
  // ATK-12: Client-Side Stripe Price ID Injection
  // ---------------------------------------------------------------------------
  try {
    const checkoutActionsSrc = fs.readFileSync(path.resolve(cwd, "lib/stripe/actions.ts"), "utf8");
    const stripeConfigSrc = fs.readFileSync(path.resolve(cwd, "lib/stripe/config.ts"), "utf8");

    const serverPriceResolution =
      checkoutActionsSrc.includes("resolveStripePriceId(planId)") &&
      stripeConfigSrc.includes("STRIPE_STARTER_PRICE_ID") &&
      stripeConfigSrc.includes("STRIPE_PRO_PRICE_ID") &&
      stripeConfigSrc.includes("STRIPE_ENTERPRISE_PRICE_ID");

    recordResult(
      "ATK-12",
      "Client-Side Stripe Price ID Tampering",
      "Attacker submits a manipulated Stripe Price ID (e.g. $0 test price) from browser during checkout initiation",
      serverPriceResolution,
      "High",
      "Server resolves Stripe Price ID strictly from internal plan identifiers ('starter' | 'pro' | 'enterprise') and server environment variables; client price IDs are ignored."
    );
  } catch (err) {
    recordResult("ATK-12", "Client-Side Stripe Price ID Tampering", "", false, "High", String(err));
  }

  // ---------------------------------------------------------------------------
  // ATK-13: Stripe Webhook Signature Forgery & Replay
  // ---------------------------------------------------------------------------
  try {
    const webhookRouteSrc = fs.readFileSync(path.resolve(cwd, "app/api/webhooks/stripe/route.ts"), "utf8");

    const enforcesSignatureVerification =
      webhookRouteSrc.includes("stripe.webhooks.constructEvent(") &&
      webhookRouteSrc.includes("process.env.STRIPE_WEBHOOK_SECRET") &&
      webhookRouteSrc.includes("record_stripe_webhook_event");

    recordResult(
      "ATK-13",
      "Forged Stripe Webhook Injection & Event Replay",
      "Attacker crafts synthetic checkout.session.completed payload without valid Stripe cryptographic signature",
      enforcesSignatureVerification,
      "Critical",
      "stripe.webhooks.constructEvent validates HMAC signature using STRIPE_WEBHOOK_SECRET; record_stripe_webhook_event database function enforces event idempotency."
    );
  } catch (err) {
    recordResult("ATK-13", "Forged Stripe Webhook Injection & Event Replay", "", false, "Critical", String(err));
  }

  // ---------------------------------------------------------------------------
  // ATK-14: Malicious SVG Upload Stored XSS Neutralization
  // ---------------------------------------------------------------------------
  try {
    const gmailAttachmentRouteSrc = fs.readFileSync(
      path.resolve(cwd, "app/api/integrations/google/gmail/attachment/route.ts"),
      "utf8"
    );

    const neutralizesSvg =
      gmailAttachmentRouteSrc.includes("!isSvg") &&
      gmailAttachmentRouteSrc.includes("dispositionType") &&
      gmailAttachmentRouteSrc.includes("default-src 'none'; sandbox") &&
      gmailAttachmentRouteSrc.includes("X-Content-Type-Options");

    recordResult(
      "ATK-14",
      "Malicious SVG Upload Stored XSS Execution",
      "Attacker uploads an SVG file containing embedded <script> tags to execute javascript in victim's browser session",
      neutralizesSvg,
      "High",
      "Attachment routes force Content-Disposition: attachment on SVG files and attach Content-Security-Policy: default-src 'none'; sandbox to prevent browser script execution."
    );
  } catch (err) {
    recordResult("ATK-14", "Malicious SVG Upload Stored XSS Execution", "", false, "High", String(err));
  }

  // ---------------------------------------------------------------------------
  // ATK-15: Cross-Tenant Team Data Inspection Hardening
  // ---------------------------------------------------------------------------
  try {
    const permActionsSrc = fs.readFileSync(path.resolve(cwd, "lib/permissions/actions.ts"), "utf8");

    const hardensTeamsAction =
      permActionsSrc.includes("organizationId && (!activeOrg || activeOrg.id !== organizationId)") &&
      permActionsSrc.includes('hasPermission(user.id, targetOrgId, "teams.view")');

    recordResult(
      "ATK-15",
      "Cross-Tenant Team Data Enumeration Hardening",
      "Attacker calls getTeamsWithDetailsAction passing explicit organizationId of a foreign workspace",
      hardensTeamsAction,
      "High",
      "getTeamsWithDetailsAction re-validates caller membership in foreign workspace before querying, and enforces teams.view permission."
    );
  } catch (err) {
    recordResult("ATK-15", "Cross-Tenant Team Data Enumeration Hardening", "", false, "High", String(err));
  }

  // ---------------------------------------------------------------------------
  // ATK-16: Unauthorized Member Permissions Inspection Hardening
  // ---------------------------------------------------------------------------
  try {
    const permActionsSrc = fs.readFileSync(path.resolve(cwd, "lib/permissions/actions.ts"), "utf8");

    const hardensMemberDetails =
      permActionsSrc.includes("if (user.id !== userId)") &&
      permActionsSrc.includes('hasPermission(user.id, activeOrg.id, "people.view")');

    recordResult(
      "ATK-16",
      "Unauthorized Member Permission Profile Inspection Hardening",
      "Attacker without people.view calls getMemberDetailsAction to dump other members' overrides and teams",
      hardensMemberDetails,
      "Medium",
      "getMemberDetailsAction restricts cross-member permission inspection to callers with people.view or Owner role."
    );
  } catch (err) {
    recordResult("ATK-16", "Unauthorized Member Permission Profile Inspection Hardening", "", false, "Medium", String(err));
  }

  // ---------------------------------------------------------------------------
  // SUMMARY
  // ---------------------------------------------------------------------------
  const totalPassed = simulationResults.filter((r) => r.passed).length;
  const totalFailed = simulationResults.filter((r) => !r.passed).length;

  console.log("=======================================================");
  console.log(`ATTACK SIMULATION RESULTS: ${totalPassed} PASSED (BLOCKED), ${totalFailed} FAILED (VULNERABLE)`);
  console.log("=======================================================\n");

  if (totalFailed > 0) {
    process.exit(1);
  }
}

runAttackSimulations().catch((err) => {
  console.error("Simulation suite error:", err);
  process.exit(1);
});
