import * as Linking from "expo-linking";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { Pressable, SafeAreaView, StyleSheet, Text, View } from "react-native";

import { tabForUrl, TABS, type Tab } from "./src/lib/deeplink";
import { HomeScreen } from "./src/screens/home";
import { MetaScreen } from "./src/screens/meta";
import { MoreScreen } from "./src/screens/more";
import { TrainingScreen } from "./src/screens/training";
import { theme } from "./src/theme";

const TAB_LABELS: Record<Tab, string> = {
  home: "Home",
  meta: "Meta",
  training: "Train",
  more: "More",
};

/**
 * Deliberately dependency-light navigation: four tabs on local state, with
 * clutchlab:// and https://clutchlab.app deep links resolving to tabs.
 * Graduates to expo-router when the screen graph outgrows this.
 */
export default function App() {
  const [tab, setTab] = useState<Tab>("home");

  useEffect(() => {
    let active = true;
    void Linking.getInitialURL().then((url) => {
      if (!active || !url) return;
      const target = tabForUrl(url);
      if (target) setTab(target);
    });
    const subscription = Linking.addEventListener("url", (event) => {
      const target = tabForUrl(event.url);
      if (target) setTab(target);
    });
    return () => {
      active = false;
      subscription.remove();
    };
  }, []);

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar style="light" />
      <View style={styles.content}>
        {tab === "home" && <HomeScreen />}
        {tab === "meta" && <MetaScreen />}
        {tab === "training" && <TrainingScreen />}
        {tab === "more" && <MoreScreen />}
      </View>
      <View style={styles.tabBar} accessibilityRole="tablist">
        {TABS.map((slug) => {
          const selected = tab === slug;
          return (
            <Pressable
              key={slug}
              onPress={() => setTab(slug)}
              style={styles.tabButton}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
            >
              <Text style={[styles.tabLabel, selected && styles.tabLabelActive]}>
                {TAB_LABELS[slug]}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  content: {
    flex: 1,
  },
  tabBar: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
  tabButton: {
    flex: 1,
    alignItems: "center",
    paddingVertical: theme.spacing.md,
  },
  tabLabel: {
    color: theme.colors.muted,
    fontSize: theme.text.sm,
    fontWeight: "600",
  },
  tabLabelActive: {
    color: theme.colors.accent,
  },
});
