import type { PropsWithChildren } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import { theme } from "./theme";

/** Minimal shared primitives mirroring the web design system's look. */

export function Screen({ title, children }: PropsWithChildren<{ title: string }>) {
  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={{ padding: theme.spacing.lg, paddingBottom: theme.spacing.xl * 2 }}
    >
      <Text style={styles.h1}>{title}</Text>
      {children}
    </ScrollView>
  );
}

export function Card({ children }: PropsWithChildren) {
  return <View style={styles.card}>{children}</View>;
}

export function Muted({ children }: PropsWithChildren) {
  return <Text style={styles.muted}>{children}</Text>;
}

export function Pill({ label, color }: { label: string; color?: string }) {
  return (
    <View style={[styles.pill, color ? { borderColor: color } : null]}>
      <Text style={[styles.pillText, color ? { color } : null]}>{label}</Text>
    </View>
  );
}

export function TierPill({ tier }: { tier: "S" | "A" | "B" | "C" | "D" | "F" }) {
  // Color is never the only carrier of meaning — the letter is the label.
  return <Pill label={`Tier ${tier}`} color={theme.tierColors[tier]} />;
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  h1: {
    color: theme.colors.foreground,
    fontSize: theme.text.xl,
    fontWeight: "700",
    marginBottom: theme.spacing.md,
  },
  card: {
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.border,
    borderWidth: 1,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.sm,
  },
  muted: {
    color: theme.colors.muted,
    fontSize: theme.text.sm,
    lineHeight: 20,
  },
  pill: {
    alignSelf: "flex-start",
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 999,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 2,
  },
  pillText: {
    color: theme.colors.muted,
    fontSize: theme.text.xs,
    fontWeight: "600",
  },
});
