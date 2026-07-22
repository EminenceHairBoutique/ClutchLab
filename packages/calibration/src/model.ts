import { z } from "zod";

/**
 * Sensitivity value model (spec §5.7): every in-game sensitivity slider is a
 * (family, scope) pair on a 1–300 scale, except free look which has no scope.
 */

export const FAMILIES = ["camera", "ads", "gyro", "ads_gyro", "free_look"] as const;
export type SensitivityFamily = (typeof FAMILIES)[number];

export const SCOPES = [
  "no_scope_tpp",
  "no_scope_fpp",
  "red_dot",
  "x2",
  "x3",
  "x4",
  "x6",
  "x8",
] as const;
export type SensitivityScope = (typeof SCOPES)[number];

export const SCOPE_LABEL: Record<SensitivityScope, string> = {
  no_scope_tpp: "TPP no scope",
  no_scope_fpp: "FPP no scope",
  red_dot: "Red dot / holo / iron",
  x2: "2×",
  x3: "3×",
  x4: "4× / VSS",
  x6: "6×",
  x8: "8×",
};

export const FAMILY_LABEL: Record<SensitivityFamily, string> = {
  camera: "Camera",
  ads: "ADS",
  gyro: "Gyroscope",
  ads_gyro: "ADS gyroscope",
  free_look: "Free look",
};

export const sensitivityValueSchema = z.number().int().min(1).max(300);

export interface SensitivityKey {
  family: SensitivityFamily;
  scope: SensitivityScope | null;
}

/** Stable string key for maps/records: `family:scope` or `family:-`. */
export function keyOf(key: SensitivityKey): string {
  return `${key.family}:${key.scope ?? "-"}`;
}

/** All (family, scope) slots a full profile can carry. */
export function allSlots(): SensitivityKey[] {
  const slots: SensitivityKey[] = [];
  for (const family of FAMILIES) {
    if (family === "free_look") {
      slots.push({ family, scope: null });
      continue;
    }
    for (const scope of SCOPES) {
      slots.push({ family, scope });
    }
  }
  return slots;
}

export type SensitivityValues = Record<string, number>;

export function clampValue(value: number): number {
  return Math.min(300, Math.max(1, Math.round(value)));
}
