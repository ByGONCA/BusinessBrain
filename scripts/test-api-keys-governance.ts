/**
 * scripts/test-api-keys-governance.ts
 *
 * Security Test Suite for API Key Cryptographic Invariants & Timing Attack Resistance.
 */

import { hashApiKey, verifyApiKeyHash } from '../lib/api-keys/service';

console.log('==================================================================');
console.log('BUSINESSBRAIN: API KEY CRYPTOGRAPHIC GOVERNANCE & TIMING SAFETY');
console.log('==================================================================\n');

let passed = 0;
let failed = 0;

function assert(condition: boolean, desc: string) {
  if (condition) {
    console.log(`  ✓ PASS: ${desc}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${desc}`);
    failed++;
  }
}

// 1. Hash generation test
const secretKey = 'cb_live_' + 'a'.repeat(64);
const digest = hashApiKey(secretKey);

assert(typeof digest === 'string', 'hashApiKey returns string');
assert(digest.length === 64, 'SHA-256 digest is exactly 64 hex characters');

// 2. Deterministic hashing
const digest2 = hashApiKey(secretKey);
assert(digest === digest2, 'hashApiKey is strictly deterministic');

// 3. Constant-time verification matching
const match = verifyApiKeyHash(digest, digest2);
assert(match === true, 'verifyApiKeyHash returns true for identical hashes');

// 4. Constant-time verification mismatch
const secretKeyB = 'cb_live_' + 'b'.repeat(64);
const digestB = hashApiKey(secretKeyB);
const mismatch = verifyApiKeyHash(digest, digestB);
assert(mismatch === false, 'verifyApiKeyHash returns false for distinct hashes');

// 5. Length safety check
const shortHash = 'abc';
const lengthSafe = verifyApiKeyHash(digest, shortHash);
assert(lengthSafe === false, 'verifyApiKeyHash safely rejects different length inputs without throwing');

// 6. Type safety check
const typeSafe = verifyApiKeyHash(null as any, digest);
assert(typeSafe === false, 'verifyApiKeyHash safely rejects non-string inputs');

console.log('\n==================================================================');
console.log(`TOTAL RESULTS: ${passed} PASSED, ${failed} FAILED`);
console.log('==================================================================');

if (failed > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
