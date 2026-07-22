import { Button, Card, CardDescription, CardHeader, CardTitle } from "@clutchlab/ui";
import type { Metadata } from "next";

import { markPayoutPaidAction } from "@/app/coach/marketplace/actions";
import { getSessionUser } from "@/lib/auth/gateway";
import { checkRoleAtLeast } from "@/lib/auth/roles";
import { formatPrice, getMarketplaceStore } from "@/lib/data/marketplace-store";
import { formatDate } from "@/lib/dates";

export const metadata: Metadata = { title: "Payout queue" };

/**
 * Payout workflow (§20 Phase 8): completed bookings release coach earnings.
 * Money handling is admin-only — the editor gate on /admin is not enough.
 * Real transfers need Stripe Connect (see PROGRESS blockers); this queue is
 * the ledger + manual marking until then.
 */
export default async function PayoutsPage() {
  const user = await getSessionUser();
  const isAdmin = user ? await checkRoleAtLeast(user, "admin") : false;
  if (!isAdmin) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Admin role required</CardTitle>
          <CardDescription>
            Payouts move money; only admins can access the ledger. Role grants are server-side
            only.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const payouts = await getMarketplaceStore().listPendingPayouts();

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted">
        Completed bookings with earnings due, oldest first. Amounts show the full charge, the
        platform fee, and the coach net. Stripe Connect automates the transfer once configured.
      </p>
      {payouts.length === 0 && (
        <Card>
          <CardHeader>
            <CardTitle>No payouts due</CardTitle>
            <CardDescription>Coach earnings appear here after players confirm delivery.</CardDescription>
          </CardHeader>
        </Card>
      )}
      {payouts.map((payout) => (
        <Card key={payout.orderId}>
          <CardHeader className="pb-2">
            <div className="flex flex-wrap items-center gap-3">
              <CardTitle className="text-sm">{payout.coachName}</CardTitle>
              <span className="text-xs text-muted">
                charge {formatPrice(payout.amountCents, payout.currency)} · fee{" "}
                {formatPrice(payout.platformFeeCents, payout.currency)} ·{" "}
                <strong className="text-foreground">
                  net {formatPrice(payout.coachNetCents, payout.currency)}
                </strong>
              </span>
              <span className="ml-auto text-xs text-faint">{formatDate(payout.createdAt)}</span>
            </div>
          </CardHeader>
          <CardHeader className="pt-0">
            <form action={markPayoutPaidAction}>
              <input type="hidden" name="orderId" value={payout.orderId} />
              <Button type="submit" size="sm" variant="accent">
                Mark payout sent
              </Button>
            </form>
          </CardHeader>
        </Card>
      ))}
    </div>
  );
}
