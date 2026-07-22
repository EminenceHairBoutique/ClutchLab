import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Card, Muted, Screen, TierPill } from "../components";
import { MODE_LABELS, snapshotMeta, tierList } from "../lib/selectors";
import { theme } from "../theme";

const MODES = Object.keys(MODE_LABELS);

export function MetaScreen() {
  const [mode, setMode] = useState<string>(MODES[0] ?? "classic_ranked");
  const rows = tierList(mode);
  const snapshot = snapshotMeta();

  return (
    <Screen title="Weapon meta">
      <View style={styles.modeRow}>
        {MODES.map((slug) => (
          <Pressable
            key={slug}
            onPress={() => setMode(slug)}
            style={[styles.modeButton, mode === slug && styles.modeButtonActive]}
            accessibilityRole="button"
            accessibilityState={{ selected: mode === slug }}
          >
            <Text style={[styles.modeText, mode === slug && styles.modeTextActive]}>
              {MODE_LABELS[slug] ?? slug}
            </Text>
          </Pressable>
        ))}
      </View>
      <Muted>
        Editorial baseline {snapshot.slug} · methodology v{snapshot.methodologyVersion}. Scores are
        explained, low-confidence, and never claim guaranteed outcomes.
      </Muted>
      <View style={{ height: theme.spacing.md }} />
      {rows.map((row) => (
        <Card key={row.slug}>
          <View style={styles.weaponRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.weaponName}>{row.name}</Text>
              <Muted>
                {row.weaponClass} · score {row.score}
              </Muted>
            </View>
            <TierPill tier={row.tier} />
          </View>
          {row.changeNote ? <Text style={styles.changeNote}>4.5: {row.changeNote}</Text> : null}
        </Card>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  modeRow: {
    flexDirection: "row",
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.md,
  },
  modeButton: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.sm,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs,
  },
  modeButtonActive: {
    borderColor: theme.colors.accent,
    backgroundColor: theme.colors.surfaceRaised,
  },
  modeText: {
    color: theme.colors.muted,
    fontSize: theme.text.sm,
  },
  modeTextActive: {
    color: theme.colors.accent,
    fontWeight: "600",
  },
  weaponRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.md,
  },
  weaponName: {
    color: theme.colors.foreground,
    fontSize: theme.text.md,
    fontWeight: "600",
  },
  changeNote: {
    color: theme.colors.warning,
    fontSize: theme.text.xs,
    marginTop: theme.spacing.xs,
  },
});
