import { createHmac, timingSafeEqual } from "node:crypto";

import { z } from "zod";

import { isPlanTier, type PaidPlan, type PlanTier } from "./entitlements";
import {
  BillingProviderError,
  type BillingEvent,
  type BillingProvider,
  type CheckoutSession,
  type PortalSession,
  type SubscriptionStatus,
} from "./provider";

/**
 * Fetch-based Stripe client — deliberately SDK-free: three endpoints, zod
 * validation, and HMAC webhook verification are all we need, and every call
 * stays testable with an injected fetch. Server-side only (secret key).
 */

const STRIPE_API = "https://api.stripe.com";
const SIGNATURE_TOLERANCE_SECONDS = 300;

const checkoutSessionSchema = z.object({ id: z.string(), url: z.string().url() });
const portalSessionSchema = z.object({ url: z.string().url() });

const eventSchema = z.object({
  type: z.string(),
  data: z.object({ object: z.unknown() }),
});

const checkoutCompletedSchema = z.object({
  client_reference_id: z.string().nullable(),
  customer: z.string(),
  subscription: z.string(),
  metadata: z.record(z.string()).nullable().default(null),
});

const subscriptionSchema = z.object({
  id: z.string(),
  customer: z.string(),
  status: z.string(),
  cancel_at_period_end: z.boolean().default(false),
  current_period_end: z.number().nullable().optional(),
  metadata: z.record(z.string()).nullable().default(null),
  items: z.object({
    data: z.array(z.object({ price: z.object({ id: z.string() }) })),
  }),
});

export function mapStripeStatus(status: string): SubscriptionStatus {
  switch (status) {
    case "active":
      return "active";
    case "trialing":
      return "trialing";
    case "past_due":
    case "unpaid":
      return "past_due";
    case "incomplete":
      return "incomplete";
    default:
      // canceled, incomplete_expired, paused, and anything Stripe adds later:
      // treat as not-entitled.
      return "canceled";
  }
}

export interface StripeBillingOptions {
  secretKey: string;
  webhookSecret: string;
  /** Configured Stripe price IDs per paid plan (never hard-coded). */
  priceIds: Record<PaidPlan, string>;
  fetchFn?: typeof fetch;
  /** Injectable clock for webhook tolerance tests. */
  nowSeconds?: () => number;
}

export class StripeBillingProvider implements BillingProvider {
  readonly mode = "stripe" as const;
  private readonly options: StripeBillingOptions;
  private readonly fetchFn: typeof fetch;

  constructor(options: StripeBillingOptions) {
    this.options = options;
    this.fetchFn = options.fetchFn ?? fetch;
  }

