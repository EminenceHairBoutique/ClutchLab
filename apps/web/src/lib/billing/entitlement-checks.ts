import "server-only";

import { withinLimit } from "@clutchlab/billing";

import { getControlsStore } from "@/lib/data/controls-store";
import { getSensitivityStore } from "@/lib/data/sensitivity-store";

import { getUserEntitlements } from "../data/billing-store";

/**
 * Server-side entitlement gates for creation limits (§14). Single enforcement
 * point used by every creating action — features never compare plan strings.
 */

export type EntitlementCheck = { ok: true } | { ok: false; error: string };

export async function checkCanCreateSensitivityProfile(userId: string): Promise<EntitlementCheck> {
  const { entitlements } = await getUserEntitlements(userId);
  const existing = await getSensitivityStore().listProfiles(userId);
  if (withinLimit(entitlements.sensitivityProfiles, existing.length)) return { ok: true };
  return {
    ok: false,
    error: `Your plan includes ${String(entitlements.sensitivityProfiles)} saved sensitivity ` +
      "profile(s). Upgrade on the Billing page for unlimited profiles.",
  };
}

export async function checkCanCreateControlLayout(userId: string): Promise<EntitlementCheck> {
  const { entitlements } = await getUserEntitlements(userId);
  const existing = await getControlsStore().listLayouts(userId);
  if (withinLimit(entitlements.controlLayouts, existing.length)) return { ok: true };
  return {
    ok: false,
    error: `Your plan includes ${String(entitlements.controlLayouts)} saved control layout(s). ` +
      "Upgrade on the Billing page for unlimited layouts.",
  };
}
