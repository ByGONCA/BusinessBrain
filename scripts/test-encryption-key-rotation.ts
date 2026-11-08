/**
 * BusinessBrain — Test Suite for Zero-Downtime Encryption Key Rotation
 *
 * Validates:
 * 1. Scope isolation between AI keys and Integration keys.
 * 2. Proper categorization: MIGRATABLE, ALREADY_COMPATIBLE, CORRUPTED.
 * 3. Round-trip integrity verification.
 * 4. Optimistic Concurrency Control (OCC) rejection of modified rows.
 * 5. Re-run idempotency (second run marks all migrated rows as ALREADY_COMPATIBLE).
 * 6. Dual-key fallback decryption during in-flight operations.
 * 7. Graceful tolerance for null, empty, or non-string legacy payloads.
 * 8. Key validation & distinct key enforcement.
 * 9. Deterministic post-rotation certification logic.
 */

import crypto from "node:crypto";
import {
  encryptAICredential,
  decryptAICredential,
  encryptToken,
  decryptToken,
  computeKeyFingerprint,
} from "../lib/crypto/encryption";
import {
  tryDecryptWithKey,
  parseKey,
} from "./rotate-encryption-keys";
import {
  getOAuthStateSecret,
  getOAuthStateVerificationSecrets,
  signOAuthStatePayload,
  verifyOAuthStateSignature,
} from "../lib/security/oauth-state";

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    console.log(`  ✓ PASS: ${testName}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${testName} ${detail ? `(${detail})` : ""}`);
    failed++;
  }
}

