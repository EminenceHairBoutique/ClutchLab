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
import { redirect } from "next/navigation";

import { DeliverForm, ReviewForm } from "@/components/coach/booking-workflows";
import { getSessionUser } from "@/lib/auth/gateway";
import { formatPrice, getMarketplaceStore, type BookingView } from "@/lib/data/marketplace-store";
import { formatDate } from "@/lib/dates";

import { completeBookingAction, respondToBookingAction } from "../marketplace/actions";

export const metadata: Metadata = { title: "My bookings" };

export const dynamic = "force-dynamic";

const STATUS_VARIANT: Record<string, "outline" | "warning" | "success" | "danger"> = {
  requested: "warning",
  accepted: "outline",
  delivered: "outline",
  completed: "success",
  declined: "danger",
  canceled: "danger",
  disputed: "danger",
};

function BookingCard({ booking }: { booking: BookingView }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle className="text-sm">{booking.serviceTitle}</CardTitle>
          <Badge variant={STATUS_VARIANT[booking.status] ?? "outline"}>{booking.status}</Badge>
          <span className="ml-auto text-xs text-faint">
            {formatPrice(booking.priceCents, booking.currency)} · {formatDate(booking.createdAt)}
          </span>
        </div>
        {booking.note && <CardDescription>Player note: {booking.note}</CardDescription>}
      </CardHeader>
      <CardContent className="space-y-3">
        {booking.deliverable && (
          <div className="rounded-md border border-border px-3 py-2">
            <p className="text-xs text-faint">Deliverable</p>
            <p className="whitespace-pre-wrap text-sm">{booking.deliverable}</p>
          </div>
        )}

        {booking.isCoach && booking.status === "requested" && (
          <div className="flex gap-2">
            <form action={respondToBookingAction}>
              <input type="hidden" name="bookingId" value={booking.id} />
              <input type="hidden" name="decision" value="accept" />
              <Button type="submit" size="sm" variant="accent">
                Accept
              </Button>
            </form>
            <form action={respondToBookingAction}>
              <input type="hidden" name="bookingId" value={booking.id} />
              <input type="hidden" name="decision" value="decline" />
              <Button type="submit" size="sm" variant="destructive">
                Decline
              </Button>
            </form>
          </div>
        )}
        {booking.isCoach && booking.status === "accepted" && <DeliverForm bookingId={booking.id} />}

        {!booking.isCoach && booking.status === "delivered" && (
          <form action={completeBookingAction}>
            <input type="hidden" name="bookingId" value={booking.id} />
            <Button type="submit" size="sm" variant="accent">
              Confirm delivery
            </Button>
          </form>
        )}
        {!booking.isCoach && booking.status === "completed" && !booking.reviewed && (
          <ReviewForm bookingId={booking.id} />
        )}
      </CardContent>
    </Card>
  );
}

export default async function BookingsPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const { asPlayer, asCoach } = await getMarketplaceStore().listMyBookings(user.id);

  return (
    <div className="space-y-5">
      <nav aria-label="Breadcrumb" className="text-xs text-muted">
        <Link href="/coach/marketplace" className="hover:text-accent">
          Marketplace
        </Link>{" "}
        / Bookings
      </nav>
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">My bookings</h1>
        <p className="text-sm text-muted">
          Booked sessions and, if you coach, your incoming requests. Confirming delivery releases
          the coach payout (minus the platform fee); reviews unlock after confirmation.
        </p>
      </div>

      <div className="space-y-2">
        <h2 className="text-lg font-semibold">As player</h2>
        {asPlayer.length === 0 && (
          <p className="text-sm text-muted">
            No bookings yet — find a coach in the{" "}
            <Link href="/coach/marketplace" className="text-accent hover:underline">
              marketplace
            </Link>
            .
          </p>
        )}
        {asPlayer.map((booking) => (
          <BookingCard key={booking.id} booking={booking} />
        ))}
      </div>

      {asCoach.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-lg font-semibold">As coach</h2>
          {asCoach.map((booking) => (
            <BookingCard key={booking.id} booking={booking} />
          ))}
        </div>
      )}
    </div>
  );
}
