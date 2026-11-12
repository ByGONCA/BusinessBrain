import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { getStripeClient } from "@/lib/stripe/client";
import { createServiceClient } from "@/lib/supabase/server";
import { logger } from "@/lib/security/logger";
import { getServerAuthToken } from "@/lib/security/authorization";
import { stripeFinancialMemoryCache } from "@/lib/integrations/stripe/cache";
import Stripe from "stripe";

// Execution runtime limits: Bounded 60-second max duration on Vercel Serverless Function
export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  // 1. Controlled Cutover Guard: Return intentional retryable HTTP 503 during deployment/migration
  if (process.env.STRIPE_WEBHOOKS_PAUSED === "true") {
    logger.warn("[Stripe Webhook Cutover] Ingestion paused for deployment/migration. Returning retryable HTTP 503.", {
      path: "/api/webhooks/stripe",
      timestamp: new Date().toISOString(),
    });
    return new NextResponse(
      JSON.stringify({
        error: "Service Temporarily Unavailable",
        message: "Webhook processing is temporarily paused for scheduled migration cutover. Please retry.",
        retryable: true,
      }),
      {
        status: 503,
        headers: {
          "Content-Type": "application/json",
          "Retry-After": "30",
        },
      }
    );
  }

  const body = await req.text();
  const headerList = await headers();
  const signature = headerList.get("stripe-signature");

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!signature || !webhookSecret) {
    logger.error("Missing stripe-signature header or STRIPE_WEBHOOK_SECRET configuration");
    return NextResponse.json(
      { error: "Webhook authentication failed." },
      { status: 400 }
    );
  }

  let event: Stripe.Event;
  try {
    const stripe = getStripeClient();
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err: unknown) {
    logger.error("Stripe webhook signature verification failed", err);
    return NextResponse.json({ error: "Invalid webhook signature." }, { status: 400 });
  }

  const supabase = createServiceClient();
  const stripe = getStripeClient();
  const workerLeaseToken = crypto.randomUUID();

  // Webhook Idempotency & Lifecycle: Claim processing lease with worker fencing
  try {
    const { data: canProcess, error: ledgerError } = await supabase.rpc(
      "record_stripe_webhook_event",
      {
        p_event_id: event.id,
        p_event_type: event.type,
        p_lease_token: workerLeaseToken,
        p_server_token: getServerAuthToken("stripe-webhook"),
      }
    );

    if (ledgerError) {
      logger.error("[Stripe Webhook] Database contract unready: record_stripe_webhook_event RPC failed", {
        eventId: event.id,
        error: ledgerError.message,
      });
      // CRITICAL CONTRACT GUARD:
      // It must be impossible to resume processing before the database contract is ready.
      // Return retryable HTTP 503 so Stripe retries once migration 00050 is verified.
      return new NextResponse(
        JSON.stringify({
          error: "Database Contract Unready",
          message: "Database migration 00050 has not completed. Ingestion paused for contract readiness.",
          retryable: true,
        }),
        {
          status: 503,
          headers: {
            "Content-Type": "application/json",
            "Retry-After": "30",
          },
        }
      );
    } else if (canProcess === false) {
      logger.info(`[Stripe Webhook] Duplicate or actively locked event ignored (idempotency): ${event.id}`);
      return NextResponse.json({ received: true, duplicate: true }, { status: 200 });
    }
  } catch (err: unknown) {
    logger.error("[Stripe Webhook] Critical exception in idempotency ledger lease claim", {
      eventId: event.id,
      error: err instanceof Error ? err.message : String(err),
    });
    return new NextResponse(
      JSON.stringify({
        error: "Idempotency Ledger Failure",
        message: "Failed to claim processing lease. Webhook will be retried.",
        retryable: true,
      }),
      {
        status: 503,
        headers: {
          "Content-Type": "application/json",
          "Retry-After": "30",
        },
      }
    );
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.mode === "subscription" && session.subscription) {
          const subscriptionId =
            typeof session.subscription === "string"
              ? session.subscription
              : session.subscription.id;

          const customerId =
            typeof session.customer === "string"
              ? session.customer
              : session.customer?.id || "";

          const orgId = session.metadata?.organization_id;
          const plan = session.metadata?.plan || "starter";

          if (orgId) {
            // Multi-tenant collision check: ensure customerId and subscriptionId do not belong to another workspace
            if (customerId) {
              const { data: customerCollision } = await supabase
                .from("subscriptions")
                .select("organization_id")
                .eq("stripe_customer_id", customerId)
                .neq("organization_id", orgId)
                .maybeSingle();

              if (customerCollision) {
                logger.error("Security Alert: Checkout customer belongs to another workspace", {
                  customerId,
                  collidingOrgId: customerCollision.organization_id,
                  targetOrgId: orgId,
                });
                break;
              }
            }

            if (subscriptionId) {
              const { data: subCollision } = await supabase
                .from("subscriptions")
                .select("organization_id")
                .eq("stripe_subscription_id", subscriptionId)
                .neq("organization_id", orgId)
                .maybeSingle();

              if (subCollision) {
                logger.error("Security Alert: Checkout subscription belongs to another workspace", {
                  subscriptionId,
                  collidingOrgId: subCollision.organization_id,
                  targetOrgId: orgId,
                });
                break;
              }
            }

            const sub = await stripe.subscriptions.retrieve(subscriptionId);

            const trialStart = sub.trial_start
              ? new Date(sub.trial_start * 1000).toISOString()
              : null;
            const trialEnd = sub.trial_end
              ? new Date(sub.trial_end * 1000).toISOString()
              : null;

            const currentPeriodStart = (sub as { current_period_start?: number }).current_period_start
              ? new Date((sub as { current_period_start: number }).current_period_start * 1000).toISOString()
              : new Date().toISOString();
            const currentPeriodEnd = (sub as { current_period_end?: number }).current_period_end
              ? new Date((sub as { current_period_end: number }).current_period_end * 1000).toISOString()
              : null;

            // Use Security Definer RPC function for safe server-side upsert with monotonic ordering and worker fencing
            const { error: rpcError } = await supabase.rpc("sync_stripe_subscription", {
              p_organization_id: orgId,
              p_stripe_customer_id: customerId,
              p_stripe_subscription_id: subscriptionId,
              p_plan: plan,
              p_status: sub.status,
              p_trial_start: trialStart,
              p_trial_end: trialEnd,
              p_current_period_start: currentPeriodStart,
              p_current_period_end: currentPeriodEnd,
              p_cancel_at_period_end: sub.cancel_at_period_end,
              p_server_token: getServerAuthToken("stripe-webhook"),
              p_stripe_event_created: new Date(event.created * 1000).toISOString(),
              p_event_id: event.id,
              p_lease_token: workerLeaseToken,
            });

            if (rpcError) {
              if (rpcError.code === "23505" || rpcError.message?.includes("Cross-tenant collision")) {
                logger.error("Security Alert: Webhook RPC sync rejected due to cross-tenant collision in checkout.session.completed", {
                  error: rpcError.message,
                  orgId,
                  subscriptionId,
                });
                throw new Error(`Security Alert: Cross-tenant collision rejected: ${rpcError.message}`);
              }

              logger.error("Authoritative sync_stripe_subscription RPC failed in checkout.session.completed", {
                orgId,
                subscriptionId,
                error: rpcError.message,
              });
              // Never silently fall back to unprotected direct PostgREST upsert.
              // Throwing causes fail_stripe_webhook_event to be called and returns retryable HTTP 500.
              throw new Error(`Authoritative subscription sync failed: ${rpcError.message}`);
            }

            logger.info(`[Stripe Webhook] Synced subscription ${subscriptionId} for org ${orgId}`);
            // Invalidate financial L1 cache for the updated organization
            stripeFinancialMemoryCache.invalidateOrganization(orgId);
          }
        }
        break;
      }

      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;
        const subscriptionId = sub.id;
        const customerId =
          typeof sub.customer === "string" ? sub.customer : sub.customer.id;
        const orgId = sub.metadata?.organization_id;
        const plan = sub.metadata?.plan || "starter";

        const trialStart = sub.trial_start
          ? new Date(sub.trial_start * 1000).toISOString()
          : null;
        const trialEnd = sub.trial_end
          ? new Date(sub.trial_end * 1000).toISOString()
          : null;
        const currentPeriodStart = (sub as { current_period_start?: number }).current_period_start
          ? new Date((sub as { current_period_start: number }).current_period_start * 1000).toISOString()
          : null;
        const currentPeriodEnd = (sub as { current_period_end?: number }).current_period_end
          ? new Date((sub as { current_period_end: number }).current_period_end * 1000).toISOString()
          : null;

        // Out-of-order event guard & Multi-tenant collision check:
        if (orgId) {
          // Multi-tenant collision check: ensure customerId and subscriptionId do not belong to another workspace
          if (customerId) {
            const { data: customerCollision } = await supabase
              .from("subscriptions")
              .select("organization_id")
              .eq("stripe_customer_id", customerId)
              .neq("organization_id", orgId)
              .maybeSingle();

            if (customerCollision) {
              logger.error("Security Alert: Subscription update customer belongs to another workspace", {
                customerId,
                collidingOrgId: customerCollision.organization_id,
                targetOrgId: orgId,
              });
              break;
            }
          }

          if (subscriptionId) {
            const { data: subCollision } = await supabase
              .from("subscriptions")
              .select("organization_id")
              .eq("stripe_subscription_id", subscriptionId)
              .neq("organization_id", orgId)
              .maybeSingle();

            if (subCollision) {
              logger.error("Security Alert: Subscription update belongs to another workspace", {
                subscriptionId,
                collidingOrgId: subCollision.organization_id,
                targetOrgId: orgId,
              });
              break;
            }
          }

          const { data: existingSub } = await supabase
            .from("subscriptions")
            .select("status, stripe_subscription_id, updated_at")
            .eq("organization_id", orgId)
            .maybeSingle();

          const eventTimeMs = event.created * 1000;
          const existingUpdatedMs = existingSub?.updated_at ? new Date(existingSub.updated_at).getTime() : 0;

          // Authoritative state container for webhook synchronization
          let effectiveSub = sub;
          let effectivePlan = plan;
          let effectiveTrialStart = trialStart;
          let effectiveTrialEnd = trialEnd;
          let effectiveCurrentPeriodStart = currentPeriodStart;
          let effectiveCurrentPeriodEnd = currentPeriodEnd;

          // Case A: Subscription already canceled in DB -> must not be resurrected by older or stale event
          if (
            existingSub?.status === "canceled" &&
            existingSub?.stripe_subscription_id === subscriptionId &&
            sub.status !== "canceled"
          ) {
            try {
              const liveSub = await stripe.subscriptions.retrieve(subscriptionId);
              if (liveSub.status === "canceled") {
                logger.warn(`[Stripe Webhook] Live Stripe verification confirmed subscription is canceled. Dropping out-of-order update: ${subscriptionId}`);
                break;
              }
              // If live Stripe actually renewed/resurrected with an active state, adopt authoritative state
              effectiveSub = liveSub;
              effectivePlan = liveSub.metadata?.plan || plan;
              effectiveTrialStart = liveSub.trial_start ? new Date(liveSub.trial_start * 1000).toISOString() : null;
              effectiveTrialEnd = liveSub.trial_end ? new Date(liveSub.trial_end * 1000).toISOString() : null;
              effectiveCurrentPeriodStart = (liveSub as { current_period_start?: number }).current_period_start
                ? new Date((liveSub as { current_period_start: number }).current_period_start * 1000).toISOString()
                : currentPeriodStart;
              effectiveCurrentPeriodEnd = (liveSub as { current_period_end?: number }).current_period_end
                ? new Date((liveSub as { current_period_end: number }).current_period_end * 1000).toISOString()
                : currentPeriodEnd;
            } catch (err: unknown) {
              logger.warn(`[Stripe Webhook] Error fetching live subscription for canceled state check; dropping event to prevent invalid reactivation: ${subscriptionId}`, {
                error: err instanceof Error ? err.message : String(err),
              });
              break;
            }
          } else if (
            existingSub &&
            existingSub.stripe_subscription_id === subscriptionId &&
            eventTimeMs < existingUpdatedMs - 2000
          ) {
            // Case B: Stale event received out-of-order (event.created is older than last database update by > 2s).
            // Reconcile with live Stripe subscription to avoid overwriting newer state (e.g. plan change race).
            try {
              const liveSub = await stripe.subscriptions.retrieve(subscriptionId);
              logger.info(`[Stripe Webhook] Out-of-order event detected (${eventTimeMs} < ${existingUpdatedMs}). Reconciling with authoritative live subscription state: ${liveSub.status}`);
              if (existingSub.status === "canceled" && liveSub.status === "canceled") {
                break;
              }
              effectiveSub = liveSub;
              effectivePlan = liveSub.metadata?.plan || plan;
              effectiveTrialStart = liveSub.trial_start ? new Date(liveSub.trial_start * 1000).toISOString() : null;
              effectiveTrialEnd = liveSub.trial_end ? new Date(liveSub.trial_end * 1000).toISOString() : null;
              effectiveCurrentPeriodStart = (liveSub as { current_period_start?: number }).current_period_start
                ? new Date((liveSub as { current_period_start: number }).current_period_start * 1000).toISOString()
                : currentPeriodStart;
              effectiveCurrentPeriodEnd = (liveSub as { current_period_end?: number }).current_period_end
                ? new Date((liveSub as { current_period_end: number }).current_period_end * 1000).toISOString()
                : currentPeriodEnd;
            } catch (err: unknown) {
              logger.warn(`[Stripe Webhook] Stale event verification failed; dropping out-of-order update: ${subscriptionId}`, {
                error: err instanceof Error ? err.message : String(err),
              });
              break;
            }
          }

          const { error: rpcError } = await supabase.rpc("sync_stripe_subscription", {
            p_organization_id: orgId,
            p_stripe_customer_id: customerId,
            p_stripe_subscription_id: subscriptionId,
            p_plan: effectivePlan,
            p_status: effectiveSub.status,
            p_trial_start: effectiveTrialStart,
            p_trial_end: effectiveTrialEnd,
            p_current_period_start: effectiveCurrentPeriodStart,
            p_current_period_end: effectiveCurrentPeriodEnd,
            p_cancel_at_period_end: effectiveSub.cancel_at_period_end,
            p_server_token: getServerAuthToken("stripe-webhook"),
            p_stripe_event_created: new Date(event.created * 1000).toISOString(),
            p_event_id: event.id,
            p_lease_token: workerLeaseToken,
          });

          if (rpcError) {
            if (rpcError.code === "23505" || rpcError.message?.includes("Cross-tenant collision")) {
              logger.error("Security Alert: Webhook RPC sync rejected due to cross-tenant collision in subscription.updated", {
                error: rpcError.message,
                orgId,
                subscriptionId,
              });
              throw new Error(`Security Alert: Cross-tenant collision rejected: ${rpcError.message}`);
            }

            logger.error("Authoritative sync_stripe_subscription RPC failed in subscription.updated", {
              orgId,
              subscriptionId,
              error: rpcError.message,
            });
            throw new Error(`Authoritative subscription sync failed: ${rpcError.message}`);
          }
        } else {
          // If no orgId in metadata, query database to resolve organization_id from existing subscription
          const { data: existingSubById } = await supabase
            .from("subscriptions")
            .select("organization_id, status, stripe_subscription_id")
            .eq("stripe_subscription_id", subscriptionId)
            .maybeSingle();

          if (existingSubById?.organization_id) {
            // Authoritative upsert through monotonic ordering RPC
            const { error: rpcError } = await supabase.rpc("sync_stripe_subscription", {
              p_organization_id: existingSubById.organization_id,
              p_stripe_customer_id: customerId,
              p_stripe_subscription_id: subscriptionId,
              p_plan: plan,
              p_status: sub.status,
              p_trial_start: trialStart,
              p_trial_end: trialEnd,
              p_current_period_start: currentPeriodStart,
              p_current_period_end: currentPeriodEnd,
              p_cancel_at_period_end: sub.cancel_at_period_end,
              p_server_token: getServerAuthToken("stripe-webhook"),
              p_stripe_event_created: new Date(event.created * 1000).toISOString(),
              p_event_id: event.id,
              p_lease_token: workerLeaseToken,
            });

            if (rpcError) {
              logger.error("Authoritative sync_stripe_subscription RPC failed for subscription without metadata orgId", {
                orgId: existingSubById.organization_id,
                subscriptionId,
                error: rpcError.message,
              });
              throw new Error(`Authoritative subscription sync failed: ${rpcError.message}`);
            }

            stripeFinancialMemoryCache.invalidateOrganization(existingSubById.organization_id);
          } else {
            logger.warn(`[Stripe Webhook] Subscription update dropped: unable to resolve organization_id for subscription ${subscriptionId}`);
          }
        }

        if (orgId) {
          stripeFinancialMemoryCache.invalidateOrganization(orgId);
        }

        logger.info(`[Stripe Webhook] Updated subscription ${subscriptionId} status: ${sub.status}`);
        break;
      }

      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const { error: rpcError } = await supabase.rpc("cancel_stripe_subscription", {
          p_stripe_subscription_id: sub.id,
          p_server_token: getServerAuthToken("stripe-webhook"),
          p_stripe_event_created: new Date(event.created * 1000).toISOString(),
          p_event_id: event.id,
          p_lease_token: workerLeaseToken,
        });

        if (rpcError) {
          logger.error("Authoritative cancel_stripe_subscription RPC failed", {
            subscriptionId: sub.id,
            error: rpcError.message,
          });
          throw new Error(`Authoritative subscription cancellation failed: ${rpcError.message}`);
        }

        logger.info(`[Stripe Webhook] Subscription canceled: ${sub.id}`);
        break;
      }

      case "customer.subscription.trial_will_end": {
        const sub = event.data.object as Stripe.Subscription;
        logger.info(`[Stripe Webhook] Trial ending soon for subscription: ${sub.id}`);
        break;
      }

      case "invoice.paid":
      case "invoice.payment_succeeded": {
        const invoice = event.data.object as Stripe.Invoice;
        const subId =
          typeof invoice.subscription === "string"
            ? invoice.subscription
            : (invoice.subscription as { id?: string } | null)?.id;

        if (subId) {
          const { data: subRecord } = await supabase
            .from("subscriptions")
            .select("organization_id, stripe_customer_id, plan, status, current_period_end")
            .eq("stripe_subscription_id", subId)
            .maybeSingle();

          if (subRecord && subRecord.status !== "canceled") {
            const { error: rpcError } = await supabase.rpc("sync_stripe_subscription", {
              p_organization_id: subRecord.organization_id,
              p_stripe_customer_id: subRecord.stripe_customer_id || (typeof invoice.customer === "string" ? invoice.customer : null),
              p_stripe_subscription_id: subId,
              p_plan: subRecord.plan,
              p_status: "active",
              p_current_period_end: subRecord.current_period_end,
              p_server_token: getServerAuthToken("stripe-webhook"),
              p_stripe_event_created: new Date(event.created * 1000).toISOString(),
              p_event_id: event.id,
              p_lease_token: workerLeaseToken,
            });

            if (rpcError) {
              logger.error("Authoritative sync_stripe_subscription failed for invoice.paid", {
                subId,
                error: rpcError.message,
              });
              throw new Error(`Invoice payment sync failed: ${rpcError.message}`);
            }
          }
        }

        logger.info(`[Stripe Webhook] Payment succeeded for invoice: ${invoice.id}`);
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const subId =
          typeof invoice.subscription === "string"
            ? invoice.subscription
            : (invoice.subscription as { id?: string } | null)?.id;

        if (subId) {
          const { data: subRecord } = await supabase
            .from("subscriptions")
            .select("organization_id, stripe_customer_id, plan, status, current_period_end")
            .eq("stripe_subscription_id", subId)
            .maybeSingle();

          if (subRecord && subRecord.status !== "canceled") {
            const { error: rpcError } = await supabase.rpc("sync_stripe_subscription", {
              p_organization_id: subRecord.organization_id,
              p_stripe_customer_id: subRecord.stripe_customer_id || (typeof invoice.customer === "string" ? invoice.customer : null),
              p_stripe_subscription_id: subId,
              p_plan: subRecord.plan,
              p_status: "past_due",
              p_current_period_end: subRecord.current_period_end,
              p_server_token: getServerAuthToken("stripe-webhook"),
              p_stripe_event_created: new Date(event.created * 1000).toISOString(),
              p_event_id: event.id,
              p_lease_token: workerLeaseToken,
            });

            if (rpcError) {
              logger.error("Authoritative sync_stripe_subscription failed for invoice.payment_failed", {
                subId,
                error: rpcError.message,
              });
              throw new Error(`Invoice payment failed sync failed: ${rpcError.message}`);
            }
          }
          logger.warn(`[Stripe Webhook] Payment failed for invoice ${invoice.id}. Marked as past_due.`);
        }
        break;
      }

      case "account.application.deauthorized": {
        // Stripe Connect: Merchant deauthorized KogSync directly from their Stripe dashboard
        const connectedAccountId = event.account || (event.data?.object as any)?.id;
        if (connectedAccountId) {
          logger.info(`[Stripe Webhook] Connect account deauthorized remotely: ${connectedAccountId}`);
          const { data: orgIntegration } = await supabase
            .from("organization_integrations")
            .select("id, organization_id")
            .eq("provider", "stripe")
            .eq("provider_account_id", connectedAccountId)
            .maybeSingle();

          if (orgIntegration) {
            await supabase
              .from("organization_integrations")
              .update({
                status: "disconnected",
                encrypted_access_token: null,
                encrypted_refresh_token: null,
                updated_at: new Date().toISOString(),
              })
              .eq("id", orgIntegration.id);

            stripeFinancialMemoryCache.invalidateOrganization(orgIntegration.organization_id);
            logger.info(`[Stripe Webhook] Marked Stripe integration as disconnected for org: ${orgIntegration.organization_id}`);
          }
        }
        break;
      }

      default:
        break;
    }

    // Mark webhook ledger entry as completed with worker fencing token
    const { data: completedSuccess, error: completeError } = await supabase.rpc("complete_stripe_webhook_event", {
      p_event_id: event.id,
      p_lease_token: workerLeaseToken,
      p_server_token: getServerAuthToken("stripe-webhook"),
    });

    if (completeError) {
      logger.error(`[Stripe Webhook] Authoritative completion RPC failed for event ${event.id}`, completeError);
      throw new Error(`Authoritative webhook completion failed: ${completeError.message}`);
    } else if (completedSuccess === false) {
      logger.warn(`[Stripe Webhook] Completion was fenced out for event ${event.id}; lease was reclaimed by another worker`);
    }

    return NextResponse.json({ received: true }, { status: 200 });
  } catch (error: unknown) {
    logger.error("Error processing Stripe webhook event", error, {
      eventId: event.id,
      eventType: event.type,
    });

    // Mark webhook ledger entry as failed so retries can re-acquire the lease with worker fencing token
    try {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const { data: failedSuccess, error: failError } = await supabase.rpc("fail_stripe_webhook_event", {
        p_event_id: event.id,
        p_lease_token: workerLeaseToken,
        p_error: errorMessage,
        p_server_token: getServerAuthToken("stripe-webhook"),
      });

      if (failError) {
        logger.error(`[Stripe Webhook] fail_stripe_webhook_event RPC error for event ${event.id}`, failError);
      } else if (failedSuccess === false) {
        logger.warn(`[Stripe Webhook] Failure transition was fenced out for event ${event.id}; lease was reclaimed by another worker`);
      }
    } catch (failEx) {
      logger.error(`[Stripe Webhook] Failed to record failure state for event ${event.id}`, failEx);
    }

    return NextResponse.json(
      { error: "Webhook event processing failed" },
      { status: 500 }
    );
  }
}
