import { NextResponse } from "next/server";

import { billingMode, getBillingProvider } from "@/lib/billing/gateway";
import { applySubscriptionChange } from "@/lib/data/billing-store";

/**
 * Stripe webhook receiver: signature-verified, then normalized and persisted
 * with the service-role client. This is the ONLY writer of subscription state
 * in Stripe mode — checkout redirects never change the plan by themselves.
 */
export async function POST(request: Request): Promise<Response> {
  if (billingMode() !== "stripe") {
    return NextResponse.json({ error: "billing is not configured" }, { status: 501 });
  }
  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "missing stripe-signature header" }, { status: 400 });
  }
  const payload = await request.text();

  let event;
  try {
    event = await getBillingProvider().parseWebhook(payload, signature);
  } catch {
    return NextResponse.json({ error: "invalid signature or payload" }, { status: 400 });
  }

  if (event.type === "ignored") {
    return NextResponse.json({ received: true, ignored: event.reason });
  }

  const result = await applySubscriptionChange(event);
  if (!result.ok) {
    // 500 makes Stripe retry — correct for transient DB failures.
    return NextResponse.json({ error: result.error }, { status: 500 });
  }
  return NextResponse.json({ received: true });
}
