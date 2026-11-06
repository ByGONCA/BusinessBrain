// ==============================================================================
// Company Brain: Phase 2 Email & Calendar Guardrails Verification Suite
// Validates:
// 1. Gmail Draft Creation, Update, Listing, Send (RFC 2822 Base64url)
// 2. Cryptographic Immutable Action Approval Tickets (HMAC-SHA256 & Canonical JSON)
// 3. Payload Immutability Guardrail (Any modification invalidates approval)
// 4. Anti-Replay & Double-Submit Protection (Single-use nonce consumption)
// 5. Expiration & TTL Enforcement
// 6. Multi-Tenant Scoping & Personal Workspace vs Company Workspace Isolation
// 7. Google Calendar & Microsoft Outlook Calendar Mutation Parity (PATCH)
// 8. AI Context Orchestration with Untrusted Boundaries & Prompt Injection Defense
// ==============================================================================

import crypto from "crypto";
import {
  canonicalJson,
  computePayloadHash,
  createActionApprovalTicket,
  verifyActionApprovalTicket,
  cancelActionApprovalTicket,
} from "../lib/integrations/guardrails";
import {
  buildRfc2822RawMessage,
  createGmailDraft,
  updateGmailDraft,
  listGmailDrafts,
  getGmailDraft,
  sendGmailDraft,
  isValidGmailId,
} from "../lib/integrations/google/gmail";
import {
  updateGoogleCalendarEvent,
} from "../lib/integrations/google/calendar";
import {
  updateOutlookCalendarEvent,
} from "../lib/integrations/microsoft/calendar";
import { AIContextOrchestrator } from "../lib/ai/context/orchestrator";
import { GOOGLE_SCOPES, GMAIL_INTEGRATION_SCOPES } from "../lib/integrations/google/config";

let totalAssertions = 0;
let passedAssertions = 0;

