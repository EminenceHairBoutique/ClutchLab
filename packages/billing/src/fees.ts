/**
 * Marketplace money split (spec §14 "platform commission"). One place, so the
 * ledger CHECK (fee + net = amount) can never drift from the computation.
 */

export const PLATFORM_FEE_PERCENT = 20;

export interface FeeSplit {
  amountCents: number;
  platformFeeCents: number;
  coachNetCents: number;
}

export function computeFeeSplit(amountCents: number): FeeSplit {
  if (!Number.isInteger(amountCents) || amountCents <= 0) {
    throw new Error(`invalid order amount: ${amountCents}`);
  }
  const platformFeeCents = Math.floor((amountCents * PLATFORM_FEE_PERCENT) / 100);
  return { amountCents, platformFeeCents, coachNetCents: amountCents - platformFeeCents };
}
