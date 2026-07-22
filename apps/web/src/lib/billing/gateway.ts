import "server-only";

import {
  MockBillingProvider,
  StripeBillingProvider,
  type BillingProvider,
} from "@clutchlab/billing";
import { getServerEnv } from "@clutchlab/config/env";

/**
 * Billing provider selection: Stripe when fully configured (env validation
 * guarantees webhook secret + price IDs come with the key), otherwise the
 * mock. Production never silently mocks — billing actions check the mode and
 * show the unconfigured state instead.
 */

export type BillingMode = "stripe" | "mock";

export function billingMode(): BillingMode {
  return getServerEnv().STRIPE_SECRET_KEY ? "stripe" : "mock";
}

export function getBillingProvider(): BillingProvider {
  const env = getServerEnv();
  if (env.STRIPE_SECRET_KEY && env.STRIPE_WEBHOOK_SECRET && env.STRIPE_PRICE_PRO && env.STRIPE_PRICE_ELITE) {
    return new StripeBillingProvider({
      secretKey: env.STRIPE_SECRET_KEY,
      webhookSecret: env.STRIPE_WEBHOOK_SECRET,
      priceIds: { pro: env.STRIPE_PRICE_PRO, elite: env.STRIPE_PRICE_ELITE },
    });
  }
  return new MockBillingProvider();
}