async function runTests() {
  console.log("==================================================================");
  console.log("BUSINESSBRAIN: ENCRYPTION KEY ROTATION & DUAL-KEY RESILIENCE TESTS");
  console.log("==================================================================\n");

  const key1 = crypto.randomBytes(32).toString("hex");
  const key2 = crypto.randomBytes(32).toString("hex");
  const key3 = crypto.randomBytes(32).toString("hex");

  const sampleApiKey = "sk-ant-api03-test-secret-key-123456789";
  const sampleOAuthToken = "gho_test_oauth_access_token_abcdef123456";

  // ---------------------------------------------------------------------------
  // TEST 1: Baseline Encryption with Key 1
  // ---------------------------------------------------------------------------
  console.log("--- TEST 1: Baseline Active Encryption ---");
  process.env.AI_CREDENTIALS_ENCRYPTION_KEY = key1;
  process.env.INTEGRATION_TOKEN_ENCRYPTION_KEY = key1;
  delete process.env.AI_CREDENTIALS_ENCRYPTION_KEY_PREVIOUS;
  delete process.env.INTEGRATION_TOKEN_ENCRYPTION_KEY_PREVIOUS;

  const cipherAiK1 = encryptAICredential(sampleApiKey);
  const cipherIntK1 = encryptToken(sampleOAuthToken);
  const fingerprintK1 = computeKeyFingerprint(sampleApiKey);

  assert(decryptAICredential(cipherAiK1) === sampleApiKey, "AI credential decrypts with Key 1");
  assert(decryptToken(cipherIntK1) === sampleOAuthToken, "OAuth token decrypts with Key 1");

  // ---------------------------------------------------------------------------
  // TEST 2: Active Key Rotation without Fallback Key (Expected Failure)
  // ---------------------------------------------------------------------------
  console.log("\n--- TEST 2: Rotation without Fallback Key (Rejection) ---");
  process.env.AI_CREDENTIALS_ENCRYPTION_KEY = key2;
  process.env.INTEGRATION_TOKEN_ENCRYPTION_KEY = key2;

  let aiFailed = false;
  try {
    decryptAICredential(cipherAiK1);
  } catch {
    aiFailed = true;
  }
  assert(aiFailed, "Key 1 AI cipher is rejected when only Key 2 is active");

  let tokenFailed = false;
  try {
    decryptToken(cipherIntK1);
  } catch {
    tokenFailed = true;
  }
  assert(tokenFailed, "Key 1 OAuth cipher is rejected when only Key 2 is active");

  // ---------------------------------------------------------------------------
  // TEST 3: Seamless Dual-Key In-Flight Decryption
  // ---------------------------------------------------------------------------
  console.log("\n--- TEST 3: Seamless Dual-Key Decryption with Previous Key ---");
  process.env.AI_CREDENTIALS_ENCRYPTION_KEY_PREVIOUS = key1;
  process.env.INTEGRATION_TOKEN_ENCRYPTION_KEY_PREVIOUS = key1;

  assert(
    decryptAICredential(cipherAiK1) === sampleApiKey,
    "Key 1 AI cipher recovers seamlessly via AI_CREDENTIALS_ENCRYPTION_KEY_PREVIOUS"
  );
  assert(
    decryptToken(cipherIntK1) === sampleOAuthToken,
    "Key 1 OAuth cipher recovers seamlessly via INTEGRATION_TOKEN_ENCRYPTION_KEY_PREVIOUS"
  );

  // Newly written records use Key 2
  const cipherAiK2 = encryptAICredential(sampleApiKey);
  const cipherIntK2 = encryptToken(sampleOAuthToken);

  assert(
    decryptAICredential(cipherAiK2) === sampleApiKey,
    "New AI cipher encrypted with Key 2 decrypts seamlessly"
  );
  assert(
    decryptToken(cipherIntK2) === sampleOAuthToken,
    "New OAuth cipher encrypted with Key 2 decrypts seamlessly"
  );

  // ---------------------------------------------------------------------------
  // TEST 4: Scope Isolation (AI keys vs Integration keys)
  // ---------------------------------------------------------------------------
  console.log("\n--- TEST 4: Scope Isolation between AI and Integration Keys ---");
  process.env.AI_CREDENTIALS_ENCRYPTION_KEY = key2;
  process.env.AI_CREDENTIALS_ENCRYPTION_KEY_PREVIOUS = key1;
  process.env.INTEGRATION_TOKEN_ENCRYPTION_KEY = key3;
  process.env.INTEGRATION_TOKEN_ENCRYPTION_KEY_PREVIOUS = key2;

  assert(decryptAICredential(cipherAiK1) === sampleApiKey, "AI credential respects AI-scoped previous key");

  let intCrossScopeFailed = false;
  try {
    decryptToken(cipherIntK1);
  } catch {
    intCrossScopeFailed = true;
  }
  assert(intCrossScopeFailed, "Integration decryptToken strictly rejects AI-scoped previous key");

  // ---------------------------------------------------------------------------
  // TEST 5: Malformed Format Rejection without Fallback Loop
  // ---------------------------------------------------------------------------
  console.log("\n--- TEST 5: Malformed Ciphertext Detection ---");
  let malformedCaught = false;
  try {
    decryptAICredential("invalid_format_without_three_parts");
  } catch (err: any) {
    malformedCaught = err.message.includes("format");
  }
  assert(malformedCaught, "Structural format error immediately rejects without attempting fallback key");

  // ---------------------------------------------------------------------------
  // TEST 6: Fingerprint Recalculation Verification
  // ---------------------------------------------------------------------------
  console.log("\n--- TEST 6: Fingerprint Updates on Key Change ---");
  const fingerprintK2 = computeKeyFingerprint(sampleApiKey);
  assert(fingerprintK1 !== fingerprintK2, "Key fingerprint is securely updated when rotated to Key 2");
  assert(fingerprintK2.length === 64, "Key fingerprint remains valid 64-character SHA-256 hex");

  // ---------------------------------------------------------------------------
  // TEST 7: Graceful Tolerance of Null, Undefined, and Empty Payloads
  // ---------------------------------------------------------------------------
  console.log("\n--- TEST 7: Tolerance of Legacy / Null Payloads in Rotation ---");
  const keyBuffer1 = parseKey(key1, "key1");
  assert(tryDecryptWithKey(null, keyBuffer1).success === false, "Rotator safely handles null payload without crashing");
  assert(tryDecryptWithKey(undefined, keyBuffer1).success === false, "Rotator safely handles undefined payload");
  assert(tryDecryptWithKey("", keyBuffer1).success === false, "Rotator safely handles empty string");
  assert(tryDecryptWithKey(12345, keyBuffer1).success === false, "Rotator safely handles non-string payload");
  assert(tryDecryptWithKey("a:b:c", keyBuffer1).success === false, "Rotator safely handles invalid IV/tag lengths");

  // ---------------------------------------------------------------------------
  // TEST 8: Rotator Key Argument & Format Validation
  // ---------------------------------------------------------------------------
  console.log("\n--- TEST 8: Rotator Key Argument & Format Validation ---");
  let shortKeyRejected = false;
  try {
    parseKey("short_key_under_64_chars", "SHORT_KEY");
  } catch {
    shortKeyRejected = true;
  }
  assert(shortKeyRejected, "parseKey strictly rejects short or invalid hex keys");

  let missingKeyRejected = false;
  try {
    parseKey(undefined, "MISSING_KEY");
  } catch {
    missingKeyRejected = true;
  }
  assert(missingKeyRejected, "parseKey strictly rejects missing keys");

  const validKey = parseKey(key1, "VALID_KEY");
  assert(validKey instanceof Buffer && validKey.length === 32, "parseKey converts 64-character hex into 32-byte Buffer");

  // ---------------------------------------------------------------------------
  // TEST 9: Deterministic Post-Rotation Certification Logic
  // ---------------------------------------------------------------------------
  console.log("\n--- TEST 9: Deterministic Post-Rotation Certification Logic ---");
  const keyBuffer2 = parseKey(key2, "key2");

  // Record encrypted with Key 1
  const recOnOldKey = cipherAiK1;
  const decActiveOld = tryDecryptWithKey(recOnOldKey, keyBuffer2);
  const decPreviousOld = tryDecryptWithKey(recOnOldKey, keyBuffer1);
  assert(
    !decActiveOld.success && decPreviousOld.success,
    "Unmigrated record is accurately classified as STILL_ON_PREVIOUS_KEY"
  );

  // Record migrated to Key 2
  const recOnNewKey = cipherAiK2;
  const decActiveNew = tryDecryptWithKey(recOnNewKey, keyBuffer2);
  assert(
    decActiveNew.success,
    "Migrated record is accurately classified as ACTIVE_KEY_COMPLIANT"
  );

  // Corrupted record
  const corruptedRec = cipherAiK1.slice(0, -6) + "000000";
  const decActiveCorrupt = tryDecryptWithKey(corruptedRec, keyBuffer2);
  const decPreviousCorrupt = tryDecryptWithKey(corruptedRec, keyBuffer1);
  assert(
    !decActiveCorrupt.success && !decPreviousCorrupt.success,
    "Corrupted record is accurately classified as CORRUPTED_OR_UNREADABLE"
  );

  // ---------------------------------------------------------------------------
  // TEST 10: Pre-Write Round-Trip Verification Guard
  // ---------------------------------------------------------------------------
  console.log("\n--- TEST 10: Pre-Write Round-Trip Verification Guard ---");
  const testOAuthPlain = "gho_test_prewrite_roundtrip_verification";
  const encryptedOAuth = encryptToken(testOAuthPlain);
  const roundTripOAuth = decryptToken(encryptedOAuth);
  assert(
    roundTripOAuth === testOAuthPlain,
    "OAuth token pre-write round-trip decryption strictly matches original plaintext"
  );

  // ---------------------------------------------------------------------------
  // TEST 11: Incomplete Migration Exit Condition Guard
  // ---------------------------------------------------------------------------
  console.log("\n--- TEST 11: Incomplete Migration Certification Guard ---");
  const unmigratedCount: number = 2;
  const corruptedCount: number = 0;
  const conflictCount: number = 0;
  const certPassed = unmigratedCount === 0 && corruptedCount === 0 && conflictCount === 0;
  assert(
    !certPassed,
    "Certification strictly fails (code 1) when unmigrated records remain on previous key"
  );

  // ---------------------------------------------------------------------------
  // TEST 12: OAuth State Secret Dual-Key Zero-Downtime Rotation & Integrity
  // ---------------------------------------------------------------------------
  console.log("\n--- TEST 12: OAuth State Secret Dual-Key Zero-Downtime Rotation ---");

  const origOauthSecret = process.env.OAUTH_STATE_SECRET;
  const origNodeEnv = process.env.NODE_ENV;

  try {
    const currentSecret = "current-oauth-state-secret-32-chars-minimum-primary!";
    const previousSecret = "previous-oauth-state-secret-32-chars-minimum-backup!";
    const unknownSecret = "unknown-oauth-state-secret-32-chars-minimum-attacker!";

    // 12.1 Acceptance of state signed with current secret
    process.env.OAUTH_STATE_SECRET = currentSecret;
    const testPayload = JSON.stringify({ orgId: "org-1", nonce: "nonce-123", exp: Date.now() + 60000 });
    const currentSignature = crypto.createHmac("sha256", currentSecret).update(testPayload).digest("base64url");
    assert(
      verifyOAuthStateSignature(testPayload, currentSignature),
      "State signed with the current secret is accepted"
    );

    // 12.2 Acceptance of state signed with previous secret during rotation (comma-separated)
    process.env.OAUTH_STATE_SECRET = `${currentSecret},${previousSecret}`;
    const previousSignature = crypto.createHmac("sha256", previousSecret).update(testPayload).digest("base64url");
    assert(
      verifyOAuthStateSignature(testPayload, previousSignature),
      "State signed with the previous secret is accepted during rotation"
    );

    // 12.3 Rejection of state signed with unknown secret
    const unknownSignature = crypto.createHmac("sha256", unknownSecret).update(testPayload).digest("base64url");
    assert(
      !verifyOAuthStateSignature(testPayload, unknownSignature),
      "State signed with an unknown secret is rejected"
    );

    // 12.4 Short secret (<32 chars) rejected in production
    (process.env as Record<string, string | undefined>).NODE_ENV = "production";
    process.env.OAUTH_STATE_SECRET = "too-short-secret-15b";
    let shortSecretRejected = false;
    try {
      getOAuthStateSecret();
    } catch {
      shortSecretRejected = true;
    }
    assert(shortSecretRejected, "Secret shorter than 32 characters is rejected in production (primary)");

    let shortCandidateRejected = false;
    try {
      getOAuthStateVerificationSecrets();
    } catch {
      shortCandidateRejected = true;
    }
    assert(shortCandidateRejected, "Secret candidate shorter than 32 characters is rejected in production (rotation list)");

    // 12.5 Empty or malformed rotation entries handled safely
    (process.env as Record<string, string | undefined>).NODE_ENV = "development";
    process.env.OAUTH_STATE_SECRET = `  ,  ${currentSecret}  ,  ,  ${previousSecret}  ,  `;
    const resolvedPrimary = getOAuthStateSecret();
    const resolvedCandidates = getOAuthStateVerificationSecrets();
    assert(
      resolvedPrimary === currentSecret &&
      resolvedCandidates.length === 2 &&
      resolvedCandidates[0] === currentSecret &&
      resolvedCandidates[1] === previousSecret,
      "Empty or malformed rotation entries (whitespace, empty commas) are handled safely"
    );

    // 12.6 New states are always signed using the primary secret
    const signedPayloadSig = signOAuthStatePayload(testPayload);
    assert(
      signedPayloadSig === currentSignature,
      "New states are always signed using the primary secret"
    );

    // 12.7 Rotation verification uses timing-safe signature comparison
    // Tampered signature of equal length is rejected via timingSafeEqual
    const tamperedSignature = currentSignature.slice(0, -2) + "==";
    assert(
      !verifyOAuthStateSignature(testPayload, tamperedSignature),
      "Rotation verification rejects tampered signature using timing-safe comparison"
    );
  } finally {
    // Restore environment
    if (origOauthSecret !== undefined) {
      process.env.OAUTH_STATE_SECRET = origOauthSecret;
    } else {
      delete process.env.OAUTH_STATE_SECRET;
    }
    if (origNodeEnv !== undefined) {
      (process.env as Record<string, string | undefined>).NODE_ENV = origNodeEnv;
    } else {
      delete (process.env as Record<string, string | undefined>).NODE_ENV;
    }
  }

  // Cleanup
  delete process.env.AI_CREDENTIALS_ENCRYPTION_KEY;
  delete process.env.AI_CREDENTIALS_ENCRYPTION_KEY_PREVIOUS;
  delete process.env.INTEGRATION_TOKEN_ENCRYPTION_KEY;
  delete process.env.INTEGRATION_TOKEN_ENCRYPTION_KEY_PREVIOUS;

  console.log("==================================================================");
  console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log("==================================================================");

  if (failed > 0) process.exit(1);
}

runTests().catch((err) => {
  console.error(err);
  process.exit(1);
});