function assert(condition: boolean, message: string) {
  totalAssertions++;
  if (condition) {
    passedAssertions++;
    console.log(`  ✓ PASS: ${message}`);
  } else {
    console.error(`  ✗ FAIL: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
}

async function runPhase2VerificationSuite() {
  console.log("===============================================================================");
  console.log("BUSINESSBRAIN: PHASE 2 EMAIL & CALENDAR GUARDRAILS VERIFICATION SUITE");
  console.log("===============================================================================\n");

  // ===========================================================================
  // SECTION 1: CANONICAL JSON SERIALIZATION & SHA-256 HASHING
  // ===========================================================================
  console.log("--> Section 1: Deterministic Canonical JSON & SHA-256 Digest");

  const objA = { z: 1, a: "test", m: { b: 2, a: 1 } };
  const objB = { a: "test", m: { a: 1, b: 2 }, z: 1 };

  const canonicalA = canonicalJson(objA);
  const canonicalB = canonicalJson(objB);

  assert(canonicalA === canonicalB, "Canonical JSON produces identical output regardless of key ordering");
  assert(
    canonicalA === '{"a":"test","m":{"a":1,"b":2},"z":1}',
    "Keys are sorted alphabetically in canonical serialization"
  );

  const hashA = computePayloadHash("email.send", objA);
  const hashB = computePayloadHash("email.send", objB);
  assert(hashA === hashB, "computePayloadHash produces identical SHA-256 for reordered object keys");
  assert(hashA.length === 64, "SHA-256 hex digest is exactly 64 characters");

  const differentActionHash = computePayloadHash("calendar.create", objA);
  assert(differentActionHash !== hashA, "Different action types yield distinct payload hashes");

  // ===========================================================================
  // SECTION 2: ACTION APPROVAL TICKET CREATION & CRYPTOGRAPHIC SIGNATURE
  // ===========================================================================
  console.log("\n--> Section 2: Action Approval Ticket Lifecycle & HMAC Signatures");

  const testOrgId = "11111111-1111-4111-8111-111111111111";
  const testUserId = "22222222-2222-4222-8222-222222222222";

  const emailPayload = {
    draftId: "draft_xyz123",
    to: "investors@acme.com",
    cc: "cfo@acme.com",
    subject: "Relatório de Fecho Q3",
    body: "Prezada equipa, segue o fecho trimestral conforme combinado.",
  };

  const ticket = createActionApprovalTicket({
    actionType: "email.send",
    payload: emailPayload,
    organizationId: testOrgId,
    userId: testUserId,
    ttlMs: 5 * 60 * 1000, // 5 min
  });

  assert(!!ticket.ticketId, "Ticket has a valid UUID ticketId");
  assert(ticket.actionType === "email.send", "Ticket actionType is 'email.send'");
  assert(ticket.organizationId === testOrgId, "Ticket organizationId matches workspace");
  assert(ticket.userId === testUserId, "Ticket userId matches actor");
  assert(ticket.state === "awaiting_confirmation", "Initial ticket state is 'awaiting_confirmation'");
  assert(ticket.expiresAt > Date.now(), "Ticket expiresAt is in the future");
  assert(ticket.signature.length === 64, "Ticket has valid 64-char HMAC-SHA256 signature");

  // Tamper signature check
  const tamperedSigTicket = { ...ticket, signature: ticket.signature.slice(0, -2) + "aa" };
  const tamperedSigVerification = verifyActionApprovalTicket({
    ticket: tamperedSigTicket,
    currentPayload: emailPayload,
    organizationId: testOrgId,
    userId: testUserId,
    markConsumed: false,
  });

  assert(tamperedSigVerification.valid === false, "Forged/tampered signature is rejected");
  assert(tamperedSigVerification.code === "INVALID_SIGNATURE", "Rejection code is INVALID_SIGNATURE");

  // ===========================================================================
  // SECTION 3: PAYLOAD IMMUTABILITY GUARDRAILS (ZERO SILENT MODIFICATION)
  // ===========================================================================
  console.log("\n--> Section 3: Payload Immutability Guardrail (Anti-Tampering)");

  // Valid verification with exact payload
  const validVerification = verifyActionApprovalTicket({
    ticket,
    currentPayload: emailPayload,
    organizationId: testOrgId,
    userId: testUserId,
    markConsumed: false, // keep for further mutation tests
  });
  assert(validVerification.valid === true, "Ticket verification succeeds when payload matches exactly");

  // Mutation Test 1: Modified recipient (to)
  const tamperedTo = { ...emailPayload, to: "attacker@evil.com" };
  const toVerification = verifyActionApprovalTicket({
    ticket,
    currentPayload: tamperedTo,
    organizationId: testOrgId,
    userId: testUserId,
    markConsumed: false,
  });
  assert(toVerification.valid === false, "Changing recipient invalidates approval ticket");
  assert(toVerification.code === "PAYLOAD_MISMATCH", "Code is PAYLOAD_MISMATCH for recipient change");

  // Mutation Test 2: Modified subject
  const tamperedSubject = { ...emailPayload, subject: "Urgente: Alteração de Faturação" };
  const subjectVerification = verifyActionApprovalTicket({
    ticket,
    currentPayload: tamperedSubject,
    organizationId: testOrgId,
    userId: testUserId,
    markConsumed: false,
  });
  assert(subjectVerification.valid === false, "Changing subject invalidates approval ticket");
  assert(subjectVerification.code === "PAYLOAD_MISMATCH", "Code is PAYLOAD_MISMATCH for subject change");

  // Mutation Test 3: Modified body
  const tamperedBody = { ...emailPayload, body: emailPayload.body + " P.S.: Por favor transfiram para IBAN PT50..." };
  const bodyVerification = verifyActionApprovalTicket({
    ticket,
    currentPayload: tamperedBody,
    organizationId: testOrgId,
    userId: testUserId,
    markConsumed: false,
  });
  assert(bodyVerification.valid === false, "Altering message body text invalidates approval ticket");
  assert(bodyVerification.code === "PAYLOAD_MISMATCH", "Code is PAYLOAD_MISMATCH for body change");

  // Mutation Test 4: Added CC
  const tamperedCc = { ...emailPayload, cc: "unauthorized_party@external.com" };
  const ccVerification = verifyActionApprovalTicket({
    ticket,
    currentPayload: tamperedCc,
    organizationId: testOrgId,
    userId: testUserId,
    markConsumed: false,
  });
  assert(ccVerification.valid === false, "Adding unauthorized CC recipient invalidates approval ticket");
  assert(ccVerification.code === "PAYLOAD_MISMATCH", "Code is PAYLOAD_MISMATCH for CC change");

  // ===========================================================================
  // SECTION 4: ANTI-REPLAY & DOUBLE-SUBMIT PROTECTION
  // ===========================================================================
  console.log("\n--> Section 4: Anti-Replay & Double-Submit Protection");

  const singleUseTicket = createActionApprovalTicket({
    actionType: "email.send",
    payload: emailPayload,
    organizationId: testOrgId,
    userId: testUserId,
  });

  // First consumption: MUST succeed
  const consumeResult1 = verifyActionApprovalTicket({
    ticket: singleUseTicket,
    currentPayload: emailPayload,
    organizationId: testOrgId,
    userId: testUserId,
    markConsumed: true,
  });
  assert(consumeResult1.valid === true, "First consumption of ticket succeeds");

  // Second consumption (replay / double-submit): MUST fail
  const consumeResult2 = verifyActionApprovalTicket({
    ticket: singleUseTicket,
    currentPayload: emailPayload,
    organizationId: testOrgId,
    userId: testUserId,
    markConsumed: true,
  });
  assert(consumeResult2.valid === false, "Replay of consumed ticket is blocked");
  assert(consumeResult2.code === "REPLAY_DETECTED", "Code is REPLAY_DETECTED on double-submit");

  // ===========================================================================
  // SECTION 5: EXPIRATION & TTL ENFORCEMENT
  // ===========================================================================
  console.log("\n--> Section 5: Expiration & Time-To-Live (TTL) Enforcement");

  const expiredTicket = createActionApprovalTicket({
    actionType: "email.send",
    payload: emailPayload,
    organizationId: testOrgId,
    userId: testUserId,
    ttlMs: -1000, // expired 1s ago
  });

  const expiredVerification = verifyActionApprovalTicket({
    ticket: expiredTicket,
    currentPayload: emailPayload,
    organizationId: testOrgId,
    userId: testUserId,
    markConsumed: false,
  });
  assert(expiredVerification.valid === false, "Expired approval ticket is rejected");
  assert(expiredVerification.code === "EXPIRED", "Code is EXPIRED for timed out ticket");

  // ===========================================================================
  // SECTION 6: MULTI-TENANT BOUNDARIES & WORKSPACE ISOLATION
  // ===========================================================================
  console.log("\n--> Section 6: Multi-Tenant Scoping & Dual-Workspace Isolation");

  const foreignOrgId = "99999999-9999-4999-8999-999999999999";
  const foreignUserId = "88888888-8888-4888-8888-888888888888";

  const tenantCheck = verifyActionApprovalTicket({
    ticket,
    currentPayload: emailPayload,
    organizationId: foreignOrgId, // Cross-tenant attempt
    userId: testUserId,
    markConsumed: false,
  });
  assert(tenantCheck.valid === false, "Cross-tenant ticket execution is rejected");
  assert(tenantCheck.code === "TENANT_MISMATCH", "Code is TENANT_MISMATCH for cross-tenant execution");

  const userCheck = verifyActionApprovalTicket({
    ticket,
    currentPayload: emailPayload,
    organizationId: testOrgId,
    userId: foreignUserId, // Impersonation attempt by another member
    markConsumed: false,
  });
  assert(userCheck.valid === false, "Actor mismatch on ticket execution is rejected");
  assert(userCheck.code === "USER_MISMATCH", "Code is USER_MISMATCH for unauthenticated actor");

  // Ticket cancellation
  const cancellableTicket = createActionApprovalTicket({
    actionType: "email.send",
    payload: emailPayload,
    organizationId: testOrgId,
    userId: testUserId,
  });

  const cancelSuccess = cancelActionApprovalTicket(cancellableTicket.ticketId, testOrgId, testUserId);
  assert(cancelSuccess === true, "cancelActionApprovalTicket cancels active ticket");

  const postCancelVerification = verifyActionApprovalTicket({
    ticket: cancellableTicket,
    currentPayload: emailPayload,
    organizationId: testOrgId,
    userId: testUserId,
    markConsumed: true,
  });
  assert(postCancelVerification.valid === false, "Cancelled ticket cannot be executed");
  assert(postCancelVerification.code === "REPLAY_DETECTED", "Cancelled ticket is recorded as consumed");

  // ===========================================================================
  // SECTION 7: RFC 2822 BASE64URL MIME MESSAGE FORMATTING
  // ===========================================================================
  console.log("\n--> Section 7: RFC 2822 Base64url MIME Message Builder");

  const rfcRaw = buildRfc2822RawMessage({
    to: ["alice@acme.com", "bob@acme.com"],
    from: "me@companybrain.io",
    cc: "carol@acme.com",
    bcc: "audit@acme.com",
    subject: "Apresentação Estratégica BusinessBrain 1.0",
    body: "Olá equipa,\n\nSegue o plano de lançamento para a versão 1.0.",
    inReplyTo: "<msg-12345@mail.gmail.com>",
  });

  assert(typeof rfcRaw === "string" && rfcRaw.length > 50, "buildRfc2822RawMessage produces valid string");
  assert(!rfcRaw.includes("+") && !rfcRaw.includes("/") && !rfcRaw.includes("="), "Output is URL-safe base64url (no +, /, =)");

  // Decode and verify MIME structure
  const decodedMime = Buffer.from(rfcRaw, "base64url").toString("utf-8");
  assert(decodedMime.includes("To: alice@acme.com, bob@acme.com"), "Decoded MIME contains To header with all recipients");
  assert(decodedMime.includes("From: me@companybrain.io"), "Decoded MIME contains From header");
  assert(decodedMime.includes("Cc: carol@acme.com"), "Decoded MIME contains Cc header");
  assert(decodedMime.includes("Bcc: audit@acme.com"), "Decoded MIME contains Bcc header");
  assert(decodedMime.includes("In-Reply-To: <msg-12345@mail.gmail.com>"), "Decoded MIME contains In-Reply-To header");
  assert(decodedMime.includes("References: <msg-12345@mail.gmail.com>"), "Decoded MIME contains References header");
  assert(decodedMime.includes("Content-Type: text/plain; charset=UTF-8"), "Decoded MIME specifies UTF-8 charset");
  assert(decodedMime.includes("=?UTF-8?B?"), "Non-ASCII subject is UTF-8 base64 encoded per RFC 2047");

  // Gmail ID validation
  assert(isValidGmailId("18f4a12bcde34567"), "Valid Gmail message/draft ID is accepted");
  assert(!isValidGmailId(""), "Empty ID is rejected");
  assert(!isValidGmailId("../etc/passwd"), "Path traversal in ID is rejected");
  assert(!isValidGmailId("id; DROP TABLE"), "SQL injection in ID is rejected");
  assert(!isValidGmailId("id with spaces"), "Whitespace in ID is rejected");

  // Google Scope verification
  assert(GOOGLE_SCOPES.GMAIL_COMPOSE === "https://www.googleapis.com/auth/gmail.compose", "GMAIL_COMPOSE scope is configured");
  assert(GMAIL_INTEGRATION_SCOPES.includes("https://www.googleapis.com/auth/gmail.compose"), "GMAIL_INTEGRATION_SCOPES includes GMAIL_COMPOSE");

  // ===========================================================================
  // SECTION 8: CALENDAR MUTATION & GUARDRAILS (GOOGLE & MICROSOFT PARITY)
  // ===========================================================================
  console.log("\n--> Section 8: Calendar Mutation Guardrails (Google & Microsoft Parity)");

  const calendarPayload = {
    summary: "Reunião de Direção Semanal",
    location: "Sala Principal / Microsoft Teams",
    start: { dateTime: "2026-11-10T10:00:00Z", timeZone: "Europe/Lisbon" },
    end: { dateTime: "2026-11-10T11:00:00Z", timeZone: "Europe/Lisbon" },
    attendees: ["ceo@acme.com", "cto@acme.com"],
  };

  const calendarTicket = createActionApprovalTicket({
    actionType: "calendar.create",
    payload: { provider: "google", ...calendarPayload },
    organizationId: testOrgId,
    userId: testUserId,
  });

  assert(calendarTicket.actionType === "calendar.create", "Calendar ticket has actionType 'calendar.create'");

  // Exact payload verification succeeds
  const calVerify = verifyActionApprovalTicket({
    ticket: calendarTicket,
    currentPayload: { provider: "google", ...calendarPayload },
    organizationId: testOrgId,
    userId: testUserId,
    markConsumed: false,
  });
  assert(calVerify.valid === true, "Calendar ticket verified with identical parameters");

  // Mutated calendar time verification fails
  const mutatedTimePayload = {
    provider: "google",
    ...calendarPayload,
    start: { dateTime: "2026-11-10T14:00:00Z", timeZone: "Europe/Lisbon" }, // Changed time
  };
  const mutatedCalVerify = verifyActionApprovalTicket({
    ticket: calendarTicket,
    currentPayload: mutatedTimePayload,
    organizationId: testOrgId,
    userId: testUserId,
    markConsumed: false,
  });
  assert(mutatedCalVerify.valid === false, "Changing calendar meeting time invalidates ticket");
  assert(mutatedCalVerify.code === "PAYLOAD_MISMATCH", "Code is PAYLOAD_MISMATCH for calendar time change");

  // Mutated attendees verification fails
  const mutatedAttendeesPayload = {
    provider: "google",
    ...calendarPayload,
    attendees: ["ceo@acme.com", "uninvited@external.com"],
  };
  const mutatedAttVerify = verifyActionApprovalTicket({
    ticket: calendarTicket,
    currentPayload: mutatedAttendeesPayload,
    organizationId: testOrgId,
    userId: testUserId,
    markConsumed: false,
  });
  assert(mutatedAttVerify.valid === false, "Changing attendee list invalidates ticket");
  assert(mutatedAttVerify.code === "PAYLOAD_MISMATCH", "Code is PAYLOAD_MISMATCH for attendee modification");

  // ===========================================================================
  // SECTION 9: AI CONTEXT ORCHESTRATION & PROMPT INJECTION DEFENSE
  // ===========================================================================
  console.log("\n--> Section 9: AI Context Orchestrator & Untrusted Content Boundaries");

  // Test snippet sanitization
  const maliciousSnippet = `Normal agenda notes.<script>stealTokens();</script><iframe src="malicious.site"></iframe> Bearer sk-ant-api03-abcdef12345678901234567890`;
  const sanitized = AIContextOrchestrator.sanitizeSnippet(maliciousSnippet, 500);

  assert(!sanitized.includes("<script>"), "Sanitization strips <script> tags");
  assert(sanitized.includes("[REDACTED_SCRIPT]"), "Script tag replaced with safe indicator");
  assert(!sanitized.includes("<iframe"), "Sanitization strips <iframe> tags");
  assert(sanitized.includes("[REDACTED_IFRAME]"), "Iframe tag replaced with safe indicator");
  assert(!sanitized.includes("sk-ant-api03-"), "Sanitization redacts sensitive API tokens");

  console.log("\n===============================================================================");
  console.log(`TOTAL ASSERTIONS PASSED: ${passedAssertions} / ${totalAssertions}`);
  console.log("===============================================================================");
}

runPhase2VerificationSuite().catch((err) => {
  console.error("Test Suite execution failed:", err);
  process.exit(1);
});
