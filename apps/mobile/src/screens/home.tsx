import { StyleSheet, Text, View } from "react-native";

import { Card, Muted, Pill, Screen } from "../components";
import { versionSummary } from "../lib/selectors";
import { theme } from "../theme";

export function HomeScreen() {
  const version = versionSummary();
  return (
    <Screen title="ClutchLab">
      <Card>
        <View style={styles.row}>
          <Pill label={`v${version.version}`} color={theme.colors.accent} />
          <Pill label={version.dataStatus} color={theme.colors.warning} />
          <Pill label={`confidence: ${version.confidence}`} />
        </View>
        <Text style={styles.headline}>{version.headline}</Text>
        <Muted>
          {version.releasedOn ? `Released ${version.releasedOn}` : "Release date unconfirmed"}
          {version.sourceName ? ` · source: ${version.sourceName}` : ""}
        </Muted>
      </Card>
      <Card>
        <Muted>
          Independent companion app for PUBG Mobile players. Not affiliated with, endorsed by, or
          connected to Krafton, Tencent, or Level Infinite. No gameplay automation, no overlays, no
          live-match assistance — analysis happens after the match, on recordings you upload.
        </Muted>
      </Card>
      <Card>
        <Text style={styles.sectionTitle}>Offline-ready by design</Text>
        <Muted>
          The meta snapshot, weapon notes, drills, and plans on this device are the bundled
          editorial baseline — the same records the web app seeds its database with. They work
          with no connection; live data and your account sync arrive with sign-in support.
        </Muted>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
    flexWrap: "wrap",
  },
  headline: {
    color: theme.colors.foreground,
    fontSize: theme.text.md,
    lineHeight: 22,
    marginBottom: theme.spacing.sm,
  },
  sectionTitle: {
    color: theme.colors.foreground,
    fontSize: theme.text.sm,
    fontWeight: "600",
    marginBottom: theme.spacing.xs,
  },
});
