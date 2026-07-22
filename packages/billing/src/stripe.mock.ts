import type { PaidPlan } from "./entitlements";
import {
  BillingProviderError,
  type BillingEvent,
  type BillingProvider,
  type CheckoutSession,
  type PortalSession,
} from "./provider";

/**
 * MOCK billing provider (spec §0.1.7): active when Stripe is not configured.
 * There is no hosted checkout — the "checkout" resolves straight to the
 * success URL and the caller (mock billing store) applies the plan change
 * directly, with a visible mock-billing notice in the UI. Dev/test only:
 * production billing actions refuse to run in mock mode.
 */
export class MockBillingProvider implements BillingProvider {
  readonly mode = "mock" as const;

  async createCheckoutSession(input: {
    userId: string;
    email: string | null;
    plan: PaidPlan;
    customerId: string | null;
    successUrl: string;
    cancelUrl: string;
  }): Promise<CheckoutSession> {
    return { id: `mock_checkout_${input.plan}_${input.userId}`, url: input.successUrl };
  }

  async createPortalSession(input: {
    customerId: string;
    returnUrl: string;
  }): Promise<PortalSession> {
    return { url: input.returnUrl };
  }

  async parseWebhook(): Promise<BillingEvent> {
    // No real webhooks exist in mock mode; refusing loudly beats pretending.
    throw new BillingProviderError("mock billing has no webhooks — configure Stripe");
  }
}
