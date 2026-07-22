import "server-only";

import { computeFeeSplit } from "@clutchlab/billing";
import type { Enums } from "@clutchlab/types";

import { authMode } from "@/lib/auth/gateway";
import { getMockAuthStore } from "@/lib/auth/mock-store";
import { createServerSupabase, createServiceSupabase } from "@/lib/auth/supabase-server";
import { notify } from "@/lib/notifications/notify";

/**
 * Coach marketplace store (spec §5.17). Mock mode runs the full loop
 * in-memory (payment simulated, loudly labeled); Supabase mode uses RLS for
 * the human workflow and the service client for the money ledger. Coaches
 * NEVER request game credentials — stated in UI and moderatable in reviews.
 */

export type ServiceKind = Enums<"coach_service_kind">;

export const SERVICE_KIND_LABELS: Record<ServiceKind, string> = {
  clip_review: "Clip review",
  full_match_review: "Full-match review",
  sensitivity_calibration: "Sensitivity calibration",
  control_layout_review: "Control-layout review",
  ultimate_royale_prep: "Ultimate Royale preparation",
  squad_vod_review: "Squad VOD review",
  map_strategy: "Map strategy session",
};

export interface CoachCard {
  userId: string;
  displayName: string;
  headline: string | null;
  region: string | null;
  languages: string[];
  isSample: boolean;
  acceptingBookings: boolean;
  services: ServiceView[];
  ratingAverage: number | null;
  ratingCount: number;
}

export interface ServiceView {
  id: string;
  kind: ServiceKind;
  kindLabel: string;
  title: string;
  description: string | null;
  priceCents: number;
  currency: string;
  deliveryDays: number;
}

export interface CoachDetail extends CoachCard {
  bio: string | null;
  credentials: string | null;
  availabilityNote: string | null;
  reviews: Array<{ rating: number; body: string | null; createdAt: string }>;
}

export interface BookingView {
  id: string;
  serviceTitle: string;
  coachName: string;
  playerLabel: string;
  status: string;
  note: string | null;
  deliverable: string | null;
  priceCents: number;
  currency: string;
  createdAt: string;
  reviewed: boolean;
  isCoach: boolean;
}

export interface PayoutRow {
  orderId: string;
  coachName: string;
  amountCents: number;
  platformFeeCents: number;
  coachNetCents: number;
  currency: string;
  createdAt: string;
}

export type MarketResult<T> = { ok: true; data: T } | { ok: false; error: string };

export interface MarketplaceStore {
  listCoaches(): Promise<CoachCard[]>;
  getCoach(coachId: string): Promise<CoachDetail | null>;
  getOwnCoachProfile(userId: string): Promise<{ verified: boolean; acceptingBookings: boolean } | null>;
  applyAsCoach(
    userId: string,
    input: {
      displayName: string;
      headline: string;
      bio: string;
      region: string;
      languages: string[];
      credentials: string;
      acceptingBookings: boolean;
      service: { kind: ServiceKind; title: string; priceCents: number; deliveryDays: number };
    },
  ): Promise<MarketResult<null>>;
  listUnverifiedCoaches(): Promise<Array<{ userId: string; displayName: string; credentials: string | null; createdAt: string }>>;
  verifyCoach(coachId: string): Promise<boolean>;
  requestBooking(playerId: string, serviceId: string, note: string | null): Promise<MarketResult<{ bookingId: string }>>;
  listMyBookings(userId: string): Promise<{ asPlayer: BookingView[]; asCoach: BookingView[] }>;
  respondToBooking(coachId: string, bookingId: string, accept: boolean): Promise<boolean>;
  deliverBooking(coachId: string, bookingId: string, deliverable: string): Promise<boolean>;
  completeBooking(playerId: string, bookingId: string): Promise<boolean>;
  submitReview(playerId: string, bookingId: string, rating: number, body: string | null): Promise<MarketResult<null>>;
  listPendingPayouts(): Promise<PayoutRow[]>;
  markPayoutPaid(orderId: string): Promise<boolean>;
}

function ratingSummary(ratings: number[]): { average: number | null; count: number } {
  if (ratings.length === 0) return { average: null, count: 0 };
  const sum = ratings.reduce((total, value) => total + value, 0);
  return { average: Math.round((sum / ratings.length) * 10) / 10, count: ratings.length };
}

