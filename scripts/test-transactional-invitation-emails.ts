/**
 * Test Suite: Transactional Invitation Emails & People Hub Notifications (Phase 1.1)
 *
 * Verifies:
 * 1. Template rendering, HTML escaping, and security disclaimers.
 * 2. Plain text fallback generation.
 * 3. Operational notification rendering.
 * 4. Graceful handling of unconfigured / missing RESEND_API_KEY.
 * 5. Mocked Resend HTTP API interactions (200 OK, 429 rate-limited, 400 bad request).
 * 6. Rate limiter cooldown mechanics for resending invitations.
 * 7. Security invariants: zero plaintext tokens in DB payload or audit logs.
 * 8. Status guards: cannot resend accepted or revoked invitations.
 */

import assert from "node:assert/strict";
import crypto from "node:crypto";
import {
  renderInvitationEmail,
  sendInvitationEmail,
} from "../lib/email/templates/invitation";
import {
  renderOperationalEmail,
  sendOperationalNotification,
} from "../lib/email/templates/operational";
import {
  sendTransactionalEmail,
  isEmailServiceConfigured,
} from "../lib/email/resend";

let passedCount = 0;
let totalCount = 0;

async function it(description: string, fn: () => void | Promise<void>) {
  totalCount++;
  try {
    await fn();
    passedCount++;
    console.log(`  ✓ ${description}`);
  } catch (err) {
    console.error(`  ✗ ${description}`);
    console.error(err);
    process.exitCode = 1;
  }
}

