import { colors, tierColors } from "@clutchlab/ui/tokens";

/** Shared design tokens (drift-guarded against the web theme in packages/ui). */
export const theme = {
  colors,
  tierColors,
  spacing: { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 },
  radius: { sm: 6, md: 10 },
  text: { xs: 12, sm: 14, md: 16, lg: 20, xl: 26 },
} as const;
