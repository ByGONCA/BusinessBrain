export type SubscriptionTier = "starter" | "pro" | "enterprise";

export type SubscriptionStatus =
  | "trialing"
  | "active"
  | "canceled"
  | "incomplete"
  | "incomplete_expired"
  | "past_due"
  | "unpaid"
  | "paused";

export interface PlanConfig {
  id: SubscriptionTier;
  name: string;
  description: string;
  monthlyPriceUsd: number;
  stripePriceIdMonthly?: string;
  stripePriceIdYearly?: string;
  trialDays: number;
  features: string[];
  limits: {
    maxMembers: number;
    maxProjects: number;
    maxStorageMb: number;
    monthlyAICredits: number;
  };
}

export interface OrganizationSubscription {
  id: string;
  organizationId: string;
  stripeCustomerId: string;
  stripeSubscriptionId: string | null;
  status: SubscriptionStatus;
  plan: SubscriptionTier;
  trialStart: string | null;
  trialEnd: string | null;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  createdAt: string;
  updatedAt: string;
}
