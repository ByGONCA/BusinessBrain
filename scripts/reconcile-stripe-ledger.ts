/**
 * KogSync — Stripe Ledger Reconciliation Procedure
 *
 * Operational Command: npx tsx scripts/reconcile-stripe-ledger.ts
 *
 * Purpose:
 * Authoritatively reconciles pending or uncompleted ledger records in `stripe_webhook_events`,
 * specifically targeting `legacy_processing` rows left by legacy workers or crashed workers.
 *
 * Guarantees:
 * 1. Never marks an event completed solely because its lease expired.
 * 2. Distinguishes:
 *    - In-Flight Events: Active unexpired lease (skipped / non-disturbed).
 *    - Successfully Mutated Events: Verified against authoritative Stripe state (marked completed).
 *    - Superseded Historical Events: DB already has a newer event timestamp (marked completed without rollback).
 *    - Outdated Events: Forward-synced to Stripe state with monotonic timestamp protection, then marked completed.
 *    - Temporary Stripe API Errors: Skipped and preserved for next retry; NEVER permanently failed on network blip.
 *    - Authoritative 404 / Missing Events: Marked failed for manual review, NEVER marked completed blindly.
 * 3. 100% Idempotent and Auditable: Can be executed repeatedly without side effects.
 */

import { getServerAuthToken } from "../lib/security/authorization";
import { logger } from "../lib/security/logger";

export interface ReconcileResult {
  inFlightCount: number;
  completedMatchedCount: number;
  completedSupersededCount: number;
  forwardSyncedCount: number;
  unresolvableCount: number;
  temporaryErrorCount: number;
  totalProcessed: number;
}

export interface StripeEventLookup {
  id: string;
  type: string;
  subscriptionId?: string;
  customerId?: string;
  status?: string;
  plan?: string;
  currentPeriodEnd?: string;
  created?: string;
}

/**
 * Core Reconciliation Logic
 * Accepts any PostgreSQL client interface (e.g. Supabase client or PGlite instance).
 */
