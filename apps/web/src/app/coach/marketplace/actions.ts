"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { requireUser } from "@/lib/auth/gateway";
import { checkRoleAtLeast } from "@/lib/auth/roles";
import { getMarketplaceStore } from "@/lib/data/marketplace-store";

export interface MarketplaceFormState {
  error: string | null;
  ok: boolean;
}

const SERVICE_KINDS = [
  "clip_review", "full_match_review", "sensitivity_calibration", "control_layout_review",
  "ultimate_royale_prep", "squad_vod_review", "map_strategy",
] as const;

/** §5.17 hard rule: nothing that could carry account credentials. */
const CREDENTIAL_PATTERN = /password|login|account.{0,12}(share|access)|uc.{0,8}(top.?up|cheap)/i;

const applySchema = z.object({
  displayName: z.string().trim().min(3).max(60),
  headline: z.string().trim().min(10).max(120),
  bio: z.string().trim().min(20).max(2000),
  region: z.string().trim().min(2).max(20),
  languages: z.string().trim().min(2).max(60),
  credentials: z.string().trim().min(10).max(1000),
  serviceKind: z.enum(SERVICE_KINDS),
  serviceTitle: z.string().trim().min(3).max(120),
  priceUsd: z.coerce.number().min(1).max(1000),
  deliveryDays: z.coerce.number().int().min(1).max(30),
});

export async function applyAsCoachAction(
  _prev: MarketplaceFormState,
  formData: FormData,
): Promise<MarketplaceFormState> {
  const user = await requireUser();
  const parsed = applySchema.safeParse({
    displayName: formData.get("displayName"),
    headline: formData.get("headline"),
    bio: formData.get("bio"),
    region: formData.get("region"),
    languages: formData.get("languages"),
    credentials: formData.get("credentials"),
    serviceKind: formData.get("serviceKind"),
    serviceTitle: formData.get("serviceTitle"),
    priceUsd: formData.get("priceUsd"),
    deliveryDays: formData.get("deliveryDays"),
  });
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { error: issue ? `${issue.path.join(".")}: ${issue.message}` : "Invalid form.", ok: false };
  }
  const joined = `${parsed.data.headline}\n${parsed.data.bio}\n${parsed.data.serviceTitle}`;
  if (CREDENTIAL_PATTERN.test(joined)) {
    return {
      error: "Coach listings can never involve account access, credentials, or UC deals.",
      ok: false,
    };
  }

  const result = await getMarketplaceStore().applyAsCoach(user.id, {
    displayName: parsed.data.displayName,
    headline: parsed.data.headline,
    bio: parsed.data.bio,
    region: parsed.data.region,
    languages: parsed.data.languages.split(",").map((l) => l.trim().toLowerCase()).filter(Boolean),
    credentials: parsed.data.credentials,
    acceptingBookings: true,
    service: {
      kind: parsed.data.serviceKind,
      title: parsed.data.serviceTitle,
      priceCents: Math.round(parsed.data.priceUsd * 100),
      deliveryDays: parsed.data.deliveryDays,
    },
  });
  if (!result.ok) return { error: result.error, ok: false };
  revalidatePath("/coach/marketplace");
  return { error: null, ok: true };
}

export async function requestBookingAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const serviceId = z.string().min(1).parse(formData.get("serviceId"));
  const coachId = z.string().min(1).parse(formData.get("coachId"));
  const note = z.string().max(1000).parse(formData.get("note") ?? "").trim() || null;
  if (note && CREDENTIAL_PATTERN.test(note)) {
    redirect(
      `/coach/marketplace/${coachId}?error=${encodeURIComponent("Booking notes can never request account access or credentials.")}`,
    );
  }
  const result = await getMarketplaceStore().requestBooking(user.id, serviceId, note);
  if (!result.ok) {
    redirect(`/coach/marketplace/${coachId}?error=${encodeURIComponent(result.error)}`);
  }
  revalidatePath("/coach/bookings");
  redirect("/coach/bookings");
}

export async function respondToBookingAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const bookingId = z.string().min(1).parse(formData.get("bookingId"));
  const decision = z.enum(["accept", "decline"]).parse(formData.get("decision"));
  await getMarketplaceStore().respondToBooking(user.id, bookingId, decision === "accept");
  revalidatePath("/coach/bookings");
}

export async function deliverBookingAction(
  _prev: MarketplaceFormState,
  formData: FormData,
): Promise<MarketplaceFormState> {
  const user = await requireUser();
  const bookingId = z.string().min(1).parse(formData.get("bookingId"));
  const deliverable = z.string().trim().min(20).max(8000).safeParse(formData.get("deliverable"));
  if (!deliverable.success) {
    return { error: "Deliverables need at least 20 characters of real feedback.", ok: false };
  }
  const ok = await getMarketplaceStore().deliverBooking(user.id, bookingId, deliverable.data);
  if (!ok) return { error: "Only accepted bookings can be delivered.", ok: false };
  revalidatePath("/coach/bookings");
  return { error: null, ok: true };
}

export async function completeBookingAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const bookingId = z.string().min(1).parse(formData.get("bookingId"));
  await getMarketplaceStore().completeBooking(user.id, bookingId);
  revalidatePath("/coach/bookings");
}

export async function submitReviewAction(
  _prev: MarketplaceFormState,
  formData: FormData,
): Promise<MarketplaceFormState> {
  const user = await requireUser();
  const bookingId = z.string().min(1).parse(formData.get("bookingId"));
  const rating = z.coerce.number().int().min(1).max(5).safeParse(formData.get("rating"));
  if (!rating.success) return { error: "Rating must be 1–5.", ok: false };
  const body = z.string().max(1000).parse(formData.get("body") ?? "").trim() || null;
  const result = await getMarketplaceStore().submitReview(user.id, bookingId, rating.data, body);
  if (!result.ok) return { error: result.error, ok: false };
  revalidatePath("/coach/bookings");
  return { error: null, ok: true };
}

/** Editor verifies coach credentials (server-authoritative). */
export async function verifyCoachAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const allowed = await checkRoleAtLeast(user, "editor");
  if (!allowed) throw new Error("editor role required");
  const coachId = z.string().min(1).parse(formData.get("coachId"));
  await getMarketplaceStore().verifyCoach(coachId);
  revalidatePath("/admin/coach");
  revalidatePath("/coach/marketplace");
}

/** Admin marks a pending payout as paid (payout workflow). */
export async function markPayoutPaidAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const allowed = await checkRoleAtLeast(user, "admin");
  if (!allowed) throw new Error("admin role required");
  const orderId = z.string().min(1).parse(formData.get("orderId"));
  await getMarketplaceStore().markPayoutPaid(orderId);
  revalidatePath("/admin/payouts");
}
