import * as Sentry from "@sentry/nextjs";
import { filterSentryEvent, filterSentryBreadcrumb } from "@/lib/security/sentry-filter";

const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN;

Sentry.init({
  dsn: SENTRY_DSN,
  // Automatically disable Sentry when DSN is absent (e.g. dev without env, tests)
  enabled: Boolean(SENTRY_DSN),

  // Conservative performance sampling suitable for free/hobby tiers (5% sample rate)
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.05 : 0.0,

  // Never sample healthy sessions to preserve free tier quota (50 replays/month limit)
  replaysSessionSampleRate: 0.0,

  // Sample on error at very conservative rate with full privacy masking and blocking
  replaysOnErrorSampleRate: process.env.NODE_ENV === "production" ? 0.05 : 0.0,

  integrations: [
    Sentry.replayIntegration({
      maskAllText: true,
      maskAllInputs: true,
      blockAllMedia: true,
      block: [
        "form",
        "input",
        "textarea",
        "select",
        "[data-private]",
        "[data-sensitive]",
      ],
    }),
  ],

  // Security & Data Sanitization Filters
  beforeSend(event) {
    return filterSentryEvent(event);
  },

  beforeBreadcrumb(breadcrumb) {
    return filterSentryBreadcrumb(breadcrumb);
  },
});
