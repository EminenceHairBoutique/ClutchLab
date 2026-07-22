import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { colors } from "./tokens";

/** tokens.ts ↔ theme.css drift guard: the CSS stays the web source of truth. */

const themeCss = readFileSync(
  path.join(path.dirname(fileURLToPath(import.meta.url)), "styles", "theme.css"),
  "utf8",
);

function cssVar(name: string): string {
  const match = new RegExp(`--color-${name}:\\s*(#[0-9a-fA-F]{6})`).exec(themeCss);
  if (!match?.[1]) throw new Error(`--color-${name} not found in theme.css`);
  return match[1].toLowerCase();
}

const TOKEN_TO_CSS: Record<keyof typeof colors, string> = {
  background: "background",
  surface: "surface",
  surfaceRaised: "surface-raised",
  border: "border",
  borderStrong: "border-strong",
  foreground: "foreground",
  muted: "muted",
  faint: "faint",
  accent: "accent",
  accentHover: "accent-hover",
  accentForeground: "accent-foreground",
  success: "success",
  warning: "warning",
  danger: "danger",
  info: "info",
  tierS: "tier-s",
  tierA: "tier-a",
  tierB: "tier-b",
  tierC: "tier-c",
  tierD: "tier-d",
  tierF: "tier-f",
};

describe("design tokens", () => {
  it("matches styles/theme.css exactly (no drift)", () => {
    for (const [token, cssName] of Object.entries(TOKEN_TO_CSS)) {
      expect(colors[token as keyof typeof colors].toLowerCase(), `token ${token}`).toBe(
        cssVar(cssName),
      );
    }
  });
});
