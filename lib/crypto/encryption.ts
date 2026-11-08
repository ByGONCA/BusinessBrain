import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // 96 bits for GCM
const AUTH_TAG_LENGTH = 16; // 128 bits

/**
 * Validates and converts an encryption key string into a strict 32-byte Buffer.
 * Strictly requires 64-hex chars (32 bytes) or exactly 32-byte UTF-8 string.
 * Rejects invalid lengths and formats to fail securely.
 */
export function parseAndValidateEncryptionKey(keyStr: string, envVarName: string): Buffer {
  if (!keyStr || typeof keyStr !== "string") {
    throw new Error(`${envVarName} must be a non-empty string.`);
  }

  const trimmed = keyStr.trim();
  if (trimmed.length === 64 && /^[0-9a-fA-F]{64}$/.test(trimmed)) {
    return Buffer.from(trimmed, "hex");
  }

  if (Buffer.byteLength(trimmed, "utf8") === 32) {
    return Buffer.from(trimmed, "utf8");
  }

  throw new Error(
    `${envVarName} is invalid: must be a 64-character hexadecimal string or exactly 32-byte UTF-8 string.`
  );
}

/**
 * Returns a 32-byte Buffer key for AES-256-GCM.
 * Uses process.env[keyEnvVar].
 * AI credentials may inherit INTEGRATION_TOKEN_ENCRYPTION_KEY if AI key is not independently configured.
 * Mandatory in production; deterministic fallback in development/test.
 * Never falls back to Stripe or unrelated secrets.
 */
function getEncryptionKey(keyEnvVar: string = "INTEGRATION_TOKEN_ENCRYPTION_KEY"): Buffer {
  const envKey =
    process.env[keyEnvVar] ||
    (keyEnvVar === "AI_CREDENTIALS_ENCRYPTION_KEY" ? process.env.INTEGRATION_TOKEN_ENCRYPTION_KEY : undefined);

  if (envKey) {
    return parseAndValidateEncryptionKey(envKey, keyEnvVar);
  }

  // Development fallback key (strictly required in production)
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      `${keyEnvVar} is required in production for credential encryption.`
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
  const envKey =
    process.env[keyEnvVar] ||
    (keyEnvVar === "AI_CREDENTIALS_ENCRYPTION_KEY_PREVIOUS"
      ? process.env.INTEGRATION_TOKEN_ENCRYPTION_KEY_PREVIOUS
      : undefined);

  if (!envKey) return null;
  return parseAndValidateEncryptionKey(envKey, keyEnvVar);
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