class MockMarketplaceStore implements MarketplaceStore {
  async listCoaches(): Promise<CoachCard[]> {
    const store = getMockAuthStore();
    return store.listVerifiedCoaches().map((coach) => {
      const reviews = store.listMarketplaceReviews(coach.userId);
      const summary = ratingSummary(reviews.map((r) => r.rating));
      return {
        userId: coach.userId,
        displayName: coach.displayName,
        headline: coach.headline,
        region: coach.region,
        languages: coach.languages,
        isSample: coach.dataStatus === "sample",
        acceptingBookings: coach.acceptingBookings,
        services: store.listCoachServices(coach.userId, true).map((s) => ({
          id: s.id,
          kind: s.kind as ServiceKind,
          kindLabel: SERVICE_KIND_LABELS[s.kind as ServiceKind] ?? s.kind,
          title: s.title,
          description: s.description,
          priceCents: s.priceCents,
          currency: s.currency,
          deliveryDays: s.deliveryDays,
        })),
        ratingAverage: summary.average,
        ratingCount: summary.count,
      };
    });
  }

  async getCoach(coachId: string): Promise<CoachDetail | null> {
    const store = getMockAuthStore();
    const coach = store.getCoachProfile(coachId);
    if (!coach || !coach.verified) return null;
    const cards = await this.listCoaches();
    const card = cards.find((c) => c.userId === coachId);
    if (!card) return null;
    return {
      ...card,
      bio: coach.bio,
      credentials: coach.credentials,
      availabilityNote: coach.availabilityNote,
      reviews: store.listMarketplaceReviews(coachId).map((r) => ({
        rating: r.rating,
        body: r.body,
        createdAt: r.createdAt,
      })),
    };
  }

  async getOwnCoachProfile(userId: string) {
    const profile = getMockAuthStore().getCoachProfile(userId);
    return profile
      ? { verified: profile.verified, acceptingBookings: profile.acceptingBookings }
      : null;
  }

  async applyAsCoach(
    userId: string,
    input: Parameters<MarketplaceStore["applyAsCoach"]>[1],
  ): Promise<MarketResult<null>> {
    const store = getMockAuthStore();
    store.upsertCoachProfile(userId, {
      displayName: input.displayName,
      headline: input.headline,
      bio: input.bio,
      region: input.region,
      languages: input.languages,
      credentials: input.credentials,
      availabilityNote: null,
      acceptingBookings: input.acceptingBookings,
    });
    if (store.listCoachServices(userId, false).length === 0) {
      store.addCoachService(userId, {
        kind: input.service.kind,
        title: input.service.title,
        description: null,
        priceCents: input.service.priceCents,
        currency: "usd",
        deliveryDays: input.service.deliveryDays,
        active: true,
      });
    }
    return { ok: true, data: null };
  }

  async listUnverifiedCoaches() {
    return getMockAuthStore()
      .listUnverifiedCoaches()
      .map((c) => ({
        userId: c.userId,
        displayName: c.displayName,
        credentials: c.credentials,
        createdAt: c.createdAt,
      }));
  }

  async verifyCoach(coachId: string): Promise<boolean> {
    return getMockAuthStore().setCoachVerified(coachId, true);
  }

  async requestBooking(
    playerId: string,
    serviceId: string,
    note: string | null,
  ): Promise<MarketResult<{ bookingId: string }>> {
    const store = getMockAuthStore();
    const service = store.getCoachService(serviceId);
    if (!service || !service.active) return { ok: false, error: "Service not found." };
    const coach = store.getCoachProfile(service.coachId);
    if (!coach?.verified || !coach.acceptingBookings) {
      return { ok: false, error: "This coach is not accepting bookings." };
    }
    if (service.coachId === playerId) {
      return { ok: false, error: "You cannot book your own service." };
    }
    const fees = computeFeeSplit(service.priceCents);
    const bookingId = store.createBooking(playerId, service, note, {
      platformFeeCents: fees.platformFeeCents,
      coachNetCents: fees.coachNetCents,
    });
    await notify(service.coachId, "coach_response", {
      title: "New booking request",
      body: `A player requested "${service.title}" — accept or decline it in your bookings.`,
      path: "/coach/bookings",
    });
    return { ok: true, data: { bookingId } };
  }

