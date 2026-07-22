import type { PaidPlan, PlanTier } from "./entitlements";

/**
 * Billing provider abstraction: the app talks to this interface only.
 * Real implementation: stripe.ts. Credential-free dev/test: stripe.mock.ts.
 */

export type SubscriptionStatus = "active" | "trialing" | "past_due" | "canceled" | "incomplete";

export interface CheckoutSession {
  id: string;
  /** Hosted checkout URL to redirect the user to. */
  url: string;
}

export interface PortalSession {
  url: string;
}

/** Normalized webhook outcome the app persists. */
export type BillingEvent =
  | {
      type: "subscription_change";
      /** Our user id when derivable (client_reference_id / metadata). */
      userId: string | null;
      customerId: string;
      subscriptionId: string;
      plan: PlanTier;
      status: SubscriptionStatus;
      currentPeriodEnd: string | null;
      cancelAtPeriodEnd: boolean;
    }
  | { type: "ignored"; reason: string };

export class BillingProviderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BillingProviderError";
  }
}

export interface BillingProvider {
  readonly mode: "stripe" | "mock";
  createCheckoutSession(input: {
    userId: string;
    email: string | null;
    plan: PaidPlan;
    customerId: string | null;
    successUrl: string;
    cancelUrl: string;
  }): Promise<CheckoutSession>;
  createPortalSession(input: { customerId: string; returnUrl: string }): Promise<PortalSession>;
  /**
   * Verify the webhook signature and normalize the event.
   * Throws BillingProviderError on an invalid signature.
   */
  parseWebhook(payload: string, signatureHeader: string): Promise<BillingEvent>;
}
