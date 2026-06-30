import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { AccountCenterSubLayout } from "../components/accountCenter/AccountCenterSubLayout";
import type { RootStackParamList } from "../navigation/rootStackTypes";
import { APP_LIME, APP_TEXT, APP_TEXT_MUTED, APP_TEXT_ON_LIME } from "../theme/appColors";

const POINTS: Array<{ icon: keyof typeof Ionicons.glyphMap; text: string }> = [
  {
    icon: "people-outline",
    text: "This preference applies to all accounts linked to your cropvibe profile."
  },
  {
    icon: "ban-outline",
    text: "You will stop receiving future activity from businesses and partners."
  },
  {
    icon: "trash-outline",
    text: "Existing off-cropvibe activity history on this device will be cleared."
  },
  {
    icon: "sparkles-outline",
    text: "Recommendations and insights may become less relevant."
  },
  {
    icon: "link-outline",
    text: "Connected features may lose personalization until you reconnect activity."
  },
  {
    icon: "shield-checkmark-outline",
    text: "Limited non-personalized data may still be used for security and analytics."
  },
  {
    icon: "newspaper-outline",
    text: "Ads will still appear, but they may be less relevant to your interests."
  }
];

export function WhatYouShouldKnowScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const disconnect = () => {
    navigation.navigate("ConfirmItsYou", {
      title: "Confirm It's You",
      description: "Re-enter your password to disconnect future off-cropvibe activity.",
      action: "disconnectFutureActivity"
    });
  };

  return (
    <AccountCenterSubLayout
      title="What You Should Know"
      description={
        <Text style={styles.description}>
          Before you disconnect future activity, here are a few important things to keep in mind.
        </Text>
      }
      contentStyle={styles.content}
    >
      {POINTS.map((point) => (
        <View key={point.text} style={styles.pointRow}>
          <View style={styles.pointIconWrap}>
            <Ionicons name={point.icon} size={22} color={APP_LIME} />
          </View>
          <Text style={styles.pointText}>{point.text}</Text>
        </View>
      ))}

      <View style={styles.actions}>
        <Pressable style={styles.cancelBtn} onPress={() => navigation.goBack()} accessibilityRole="button">
          <Text style={styles.cancelBtnText}>Cancel</Text>
        </Pressable>
        <Pressable style={styles.primaryBtn} onPress={disconnect} accessibilityRole="button">
          <Text style={styles.primaryBtnText}>Disconnect Future Activity</Text>
        </Pressable>
      </View>
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
    paddingBottom: 24
  },
  pointRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    marginBottom: 16
  },
  pointIconWrap: {
    width: 28,
    alignItems: "center",
    paddingTop: 2
  },
  pointText: {
    flex: 1,
    color: APP_TEXT,
    fontSize: 14,
    lineHeight: 21
  },
  actions: {
    gap: 12,
    marginTop: 8
  },
  cancelBtn: {
    minHeight: 48,
    borderRadius: 12,
    backgroundColor: "#303030",
    alignItems: "center",
    justifyContent: "center"
  },
  cancelBtnText: {
    color: APP_TEXT,
    fontSize: 15,
    fontWeight: "700"
  },
  primaryBtn: {
    minHeight: 48,
    borderRadius: 12,
    backgroundColor: APP_LIME,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12
  },
  primaryBtnText: {
    color: APP_TEXT_ON_LIME,
    fontSize: 15,
    fontWeight: "700",
    textAlign: "center"
  }
});
