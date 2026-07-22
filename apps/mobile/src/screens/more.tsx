import * as Linking from "expo-linking";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Card, Muted, Screen } from "../components";
import { buildWebUrl } from "../lib/deeplink";
import { theme } from "../theme";

const WEB_FEATURES: Array<{ label: string; path: string; note: string }> = [
  { label: "AI Coach", path: "/coach", note: "Upload recordings, get post-match reports" },
  { label: "Sensitivity builder", path: "/settings/sensitivity", note: "Profiles, calibration, versions" },
  { label: "Control Layout Studio", path: "/controls", note: "Visual editor + ergonomics analysis" },
  { label: "Pro settings vault", path: "/pros", note: "Verified pro configs, compare + fork" },
  { label: "Community", path: "/community", note: "Moderated discussions and settings shares" },
  { label: "Plans & billing", path: "/billing", note: "Free / Pro / Elite entitlements" },
];

export function MoreScreen() {
  return (
    <Screen title="More">
      <Muted>
        Account features open in the web app until mobile sign-in ships — your data is the same in
        both places.
      </Muted>
      <View style={{ height: theme.spacing.md }} />
      {WEB_FEATURES.map((feature) => (
        <Card key={feature.path}>
          <Pressable
            onPress={() => {
              // Fire-and-forget: failures surface through the OS link handler.
              void Linking.openURL(buildWebUrl(feature.path));
            }}
            accessibilityRole="link"
          >
            <Text style={styles.linkLabel}>{feature.label} ↗</Text>
            <Muted>{feature.note}</Muted>
          </Pressable>
        </Card>
      ))}

      <View style={{ height: theme.spacing.md }} />
      <Card>
        <Text style={styles.linkLabel}>Notifications</Text>
        <Muted>
          Patch alerts, pro-settings updates, and training reminders arrive here once push
          credentials are configured (see MOBILE.md). Notification preferences stay opt-in and
          granular — nothing is on by default.
        </Muted>
      </Card>
      <Card>
        <Muted>
          ClutchLab is an independent companion app. Not affiliated with Krafton, Tencent, or
          Level Infinite. No gameplay automation, ever. Recordings are analyzed only after the
          match, only when you upload them, and you can delete them — and everything derived from
          them — at any time.
        </Muted>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  linkLabel: {
    color: theme.colors.accent,
    fontSize: theme.text.md,
    fontWeight: "600",
    marginBottom: 2,
  },
});
