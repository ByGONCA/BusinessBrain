import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // 96 bits for GCM
const AUTH_TAG_LENGTH = 16; // 128 bits

/**
 * Returns a 32-byte Buffer key for AES-256-GCM.
 * Uses process.env.AI_CREDENTIALS_ENCRYPTION_KEY or process.env.INTEGRATION_TOKEN_ENCRYPTION_KEY.
 * In development without an explicit key, falls back to a deterministic development key.
 */
function getEncryptionKey(keyEnvVar: string = "INTEGRATION_TOKEN_ENCRYPTION_KEY"): Buffer {
  const envKey = process.env[keyEnvVar] || process.env.INTEGRATION_TOKEN_ENCRYPTION_KEY;

  if (envKey) {
    if (envKey.length === 64) {
      return Buffer.from(envKey, "hex");
    }
    if (Buffer.byteLength(envKey, "utf8") === 32) {
      return Buffer.from(envKey, "utf8");
    }
    // If key has custom length, hash it with SHA-256 to produce exactly 32 bytes
    return crypto.createHash("sha256").update(envKey).digest();
  }

  // Development fallback key (warn in production)
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      `${keyEnvVar} (or INTEGRATION_TOKEN_ENCRYPTION_KEY) is required in production for credential encryption.`
    );
  }

  // Deterministic 32-byte key for local development
  return crypto
    .createHash("sha256")
    .update("company-brain-default-dev-encryption-key-local")
    .digest();
}

/**
 * Resolves an optional previous 32-byte Buffer key for seamless zero-downtime key rotation.
 * Returns null if no previous key is configured.
 */
function getPreviousEncryptionKey(keyEnvVar: string): Buffer | null {
  const envKey = process.env[keyEnvVar];
  if (!envKey) return null;

  if (envKey.length === 64) {
    return Buffer.from(envKey, "hex");
  }
  if (Buffer.byteLength(envKey, "utf8") === 32) {
    return Buffer.from(envKey, "utf8");
  }
  return crypto.createHash("sha256").update(envKey).digest();
}

/**
 * Internal AES-256-GCM decryption helper.
 * Distinguishes malformed structural format errors from cryptographic authentication failures.
 */
function performGcmDecryption(encryptedPayload: string, key: Buffer, formatName: string): string {
  const parts = encryptedPayload.split(":");
  if (parts.length !== 3) {
    throw new Error(`Invalid encrypted ${formatName} format.`);
  }

  const [ivHex, authTagHex, ciphertextHex] = parts;
  if (!ivHex || !authTagHex || !ciphertextHex || ivHex.length !== 24 || authTagHex.length !== 32) {
    throw new Error(`Invalid encrypted ${formatName} format.`);
  }

  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");
  const ciphertext = Buffer.from(ciphertextHex, "hex");

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);

  return decrypted.toString("utf8");
}

/**
 * Encrypts a sensitive string (such as an OAuth access or refresh token) using AES-256-GCM.
 * Output format: `ivHex:authTagHex:ciphertextHex`
 */
export function encryptToken(plaintext: string): string {
  if (!plaintext) return "";
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });

  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);

  const authTag = cipher.getAuthTag();

  return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted.toString("hex")}`;
}

/**
 * Decrypts a ciphertext string created by `encryptToken`.
 * Supports dual-key transition via INTEGRATION_TOKEN_ENCRYPTION_KEY_PREVIOUS.
 */
export function decryptToken(encryptedPayload: string): string {
  if (!encryptedPayload) return "";
  const key = getEncryptionKey();

  try {
    return performGcmDecryption(encryptedPayload, key, "token");
  } catch (primaryErr: any) {
    if (primaryErr?.message?.includes("format")) {
      throw primaryErr;
    }
    const previousKey = getPreviousEncryptionKey("INTEGRATION_TOKEN_ENCRYPTION_KEY_PREVIOUS");
    if (previousKey) {
      try {
        return performGcmDecryption(encryptedPayload, previousKey, "token");
      } catch {
        // Fall through to throw original primary error
      }
    }
    throw primaryErr;
  }
}

/**
 * Encrypts an AI provider API key (BYOK) using AES-256-GCM.
 * Prioritizes process.env.AI_CREDENTIALS_ENCRYPTION_KEY.
 */
export function encryptAICredential(plaintextKey: string): string {
  if (!plaintextKey) return "";
  const key = getEncryptionKey("AI_CREDENTIALS_ENCRYPTION_KEY");
  const iv = crypto.randomBytes(IV_LENGTH);

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });

  const encrypted = Buffer.concat([
    cipher.update(plaintextKey, "utf8"),
    cipher.final(),
  ]);

  const authTag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted.toString("hex")}`;
}

/**
 * Decrypts an AI provider API key ciphertext JIT (Just-In-Time).
 * Supports dual-key transition via AI_CREDENTIALS_ENCRYPTION_KEY_PREVIOUS or
 * INTEGRATION_TOKEN_ENCRYPTION_KEY_PREVIOUS for seamless zero-downtime rotation.
 */
export function decryptAICredential(encryptedPayload: string): string {
  if (!encryptedPayload) return "";
  const key = getEncryptionKey("AI_CREDENTIALS_ENCRYPTION_KEY");

  try {
    return performGcmDecryption(encryptedPayload, key, "AI credential");
  } catch (primaryErr: any) {
    if (primaryErr?.message?.includes("format")) {
      throw primaryErr;
    }
    const previousKey = process.env.AI_CREDENTIALS_ENCRYPTION_KEY
      ? getPreviousEncryptionKey("AI_CREDENTIALS_ENCRYPTION_KEY_PREVIOUS")
      : (getPreviousEncryptionKey("AI_CREDENTIALS_ENCRYPTION_KEY_PREVIOUS") ||
         getPreviousEncryptionKey("INTEGRATION_TOKEN_ENCRYPTION_KEY_PREVIOUS"));

    if (previousKey) {
      try {
        return performGcmDecryption(encryptedPayload, previousKey, "AI credential");
      } catch {
        // Fall through to throw original primary error
      }
    }
    throw primaryErr;
  }
}

/**
 * Computes a deterministic HMAC-SHA256 fingerprint of an API key.
 * Used for duplicate detection within the same organization without persisting raw secrets.
 */
export function computeKeyFingerprint(rawKey: string): string {
  if (!rawKey) return "";
  const key = getEncryptionKey("AI_CREDENTIALS_ENCRYPTION_KEY");
  return crypto.createHmac("sha256", key).update(rawKey).digest("hex");
}
