import type { Instrumentation } from "next";

/**
 * Runs once on server startup: validate the environment before serving anything
 * (a production runtime without Supabase config, or with AUTH_MOCK set, crashes
 * here with an explicit message), then initialize Sentry if a DSN is present.
 */
export async function register(): Promise<void> {
  const { getServerEnv } = await import("@clutchlab/config/env");
  const env = getServerEnv();

  if (env.SENTRY_DSN) {
    const Sentry = await import("@sentry/nextjs");
    Sentry.init({
      dsn: env.SENTRY_DSN,
      environment: env.appEnv,
      tracesSampleRate: env.appEnv === "production" ? 0.1 : 0,
    });
  }
}

/** Forwards uncaught request errors to Sentry (no-op without a DSN). */
export const onRequestError: Instrumentation.onRequestError = async (...args) => {
  const { getServerEnv } = await import("@clutchlab/config/env");
  if (getServerEnv().SENTRY_DSN) {
    const Sentry = await import("@sentry/nextjs");
    await Sentry.captureRequestError(...args);
  }
};
