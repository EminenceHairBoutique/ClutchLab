import { PLAN_SUMMARIES, PLAN_TIERS, type PlanTier } from "@clutchlab/billing";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@clutchlab/ui";
import type { Metadata } from "next";
import Link from "next/link";

import { getSessionUser } from "@/lib/auth/gateway";
import { billingMode } from "@/lib/billing/gateway";
import { getPlanState } from "@/lib/data/billing-store";
import { formatDate } from "@/lib/dates";

import { mockDowngradeAction, openPortalAction, startCheckoutAction } from "./actions";

export const metadata: Metadata = {
  title: "Plans & Billing",
  description:
    "Free, Pro, and Elite plans for ClutchLab — entitlements, AI analysis quotas, and billing.",
};

export const dynamic = "force-dynamic";

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; notice?: string }>;
}) {
  const { error, notice } = await searchParams;
  const user = await getSessionUser();
  const state = user ? await getPlanState(user.id) : null;
  const mock = billingMode() === "mock";

  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">Plans &amp; Billing</h1>
        <p className="text-sm text-muted">
          Entitlements gate features server-side — what you see below is exactly what each plan
          unlocks. Prices are test ranges until launch pricing is finalized.
        </p>
      </div>

      {mock && (
        <p
          role="status"
          className="rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-warning"
        >
          Billing is in <strong>mock mode</strong> — Stripe is not configured. Plan switches are
          instant, free, and for demo only. See SETUP.md to connect Stripe.
        </p>
      )}
      {notice && (
        <p
          role="status"
          className="rounded-md border border-accent/40 bg-accent/10 px-3 py-2 text-sm"
        >
          {notice}
        </p>
      )}
      {error && (
        <p
          role="alert"
          className="rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger"
        >
          {error}
        </p>
      )}

      {state && (
        <Card>
          <CardContent className="flex flex-wrap items-center gap-3 pt-4">
            <span className="text-sm text-muted">Current plan:</span>
            <Badge variant="accent">{PLAN_SUMMARIES[state.plan].name}</Badge>
            {state.cancelAtPeriodEnd && (
              <Badge variant="warning">
                cancels {state.currentPeriodEnd ? formatDate(state.currentPeriodEnd) : "at period end"}
              </Badge>
            )}
            {state.plan !== "free" &&
              (mock ? (
                <form action={mockDowngradeAction} className="ml-auto">
                  <Button type="submit" size="sm" variant="outline">
                    Back to Free (mock)
                  </Button>
                </form>
              ) : (
                <form action={openPortalAction} className="ml-auto">
                  <Button type="submit" size="sm" variant="outline">
                    Manage billing
                  </Button>
                </form>
              ))}
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {PLAN_TIERS.map((plan: PlanTier) => {
          const summary = PLAN_SUMMARIES[plan];
          const isCurrent = state?.plan === plan;
          return (
            <Card key={plan} className={isCurrent ? "border-accent" : undefined}>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <CardTitle>{summary.name}</CardTitle>
                  {isCurrent && <Badge variant="accent">current</Badge>}
                </div>
                <CardDescription>{summary.priceNote}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <ul className="space-y-1.5 text-sm text-muted">
                  {summary.highlights.map((line) => (
                    <li key={line} className="flex gap-2">
                      <span aria-hidden className="text-accent">
                        •
                      </span>
                      {line}
                    </li>
                  ))}
                </ul>
                {user && plan !== "free" && !isCurrent && (
                  <form action={startCheckoutAction}>
                    <input type="hidden" name="plan" value={plan} />
                    <Button type="submit" variant="accent" className="w-full">
                      {mock ? `Switch to ${summary.name} (mock)` : `Upgrade to ${summary.name}`}
                    </Button>
                  </form>
                )}
                {!user && plan !== "free" && (
                  <Button asChild variant="outline" className="w-full">
                    <Link href="/login">Sign in to upgrade</Link>
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <p className="text-xs text-faint">
        Subscriptions are managed by Stripe when configured — ClutchLab never stores card numbers.
        Plan changes from Stripe arrive via signed webhooks; permissions are enforced server-side.
      </p>
    </div>
  );
}
