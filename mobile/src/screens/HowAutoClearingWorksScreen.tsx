import React, { useCallback, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { AccountCenterSubLayout } from "../components/accountCenter/AccountCenterSubLayout";
import { autoClearPeriodLabel, readSearchHistorySettings } from "../utils/searchHistorySettings";
import { APP_LIME, APP_SURFACE, APP_TEXT, APP_TEXT_MUTED } from "../theme/appColors";

type Step = {
  icon: keyof typeof Ionicons.glyphMap;
  text: string;
};

export function HowAutoClearingWorksScreen() {
  const [periodLabel, setPeriodLabel] = useState("7 days");

  useFocusEffect(
    useCallback(() => {
      void (async () => {
        const settings = await readSearchHistorySettings();
        const label = autoClearPeriodLabel(settings.autoClearPeriod);
        setPeriodLabel(label === "Default" ? "the selected period" : label.toLowerCase());
      })();
    }, [])
  );

  const steps: Step[] = [
    {
      icon: "refresh-outline",
      text: `You enable auto-clear for searches older than ${periodLabel}.`
    },
    {
      icon: "globe-outline",
      text: "You search for — Agriculture Products"
    },
    {
      icon: "search-outline",
      text: `For the next ${periodLabel}, you can easily find that search in your history.`
    },
    {
      icon: "trash-outline",
      text: `After ${periodLabel}, the search is automatically removed from your device.`
    }
  ];

  return (
    <AccountCenterSubLayout
      title="How Auto Clearing Works"
      description={
        <Text style={styles.description}>
          We'll automatically remove your search history once it becomes older than the time period you selected.
        </Text>
      }
      contentStyle={styles.content}
    >
      <View style={styles.heroPlaceholder} />

      {steps.map((step) => (
        <View key={step.text} style={styles.stepRow}>
          <View style={styles.stepIconWrap}>
            <Ionicons name={step.icon} size={22} color={APP_LIME} />
          </View>
          <Text style={styles.stepText}>{step.text}</Text>
        </View>
      ))}
    </AccountCenterSubLayout>
  );
}

const styles = StyleSheet.create({
  description: {
    color: "#97a0a8",
    fontSize: 14,
    lineHeight: 21
  },
  content: {
    paddingBottom: 40
  },
  heroPlaceholder: {
    height: 180,
    borderRadius: 14,
    backgroundColor: APP_SURFACE,
    marginBottom: 20
  },
  stepRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    marginBottom: 16
  },
  stepIconWrap: {
    width: 28,
    alignItems: "center",
    paddingTop: 2
  },
  stepText: {
    flex: 1,
    color: APP_TEXT,
    fontSize: 14,
    lineHeight: 21
  }
});