  private toBookingView(
    booking: NonNullable<ReturnType<ReturnType<typeof getMockAuthStore>["getBooking"]>>,
    viewerIsCoach: boolean,
  ): BookingView {
    const store = getMockAuthStore();
    const service = store.getCoachService(booking.serviceId);
    const coach = store.getCoachProfile(booking.coachId);
    const order = store.getOrderForBooking(booking.id);
    return {
      id: booking.id,
      serviceTitle: service?.title ?? "(service removed)",
      coachName: coach?.displayName ?? "coach",
      playerLabel: "player",
      status: booking.status,
      note: booking.note,
      deliverable: booking.deliverable,
      priceCents: order?.amountCents ?? service?.priceCents ?? 0,
      currency: order?.currency ?? "usd",
      createdAt: booking.createdAt,
      reviewed: store
        .listMarketplaceReviews(booking.coachId)
        .some((r) => r.bookingId === booking.id),
      isCoach: viewerIsCoach,
    };
  }

  async listMyBookings(userId: string) {
    const store = getMockAuthStore();
    return {
      asPlayer: store.listBookingsForPlayer(userId).map((b) => this.toBookingView(b, false)),
      asCoach: store.listBookingsForCoach(userId).map((b) => this.toBookingView(b, true)),
    };
  }

  async respondToBooking(coachId: string, bookingId: string, accept: boolean): Promise<boolean> {
    const store = getMockAuthStore();
    const ok = store.respondToBooking(coachId, bookingId, accept);
    if (ok) {
      const booking = store.getBooking(bookingId);
      if (booking) {
        await notify(booking.playerId, "coach_response", {
          title: accept ? "Booking accepted" : "Booking declined",
          body: accept
            ? "Your coach accepted the session — the deliverable lands in your bookings."
            : "The coach declined this request; the mock payment was refunded.",
          path: "/coach/bookings",
        });
      }
    }
    return ok;
  }

  async deliverBooking(coachId: string, bookingId: string, deliverable: string): Promise<boolean> {
    const store = getMockAuthStore();
    const ok = store.deliverBooking(coachId, bookingId, deliverable);
    if (ok) {
      const booking = store.getBooking(bookingId);
      if (booking) {
        await notify(booking.playerId, "coach_response", {
          title: "Your coaching session was delivered",
          body: "The written deliverable is ready — confirm delivery to release the payout.",
          path: "/coach/bookings",
        });
      }
    }
    return ok;
  }

  async completeBooking(playerId: string, bookingId: string): Promise<boolean> {
    return getMockAuthStore().completeBooking(playerId, bookingId);
  }

  async submitReview(
    playerId: string,
    bookingId: string,
    rating: number,
    body: string | null,
  ): Promise<MarketResult<null>> {
    const result = getMockAuthStore().addMarketplaceReview(playerId, bookingId, rating, body);
    return result.ok ? { ok: true, data: null } : { ok: false, error: result.error ?? "Failed." };
  }

  async listPendingPayouts(): Promise<PayoutRow[]> {
    const store = getMockAuthStore();
    return store.listPendingPayouts().map((order) => ({
      orderId: order.id,
      coachName: store.getCoachProfile(order.coachId)?.displayName ?? "coach",
      amountCents: order.amountCents,
      platformFeeCents: order.platformFeeCents,
      coachNetCents: order.coachNetCents,
      currency: order.currency,
      createdAt: order.createdAt,
    }));
  }

  async markPayoutPaid(orderId: string): Promise<boolean> {
    return getMockAuthStore().markPayoutPaid(orderId);
  }
}

