import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { getStripeClient } from "@/lib/stripe/client";
import { createServiceClient } from "@/lib/supabase/server";
import { logger } from "@/lib/security/logger";
import { getServerAuthToken } from "@/lib/security/authorization";
import Stripe from "stripe";

export async function POST(req: Request) {
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

  // Webhook Idempotency: Verify if event has already been processed
  try {
    const { data: isNew, error: ledgerError } = await supabase.rpc(
      "record_stripe_webhook_event",
      {
        p_event_id: event.id,
        p_event_type: event.type,
        p_server_token: getServerAuthToken("stripe-webhook"),
      }
    );

    if (ledgerError) {
      // Fallback check against stripe_webhook_events table if RPC is delayed
      const { data: existing } = await supabase
        .from("stripe_webhook_events")
        .select("id")
        .eq("id", event.id)
        .maybeSingle();

      if (existing) {
        logger.info(`[Stripe Webhook] Duplicate event ignored (idempotency): ${event.id}`);
        return NextResponse.json({ received: true, duplicate: true }, { status: 200 });
      }

      await supabase.from("stripe_webhook_events").insert({
        id: event.id,
        event_type: event.type,
      });
    } else if (isNew === false) {
      logger.info(`[Stripe Webhook] Duplicate event ignored (idempotency): ${event.id}`);
      return NextResponse.json({ received: true, duplicate: true }, { status: 200 });
    }
  } catch (err: unknown) {
    logger.warn("Idempotency ledger lookup skipped or errored", {
      eventId: event.id,
      error: err instanceof Error ? err.message : String(err),
    });
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

            // Use Security Definer RPC function for safe server-side upsert
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
            });

            if (rpcError) {
              if (rpcError.code === "23505" || rpcError.message?.includes("Cross-tenant collision")) {
                logger.error("Security Alert: Webhook RPC sync rejected due to cross-tenant collision in checkout.session.completed", {
                  error: rpcError.message,
                  orgId,
                  subscriptionId,
                });
                break;
              }

              logger.warn("Failed to sync Stripe subscription via RPC, falling back to direct upsert", {
                orgId,
                subscriptionId,
                error: rpcError.message,
              });

              const { error: upsertError } = await supabase.from("subscriptions").upsert(
                {
                  organization_id: orgId,
                  stripe_customer_id: customerId,
                  stripe_subscription_id: subscriptionId,
                  plan,
                  status: sub.status,
                  trial_start: trialStart,
                  trial_end: trialEnd,
                  current_period_start: currentPeriodStart,
                  current_period_end: currentPeriodEnd,
                  cancel_at_period_end: sub.cancel_at_period_end,
                  updated_at: new Date().toISOString(),
                },
                { onConflict: "organization_id" }
              );

              if (upsertError) {
                logger.error("Failed to sync Stripe subscription via fallback upsert", upsertError, {
                  orgId,
                  subscriptionId,
                });
                break;
              }
            } else {
              logger.info(`[Stripe Webhook] Synced subscription ${subscriptionId} for org ${orgId}`);
            }
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

          // If the subscription in DB is canceled for this same subscription ID,
          // and the incoming event claims an active status, verify against live Stripe API
          // to ensure stale retries or clock-skewed out-of-order events do not resurrect it.
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
            } catch (err: unknown) {
              logger.warn(`[Stripe Webhook] Error fetching live subscription for canceled state check; dropping event to prevent invalid reactivation: ${subscriptionId}`, {
                error: err instanceof Error ? err.message : String(err),
              });
              break;
            }
          }

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
          });

          if (rpcError) {
            if (rpcError.code === "23505" || rpcError.message?.includes("Cross-tenant collision")) {
              logger.error("Security Alert: Webhook RPC sync rejected due to cross-tenant collision in subscription.updated", {
                error: rpcError.message,
                orgId,
                subscriptionId,
              });
              break;
            }

            logger.warn("Failed to sync updated Stripe subscription via RPC, falling back to direct upsert", {
              orgId,
              subscriptionId,
              error: rpcError.message,
            });

            const { error: upsertError } = await supabase.from("subscriptions").upsert(
              {
                organization_id: orgId,
                stripe_customer_id: customerId,
                stripe_subscription_id: subscriptionId,
                plan,
                status: sub.status,
                trial_start: trialStart,
                trial_end: trialEnd,
                current_period_start: currentPeriodStart,
                current_period_end: currentPeriodEnd,
                cancel_at_period_end: sub.cancel_at_period_end,
                updated_at: new Date().toISOString(),
              },
              { onConflict: "organization_id" }
            );

            if (upsertError) {
              logger.error("Failed to sync updated Stripe subscription via fallback upsert", upsertError, {
                orgId,
                subscriptionId,
              });
              break;
            }
          }
        } else {
          // If no orgId in metadata, verify existing state by subscription ID before updating
          const { data: existingSubById } = await supabase
            .from("subscriptions")
            .select("status, stripe_subscription_id")
            .eq("stripe_subscription_id", subscriptionId)
            .maybeSingle();

          if (existingSubById?.status === "canceled" && sub.status !== "canceled") {
            try {
              const liveSub = await stripe.subscriptions.retrieve(subscriptionId);
              if (liveSub.status === "canceled") {
                logger.warn(`[Stripe Webhook] Live Stripe verification confirmed subscription is canceled. Dropping out-of-order update (no orgId): ${subscriptionId}`);
                break;
              }
            } catch {
              break;
            }
          }

          const { error: updateError } = await supabase
            .from("subscriptions")
            .update({
              status: sub.status,
              trial_start: trialStart,
              trial_end: trialEnd,
              current_period_start: currentPeriodStart,
              current_period_end: currentPeriodEnd,
              cancel_at_period_end: sub.cancel_at_period_end,
              updated_at: new Date().toISOString(),
            })
            .eq("stripe_subscription_id", subscriptionId);

          if (updateError) {
            logger.error("Failed to update subscription by ID without metadata", updateError, {
              subscriptionId,
            });
            break;
          }
        }

        logger.info(`[Stripe Webhook] Updated subscription ${subscriptionId} status: ${sub.status}`);
        break;
      }

      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const { error: rpcError } = await supabase.rpc("cancel_stripe_subscription", {
          p_stripe_subscription_id: sub.id,
          p_server_token: getServerAuthToken("stripe-webhook"),
        });

        if (rpcError) {
          const { error: cancelError } = await supabase
            .from("subscriptions")
            .update({
              status: "canceled",
              updated_at: new Date().toISOString(),
            })
            .eq("stripe_subscription_id", sub.id);

          if (cancelError) {
            logger.error("Failed to cancel subscription via fallback update", cancelError, {
              subscriptionId: sub.id,
            });
            break;
          }
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
          await supabase
            .from("subscriptions")
            .update({
              status: "active",
              updated_at: new Date().toISOString(),
            })
            .eq("stripe_subscription_id", subId)
            .neq("status", "trialing")
            .neq("status", "canceled");
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
          await supabase
            .from("subscriptions")
            .update({
              status: "past_due",
              updated_at: new Date().toISOString(),
            })
            .eq("stripe_subscription_id", subId)
            .neq("status", "canceled");

          logger.warn(`[Stripe Webhook] Payment failed for invoice ${invoice.id}. Marked as past_due.`);
        }
        break;
      }

      default:
        break;
    }

    return NextResponse.json({ received: true }, { status: 200 });
  } catch (error: unknown) {
    logger.error("Error processing Stripe webhook event", error, {
      eventId: event.id,
      eventType: event.type,
    });
    return NextResponse.json(
      { error: "Webhook event processing failed" },
      { status: 500 }
    );
  }
}