export async function reconcileStripeLedger(
  client: { query: (sql: string, params?: any[]) => Promise<{ rows: any[] }> },
  stripeLookupFn?: (eventId: string) => Promise<StripeEventLookup | null>
): Promise<ReconcileResult> {
  const serverToken = getServerAuthToken("stripe-webhook");
  const result: ReconcileResult = {
    inFlightCount: 0,
    completedMatchedCount: 0,
    completedSupersededCount: 0,
    forwardSyncedCount: 0,
    unresolvableCount: 0,
    temporaryErrorCount: 0,
    totalProcessed: 0,
  };

  // 1. Fetch all events requiring reconciliation
  const pendingEvents = await client.query(`
    select id, event_type, status, lease_token, lease_expires_at, attempt_count, processed_at
    from public.stripe_webhook_events
    where status in ('legacy_processing', 'processing')
    order by processed_at asc
  `);

  const now = Date.now();

  for (const row of pendingEvents.rows) {
    result.totalProcessed++;
    const eventId = row.id;
    const observedAttemptCount = row.attempt_count;
    const observedLeaseToken = row.lease_token;
    const leaseExpiresAt = row.lease_expires_at ? new Date(row.lease_expires_at).getTime() : 0;

    // Check if worker is currently active (in-flight)
    if (leaseExpiresAt > now) {
      result.inFlightCount++;
      logger.info(`[Reconciliation] Event ${eventId} currently in-flight (lease expires in ${Math.round((leaseExpiresAt - now) / 1000)}s). Skipping.`);
      continue;
    }

    // Event lease has expired. Authoritatively verify with Stripe.
    let stripeEvent: StripeEventLookup | null = null;
    let isTemporaryError = false;

    if (stripeLookupFn) {
      try {
        stripeEvent = await stripeLookupFn(eventId);
      } catch (err: unknown) {
        // Distinguish between permanent 404 (resource missing) and transient network / 5xx / rate-limit errors
        const is404 =
          (err as { statusCode?: number })?.statusCode === 404 ||
          (err as { code?: string })?.code === "resource_missing" ||
          (err as { status?: number })?.status === 404;

        if (is404) {
          logger.warn(`[Reconciliation] Stripe event ${eventId} does not exist in Stripe (404/resource_missing).`);
          stripeEvent = null;
        } else {
          // Transient failure: DO NOT mark permanently failed!
          isTemporaryError = true;
          result.temporaryErrorCount++;
          logger.error(`[Reconciliation] Temporary Stripe API failure for event ${eventId}. Preserving event for subsequent retry:`, err);
          continue;
        }
      }
    }

    // Compare-And-Set (CAS) Check: Verify that the event was NOT reclaimed or modified by an active worker during Stripe lookup
    const casCheck = await client.query(`
      select status, lease_token, lease_expires_at, attempt_count
      from public.stripe_webhook_events
      where id = $1
    `, [eventId]);

    const currentEvent = casCheck.rows[0];
    if (
      !currentEvent ||
      currentEvent.attempt_count !== observedAttemptCount ||
      currentEvent.lease_token !== observedLeaseToken ||
      currentEvent.status === "completed" ||
      (currentEvent.lease_expires_at && new Date(currentEvent.lease_expires_at).getTime() > Date.now())
    ) {
      logger.warn(`[Reconciliation] Event ${eventId} was reclaimed or completed by an active worker during Stripe lookup. Aborting reconciliation to preserve active worker.`);
      continue;
    }

    if (!stripeEvent && !isTemporaryError) {
      // Event authoritatively does not exist in Stripe or is unresolvable
      // CRITICAL: NEVER mark completed solely because lease expired!
      await client.query(`
        update public.stripe_webhook_events
        set
          status = 'failed',
          lease_token = null,
          lease_expires_at = null,
          processed_at = clock_timestamp(),
          error_message = 'Reconciliation: Stripe event unresolvable or missing (404). Flagged for manual audit.'
        where id = $1
          and attempt_count = $2
          and status in ('legacy_processing', 'processing')
          and (lease_expires_at is null or lease_expires_at <= clock_timestamp())
      `, [eventId, observedAttemptCount]);
      result.unresolvableCount++;
      continue;
    }

    if (!stripeEvent) {
      continue;
    }

    // If event does not mutate subscriptions (e.g. unhandled informational event)
    if (!stripeEvent.subscriptionId) {
      await client.query(`
        update public.stripe_webhook_events
        set
          status = 'completed',
          lease_token = null,
          lease_expires_at = null,
          processed_at = clock_timestamp(),
          error_message = 'Reconciled: informational event with no subscription mutation.'
        where id = $1
          and attempt_count = $2
          and status in ('legacy_processing', 'processing')
          and (lease_expires_at is null or lease_expires_at <= clock_timestamp())
      `, [eventId, observedAttemptCount]);
      result.completedMatchedCount++;
      continue;
    }

    // Check existing database subscription
    const dbSubRes = await client.query(`
      select id, organization_id, status, plan, stripe_subscription_id, current_period_end, stripe_event_created
      from public.subscriptions
      where stripe_subscription_id = $1
    `, [stripeEvent.subscriptionId]);

    const dbSub = dbSubRes.rows[0];

    if (dbSub) {
      const dbEventCreated = dbSub.stripe_event_created ? new Date(dbSub.stripe_event_created).getTime() : 0;
      const stripeEvtCreated = stripeEvent.created ? new Date(stripeEvent.created).getTime() : 0;

      // Ambiguity check: If DB subscription already has a strictly newer timestamp than this historical event,
      // the business effect was already superseded by a newer event. Sealing the ledger is safe without re-upserting.
      if (dbEventCreated > 0 && stripeEvtCreated > 0 && dbEventCreated > stripeEvtCreated) {
        await client.query(`
          update public.stripe_webhook_events
          set
            status = 'completed',
            lease_token = null,
            lease_expires_at = null,
            processed_at = clock_timestamp(),
            error_message = 'Reconciled: historical event superseded by newer database state.'
          where id = $1
            and attempt_count = $2
            and status in ('legacy_processing', 'processing')
            and (lease_expires_at is null or lease_expires_at <= clock_timestamp())
        `, [eventId, observedAttemptCount]);
        result.completedSupersededCount++;
        continue;
      }

      // Exact match check: DB status and plan match current authoritative Stripe state
      if (dbSub.status === stripeEvent.status && dbSub.plan === stripeEvent.plan) {
        await client.query(`
          update public.stripe_webhook_events
          set
            status = 'completed',
            lease_token = null,
            lease_expires_at = null,
            processed_at = clock_timestamp(),
            error_message = 'Reconciled: verified matching authoritative Stripe state.'
          where id = $1
            and attempt_count = $2
            and status in ('legacy_processing', 'processing')
            and (lease_expires_at is null or lease_expires_at <= clock_timestamp())
        `, [eventId, observedAttemptCount]);
        result.completedMatchedCount++;
      } else {
        // Outdated state: forward-synchronize subscription with monotonic timestamp protection
        await client.query(`
          select public.sync_stripe_subscription(
            $1, $2, $3, $4, $5, null, null, null, $6, false, $7, $8
          )
        `, [
          dbSub.organization_id,
          stripeEvent.customerId || null,
          stripeEvent.subscriptionId,
          stripeEvent.plan || dbSub.plan,
          stripeEvent.status || dbSub.status,
          stripeEvent.currentPeriodEnd || dbSub.current_period_end,
          serverToken,
          stripeEvent.created || null,
        ]);

        await client.query(`
          update public.stripe_webhook_events
          set
            status = 'completed',
            lease_token = null,
            lease_expires_at = null,
            processed_at = clock_timestamp(),
            error_message = 'Reconciled: forward-synced subscription to authoritative Stripe state.'
          where id = $1
            and attempt_count = $2
            and status in ('legacy_processing', 'processing')
            and (lease_expires_at is null or lease_expires_at <= clock_timestamp())
        `, [eventId, observedAttemptCount]);
        result.forwardSyncedCount++;
      }
    } else {
      // Target organization subscription record does not exist
      await client.query(`
        update public.stripe_webhook_events
        set
          status = 'failed',
          lease_token = null,
          lease_expires_at = null,
          processed_at = clock_timestamp(),
          error_message = 'Reconciliation: Target subscription not found in database. Pending manual review.'
        where id = $1
          and attempt_count = $2
          and status in ('legacy_processing', 'processing')
          and (lease_expires_at is null or lease_expires_at <= clock_timestamp())
      `, [eventId, observedAttemptCount]);
      result.unresolvableCount++;
    }
  }

  return result;
}
