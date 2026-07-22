import { createHmac } from "node:crypto";

import { describe, expect, it } from "vitest";

import { BillingProviderError } from "./provider";
import { StripeBillingProvider, mapStripeStatus } from "./stripe";

const PRICE_IDS = { pro: "price_pro_123", elite: "price_elite_456" } as const;
const WEBHOOK_SECRET = "whsec_test_secret";

interface Captured {
  url: string;
  body: URLSearchParams;
  auth: string | null;
}

function providerWith(
  response: Response,
  captured: Captured[] = [],
  nowSeconds?: () => number,
): StripeBillingProvider {
  const fetchFn: typeof fetch = async (input, init) => {
    captured.push({
      url: String(input),
      body: new URLSearchParams(String(init?.body)),
      auth: new Headers(init?.headers).get("authorization"),
    });
    return response;
  };
  return new StripeBillingProvider({
    secretKey: "sk_test_key",
    webhookSecret: WEBHOOK_SECRET,
    priceIds: { ...PRICE_IDS },
    fetchFn,
    nowSeconds,
  });
}

function sign(payload: string, timestamp: number, secret = WEBHOOK_SECRET): string {
  const v1 = createHmac("sha256", secret).update(`${timestamp}.${payload}`).digest("hex");
  return `t=${timestamp},v1=${v1}`;
}

describe("StripeBillingProvider", () => {
  it("creates a checkout session with the configured price and user linkage", async () => {
    const captured: Captured[] = [];
    const provider = providerWith(
      new Response(JSON.stringify({ id: "cs_123", url: "https://checkout.stripe.com/c/cs_123" }), {
        status: 200,
      }),
      captured,
    );
    const session = await provider.createCheckoutSession({
      userId: "user-1",
      email: "player@example.com",
      plan: "pro",
      customerId: null,
      successUrl: "https://app/billing?success=1",
      cancelUrl: "https://app/billing",
    });
    expect(session.url).toContain("checkout.stripe.com");
    const form = captured[0]?.body;
    expect(captured[0]?.auth).toBe("Bearer sk_test_key");
    expect(form?.get("line_items[0][price]")).toBe(PRICE_IDS.pro);
    expect(form?.get("client_reference_id")).toBe("user-1");
    expect(form?.get("subscription_data[metadata][plan]")).toBe("pro");
    expect(form?.get("customer_email")).toBe("player@example.com");
  });

  it("surfaces Stripe API errors instead of swallowing them", async () => {
    const provider = providerWith(
      new Response(JSON.stringify({ error: { message: "No such price" } }), { status: 400 }),
    );
    await expect(
      provider.createPortalSession({ customerId: "cus_1", returnUrl: "https://app/billing" }),
    ).rejects.toThrow(/No such price/);
  });

  it("accepts a correctly signed webhook and normalizes checkout completion", async () => {
    const now = 1_753_000_000;
    const provider = providerWith(new Response(null), [], () => now);
    const payload = JSON.stringify({
      type: "checkout.session.completed",
      data: {
        object: {
          client_reference_id: "user-9",
          customer: "cus_9",
          subscription: "sub_9",
          metadata: { user_id: "user-9", plan: "elite" },
        },
      },
    });
    const event = await provider.parseWebhook(payload, sign(payload, now));
    expect(event).toMatchObject({
      type: "subscription_change",
      userId: "user-9",
      customerId: "cus_9",
      subscriptionId: "sub_9",
      plan: "elite",
      status: "active",
    });
  });

  it("rejects bad signatures and stale timestamps", async () => {
    const now = 1_753_000_000;
    const provider = providerWith(new Response(null), [], () => now);
    const payload = JSON.stringify({ type: "x", data: { object: {} } });
    await expect(
      provider.parseWebhook(payload, sign(payload, now, "whsec_wrong")),
    ).rejects.toThrowError(BillingProviderError);
    await expect(
      provider.parseWebhook(payload, sign(payload, now - 10_000)),
    ).rejects.toThrow(/signature/);
  });

  it("maps subscription updates through configured price IDs", async () => {
    const now = 1_753_000_000;
    const provider = providerWith(new Response(null), [], () => now);
    const payload = JSON.stringify({
      type: "customer.subscription.updated",
      data: {
        object: {
          id: "sub_1",
          customer: "cus_1",
          status: "active",
          cancel_at_period_end: true,
          current_period_end: now + 86_400,
          metadata: { user_id: "user-1" },
          items: { data: [{ price: { id: PRICE_IDS.elite } }] },
        },
      },
    });
    const event = await provider.parseWebhook(payload, sign(payload, now));
    expect(event).toMatchObject({
      type: "subscription_change",
      plan: "elite",
      status: "active",
      cancelAtPeriodEnd: true,
      userId: "user-1",
    });
  });

  it("downgrades to free on subscription deletion", async () => {
    const now = 1_753_000_000;
    const provider = providerWith(new Response(null), [], () => now);
    const payload = JSON.stringify({
      type: "customer.subscription.deleted",
      data: {
        object: {
          id: "sub_1",
          customer: "cus_1",
          status: "canceled",
          metadata: { user_id: "user-1" },
          items: { data: [{ price: { id: PRICE_IDS.pro } }] },
        },
      },
    });
    const event = await provider.parseWebhook(payload, sign(payload, now));
    expect(event).toMatchObject({ type: "subscription_change", plan: "free", status: "canceled" });
  });

  it("ignores unrelated event types", async () => {
    const now = 1_753_000_000;
    const provider = providerWith(new Response(null), [], () => now);
    const payload = JSON.stringify({ type: "invoice.paid", data: { object: {} } });
    const event = await provider.parseWebhook(payload, sign(payload, now));
    expect(event).toMatchObject({ type: "ignored" });
  });

  it("maps ambiguous Stripe statuses conservatively", () => {
    expect(mapStripeStatus("active")).toBe("active");
    expect(mapStripeStatus("unpaid")).toBe("past_due");
    expect(mapStripeStatus("incomplete_expired")).toBe("canceled");
    expect(mapStripeStatus("paused")).toBe("canceled");
  });
});