class SupabaseMarketplaceStore implements MarketplaceStore {
  async listCoaches(): Promise<CoachCard[]> {
    const supabase = await createServerSupabase();
    const { data: profiles, error } = await supabase
      .from("coach_profiles")
      .select("user_id, display_name, headline, region, languages, accepting_bookings, data_status")
      .eq("verified", true)
      .order("display_name");
    if (error) throw new Error(`coach directory read failed: ${error.message}`);
    const { data: services, error: servicesError } = await supabase
      .from("coach_services")
      .select("id, coach_id, kind, title, description, price_cents, currency, delivery_days")
      .eq("active", true);
    if (servicesError) throw new Error(`services read failed: ${servicesError.message}`);
    const { data: reviews, error: reviewsError } = await supabase
      .from("coach_reviews")
      .select("coach_id, rating");
    if (reviewsError) throw new Error(`reviews read failed: ${reviewsError.message}`);

    return profiles.map((p) => {
      const summary = ratingSummary(
        reviews.filter((r) => r.coach_id === p.user_id).map((r) => r.rating),
      );
      return {
        userId: p.user_id,
        displayName: p.display_name,
        headline: p.headline,
        region: p.region,
        languages: p.languages,
        isSample: p.data_status === "sample",
        acceptingBookings: p.accepting_bookings,
        services: services
          .filter((s) => s.coach_id === p.user_id)
          .map((s) => ({
            id: s.id,
            kind: s.kind,
            kindLabel: SERVICE_KIND_LABELS[s.kind] ?? s.kind,
            title: s.title,
            description: s.description,
            priceCents: s.price_cents,
            currency: s.currency,
            deliveryDays: s.delivery_days,
          })),
        ratingAverage: summary.average,
        ratingCount: summary.count,
      };
    });
  }

  async getCoach(coachId: string): Promise<CoachDetail | null> {
    const cards = await this.listCoaches();
    const card = cards.find((c) => c.userId === coachId);
    if (!card) return null;
    const supabase = await createServerSupabase();
    const { data: profile, error } = await supabase
      .from("coach_profiles")
      .select("bio, credentials, availability_note")
      .eq("user_id", coachId)
      .maybeSingle();
    if (error) throw new Error(`coach read failed: ${error.message}`);
    if (!profile) return null;
    const { data: reviews, error: reviewsError } = await supabase
      .from("coach_reviews")
      .select("rating, body, created_at")
      .eq("coach_id", coachId)
      .order("created_at", { ascending: false });
    if (reviewsError) throw new Error(`reviews read failed: ${reviewsError.message}`);
    return {
      ...card,
      bio: profile.bio,
      credentials: profile.credentials,
      availabilityNote: profile.availability_note,
      reviews: reviews.map((r) => ({ rating: r.rating, body: r.body, createdAt: r.created_at })),
    };
  }

  async getOwnCoachProfile(userId: string) {
    const supabase = await createServerSupabase();
    const { data, error } = await supabase
      .from("coach_profiles")
      .select("verified, accepting_bookings")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw new Error(`own coach profile read failed: ${error.message}`);
    return data ? { verified: data.verified, acceptingBookings: data.accepting_bookings } : null;
  }

  async applyAsCoach(
    userId: string,
    input: Parameters<MarketplaceStore["applyAsCoach"]>[1],
  ): Promise<MarketResult<null>> {
    const supabase = await createServerSupabase();
    const { error } = await supabase.from("coach_profiles").upsert(
      {
        user_id: userId,
        display_name: input.displayName,
        headline: input.headline,
        bio: input.bio,
        region: input.region,
        languages: input.languages,
        credentials: input.credentials,
        accepting_bookings: input.acceptingBookings,
      },
      { onConflict: "user_id" },
    );
    if (error) return { ok: false, error: error.message };
    const { count } = await supabase
      .from("coach_services")
      .select("id", { count: "exact", head: true })
      .eq("coach_id", userId);
    if ((count ?? 0) === 0) {
      const { error: serviceError } = await supabase.from("coach_services").insert({
        coach_id: userId,
        kind: input.service.kind,
        title: input.service.title,
        price_cents: input.service.priceCents,
        delivery_days: input.service.deliveryDays,
      });
      if (serviceError) return { ok: false, error: serviceError.message };
    }
    return { ok: true, data: null };
  }

  async listUnverifiedCoaches() {
    // Editor RLS exposes unverified profiles to reviewers only.
    const supabase = await createServerSupabase();
    const { data, error } = await supabase
      .from("coach_profiles")
      .select("user_id, display_name, credentials, created_at")
      .eq("verified", false)
      .order("created_at");
    if (error) throw new Error(`coach applications read failed: ${error.message}`);
    return data.map((c) => ({
      userId: c.user_id,
      displayName: c.display_name,
      credentials: c.credentials,
      createdAt: c.created_at,
    }));
  }

