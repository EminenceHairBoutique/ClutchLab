import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Card, Muted, Pill, Screen } from "../components";
import { drillsBySkill, planList } from "../lib/selectors";
import { theme } from "../theme";

export function TrainingScreen() {
  const [expandedSkill, setExpandedSkill] = useState<string | null>(null);
  const groups = drillsBySkill();
  const plans = planList();

  return (
    <Screen title="Training academy">
      <Muted>
        {groups.reduce((sum, g) => sum + g.drills.length, 0)} drills across {groups.length} skills
        — every drill runs in modes without gameplay modification. Session tracking and the plan
        generator live in the web app until mobile sign-in ships.
      </Muted>
      <View style={{ height: theme.spacing.md }} />

      <Text style={styles.sectionTitle}>Drills by skill</Text>
      {groups.map(({ skill, drills }) => {
        const expanded = expandedSkill === skill.slug;
        return (
          <Card key={skill.slug}>
            <Pressable
              onPress={() => setExpandedSkill(expanded ? null : skill.slug)}
              accessibilityRole="button"
              accessibilityState={{ expanded }}
            >
              <View style={styles.skillRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.skillName}>{skill.name}</Text>
                  <Muted>{skill.description}</Muted>
                </View>
                <Pill label={`${drills.length} drills`} />
              </View>
            </Pressable>
            {expanded &&
              drills.map((drill) => (
                <View key={drill.slug} style={styles.drillRow}>
                  <Text style={styles.drillName}>{drill.name}</Text>
                  <Muted>
                    {drill.objective} ({drill.durationMinutes} min · {drill.difficulty}
                    {drill.aimAssistVariant ? ` · aim assist ${drill.aimAssistVariant}` : ""})
                  </Muted>
                </View>
              ))}
          </Card>
        );
      })}

      <View style={{ height: theme.spacing.md }} />
      <Text style={styles.sectionTitle}>Training plans</Text>
      {plans.map((plan) => (
        <Card key={plan.slug}>
          <View style={styles.skillRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.skillName}>{plan.name}</Text>
              <Muted>{plan.description}</Muted>
            </View>
            <Pill label={`${plan.minutes} min`} color={theme.colors.accent} />
          </View>
        </Card>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  sectionTitle: {
    color: theme.colors.foreground,
    fontSize: theme.text.lg,
    fontWeight: "600",
    marginBottom: theme.spacing.sm,
  },
  skillRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.md,
  },
  skillName: {
    color: theme.colors.foreground,
    fontSize: theme.text.md,
    fontWeight: "600",
  },
  drillRow: {
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    marginTop: theme.spacing.sm,
    paddingTop: theme.spacing.sm,
  },
  drillName: {
    color: theme.colors.foreground,
    fontSize: theme.text.sm,
    fontWeight: "600",
  },
});
