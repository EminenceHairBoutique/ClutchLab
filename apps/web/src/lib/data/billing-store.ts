import "server-only";

import {
  entitlementsFor,
  isPlanTier,
  type BillingEvent,
  type PlanEntitlements,
  type PlanTier,
} from "@clutchlab/billing";

import { authMode } from "@/lib/auth/gateway";
import { getMockAuthStore } from "@/lib/auth/mock-store";
import { createServerSupabase, createServiceSupabase } from "@/lib/auth/supabase-server";

/**
 * Plan state + entitlements resolution. Reads run under the caller's session
 * (RLS scopes subscriptions to the owner); webhook writes use the service
 * client, mirroring the "server-authoritative permissions" hard rule.
 */

export interface PlanState {
  plan: PlanTier;
  status: string;
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd: string | null;
  stripeCustomerId: string | null;
}

const FREE_STATE: PlanState = {
  plan: "free",
  status: "active",
  cancelAtPeriodEnd: false,
  currentPeriodEnd: null,
  stripeCustomerId: null,
};

/** Subscription statuses that keep paid entitlements active. */
const ENTITLED_STATUSES = new Set(["active", "trialing", "past_due"]);

export async function getPlanState(userId: string): Promise<PlanState> {
  if (authMode() !== "supabase") {
    const state = getMockAuthStore().getPlanState(userId);
    return { ...FREE_STATE, ...state };
  }
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("subscriptions")
    .select("plan, status, cancel_at_period_end, current_period_end, stripe_customer_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(`subscription read failed: ${error.message}`);
  if (!data) return FREE_STATE;
  const entitled = ENTITLED_STATUSES.has(data.status);
  return {
    plan: entitled && isPlanTier(data.plan) ? data.plan : "free",
    status: data.status,
    cancelAtPeriodEnd: data.cancel_at_period_end,
    currentPeriodEnd: data.current_period_end,
    stripeCustomerId: data.stripe_customer_id,
  };
}

export async function getUserEntitlements(
  userId: string,
): Promise<{ plan: PlanTier; entitlements: PlanEntitlements }> {
  const state = await getPlanState(userId);
  return { plan: state.plan, entitlements: entitlementsFor(state.plan) };
}

/** Persist a normalized billing webhook event (service-role write). */
export async function applySubscriptionChange(
  event: Extract<BillingEvent, { type: "subscription_change" }>,
): Promise<{ ok: boolean; error?: string }> {
  if (!event.userId) {
    return { ok: false, error: "event carried no user linkage (metadata.user_id missing)" };
  }
  if (authMode() !== "supabase") {
    // Mock mode has no webhooks; kept for interface completeness in tests.
    getMockAuthStore().setPlanState(event.userId, event.plan, event.cancelAtPeriodEnd);
    return { ok: true };
  }
  const supabase = createServiceSupabase();
  const { error } = await supabase.from("subscriptions").upsert(
    {
      user_id: event.userId,
      plan: event.plan,
      status: event.status,
      stripe_customer_id: event.customerId,
      stripe_subscription_id: event.subscriptionId,
      current_period_end: event.currentPeriodEnd,
      cancel_at_period_end: event.cancelAtPeriodEnd,
    },
    { onConflict: "user_id" },
  );
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/** Mock-mode plan switch (no Stripe): applied directly with a visible banner. */
export function applyMockPlanSwitch(userId: string, plan: PlanTier): void {
  getMockAuthStore().setPlanState(userId, plan);
}
