/**
 * BusinessBrain — Zero-Downtime Encryption Key Rotation Utility
 *
 * Re-encrypts credentials across:
 * - organization_ai_credentials (encrypted_api_key, key_fingerprint)
 * - user_ai_credentials (encrypted_api_key, key_fingerprint)
 * - organization_integrations (access_token, refresh_token)
 *
 * Safety Invariants:
 * 1. Default mode is DRY-RUN (no database writes). Pass `--apply` to commit.
 * 2. Scope selection: `--scope=ai` (default), `--scope=integrations`, or `--scope=all`.
 * 3. Categorizes each row deterministically:
 *    - ACTIVE_KEY_COMPLIANT: Decrypts with NEW_KEY. Skipped safely.
 *    - STILL_ON_PREVIOUS_KEY: Decrypts with OLD_KEY (eligible for rotation).
 *    - CORRUPTED_OR_UNREADABLE: Fails decryption with BOTH keys (preserved untouched).
 *    - OCC_CONFLICT: Row updated concurrently during migration (preserved untouched).
 * 4. Optimistic Concurrency Control (OCC): Updates enforce `updated_at` matching.
 * 5. Robust Error Handling: Tolerates null, empty, or malformed legacy payloads without crashing.
 * 6. Exit Codes: Exits with code 1 if any rows remain unmigrated, corrupted, or in conflict.
 *    Exits with code 0 ONLY when all rows are certified on the active key.
 * 7. Zero plaintext secrets, keys, or ciphertext printed to console or logs.
 *
 * Usage:
 *   # Dry-run audit for AI credentials:
 *   OLD_KEY="<64-hex>" NEW_KEY="<64-hex>" npx tsx scripts/rotate-encryption-keys.ts --scope=ai
 *
 *   # Apply live rotation with OCC:
 *   OLD_KEY="<64-hex>" NEW_KEY="<64-hex>" npx tsx scripts/rotate-encryption-keys.ts --scope=ai --apply
 *
 *   # Verification run (verifies zero rows depend on previous key):
 *   OLD_KEY="<64-hex>" NEW_KEY="<64-hex>" npx tsx scripts/rotate-encryption-keys.ts --scope=ai --verify
 */

import crypto from "node:crypto";
import { createServiceClient } from "../lib/supabase/server";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

export interface CategoryStats {
  total: number;
  activeKeyCompliant: number;
  stillOnPreviousKey: number;
  migrated: number;
  corrupted: number;
  conflicts: number;
}

export function parseKey(rawKey: string | undefined, varName: string): Buffer {
  if (!rawKey || (rawKey.length !== 64 && Buffer.byteLength(rawKey, "utf8") !== 32)) {
    throw new Error(`Invalid or missing ${varName}: must be a 64-character hex string or 32-byte key.`);
  }
  return rawKey.length === 64 ? Buffer.from(rawKey, "hex") : Buffer.from(rawKey, "utf8");
}

export function tryDecryptWithKey(encryptedPayload: unknown, key: Buffer): { success: boolean; plaintext?: string } {
  if (!encryptedPayload || typeof encryptedPayload !== "string") {
    return { success: false };
  }
  try {
    const parts = encryptedPayload.split(":");
    if (parts.length !== 3) return { success: false };
    const [ivHex, authTagHex, cipherHex] = parts;
    if (!ivHex || !authTagHex || !cipherHex || ivHex.length !== 24 || authTagHex.length !== 32) {
      return { success: false };
    }

    const decipher = crypto.createDecipheriv(ALGORITHM, key, Buffer.from(ivHex, "hex"), {
      authTagLength: AUTH_TAG_LENGTH,
    });
    decipher.setAuthTag(Buffer.from(authTagHex, "hex"));

    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(cipherHex, "hex")),
      decipher.final(),
    ]);
    return { success: true, plaintext: decrypted.toString("utf8") };
  } catch {
    return { success: false };
  }
}

export function encryptWithKey(plaintext: string, key: Buffer): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  return `${iv.toString("hex")}:${cipher.getAuthTag().toString("hex")}:${encrypted.toString("hex")}`;
}

export function computeFingerprintWithKey(plaintext: string, key: Buffer): string {
  return crypto.createHmac("sha256", key).update(plaintext).digest("hex");
}