  private async post(path: string, form: Record<string, string>): Promise<unknown> {
    let response: Response;
    try {
      response = await this.fetchFn(`${STRIPE_API}${path}`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${this.options.secretKey}`,
          "content-type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams(form).toString(),
        signal: AbortSignal.timeout(30_000),
      });
    } catch (error) {
      throw new BillingProviderError(
        `Stripe request failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
    const body: unknown = await response.json().catch(() => null);
    if (!response.ok) {
      const message =
        typeof body === "object" && body !== null && "error" in body
          ? String((body as { error: { message?: string } }).error.message ?? response.status)
          : String(response.status);
      throw new BillingProviderError(`Stripe API error: ${message}`);
    }
    return body;
  }

  async createCheckoutSession(input: {
    userId: string;
    email: string | null;
    plan: PaidPlan;
    customerId: string | null;
    successUrl: string;
    cancelUrl: string;
  }): Promise<CheckoutSession> {
    const form: Record<string, string> = {
      mode: "subscription",
      "line_items[0][price]": this.options.priceIds[input.plan],
      "line_items[0][quantity]": "1",
      success_url: input.successUrl,
      cancel_url: input.cancelUrl,
      client_reference_id: input.userId,
      "metadata[user_id]": input.userId,
      "metadata[plan]": input.plan,
      "subscription_data[metadata][user_id]": input.userId,
      "subscription_data[metadata][plan]": input.plan,
    };
    if (input.customerId) form.customer = input.customerId;
    else if (input.email) form.customer_email = input.email;

    const body = await this.post("/v1/checkout/sessions", form);
    const parsed = checkoutSessionSchema.safeParse(body);
    if (!parsed.success) {
      throw new BillingProviderError("Stripe checkout session response had an unexpected shape");
    }
    return parsed.data;
  }

  async createPortalSession(input: {
    customerId: string;
    returnUrl: string;
  }): Promise<PortalSession> {
    const body = await this.post("/v1/billing_portal/sessions", {
      customer: input.customerId,
      return_url: input.returnUrl,
    });
    const parsed = portalSessionSchema.safeParse(body);
    if (!parsed.success) {
      throw new BillingProviderError("Stripe portal session response had an unexpected shape");
    }
    return parsed.data;
  }

  /** Stripe-Signature: t=<unix>,v1=<hmac>[,v1=...] over `${t}.${payload}`. */
  verifySignature(payload: string, signatureHeader: string): boolean {
    const parts = signatureHeader.split(",").map((p) => p.trim());
    const timestamp = parts.find((p) => p.startsWith("t="))?.slice(2);
    const signatures = parts.filter((p) => p.startsWith("v1=")).map((p) => p.slice(3));
    if (!timestamp || signatures.length === 0) return false;

    const now = this.options.nowSeconds?.() ?? Math.floor(Date.now() / 1000);
    const age = Math.abs(now - Number.parseInt(timestamp, 10));
    if (!Number.isFinite(age) || age > SIGNATURE_TOLERANCE_SECONDS) return false;

    const expected = createHmac("sha256", this.options.webhookSecret)
      .update(`${timestamp}.${payload}`)
      .digest("hex");
    const expectedBuffer = Buffer.from(expected, "hex");
    return signatures.some((candidate) => {
      const candidateBuffer = Buffer.from(candidate, "hex");
      return (
        candidateBuffer.length === expectedBuffer.length &&
        timingSafeEqual(candidateBuffer, expectedBuffer)
      );
    });
  }

  private planFromPriceId(priceId: string): PlanTier | null {
    const entries = Object.entries(this.options.priceIds) as Array<[PaidPlan, string]>;
    return entries.find(([, id]) => id === priceId)?.[0] ?? null;
  }

  async parseWebhook(payload: string, signatureHeader: string): Promise<BillingEvent> {
    if (!this.verifySignature(payload, signatureHeader)) {
      throw new BillingProviderError("invalid webhook signature");
    }
    let raw: unknown;
    try {
      raw = JSON.parse(payload);
    } catch {
      throw new BillingProviderError("webhook payload is not valid JSON");
    }
    const event = eventSchema.safeParse(raw);
    if (!event.success) {
      throw new BillingProviderError("webhook event had an unexpected shape");
    }

    switch (event.data.type) {
      case "checkout.session.completed": {
        const session = checkoutCompletedSchema.safeParse(event.data.data.object);
        if (!session.success) {
          return { type: "ignored", reason: "checkout session shape not recognized" };
        }
        const metadataPlan = session.data.metadata?.plan;
        const plan: PlanTier =
          metadataPlan && isPlanTier(metadataPlan) ? metadataPlan : "pro";
        return {
          type: "subscription_change",
          userId: session.data.client_reference_id ?? session.data.metadata?.user_id ?? null,
          customerId: session.data.customer,
          subscriptionId: session.data.subscription,
          plan,
          status: "active",
          currentPeriodEnd: null,
          cancelAtPeriodEnd: false,
        };
      }
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const subscription = subscriptionSchema.safeParse(event.data.data.object);
        if (!subscription.success) {
          return { type: "ignored", reason: "subscription shape not recognized" };
        }
        const deleted = event.data.type === "customer.subscription.deleted";
        const priceId = subscription.data.items.data[0]?.price.id ?? "";
        const status = deleted ? "canceled" : mapStripeStatus(subscription.data.status);
        const entitled = status === "active" || status === "trialing" || status === "past_due";
        const plan = entitled ? (this.planFromPriceId(priceId) ?? "free") : "free";
        return {
          type: "subscription_change",
          userId: subscription.data.metadata?.user_id ?? null,
          customerId: subscription.data.customer,
          subscriptionId: subscription.data.id,
          plan,
          status,
          currentPeriodEnd: subscription.data.current_period_end
            ? new Date(subscription.data.current_period_end * 1000).toISOString()
            : null,
          cancelAtPeriodEnd: subscription.data.cancel_at_period_end,
        };
      }
      default:
        return { type: "ignored", reason: `unhandled event type: ${event.data.type}` };
    }
  }
}
