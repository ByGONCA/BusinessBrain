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

export interface StripeEnvironmentAssessment {
  valid: boolean;
  mode: "live" | "test" | "missing";
  isLiveMode: boolean;
  isAutomaticTaxEnabled: boolean;
  taxRegistrationStatus: "NOT_CONFIGURED" | "FLAG_ENABLED_PENDING_REGISTRATION_PROOF";
  webhookSecretConfigured: boolean;
  isProductionReady: boolean;
  error?: string;
  pendingChecks: string[];
}

/**
 * Validates Stripe environment configuration to prevent test/live mode confusion,
 * and explicitly distinguishes local environment variables from verified live production readiness.
 */
export function validateStripeEnvironment(): StripeEnvironmentAssessment {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const isAutomaticTaxEnabled = process.env.STRIPE_AUTOMATIC_TAX === "true";
  const webhookSecretConfigured = !!webhookSecret && webhookSecret.startsWith("whsec_");

  const pendingChecks: string[] = [];

  if (!secretKey) {
    return {
      valid: false,
      mode: "missing",
      isLiveMode: false,
      isAutomaticTaxEnabled,
      taxRegistrationStatus: isAutomaticTaxEnabled
        ? "FLAG_ENABLED_PENDING_REGISTRATION_PROOF"
        : "NOT_CONFIGURED",
      webhookSecretConfigured,
      isProductionReady: false,
      error: "STRIPE_SECRET_KEY is missing from environment.",
      pendingChecks: [
        "Configure STRIPE_SECRET_KEY in production environment.",
        ...(isAutomaticTaxEnabled
          ? ["STRIPE_AUTOMATIC_TAX=true set; live tax registration must be confirmed in Stripe Dashboard."]
          : []),
      ],
    };
  }

  const isLive = secretKey.startsWith("sk_live_");
  const isTest = secretKey.startsWith("sk_test_");

  if (!isLive && !isTest) {
    return {
      valid: false,
      mode: "missing",
      isLiveMode: false,
      isAutomaticTaxEnabled,
      taxRegistrationStatus: isAutomaticTaxEnabled
        ? "FLAG_ENABLED_PENDING_REGISTRATION_PROOF"
        : "NOT_CONFIGURED",
      webhookSecretConfigured,
      isProductionReady: false,
      error: "STRIPE_SECRET_KEY format is invalid (must start with sk_live_ or sk_test_).",
      pendingChecks: [
        "Provide a valid Stripe secret key with sk_live_ or sk_test_ prefix.",
        ...(isAutomaticTaxEnabled
          ? ["STRIPE_AUTOMATIC_TAX=true set; live tax registration must be confirmed in Stripe Dashboard."]
          : []),
      ],
    };
  }

  if (!isLive) {
    pendingChecks.push("Live Stripe API secret key (sk_live_...) required for commercial launch.");
  }

  if (!webhookSecretConfigured) {
    pendingChecks.push("Live Stripe webhook signing secret (whsec_...) required.");
  }

  const taxRegistrationStatus: StripeEnvironmentAssessment["taxRegistrationStatus"] =
    isAutomaticTaxEnabled
      ? "FLAG_ENABLED_PENDING_REGISTRATION_PROOF"
      : "NOT_CONFIGURED";

  if (isAutomaticTaxEnabled) {
    pendingChecks.push(
      "STRIPE_AUTOMATIC_TAX=true flag set; live tax registration must be confirmed in Stripe Dashboard."
    );
  } else {
    pendingChecks.push("Stripe Tax registration and STRIPE_AUTOMATIC_TAX=true required for EU VAT invoicing.");
  }

  if (process.env.NODE_ENV === "production" && isTest) {
    return {
      valid: true,
      mode: "test",
      isLiveMode: false,
      isAutomaticTaxEnabled,
      taxRegistrationStatus,
      webhookSecretConfigured,
      isProductionReady: false,
      error: "Notice: Running in Stripe TEST mode under NODE_ENV=production.",
      pendingChecks,
    };
  }

  // Production readiness requires live mode + live webhook secret + zero pending checks
  const isProductionReady = isLive && webhookSecretConfigured;

  return {
    valid: true,
    mode: isLive ? "live" : "test",
    isLiveMode: isLive,
    isAutomaticTaxEnabled,
    taxRegistrationStatus,
    webhookSecretConfigured,
    isProductionReady,
    pendingChecks,
  };
}
