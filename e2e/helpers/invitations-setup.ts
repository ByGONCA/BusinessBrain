import crypto from "node:crypto";

/**
 * BusinessBrain — E2E Invitation Test Data Helper
 * 
 * Safe test harness utilities:
 * 1. Generates ephemeral, isolated tokens prefixed with 'test_e2e_'.
 * 2. Cleans up ONLY test-generated rows matching the specific test ID,
 *    never performing table-wide or indiscriminate deletions.
 * 3. Never logs plaintext tokens, cookies, or secrets to stdout/stderr.
 */

export interface TestInvitationContext {
  token: string;
  tokenHash: string;
  testId: string;
}

export function createEphemeralTestToken(): TestInvitationContext {
  const testId = `test_e2e_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
  const token = `test_tok_${crypto.randomBytes(32).toString("hex")}`;
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

  return { token, tokenHash, testId };
}