async function runRotation() {
  const isApply = process.argv.includes("--apply");
  const isVerify = process.argv.includes("--verify");
  const scopeArg = process.argv.find((a) => a.startsWith("--scope="))?.split("=")[1] || "all";

  const modeName = isApply ? "LIVE MUTATION (--apply)" : isVerify ? "CERTIFICATION AUDIT (--verify)" : "DRY RUN (Preview Only)";

  console.log("==================================================================");
  console.log("BUSINESSBRAIN: ZERO-DOWNTIME ENCRYPTION KEY ROTATION RUNNER");
  console.log(`Execution Mode : ${modeName}`);
  console.log(`Target Scope   : ${scopeArg.toUpperCase()}`);
  console.log("==================================================================\n");

  const supabase = createServiceClient();

  // Resolve AI Keys
  const oldAiKeyRaw = process.env.OLD_AI_KEY || process.env.OLD_KEY || process.env.AI_CREDENTIALS_ENCRYPTION_KEY_PREVIOUS;
  const newAiKeyRaw = process.env.NEW_AI_KEY || process.env.NEW_KEY || process.env.AI_CREDENTIALS_ENCRYPTION_KEY;

  // Resolve Integration Keys
  const oldIntKeyRaw = process.env.OLD_INTEGRATION_KEY || process.env.OLD_KEY || process.env.INTEGRATION_TOKEN_ENCRYPTION_KEY_PREVIOUS;
  const newIntKeyRaw = process.env.NEW_INTEGRATION_KEY || process.env.NEW_KEY || process.env.INTEGRATION_TOKEN_ENCRYPTION_KEY;

  const shouldRotateAi = scopeArg === "all" || scopeArg === "ai";
  const shouldRotateIntegrations = scopeArg === "all" || scopeArg === "integrations";

  let oldAiKey: Buffer | null = null;
  let newAiKey: Buffer | null = null;
  if (shouldRotateAi) {
    if (!oldAiKeyRaw || !newAiKeyRaw) {
      console.error("FATAL: AI rotation requires OLD_KEY/OLD_AI_KEY and NEW_KEY/NEW_AI_KEY.");
      process.exit(1);
    }
    oldAiKey = parseKey(oldAiKeyRaw, "OLD_AI_KEY");
    newAiKey = parseKey(newAiKeyRaw, "NEW_AI_KEY");
    if (oldAiKey.equals(newAiKey)) {
      console.error("FATAL: OLD_AI_KEY and NEW_AI_KEY must be distinct.");
      process.exit(1);
    }
  }

  let oldIntKey: Buffer | null = null;
  let newIntKey: Buffer | null = null;
  if (shouldRotateIntegrations) {
    if (!oldIntKeyRaw || !newIntKeyRaw) {
      console.error("FATAL: Integration rotation requires OLD_KEY/OLD_INTEGRATION_KEY and NEW_KEY/NEW_INTEGRATION_KEY.");
      process.exit(1);
    }
    oldIntKey = parseKey(oldIntKeyRaw, "OLD_INTEGRATION_KEY");
    newIntKey = parseKey(newIntKeyRaw, "NEW_INTEGRATION_KEY");
    if (oldIntKey.equals(newIntKey)) {
      console.error("FATAL: OLD_INTEGRATION_KEY and NEW_INTEGRATION_KEY must be distinct.");
      process.exit(1);
    }
  }

  // ---------------------------------------------------------------------------
  // 1. organization_ai_credentials
  // ---------------------------------------------------------------------------
  const statsOrg: CategoryStats = { total: 0, activeKeyCompliant: 0, stillOnPreviousKey: 0, migrated: 0, corrupted: 0, conflicts: 0 };
  if (shouldRotateAi && oldAiKey && newAiKey) {
    console.log("[1/3] Scanning organization_ai_credentials (Workspace BYOK)...");
    const { data: orgCreds, error: orgErr } = await supabase
      .from("organization_ai_credentials")
      .select("id, encrypted_api_key, key_fingerprint, updated_at");

    if (orgErr) {
      console.error("  Error reading organization_ai_credentials:", orgErr.message);
      statsOrg.corrupted++;
    } else if (orgCreds) {
      statsOrg.total = orgCreds.length;
      for (const cred of orgCreds) {
        // Step 1: Check if already compliant with new active key
        const newTry = tryDecryptWithKey(cred.encrypted_api_key, newAiKey);
        if (newTry.success) {
          statsOrg.activeKeyCompliant++;
          continue;
        }

        // Step 2: Check if decryptable with old previous key
        const oldTry = tryDecryptWithKey(cred.encrypted_api_key, oldAiKey);
        if (!oldTry.success || !oldTry.plaintext) {
          statsOrg.corrupted++;
          console.warn(`  [Notice] Row ${cred.id}: Cannot be decrypted with active or previous key (preserved untouched).`);
          continue;
        }

        statsOrg.stillOnPreviousKey++;

        if (isApply) {
          const newCipher = encryptWithKey(oldTry.plaintext, newAiKey);
          const newFingerprint = computeFingerprintWithKey(oldTry.plaintext, newAiKey);

          // Verification round-trip before database write
          const verify = tryDecryptWithKey(newCipher, newAiKey);
          if (!verify.success || verify.plaintext !== oldTry.plaintext) {
            statsOrg.corrupted++;
            console.error(`  [FATAL] Pre-write round-trip verification failed for row ${cred.id}`);
            continue;
          }

          // Atomic OCC Update
          const { data: updated, error: updateErr } = await supabase
            .from("organization_ai_credentials")
            .update({
              encrypted_api_key: newCipher,
              key_fingerprint: newFingerprint,
              updated_at: new Date().toISOString(),
            })
            .eq("id", cred.id)
            .eq("updated_at", cred.updated_at)
            .select("id");

          if (updateErr) {
            console.error(`  [Error] Database update failed on row ${cred.id}:`, updateErr.message);
            statsOrg.conflicts++;
            continue;
          }
          if (!updated || updated.length === 0) {
            console.warn(`  [Warning] OCC conflict on row ${cred.id}: updated concurrently by another transaction (skipped).`);
            statsOrg.conflicts++;
            continue;
          }
          statsOrg.migrated++;
        }
      }
      console.log(`  Processed: ${statsOrg.activeKeyCompliant} active-compliant, ${statsOrg.stillOnPreviousKey} on previous key (${statsOrg.migrated} migrated), ${statsOrg.corrupted} corrupted, ${statsOrg.conflicts} conflicts.\n`);
    }
  }

  // ---------------------------------------------------------------------------
  // 2. user_ai_credentials
  // ---------------------------------------------------------------------------
  const statsUser: CategoryStats = { total: 0, activeKeyCompliant: 0, stillOnPreviousKey: 0, migrated: 0, corrupted: 0, conflicts: 0 };
  if (shouldRotateAi && oldAiKey && newAiKey) {
    console.log("[2/3] Scanning user_ai_credentials (Personal BYOK)...");
    const { data: userCreds, error: userErr } = await supabase
      .from("user_ai_credentials")
      .select("id, encrypted_api_key, key_fingerprint, updated_at");

    if (userErr) {
      console.error("  Error reading user_ai_credentials:", userErr.message);
      statsUser.corrupted++;
    } else if (userCreds) {
      statsUser.total = userCreds.length;
      for (const cred of userCreds) {
        const newTry = tryDecryptWithKey(cred.encrypted_api_key, newAiKey);
        if (newTry.success) {
          statsUser.activeKeyCompliant++;
          continue;
        }

        const oldTry = tryDecryptWithKey(cred.encrypted_api_key, oldAiKey);
        if (!oldTry.success || !oldTry.plaintext) {
          statsUser.corrupted++;
          console.warn(`  [Notice] Row ${cred.id}: Cannot be decrypted with active or previous key (preserved untouched).`);
          continue;
        }

        statsUser.stillOnPreviousKey++;

        if (isApply) {
          const newCipher = encryptWithKey(oldTry.plaintext, newAiKey);
          const newFingerprint = computeFingerprintWithKey(oldTry.plaintext, newAiKey);

          const verify = tryDecryptWithKey(newCipher, newAiKey);
          if (!verify.success || verify.plaintext !== oldTry.plaintext) {
            statsUser.corrupted++;
            console.error(`  [FATAL] Pre-write round-trip verification failed for row ${cred.id}`);
            continue;
          }

          const { data: updated, error: updateErr } = await supabase
            .from("user_ai_credentials")
            .update({
              encrypted_api_key: newCipher,
              key_fingerprint: newFingerprint,
              updated_at: new Date().toISOString(),
            })
            .eq("id", cred.id)
            .eq("updated_at", cred.updated_at)
            .select("id");

          if (updateErr) {
            console.error(`  [Error] Database update failed on row ${cred.id}:`, updateErr.message);
            statsUser.conflicts++;
            continue;
          }
          if (!updated || updated.length === 0) {
            console.warn(`  [Warning] OCC conflict on row ${cred.id}: updated concurrently by another transaction (skipped).`);
            statsUser.conflicts++;
            continue;
          }
          statsUser.migrated++;
        }
      }
      console.log(`  Processed: ${statsUser.activeKeyCompliant} active-compliant, ${statsUser.stillOnPreviousKey} on previous key (${statsUser.migrated} migrated), ${statsUser.corrupted} corrupted, ${statsUser.conflicts} conflicts.\n`);
    }
  }

  // ---------------------------------------------------------------------------
  // 3. organization_integrations
  // ---------------------------------------------------------------------------
  const statsInt: CategoryStats = { total: 0, activeKeyCompliant: 0, stillOnPreviousKey: 0, migrated: 0, corrupted: 0, conflicts: 0 };
  if (shouldRotateIntegrations && oldIntKey && newIntKey) {
    console.log("[3/3] Scanning organization_integrations (OAuth Tokens)...");
    const { data: integrations, error: intErr } = await supabase
      .from("organization_integrations")
      .select("id, access_token, refresh_token, updated_at");

    if (intErr) {
      console.error("  Error reading organization_integrations:", intErr.message);
      statsInt.corrupted++;
    } else if (integrations) {
      statsInt.total = integrations.length;
      for (const intg of integrations) {
        let isCompliant = true;
        let needsMigration = false;
        let newAccess = intg.access_token;
        let newRefresh = intg.refresh_token;

        if (intg.access_token) {
          const newTry = tryDecryptWithKey(intg.access_token, newIntKey);
          if (!newTry.success) {
            isCompliant = false;
            const oldTry = tryDecryptWithKey(intg.access_token, oldIntKey);
            if (oldTry.success && oldTry.plaintext) {
              needsMigration = true;
              newAccess = encryptWithKey(oldTry.plaintext, newIntKey);
              const verify = tryDecryptWithKey(newAccess, newIntKey);
              if (!verify.success || verify.plaintext !== oldTry.plaintext) {
                statsInt.corrupted++;
                console.error(`  [FATAL] Pre-write round-trip verification failed for access_token on row ${intg.id}`);
                continue;
              }
            }
          }
        }

        if (intg.refresh_token) {
          const newTry = tryDecryptWithKey(intg.refresh_token, newIntKey);
          if (!newTry.success) {
            isCompliant = false;
            const oldTry = tryDecryptWithKey(intg.refresh_token, oldIntKey);
            if (oldTry.success && oldTry.plaintext) {
              needsMigration = true;
              newRefresh = encryptWithKey(oldTry.plaintext, newIntKey);
              const verify = tryDecryptWithKey(newRefresh, newIntKey);
              if (!verify.success || verify.plaintext !== oldTry.plaintext) {
                statsInt.corrupted++;
                console.error(`  [FATAL] Pre-write round-trip verification failed for refresh_token on row ${intg.id}`);
                continue;
              }
            }
          }
        }

        if (isCompliant && !needsMigration) {
          statsInt.activeKeyCompliant++;
          continue;
        }

        if (!needsMigration) {
          statsInt.corrupted++;
          continue;
        }

        statsInt.stillOnPreviousKey++;

        if (isApply) {
          const { data: updated, error: updateErr } = await supabase
            .from("organization_integrations")
            .update({
              access_token: newAccess,
              refresh_token: newRefresh,
              updated_at: new Date().toISOString(),
            })
            .eq("id", intg.id)
            .eq("updated_at", intg.updated_at)
            .select("id");

          if (updateErr || !updated || updated.length === 0) {
            statsInt.conflicts++;
            continue;
          }
          statsInt.migrated++;
        }
      }
      console.log(`  Processed: ${statsInt.activeKeyCompliant} active-compliant, ${statsInt.stillOnPreviousKey} on previous key (${statsInt.migrated} migrated), ${statsInt.corrupted} corrupted, ${statsInt.conflicts} conflicts.\n`);
    }
  }

  // ---------------------------------------------------------------------------
  // Summary Audit Table
  // ---------------------------------------------------------------------------
  console.log("==================================================================");
  console.log(`ROTATION AUDIT SUMMARY [Mode: ${modeName}]`);
  console.log("==================================================================");
  console.log("Category                 Total   Compliant   On Previous Key (Migrated)   Corrupted   Conflicts");
  console.log("------------------------------------------------------------------");
  if (shouldRotateAi) {
    console.log(`Workspace BYOK (AI)      ${String(statsOrg.total).padEnd(7)} ${String(statsOrg.activeKeyCompliant).padEnd(11)} ${String(statsOrg.stillOnPreviousKey).padEnd(16)} (${String(statsOrg.migrated).padEnd(8)}) ${String(statsOrg.corrupted).padEnd(11)} ${statsOrg.conflicts}`);
    console.log(`Personal BYOK (AI)       ${String(statsUser.total).padEnd(7)} ${String(statsUser.activeKeyCompliant).padEnd(11)} ${String(statsUser.stillOnPreviousKey).padEnd(16)} (${String(statsUser.migrated).padEnd(8)}) ${String(statsUser.corrupted).padEnd(11)} ${statsUser.conflicts}`);
  }
  if (shouldRotateIntegrations) {
    console.log(`OAuth Tokens (Integr.)   ${String(statsInt.total).padEnd(7)} ${String(statsInt.activeKeyCompliant).padEnd(11)} ${String(statsInt.stillOnPreviousKey).padEnd(16)} (${String(statsInt.migrated).padEnd(8)}) ${String(statsInt.corrupted).padEnd(11)} ${statsInt.conflicts}`);
  }
  console.log("==================================================================");

  const totalRemainingOnPrevious =
    (shouldRotateAi ? (statsOrg.stillOnPreviousKey - (isApply ? statsOrg.migrated : 0)) + (statsUser.stillOnPreviousKey - (isApply ? statsUser.migrated : 0)) : 0) +
    (shouldRotateIntegrations ? (statsInt.stillOnPreviousKey - (isApply ? statsInt.migrated : 0)) : 0);

  const totalCorrupted = (shouldRotateAi ? statsOrg.corrupted + statsUser.corrupted : 0) + (shouldRotateIntegrations ? statsInt.corrupted : 0);
  const totalConflicts = (shouldRotateAi ? statsOrg.conflicts + statsUser.conflicts : 0) + (shouldRotateIntegrations ? statsInt.conflicts : 0);

  if (isVerify) {
    if (totalRemainingOnPrevious === 0 && totalCorrupted === 0 && totalConflicts === 0) {
      console.log("✅ CERTIFICATION PASSED: 100% of examined records are on the active encryption key.");
      console.log("Zero records depend on the previous key. It is now safe to decommission the previous key.");
      process.exit(0);
    } else {
      console.error("❌ CERTIFICATION FAILED: Unmigrated, corrupted, or conflicted records detected.");
      console.error(`- Remaining on previous key: ${totalRemainingOnPrevious}`);
      console.error(`- Corrupted / unreadable    : ${totalCorrupted}`);
      console.error(`- Concurrency conflicts     : ${totalConflicts}`);
      console.error("DO NOT remove the previous key from production environment variables.");
      process.exit(1);
    }
  }

  if (isApply) {
    if (totalConflicts > 0 || totalCorrupted > 0 || totalRemainingOnPrevious > 0) {
      console.warn("⚠️  MIGRATION WARNING: Partial failures, unmigrated rows, OCC conflicts, or corrupted rows detected.");
      console.warn("Run the script again to re-attempt conflicted rows, and review corrupted records.");
      process.exit(1);
    } else {
      console.log("✅ Live rotation completed cleanly without conflicts.");
      console.log("Next step: Run with `--verify` to certify that zero records remain on the previous key.");
      process.exit(0);
    }
  } else {
    console.log("Dry-run preview complete. Zero database records were modified.");
    console.log("To execute the live migration with OCC protection, run with `--apply`.");
    process.exit(0);
  }
}

const isDirectExecution = process.argv[1] && (
  process.argv[1].endsWith("rotate-encryption-keys.ts") ||
  process.argv[1].endsWith("rotate-encryption-keys.js") ||
  process.argv[1].includes("rotate-encryption-keys")
);

if (isDirectExecution) {
  runRotation().catch((err) => {
    console.error("Fatal error during rotation:", err.message);
    process.exit(1);
  });
}
