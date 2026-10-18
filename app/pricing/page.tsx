import Link from "next/link";
import { Sparkles, Check, ArrowRight, ShieldCheck, HelpCircle } from "lucide-react";
import { SUBSCRIPTION_PLANS } from "@/lib/stripe/config";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/server";
import { getActiveOrganization } from "@/lib/organizations/queries";
import { getOrganizationEntitlement } from "@/lib/organizations/entitlements";
import { PricingCards } from "./pricing-cards";

interface PricingPageProps {
  searchParams: Promise<{
    reason?: string;
    canceled?: string;
  }>;
}

export default async function PricingPage({ searchParams }: PricingPageProps) {
  const params = await searchParams;
  const isSubscriptionRequired = params.reason === "subscription_required";
  const wasCanceled = params.canceled === "true";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const activeOrg = user ? await getActiveOrganization() : null;
  const entitlement = activeOrg ? await getOrganizationEntitlement(activeOrg.id) : null;

  return (
    <div className="flex min-h-screen flex-col bg-[#0B0B0C] text-[#F5F5F5]">
      {/* Top Header */}
      <header className="flex h-16 w-full items-center justify-between border-b border-[#29292D] px-6 sm:px-12 bg-[#09090A]/80 backdrop-blur-md">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#19191C] border border-[#29292D] text-[#F5F5F5] shadow-sm">
            <Sparkles className="h-4 w-4 text-blue-400" />
          </div>
          <span className="text-base font-bold tracking-tight text-[#F5F5F5]">
            Company Brain
          </span>
        </Link>

        <div className="flex items-center gap-3">
          {user ? (
            <div className="flex items-center gap-3">
              <span className="text-xs text-[#A1A1AA] hidden sm:inline">
                Signed in as <span className="text-[#F5F5F5] font-medium">{user.email}</span>
              </span>
              {entitlement?.isEntitled && (
                <Link href="/dashboard">
                  <Button size="sm" variant="outline">
                    Back to Dashboard
                  </Button>
                </Link>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link href="/login">
                <Button variant="ghost" size="sm">
                  Sign In
                </Button>
              </Link>
              <Link href="/signup">
                <Button variant="primary" size="sm">
                  Start Free Trial
                </Button>
              </Link>
            </div>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 px-6 py-16 sm:px-12">
        <div className="mx-auto max-w-5xl text-center">
          {/* Gating Notice Banner */}
          {isSubscriptionRequired && (
            <div className="mb-8 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-xs text-amber-300">
              <p className="font-semibold text-sm">Subscription or Free Trial Required</p>
              <p className="mt-1 text-amber-200/80">
                Company Brain does not have a permanent free tier. Select a plan below to start your 7-day free trial and unlock your workspace.
              </p>
            </div>
          )}

          {wasCanceled && (
            <div className="mb-8 rounded-xl border border-[#29292D] bg-[#141416] p-4 text-xs text-[#A1A1AA]">
              <p className="font-semibold text-sm text-[#F5F5F5]">Checkout Canceled</p>
              <p className="mt-1 text-[#71717A]">
                You can select a plan and start your free trial whenever you are ready.
              </p>
            </div>
          )}

          <div className="inline-flex items-center gap-2 rounded-full border border-blue-500/20 bg-blue-500/10 px-3 py-1 text-xs font-medium text-blue-400">
            <Sparkles className="h-3.5 w-3.5" />
            <span>7-Day Full Access Free Trial on All Plans</span>
          </div>

          <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-[#F5F5F5] sm:text-5xl">
            Predictable pricing for your company&apos;s memory
          </h1>

          <p className="mt-4 text-sm text-[#A1A1AA] max-w-xl mx-auto leading-relaxed">
            Every plan includes an unrestricted 7-day free trial. Cancel anytime before your trial ends and you will not be charged.
          </p>

          {/* Pricing Cards Component */}
          <div className="mt-12">
            <PricingCards
              plans={Object.values(SUBSCRIPTION_PLANS)}
              isAuthenticated={!!user}
              activeOrg={activeOrg}
              currentPlan={entitlement?.plan || null}
              isTrial={entitlement?.isTrial || false}
            />
          </div>

          {/* FAQ / Trust Indicators */}
          <div className="mt-20 border-t border-[#29292D] pt-12">
            <div className="grid grid-cols-1 gap-6 text-left sm:grid-cols-3">
              <div className="rounded-xl border border-[#29292D] bg-[#141416] p-5 shadow-sm">
                <ShieldCheck className="h-5 w-5 text-blue-400 mb-2" />
                <h4 className="text-xs font-semibold text-[#F5F5F5]">Enterprise Isolation</h4>
                <p className="mt-1 text-[11px] text-[#A1A1AA] leading-relaxed">
                  Every organization operates within an isolated PostgreSQL schema enforced with Row Level Security.
                </p>
              </div>

              <div className="rounded-xl border border-[#29292D] bg-[#141416] p-5 shadow-sm">
                <HelpCircle className="h-5 w-5 text-blue-400 mb-2" />
                <h4 className="text-xs font-semibold text-[#F5F5F5]">How do free trials work?</h4>
                <p className="mt-1 text-[11px] text-[#A1A1AA] leading-relaxed">
                  You get 7 days of full access to explore Company Brain. You can cancel at any time with one click.
                </p>
              </div>

              <div className="rounded-xl border border-[#29292D] bg-[#141416] p-5 shadow-sm">
                <Sparkles className="h-5 w-5 text-blue-400 mb-2" />
                <h4 className="text-xs font-semibold text-[#F5F5F5]">Can I switch plans later?</h4>
                <p className="mt-1 text-[11px] text-[#A1A1AA] leading-relaxed">
                  Yes, you can upgrade, downgrade, or update your workspace subscription at any time.
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-[#29292D] px-6 py-6 text-center text-xs text-[#71717A]">
        Company Brain &copy; {new Date().getFullYear()}. Secure billing via Stripe.
      </footer>
    </div>
  );
}
