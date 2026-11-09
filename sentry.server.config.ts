import * as Sentry from "@sentry/nextjs";
import { filterSentryEvent, filterSentryBreadcrumb } from "@/lib/security/sentry-filter";

const SENTRY_DSN = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN;

Sentry.init({
  dsn: SENTRY_DSN,
  // Automatically disable Sentry when DSN is absent
  enabled: Boolean(SENTRY_DSN),

  // Conservative performance sampling suitable for free/hobby tiers (5% sample rate)
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.05 : 0.0,

  // Security & Data Sanitization Filters
  beforeSend(event) {
    return filterSentryEvent(event);
  },

  beforeBreadcrumb(breadcrumb) {
    return filterSentryBreadcrumb(breadcrumb);
  },
});
