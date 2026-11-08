import crypto from "crypto";
import { logger } from "@/lib/security/logger";

export type GuardrailActionType =
  | "email.send"
  | "calendar.create"
  | "calendar.update"
  | "calendar.delete";

export type GuardrailActionState =
  | "draft_created"
  | "awaiting_confirmation"
  | "authorized"
  | "executed"
  | "failed"
  | "cancelled";

export interface ActionApprovalTicket {
  ticketId: string;
  actionType: GuardrailActionType;
  organizationId: string;
  userId: string;
  payloadHash: string;
  state: GuardrailActionState;
  createdAt: number;
  expiresAt: number;
  nonce: string;
  signature: string;
}

export interface VerificationResult {
  valid: boolean;
  code?: "INVALID_SIGNATURE" | "EXPIRED" | "REPLAY_DETECTED" | "PAYLOAD_MISMATCH" | "TENANT_MISMATCH" | "USER_MISMATCH" | "INVALID_FORMAT";
  error?: string;
  ticket?: ActionApprovalTicket;
}

// In-memory set of consumed nonces/tickets to guarantee single-use and anti-replay
// Tracks ticketId -> consumedAt timestamp
const consumedTickets = new Map<string, number>();

// In-memory registry of active tickets to track state transitions
const activeTickets = new Map<string, ActionApprovalTicket>();

// Cleanup stale consumed and active tickets older than 30 minutes
function cleanupOldTickets() {
  const cutoff = Date.now() - 30 * 60 * 1000;
  for (const [id, time] of consumedTickets.entries()) {
    if (time < cutoff) {
      consumedTickets.delete(id);
    }
  }
  for (const [id, ticket] of activeTickets.entries()) {
    if (ticket.expiresAt < Date.now() - 5 * 60 * 1000) {
      activeTickets.delete(id);
    }
  }
}

/**
 * Returns a deterministic, canonical JSON string where object keys are deeply sorted.
 * Ensures consistent cryptographic hashes regardless of object property ordering.
 */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return "[" + value.map((item) => canonicalJson(item)).join(",") + "]";
  }

  const obj = value as Record<string, unknown>;
  const sortedKeys = Object.keys(obj).sort();
  const pairs = sortedKeys
    .filter((k) => obj[k] !== undefined)
    .map((k) => `${JSON.stringify(k)}:${canonicalJson(obj[k])}`);

  return "{" + pairs.join(",") + "}";
}

/**
 * Computes SHA-256 digest of the canonical action payload.
 */
export function computePayloadHash(actionType: GuardrailActionType, payload: unknown): string {
  const canonical = canonicalJson({
    actionType,
    payload,
  });
  return crypto.createHash("sha256").update(canonical).digest("hex");
}

function getSigningSecret(): string {
  const secret =
    process.env.SUPABASE_JWT_SECRET?.trim() ||
    process.env.INTEGRATION_TOKEN_ENCRYPTION_KEY?.trim() ||
    process.env.ENCRYPTION_KEY?.trim();

  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "CRITICAL SECURITY CONFIGURATION ERROR: SUPABASE_JWT_SECRET or INTEGRATION_TOKEN_ENCRYPTION_KEY must be configured in production for guardrail action signing. Fallback to hardcoded dev key is strictly prohibited."
      );
    }
    return "company-brain-guardrail-secret-fallback-key-32bytes";
  }

  return secret;
}

/**
 * Signs an approval ticket using HMAC-SHA256 over its immutable parameters.
 */
export function signTicket(ticket: Omit<ActionApprovalTicket, "signature">): string {
  const canonicalPayload = [
    ticket.ticketId,
    ticket.actionType,
    ticket.organizationId,
    ticket.userId,
    ticket.payloadHash,
    ticket.createdAt,
    ticket.expiresAt,
    ticket.nonce,
  ].join("|");

  return crypto
    .createHmac("sha256", getSigningSecret())
    .update(canonicalPayload)
    .digest("hex");
}

/**
 * Issues a cryptographically signed ActionApprovalTicket.
 * Default TTL is 10 minutes.
 */
export function createActionApprovalTicket(params: {
  actionType: GuardrailActionType;
  payload: unknown;
  organizationId: string;
  userId: string;
  ttlMs?: number;
}): ActionApprovalTicket {
  cleanupOldTickets();

  const ticketId = crypto.randomUUID();
  const nonce = crypto.randomBytes(16).toString("hex");
  const createdAt = Date.now();
  const ttl = params.ttlMs ?? 10 * 60 * 1000; // 10 minutes default
  const expiresAt = createdAt + ttl;

  const payloadHash = computePayloadHash(params.actionType, params.payload);

  const unsigned: Omit<ActionApprovalTicket, "signature"> = {
    ticketId,
    actionType: params.actionType,
    organizationId: params.organizationId,
    userId: params.userId,
    payloadHash,
    state: "awaiting_confirmation",
    createdAt,
    expiresAt,
    nonce,
  };

  const signature = signTicket(unsigned);
  const ticket: ActionApprovalTicket = {
    ...unsigned,
    signature,
  };

  activeTickets.set(ticketId, ticket);
  return ticket;
}

