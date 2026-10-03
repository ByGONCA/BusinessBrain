import Stripe from "stripe";

let stripeInstance: Stripe | null = null;

/**
 * Returns a singleton server-side Stripe client.
 *
 * SECURITY INVARIANT:
 * - NEVER import this client in Client Components or expose to the browser bundle.
 */
export function getStripeClient(): Stripe {
  if (stripeInstance) {
    return stripeInstance;
  }

  const apiKey = process.env.STRIPE_SECRET_KEY;
  if (!apiKey) {
    throw new Error(
      "Missing STRIPE_SECRET_KEY environment variable. Required for Stripe server operations."
    );
  }

  stripeInstance = new Stripe(apiKey, {
    apiVersion: "2025-02-24.acacia",
    appInfo: {
      name: "Company Brain SaaS",
      version: "0.1.0",
    },
  });

  return stripeInstance;
}
