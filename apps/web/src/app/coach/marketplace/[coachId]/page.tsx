import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Label,
} from "@clutchlab/ui";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { getSessionUser } from "@/lib/auth/gateway";
import { formatPrice, getMarketplaceStore } from "@/lib/data/marketplace-store";
import { formatDate } from "@/lib/dates";

import { requestBookingAction } from "../actions";

export const metadata: Metadata = { title: "Coach profile" };

export const dynamic = "force-dynamic";

export default async function CoachDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ coachId: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { coachId } = await params;
  const { error } = await searchParams;
  const user = await getSessionUser();
  const coach = await getMarketplaceStore().getCoach(coachId);
  if (!coach) notFound();

  const canBook = Boolean(user) && coach.acceptingBookings && user?.id !== coach.userId;

  return (
    <div className="space-y-5">
      <nav aria-label="Breadcrumb" className="text-xs text-muted">
        <Link href="/coach/marketplace" className="hover:text-accent">
          Marketplace
        </Link>{" "}
        / {coach.displayName}
      </nav>

      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-bold tracking-tight">{coach.displayName}</h1>
          {coach.isSample && <Badge variant="outline">sample</Badge>}
          <Badge variant="success">credentials verified</Badge>
          {coach.ratingAverage !== null && (
            <Badge variant="outline">
              ★ {coach.ratingAverage} ({coach.ratingCount})
            </Badge>
          )}
        </div>
        <p className="text-sm text-muted">
          {coach.region} · {coach.languages.join(", ")}
          {coach.headline ? ` — ${coach.headline}` : ""}
        </p>
      </div>

      {error && (
        <p
          role="alert"
          className="rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger"
        >
          {error}
        </p>
      )}

      {coach.bio && (
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm leading-relaxed">{coach.bio}</p>
            {coach.credentials && (
              <p className="mt-2 text-xs text-faint">Verified credentials: {coach.credentials}</p>
            )}
            {coach.availabilityNote && (
              <p className="mt-2 text-xs text-warning">{coach.availabilityNote}</p>
            )}
          </CardContent>
        </Card>
      )}

      <div className="space-y-2">
        <h2 className="text-lg font-semibold">Services</h2>
        {coach.services.map((service) => (
          <Card key={service.id}>
            <CardHeader className="pb-2">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">{service.kindLabel}</Badge>
                <CardTitle className="text-sm">{service.title}</CardTitle>
                <span className="ml-auto text-sm font-medium">
                  {formatPrice(service.priceCents, service.currency)}
                </span>
              </div>
              <CardDescription>
                {service.description ?? ""} Delivered within {service.deliveryDays} day(s).
              </CardDescription>
            </CardHeader>
            {canBook && (
              <CardContent>
                <form action={requestBookingAction} className="flex flex-wrap items-end gap-3">
                  <input type="hidden" name="serviceId" value={service.id} />
                  <input type="hidden" name="coachId" value={coach.userId} />
                  <div className="min-w-56 flex-1 space-y-1.5">
                    <Label htmlFor={`note-${service.id}`}>What should the coach focus on?</Label>
                    <Input
                      id={`note-${service.id}`}
                      name="note"
                      maxLength={1000}
                      placeholder="Optional context — never share account credentials"
                    />
                  </div>
                  <Button type="submit" size="sm" variant="accent">
                    Request booking
                  </Button>
                </form>
              </CardContent>
            )}
          </Card>
        ))}
        {!coach.acceptingBookings && (
          <p className="text-sm text-muted">This coach is not accepting bookings right now.</p>
        )}
        {!user && (
          <Button asChild variant="outline">
            <Link href="/login">Sign in to book</Link>
          </Button>
        )}
      </div>

      {coach.reviews.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-lg font-semibold">Reviews</h2>
          {coach.reviews.map((review, index) => (
            <Card key={`${review.createdAt}-${index}`}>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{"★".repeat(review.rating)}</span>
                  <span className="text-xs text-faint">{formatDate(review.createdAt)}</span>
                </div>
                {review.body && <p className="mt-1 text-sm text-muted">{review.body}</p>}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
