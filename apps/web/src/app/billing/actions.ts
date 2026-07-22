"use server";

import { PAID_PLANS } from "@clutchlab/billing";
import { getServerEnv } from "@clutchlab/config/env";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { requireUser } from "@/lib/auth/gateway";
import { billingMode, getBillingProvider } from "@/lib/billing/gateway";
import { applyMockPlanSwitch, getPlanState } from "@/lib/data/billing-store";

/**
 * Checkout entry point. Stripe mode redirects to hosted checkout; the plan
 * only changes when the verified webhook lands. Mock mode (dev/test only)
 * switches instantly with a visible banner — production refuses.
 */
export async function startCheckoutAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const plan = z.enum(PAID_PLANS).parse(formData.get("plan"));
  const env = getServerEnv();

  if (billingMode() === "mock") {
    if (env.appEnv === "production") {
      redirect(
        `/billing?error=${encodeURIComponent("Billing is not configured on this deployment.")}`,
      );
    }
    applyMockPlanSwitch(user.id, plan);
    revalidatePath("/billing");
    redirect(`/billing?notice=${encodeURIComponent(`Switched to ${plan} (mock billing — no payment happened).`)}`);
  }

  const provider = getBillingProvider();
  const state = await getPlanState(user.id);
  const session = await provider.createCheckoutSession({
    userId: user.id,
    email: user.email,
    plan,
    customerId: state.stripeCustomerId,
    successUrl: `${env.NEXT_PUBLIC_APP_URL}/billing?notice=${encodeURIComponent("Checkout complete — your plan updates as soon as Stripe confirms it.")}`,
    cancelUrl: `${env.NEXT_PUBLIC_APP_URL}/billing`,
  });
  redirect(session.url);
}

/** Stripe customer portal (manage/cancel). Mock mode: downgrade button instead. */
export async function openPortalAction(): Promise<void> {
  const user = await requireUser();
  const env = getServerEnv();
  if (billingMode() === "mock") {
    redirect(`/billing?error=${encodeURIComponent("The billing portal needs Stripe configured.")}`);
  }
  const state = await getPlanState(user.id);
  if (!state.stripeCustomerId) {
    redirect(`/billing?error=${encodeURIComponent("No billing account yet — upgrade first.")}`);
  }
  const session = await getBillingProvider().createPortalSession({
    customerId: state.stripeCustomerId,
    returnUrl: `${env.NEXT_PUBLIC_APP_URL}/billing`,
  });
  redirect(session.url);
}

/** Mock-mode return to free (simulates a canceled subscription). */
export async function mockDowngradeAction(): Promise<void> {
  const user = await requireUser();
  const env = getServerEnv();
  if (billingMode() !== "mock" || env.appEnv === "production") {
    redirect(`/billing?error=${encodeURIComponent("Use the billing portal to cancel.")}`);
  }
  applyMockPlanSwitch(user.id, "free");
  revalidatePath("/billing");
  redirect(`/billing?notice=${encodeURIComponent("Back on Free (mock billing).")}`);
}