  async verifyCoach(coachId: string): Promise<boolean> {
    const supabase = await createServerSupabase();
    const { data, error } = await supabase
      .from("coach_profiles")
      .update({ verified: true })
      .eq("user_id", coachId)
      .select("user_id");
    return !error && data.length > 0;
  }

  async requestBooking(
    playerId: string,
    serviceId: string,
    note: string | null,
  ): Promise<MarketResult<{ bookingId: string }>> {
    const supabase = await createServerSupabase();
    const { data: service, error: serviceError } = await supabase
      .from("coach_services")
      .select("id, coach_id, price_cents, currency, active")
      .eq("id", serviceId)
      .maybeSingle();
    if (serviceError) return { ok: false, error: serviceError.message };
    if (!service || !service.active) return { ok: false, error: "Service not found." };
    if (service.coach_id === playerId) {
      return { ok: false, error: "You cannot book your own service." };
    }

    const { data: booking, error } = await supabase
      .from("bookings")
      .insert({
        service_id: service.id,
        coach_id: service.coach_id,
        player_id: playerId,
        note,
      })
      .select("id")
      .single();
    if (error) return { ok: false, error: error.message };
    await notify(service.coach_id, "coach_response", {
      title: "New booking request",
      body: "A player requested one of your services — accept or decline it in your bookings.",
      path: "/coach/bookings",
    });

    // Money ledger is service-role territory. Real payments need Stripe
    // Connect (see PROGRESS blockers); the pending order records the intent.
    const fees = computeFeeSplit(service.price_cents);
    const admin = createServiceSupabase();
    const { error: orderError } = await admin.from("marketplace_orders").insert({
      booking_id: booking.id,
      player_id: playerId,
      coach_id: service.coach_id,
      amount_cents: fees.amountCents,
      currency: service.currency,
      platform_fee_cents: fees.platformFeeCents,
      coach_net_cents: fees.coachNetCents,
      status: "pending_payment",
    });
    if (orderError) return { ok: false, error: orderError.message };
    return { ok: true, data: { bookingId: booking.id } };
  }

  async listMyBookings(userId: string) {
    const supabase = await createServerSupabase();
    // RLS returns only bookings where the caller is a participant.
    const { data, error } = await supabase
      .from("bookings")
      .select("id, service_id, coach_id, player_id, status, note, deliverable, created_at")
      .order("created_at", { ascending: false });
    if (error) throw new Error(`bookings read failed: ${error.message}`);
    const serviceIds = [...new Set(data.map((b) => b.service_id))];
    const { data: services, error: servicesError } = await supabase
      .from("coach_services")
      .select("id, title, price_cents, currency")
      .in("id", serviceIds.length > 0 ? serviceIds : ["00000000-0000-0000-0000-000000000000"]);
    if (servicesError) throw new Error(`services read failed: ${servicesError.message}`);
    const { data: reviews, error: reviewsError } = await supabase
      .from("coach_reviews")
      .select("booking_id");
    if (reviewsError) throw new Error(`reviews read failed: ${reviewsError.message}`);
    const reviewed = new Set(reviews.map((r) => r.booking_id));
    const serviceById = new Map(services.map((s) => [s.id, s]));

    const toView = (b: (typeof data)[number], isCoach: boolean): BookingView => ({
      id: b.id,
      serviceTitle: serviceById.get(b.service_id)?.title ?? "(service)",
      coachName: "coach",
      playerLabel: "player",
      status: b.status,
      note: b.note,
      deliverable: b.deliverable,
      priceCents: serviceById.get(b.service_id)?.price_cents ?? 0,
      currency: serviceById.get(b.service_id)?.currency ?? "usd",
      createdAt: b.created_at,
      reviewed: reviewed.has(b.id),
      isCoach,
    });

    return {
      asPlayer: data.filter((b) => b.player_id === userId).map((b) => toView(b, false)),
      asCoach: data.filter((b) => b.coach_id === userId).map((b) => toView(b, true)),
    };
  }

