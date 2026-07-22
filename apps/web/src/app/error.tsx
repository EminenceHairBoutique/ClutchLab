"use client";

import { Button } from "@clutchlab/ui";
import { useEffect } from "react";

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
    if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
      void import("@sentry/nextjs").then((Sentry) => {
        Sentry.captureException(error);
      });
    }
  }, [error]);

  return (
    <div className="flex flex-col items-start gap-4 py-16">
      <h1 className="text-2xl font-bold tracking-tight">Something broke</h1>
      <p className="text-sm text-muted">
        The error has been logged. Try again — if it keeps happening, it&apos;s on us, not your
        settings.
      </p>
      <Button onClick={reset} variant="accent">
        Try again
      </Button>
    </div>
  );
}