/**
 * Verifies an ActionApprovalTicket against the exact payload and executing security context.
 * Performs all invariant validations:
 * 1. HMAC signature integrity.
 * 2. Organization and user scoping (anti-IDOR / anti-cross-workspace).
 * 3. Expiration TTL check.
 * 4. Anti-replay (ticketId single-use consumption).
 * 5. Exact payload hash equality. Any discrepancy (modified text, date, attendee) invalidates the ticket.
 */
export function verifyActionApprovalTicket(params: {
  ticket: ActionApprovalTicket;
  currentPayload: unknown;
  organizationId: string;
  userId: string;
  markConsumed?: boolean;
}): VerificationResult {
  cleanupOldTickets();

  const { ticket, currentPayload, organizationId, userId, markConsumed = true } = params;

  if (!ticket || !ticket.ticketId || !ticket.signature || !ticket.payloadHash) {
    return { valid: false, code: "INVALID_FORMAT", error: "Malformed approval ticket structure." };
  }

  // 1. Verify cryptographic HMAC signature
  const expectedSig = signTicket({
    ticketId: ticket.ticketId,
    actionType: ticket.actionType,
    organizationId: ticket.organizationId,
    userId: ticket.userId,
    payloadHash: ticket.payloadHash,
    state: ticket.state,
    createdAt: ticket.createdAt,
    expiresAt: ticket.expiresAt,
    nonce: ticket.nonce,
  });

  const sigBufferA = Buffer.from(ticket.signature, "hex");
  const sigBufferB = Buffer.from(expectedSig, "hex");

  if (
    sigBufferA.length !== sigBufferB.length ||
    !crypto.timingSafeEqual(sigBufferA, sigBufferB)
  ) {
    logger.warn("Security violation: ActionApprovalTicket signature mismatch", {
      ticketId: ticket.ticketId,
      organizationId,
      userId,
    });
    return { valid: false, code: "INVALID_SIGNATURE", error: "Ticket signature verification failed." };
  }

  // 2. Multi-tenancy & actor scoping
  if (ticket.organizationId !== organizationId) {
    logger.warn("Security violation: Cross-tenant ticket confirmation rejected", {
      ticketOrgId: ticket.organizationId,
      requestOrgId: organizationId,
    });
    return { valid: false, code: "TENANT_MISMATCH", error: "Workspace mismatch on action approval." };
  }

  if (ticket.userId !== userId) {
    logger.warn("Security violation: User mismatch on ticket confirmation", {
      ticketUserId: ticket.userId,
      requestUserId: userId,
    });
    return { valid: false, code: "USER_MISMATCH", error: "Action confirmation must be signed by original actor." };
  }

  // 3. Expiration check
  if (Date.now() > ticket.expiresAt) {
    return { valid: false, code: "EXPIRED", error: "Confirmation ticket has expired. Please request a new confirmation." };
  }

  // 4. Anti-replay / Double-submit check
  if (consumedTickets.has(ticket.ticketId)) {
    logger.warn("Security violation: Replay of consumed ActionApprovalTicket detected", {
      ticketId: ticket.ticketId,
      consumedAt: consumedTickets.get(ticket.ticketId),
    });
    return { valid: false, code: "REPLAY_DETECTED", error: "Action has already been confirmed and executed." };
  }

  // 5. Payload immutability check
  const currentHash = computePayloadHash(ticket.actionType, currentPayload);
  if (currentHash !== ticket.payloadHash) {
    logger.warn("Security guardrail tripped: Action payload was altered after ticket creation", {
      ticketId: ticket.ticketId,
      originalHash: ticket.payloadHash,
      attemptedHash: currentHash,
    });
    return {
      valid: false,
      code: "PAYLOAD_MISMATCH",
      error: "The content or parameters changed after approval was prepared. A new confirmation is required.",
    };
  }

  // Mark ticket as consumed to prevent replay attacks
  if (markConsumed) {
    consumedTickets.set(ticket.ticketId, Date.now());
    const stored = activeTickets.get(ticket.ticketId);
    if (stored) {
      stored.state = "executed";
    }
  }

  return { valid: true, ticket };
}

/**
 * Transitions ticket state explicitly to 'cancelled'.
 */
export function cancelActionApprovalTicket(ticketId: string, organizationId: string, userId: string): boolean {
  const ticket = activeTickets.get(ticketId);
  if (!ticket) return false;
  if (ticket.organizationId !== organizationId || ticket.userId !== userId) return false;
  ticket.state = "cancelled";
  consumedTickets.set(ticketId, Date.now());
  return true;
}
