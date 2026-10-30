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
 */
export function decryptToken(encryptedPayload: string): string {
  if (!encryptedPayload) return "";
  const parts = encryptedPayload.split(":");
  if (parts.length !== 3) {
    throw new Error("Invalid encrypted token format.");
  }

  const [ivHex, authTagHex, ciphertextHex] = parts;
  const key = getEncryptionKey();
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
 */
export function decryptAICredential(encryptedPayload: string): string {
  if (!encryptedPayload) return "";
  const parts = encryptedPayload.split(":");
  if (parts.length !== 3) {
    throw new Error("Invalid encrypted AI credential format.");
  }

  const [ivHex, authTagHex, ciphertextHex] = parts;
  const key = getEncryptionKey("AI_CREDENTIALS_ENCRYPTION_KEY");
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
 * Computes a deterministic HMAC-SHA256 fingerprint of an API key.
 * Used for duplicate detection within the same organization without persisting raw secrets.
 */
export function computeKeyFingerprint(rawKey: string): string {
  if (!rawKey) return "";
  const key = getEncryptionKey("AI_CREDENTIALS_ENCRYPTION_KEY");
  return crypto.createHmac("sha256", key).update(rawKey).digest("hex");
}

