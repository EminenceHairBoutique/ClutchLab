/**
 * Design tokens as plain values for non-CSS consumers (the Expo app).
 * styles/theme.css remains the web source; tokens.test.ts parses that file
 * and fails on ANY drift between the two — update both together.
 * This module must stay dependency- and react-free.
 */

export const colors = {
  background: "#0a0b0d",
  surface: "#14161a",
  surfaceRaised: "#1b1e24",
  border: "#272b33",
  borderStrong: "#3a404b",
  foreground: "#e9ebee",
  muted: "#9aa1ac",
  faint: "#6b7280",
  accent: "#00e5a0",
  accentHover: "#33ecb5",
  accentForeground: "#04150e",
  success: "#34d399",
  warning: "#fbbf24",
  danger: "#f87171",
  info: "#38bdf8",
  tierS: "#fb7185",
  tierA: "#fbbf24",
  tierB: "#34d399",
  tierC: "#38bdf8",
  tierD: "#a78bfa",
  tierF: "#9ca3af",
} as const;

export type ColorToken = keyof typeof colors;

/** Tier letter → color, always paired with a visible letter label. */
export const tierColors: Record<"S" | "A" | "B" | "C" | "D" | "F", string> = {
  S: colors.tierS,
  A: colors.tierA,
  B: colors.tierB,
  C: colors.tierC,
  D: colors.tierD,
  F: colors.tierF,
};
