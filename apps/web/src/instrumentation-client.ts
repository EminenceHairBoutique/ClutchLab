/**
 * Client-side error monitoring: initialized only when a public DSN is
 * configured, loaded lazily so uninstrumented deployments ship no Sentry code
 * on the critical path.
 */
if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
  void import("@sentry/nextjs").then((Sentry) => {
    Sentry.init({
      dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
      tracesSampleRate: 0,
    });
  });
}