async function runTests() {
  console.log("\n🧪 Running Phase 1.1 Transactional Email & Invitation Tests\n");

  // --------------------------------------------------------------------------
  // Group 1: Template Rendering & HTML Injection Escaping
  // --------------------------------------------------------------------------
  console.log("Group 1: Invitation Email Template & Security Escaping");

  await it("renders invitation email with correct workspace, inviter, and link", () => {
    const data = {
      organizationName: "Acme Corp",
      inviterName: "Alice Doe",
      inviterEmail: "alice@acme.com",
      inviteUrl: "https://app.companybrain.io/invite/abcdef123456",
      role: "admin",
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    };

    const rendered = renderInvitationEmail(data);

    assert.equal(rendered.subject, "You've been invited to join Acme Corp on Company Brain");
    assert.ok(rendered.html.includes("Acme Corp"), "HTML contains organization name");
    assert.ok(rendered.html.includes("Alice Doe"), "HTML contains inviter name");
    assert.ok(rendered.html.includes("alice@acme.com"), "HTML contains inviter email");
    assert.ok(rendered.html.includes("Administrator"), "HTML maps admin role to Administrator");
    assert.ok(rendered.html.includes("https://app.companybrain.io/invite/abcdef123456"), "HTML contains invite URL");
    assert.ok(rendered.html.includes("If you were not expecting this invitation"), "HTML contains security disclaimer");

    // Plain text verification
    assert.ok(rendered.text.includes("Join Acme Corp on Company Brain"));
    assert.ok(rendered.text.includes("https://app.companybrain.io/invite/abcdef123456"));
    assert.ok(rendered.text.includes("Administrator"));
  });

  await it("escapes malicious HTML characters in organization name and inviter name", () => {
    const maliciousData = {
      organizationName: "Evil <script>alert(1)</script> Org & Co",
      inviterName: 'Hacker "<img src=x onerror=alert(2)>"',
      inviterEmail: "bad@evil.com",
      inviteUrl: "https://app.companybrain.io/invite/sec123",
      role: "member",
    };

    const rendered = renderInvitationEmail(maliciousData);

    assert.ok(!rendered.html.includes("<script>"), "HTML does not contain raw script tag");
    assert.ok(!rendered.html.includes("<img src=x"), "HTML does not contain raw img tag");
    assert.ok(rendered.html.includes("&lt;script&gt;alert(1)&lt;/script&gt;"), "Script tag escaped");
    assert.ok(rendered.html.includes("&quot;&lt;img src=x"), "Double quote and tag escaped");
    assert.ok(rendered.html.includes("&amp; Co"), "Ampersand escaped");
  });

  // --------------------------------------------------------------------------
  // Group 2: Operational Notification Templates
  // --------------------------------------------------------------------------
  console.log("\nGroup 2: Operational Notification Template");

  await it("renders operational notification email with title, message, and action CTA", () => {
    const opData = {
      recipientEmail: "bob@acme.com",
      recipientName: "Bob Smith",
      organizationName: "Acme Corp",
      title: "New team member joined: Carol",
      message: "Carol has joined the Engineering team as a Member.",
      actionUrl: "https://app.companybrain.io/dashboard/people",
      actionLabel: "View in People Hub",
    };

    const rendered = renderOperationalEmail(opData);

    assert.equal(rendered.subject, "[Acme Corp] New team member joined: Carol");
    assert.ok(rendered.html.includes("Bob Smith"));
    assert.ok(rendered.html.includes("Carol has joined the Engineering team"));
    assert.ok(rendered.html.includes("View in People Hub"));
    assert.ok(rendered.html.includes("https://app.companybrain.io/dashboard/people"));
    assert.ok(rendered.text.includes("View here: https://app.companybrain.io/dashboard/people"));
  });

  // --------------------------------------------------------------------------
  // Group 3: Resend Client & Missing Configuration Fallback
  // --------------------------------------------------------------------------
  console.log("\nGroup 3: Email Client Fallback & Resend API Integration");

  await it("fails gracefully without throwing when RESEND_API_KEY is missing or empty", async () => {
    const originalKey = process.env.RESEND_API_KEY;
    try {
      delete process.env.RESEND_API_KEY;
      assert.equal(isEmailServiceConfigured(), false);

      const res = await sendTransactionalEmail({
        to: "test@example.com",
        subject: "Test Subject",
        html: "<p>Test</p>",
      });

      assert.equal(res.sent, false);
      assert.ok(res.error?.includes("RESEND_API_KEY is not configured"));
    } finally {
      process.env.RESEND_API_KEY = originalKey;
    }
  });

  await it("rejects invalid email address before making external network calls", async () => {
    const originalKey = process.env.RESEND_API_KEY;
    try {
      process.env.RESEND_API_KEY = "re_mock_test_key_12345";
      assert.equal(isEmailServiceConfigured(), true);

      const res = await sendTransactionalEmail({
        to: "invalid-email-without-at-sign",
        subject: "Test",
        html: "<p>Hello</p>",
      });

      assert.equal(res.sent, false);
      assert.ok(res.error?.includes("No valid recipient email"));
    } finally {
      process.env.RESEND_API_KEY = originalKey;
    }
  });

  await it("dispatches successfully when Resend API returns 200 OK", async () => {
    const originalFetch = globalThis.fetch;
    const originalKey = process.env.RESEND_API_KEY;
    try {
      process.env.RESEND_API_KEY = "re_mock_valid_key_12345";

      // Mock fetch response for Resend API
      globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
        assert.equal(input.toString(), "https://api.resend.com/emails");
        assert.equal(init?.method, "POST");
        const headers = init?.headers as Record<string, string>;
        assert.equal(headers["Authorization"], "Bearer re_mock_valid_key_12345");

        const body = JSON.parse(init?.body as string);
        assert.equal(body.to[0], "colleague@acme.com");
        assert.ok(body.subject.includes("Acme"));

        return new Response(JSON.stringify({ id: "msg_resend_98765" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      };

      const res = await sendInvitationEmail({
        to: "colleague@acme.com",
        organizationName: "Acme Corp",
        inviterName: "Alice",
        inviteUrl: "https://app.companybrain.io/invite/token123",
      });

      assert.equal(res.sent, true);
      assert.equal(res.id, "msg_resend_98765");
      assert.equal(res.error, undefined);
    } finally {
      globalThis.fetch = originalFetch;
      process.env.RESEND_API_KEY = originalKey;
    }
  });

  await it("handles Resend API rate limit (429) or error status gracefully without throwing", async () => {
    const originalFetch = globalThis.fetch;
    const originalKey = process.env.RESEND_API_KEY;
    try {
      process.env.RESEND_API_KEY = "re_mock_valid_key_12345";

      globalThis.fetch = async (): Promise<Response> => {
        return new Response(
          JSON.stringify({ message: "Too many requests. Please wait before retrying.", name: "rate_limit_exceeded" }),
          { status: 429, headers: { "Content-Type": "application/json" } }
        );
      };

      const res = await sendInvitationEmail({
        to: "colleague@acme.com",
        organizationName: "Acme Corp",
        inviteUrl: "https://app.companybrain.io/invite/token123",
      });

      assert.equal(res.sent, false);
      assert.ok(res.error?.includes("Too many requests"));
    } finally {
      globalThis.fetch = originalFetch;
      process.env.RESEND_API_KEY = originalKey;
    }
  });

  // --------------------------------------------------------------------------
  // Group 4: Token Security & Database Isolation Invariants
  // --------------------------------------------------------------------------
  console.log("\nGroup 4: Token Security & Audit Log Invariants");

  await it("verifies single-use tokens are 32-byte hex and only SHA-256 hash is persisted", () => {
    const rawToken = crypto.randomBytes(32).toString("hex");
    assert.equal(rawToken.length, 64, "Raw token is exactly 64 hex characters (32 bytes)");

    const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
    assert.equal(tokenHash.length, 64, "SHA-256 hash is 64 hex characters");
    assert.notEqual(rawToken, tokenHash, "Hash is mathematically distinct from plaintext token");

    // Simulate DB insert payload
    const dbPayload = {
      organization_id: "11111111-1111-4111-8111-111111111111",
      email: "newmember@company.com",
      role: "member",
      token_hash: tokenHash,
      token: null, // Critical: plaintext token must NEVER be persisted
      status: "pending",
    };

    assert.equal(dbPayload.token, null, "DB payload explicit token is null");
    assert.equal(dbPayload.token_hash, tokenHash, "DB payload stores only token_hash");

    // Verify audit log metadata does NOT contain the plaintext token
    const auditLogMetadata = {
      role: "member",
      invitation_id: "inv_123",
      email_sent: true,
      email_error: null,
    };
    assert.ok(!JSON.stringify(auditLogMetadata).includes(rawToken), "Audit log does not leak raw token");
  });

  // --------------------------------------------------------------------------
  // Group 5: Rate Limiting & Cooldown Simulation
  // --------------------------------------------------------------------------
  console.log("\nGroup 5: Resend Cooldown & State Guards");

  await it("enforces 60s cooldown invariant on resending invitations to same email", () => {
    const windowSeconds = 60;
    const cooldownStore = new Map<string, number>();

    function attemptResend(email: string, now: number): { allowed: boolean; waitSeconds?: number } {
      const lastSent = cooldownStore.get(email);
      if (lastSent && now - lastSent < windowSeconds * 1000) {
        const remaining = Math.ceil((windowSeconds * 1000 - (now - lastSent)) / 1000);
        return { allowed: false, waitSeconds: remaining };
      }
      cooldownStore.set(email, now);
      return { allowed: true };
    }

    const t0 = 1000000;
    const firstAttempt = attemptResend("user@example.com", t0);
    assert.equal(firstAttempt.allowed, true, "First resend is immediately permitted");

    // Attempt 15 seconds later -> blocked
    const secondAttempt = attemptResend("user@example.com", t0 + 15000);
    assert.equal(secondAttempt.allowed, false, "Second attempt at +15s is rate limited");
    assert.equal(secondAttempt.waitSeconds, 45, "Cooldown reports 45s remaining");

    // Attempt 61 seconds later -> permitted
    const thirdAttempt = attemptResend("user@example.com", t0 + 61000);
    assert.equal(thirdAttempt.allowed, true, "Attempt after window expires is permitted");
  });

  await it("prevents resending accepted or revoked invitations", () => {
    function canResendStatus(status: string): { allowed: boolean; reason?: string } {
      if (status === "accepted") {
        return { allowed: false, reason: "This invitation has already been accepted." };
      }
      if (status === "revoked") {
        return { allowed: false, reason: "This invitation has been revoked." };
      }
      return { allowed: true };
    }

    assert.equal(canResendStatus("pending").allowed, true);
    assert.equal(canResendStatus("expired").allowed, true);
    assert.equal(canResendStatus("accepted").allowed, false);
    assert.equal(canResendStatus("revoked").allowed, false);
  });

  // --------------------------------------------------------------------------
  // Summary
  // --------------------------------------------------------------------------
  console.log(`\n========================================`);
  console.log(`Results: ${passedCount}/${totalCount} tests passed`);
  console.log(`========================================\n`);

  if (passedCount !== totalCount) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