  async respondToBooking(coachId: string, bookingId: string, accept: boolean): Promise<boolean> {
    const supabase = await createServerSupabase();
    const { data, error } = await supabase
      .from("bookings")
      .update({
        status: accept ? "accepted" : "declined",
        responded_at: new Date().toISOString(),
      })
      .eq("id", bookingId)
      .eq("coach_id", coachId)
      .eq("status", "requested")
      .select("id, player_id");
    const ok = !error && data.length > 0;
    if (ok && data[0]) {
      await notify(data[0].player_id, "coach_response", {
        title: accept ? "Booking accepted" : "Booking declined",
        body: accept
          ? "Your coach accepted the session — the deliverable lands in your bookings."
          : "The coach declined this request.",
        path: "/coach/bookings",
      });
    }
    return ok;
  }

  async deliverBooking(coachId: string, bookingId: string, deliverable: string): Promise<boolean> {
    const supabase = await createServerSupabase();
    const { data, error } = await supabase
      .from("bookings")
      .update({ status: "delivered", deliverable, delivered_at: new Date().toISOString() })
      .eq("id", bookingId)
      .eq("coach_id", coachId)
      .eq("status", "accepted")
      .select("id, player_id");
    const ok = !error && data.length > 0;
    if (ok && data[0]) {
      await notify(data[0].player_id, "coach_response", {
        title: "Your coaching session was delivered",
        body: "The written deliverable is ready — confirm delivery to release the payout.",
        path: "/coach/bookings",
      });
    }
    return ok;
  }

  async completeBooking(playerId: string, bookingId: string): Promise<boolean> {
    const supabase = await createServerSupabase();
    const { data, error } = await supabase
      .from("bookings")
      .update({ status: "completed", completed_at: new Date().toISOString() })
      .eq("id", bookingId)
      .eq("player_id", playerId)
      .eq("status", "delivered")
      .select("id");
    if (error || data.length === 0) return false;
    const admin = createServiceSupabase();
    await admin
      .from("marketplace_orders")
      .update({ payout_status: "pending" })
      .eq("booking_id", bookingId)
      .eq("status", "paid");
    return true;
  }

  async submitReview(
    playerId: string,
    bookingId: string,
    rating: number,
    body: string | null,
  ): Promise<MarketResult<null>> {
    const supabase = await createServerSupabase();
    const { data: booking } = await supabase
      .from("bookings")
      .select("coach_id")
      .eq("id", bookingId)
      .maybeSingle();
    if (!booking) return { ok: false, error: "Booking not found." };
    const { error } = await supabase.from("coach_reviews").insert({
      booking_id: bookingId,
      coach_id: booking.coach_id,
      player_id: playerId,
      rating,
      body,
    });
    if (error) {
      return {
        ok: false,
        error:
          error.code === "23505"
            ? "You already reviewed this booking."
            : "Reviews unlock after you confirm delivery.",
      };
    }
    return { ok: true, data: null };
  }

  async listPendingPayouts(): Promise<PayoutRow[]> {
    // Admin RLS policy exposes the full ledger to admins only.
    const supabase = await createServerSupabase();
    const { data, error } = await supabase
      .from("marketplace_orders")
      .select("id, coach_id, amount_cents, platform_fee_cents, coach_net_cents, currency, created_at")
      .eq("status", "paid")
      .eq("payout_status", "pending")
      .order("created_at");
    if (error) throw new Error(`payouts read failed: ${error.message}`);
    return data.map((o) => ({
      orderId: o.id,
      coachName: o.coach_id,
      amountCents: o.amount_cents,
      platformFeeCents: o.platform_fee_cents,
      coachNetCents: o.coach_net_cents,
      currency: o.currency,
      createdAt: o.created_at,
    }));
  }

  async markPayoutPaid(orderId: string): Promise<boolean> {
    const supabase = await createServerSupabase();
    const { data, error } = await supabase
      .from("marketplace_orders")
      .update({ payout_status: "paid", payout_at: new Date().toISOString() })
      .eq("id", orderId)
      .eq("payout_status", "pending")
      .select("id");
    return !error && data.length > 0;
  }
}

export function getMarketplaceStore(): MarketplaceStore {
  return authMode() === "supabase" ? new SupabaseMarketplaceStore() : new MockMarketplaceStore();
}

export function formatPrice(cents: number, currency: string): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: currency.toUpperCase() }).format(
    cents / 100,
  );
}
