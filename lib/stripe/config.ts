import { PlanConfig, SubscriptionTier } from "./types";

/**
 * Global configurable free trial duration in days.
 * Defaults to 3 days if TRIAL_DAYS is not set in environment.
 */
export function getTrialDays(): number {
  const envVal = process.env.TRIAL_DAYS;
  const parsed = envVal ? parseInt(envVal, 10) : 3;
  return isNaN(parsed) || parsed <= 0 ? 7 : parsed;
}

/**
 * Enterprise Plan Definitions (No permanent free tier in Company Brain).
 * Every plan starts with a configurable free trial.
 */
export const SUBSCRIPTION_PLANS: Record<SubscriptionTier, PlanConfig> = {
  starter: {
    id: "starter",
    name: "Starter",
    description: "Essential intelligence and institutional memory for early-stage companies.",
    monthlyPriceUsd: 29,
    stripePriceIdMonthly: process.env.STRIPE_STARTER_PRICE_ID,
    trialDays: getTrialDays(),
    features: [
      "3-day full access free trial",
      "Up to 10 team members",
      "Unlimited projects & tasks",
      "Centralized Decision Log (ADRs)",
      "Meeting records & action items",
      "Standard workspace support",
    ],
    limits: {
      maxMembers: 10,
      maxProjects: 25,
      maxStorageMb: 5000, // 5 GB
      monthlyAICredits: 1000,
    },
  },
  pro: {
    id: "pro",
    name: "Pro",
    description: "For fast-growing companies demanding unified context and future AI operations.",
    monthlyPriceUsd: 79,
    stripePriceIdMonthly: process.env.STRIPE_PRO_PRICE_ID,
    trialDays: getTrialDays(),
    features: [
      "3-day full access free trial",
      "Up to 50 team members",
      "Unlimited projects, tasks & decisions",
      "Knowledge Base wikis & SOP docs",
      "AI Company Brain Assistant (future)",
      "Automated meeting transcription (future)",
      "Priority customer support",
    ],
    limits: {
      maxMembers: 50,
      maxProjects: 1000,
      maxStorageMb: 50000, // 50 GB
      monthlyAICredits: 5000,
    },
  },
  enterprise: {
    id: "enterprise",
    name: "Enterprise",
    description: "Dedicated security, custom integrations, and SLA guarantees for scaling enterprises.",
    monthlyPriceUsd: 299,
    stripePriceIdMonthly: process.env.STRIPE_ENTERPRISE_PRICE_ID,
    trialDays: getTrialDays(),
    features: [
      "3-day full access free trial",
      "Unlimited team members",
      "Dedicated infrastructure & custom models",
      "Audit logging & enterprise security",
      "SSO / SAML 2.0 enforcement",
      "99.9% uptime SLA",
      "Dedicated account manager",
    ],
    limits: {
      maxMembers: 10000,
      maxProjects: 100000,
      maxStorageMb: 1000000, // 1 TB
      monthlyAICredits: 100000,
    },
  },
};

/**
 * Server-side resolution of internal plan ID to Stripe Price ID.
 * NEVER trust price IDs sent from the client browser.
 */
export function resolveStripePriceId(planId: string): string | undefined {
  const plan = SUBSCRIPTION_PLANS[planId as SubscriptionTier];
  return plan?.stripePriceIdMonthly;
}
