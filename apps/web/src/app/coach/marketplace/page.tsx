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

import { MockModeBanner } from "@/components/auth/mock-mode-banner";
import { CoachApplyForm } from "@/components/coach/coach-apply-form";
import { getSessionUser } from "@/lib/auth/gateway";
import { formatPrice, getMarketplaceStore } from "@/lib/data/marketplace-store";

export const metadata: Metadata = {
  title: "Coach marketplace",
  description:
    "Book verified PUBG Mobile coaches for clip reviews, calibration, layouts, and strategy.",
};

export const dynamic = "force-dynamic";

export default async function MarketplacePage() {
  const user = await getSessionUser();
  const store = getMarketplaceStore();
  const coaches = await store.listCoaches();
  const ownProfile = user ? await store.getOwnCoachProfile(user.id) : null;

  return (
    <div className="space-y-5">
      <nav aria-label="Breadcrumb" className="text-xs text-muted">
        <Link href="/coach" className="hover:text-accent">
          Coach
        </Link>{" "}
        / Marketplace
      </nav>
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">Coach marketplace</h1>
        <p className="text-sm text-muted">
          Human coaches with editor-verified credentials. Sessions are asynchronous deliverables —
          and coaches <strong>never</strong> get your game account, credentials, or UC. Payments
          run through the platform with a {""}
          transparent fee; disputes go to moderation.
        </p>
      </div>
      <MockModeBanner />

      {user && (
        <Card>
          <CardContent className="flex flex-wrap items-center gap-3 pt-4">
            <Button asChild size="sm" variant="outline">
              <Link href="/coach/bookings">My bookings</Link>
            </Button>
            {ownProfile && (
              <Badge variant={ownProfile.verified ? "success" : "warning"}>
                {ownProfile.verified ? "you are a verified coach" : "coach application pending review"}
              </Badge>
            )}
          </CardContent>
        </Card>
      )}

      <div className="space-y-2">
        {coaches.length === 0 && (
          <p className="text-sm text-muted">No verified coaches yet.</p>
        )}
        {coaches.map((coach) => (
          <Card key={coach.userId}>
            <CardHeader className="pb-2">
              <div className="flex flex-wrap items-center gap-2">
                <CardTitle className="text-sm">
                  <Link href={`/coach/marketplace/${coach.userId}`} className="hover:text-accent">
                    {coach.displayName}
                  </Link>
                </CardTitle>
                {coach.isSample && <Badge variant="outline">sample</Badge>}
                {!coach.acceptingBookings && <Badge variant="warning">not accepting bookings</Badge>}
                {coach.ratingAverage !== null && (
                  <Badge variant="outline">
                    ★ {coach.ratingAverage} ({coach.ratingCount})
                  </Badge>
                )}
                <span className="ml-auto text-xs text-faint">
                  {coach.region} · {coach.languages.join(", ")}
                </span>
              </div>
              {coach.headline && <CardDescription>{coach.headline}</CardDescription>}
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {coach.services.map((service) => (
                <span
                  key={service.id}
                  className="rounded-md border border-border px-2 py-1 text-xs text-muted"
                >
                  {service.kindLabel} · {formatPrice(service.priceCents, service.currency)}
                </span>
              ))}
              <Button asChild size="sm" variant="outline" className="ml-auto">
                <Link href={`/coach/marketplace/${coach.userId}`}>View</Link>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {user && !ownProfile && (
        <Card>
          <CardHeader>
            <CardTitle>Become a coach</CardTitle>
            <CardDescription>
              Applications are credential-checked by editors before appearing in the directory.
              Listings must never involve account sharing, credentials, boosting, or UC deals.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <CoachApplyForm />
          </CardContent>
        </Card>
      )}
      {!user && (
        <Card>
          <CardContent className="flex items-center justify-between gap-3 pt-4">
            <p className="text-sm text-muted">Sign in to book a session or apply as a coach.</p>
            <Button asChild variant="accent">
              <Link href="/login">Sign in</Link>
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
