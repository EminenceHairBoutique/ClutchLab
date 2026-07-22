/**
 * Cost guardrails (spec §5.13.6): per-user monthly analysis quota, surfaced to
 * the user before upload. Phase 8 entitlements will vary this by plan tier;
 * until then a single conservative allowance applies to everyone.
 */

export const MONTHLY_ANALYSIS_QUOTA = 10;

export interface QuotaState {
  used: number;
  limit: number;
  remaining: number;
}

export function quotaState(usedThisMonth: number, limit = MONTHLY_ANALYSIS_QUOTA): QuotaState {
  const used = Math.max(0, usedThisMonth);
  return { used, limit, remaining: Math.max(0, limit - used) };
}

/** First instant of the current UTC month — the quota window boundary. */
export function currentQuotaWindowStart(now = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}
